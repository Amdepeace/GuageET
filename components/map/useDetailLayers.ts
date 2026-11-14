"use client";
// Loads and draws the detailed OpenStreetMap layers on demand: a layer's data
// file is fetched the first time it is switched on, so the page itself stays
// light. Names (towns, rivers, roads, streets, facilities) are native map text
// using self-hosted Noto Sans glyphs, so they follow the line they label,
// collide properly, and render Amharic. City street networks load as you zoom
// into a city.
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import cityExtents from "@/config/city-extents.json";
import { ALL_FAC_CATS, type FacCat, type Lang, type Layer } from "@/lib/urlState";
import { DETAIL_BASE, FAC_META, FONT, LABEL_LAYERS, LAYER_ORDER, LAYER_TOGGLE, drawIcon, facColor, nameField } from "./detail";

type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: Feature[] };

export const CITIES = (cityExtents as unknown as { cities: { id: string; name: string; am: string; bbox: [number, number, number, number] }[] }).cities;

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colors = () => ({
  river: cssVar("--river") || "#4f8fc0",
  road: cssVar("--road") || "#93a5b8",
  rail: cssVar("--rail") || "#b7c4d1",
  ink: cssVar("--ink") || "#dbe6ef",
  ink2: cssVar("--ink-2") || "#9fb0bf",
  ink3: cssVar("--ink-3") || "#6c7f90",
  panel: cssVar("--panel") || "#0f171f",
  bg: cssVar("--bg") || "#0b1117",
});

const MAJOR_TYPES = ["hospital", "university", "college", "aerodrome", "bus_station", "station", "ferry_terminal"];

type Args = {
  map: React.MutableRefObject<MlMap | null>;
  ready: boolean;
  layers: Layer[];
  facCats: FacCat[];
  theme: string;
  lang: Lang;
  /** [lon, lat] of places the weather markers already label; their own labels are hidden while weather is on */
  avoid: [number, number][];
};

export function useDetailLayers({ map, ready, layers, facCats, theme, lang, avoid }: Args) {
  const [loading, setLoading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const data = useRef<Record<string, FC>>({});
  const inflight = useRef<Map<string, Promise<void>>>(new Map());
  const avoidIds = useRef<string[]>([]);
  const cityLoaded = useRef<Set<string>>(new Set());
  const streets = useRef<Feature[]>([]);

  const live = useRef({ layers, facCats, theme, lang, avoid });
  live.current = { layers, facCats, theme, lang, avoid };

  const busy = useCallback((key: string, on: boolean) => setLoading((l) => (on ? (l.includes(key) ? l : [...l, key]) : l.filter((x) => x !== key))), []);
  const fail = useCallback((key: string, on: boolean) => setErrors((l) => (on ? (l.includes(key) ? l : [...l, key]) : l.filter((x) => x !== key))), []);

  // ---- layer construction ----------------------------------------------------
  const add = useCallback((m: MlMap, spec: Record<string, unknown>) => {
    const id = spec.id as string;
    if (m.getLayer(id)) return;
    let before: string | undefined;
    for (let i = LAYER_ORDER.indexOf(id) + 1; i < LAYER_ORDER.length; i++) {
      if (m.getLayer(LAYER_ORDER[i])) {
        before = LAYER_ORDER[i];
        break;
      }
    }
    if (!before && m.getLayer("infra-halo")) before = "infra-halo";
    m.addLayer(spec as never, before);
  }, []);

  const registerIcons = useCallback((m: MlMap) => {
    const th = live.current.theme;
    const outline = th === "light" ? "#ffffff" : "#0b1117";
    for (const cat of ALL_FAC_CATS) {
      const name = `fac-${cat}`;
      if (m.hasImage(name)) m.removeImage(name);
      m.addImage(name, drawIcon(FAC_META[cat].shape, facColor(cat, th), outline, 32), { pixelRatio: 2 });
    }
  }, []);

  /** hide labels of places the weather markers already name (nearest city or town to each weather point) */
  const placeFilter = useCallback((base: unknown[]) => {
    const hide = live.current.layers.includes("weather") && avoidIds.current.length > 0;
    return hide ? ["all", base, ["!", ["in", ["get", "i"], ["literal", avoidIds.current]]]] : base;
  }, []);

  const addLayers = useCallback(
    (m: MlMap, id: string) => {
      const c = colors();
      const lang0 = live.current.lang;
      const zoomW = (stops: [number, number][]) => ["interpolate", ["linear"], ["zoom"], ...stops.flat()];
      const text = (font: string[], size: unknown, color: string, extra: Record<string, unknown> = {}) => ({
        layout: { "text-field": nameField(lang0), "text-font": font, "text-size": size, ...extra },
        paint: { "text-color": color, "text-halo-color": c.bg, "text-halo-width": 1.3 },
      });
      const hasName = ["any", ["has", "n"], ["has", "a"]];

      if (id === "d-water") {
        const fill = (lid: string, filter: unknown, minzoom: number) => add(m, { id: lid, type: "fill", source: id, minzoom, filter, paint: { "fill-color": c.river, "fill-opacity": 0.4 } });
        fill("d-water-big", [">=", ["get", "s"], 20], 2.5);
        fill("d-water-mid", ["all", [">=", ["get", "s"], 2], ["<", ["get", "s"], 20]], 6);
        fill("d-water-small", ["<", ["get", "s"], 2], 8.5);
        add(m, { id: "d-water-line", type: "line", source: id, minzoom: 6, paint: { "line-color": c.river, "line-width": 0.6, "line-opacity": 0.7 } });
      } else if (id === "d-rivers") {
        const w = (named: number, other: number) => ["case", ["has", "n"], named, other];
        add(m, {
          id: "d-rivers",
          type: "line",
          source: id,
          minzoom: 3,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": c.river, "line-opacity": 0.85, "line-width": ["interpolate", ["linear"], ["zoom"], 3, w(0.6, 0.3), 7, w(1.2, 0.6), 11, w(2.4, 1.2), 15, w(5, 2.6)] },
        });
        add(m, {
          id: "d-river-names",
          type: "symbol",
          source: id,
          minzoom: 6,
          filter: hasName,
          ...text(FONT.italic, zoomW([[6, 10], [12, 12]]), c.river, { "symbol-placement": "line", "text-letter-spacing": 0.12, "symbol-spacing": 320 }),
        });
      } else if (id === "d-streams") {
        add(m, { id: "d-streams", type: "line", source: id, minzoom: 7, paint: { "line-color": c.river, "line-opacity": 0.6, "line-width": zoomW([[7, 0.3], [10, 0.6], [14, 1.4]]) } });
      } else if (id === "d-roads-tertiary") {
        add(m, { id: "d-roads-tertiary", type: "line", source: id, minzoom: 8, paint: { "line-color": c.road, "line-opacity": 0.45, "line-width": zoomW([[8, 0.3], [12, 1], [16, 3]]) } });
        add(m, { id: "d-road-names-tertiary", type: "symbol", source: id, minzoom: 12, filter: hasName, ...text(FONT.regular, 10, c.ink3, { "symbol-placement": "line", "symbol-spacing": 280 }) });
      } else if (id === "d-roads-major") {
        const m3 = (a: number, b: number, d: number) => ["match", ["get", "h"], "motorway", a, "trunk", b, d];
        add(m, { id: "d-roads-secondary", type: "line", source: id, minzoom: 6.5, filter: ["==", ["get", "h"], "secondary"], paint: { "line-color": c.road, "line-opacity": 0.7, "line-width": zoomW([[6.5, 0.4], [10, 1], [14, 3], [16, 5]]) } });
        add(m, {
          id: "d-roads-major",
          type: "line",
          source: id,
          minzoom: 3.5,
          filter: ["in", ["get", "h"], ["literal", ["motorway", "trunk", "primary"]]],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": c.road,
            "line-opacity": ["match", ["get", "h"], "primary", 0.85, 1],
            "line-width": ["interpolate", ["linear"], ["zoom"], 3.5, m3(1.6, 1.4, 1), 8, m3(2.6, 2.2, 1.6), 12, m3(4.2, 3.6, 2.6), 16, m3(9, 8, 6)],
          },
        });
        add(m, { id: "d-road-names-major", type: "symbol", source: id, minzoom: 8.5, filter: hasName, ...text(FONT.regular, zoomW([[8.5, 10], [14, 12]]), c.ink2, { "symbol-placement": "line", "symbol-spacing": 300 }) });
      } else if (id === "d-rail") {
        add(m, { id: "d-rail", type: "line", source: id, minzoom: 3.5, filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]], paint: { "line-color": c.rail, "line-opacity": 0.9, "line-dasharray": [3, 1.6], "line-width": zoomW([[4, 0.8], [10, 1.8], [15, 3.5]]) } });
        add(m, { id: "d-stations", type: "circle", source: id, minzoom: 7.5, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": zoomW([[7.5, 2.5], [13, 5]]), "circle-color": c.panel, "circle-stroke-color": c.rail, "circle-stroke-width": 1.5 } });
      } else if (id === "d-airports") {
        add(m, { id: "d-runways", type: "line", source: id, minzoom: 8, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": c.rail, "line-width": zoomW([[8, 1.2], [12, 3.5], [16, 10]]) } });
      } else if (id === "d-places") {
        const r = (city: number, town: number, vill: number) => ["match", ["get", "t"], "city", city, "town", town, vill];
        // towns stay invisible until ~zoom 6.5 so the dots never drown the infrastructure
        const radius = ["interpolate", ["linear"], ["zoom"], 4.5, r(2.6, 0, 0), 6.4, r(3, 0, 0), 6.6, r(3, 1.7, 0), 12, r(4.6, 3, 0)];
        const base = { "circle-color": c.ink2, "circle-opacity": 0.85, "circle-stroke-color": c.panel, "circle-stroke-width": 1 };
        add(m, { id: "d-places", type: "circle", source: id, minzoom: 4.5, filter: ["in", ["get", "t"], ["literal", ["city", "town"]]], paint: { ...base, "circle-radius": radius } });
        add(m, { id: "d-places-village", type: "circle", source: id, minzoom: 9.5, filter: ["==", ["get", "t"], "village"], paint: { ...base, "circle-radius": zoomW([[9.5, 1.4], [14, 2.6]]) } });
        // names: higher population is placed first, so the biggest places win collisions
        const sortKey = ["*", -1, ["coalesce", ["get", "pop"], 0]];
        const lab = (lid: string, t: string, minzoom: number, font: string[], size: unknown, color: string) =>
          add(m, {
            id: lid,
            type: "symbol",
            source: id,
            minzoom,
            filter: placeFilter(["==", ["get", "t"], t]),
            ...text(font, size, color, { "text-anchor": "top", "text-offset": [0, 0.55], "symbol-sort-key": sortKey, "text-padding": 3, "text-max-width": 8 }),
          });
        lab("d-place-city", "city", 5, FONT.medium, zoomW([[5, 11], [9, 14], [13, 17]]), c.ink);
        lab("d-place-town", "town", 7.5, FONT.regular, zoomW([[7.5, 10.5], [12, 13]]), c.ink2);
        lab("d-place-village", "village", 11, FONT.regular, zoomW([[11, 10], [14, 12]]), c.ink3);
      } else if (id === "d-facilities") {
        registerIcons(m);
        const catFilter = ["in", ["get", "k"], ["literal", live.current.facCats]];
        const major = ["in", ["get", "t"], ["literal", MAJOR_TYPES]];
        const layout = (z0: number, s0: number) => ({ "icon-image": ["concat", "fac-", ["get", "k"]], "icon-size": zoomW([[z0, s0], [12, 0.85], [15, 1]]), "icon-allow-overlap": false, "icon-padding": 2 });
        add(m, { id: "d-fac-minor", type: "symbol", source: id, minzoom: 9.5, filter: ["all", catFilter, ["!", major]], layout: layout(9.5, 0.5) });
        add(m, { id: "d-fac-major", type: "symbol", source: id, minzoom: 6.5, filter: ["all", catFilter, major], layout: layout(6.5, 0.55) });
        add(m, { id: "d-fac-names", type: "symbol", source: id, minzoom: 14, filter: ["all", catFilter, hasName], ...text(FONT.regular, 10.5, c.ink2, { "text-anchor": "top", "text-offset": [0, 0.9], "text-optional": true, "text-padding": 2, "text-max-width": 9 }) });
      } else if (id === "d-streets") {
        add(m, { id: "d-streets", type: "line", source: id, minzoom: 10, paint: { "line-color": c.road, "line-opacity": 0.55, "line-width": zoomW([[10, 0.3], [13, 0.8], [16, 2.6]]) } });
        add(m, { id: "d-street-names", type: "symbol", source: id, minzoom: 14, filter: hasName, ...text(FONT.regular, 10.5, c.ink3, { "symbol-placement": "line", "symbol-spacing": 260 }) });
      }
    },
    [add, registerIcons, placeFilter],
  );

  const applyVisibility = useCallback(() => {
    const m = map.current;
    if (!m) return;
    for (const [id, toggle] of Object.entries(LAYER_TOGGLE)) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", live.current.layers.includes(toggle) ? "visible" : "none");
    }
  }, [map]);

  const applyTheme = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const c = colors();
    const set = (id: string, prop: string, v: string) => m.getLayer(id) && m.setPaintProperty(id, prop, v);
    for (const id of ["d-water-big", "d-water-mid", "d-water-small"]) set(id, "fill-color", c.river);
    for (const id of ["d-water-line", "d-rivers", "d-streams"]) set(id, "line-color", c.river);
    for (const id of ["d-roads-tertiary", "d-roads-secondary", "d-roads-major", "d-streets"]) set(id, "line-color", c.road);
    for (const id of ["d-rail", "d-runways"]) set(id, "line-color", c.rail);
    set("d-stations", "circle-color", c.panel);
    set("d-stations", "circle-stroke-color", c.rail);
    for (const id of ["d-places", "d-places-village"]) {
      set(id, "circle-color", c.ink2);
      set(id, "circle-stroke-color", c.panel);
    }
    const textColor: Record<string, string> = {
      "d-river-names": c.river,
      "d-road-names-tertiary": c.ink3,
      "d-road-names-major": c.ink2,
      "d-street-names": c.ink3,
      "d-place-city": c.ink,
      "d-place-town": c.ink2,
      "d-place-village": c.ink3,
      "d-fac-names": c.ink2,
    };
    for (const id of LABEL_LAYERS) {
      set(id, "text-color", textColor[id]);
      set(id, "text-halo-color", c.bg);
    }
    if (m.getLayer("d-fac-major")) registerIcons(m);
  }, [map, registerIcons]);

  // ---- data loading ---------------------------------------------------------------
  const fetchData = useCallback((id: string, file: string): Promise<FC> => {
    if (data.current[id]) return Promise.resolve(data.current[id]);
    return fetch(`${DETAIL_BASE}/${file}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${file}`);
      return r.json().then((fc: FC) => {
        data.current[id] = fc;
        return fc;
      });
    });
  }, []);

  const applyPlaceFilters = useCallback(() => {
    const m = map.current;
    if (!m) return;
    for (const [id, t] of [["d-place-city", "city"], ["d-place-town", "town"], ["d-place-village", "village"]] as const) {
      if (m.getLayer(id)) m.setFilter(id, placeFilter(["==", ["get", "t"], t]) as never);
    }
  }, [map, placeFilter]);

  /** find the place feature nearest to each weather point (within ~13 km) so its label can be hidden */
  const computeAvoid = useCallback((fc: FC) => {
    const ids: string[] = [];
    for (const [ax, ay] of live.current.avoid) {
      let best: { d: number; id: string } | null = null;
      for (const f of fc.features) {
        const t = f.properties.t;
        if (t !== "city" && t !== "town") continue;
        const [x, y] = f.geometry.coordinates as [number, number];
        const d = (x - ax) ** 2 + (y - ay) ** 2;
        if (d < 0.012 && (!best || d < best.d)) best = { d, id: f.properties.i as string };
      }
      if (best) ids.push(best.id);
    }
    avoidIds.current = ids;
  }, []);

  const refreshStreets = useCallback(() => {
    const m = map.current;
    if (!m || !live.current.layers.includes("streets") || m.getZoom() < 10) return;
    const b = m.getBounds();
    for (const c of CITIES) {
      if (cityLoaded.current.has(c.id)) continue;
      if (b.getWest() > c.bbox[2] || b.getEast() < c.bbox[0] || b.getSouth() > c.bbox[3] || b.getNorth() < c.bbox[1]) continue;
      cityLoaded.current.add(c.id);
      busy(`streets:${c.id}`, true);
      fetch(`${DETAIL_BASE}/cities/${c.id}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<FC>;
        })
        .then((fc) => {
          streets.current = streets.current.concat(fc.features);
          if (!m.getSource("d-streets")) {
            m.addSource("d-streets", { type: "geojson", data: { type: "FeatureCollection", features: streets.current } as never });
            addLayers(m, "d-streets");
            applyVisibility();
          } else (m.getSource("d-streets") as GeoJSONSource).setData({ type: "FeatureCollection", features: streets.current } as never);
          fail(`streets:${c.id}`, false);
        })
        .catch(() => {
          cityLoaded.current.delete(c.id); // retry on the next move
          fail(`streets:${c.id}`, true);
        })
        .finally(() => busy(`streets:${c.id}`, false));
    }
  }, [map, addLayers, applyVisibility, busy, fail]);

  const ensure = useCallback(
    (id: string, file: string, after?: (fc: FC) => void): Promise<void> => {
      const m = map.current;
      if (!m) return Promise.resolve();
      const existing = inflight.current.get(id);
      if (existing) return existing;
      if (m.getSource(id)) return Promise.resolve();
      busy(id, true);
      const p = fetchData(id, file)
        .then((fc) => {
          after?.(fc);
          if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: fc as never });
          addLayers(m, id);
          applyVisibility();
          fail(id, false);
        })
        .catch((e) => {
          console.warn(`detail layer ${id} failed`, e);
          fail(id, true);
        })
        .finally(() => {
          inflight.current.delete(id);
          busy(id, false);
        });
      inflight.current.set(id, p);
      return p;
    },
    [map, fetchData, addLayers, applyVisibility, busy, fail],
  );

  // ---- effects --------------------------------------------------------------------
  // load what is switched on, then show/hide
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const on = (l: Layer) => layers.includes(l);
    if (on("rivers")) {
      void ensure("d-water", "water.json");
      void ensure("d-rivers", "rivers.json");
    }
    if (on("streams")) void ensure("d-streams", "streams.json");
    if (on("roads")) void ensure("d-roads-major", "roads-major.json");
    if (on("tertiary")) void ensure("d-roads-tertiary", "roads-tertiary.json");
    if (on("rail")) {
      void ensure("d-rail", "rail.json");
      void ensure("d-airports", "airports.json");
    }
    if (on("places")) void ensure("d-places", "places.json", computeAvoid);
    if (on("facilities")) void ensure("d-facilities", "facilities.json");
    applyVisibility();
    applyPlaceFilters();
    refreshStreets();
  }, [layers, ready, map, ensure, applyVisibility, applyPlaceFilters, refreshStreets, computeAvoid]);

  // city streets follow the view
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.on("moveend", refreshStreets);
    return () => {
      m.off("moveend", refreshStreets);
    };
  }, [map, ready, refreshStreets]);

  // facility categories
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const catFilter = ["in", ["get", "k"], ["literal", facCats]];
    const major = ["in", ["get", "t"], ["literal", MAJOR_TYPES]];
    if (m.getLayer("d-fac-major")) m.setFilter("d-fac-major", ["all", catFilter, major] as never);
    if (m.getLayer("d-fac-minor")) m.setFilter("d-fac-minor", ["all", catFilter, ["!", major]] as never);
    if (m.getLayer("d-fac-names")) m.setFilter("d-fac-names", ["all", catFilter, ["any", ["has", "n"], ["has", "a"]]] as never);
  }, [facCats, ready, map]);

  // label language
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const id of LABEL_LAYERS) if (m.getLayer(id)) m.setLayoutProperty(id, "text-field", nameField(lang) as never);
  }, [lang, ready, map, layers]);

  useEffect(() => {
    if (ready) applyTheme();
  }, [theme, ready, applyTheme]);

  return { loading, errors };
}
