"use client";
import type { Quake } from "@/lib/usgs";
import { QUAKE_SOURCE, QUAKE_SOURCE_URL } from "@/lib/usgs";
import { Field } from "../shell/Drawer";

export function QuakeDetail({ q, now }: { q: Quake; now: number | null }) {
  const when = new Date(q.time);
  const hrs = now ? (now - q.time) / 3_600_000 : null;
  return (
    <>
      <div>
        <div className="label">Magnitude</div>
        <div className="mono text-[32px] font-semibold leading-tight" style={{ color: "var(--quake)" }}>
          M {q.mag.toFixed(1)}
        </div>
        <div className="text-[12px] ink2">{q.place}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <Field label="When (UTC)">
          <span className="mono">{when.toISOString().slice(0, 16).replace("T", " ")}</span>
          {hrs != null && <div className="muted text-[11px]">{hrs < 48 ? `${hrs.toFixed(0)}h ago` : `${(hrs / 24).toFixed(0)}d ago`}</div>}
        </Field>
        <Field label="Depth">
          <span className="mono">{q.depth.toFixed(0)} km</span>
        </Field>
        <Field label="Coordinates">
          <span className="mono">
            {q.lat.toFixed(2)}, {q.lon.toFixed(2)}
          </span>
        </Field>
        <Field label="Source">
          <a href={q.url || QUAKE_SOURCE_URL} target="_blank" rel="noreferrer">
            {QUAKE_SOURCE} ↗
          </a>
        </Field>
      </div>
      <p className="text-[11px] muted">
        Live feed, magnitude 2.5+, filtered to the Horn of Africa and the East African Rift. Larger and more recent events draw a bigger, pulsing marker.
      </p>
    </>
  );
}
