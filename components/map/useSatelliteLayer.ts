"use client";
// NASA GIBS satellite imagery over the map (public WMTS, no key). Defaults to
// the latest COMPLETE UTC day (yesterday): same-day tiles are only partly
// populated while satellites are still passing over. Clouds, swath gaps and
// polar-night gaps are normal; this is imagery, not a measurement product.
import { useEffect } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { Layer } from "@/lib/urlState";
import { LAYER_ORDER } from "./detail";

export type SatKind = "truecolor" | "lst";
export const SAT_KINDS: { id: SatKind; label: string; layer: string; matrix: string; ext: string; maxzoom: number; opacity: number; credit: string; note: string }[] = [
  { id: "truecolor", label: "True colour (VIIRS NOAA-21)", layer: "VIIRS_NOAA21_CorrectedReflectance_TrueColor", matrix: "GoogleMapsCompatible_Level9", ext: "jpg", maxzoom: 9, opacity: 0.9, credit: "NASA GIBS / VIIRS NOAA-21 corrected reflectance", note: "Daily true-colour imagery. Clouds and swath edges are normal." },
  { id: "lst", label: "Land surface temperature, day (MODIS Terra)", layer: "MODIS_Terra_Land_Surface_Temp_Day", matrix: "GoogleMapsCompatible_Level7", ext: "png", maxzoom: 7, opacity: 0.75, credit: "NASA GIBS / MODIS Terra land surface temperature (day)", note: "Satellite skin temperature in daytime; cloud-covered pixels are blank. Not air temperature." },
];

const BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** yesterday in UTC, as YYYY-MM-DD */
export const latestCompleteDay = () => new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

export function useSatelliteLayer({ map, ready, layers, kind, date }: { map: React.MutableRefObject<MlMap | null>; ready: boolean; layers: Layer[]; kind: SatKind; date: string }) {
  const on = layers.includes("satellite");
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (m.getLayer("d-sat")) m.removeLayer("d-sat");
    if (m.getSource("d-sat")) m.removeSource("d-sat");
    if (!on) return;
    const k = SAT_KINDS.find((x) => x.id === kind) ?? SAT_KINDS[0];
    m.addSource("d-sat", { type: "raster", tiles: [`${BASE}/${k.layer}/default/${date}/${k.matrix}/{z}/{y}/{x}.${k.ext}`], tileSize: 256, maxzoom: k.maxzoom, attribution: `Imagery: ${k.credit}` });
    // above the base land fill, below every vector layer that is added later
    let before: string | undefined = LAYER_ORDER.find((id) => m.getLayer(id));
    for (const id of ["d-risk-fill", "d-rain-fill", "d-soil-fill"]) if (!before && m.getLayer(id)) before = id;
    if (!before && m.getLayer("infra-halo")) before = "infra-halo";
    m.addLayer({ id: "d-sat", type: "raster", source: "d-sat", paint: { "raster-opacity": k.opacity, "raster-fade-duration": 200 } }, before);
  }, [map, ready, on, kind, date]);
}
