"use client";
import type { PowerExportsFile } from "@/lib/schema";
import { compact } from "@/lib/format";

export function PowerExportsPanel({ data, onSelectInfra }: { data: PowerExportsFile; onSelectInfra: (id: string) => void }) {
  const t = data.total;
  const max = Math.max(...data.partners.map((p) => p.revenueUsd ?? 0), 1);
  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>POWER · Electricity exports</span>
        <span className="grow" />
        <span className="mono normal-case tracking-normal muted">verified {data.lastVerified}</span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <div className="label">{t.label}</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono text-[22px]">${compact(t.valueUsd)}</span>
            <span className="text-[11px] muted">{t.period}</span>
            {!t.verified && <span className="unverified-tag">UNVERIFIED</span>}
          </div>
          <a className="text-[11px]" href={t.source.url} target="_blank" rel="noreferrer">
            {t.source.title} ↗
          </a>
          <p className="text-[11px] muted leading-snug mt-1">
            {t.caveat}{" "}
            <a href={t.caveatSource.url} target="_blank" rel="noreferrer">
              Source ↗
            </a>
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {data.partners.map((p) => (
            <li key={p.id} className="border-t border-[var(--line)] pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[13px]">{p.name}</span>
                <span className="mono text-[10.5px] px-1.5 border" style={{ borderColor: "var(--line-strong)" }}>
                  {p.status.toUpperCase()}
                </span>
                {!p.verified && <span className="unverified-tag">UNVERIFIED</span>}
                <span className="grow" />
                <span className="mono text-[12px]">{p.revenueUsd != null ? `$${compact(p.revenueUsd)}` : "no figure"}</span>
              </div>
              <span className="relative h-[8px] block bg-[var(--panel-2)] my-1">
                <span className="absolute top-0 bottom-0 left-0" style={{ width: `${p.revenueUsd ? Math.max((p.revenueUsd / max) * 100, 1.5) : 0}%`, background: "#0ea5c6" }} />
              </span>
              <p className="text-[12px] ink2 leading-snug">{p.capacity}</p>
              <div className="text-[11px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {p.revenuePeriod && <span className="muted">Revenue period: {p.revenuePeriod}</span>}
                {p.infraIds.map((id) => (
                  <button key={id} type="button" className="underline" onClick={() => onSelectInfra(id)}>
                    Show {id} on map
                  </button>
                ))}
                {p.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.title} ↗
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[10.5px] muted leading-snug">{data.note} Earnings are in US dollars as reported; they are not volumes (MWh).</p>
      </div>
    </div>
  );
}
