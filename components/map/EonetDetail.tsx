"use client";
import { Field } from "../shell/Drawer";
import { eonetColor, type EonetEvent } from "./useEonetLayer";

export function EonetDetail({ e }: { e: EonetEvent }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: eonetColor(e.categoryId) }}>
          {e.category.toUpperCase()}
        </span>
        <span className="text-[12px] muted">latest observation {e.date.slice(0, 16).replace("T", " ")} UTC</span>
      </div>
      <Field label="Location">
        <span className="mono text-[12px]">
          {e.lat.toFixed(3)}, {e.lon.toFixed(3)}
        </span>
      </Field>
      {e.magnitude && (
        <Field label="Magnitude as reported">
          <span className="text-[12px]">{e.magnitude}</span>
        </Field>
      )}
      <Field label="Sources">
        <ul className="text-[12px] flex flex-col gap-1 mt-0.5">
          {e.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.id} ↗
              </a>
            </li>
          ))}
          <li>
            <a href={e.link} target="_blank" rel="noreferrer">
              NASA EONET record ↗
            </a>
          </li>
        </ul>
      </Field>
      <p className="text-[11px] muted leading-snug">NASA EONET aggregates reports from other agencies (GDACS, Smithsonian and others); it is a pointer to those sources, not a verified incident record. Positions are as reported and may be approximate.</p>
    </>
  );
}
