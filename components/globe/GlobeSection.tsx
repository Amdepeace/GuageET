"use client";
// Panel shell for the 3D globe. react-globe.gl and three.js are only downloaded
// when the viewer presses the button, so they add nothing to the first page load.
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import type { CorridorsFile, PortsFile, TradeFile } from "@/lib/schema";
import type { Quake } from "@/lib/usgs";
import type { ShipPick } from "../map/useShippingLayer";

const GlobeView = dynamic(() => import("./GlobeView"), { ssr: false, loading: () => <div className="p-6 text-[12px] muted mono">Loading 3D globe…</div> });

class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { err: e.message };
  }
  render() {
    return this.state.err ? <div className="p-4 text-[12px] muted">The 3D globe could not start ({this.state.err}). It needs WebGL; the flat map shows the same layers.</div> : this.props.children;
  }
}

export function GlobeSection(props: { trade: TradeFile; corridors: CorridorsFile; ports: PortsFile; quakes: Quake[]; theme: string; onCountry: (c: { iso3: string; un: string | null; name: string }) => void; onShip: (p: ShipPick) => void }) {
  const [on, setOn] = useState(false);
  const [show, setShow] = useState({ trade: true, ports: true, quakes: true });
  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>GLOBE · Ethiopia and the world in 3D</span>
        <span className="grow" />
        {on &&
          (["trade", "ports", "quakes"] as const).map((k) => (
            <button key={k} type="button" className="ctl" aria-pressed={show[k]} onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}>
              {k === "trade" ? "Trade arcs" : k === "ports" ? "Ports & corridors" : "Earthquakes"}
            </button>
          ))}
      </div>
      {on ? (
        <Boundary>
          <GlobeView {...props} show={show} />
          <p className="px-3 py-2 text-[10.5px] muted leading-snug">
            Drag to rotate, scroll to zoom, click a partner arc for that country&apos;s relations or a port for its activity. Arcs: cyan = Ethiopian exports, violet = imports, width = trade value (UN Comtrade, {props.trade.period || "latest year"}); grey arcs = sea-access corridors; port colour = change in port calls (IMF PortWatch); rings = USGS earthquakes this week. Globe:{" "}
            <a href="https://github.com/vasturiano/react-globe.gl" target="_blank" rel="noreferrer">
              react-globe.gl ↗
            </a>{" "}
            (MIT, as used by{" "}
            <a href="https://github.com/sonnylazuardi/globe-3d" target="_blank" rel="noreferrer">
              globe-3d ↗
            </a>
            ). Earth image: NASA Blue Marble via NASA GIBS.
          </p>
        </Boundary>
      ) : (
        <div className="p-4 flex flex-col gap-2 items-start">
          <p className="text-[12px] ink2 leading-snug">A 3D view of the same trade, shipping and earthquake data. It loads a graphics library (about 1 MB) only when you open it.</p>
          <button type="button" className="ctl" onClick={() => setOn(true)}>
            Open 3D globe
          </button>
        </div>
      )}
    </div>
  );
}
