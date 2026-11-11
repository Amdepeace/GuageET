// IMF PortWatch daily chokepoint transit (open ArcGIS feature service).
// Bab el-Mandeb matters directly to Ethiopia's Red Sea trade; Suez is the
// downstream route. We keep ~120 days and a median baseline for the risk gauge.
import { join } from "node:path";
import type { Chokepoint, ChokepointDay, RedSeaFile } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "IMF PortWatch";
const SOURCE_URL = "https://portwatch.imf.org/";
const BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query";
const OUT = join(DATA, "redsea.json");
const KEEP = 120;
const POINTS: { id: string; name: string }[] = [
  { id: "chokepoint4", name: "Bab el-Mandeb Strait" },
  { id: "chokepoint1", name: "Suez Canal" },
];

type Row = { attributes: { date: number | string; n_total: number; capacity: number } };

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<RedSeaFile | null>(OUT, null);
  try {
    const chokepoints: Chokepoint[] = [];
    for (const p of POINTS) {
      const url = `${BASE}?where=portid%3D'${p.id}'&outFields=date,n_total,capacity&orderByFields=date%20DESC&resultRecordCount=${KEEP}&f=json`;
      const body = (await fetchJson(url)) as { features?: Row[] };
      const feats = body.features ?? [];
      if (!feats.length) throw new Error(`no rows for ${p.id}`);
      const history: ChokepointDay[] = feats
        .map((f) => {
          const d = f.attributes.date;
          const iso = typeof d === "number" ? new Date(d).toISOString().slice(0, 10) : String(d).slice(0, 10);
          return { date: iso, ships: f.attributes.n_total, capacity: f.attributes.capacity };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      chokepoints.push({ id: p.id, name: p.name, history, baselineShips: median(history.map((h) => h.ships)) });
      await new Promise((r) => setTimeout(r, 300));
    }
    writeJson(OUT, { fetchedAt, source: SOURCE, sourceUrl: SOURCE_URL, chokepoints } satisfies RedSeaFile);
    recordHealth(SOURCE, 2, { ok: true });
    console.log(`redsea: ${chokepoints.map((c) => `${c.name.split(" ")[0]}=${c.history.at(-1)?.ships}`).join(" ")}`);
  } catch (e) {
    recordHealth(SOURCE, 2, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { fetchedAt, source: SOURCE, sourceUrl: SOURCE_URL, chokepoints: [] } satisfies RedSeaFile);
    console.error("redsea failed, keeping last good:", (e as Error).message);
  }
}

main();
