"use client";
import type { IndicatorConfig, Series } from "@/lib/schema";
import { formatDelta, formatValue } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export function VitalTile({
  ind,
  series,
  stale,
  onOpen,
}: {
  ind: IndicatorConfig;
  series: Series | undefined;
  stale: boolean;
  onOpen: () => void;
}) {
  const h = series?.history ?? [];
  const last = h.at(-1);
  const prev = h.at(-2);
  const fmt = (v: number) => formatValue(v, ind.format);
  const delta = last && prev ? formatDelta(last.value, prev.value, ind.format) : null;
  const pts = h.slice(-12).map((o) => ({ label: o.period, value: o.value }));

  return (
    <div className="panel flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        className="text-left px-3 pt-2 pb-1 cursor-pointer hover:bg-[var(--panel-2)] focus-visible:bg-[var(--panel-2)]"
        aria-label={`${ind.label}: open history and source`}
      >
        <div className="flex items-center gap-2">
          <span className="label">{ind.label}</span>
          <span className="grow" />
          <span className="mono text-[10px] muted">{ind.callsign}</span>
        </div>
        {last ? (
          <>
            <div className="mono text-[24px] leading-[30px] font-semibold tracking-tight" key={last.value}>
              <span className="tick">{fmt(last.value)}</span>
              {ind.format === "rate" && <span className="text-[11px] ink2 font-normal"> ETB/USD</span>}
            </div>
            <div className="mono text-[11px] ink2 flex flex-wrap gap-x-2">
              {delta && (
                <span>
                  {delta.text} <span className="muted">vs {prev!.period}</span>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="mono text-[13px] muted py-2">NO DATA YET</div>
        )}
      </button>
      <div className="px-3">
        {pts.length > 1 && <Sparkline points={pts} format={fmt} ariaLabel={`${ind.label}, last ${pts.length} periods`} />}
      </div>
      {last && (
        <div className="px-3 pb-2 pt-1 text-[10.5px] muted flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="mono ink2">{last.period}</span>
          <span>·</span>
          <a href={last.sourceUrl} target="_blank" rel="noreferrer">
            {last.source}
          </a>
          {stale && <span className="stale-tag">STALE</span>}
        </div>
      )}
    </div>
  );
}
