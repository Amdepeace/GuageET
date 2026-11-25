"use client";
// El Niño watch on the map: NOAA's four Niño regions in the equatorial Pacific coloured by the
// latest weekly sea-surface-temperature anomaly (NOAA CPC), plus two annotation markers on
// Ethiopia for the seasonal rainfall tendencies agencies have published (FEWS NET, ICPAC).
// The markers are placed approximately and are not boundaries. Pair with "Rainfall vs normal"
// to see what is actually happening on the ground.
import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { EnsoFile, EnsoImpactsFile } from "@/lib/schema";
import type { Layer } from "@/lib/urlState";
import { FONT } from "./detail";

// NOAA region definitions: [west, south, east, north]; longitudes past 180 are east of the date line
const BOXES: { id: string; name: string; bbox: [number, number, number, number]; key: "n12" | "n3" | "n34" | "n4"; label: [number, number] }[] = [
  { id: "n4", name: "Niño-4", bbox: [160, -5, 210, 5], key: "n4", label: [185, 8.5] },
  { id: "n3", name: "Niño-3", bbox: [-150, -5, -90, 5], key: "n3", label: [-112, 8.5] },
  { id: "n12", name: "Niño-1+2", bbox: [-90, -10, -80, 0], key: "n12", label: [-84, -13] },
  { id: "n34", name: "Niño-3.4", bbox: [-170, -5, -120, 5], key: "n34", label: [-145, -8.5] },
];
export const ENSO_BOUNDS: [[number, number], [number, number]] = [[-205, -20], [-72, 18]]; // the four Niño boxes (Niño-4 sits across the date line, so west of -180 is the same ocean)
export const ENSO_STEPS: { min: number; color: string; label: string }[] = [
  { min: 3, color: "#b3261e", label: "+3.0 °C or more" },
  { min: 2, color: "#d9534f", label: "+2.0 to +3.0" },
  { min: 1, color: "#e08a3c", label: "+1.0 to +2.0" },
  { min: 0.5, color: "#d6b24a", label: "+0.5 to +1.0" },
  { min: -99, color: "#4f8fc0", label: "below +0.5" },
];

function build(enso: EnsoFile, impacts: EnsoImpactsFile) {
  const w = enso.weekly.at(-1);
  const feats: unknown[] = [];
  for (const b of BOXES) {
    const [x0, y0, x1, y1] = b.bbox;
    const pair = w?.[b.key];
    feats.push({ type: "Feature", properties: { k: "box", id: b.id, a: pair?.[1] ?? 0, t: pair ? `${b.name}\n${pair[1] >= 0 ? "+" : "−"}${Math.abs(pair[1]).toFixed(1)} °C` : b.name }, geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } });
    feats.push({ type: "Feature", properties: { k: "lbl", a: pair?.[1] ?? 0, t: pair ? `${b.name}\n${pair[1] >= 0 ? "+" : "−"}${Math.abs(pair[1]).toFixed(1)} °C` : b.name }, geometry: { type: "Point", coordinates: b.label } });
  }
  for (const n of impacts.mapNotes) feats.push({ type: "Feature", properties: { k: "note", kind: n.kind, t: n.label, src: n.source }, geometry: { type: "Point", coordinates: [n.lon, n.lat] } });
  return { type: "FeatureCollection", features: feats };
}

const IDS = ["d-enso-fill", "d-enso-line", "d-enso-lbl", "d-enso-note", "d-enso-note-lbl"];

export function useEnsoLayer({ map, ready, layers, theme, enso, impacts }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string; enso: EnsoFile; impacts: EnsoImpactsFile }) {
  const on = layers.includes("enso");
  const was = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    // first time it is switched on: frame the equatorial Pacific, where the signal is measured
    if (on && !was.current && m.getZoom() > 3.2) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.fitBounds(ENSO_BOUNDS, { padding: 20, duration: reduce ? 0 : 900 });
    }
    was.current = on;
    if (!on) {
      for (const id of IDS) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const css = (n: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
    const bg = css("--bg", "#0b1117");
    const ink = css("--ink", "#dbe6ef");
    const data = build(enso, impacts);
    if (!m.getSource("d-enso")) m.addSource("d-enso", { type: "geojson", data: data as never });
    else (m.getSource("d-enso") as unknown as { setData: (d: unknown) => void }).setData(data);
    const colour = ["step", ["get", "a"], ENSO_STEPS[4].color, 0.5, ENSO_STEPS[3].color, 1, ENSO_STEPS[2].color, 2, ENSO_STEPS[1].color, 3, ENSO_STEPS[0].color];
    const isBox = ["==", ["get", "k"], "box"];
    if (!m.getLayer("d-enso-fill")) {
      m.addLayer({ id: "d-enso-fill", type: "fill", source: "d-enso", filter: isBox as never, paint: { "fill-color": colour as never, "fill-opacity": 0.28 } });
      m.addLayer({ id: "d-enso-line", type: "line", source: "d-enso", filter: isBox as never, paint: { "line-color": colour as never, "line-width": 1.8 } });
      m.addLayer({
        id: "d-enso-lbl",
        type: "symbol",
        source: "d-enso",
        filter: ["==", ["get", "k"], "lbl"] as never,
        layout: { "text-field": ["get", "t"], "text-font": FONT.medium, "text-size": 12, "text-allow-overlap": true, "text-line-height": 1.15 },
        paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.6 },
      });
      m.addLayer({
        id: "d-enso-note",
        type: "circle",
        source: "d-enso",
        filter: ["==", ["get", "k"], "note"] as never,
        paint: { "circle-radius": 7, "circle-color": ["match", ["get", "kind"], "dry", "#cf9440", "#37a39a"] as never, "circle-stroke-color": bg, "circle-stroke-width": 2, "circle-opacity": 0.95 },
      });
      m.addLayer({
        id: "d-enso-note-lbl",
        type: "symbol",
        source: "d-enso",
        filter: ["==", ["get", "k"], "note"] as never,
        layout: { "text-field": ["get", "t"], "text-font": FONT.medium, "text-size": 12, "text-offset": [0, 1.2], "text-anchor": "top", "text-allow-overlap": true },
        paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.6 },
      });
    }
    for (const id of IDS) m.setLayoutProperty(id, "visibility", "visible");
  }, [map, ready, on, theme, enso, impacts]);
}
