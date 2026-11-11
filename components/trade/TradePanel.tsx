"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HealthStatus, TradeFile, TradePartner } from "@/lib/schema";
import { compact } from "@/lib/format";

function Bars({ rows, accent }: { rows: TradePartner[]; accent: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-[5px]">
      {rows.map((r) => (
        <li key={r.partnerCode} className="grid grid-cols-[96px_1fr_auto] items-center gap-2">
          <span className="text-[11px] truncate" title={r.partner}>
            {r.partner}
          </span>
          <span className="relative h-[13px] block bg-[var(--panel-2)]">
            <span className="absolute top-0 bottom-0 left-0" style={{ width: `max(${(r.value / max) * 100}%, 2px)`, background: accent, borderRadius: "0 3px 3px 0" }} />
          </span>
          <span className="mono text-[11px] text-right">${compact(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TradePanel({ trade, status }: { trade: TradeFile; status: HealthStatus }) {
  const [tab, setTab] = useState<"exports" | "imports" | "balance">("exports");

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>TRADE · Partners &amp; balance</span>
        <span className="grow" />
        {trade.available && <span className="mono normal-case tracking-normal muted">{trade.period}</span>}
        <span className={`st ${status}`}>{status}</span>
      </div>

      {!trade.available ? (
        <div className="p-4 text-[12.5px] ink2 flex flex-col gap-2">
          <p className="font-semibold" style={{ color: "var(--ink)" }}>
            Trade panel is waiting for a data key.
          </p>
          <p>{trade.note}</p>
          <ol className="list-decimal ml-4 flex flex-col gap-1 text-[12px]">
            <li>
              Register a free key at{" "}
              <a href="https://comtradeplus.un.org/" target="_blank" rel="noreferrer">
                UN Comtrade ↗
              </a>{" "}
              (free tier, email sign-up).
            </li>
            <li>
              In the repo: <span className="mono">Settings → Secrets and variables → Actions → New repository secret</span>, named{" "}
              <span className="mono">COMTRADE_PRIMARY_KEY</span>.
            </li>
            <li>Re-run the &ldquo;Update data and deploy&rdquo; workflow. Top partners and the trade balance appear here.</li>
          </ol>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex gap-1 mb-3" role="tablist">
            {(
              [
                ["exports", "Top export partners"],
                ["imports", "Top import partners"],
                ["balance", "Trade balance"],
              ] as [typeof tab, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" className="ctl" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "exports" && <Bars rows={trade.exportsByPartner} accent="var(--cat-transport)" />}
          {tab === "imports" && <Bars rows={trade.importsByPartner} accent="var(--cat-power)" />}
          {tab === "balance" && (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trade.balance.map((b) => ({ period: b.period, Exports: b.exports, Imports: b.imports, Balance: b.exports - b.imports }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" tickLine={false} />
                  <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" tickLine={false} width={48} tickFormatter={(v: number) => `$${compact(v)}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 0, fontSize: 11 }}
                    labelStyle={{ color: "var(--ink-3)" }}
                    formatter={(v: number, n: string) => [`$${compact(v)}`, n]}
                  />
                  <Line type="linear" dataKey="Exports" stroke="var(--cat-transport)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="Imports" stroke="var(--cat-power)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="Balance" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-3 text-[10.5px] ink2 mt-1">
                <Legend c="var(--cat-transport)" t="Exports" />
                <Legend c="var(--cat-power)" t="Imports" />
                <Legend c="var(--ink-3)" t="Balance (X−M)" dashed />
              </div>
            </div>
          )}
          <div className="text-[10.5px] muted mt-3">
            <a href={trade.sourceUrl} target="_blank" rel="noreferrer">
              {trade.source}
            </a>{" "}
            · {trade.note}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ c, t, dashed }: { c: string; t: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="0" y1="3" x2="18" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />
      </svg>
      {t}
    </span>
  );
}
