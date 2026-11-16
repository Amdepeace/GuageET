"use client";
// NASA EONET natural events (open API, no key) fetched live in the browser for
// the Horn of Africa and the Red Sea region. EONET keeps events marked "open"
// long after they stop, so only events whose latest observation is within the
// last 30 days are shown. Coverage of Africa is sparse; an empty map means
// none was reported, not that nothing happened.
import { useEffect, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { Layer } from "@/lib/urlState";
import { FONT } from "./detail";

export type EonetEvent = { id: string; title: string; category: string; categoryId: string; date: string; lon: number; lat: number; magnitude: string; link: string; sources: { id: string; url: string }[] };
export const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&bbox=30,20,52,-5&limit=200";
const COLORS: Record<string, string> = { wildfires: "#f08a4b", volcanoes: "#d4546a", floods: "#0ea5c6", severeStorms: "#7b6cf0", drought: "#b8863f", dustHaze: "#c9a56a", landslides: "#9c7040", seaLakeIce: "#9fb0bf" };
export const eonetColor = (id: string) => COLORS[id] ?? "#9fb0bf";

type Raw = { id: string; title: string; link: string; categories: { id: string; title: string }[]; sources?: { id: string; url: string }[]; geometry: { date: string; type: string; coordinates: number[] | number[][]; magnitudeValue?: number | null; magnitudeUnit?: string | null }[] };

export function useEonetLayer({ map, ready, layers }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[] }) {
  const on = layers.includes("events");
  const [state, setState] = useState<{ loading: boolean; error: string | null; events: EonetEvent[]; fetchedAt: string | null }>({ loading: false, error: null, events: [], fetchedAt: null });

  useEffect(() => {
    if (!on) return;
    let alive = true;
    const load = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const r = await fetch(EONET_URL);
        if (!r.ok) throw new Error(`EONET HTTP ${r.status}`);
        const d = (await r.json()) as { events: Raw[] };
        const cutoff = Date.now() - 30 * 86400_000;
        const events: EonetEvent[] = [];
        for (const e of d.events ?? []) {
          const g = e.geometry.at(-1);
          if (!g || g.type !== "Point" || Date.parse(g.date) < cutoff) continue;
          const [lon, lat] = g.coordinates as number[];
          events.push({ id: e.id, title: e.title, category: e.categories[0]?.title ?? "Event", categoryId: e.categories[0]?.id ?? "", date: g.date, lon, lat, magnitude: g.magnitudeValue != null ? `${g.magnitudeValue} ${g.magnitudeUnit ?? ""}`.trim() : "", link: e.link, sources: e.sources ?? [] });
        }
        if (alive) setState({ loading: false, error: null, events, fetchedAt: new Date().toISOString() });
      } catch (err) {
        if (alive) setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      }
    };
    void load();
    const t = setInterval(load, 30 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [on]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!on) {
      for (const id of ["d-eonet-pt", "d-eonet-lbl"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const fc = { type: "FeatureCollection", features: state.events.map((e) => ({ type: "Feature", geometry: { type: "Point", coordinates: [e.lon, e.lat] }, properties: { id: e.id, n: e.title, cat: e.categoryId, col: eonetColor(e.categoryId) } })) };
    const src = m.getSource("d-eonet") as { setData: (d: never) => void } | undefined;
    if (src) src.setData(fc as never);
    else m.addSource("d-eonet", { type: "geojson", data: fc as never });
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--bg").trim() || "#0b1117";
    const ink = cs.getPropertyValue("--ink-2").trim() || "#9fb0bf";
    if (!m.getLayer("d-eonet-pt")) {
      m.addLayer({ id: "d-eonet-pt", type: "circle", source: "d-eonet", paint: { "circle-color": ["get", "col"] as never, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 8, 8, 12, 11] as never, "circle-stroke-color": bg, "circle-stroke-width": 1.5, "circle-opacity": 0.95 } });
      m.addLayer({ id: "d-eonet-lbl", type: "symbol", source: "d-eonet", minzoom: 6, layout: { "text-field": ["get", "n"], "text-font": FONT.regular, "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true }, paint: { "text-color": ink, "text-halo-color": bg, "text-halo-width": 1.3 } });
    }
    for (const id of ["d-eonet-pt", "d-eonet-lbl"]) m.setLayoutProperty(id, "visibility", "visible");
  }, [map, ready, on, state.events]);

  return state;
}
