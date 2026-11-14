// Shared definitions for the detailed map layers (OpenStreetMap data built by
// scripts/build-detail-geo.py and served as static files under /geo-detail).
import type { FacCat, Lang, Layer } from "@/lib/urlState";

export const DETAIL_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/geo-detail`;

export type Shape = "plus" | "square" | "diamond" | "circle" | "triangle" | "hexagon" | "ring" | "cross";

/** Icon geometry in a 32x32 box; shared by the map icons (canvas Path2D) and
 *  the panel swatches (SVG) so they always match. */
export const SHAPES: Record<Shape, { d: string; mode: "fill" | "stroke"; width?: number }> = {
  plus: { d: "M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z", mode: "fill" },
  square: { d: "M7 7h18v18H7z", mode: "fill" },
  diamond: { d: "M16 3l13 13-13 13L3 16z", mode: "fill" },
  circle: { d: "M16 5a11 11 0 1 0 0.001 0z", mode: "fill" },
  triangle: { d: "M16 4l13 23H3z", mode: "fill" },
  hexagon: { d: "M16 3l12 7v12l-12 7-12-7V10z", mode: "fill" },
  ring: { d: "M16 7a9 9 0 1 0 0.001 0z", mode: "stroke", width: 4.5 },
  cross: { d: "M8 8L24 24M24 8L8 24", mode: "stroke", width: 5 },
};

// Colour groups validated with the palette checker in both themes. Shape is the
// primary identity inside a group, so colour is never the only cue.
export type Group = "health" | "education" | "commerce" | "transport" | "neutral";
export const GROUP_COLORS: Record<"dark" | "light", Record<Group, string>> = {
  dark: { health: "#d95b92", education: "#7b6cf0", commerce: "#b8863f", transport: "#0ea5c6", neutral: "#9fb0bf" },
  light: { health: "#c2447f", education: "#5a49d6", commerce: "#8f5f12", transport: "#0587ad", neutral: "#44566a" },
};

export const FAC_META: Record<FacCat, { label: string; group: Group; shape: Shape; note: string }> = {
  health: { label: "Health", group: "health", shape: "plus", note: "hospitals, clinics, pharmacies" },
  education: { label: "Education", group: "education", shape: "square", note: "schools, colleges, universities" },
  finance: { label: "Banks", group: "commerce", shape: "diamond", note: "banks and exchange" },
  market: { label: "Markets", group: "commerce", shape: "circle", note: "marketplaces" },
  fuel: { label: "Fuel", group: "commerce", shape: "triangle", note: "fuel stations" },
  transport: { label: "Transport", group: "transport", shape: "hexagon", note: "airports, rail and bus stations" },
  civic: { label: "Civic & safety", group: "neutral", shape: "ring", note: "police, fire, post, courts, town halls" },
  industry: { label: "Industry & utilities", group: "neutral", shape: "cross", note: "works, silos, tanks, water works" },
};

export type Theme = "dark" | "light";

/** Label language: English/Latin names (falling back to Amharic) or Amharic (falling back to English). */
export const nameField = (lang: Lang) => (lang === "am" ? ["coalesce", ["get", "a"], ["get", "n"]] : ["coalesce", ["get", "n"], ["get", "a"]]);
/** One font per stack: a static host cannot merge fonts, so every font ships all the ranges it needs (Latin and Ethiopic). */
export const FONT = { regular: ["NotoSans-Regular"], medium: ["NotoSans-Medium"], italic: ["NotoSans-Italic"] };
export const GLYPHS_URL = () => `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/glyphs/{fontstack}/{range}.pbf`;
/** Every label layer, so language and theme changes can reach them. */
export const LABEL_LAYERS = ["d-river-names", "d-road-names-tertiary", "d-road-names-major", "d-street-names", "d-place-village", "d-place-town", "d-place-city", "d-fac-names"];
export const facColor = (cat: FacCat, theme: string) => GROUP_COLORS[theme === "light" ? "light" : "dark"][FAC_META[cat].group];

/** Draw one facility icon to raw RGBA pixels (works without any glyph/sprite service). */
export function drawIcon(shape: Shape, color: string, outline: string, size = 32): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const s = size / 32;
  ctx.scale(s, s);
  const path = new Path2D(SHAPES[shape].d);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (SHAPES[shape].mode === "fill") {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    ctx.stroke(path);
    ctx.fillStyle = color;
    ctx.fill(path);
  } else {
    const w = SHAPES[shape].width ?? 4;
    ctx.strokeStyle = outline;
    ctx.lineWidth = w + 4;
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke(path);
  }
  return ctx.getImageData(0, 0, size, size);
}

/** What a click or hover on a detail feature yields. */
export type DetailKind = "facility" | "road" | "street" | "river" | "stream" | "water" | "place" | "rail" | "station" | "runway";
export type DetailFeature = { kind: DetailKind; props: Record<string, unknown>; lngLat: [number, number] };

/** Which toggle each detail layer id belongs to. */
export const LAYER_TOGGLE: Record<string, Layer> = {
  "d-water-big": "rivers",
  "d-water-mid": "rivers",
  "d-water-small": "rivers",
  "d-water-line": "rivers",
  "d-rivers": "rivers",
  "d-streams": "streams",
  "d-roads-tertiary": "tertiary",
  "d-streets": "streets",
  "d-roads-secondary": "roads",
  "d-roads-major": "roads",
  "d-rail": "rail",
  "d-stations": "rail",
  "d-runways": "rail",
  "d-places": "places",
  "d-places-village": "places",
  "d-fac-minor": "facilities",
  "d-fac-major": "facilities",
  "d-fac-names": "facilities",
  "d-river-names": "rivers",
  "d-road-names-tertiary": "tertiary",
  "d-road-names-major": "roads",
  "d-street-names": "streets",
  "d-place-village": "places",
  "d-place-town": "places",
  "d-place-city": "places",
};

/** Bottom-to-top draw order of the detail layers. */
export const LAYER_ORDER = [
  "d-water-big",
  "d-water-mid",
  "d-water-small",
  "d-water-line",
  "d-rivers",
  "d-streams",
  "d-roads-tertiary",
  "d-streets",
  "d-roads-secondary",
  "d-roads-major",
  "d-rail",
  "d-runways",
  "d-stations",
  "d-places",
  "d-places-village",
  "d-fac-minor",
  "d-fac-major",
  "d-fac-names",
  "d-river-names",
  "d-road-names-tertiary",
  "d-road-names-major",
  "d-street-names",
  "d-place-village",
  "d-place-town",
  "d-place-city",
];

export const LAYER_KIND: Record<string, DetailKind> = {
  "d-water-big": "water",
  "d-water-mid": "water",
  "d-water-small": "water",
  "d-rivers": "river",
  "d-streams": "stream",
  "d-roads-tertiary": "road",
  "d-roads-secondary": "road",
  "d-roads-major": "road",
  "d-streets": "street",
  "d-rail": "rail",
  "d-stations": "station",
  "d-runways": "runway",
  "d-places": "place",
  "d-places-village": "place",
  "d-fac-minor": "facility",
  "d-fac-major": "facility",
  "d-place-village": "place",
  "d-place-town": "place",
  "d-place-city": "place",
};

/** Layers a pointer can hit, topmost first. */
export const HIT_LAYERS = ["d-fac-major", "d-fac-minor", "d-place-city", "d-place-town", "d-place-village", "d-places", "d-places-village", "d-stations", "d-runways", "d-roads-major", "d-roads-secondary", "d-rail", "d-streets", "d-roads-tertiary", "d-rivers", "d-streams", "d-water-big", "d-water-mid", "d-water-small"];

export const pretty = (s: unknown) => String(s ?? "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
