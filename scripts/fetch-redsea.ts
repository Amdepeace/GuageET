// IMF PortWatch daily chokepoint transit (open ArcGIS feature service).
// Bab el-Mandeb matters directly to Ethiopia's Red Sea trade; Suez is the
// downstream route. We keep ~120 days and a median baseline for the risk gauge.
//
// The hosted service has a shared per-minute request quota. When it is
// exceeded it answers HTTP 200 with an {error:{code:429}} body ("retry after
// 60 sec"), so that case is detected explicitly: wait out the minute and
// retry. Each chokepoint is independent; one failing keeps its last good data.
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
type ArcGis = { features?: Row[]; error?: { code: number; message: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function query(id: string): Promise<Row[]> {
  const url = `${BASE}?where=portid%3D'${id}'&outFields=date,n_total,capacity&orderByFields=date%20DESC&resultRecordCount=${KEEP}&f=json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const body = (await fetchJson(url)) as ArcGis;
    if (body.error) {
      if (body.error.code === 429 && attempt < 3) {
        console.warn(`redsea: ${id} quota exceeded; waiting 65s (attempt ${attempt + 1})`);
        await sleep(65_000);
        continue;
      }
      throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
    }
    if (!body.features?.length) throw new Error(`no rows for ${id}`);
    return body.features;
  }
  throw new Error(`quota still exceeded for ${id}`);
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<RedSeaFile | null>(OUT, null);
  const failures: string[] = [];
  const chokepoints: Chokepoint[] = [];

  for (const p of POINTS) {
    try {
      const feats = await query(p.id);
      const history: ChokepointDay[] = feats
        .map((f) => {
          const d = f.attributes.date;
          const iso = typeof d === "number" ? new Date(d).toISOString().slice(0, 10) : String(d).slice(0, 10);
          return { date: iso, ships: f.attributes.n_total, capacity: f.attributes.capacity };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      chokepoints.push({ id: p.id, name: p.name, history, baselineShips: median(history.map((h) => h.ships)) });
    } catch (e) {
      failures.push(`${p.name}: ${(e as Error).message}`);
      const last = prev?.chokepoints.find((c) => c.id === p.id);
      if (last) chokepoints.push(last); // keep the last good data for this one
    }
    await sleep(1500); // stay well under the shared quota
  }

  if (!chokepoints.length) {
    recordHealth(SOURCE, 2, { ok: false, error: failures.join("; ") });
    if (!prev) writeJson(OUT, { fetchedAt, source: SOURCE, sourceUrl: SOURCE_URL, chokepoints: [] } satisfies RedSeaFile);
    console.error("redsea failed, keeping last good:", failures.join("; "));
    return;
  }
  // fetchedAt moves only if something fresh was fetched
  const freshCount = POINTS.length - failures.length;
  writeJson(OUT, { fetchedAt: freshCount > 0 ? fetchedAt : (prev?.fetchedAt ?? fetchedAt), source: SOURCE, sourceUrl: SOURCE_URL, chokepoints } satisfies RedSeaFile);
  recordHealth(SOURCE, 2, failures.length ? { ok: false, error: failures.join("; ") } : { ok: true });
  console.log(`redsea: ${chokepoints.map((c) => `${c.name.split(" ")[0]}=${c.history.at(-1)?.ships}`).join(" ")} (${failures.length} failures)`);
}

main();
