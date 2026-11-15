"use client";
// deck.gl layers on top of the MapLibre map (MIT, https://github.com/visgl/deck.gl):
//  - corridor arcs from Addis Ababa to the sea ports (curated, sourced statuses)
//  - trade-partner arcs from UN Comtrade (width = trade value; only when the key is set)
//  - a hexagon density map of mapped facilities (respects the facility category chips),
//    coloured by rank so rural districts stay visible next to Addis Ababa
// deck.gl is loaded with dynamic imports the first time one of these layers is
// switched on, so it adds nothing to the initial page.
import { useCallback, useEffect, useRef, useState } from "react";
import type { IControl, Map as MlMap } from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import world from "@/data/geo/world.geojson";
import type { Corridor, CorridorsFile, TradeFile } from "@/lib/schema";
import type { FacCat, Layer } from "@/lib/urlState";
import { DETAIL_BASE } from "./detail";
import { compact } from "@/lib/format";

type Pt = [number, number];
type Rgba = [number, number, number, number];
type PartnerArc = { id: string; iso3: string; partner: string; from: Pt; to: Pt; value: number; kind: "export" | "import" };
export type DeckPick = { kind: "corridor"; id: string; text: string } | { kind: "partner"; id: string; iso3: string; name: string; text: string };

type Geometry = { type: string; coordinates: unknown };

// ---- geometry helpers: country centroids from the bundled world layer -----------
function ringCentroid(ring: Pt[]): { area: number; c: Pt } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return { area: 0, c: ring[0] };
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] };
}

/** centroid of the largest polygon, so e.g. Russia or the USA point at their mainland */
function centroidOf(g: Geometry): Pt | null {
  const polys = g.type === "Polygon" ? [g.coordinates as Pt[][]] : g.type === "MultiPolygon" ? (g.coordinates as Pt[][][]) : [];
  let best: { area: number; c: Pt } | null = null;
  for (const p of polys) {
    const r = ringCentroid(p[0]);
    if (!best || r.area > best.area) best = r;
  }
  return best ? best.c : null;
}

let centroidsByUn: Map<string, { c: Pt; name: string; iso3: string }> | null = null;
function centroids() {
  if (centroidsByUn) return centroidsByUn;
  centroidsByUn = new Map();
  for (const f of (world as unknown as { features: { properties: { un?: string | number | null; name: string; iso3: string }; geometry: Geometry }[] }).features) {
    const c = centroidOf(f.geometry);
    if (c && f.properties.un != null) centroidsByUn.set(String(f.properties.un), { c, name: f.properties.name, iso3: f.properties.iso3 });
  }
  return centroidsByUn;
}

const THEMES = {
  dark: {
    corridor: [205, 216, 226] as [number, number, number],
    exports: [14, 165, 198] as [number, number, number],
    imports: [154, 124, 240] as [number, number, number],
    heat: [[15, 91, 115, 150], [20, 125, 155, 175], [24, 152, 184, 195], [34, 195, 230, 215], [120, 225, 245, 235], [205, 247, 255, 245]] as Rgba[],
  },
  light: {
    corridor: [68, 86, 106] as [number, number, number],
    exports: [5, 135, 173] as [number, number, number],
    imports: [124, 58, 237] as [number, number, number],
    heat: [[170, 215, 232, 150], [120, 190, 214, 170], [70, 160, 196, 190], [30, 130, 172, 210], [10, 100, 140, 230], [6, 62, 96, 245]] as Rgba[],
  },
};

type Args = {
  map: React.MutableRefObject<MlMap | null>;
  ready: boolean;
  layers: Layer[];
  fac: FacCat[];
  theme: string;
  corridors: CorridorsFile;
  trade: TradeFile;
};

export function useDeckOverlay({ map, ready, layers, fac, theme, corridors, trade }: Args) {
  const overlay = useRef<MapboxOverlay | null>(null);
  const facilities = useRef<{ p: Pt; k: string }[] | null>(null);
  const run = useRef(0);
  const [zoomStep, setZoomStep] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: string | null; partnerArcs: number; facilities: number }>({ loading: false, error: null, partnerArcs: 0, facilities: 0 });

  const flows = layers.includes("flows");
  const density = layers.includes("density");

  // hex size and the partner-arc fade follow the zoom level, so rebuild when it changes by half a level
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !(density || flows)) return;
    const onZoom = () => setZoomStep(Math.round(m.getZoom() * 2) / 2);
    onZoom();
    m.on("zoomend", onZoom);
    return () => {
      m.off("zoomend", onZoom);
    };
  }, [map, ready, density, flows]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const id = ++run.current;

    if (!flows && !density) {
      overlay.current?.setProps({ layers: [] });
      return;
    }

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [{ MapboxOverlay }, { ArcLayer }, { HexagonLayer }] = await Promise.all([import("@deck.gl/mapbox"), import("@deck.gl/layers"), import("@deck.gl/aggregation-layers")]);
        if (id !== run.current) return;

        if (!overlay.current) {
          overlay.current = new MapboxOverlay({ interleaved: false, layers: [] });
          m.addControl(overlay.current as unknown as IControl);
        }

        if (density && !facilities.current) {
          const r = await fetch(`${DETAIL_BASE}/facilities.json`);
          if (!r.ok) throw new Error(`facilities.json HTTP ${r.status}`);
          const fc = (await r.json()) as { features: { properties: { k: string }; geometry: { coordinates: Pt } }[] };
          facilities.current = fc.features.map((f) => ({ p: f.geometry.coordinates, k: f.properties.k }));
          if (id !== run.current) return;
        }

        const th = THEMES[theme === "light" ? "light" : "dark"];
        const out: unknown[] = [];

        if (density && facilities.current) {
          const pts = facilities.current.filter((f) => fac.includes(f.k as FacCat));
          // ~12 km hexes at zoom 6, halving with each zoom level
          const radius = Math.min(30000, Math.max(250, 12000 * 2 ** (6 - zoomStep)));
          out.push(
            new HexagonLayer<{ p: Pt }>({
              id: "fac-density",
              data: pts,
              getPosition: (d) => d.p,
              radius,
              coverage: 0.92,
              extruded: false,
              colorRange: th.heat,
              colorScaleType: "quantile",
              pickable: false,
            }),
          );
        }

        let partnerCount = 0;
        if (flows) {
          const origin = corridors.origin.coordinates as Pt;
          const alpha = (c: Corridor) => (c.status === "operational" ? 235 : c.verified ? 160 : 110);
          out.push(
            new ArcLayer<Corridor>({
              id: "corridors",
              data: corridors.corridors,
              pickable: true,
              greatCircle: false,
              getSourcePosition: () => origin,
              getTargetPosition: (c) => c.coordinates,
              getSourceColor: (c) => [...th.corridor, alpha(c)] as Rgba,
              getTargetColor: (c) => [...th.corridor, alpha(c)] as Rgba,
              getWidth: (c) => (c.status === "operational" ? 4 : 2.5),
              getHeight: 0.3,
              getTilt: 90,
              widthMinPixels: 2,
            }),
          );

          if (trade.available && Object.keys(trade.bilateral).length) {
            const cents = centroids();
            const arcs: PartnerArc[] = [];
            const top = Object.entries(trade.bilateral)
              .sort((a, b) => b[1].exports + b[1].imports - (a[1].exports + a[1].imports))
              .slice(0, 15);
            for (const [un, b] of top) {
              const c = cents.get(un);
              if (!c) continue;
              if (b.exports > 0) arcs.push({ id: un, iso3: c.iso3, partner: c.name, from: origin, to: c.c, value: b.exports, kind: "export" });
              if (b.imports > 0) arcs.push({ id: un, iso3: c.iso3, partner: c.name, from: c.c, to: origin, value: b.imports, kind: "import" });
            }
            partnerCount = arcs.length;
            const max = Math.max(...arcs.map((a) => a.value), 1);
            out.push(
              new ArcLayer<PartnerArc>({
                id: "partners",
                data: arcs,
                pickable: true,
                greatCircle: true,
                getSourcePosition: (a) => a.from,
                getTargetPosition: (a) => a.to,
                getSourceColor: (a) => [...(a.kind === "export" ? th.exports : th.imports), 200] as Rgba,
                getTargetColor: (a) => [...(a.kind === "export" ? th.exports : th.imports), 200] as Rgba,
                // partner flows belong to a world-scale view: fade them out as you zoom in
                opacity: Math.min(1, Math.max(0.1, (6.2 - zoomStep) / 2.2)),
                getWidth: (a) => Math.max(1.5, Math.sqrt(a.value / max) * 7),
                getHeight: 0.35,
                getTilt: 90,
                widthMinPixels: 1.5,
              }),
            );
          }
        }

        overlay.current.setProps({ layers: out as never });
        setState({ loading: false, error: null, partnerArcs: partnerCount, facilities: facilities.current?.length ?? 0 });
      } catch (e) {
        if (id === run.current) setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    })();
  }, [map, ready, flows, density, fac, theme, corridors, trade, zoomStep]);

  // remove the overlay if the map goes away
  useEffect(() => {
    const m = map.current;
    return () => {
      if (m && overlay.current) {
        try {
          m.removeControl(overlay.current as unknown as IControl);
        } catch {
          /* map already removed */
        }
        overlay.current = null;
      }
    };
  }, [map]);

  /** what is under the pointer, for hover tooltips and clicks */
  const pick = useCallback((x: number, y: number): DeckPick | null => {
    const o = overlay.current;
    if (!o) return null;
    const info = o.pickObject({ x, y, radius: 6 });
    if (!info || !info.object) return null;
    if (info.layer?.id === "corridors") {
      const c = info.object as Corridor;
      return { kind: "corridor", id: c.id, text: `${c.name} · ${c.status.replace(/_/g, " ")}${c.verified ? "" : " · unverified"}` };
    }
    if (info.layer?.id === "partners") {
      const a = info.object as PartnerArc;
      return { kind: "partner", id: a.id, iso3: a.iso3, name: a.partner, text: `${a.partner}: Ethiopia ${a.kind === "export" ? "exports" : "imports"} $${compact(a.value)}` };
    }
    return null;
  }, []);

  return { pick, ...state };
}
