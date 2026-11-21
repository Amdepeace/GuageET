"use client";
import type { PopulationZonesFile } from "@/lib/schema";
import { ageGroups, medianAge, ZONE_WIDTHS } from "@/lib/demography";
import { Field } from "../shell/Drawer";
import { Pyramid } from "../demography/Pyramid";
import type { SoilZone } from "./useRiskLayers";

const n = (v: number) => v.toLocaleString("en-US");

export function PopulationZoneDetail({ zone, pop, areaKm2 }: { zone: SoilZone; pop: PopulationZonesFile; areaKm2: number }) {
  const z = pop.zones.find((x) => x.id === zone.id);
  if (!z) {
    return (
      <>
        <p className="text-[13px]">
          {zone.n}
          {zone.r ? `, ${zone.r}` : ""}: the population source has no complete record for this zone, so nothing is shown (not zero).
        </p>
        <p className="text-[11px] muted">{pop.note}</p>
      </>
    );
  }
  const m = z.m.reduce((a, b) => a + b, 0);
  const f = z.f.reduce((a, b) => a + b, 0);
  const g = ageGroups(z.m, z.f, 13);
  const med = medianAge(z.m, z.f, ZONE_WIDTHS);
  return (
    <>
      <div className="text-[12px] ink2">
        {z.region} · reference year {pop.period}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Population">
          <span className="mono text-[20px]">{n(z.total)}</span>
        </Field>
        <Field label="Density">
          <span className="mono text-[20px]">{areaKm2 > 0 ? `${Math.round(z.total / areaKm2)}/km²` : "—"}</span>
        </Field>
        <Field label="Median age (computed)">
          <span className="mono text-[20px]">{med ?? "—"}</span>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3 text-[12px]">
        <Field label="Female share">
          <span className="mono">{((f / (m + f)) * 100).toFixed(1)}%</span>
        </Field>
        <Field label="Under 15">
          <span className="mono">{g.young.toFixed(1)}%</span>
        </Field>
        <Field label="65 and over">
          <span className="mono">{g.old.toFixed(1)}%</span>
        </Field>
      </div>
      <div>
        <div className="label mb-1">
          Population pyramid, {pop.period} · <span style={{ color: "#0ea5c6" }}>male</span> · <span style={{ color: "#d95b92" }}>female</span>
        </div>
        <Pyramid bands={pop.bands} m={z.m} f={z.f} height={300} />
      </div>
      <p className="text-[11px] muted leading-snug">
        {pop.note} Source:{" "}
        <a href={pop.sourceUrl} target="_blank" rel="noopener noreferrer">
          OCHA COD-PS via HDX ↗
        </a>
        . Median age is computed from the 5-year age bands.
      </p>
    </>
  );
}
