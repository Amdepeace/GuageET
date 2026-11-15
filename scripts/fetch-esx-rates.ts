// Weekly interbank money-market statistics published by the Ethiopian
// Securities Exchange (fixed-income market data page): for overnight and 7-day
// loans, the volume traded, number of trades, weighted-average interest rate
// and the weekly change. One public page, one request per run; if the table
// layout changes the parse fails loudly and the last good data is kept.
import { join } from "node:path";
import type { InterbankFile, InterbankWeek } from "../lib/schema";
import { DATA, fetchText, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "ESX interbank money market";
const URL_ = "https://esx.et/fixed-income-market/data/";
const OUT = join(DATA, "esx-rates.json");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** "Jun 30 – Jul 4, 2025" or "19 October - 23 October, 2026" -> ISO start/end dates */
function parseWeek(s: string): { start: string; end: string } | null {
  const m = /^(.+?)\s*[–-]\s*(.+?),?\s+(\d{4})$/.exec(s.replace(/,/g, ", ").replace(/\s+/g, " ").replace(/, (\d{4})$/, " $1").trim());
  if (!m) return null;
  const part = (p: string) => {
    const t = p.replace(/,/g, "").trim().split(" ");
    const day = Number(t.find((x) => /^\d{1,2}$/.test(x)));
    const mon = MONTHS.indexOf((t.find((x) => /^[A-Za-z]+$/.test(x)) ?? "").slice(0, 3).toLowerCase());
    return day && mon >= 0 ? { day, mon } : null;
  };
  const a = part(m[1]);
  const b = part(m[2]);
  const year = Number(m[3]);
  if (!a || !b) return null;
  const startYear = a.mon > b.mon ? year - 1 : year;
  const iso = (y: number, mo: number, d: number) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start: iso(startYear, a.mon, a.day), end: iso(year, b.mon, b.day) };
}

const num = (s: string) => {
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && /\d/.test(s) ? n : NaN;
};

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<InterbankFile | null>(OUT, null);
  try {
    const html = await fetchText(URL_, 3, 90_000);
    const table = /<table[\s\S]*?<\/table>/.exec(html)?.[0];
    if (!table) throw new Error("no table found (page layout may have changed)");
    const weeks: InterbankWeek[] = [];
    for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const c = (row.match(/<td[\s\S]*?<\/td>/g) ?? []).map(clean);
      if (c.length < 6) continue;
      const w = parseWeek(c[0]);
      const mat = /overnight/i.test(c[1]) ? "overnight" : /7\s*day/i.test(c[1]) ? "7d" : null;
      const vol = num(c[2]);
      const trades = num(c[3]);
      const rate = num(c[4]);
      const chg = num(c[5]);
      if (!w || !mat || !Number.isFinite(vol) || !Number.isFinite(trades) || !Number.isFinite(rate)) continue;
      weeks.push({ ...w, maturity: mat, volumeEtb: vol, trades, rate, changePts: Number.isFinite(chg) ? chg : null });
    }
    if (weeks.length < 20) throw new Error(`only ${weeks.length} rows parsed (page layout may have changed)`);
    weeks.sort((a, b) => a.end.localeCompare(b.end) || a.maturity.localeCompare(b.maturity));
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: URL_,
      fetchedAt,
      available: true,
      note: "Weekly statistics for interbank loans traded on ESX, as published by ESX. The rate is the weighted-average interest rate; change is the weekly move in percentage points as published. A thin week (few trades) can move a lot.",
      weeks,
    } satisfies InterbankFile);
    recordHealth(SOURCE, 10, { ok: true });
    console.log(`esx-rates: ${weeks.length} rows, latest week ending ${weeks.at(-1)!.end}`);
  } catch (e) {
    recordHealth(SOURCE, 10, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: URL_, fetchedAt, available: false, note: "Interbank rates have not loaded yet.", weeks: [] } satisfies InterbankFile);
    console.error("esx-rates failed, keeping last good:", (e as Error).message);
  }
}

main();
