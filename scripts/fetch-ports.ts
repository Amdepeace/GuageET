// Port activity near Ethiopia's trade routes from IMF PortWatch (open ArcGIS
// services): daily port calls by vessel type and PortWatch's estimated import
// and export tonnage, derived by PortWatch from satellite AIS vessel tracking.
// This is near-live, not live: PortWatch publishes with a lag of several days,
// so every figure carries its as-of date. Ethiopia is landlocked, so the ports
// shown are the ones its trade depends on or competes with. The service has a
// shared per-minute quota that answers HTTP 200 with an {error:{code:429}} body;
// that is detected and waited out, as in fetch-redsea.ts.
import { join } from "node:path";
import type { PortDay, PortSummary, PortsFile } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "IMF PortWatch (ports)";
const SOURCE_URL = "https://portwatch.imf.org/";
const BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";
const OUT = join(DATA, "ports.json");
const PORT_IDS = ["port294", "port146", "port977", "port757", "port631", "port751", "port278", "port9"]; // Djibouti, Berbera, Port Sudan, Mombasa, Lamu, Massawa, Dar es Salaam, Aden
const CHOKE_IDS = ["chokepoint4", "chokepoint1"];
const DAYS = 90;

type Resp<T> = { features?: { attributes: T }[]; error?: { code: number; message: string } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function q<T>(service: string, params: Record<string, string>): Promise<T[]> {
  const url = `${BASE}/${service}/FeatureServer/0/query?${new URLSearchParams({ f: "json", ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const body = (await fetchJson(url)) as Resp<T>;
    if (body.error) {
      if (body.error.code === 429 && attempt < 3) {
        console.warn(`ports: ${service} quota exceeded; waiting 65s`);
        await sleep(65_000);
        continue;
      }
      throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
    }
    return (body.features ?? []).map((f) => f.attributes);
  }
  throw new Error(`quota still exceeded for ${service}`);
}

type Meta = { portid: string; portname: string; country: string; ISO3: string; lat: number; lon: number };
type Day = { date: number | string; portid: string; portcalls: number; portcalls_container: number; portcalls_tanker: number; portcalls_dry_bulk: number; portcalls_general_cargo: number; portcalls_roro: number; import: number; export: number };

const iso = (v: number | string) => (typeof v === "number" ? new Date(v) : new Date(v)).toISOString().slice(0, 10);
const inList = (ids: string[]) => `portid IN (${ids.map((i) => `'${i}'`).join(",")})`;

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<PortsFile | null>(OUT, null);
  try {
    const meta = await q<Meta>("PortWatch_ports_database", { where: inList(PORT_IDS), outFields: "portid,portname,country,ISO3,lat,lon" });
    await sleep(2000);
    const days = await q<Day>("Daily_Ports_Data", { where: inList(PORT_IDS), outFields: "date,portid,portcalls,portcalls_container,portcalls_tanker,portcalls_dry_bulk,portcalls_general_cargo,portcalls_roro,import,export", orderByFields: "date DESC", resultRecordCount: String(PORT_IDS.length * DAYS) });
    await sleep(2000);
    const chokes = await q<Meta>("PortWatch_chokepoints_database", { where: inList(CHOKE_IDS), outFields: "portid,portname,country,ISO3,lat,lon" });
    if (!meta.length || !days.length) throw new Error("no port rows returned");

    const ports: PortSummary[] = [];
    for (const m of meta) {
      const rows = days.filter((d) => d.portid === m.portid).sort((a, b) => iso(a.date).localeCompare(iso(b.date)));
      if (!rows.length) continue;
      const hist: PortDay[] = rows.map((r) => ({ d: iso(r.date), calls: r.portcalls ?? 0, imp: Math.round(r.import ?? 0), exp: Math.round(r.export ?? 0) }));
      const last30 = rows.slice(-30);
      const prior30 = rows.slice(-60, -30);
      const sum = (a: Day[], k: keyof Day) => a.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      ports.push({
        id: m.portid,
        name: m.portname,
        iso3: m.ISO3,
        country: m.country,
        lat: m.lat,
        lon: m.lon,
        asOf: hist.at(-1)!.d,
        calls30: sum(last30, "portcalls"),
        calls30Prior: prior30.length >= 25 ? sum(prior30, "portcalls") : 0,
        imp30: Math.round(sum(last30, "import")),
        exp30: Math.round(sum(last30, "export")),
        byType30: { container: sum(last30, "portcalls_container"), tanker: sum(last30, "portcalls_tanker"), dryBulk: sum(last30, "portcalls_dry_bulk"), generalCargo: sum(last30, "portcalls_general_cargo"), roro: sum(last30, "portcalls_roro") },
        history: hist.slice(-60),
      });
    }
    if (!ports.length) throw new Error("no ports summarised");
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "Daily port calls and estimated import/export tonnage from IMF PortWatch, derived from satellite vessel-tracking (AIS) data. Near-live, not live: PortWatch publishes with a lag of several days. Tonnage is PortWatch's estimate, not customs data, and a port with zero calls may simply have poor AIS coverage.",
      ports: ports.sort((a, b) => b.calls30 - a.calls30),
      chokepoints: chokes.map((c) => ({ id: c.portid, name: c.portname, lat: c.lat, lon: c.lon })),
    } satisfies PortsFile);
    recordHealth(SOURCE, 3, { ok: true });
    console.log(`ports: ${ports.length} ports, latest ${ports.map((p) => `${p.name} ${p.asOf}`).slice(0, 2).join(", ")}`);
  } catch (e) {
    recordHealth(SOURCE, 3, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Port data has not loaded yet.", ports: [], chokepoints: [] } satisfies PortsFile);
    console.error("ports failed, keeping last good:", (e as Error).message);
  }
}

main();
