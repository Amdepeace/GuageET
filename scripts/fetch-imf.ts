// IMF DataMapper API (WEO), keyless. Used as the alternative source shown in
// detail cards. Only the period that matches the World Bank's latest period is
// stored, so the comparison is like for like and no IMF projection is shown.
// Docs: https://www.imf.org/external/datamapper/api/help
import indicators from "../config/indicators.json";
import { COUNTRIES, type CountryFile, type IndicatorConfig } from "../lib/schema";
import { countryPath, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "IMF WEO";

type DmResponse = { values?: Record<string, Record<string, Record<string, number>>> };

async function main() {
  const fetchedAt = new Date().toISOString();
  const currentYear = new Date().getUTCFullYear();
  const failures: string[] = [];
  const files = new Map(
    COUNTRIES.map((c) => [c.code, readJson<CountryFile>(countryPath(c.code), { country: c.code, series: {} })]),
  );

  for (const ind of (indicators as IndicatorConfig[]).filter((i) => i.imf)) {
    const url = `https://www.imf.org/external/datamapper/api/v1/${ind.imf}/${COUNTRIES.map((c) => c.code).join("/")}`;
    try {
      const body = (await fetchJson(url)) as DmResponse;
      const table = body.values?.[ind.imf!];
      if (!table) throw new Error(`no values for ${ind.imf}`);
      for (const c of COUNTRIES) {
        const series = files.get(c.code)!.series[ind.id];
        const latest = series?.history.at(-1);
        if (!series || !latest) continue;
        const year = latest.period;
        const v = table[c.code]?.[year];
        // skip the current calendar year and later: those are WEO projections
        if (typeof v !== "number" || Number(year) >= currentYear) {
          series.alternatives = series.alternatives.filter((a) => a.source !== SOURCE);
          continue;
        }
        series.alternatives = [
          ...series.alternatives.filter((a) => a.source !== SOURCE),
          {
            value: v,
            unit: ind.unit,
            asOf: latest.asOf,
            period: year,
            source: SOURCE,
            sourceUrl: `https://www.imf.org/external/datamapper/${ind.imf}@WEO/${c.code}`,
            fetchedAt,
          },
        ];
      }
    } catch (e) {
      failures.push(`${ind.imf}: ${(e as Error).message}`);
    }
  }
  for (const [code, file] of files) writeJson(countryPath(code), file);
  recordHealth(SOURCE, 7, failures.length ? { ok: false, error: failures.join("; ") } : { ok: true });
  console.log(`IMF: ${failures.length} failures`);
}

main().catch((e) => {
  recordHealth(SOURCE, 7, { ok: false, error: String(e?.message ?? e) });
  console.error(e);
});
