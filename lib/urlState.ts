// The URL stores the active view, so a link opens the exact same view.
// ?layers=existing,planned,weather&sel=gerd&cmp=inflation&z=5.1&c=39.50,8.60
export type Layer = "existing" | "planned" | "weather" | "activity";
export const ALL_LAYERS: Layer[] = ["existing", "planned", "weather", "activity"];

export type ViewState = {
  layers: Layer[];
  sel: string | null;
  cmp: string;
  zoom: number | null;
  center: [number, number] | null;
};

export const DEFAULT_VIEW: ViewState = {
  layers: ALL_LAYERS,
  sel: null,
  cmp: "gdp_growth",
  zoom: null,
  center: null,
};

export function readView(search: string): ViewState {
  const q = new URLSearchParams(search);
  const layers = q.get("layers");
  const z = Number(q.get("z"));
  const c = q.get("c")?.split(",").map(Number);
  return {
    layers: layers != null ? (layers.split(",").filter((l) => (ALL_LAYERS as string[]).includes(l)) as Layer[]) : DEFAULT_VIEW.layers,
    sel: q.get("sel"),
    cmp: q.get("cmp") ?? DEFAULT_VIEW.cmp,
    zoom: Number.isFinite(z) && z > 0 ? z : null,
    center: c && c.length === 2 && c.every(Number.isFinite) ? [c[0], c[1]] : null,
  };
}

export function writeView(v: ViewState) {
  const q = new URLSearchParams();
  if (v.layers.join(",") !== ALL_LAYERS.join(",")) q.set("layers", v.layers.join(","));
  if (v.sel) q.set("sel", v.sel);
  if (v.cmp !== DEFAULT_VIEW.cmp) q.set("cmp", v.cmp);
  if (v.zoom != null) q.set("z", v.zoom.toFixed(2));
  if (v.center) q.set("c", `${v.center[0].toFixed(2)},${v.center[1].toFixed(2)}`);
  const s = q.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${s ? "?" + s : ""}`);
}
