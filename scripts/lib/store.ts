// Shared helpers for fetchers: enforce the data contract, merge into
// append-only history, keep the last good value on failure, log events.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  CountryCode,
  CountryFile,
  Observation,
  SourceHealth,
} from "../../lib/schema";

export const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..");
export const DATA = join(ROOT, "data");

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export function assertObservation(o: Observation, ctx: string) {
  const missing = (["unit", "asOf", "period", "source", "sourceUrl", "fetchedAt"] as const).filter(
    (k) => !o[k],
  );
  if (typeof o.value !== "number" || !Number.isFinite(o.value)) missing.push("value" as never);
  if (missing.length) throw new Error(`${ctx}: observation missing ${missing.join(", ")}`);
}

export type EventEntry = {
  at: string;
  kind: "new_period" | "revision" | "source_error" | "source_recovered";
  country?: CountryCode;
  indicator?: string;
  period?: string;
  value?: number;
  previous?: number;
  unit?: string;
  source: string;
  message: string;
};

const EVENTS_PATH = join(DATA, "events.json");
const EVENTS_MAX = 500;

export function appendEvents(events: EventEntry[]) {
  if (!events.length) return;
  const log = readJson<EventEntry[]>(EVENTS_PATH, []);
  log.push(...events);
  log.sort((a, b) => a.at.localeCompare(b.at));
  writeJson(EVENTS_PATH, log.slice(-EVENTS_MAX));
}

export function countryPath(c: CountryCode) {
  return join(DATA, "series", `${c}.json`);
}

/** Merge fresh observations into a series history. Returns events for new/revised values. */
export function mergeHistory(
  file: CountryFile,
  indicator: string,
  fresh: Observation[],
): EventEntry[] {
  const events: EventEntry[] = [];
  const series = (file.series[indicator] ??= {
    id: indicator,
    country: file.country,
    history: [],
    alternatives: [],
  });
  const byAsOf = new Map(series.history.map((o) => [o.asOf, o]));
  const isFirstLoad = series.history.length === 0;
  for (const o of fresh) {
    assertObservation(o, `${file.country}/${indicator}`);
    const prev = byAsOf.get(o.asOf);
    if (!prev) {
      byAsOf.set(o.asOf, o);
      if (!isFirstLoad)
        events.push({
          at: o.fetchedAt,
          kind: "new_period",
          country: file.country,
          indicator,
          period: o.period,
          value: o.value,
          unit: o.unit,
          source: o.source,
          message: `New ${o.period} figure published`,
        });
    } else if (Math.abs(prev.value - o.value) > 1e-9 * Math.max(1, Math.abs(prev.value))) {
      byAsOf.set(o.asOf, o);
      events.push({
        at: o.fetchedAt,
        kind: "revision",
        country: file.country,
        indicator,
        period: o.period,
        value: o.value,
        previous: prev.value,
        unit: o.unit,
        source: o.source,
        message: `${o.period} figure revised`,
      });
    }
    // unchanged values keep their original fetchedAt
  }
  series.history = [...byAsOf.values()].sort((a, b) => a.asOf.localeCompare(b.asOf));
  return events;
}

const HEALTH_PATH = join(DATA, "health.json");

export function recordHealth(
  source: string,
  expectedRefreshDays: number,
  result: { ok: true } | { ok: false; error: string },
) {
  const all = readJson<Record<string, SourceHealth>>(HEALTH_PATH, {});
  const now = new Date().toISOString();
  const prev = all[source];
  const events: EventEntry[] = [];
  if (!result.ok && (!prev || !prev.lastError))
    events.push({ at: now, kind: "source_error", source, message: `Fetch failed: ${result.error}` });
  if (result.ok && prev?.lastError)
    events.push({ at: now, kind: "source_recovered", source, message: "Source recovered" });
  all[source] = {
    source,
    expectedRefreshDays,
    lastAttemptAt: now,
    lastSuccessAt: result.ok ? now : (prev?.lastSuccessAt ?? null),
    lastError: result.ok ? null : result.error,
  };
  writeJson(HEALTH_PATH, all);
  appendEvents(events);
}

/** Fetch a text body (RSS/XML) with a timeout and retries. */
export async function fetchText(url: string, tries = 2, timeoutMs = 30_000): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastErr;
}

/** The World Bank data API is often slow (single small queries can take
 *  1-2 minutes), so its calls get a long timeout; everything else uses the
 *  default. A timeout still exists so a hung connection cannot stall the job. */
export const WB_TIMEOUT_MS = 180_000;

export async function fetchJson(url: string, tries = 3, timeoutMs = 60_000): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      // abort a stalled connection so a hung request can't block the pipeline
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastErr;
}
