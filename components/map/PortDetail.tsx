"use client";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PortsFile, RedSeaFile } from "@/lib/schema";
import { compact } from "@/lib/format";
import { Field } from "../shell/Drawer";
import { portChange, type ShipPick } from "./useShippingLayer";

const axis = { fontSize: 10, fill: "var(--ink-3)" };
const tip = { background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 };

export function PortDetail({ pick, ports, redsea }: { pick: ShipPick; ports: PortsFile; redsea: RedSeaFile }) {
  if (pick.kind === "choke") {
    const cp = redsea.chokepoints.find((c) => c.id === pick.id);
    const last = cp?.history.at(-1);
    return cp && last ? (
      <>
        <div className="text-[12px] ink2">Daily transits, IMF PortWatch · latest {last.date}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latest day">
            <span className="mono text-[20px]">{last.ships} ships</span>
          </Field>
          <Field label="Median of the window">
            <span className="mono text-[20px]">{cp.baselineShips} ships</span>
          </Field>
        </div>
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <ComposedChart data={cp.history.slice(-60)} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={axis} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={axis} />
              <Tooltip contentStyle={tip} />
              <Line dataKey="ships" name="Transits" stroke="#0ea5c6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] muted leading-snug">This is the same data as the Red Sea monitor on the dashboard. Source: IMF PortWatch, derived from AIS vessel tracking; published several days behind.</p>
      </>
    ) : (
      <p className="text-[12px] muted">No transit data for this chokepoint yet.</p>
    );
  }
  const p = ports.ports.find((x) => x.id === pick.id);
  if (!p) return <p className="text-[12px] muted">No data for this port.</p>;
  const pct = portChange(p.calls30, p.calls30Prior);
  const types = [
    { label: "Container", v: p.byType30.container },
    { label: "Tanker", v: p.byType30.tanker },
    { label: "Dry bulk", v: p.byType30.dryBulk },
    { label: "General cargo", v: p.byType30.generalCargo },
    { label: "Ro-ro", v: p.byType30.roro },
  ];
  const max = Math.max(...types.map((t) => t.v), 1);
  return (
    <>
      <div className="text-[12px] ink2">
        {p.country} · 30 days to {p.asOf} (PortWatch publishes several days behind)
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Port calls">
          <span className="mono text-[20px]">{p.calls30}</span>
        </Field>
        <Field label="Est. imports">
          <span className="mono text-[20px]">{compact(p.imp30)} t</span>
        </Field>
        <Field label="Est. exports">
          <span className="mono text-[20px]">{compact(p.exp30)} t</span>
        </Field>
      </div>
      <p className="text-[12px]">
        {pct == null ? "No full prior 30-day window to compare." : `Port calls ${pct >= 0 ? "up" : "down"} ${Math.abs(Math.round(pct))}% on the previous 30 days (${p.calls30Prior} → ${p.calls30}).`}
      </p>
      <Field label="Calls by vessel type (30 days)">
        <ul className="flex flex-col gap-[5px] mt-1">
          {types.map((t) => (
            <li key={t.label} className="grid grid-cols-[100px_1fr_auto] items-center gap-2 text-[12px]">
              <span>{t.label}</span>
              <span className="h-[6px] bg-[var(--panel-2)] block">
                <span className="block h-full" style={{ width: `${(t.v / max) * 100}%`, background: "var(--accent)" }} />
              </span>
              <span className="mono">{t.v}</span>
            </li>
          ))}
        </ul>
      </Field>
      <div>
        <div className="label mb-1">Daily port calls, last 60 days</div>
        <div style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer>
            <ComposedChart data={p.history} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="d" tick={axis} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tip} />
              <Line dataKey="calls" name="Port calls" stroke="#0ea5c6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-[11px] muted leading-snug">
        {ports.note} Source:{" "}
        <a href={ports.sourceUrl} target="_blank" rel="noreferrer">
          IMF PortWatch ↗
        </a>
        . Ethiopia is landlocked; its trade moves through these ports and the Djibouti corridor.
      </p>
    </>
  );
}
