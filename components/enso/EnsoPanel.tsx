"use client";
// El Niño watch: NOAA's live Pacific readings, how this event compares with past strong ones,
// and the cascade of effects on Ethiopia, each step labelled as an agency expectation, an
// observed pattern, a past analogue or press-relayed reporting. Nothing here is forecast or
// quantified by the dashboard; the outlook is CPC's own wording.
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EnsoFile, EnsoImpactsFile } from "@/lib/schema";
import type { Layer } from "@/lib/urlState";

const STRENGTH = [
  { min: 2.0, label: "very strong", color: "var(--bad)" },
  { min: 1.5, label: "strong", color: "var(--warn)" },
  { min: 1.0, label: "moderate", color: "var(--warn)" },
  { min: 0.5, label: "weak El Niño", color: "var(--accent)" },
];
const strengthOf = (v: number) => STRENGTH.find((s) => v >= s.min);
const sign = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;
const KIND: Record<string, { label: string; color: string }> = {
  outlook: { label: "AGENCY OUTLOOK", color: "var(--accent)" },
  pattern: { label: "OBSERVED PATTERN", color: "var(--cat-power)" },
  analogue: { label: "PAST ANALOGUE", color: "var(--warn)" },
  reported: { label: "PRESS-RELAYED", color: "var(--warn)" },
};
const SEASON_MONTHS: Record<string, string> = { DJF: "Dec–Feb", JFM: "Jan–Mar", FMA: "Feb–Apr", MAM: "Mar–May", AMJ: "Apr–Jun", MJJ: "May–Jul", JJA: "Jun–Aug", JAS: "Jul–Sep", ASO: "Aug–Oct", SON: "Sep–Nov", OND: "Oct–Dec", NDJ: "Nov–Jan" };
const dateLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function EnsoPanel({
  enso,
  impacts,
  onOpenVital,
  onLayer,
  onGo,
}: {
  enso: EnsoFile;
  impacts: EnsoImpactsFile;
  onOpenVital: (id: string) => void;
  onLayer: (l: Layer) => void;
  onGo: (section: string) => void;
}) {
  const latest = enso.weekly.at(-1);
  const oni = enso.oni.at(-1);
  const mei = enso.mei.at(-1);
  const d = enso.discussion;
  const weeklyChart = useMemo(() => enso.weekly.map((w) => ({ d: w.d, n12: w.n12[1], n3: w.n3[1], n34: w.n34[1], n4: w.n4[1] })), [enso.weekly]);
  const strong = enso.episodes.filter((e) => e.current || e.peak >= 2.0);
  const compare = useMemo(() => {
    const ks = new Set<number>();
    for (const e of strong) for (const p of e.series) ks.add(p.k);
    return [...ks].sort((a, b) => a - b).map((k) => {
      const row: Record<string, number> = { k };
      strong.forEach((e, i) => {
        const p = e.series.find((x) => x.k === k);
        if (p) row[`e${i}`] = p.v;
      });
      return row;
    });
  }, [strong]);
  const tick = { fill: "var(--ink-3)", fontSize: 10 };

  if (!enso.available || !latest || !oni) {
    return (
      <div className="panel">
        <div className="panel-title">EL NIÑO WATCH</div>
        <p className="p-3 text-[12px] muted">NOAA ENSO data is not available right now. The last good values are kept on each refresh.</p>
      </div>
    );
  }
  const s34 = strengthOf(latest.n34[1]);
  const tiles: { k: string; label: string; value: string; sub: string; color?: string }[] = [
    { k: "n34", label: "NIÑO-3.4 ANOMALY, WEEKLY", value: `${sign(latest.n34[1])} °C`, sub: `week of ${dateLabel(latest.d)} · sea surface ${latest.n34[0].toFixed(1)} °C`, color: s34?.color },
    { k: "oni", label: "OCEANIC NIÑO INDEX (ONI)", value: sign(oni.anom, 2), sub: `${oni.season} ${oni.year} (${SEASON_MONTHS[oni.season] ?? oni.season}) · ${strengthOf(oni.anom)?.label ?? "neutral"} on NOAA's scale`, color: strengthOf(oni.anom)?.color },
    { k: "n12", label: "NIÑO-1+2 ANOMALY, WEEKLY", value: `${sign(latest.n12[1])} °C`, sub: "far-eastern Pacific, off Peru and Ecuador" },
    { k: "mei", label: "MEI.V2 (NOAA PSL)", value: mei ? sign(mei.value, 2) : "–", sub: mei ? `${mei.season} ${mei.year} · 2-month season` : "unavailable" },
  ];
  const peakCurrent = enso.episodes.find((e) => e.current);
  const past = strong.filter((e) => !e.current);
  const beat = peakCurrent ? past.filter((e) => peakCurrent.peak > e.peak) : [];

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>EL NIÑO WATCH · the Pacific signal and what follows for Ethiopia</span>
        <span className="grow" />
        <button type="button" className="ctl" onClick={() => onLayer("enso")}>
          Show on map
        </button>
        {d.status && (
          <span className="mono normal-case tracking-normal" style={{ color: "var(--bad)" }}>
            ● CPC: {d.status}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* status + quote */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
          <div className="rounded border p-3 flex flex-col gap-2" style={{ borderColor: "var(--line-strong)", background: "var(--panel-2)" }}>
            <div className="text-[11px] mono muted">
              NOAA CLIMATE PREDICTION CENTER · ENSO DIAGNOSTIC DISCUSSION{d.issued ? ` · ISSUED ${d.issued.toUpperCase()}` : ""}
            </div>
            {d.synopsis ? <p className="text-[13px] leading-snug m-0">“{d.synopsis.split(/(?<=\.)\s/).slice(0, 2).join(" ")}”</p> : <p className="text-[12px] muted m-0">The CPC discussion could not be read on the last refresh.</p>}
            <div className="text-[11px] muted flex flex-wrap gap-x-3 gap-y-1">
              <a href={d.url} target="_blank" rel="noreferrer">
                Full CPC discussion ↗
              </a>
              {d.next && <span>Next discussion: {d.next}</span>}
              <span>Quoted as published; this dashboard adds no forecast.</span>
            </div>
            {peakCurrent && (
              <div className="text-[12px] leading-snug" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <b>How big is it?</b> The ONI has reached {sign(peakCurrent.peak, 2)} °C (in {peakCurrent.peakSeason}) and is still being updated.{" "}
                {beat.length ? (
                  <>
                    That is already above the peak ONI of {beat.map((e) => `${e.peakSeason.split(" ")[1]} (${sign(e.peak, 2)})`).join(", ")}.
                  </>
                ) : (
                  <>It has not yet passed the peaks of the strongest past events.</>
                )}{" "}
                <span className="muted">&ldquo;Super El Niño&rdquo; is not an official category: {impacts.definition}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => (
              <div key={t.k} className="p-2.5 flex flex-col gap-0.5 rounded border" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>
                <div className="text-[10px] mono muted tracking-wide">{t.label}</div>
                <div className="text-[26px] mono leading-none" style={{ color: t.color ?? "var(--ink)" }}>
                  {t.value}
                </div>
                <div className="text-[10.5px] muted leading-tight">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <figure className="m-0 flex flex-col gap-1">
            <figcaption className="text-[11px] mono muted">WEEKLY SEA-SURFACE TEMPERATURE ANOMALY BY NIÑO REGION, °C (SINCE JAN 2025)</figcaption>
            <div className="h-[230px]" role="img" aria-label={`Line chart of weekly sea surface temperature anomalies in the four Niño regions since January 2025. Niño-3.4 is ${sign(latest.n34[1])} degrees in the week of ${dateLabel(latest.d)}.`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="d" tick={tick} stroke="var(--line)" tickLine={false} minTickGap={48} tickFormatter={(v: string) => new Date(v + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })} />
                  <YAxis tick={tick} stroke="var(--line)" tickLine={false} width={34} domain={[-2, 6]} ticks={[-2, 0, 2, 4, 6]} />
                  <ReferenceLine y={0.5} stroke="var(--ink-3)" strokeDasharray="3 3" label={{ value: "El Niño threshold +0.5", fill: "var(--ink-3)", fontSize: 9, position: "insideBottomLeft" }} />
                  <ReferenceLine y={2} stroke="var(--bad)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "+2.0", fill: "var(--bad)", fontSize: 9, position: "insideTopLeft" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 11 }}
                    labelFormatter={(v) => dateLabel(String(v))}
                    formatter={(v, n) => [`${sign(Number(v))} °C`, String(n)]}
                  />
                  <Line type="monotone" dataKey="n12" name="Niño-1+2" stroke="var(--ink-3)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="n3" name="Niño-3" stroke="var(--cat-power)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="n4" name="Niño-4" stroke="var(--river)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="n34" name="Niño-3.4" stroke="var(--bad)" strokeWidth={2.6} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10.5px] muted flex flex-wrap gap-x-3">
              <span style={{ color: "var(--bad)" }}>━ Niño-3.4 (the headline region)</span>
              <span style={{ color: "var(--cat-power)" }}>━ Niño-3</span>
              <span style={{ color: "var(--river)" }}>━ Niño-4</span>
              <span>━ Niño-1+2</span>
              <span>Source: NOAA CPC weekly OISST</span>
            </div>
          </figure>

          <figure className="m-0 flex flex-col gap-1">
            <figcaption className="text-[11px] mono muted">THIS EVENT AGAINST PAST STRONG EVENTS: ONI BY 3-MONTH SEASON FROM ONSET, °C</figcaption>
            <div className="h-[230px]" role="img" aria-label="Line chart comparing the Oceanic Niño Index of the current El Niño with past strong events, by season since onset.">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compare} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="k" type="number" domain={[-3, 21]} ticks={[0, 3, 6, 9, 12, 15, 18, 21]} tick={tick} stroke="var(--line)" tickLine={false} tickFormatter={(v: number) => (v === 0 ? "onset" : `+${v}`)} />
                  <YAxis tick={tick} stroke="var(--line)" tickLine={false} width={34} domain={[-1, 3]} ticks={[-1, 0, 1, 2, 3]} />
                  <ReferenceLine y={2} stroke="var(--bad)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "+2.0", fill: "var(--bad)", fontSize: 9, position: "insideTopLeft" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 11 }}
                    labelFormatter={(v) => (Number(v) === 0 ? "Onset season" : `${Number(v) > 0 ? "+" : ""}${v} seasons from onset`)}
                    formatter={(v, n) => [sign(Number(v), 2), String(n)]}
                  />
                  {strong.map((e, i) => (
                    <Line
                      key={e.name}
                      type="monotone"
                      dataKey={`e${i}`}
                      name={`${e.current ? "Now: " : ""}${e.name} (peak ${sign(e.peak, 2)})`}
                      stroke={e.current ? "var(--bad)" : ["var(--ink-3)", "var(--river)", "var(--cat-power)", "var(--accent)", "var(--ink-2)"][i % 5]}
                      strokeWidth={e.current ? 2.8 : 1.4}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10.5px] muted flex flex-wrap gap-x-3">
              {strong.map((e) => (
                <span key={e.name} style={{ color: e.current ? "var(--bad)" : undefined }}>
                  ━ {e.current ? "Now" : e.name} · peak {sign(e.peak, 2)} ({e.peakSeason})
                </span>
              ))}
              <span>Source: NOAA CPC ONI. Onset = first season at or above +0.5.</span>
            </div>
          </figure>
        </div>

        {/* cascade */}
        <div>
          <div className="text-[11px] mono muted mb-1.5">CASCADING EFFECTS ON ETHIOPIA · FROM THE OCEAN TO THE ECONOMY</div>
          <ol className="list-none m-0 p-0 grid grid-cols-1 gap-2">
            {impacts.chain.map((c, i) => {
              const k = KIND[c.kind];
              return (
                <li key={c.id} className="rounded border p-3 flex flex-col gap-1.5" style={{ borderColor: "var(--line)", borderLeft: `3px solid ${k.color}`, background: "var(--panel-2)" }}>
                  <div className="flex flex-wrap items-center gap-2 text-[10.5px] mono">
                    <span className="muted">{c.stage}</span>
                    <span style={{ color: k.color, border: `1px solid ${k.color}`, padding: "0 5px", borderRadius: 3 }}>{k.label}</span>
                    {i < impacts.chain.length - 1 && <span className="muted">↓ leads to</span>}
                  </div>
                  <div className="text-[14px] font-semibold">{c.title}</div>
                  <p className="m-0 text-[12.5px] leading-snug">{c.text}</p>
                  {c.caveat && <p className="m-0 text-[11.5px] leading-snug muted">⚠ {c.caveat}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {c.watch?.map((w) => (
                      <button
                        key={w.label}
                        type="button"
                        className="ctl"
                        onClick={() => (w.vital ? onOpenVital(w.vital) : w.layer ? onLayer(w.layer as Layer) : w.section ? onGo(w.section) : undefined)}
                      >
                        {w.vital ? "Open: " : w.layer ? "Map: " : "Go to: "}
                        {w.label}
                      </button>
                    ))}
                    {c.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="muted">
                        {s.title} ({s.date}) ↗
                      </a>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="m-0 text-[10.5px] muted leading-snug">
          {impacts.note} Data: NOAA CPC (weekly Niño indices, ONI, ENSO Diagnostic Discussion) and NOAA PSL (MEI.v2), refreshed daily; CPC itself updates weekly, and the discussion monthly. Fetched {new Date(enso.fetchedAt).toISOString().slice(0, 10)}. Impact text last reviewed {impacts.asOf}.
        </p>
      </div>
    </div>
  );
}
