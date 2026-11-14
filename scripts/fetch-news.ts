// Headlines about Ethiopia's economy and infrastructure.
//
// Two keyless sources, merged and de-duplicated:
//  1. GDELT 2.0 Doc API: broad coverage, but it rate-limits shared IPs (HTTP
//     429), including GitHub's runners, so it is tried briefly and treated as
//     optional.
//  2. Public RSS feeds from Ethiopian outlets (Capital, The Reporter, Addis
//     Fortune): the standard syndication use, headline + link only, filtered
//     to economy/infrastructure topics.
// If both fail the last good list stays; nothing is blanked.
import { join } from "node:path";
import type { NewsFile, NewsItem } from "../lib/schema";
import { DATA, fetchText, readJson, recordHealth, writeJson } from "./lib/store";

const OUT = join(DATA, "news.json");
const KEEP = 40;

// ---- GDELT -------------------------------------------------------------
const QUERY =
  '(Ethiopia (economy OR inflation OR birr OR trade OR railway OR "Grand Ethiopian Renaissance Dam" OR port OR corridor OR electricity)) sourcelang:english';
const GDELT_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(QUERY)}&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan=14d`;

type GdeltArt = { url: string; title: string; domain: string; seendate: string };

function parseSeen(s: string): string {
  // GDELT seendate: YYYYMMDDTHHMMSSZ
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

async function fromGdelt(): Promise<NewsItem[]> {
  let lastErr = "";
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(GDELT_URL, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 429) throw new Error("429 rate limited");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { articles?: GdeltArt[] };
      return (body.articles ?? [])
        .filter((a) => a.title && a.url)
        .map((a) => ({ title: a.title.trim(), url: a.url, domain: a.domain || new URL(a.url).hostname, seenAt: parseSeen(a.seendate) }));
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((r) => setTimeout(r, 6000 * (i + 1)));
    }
  }
  throw new Error(lastErr);
}

// ---- RSS ---------------------------------------------------------------
const FEEDS: { name: string; domain: string; url: string }[] = [
  { name: "Capital Ethiopia", domain: "capitalethiopia.com", url: "https://capitalethiopia.com/feed/" },
  { name: "The Reporter", domain: "thereporterethiopia.com", url: "https://www.thereporterethiopia.com/feed/" },
  { name: "Addis Fortune", domain: "addisfortune.news", url: "https://addisfortune.news/feed" },
];

// keep headlines on the economy and infrastructure; drop sport, culture, etc.
const TOPIC =
  /econom|inflation|birr|trade|export|import|bank|financ|fiscal|budget|tax|debt|imf|world bank|invest|industr|manufactur|agricult|coffee|gold|mining|fuel|energy|electric|power|dam|gerd|rail|road|port|corridor|airport|airline|logistic|transport|telecom|safaricom|currency|forex|foreign exchange|reserve|growth|gdp|price|market|business|privati[sz]|bond|loan|credit|grant|aid|water|housing|construction/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/[​ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(item);
  return m ? decode(m[1]) : null;
}

function parseRss(xml: string, domain: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(m[1], "title");
    const link = tag(m[1], "link");
    const date = tag(m[1], "pubDate");
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    const t = date ? Date.parse(date) : NaN;
    out.push({ title, url: link, domain, seenAt: new Date(Number.isFinite(t) ? t : Date.now()).toISOString() });
  }
  return out;
}

async function fromRss(): Promise<{ items: NewsItem[]; failed: string[] }> {
  const items: NewsItem[] = [];
  const failed: string[] = [];
  for (const f of FEEDS) {
    try {
      const xml = await fetchText(f.url);
      const parsed = parseRss(xml, f.domain);
      if (!parsed.length) throw new Error("no items parsed");
      items.push(...parsed.filter((i) => TOPIC.test(i.title)));
    } catch (e) {
      failed.push(`${f.name}: ${(e as Error).message}`);
    }
  }
  return { items, failed };
}

// ---- main --------------------------------------------------------------
async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<NewsFile | null>(OUT, null);
  const all: NewsItem[] = [];

  try {
    const g = await fromGdelt();
    all.push(...g);
    recordHealth("GDELT", 1, { ok: true });
    console.log(`news: GDELT ${g.length}`);
  } catch (e) {
    recordHealth("GDELT", 1, { ok: false, error: (e as Error).message });
    console.warn("news: GDELT failed:", (e as Error).message);
  }

  const rss = await fromRss();
  all.push(...rss.items);
  recordHealth("News RSS", 1, rss.failed.length === FEEDS.length ? { ok: false, error: rss.failed.join("; ") } : { ok: true });
  if (rss.failed.length) console.warn("news: RSS partial:", rss.failed.join("; "));
  console.log(`news: RSS ${rss.items.length}`);

  const seen = new Set<string>();
  const items = all
    .filter((i) => {
      const k = i.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
    .slice(0, KEEP);

  if (!items.length) {
    if (!prev) writeJson(OUT, { fetchedAt, items: [] } satisfies NewsFile);
    console.error("news: nothing fetched, keeping last good");
    return;
  }
  writeJson(OUT, { fetchedAt, items } satisfies NewsFile);
  console.log(`news: ${items.length} headlines saved`);
}

main();
