// UN Comtrade (free tier) — top export/import partners and the trade balance
// for Ethiopia. Needs a free subscription key in COMTRADE_PRIMARY_KEY
// (stored as a GitHub Secret). Without the key the panel renders a clear
// "awaiting key" state instead of empty space.
// Docs: https://comtradeplus.un.org/  API: https://comtradeapi.un.org/
import { join } from "node:path";
import type { TradeFile, TradePartner } from "../lib/schema";
import { DATA, recordHealth, writeJson, readJson } from "./lib/store";

const SOURCE = "UN Comtrade";
const SOURCE_URL = "https://comtradeplus.un.org/";
const OUT = join(DATA, "trade.json");
const ETH = 231; // Comtrade numeric code for Ethiopia
const KEY = process.env.COMTRADE_PRIMARY_KEY || "";

type Row = { refYear: number; flowCode: string; partnerCode: number; partnerDesc: string; primaryValue: number };

async function fetchFlow(flow: "X" | "M", year: number): Promise<Row[]> {
  const url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=${ETH}&period=${year}&flowCode=${flow}&partnerCode=&cmdCode=TOTAL&motCode=0&customsCode=C00&includeDesc=true`;
  const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${flow} ${year}`);
  const body = (await res.json()) as { data?: Row[] };
  return body.data ?? [];
}

function topPartners(rows: Row[]): TradePartner[] {
  return rows
    .filter((r) => r.partnerCode !== 0 && r.primaryValue > 0) // 0 = World
    .map((r) => ({ partner: r.partnerDesc, partnerCode: String(r.partnerCode), value: r.primaryValue }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<TradeFile | null>(OUT, null);

  if (!KEY) {
    writeJson(OUT, {
      fetchedAt,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      period: "",
      available: false,
      note: "Set COMTRADE_PRIMARY_KEY (a free UN Comtrade subscription key) as a GitHub Secret to populate the trade panel.",
      exportsByPartner: [],
      importsByPartner: [],
      balance: [],
    } satisfies TradeFile);
    recordHealth(SOURCE, 40, { ok: false, error: "No COMTRADE_PRIMARY_KEY configured" });
    console.log("trade: no key configured; wrote awaiting-key state");
    return;
  }

  try {
    const thisYear = new Date().getUTCFullYear();
    let period = 0;
    let exp: Row[] = [];
    let imp: Row[] = [];
    // trade data lags; walk back until a year returns data
    for (let y = thisYear - 1; y >= thisYear - 4 && !period; y--) {
      const [x, m] = await Promise.all([fetchFlow("X", y), fetchFlow("M", y)]);
      if (x.length || m.length) {
        period = y;
        exp = x;
        imp = m;
      }
    }
    if (!period) throw new Error("no trade data in the last 4 years");

    // balance trend across available years
    const balance: TradeFile["balance"] = [];
    for (let y = period - 4; y <= period; y++) {
      try {
        const [x, m] = await Promise.all([fetchFlow("X", y), fetchFlow("M", y)]);
        const xw = x.find((r) => r.partnerCode === 0)?.primaryValue ?? x.reduce((s, r) => s + r.primaryValue, 0);
        const mw = m.find((r) => r.partnerCode === 0)?.primaryValue ?? m.reduce((s, r) => s + r.primaryValue, 0);
        if (xw || mw) balance.push({ period: String(y), exports: xw, imports: mw });
      } catch {
        /* skip a missing year */
      }
    }

    writeJson(OUT, {
      fetchedAt,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      period: String(period),
      available: true,
      note: `Latest year with data: ${period}. Trade data lags by months to years.`,
      exportsByPartner: topPartners(exp),
      importsByPartner: topPartners(imp),
      balance,
    } satisfies TradeFile);
    recordHealth(SOURCE, 40, { ok: true });
    console.log(`trade: ${period}, ${topPartners(exp).length} export partners, ${topPartners(imp).length} import partners`);
  } catch (e) {
    recordHealth(SOURCE, 40, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { fetchedAt, source: SOURCE, sourceUrl: SOURCE_URL, period: "", available: false, note: "Fetch failed; see System Health.", exportsByPartner: [], importsByPartner: [], balance: [] } satisfies TradeFile);
    console.error("trade failed, keeping last good:", (e as Error).message);
  }
}

main();
