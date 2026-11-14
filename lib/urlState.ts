// The URL stores the active view, so a link opens the exact same view.
// ?layers=existing,planned,rivers&sel=gerd&cmp=inflation&z=5.1&c=39.50,8.60&fc=health,education
export type Layer =
  | "existing"
  | "planned"
  | "weather"
  | "activity"
  // detailed map layers (OpenStreetMap data, loaded on demand)
  | "rivers"
  | "streams"
  | "roads"
  | "tertiary"
  | "rail"
  | "places"
  | "facilities"
  | "streets";

export const ALL_LAYERS: Layer[] = [
  "existing",
  "planned",
  "weather",
  "activity",
  "rivers",
  "streams",
  "roads",
  "tertiary",
  "rail",
  "places",
  "facilities",
  "streets",
];

/** On by default: the infrastructure story plus a calm detailed base. The
 *  heavier or busier detail layers are opt-in. */
export const DEFAULT_LAYERS: Layer[] = ["existing", "planned", "weather", "activity", "rivers", "roads", "rail", "places", "streets"];

export type FacCat = "health" | "education" | "finance" | "market" | "fuel" | "transport" | "civic" | "industry";
export const ALL_FAC_CATS: FacCat[] = ["health", "education", "finance", "market", "fuel", "transport", "civic", "industry"];

export type Lang = "en" | "am";

export type ViewState = {
  lang: Lang;
  layers: Layer[];
  fac: FacCat[];
  sel: string | null;
  cmp: string;
  zoom: number | null;
  center: [number, number] | null;
};

export const DEFAULT_VIEW: ViewState = {
  lang: "en",
  layers: DEFAULT_LAYERS,
  fac: ALL_FAC_CATS,
  sel: null,
  cmp: "gdp_growth",
  zoom: null,
  center: null,
};

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function readView(search: string): ViewState {
  const q = new URLSearchParams(search);
  const layers = q.get("layers");
  const fc = q.get("fc");
  const z = Number(q.get("z"));
  const c = q.get("c")?.split(",").map(Number);
  return {
    lang: q.get("lang") === "am" ? "am" : "en",
    layers: layers != null ? (layers.split(",").filter((l) => (ALL_LAYERS as string[]).includes(l)) as Layer[]) : DEFAULT_VIEW.layers,
    fac: fc != null ? (fc.split(",").filter((l) => (ALL_FAC_CATS as string[]).includes(l)) as FacCat[]) : DEFAULT_VIEW.fac,
    sel: q.get("sel"),
    cmp: q.get("cmp") ?? DEFAULT_VIEW.cmp,
    zoom: Number.isFinite(z) && z > 0 ? z : null,
    center: c && c.length === 2 && c.every(Number.isFinite) ? [c[0], c[1]] : null,
  };
}

export function writeView(v: ViewState) {
  const q = new URLSearchParams();
  if (!same(v.layers, DEFAULT_LAYERS)) q.set("layers", v.layers.join(","));
  if (!same(v.fac, ALL_FAC_CATS)) q.set("fc", v.fac.join(","));
  if (v.lang !== "en") q.set("lang", v.lang);
  if (v.sel) q.set("sel", v.sel);
  if (v.cmp !== DEFAULT_VIEW.cmp) q.set("cmp", v.cmp);
  if (v.zoom != null) q.set("z", v.zoom.toFixed(2));
  if (v.center) q.set("c", `${v.center[0].toFixed(2)},${v.center[1].toFixed(2)}`);
  const s = q.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${s ? "?" + s : ""}`);
}
