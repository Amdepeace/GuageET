// IMF World Economic Outlook via the IMF's official SDMX API (api.imf.org),
// keyless. Used as the alternative source in detail cards. (The older
// DataMapper API refuses automated clients with HTTP 403, so this newer
// official API is used instead.)
//
// Only the period that matches the World Bank's latest period is stored, and
// never a WEO projection (current year or later), so the comparison is like
// for like.
// Docs: https://portal.api.imf.org/
import indicators from "../config/indicators.json";
import { COUNTRIES, type CountryFile, type IndicatorConfig } from "../lib/schema";
import { countryPath, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "IMF WEO";
const BASE = "https://api.imf.org/external/sdmx/2.1/data/WEO";

type SdmxJson = {
  structure?: { dimensions: { series: { id: string; values: { id: string }[] }[]; observation: { id: string; values: { id: string }[] }[] } };
  dataSets?: { series: Record<string, { observations: Record<string, (string | null)[]> }> }[];
};

async function getSdmx(url: string): Promise<SdmxJson> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as SdmxJson;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastErr;
}

/** country -> year -> value, from one multi-country SDMX-JSON response */
function parse(json: SdmxJson): Record<string, Record<string, number>> {
  const dims = json.structure?.dimensions;
  const ds = json.dataSets?.[0];
  if (!dims || !ds) throw new Error("unexpected SDMX response shape");
  const countryIdx = dims.series.findIndex((d) => d.id === "COUNTRY");
  const times = dims.observation.find((d) => d.id === "TIME_PERIOD")?.values.map((v) => v.id) ?? [];
  const out: Record<string, Record<string, number>> = {};
  for (const [key, s] of Object.entries(ds.series)) {
    const country = dims.series[countryIdx].values[Number(key.split(":")[countryIdx])]?.id;
    if (!country) continue;
    for (const [t, v] of Object.entries(s.observations)) {
      const num = v?.[0] == null ? NaN : Number(v[0]);
      if (Number.isFinite(num)) (out[country] ??= {})[times[Number(t)]] = num;
    }
  }
  return out;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const currentYear = new Date().getUTCFullYear();
  const failures: string[] = [];
  const files = new Map(
    COUNTRIES.map((c) => [c.code, readJson<CountryFile>(countryPath(c.code), { country: c.code, series: {} })]),
  );
  const countryKey = COUNTRIES.map((c) => c.code).join("+");

  for (const ind of (indicators as IndicatorConfig[]).filter((i) => i.imf)) {
    try {
      const json = await getSdmx(`${BASE}/${countryKey}.${ind.imf}.A?startPeriod=2015&endPeriod=${currentYear}`);
      const byCountry = parse(json);
      for (const c of COUNTRIES) {
        const series = files.get(c.code)!.series[ind.id];
        const latest = series?.history.at(-1);
        if (!series || !latest) continue;
        const year = latest.period;
        const v = byCountry[c.code]?.[year];
        // skip the current calendar year and later: those are WEO projections
        if (typeof v !== "number" || Number(year) >= currentYear) {
          series.alternatives = series.alternatives.filter((a) => a.source !== SOURCE);
          continue;
        }
        series.alternatives = [
          ...series.alternatives.filter((a) => a.source !== SOURCE),
          {
            value: Number(v.toFixed(2)),
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
