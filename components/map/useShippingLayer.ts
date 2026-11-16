"use client";
// Ports and chokepoints on the map from IMF PortWatch: circle size = port calls
// in the last 30 days, colour = change against the 30 days before. Near-live
// (PortWatch lags by several days); every popup states its as-of date.
import { useEffect } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import type { PortsFile, RedSeaFile } from "@/lib/schema";
import type { Layer } from "@/lib/urlState";
import { FONT } from "./detail";

export type ShipPick = { kind: "port" | "choke"; id: string };
export const SHIP_COLORS = {
  dark: { up: "#0ea5c6", flat: "#9fb0bf", down: "#f08a4b" },
  light: { up: "#0587ad", flat: "#5f6f7e", down: "#c8506a" },
};

/** change in port calls versus the prior 30 days, or null when there is no prior window */
export const portChange = (calls: number, prior: number) => (prior > 0 ? ((calls - prior) / prior) * 100 : null);

const colorExpr = (theme: string) => {
  const c = SHIP_COLORS[theme === "light" ? "light" : "dark"];
  return ["case", ["==", ["get", "k"], "choke"], "transparent", ["!", ["has", "pct"]], c.flat, [">=", ["get", "pct"], 15], c.up, ["<=", ["get", "pct"], -15], c.down, c.flat];
};

export function useShippingLayer({ map, ready, layers, theme, ports, redsea }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string; ports: PortsFile; redsea: RedSeaFile }) {
  const on = layers.includes("ships");

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!on || !ports.available) {
      for (const id of ["d-ship-pt", "d-ship-lbl"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--bg").trim() || "#0b1117";
    const ink = cs.getPropertyValue("--ink-2").trim() || "#9fb0bf";
    const features = [
      ...ports.ports.map((p) => {
        const pct = portChange(p.calls30, p.calls30Prior);
        return { type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { k: "port", id: p.id, n: p.name, c: p.country, calls: p.calls30, asOf: p.asOf, ...(pct != null ? { pct: Math.round(pct) } : {}) } };
      }),
      ...ports.chokepoints.map((c) => {
        const cp = redsea.chokepoints.find((x) => x.id === c.id);
        const last = cp?.history.at(-1);
        return { type: "Feature", geometry: { type: "Point", coordinates: [c.lon, c.lat] }, properties: { k: "choke", id: c.id, n: c.name, c: "", calls: last?.ships ?? 0, asOf: last?.date ?? "" } };
      }),
    ];
    const fc = { type: "FeatureCollection", features };
    if (!m.getSource("d-ship")) m.addSource("d-ship", { type: "geojson", data: fc as never });
    else (m.getSource("d-ship") as GeoJSONSource).setData(fc as never);
    if (!m.getLayer("d-ship-pt")) {
      m.addLayer({
        id: "d-ship-pt",
        type: "circle",
        source: "d-ship",
        paint: {
          "circle-color": colorExpr(theme) as never,
          "circle-radius": ["interpolate", ["linear"], ["get", "calls"], 0, 5, 25, 7, 100, 11, 250, 15] as never,
          "circle-stroke-color": ["case", ["==", ["get", "k"], "choke"], ink, bg] as never,
          "circle-stroke-width": ["case", ["==", ["get", "k"], "choke"], 2, 1.4] as never,
          "circle-opacity": 0.92,
        },
      });
      m.addLayer({ id: "d-ship-lbl", type: "symbol", source: "d-ship", layout: { "text-field": ["get", "n"], "text-font": FONT.regular, "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.3 } });
    }
    for (const id of ["d-ship-pt", "d-ship-lbl"]) m.setLayoutProperty(id, "visibility", "visible");
  }, [map, ready, on, ports, redsea, theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("d-ship-pt")) return;
    m.setPaintProperty("d-ship-pt", "circle-color", colorExpr(theme) as never);
  }, [map, ready, theme]);
}
