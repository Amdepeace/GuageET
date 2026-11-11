"use client";
import type { HealthStatus } from "@/lib/schema";
import { STATUS_HELP } from "@/lib/freshness";
import { ago } from "@/lib/format";

export type SourceRow = {
  source: string;
  kind: "live" | "scheduled" | "curated";
  status: HealthStatus;
  lastSuccess: string | null;
  error: string | null;
};

export function SystemHealth({ rows, now }: { rows: SourceRow[]; now: number | null }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>System health</span>
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.source} className="px-3 py-1.5 border-b last:border-b-0 border-[var(--line)] text-[12px]">
            <div className="flex items-center gap-2">
              <span className="grow">{r.source}</span>
              <span className={`st ${r.status}`} title={STATUS_HELP[r.status]}>
                {r.status}
              </span>
            </div>
            <div className="text-[10.5px] muted mono">
              {r.kind} · last ok {r.lastSuccess && now ? `${ago(r.lastSuccess, now)} ago` : "never"}
            </div>
            {r.error && (
              <div className="text-[10.5px] mt-0.5 break-words" style={{ color: "var(--warn)" }} title={r.error}>
                {r.error.length > 120 ? r.error.slice(0, 120) + "…" : r.error}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
