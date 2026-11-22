"use client";
import type { CountryFile, IndicatorConfig, RebaseCurated, RebaseLive } from "@/lib/schema";
import { formatValue } from "@/lib/format";

const trn = (v: number) => `${(v / 1e12).toFixed(2)} trillion birr`;
const bn = (v: number) => `$${(v / 1e9).toFixed(1)}B`;

// What the rebasing does to each directly affected indicator. Direction only: no rebased
// value is estimated, because the sources read do not publish restated series.
const EFFECT: Record<string, string> = {
  gdp_growth: "Growth rates will be restated on the new base. The size of that restatement is not in the sources read here.",
  gdp_pc: "The level rises with GDP, and it also moves with the exchange rate. Not comparable across the break.",
  exports_gdp: "A ratio to GDP. With a higher GDP and an unchanged numerator it falls.",
  current_acct: "A ratio to GDP. With a higher GDP and an unchanged numerator the balance looks smaller.",
  agri_share: "A share of GDP. New activities counted in the accounts (such as digital finance) shift the sector shares.",
  govt_rev: "A ratio to GDP. With a higher GDP and an unchanged numerator it falls.",
};

const MAYBE: { title: string; where: string; note: string }[] = [
  { title: "Debt ratios", where: "Debt & aid panel", note: "World Bank debt ratios use gross national income (GNI), which is built from the same national accounts. Officials quote debt to GDP at about 27.4% on the new base; the debt itself has not changed." },
  { title: "Country comparison", where: "Relations drawer and map", note: "GDP and GDP per capita for Ethiopia come from the old series, while other countries keep their own base years. Gaps in rank may change when the new series arrives." },
  { title: "Status light and alerts", where: "ECON desk", note: "The ECON light reads GDP growth against fixed thresholds (amber below 4%, red below 0%). A restated growth rate could move it." },
  { title: "Stress matrix", where: "Risk section", note: "Ranks each indicator's latest year against its own history. When the series is restated, a break can read as a shock. Use the break marker, not the rank, until history is restated." },
  { title: "Explorer and changes feed", where: "Explorer, What-changed feed", note: "A restatement of past years will appear as a 'revision' in the feed, and lines in the Explorer will jump at the break." },
];

export function RebaseTab({
  curated,
  live,
  indicators,
  eth,
  onOpenVital,
  onGo,
}: {
  curated: RebaseCurated;
  live: RebaseLive;
  indicators: IndicatorConfig[];
  eth: CountryFile;
  onOpenVital: (id: string) => void;
  onGo: (section: string) => void;
}) {
  const direct = indicators.filter((i) => i.rebase === "direct");
  const unaffected = indicators.filter((i) => !i.rebase);
  const c = live.check;
  const tone = c.status === "old_series" ? "var(--warn)" : c.status === "new_series_visible" ? "var(--ok)" : "var(--warn)";
  const badge = c.status === "old_series" ? "OLD SERIES" : c.status === "new_series_visible" ? "NEW SERIES DETECTED" : "UNCLEAR";

  // GDP in US dollars from the World Bank, for the comparison chart
  const usd = live.gdpUsd.filter((p) => Number(p.period) >= 2018);
  const maxUsd = Math.max(curated.gdpUsdNew, ...usd.map((p) => p.value));

  return (
    <div className="flex flex-col gap-2" id="rebase-top">
      <section className="panel" aria-label="GDP rebasing summary">
        <div className="panel-title flex-wrap">
          <span>REBASE · Ethiopia&apos;s national accounts, November 2026</span>
          <span className="grow" />
          <span className="stale-tag" style={{ color: tone, borderColor: tone }}>{badge}</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <p className="text-[13px] leading-snug">
            In early November 2026 Ethiopia presented <b>rebased national accounts</b>: the base year for GDP moved from <b>{curated.oldBase}</b> to <b>{curated.newBase}</b>, and the measured size of the 2024/25 economy rose by about <b>{curated.revisionPct}%</b>. This tab shows what that means for every figure on this dashboard.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="panel p-3">
              <div className="label">Base year</div>
              <div className="mono text-[20px] font-semibold">{curated.oldBase} → {curated.newBase}</div>
            </div>
            <div className="panel p-3">
              <div className="label">GDP {curated.gdpBirr.period}</div>
              <div className="mono text-[15px] font-semibold leading-snug">{trn(curated.gdpBirr.old)}<br />→ {trn(curated.gdpBirr.new)}</div>
              <div className="text-[11px] muted">+{curated.revisionPct}%</div>
            </div>
            <div className="panel p-3">
              <div className="label">GDP in US dollars</div>
              <div className="mono text-[20px] font-semibold">{bn(curated.gdpUsdNew)}</div>
              <div className="text-[11px] muted">new series, reported. Dashboard shows {live.gdpUsd.at(-1) ? bn(live.gdpUsd.at(-1)!.value) : "n/a"} ({live.gdpUsd.at(-1)?.period}).</div>
            </div>
            <div className="panel p-3">
              <div className="label">Debt to GDP (officials)</div>
              <div className="mono text-[20px] font-semibold">{curated.debtToGdpNew}%</div>
              <div className="text-[11px] muted">on the new base; the debt is unchanged</div>
            </div>
          </div>
          <div className="text-[11px] muted">{curated.status} Last checked {curated.lastVerified}.</div>
        </div>
      </section>

      <section className="panel" aria-label="Which series the dashboard is reading">
        <div className="panel-title flex-wrap">
          <span>WHICH SERIES THIS DASHBOARD IS READING</span>
          <span className="grow" />
          <span className="mono muted text-[10.5px]">checked {live.fetchedAt.slice(0, 10)}</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <div className="text-[13px] leading-snug" style={{ color: tone }}>{c.text}</div>
          <div className="grid gap-1.5" role="img" aria-label="GDP in US dollars, World Bank series by year, next to the rebased 2024/25 figure">
            {usd.map((p) => (
              <div key={p.period} className="flex items-center gap-2 text-[12px]">
                <span className="mono w-10 muted">{p.period}</span>
                <div className="grow h-[18px] rounded-sm" style={{ background: "var(--panel-2)" }}>
                  <div className="h-full rounded-sm" style={{ width: `${(p.value / maxUsd) * 100}%`, background: "var(--accent)" }} />
                </div>
                <span className="mono w-16 text-right">{bn(p.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[12px]">
              <span className="mono w-10 muted" title="fiscal year 2024/25">24/25</span>
              <div className="grow h-[18px] rounded-sm" style={{ background: "var(--panel-2)" }}>
                <div className="h-full rounded-sm" style={{ width: `${(curated.gdpUsdNew / maxUsd) * 100}%`, background: "repeating-linear-gradient(45deg, var(--warn), var(--warn) 6px, transparent 6px, transparent 11px)", border: "1px solid var(--warn)" }} />
              </div>
              <span className="mono w-16 text-right">{bn(curated.gdpUsdNew)}</span>
            </div>
          </div>
          <div className="text-[11px] muted">Solid bars: World Bank GDP (current US$), old series. Hatched bar: the rebased 2024/25 figure as reported, shown for comparison only; it is a different series, not a new data point on the same line. The World Bank labels fiscal year 2024/25 as 2025. Source: <a href={live.sourceUrl} target="_blank" rel="noreferrer">World Bank WDI ↗</a>.</div>
        </div>
      </section>

      <section className="panel" aria-label="Indicators directly affected">
        <div className="panel-title flex-wrap">
          <span>DIRECTLY AFFECTED · GDP IS THE MEASURE OR THE DENOMINATOR ({direct.length})</span>
        </div>
        <div className="p-3 grid gap-2 md:grid-cols-2">
          {direct.map((ind) => {
            const last = eth.series[ind.id]?.history.at(-1);
            return (
              <button key={ind.id} type="button" onClick={() => onOpenVital(ind.id)} className="panel p-3 text-left cursor-pointer hover:bg-[var(--panel-2)]" aria-label={`${ind.label}: open history and source`}>
                <div className="flex items-baseline gap-2">
                  <span className="label">{ind.label}</span>
                  <span className="grow" />
                  <span className="mono text-[10px] muted">{ind.callsign}</span>
                </div>
                <div className="mono text-[22px] font-semibold">{last ? formatValue(last.value, ind.format) : "n/a"}</div>
                <div className="text-[11px] muted">{last ? `${last.period} · ${last.source} · old series` : "no data"}</div>
                <div className="text-[12px] mt-1 leading-snug">{EFFECT[ind.id]}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-label="Places that may be affected">
        <div className="panel-title"><span>MAY BE AFFECTED ELSEWHERE ON THE DASHBOARD</span></div>
        <div className="p-3 grid gap-2 md:grid-cols-2">
          {MAYBE.map((m) => (
            <div key={m.title} className="panel p-3">
              <div className="flex items-baseline gap-2"><span className="label">{m.title}</span><span className="grow" /><span className="text-[10.5px] muted">{m.where}</span></div>
              <div className="text-[12px] mt-1 leading-snug">{m.note}</div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          <button type="button" className="ctl" onClick={() => onGo("sec-risk")}>Go to Risk section</button>
          <button type="button" className="ctl" onClick={() => onGo("sec-economy")}>Go to Debt &amp; aid</button>
          <button type="button" className="ctl" onClick={() => onGo("sec-explore")}>Go to Explorer</button>
        </div>
      </section>

      <section className="panel" aria-label="Indicators not affected">
        <div className="panel-title"><span>NOT AFFECTED ({unaffected.length})</span></div>
        <div className="p-3 text-[12px] leading-snug">
          <p className="mb-2">These are counts, physical measures or dollar flows measured outside the GDP accounts: population, health, education, access to power and internet, reserves, remittances, foreign investment and external debt in dollars. They do not move with the rebasing, though anything you divide by GDP will.</p>
          <div className="flex flex-wrap gap-1.5">
            {unaffected.map((i) => (
              <button key={i.id} type="button" className="ctl" onClick={() => onOpenVital(i.id)}>{i.label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" aria-label="What was reported">
        <div className="panel-title"><span>WHAT WAS REPORTED</span></div>
        <div className="p-3 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2 text-[12px] leading-snug">
            {curated.reported.map((r) => (
              <div key={r.label}><span className="label">{r.label}</span><div>{r.detail}</div></div>
            ))}
          </div>
          <div className="flex flex-col gap-3 text-[12px] leading-snug">
            <div>
              <div className="label">What officials say</div>
              <ul className="list-disc pl-4">{curated.officialsSay.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
            <div>
              <div className="label">Still to come</div>
              <ul className="list-disc pl-4">{curated.planned.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
            <div className="muted">{curated.previous}</div>
          </div>
        </div>
      </section>

      <section className="panel" aria-label="How to read GDP figures now">
        <div className="panel-title"><span>HOW TO READ THE NUMBERS NOW</span></div>
        <ol className="p-3 pl-7 list-decimal text-[12px] leading-snug flex flex-col gap-1">
          <li>Do not compare a figure on the old base with one on the new base. A jump at the break year is measurement, not growth.</li>
          <li>Counts and physical measures are safe. Ratios to GDP and GDP per person are not, until the World Bank and IMF restate them.</li>
          <li>Nothing on this dashboard is an estimate of a rebased value. When the new series arrives it will be shown with its source and a break marker.</li>
          <li>This tab checks the World Bank every day. The badge above changes when the new series is detected.</li>
        </ol>
      </section>

      <section className="panel" aria-label="Sources">
        <div className="panel-title"><span>SOURCES</span></div>
        <ul className="p-3 pl-7 list-disc text-[12px] leading-snug">
          {curated.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>
          ))}
          <li><a href={live.sourceUrl} target="_blank" rel="noreferrer">World Bank WDI: GDP, current LCU and US$ ↗</a></li>
        </ul>
        <div className="px-3 pb-3 text-[11px] muted">Facts come from press coverage; the Ethiopian Statistics Service release itself was not read when this was written. Figures here are as reported and may be corrected.</div>
      </section>
    </div>
  );
}
