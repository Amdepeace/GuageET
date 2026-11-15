"use client";
// Risk heatmap layers on the map. Currently: conflict events by zone (ACLED data
// via HDX HAPI) over the last 12 complete months, shaded by event count.
// Zones HAPI has no rows for are drawn as hatched-grey "no data", never as zero.
// Boundaries: OCHA COD-AB Ethiopia (CC BY-IGO). Loaded on demand.
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import type { ConflictFile } from "@/lib/schema";
import type { Layer } from "@/lib/urlState";
import { DETAIL_BASE, LAYER_ORDER } from "./detail";

export const CONFLICT_BREAKS = [1, 10, 30, 80, 200];
export const CONFLICT_COLORS = {
  dark: ["#3a2b52", "#6a3a73", "#a1427a", "#d4546a", "#f08a4b", "#fbc552"],
  light: ["#f6e3c8", "#f4b98a", "#e8825f", "#c8506a", "#8e3a7d", "#4b2a6b"],
};

export type RiskZone = { id: string; n: string; r: string; nodata: boolean; e: number; f: number; ep: number; fp: number; ct: number; d: number; pv: number };

const fillColor = (theme: string) => {
  const c = CONFLICT_COLORS[theme === "light" ? "light" : "dark"];
  const step: unknown[] = ["step", ["get", "e"], c[0]];
  CONFLICT_BREAKS.forEach((b, i) => step.push(b, c[i + 1]));
  return ["case", ["get", "nodata"], theme === "light" ? "#c9d2da" : "#26323d", step];
};

export function useRiskLayers({ map, ready, layers, theme, conflict }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string; conflict: ConflictFile }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const fc = useRef<{ type: string; features: { properties: Record<string, unknown> }[] } | null>(null);
  const on = layers.includes("conflict");

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const vis = on ? "visible" : "none";
    if (!on) {
      for (const id of ["d-risk-fill", "d-risk-line"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", vis);
      return;
    }
    let alive = true;
    (async () => {
      try {
        if (!fc.current) {
          setState({ loading: true, error: null });
          const r = await fetch(`${DETAIL_BASE}/admin2.json`);
          if (!r.ok) throw new Error(`admin2.json HTTP ${r.status}`);
          fc.current = await r.json();
        }
        if (!alive || !fc.current) return;
        // join the conflict counts onto the zone polygons
        for (const f of fc.current.features) {
          const p = f.properties as { id: string };
          const a = conflict.available ? conflict.areas[p.id] : undefined;
          Object.assign(f.properties, a ? { nodata: false, e: a.events, f: a.fatalities, ep: a.eventsPrior, fp: a.fatalitiesPrior, ct: a.byType.civilian_targeting, d: a.byType.demonstration, pv: a.byType.political_violence } : { nodata: true, e: 0, f: 0, ep: 0, fp: 0, ct: 0, d: 0, pv: 0 });
        }
        if (!m.getSource("d-risk")) m.addSource("d-risk", { type: "geojson", data: fc.current as never });
        else (m.getSource("d-risk") as GeoJSONSource).setData(fc.current as never);
        let before: string | undefined = LAYER_ORDER.find((id) => m.getLayer(id));
        if (!before && m.getLayer("infra-halo")) before = "infra-halo";
        if (!m.getLayer("d-risk-fill")) m.addLayer({ id: "d-risk-fill", type: "fill", source: "d-risk", paint: { "fill-color": fillColor(theme) as never, "fill-opacity": 0.72 } }, before);
        if (!m.getLayer("d-risk-line")) m.addLayer({ id: "d-risk-line", type: "line", source: "d-risk", paint: { "line-color": theme === "light" ? "#ffffff" : "#0b1117", "line-width": 0.6, "line-opacity": 0.8 } }, before);
        for (const id of ["d-risk-fill", "d-risk-line"]) m.setLayoutProperty(id, "visibility", "visible");
        setState({ loading: false, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, error: (e as Error).message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [map, ready, on, conflict, theme]);

  // theme changes recolour in place
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("d-risk-fill")) return;
    m.setPaintProperty("d-risk-fill", "fill-color", fillColor(theme) as never);
    m.setPaintProperty("d-risk-line", "line-color", theme === "light" ? "#ffffff" : "#0b1117");
  }, [map, ready, theme]);

  return state;
}
