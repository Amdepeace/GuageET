// A small statistical outlook for monthly conflict events nationwide. This is
// OUR model output, not a forecast of record, so it is shown only when it beats
// a naive baseline (mean of the last 3 months) in a rolling backtest, and the
// backtest error is published beside it. Method: additive damped-trend
// exponential smoothing (Holt), parameters chosen on older data only, 1-3
// months ahead; the range is the 10th-90th percentile of past backtest errors.
// Limit: the backtest uses today's (revised) counts for every month, whereas in
// real time the latest months are under-reported, so true accuracy is lower.
import { join } from "node:path";
import type { ConflictFile, OutlookFile } from "../lib/schema";
import { DATA, readJson, recordHealth, writeJson } from "./lib/store";

const OUT = join(DATA, "outlook.json");
const H = 3;

function holt(y: number[], a: number, b: number, phi: number, h: number): number[] {
  let l = y[0];
  let t = y.length > 1 ? y[1] - y[0] : 0;
  for (let i = 1; i < y.length; i++) {
    const prevL = l;
    l = a * y[i] + (1 - a) * (prevL + phi * t);
    t = b * (l - prevL) + (1 - b) * phi * t;
  }
  const out: number[] = [];
  let damp = 0;
  for (let k = 1; k <= h; k++) {
    damp += phi ** k;
    out.push(Math.max(0, l + damp * t));
  }
  return out;
}

const baseline = (y: number[], h: number) => Array(h).fill(y.slice(-3).reduce((s, v) => s + v, 0) / 3);
const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
};
const nextMonth = (m: string, k: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function main() {
  const c = readJson<ConflictFile | null>(join(DATA, "conflict.json"), null);
  const prev = readJson<OutlookFile | null>(OUT, null);
  if (!c?.available || c.national.length < 48) {
    recordHealth("Conflict outlook (model)", 35, { ok: false, error: "not enough conflict history" });
    console.log("outlook: not enough history, skipped");
    return;
  }
  const y = c.national.map((n) => n.events);
  const months = c.national.map((n) => n.month);
  const N = y.length;
  const ORIG = 18;

  // choose smoothing parameters using only data before the backtest window
  const train = y.slice(0, N - ORIG);
  let best = { a: 0.3, b: 0.1, phi: 0.9, e: Infinity };
  for (const a of [0.1, 0.2, 0.3, 0.5, 0.7])
    for (const b of [0.01, 0.05, 0.1, 0.2])
      for (const phi of [0.8, 0.9, 0.98]) {
        let e = 0;
        let n = 0;
        for (let t = 24; t < train.length - 1; t++) {
          const f = holt(train.slice(0, t), a, b, phi, 1)[0];
          e += Math.abs(f - train[t]);
          n++;
        }
        if (e / n < best.e) best = { a, b, phi, e: e / n };
      }

  // rolling-origin backtest over the last ORIG origins, horizons 1..H
  const errM: number[][] = Array.from({ length: H }, () => []);
  let maeM = 0;
  let maeB = 0;
  let cnt = 0;
  for (let t = N - ORIG - H + 1; t <= N - H; t++) {
    const hist = y.slice(0, t);
    const fm = holt(hist, best.a, best.b, best.phi, H);
    const fb = baseline(hist, H);
    for (let k = 0; k < H; k++) {
      const actual = y[t + k];
      errM[k].push(actual - fm[k]);
      maeM += Math.abs(actual - fm[k]);
      maeB += Math.abs(actual - fb[k]);
      cnt++;
    }
  }
  maeM /= cnt;
  maeB /= cnt;
  const skill = 1 - maeM / maeB;
  const skillful = skill > 0.05;

  const fc = holt(y, best.a, best.b, best.phi, H);
  const through = months[N - 1];
  const out: OutlookFile = {
    generatedAt: new Date().toISOString(),
    available: true,
    skillful,
    series: "Conflict events per month, Ethiopia (ACLED via HDX HAPI)",
    through,
    method: `Damped-trend exponential smoothing (alpha ${best.a}, beta ${best.b}, phi ${best.phi}) chosen on data before the backtest window; range = 10th to 90th percentile of past errors. Baseline = mean of the last 3 months.`,
    note: skillful
      ? "Statistical extrapolation from past counts, not a forecast of record: it cannot anticipate new events, and the backtest uses revised counts, so real-time accuracy is lower."
      : "The model did not beat a simple 3-month average in the backtest, so no outlook is published. Past counts alone do not predict the next months.",
    backtest: { origins: ORIG, maeModel: Math.round(maeM), maeBaseline: Math.round(maeB), skill: Math.round(skill * 100) / 100 },
    history: months.slice(-36).map((m, i) => ({ month: m, value: y.slice(-36)[i] })),
    forecast: skillful ? fc.map((v, k) => ({ month: nextMonth(through, k + 1), value: Math.round(v), low: Math.max(0, Math.round(v + q(errM[k], 0.1))), high: Math.round(v + q(errM[k], 0.9)) })) : [],
  };
  writeJson(OUT, out);
  recordHealth("Conflict outlook (model)", 35, { ok: true });
  console.log(`outlook: through ${through}, model MAE ${out.backtest.maeModel} vs baseline ${out.backtest.maeBaseline}, skill ${out.backtest.skill}, published=${skillful}`, out.forecast);
  void prev;
}

main();
