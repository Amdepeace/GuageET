"use client";
import type { SoilFile } from "@/lib/schema";
import { CONFLICT_COLORS, RAIN_COLORS, SOIL_COLORS, soilBreaks } from "./useRiskLayers";
import { MINERAL_KINDS } from "./useMineralLayers";
import { SHIP_COLORS } from "./useShippingLayer";
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
  { id: "rsdp", label: "RSDP road upgrades", note: "links upgraded in Road Sector Development Programme phases I–IV (ERA data, World Bank study); colour = phase", sw: <Line color="#7b6cf0" w={2.6} /> },
  { id: "rail", label: "Rail & runways", note: "lines, stations, airport runways", sw: <Line color="var(--rail)" dash="4 2.5" w={2} /> },
  { id: "places", label: "Towns & villages", note: "names appear as you zoom", sw: <span className="inline-block w-[7px] h-[7px] rounded-full mx-[7px]" style={{ background: "var(--ink-2)" }} /> },
  { id: "facilities", label: "Facilities", note: "health, schools, banks, fuel, markets…", sw: <ShapeIcon shape="plus" color="var(--ink-2)" /> },
  { id: "streets", label: "City streets", note: "loads automatically when you zoom into a city", sw: <Line color="var(--road)" w={1} /> },
  { id: "flows", label: "Trade corridors & flows", note: "arcs from Addis Ababa to the sea ports; partner trade arcs from UN Comtrade", sw: <Line color="var(--ink-2)" w={3} /> },
  { id: "conflict", label: "Conflict heatmap", note: "ACLED events by zone, last 12 months (HDX HAPI). Reported events only; unreported areas are under-counted", sw: <span className="inline-block w-[14px] h-[8px] mx-[4px]" style={{ background: "linear-gradient(90deg,#6a3a73,#d4546a,#fbc552)" }} /> },
  { id: "rainfall", label: "Rainfall vs normal", note: "last 90 days by region as % of the 1991–2020 average (ERA5 reanalysis, coarse screen for drought or flood)", sw: <span className="inline-block w-[14px] h-[8px] mx-[4px]" style={{ background: "linear-gradient(90deg,#cf9440,#3a4752,#37a39a)" }} /> },
  { id: "minerals", label: "Minerals & prospects", note: "mines and plants (2018 source), major deposits, exploration sites (USGS); positions approximate, records can be out of date", sw: <span className="inline-block w-[9px] h-[9px] mx-[6px] rounded-full" style={{ background: "#b8863f" }} /> },
  { id: "soil", label: "Soil properties", note: "zone averages of topsoil pH, organic carbon, phosphorus or clay (iSDAsoil model predictions, not field measurements)", sw: <span className="inline-block w-[14px] h-[8px] mx-[4px]" style={{ background: "linear-gradient(90deg,#6b4e30,#c99a58,#f0d29a)" }} /> },
  { id: "ships", label: "Ports & shipping", note: "port calls and chokepoint transits (IMF PortWatch, AIS-derived; near-live, a few days behind). Size = calls in 30 days; colour = change vs prior 30 days", sw: <span className="inline-block w-[9px] h-[9px] mx-[6px] rounded-full" style={{ background: "#0ea5c6" }} /> },
  { id: "density", label: "Facility density", note: "hexagon map of where facilities are mapped (categories below). Mapping effort varies by area, so it is not a measure of need", sw: <span className="inline-block w-[14px] h-[8px] mx-[4px] rounded-full" style={{ background: "radial-gradient(circle, var(--accent), transparent)" }} /> },
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
  deck,
  risk,
  soil,
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
  deck: { loading: boolean; error: string | null; partnerArcs: number; tradeReady: boolean };
  soil: { file: SoilFile; prop: string; onProp: (id: string) => void };
  risk: { through: string; available: boolean; windowMonths: number; rainFrom: string; rainTo: string; rainAvailable: boolean };
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
            {(r.id === "facilities" ? layers.includes("facilities") : r.id === "density" && layers.includes("density") && !layers.includes("facilities")) && (
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

      {(layers.includes("flows") || layers.includes("density")) && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          {deck.loading && <div className="muted mono">Loading deck.gl…</div>}
          {deck.error && <div style={{ color: "var(--warn)" }}>Could not draw the overlay: {deck.error}</div>}
          {layers.includes("flows") && !deck.tradeReady && <div className="muted">Partner trade arcs appear once UN Comtrade data has loaded (see the Trade panel). Corridor arcs show the sea-access routes, not trade volume.</div>}
          {layers.includes("flows") && deck.tradeReady && <div className="muted mono">{deck.partnerArcs} partner arcs · width = trade value · cyan exports, violet imports · zoom out to see them · click one for the country</div>}
        </div>
      )}

      {layers.includes("conflict") && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          <div className="label mb-1">Conflict events, 12 months to {risk.available ? risk.through : "—"}</div>
          {risk.available ? (
            <>
              <div className="flex items-stretch">
                {CONFLICT_COLORS.dark.map((c, i) => (
                  <span key={i} className="flex-1 h-[8px]" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mono muted mt-0.5">
                <span>0</span>
                <span>10</span>
                <span>30</span>
                <span>80</span>
                <span>200+</span>
              </div>
              <div className="muted mt-1">Grey = no data from the source for that zone (not zero). Click a zone for detail.</div>
            </>
          ) : (
            <div className="muted">Conflict data has not loaded yet.</div>
          )}
        </div>
      )}

      {layers.includes("soil") && (() => {
        const p = soil.file.properties.find((x) => x.id === soil.prop);
        const br = soilBreaks(soil.file, soil.prop);
        return (
          <div className="px-3 pb-2 text-[10.5px]" role="status">
            <div className="label mb-1">Soil · {soil.file.depth}</div>
            <select className="ctl w-full mb-1" value={soil.prop} onChange={(e) => soil.onProp(e.target.value)} aria-label="Soil property">
              {soil.file.properties.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label} ({x.unit})
                </option>
              ))}
            </select>
            <div className="flex items-stretch">
              {SOIL_COLORS.dark.map((c, i) => (
                <span key={i} className="flex-1 h-[8px]" style={{ background: c }} />
              ))}
            </div>
            <div className="flex justify-between mono muted mt-0.5">
              <span>&lt;{br[0]}</span>
              <span>{br[1]}</span>
              <span>{br[2]}</span>
              <span>&gt;{br[3]}</span>
            </div>
            <div className="muted mt-1">
              Classes are quintiles of the {Object.keys(p?.zones ?? {}).length} zone averages. Model predictions ({soil.file.license}, iSDAsoil), not field measurements. Click a zone.
            </div>
          </div>
        );
      })()}

      {layers.includes("ships") && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          <div className="label mb-1">Ports &amp; shipping · IMF PortWatch</div>
          <ul className="flex flex-col gap-0.5">
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-[9px] h-[9px] rounded-full" style={{ background: SHIP_COLORS.dark.up }} />
              port calls up 15% or more vs prior 30 days
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-[9px] h-[9px] rounded-full" style={{ background: SHIP_COLORS.dark.flat }} />
              within 15%, or no prior period
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-[9px] h-[9px] rounded-full" style={{ background: SHIP_COLORS.dark.down }} />
              down 15% or more
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-[9px] h-[9px] rounded-full border-2" style={{ borderColor: "var(--ink-2)" }} />
              chokepoint (transits per day)
            </li>
          </ul>
          <div className="muted mt-1">Near-live: PortWatch publishes several days behind, so each popup shows its as-of date. Not a live ship tracker. Click a port for detail.</div>
        </div>
      )}

      {layers.includes("minerals") && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          <div className="label mb-1">Mineral sites · USGS</div>
          <ul className="flex flex-col gap-0.5">
            {MINERAL_KINDS.map((k) => (
              <li key={k.k} className="flex items-center gap-1.5">
                <span className="inline-block w-[9px] h-[9px] rounded-full" style={{ background: k.dark }} />
                {k.label}
              </li>
            ))}
          </ul>
          <div className="muted mt-1">Click a point for commodities, status, operator and source. Facility status is as of 2018; exploration sites often lapse.</div>
        </div>
      )}

      {layers.includes("rainfall") && (
        <div className="px-3 pb-2 text-[10.5px]" role="status">
          <div className="label mb-1">
            Rainfall vs 1991–2020 normal{risk.rainAvailable ? `, ${risk.rainFrom} to ${risk.rainTo}` : ""}
          </div>
          {risk.rainAvailable ? (
            <>
              <div className="flex items-stretch">
                {RAIN_COLORS.dark.map((c, i) => (
                  <span key={i} className="flex-1 h-[8px]" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mono muted mt-0.5">
                <span>&lt;50%</span>
                <span>90</span>
                <span>110</span>
                <span>&gt;150%</span>
              </div>
              <div className="muted mt-1">Brown = drier than normal, teal = wetter. Grey = dry season, normal too small to rate. One sample point per region, so local rain can differ. Click a region.</div>
            </>
          ) : (
            <div className="muted">Rainfall data has not loaded yet.</div>
          )}
        </div>
      )}

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
