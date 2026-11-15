"use client";
import type { ConflictFile, RainfallFile, SoilFile } from "@/lib/schema";
import { Field } from "../shell/Drawer";
import type { RiskPick, RiskZone } from "./useRiskLayers";

const n = (v: number) => v.toLocaleString("en-US");

export function RiskZoneDetail({ pick, conflict, rainfall, soil }: { pick: RiskPick; conflict: ConflictFile; rainfall: RainfallFile; soil: SoilFile }) {
  if (pick.kind === "soil") {
    const z = pick.z;
    return (
      <>
        <div className="text-[12px] ink2">
          {z.r} · topsoil {soil.depth}
        </div>
        <ul className="flex flex-col gap-2">
          {soil.properties.map((p) => {
            const s = p.zones[z.id];
            return (
              <li key={p.id} className="panel p-2">
                <div className="label">{p.label}</div>
                {s ? (
                  <div className="mono text-[13px]">
                    {s.mean} {p.unit} <span className="muted">· pixels range {s.p10}–{s.p90} (10th–90th percentile) · whole country {p.national.mean}</span>
                  </div>
                ) : (
                  <div className="text-[12px] muted">no data for this zone</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] muted leading-snug">
          {soil.note} {soil.period}. Source:{" "}
          <a href={soil.sourceUrl} target="_blank" rel="noreferrer">
            iSDAsoil ↗
          </a>{" "}
          ({soil.license}). Cite: {soil.citation}
        </p>
      </>
    );
  }
  if (pick.kind === "rain") {
    const z = pick.z;
    return (
      <>
        <div className="text-[12px] ink2">
          {rainfall.from} to {rainfall.to} ({rainfall.windowDays} days)
        </div>
        {z.rated ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rain">
                <span className="mono text-[20px]">{n(z.mm)} mm</span>
              </Field>
              <Field label={`Normal ${rainfall.baseline}`}>
                <span className="mono text-[20px]">{n(z.nm)} mm</span>
              </Field>
              <Field label="Of normal">
                <span className="mono text-[20px]">{z.pct}%</span>
              </Field>
            </div>
            <p className="text-[12px]">{z.pct < 75 ? "Markedly drier than normal for these weeks." : z.pct > 125 ? "Markedly wetter than normal for these weeks." : "Within about a quarter of normal."}</p>
          </>
        ) : (
          <p className="text-[13px]">This region is in its dry season: the normal for these weeks is under 20 mm, so a percentage would swing wildly and is not rated.</p>
        )}
        <p className="text-[11px] muted leading-snug">
          {rainfall.note} Source:{" "}
          <a href={rainfall.sourceUrl} target="_blank" rel="noreferrer">
            Open-Meteo / ERA5 ↗
          </a>
          . Region boundaries: OCHA COD-AB (CC BY-IGO).
        </p>
      </>
    );
  }
  const z: RiskZone = pick.z;
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
