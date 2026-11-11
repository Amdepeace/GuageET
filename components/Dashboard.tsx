"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DashboardData } from "@/lib/data";
import type { Alert, CountryCode, HealthStatus } from "@/lib/schema";
import { liveStatus, sourceStatus } from "@/lib/freshness";
import { evalRule, worst, type Light, type RuleResult } from "@/lib/thresholds";
import { fetchWeather, WEATHER_POLL_MIN, WEATHER_SOURCE, type WeatherSnapshot } from "@/lib/openMeteo";
import { fetchQuakes, QUAKE_POLL_MIN, QUAKE_SOURCE, type QuakeSnapshot } from "@/lib/usgs";
import { DEFAULT_VIEW, readView, writeView, type ViewState } from "@/lib/urlState";
import alertCfg from "@/config/alerts.json";
import { StatusBar } from "./shell/StatusBar";
import { Drawer } from "./shell/Drawer";
import { EventLog } from "./shell/EventLog";
import { SystemHealth, type SourceRow } from "./shell/SystemHealth";
import { AlertBanner } from "./shell/AlertBanner";
import { VitalTile } from "./vitals/VitalTile";
import { VitalDetail } from "./vitals/VitalDetail";
import { NeighborCompare } from "./vitals/NeighborCompare";
import { SimpleTile } from "./pulse/SimpleTile";
import { SimpleDetail } from "./pulse/SimpleDetail";
import { NewsFeed } from "./pulse/NewsFeed";
import { RedSeaMonitor } from "./pulse/RedSeaMonitor";
import { TradePanel } from "./trade/TradePanel";
import { InfraTable } from "./infra/InfraTable";
import { InfraDetail } from "./infra/InfraDetail";
import { CityDetail, WeatherPanel } from "./weather/WeatherPanel";
import { QuakeDetail } from "./map/QuakeDetail";

// MapLibre is the heaviest dependency; load it after the vitals render.
const MapView = dynamic(() => import("./map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="panel h-full min-h-[380px] flex items-center justify-center label">Acquiring map…</div>,
});

type Detail =
  | { kind: "vital"; id: string; country: CountryCode }
  | { kind: "simple"; id: string }
  | { kind: "infra"; id: string }
  | { kind: "city"; id: string }
  | { kind: "quake"; id: string }
  | { kind: "desk"; id: string }
  | null;

const DAY = 86_400_000;
const LS_WEATHER = "ev-weather";
const LS_QUAKES = "ev-quakes";
const LS_VISIT = "ev-last-visit";
const LS_THEME = "ev-theme";

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable: per-viewer convenience only */
  }
}

/** Generic live-poll hook: fetch now, cache per-viewer, re-poll on interval.
 *  On failure the last good snapshot stays; nothing is blanked. */
function useLive<T extends { fetchedAt: number }>(fn: () => Promise<T>, cacheKey: string, pollMin: number) {
  const [snap, setSnap] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const cached = lsGet(cacheKey);
    if (cached) {
      try {
        setSnap(JSON.parse(cached));
      } catch {
        /* ignore corrupt cache */
      }
    }
    let alive = true;
    const run = async () => {
      try {
        const s = await fn();
        if (!alive) return;
        setSnap(s);
        setError(null);
        setPulse((p) => p + 1);
        lsSet(cacheKey, JSON.stringify(s));
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    run();
    const t = setInterval(run, pollMin * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);
  return { snap, error, pulse };
}

export function Dashboard({ data }: { data: DashboardData }) {
  const { indicators, countries, infra, cities, thresholds, health, commodities, fxDaily, news, redsea, trade, timeline } = data;
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [viewReady, setViewReady] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [now, setNow] = useState<number | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");
  const weather = useLive<WeatherSnapshot>(() => fetchWeather(cities), LS_WEATHER, WEATHER_POLL_MIN);
  const quakes = useLive<QuakeSnapshot>(fetchQuakes, LS_QUAKES, QUAKE_POLL_MIN);
  const quakeList = useMemo(() => quakes.snap?.quakes ?? [], [quakes.snap]);

  // client-only state: URL view, clock, last visit, theme
  useEffect(() => {
    const v = readView(window.location.search);
    setView(v);
    setViewReady(true);
    if (v.sel && infra.some((f) => f.properties.id === v.sel)) setDetail({ kind: "infra", id: v.sel });
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    setLastVisit(lsGet(LS_VISIT));
    const mark = setTimeout(() => lsSet(LS_VISIT, new Date().toISOString()), 5000);
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    return () => {
      clearInterval(t);
      clearTimeout(mark);
    };
  }, [infra]);

  useEffect(() => {
    if (viewReady) writeView(view);
  }, [view, viewReady]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    lsSet(LS_THEME, next);
    setTheme(next);
  };

  // --- source health -------------------------------------------------------
  const weatherStatus: HealthStatus = now ? liveStatus(weather.snap?.fetchedAt ?? null, weather.error, WEATHER_POLL_MIN, now) : "NOMINAL";
  const quakeStatus: HealthStatus = now ? liveStatus(quakes.snap?.fetchedAt ?? null, quakes.error, QUAKE_POLL_MIN, now) : "NOMINAL";
  const newestVerified = infra.map((f) => f.properties.lastVerified).sort().at(-1) ?? null;
  const oldestVerified = infra.map((f) => f.properties.lastVerified).sort()[0] ?? null;
  const curatedStatus: HealthStatus = !newestVerified || !now ? "NOMINAL" : now - Date.parse(oldestVerified!) > 60 * DAY ? "OFFLINE" : now - Date.parse(oldestVerified!) > 35 * DAY ? "DELAYED" : "NOMINAL";

  const sourceRows: SourceRow[] = useMemo(
    () => [
      ...Object.values(health).map((h) => ({
        source: h.source,
        kind: "scheduled" as const,
        status: now ? sourceStatus(h, now) : ("NOMINAL" as HealthStatus),
        lastSuccess: h.lastSuccessAt,
        error: h.lastError,
      })),
      { source: WEATHER_SOURCE, kind: "live" as const, status: weatherStatus, lastSuccess: weather.snap ? new Date(weather.snap.fetchedAt).toISOString() : null, error: weather.error },
      { source: QUAKE_SOURCE, kind: "live" as const, status: quakeStatus, lastSuccess: quakes.snap ? new Date(quakes.snap.fetchedAt).toISOString() : null, error: quakes.error },
      { source: "Curated infrastructure", kind: "curated" as const, status: curatedStatus, lastSuccess: oldestVerified, error: null },
    ],
    [health, now, weatherStatus, weather.snap, weather.error, quakeStatus, quakes.snap, quakes.error, curatedStatus, oldestVerified],
  );
  const statusOf = useCallback((source: string): HealthStatus => sourceRows.find((r) => r.source === source)?.status ?? "NOMINAL", [sourceRows]);
  const staleSources = useMemo(() => new Set(sourceRows.filter((r) => r.status === "OFFLINE").map((r) => r.source)), [sourceRows]);
  const lastSync = Object.values(health)
    .map((h) => h.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  // --- alerts (scheduled file + live quakes) -------------------------------
  const alerts: Alert[] = useMemo(() => {
    const live: Alert[] = [];
    const cutoff = (now ?? Date.now()) - 2 * DAY;
    for (const q of quakeList) {
      if (q.mag >= alertCfg.quakeMinMagnitude && q.time >= cutoff) {
        live.push({
          id: `quake-${q.id}`,
          level: q.mag >= 5.5 ? "red" : "amber",
          title: `M${q.mag.toFixed(1)} earthquake near ${q.place}`,
          detail: `Depth ${q.depth.toFixed(0)} km, ${new Date(q.time).toISOString().slice(0, 16).replace("T", " ")} UTC.`,
          at: new Date(q.time).toISOString(),
          source: QUAKE_SOURCE,
          sourceUrl: q.url,
        });
      }
    }
    const byId = new Map<string, Alert>();
    for (const a of [...data.alerts.alerts, ...live]) byId.set(a.id, a);
    return [...byId.values()].sort((a, b) => (a.level === b.level ? b.at.localeCompare(a.at) : a.level === "red" ? -1 : 1));
  }, [data.alerts.alerts, quakeList, now]);

  // --- desk lights ---------------------------------------------------------
  const deskRules = useMemo(() => {
    const eth = countries.ETH.series;
    const bab = redsea.chokepoints.find((c) => c.id === "chokepoint4");
    const metric = (m: string): number | null => {
      switch (m) {
        case "unverified_records":
          return infra.filter((f) => !f.properties.verified).length;
        case "oldest_verification_days":
          return now && oldestVerified ? Math.floor((now - Date.parse(oldestVerified)) / DAY) : null;
        case "max_temp_c":
          return weather.snap ? Math.max(...weather.snap.cities.flatMap((c) => c.daily.map((d) => d.max))) : null;
        case "daily_precip_mm":
          return weather.snap ? Math.max(...weather.snap.cities.flatMap((c) => c.daily.map((d) => d.precip))) : null;
        case "offline_sources":
          return sourceRows.filter((r) => r.status === "OFFLINE").length;
        case "redsea_drop_pct": {
          const last = bab?.history.at(-1);
          return last && bab!.baselineShips ? ((bab!.baselineShips - last.ships) / bab!.baselineShips) * 100 : null;
        }
        case "trade_unavailable":
          return trade.available ? 0 : 1;
        case "news_offline":
          return statusOf("GDELT") === "OFFLINE" ? 1 : 0;
      }
      return null;
    };
    const out: Record<string, RuleResult[]> = {};
    for (const [desk, rules] of Object.entries(thresholds)) {
      out[desk] = rules.map((rule) => {
        const value = rule.indicator ? (eth[rule.indicator]?.history.at(-1)?.value ?? null) : metric(rule.metric!);
        return { rule, value, light: evalRule(rule, value) };
      });
    }
    return out;
  }, [countries, infra, now, oldestVerified, weather.snap, sourceRows, thresholds, redsea, trade.available, statusOf]);
  const desks = Object.entries(deskRules).map(([id, r]) => ({ id, light: worst(r.map((x) => x.light)) as Light }));

  // --- selection -----------------------------------------------------------
  const selectInfra = useCallback((id: string | null) => {
    setView((v) => ({ ...v, sel: id }));
    setDetail(id ? { kind: "infra", id } : null);
  }, []);
  const closeDetail = useCallback(() => {
    setDetail((d) => {
      if (d?.kind === "infra") setView((v) => ({ ...v, sel: null }));
      return null;
    });
  }, []);
  const onViewChange = useCallback((zoom: number, center: [number, number]) => setView((v) => ({ ...v, zoom, center })), []);

  const detailNode = (() => {
    if (!detail) return null;
    if (detail.kind === "vital") {
      const ind = indicators.find((i) => i.id === detail.id)!;
      return (
        <Drawer title={ind.label} callsign={ind.callsign} onClose={closeDetail}>
          <VitalDetail ind={ind} countries={countries} country={detail.country} onCountry={(c) => setDetail({ ...detail, country: c })} staleSources={staleSources} timeline={timeline} />
        </Drawer>
      );
    }
    if (detail.kind === "simple") {
      const sv = [...commodities, fxDaily].find((x) => x.id === detail.id);
      if (!sv) return null;
      return (
        <Drawer title={sv.label} callsign={sv.callsign} onClose={closeDetail}>
          <SimpleDetail series={sv} />
        </Drawer>
      );
    }
    if (detail.kind === "infra") {
      const f = infra.find((x) => x.properties.id === detail.id);
      if (!f) return null;
      return (
        <Drawer title={f.properties.name} callsign={f.properties.callsign} onClose={closeDetail}>
          <InfraDetail p={f.properties} />
        </Drawer>
      );
    }
    if (detail.kind === "city") {
      const c = cities.find((x) => x.id === detail.id)!;
      return (
        <Drawer title={`${c.name} weather`} callsign={c.id} onClose={closeDetail}>
          <CityDetail city={c} snap={weather.snap} />
        </Drawer>
      );
    }
    if (detail.kind === "quake") {
      const q = quakeList.find((x) => x.id === detail.id);
      if (!q) return null;
      return (
        <Drawer title="Earthquake" callsign="QUAKE" onClose={closeDetail}>
          <QuakeDetail q={q} now={now} />
        </Drawer>
      );
    }
    const rules = deskRules[detail.id] ?? [];
    return (
      <Drawer title={`${detail.id} status light`} callsign={detail.id} onClose={closeDetail}>
        <p className="text-[12px] ink2">
          The desk shows the worst light among its rules. Rules live in <span className="mono">config/thresholds.json</span>.
        </p>
        <ul className="flex flex-col gap-2">
          {rules.map((r, k) => (
            <li key={k} className="panel p-2">
              <div className="flex items-center gap-2">
                <span className={`st ${r.light}`}>{r.light.toUpperCase()}</span>
                <span className="mono text-[12px] grow text-right">{r.value == null ? "no value" : Number.isInteger(r.value) ? r.value : r.value.toFixed(2)}</span>
              </div>
              <div className="text-[12px] mt-1">{r.rule.text}</div>
            </li>
          ))}
        </ul>
      </Drawer>
    );
  })();

  return (
    <main className="min-h-screen flex flex-col gap-2 p-2 md:p-3 max-w-[1800px] mx-auto">
      <StatusBar lastSync={lastSync} desks={desks} onDesk={(id) => setDetail({ kind: "desk", id })} theme={theme} onTheme={toggleTheme} />

      <AlertBanner alerts={alerts} />

      <section aria-label="ECON vitals" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {indicators.map((ind) => (
          <VitalTile
            key={ind.id}
            ind={ind}
            series={countries.ETH.series[ind.id]}
            stale={staleSources.has(countries.ETH.series[ind.id]?.history.at(-1)?.source ?? "")}
            onOpen={() => setDetail({ kind: "vital", id: ind.id, country: "ETH" })}
          />
        ))}
      </section>

      <section aria-label="Pulse: FX and commodities" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SimpleTile series={fxDaily} stale={statusOf(fxDaily.source) === "OFFLINE"} onOpen={() => setDetail({ kind: "simple", id: fxDaily.id })} />
        {commodities.map((c) => (
          <SimpleTile key={c.id} series={c} stale={statusOf(c.source) === "OFFLINE"} onOpen={() => setDetail({ kind: "simple", id: c.id })} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,330px)]">
        <div className="order-1 lg:order-2 h-[62vh] min-h-[380px] lg:h-auto lg:min-h-[560px]">
          {viewReady && (
            <MapView
              infra={infra}
              cities={cities}
              weather={weather.snap?.cities ?? null}
              quakes={quakeList}
              layers={view.layers}
              onLayers={(layers) => setView((v) => ({ ...v, layers }))}
              selected={view.sel}
              onSelect={selectInfra}
              onCity={(id) => setDetail({ kind: "city", id })}
              onQuake={(id) => setDetail({ kind: "quake", id })}
              initialView={{ zoom: view.zoom, center: view.center }}
              onViewChange={onViewChange}
              pulseKey={weather.pulse}
              theme={theme}
            />
          )}
        </div>
        <div className="order-2 lg:order-1 flex flex-col gap-2">
          <NeighborCompare indicators={indicators} countries={countries} cmp={view.cmp} onCmp={(cmp) => setView((v) => ({ ...v, cmp }))} onOpen={(country) => setDetail({ kind: "vital", id: view.cmp, country })} />
          <SystemHealth rows={sourceRows} now={now} />
        </div>
        <div className="order-3 flex flex-col gap-2">
          <WeatherPanel cities={cities} snap={weather.snap} status={weatherStatus} now={now} onCity={(id) => setDetail({ kind: "city", id })} />
          <RedSeaMonitor data={redsea} status={statusOf(redsea.source)} now={now} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <TradePanel trade={trade} status={statusOf(trade.source)} />
        <NewsFeed news={news} status={statusOf("GDELT")} now={now} />
      </div>

      <InfraTable infra={infra} selected={view.sel} onSelect={(id) => selectInfra(id)} />

      <EventLog changes={data.changes} events={data.events} indicators={indicators} lastVisit={lastVisit} onOpen={(id, country) => setDetail({ kind: "vital", id, country })} />

      <footer className="text-[10.5px] muted px-1 pb-2 flex flex-wrap gap-x-3">
        <span>Every figure shows its source and period. Values are never estimated; on a failed fetch the last good value stays, marked stale.</span>
        <span>Data: World Bank · IMF · Open-Meteo · USGS · World Bank Pink Sheet · open.er-api · IMF PortWatch · GDELT · UN Comtrade · Natural Earth · curated records.</span>
      </footer>
      {detailNode}
    </main>
  );
}
