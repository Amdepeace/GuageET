"use client";
import { Field } from "../shell/Drawer";
import { MINERAL_KINDS, type MineralProps } from "./useMineralLayers";

const KIND_TEXT: Record<MineralProps["k"], string> = {
  facility: "Mine, quarry or processing plant, as listed in the USGS 2018 Minerals Yearbook. Status is as of that source year, not today.",
  deposit: "Major mineral deposit from USGS compilations. This is a geological record, not a statement that it is being mined.",
  exploration: "Exploration or development project from the USGS World Minerals Exploration Database. The year is when the project was last verified active, and projects often lapse.",
};

export function MineralDetail({ p }: { p: MineralProps }) {
  const kind = MINERAL_KINDS.find((k) => k.k === p.k)!;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: kind.dark }}>
          {kind.label.toUpperCase()}
        </span>
        {p.st && <span className="text-[12px] ink2">{p.st}</span>}
        {p.yr && <span className="text-[12px] muted">· {p.k === "exploration" ? `last verified active ${p.yr}` : `source year ${p.yr}`}</span>}
      </div>
      <p className="text-[12px] ink2 leading-snug">{KIND_TEXT[p.k]}</p>
      <Field label="Commodities">
        <span className="text-[13px]">{p.c.length ? p.c.join(", ") : "not listed"}</span>
      </Field>
      {p.d && (
        <Field label="Details">
          <span className="text-[12px]">{p.d}</span>
        </Field>
      )}
      {p.op && (
        <Field label={p.k === "exploration" ? "Owner" : "Operator"}>
          <span className="text-[12px]">{p.op}</span>
        </Field>
      )}
      <Field label="Location">
        <span className="text-[12px]">
          {[p.adm1, p.loc].filter(Boolean).join(" · ") || "no description"}
          {p.lc ? ` · location accuracy class ${p.lc} (A best)` : ""}
        </span>
      </Field>
      <p className="text-[11px] muted leading-snug">
        Source: {p.src || "USGS"}. Compiled in the USGS data release{" "}
        <a href="https://doi.org/10.5066/P97EQWXP" target="_blank" rel="noreferrer">
          Mineral Industries of Africa (2024) ↗
        </a>
        . Public domain. Records may be out of date and positions approximate; this is not a licence, reserve or ownership record.
      </p>
    </>
  );
}
