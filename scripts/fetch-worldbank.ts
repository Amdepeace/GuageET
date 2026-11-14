// World Bank Indicators API v2 (keyless, open). Primary source for the vitals strip.
// Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
//
// The API is slow per request (often 1-2 minutes even for tiny responses), so
// all indicators are fetched in ONE batched call (indicator codes joined by ";"
// with source=2). If the batch fails, it falls back to one call per indicator
// so a single bad series cannot block the others.
import indicators from "../config/indicators.json";
import { COUNTRIES, type CountryFile, type IndicatorConfig, type Observation } from "../lib/schema";
import {
  WB_TIMEOUT_MS,
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

type WbRow = { indicator?: { id: string }; countryiso3code: string; date: string; value: number | null };

const codes = COUNTRIES.map((c) => c.code).join(";");
const range = `${FIRST_YEAR}:${new Date().getUTCFullYear()}`;

async function fetchRows(indicatorCodes: string[]): Promise<WbRow[]> {
  const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${indicatorCodes.join(";")}?source=2&format=json&per_page=5000&date=${range}`;
  const body = (await fetchJson(url, 3, WB_TIMEOUT_MS)) as [unknown, WbRow[] | null];
  const rows = body?.[1];
  if (!Array.isArray(rows)) throw new Error(`unexpected response for ${indicatorCodes.join(",")}`);
  return rows;
}

function toObservations(ind: IndicatorConfig, country: string, rows: WbRow[], fetchedAt: string): Observation[] {
  return rows
    .filter((r) => r.countryiso3code === country && r.value !== null && /^\d{4}$/.test(r.date))
    .filter((r) => !r.indicator || r.indicator.id === ind.worldBank)
    .map((r) => ({
      value: r.value as number,
      unit: ind.unit,
      asOf: `${r.date}-12-31`,
      period: r.date,
      source: SOURCE,
      sourceUrl: `https://data.worldbank.org/indicator/${ind.worldBank}?locations=${ISO2[country]}`,
      fetchedAt,
    }));
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const inds = indicators as IndicatorConfig[];
  const files = new Map(
    COUNTRIES.map((c) => [c.code, readJson<CountryFile>(countryPath(c.code), { country: c.code, series: {} })]),
  );
  const events: EventEntry[] = [];
  const failures: string[] = [];

  // indicator id -> rows
  const rowsByInd = new Map<string, WbRow[]>();
  try {
    const all = await fetchRows(inds.map((i) => i.worldBank));
    for (const i of inds) rowsByInd.set(i.id, all.filter((r) => r.indicator?.id === i.worldBank));
    console.log(`World Bank: batch ok (${all.length} rows)`);
  } catch (e) {
    console.warn(`World Bank: batch failed (${(e as Error).message}); falling back to per-indicator calls`);
    for (const i of inds) {
      try {
        rowsByInd.set(i.id, await fetchRows([i.worldBank]));
      } catch (err) {
        failures.push(`${i.worldBank}: ${(err as Error).message}`);
      }
    }
  }

  for (const ind of inds) {
    const rows = rowsByInd.get(ind.id);
    if (!rows) continue;
    for (const c of COUNTRIES) {
      const obs = toObservations(ind, c.code, rows, fetchedAt);
      if (obs.length) events.push(...mergeHistory(files.get(c.code)!, ind.id, obs));
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
