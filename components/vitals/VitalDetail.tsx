"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COUNTRIES, type CountryCode, type CountryFile, type IndicatorConfig } from "@/lib/schema";
import { formatDelta, formatValue, shortDate } from "@/lib/format";
import { Field } from "../shell/Drawer";

export function VitalDetail({
  ind,
  countries,
  country,
  onCountry,
  staleSources,
}: {
  ind: IndicatorConfig;
  countries: Record<CountryCode, CountryFile>;
  country: CountryCode;
  onCountry: (c: CountryCode) => void;
  staleSources: Set<string>;
}) {
  const [showTable, setShowTable] = useState(false);
  const s = countries[country]?.series[ind.id];
  const h = s?.history ?? [];
  const last = h.at(-1);
  const prev = h.at(-2);
  const fmt = (v: number) => formatValue(v, ind.format);
  const name = COUNTRIES.find((c) => c.code === country)!.name;

  return (
    <>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Country">
        {COUNTRIES.map((c) => (
          <button key={c.code} type="button" className="ctl mono" aria-pressed={c.code === country} onClick={() => onCountry(c.code)}>
            {c.code}
          </button>
        ))}
      </div>

      {!last ? (
        <div className="muted">No {ind.label.toLowerCase()} data published for {name}.</div>
      ) : (
        <>
          <div>
            <div className="label">
              {ind.label} · {name}
            </div>
            <div className="mono text-[32px] font-semibold leading-tight">{fmt(last.value)}</div>
            <div className="mono text-[12px] ink2">
              {prev && formatDelta(last.value, prev.value, ind.format).text} {prev && <span className="muted">vs {prev.period}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <Field label="Period">
              <span className="mono">{last.period}</span> <span className="muted">(as of {last.asOf})</span>
            </Field>
            <Field label="Unit">{last.unit}</Field>
            <Field label="Source">
              <a href={last.sourceUrl} target="_blank" rel="noreferrer">
                {last.source} ↗
              </a>
              {staleSources.has(last.source) && <span className="stale-tag ml-2">STALE</span>}
            </Field>
            <Field label="Fetched">
              <span className="mono">{shortDate(last.fetchedAt)}</span>
            </Field>
          </div>

          <div>
            <div className="flex items-center mb-1">
              <span className="label grow">History · {h.length} periods</span>
              <button type="button" className="ctl" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
                {showTable ? "CHART" : "TABLE"}
              </button>
            </div>
            {showTable ? (
              <div className="max-h-[260px] overflow-y-auto scroll-thin">
                <table className="grid mono text-[11.5px]">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th style={{ textAlign: "right" }}>Value</th>
                      <th>Fetched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...h].reverse().map((o) => (
                      <tr key={o.asOf}>
                        <td>{o.period}</td>
                        <td style={{ textAlign: "right" }}>{fmt(o.value)}</td>
                        <td className="muted">{shortDate(o.fetchedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={h.map((o) => ({ period: o.period, value: o.value }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" tickLine={false} minTickGap={16} />
                    <YAxis
                      tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                      stroke="var(--line)"
                      tickLine={false}
                      width={52}
                      tickFormatter={(v: number) => fmt(v)}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--line-strong)" }}
                      contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 0, fontSize: 11 }}
                      labelStyle={{ color: "var(--ink-3)" }}
                      itemStyle={{ color: "var(--ink)" }}
                      formatter={(v: number) => [fmt(v), ind.label]}
                    />
                    <Line type="linear" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div>
            <div className="label mb-1">Other sources</div>
            {s!.alternatives.length ? (
              <ul className="text-[12px] flex flex-col gap-1">
                {s!.alternatives.map((a) => (
                  <li key={a.source}>
                    <span className="mono">{fmt(a.value)}</span> <span className="muted">({a.period})</span> ·{" "}
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                      {a.source} ↗
                    </a>
                    {Math.abs(a.value - last.value) > 1e-6 && (
                      <span className="muted"> · differs from primary by {formatValue(Math.abs(a.value - last.value), ind.format)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12px] muted">
                {ind.imf ? "No alternative value for this period (IMF source not yet fetched or offline)." : "No alternative source configured for this indicator."}
              </div>
            )}
          </div>
          <p className="text-[11px] muted">
            Shows the primary source&apos;s published annual figure. Values are never estimated; a missing year is left out.
          </p>
        </>
      )}
    </>
  );
}
