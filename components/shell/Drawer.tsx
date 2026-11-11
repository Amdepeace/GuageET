"use client";
import { useEffect, useRef } from "react";

/** Detail card that slides in from the side; the map stays visible behind it. */
export function Drawer({
  title,
  callsign,
  onClose,
  children,
}: {
  title: string;
  callsign?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={title}
      className="panel slide-in fixed z-40 right-0 top-0 bottom-0 w-full sm:w-[440px] flex flex-col shadow-2xl outline-none"
      style={{ borderLeft: "1px solid var(--line-strong)" }}
    >
      <div className="panel-title">
        {callsign && <span className="mono" style={{ color: "var(--accent)" }}>{callsign}</span>}
        <span className="grow normal-case tracking-normal text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </span>
        <button type="button" className="ctl" onClick={onClose} aria-label="Close detail card">
          ESC ✕
        </button>
      </div>
      <div className="overflow-y-auto scroll-thin p-3 flex-1 flex flex-col gap-4">{children}</div>
    </aside>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}
