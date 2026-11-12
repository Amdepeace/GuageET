// World Bank International Debt Statistics (IDS) for Ethiopia: external-debt
// composition by creditor type, key ratios, and a trend. Keyless.
// All values are the World Bank's published figures; nothing is estimated.
import { join } from "node:path";
import { DATA, fetchJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "World Bank IDS";
const SOURCE_URL = "https://www.worldbank.org/en/programs/debt-statistics/ids";
const OUT = join(DATA, "debt.json");

const COMPOSITION: { id: string; label: string; wb: string }[] = [
  { id: "multilateral", label: "Multilateral (PPG)", wb: "DT.DOD.MLAT.CD" },
  { id: "bilateral", label: "Bilateral (PPG)", wb: "DT.DOD.BLAT.CD" },
  { id: "bonds", label: "Bonds", wb: "DT.DOD.PBND.CD" },
  { id: "commercial", label: "Commercial banks", wb: "DT.DOD.PCBK.CD" },
  { id: "other_private", label: "Other private (PPG)", wb: "DT.DOD.PROP.CD" },
  { id: "png", label: "Private non-guaranteed", wb: "DT.DOD.DPNG.CD" },
  { id: "short_term", label: "Short-term", wb: "DT.DOD.DSTC.CD" },
  { id: "imf_credit", label: "Use of IMF credit", wb: "DT.DOD.DIMF.CD" },
];
const RATIOS: { id: string; label: string; wb: string; unit: string; format: "usd" | "pct" }[] = [
  { id: "total", label: "External debt stocks", wb: "DT.DOD.DECT.CD", unit: "USD", format: "usd" },
  { id: "pct_gni", label: "External debt / GNI", wb: "DT.DOD.DECT.GN.ZS", unit: "%", format: "pct" },
  { id: "debt_service", label: "Total debt service", wb: "DT.TDS.DECT.CD", unit: "USD", format: "usd" },
  { id: "reserves_pct", label: "Reserves / external debt", wb: "DT.DOD.DECT.CD.RS.ZS", unit: "%", format: "pct" },
];

type WbRow = { date: string; value: number | null };

async function latest(wb: string): Promise<{ value: number; period: string } | null> {
  const url = `https://api.worldbank.org/v2/country/ETH/indicator/${wb}?format=json&per_page=12&mrv=8`;
  const body = (await fetchJson(url)) as [unknown, WbRow[] | null];
  const rows = body?.[1];
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((r) => r.value != null);
  return hit ? { value: hit.value as number, period: hit.date } : null;
}

async function history(wb: string): Promise<{ period: string; value: number }[]> {
  const url = `https://api.worldbank.org/v2/country/ETH/indicator/${wb}?format=json&per_page=20&date=2010:${new Date().getUTCFullYear()}`;
  const body = (await fetchJson(url)) as [unknown, WbRow[] | null];
  const rows = body?.[1];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r.value != null)
    .map((r) => ({ period: r.date, value: r.value as number }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

async function main() {
  const fetchedAt = new Date().toISOString();
  try {
    const composition = [];
    for (const c of COMPOSITION) {
      const v = await latest(c.wb);
      if (v && v.value > 0) composition.push({ id: c.id, label: c.label, value: v.value, period: v.period });
      await new Promise((r) => setTimeout(r, 250));
    }
    const ratios: Record<string, { value: number; period: string; label: string; format: string }> = {};
    for (const r of RATIOS) {
      const v = await latest(r.wb);
      if (v) ratios[r.id] = { value: v.value, period: v.period, label: r.label, format: r.format };
      await new Promise((x) => setTimeout(x, 250));
    }
    const totalHistory = await history("DT.DOD.DECT.CD");

    writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, composition, ratios, totalHistory });
    recordHealth(SOURCE, 400, { ok: true });
    console.log(`debt: ${composition.length} creditor classes, ${Object.keys(ratios).length} ratios`);
  } catch (e) {
    recordHealth(SOURCE, 400, { ok: false, error: String((e as Error).message ?? e) });
    console.error("debt failed:", (e as Error).message);
  }
}

main();
