"use client";
import type { CountryFile, IndicatorConfig } from "@/lib/schema";
import { VitalTile } from "./VitalTile";

const GROUPS: { id: NonNullable<IndicatorConfig["group"]>; title: string; note: string }[] = [
  { id: "health", title: "Health & nutrition", note: "Child and maternal mortality, life expectancy, immunisation and hunger." },
  { id: "labour", title: "Jobs, poverty & inequality", note: "Unemployment is an ILO model estimate; poverty and inequality come from household surveys run every few years." },
  { id: "access", title: "Education & access", note: "Who can read, and who has power, phones, internet and safe water." },
  { id: "structure", title: "Economy structure", note: "Income per person, trade, farming's weight, and what the state collects." },
];

/** Social and structural indicators for Ethiopia, grouped. Same tiles, history, sources and neighbour comparison as the vitals strip. */
export function DevelopmentPanel({
  indicators,
  eth,
  staleSources,
  onOpen,
}: {
  indicators: IndicatorConfig[];
  eth: CountryFile;
  staleSources: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <section id="sec-development" aria-label="People and development indicators" className="panel p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
        <h2 className="label">People &amp; development</h2>
        <span className="text-[11px] muted">
          World Bank World Development Indicators. Annual, so the latest year is often one or two years behind; survey-based tiles carry a DATED tag when the latest figure is 4+ years old. Click a tile for history, sources and the neighbour comparison.
        </span>
      </div>
      <div className="space-y-3">
        {GROUPS.map((g) => {
          const list = indicators.filter((i) => i.group === g.id);
          if (!list.length) return null;
          return (
            <div key={g.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                <h3 className="text-[12px] font-semibold ink2">{g.title}</h3>
                <span className="text-[10.5px] muted">{g.note}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                {list.map((ind) => (
                  <VitalTile
                    key={ind.id}
                    ind={ind}
                    series={eth.series[ind.id]}
                    stale={staleSources.has(eth.series[ind.id]?.history.at(-1)?.source ?? "")}
                    onOpen={() => onOpen(ind.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
