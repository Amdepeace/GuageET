"use client";
import type { InfraProps } from "@/lib/schema";
import { formatUsd } from "@/lib/format";
import { Field } from "../shell/Drawer";
import { STATUS_LABEL, TYPE_LABEL } from "./InfraTable";

export function InfraDetail({ p }: { p: InfraProps }) {
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: "var(--line-strong)" }}>
          {STATUS_LABEL[p.status]}
        </span>
        <span className="text-[12px] ink2">
          {TYPE_LABEL[p.type]} · {p.layer}
        </span>
        {!p.verified && <span className="unverified-tag">UNVERIFIED</span>}
      </div>
      <p className="text-[13px] leading-relaxed">{p.summary}</p>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <Field label="Cost">
          <span className="mono">{formatUsd(p.costUsd)}</span>
          {p.costNote && <div className="muted text-[11px]">{p.costNote}</div>}
        </Field>
        <Field label="Last verified">
          <span className="mono">{p.lastVerified}</span>
        </Field>
        <Field label="Funders">{p.funders.join("; ")}</Field>
        <Field label="Connects">{p.connects.join(" · ")}</Field>
      </div>
      <Field label="Sources">
        <ul className="text-[12px] flex flex-col gap-1 mt-0.5">
          {p.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            </li>
          ))}
        </ul>
      </Field>
      <p className="text-[11px] muted">{p.geometryNote}</p>
      {!p.verified && (
        <p className="text-[11px]" style={{ color: "var(--warn)" }}>
          Marked unverified: the cited sources conflict, are undated, or no current status report was found. Check before relying on it.
        </p>
      )}
    </>
  );
}
