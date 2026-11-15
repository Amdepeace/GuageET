"use client";
// Mineral sites on the map (USGS Africa mineral-industries data release, public
// domain): processing facilities and mines as of the 2018 source year, major
// deposits, and exploration/development sites. Points only; loaded on demand.
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { Layer } from "@/lib/urlState";
import { DETAIL_BASE, FONT } from "./detail";

export type MineralProps = { id: string; k: "facility" | "deposit" | "exploration"; n: string; c: string[]; st: string; op: string; yr: string; d: string; src: string; lc: string; loc: string; adm1: string };
export const MINERAL_KINDS: { k: MineralProps["k"]; label: string; dark: string; light: string }[] = [
  { k: "facility", label: "Mine or plant (2018 source)", dark: "#b8863f", light: "#8f5f12" },
  { k: "deposit", label: "Major deposit", dark: "#7b6cf0", light: "#5a49d6" },
  { k: "exploration", label: "Exploration / development site", dark: "#0ea5c6", light: "#0587ad" },
];

const colorExpr = (theme: string) => ["match", ["get", "k"], ...MINERAL_KINDS.flatMap((m) => [m.k, theme === "light" ? m.light : m.dark]), "#888"];

export function useMineralLayers({ map, ready, layers, theme }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; count: number }>({ loading: false, error: null, count: 0 });
  const data = useRef<unknown>(null);
  const on = layers.includes("minerals");

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!on) {
      for (const id of ["d-min-pt", "d-min-lbl"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    let alive = true;
    (async () => {
      try {
        if (!data.current) {
          setState((s) => ({ ...s, loading: true }));
          const r = await fetch(`${DETAIL_BASE}/minerals.json`);
          if (!r.ok) throw new Error(`minerals.json HTTP ${r.status}`);
          data.current = await r.json();
        }
        if (!alive) return;
        const fc = data.current as { features: unknown[] };
        if (!m.getSource("d-min")) m.addSource("d-min", { type: "geojson", data: fc as never });
        const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0b1117";
        const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink-2").trim() || "#9fb0bf";
        if (!m.getLayer("d-min-pt")) {
          m.addLayer({ id: "d-min-pt", type: "circle", source: "d-min", paint: { "circle-color": colorExpr(theme) as never, "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 8, 6, 12, 9] as never, "circle-stroke-color": bg, "circle-stroke-width": 1.4, "circle-opacity": 0.95 } });
          m.addLayer({ id: "d-min-lbl", type: "symbol", source: "d-min", minzoom: 7, layout: { "text-field": ["get", "n"], "text-font": FONT.regular, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.3 } });
        }
        for (const id of ["d-min-pt", "d-min-lbl"]) m.setLayoutProperty(id, "visibility", "visible");
        setState({ loading: false, error: null, count: fc.features.length });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [map, ready, on, theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("d-min-pt")) return;
    m.setPaintProperty("d-min-pt", "circle-color", colorExpr(theme) as never);
    m.setPaintProperty("d-min-pt", "circle-stroke-color", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0b1117");
  }, [map, ready, theme]);

  return state;
}
