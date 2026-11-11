// CI gate: every stored figure must carry source and as-of date, and every
// curated record must carry at least one source URL and a last-verified date.
import { join } from "node:path";
import { COUNTRIES, type CountryFile, type InfraProps, type SimpleSeries } from "../lib/schema";
import { DATA, assertObservation, countryPath, readJson } from "./lib/store";

const errors: string[] = [];

// v2 contract-shaped files: commodities (array) and daily FX (single series)
const commodities = readJson<SimpleSeries[]>(join(DATA, "commodities.json"), []);
const fx = readJson<SimpleSeries | null>(join(DATA, "fx-daily.json"), null);
for (const s of [...commodities, ...(fx ? [fx] : [])]) {
  for (const o of s.history) {
    try {
      assertObservation(o, `${s.id}/${o.period}`);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
}
for (const c of COUNTRIES) {
  const file = readJson<CountryFile | null>(countryPath(c.code), null);
  if (!file) {
    errors.push(`missing data/series/${c.code}.json`);
    continue;
  }
  for (const [id, s] of Object.entries(file.series)) {
    for (const o of [...s.history, ...s.alternatives]) {
      try {
        assertObservation(o, `${c.code}/${id}/${o.period}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
  }
}

type FC = { features: { properties: InfraProps; geometry: unknown }[] };
const infra = readJson<FC>(join(DATA, "curated", "infrastructure.geojson"), { features: [] });
const ids = new Set<string>();
for (const f of infra.features) {
  const p = f.properties;
  if (ids.has(p.id)) errors.push(`duplicate infra id ${p.id}`);
  ids.add(p.id);
  if (!p.sources?.length || p.sources.some((s) => !/^https?:\/\//.test(s.url)))
    errors.push(`infra ${p.id}: needs at least one source URL`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerified ?? "")) errors.push(`infra ${p.id}: bad lastVerified`);
  if (!f.geometry) errors.push(`infra ${p.id}: missing geometry`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`data valid: ${COUNTRIES.length} countries, ${infra.features.length} infra records`);
