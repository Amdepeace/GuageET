import type { Bloc, RelationsFile, TradeFile, WorldIndicatorsFile } from "./schema";

export type RelationsInput = {
  worldIndicators: WorldIndicatorsFile;
  blocs: Bloc[];
  trade: TradeFile;
  relations: RelationsFile;
};

export type ClickedCountry = { iso3: string; un: string | null; name: string };

export type SharedBlocs = { shared: Bloc[]; ethOnly: Bloc[]; countryOnly: Bloc[] };

export function sharedBlocs(blocs: Bloc[], iso3: string): SharedBlocs {
  const shared: Bloc[] = [];
  const ethOnly: Bloc[] = [];
  const countryOnly: Bloc[] = [];
  for (const b of blocs) {
    const eth = b.members.includes("ETH");
    const them = b.members.includes(iso3);
    if (eth && them) shared.push(b);
    else if (eth && !them) ethOnly.push(b);
    else if (!eth && them) countryOnly.push(b);
  }
  return { shared, ethOnly, countryOnly };
}

export type CountryRelations = {
  country: ClickedCountry;
  isEthiopia: boolean;
  blocs: SharedBlocs;
  indicators: { id: string; label: string; eth: { value: number; year: string } | null; them: { value: number; year: string } | null; format: "count" | "usd" | "pct" }[];
  bilateral: { exports: number; imports: number } | null;
  tradePeriod: string;
  tradeAvailable: boolean;
  topExportCommodities: { code: string; label: string; value: number }[];
  topImportCommodities: { code: string; label: string; value: number }[];
  profile: { current: string; history: string; investment: string; sources: { title: string; url: string }[] } | null;
};

const IND_META: { id: "population" | "gdp_usd" | "gdp_growth"; label: string; format: "count" | "usd" | "pct" }[] = [
  { id: "gdp_usd", label: "GDP (US$)", format: "usd" },
  { id: "population", label: "Population", format: "count" },
  { id: "gdp_growth", label: "GDP growth", format: "pct" },
];

export function buildRelations(d: RelationsInput, c: ClickedCountry): CountryRelations {
  const them = d.worldIndicators.countries[c.iso3] ?? {};
  const eth = d.worldIndicators.countries["ETH"] ?? {};
  const indicators = IND_META.map((m) => ({
    id: m.id,
    label: m.label,
    eth: eth[m.id] ?? null,
    them: them[m.id] ?? null,
    format: m.format,
  }));
  const bil = c.un ? d.trade.bilateral[c.un] : undefined;
  return {
    country: c,
    isEthiopia: c.iso3 === "ETH",
    blocs: sharedBlocs(d.blocs, c.iso3),
    indicators,
    bilateral: bil ? { exports: bil.exports, imports: bil.imports } : null,
    tradePeriod: d.trade.period,
    tradeAvailable: d.trade.available,
    topExportCommodities: d.trade.topExportCommodities,
    topImportCommodities: d.trade.topImportCommodities,
    profile: d.relations.profiles[c.iso3] ?? null,
  };
}
