// Latest population, GDP (current US$) and GDP growth for every country, from
// the World Bank API (keyless). Used to show any clicked country beside
// Ethiopia. One small file keyed by ISO3; only the latest non-null value is kept.
import { join } from "node:path";
import { DATA, fetchJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "World Bank WDI";
const OUT = join(DATA, "world-indicators.json");
const INDICATORS: { id: string; wb: string }[] = [
  { id: "population", wb: "SP.POP.TOTL" },
  { id: "gdp_usd", wb: "NY.GDP.MKTP.CD" },
  { id: "gdp_growth", wb: "NY.GDP.MKTP.KD.ZG" },
];

type WbRow = { countryiso3code: string; date: string; value: number | null };
export type WorldIndicator = { value: number; year: string };
type Entry = Record<string, WorldIndicator>;

async function main() {
  const fetchedAt = new Date().toISOString();
  try {
    const out: Record<string, Entry & { fetchedAt?: string }> = {};
    for (const ind of INDICATORS) {
      // all countries, last 6 years, pick latest non-null per country
      const url = `https://api.worldbank.org/v2/country/all/indicator/${ind.wb}?format=json&per_page=20000&date=${new Date().getUTCFullYear() - 6}:${new Date().getUTCFullYear()}`;
      const body = (await fetchJson(url)) as [unknown, WbRow[] | null];
      const rows = body?.[1];
      if (!Array.isArray(rows)) throw new Error(`no rows for ${ind.wb}`);
      const latest = new Map<string, { value: number; year: string }>();
      for (const r of rows) {
        if (r.value == null || !/^[A-Z]{3}$/.test(r.countryiso3code)) continue;
        const cur = latest.get(r.countryiso3code);
        if (!cur || r.date > cur.year) latest.set(r.countryiso3code, { value: r.value, year: r.date });
      }
      for (const [iso3, v] of latest) {
        (out[iso3] ??= {})[ind.id] = { value: Number(v.value.toFixed(ind.id === "gdp_growth" ? 2 : 0)), year: v.year };
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    writeJson(OUT, { source: SOURCE, sourceUrl: "https://data.worldbank.org/", fetchedAt, countries: out });
    recordHealth("World Bank (world indicators)", 30, { ok: true });
    console.log(`world-indicators: ${Object.keys(out).length} countries`);
  } catch (e) {
    recordHealth("World Bank (world indicators)", 30, { ok: false, error: String((e as Error).message ?? e) });
    console.error("world-indicators failed:", (e as Error).message);
  }
}

main();
