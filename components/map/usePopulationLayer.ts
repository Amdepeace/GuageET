"use client";
// Population by zone on the map (OCHA COD-PS 2022 via HDX HAPI): population,
// density, female share, share aged under 15, share 65+, and median age
// (computed from the 5-year age bands). Zones the source lacks are grey "no data".
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import type { PopulationZonesFile, PopZone } from "@/lib/schema";
import type { Layer } from "@/lib/urlState";
import { ageGroups, medianAge, ZONE_WIDTHS } from "@/lib/demography";
import { DETAIL_BASE, LAYER_ORDER } from "./detail";

export type PopMetric = "pop" | "density" | "female" | "young" | "old" | "median";
export const POP_METRICS: { id: PopMetric; label: string; unit: string; fmt: (v: number) => string }[] = [
  { id: "pop", label: "Population", unit: "people", fmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`) },
  { id: "density", label: "Population density", unit: "people per km²", fmt: (v) => (v >= 100 ? `${Math.round(v)}` : v.toFixed(1)) },
  { id: "female", label: "Female share", unit: "% of population", fmt: (v) => `${v.toFixed(1)}%` },
  { id: "young", label: "Children under 15", unit: "% of population", fmt: (v) => `${v.toFixed(1)}%` },
  { id: "old", label: "People aged 65+", unit: "% of population", fmt: (v) => `${v.toFixed(1)}%` },
  { id: "median", label: "Median age (computed)", unit: "years", fmt: (v) => `${v.toFixed(1)}` },
];
export const POP_COLORS = {
  dark: ["#26305a", "#3d4a96", "#5b6fcf", "#8aa0ea", "#c4d2ff"],
  light: ["#e8eeff", "#c3d0fb", "#90a8f0", "#5a76d6", "#2c3f94"],
};
export type PopZoneHit = { id: string; n: string; r: string };

export function zoneMetric(z: PopZone, metric: PopMetric, areaKm2: number): number | null {
  const tot = z.m.reduce((a, b) => a + b, 0) + z.f.reduce((a, b) => a + b, 0);
  if (!tot) return null;
  switch (metric) {
    case "pop":
      return z.total;
    case "density":
      return areaKm2 > 0 ? z.total / areaKm2 : null;
    case "female":
      return (z.f.reduce((a, b) => a + b, 0) / tot) * 100;
    case "young":
      return ageGroups(z.m, z.f, 13).young;
    case "old":
      return ageGroups(z.m, z.f, 13).old;
    case "median":
      return medianAge(z.m, z.f, ZONE_WIDTHS);
  }
}

type Fc = { type: string; features: { properties: Record<string, unknown> }[] };
const quint = (vals: number[]) => {
  const v = [...vals].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
};

export function popBreaks(pop: PopulationZonesFile, metric: PopMetric, areas: Map<string, number>): number[] {
  const vals = pop.zones.map((z) => zoneMetric(z, metric, areas.get(z.id) ?? 0)).filter((v): v is number => v != null);
  return vals.length ? quint(vals) : [];
}

const fill = (theme: string, breaks: number[]) => {
  const c = POP_COLORS[theme === "light" ? "light" : "dark"];
  const step: unknown[] = ["step", ["get", "v"], c[0]];
  breaks.forEach((b, i) => step.push(b, c[i + 1]));
  return ["case", ["get", "rated"], step, theme === "light" ? "#c9d2da" : "#26323d"];
};

export function usePopulationLayer({ map, ready, layers, theme, pop, metric }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; theme: string; pop: PopulationZonesFile; metric: PopMetric }) {
  const on = layers.includes("population");
  const fc = useRef<Fc | null>(null);
  const [areas, setAreas] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!on || !pop.available) {
      for (const id of ["d-pop-fill", "d-pop-line"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    let alive = true;
    (async () => {
      try {
        if (!fc.current) {
          const r = await fetch(`${DETAIL_BASE}/admin2.json`);
          if (!r.ok) throw new Error(`admin2.json HTTP ${r.status}`);
          fc.current = (await r.json()) as Fc;
          setAreas(new Map(fc.current.features.map((f) => [String(f.properties.id), Number(f.properties.a) || 0])));
        }
        if (!alive || !fc.current) return;
        const byId = new Map(pop.zones.map((z) => [z.id, z]));
        const ar = new Map(fc.current.features.map((f) => [String(f.properties.id), Number(f.properties.a) || 0]));
        for (const f of fc.current.features) {
          const id = String(f.properties.id);
          const z = byId.get(id);
          const v = z ? zoneMetric(z, metric, ar.get(id) ?? 0) : null;
          Object.assign(f.properties, v != null ? { rated: true, v } : { rated: false, v: 0 });
        }
        const breaks = popBreaks(pop, metric, ar);
        if (!m.getSource("d-pop")) m.addSource("d-pop", { type: "geojson", data: fc.current as never });
        else (m.getSource("d-pop") as GeoJSONSource).setData(fc.current as never);
        let before: string | undefined = LAYER_ORDER.find((id) => m.getLayer(id));
        if (!before && m.getLayer("infra-halo")) before = "infra-halo";
        if (!m.getLayer("d-pop-fill")) m.addLayer({ id: "d-pop-fill", type: "fill", source: "d-pop", paint: { "fill-color": fill(theme, breaks) as never, "fill-opacity": 0.78 } }, before);
        else m.setPaintProperty("d-pop-fill", "fill-color", fill(theme, breaks) as never);
        if (!m.getLayer("d-pop-line")) m.addLayer({ id: "d-pop-line", type: "line", source: "d-pop", paint: { "line-color": theme === "light" ? "#ffffff" : "#0b1117", "line-width": 0.6, "line-opacity": 0.8 } }, before);
        for (const id of ["d-pop-fill", "d-pop-line"]) m.setLayoutProperty(id, "visibility", "visible");
      } catch (e) {
        console.warn("population layer failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [map, ready, on, pop, metric, theme]);

  return { areas };
}
