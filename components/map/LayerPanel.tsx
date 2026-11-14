"use client";
import type { ReactNode } from "react";
import { ALL_FAC_CATS, type FacCat, type Lang, type Layer } from "@/lib/urlState";
import { FAC_META, SHAPES, facColor, type Shape } from "./detail";
import { CITIES } from "./useDetailLayers";

export function ShapeIcon({ shape, color, size = 14 }: { shape: Shape; color: string; size?: number }) {
  const s = SHAPES[shape];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      {s.mode === "fill" ? (
        <path d={s.d} fill={color} />
      ) : (
        <path d={s.d} fill="none" stroke={color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const Line = ({ color, dash, w = 2 }: { color: string; dash?: string; w?: number }) => (
  <svg width="22" height="8" aria-hidden className="shrink-0">
    <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" />
  </svg>
);

const ROWS: { id: Layer; label: string; note: string; sw: ReactNode }[] = [
  { id: "rivers", label: "Rivers & lakes", note: "rivers, reservoirs, lakes, wetlands", sw: <Line color="var(--river)" w={2.2} /> },
  { id: "streams", label: "Streams & tributaries", note: "small tributaries; appear when zoomed in", sw: <Line color="var(--river)" w={1} /> },
  { id: "roads", label: "Main roads", note: "motorway, trunk, primary, secondary", sw: <Line color="var(--road)" w={2.6} /> },
  { id: "tertiary", label: "Tertiary roads", note: "appear when zoomed in", sw: <Line color="var(--road)" w={1.2} /> },
  { id: "rail", label: "Rail & runways", note: "lines, stations, airport runways", sw: <Line color="var(--rail)" dash="4 2.5" w={2} /> },
  { id: "places", label: "Towns & villages", note: "names appear as you zoom", sw: <span className="inline-block w-[7px] h-[7px] rounded-full mx-[7px]" style={{ background: "var(--ink-2)" }} /> },
  { id: "facilities", label: "Facilities", note: "health, schools, banks, fuel, markets…", sw: <ShapeIcon shape="plus" color="var(--ink-2)" /> },
  { id: "streets", label: "City streets", note: "loads automatically when you zoom into a city", sw: <Line color="var(--road)" w={1} /> },
];

export function LayerPanel({
  layers,
  onToggle,
  fac,
  onFac,
  theme,
  lang,
  onLang,
  loading,
  errors,
  onJump,
  onClose,
}: {
  layers: Layer[];
  onToggle: (l: Layer) => void;
  fac: FacCat[];
  onFac: (c: FacCat) => void;
  theme: string;
  lang: Lang;
  onLang: (l: Lang) => void;
  loading: string[];
  errors: string[];
  onJump: (cityId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="panel absolute left-2 top-11 z-20 w-[268px] max-w-[calc(100%-16px)] max-h-[calc(100%-56px)] overflow-y-auto scroll-thin" style={{ background: "var(--panel)" }} role="dialog" aria-label="Detailed map layers">
      <div className="panel-title">
        <span className="grow">Detail layers</span>
        <button type="button" className="ctl" onClick={onClose} aria-label="Close layer panel">
          ✕
        </button>
      </div>
      <ul className="p-2 flex flex-col gap-0.5">
        {ROWS.map((r) => (
          <li key={r.id}>
            <label className="flex items-start gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--panel-2)]">
              <input type="checkbox" className="mt-[3px]" checked={layers.includes(r.id)} onChange={() => onToggle(r.id)} />
              <span className="grow min-w-0">
                <span className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink)" }}>
                  {r.sw}
                  {r.label}
                </span>
                <span className="block text-[10.5px] muted">{r.note}</span>
              </span>
            </label>
            {r.id === "facilities" && layers.includes("facilities") && (
              <div className="flex flex-wrap gap-1 pl-6 pb-1.5 pt-0.5" role="group" aria-label="Facility categories">
                {ALL_FAC_CATS.map((c) => (
                  <button key={c} type="button" className="ctl flex items-center gap-1.5" aria-pressed={fac.includes(c)} onClick={() => onFac(c)} title={FAC_META[c].note}>
                    <ShapeIcon shape={FAC_META[c].shape} color={facColor(c, theme)} />
                    {FAC_META[c].label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="px-3 pb-2">
        <div className="label mb-1">Place names</div>
        <div className="flex gap-1" role="group" aria-label="Label language">
          <button type="button" className="ctl" aria-pressed={lang === "en"} onClick={() => onLang("en")}>
            English
          </button>
          <button type="button" className="ctl am" aria-pressed={lang === "am"} onClick={() => onLang("am")}>
            አማርኛ
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <label className="label block mb-1" htmlFor="jump-city">
          Jump to a city
        </label>
        <select id="jump-city" className="ctl w-full" defaultValue="" onChange={(e) => e.target.value && onJump(e.target.value)}>
          <option value="" disabled>
            Choose a city…
          </option>
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {(loading.length > 0 || errors.length > 0) && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          {loading.length > 0 && <div className="muted mono">Loading {loading.length} layer file{loading.length > 1 ? "s" : ""}…</div>}
          {errors.length > 0 && (
            <div style={{ color: "var(--warn)" }}>Could not load: {errors.map((e) => e.replace("d-", "")).join(", ")}. Switch the layer off and on to retry.</div>
          )}
        </div>
      )}

      <p className="px-3 pb-3 text-[10px] muted leading-snug">
        Roads, rivers, facilities and places: © OpenStreetMap contributors (ODbL), via the Humanitarian OpenStreetMap Team on HDX. Volunteer-mapped data is incomplete in places; an empty area may simply be unmapped.
      </p>
    </div>
  );
}
