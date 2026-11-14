// Client-side CSV/JSON downloads built from the data already loaded in the
// page, so no extra files or servers are needed. Every row carries its source
// and as-of date, matching the dashboard's rule.
import type { DashboardData } from "./data";
import { COUNTRIES, type Observation } from "./schema";

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

const OBS_HEADER = ["id", "label", "period", "as_of", "value", "unit", "source", "source_url", "fetched_at"];
const obsRow = (id: string, label: string, o: Observation) => [id, label, o.period, o.asOf, o.value, o.unit, o.source, o.sourceUrl, o.fetchedAt];

export type ExportSet = { key: string; label: string; filename: string; mime: string; build: (d: DashboardData) => string };

export const EXPORTS: ExportSet[] = [
  {
    key: "vitals",
    label: "Vitals, all six countries (CSV)",
    filename: "ethiopia-vitals-indicators.csv",
    mime: "text/csv",
    build: (d) => {
      const rows: unknown[][] = [];
      for (const c of COUNTRIES) {
        for (const ind of d.indicators) {
          for (const o of d.countries[c.code]?.series[ind.id]?.history ?? []) rows.push([c.code, ...obsRow(ind.id, ind.label, o)]);
        }
      }
      return toCsv(["country", ...OBS_HEADER], rows);
    },
  },
  {
    key: "pulse",
    label: "Commodities and daily FX (CSV)",
    filename: "ethiopia-vitals-commodities-fx.csv",
    mime: "text/csv",
    build: (d) => toCsv(OBS_HEADER, [...d.commodities, d.fxDaily].flatMap((s) => s.history.map((o) => obsRow(s.id, s.label, o)))),
  },
  {
    key: "debt",
    label: "External debt: composition and creditors (CSV)",
    filename: "ethiopia-vitals-debt.csv",
    mime: "text/csv",
    build: (d) =>
      toCsv(
        ["kind", "name", "group", "period", "value_usd", "source"],
        [
          ...d.debt.composition.map((c) => ["class", c.label, "", c.period, Math.round(c.value), c.id === "residual" ? "computed: published total minus listed classes" : d.debt.source]),
          ...(d.debt.creditors ?? []).map((c) => ["creditor", c.name, c.group, c.period, Math.round(c.value), d.debt.source]),
        ],
      ),
  },
  {
    key: "infra",
    label: "Infrastructure projects (CSV)",
    filename: "ethiopia-vitals-infrastructure.csv",
    mime: "text/csv",
    build: (d) =>
      toCsv(
        ["callsign", "name", "type", "layer", "status", "cost_usd", "cost_note", "funders", "connects", "last_verified", "verified", "sources"],
        d.infra.map((f) => {
          const p = f.properties;
          return [p.callsign, p.name, p.type, p.layer, p.status, p.costUsd, p.costNote ?? "", p.funders.join("; "), p.connects.join("; "), p.lastVerified, p.verified, p.sources.map((s) => s.url).join(" ")];
        }),
      ),
  },
  {
    key: "all",
    label: "Everything above as one JSON file",
    filename: "ethiopia-vitals-data.json",
    mime: "application/json",
    build: (d) =>
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          note: "Every value carries its source and as-of date. Curated records carry a last-verified date.",
          indicators: d.indicators,
          countries: d.countries,
          commodities: d.commodities,
          fxDaily: d.fxDaily,
          debt: d.debt,
          infrastructure: d.infra.map((f) => f.properties),
          trade: d.trade,
          humanitarian: d.humanitarian,
        },
        null,
        2,
      ),
  },
];

export function download(set: ExportSet, d: DashboardData) {
  const blob = new Blob([set.build(d)], { type: `${set.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = set.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
