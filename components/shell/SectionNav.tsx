"use client";
import { useEffect, useState } from "react";

export const SECTIONS = [
  { id: "sec-vitals", label: "Vitals" },
  { id: "sec-map", label: "Map" },
  { id: "sec-explore", label: "Explorer" },
  { id: "sec-risk", label: "Risk" },
  { id: "sec-economy", label: "Debt & aid" },
  { id: "sec-trade", label: "Trade & news" },
  { id: "sec-climate", label: "Climate" },
  { id: "sec-roads", label: "Roads" },
  { id: "sec-power", label: "Power" },
  { id: "sec-infra", label: "Infrastructure" },
];

/** Sticky section bar that highlights the section in view. */
export function SectionNav({ onSearch }: { onSearch: () => void }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);
  return (
    <nav aria-label="Dashboard sections" className="sticky top-0 z-30 -mx-2 md:-mx-3 px-2 md:px-3 py-1 flex items-center gap-1 overflow-x-auto border-b" style={{ background: "var(--bg)", borderColor: "var(--line)" }}>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "true" : undefined}
          className="shrink-0 text-[11px] px-2 py-1 border"
          style={{ borderColor: active === s.id ? "var(--accent)" : "transparent", color: active === s.id ? "var(--ink)" : "var(--ink-2)", background: active === s.id ? "var(--accent-dim)" : "transparent", textDecoration: "none" }}
        >
          {s.label}
        </a>
      ))}
      <span className="grow" />
      <button type="button" className="ctl shrink-0" onClick={onSearch} aria-label="Search the dashboard (Ctrl or Cmd plus K)">
        Search <span className="mono muted">⌘K</span>
      </button>
    </nav>
  );
}
