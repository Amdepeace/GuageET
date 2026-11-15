"use client";
import type { Corridor } from "@/lib/schema";
import { Field } from "../shell/Drawer";
import { STATUS_LABEL } from "../infra/InfraTable";

export function CorridorDetail({ c, originName }: { c: Corridor; originName: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: "var(--line-strong)" }}>
          {STATUS_LABEL[c.status]}
        </span>
        <span className="text-[12px] ink2">
          {originName} → {c.port}
        </span>
        {!c.verified && <span className="unverified-tag">UNVERIFIED</span>}
      </div>
      <p className="text-[13px] leading-relaxed">{c.summary}</p>
      <Field label="Sources">
        <ul className="text-[12px] flex flex-col gap-1 mt-0.5">
          {c.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            </li>
          ))}
        </ul>
      </Field>
      <p className="text-[11px] muted leading-snug">
        The arc shows the corridor between {originName} and the port; it does not encode trade volume. Status and sources come from the linked infrastructure records ({c.infraIds.join(", ")}) in the tracker below.
        {!c.verified && " This status is marked unverified there: the cited sources conflict, are undated, or no current report was found."}
      </p>
    </>
  );
}
