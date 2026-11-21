"use client";
// Demographics: the UN World Population Prospects series as published by the
// World Bank (estimates to 2023, the UN's medium-variant projections from 2024
// to 2050), shown as an interactive pyramid with a year slider, plus trends and
// the 2022 subnational picture. The projections are the UN's, not ours.
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DemographicsFile, PopulationZonesFile } from "@/lib/schema";
import { ageGroups, medianAge, NATIONAL_WIDTHS, ZONE_WIDTHS } from "@/lib/demography";
import { compact } from "@/lib/format";
import { Pyramid } from "./Pyramid";

const axis = { fontSize: 10, fill: "var(--ink-3)" };
const tip = { background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 };

export function DemographicsPanel({ demo, zones, onShowMap }: { demo: DemographicsFile; zones: PopulationZonesFile; onShowMap: () => void }) {
  const [year, setYear] = useState(2025);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || !demo.years.length) return;
    const t = setInterval(() => {
      setYear((y) => {
        const next = y + 1;
        if (next > demo.years.at(-1)!) {
          setPlaying(false);
          return demo.years.at(-1)!;
        }
        return next;
      });
    }, 220);
    return () => clearInterval(t);
  }, [playing, demo.years]);

  const get = (id: string, y: number) => demo.series.find((s) => s.id === id)?.values[String(y)] ?? null;
  const pyr = demo.pyramid[String(year)];
  const first = demo.years[0];
  const last = demo.years.at(-1) ?? 2050;
  const projected = year >= demo.projectionFrom;

  const stats = useMemo(() => {
    if (!pyr) return null;
    const m = pyr.m.reduce((a, b) => a + b, 0);
    const f = pyr.f.reduce((a, b) => a + b, 0);
    const g = ageGroups(pyr.m, pyr.f, 13);
    return { m, f, total: m + f, med: medianAge(pyr.m, pyr.f, NATIONAL_WIDTHS), sexRatio: (m / f) * 100, g };
  }, [pyr]);

  const trend = useMemo(
    () =>
      demo.years.map((y) => {
        const p = demo.pyramid[String(y)];
        const g = ageGroups(p.m, p.f, 13);
        const tot = get("total", y);
        return {
          year: y,
          actual: y < demo.projectionFrom ? tot : null,
          projected: y >= demo.projectionFrom - 1 ? tot : null,
          young: Math.round(g.young * 10) / 10,
          working: Math.round(g.working * 10) / 10,
          old: Math.round(g.old * 10) / 10,
          median: medianAge(p.m, p.f, NATIONAL_WIDTHS),
          tfr: get("tfr", y),
          lifeF: get("lifeF", y),
          lifeM: get("lifeM", y),
          birth: get("birth", y),
          death: get("death", y),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo],
  );

  const regionRows = useMemo(
    () =>
      zones.regions
        .map((r) => {
          const m = r.m.reduce((a, b) => a + b, 0);
          const f = r.f.reduce((a, b) => a + b, 0);
          const g = ageGroups(r.m, r.f, 13);
          return { name: r.name, total: r.total, female: (f / (m + f)) * 100, young: g.young, old: g.old, median: medianAge(r.m, r.f, ZONE_WIDTHS) };
        })
        .sort((a, b) => b.total - a.total),
    [zones.regions],
  );
  const regionTotal = zones.regions.reduce((s, r) => s + r.total, 0);
  const un2022 = get("total", 2022);

  if (!demo.available || !pyr || !stats) {
    return (
      <div className="panel">
        <div className="panel-title">DEMOGRAPHICS · Population, age and sex</div>
        <div className="p-4 text-[12px] muted">{demo.note}</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>DEMOGRAPHICS · Population, age and sex, {first}–{last}</span>
        <span className="grow" />
        <button type="button" className="ctl" onClick={onShowMap}>
          Show population on the map →
        </button>
      </div>
      <div className="p-3 flex flex-col gap-4">
        {/* year control + KPIs */}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className="ctl" onClick={() => (year >= last ? (setYear(first), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? "Pause animation" : "Play through the years"}>
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <input type="range" min={first} max={last} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} className="grow min-w-[180px]" aria-label="Year" />
          <span className="mono text-[20px]">{year}</span>
          <span className="mono text-[10.5px] px-1.5 border" style={{ borderColor: projected ? "var(--warn)" : "var(--ok)", color: projected ? "var(--warn)" : "var(--ok)" }}>
            {projected ? "UN PROJECTION" : "UN ESTIMATE"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            ["Population", compact(stats.total), ""],
            ["Median age*", stats.med != null ? `${stats.med}` : "—", "years"],
            ["Female share", `${((stats.f / stats.total) * 100).toFixed(1)}%`, `${stats.sexRatio.toFixed(0)} men per 100 women`],
            ["Under 15", `${stats.g.young.toFixed(1)}%`, ""],
            ["Aged 65+", `${stats.g.old.toFixed(1)}%`, ""],
            ["Fertility", get("tfr", year) != null ? `${get("tfr", year)!.toFixed(2)}` : "—", "births per woman"],
            ["Life expectancy", get("life", year) != null ? `${get("life", year)!.toFixed(1)}` : "—", get("lifeF", year) != null && get("lifeM", year) != null ? `F ${get("lifeF", year)!.toFixed(1)} · M ${get("lifeM", year)!.toFixed(1)}` : "years"],
            ["Urban share", get("urban", year) != null ? `${get("urban", year)!.toFixed(1)}%` : "n/a", get("urban", year) == null ? "series ends 2025" : "of population"],
          ].map(([l, v, s]) => (
            <div key={l}>
              <div className="label">{l}</div>
              <div className="mono text-[18px]">{v}</div>
              <div className="text-[10.5px] muted leading-tight">{s}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <div className="label mb-1">
              Population pyramid, {year} · <span style={{ color: "#0ea5c6" }}>male</span> · <span style={{ color: "#d95b92" }}>female</span>
            </div>
            <Pyramid bands={demo.bands} m={pyr.m} f={pyr.f} height={360} />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="label mb-1">Total population (solid = estimate, dashed = UN projection)</div>
              <div style={{ width: "100%", height: 150 }}>
                <ResponsiveContainer>
                  <ComposedChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -4 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="year" tick={axis} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis tick={axis} tickFormatter={(v) => compact(v as number)} />
                    <Tooltip contentStyle={tip} formatter={(v) => (typeof v === "number" ? v.toLocaleString("en-US") : "—")} />
                    <ReferenceLine x={year} stroke="var(--accent)" />
                    <Line dataKey="actual" name="Estimate" stroke="#0ea5c6" strokeWidth={2} dot={false} connectNulls />
                    <Line dataKey="projected" name="UN projection" stroke="#b8863f" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="label mb-1">Age structure, share of population (%)</div>
              <div style={{ width: "100%", height: 150 }}>
                <ResponsiveContainer>
                  <AreaChart data={trend} stackOffset="expand" margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="year" tick={axis} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis tick={axis} tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
                    <Tooltip contentStyle={tip} formatter={(v, n) => [`${(v as number).toFixed(1)}%`, n as string]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={year} stroke="var(--accent)" />
                    <Area dataKey="young" name="0–14" stackId="a" stroke="#d95b92" fill="#d95b92" fillOpacity={0.55} />
                    <Area dataKey="working" name="15–64" stackId="a" stroke="#0ea5c6" fill="#0ea5c6" fillOpacity={0.55} />
                    <Area dataKey="old" name="65+" stackId="a" stroke="#b8863f" fill="#b8863f" fillOpacity={0.7} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Median age* (years)", lines: [{ k: "median", n: "Median age", c: "#7b6cf0" }] },
            { title: "Fertility (births per woman)", lines: [{ k: "tfr", n: "Fertility", c: "#d95b92" }] },
            { title: "Life expectancy (years)", lines: [{ k: "lifeF", n: "Female", c: "#d95b92" }, { k: "lifeM", n: "Male", c: "#0ea5c6" }] },
          ].map((c) => (
            <div key={c.title}>
              <div className="label mb-1">{c.title}</div>
              <div style={{ width: "100%", height: 120 }}>
                <ResponsiveContainer>
                  <ComposedChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="year" tick={axis} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis tick={axis} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tip} />
                    <ReferenceLine x={year} stroke="var(--accent)" />
                    {c.lines.map((l) => (
                      <Line key={l.k} dataKey={l.k} name={l.n} stroke={l.c} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* subnational */}
        {zones.available && (
          <div>
            <div className="label mb-1">By region, {zones.period} (OCHA COD-PS)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left muted text-[10.5px]">
                    <th className="font-normal py-1">Region</th>
                    <th className="font-normal text-right">Population</th>
                    <th className="font-normal text-right">Female</th>
                    <th className="font-normal text-right">Under 15</th>
                    <th className="font-normal text-right">65+</th>
                    <th className="font-normal text-right">Median age*</th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((r) => (
                    <tr key={r.name} className="border-t border-[var(--line)]">
                      <td className="py-1">{r.name}</td>
                      <td className="mono text-right">{compact(r.total)}</td>
                      <td className="mono text-right">{r.female.toFixed(1)}%</td>
                      <td className="mono text-right">{r.young.toFixed(1)}%</td>
                      <td className="mono text-right">{r.old.toFixed(1)}%</td>
                      <td className="mono text-right">{r.median != null ? r.median.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10.5px] muted leading-snug mt-1">
              Regions in the source add up to {compact(regionTotal)} for {zones.period}, against the UN&apos;s estimate of {un2022 != null ? compact(un2022) : "—"} for the same year. The two come from different sources and methods, and the regional source omits some areas (for example the newer South Ethiopia Region and contested areas), so use the regional figures for relative comparison, not as the national total.
            </p>
          </div>
        )}

        <p className="text-[10.5px] muted leading-snug">
          *Median age is computed here from the published 5-year age bands by interpolation, so it approximates the official figure. {demo.note} Source:{" "}
          <a href={demo.sourceUrl} target="_blank" rel="noopener noreferrer">
            World Bank, from UN World Population Prospects ↗
          </a>{" "}
          (database updated {demo.lastUpdated}). Subnational:{" "}
          <a href={zones.sourceUrl} target="_blank" rel="noopener noreferrer">
            OCHA COD-PS via HDX ↗
          </a>
          . No subnational projections are available from these sources. Population projections can miss: they assume future fertility, mortality and migration paths.
        </p>
      </div>
    </div>
  );
}
