"use client";
// 3D globe view built on react-globe.gl (MIT, https://github.com/vasturiano/react-globe.gl),
// the library behind the MIT-licensed globe-3d project. Shows Ethiopia's trade
// partners (arc width = trade value), the sea ports its trade depends on (size =
// port calls, colour = change), the corridor arcs to the sea, and recent
// earthquakes. Loaded only when the viewer asks for it, since three.js is heavy.
// Earth texture: NASA Blue Marble from NASA GIBS (public domain imagery).
import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { CorridorsFile, PortsFile, TradeFile } from "@/lib/schema";
import type { Quake } from "@/lib/usgs";
import { centroids } from "../map/useDeckOverlay";
import { portChange, SHIP_COLORS, type ShipPick } from "../map/useShippingLayer";
import { compact } from "@/lib/format";

const TEXTURE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg";

type Arc = { id: string; iso3: string; name: string; startLat: number; startLng: number; endLat: number; endLng: number; value: number; kind: "export" | "import" | "corridor" };
type Pt = { id: string; label: string; lat: number; lng: number; size: number; color: string; kind: "port" | "choke" | "addis"; ship?: ShipPick };
type Ring = { id: string; lat: number; lng: number; mag: number; place: string };

export default function GlobeView({
  trade,
  corridors,
  ports,
  quakes,
  theme,
  show,
  onCountry,
  onShip,
}: {
  trade: TradeFile;
  corridors: CorridorsFile;
  ports: PortsFile;
  quakes: Quake[];
  theme: string;
  show: { trade: boolean; ports: boolean; quakes: boolean };
  onCountry: (c: { iso3: string; un: string | null; name: string }) => void;
  onShip: (p: ShipPick) => void;
}) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const light = theme === "light";
  const cols = SHIP_COLORS[light ? "light" : "dark"];
  const [alng, alat] = corridors.origin.coordinates;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // start centred on Ethiopia with a slow auto-rotate that stops when the viewer interacts
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.pointOfView({ lat: 9, lng: 40, altitude: 1.55 }, 0);
    const c = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableDamping?: boolean };
    c.autoRotate = true;
    c.autoRotateSpeed = 0.35;
  }, []);

  const arcs = useMemo<Arc[]>(() => {
    const out: Arc[] = [];
    if (show.trade && trade.available) {
      const cents = centroids();
      const top = Object.entries(trade.bilateral)
        .sort((a, b) => b[1].exports + b[1].imports - (a[1].exports + a[1].imports))
        .slice(0, 15);
      for (const [un, b] of top) {
        const c = cents.get(un);
        if (!c) continue;
        if (b.exports > 0) out.push({ id: un, iso3: c.iso3, name: c.name, startLat: alat, startLng: alng, endLat: c.c[1], endLng: c.c[0], value: b.exports, kind: "export" });
        if (b.imports > 0) out.push({ id: un, iso3: c.iso3, name: c.name, startLat: c.c[1], startLng: c.c[0], endLat: alat, endLng: alng, value: b.imports, kind: "import" });
      }
    }
    if (show.ports) for (const c of corridors.corridors) out.push({ id: c.id, iso3: "", name: `${c.name} (${c.status.replace(/_/g, " ")})`, startLat: alat, startLng: alng, endLat: c.coordinates[1], endLng: c.coordinates[0], value: 0, kind: "corridor" });
    return out;
  }, [show.trade, show.ports, trade, corridors, alat, alng]);
  const maxV = Math.max(...arcs.map((a) => a.value), 1);

  const points = useMemo<Pt[]>(() => {
    const out: Pt[] = [{ id: "addis", label: "Addis Ababa", lat: alat, lng: alng, size: 0.5, color: light ? "#0587ad" : "#0ea5c6", kind: "addis" }];
    if (show.ports && ports.available) {
      for (const p of ports.ports) {
        const pct = portChange(p.calls30, p.calls30Prior);
        out.push({ id: p.id, label: `${p.name} · ${p.calls30} port calls (30 d to ${p.asOf})`, lat: p.lat, lng: p.lon, size: 0.25 + Math.min(0.5, p.calls30 / 250), color: pct == null ? cols.flat : pct >= 15 ? cols.up : pct <= -15 ? cols.down : cols.flat, kind: "port", ship: { kind: "port", id: p.id } });
      }
      for (const c of ports.chokepoints) out.push({ id: c.id, label: c.name, lat: c.lat, lng: c.lon, size: 0.4, color: light ? "#44566a" : "#cdd8e2", kind: "choke", ship: { kind: "choke", id: c.id } });
    }
    return out;
  }, [show.ports, ports, alat, alng, light, cols]);

  const rings = useMemo<Ring[]>(() => (show.quakes ? quakes.map((q) => ({ id: q.id, lat: q.lat, lng: q.lon, mag: q.mag, place: q.place })) : []), [show.quakes, quakes]);

  return (
    <div ref={box} className="relative w-full" style={{ height: 520, background: "#02050a" }} onPointerDown={() => { const c = ref.current?.controls() as { autoRotate: boolean } | undefined; if (c) c.autoRotate = false; }}>
      <Globe
        ref={ref}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={TEXTURE}
        showAtmosphere
        atmosphereColor="#5fa8d3"
        atmosphereAltitude={0.18}
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(d: object) => {
          const a = d as Arc;
          return a.kind === "corridor" ? ["rgba(205,216,226,0.95)", "rgba(205,216,226,0.95)"] : a.kind === "export" ? ["rgba(14,165,198,0.9)", "rgba(14,165,198,0.9)"] : ["rgba(154,124,240,0.9)", "rgba(154,124,240,0.9)"];
        }}
        arcStroke={(d: object) => {
          const a = d as Arc;
          return a.kind === "corridor" ? 0.6 : Math.max(0.28, Math.sqrt(a.value / maxV) * 1.4);
        }}
        arcAltitudeAutoScale={0.35}
        arcDashLength={0.5}
        arcDashGap={0.15}
        arcDashAnimateTime={4500}
        arcLabel={(d: object) => {
          const a = d as Arc;
          return a.kind === "corridor" ? a.name : `${a.name}: Ethiopia ${a.kind === "export" ? "exports" : "imports"} $${compact(a.value)}`;
        }}
        onArcClick={(d: object) => {
          const a = d as Arc;
          if (a.kind !== "corridor") onCountry({ iso3: a.iso3, un: a.id, name: a.name });
        }}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.01}
        pointRadius="size"
        pointLabel={(d: object) => (d as Pt).label}
        onPointClick={(d: object) => {
          const p = d as Pt;
          if (p.ship) onShip(p.ship);
        }}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(240,138,75,${1 - t})`}
        ringMaxRadius={(d: object) => 1.2 + (d as Ring).mag * 0.9}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1800}
        labelsData={[{ lat: alat, lng: alng, text: "Ethiopia" }]}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize={1.1}
        labelDotRadius={0}
        labelColor={() => "rgba(255,255,255,0.9)"}
        labelAltitude={0.012}
        labelResolution={2}
        onLabelClick={() => onCountry({ iso3: "ETH", un: "231", name: "Ethiopia" })}
      />
      {rings.length > 0 && (
        <div className="absolute right-2 bottom-2 text-[10.5px] px-2 py-1 mono" style={{ background: "rgba(2,5,10,0.7)", color: "#c8d3dd" }}>
          rings: earthquakes M{Math.min(...rings.map((r) => r.mag)).toFixed(1)}+ this week
        </div>
      )}
      <span className="sr-only">3D globe of Ethiopia&apos;s trade partners, sea ports and recent earthquakes. The same information is in the map and the Trade panel.</span>
    </div>
  );
}
