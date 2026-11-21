// Ethiopia's national demographics from the World Bank "Population estimates and
// projections" database (source 40), which republishes the UN World Population
// Prospects: population by sex and 5-year age band for every year 1960-2050,
// plus fertility, life expectancy, birth and death rates and dependency ratios.
// Years from 2024 are the UN's medium-variant PROJECTIONS (the dashboard makes
// no demographic forecast of its own). Urban share comes from WDI (source 2).
import { join } from "node:path";
import type { DemoSeries, DemographicsFile } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson, WB_TIMEOUT_MS } from "./lib/store";

const SOURCE = "World Bank / UN World Population Prospects";
const SOURCE_URL = "https://databank.worldbank.org/source/population-estimates-and-projections";
const OUT = join(DATA, "demographics.json");
const BAND_CODES = ["0004", "0509", "1014", "1519", "2024", "2529", "3034", "3539", "4044", "4549", "5054", "5559", "6064", "6569", "7074", "7579", "80UP"];
const BANDS = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80+"];
const SERIES: { code: string; id: string; label: string; unit: string; source: number }[] = [
  { code: "SP.POP.TOTL", id: "total", label: "Total population", unit: "people", source: 40 },
  { code: "SP.POP.GROW", id: "growth", label: "Population growth", unit: "% a year", source: 40 },
  { code: "SP.DYN.TFRT.IN", id: "tfr", label: "Fertility rate", unit: "births per woman", source: 40 },
  { code: "SP.DYN.LE00.IN", id: "life", label: "Life expectancy at birth", unit: "years", source: 40 },
  { code: "SP.DYN.LE00.FE.IN", id: "lifeF", label: "Life expectancy, female", unit: "years", source: 40 },
  { code: "SP.DYN.LE00.MA.IN", id: "lifeM", label: "Life expectancy, male", unit: "years", source: 40 },
  { code: "SP.DYN.CBRT.IN", id: "birth", label: "Birth rate", unit: "per 1,000 people", source: 40 },
  { code: "SP.DYN.CDRT.IN", id: "death", label: "Death rate", unit: "per 1,000 people", source: 40 },
  { code: "SP.POP.DPND", id: "dep", label: "Age dependency ratio", unit: "dependents per 100 working-age", source: 40 },
  { code: "SP.URB.TOTL.IN.ZS", id: "urban", label: "Urban population", unit: "% of total", source: 2 },
];

type Row = { indicator: { id: string }; date: string; value: number | null };

async function wb(codes: string[], source: number, from: number, to: number): Promise<{ rows: Row[]; lastUpdated: string }> {
  const url = `https://api.worldbank.org/v2/country/ETH/indicator/${codes.join(";")}?source=${source}&date=${from}:${to}&format=json&per_page=20000`;
  const d = (await fetchJson(url, 3, WB_TIMEOUT_MS)) as [{ lastupdated?: string; message?: unknown }, Row[] | null];
  if (!d[1]) throw new Error(`no data for source ${source}: ${JSON.stringify(d[0]).slice(0, 120)}`);
  return { rows: d[1], lastUpdated: d[0].lastupdated ?? "" };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<DemographicsFile | null>(OUT, null);
  try {
    const codes = BAND_CODES.flatMap((b) => [`SP.POP.${b}.MA`, `SP.POP.${b}.FE`]);
    const bands = await wb(codes, 40, 1960, 2050);
    const s40 = await wb(SERIES.filter((s) => s.source === 40).map((s) => s.code), 40, 1960, 2050);
    const s2 = await wb(SERIES.filter((s) => s.source === 2).map((s) => s.code), 2, 1960, 2050);

    const years = [...new Set(bands.rows.filter((r) => r.value != null).map((r) => Number(r.date)))].sort((a, b) => a - b);
    const pyramid: DemographicsFile["pyramid"] = {};
    for (const y of years) pyramid[String(y)] = { m: new Array(BANDS.length).fill(0), f: new Array(BANDS.length).fill(0) };
    for (const r of bands.rows) {
      if (r.value == null) continue;
      const m = /^SP\.POP\.(\w{4})\.(MA|FE)$/.exec(r.indicator.id);
      if (!m) continue;
      const i = BAND_CODES.indexOf(m[1]);
      const p = pyramid[r.date];
      if (p && i >= 0) (m[2] === "MA" ? p.m : p.f)[i] = Math.round(r.value);
    }
    // a year only counts if every band is present for both sexes
    const complete = years.filter((y) => pyramid[String(y)].m.every((v) => v > 0) && pyramid[String(y)].f.every((v) => v > 0));
    if (complete.length < 80) throw new Error(`only ${complete.length} complete years of age-sex data`);

    const series: DemoSeries[] = [];
    for (const def of SERIES) {
      const rows = (def.source === 40 ? s40.rows : s2.rows).filter((r) => r.indicator.id === def.code && r.value != null);
      const values: Record<string, number> = {};
      for (const r of rows) values[r.date] = Math.round(Number(r.value) * 1000) / 1000;
      if (Object.keys(values).length) series.push({ id: def.id, label: def.label, unit: def.unit, values });
    }
    if (!series.some((s) => s.id === "total")) throw new Error("no total population series");

    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      lastUpdated: bands.lastUpdated,
      available: true,
      note: "Population by sex and age, fertility, life expectancy and related series as published by the UN Population Division (World Population Prospects) through the World Bank. Years from 2024 on are the UN's medium-variant projections, not recorded counts, and the further out, the more uncertain. Median age is computed here from the published 5-year age bands.",
      projectionFrom: 2024,
      years: complete,
      bands: BANDS,
      pyramid: Object.fromEntries(complete.map((y) => [String(y), pyramid[String(y)]])),
      series,
    } satisfies DemographicsFile);
    recordHealth(SOURCE, 35, { ok: true });
    console.log(`demographics: ${complete[0]}-${complete.at(-1)}, ${series.length} series, WB updated ${bands.lastUpdated}`);
  } catch (e) {
    recordHealth(SOURCE, 35, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, lastUpdated: "", available: false, note: "Demographic data has not loaded yet.", projectionFrom: 2024, years: [], bands: BANDS, pyramid: {}, series: [] } satisfies DemographicsFile);
    console.error("demographics failed, keeping last good:", (e as Error).message);
  }
}

main();
