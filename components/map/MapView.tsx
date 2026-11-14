"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type Map as MlMap } from "maplibre-gl";
import countries from "@/data/geo/countries.geojson";
import lakes from "@/data/geo/lakes.geojson";
import disputed from "@/data/geo/disputed.geojson";
import world from "@/data/geo/world.geojson";
import type { City, InfraFeature } from "@/lib/data";
import type { CityWeather } from "@/lib/openMeteo";
import { ALL_LAYERS, type FacCat, type Lang, type Layer } from "@/lib/urlState";
import type { Quake } from "@/lib/usgs";
import { GLYPHS_URL, HIT_LAYERS, LAYER_KIND, pretty, type DetailFeature } from "./detail";
import { LayerPanel } from "./LayerPanel";
import { CITIES, useDetailLayers } from "./useDetailLayers";

const HOME: LngLatBoundsLike = [
  [32.5, -6],
  [46.5, 15.2],
];

const COUNTRY_LABELS: [string, number, number, boolean][] = [
  ["ETHIOPIA", 41.2, 6.9, true],
  ["KENYA", 37.9, 0.6, false],
  ["SUDAN", 32.6, 13.6, false],
  ["S. SUDAN", 30.6, 7.3, false],
  ["SOMALIA", 45.6, 4.0, false],
  ["ERITREA", 38.3, 15.3, false],
  ["DJIBOUTI", 42.6, 11.8, false],
  ["TANZANIA", 34.6, -5.4, false],
  ["UGANDA", 32.4, 1.6, false],
  ["YEMEN", 45.4, 14.9, false],
];

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function graticule() {
  const f = [];
  for (let lon = 20; lon <= 60; lon += 5)
    f.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lon, -15], [lon, 35]] } });
  for (let lat = -15; lat <= 35; lat += 5)
    f.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[20, lat], [60, lat]] } });
  return { type: "FeatureCollection", features: f };
}

const LINES = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]];
const POWER = ["in", ["get", "type"], ["literal", ["power_line", "dam"]]];
const CAT_COLOR = (power: string, transport: string) => ["case", POWER, power, transport];

export function MapView({
  infra,
  cities,
  weather,
  quakes,
  layers,
  onLayers,
  selected,
  onSelect,
  onCity,
  onQuake,
  onCountry,
  onFeature,
  fac,
  onFac,
  lang,
  onLang,
  relationsSel,
  initialView,
  onViewChange,
  pulseKey,
  theme,
}: {
  infra: InfraFeature[];
  cities: City[];
  weather: CityWeather[] | null;
  quakes: Quake[];
  layers: Layer[];
  onLayers: (l: Layer[]) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCity: (id: string) => void;
  onQuake: (id: string) => void;
  onCountry: (c: { iso3: string; un: string | null; name: string }) => void;
  onFeature: (f: DetailFeature) => void;
  fac: FacCat[];
  onFac: (c: FacCat) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  relationsSel: string | null;
  initialView: { zoom: number | null; center: [number, number] | null };
  onViewChange: (zoom: number, center: [number, number]) => void;
  pulseKey: number;
  theme: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const cityMarkers = useRef<maplibregl.Marker[]>([]);
  const quakeMarkers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const cb = useRef({ onSelect, onViewChange, onCity, onQuake, onCountry, onFeature });
  cb.current = { onSelect, onViewChange, onCity, onQuake, onCountry, onFeature };
  const avoid = useMemo(() => cities.map((c) => [c.lon, c.lat] as [number, number]), [cities]);

  // init once
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, glyphs: GLYPHS_URL(), sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0a1e2c" } }] },
      bounds: initialView.center ? undefined : HOME,
      center: initialView.center ?? undefined,
      zoom: initialView.zoom ?? undefined,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 16,
      minZoom: 1.2,
      renderWorldCopies: true,
      cooperativeGestures: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          'Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · dashed = disputed · Roads, rivers, facilities: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      }),
      "bottom-right",
    );

    m.on("load", () => {
      m.addSource("grat", { type: "geojson", data: graticule() as never });
      m.addSource("world", { type: "geojson", data: world as never, promoteId: "iso3" });
      m.addSource("countries", { type: "geojson", data: countries as never });
      m.addSource("lakes", { type: "geojson", data: lakes as never });
      m.addSource("disputed", { type: "geojson", data: disputed as never });
      m.addSource("infra", { type: "geojson", data: { type: "FeatureCollection", features: infra } as never, promoteId: "id" });

      m.addLayer({ id: "grat", type: "line", source: "grat", paint: { "line-color": "#ffffff", "line-opacity": 0.05, "line-width": 1 } });
      // whole-world clickable base (sits under the detailed regional land)
      m.addLayer({ id: "world-fill", type: "fill", source: "world", paint: { "fill-color": "#101922", "fill-opacity": 1 } });
      m.addLayer({ id: "world-line", type: "line", source: "world", paint: { "line-color": "#223040", "line-width": 0.6 } });
      m.addLayer({ id: "land", type: "fill", source: "countries", paint: { "fill-color": "#121c25" } });
      m.addLayer({ id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": "#0a1e2c" } });
      m.addLayer({ id: "borders", type: "line", source: "countries", paint: { "line-color": "#2f4152", "line-width": 0.8 } });
      m.addLayer({ id: "eth-border", type: "line", source: "countries", filter: ["==", ["get", "iso3"], "ETH"], paint: { "line-color": "#6c7f90", "line-width": 1.4 } });
      m.addLayer({ id: "disputed", type: "line", source: "disputed", paint: { "line-color": "#9fb0bf", "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.7 } });
      // relations selection: drawn above the regional land so it shows in-region too
      m.addLayer({ id: "world-sel", type: "fill", source: "world", filter: ["==", ["get", "iso3"], ""] as never, paint: { "fill-color": "#22c3e6", "fill-opacity": 0.16 } });
      m.addLayer({ id: "world-sel-line", type: "line", source: "world", filter: ["==", ["get", "iso3"], ""] as never, paint: { "line-color": "#22c3e6", "line-width": 1.6 } });

      const isLine = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]];
      const isPt = ["==", ["geometry-type"], "Point"];
      const L = (layer: string) => ["==", ["get", "layer"], layer];
      // selection halo (under the lines)
      m.addLayer({ id: "infra-halo", type: "line", source: "infra", filter: ["all", isLine, ["==", ["get", "id"], ""]] as never, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.25 } });
      m.addLayer({ id: "infra-existing", type: "line", source: "infra", filter: ["all", isLine, L("existing")] as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": CAT_COLOR("#9a7cf0", "#0ea5c6") as never, "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, ["case", ["==", ["get", "schematic"], true], 0.28, 1], 14, ["case", ["==", ["get", "schematic"], true], 0.08, 1]], "line-width": 2.2 } });
      m.addLayer({ id: "infra-planned", type: "line", source: "infra", filter: ["all", isLine, L("planned")] as never, layout: { "line-join": "round" }, paint: { "line-color": CAT_COLOR("#9a7cf0", "#0ea5c6") as never, "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, ["case", ["==", ["get", "schematic"], true], 0.28, 1], 14, ["case", ["==", ["get", "schematic"], true], 0.08, 1]], "line-width": 2, "line-dasharray": [2.2, 1.6] } });
      m.addLayer({ id: "infra-pts-halo", type: "circle", source: "infra", filter: ["all", isPt, ["==", ["get", "id"], ""]] as never, paint: { "circle-radius": 13, "circle-color": "#ffffff", "circle-opacity": 0.2 } });
      m.addLayer({
        id: "infra-pts",
        type: "circle",
        source: "infra",
        filter: isPt as never,
        paint: {
          "circle-radius": 6,
          "circle-color": ["case", L("planned"), "#0b1117", CAT_COLOR("#9a7cf0", "#0ea5c6")] as never,
          "circle-stroke-color": CAT_COLOR("#9a7cf0", "#0ea5c6") as never,
          "circle-stroke-width": 2,
        },
      });
      // generous invisible hit targets
      m.addLayer({ id: "infra-hit-line", type: "line", source: "infra", filter: isLine as never, paint: { "line-width": 14, "line-opacity": 0 } });
      m.addLayer({ id: "infra-hit-pt", type: "circle", source: "infra", filter: isPt as never, paint: { "circle-radius": 14, "circle-opacity": 0 } });

      for (const [t, lon, lat, focus] of COUNTRY_LABELS) {
        const d = document.createElement("div");
        d.className = `map-label${focus ? " focus" : ""}`;
        d.textContent = t;
        new maplibregl.Marker({ element: d }).setLngLat([lon, lat]).addTo(m);
      }

      // one pointer handler: infrastructure first, then the detailed layers, then the country
      const tip = (kind: DetailFeature["kind"], p: Record<string, unknown>) => {
        const name = (p.n as string) || (p.a as string);
        const cls = pretty(p.h ?? p.t);
        switch (kind) {
          case "facility":
            return `${cls} · ${name ?? "unnamed"}`;
          case "road":
          case "street":
            return name ? `${name} · ${cls}` : `${cls} road`;
          case "river":
            return name ? `${name} (river)` : "River";
          case "stream":
            return name ? `${name} (stream)` : "Stream";
          default:
            return name ?? cls;
        }
      };
      const detailAt = (x: number, y: number, r: number) => {
        const present = HIT_LAYERS.filter((id) => m.getLayer(id));
        return present.length ? m.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: present })[0] : undefined;
      };
      m.on("mousemove", (e) => {
        const infraHit = m.queryRenderedFeatures(e.point, { layers: ["infra-hit-pt", "infra-hit-line"] })[0];
        const ip = infraHit?.properties as { callsign: string; name: string } | undefined;
        const f = infraHit ? undefined : detailAt(e.point.x, e.point.y, 5);
        if (ip) setHover({ x: e.point.x, y: e.point.y, text: `${ip.callsign} · ${ip.name}` });
        else if (f) setHover({ x: e.point.x, y: e.point.y, text: tip(LAYER_KIND[f.layer.id], f.properties as Record<string, unknown>) });
        else setHover(null);
        m.getCanvas().style.cursor = ip || f ? "pointer" : "";
        const c = m.queryRenderedFeatures(e.point, { layers: ["world-fill"] })[0]?.properties as { name?: string } | undefined;
        setHoverCountry(c?.name ?? null);
      });
      m.getCanvas().addEventListener("mouseleave", () => {
        setHover(null);
        setHoverCountry(null);
      });
      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["infra-hit-pt", "infra-hit-line"] });
        const id = (hits[0]?.properties as { id?: string } | undefined)?.id ?? null;
        if (id) {
          cb.current.onSelect(id);
          return;
        }
        const f = detailAt(e.point.x, e.point.y, 6);
        if (f) {
          const g = f.geometry as { type: string; coordinates: [number, number] };
          cb.current.onFeature({
            kind: LAYER_KIND[f.layer.id],
            props: f.properties as Record<string, unknown>,
            lngLat: g.type === "Point" ? g.coordinates : [e.lngLat.lng, e.lngLat.lat],
          });
          return;
        }
        // nothing mapped under the cursor: open the country's relations
        const c = m.queryRenderedFeatures(e.point, { layers: ["world-fill"] })[0]?.properties as
          | { iso3?: string; un?: string | number | null; name?: string }
          | undefined;
        if (c?.iso3 && c.name) cb.current.onCountry({ iso3: c.iso3, un: c.un != null ? String(c.un) : null, name: c.name });
      });
      m.on("moveend", () => {
        const c = m.getCenter();
        cb.current.onViewChange(m.getZoom(), [c.lng, c.lat]);
      });
      setReady(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // theme colours
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const transport = cssVar("--cat-transport");
    const power = cssVar("--cat-power");
    const light = theme === "light";
    m.setPaintProperty("bg", "background-color", cssVar("--water"));
    m.setPaintProperty("lakes", "fill-color", cssVar("--water"));
    m.setPaintProperty("world-fill", "fill-color", light ? "#dde5ec" : "#101922");
    m.setPaintProperty("world-line", "line-color", cssVar("--line"));
    m.setPaintProperty("world-sel", "fill-color", cssVar("--accent"));
    m.setPaintProperty("world-sel-line", "line-color", cssVar("--accent"));
    m.setPaintProperty("land", "fill-color", ["case", ["==", ["get", "iso3"], "ETH"], cssVar("--land-focus"), cssVar("--land")]);
    m.setPaintProperty("borders", "line-color", cssVar("--line-strong"));
    m.setPaintProperty("eth-border", "line-color", cssVar("--ink-3"));
    m.setPaintProperty("disputed", "line-color", cssVar("--ink-2"));
    m.setPaintProperty("grat", "line-color", light ? "#000000" : "#ffffff");
    m.setPaintProperty("infra-halo", "line-color", light ? "#000000" : "#ffffff");
    m.setPaintProperty("infra-pts-halo", "circle-color", light ? "#000000" : "#ffffff");
    for (const id of ["infra-existing", "infra-planned"]) m.setPaintProperty(id, "line-color", CAT_COLOR(power, transport));
    m.setPaintProperty("infra-pts", "circle-stroke-color", CAT_COLOR(power, transport));
    m.setPaintProperty("infra-pts", "circle-color", ["case", ["==", ["get", "layer"], "planned"], cssVar("--panel"), CAT_COLOR(power, transport)]);
  }, [theme, ready]);

  // infra data (kept in sync if it ever changes)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("infra") as GeoJSONSource).setData({ type: "FeatureCollection", features: infra } as never);
  }, [infra, ready]);

  // relations: highlight the selected country and bring it into view
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const iso = relationsSel ?? "";
    m.setFilter("world-sel", ["==", ["get", "iso3"], iso] as never);
    m.setFilter("world-sel-line", ["==", ["get", "iso3"], iso] as never);
    if (!relationsSel) return;
    const f = (world as { features: { properties: { iso3: string }; geometry: GeoJSON.Geometry }[] }).features.find((x) => x.properties.iso3 === relationsSel);
    if (!f) return;
    const b = new maplibregl.LngLatBounds();
    const extend = (coords: number[][]) => coords.forEach((c) => b.extend(c as [number, number]));
    const g = f.geometry;
    if (g.type === "Polygon") g.coordinates.forEach(extend);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach(extend));
    if (b.isEmpty()) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vb = m.getBounds();
    if (!(vb.contains(b.getSouthWest()) && vb.contains(b.getNorthEast()))) m.fitBounds(b, { padding: 60, duration: reduce ? 0 : 600, maxZoom: 6 });
  }, [relationsSel, ready]);

  // layer visibility
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const show = (on: boolean) => (on ? "visible" : "none");
    const ex = layers.includes("existing");
    const pl = layers.includes("planned");
    m.setLayoutProperty("infra-existing", "visibility", show(ex));
    m.setLayoutProperty("infra-planned", "visibility", show(pl));
    const which = [ex && "existing", pl && "planned"].filter(Boolean) as string[];
    const f = ["in", ["get", "layer"], ["literal", which]];
    m.setFilter("infra-pts", ["all", ["==", ["geometry-type"], "Point"], f] as never);
    m.setFilter("infra-hit-pt", ["all", ["==", ["geometry-type"], "Point"], f] as never);
    m.setFilter("infra-hit-line", ["all", LINES, f] as never);
    for (const mk of cityMarkers.current) mk.getElement().style.display = layers.includes("weather") ? "" : "none";
  }, [layers, ready]);

  // selection highlight + fly to
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const id = selected ?? "";
    m.setFilter("infra-halo", ["all", LINES, ["==", ["get", "id"], id]] as never);
    m.setFilter("infra-pts-halo", ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "id"], id]] as never);
    const f = infra.find((x) => x.properties.id === selected);
    if (!f) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (f.geometry.type === "Point") {
      const c = f.geometry.coordinates;
      if (!m.getBounds().contains(c)) m.easeTo({ center: c, duration: reduce ? 0 : 600 });
    } else {
      const b = new maplibregl.LngLatBounds();
      const pts = f.geometry.type === "MultiLineString" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
      pts.forEach((c) => b.extend(c));
      const vb = m.getBounds();
      if (!(vb.contains(b.getSouthWest()) && vb.contains(b.getNorthEast()))) m.fitBounds(b, { padding: 50, duration: reduce ? 0 : 600, maxZoom: 6.5 });
    }
  }, [selected, ready, infra]);

  // weather city markers
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    cityMarkers.current.forEach((mk) => mk.remove());
    cityMarkers.current = cities.map((c) => {
      const w = weather?.find((x) => x.id === c.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "city-marker";
      b.setAttribute("aria-label", `${c.name} weather${w ? `, ${Math.round(w.current.temp)} degrees` : ""}`);
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = w ? `${Math.round(w.current.temp)}°` : "--°";
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = c.name;
      b.append(t, n);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onCity(c.id);
      });
      b.style.display = layers.includes("weather") ? "" : "none";
      if (c.labelAnchor === "bottom") b.style.flexDirection = "column-reverse";
      return new maplibregl.Marker({ element: b, anchor: c.labelAnchor ?? "top" }).setLngLat([c.lon, c.lat]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, weather, ready]);

  // earthquake markers (live activity layer)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    quakeMarkers.current.forEach((mk) => mk.remove());
    const show = layers.includes("activity");
    const now = Date.now();
    quakeMarkers.current = quakes.map((q) => {
      const recent = now - q.time < 86_400_000;
      const size = Math.max(10, Math.min(34, 6 + q.mag * 4));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quake-marker";
      b.setAttribute("aria-label", `Magnitude ${q.mag} earthquake, ${q.place}`);
      b.style.width = b.style.height = `${size}px`;
      if (recent) b.classList.add("recent");
      const lab = document.createElement("span");
      lab.textContent = q.mag.toFixed(1);
      b.append(lab);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onQuake(q.id);
      });
      b.style.display = show ? "" : "none";
      return new maplibregl.Marker({ element: b }).setLngLat([q.lon, q.lat]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quakes, ready]);

  useEffect(() => {
    const show = layers.includes("activity");
    for (const mk of quakeMarkers.current) mk.getElement().style.display = show ? "" : "none";
  }, [layers]);

  const toggle = (l: Layer) => onLayers(layers.includes(l) ? layers.filter((x) => x !== l) : ALL_LAYERS.filter((x) => x === l || layers.includes(x)));

  // detailed OpenStreetMap layers: loaded on demand, drawn and labelled here
  const detail = useDetailLayers({ map, ready, layers, facCats: fac, theme, lang, avoid });
  const DETAIL: Layer[] = ["rivers", "streams", "roads", "tertiary", "rail", "places", "facilities", "streets"];
  const detailOn = DETAIL.filter((l) => layers.includes(l)).length;

  const jump = (id: string) => {
    const c = CITIES.find((x) => x.id === id);
    const m = map.current;
    if (!c || !m) return;
    if (!layers.includes("streets")) toggle("streets");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    m.fitBounds([[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]], { padding: 30, maxZoom: 14, duration: reduce ? 0 : 700 });
  };

  return (
    <div className="panel relative flex flex-col h-full min-h-[380px]">
      <div className="panel-title flex-wrap">
        <span className="live-dot" aria-hidden />
        <span>Tracking display</span>
        <span className="grow" />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Map layers">
          {(
            [
              ["existing", "Existing infra"],
              ["planned", "Planned infra"],
              ["weather", "Weather"],
              ["activity", "Quakes"],
            ] as [Layer, string][]
          ).map(([l, label]) => (
            <button key={l} type="button" className="ctl" aria-pressed={layers.includes(l)} onClick={() => toggle(l)}>
              {label}
            </button>
          ))}
          <button type="button" className="ctl" aria-pressed={panelOpen} onClick={() => setPanelOpen((v) => !v)} aria-label="Detail layers: rivers, roads, towns, facilities, city streets">
            Detail layers · {detailOn}
          </button>
          <button type="button" className="ctl" onClick={() => map.current?.fitBounds(HOME, { duration: 500 })} aria-label="Reset map view">
            ⌂
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <div ref={el} className="w-full h-full" role="region" aria-label="Map of Ethiopia and neighbours with infrastructure layers" />
        </div>
        <div key={pulseKey} className="sweep" aria-hidden />
        {hover && (
          <div className="tooltip mono" style={{ left: hover.x + 12, top: hover.y + 12 }}>
            {hover.text}
          </div>
        )}
        <div className="absolute left-2 top-2 panel px-2 py-1 text-[10.5px] z-10" style={{ background: "var(--panel)" }}>
          {hoverCountry ? (
            <span>
              <span className="ink2">{hoverCountry}</span> <span className="muted">· click for relations with Ethiopia</span>
            </span>
          ) : (
            <span className="muted">Zoom out and click any country for its relations with Ethiopia</span>
          )}
        </div>
        {panelOpen && (
          <LayerPanel
            layers={layers}
            onToggle={toggle}
            fac={fac}
            onFac={onFac}
            theme={theme}
            lang={lang}
            onLang={onLang}
            loading={detail.loading}
            errors={detail.errors}
            onJump={jump}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const row = (stroke: string, dash: boolean, label: string) => (
    <div className="flex items-center gap-2">
      <svg width="26" height="8" aria-hidden>
        <line x1="1" y1="4" x2="25" y2="4" stroke={stroke} strokeWidth="2.2" strokeDasharray={dash ? "5 3" : undefined} strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
  return (
    <div className="absolute left-2 bottom-2 panel px-2 py-1.5 text-[10.5px] ink2 flex flex-col gap-0.5 z-10" style={{ background: "var(--panel)" }}>
      {row("var(--cat-transport)", false, "Transport (rail, road, air)")}
      {row("var(--cat-power)", false, "Power (lines, dams)")}
      {row("var(--ink-2)", true, "Planned / under way")}
      <div className="flex items-center gap-2">
        <svg width="26" height="8" aria-hidden>
          <line x1="1" y1="4" x2="25" y2="4" stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
        <span>Disputed area</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden>
          <circle cx="8" cy="5" r="4" fill="none" stroke="var(--quake)" strokeWidth="1.5" />
        </svg>
        <span>Quake (size = magnitude)</span>
      </div>
    </div>
  );
}
