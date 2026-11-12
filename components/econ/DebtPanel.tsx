"use client";
import type { DebtFile, HealthStatus, ImfProgramme } from "@/lib/schema";
import { compact } from "@/lib/format";
import { ago } from "@/lib/format";

export function DebtPanel({ debt, imf, status, now }: { debt: DebtFile; imf: ImfProgramme; status: HealthStatus; now: number | null }) {
  const comp = [...debt.composition].sort((a, b) => b.value - a.value);
  const total = comp.reduce((s, c) => s + c.value, 0);
  const max = Math.max(...comp.map((c) => c.value), 1);
  const fmtRatio = (id: string) => {
    const r = debt.ratios[id];
    if (!r) return "—";
    return r.format === "pct" ? `${r.value.toFixed(1)}%` : `$${compact(r.value)}`;
  };

  return (
    <div className="panel flex flex-col">
      <div className="panel-title flex-wrap">
        <span>DEBT · External debt &amp; financing</span>
        <span className="grow" />
        {debt.ratios.total && <span className="mono normal-case tracking-normal muted">{debt.ratios.total.period}</span>}
        <span className={`st ${status}`}>{status}</span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* headline ratios */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["total", "Total external debt"],
            ["pct_gni", "Debt / GNI"],
            ["debt_service", "Debt service / yr"],
          ].map(([id, label]) => (
            <div key={id}>
              <div className="label">{label}</div>
              <div className="mono text-[17px] font-semibold">{fmtRatio(id)}</div>
            </div>
          ))}
        </div>

        {/* composition by creditor type */}
        <div>
          <div className="label mb-1">Composition by creditor type</div>
          {comp.length === 0 ? (
            <div className="text-[12px] muted">Awaiting World Bank IDS data.</div>
          ) : (
            <ul className="flex flex-col gap-[5px]">
              {comp.map((c) => (
                <li key={c.id} className="grid grid-cols-[132px_1fr_auto] items-center gap-2">
                  <span className="text-[11px] truncate" title={c.label}>
                    {c.label}
                  </span>
                  <span className="relative h-[12px] block bg-[var(--panel-2)]">
                    <span className="absolute top-0 bottom-0 left-0" style={{ width: `max(${(c.value / max) * 100}%, 2px)`, background: "var(--accent)", borderRadius: "0 3px 3px 0" }} />
                  </span>
                  <span className="mono text-[11px] text-right">
                    ${compact(c.value)} <span className="muted">{total ? `${((c.value / total) * 100).toFixed(0)}%` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* IMF programme timeline */}
        <div>
          <div className="label mb-1">{imf.programme}</div>
          <ul className="flex flex-col gap-1.5">
            {imf.events.map((e) => (
              <li key={e.date} className="text-[11.5px] grid grid-cols-[72px_1fr] gap-2">
                <span className="mono muted">{e.date.slice(0, 7)}</span>
                <span>
                  <span style={{ color: "var(--ink)" }}>{e.label}</span>
                  <span className="muted"> — {e.detail}</span>{" "}
                  {e.sourceUrl && (
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                      ↗
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] muted mt-1">{imf.note}</p>
        </div>
      </div>

      <div className="px-3 pb-2 text-[10px] muted flex flex-wrap gap-x-2 mt-auto">
        <a href={debt.sourceUrl} target="_blank" rel="noreferrer">
          {debt.source}
        </a>
        <span>· PPG = public &amp; publicly guaranteed · figures lag ~1 year</span>
        {debt.fetchedAt && now && <span className="mono">· {ago(debt.fetchedAt, now)} ago</span>}
      </div>
    </div>
  );
}
