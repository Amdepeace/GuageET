// Monthly climate context for the dashboard cities: 1991–2020 normals of mean
// temperature and rainfall, plus the last 24 months against them. Source:
// Open-Meteo Historical Weather API (ERA5 reanalysis, free, no key). Values are
// reanalysis on a ~10 km grid, not station measurements. The normals never
// change, so they are reused from the previous run; only recent months refresh.
// Idea borrowed from pooja97/ethio_hydro (monthly temperature/precipitation
// analysis); no code or data from that repo is used.
import { join } from "node:path";
import type { ClimateFile, ClimateCity } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";
import cities from "../config/cities.json";

const SOURCE = "Open-Meteo Historical Weather (ERA5)";
const SOURCE_URL = "https://open-meteo.com/en/docs/historical-weather-api";
const OUT = join(DATA, "climate.json");
const BASE_FROM = 1991;
const BASE_TO = 2020;
const API = "https://archive-api.open-meteo.com/v1/archive";

type Daily = { time: string[]; temperature_2m_mean: (number | null)[]; precipitation_sum: (number | null)[] };

async function daily(lat: number, lon: number, start: string, end: string): Promise<Daily> {
  const qs = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: start, end_date: end, daily: "temperature_2m_mean,precipitation_sum", timezone: "Africa/Addis_Ababa" });
  const d = (await fetchJson(`${API}?${qs}`, 4, 120_000)) as { daily?: Daily; error?: boolean; reason?: string };
  if (!d.daily) throw new Error(d.reason ?? "no daily data");
  return d.daily;
}

const round = (v: number, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

function normals(d: Daily): ClimateCity["normals"] {
  // monthly mean temperature; monthly rainfall total averaged over the years
  const t: number[][] = Array.from({ length: 12 }, () => []);
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  d.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7)) - 1;
    const tv = d.temperature_2m_mean[i];
    const pv = d.precipitation_sum[i];
    if (tv != null) t[m].push(tv);
    if (pv != null) {
      const k = day.slice(0, 7);
      sums.set(k, (sums.get(k) ?? 0) + pv);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  });
  const pm: number[][] = Array.from({ length: 12 }, () => []);
  for (const [k, v] of sums) pm[Number(k.slice(5, 7)) - 1].push(v);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  return { tempC: t.map((a) => round(mean(a))), precipMm: pm.map((a) => round(mean(a), 0)) };
}

function recent(d: Daily): ClimateCity["recent"] {
  const by = new Map<string, { t: number[]; p: number; pn: number }>();
  d.time.forEach((day, i) => {
    const k = day.slice(0, 7);
    const e = by.get(k) ?? { t: [], p: 0, pn: 0 };
    const tv = d.temperature_2m_mean[i];
    const pv = d.precipitation_sum[i];
    if (tv != null) e.t.push(tv);
    if (pv != null) {
      e.p += pv;
      e.pn++;
    }
    by.set(k, e);
  });
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => {
      const [y, m] = month.split("-").map(Number);
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        month,
        tempC: e.t.length ? round(e.t.reduce((x, y2) => x + y2, 0) / e.t.length) : null,
        precipMm: e.pn ? round(e.p, 0) : null,
        days: e.pn,
        complete: e.pn >= days,
      };
    });
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<ClimateFile | null>(OUT, null);
  const prevBy = new Map((prev?.cities ?? []).map((c) => [c.id, c]));
  try {
    // ERA5 lags a few days; stop 7 days back so partial days never appear
    const endD = new Date(Date.now() - 7 * 86400_000);
    const end = endD.toISOString().slice(0, 10);
    const startD = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth() - 23, 1));
    const start = startD.toISOString().slice(0, 10);
    const out: ClimateCity[] = [];
    for (const c of cities as { id: string; name: string; lat: number; lon: number }[]) {
      let n = prevBy.get(c.id)?.normals;
      if (!n || prev?.baseline !== `${BASE_FROM}–${BASE_TO}`) n = normals(await daily(c.lat, c.lon, `${BASE_FROM}-01-01`, `${BASE_TO}-12-31`));
      const r = recent(await daily(c.lat, c.lon, start, end));
      out.push({ id: c.id, name: c.name, normals: n, recent: r });
      await new Promise((res) => setTimeout(res, 1500));
    }
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      baseline: `${BASE_FROM}–${BASE_TO}`,
      throughDate: end,
      note: "ERA5 reanalysis (about 10 km grid), not station measurements. Months marked partial are incomplete and not compared with the normal.",
      cities: out,
    } satisfies ClimateFile);
    recordHealth(SOURCE, 24 * 7, { ok: true });
    console.log(`climate: ${out.length} cities through ${end}`);
  } catch (e) {
    recordHealth(SOURCE, 24 * 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, baseline: `${BASE_FROM}–${BASE_TO}`, throughDate: "", note: "Climate data has not loaded yet.", cities: [] } satisfies ClimateFile);
    console.error("climate failed, keeping last good:", (e as Error).message);
  }
}

main();
