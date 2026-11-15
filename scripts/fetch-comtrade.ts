// UN Comtrade (free tier) — Ethiopia's trade: top partners, the trade balance,
// bilateral totals for every partner (keyed by M49 so the world map can look
// them up), and the top traded commodity groups.
// Keyless by default: UN Comtrade's public "preview" endpoint needs no key or
// account (it caps a response at 500 rows, plenty for annual totals by partner
// and HS-2 groups). If COMTRADE_PRIMARY_KEY (a free subscription key, stored as
// a GitHub Secret) is set, the full data API is used instead.
// Docs: https://comtradeplus.un.org/
import { join } from "node:path";
import type { BilateralTrade, TradeCommodity, TradeFile, TradePartner } from "../lib/schema";
import { DATA, recordHealth, writeJson, readJson } from "./lib/store";

const SOURCE = "UN Comtrade";
const SOURCE_URL = "https://comtradeplus.un.org/";
const OUT = join(DATA, "trade.json");
const ETH = 231;
const KEY = process.env.COMTRADE_PRIMARY_KEY || "";

type Row = { flowCode: string; partnerCode: number; partnerDesc: string; cmdCode: string; cmdDesc: string; primaryValue: number };

async function query(params: Record<string, string>): Promise<Row[]> {
  const qs = new URLSearchParams({ reporterCode: String(ETH), motCode: "0", customsCode: "C00", includeDesc: "true", ...params });
  const url = KEY ? `https://comtradeapi.un.org/data/v1/get/C/A/HS?${qs}` : `https://comtradeapi.un.org/public/v1/preview/C/A/HS?${qs}`;
  const headers: Record<string, string> = KEY ? { "Ocp-Apim-Subscription-Key": KEY } : {};
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 4000 * attempt));
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (res.status === 429 || res.status >= 500) {
        last = `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${params.flowCode} ${params.period}`);
      return ((await res.json()) as { data?: Row[] }).data ?? [];
    } catch (e) {
      last = String((e as Error).message ?? e);
      if (/^HTTP 4/.test(last)) throw e;
    }
  }
  throw new Error(`${last} for ${params.flowCode} ${params.period}`);
}

const awaitingKey = (fetchedAt: string): TradeFile => ({
  fetchedAt,
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  period: "",
  available: false,
  note: "Trade data has not been fetched yet; the next scheduled update will fill it.",
  exportsByPartner: [],
  importsByPartner: [],
  balance: [],
  bilateral: {},
  topExportCommodities: [],
  topImportCommodities: [],
});

function topPartners(rows: Row[]): TradePartner[] {
  return rows
    .filter((r) => r.partnerCode !== 0 && r.primaryValue > 0)
    .map((r) => ({ partner: r.partnerDesc, partnerCode: String(r.partnerCode), value: r.primaryValue }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function topCommodities(rows: Row[]): TradeCommodity[] {
  return rows
    .filter((r) => r.cmdCode !== "TOTAL" && r.primaryValue > 0)
    .map((r) => ({ code: r.cmdCode, label: r.cmdDesc, value: r.primaryValue }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<TradeFile | null>(OUT, null);

  try {
    const thisYear = new Date().getUTCFullYear();
    let period = 0;
    let exp: Row[] = [];
    let imp: Row[] = [];
    for (let y = thisYear - 1; y >= thisYear - 4 && !period; y--) {
      const [x, m] = await Promise.all([
        query({ period: String(y), flowCode: "X", partnerCode: "", cmdCode: "TOTAL" }),
        query({ period: String(y), flowCode: "M", partnerCode: "", cmdCode: "TOTAL" }),
      ]);
      if (x.length || m.length) {
        period = y;
        exp = x;
        imp = m;
      }
    }
    if (!period) throw new Error("no trade data in the last 4 years");

    // bilateral totals keyed by partner M49
    const bilateral: Record<string, BilateralTrade> = {};
    for (const r of exp) if (r.partnerCode !== 0) (bilateral[r.partnerCode] ??= { partner: r.partnerDesc, exports: 0, imports: 0 }).exports = r.primaryValue;
    for (const r of imp) if (r.partnerCode !== 0) (bilateral[r.partnerCode] ??= { partner: r.partnerDesc, exports: 0, imports: 0 }).imports = r.primaryValue;

    // top commodity groups (HS 2-digit) with the World
    const [expCmd, impCmd] = await Promise.all([
      query({ period: String(period), flowCode: "X", partnerCode: "0", cmdCode: "AG2" }),
      query({ period: String(period), flowCode: "M", partnerCode: "0", cmdCode: "AG2" }),
    ]);

    // balance trend
    const balance: TradeFile["balance"] = [];
    for (let y = period - 4; y <= period; y++) {
      try {
        const [x, m] = await Promise.all([
          query({ period: String(y), flowCode: "X", partnerCode: "0", cmdCode: "TOTAL" }),
          query({ period: String(y), flowCode: "M", partnerCode: "0", cmdCode: "TOTAL" }),
        ]);
        const xw = x[0]?.primaryValue ?? 0;
        const mw = m[0]?.primaryValue ?? 0;
        if (xw || mw) balance.push({ period: String(y), exports: xw, imports: mw });
      } catch {
        /* skip a missing year */
      }
    }

    writeJson(OUT, {
      fetchedAt,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      period: String(period),
      available: true,
      note: `Latest year with data: ${period}. Trade data lags by months to years. Reporter-declared values (${KEY ? "UN Comtrade data API" : "UN Comtrade public preview, no key"}); partners can mirror-report differently.`,
      exportsByPartner: topPartners(exp),
      importsByPartner: topPartners(imp),
      balance,
      bilateral,
      topExportCommodities: topCommodities(expCmd),
      topImportCommodities: topCommodities(impCmd),
    } satisfies TradeFile);
    recordHealth(SOURCE, 40, { ok: true });
    console.log(`trade: ${period}, ${Object.keys(bilateral).length} partners, ${topCommodities(expCmd).length} export commodities`);
  } catch (e) {
    recordHealth(SOURCE, 40, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, awaitingKey(fetchedAt));
    console.error("trade failed, keeping last good:", (e as Error).message);
  }
}

main();
