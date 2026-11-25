// El Niño / Southern Oscillation watch. Everything here is NOAA data, fetched as published:
//   - weekly Niño-region sea-surface temperatures and anomalies (NOAA CPC, OISST)
//   - the monthly Oceanic Niño Index, ONI (NOAA CPC, ERSSTv5), and past El Niño episodes computed from it
//   - the Multivariate ENSO Index v2, MEI.v2 (NOAA PSL)
//   - the latest CPC ENSO Diagnostic Discussion (alert status, issue date, synopsis quoted as written)
// Nothing is forecast or estimated here: the outlook is CPC's own words. Each piece is parsed
// independently, so one source changing format keeps the others (and the last good value of the
// failed one) rather than blanking the panel.
import { join } from "node:path";
import { DATA, fetchText, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "NOAA CPC (ENSO)";
const OUT = join(DATA, "enso.json");
const CPC = "https://www.cpc.ncep.noaa.gov";
const WEEKLY_FROM = "2025-01-01";

type Wk = { d: string; n12: [number, number]; n3: [number, number]; n34: [number, number]; n4: [number, number] };
type Oni = { season: string; year: number; total: number; anom: number };
type Episode = { name: string; start: string; peak: number; peakSeason: string; current: boolean; series: { k: number; v: number }[] };
type Mei = { year: number; season: string; value: number };
type Discussion = { issued: string | null; status: string | null; synopsis: string | null; next: string | null; url: string };
export type EnsoOut = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  available: boolean;
  weekly: Wk[];
  oni: Oni[];
  episodes: Episode[];
  mei: Mei[];
  discussion: Discussion;
  errors: string[];
};

const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

function parseWeekly(text: string): Wk[] {
  const num = "(-?\\d+\\.\\d)";
  const re = new RegExp(`^\\s*(\\d{2})([A-Z]{3})(\\d{4})\\s+${num}\\s*${num}\\s+${num}\\s*${num}\\s+${num}\\s*${num}\\s+${num}\\s*${num}`);
  const out: Wk[] = [];
  for (const line of text.split("\n")) {
    const m = re.exec(line);
    if (!m) continue;
    const d = `${m[3]}-${MON[m[2]]}-${m[1]}`;
    if (d < WEEKLY_FROM) continue;
    const v = m.slice(4).map(Number);
    out.push({ d, n12: [v[0], v[1]], n3: [v[2], v[3]], n34: [v[4], v[5]], n4: [v[6], v[7]] });
  }
  return out;
}

function parseOni(text: string): Oni[] {
  const out: Oni[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z]{3})\s+(\d{4})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/.exec(line);
    if (m) out.push({ season: m[1], year: Number(m[2]), total: Number(m[3]), anom: Number(m[4]) });
  }
  return out;
}

/** Episodes = runs of 5 or more consecutive overlapping seasons at or above +0.5 (CPC's definition). */
function episodes(oni: Oni[]): Episode[] {
  const eps: Episode[] = [];
  let i = 0;
  while (i < oni.length) {
    if (oni[i].anom < 0.5) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < oni.length && oni[j + 1].anom >= 0.5) j++;
    const run = oni.slice(i, j + 1);
    const current = j === oni.length - 1;
    // completed episodes need 5 seasons; the running one is shown from its first season so a forming event is visible
    if (run.length >= 5 || current) {
      const peakRow = run.reduce((a, b) => (b.anom > a.anom ? b : a));
      const from = Math.max(0, i - 3);
      const series = oni.slice(from, Math.min(oni.length, i + 22)).map((r, idx) => ({ k: from + idx - i, v: r.anom }));
      eps.push({ name: `${oni[i].season} ${oni[i].year}`, start: `${oni[i].season} ${oni[i].year}`, peak: peakRow.anom, peakSeason: `${peakRow.season} ${peakRow.year}`, current, series });
    }
    i = j + 1;
  }
  return eps;
}

function parseMei(text: string): Mei[] {
  const seasons = ["DJ", "JF", "FM", "MA", "AM", "MJ", "JJ", "JA", "AS", "SO", "ON", "ND"];
  const out: Mei[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*(\d{4})((?:\s+-?\d+\.\d+){12})\s*$/.exec(line);
    if (!m) continue;
    m[2]
      .trim()
      .split(/\s+/)
      .forEach((v, i) => {
        const x = Number(v);
        if (x > -99) out.push({ year: Number(m[1]), season: seasons[i], value: x });
      });
  }
  return out.slice(-18);
}

function parseDiscussion(html: string): Discussion {
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ({ nbsp: " ", deg: "°", amp: "&", ntilde: "ñ", Ntilde: "Ñ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", quot: '"', plusmn: "±" } as Record<string, string>)[name] ?? m)
    .replace(/\s+/g, " ");
  const pick = (re: RegExp) => re.exec(t)?.[1]?.trim() ?? null;
  const synopsis = pick(/Synopsis:\s*(.*?)\s+This discussion is a consolidated effort/);
  return {
    issued: pick(/issued by\s+CLIMATE PREDICTION CENTER\/NCEP\/NWS\s+(\d{1,2} [A-Za-z]+ \d{4})/),
    status: pick(/ENSO Alert System Status:\s*(.*?)\s+Synopsis:/),
    synopsis: synopsis ? synopsis.replace(/\s+\[Fig\. ?[\d\- ,]+\]/g, "").replace(/\s+\[Figs?\.? ?[\d\- ,]+\]/g, "") : null,
    next: pick(/next ENSO Diagnostics? Discussion is scheduled for (\d{1,2} [A-Za-z]+ \d{4})/),
    url: `${CPC}/products/analysis_monitoring/enso_advisory/ensodisc.shtml`,
  };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<EnsoOut | null>(OUT, null);
  const errors: string[] = [];
  const attempt = async <T>(label: string, fn: () => Promise<T>, last: T): Promise<T> => {
    try {
      const v = await fn();
      if (Array.isArray(v) && !v.length) throw new Error("parsed no rows");
      return v;
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
      return last;
    }
  };

  const weekly = await attempt("weekly Niño indices", async () => parseWeekly(await fetchText(`${CPC}/data/indices/wksst9120.for`)), prev?.weekly ?? []);
  const oni = await attempt("ONI", async () => parseOni(await fetchText(`${CPC}/data/indices/oni.ascii.txt`)), prev?.oni ?? []);
  const mei = await attempt("MEI.v2", async () => parseMei(await fetchText("https://psl.noaa.gov/enso/mei/data/meiv2.data")), prev?.mei ?? []);
  const discussion = await attempt(
    "CPC discussion",
    async () => {
      const d = parseDiscussion(await fetchText(`${CPC}/products/analysis_monitoring/enso_advisory/ensodisc.shtml`));
      if (!d.status || !d.synopsis || !d.issued) throw new Error("discussion page format changed (status, issue date or synopsis not found)");
      return d;
    },
    prev?.discussion ?? { issued: null, status: null, synopsis: null, next: null, url: `${CPC}/products/analysis_monitoring/enso_advisory/ensodisc.shtml` },
  );

  const out: EnsoOut = {
    source: SOURCE,
    sourceUrl: `${CPC}/products/analysis_monitoring/enso_advisory/ensodisc.shtml`,
    fetchedAt,
    available: weekly.length > 0 && oni.length > 0,
    weekly,
    oni: oni.slice(-30),
    episodes: episodes(oni).filter((e) => e.peak >= 1.5 || e.current), // strong events and the running one are what the panel compares
    mei,
    discussion,
    errors,
  };
  writeJson(OUT, out);
  const latest = weekly.at(-1);
  console.log(`enso: weekly ${weekly.length} (latest ${latest?.d} Niño-3.4 ${latest?.n34[1]}), ONI ${oni.at(-1)?.season} ${oni.at(-1)?.year} ${oni.at(-1)?.anom}, episodes ${out.episodes.length}, discussion ${discussion.issued} "${discussion.status}", ${errors.length} errors`);
  recordHealth(SOURCE, 7, errors.length === 4 ? { ok: false, error: errors.join("; ") } : { ok: true, ...(errors.length ? { error: `partial: ${errors.join("; ")}` } : {}) });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
