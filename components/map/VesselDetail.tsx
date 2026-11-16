"use client";
import { Field } from "../shell/Drawer";
import { vesselTypeLabel, type VesselProps } from "./useVesselLayer";

const NAV: Record<number, string> = { 0: "Under way using engine", 1: "At anchor", 2: "Not under command", 3: "Restricted manoeuvrability", 4: "Constrained by draught", 5: "Moored", 6: "Aground", 7: "Engaged in fishing", 8: "Under way sailing", 15: "Not defined" };

function ago(s?: number) {
  if (s == null) return "unknown";
  if (s < 90) return `${Math.round(s)} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export function VesselDetail({ v, lat, lon }: { v: VesselProps; lat: number; lon: number }) {
  const moving = (v.sog ?? 0) > 0.5;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: "var(--line-strong)" }}>
          {vesselTypeLabel(v.type).toUpperCase()}
        </span>
        <span className="text-[12px] ink2">{v.name?.trim() || "Unnamed"}</span>
        {v.flag && <span className="mono text-[11px] muted">flag {v.flag}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Speed">
          <span className="mono text-[18px]">{v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}</span>
        </Field>
        <Field label="Course">
          <span className="mono text-[18px]">{v.cog != null ? `${Math.round(v.cog)}°` : "—"}</span>
        </Field>
        <Field label="Last heard">
          <span className="mono text-[14px]">{ago(v.age_s)}</span>
        </Field>
      </div>
      <Field label="Status">
        <span className="text-[12px]">{v.nav_status != null && NAV[v.nav_status] ? NAV[v.nav_status] : moving ? "Under way" : "Stationary"}</span>
      </Field>
      <Field label="Identity">
        <span className="mono text-[12px]">
          MMSI {v.mmsi}
          {v.class ? ` · AIS class ${v.class}` : ""}
          {v.length ? ` · ${v.length} m × ${v.beam ?? "?"} m` : ""}
        </span>
      </Field>
      <p className="text-[11px] muted leading-snug">
        Position as broadcast by the vessel and relayed by receivers (heard by {v.source ?? "an open feed"}
        {v.station ? `, station ${v.station}` : ""}). AIS is self-reported and can be wrong, switched off or spoofed; this is not a navigation or enforcement source.{" "}
        <a href="https://openwaters.io/ais/" target="_blank" rel="noopener noreferrer">
          Open Waters AIS ↗
        </a>
        . Data licence is per source (see their licence page).{" "}
        <a href={`https://www.marinetraffic.com/en/ais/home/centerx:${lon.toFixed(3)}/centery:${lat.toFixed(3)}/zoom:11`} target="_blank" rel="noopener noreferrer">
          View this area on MarineTraffic ↗
        </a>
      </p>
    </>
  );
}
