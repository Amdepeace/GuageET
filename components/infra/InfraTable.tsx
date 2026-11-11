"use client";
import { useMemo, useState } from "react";
import type { InfraFeature } from "@/lib/data";
import type { InfraProps } from "@/lib/schema";
import { formatUsd } from "@/lib/format";

export const STATUS_LABEL: Record<InfraProps["status"], string> = {
  operational: "OPERATIONAL",
  trial: "TRIAL",
  under_construction: "UNDER CONSTR.",
  planned: "PLANNED",
  stalled: "STALLED",
};
export const TYPE_LABEL: Record<InfraProps["type"], string> = {
  rail: "Rail",
  road: "Road",
  airport: "Airport",
  dam: "Dam / hydro",
  power_line: "Power line",
  port: "Port",
  corridor: "Trade corridor",
};

type Key = "callsign" | "type" | "status" | "costUsd" | "lastVerified" | "layer";

export function InfraTable({
  infra,
  selected,
  onSelect,
}: {
  infra: InfraFeature[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "layer", dir: 1 });
  const rows = useMemo(() => {
    const r = infra.map((f) => f.properties);
    return r.sort((a, b) => {
      const av = a[sort.key] ?? -Infinity;
      const bv = b[sort.key] ?? -Infinity;
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return c * sort.dir || a.callsign.localeCompare(b.callsign);
    });
  }, [infra, sort]);

  const H = ({ k, children, right }: { k: Key; children: React.ReactNode; right?: boolean }) => (
    <th aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} style={right ? { textAlign: "right" } : undefined}>
      <button
        type="button"
        className="uppercase tracking-[0.1em] cursor-pointer hover:text-[var(--ink)]"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))}
      >
        {children} {sort.key === k ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="panel">
      <div className="panel-title">
        <span>INFRA · Infrastructure tracker</span>
        <span className="grow" />
        <span className="normal-case tracking-normal font-normal muted">{rows.length} projects · curated, reviewed monthly</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="grid text-[12px] min-w-[960px]">
          <thead>
            <tr>
              <H k="callsign">Callsign</H>
              <th>Name</th>
              <H k="type">Type</H>
              <H k="layer">Layer</H>
              <H k="status">Status</H>
              <H k="costUsd" right>
                Cost
              </H>
              <th>Funders</th>
              <th>Connects</th>
              <H k="lastVerified">Verified</H>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="row"
                aria-selected={selected === p.id}
                tabIndex={0}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(p.id))}
              >
                <td className="mono whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  <span
                    aria-hidden
                    className="inline-block w-[10px] h-[3px] mr-2 align-middle"
                    style={{ background: p.type === "power_line" || p.type === "dam" ? "var(--cat-power)" : "var(--cat-transport)" }}
                  />
                  {p.callsign}
                </td>
                <td className="min-w-[200px]">{p.name}</td>
                <td className="whitespace-nowrap ink2">{TYPE_LABEL[p.type]}</td>
                <td className="whitespace-nowrap ink2">{p.layer}</td>
                <td className="mono whitespace-nowrap text-[11px]">{STATUS_LABEL[p.status]}</td>
                <td className="mono text-right whitespace-nowrap" title={p.costNote}>
                  {formatUsd(p.costUsd)}
                  {p.costNote && p.costUsd != null && <span className="muted">*</span>}
                </td>
                <td className="ink2 min-w-[160px]">{p.funders.join("; ")}</td>
                <td className="ink2 min-w-[150px]">{p.connects.join(" · ")}</td>
                <td className="whitespace-nowrap">
                  <span className="mono">{p.lastVerified}</span> {!p.verified && <span className="unverified-tag">UNVERIFIED</span>}
                </td>
                <td className="whitespace-nowrap">
                  <a href={p.sources[0].url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    source ↗
                  </a>
                  {p.sources.length > 1 && <span className="muted"> +{p.sources.length - 1}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[10.5px] muted">
        UNVERIFIED = sources conflict or no current status found. * cost note in detail card. Map lines are schematic.
      </div>
    </div>
  );
}
