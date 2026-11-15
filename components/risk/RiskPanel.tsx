"use client";
// Risk section: what is unusually stressed right now, what others project, and
// what a small statistical model says (only when it beats a naive baseline).
// Nothing here is a probability of crisis. Every cell shows how a value ranks
// against that indicator's own history; the sources keep their own dates.
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConflictFile, CountryFile, OutlookFile, ProjectionsFile, RainfallFile, Observation } from "@/lib/schema";
import { compact } from "@/lib/format";
import { CONFLICT_COLORS } from "../map/useRiskLayers";

type Row = { id: string; label: string; basis: string; transform: "level" | "change"; stressIs: "high" | "low" };
const ROWS: Row[] = [
  { id: "inflation", label: "Inflation", basis: "level, % y/y", transform: "level", stressIs: "high" },
  { id: "gdp_growth", label: "GDP growth", basis: "level, % y/y", transform: "level", stressIs: "low" },
  { id: "fx_usd", label: "Birr depreciation", basis: "change in birr per USD", transform: "change", stressIs: "high" },
  { id: "reserves", label: "FX reserves", basis: "level, USD", transform: "level", stressIs: "low" },
  { id: "external_debt", label: "External debt growth", basis: "change in USD stock", transform: "change", stressIs: "high" },
  { id: "remittances", label: "Remittance inflows", basis: "change in USD", transform: "change", stressIs: "low" },
  { id: "fdi", label: "Foreign direct investment", basis: "level, USD", transform: "level", stressIs: "low" },
];

const year = (o: Observation) => Number(o.period.slice(0, 4));
const FROM = 2011;

type Cell = { year: number; value: number; rank: number }; // rank 0..1, 1 = most stressed relative to own history

function cells(h: Observation[], row: Row): Cell[] {
  const pts: { year: number; value: number }[] = [];
  for (let i = 0; i < h.length; i++) {
    if (row.transform === "level") pts.push({ year: year(h[i]), value: h[i].value });
    else if (i > 0 && h[i - 1].value !== 0) pts.push({ year: year(h[i]), value: ((h[i].value - h[i - 1].value) / Math.abs(h[i - 1].value)) * 100 });
  }
  const win = pts.filter((p) => p.year >= FROM);
  const sorted = [...win].map((p) => p.value).sort((a, b) => a - b);
  return win.map((p) => {
    const below = sorted.filter((v) => v < p.value).length + sorted.filter((v) => v === p.value).length / 2;
    const pr = sorted.length > 1 ? below / sorted.length : 0.5;
    return { year: p.year, value: p.value, rank: row.stressIs === "high" ? pr : 1 - pr };
  });
}

function fmt(row: Row, v: number) {
  if (row.transform === "change") return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  return row.id === "inflation" || row.id === "gdp_growth" ? `${v.toFixed(1)}%` : `$${compact(v)}`;
}

export function RiskPanel({
  eth,
  conflict,
  rainfall,
  projections,
  outlook,
  theme,
  onLayer,
  onOpenVital,
}: {
  eth: CountryFile;
  conflict: ConflictFile;
  rainfall: RainfallFile;
  projections: ProjectionsFile;
  outlook: OutlookFile;
  theme: string;
  onLayer: (layer: "conflict" | "rainfall") => void;
  onOpenVital: (id: string) => void;
}) {
  const palette = CONFLICT_COLORS[theme === "light" ? "light" : "dark"];
  const colour = (rank: number) => palette[Math.min(palette.length - 1, Math.floor(rank * palette.length))];
  const data = ROWS.map((r) => ({ row: r, cells: cells(eth.series[r.id]?.history ?? [], r) }));
  const years = [...new Set(data.flatMap((d) => d.cells.map((c) => c.year)))].sort((a, b) => a - b);

  // latest signals
  const natNow = conflict.national.slice(-conflict.windowMonths).reduce((s, n) => s + n.events, 0);
  const natPrior = conflict.national.slice(-2 * conflict.windowMonths, -conflict.windowMonths).reduce((s, n) => s + n.events, 0);
  const rainRows = Object.values(rainfall.regions).filter((r) => r.normalMm >= 20);
  const dry = rainRows.filter((r) => r.pct < 75).length;
  const wet = rainRows.filter((r) => r.pct > 125).length;

  const axis = { fontSize: 10, fill: "var(--ink-3)" };
  const tip = { background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 };

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>RISK · Stress, projections &amp; outlook</span>
        <span className="grow" />
        <span className="mono normal-case tracking-normal muted">not a probability of crisis</span>
      </div>
      <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* stress matrix */}
        <section className="xl:col-span-2">
          <div className="label mb-1">Stress matrix · Ethiopia, annual · each cell ranks that year against the indicator&apos;s own {FROM}–latest range</div>
          <div className="overflow-x-auto">
            <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="text-left font-normal muted pr-2">Indicator</th>
                  {years.map((y) => (
                    <th key={y} className="mono font-normal muted px-0.5">
                      {String(y).slice(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(({ row, cells: cs }) => (
                  <tr key={row.id}>
                    <td className="pr-2 whitespace-nowrap">
                      <button type="button" className="text-left underline decoration-dotted" onClick={() => onOpenVital(row.id)} title={`Open ${row.label}`}>
                        {row.label}
                      </button>
                      <span className="muted"> · {row.basis}</span>
                    </td>
                    {years.map((y) => {
                      const c = cs.find((k) => k.year === y);
                      return (
                        <td key={y} title={c ? `${row.label} ${y}: ${fmt(row, c.value)} · ${Math.round(c.rank * 100)}th percentile of stress` : `${y}: no value`} style={{ width: 26, height: 22, background: c ? colour(c.rank) : "transparent", border: c ? undefined : "1px dashed var(--line)", opacity: 0.92 }} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10.5px] muted">
            <span>less stressed</span>
            {palette.map((c, i) => (
              <span key={i} className="inline-block w-[22px] h-[8px]" style={{ background: c }} />
            ))}
            <span>more stressed</span>
            <span className="ml-2">Relative to its own history, not an absolute threshold. Hover a cell for the value. World Bank annual data; the latest year is whatever the source has published.</span>
          </div>
        </section>

        {/* latest signals */}
        <section>
          <div className="label mb-1">Latest signals</div>
          <ul className="flex flex-col gap-2 text-[12px]">
            {conflict.available && (
              <li className="panel p-2">
                <b>Conflict events:</b> {natNow.toLocaleString("en-US")} in the 12 months to {conflict.through} vs {natPrior.toLocaleString("en-US")} the year before
                {natPrior > 0 ? ` (${natNow >= natPrior ? "+" : ""}${Math.round(((natNow - natPrior) / natPrior) * 100)}%)` : ""}. <span className="muted">ACLED via HDX; reported events.</span>{" "}
                <button type="button" className="ctl" onClick={() => onLayer("conflict")}>
                  Show heatmap on map
                </button>
              </li>
            )}
            {rainfall.available && (
              <li className="panel p-2">
                <b>Rainfall, {rainfall.from} to {rainfall.to}:</b> {dry} of {rainRows.length} rateable regions below 75% of normal, {wet} above 125%. <span className="muted">ERA5, one point per region.</span>{" "}
                <button type="button" className="ctl" onClick={() => onLayer("rainfall")}>
                  Show on map
                </button>
              </li>
            )}
          </ul>
        </section>

        {/* quoted projections */}
        <section>
          <div className="label mb-1">Projections quoted from the IMF (not ours)</div>
          {projections.available ? (
            <div className="grid grid-cols-2 gap-2">
              {projections.series.map((s) => {
                const rows = s.points.map((p) => ({ year: p.year, obs: p.projected ? null : p.value, proj: p.projected || p.year === s.points.filter((q) => !q.projected).at(-1)?.year ? p.value : null }));
                return (
                  <div key={s.id}>
                    <div className="text-[11px] ink2">{s.label} (%)</div>
                    <div style={{ width: "100%", height: 130 }}>
                      <ResponsiveContainer>
                        <ComposedChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                          <CartesianGrid stroke="var(--line)" vertical={false} />
                          <XAxis dataKey="year" tick={axis} />
                          <YAxis tick={axis} />
                          <Tooltip contentStyle={tip} />
                          <Line dataKey="obs" name="Recorded" stroke="#0ea5c6" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                          <Line dataKey="proj" name="IMF projection" stroke="#b8863f" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[12px] muted">Projections have not loaded yet.</div>
          )}
          <p className="text-[10.5px] muted leading-snug">
            {projections.note}{" "}
            <a href={projections.sourceUrl} target="_blank" rel="noreferrer">
              IMF WEO ↗
            </a>
          </p>
        </section>

        {/* own model */}
        <section className="xl:col-span-2">
          <div className="label mb-1">Statistical outlook · our model · conflict events per month</div>
          {outlook.available ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,360px)] gap-3">
              <div style={{ width: "100%", height: 170 }}>
                <ResponsiveContainer>
                  <ComposedChart
                    data={[...outlook.history.map((h) => ({ month: h.month, value: h.value as number | null, fc: null as number | null })), ...outlook.forecast.map((f) => ({ month: f.month, value: null as number | null, fc: f.value }))]}
                    margin={{ top: 4, right: 6, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="month" tick={axis} interval={5} />
                    <YAxis tick={axis} />
                    <Tooltip contentStyle={tip} />
                    <Line dataKey="value" name="Reported events" stroke="#0ea5c6" strokeWidth={2} dot={false} />
                    {outlook.skillful && <Line dataKey="fc" name="Model outlook" stroke="#b8863f" strokeWidth={2} strokeDasharray="4 3" dot />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[12px] flex flex-col gap-1.5">
                <div className="panel p-2">
                  <b>{outlook.skillful ? "Outlook published" : "No outlook published"}</b>
                  <div className="mono text-[11px] mt-1">
                    backtest over {outlook.backtest.origins} past months: model error {outlook.backtest.maeModel} events/month vs {outlook.backtest.maeBaseline} for a plain 3-month average (skill {outlook.backtest.skill >= 0 ? "+" : ""}
                    {Math.round(outlook.backtest.skill * 100)}%)
                  </div>
                </div>
                {outlook.skillful && outlook.forecast.length > 0 && (
                  <ul className="mono text-[11.5px]">
                    {outlook.forecast.map((f) => (
                      <li key={f.month}>
                        {f.month}: {f.value} (80% range {f.low}–{f.high})
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] muted leading-snug">{outlook.note}</p>
              </div>
            </div>
          ) : (
            <div className="text-[12px] muted">Not enough history for a model yet.</div>
          )}
          <p className="text-[10.5px] muted leading-snug mt-1">{outlook.method}</p>
        </section>
      </div>
    </div>
  );
}
