"use client";
import { useState } from "react";
import { COUNTRIES, type ChangeEntry, type CountryCode, type IndicatorConfig } from "@/lib/schema";
import type { EventEntry } from "@/lib/data";
import { formatValue } from "@/lib/format";

/** Size of a move, comparable across indicators: percentage points for
 *  series already in %, relative % change otherwise. */
export function moveSize(c: ChangeEntry, ind: IndicatorConfig | undefined): number {
  if (!ind) return 0;
  return ind.format === "pct" ? Math.abs(c.value - c.previous) : Math.abs(c.pctChange ?? 0);
}

export function EventLog({
  changes,
  events,
  indicators,
  lastVisit,
  onOpen,
}: {
  changes: ChangeEntry[];
  events: EventEntry[];
  indicators: IndicatorConfig[];
  lastVisit: string | null;
  onOpen: (indicator: string, country: CountryCode) => void;
}) {
  const [tab, setTab] = useState<"ranked" | "log">("ranked");
  const ind = (id: string) => indicators.find((i) => i.id === id);
  const since = lastVisit ? changes.filter((c) => c.at > lastVisit) : changes;
  const ranked = [...since].sort((a, b) => moveSize(b, ind(b.indicator)) - moveSize(a, ind(a.indicator))).slice(0, 12);
  const name = (c?: CountryCode) => COUNTRIES.find((x) => x.code === c)?.name ?? "";
  const log = [...events].reverse().slice(0, 100);

  return (
    <section className="panel flex flex-col">
      <div className="panel-title">
        <span>Event log</span>
        <span className="grow" />
        <div className="flex gap-1" role="tablist">
          <button type="button" role="tab" className="ctl" aria-selected={tab === "ranked"} onClick={() => setTab("ranked")}>
            What changed
          </button>
          <button type="button" role="tab" className="ctl" aria-selected={tab === "log"} onClick={() => setTab("log")}>
            Raw log
          </button>
        </div>
      </div>
      <div className="max-h-[260px] overflow-y-auto scroll-thin">
        {tab === "ranked" ? (
          <>
            <div className="px-3 pt-2 text-[10.5px] muted">
              {lastVisit
                ? `${since.length} figures changed since your last visit (${lastVisit.slice(0, 10)}). Ranked by size of move: pp for % series, % change otherwise.`
                : "First visit: showing the latest move in every series, ranked by size (pp for % series, % change otherwise)."}
            </div>
            {ranked.length === 0 ? (
              <div className="px-3 py-3 muted text-[12px]">No new figures since your last visit.</div>
            ) : (
              <ol className="mono text-[11.5px]">
                {ranked.map((c) => {
                  const i = ind(c.indicator)!;
                  const d = c.value - c.previous;
                  const mv = i.format === "pct" ? `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} pp` : `${(c.pctChange ?? 0) >= 0 ? "+" : "−"}${Math.abs(c.pctChange ?? 0).toFixed(1)}%`;
                  return (
                    <li key={`${c.country}-${c.indicator}`}>
                      <button
                        type="button"
                        className="w-full text-left grid grid-cols-[44px_52px_1fr_auto] sm:grid-cols-[44px_52px_1fr_auto_auto] gap-2 px-3 py-1 hover:bg-[var(--panel-2)] cursor-pointer"
                        onClick={() => onOpen(c.indicator, c.country)}
                      >
                        <span style={{ color: c.country === "ETH" ? "var(--accent)" : "var(--ink-2)" }}>{c.country}</span>
                        <span className="ink2">{i.callsign}</span>
                        <span className="truncate font-sans">
                          {name(c.country)} {i.label.toLowerCase()}: {formatValue(c.previous, i.format)} → {formatValue(c.value, i.format)}
                        </span>
                        <span>{mv}</span>
                        <span className="muted hidden sm:inline">
                          {c.previousPeriod}→{c.period}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        ) : log.length === 0 ? (
          <div className="px-3 py-3 muted text-[12px]">No events recorded yet. New periods, revisions and source failures appear here as the scheduled job runs.</div>
        ) : (
          <ol className="mono text-[11px]">
            {log.map((e, k) => (
              <li key={k} className="grid grid-cols-[128px_1fr] gap-2 px-3 py-1 border-b border-[var(--line)]">
                <span className="muted">{e.at.slice(0, 16).replace("T", " ")}Z</span>
                <span>
                  <span style={{ color: e.kind === "source_error" ? "var(--warn)" : "var(--ink-2)" }}>
                    [{e.kind.replace("_", " ").toUpperCase()}]
                  </span>{" "}
                  {e.country && `${e.country} `}
                  {e.indicator && `${ind(e.indicator)?.callsign ?? e.indicator} `}
                  {e.message}
                  {e.value != null && e.indicator && ` · ${formatValue(e.value, ind(e.indicator)!.format)}`}
                  <span className="muted"> · {e.source}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
