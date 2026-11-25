"use client";
// Mounts its children only when the wrapper is about to scroll into view. Heavy panels
// (charts, the map, tables) then cost nothing on first load: their code is not parsed and
// their effects do not run until the viewer gets near them.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Lazy({
  children,
  minHeight = 280,
  rootMargin = "900px",
  className,
  placeholder = null,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
  placeholder?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [on, rootMargin]);
  return (
    <div ref={ref} className={className} style={on ? undefined : { minHeight }}>
      {on ? children : placeholder}
    </div>
  );
}
