"use client";
import type { HealthStatus, RedSeaFile } from "@/lib/schema";
import { ago } from "@/lib/format";
import { Sparkline } from "../vitals/Sparkline";

export function RedSeaMonitor({ data, status, now }: { data: RedSeaFile; status: HealthStatus; now: number | null }) {
  return (
    <div className="panel flex flex-col">
      <div className="panel-title">
        <span>Red Sea risk · daily transit</span>
        <span className="grow" />
        <span className={`st ${status}`}>{status}</span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {data.chokepoints.length === 0 ? (
          <div className="text-[12px] muted">Awaiting IMF PortWatch data.</div>
        ) : (
          data.chokepoints.map((c) => {
            const last = c.history.at(-1);
            const drop = last && c.baselineShips ? ((c.baselineShips - last.ships) / c.baselineShips) * 100 : 0;
            const pts = c.history.slice(-45).map((d) => ({ label: d.date.slice(5), value: d.ships }));
            return (
              <div key={c.id}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px]" style={{ color: "var(--ink)" }}>
                    {c.name}
                  </span>
                  <span className="grow" />
                  <span className="mono text-[16px] font-semibold">{last?.ships ?? "—"}</span>
                  <span className="label">ships</span>
                </div>
                <div className="mono text-[10.5px] ink2">
                  {drop > 5 ? (
                    <span style={{ color: drop > 40 ? "var(--bad)" : "var(--warn)" }}>▼ {drop.toFixed(0)}% vs median</span>
                  ) : drop < -5 ? (
                    <span>▲ {Math.abs(drop).toFixed(0)}% vs median</span>
                  ) : (
                    <span className="muted">≈ median ({c.baselineShips})</span>
                  )}
                  {last && <span className="muted"> · {last.date}</span>}
                </div>
                <div className="mt-1">
                  <Sparkline points={pts} format={(v) => `${v} ships`} height={24} ariaLabel={`${c.name} daily transit, last ${pts.length} days`} />
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="px-3 pb-2 text-[10px] muted flex flex-wrap gap-x-2 mt-auto">
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          {data.source}
        </a>
        <span>· ships/day, median over window</span>
        {data.fetchedAt && now && <span className="mono">· {ago(data.fetchedAt, now)} ago</span>}
      </div>
    </div>
  );
}
