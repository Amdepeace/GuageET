"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DashboardData } from "@/lib/data";
import type { Alert, CountryCode, HealthStatus } from "@/lib/schema";
import { liveStatus, sourceStatus } from "@/lib/freshness";
import { evalRule, worst, type Light, type RuleResult } from "@/lib/thresholds";
import { fetchWeather, WEATHER_POLL_MIN, WEATHER_SOURCE, type WeatherSnapshot } from "@/lib/openMeteo";
import { fetchQuakes, QUAKE_POLL_MIN, QUAKE_SOURCE, type QuakeSnapshot } from "@/lib/usgs";
import { DEFAULT_VIEW, readView, writeView, type Tab, type ViewState } from "@/lib/urlState";
import alertCfg from "@/config/alerts.json";
import { StatusBar } from "./shell/StatusBar";
import { Drawer } from "./shell/Drawer";
import { SystemHealth, type SourceRow } from "./shell/SystemHealth";
import { AlertBanner } from "./shell/AlertBanner";
import { DevelopmentPanel } from "./vitals/DevelopmentPanel";
import { VitalTile } from "./vitals/VitalTile";
import { NeighborCompare } from "./vitals/NeighborCompare";
import { SimpleTile } from "./pulse/SimpleTile";
import type { RiskPick } from "./map/useRiskLayers";
import type { GoTarget } from "./invest/InvestTab";
import { VesselDetail } from "./map/VesselDetail";
import type { VesselProps } from "./map/useVesselLayer";
import { MapLoading } from "./shell/ChunkRecovery";
import { Lazy } from "./shell/Lazy";
import { EonetDetail } from "./map/EonetDetail";
import type { EonetEvent } from "./map/useEonetLayer";
import type { ShipPick } from "./map/useShippingLayer";
import { MineralDetail } from "./map/MineralDetail";
import type { MineralProps } from "./map/useMineralLayers";
import { RiskZoneDetail } from "./map/RiskZoneDetail";
import { CommandPalette, type PaletteItem } from "./shell/CommandPalette";
import { SectionNav, SECTIONS } from "./shell/SectionNav";
import { InfraDetail } from "./infra/InfraDetail";
import { CityDetail, WeatherPanel } from "./weather/WeatherPanel";
import { QuakeDetail } from "./map/QuakeDetail";
import { RelationsPanel } from "./relations/RelationsPanel";
import { buildRelations } from "@/lib/relations";
import { AboutPanel } from "./shell/AboutPanel";
import { FeatureDetail, featureTitle } from "./map/FeatureDetail";
import { CorridorDetail } from "./map/CorridorDetail";
import type { DetailFeature } from "./map/detail";
import type { FacCat } from "@/lib/urlState";

// Heavy panels are code-split and only fetched when they scroll near (see shell/Lazy) or are opened.
const DemographicsPanel = dynamic(() => import("./demography/DemographicsPanel").then((m) => m.DemographicsPanel), { ssr: false });
const Explorer = dynamic(() => import("./explore/Explorer").then((m) => m.Explorer), { ssr: false });
const RiskPanel = dynamic(() => import("./risk/RiskPanel").then((m) => m.RiskPanel), { ssr: false });
const TradePanel = dynamic(() => import("./trade/TradePanel").then((m) => m.TradePanel), { ssr: false });
const InterbankPanel = dynamic(() => import("./markets/InterbankPanel").then((m) => m.InterbankPanel), { ssr: false });
const EsxPanel = dynamic(() => import("./markets/EsxPanel").then((m) => m.EsxPanel), { ssr: false });
const RadioPanel = dynamic(() => import("./radio/RadioPanel").then((m) => m.RadioPanel), { ssr: false });
const ClimatePanel = dynamic(() => import("./weather/ClimatePanel").then((m) => m.ClimatePanel), { ssr: false });
const RsdpPanel = dynamic(() => import("./roads/RsdpPanel").then((m) => m.RsdpPanel), { ssr: false });
const PowerExportsPanel = dynamic(() => import("./power/PowerExportsPanel").then((m) => m.PowerExportsPanel), { ssr: false });
const InfraTable = dynamic(() => import("./infra/InfraTable").then((m) => m.InfraTable), { ssr: false });
const DebtPanel = dynamic(() => import("./econ/DebtPanel").then((m) => m.DebtPanel), { ssr: false });
const HumanitarianPanel = dynamic(() => import("./humanitarian/HumanitarianPanel").then((m) => m.HumanitarianPanel), { ssr: false });
const NewsFeed = dynamic(() => import("./pulse/NewsFeed").then((m) => m.NewsFeed), { ssr: false });
const AirQualityPanel = dynamic(() => import("./weather/AirQualityPanel").then((m) => m.AirQualityPanel), { ssr: false });
const RedSeaMonitor = dynamic(() => import("./pulse/RedSeaMonitor").then((m) => m.RedSeaMonitor), { ssr: false });
const InvestTab = dynamic(() => import("./invest/InvestTab").then((m) => m.InvestTab), { ssr: false });
const RebaseTab = dynamic(() => import("./rebase/RebaseTab").then((m) => m.RebaseTab), { ssr: false });
const VitalDetail = dynamic(() => import("./vitals/VitalDetail").then((m) => m.VitalDetail), { ssr: false });
const SimpleDetail = dynamic(() => import("./pulse/SimpleDetail").then((m) => m.SimpleDetail), { ssr: false });
const PortDetail = dynamic(() => import("./map/PortDetail").then((m) => m.PortDetail), { ssr: false });
const EventLog = dynamic(() => import("./shell/EventLog").then((m) => m.EventLog), { ssr: false });
const EnsoPanel = dynamic(() => import("./enso/EnsoPanel").then((m) => m.EnsoPanel), { ssr: false });
const GlobeSection = dynamic(() => import("./globe/GlobeSection").then((m) => m.GlobeSection), { ssr: false });

// MapLibre is the heaviest dependency; load it after the vitals render.
const MapView = dynamic(() => import("./map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

type Detail =
  | { kind: "vital"; id: string; country: CountryCode }
  | { kind: "simple"; id: string }
  | { kind: "infra"; id: string }
  | { kind: "risk"; pick: RiskPick }
  | { kind: "mineral"; p: MineralProps }
  | { kind: "ship"; pick: ShipPick }
  | { kind: "event"; e: EonetEvent }
  | { kind: "vessel"; v: VesselProps; lat: number; lon: number }
  | { kind: "city"; id: string }
  | { kind: "quake"; id: string }
  | { kind: "country"; iso3: string; un: string | null; name: string }
  | { kind: "desk"; id: string }
  | { kind: "about" }
  | { kind: "feature"; f: DetailFeature }
  | { kind: "corridor"; id: string }
  | null;

const DAY = 86_400_000;
const OPTIONAL_SOURCES = new Set(["GDELT"]);
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
  // warm the map's code in idle time after first paint so it opens instantly when scrolled to (nothing runs until then)
  useEffect(() => {
    const warm = () => void import("./map/MapView");
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const t = window.setTimeout(() => (idle ? idle(warm, { timeout: 6000 }) : warm()), 3500);
    return () => window.clearTimeout(t);
  }, []);
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
        // GDELT rate-limits shared IPs and the feed falls back to outlet RSS, so its outage is a warning, not an alarm
        status: now ? (OPTIONAL_SOURCES.has(h.source) && sourceStatus(h, now) === "OFFLINE" ? ("DELAYED" as HealthStatus) : sourceStatus(h, now)) : ("NOMINAL" as HealthStatus),
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
  // headlines come from two sources; the feed is healthy if either works
  const newsStatus: HealthStatus = (() => {
    const rank: Record<HealthStatus, number> = { NOMINAL: 0, DELAYED: 1, OFFLINE: 2 };
    const a = statusOf("GDELT");
    const b = statusOf("News RSS");
    return rank[a] <= rank[b] ? a : b;
  })();
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
          return newsStatus === "OFFLINE" ? 1 : 0;
        case "debt_gni_pct":
          return data.debt.ratios.pct_gni?.value ?? null;
        case "ipc3plus_millions":
          return data.humanitarian.ipcPhase3plus ? data.humanitarian.ipcPhase3plus.value / 1e6 : null;
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
  }, [countries, infra, now, oldestVerified, weather.snap, sourceRows, thresholds, redsea, trade.available, newsStatus, data.debt, data.humanitarian]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  /** switch tab, then scroll to a section or switch on a map layer once the dashboard view is mounted */
  const goDash = (t: GoTarget) => {
    setView((v) => ({ ...v, tab: "dashboard" as Tab, layers: t.layer && !v.layers.includes(t.layer as never) ? [...v.layers, t.layer as never] : v.layers }));
    window.scrollTo({ top: 0 });
    setTimeout(() => goTo(t.layer ? "sec-map" : (t.section ?? "sec-vitals")), 250);
  };
  const setTab = (tab: Tab) => {
    setView((v) => ({ ...v, tab }));
    window.scrollTo({ top: 0 });
  };
  const paletteItems: PaletteItem[] = [
    { id: "t-invest", group: "Tabs", label: "Investment tab", hint: "sectors, pipeline, legal", run: () => setTab("invest") },
    { id: "t-rebase", group: "Tabs", label: "Rebase tab", hint: "GDP rebasing, Nov 2026", run: () => setTab("rebase") },
    { id: "t-dash", group: "Tabs", label: "Dashboard tab", run: () => setTab("dashboard") },
    ...(data.invest.sectors.map((s) => ({ id: `s-${s.id}`, group: "Investment sectors", label: s.name, hint: s.group, run: () => { setTab("invest"); setTimeout(() => document.getElementById(`sector-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250); } }))),
    ...SECTIONS.map((sec) => ({ id: sec.id, group: "Go to section", label: sec.label, run: () => goDash({ section: sec.id }) })),
    ...indicators.map((i) => ({ id: `v-${i.id}`, group: "Vitals", label: i.label, hint: i.callsign, run: () => setDetail({ kind: "vital", id: i.id, country: "ETH" }) })),
    ...infra.map((f) => ({ id: `i-${f.properties.id}`, group: "Infrastructure", label: f.properties.name, hint: f.properties.callsign, run: () => selectInfra(f.properties.id) })),
    { id: "a-about", group: "Actions", label: "About, sources and data export", run: () => setDetail({ kind: "about" }) },
    { id: "a-theme", group: "Actions", label: theme === "light" ? "Switch to dark theme" : "Switch to light theme", run: () => toggleTheme() },
  ];
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
          <VitalDetail ind={ind} countries={countries} country={detail.country} onCountry={(c) => setDetail({ ...detail, country: c })} staleSources={staleSources} timeline={timeline} onRebase={() => { closeDetail(); setTab("rebase"); }} />
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
    if (detail.kind === "vessel") {
      return (
        <Drawer title={detail.v.name?.trim() || `MMSI ${detail.v.mmsi}`} callsign="VESSEL" onClose={closeDetail}>
          <VesselDetail v={detail.v} lat={detail.lat} lon={detail.lon} />
        </Drawer>
      );
    }
    if (detail.kind === "event") {
      return (
        <Drawer title={detail.e.title} callsign="EVENT" onClose={closeDetail}>
          <EonetDetail e={detail.e} />
        </Drawer>
      );
    }
    if (detail.kind === "ship") {
      const name = detail.pick.kind === "port" ? data.ports.ports.find((x) => x.id === detail.pick.id)?.name : data.ports.chokepoints.find((x) => x.id === detail.pick.id)?.name;
      return (
        <Drawer title={name ?? "Ports & shipping"} callsign={detail.pick.kind === "port" ? "PORT" : "CHOKEPOINT"} onClose={closeDetail}>
          <PortDetail pick={detail.pick} ports={data.ports} redsea={data.redsea} />
        </Drawer>
      );
    }
    if (detail.kind === "mineral") {
      return (
        <Drawer title={detail.p.n} callsign="MINERAL" onClose={closeDetail}>
          <MineralDetail p={detail.p} />
        </Drawer>
      );
    }
    if (detail.kind === "risk") {
      return (
        <Drawer title={detail.pick.z.n} callsign={detail.pick.kind === "conflict" ? "CONFLICT" : detail.pick.kind === "rain" ? "RAINFALL" : detail.pick.kind === "pop" ? "POPULATION" : "SOIL"} onClose={closeDetail}>
          <RiskZoneDetail pick={detail.pick} conflict={data.conflict} rainfall={data.rainfall} soil={data.soil} population={data.populationZones} />
        </Drawer>
      );
    }
    if (detail.kind === "country") {
      const rel = buildRelations(data, { iso3: detail.iso3, un: detail.un, name: detail.name });
      return (
        <Drawer title={`${detail.name} · relations`} callsign={detail.iso3} onClose={closeDetail}>
          <RelationsPanel rel={rel} />
        </Drawer>
      );
    }
    if (detail.kind === "corridor") {
      const c = data.corridors.corridors.find((x) => x.id === detail.id);
      if (!c) return null;
      return (
        <Drawer title={c.name} callsign="CORRIDOR" onClose={closeDetail}>
          <CorridorDetail c={c} originName={data.corridors.origin.name} />
        </Drawer>
      );
    }
    if (detail.kind === "feature") {
      return (
        <Drawer title={featureTitle(detail.f)} callsign="MAP" onClose={closeDetail}>
          <FeatureDetail f={detail.f} />
        </Drawer>
      );
    }
    if (detail.kind === "about") {
      return (
        <Drawer title="About this dashboard" callsign="INFO" onClose={closeDetail}>
          <AboutPanel data={data} statusOf={(key) => (sourceRows.some((r) => r.source === key) ? statusOf(key) : null)} />
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
      <StatusBar lastSync={lastSync} desks={desks} onDesk={(id) => setDetail({ kind: "desk", id })} theme={theme} onTheme={toggleTheme} onAbout={() => setDetail({ kind: "about" })} />

      <div role="tablist" aria-label="Main views" className="flex items-center gap-1 border-b" style={{ borderColor: "var(--line)" }}>
        {([["dashboard", "Dashboard"], ["invest", "Investment"], ["rebase", "Rebase"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={view.tab === t} className="px-4 py-2 text-[13px] border-b-2" style={{ borderColor: view.tab === t ? "var(--accent)" : "transparent", color: view.tab === t ? "var(--ink)" : "var(--ink-2)", background: "transparent" }} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
        <span className="grow" />
        {view.tab !== "dashboard" && (
          <button type="button" className="ctl" onClick={() => setPaletteOpen(true)} aria-label="Search the dashboard (Ctrl or Cmd plus K)">
            Search <span className="mono muted">⌘K</span>
          </button>
        )}
      </div>

      <CommandPalette items={paletteItems} open={paletteOpen} onOpenChange={setPaletteOpen} />

      {view.tab === "invest" ? (
        <InvestTab invest={data.invest} pipeline={data.investPipeline} eth={countries.ETH} esx={data.esx} rates={data.esxRates} onGo={goDash} />
      ) : view.tab === "rebase" ? (
        <RebaseTab curated={data.rebase.curated} live={data.rebase.live} indicators={indicators} eth={countries.ETH} onOpenVital={(id) => setDetail({ kind: "vital", id, country: "ETH" })} onGo={(section) => goDash({ section })} />
      ) : (
        <>
      <SectionNav onSearch={() => setPaletteOpen(true)} />

      <AlertBanner alerts={alerts} />

      <section id="sec-vitals" aria-label="ECON vitals" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {indicators.filter((i) => !i.group).map((ind) => (
          <VitalTile
            key={ind.id}
            ind={ind}
            series={countries.ETH.series[ind.id]}
            stale={staleSources.has(countries.ETH.series[ind.id]?.history.at(-1)?.source ?? "")}
            onOpen={() => setDetail({ kind: "vital", id: ind.id, country: "ETH" })}
          />
        ))}
      </section>

      <DevelopmentPanel
        indicators={indicators}
        eth={countries.ETH}
        staleSources={staleSources}
        onOpen={(id) => setDetail({ kind: "vital", id, country: "ETH" })}
      />

      <section aria-label="Pulse: FX and commodities" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SimpleTile series={fxDaily} stale={statusOf(fxDaily.source) === "OFFLINE"} onOpen={() => setDetail({ kind: "simple", id: fxDaily.id })} />
        {commodities.map((c) => (
          <SimpleTile key={c.id} series={c} stale={statusOf(c.source) === "OFFLINE"} onOpen={() => setDetail({ kind: "simple", id: c.id })} />
        ))}
      </section>

      <div id="sec-map" className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,330px)]">
        <div className="order-1 lg:order-2 h-[62vh] min-h-[380px] lg:h-auto lg:min-h-[560px]">
          {viewReady && (
            <Lazy className="h-full" minHeight={380} rootMargin="600px" placeholder={<MapLoading />}>
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
              onCountry={(c) => setDetail({ kind: "country", iso3: c.iso3, un: c.un, name: c.name })}
              onFeature={(f) => setDetail({ kind: "feature", f })}
              corridors={data.corridors}
              trade={data.trade}
              onCorridor={(id) => setDetail({ kind: "corridor", id })}
              conflict={data.conflict}
              rainfall={data.rainfall}
              soil={data.soil}
              onRisk={(pick) => setDetail({ kind: "risk", pick })}
              onMineral={(p) => setDetail({ kind: "mineral", p })}
              ports={data.ports}
              redsea={redsea}
              onShip={(pick) => setDetail({ kind: "ship", pick })}
              onEvent={(e) => setDetail({ kind: "event", e })}
              onVessel={(v, lat, lon) => setDetail({ kind: "vessel", v, lat, lon })}
              population={data.populationZones}
              enso={data.enso}
              ensoImpacts={data.ensoImpacts}
              lang={view.lang}
              onLang={(lang) => setView((v) => ({ ...v, lang }))}
              fac={view.fac}
              onFac={(c: FacCat) => setView((v) => ({ ...v, fac: v.fac.includes(c) ? v.fac.filter((x) => x !== c) : [...v.fac, c] }))}
              relationsSel={detail?.kind === "country" ? detail.iso3 : null}
              initialView={{ zoom: view.zoom, center: view.center }}
              onViewChange={onViewChange}
              pulseKey={weather.pulse}
              theme={theme}
            />
            </Lazy>
          )}
        </div>
        <div className="order-2 lg:order-1 flex flex-col gap-2">
          <NeighborCompare indicators={indicators} countries={countries} cmp={view.cmp} onCmp={(cmp) => setView((v) => ({ ...v, cmp }))} onOpen={(country) => setDetail({ kind: "vital", id: view.cmp, country })} />
          <SystemHealth rows={sourceRows} now={now} />
        </div>
        <div className="order-3 flex flex-col gap-2">
          <WeatherPanel cities={cities} snap={weather.snap} status={weatherStatus} now={now} onCity={(id) => setDetail({ kind: "city", id })} />
          <Lazy minHeight={120}>
            <AirQualityPanel cities={cities} />
          </Lazy>
          <Lazy minHeight={120}>
            <RedSeaMonitor data={redsea} status={statusOf(redsea.source)} now={now} />
          </Lazy>
        </div>
      </div>

      <div id="sec-enso">
        <Lazy minHeight={520}>
          <EnsoPanel enso={data.enso} impacts={data.ensoImpacts} onOpenVital={(id) => setDetail({ kind: "vital", id, country: "ETH" })} onLayer={(layer) => goDash({ layer })} onGo={(section) => goDash({ section })} />
        </Lazy>
      </div>

      <div id="sec-globe">
        <Lazy minHeight={160}>
        <GlobeSection
          trade={data.trade}
          corridors={data.corridors}
          ports={data.ports}
          quakes={quakeList}
          theme={theme}
          onCountry={(c) => setDetail({ kind: "country", iso3: c.iso3, un: c.un, name: c.name })}
          onShip={(pick) => setDetail({ kind: "ship", pick })}
        />
        </Lazy>
      </div>

      <div id="sec-demography">
<Lazy minHeight={420}>
        <DemographicsPanel demo={data.demographics} zones={data.populationZones} onShowMap={() => goDash({ layer: "population" })} />
</Lazy>
      </div>

      <div id="sec-explore">
<Lazy minHeight={420}>
        <Explorer indicators={indicators} countries={countries} theme={theme} />
</Lazy>
      </div>

      <div id="sec-risk">
<Lazy minHeight={420}>
        <RiskPanel
          eth={countries.ETH}
          conflict={data.conflict}
          rainfall={data.rainfall}
          projections={data.projections}
          outlook={data.outlook}
          interbank={data.esxRates}
          theme={theme}
          onLayer={(layer) => {
            setView((v) => ({ ...v, layers: v.layers.includes(layer) ? v.layers : [...v.layers, layer] }));
            document.getElementById("sec-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onOpenVital={(id) => setDetail({ kind: "vital", id, country: "ETH" })}
        />
</Lazy>
      </div>

      <div id="sec-economy" className="grid grid-cols-1 lg:grid-cols-2 gap-2">
<Lazy minHeight={300}>
        <DebtPanel debt={data.debt} imf={data.imfProgramme} status={statusOf(data.debt.source)} now={now} />
        <HumanitarianPanel data={data.humanitarian} status={statusOf(data.humanitarian.source)} />
</Lazy>
      </div>

      <div id="sec-trade" className="grid grid-cols-1 lg:grid-cols-2 gap-2">
<Lazy minHeight={300}>
        <TradePanel trade={trade} status={statusOf(trade.source)} />
        <NewsFeed news={news} status={newsStatus} now={now} />
</Lazy>
      </div>

      <div id="sec-markets" className="flex flex-col gap-2">
<Lazy minHeight={300}>
        <InterbankPanel data={data.esxRates} health={statusOf(data.esxRates.source)} />
        <EsxPanel data={data.esx} cal={data.esxCalendar} now={now ? new Date(now) : null} health={statusOf(data.esx.source)} />
</Lazy>
      </div>

      <div id="sec-radio">
<Lazy minHeight={200}>
        <RadioPanel data={data.radio} />
</Lazy>
      </div>

      <div id="sec-climate">
<Lazy minHeight={300}>
        <ClimatePanel data={data.climate} />
</Lazy>
      </div>

      <div id="sec-roads">
<Lazy minHeight={300}>
        <RsdpPanel data={data.rsdp} />
</Lazy>
      </div>

      <div id="sec-power">
<Lazy minHeight={300}>
        <PowerExportsPanel data={data.powerExports} onSelectInfra={(id) => selectInfra(id)} />
</Lazy>
      </div>

      <div id="sec-infra"></div>
      <Lazy minHeight={240}>
        <InfraTable infra={infra} selected={view.sel} onSelect={(id) => selectInfra(id)} />
      </Lazy>

      <Lazy minHeight={160}>
        <EventLog changes={data.changes} events={data.events} indicators={indicators} lastVisit={lastVisit} onOpen={(id, country) => setDetail({ kind: "vital", id, country })} />
      </Lazy>

      <footer className="text-[10.5px] muted px-1 pb-2 flex flex-wrap gap-x-3">
        <span>Every figure shows its source and period. Values are never estimated; on a failed fetch the last good value stays, marked stale.</span>
        <span>Data: World Bank · IMF · Open-Meteo · USGS · World Bank Pink Sheet · open.er-api · IMF PortWatch · GDELT and Ethiopian outlet RSS · UN Comtrade · Natural Earth · curated records.</span>
      </footer>
        </>
      )}
      {detailNode}
    </main>
  );
}
