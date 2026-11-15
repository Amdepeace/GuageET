// Rainfall against normal for each Ethiopian region (admin-1) over the latest
// 90 days: total rain in the window as a percent of the 1991–2020 average for
// the same calendar days. Source: Open-Meteo Historical Weather API (ERA5
// reanalysis, free, no key), sampled at each region's centre point. One point
// stands for a whole region, so local rain can differ a lot; this is a coarse
// screen for regional drought or flood conditions, not a measurement.
// The day-of-year climatology is computed once and reused.
import { join } from "node:path";
import type { RainfallFile } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";
import regions from "../config/admin1-centroids.json";

const SOURCE = "Open-Meteo Historical Weather (ERA5)";
const SOURCE_URL = "https://open-meteo.com/en/docs/historical-weather-api";
const OUT = join(DATA, "rainfall.json");
const API = "https://archive-api.open-meteo.com/v1/archive";
const WINDOW = 90;
const BASELINE = "1991–2020";

type Resp = { daily: { time: string[]; precipitation_sum: (number | null)[] } };
type Pt = { id: string; name: string; lat: number; lon: number };
const pts = regions as Pt[];

async function daily(group: Pt[], start: string, end: string): Promise<Resp[]> {
  const qs = new URLSearchParams({ latitude: group.map((g) => g.lat).join(","), longitude: group.map((g) => g.lon).join(","), start_date: start, end_date: end, daily: "precipitation_sum", timezone: "Africa/Addis_Ababa" });
  const d = (await fetchJson(`${API}?${qs}`, 4, 180_000)) as Resp | Resp[];
  return Array.isArray(d) ? d : [d];
}

// day of year with Feb 29 folded onto Feb 28, so every year has 365 slots
const slot = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const dd = m === 2 && d === 29 && leap ? 28 : d;
  return cum[m - 1] + dd - 1;
};

async function climatology(): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  for (let i = 0; i < pts.length; i += 5) {
    const group = pts.slice(i, i + 5);
    const res = await daily(group, "1991-01-01", "2020-12-31");
    res.forEach((r, k) => {
      const sum = new Array(365).fill(0);
      const cnt = new Array(365).fill(0);
      r.daily.time.forEach((t, j) => {
        const v = r.daily.precipitation_sum[j];
        if (v == null) return;
        const s = slot(t);
        // a folded Feb 28 averages the two days' totals, so it stays a one-day mean
        sum[s] += v;
        cnt[s]++;
      });
      out[group[k].id] = sum.map((s, j) => (cnt[j] ? Math.round((s / cnt[j]) * 100) / 100 : 0));
    });
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<RainfallFile | null>(OUT, null);
  try {
    const endD = new Date(Date.now() - 7 * 86400_000); // ERA5 lags about a week
    const startD = new Date(endD.getTime() - (WINDOW - 1) * 86400_000);
    const to = endD.toISOString().slice(0, 10);
    const from = startD.toISOString().slice(0, 10);

    const clim = prev && Object.keys(prev.climatology ?? {}).length === pts.length ? prev.climatology : await climatology();
    const res: RainfallFile["regions"] = {};
    for (let i = 0; i < pts.length; i += 5) {
      const group = pts.slice(i, i + 5);
      const data = await daily(group, from, to);
      data.forEach((r, k) => {
        const id = group[k].id;
        let mm = 0;
        let normal = 0;
        let n = 0;
        r.daily.time.forEach((t, j) => {
          const v = r.daily.precipitation_sum[j];
          if (v == null) return;
          mm += v;
          normal += clim[id][slot(t)];
          n++;
        });
        if (n < WINDOW - 3) throw new Error(`${group[k].name}: only ${n} days returned`);
        res[id] = { name: group[k].name, mm: Math.round(mm), normalMm: Math.round(normal), pct: normal > 5 ? Math.round((mm / normal) * 100) : 0 };
      });
      await new Promise((r) => setTimeout(r, 1500));
    }
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: `ERA5 reanalysis sampled at each region's centre point, so it is a coarse regional screen, not a measurement. Normal = ${BASELINE} average for the same ${WINDOW} calendar days. Regions in a dry season have tiny normals, so percentages there swing widely and are not coloured as anomalies.`,
      baseline: BASELINE,
      windowDays: WINDOW,
      from,
      to,
      regions: res,
      climatology: clim,
    } satisfies RainfallFile);
    recordHealth("Rainfall anomaly (ERA5)", 7, { ok: true });
    console.log(`rainfall: ${Object.keys(res).length} regions, ${from} to ${to}`);
  } catch (e) {
    recordHealth("Rainfall anomaly (ERA5)", 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Rainfall data has not loaded yet.", baseline: BASELINE, windowDays: WINDOW, from: "", to: "", regions: {}, climatology: {} } satisfies RainfallFile);
    console.error("rainfall failed, keeping last good:", (e as Error).message);
  }
}

main();
