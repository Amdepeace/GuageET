// World Bank Pink Sheet (Commodity Markets), monthly prices. Keyless.
// Parses the published .xlsx, matching columns by header name so a layout
// change does not silently grab the wrong column. Last-good-value on failure.
import { join } from "node:path";
import * as XLSX from "xlsx";
import commoditiesCfg from "../config/commodities.json";
import type { Observation, SimpleSeries } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson, type EventEntry, appendEvents } from "./lib/store";

const SOURCE = "World Bank Pink Sheet";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KEEP = 120; // ~10 years of monthly points
const OUT = join(DATA, "commodities.json");

type Cfg = typeof commoditiesCfg;

function periodLabel(code: string) {
  const m = /^(\d{4})M(\d{2})$/.exec(code);
  if (!m) return code;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
function asOf(code: string) {
  const m = /^(\d{4})M(\d{2})$/.exec(code)!;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); // last day of month
}

async function main() {
  const cfg = commoditiesCfg as Cfg;
  const fetchedAt = new Date().toISOString();
  const existing = readJson<SimpleSeries[]>(OUT, []);
  const events: EventEntry[] = [];
  try {
    const res = await fetch(cfg.sourceFile);
    if (!res.ok) throw new Error(`HTTP ${res.status} for Pink Sheet file`);
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Monthly Prices"], { header: 1, defval: null });
    const names = rows[4] as (string | null)[];
    const dataRows = rows.slice(6).filter((r) => typeof r[0] === "string" && /^\d{4}M\d{2}$/.test(r[0] as string));

    const out: SimpleSeries[] = cfg.items.map((item) => {
      const col = names.findIndex((n) => n === item.column);
      if (col < 0) throw new Error(`column not found: ${item.column}`);
      const history: Observation[] = [];
      for (const r of dataRows) {
        const code = r[0] as string;
        const v = r[col];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        history.push({
          value: Number(v.toFixed(3)),
          unit: item.unit,
          asOf: asOf(code),
          period: periodLabel(code),
          source: SOURCE,
          sourceUrl: cfg.landingPage,
          fetchedAt,
        });
      }
      const trimmed = history.slice(-KEEP);
      const prev = existing.find((e) => e.id === item.id)?.history.at(-1);
      const last = trimmed.at(-1);
      if (last && (!prev || prev.period !== last.period)) {
        events.push({ at: fetchedAt, kind: "new_period", indicator: item.id, period: last.period, value: last.value, unit: last.unit, source: SOURCE, message: `${item.label}: ${last.period} price` });
      }
      return { id: item.id, label: item.label, callsign: item.callsign, unit: item.unit, format: item.format as SimpleSeries["format"], source: SOURCE, sourceUrl: cfg.landingPage, history: trimmed };
    });

    writeJson(OUT, out);
    appendEvents(events);
    recordHealth(SOURCE, 35, { ok: true });
    console.log(`commodities: ${out.map((o) => `${o.callsign}=${o.history.at(-1)?.value}`).join(" ")}`);
  } catch (e) {
    recordHealth(SOURCE, 35, { ok: false, error: String((e as Error).message ?? e) });
    if (!existing.length) writeJson(OUT, []);
    console.error("commodities failed, keeping last good:", (e as Error).message);
  }
}

main();
