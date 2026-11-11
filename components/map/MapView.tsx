"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type Map as MlMap } from "maplibre-gl";
import countries from "@/data/geo/countries.geojson";
import lakes from "@/data/geo/lakes.geojson";
import disputed from "@/data/geo/disputed.geojson";
import type { City, InfraFeature } from "@/lib/data";
import type { CityWeather } from "@/lib/openMeteo";
import { ALL_LAYERS, type Layer } from "@/lib/urlState";
import type { Quake } from "@/lib/usgs";

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
  const cb = useRef({ onSelect, onViewChange, onCity, onQuake });
  cb.current = { onSelect, onViewChange, onCity, onQuake };

  // init once
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0a1e2c" } }] },
      bounds: initialView.center ? undefined : HOME,
      center: initialView.center ?? undefined,
      zoom: initialView.zoom ?? undefined,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 9,
      minZoom: 2.5,
      cooperativeGestures: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · dashed = disputed',
      }),
      "bottom-right",
    );

    m.on("load", () => {
      m.addSource("grat", { type: "geojson", data: graticule() as never });
      m.addSource("countries", { type: "geojson", data: countries as never });
      m.addSource("lakes", { type: "geojson", data: lakes as never });
      m.addSource("disputed", { type: "geojson", data: disputed as never });
      m.addSource("infra", { type: "geojson", data: { type: "FeatureCollection", features: infra } as never, promoteId: "id" });

      m.addLayer({ id: "grat", type: "line", source: "grat", paint: { "line-color": "#ffffff", "line-opacity": 0.05, "line-width": 1 } });
      m.addLayer({ id: "land", type: "fill", source: "countries", paint: { "fill-color": "#121c25" } });
      m.addLayer({ id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": "#0a1e2c" } });
      m.addLayer({ id: "borders", type: "line", source: "countries", paint: { "line-color": "#2f4152", "line-width": 0.8 } });
      m.addLayer({ id: "eth-border", type: "line", source: "countries", filter: ["==", ["get", "iso3"], "ETH"], paint: { "line-color": "#6c7f90", "line-width": 1.4 } });
      m.addLayer({ id: "disputed", type: "line", source: "disputed", paint: { "line-color": "#9fb0bf", "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.7 } });

      const isLine = ["==", ["geometry-type"], "LineString"];
      const isPt = ["==", ["geometry-type"], "Point"];
      const L = (layer: string) => ["==", ["get", "layer"], layer];
      // selection halo (under the lines)
      m.addLayer({ id: "infra-halo", type: "line", source: "infra", filter: ["all", isLine, ["==", ["get", "id"], ""]] as never, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.25 } });
      m.addLayer({ id: "infra-existing", type: "line", source: "infra", filter: ["all", isLine, L("existing")] as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": CAT_COLOR("#9a7cf0", "#0ea5c6") as never, "line-width": 2.2 } });
      m.addLayer({ id: "infra-planned", type: "line", source: "infra", filter: ["all", isLine, L("planned")] as never, layout: { "line-join": "round" }, paint: { "line-color": CAT_COLOR("#9a7cf0", "#0ea5c6") as never, "line-width": 2, "line-dasharray": [2.2, 1.6] } });
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

      for (const id of ["infra-hit-line", "infra-hit-pt"]) {
        m.on("mousemove", id, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const p = e.features?.[0]?.properties as { callsign: string; name: string } | undefined;
          if (p) setHover({ x: e.point.x, y: e.point.y, text: `${p.callsign} · ${p.name}` });
        });
        m.on("mouseleave", id, () => {
          m.getCanvas().style.cursor = "";
          setHover(null);
        });
      }
      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["infra-hit-pt", "infra-hit-line"] });
        const id = (hits[0]?.properties as { id?: string } | undefined)?.id ?? null;
        if (id) cb.current.onSelect(id);
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
    m.setFilter("infra-hit-line", ["all", ["==", ["geometry-type"], "LineString"], f] as never);
    for (const mk of cityMarkers.current) mk.getElement().style.display = layers.includes("weather") ? "" : "none";
  }, [layers, ready]);

  // selection highlight + fly to
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const id = selected ?? "";
    m.setFilter("infra-halo", ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "id"], id]] as never);
    m.setFilter("infra-pts-halo", ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "id"], id]] as never);
    const f = infra.find((x) => x.properties.id === selected);
    if (!f) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (f.geometry.type === "Point") {
      const c = f.geometry.coordinates;
      if (!m.getBounds().contains(c)) m.easeTo({ center: c, duration: reduce ? 0 : 600 });
    } else {
      const b = new maplibregl.LngLatBounds();
      f.geometry.coordinates.forEach((c) => b.extend(c));
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
