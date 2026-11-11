// Compute the what-changed feed from stored history: for every series, the
// latest period against the one before it. The UI ranks these by size of move
// and filters to what arrived since the viewer's last visit.
import { join } from "node:path";
import indicators from "../config/indicators.json";
import { COUNTRIES, type ChangeEntry, type CountryFile, type IndicatorConfig } from "../lib/schema";
import { DATA, countryPath, readJson, writeJson } from "./lib/store";

const out: ChangeEntry[] = [];
for (const c of COUNTRIES) {
  const file = readJson<CountryFile>(countryPath(c.code), { country: c.code, series: {} });
  for (const ind of indicators as IndicatorConfig[]) {
    const h = file.series[ind.id]?.history ?? [];
    if (h.length < 2) continue;
    const [prev, last] = h.slice(-2);
    out.push({
      at: last.fetchedAt,
      country: c.code,
      indicator: ind.id,
      period: last.period,
      previousPeriod: prev.period,
      value: last.value,
      previous: prev.value,
      unit: last.unit,
      // for series already in % the move is shown in percentage points instead
      pctChange: ind.format === "pct" || prev.value === 0 ? null : ((last.value - prev.value) / Math.abs(prev.value)) * 100,
      source: last.source,
    });
  }
}
writeJson(join(DATA, "changes.json"), out);
console.log(`changes: ${out.length} entries`);
