// GDELT 2.0 Doc API: keyless English headlines about Ethiopia's economy and
// infrastructure. Rate-limited (HTTP 429), so we fetch once per run with backoff
// and keep the last good list on failure.
import { join } from "node:path";
import type { NewsFile, NewsItem } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "GDELT";
const OUT = join(DATA, "news.json");
const QUERY =
  '(Ethiopia (economy OR inflation OR birr OR trade OR railway OR "Grand Ethiopian Renaissance Dam" OR port OR corridor OR electricity)) sourcelang:english';
const API_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(QUERY)}&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan=14d`;

type GdeltArt = { url: string; title: string; domain: string; seendate: string };

function parseSeen(s: string): string {
  // GDELT seendate: YYYYMMDDTHHMMSSZ
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<NewsFile | null>(OUT, null);
  let lastErr = "";
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(API_URL);
      if (res.status === 429) throw new Error("429 rate limited");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { articles?: GdeltArt[] };
      const seen = new Set<string>();
      const items: NewsItem[] = (body.articles ?? [])
        .filter((a) => a.title && a.url)
        .map((a) => ({ title: a.title.trim(), url: a.url, domain: a.domain || new URL(a.url).hostname, seenAt: parseSeen(a.seendate) }))
        .filter((a) => (seen.has(a.title) ? false : (seen.add(a.title), true)))
        .slice(0, 30);
      writeJson(OUT, { fetchedAt, items } satisfies NewsFile);
      recordHealth(SOURCE, 1, { ok: true });
      console.log(`news: ${items.length} headlines`);
      return;
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
    }
  }
  recordHealth(SOURCE, 1, { ok: false, error: lastErr });
  if (!prev) writeJson(OUT, { fetchedAt, items: [] } satisfies NewsFile);
  console.error("news failed, keeping last good:", lastErr);
}

main();
