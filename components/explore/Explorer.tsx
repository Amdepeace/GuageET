"use client";
// Interactive explorer built on Apache ECharts (Apache-2.0, https://github.com/apache/echarts).
// Pick an indicator and countries, then zoom, pan, toggle series and compare:
//   Values   - the raw series with their own units
//   Indexed  - every series rebased to 100 in the first year all selected series share
//   Scatter  - one indicator against another, one point per year
// ECharts is loaded on demand, so it adds nothing to the first page load.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryFile, CountryCode, IndicatorConfig, Observation } from "@/lib/schema";
import { COUNTRIES } from "@/lib/schema";
import { compact } from "@/lib/format";

type Mode = "values" | "indexed" | "scatter";
const COLORS: Record<CountryCode, [string, string]> = {
  ETH: ["#0ea5c6", "#0587ad"],
  KEN: ["#d95b92", "#c2447f"],
  DJI: ["#7b6cf0", "#5a49d6"],
  EGY: ["#b8863f", "#8f5f12"],
  SDN: ["#4fb286", "#2f8a60"],
  TZA: ["#9aa7b4", "#5f6f7e"],
};

const ind0 = (list: IndicatorConfig[], id: string) => list.find((i) => i.id === id);
const year = (o: Observation) => Number(o.period.slice(0, 4));

function cssVar(n: string, d: string) {
  if (typeof document === "undefined") return d;
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
}

export function Explorer({ indicators, countries, theme }: { indicators: IndicatorConfig[]; countries: Record<CountryCode, CountryFile>; theme: string }) {
  const [modeSel, setMode] = useState<Mode>("values");
  const [x, setX] = useState(indicators[0]?.id ?? "");
  const [y, setY] = useState(indicators[1]?.id ?? indicators[0]?.id ?? "");
  const mode: Mode = modeSel === "indexed" && ind0(indicators, x)?.format === "pct" ? "values" : modeSel;
  const [sel, setSel] = useState<CountryCode[]>(["ETH", "KEN", "DJI"]);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<{ setOption: (o: unknown, notMerge?: boolean) => void; dispose: () => void; resize: () => void } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ind = (id: string) => indicators.find((i) => i.id === id);
  const hist = (c: CountryCode, id: string) => countries[c]?.series[id]?.history ?? [];
  const dark = theme !== "light";
  // indexing only makes sense for levels (money, people), not for rates or ratios
  const canIndex = ind(x)?.format !== "pct";
  const col = (c: CountryCode) => COLORS[c][dark ? 0 : 1];

  const option = useMemo(() => {
    const ink = cssVar("--ink-2", "#9fb0bf");
    const line = cssVar("--line", "#1f2d3a");
    const panel = cssVar("--panel", "#0f171f");
    const base = {
      backgroundColor: "transparent",
      animationDuration: 400,
      textStyle: { fontFamily: "inherit" },
      legend: { top: 0, textStyle: { color: ink, fontSize: 11 }, inactiveColor: "#566574" },
      grid: { left: 54, right: 18, top: 36, bottom: 70 },
      tooltip: { trigger: mode === "scatter" ? "item" : "axis", backgroundColor: panel, borderColor: line, textStyle: { color: ink, fontSize: 12 } },
      toolbox: { right: 6, top: 0, iconStyle: { borderColor: ink }, feature: { dataZoom: { yAxisIndex: "none", title: { zoom: "Zoom", back: "Undo zoom" } }, restore: { title: "Reset" }, saveAsImage: { title: "Save as image", backgroundColor: panel } } },
      dataZoom: [
        { type: "inside", filterMode: "none" },
        { type: "slider", height: 18, bottom: 8, borderColor: line, textStyle: { color: ink }, filterMode: "none" },
      ],
    };
    const axis = (name: string, type: "category" | "value" | "time") => ({ type, name, nameTextStyle: { color: ink, fontSize: 11 }, axisLabel: { color: ink, fontSize: 10 }, axisLine: { lineStyle: { color: line } }, splitLine: { lineStyle: { color: line } } });

    if (mode === "scatter") {
      const xi = ind(x);
      const yi = ind(y);
      return {
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: { seriesName: string; data: [number, number, number] }) => `${p.seriesName} · ${p.data[2]}<br/>${xi?.label}: ${compact(p.data[0])}<br/>${yi?.label}: ${compact(p.data[1])}` },
        xAxis: { ...axis(xi?.label ?? "", "value"), scale: true },
        yAxis: { ...axis(yi?.label ?? "", "value"), scale: true },
        dataZoom: [{ type: "inside", filterMode: "none" }, { type: "inside", orient: "vertical", filterMode: "none" }],
        series: sel.map((c) => {
          const ys = new Map(hist(c, y).map((o) => [year(o), o.value]));
          const pts = hist(c, x)
            .filter((o) => ys.has(year(o)))
            .map((o) => [o.value, ys.get(year(o)) as number, year(o)]);
          return { name: COUNTRIES.find((k) => k.code === c)?.name, type: "scatter", symbolSize: c === "ETH" ? 10 : 7, itemStyle: { color: col(c) }, data: pts };
        }),
      };
    }

    const series = sel.map((c) => ({ c, h: hist(c, x) })).filter((s) => s.h.length);
    let rebase: Record<string, number> = {};
    if (mode === "indexed") {
      // first year in which every selected series has a non-zero value
      const sets = series.map((s) => new Set(s.h.filter((o) => o.value !== 0).map(year)));
      const common = sets.length ? [...sets[0]].filter((yr) => sets.every((st) => st.has(yr))).sort()[0] : undefined;
      if (common !== undefined) rebase = Object.fromEntries(series.map((s) => [s.c, s.h.find((o) => year(o) === common)!.value]));
    }
    const indexed = mode === "indexed" && Object.keys(rebase).length > 0;
    const xi = ind(x);
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        valueFormatter: (v: number) => (v == null ? "—" : indexed ? v.toFixed(1) : compact(v)),
      },
      xAxis: { ...axis("", "category"), boundaryGap: false, data: [...new Set(series.flatMap((s) => s.h.map(year)))].sort() },
      yAxis: { ...axis(indexed ? "Index (base year = 100)" : (xi?.unit ?? ""), "value"), scale: true },
      series: series.map((s) => ({
        name: COUNTRIES.find((k) => k.code === s.c)?.name,
        type: "line",
        showSymbol: true,
        symbolSize: 5,
        smooth: false,
        lineStyle: { width: s.c === "ETH" ? 3 : 2, color: col(s.c) },
        itemStyle: { color: col(s.c) },
        emphasis: { focus: "series" },
        connectNulls: false,
        data: [...new Set(series.flatMap((q) => q.h.map(year)))].sort().map((yr) => {
          const o = s.h.find((q) => year(q) === yr);
          return o ? (indexed ? (o.value / rebase[s.c]) * 100 : o.value) : null;
        }),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, x, y, sel, countries, indicators, dark]);

  // mount ECharts lazily, reuse the instance, and keep it sized
  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const [core, charts, comps, rend] = await Promise.all([import("echarts/core"), import("echarts/charts"), import("echarts/components"), import("echarts/renderers")]);
        if (!alive || !host.current) return;
        core.use([charts.LineChart, charts.ScatterChart, comps.GridComponent, comps.TooltipComponent, comps.LegendComponent, comps.DataZoomComponent, comps.ToolboxComponent, rend.CanvasRenderer]);
        if (!chart.current) {
          chart.current = core.init(host.current) as unknown as NonNullable<typeof chart.current>;
          ro = new ResizeObserver(() => chart.current?.resize());
          ro.observe(host.current);
        }
        chart.current.setOption(option, true);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [option]);

  useEffect(
    () => () => {
      chart.current?.dispose();
      chart.current = null;
    },
    [],
  );

  const toggle = (c: CountryCode) => setSel((s) => (s.includes(c) ? (s.length > 1 ? s.filter((k) => k !== c) : s) : [...s, c]));
  const sources = [...new Set(sel.map((c) => hist(c, x).at(-1)?.source).filter(Boolean))];

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>EXPLORER · Interactive comparison</span>
        <span className="grow" />
        <div className="flex gap-1" role="tablist" aria-label="Chart mode">
          {(["values", "indexed", "scatter"] as Mode[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className="ctl" disabled={m === "indexed" && !canIndex} title={m === "indexed" && !canIndex ? "Not available for rates and ratios" : undefined} onClick={() => setMode(m)}>
              {m === "values" ? "Values" : m === "indexed" ? "Indexed" : "Scatter"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="flex items-center gap-1">
            <span className="muted">{mode === "scatter" ? "X" : "Indicator"}</span>
            <select className="ctl" value={x} onChange={(e) => setX(e.target.value)}>
              {indicators.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          {mode === "scatter" && (
            <label className="flex items-center gap-1">
              <span className="muted">Y</span>
              <select className="ctl" value={y} onChange={(e) => setY(e.target.value)}>
                {indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="grow" />
          {COUNTRIES.map((c) => (
            <button key={c.code} type="button" className="ctl" aria-pressed={sel.includes(c.code)} onClick={() => toggle(c.code)} style={sel.includes(c.code) ? { borderColor: col(c.code) } : undefined}>
              <span className="inline-block w-[8px] h-[8px] mr-1 rounded-full" style={{ background: sel.includes(c.code) ? col(c.code) : "transparent", outline: `1px solid ${col(c.code)}` }} />
              {c.name}
            </button>
          ))}
        </div>
        {err ? (
          <div className="text-[12px] muted p-4">The chart library could not load: {err}</div>
        ) : (
          <div ref={host} style={{ width: "100%", height: 360 }} role="img" aria-label={`Interactive chart of ${ind(x)?.label ?? "indicator"}`} />
        )}
        <p className="text-[10.5px] muted leading-snug">
          {mode === "indexed" ? "Indexed: each line is rebased to 100 in the first year every selected country has data, so growth is comparable across different units. " : ""}
          {mode === "scatter" ? "Scatter: each point is one year; hover for the year. " : ""}
          Scroll or drag the slider to zoom; click a legend entry to hide a series; the toolbox saves the chart as an image. Annual data; sources: {sources.join(", ") || "—"}. Charts by{" "}
          <a href="https://echarts.apache.org/" target="_blank" rel="noreferrer">
            Apache ECharts ↗
          </a>
          .
        </p>
      </div>
    </div>
  );
}
