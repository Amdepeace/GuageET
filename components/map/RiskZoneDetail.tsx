"use client";
import type { ConflictFile } from "@/lib/schema";
import { Field } from "../shell/Drawer";
import type { RiskZone } from "./useRiskLayers";

const n = (v: number) => v.toLocaleString("en-US");

export function RiskZoneDetail({ z, conflict }: { z: RiskZone; conflict: ConflictFile }) {
  if (z.nodata) {
    return (
      <>
        <p className="text-[13px]">
          {z.n}
          {z.r ? `, ${z.r}` : ""}: the source has no conflict-event rows for this zone. That is not the same as zero events.
        </p>
        <p className="text-[11px] muted">{conflict.note}</p>
      </>
    );
  }
  const delta = z.e - z.ep;
  const pct = z.ep > 0 ? Math.round((delta / z.ep) * 100) : null;
  const types = [
    { label: "Violence against civilians", v: z.ct },
    { label: "Political violence (battles, explosions)", v: z.pv },
    { label: "Demonstrations", v: z.d },
  ];
  const max = Math.max(...types.map((t) => t.v), 1);
  return (
    <>
      <div className="text-[12px] ink2">
        {z.r} · 12 months to {conflict.through}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Events">
          <span className="mono text-[20px]">{n(z.e)}</span>
        </Field>
        <Field label="Reported fatalities">
          <span className="mono text-[20px]">{n(z.f)}</span>
        </Field>
      </div>
      <Field label="Versus the previous 12 months">
        <span className="mono text-[13px]">
          {n(z.ep)} events → {n(z.e)} ({delta >= 0 ? "+" : ""}
          {n(delta)}
          {pct != null ? `, ${delta >= 0 ? "+" : ""}${pct}%` : ""}) · fatalities {n(z.fp)} → {n(z.f)}
        </span>
      </Field>
      <Field label="By event type">
        <ul className="flex flex-col gap-[5px] mt-1">
          {types.map((t) => (
            <li key={t.label} className="grid grid-cols-[1fr_auto] gap-2 text-[12px]">
              <span>
                {t.label}
                <span className="block h-[6px] bg-[var(--panel-2)] mt-0.5">
                  <span className="block h-full" style={{ width: `${(t.v / max) * 100}%`, background: "var(--accent)" }} />
                </span>
              </span>
              <span className="mono">{n(t.v)}</span>
            </li>
          ))}
        </ul>
      </Field>
      <p className="text-[11px] muted leading-snug">
        {conflict.note} Source:{" "}
        <a href="https://acleddata.com/" target="_blank" rel="noreferrer">
          ACLED ↗
        </a>{" "}
        via{" "}
        <a href={conflict.sourceUrl} target="_blank" rel="noreferrer">
          HDX HAPI ↗
        </a>
        . Zone boundaries: OCHA COD-AB (CC BY-IGO).
      </p>
    </>
  );
}
