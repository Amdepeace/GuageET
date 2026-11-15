// Companies listed on the Ethiopian Securities Exchange (ESX), read from the
// exchange's public "Listed Companies" page: name, symbol, sector, listing and
// incorporation dates. The page has no price data, so none is shown. ESX's
// robots.txt allows this; it is one request per run. If the table layout
// changes the parse fails loudly and the last good list is kept.
import { join } from "node:path";
import type { EsxCompany, EsxFile } from "../lib/schema";
import { DATA, fetchText, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "Ethiopian Securities Exchange";
const URL_ = "https://esx.et/equity-market/listed-companies/";
const OUT = join(DATA, "esx.json");

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<EsxFile | null>(OUT, null);
  try {
    const html = await fetchText(URL_, 3, 60_000);
    const table = /<table[\s\S]*?<\/table>/.exec(html)?.[0];
    if (!table) throw new Error("no table found (page layout may have changed)");
    const companies: EsxCompany[] = [];
    for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const cells = (row.match(/<td[\s\S]*?<\/td>/g) ?? []).map((c) => c);
      if (cells.length < 5) continue;
      const text = cells.map(clean);
      const href = /href="([^"]+)"/.exec(cells[0])?.[1] ?? URL_;
      const date = /^\d{4}-\d{2}-\d{2}$/;
      if (!date.test(text[3])) continue;
      companies.push({ name: text[0], symbol: text[1], sector: text[2].replace(/Servicess/, "Services"), listed: text[3], incorporated: date.test(text[4]) ? text[4] : "", url: href });
    }
    if (!companies.length) throw new Error("no companies parsed");
    companies.sort((a, b) => b.listed.localeCompare(a.listed));
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: URL_,
      fetchedAt,
      available: true,
      note: "Company list as published on ESX's Listed Companies page. The page carries no prices, so none are shown; for prices use ESX directly.",
      companies,
    } satisfies EsxFile);
    recordHealth(SOURCE, 7, { ok: true });
    console.log(`esx: ${companies.length} listed companies`);
  } catch (e) {
    recordHealth(SOURCE, 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: URL_, fetchedAt, available: false, note: "ESX data has not loaded yet.", companies: [] } satisfies EsxFile);
    console.error("esx failed, keeping last good:", (e as Error).message);
  }
}

main();
