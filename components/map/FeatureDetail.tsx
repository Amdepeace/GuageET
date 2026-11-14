"use client";
import type { FacCat } from "@/lib/urlState";
import { FAC_META, pretty, type DetailFeature } from "./detail";
import { Field } from "../shell/Drawer";

const KIND_LABEL: Record<DetailFeature["kind"], string> = {
  facility: "Facility",
  road: "Road",
  street: "Street",
  river: "River",
  stream: "Stream",
  water: "Water body",
  place: "Place",
  rail: "Railway",
  station: "Railway station",
  runway: "Runway",
};

export function featureTitle(f: DetailFeature): string {
  const p = f.props;
  const name = (p.n as string) || (p.a as string);
  if (name) return name;
  const t = (p.t as string) || (p.h as string);
  return t ? `Unnamed ${pretty(t).toLowerCase()}` : `Unnamed ${KIND_LABEL[f.kind].toLowerCase()}`;
}

export function FeatureDetail({ f }: { f: DetailFeature }) {
  const p = f.props as Record<string, string | number | undefined>;
  const cat = p.k ? FAC_META[p.k as FacCat] : null;
  const type = p.t ?? p.h;
  const osm = typeof p.i === "string" && /^(node|way|relation)\/\d+$/.test(p.i) ? `https://www.openstreetmap.org/${p.i}` : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] px-1.5 border" style={{ borderColor: "var(--line-strong)" }}>
          {KIND_LABEL[f.kind].toUpperCase()}
        </span>
        {type && <span className="text-[12px] ink2">{pretty(type)}</span>}
        {cat && <span className="text-[12px] muted">· {cat.label}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        {p.n && (
          <Field label="Name">
            {p.n}
          </Field>
        )}
        {p.a && (
          <Field label="Amharic name">
            <span className="am">{p.a}</span>
          </Field>
        )}
        {f.kind === "place" && p.pop != null && (
          <Field label="Population (as mapped)">
            <span className="mono">{Number(p.pop).toLocaleString()}</span>
          </Field>
        )}
        {f.kind === "water" && p.s != null && (
          <Field label="Area">
            <span className="mono">{Number(p.s).toLocaleString()} km²</span>
          </Field>
        )}
        {(p.w || p.r) && (
          <Field label="Location">
            {[p.w, p.r].filter(Boolean).join(", ")}
          </Field>
        )}
        <Field label="Coordinates">
          <span className="mono">
            {f.lngLat[1].toFixed(4)}, {f.lngLat[0].toFixed(4)}
          </span>
        </Field>
      </div>

      <p className="text-[11px] muted leading-snug">
        {cat ? cat.note.charAt(0).toUpperCase() + cat.note.slice(1) + ". " : ""}
        Mapped by OpenStreetMap volunteers; positions and details can be incomplete or out of date.
      </p>

      <div className="text-[12px] flex flex-col gap-1">
        {osm && (
          <a href={osm} target="_blank" rel="noreferrer">
            View or correct on OpenStreetMap ↗
          </a>
        )}
        <span className="muted text-[10.5px]">
          Data: © OpenStreetMap contributors (ODbL), via the Humanitarian OpenStreetMap Team on{" "}
          <a href="https://data.humdata.org/organization/hot" target="_blank" rel="noreferrer">
            HDX
          </a>
          .
        </span>
      </div>
    </>
  );
}
