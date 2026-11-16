"use client";
// Modelled air quality for the dashboard cities from the Copernicus CAMS
// atmospheric model via the Open-Meteo air-quality API (keyless), fetched live
// in the browser. These are model values on a grid of roughly 45 km for this
// region, not readings from a ground sensor, so a city value is an area estimate.
import { useEffect, useState } from "react";
import type { City } from "@/lib/data";

type Row = { time: string; aqi: number | null; pm25: number | null; pm10: number | null; o3: number | null };

// US EPA AQI categories
const BANDS: { max: number; label: string; color: string }[] = [
  { max: 50, label: "Good", color: "#3fb950" },
  { max: 100, label: "Moderate", color: "#d29922" },
  { max: 150, label: "Unhealthy for sensitive groups", color: "#f08a4b" },
  { max: 200, label: "Unhealthy", color: "#d4546a" },
  { max: 300, label: "Very unhealthy", color: "#a1427a" },
  { max: 9999, label: "Hazardous", color: "#6a3a73" },
];
const band = (v: number | null) => (v == null ? null : BANDS.find((b) => v <= b.max)!);

export function AirQualityPanel({ cities }: { cities: City[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ latitude: cities.map((c) => c.lat).join(","), longitude: cities.map((c) => c.lon).join(","), current: "us_aqi,pm2_5,pm10,ozone", timezone: "Africa/Addis_Ababa" });
        const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${qs}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as { current: { time: string; us_aqi: number | null; pm2_5: number | null; pm10: number | null; ozone: number | null } }[] | { current: { time: string; us_aqi: number | null; pm2_5: number | null; pm10: number | null; ozone: number | null } };
        const list = Array.isArray(d) ? d : [d];
        if (alive) {
          setRows(list.map((x) => ({ time: x.current.time, aqi: x.current.us_aqi, pm25: x.current.pm2_5, pm10: x.current.pm10, o3: x.current.ozone })));
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    };
    void load();
    const t = setInterval(load, 30 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [cities]);

  const time = rows?.[0]?.time;
  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>AIR · Modelled air quality</span>
        <span className="grow" />
        {time && <span className="mono normal-case tracking-normal muted">{time.replace("T", " ")} EAT</span>}
      </div>
      <div className="p-3">
        {!rows && !err && <div className="text-[12px] muted">Loading…</div>}
        {err && !rows && <div className="text-[12px] muted">Air-quality model unavailable right now ({err}).</div>}
        {rows && (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left muted text-[10.5px]">
                <th className="font-normal py-1">City</th>
                <th className="font-normal">US AQI</th>
                <th className="font-normal text-right">PM2.5</th>
                <th className="font-normal text-right">PM10</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c, i) => {
                const r = rows[i];
                const b = band(r?.aqi ?? null);
                return (
                  <tr key={c.id} className="border-t border-[var(--line)]">
                    <td className="py-1">{c.name}</td>
                    <td>
                      {b ? (
                        <span className="inline-flex items-center gap-1.5" title={b.label}>
                          <span className="inline-block w-[9px] h-[9px] rounded-full" style={{ background: b.color }} />
                          <span className="mono">{r.aqi}</span>
                          <span className="muted text-[10.5px]">{b.label.replace(" for sensitive groups", " (sens.)")}</span>
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono text-right">{r?.pm25 != null ? r.pm25.toFixed(1) : "—"}</td>
                    <td className="mono text-right">{r?.pm10 != null ? r.pm10.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-[10.5px] muted leading-snug mt-2">
          CAMS atmospheric-model output via{" "}
          <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">
            Open-Meteo ↗
          </a>
          , about 45 km grid: an area estimate, not a ground-sensor reading. PM2.5 and PM10 in µg/m³. Live in your browser, refreshed every 30 minutes.
        </p>
      </div>
    </div>
  );
}
