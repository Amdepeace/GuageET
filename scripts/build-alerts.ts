// Turn the scheduled data into data/alerts.json for the in-page banner.
// Covers FX daily move, Red Sea transit drop, and large commodity moves.
// Earthquake alerts are raised in the browser from the live USGS feed so the
// banner reflects quakes between scheduled runs.
import { join } from "node:path";
import alertCfg from "../config/alerts.json";
import type { Alert, AlertsFile, RedSeaFile, SimpleSeries } from "../lib/schema";
import { DATA, readJson, writeJson } from "./lib/store";

const cfg = alertCfg as { fxDailyMovePct: number; redSeaDropPct: number; commodityMovePct: number };
const now = new Date().toISOString();
const alerts: Alert[] = [];

// FX daily move
const fx = readJson<SimpleSeries | null>(join(DATA, "fx-daily.json"), null);
if (fx && fx.history.length >= 2) {
  const [prev, last] = fx.history.slice(-2);
  const pct = ((last.value - prev.value) / prev.value) * 100;
  if (Math.abs(pct) >= cfg.fxDailyMovePct) {
    alerts.push({
      id: `fx-${last.asOf}`,
      level: Math.abs(pct) >= cfg.fxDailyMovePct * 2 ? "red" : "amber",
      title: `Birr/USD moved ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
      detail: `${prev.value.toFixed(2)} → ${last.value.toFixed(2)} ETB/USD between ${prev.asOf} and ${last.asOf}.`,
      at: last.asOf,
      source: fx.source,
      sourceUrl: fx.sourceUrl,
    });
  }
}

// Red Sea transit drop vs baseline
const rs = readJson<RedSeaFile | null>(join(DATA, "redsea.json"), null);
const bab = rs?.chokepoints.find((c) => c.id === "chokepoint4");
if (bab && bab.history.length) {
  const last = bab.history.at(-1)!;
  const drop = bab.baselineShips ? ((bab.baselineShips - last.ships) / bab.baselineShips) * 100 : 0;
  if (drop >= cfg.redSeaDropPct) {
    alerts.push({
      id: `redsea-${last.date}`,
      level: drop >= cfg.redSeaDropPct * 1.5 ? "red" : "amber",
      title: `Bab el-Mandeb transit down ${drop.toFixed(0)}%`,
      detail: `${last.ships} ships on ${last.date} vs a ${bab.baselineShips}-ship median over the window.`,
      at: last.date,
      source: rs!.source,
      sourceUrl: rs!.sourceUrl,
    });
  }
}

// Large commodity moves (month on month)
const commodities = readJson<SimpleSeries[]>(join(DATA, "commodities.json"), []);
for (const c of commodities) {
  if (c.history.length < 2) continue;
  const [prev, last] = c.history.slice(-2);
  const pct = ((last.value - prev.value) / prev.value) * 100;
  if (Math.abs(pct) >= cfg.commodityMovePct) {
    alerts.push({
      id: `cmd-${c.id}-${last.period}`,
      level: "amber",
      title: `${c.label} ${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(0)}%`,
      detail: `${prev.value} → ${last.value} ${c.unit} (${prev.period} → ${last.period}).`,
      at: last.asOf,
      source: c.source,
      sourceUrl: c.sourceUrl,
    });
  }
}

writeJson(join(DATA, "alerts.json"), { generatedAt: now, alerts } satisfies AlertsFile);
console.log(`alerts: ${alerts.length} raised`);
