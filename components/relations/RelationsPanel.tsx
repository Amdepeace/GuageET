"use client";
import type { CountryRelations } from "@/lib/relations";
import { compact } from "@/lib/format";
import { Field } from "../shell/Drawer";

function indValue(v: { value: number; year: string } | null, format: "count" | "usd" | "pct") {
  if (!v) return <span className="muted">—</span>;
  const s = format === "usd" ? `$${compact(v.value)}` : format === "pct" ? `${v.value.toFixed(1)}%` : compact(v.value);
  return (
    <>
      <span className="mono">{s}</span> <span className="muted text-[10px]">’{v.year.slice(2)}</span>
    </>
  );
}

export function RelationsPanel({ rel }: { rel: CountryRelations }) {
  const { blocs, bilateral, profile } = rel;
  const balance = bilateral ? bilateral.exports - bilateral.imports : null;

  return (
    <>
      {rel.isEthiopia && <p className="text-[12px] ink2">This is Ethiopia — the home country. Click another country to see its relations with Ethiopia.</p>}

      {/* indicators side by side */}
      <div>
        <div className="label mb-1">Key indicators · this country vs Ethiopia</div>
        <table className="grid text-[12px]">
          <thead>
            <tr>
              <th>Indicator</th>
              <th style={{ textAlign: "right" }}>{rel.country.name}</th>
              <th style={{ textAlign: "right" }}>Ethiopia</th>
            </tr>
          </thead>
          <tbody>
            {rel.indicators.map((i) => (
              <tr key={i.id}>
                <td>{i.label}</td>
                <td style={{ textAlign: "right" }}>{indValue(i.them, i.format)}</td>
                <td style={{ textAlign: "right" }} className="ink2">
                  {indValue(i.eth, i.format)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[10px] muted mt-1">
          <a href="https://data.worldbank.org/" target="_blank" rel="noreferrer">
            World Bank
          </a>{" "}
          · latest available year per country
        </div>
      </div>

      {/* shared organizations */}
      {!rel.isEthiopia && (
        <div>
          <div className="label mb-1">Shared organizations &amp; blocs</div>
          {blocs.shared.length ? (
            <div className="flex flex-wrap gap-1">
              {blocs.shared.map((b) => (
                <span key={b.id} className="mono text-[10.5px] px-1.5 py-0.5" style={{ border: "1px solid var(--accent)", color: "var(--accent)" }} title={`${b.name} — ${b.note}`}>
                  {b.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] muted">No shared blocs in the tracked set.</div>
          )}
          {(blocs.ethOnly.length > 0 || blocs.countryOnly.length > 0) && (
            <div className="text-[10.5px] muted mt-2 flex flex-col gap-0.5">
              {blocs.ethOnly.length > 0 && (
                <div>
                  <span className="ink2">Ethiopia only:</span> {blocs.ethOnly.map((b) => b.name).join(", ")}
                </div>
              )}
              {blocs.countryOnly.length > 0 && (
                <div>
                  <span className="ink2">{rel.country.name} only:</span> {blocs.countryOnly.map((b) => b.name).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* bilateral trade */}
      {!rel.isEthiopia && (
        <div>
          <div className="label mb-1">Bilateral trade with Ethiopia</div>
          {!rel.tradeAvailable ? (
            <div className="text-[12px] muted">
              Needs a UN Comtrade key (see the Trade panel). Once set, Ethiopia&apos;s exports to and imports from {rel.country.name} appear here.
            </div>
          ) : bilateral ? (
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <Field label="ETH exports">
                <span className="mono" style={{ color: "var(--cat-transport)" }}>
                  ${compact(bilateral.exports)}
                </span>
              </Field>
              <Field label="ETH imports">
                <span className="mono" style={{ color: "var(--cat-power)" }}>
                  ${compact(bilateral.imports)}
                </span>
              </Field>
              <Field label="Balance">
                <span className="mono">{balance! >= 0 ? "+" : "−"}${compact(Math.abs(balance!))}</span>
              </Field>
            </div>
          ) : (
            <div className="text-[12px] muted">No recorded Ethiopia trade with {rel.country.name} in {rel.tradePeriod || "the latest year"}.</div>
          )}
          {rel.tradeAvailable && (
            <div className="text-[10px] muted mt-1">
              <a href="https://comtradeplus.un.org/" target="_blank" rel="noreferrer">
                UN Comtrade
              </a>{" "}
              · {rel.tradePeriod} · Ethiopia-reported
            </div>
          )}
        </div>
      )}

      {/* curated profile */}
      {profile ? (
        <div className="flex flex-col gap-2">
          <div className="label">Relations profile</div>
          <Field label="Current">
            <span className="text-[12.5px]">{profile.current}</span>
          </Field>
          <Field label="History">
            <span className="text-[12.5px]">{profile.history}</span>
          </Field>
          <Field label="Economic ties / investment">
            <span className="text-[12.5px]">{profile.investment}</span>
          </Field>
          <div className="text-[11px]">
            {profile.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block">
                {s.title} ↗
              </a>
            ))}
          </div>
          <p className="text-[10.5px] muted">Curated background summary, reviewed monthly — not real-time reporting.</p>
        </div>
      ) : (
        !rel.isEthiopia && (
          <p className="text-[11.5px] muted">
            No curated relations profile for {rel.country.name} yet. The structured data above (indicators, shared blocs, trade) is sourced; curated profiles exist for Ethiopia&apos;s main partners.
          </p>
        )
      )}
    </>
  );
}
