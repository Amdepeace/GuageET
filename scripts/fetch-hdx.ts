// Humanitarian Data Exchange (HDX HAPI) for Ethiopia: people in need, food
// insecurity (IPC) and staple food prices. Needs a free HDX app identifier in
// HDX_APP_IDENTIFIER (a usage tag, base64 of "appname:email"; stored as a
// GitHub Secret). Without it the panel shows an "awaiting key" state.
// Each figure keeps its own reference period and provider, as HDX publishes it.
import { join } from "node:path";
import { DATA, recordHealth, writeJson, readJson } from "./lib/store";

const SOURCE = "HDX (HAPI)";
const SOURCE_URL = "https://data.humdata.org/";
const OUT = join(DATA, "humanitarian.json");
const KEY = process.env.HDX_APP_IDENTIFIER || "";
const BASE = "https://hapi.humdata.org/api/v1";
const STAPLES = ["teff", "maize", "wheat", "sorghum"];

type Row = Record<string, string | number | null>;

async function hapi(path: string, params: Record<string, string>): Promise<Row[]> {
  const qs = new URLSearchParams({ location_code: "ETH", output_format: "json", limit: "500", app_identifier: KEY, ...params });
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${BASE}/${path}?${qs}`);
    if (res.ok) return ((await res.json()) as { data?: Row[] }).data ?? [];
    if (res.status !== 429) throw new Error(`HTTP ${res.status} for ${path}`);
    lastErr = new Error(`HTTP 429 for ${path}`);
    await new Promise((r) => setTimeout(r, 3000 * (i + 1))); // back off on rate limit
  }
  throw lastErr;
}

function latestPeriod(rows: Row[]): string | null {
  const ps = rows.map((r) => String(r.reference_period_start ?? "").slice(0, 10)).filter(Boolean);
  return ps.length ? ps.sort().at(-1)! : null;
}

type HumanitarianFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  available: boolean;
  note: string;
  peopleInNeed: { value: number; population: number | null; period: string } | null;
  ipcPhase3plus: { value: number; period: string } | null;
  foodPrices: { commodity: string; price: number; unit: string; currency: string; period: string }[];
};

const awaiting = (fetchedAt: string): HumanitarianFile => ({
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  fetchedAt,
  available: false,
  note: "Set HDX_APP_IDENTIFIER (a free HDX app identifier) as a GitHub Secret to populate the humanitarian panel.",
  peopleInNeed: null,
  ipcPhase3plus: null,
  foodPrices: [],
});

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<HumanitarianFile | null>(OUT, null);
  if (!KEY) {
    writeJson(OUT, awaiting(fetchedAt));
    recordHealth(SOURCE, 30, { ok: false, error: "No HDX_APP_IDENTIFIER configured" });
    console.log("hdx: no app identifier; wrote awaiting-key state");
    return;
  }

  try {
    // people in need: national intersectoral, "in need" population, latest period
    let peopleInNeed: HumanitarianFile["peopleInNeed"] = null;
    try {
      const needs = await hapi("affected-people/humanitarian-needs", { admin_level: "0" });
      const period = latestPeriod(needs);
      const inter = needs.filter((r) => String(r.reference_period_start).slice(0, 10) === period && r.sector_code === "Intersectoral");
      const inn = inter.find((r) => r.population_status === "INN");
      const all = inter.find((r) => r.population_status === "all");
      if (inn && period) peopleInNeed = { value: Number(inn.population), population: all ? Number(all.population) : null, period };
    } catch (e) {
      console.warn("hdx needs:", (e as Error).message);
    }

    // food security: national Phase 3+ (crisis or worse), current, latest period
    let ipcPhase3plus: HumanitarianFile["ipcPhase3plus"] = null;
    try {
      const fs = await hapi("food/food-security", { admin_level: "0", ipc_type: "current" });
      const period = latestPeriod(fs);
      const p3 = fs.find((r) => String(r.reference_period_start).slice(0, 10) === period && r.ipc_phase === "3+");
      if (p3 && period) ipcPhase3plus = { value: Number(p3.population_in_phase), period };
    } catch (e) {
      console.warn("hdx food-security:", (e as Error).message);
    }

    // staple food prices: latest price per staple, averaged across reporting markets
    const foodPrices: HumanitarianFile["foodPrices"] = [];
    try {
      const fp = await hapi("food/food-price", { commodity_category: "cereals and tubers" });
      const byCommodity = new Map<string, Row[]>();
      for (const r of fp) {
        const name = String(r.commodity_name).toLowerCase();
        if (!STAPLES.some((s) => name.includes(s))) continue;
        const arr = byCommodity.get(String(r.commodity_name)) ?? [];
        arr.push(r);
        byCommodity.set(String(r.commodity_name), arr);
      }
      for (const [commodity, rows] of byCommodity) {
        const period = latestPeriod(rows)!;
        const at = rows.filter((r) => String(r.reference_period_start).slice(0, 10) === period);
        const price = at.reduce((s, r) => s + Number(r.price), 0) / at.length;
        foodPrices.push({ commodity, price: Math.round(price), unit: String(at[0].unit), currency: String(at[0].currency_code), period });
      }
      foodPrices.sort((a, b) => a.commodity.localeCompare(b.commodity));
    } catch (e) {
      console.warn("hdx food-price:", (e as Error).message);
    }

    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "Each figure carries its own reference period and original provider (WFP, IPC, OCHA). Some HDX series update infrequently.",
      peopleInNeed,
      ipcPhase3plus,
      foodPrices,
    } satisfies HumanitarianFile);
    recordHealth(SOURCE, 30, { ok: true });
    console.log(`hdx: PiN=${peopleInNeed?.value ?? "—"} IPC3+=${ipcPhase3plus?.value ?? "—"} prices=${foodPrices.length}`);
  } catch (e) {
    recordHealth(SOURCE, 30, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, awaiting(fetchedAt));
    console.error("hdx failed, keeping last good:", (e as Error).message);
  }
}

main();
