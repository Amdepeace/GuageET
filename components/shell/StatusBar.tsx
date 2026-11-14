"use client";
import { useEffect, useState } from "react";
import { ethiopianToday } from "@/lib/ethiopianCalendar";
import { ago } from "@/lib/format";
import type { Light } from "@/lib/thresholds";

export type Desk = { id: string; light: Light };

export function StatusBar({
  lastSync,
  desks,
  onDesk,
  theme,
  onTheme,
  onAbout,
}: {
  lastSync: string | null;
  desks: Desk[];
  onDesk: (id: string) => void;
  theme: string;
  onTheme: () => void;
  onAbout: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const t = (tz: string) =>
    now ? now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--";
  const et = now ? ethiopianToday(now) : null;

  return (
    <header className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2 mr-2">
        <span className="live-dot" aria-hidden />
        <h1 className="text-[12px] font-semibold tracking-[0.18em] uppercase">Ethiopia Vitals</h1>
        <span className="am muted text-[12px]">ኢትዮጵያ</span>
      </div>
      <Readout label="Addis" value={t("Africa/Addis_Ababa")} />
      <Readout label="UTC" value={t("UTC")} />
      <Readout
        label="E.C."
        value={et ? `${et.day} ${et.monthName} ${et.year}` : "—"}
        title={et ? `Ethiopian calendar: ${et.day} ${et.monthAm} ${et.year}` : undefined}
      />
      <Readout label="Last data sync" value={lastSync && now ? `${ago(lastSync, now.getTime())} ago` : "—"} title={lastSync ?? undefined} />
      <span className="grow" />
      <nav className="flex flex-wrap gap-1" aria-label="Desk status lights">
        {desks.map((d) => (
          <button key={d.id} type="button" className="ctl" onClick={() => onDesk(d.id)} title={`${d.id}: show the threshold rules behind this light`}>
            <span className={`st ${d.light}`}>{d.id}</span>
          </button>
        ))}
      </nav>
      <button type="button" className="ctl" onClick={onAbout} title="Sources, definitions and data downloads">
        ABOUT
      </button>
      <button type="button" className="ctl" onClick={onTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
        {theme === "light" ? "◐ DARK" : "◑ LIGHT"}
      </button>
    </header>
  );
}

function Readout({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline gap-1.5" title={title}>
      <span className="label">{label}</span>
      <span className="mono text-[12px]">{value}</span>
    </div>
  );
}
