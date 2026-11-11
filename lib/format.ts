import type { IndicatorConfig } from "./schema";

export function formatValue(v: number, format: IndicatorConfig["format"], unit?: string): string {
  switch (format) {
    case "pct":
      return `${v.toFixed(1)}%`;
    case "usd":
      return `$${compact(v)}`;
    case "count":
      return compact(v);
    case "rate":
      return v >= 100 ? v.toFixed(1) : v.toFixed(2);
    default:
      return `${v}${unit ? " " + unit : ""}`;
  }
}

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

/** Change between two observations, as shown under a tile. */
export function formatDelta(
  last: number,
  prev: number,
  format: IndicatorConfig["format"],
): { text: string; sign: -1 | 0 | 1 } {
  const d = last - prev;
  const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
  const arrow = sign > 0 ? "▲" : sign < 0 ? "▼" : "■";
  if (format === "pct") return { text: `${arrow} ${Math.abs(d).toFixed(1)} pp`, sign };
  if (prev === 0) return { text: `${arrow} n/a`, sign };
  return { text: `${arrow} ${Math.abs((d / Math.abs(prev)) * 100).toFixed(1)}%`, sign };
}

export function formatUsd(v: number | null): string {
  return v == null ? "—" : `$${compact(v)}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}
