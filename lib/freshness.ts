// Data freshness rules (PRD: "Data freshness rules").
//
// Two separate signals, so annual statistics are never flagged forever and
// old figures are never shown as current:
//   1. Source health / stale: based on the last SUCCESSFUL fetch against the
//      source's expected refresh interval. Older than 2x the interval = stale.
//   2. Period lag: shown as a plain period label ("2024") on every figure.
import type { HealthStatus, SourceHealth } from "./schema";

const DAY = 86_400_000;

export function sourceStatus(h: SourceHealth | undefined, now: number): HealthStatus {
  if (!h || !h.lastSuccessAt) return "OFFLINE";
  const age = now - Date.parse(h.lastSuccessAt);
  const limit = 2 * h.expectedRefreshDays * DAY;
  if (age > limit) return "OFFLINE";
  if (h.lastError) return "DELAYED";
  return "NOMINAL";
}

export function isStale(h: SourceHealth | undefined, now: number): boolean {
  return sourceStatus(h, now) === "OFFLINE";
}

/** Same rule for live data fetched in the browser (weather): interval in minutes. */
export function liveStatus(lastSuccessAt: number | null, lastError: string | null, intervalMin: number, now: number): HealthStatus {
  if (!lastSuccessAt) return "OFFLINE";
  if (now - lastSuccessAt > 2 * intervalMin * 60_000) return "OFFLINE";
  return lastError ? "DELAYED" : "NOMINAL";
}

export const STATUS_HELP: Record<HealthStatus, string> = {
  NOMINAL: "Last fetch succeeded within the expected refresh interval.",
  DELAYED: "Latest fetch failed; last good value is still within twice the expected interval.",
  OFFLINE: "No successful fetch within twice the expected interval. Values shown are the last good ones, marked stale.",
};
