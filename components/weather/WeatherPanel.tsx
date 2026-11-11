"use client";
import type { City } from "@/lib/data";
import type { HealthStatus } from "@/lib/schema";
import { WEATHER_SOURCE, WEATHER_SOURCE_URL, wmoLabel, type WeatherSnapshot } from "@/lib/openMeteo";
import { ago } from "@/lib/format";
import { Field } from "../shell/Drawer";

export function WeatherPanel({
  cities,
  snap,
  status,
  now,
  onCity,
}: {
  cities: City[];
  snap: WeatherSnapshot | null;
  status: HealthStatus;
  now: number | null;
  onCity: (id: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Weather · now &amp; 7-day</span>
        <span className="grow" />
        <span className={`st ${status}`}>{status}</span>
      </div>
      <table className="grid text-[12px]">
        <thead>
          <tr>
            <th>City</th>
            <th style={{ textAlign: "right" }}>Now</th>
            <th>Cond.</th>
            <th style={{ textAlign: "right" }} title="Total forecast precipitation over the next 7 days">
              Rain 7d
            </th>
          </tr>
        </thead>
        <tbody>
          {cities.map((c) => {
            const w = snap?.cities.find((x) => x.id === c.id);
            const rain = w ? w.daily.reduce((s, d) => s + (d.precip ?? 0), 0) : null;
            return (
              <tr key={c.id} className="row" tabIndex={0} onClick={() => onCity(c.id)} onKeyDown={(e) => e.key === "Enter" && onCity(c.id)}>
                <td>
                  <span className="mono muted mr-1.5">{c.id}</span>
                  {c.name}
                </td>
                <td className="mono text-right" style={{ color: "var(--ink)" }}>
                  {w ? `${Math.round(w.current.temp)}°C` : "—"}
                </td>
                <td className="mono text-[10.5px] ink2 whitespace-nowrap">{w ? wmoLabel(w.current.code) : "—"}</td>
                <td className="mono text-right ink2">{rain != null ? `${rain.toFixed(0)} mm` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[10.5px] muted flex flex-wrap gap-x-2">
        <a href={WEATHER_SOURCE_URL} target="_blank" rel="noreferrer">
          {WEATHER_SOURCE}
        </a>
        <span>· live, polled every 15 min</span>
        {snap && now && <span className="mono">· fetched {ago(new Date(snap.fetchedAt).toISOString(), now)} ago</span>}
        {status === "OFFLINE" && snap && <span className="stale-tag">STALE</span>}
      </div>
    </div>
  );
}

export function CityDetail({ city, snap }: { city: City; snap: WeatherSnapshot | null }) {
  const w = snap?.cities.find((x) => x.id === city.id);
  if (!w || !snap) return <div className="muted">No weather fetched yet for {city.name}.</div>;
  return (
    <>
      <div>
        <div className="label">
          {city.name} · <span className="am normal-case tracking-normal">{city.am}</span>
        </div>
        <div className="mono text-[32px] font-semibold leading-tight">{w.current.temp.toFixed(1)}°C</div>
        <div className="mono text-[12px] ink2">
          {wmoLabel(w.current.code)} · RH {w.current.humidity}% · wind {w.current.wind.toFixed(0)} km/h
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <Field label="Observed (local)">
          <span className="mono">{w.current.time.replace("T", " ")}</span>
        </Field>
        <Field label="Source">
          <a href={WEATHER_SOURCE_URL} target="_blank" rel="noreferrer">
            {WEATHER_SOURCE} ↗
          </a>
        </Field>
      </div>
      <div>
        <div className="label mb-1">7-day forecast</div>
        <table className="grid mono text-[11.5px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Cond.</th>
              <th style={{ textAlign: "right" }}>Max</th>
              <th style={{ textAlign: "right" }}>Min</th>
              <th style={{ textAlign: "right" }}>Rain</th>
            </tr>
          </thead>
          <tbody>
            {w.daily.map((d) => (
              <tr key={d.date}>
                <td>{d.date.slice(5)}</td>
                <td className="ink2">{wmoLabel(d.code)}</td>
                <td style={{ textAlign: "right" }}>{d.max.toFixed(0)}°</td>
                <td style={{ textAlign: "right" }} className="ink2">
                  {d.min.toFixed(0)}°
                </td>
                <td style={{ textAlign: "right" }}>{d.precip.toFixed(1)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] muted">Model forecast for the city coordinates. Seasonal rainfall comparison (belg / kiremt) arrives in v2.</p>
    </>
  );
}
