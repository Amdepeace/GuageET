"use client";
import type { SimpleSeries } from "@/lib/schema";
import { formatDelta, formatValue } from "@/lib/format";
import { Sparkline } from "../vitals/Sparkline";

export function SimpleTile({ series, stale, onOpen }: { series: SimpleSeries; stale: boolean; onOpen: () => void }) {
  const h = series.history;
  const last = h.at(-1);
  const prev = h.at(-2);
  const fmt = (v: number) => formatValue(v, series.format);
  const delta = last && prev ? formatDelta(last.value, prev.value, series.format) : null;
  const pts = h.slice(-12).map((o) => ({ label: o.period, value: o.value }));

  return (
    <div className="panel flex flex-col">
      <button type="button" onClick={onOpen} className="text-left px-3 pt-2 pb-1 hover:bg-[var(--panel-2)] focus-visible:bg-[var(--panel-2)]" aria-label={`${series.label}: open history and source`}>
        <div className="flex items-center gap-2">
          <span className="label truncate">{series.label}</span>
          <span className="grow" />
          <span className="mono text-[10px] muted">{series.callsign}</span>
        </div>
        {last ? (
          <>
            <div className="mono text-[20px] leading-[26px] font-semibold tracking-tight" key={last.value}>
              <span className="tick">{fmt(last.value)}</span>
            </div>
            <div className="mono text-[11px] ink2">
              {delta && (
                <>
                  {delta.text} <span className="muted">vs {prev!.period}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="mono text-[12px] muted py-2">AWAITING DATA</div>
        )}
      </button>
      <div className="px-3">{pts.length > 1 && <Sparkline points={pts} format={fmt} height={26} ariaLabel={`${series.label}, last ${pts.length} points`} />}</div>
      {last && (
        <div className="px-3 pb-2 pt-1 text-[10px] muted flex flex-wrap items-center gap-x-2">
          <span className="mono ink2">{last.period}</span>
          <span>·</span>
          <a href={series.sourceUrl} target="_blank" rel="noreferrer">
            {series.source}
          </a>
          {stale && <span className="stale-tag">STALE</span>}
        </div>
      )}
    </div>
  );
}
