// World Bank Indicators API v2 (keyless, open). Primary source for the vitals strip.
// Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
import indicators from "../config/indicators.json";
import { COUNTRIES, type CountryFile, type IndicatorConfig, type Observation } from "../lib/schema";
import {
  appendEvents,
  countryPath,
  fetchJson,
  mergeHistory,
  readJson,
  recordHealth,
  writeJson,
  type EventEntry,
} from "./lib/store";

const SOURCE = "World Bank WDI";
const ISO2: Record<string, string> = { ETH: "ET", KEN: "KE", DJI: "DJ", EGY: "EG", SDN: "SD", TZA: "TZ" };
const FIRST_YEAR = 2010;

type WbRow = { countryiso3code: string; date: string; value: number | null };

async function main() {
  const codes = COUNTRIES.map((c) => c.code).join(";");
  const fetchedAt = new Date().toISOString();
  const files = new Map(
    COUNTRIES.map((c) => [c.code, readJson<CountryFile>(countryPath(c.code), { country: c.code, series: {} })]),
  );
  const events: EventEntry[] = [];
  const failures: string[] = [];

  for (const ind of indicators as IndicatorConfig[]) {
    const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${ind.worldBank}?format=json&per_page=1000&date=${FIRST_YEAR}:${new Date().getUTCFullYear()}`;
    try {
      const body = (await fetchJson(url)) as [unknown, WbRow[] | null];
      const rows = body?.[1];
      if (!Array.isArray(rows)) throw new Error(`unexpected response for ${ind.worldBank}`);
      for (const c of COUNTRIES) {
        const obs: Observation[] = rows
          .filter((r) => r.countryiso3code === c.code && r.value !== null && /^\d{4}$/.test(r.date))
          .map((r) => ({
            value: r.value as number,
            unit: ind.unit,
            asOf: `${r.date}-12-31`,
            period: r.date,
            source: SOURCE,
            sourceUrl: `https://data.worldbank.org/indicator/${ind.worldBank}?locations=${ISO2[c.code]}`,
            fetchedAt,
          }));
        if (obs.length) events.push(...mergeHistory(files.get(c.code)!, ind.id, obs));
      }
      // be polite: the API is free and unmetered, but we poll sparingly
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      failures.push(`${ind.worldBank}: ${(e as Error).message}`);
    }
  }

  for (const [code, file] of files) writeJson(countryPath(code), file);
  appendEvents(events);
  recordHealth(SOURCE, 1, failures.length ? { ok: false, error: failures.join("; ") } : { ok: true });
  console.log(`World Bank: ${events.length} new/revised values, ${failures.length} failures`);
}

main().catch((e) => {
  // never crash the pipeline: last good values stay in /data
  recordHealth(SOURCE, 1, { ok: false, error: String(e?.message ?? e) });
  console.error(e);
});
