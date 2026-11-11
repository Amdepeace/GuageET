"use client";
import { useEffect, useState } from "react";
import type { Alert } from "@/lib/schema";

const LS_DISMISSED = "ev-alerts-dismissed";

function lsGet(k: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(k) || "[]");
  } catch {
    return [];
  }
}
function lsAdd(k: string, id: string) {
  try {
    const s = new Set(lsGet(k));
    s.add(id);
    localStorage.setItem(k, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/** Dismissible banner of scheduled + live alerts. Reduced motion: no slide. */
export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => setDismissed(new Set(lsGet(LS_DISMISSED))), []);
  const shown = alerts.filter((a) => !dismissed.has(a.id));
  if (!shown.length) return null;

  return (
    <div className="flex flex-col gap-1" role="status" aria-live="polite">
      {shown.map((a) => (
        <div
          key={a.id}
          className="panel flex items-start gap-2 px-3 py-2"
          style={{ borderLeft: `3px solid ${a.level === "red" ? "var(--bad)" : "var(--warn)"}` }}
        >
          <span className={`st ${a.level === "red" ? "red" : "amber"} mt-0.5`} aria-label={a.level === "red" ? "Critical alert" : "Warning alert"} />
          <div className="grow min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: a.level === "red" ? "var(--bad)" : "var(--warn)" }}>
              {a.title}
            </div>
            <div className="text-[11.5px] ink2">
              {a.detail}{" "}
              {a.sourceUrl ? (
                <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                  {a.source} ↗
                </a>
              ) : (
                <span className="muted">· {a.source}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="ctl shrink-0"
            onClick={() => {
              lsAdd(LS_DISMISSED, a.id);
              setDismissed((d) => new Set(d).add(a.id));
            }}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
