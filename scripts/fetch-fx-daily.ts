// Daily birr-per-USD from a keyless open FX API. The API returns only the
// current rate, so each run appends one dated point; history builds over time.
// This is the "open FX API fallback" the PRD names; NBE daily-rate scraping and
// the official/parallel gap are a later addition.
import { join } from "node:path";
import type { Observation, SimpleSeries } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson, appendEvents, type EventEntry } from "./lib/store";

const SOURCE = "open.er-api.com";
const URL = "https://open.er-api.com/v6/latest/USD";
const OUT = join(DATA, "fx-daily.json");
const KEEP = 400;

type Resp = { result: string; time_last_update_utc: string; rates: Record<string, number> };

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<SimpleSeries | null>(OUT, null);
  try {
    const d = (await fetchJson(URL)) as Resp;
    if (d.result !== "success" || typeof d.rates?.ETB !== "number") throw new Error("no ETB rate in response");
    const day = new Date(d.time_last_update_utc || fetchedAt).toISOString().slice(0, 10);
    const obs: Observation = {
      value: d.rates.ETB,
      unit: "ETB per USD",
      asOf: day,
      period: day,
      source: SOURCE,
      sourceUrl: "https://www.er-api.com/",
      fetchedAt,
    };
    const history = (prev?.history ?? []).filter((o) => o.asOf !== day);
    history.push(obs);
    history.sort((a, b) => a.asOf.localeCompare(b.asOf));
    const series: SimpleSeries = {
      id: "etb_usd_daily",
      label: "Birr per USD (daily, market)",
      callsign: "ETB/USD",
      unit: "ETB per USD",
      format: "rate",
      source: SOURCE,
      sourceUrl: "https://www.er-api.com/",
      history: history.slice(-KEEP),
    };
    writeJson(OUT, series);
    const events: EventEntry[] = [];
    const before = prev?.history.at(-1);
    if (before && before.asOf !== day && Math.abs((obs.value - before.value) / before.value) > 0.02) {
      events.push({ at: fetchedAt, kind: "new_period", indicator: "etb_usd_daily", period: day, value: obs.value, unit: obs.unit, source: SOURCE, message: `Birr/USD moved ${(((obs.value - before.value) / before.value) * 100).toFixed(1)}% vs ${before.asOf}` });
    }
    appendEvents(events);
    recordHealth(SOURCE, 1, { ok: true });
    console.log(`fx-daily: ETB/USD=${obs.value} on ${day} (${history.length} points)`);
  } catch (e) {
    recordHealth(SOURCE, 1, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { id: "etb_usd_daily", label: "Birr per USD (daily, market)", callsign: "ETB/USD", unit: "ETB per USD", format: "rate", source: SOURCE, sourceUrl: "https://www.er-api.com/", history: [] });
    console.error("fx-daily failed, keeping last good:", (e as Error).message);
  }
}

main();
