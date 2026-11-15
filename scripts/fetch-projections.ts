// IMF World Economic Outlook estimates and projections for Ethiopia, quoted as
// published (the dashboard makes no forecasts of its own here). Years from the
// current calendar year onward are the IMF's estimates/projections. Official
// IMF SDMX API (api.imf.org), keyless. The IMF revises these each April and
// October; the API returns its latest published vintage.
import { join } from "node:path";
import type { ProjectionsFile, ProjectionSeries } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "IMF WEO projections";
const SOURCE_URL = "https://www.imf.org/en/Publications/WEO";
const OUT = join(DATA, "projections.json");
const BASE = "https://api.imf.org/external/sdmx/2.1/data/WEO";
const IND = [
  { id: "gdp_growth", code: "NGDP_RPCH", label: "Real GDP growth", unit: "% y/y" },
  { id: "inflation", code: "PCPIPCH", label: "Inflation (average CPI)", unit: "% y/y" },
];

type Sdmx = {
  structure?: { dimensions: { observation: { id: string; values: { id: string }[] }[] } };
  dataSets?: { series: Record<string, { observations: Record<string, (string | null)[]> }> }[];
};

async function get(url: string): Promise<Sdmx> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Sdmx;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<ProjectionsFile | null>(OUT, null);
  const year = new Date().getUTCFullYear();
  try {
    const series: ProjectionSeries[] = [];
    for (const ind of IND) {
      const j = await get(`${BASE}/ETH.${ind.code}.A?startPeriod=${year - 3}&endPeriod=${year + 5}`);
      const times = j.structure?.dimensions.observation.find((d) => d.id === "TIME_PERIOD")?.values.map((v) => v.id) ?? [];
      const s = Object.values(j.dataSets?.[0]?.series ?? {})[0];
      if (!s) throw new Error(`no ${ind.code} series`);
      const points = Object.entries(s.observations)
        .map(([t, v]) => ({ year: Number(times[Number(t)]), value: v?.[0] == null ? NaN : Math.round(Number(v[0]) * 10) / 10, projected: Number(times[Number(t)]) >= year }))
        .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.year))
        .sort((a, b) => a.year - b.year);
      if (!points.some((p) => p.projected)) throw new Error(`${ind.code}: no projected years returned`);
      series.push({ id: ind.id, label: ind.label, unit: ind.unit, country: "ETH", points });
    }
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "IMF staff estimates and projections as last published (WEO is revised each April and October); they are the IMF's, not this dashboard's. Projections are conditional on the IMF's assumptions and often miss in a crisis.",
      series,
    } satisfies ProjectionsFile);
    recordHealth(SOURCE, 7, { ok: true });
    console.log(`projections: ${series.map((s) => `${s.id}=${s.points.filter((p) => p.projected).length}`).join(" ")}`);
  } catch (e) {
    recordHealth(SOURCE, 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Projections have not loaded yet.", series: [] } satisfies ProjectionsFile);
    console.error("projections failed, keeping last good:", (e as Error).message);
  }
}

main();
