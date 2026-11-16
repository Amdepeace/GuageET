"use client";
// Live vessels from Open Waters AIS (https://openwaters.io/ais/): vector tiles of
// every vessel heard in the last 30 minutes (plus stationary ones up to 7 days),
// aggregated from government feeds, aggregators and volunteer receivers. Free
// anonymous tier, called straight from the visitor's browser; no key. Each
// source keeps its own licence (credited via the TileJSON attribution). Coverage
// is uneven: dense in Europe, North America, East Asia and South Africa, and
// absent in much of the Red Sea / Gulf of Aden / East Africa, so an empty sea
// means no receiver, not no ships. Loaded and refreshed only while the layer is on.
import { useEffect } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { Layer } from "@/lib/urlState";
import { FONT } from "./detail";

export const AIS_TILEJSON = "https://ais.openwaters.io/v1/vessels/tiles.json";
export type VesselProps = { mmsi: number; name?: string; kind: string; type?: number; sog?: number; cog?: number; hdg?: number; nav_status?: number; class?: string; flag?: string; length?: number; beam?: number; age_s?: number; source?: string; station?: string };

export const VESSEL_CLASSES: { id: string; label: string; dark: string; light: string }[] = [
  { id: "cargo", label: "Cargo", dark: "#0ea5c6", light: "#0587ad" },
  { id: "tanker", label: "Tanker", dark: "#f08a4b", light: "#c8506a" },
  { id: "passenger", label: "Passenger", dark: "#d95b92", light: "#c2447f" },
  { id: "fishing", label: "Fishing", dark: "#4fb286", light: "#2f8a60" },
  { id: "other", label: "Other", dark: "#9fb0bf", light: "#5f6f7e" },
];

/** ITU ship-and-cargo type code to a plain label */
export function vesselTypeLabel(t?: number): string {
  if (t == null) return "Unknown type";
  if (t >= 70 && t <= 79) return "Cargo ship";
  if (t >= 80 && t <= 89) return "Tanker";
  if (t >= 60 && t <= 69) return "Passenger ship";
  if (t === 30) return "Fishing vessel";
  if (t === 31 || t === 32) return "Towing vessel";
  if (t === 33) return "Dredger";
  if (t === 34) return "Diving vessel";
  if (t === 35) return "Military";
  if (t === 36) return "Sailing vessel";
  if (t === 37) return "Pleasure craft";
  if (t >= 40 && t <= 49) return "High-speed craft";
  if (t === 50) return "Pilot vessel";
  if (t === 51) return "Search and rescue";
  if (t === 52) return "Tug";
  if (t === 53) return "Port tender";
  if (t === 55) return "Law enforcement";
  return t >= 90 && t <= 99 ? "Other vessel" : `Type ${t}`;
}

const colorExpr = (theme: string) => {
  const c = Object.fromEntries(VESSEL_CLASSES.map((v) => [v.id, theme === "light" ? v.light : v.dark]));
  return ["case", ["all", [">=", ["coalesce", ["get", "type"], 0], 70], ["<=", ["coalesce", ["get", "type"], 0], 79]], c.cargo, ["all", [">=", ["coalesce", ["get", "type"], 0], 80], ["<=", ["coalesce", ["get", "type"], 0], 89]], c.tanker, ["all", [">=", ["coalesce", ["get", "type"], 0], 60], ["<=", ["coalesce", ["get", "type"], 0], 69]], c.passenger, ["==", ["coalesce", ["get", "type"], 0], 30], c.fishing, c.other];
};

export function useVesselLayer({ map, ready, layers, theme }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string }) {
  const on = layers.includes("vessels");

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!on) {
      for (const id of ["d-ais-pt", "d-ais-lbl"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--bg").trim() || "#0b1117";
    const ink = cs.getPropertyValue("--ink-2").trim() || "#9fb0bf";
    if (!m.getSource("d-ais")) m.addSource("d-ais", { type: "vector", url: AIS_TILEJSON });
    if (!m.getLayer("d-ais-pt")) {
      m.addLayer({
        id: "d-ais-pt",
        type: "circle",
        source: "d-ais",
        "source-layer": "vessels",
        filter: ["==", ["get", "kind"], "vessel"],
        paint: {
          "circle-color": colorExpr(theme) as never,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 6, 2.6, 10, 5, 14, 8] as never,
          "circle-stroke-color": bg,
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 0, 8, 0.6, 12, 1.2] as never,
          // fade positions that have not been heard for a while
          "circle-opacity": ["interpolate", ["linear"], ["coalesce", ["get", "age_s"], 0], 0, 0.95, 1800, 0.45, 86400, 0.25] as never,
        },
      });
      m.addLayer({ id: "d-ais-lbl", type: "symbol", source: "d-ais", "source-layer": "vessels", minzoom: 10, filter: ["==", ["get", "kind"], "vessel"], layout: { "text-field": ["coalesce", ["get", "name"], ""], "text-font": FONT.regular, "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.2 } });
    }
    for (const id of ["d-ais-pt", "d-ais-lbl"]) m.setLayoutProperty(id, "visibility", "visible");

    // tiles are snapshots rebuilt every ~10 s; reload every 30 s while the page is visible (well inside the anonymous limits)
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const src = m.getSource("d-ais") as unknown as { reload?: () => void } | undefined;
      src?.reload?.();
    }, 30_000);
    return () => clearInterval(t);
  }, [map, ready, on, theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("d-ais-pt")) return;
    m.setPaintProperty("d-ais-pt", "circle-color", colorExpr(theme) as never);
  }, [map, ready, theme]);
}
