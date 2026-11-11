// Open-Meteo forecast API: keyless, browser-callable (CORS), free for
// non-commercial use. One batched request covers all cities.
// Docs: https://open-meteo.com/en/docs
import type { City } from "./data";

export type CityWeather = {
  id: string;
  current: { time: string; temp: number; humidity: number; wind: number; code: number };
  daily: { date: string; max: number; min: number; precip: number; code: number }[];
};

export type WeatherSnapshot = { fetchedAt: number; cities: CityWeather[] };

export const WEATHER_SOURCE = "Open-Meteo";
export const WEATHER_SOURCE_URL = "https://open-meteo.com/";
export const WEATHER_POLL_MIN = 15;

type OmOne = {
  current: { time: string; temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
};

export async function fetchWeather(cities: City[]): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.lat).join(","),
    longitude: cities.map((c) => c.lon).join(","),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "Africa/Addis_Ababa",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body = (await res.json()) as OmOne | OmOne[];
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== cities.length) throw new Error("Open-Meteo: unexpected response length");
  return {
    fetchedAt: Date.now(),
    cities: list.map((r, i) => ({
      id: cities[i].id,
      current: {
        time: r.current.time,
        temp: r.current.temperature_2m,
        humidity: r.current.relative_humidity_2m,
        wind: r.current.wind_speed_10m,
        code: r.current.weather_code,
      },
      daily: r.daily.time.map((d, j) => ({
        date: d,
        max: r.daily.temperature_2m_max[j],
        min: r.daily.temperature_2m_min[j],
        precip: r.daily.precipitation_sum[j],
        code: r.daily.weather_code[j],
      })),
    })),
  };
}

// WMO weather interpretation codes -> short uppercase console labels
export function wmoLabel(code: number): string {
  if (code === 0) return "CLEAR";
  if (code <= 2) return "PT CLOUD";
  if (code === 3) return "OVERCAST";
  if (code === 45 || code === 48) return "FOG";
  if (code >= 51 && code <= 57) return "DRIZZLE";
  if (code >= 61 && code <= 67) return "RAIN";
  if (code >= 71 && code <= 77) return "SNOW";
  if (code >= 80 && code <= 82) return "SHOWERS";
  if (code >= 95) return "T-STORM";
  return `WMO ${code}`;
}
