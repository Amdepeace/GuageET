"use client";
import { useState } from "react";
import { COUNTRIES, type CountryCode, type CountryFile, type IndicatorConfig } from "@/lib/schema";
import { formatValue } from "@/lib/format";

/** Ethiopia beside its neighbours on one vital. Single measure, so one hue:
 *  Ethiopia in the accent, neighbours in neutral ink. Each bar carries its own
 *  period because neighbours publish on different lags. */
export function NeighborCompare({
  indicators,
  countries,
  cmp,
  onCmp,
  onOpen,
}: {
  indicators: IndicatorConfig[];
  countries: Record<CountryCode, CountryFile>;
  cmp: string;
  onCmp: (id: string) => void;
  onOpen: (country: CountryCode) => void;
}) {
  const [hover, setHover] = useState<CountryCode | null>(null);
  const ind = indicators.find((i) => i.id === cmp) ?? indicators[0];
  const rows = COUNTRIES.map((c) => {
    const o = countries[c.code]?.series[ind.id]?.history.at(-1);
    return { ...c, o };
  });
  const vals = rows.filter((r) => r.o).map((r) => r.o!.value);
  const lo = Math.min(0, ...vals);
  // One extreme value (e.g. Sudan's triple-digit inflation) would flatten every
  // other bar, so the scale is capped and the clipped bar gets a break marker.
  // Its true value is always printed beside it.
  const sorted = [...vals].sort((a, b) => b - a);
  const capped = sorted.length > 2 && sorted[0] > 0 && sorted[1] > 0 && sorted[0] > 4 * sorted[1];
  const hi = capped ? sorted[1] * 1.3 : Math.max(0, ...vals);
  const span = hi - lo || 1;
  const zero = ((0 - lo) / span) * 100;
  const fmt = (v: number) => formatValue(v, ind.format);
  const periods = new Set(rows.filter((r) => r.o).map((r) => r.o!.period));

  return (
    <div className="panel">
      <div className="panel-title">
        <span>Neighbour comparison</span>
        <span className="grow" />
        <select className="ctl max-w-[150px]" value={ind.id} onChange={(e) => onCmp(e.target.value)} aria-label="Indicator to compare">
          {indicators.map((i) => (
            <option key={i.id} value={i.id}>
              {i.callsign} · {i.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="p-3 flex flex-col gap-[6px]">
        {rows.map((r) => {
          const v = r.o?.value;
          const left = v == null ? zero : v >= 0 ? zero : ((v - lo) / span) * 100;
          const clipped = v != null && v > hi;
          const width = v == null ? 0 : clipped ? 100 - zero : (Math.abs(v) / span) * 100;
          const isEth = r.code === "ETH";
          return (
            <li key={r.code} className="relative">
              <button
                type="button"
                className="w-full grid grid-cols-[38px_1fr_auto] items-center gap-2 text-left cursor-pointer"
                onClick={() => onOpen(r.code)}
                onPointerEnter={() => setHover(r.code)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(r.code)}
                onBlur={() => setHover(null)}
                aria-label={`${r.name}: ${v != null ? fmt(v) : "no data"}${r.o ? `, ${r.o.period}` : ""}`}
              >
                <span className="mono text-[11px]" style={{ color: isEth ? "var(--ink)" : "var(--ink-2)", fontWeight: isEth ? 600 : 400 }}>
                  {r.code}
                </span>
                <span className="relative h-[14px] block" style={{ background: hover === r.code ? "var(--panel-2)" : undefined }}>
                  <span className="absolute top-0 bottom-0" style={{ left: `${zero}%`, width: 1, background: "var(--line-strong)" }} />
                  {v != null && (
                    <span
                      className="absolute top-[2px] bottom-[2px]"
                      style={{
                        left: `${left}%`,
                        width: `max(${width}%, 2px)`,
                        background: isEth ? "var(--accent)" : "var(--ink-3)",
                        opacity: isEth ? 1 : 0.55,
                        borderRadius: clipped ? 0 : v >= 0 ? "0 3px 3px 0" : "3px 0 0 3px",
                      }}
                    />
                  )}
                  {clipped && (
                    <span
                      aria-hidden
                      className="absolute top-0 bottom-0"
                      style={{ left: "88%", width: 4, background: "var(--panel)", transform: "skewX(-20deg)" }}
                    />
                  )}
                </span>
                <span className="mono text-[11px] text-right whitespace-nowrap">
                  {v != null ? fmt(v) : <span className="muted">—</span>}
                  {r.o && periods.size > 1 && <span className="muted"> ’{r.o.period.slice(2)}</span>}
                </span>
              </button>
              {hover === r.code && r.o && (
                <div className="tooltip" style={{ right: 0, bottom: 20 }}>
                  <div className="font-semibold">{r.name}</div>
                  <div className="mono">
                    {fmt(r.o.value)} <span className="muted">{r.o.period}</span>
                  </div>
                  <div className="muted">{r.o.source}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="px-3 pb-2 text-[10.5px] muted">
        Latest published year per country · {rows[0].o?.source ?? "World Bank WDI"}
        {periods.size > 1 && " · years differ, marked ’YY"}
        {capped && " · scale capped; broken bar runs off-scale"}
      </div>
    </div>
  );
}
