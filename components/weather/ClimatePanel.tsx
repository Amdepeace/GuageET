"use client";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClimateFile } from "@/lib/schema";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ClimatePanel({ data }: { data: ClimateFile }) {
  const [id, setId] = useState(data.cities[0]?.id ?? "");
  const city = data.cities.find((c) => c.id === id);

  const rows = useMemo(() => {
    if (!city) return [];
    // last 12 complete months, oldest first; each compared with its own calendar-month normal
    return city.recent
      .filter((r) => r.complete)
      .slice(-12)
      .map((r) => {
        const mi = Number(r.month.slice(5, 7)) - 1;
        return { label: `${MON[mi]} ${r.month.slice(2, 4)}`, rain: r.precipMm, rainNormal: city.normals.precipMm[mi], temp: r.tempC, tempNormal: city.normals.tempC[mi] };
      });
  }, [city]);

  if (!city) {
    return (
      <div className="panel">
        <div className="panel-title">CLIMATE · Rainfall &amp; temperature vs normal</div>
        <div className="p-4 text-[12px] muted">{data.note}</div>
      </div>
    );
  }

  const wetter = rows.filter((r) => r.rain != null && r.rainNormal > 20 && r.rain > r.rainNormal * 1.25).length;
  const drier = rows.filter((r) => r.rain != null && r.rainNormal > 20 && r.rain < r.rainNormal * 0.75).length;
  const axis = { fontSize: 10, fill: "var(--ink-3)" };
  const grid = "var(--line)";

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>CLIMATE · Rainfall &amp; temperature vs {data.baseline} normal</span>
        <span className="grow" />
        <select className="ctl" value={id} onChange={(e) => setId(e.target.value)} aria-label="City">
          {data.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="mono normal-case tracking-normal muted">through {data.throughDate}</span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <div className="label mb-1">Monthly rainfall (mm), last 12 complete months</div>
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} interval={0} />
                <YAxis tick={axis} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="rain" name="Observed" fill="#0ea5c6" />
                <Line dataKey="rainNormal" name={`Normal ${data.baseline}`} stroke="#b8863f" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] ink2">
            {wetter} wetter and {drier} drier than normal (by more than 25%, months with a normal over 20 mm) out of the last {rows.length} months.
          </p>
        </div>
        <div>
          <div className="label mb-1">Mean temperature (°C)</div>
          <div style={{ width: "100%", height: 150 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} interval={0} />
                <YAxis tick={axis} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 }} />
                <Line dataKey="temp" name="Observed" stroke="#d95b92" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="tempNormal" name="Normal" stroke="#b8863f" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="text-[10.5px] muted leading-snug">
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            {data.source} ↗
          </a>
          . {data.note} Normal = {data.baseline} average for the same calendar month. Idea inspired by the open-source ethio_hydro project; its data is not used.
        </p>
      </div>
    </div>
  );
}
