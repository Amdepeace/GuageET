"use client";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HealthStatus, InterbankFile, InterbankWeek } from "@/lib/schema";
import { compact } from "@/lib/format";

const pts = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)} pts`);

export function InterbankPanel({ data, health }: { data: InterbankFile; health: HealthStatus }) {
  const by = (m: InterbankWeek["maturity"]) => data.weeks.filter((w) => w.maturity === m);
  const on = by("overnight");
  const d7 = by("7d");
  const ends = [...new Set(data.weeks.map((w) => w.end))].sort();
  const rows = ends.map((end) => ({ end, overnight: on.find((w) => w.end === end)?.rate ?? null, d7: d7.find((w) => w.end === end)?.rate ?? null }));
  const latest = ends.at(-1);
  const axis = { fontSize: 10, fill: "var(--ink-3)" };

  const tile = (label: string, series: InterbankWeek[]) => {
    const w = series.at(-1);
    if (!w) return null;
    const prev = series.at(-2);
    const hi = Math.max(...series.map((s) => s.rate));
    const isHigh = w.rate >= hi && series.length > 8;
    return (
      <div>
        <div className="label">{label}</div>
        <div className="mono text-[24px]">{w.rate.toFixed(2)}%</div>
        <div className="text-[11.5px] ink2">
          {pts(w.changePts)} on the week{prev ? ` (was ${prev.rate.toFixed(2)}%)` : ""}
        </div>
        <div className="text-[11px] muted">
          ETB {compact(w.volumeEtb)} traded · {w.trades} trades{isHigh ? ` · highest weekly rate in this table (since ${series[0].end})` : ""}
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>MARKETS · Interbank money market rates</span>
        <span className="grow" />
        {latest && <span className="mono normal-case tracking-normal muted">week ending {latest}</span>}
        <span className={`st ${health}`}>{health}</span>
      </div>
      {data.available && data.weeks.length ? (
        <div className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {tile("Overnight, weighted-average rate", on)}
            {tile("7-day, weighted-average rate", d7)}
          </div>
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="end" tick={axis} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={axis} unit="%" domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 }} formatter={(v) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—")} labelFormatter={(l) => `week ending ${l}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="overnight" name="Overnight" stroke="#0ea5c6" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="d7" name="7-day" stroke="#d95b92" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10.5px] muted leading-snug">
            {data.note} Change is shown as published; in a few older rows it differs from the difference between ESX&apos;s own weekly rates. Source:{" "}
            <a href={data.sourceUrl} target="_blank" rel="noreferrer">
              ESX fixed-income market data ↗
            </a>
            , fetched {data.fetchedAt.slice(0, 10)}. This is interbank lending, not equity prices.
          </p>
        </div>
      ) : (
        <div className="p-4 text-[12px] muted">{data.note}</div>
      )}
    </div>
  );
}
