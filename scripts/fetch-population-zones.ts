// Ethiopia's population by zone (admin-2) and region (admin-1), by sex and 5-year
// age band, from OCHA's Common Operational Dataset on Population Statistics
// (COD-PS) as served by HDX HAPI (keyless). The reference year is 2022. These are
// the national statistics office's/OCHA's projections for 2022, a different
// source from the UN series on the national chart, and they do not cover every
// area (zones missing from the source are shown as "no data", never as zero).
import { join } from "node:path";
import type { PopZone, PopulationZonesFile } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "OCHA COD-PS via HDX HAPI";
const SOURCE_URL = "https://data.humdata.org/dataset/cod-ps-eth";
const OUT = join(DATA, "population-zones.json");
const KEY = process.env.HDX_APP_IDENTIFIER || Buffer.from("guageet:noreply@example.com").toString("base64");
const BASE = "https://hapi.humdata.org/api/v1/population-social/population";
const BANDS = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65+"];

type Row = { admin1_code: string; admin1_name: string; admin2_code: string | null; admin2_name: string | null; gender: string; age_range: string; population: number; reference_period_start: string };

async function load(level: 1 | 2): Promise<Row[]> {
  const out: Row[] = [];
  for (let off = 0; ; off += 10000) {
    const qs = new URLSearchParams({ location_code: "ETH", admin_level: String(level), output_format: "json", limit: "10000", offset: String(off), app_identifier: KEY });
    let rows: Row[] | null = null;
    for (let i = 0; i < 4 && !rows; i++) {
      const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(120_000) });
      if (res.ok) rows = ((await res.json()) as { data?: Row[] }).data ?? [];
      else if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      else throw new Error(`HTTP ${res.status}`);
    }
    if (!rows) throw new Error("HAPI unavailable");
    out.push(...rows);
    if (rows.length < 10000) break;
  }
  return out;
}

function build(rows: Row[], level: 1 | 2): PopZone[] {
  const zones = new Map<string, PopZone>();
  for (const r of rows) {
    const id = level === 1 ? r.admin1_code : r.admin2_code;
    const name = level === 1 ? r.admin1_name : r.admin2_name;
    if (!id || !name) continue;
    const z = zones.get(id) ?? { id, name, region: r.admin1_name, total: 0, m: new Array(BANDS.length).fill(0), f: new Array(BANDS.length).fill(0) };
    zones.set(id, z);
    const i = BANDS.indexOf(r.age_range);
    if (i >= 0 && r.gender === "m") z.m[i] = r.population;
    else if (i >= 0 && r.gender === "f") z.f[i] = r.population;
    else if (r.age_range === "all" && r.gender === "all") z.total = r.population;
  }
  // keep only zones whose bands add up to the published total (within 2%), so a partial record never skews a map or pyramid
  return [...zones.values()].filter((z) => {
    const sum = z.m.reduce((a, b) => a + b, 0) + z.f.reduce((a, b) => a + b, 0);
    return z.total > 0 && Math.abs(sum - z.total) / z.total < 0.02;
  });
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<PopulationZonesFile | null>(OUT, null);
  try {
    const [r1, r2] = [await load(1), await load(2)];
    const regions = build(r1, 1);
    const zones = build(r2, 2);
    if (zones.length < 50 || regions.length < 8) throw new Error(`too few units (${zones.length} zones, ${regions.length} regions)`);
    const period = (r2[0]?.reference_period_start ?? "").slice(0, 4);
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: `Reference year ${period}. OCHA COD-PS population statistics (from the national statistics office's projections), by sex and 5-year age band. They differ from the UN figures used on the national charts, and some areas are absent from the source, so the zone totals add up to less than the national estimate. There are no subnational projections in these sources.`,
      period,
      bands: BANDS,
      zones,
      regions,
    } satisfies PopulationZonesFile);
    recordHealth(SOURCE, 35, { ok: true });
    console.log(`population-zones: ${zones.length} zones, ${regions.length} regions, year ${period}, total ${zones.reduce((s, z) => s + z.total, 0)}`);
  } catch (e) {
    recordHealth(SOURCE, 35, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Population data has not loaded yet.", period: "", bands: BANDS, zones: [], regions: [] } satisfies PopulationZonesFile);
    console.error("population-zones failed, keeping last good:", (e as Error).message);
  }
}

main();
