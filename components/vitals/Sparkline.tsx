"use client";
import { useRef, useState } from "react";

type Pt = { label: string; value: number };

/** Signal-trace sparkline on a faint grid, with a hover readout. */
export function Sparkline({
  points,
  format,
  height = 30,
  ariaLabel,
}: {
  points: Pt[];
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 200;
  const H = height;
  const pad = 3;
  if (points.length < 2) return <div style={{ height }} className="label">no history</div>;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points.length - 1;
  const hi = hover ?? last;

  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - pad) / (W - pad * 2)) * (points.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  }

  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && (
          <line x1={x(hi)} x2={x(hi)} y1={0} y2={H} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* round marker drawn in HTML so it stays circular despite the stretched viewBox */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: `${(x(hi) / W) * 100}%`,
          top: y(points[hi].value),
          width: 7,
          height: 7,
          marginLeft: -3.5,
          marginTop: -3.5,
          borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 0 0 2px var(--panel)",
        }}
      />
      {hover != null && (
        <div className="tooltip mono" style={{ left: `${Math.min(70, (x(hi) / W) * 100)}%`, bottom: H + 4 }}>
          <span className="muted">{points[hi].label}</span> {format(points[hi].value)}
        </div>
      )}
    </div>
  );
}
