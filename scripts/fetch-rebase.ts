// Watches for the World Bank adopting Ethiopia's rebased GDP (new base year
// 2024/25, announced November 2026). Reads GDP in birr and US dollars from the
// World Bank API (keyless) and compares the latest year with the old and new
// 2024/25 figures recorded in data/curated/rebase.json. Nothing here estimates
// a rebased value: it only reports which series the World Bank is serving.
import { join } from "node:path";
import curated from "../data/curated/rebase.json";
import { DATA, WB_TIMEOUT_MS, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "World Bank (rebase check)";
const OUT = join(DATA, "rebase.json");

type WbRow = { indicator: { id: string }; date: string; value: number | null };
type Point = { period: string; value: number };
type Out = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  available: boolean;
  gdpBirr: Point[];
  gdpUsd: Point[];
  check: {
    status: "old_series" | "new_series_visible" | "unclear";
    latestPeriod: string;
    wbLatestBirr: number;
    oldSeriesBirr: number;
    newSeriesBirr: number;
    gapToNewPct: number;
    jumpVsPreviousRunPct: number | null;
    text: string;
  };
};

async function main() {
  const fetchedAt = new Date().toISOString();
  try {
    const url = `https://api.worldbank.org/v2/country/ETH/indicator/NY.GDP.MKTP.CN;NY.GDP.MKTP.CD?source=2&format=json&per_page=200&date=2015:${new Date().getUTCFullYear()}`;
    const body = (await fetchJson(url, 3, WB_TIMEOUT_MS)) as [unknown, WbRow[] | null];
    const rows = body?.[1];
    if (!Array.isArray(rows)) throw new Error("unexpected World Bank response");
    const pick = (id: string): Point[] =>
      rows
        .filter((r) => r.indicator.id === id && r.value != null)
        .map((r) => ({ period: r.date, value: r.value as number }))
        .sort((a, b) => a.period.localeCompare(b.period));
    const gdpBirr = pick("NY.GDP.MKTP.CN");
    const gdpUsd = pick("NY.GDP.MKTP.CD");
    const latest = gdpBirr.at(-1);
    if (!latest) throw new Error("no GDP in birr returned");

    const prev = readJson<Out | null>(OUT, null);
    const prevSame = prev?.gdpBirr.find((p) => p.period === latest.period)?.value;
    const jump = prevSame ? ((latest.value - prevSame) / prevSame) * 100 : null;

    const oldB = curated.gdpBirr.old;
    const newB = curated.gdpBirr.new;
    const nearOld = Math.abs(latest.value - oldB) / oldB < 0.03;
    const nearNew = latest.value >= newB * 0.9;
    const status: Out["check"]["status"] = nearNew || (jump != null && jump > 20) ? "new_series_visible" : nearOld ? "old_series" : "unclear";
    const trn = (v: number) => `${(v / 1e12).toFixed(2)} trillion birr`;
    const text =
      status === "new_series_visible"
        ? `The World Bank's ${latest.period} GDP is now ${trn(latest.value)}, close to the rebased ${trn(newB)}. The new series appears to be in the database; check the figures before comparing across years.`
        : status === "old_series"
          ? `The World Bank's ${latest.period} GDP is ${trn(latest.value)}, matching the OLD 2024/25 figure of ${trn(oldB)}, not the rebased ${trn(newB)}. This dashboard is still on the old series.`
          : `The World Bank's ${latest.period} GDP is ${trn(latest.value)}, which matches neither the old (${trn(oldB)}) nor the rebased (${trn(newB)}) 2024/25 figure. Treat GDP-based figures with caution.`;

    const out: Out = {
      source: "World Bank WDI (NY.GDP.MKTP.CN, NY.GDP.MKTP.CD)",
      sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CN?locations=ET",
      fetchedAt,
      available: true,
      gdpBirr,
      gdpUsd,
      check: {
        status,
        latestPeriod: latest.period,
        wbLatestBirr: latest.value,
        oldSeriesBirr: oldB,
        newSeriesBirr: newB,
        gapToNewPct: Number((((newB - latest.value) / latest.value) * 100).toFixed(1)),
        jumpVsPreviousRunPct: jump == null ? null : Number(jump.toFixed(1)),
        text,
      },
    };
    writeJson(OUT, out);
    recordHealth(SOURCE, 30, { ok: true });
    console.log(`rebase: ${status} (${text})`);
  } catch (e) {
    recordHealth(SOURCE, 30, { ok: false, error: String((e as Error).message ?? e) });
    console.error("rebase check failed:", (e as Error).message);
  }
}

main();
