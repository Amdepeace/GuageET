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
