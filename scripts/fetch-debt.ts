// World Bank International Debt Statistics (IDS) for Ethiopia. Keyless.
//
// Two routes, because the World Bank serves them differently:
//  1. Totals and ratios (external debt, % of GNI, debt service, reserves cover,
//     IMF credit, short-term debt): the standard indicator endpoint, batched
//     into one call.
//  2. Creditor breakdown (multilateral / bilateral / bonds / commercial banks,
//     by named creditor such as China, IDA, AfDB): the IDS "sources" route,
//     which returns one row per counterpart creditor.
// All values are the World Bank's published figures. The one derived line is
// "Other (residual)": the published total minus the listed classes, labelled as
// such, so the bars add up to the published total.
import { join } from "node:path";
import type { DebtFile, DebtSlice } from "../lib/schema";
import { DATA, WB_TIMEOUT_MS, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "World Bank IDS";
const SOURCE_URL = "https://www.worldbank.org/en/programs/debt-statistics/ids";
const OUT = join(DATA, "debt.json");

const RATIOS: { id: string; wb: string; label: string; format: "usd" | "pct" }[] = [
  { id: "total", wb: "DT.DOD.DECT.CD", label: "External debt stocks", format: "usd" },
  { id: "pct_gni", wb: "DT.DOD.DECT.GN.ZS", label: "External debt / GNI", format: "pct" },
  { id: "debt_service", wb: "DT.TDS.DECT.CD", label: "Total debt service", format: "usd" },
  { id: "reserves_pct", wb: "FI.RES.TOTL.DT.ZS", label: "Reserves / external debt", format: "pct" },
  { id: "imf_credit", wb: "DT.DOD.DIMF.CD", label: "Use of IMF credit", format: "usd" },
  { id: "short_term", wb: "DT.DOD.DSTC.CD", label: "Short-term debt", format: "usd" },
];

const CLASSES: { id: string; series: string; label: string }[] = [
  { id: "multilateral", series: "DT.DOD.MLAT.CD", label: "Multilateral (PPG)" },
  { id: "bilateral", series: "DT.DOD.BLAT.CD", label: "Bilateral (PPG)" },
  { id: "bonds", series: "DT.DOD.PBND.CD", label: "Bonds (PPG)" },
  { id: "commercial", series: "DT.DOD.PCBK.CD", label: "Commercial banks (PPG)" },
];

type WbRow = { indicator: { id: string }; date: string; value: number | null };
type SrcRow = { variable: { concept: string; id: string; value: string }[]; value: number | null };

const clean = (s: string) => s.replace(/[\s ]+/g, " ").trim();

async function totalsAndRatios() {
  const codes = RATIOS.map((r) => r.wb).join(";");
  const url = `https://api.worldbank.org/v2/country/ETH/indicator/${codes}?source=2&format=json&per_page=500&date=2008:${new Date().getUTCFullYear()}`;
  const body = (await fetchJson(url, 3, WB_TIMEOUT_MS)) as [unknown, WbRow[] | null];
  const rows = body?.[1];
  if (!Array.isArray(rows)) throw new Error("unexpected response for debt ratios");
  const ratios: DebtFile["ratios"] = {};
  const latestByWb = new Map<string, { value: number; period: string }>();
  for (const r of rows) {
    if (r.value == null) continue;
    const cur = latestByWb.get(r.indicator.id);
    if (!cur || r.date > cur.period) latestByWb.set(r.indicator.id, { value: r.value, period: r.date });
  }
  for (const r of RATIOS) {
    const v = latestByWb.get(r.wb);
    if (v) ratios[r.id] = { value: v.value, period: v.period, label: r.label, format: r.format };
  }
  const totalHistory = rows
    .filter((r) => r.indicator.id === "DT.DOD.DECT.CD" && r.value != null)
    .map((r) => ({ period: r.date, value: r.value as number }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return { ratios, totalHistory };
}

/** Latest year of one creditor class: the "World" row is the class total, the
 *  other rows are individual creditors. */
async function creditorClass(series: string) {
  for (let y = new Date().getUTCFullYear() - 1; y >= new Date().getUTCFullYear() - 4; y--) {
    const url = `https://api.worldbank.org/v2/sources/6/country/ETH/series/${series}/time/YR${y}?format=json&per_page=500`;
    const body = (await fetchJson(url, 3, WB_TIMEOUT_MS)) as { source?: { data?: SrcRow[] } };
    const rows = body.source?.data ?? [];
    const named = rows
      .filter((r) => r.value != null && r.value > 0)
      .map((r) => {
        const cp = r.variable.find((v) => v.concept === "Counterpart-Area");
        return { name: clean(cp?.value ?? "Unknown"), value: r.value as number };
      });
    const world = named.find((n) => n.name === "World");
    if (world) return { period: String(y), total: world.value, creditors: named.filter((n) => n.name !== "World") };
  }
  return null;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<DebtFile | null>(OUT, null);
  const failures: string[] = [];

  let ratios: DebtFile["ratios"] = {};
  let totalHistory: DebtFile["totalHistory"] = [];
  try {
    ({ ratios, totalHistory } = await totalsAndRatios());
  } catch (e) {
    failures.push(`ratios: ${(e as Error).message}`);
  }

  const composition: DebtSlice[] = [];
  const creditors: NonNullable<DebtFile["creditors"]> = [];
  const results = await Promise.allSettled(CLASSES.map((c) => creditorClass(c.series)));
  results.forEach((res, i) => {
    const cls = CLASSES[i];
    if (res.status === "rejected") {
      failures.push(`${cls.series}: ${(res.reason as Error).message}`);
      return;
    }
    if (!res.value) return;
    composition.push({ id: cls.id, label: cls.label, value: res.value.total, period: res.value.period });
    for (const c of res.value.creditors) creditors.push({ group: cls.label, name: c.name, value: c.value, period: res.value.period });
  });

  // classes served by the standard endpoint
  for (const id of ["imf_credit", "short_term"]) {
    const r = ratios[id];
    if (r) composition.push({ id, label: r.label, value: r.value, period: r.period });
    delete ratios[id]; // shown as bars, not headline ratios
  }

  // residual so the bars reach the published total (same year only)
  const total = ratios.total;
  if (total && composition.length && composition.every((c) => c.period === total.period)) {
    const residual = total.value - composition.reduce((s, c) => s + c.value, 0);
    if (residual > 0) composition.push({ id: "residual", label: "Other (residual)", value: residual, period: total.period });
  }

  if (!Object.keys(ratios).length && !composition.length) {
    // nothing usable: keep the last good file and flag the source
    recordHealth(SOURCE, 400, { ok: false, error: failures.join("; ") || "no debt data returned" });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, composition: [], ratios: {}, totalHistory: [], creditors: [] } satisfies DebtFile);
    console.error("debt failed, keeping last good:", failures.join("; "));
    return;
  }

  creditors.sort((a, b) => b.value - a.value);
  writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, composition, ratios, totalHistory, creditors: creditors.slice(0, 12) } satisfies DebtFile);
  recordHealth(SOURCE, 400, failures.length ? { ok: false, error: failures.join("; ") } : { ok: true });
  console.log(`debt: ${composition.length} classes, ${creditors.length} creditors, ${Object.keys(ratios).length} ratios, ${failures.length} failures`);
}

main();
