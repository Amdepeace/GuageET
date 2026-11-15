"use client";
import type { RsdpFile } from "@/lib/schema";
import { RSDP_COLORS } from "../map/useDetailLayers";

const n = (v: number) => v.toLocaleString("en-US");
const ROMAN = ["", "I", "II", "III", "IV"];

export function RsdpPanel({ data }: { data: RsdpFile }) {
  const s96 = data.surfaceKm["1996"] ?? {};
  const s14 = data.surfaceKm["2014"] ?? {};
  const total = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
  const pct = (s: Record<string, number>) => ((s.paved ?? 0) / Math.max(total(s), 1)) * 100;
  const max = Math.max(...data.phases.map((p) => p.km), 1);
  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>ROADS · RSDP road programme</span>
        <span className="grow" />
        <span className="mono normal-case tracking-normal muted">{data.period}</span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Paved roads in the mapped network</div>
            <div className="mono text-[20px]">
              {n(s96.paved ?? 0)} → {n(s14.paved ?? 0)} km
            </div>
            <div className="text-[11px] muted">
              1996 → 2014 · {pct(s96).toFixed(0)}% → {pct(s14).toFixed(0)}% of the network that had a recorded surface
            </div>
          </div>
          <div>
            <div className="label">Network with a recorded surface</div>
            <div className="mono text-[20px]">
              {n(total(s96))} → {n(total(s14))} km
            </div>
            <div className="text-[11px] muted">1996 → 2014 · includes roads added to the network in that time</div>
          </div>
        </div>

        <div>
          <div className="label mb-1">Links upgraded, by RSDP phase</div>
          <ul className="flex flex-col gap-[6px]">
            {data.phases.map((p) => (
              <li key={p.phase} className="grid grid-cols-[88px_1fr_auto] items-center gap-2">
                <span className="text-[11px]">
                  <span className="inline-block w-[8px] h-[8px] mr-1 align-middle" style={{ background: RSDP_COLORS.dark[p.phase - 1], outline: "1px solid var(--line-strong)" }} />
                  Phase {ROMAN[p.phase]} <span className="muted">({p.startYear})</span>
                </span>
                <span className="relative h-[11px] block bg-[var(--panel-2)]">
                  <span className="absolute top-0 bottom-0 left-0" style={{ width: `max(${(p.km / max) * 100}%, 2px)`, background: RSDP_COLORS.dark[p.phase - 1] }} />
                </span>
                <span className="mono text-[11px] text-right">
                  {n(p.km)} km · {n(p.links)} links
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] muted leading-snug mt-1">
            Phase and start year are as coded in the study&apos;s dataset. Turn on <b>RSDP road upgrades</b> in the map&apos;s layer panel to see them.
          </p>
        </div>

        <div>
          <div className="label mb-1">Paved km by region, 1996 → 2014</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px]">
            {data.regions
              .filter((r) => r.pavedKm2014 > 0)
              .slice(0, 10)
              .map((r) => (
                <li key={r.region} className="flex justify-between gap-2">
                  <span className="truncate">{r.region}</span>
                  <span className="mono">
                    {n(r.pavedKm1996)} → {n(r.pavedKm2014)}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <p className="text-[10.5px] muted leading-snug">
          Source:{" "}
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            World Bank replication package ↗
          </a>{" "}
          (road data provided by the Ethiopian Roads Authority; study:{" "}
          <a href={data.publicationUrl} target="_blank" rel="noreferrer">
            The Impact of Ethiopia&apos;s Road Investment Program ↗
          </a>
          ). This is a historical dataset ending in 2016, not current road status. The repository states no data licence; the map shows simplified geometry and summary totals only, with attribution.
        </p>
      </div>
    </div>
  );
}
