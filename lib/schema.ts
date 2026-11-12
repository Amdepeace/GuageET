// The data contract (PRD: "Data contract"). Every stored value uses this shape,
// and the UI reads only this shape, so sources can be swapped freely.

export type Observation = {
  value: number; // never estimated; a missing value is simply not stored
  unit: string; // "%", "ETB per USD", "USD", "people"
  asOf: string; // ISO date of the period the value describes (period end)
  period: string; // human label for that period, e.g. "2024"
  source: string; // "World Bank WDI"
  sourceUrl: string;
  fetchedAt: string; // ISO timestamp of the fetch that produced it
};

export type CountryCode = "ETH" | "KEN" | "DJI" | "EGY" | "SDN" | "TZA";

export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: "ETH", name: "Ethiopia" },
  { code: "KEN", name: "Kenya" },
  { code: "DJI", name: "Djibouti" },
  { code: "EGY", name: "Egypt" },
  { code: "SDN", name: "Sudan" },
  { code: "TZA", name: "Tanzania" },
];

export type Frequency = "annual" | "quarterly" | "monthly" | "daily";

export type Series = {
  id: string; // indicator id from config/indicators.json
  country: CountryCode;
  history: Observation[]; // primary source, sorted by asOf ascending
  alternatives: Observation[]; // latest value from other sources, for the detail card
};

export type CountryFile = {
  country: CountryCode;
  series: Record<string, Series>;
};

export type HealthStatus = "NOMINAL" | "DELAYED" | "OFFLINE";

export type SourceHealth = {
  source: string;
  expectedRefreshDays: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ChangeEntry = {
  at: string; // when the change was detected (fetchedAt)
  country: CountryCode;
  indicator: string;
  period: string;
  previousPeriod: string;
  value: number;
  previous: number;
  unit: string;
  pctChange: number | null;
  source: string;
};

export type InfraLayer = "existing" | "planned";
export type InfraStatus = "operational" | "trial" | "under_construction" | "planned" | "stalled";
export type InfraType =
  | "rail"
  | "road"
  | "airport"
  | "dam"
  | "power_line"
  | "port"
  | "corridor";

export type InfraProps = {
  id: string;
  callsign: string;
  name: string;
  type: InfraType;
  layer: InfraLayer;
  status: InfraStatus;
  costUsd: number | null;
  costNote?: string;
  funders: string[];
  connects: string[];
  lastVerified: string;
  verified: boolean;
  summary: string;
  geometryNote: string; // how the drawn line/point was derived
  sources: { title: string; url: string }[];
};

// --- v2 types -------------------------------------------------------------

export type SimpleSeries = {
  id: string;
  label: string;
  callsign: string;
  unit: string;
  format: "pct" | "usd" | "count" | "rate";
  source: string;
  sourceUrl: string;
  history: Observation[];
};

export type NewsItem = {
  title: string;
  url: string;
  domain: string;
  seenAt: string; // ISO
};

export type NewsFile = { fetchedAt: string; items: NewsItem[] };

export type ChokepointDay = { date: string; ships: number; capacity: number };
export type Chokepoint = {
  id: string;
  name: string;
  history: ChokepointDay[];
  baselineShips: number; // median of the window, for the risk gauge
};
export type RedSeaFile = { fetchedAt: string; source: string; sourceUrl: string; chokepoints: Chokepoint[] };

export type TimelineEvent = {
  date: string; // ISO date
  label: string;
  type: "fx" | "trade" | "power" | "conflict" | "policy";
  detail: string;
  indicators?: string[]; // which vital charts to mark
  sourceUrl?: string;
};

export type AlertLevel = "amber" | "red";
export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  at: string;
  source: string;
  sourceUrl?: string;
};
export type AlertsFile = { generatedAt: string; alerts: Alert[] };

export type TradePartner = { partner: string; partnerCode: string; value: number };
export type TradeCommodity = { code: string; label: string; value: number };
export type BilateralTrade = { partner: string; exports: number; imports: number };
export type TradeFile = {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  period: string; // latest year with data
  available: boolean; // false when no Comtrade key is configured
  note: string;
  exportsByPartner: TradePartner[];
  importsByPartner: TradePartner[];
  balance: { period: string; exports: number; imports: number }[];
  // bilateral totals keyed by partner M49 code (matches world.geojson `un`)
  bilateral: Record<string, BilateralTrade>;
  topExportCommodities: TradeCommodity[];
  topImportCommodities: TradeCommodity[];
};

// --- world relations ------------------------------------------------------

export type Bloc = { id: string; name: string; note: string; sourceUrl: string; members: string[] };
export type WorldIndicatorValue = { value: number; year: string };
export type WorldIndicatorsFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  countries: Record<string, { population?: WorldIndicatorValue; gdp_usd?: WorldIndicatorValue; gdp_growth?: WorldIndicatorValue }>;
};
export type RelationProfile = { current: string; history: string; investment: string; sources: { title: string; url: string }[] };
export type RelationsFile = { profiles: Record<string, RelationProfile> };

export type DebtSlice = { id: string; label: string; value: number; period: string };
export type DebtRatio = { value: number; period: string; label: string; format: "usd" | "pct" };
export type DebtFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  composition: DebtSlice[];
  ratios: Record<string, DebtRatio>;
  totalHistory: { period: string; value: number }[];
};
export type ImfEvent = { date: string; label: string; detail: string; sourceUrl?: string };
export type ImfProgramme = { programme: string; events: ImfEvent[]; note: string };

export type HumanitarianFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  available: boolean;
  note: string;
  peopleInNeed: { value: number; population: number | null; period: string } | null;
  ipcPhase3plus: { value: number; period: string } | null;
  foodPrices: { commodity: string; price: number; unit: string; currency: string; period: string }[];
};

export type IndicatorConfig = {
  id: string;
  label: string;
  callsign: string;
  unit: string;
  format: "pct" | "usd" | "count" | "rate";
  frequency: Frequency;
  expectedRefreshDays: number;
  higherIsBetter: boolean | null;
  worldBank: string;
  imf: string | null;
};
