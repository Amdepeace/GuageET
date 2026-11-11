"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SimpleSeries } from "@/lib/schema";
import { formatValue, shortDate } from "@/lib/format";
import { Field } from "../shell/Drawer";

export function SimpleDetail({ series }: { series: SimpleSeries }) {
  const h = series.history;
  const last = h.at(-1);
  const fmt = (v: number) => formatValue(v, series.format);
  if (!last) return <div className="muted">No data yet for {series.label}.</div>;
  const chart = h.slice(-60).map((o) => ({ period: o.period, value: o.value }));
  return (
    <>
      <div>
        <div className="label">{series.label}</div>
        <div className="mono text-[30px] font-semibold leading-tight">{fmt(last.value)}</div>
        <div className="mono text-[12px] ink2">
          {last.unit} · {last.period}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <Field label="Source">
          <a href={series.sourceUrl} target="_blank" rel="noreferrer">
            {series.source} ↗
          </a>
        </Field>
        <Field label="Fetched">
          <span className="mono">{shortDate(last.fetchedAt)}</span>
        </Field>
      </div>
      <div>
        <div className="label mb-1">History · {h.length} points</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" tickLine={false} width={52} tickFormatter={fmt} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 0, fontSize: 11 }}
                labelStyle={{ color: "var(--ink-3)" }}
                formatter={(v: number) => [fmt(v), series.callsign]}
              />
              <Line type="linear" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
