// USGS earthquake feed: open GeoJSON, browser-callable (CORS). We pull the
// past week at M2.5+ and keep events in the Horn/Rift region.
export type Quake = {
  id: string;
  mag: number;
  place: string;
  time: number;
  depth: number;
  lon: number;
  lat: number;
  url: string;
};

export type QuakeSnapshot = { fetchedAt: number; quakes: Quake[] };

export const QUAKE_SOURCE = "USGS";
export const QUAKE_SOURCE_URL = "https://earthquake.usgs.gov/earthquakes/";
export const QUAKE_POLL_MIN = 10;
export const QUAKE_REGION = { minLat: 2, maxLat: 16, minLon: 32, maxLon: 49 };

type FeedFeature = {
  id: string;
  properties: { mag: number; place: string; time: number; url: string };
  geometry: { coordinates: [number, number, number] };
};

export async function fetchQuakes(): Promise<QuakeSnapshot> {
  const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson");
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const body = (await res.json()) as { features: FeedFeature[] };
  const r = QUAKE_REGION;
  const quakes: Quake[] = body.features
    .map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place || "Unknown location",
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      url: f.properties.url,
    }))
    .filter((q) => q.lat >= r.minLat && q.lat <= r.maxLat && q.lon >= r.minLon && q.lon <= r.maxLon && q.mag != null)
    .sort((a, b) => b.time - a.time);
  return { fetchedAt: Date.now(), quakes };
}
