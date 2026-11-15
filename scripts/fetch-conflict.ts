// Conflict events for Ethiopia from HDX HAPI (keyless): monthly counts of events
// and fatalities by admin-2 zone and event type. The underlying data is ACLED's
// (Armed Conflict Location & Event Data Project), published through HDX; HAPI
// only passes it on, so the attribution below names ACLED. Counts are events
// ACLED has coded from media and partner reports, so they under-count places
// with little reporting and the most recent months are often revised upward.
import { join } from "node:path";
import type { ConflictArea, ConflictFile } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "ACLED via HDX HAPI";
const SOURCE_URL = "https://hdx-hapi.readthedocs.io/en/latest/data_usage_guides/coordination_and_context/#conflict-events";
const OUT = join(DATA, "conflict.json");
const KEY = process.env.HDX_APP_IDENTIFIER || Buffer.from("guageet:noreply@example.com").toString("base64");
const BASE = "https://hapi.humdata.org/api/v1/coordination-context/conflict-event";
const WINDOW = 12;

type Row = { admin1_name: string; admin2_code: string; admin2_name: string; event_type: keyof ConflictArea["byType"]; events: number; fatalities: number; reference_period_start: string; reference_period_end: string };

async function page(offset: number): Promise<Row[]> {
  const qs = new URLSearchParams({ location_code: "ETH", admin_level: "2", output_format: "json", limit: "10000", offset: String(offset), app_identifier: KEY });
  let last = "";
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(120_000) });
    if (res.ok) return ((await res.json()) as { data?: Row[] }).data ?? [];
    last = `HTTP ${res.status}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  throw new Error(last);
}

const ym = (s: string) => s.slice(0, 7);
const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<ConflictFile | null>(OUT, null);
  try {
    const rows: Row[] = [];
    for (let off = 0; ; off += 10000) {
      const p = await page(off);
      rows.push(...p);
      if (p.length < 10000) break;
    }
    if (!rows.length) throw new Error("no rows");

    // last complete month: a month whose end date has passed
    const now = Date.now();
    const months = [...new Set(rows.filter((r) => Date.parse(r.reference_period_end) < now).map((r) => ym(r.reference_period_start)))].sort();
    const through = months.at(-1)!;
    const winStart = addMonths(through, -(WINDOW - 1));
    const priorStart = addMonths(through, -(2 * WINDOW - 1));

    const areas: Record<string, ConflictArea> = {};
    const nat = new Map<string, { events: number; fatalities: number }>();
    for (const r of rows) {
      const m = ym(r.reference_period_start);
      if (m > through) continue;
      if (m >= addMonths(through, -59)) {
        const n = nat.get(m) ?? { events: 0, fatalities: 0 };
        n.events += r.events;
        n.fatalities += r.fatalities;
        nat.set(m, n);
      }
      const inWin = m >= winStart;
      const inPrior = m >= priorStart && m < winStart;
      if (!inWin && !inPrior) continue;
      const a = (areas[r.admin2_code] ??= {
        name: r.admin2_name,
        region: r.admin1_name,
        events: 0,
        fatalities: 0,
        eventsPrior: 0,
        fatalitiesPrior: 0,
        byType: { civilian_targeting: 0, demonstration: 0, political_violence: 0 },
      });
      if (inWin) {
        a.events += r.events;
        a.fatalities += r.fatalities;
        if (r.event_type in a.byType) a.byType[r.event_type] += r.events;
      } else {
        a.eventsPrior += r.events;
        a.fatalitiesPrior += r.fatalities;
      }
    }

    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "ACLED data via HDX HAPI. Counts are reported events; areas with little media or partner reporting are under-counted, and recent months are often revised upward. Event counts say nothing about the scale of each event.",
      through,
      windowMonths: WINDOW,
      areas,
      national: [...nat.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    } satisfies ConflictFile);
    recordHealth(SOURCE, 35, { ok: true });
    console.log(`conflict: through ${through}, ${Object.keys(areas).length} zones, ${rows.length} rows`);
  } catch (e) {
    recordHealth(SOURCE, 35, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Conflict data has not loaded yet.", through: "", windowMonths: WINDOW, areas: {}, national: [] } satisfies ConflictFile);
    console.error("conflict failed, keeping last good:", (e as Error).message);
  }
}

main();
