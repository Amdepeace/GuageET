// Ethiopian radio stations from the Radio Browser community directory
// (radio-browser.info, free, no key). We keep only the station's own stream
// address and its metadata; no audio passes through this site, so a visitor's
// browser connects to the station's stream host only when they press play.
// Only https streams are kept (the dashboard is served over https, and browsers
// block http audio there), and only stations the directory's own health check
// found working in the last 14 days. The directory's check is not our check:
// a stream can still fail for an individual listener.
import { join } from "node:path";
import type { RadioFile, RadioStation } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "Radio Browser directory";
const SOURCE_URL = "https://www.radio-browser.info/";
const OUT = join(DATA, "radio.json");
const MIRRORS = ["https://de1.api.radio-browser.info", "https://all.api.radio-browser.info"];
const UA = "open-data-dashboard/1.0";

type Raw = { stationuuid: string; name: string; url_resolved: string; codec: string; bitrate: number; language: string; tags: string; homepage: string; lastcheckok: number; lastchecktime_iso8601?: string; lastchecktime: string; clickcount: number };

async function load(): Promise<Raw[]> {
  let last = "";
  for (const m of MIRRORS) {
    try {
      const res = await fetch(`${m}/json/stations/bycountrycodeexact/ET?hidebroken=true&order=clickcount&reverse=true&limit=200`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Raw[];
    } catch (e) {
      last = `${m}: ${(e as Error).message}`;
    }
  }
  throw new Error(last);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ሀ-፿]+/g, " ").replace(/\b(fm|radio)\b/g, "").replace(/\s+/g, " ").trim();

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<RadioFile | null>(OUT, null);
  try {
    const raw = await load();
    const cutoff = Date.now() - 14 * 86400_000;
    const seen = new Set<string>();
    const stations: RadioStation[] = [];
    for (const r of raw) {
      const t = Date.parse((r.lastchecktime_iso8601 ?? r.lastchecktime).replace(" ", "T") + (r.lastchecktime.includes("Z") || r.lastchecktime_iso8601 ? "" : "Z"));
      if (r.lastcheckok !== 1 || !/^https:\/\//.test(r.url_resolved) || !(t >= cutoff)) continue;
      const name = r.name.trim().replace(/\s+/g, " ");
      const key = norm(name).replace(/\d+(\.\d+)?/g, "").trim() || norm(name);
      if (seen.has(key)) continue; // the directory lists some stations twice
      seen.add(key);
      stations.push({ id: r.stationuuid, name, url: r.url_resolved, codec: r.codec, bitrate: r.bitrate, language: r.language, tags: r.tags, homepage: /^https?:\/\//.test(r.homepage) ? r.homepage : "", lastCheck: new Date(t).toISOString().slice(0, 10) });
    }
    if (!stations.length) throw new Error("no working https stations returned");
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "Station list and stream addresses come from the Radio Browser community directory, which health-checks each stream; a stream can still be down or blocked for you. Audio plays straight from each station's own stream host. This dashboard is not affiliated with any station.",
      stations,
    } satisfies RadioFile);
    recordHealth(SOURCE, 7, { ok: true });
    console.log(`radio: ${stations.length} stations`);
  } catch (e) {
    recordHealth(SOURCE, 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Radio stations have not loaded yet.", stations: [] } satisfies RadioFile);
    console.error("radio failed, keeping last good:", (e as Error).message);
  }
}

main();
