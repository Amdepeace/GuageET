// Build-time data: everything in /data is bundled into the static export.
// A data commit by the scheduled job triggers a rebuild, so the page always
// ships with the latest committed values.
import indicatorsJson from "@/config/indicators.json";
import citiesJson from "@/config/cities.json";
import thresholdsJson from "@/config/thresholds.json";
import ETH from "@/data/series/ETH.json";
import KEN from "@/data/series/KEN.json";
import DJI from "@/data/series/DJI.json";
import EGY from "@/data/series/EGY.json";
import SDN from "@/data/series/SDN.json";
import TZA from "@/data/series/TZA.json";
import changesJson from "@/data/changes.json";
import eventsJson from "@/data/events.json";
import healthJson from "@/data/health.json";
import infraJson from "@/data/curated/infrastructure.geojson";
import commoditiesJson from "@/data/commodities.json";
import fxDailyJson from "@/data/fx-daily.json";
import newsJson from "@/data/news.json";
import redseaJson from "@/data/redsea.json";
import tradeJson from "@/data/trade.json";
import alertsJson from "@/data/alerts.json";
import timelineJson from "@/data/curated/timeline.json";
import worldIndicatorsJson from "@/data/world-indicators.json";
import blocsJson from "@/config/blocs.json";
import relationsJson from "@/data/curated/relations.json";
import debtJson from "@/data/debt.json";
import imfProgrammeJson from "@/data/curated/imf-programme.json";
import corridorsJson from "@/data/curated/corridors.json";
import powerExportsJson from "@/data/curated/power-exports.json";
import rsdpJson from "@/data/curated/rsdp.json";
import climateJson from "@/data/climate.json";
import conflictJson from "@/data/conflict.json";
import rainfallJson from "@/data/rainfall.json";
import projectionsJson from "@/data/projections.json";
import outlookJson from "@/data/outlook.json";
import radioJson from "@/data/radio.json";
import esxJson from "@/data/esx.json";
import esxCalJson from "@/data/curated/esx-calendar.json";
import esxRatesJson from "@/data/esx-rates.json";
import soilJson from "@/data/curated/soil.json";
import humanitarianJson from "@/data/humanitarian.json";
import type {
  ChangeEntry,
  CountryCode,
  CountryFile,
  IndicatorConfig,
  InfraProps,
  SourceHealth,
  SimpleSeries,
  NewsFile,
  RedSeaFile,
  TradeFile,
  AlertsFile,
  TimelineEvent,
  Bloc,
  WorldIndicatorsFile,
  RelationsFile,
  DebtFile,
  ImfProgramme,
  HumanitarianFile,
  CorridorsFile,
  PowerExportsFile,
  RsdpFile,
  ClimateFile,
  ConflictFile,
  RainfallFile,
  ProjectionsFile,
  OutlookFile,
  RadioFile,
  EsxFile,
  EsxCalendar,
  InterbankFile,
  SoilFile,
} from "./schema";

export type City = { id: string; name: string; am: string; lat: number; lon: number; labelAnchor?: "top" | "bottom" };
export type ThresholdRule = {
  indicator?: string;
  metric?: string;
  amberAbove?: number;
  redAbove?: number;
  amberBelow?: number;
  redBelow?: number;
  text: string;
};
export type EventEntry = {
  at: string;
  kind: "new_period" | "revision" | "source_error" | "source_recovered";
  country?: CountryCode;
  indicator?: string;
  period?: string;
  value?: number;
  previous?: number;
  unit?: string;
  source: string;
  message: string;
};
export type InfraFeature = {
  type: "Feature";
  properties: InfraProps;
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "MultiLineString"; coordinates: [number, number][][] };
};

export type DashboardData = {
  indicators: IndicatorConfig[];
  countries: Record<CountryCode, CountryFile>;
  changes: ChangeEntry[];
  events: EventEntry[];
  health: Record<string, SourceHealth>;
  infra: InfraFeature[];
  cities: City[];
  thresholds: Record<string, ThresholdRule[]>;
  commodities: SimpleSeries[];
  fxDaily: SimpleSeries;
  news: NewsFile;
  redsea: RedSeaFile;
  trade: TradeFile;
  alerts: AlertsFile;
  timeline: TimelineEvent[];
  worldIndicators: WorldIndicatorsFile;
  blocs: Bloc[];
  relations: RelationsFile;
  debt: DebtFile;
  imfProgramme: ImfProgramme;
  humanitarian: HumanitarianFile;
  corridors: CorridorsFile;
  powerExports: PowerExportsFile;
  rsdp: RsdpFile;
  climate: ClimateFile;
  conflict: ConflictFile;
  rainfall: RainfallFile;
  projections: ProjectionsFile;
  outlook: OutlookFile;
  radio: RadioFile;
  esx: EsxFile;
  esxCalendar: EsxCalendar;
  esxRates: InterbankFile;
  soil: SoilFile;
};

export function loadData(): DashboardData {
  const { _doc, ...thresholds } = thresholdsJson as Record<string, unknown>;
  void _doc;
  return {
    indicators: indicatorsJson as IndicatorConfig[],
    countries: { ETH, KEN, DJI, EGY, SDN, TZA } as unknown as Record<CountryCode, CountryFile>,
    changes: changesJson as ChangeEntry[],
    events: eventsJson as EventEntry[],
    health: healthJson as Record<string, SourceHealth>,
    infra: (infraJson as unknown as { features: InfraFeature[] }).features,
    cities: citiesJson as City[],
    thresholds: thresholds as Record<string, ThresholdRule[]>,
    commodities: commoditiesJson as SimpleSeries[],
    fxDaily: fxDailyJson as SimpleSeries,
    news: newsJson as NewsFile,
    redsea: redseaJson as RedSeaFile,
    trade: tradeJson as TradeFile,
    alerts: alertsJson as AlertsFile,
    timeline: (timelineJson as { events: TimelineEvent[] }).events,
    worldIndicators: worldIndicatorsJson as WorldIndicatorsFile,
    blocs: (blocsJson as { blocs: Bloc[] }).blocs,
    relations: relationsJson as RelationsFile,
    debt: debtJson as DebtFile,
    imfProgramme: imfProgrammeJson as ImfProgramme,
    humanitarian: humanitarianJson as HumanitarianFile,
    corridors: corridorsJson as unknown as CorridorsFile,
    powerExports: powerExportsJson as unknown as PowerExportsFile,
    rsdp: rsdpJson as unknown as RsdpFile,
    climate: climateJson as unknown as ClimateFile,
    conflict: conflictJson as unknown as ConflictFile,
    rainfall: rainfallJson as unknown as RainfallFile,
    projections: projectionsJson as unknown as ProjectionsFile,
    outlook: outlookJson as unknown as OutlookFile,
    radio: radioJson as unknown as RadioFile,
    esx: esxJson as unknown as EsxFile,
    esxCalendar: esxCalJson as unknown as EsxCalendar,
    esxRates: esxRatesJson as unknown as InterbankFile,
    soil: soilJson as unknown as SoilFile,
  };
}
