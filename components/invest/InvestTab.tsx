"use client";
// Investment tab: sector guides (EIC's published claims, labelled as such), the
// World Bank public-finance pipeline, industrial parks, how to set up, the legal
// framework and due-diligence links. Information only; nothing here is advice or
// an offer, and every claim names its source and dating.
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CountryFile, EsxFile, InterbankFile, InvestFile, InvestPipelineFile, InvestSector } from "@/lib/schema";
import { compact } from "@/lib/format";

export type GoTarget = { layer?: string; section?: string };

const SUBNAV = [
  { id: "inv-overview", label: "Overview" },
  { id: "inv-sectors", label: "Sectors" },
  { id: "inv-pipeline", label: "Public pipeline" },
  { id: "inv-parks", label: "Industrial parks" },
  { id: "inv-start", label: "Setting up" },
  { id: "inv-legal", label: "Legal framework" },
  { id: "inv-resources", label: "Resources" },
];

function Badge({ s }: { s: InvestSector["foreign"]["status"] }) {
  return s === "opened" ? (
    <span className="mono text-[10px] px-1.5 border" style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
      OPENED TO FOREIGN INVESTORS (PER EIC)
    </span>
  ) : (
    <span className="mono text-[10px] px-1.5 border" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
      RULES NOT STATED: CHECK THE LAW
    </span>
  );
}

function SectorCard({ s, onGo }: { s: InvestSector; onGo: (t: GoTarget) => void }) {
  const [open, setOpen] = useState(false);
  const shown = open ? s.claims : s.claims.slice(0, 2);
  return (
    <article className="panel p-3 flex flex-col gap-2" id={`sector-${s.id}`}>
      <div className="flex items-start gap-2 flex-wrap">
        <h3 className="text-[14px] font-semibold grow">{s.name}</h3>
        <span className="text-[10.5px] muted">{s.group}</span>
      </div>
      <p className="text-[12px] ink2 leading-snug">{s.tagline}</p>
      <Badge s={s.foreign.status} />
      <p className="text-[11px] muted leading-snug">{s.foreign.note}</p>
      <div>
        <div className="label mb-0.5">What EIC and other sources say</div>
        <ul className="flex flex-col gap-1.5">
          {shown.map((c, i) => (
            <li key={i} className="text-[12px] leading-snug">
              {c.t} <span className="mono text-[10px] muted">[{c.asOf}]</span>
            </li>
          ))}
        </ul>
        {s.claims.length > 2 && (
          <button type="button" className="ctl mt-1" onClick={() => setOpen((v) => !v)}>
            {open ? "Show fewer" : `Show all ${s.claims.length} points`}
          </button>
        )}
      </div>
      <div>
        <div className="label mb-0.5">Opportunity types named</div>
        <div className="flex flex-wrap gap-1">
          {s.opportunities.map((o) => (
            <span key={o} className="text-[11px] px-1.5 py-0.5 border" style={{ borderColor: "var(--line-strong)" }}>
              {o}
            </span>
          ))}
        </div>
      </div>
      {s.onDashboard.length > 0 && (
        <div>
          <div className="label mb-0.5">Check against this dashboard&apos;s data</div>
          <div className="flex flex-wrap gap-1">
            {s.onDashboard.map((d) => (
              <button key={d.label} type="button" className="ctl" onClick={() => onGo(d)}>
                {d.label} →
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-[11px] flex flex-wrap gap-x-3 mt-auto">
        {s.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
            {l.title} ↗
          </a>
        ))}
      </div>
    </article>
  );
}

export function InvestTab({
  invest,
  pipeline,
  eth,
  esx,
  rates,
  onGo,
  initialSector,
}: {
  invest: InvestFile;
  pipeline: InvestPipelineFile;
  eth: CountryFile;
  esx: EsxFile;
  rates: InterbankFile;
  onGo: (t: GoTarget) => void;
  initialSector?: string | null;
}) {
  const [group, setGroup] = useState<string>("All");
  const [q, setQ] = useState(initialSector ?? "");
  const [status, setStatus] = useState<"Pipeline" | "Active" | "All">("Pipeline");
  const [pq, setPq] = useState("");
  const [allRows, setAllRows] = useState(false);

  const sectors = useMemo(() => {
    const t = q.trim().toLowerCase();
    return invest.sectors.filter((s) => (group === "All" || s.group === group) && (!t || `${s.name} ${s.tagline} ${s.opportunities.join(" ")}`.toLowerCase().includes(t)));
  }, [invest.sectors, group, q]);

  const projects = useMemo(() => {
    const t = pq.trim().toLowerCase();
    return pipeline.projects.filter((p) => (status === "All" || p.status === status) && (!t || `${p.name} ${p.sector} ${p.agency} ${p.instrument} ${p.objective}`.toLowerCase().includes(t)));
  }, [pipeline.projects, status, pq]);
  const rows = allRows ? projects : projects.slice(0, 20);
  const total = projects.reduce((s, p) => s + p.commitmentUsd, 0);

  const fdi = eth.series.fdi?.history ?? [];
  const lastFdi = fdi.at(-1);
  const ibLatest = rates.available ? rates.weeks.filter((w) => w.maturity === "overnight").at(-1) : undefined;
  const axis = { fontSize: 10, fill: "var(--ink-3)" };

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3" role="note">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="mono text-[11px] px-1.5 border" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
            INFORMATION ONLY · NOT INVESTMENT ADVICE
          </span>
          <span className="mono text-[10.5px] muted">curated {invest.lastVerified}</span>
        </div>
        <p className="text-[12px] ink2 leading-snug">{invest.notice}</p>
      </div>

      <nav aria-label="Investment sections" className="sticky top-[34px] z-20 -mx-2 md:-mx-3 px-2 md:px-3 py-1 flex items-center gap-1 overflow-x-auto border-b" style={{ background: "var(--bg)", borderColor: "var(--line)" }}>
        {SUBNAV.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 text-[11px] px-2 py-1" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
            {s.label}
          </a>
        ))}
      </nav>

      {/* overview */}
      <section id="inv-overview" className="panel">
        <div className="panel-title">
          <span>OVERVIEW · Investment context from this dashboard</span>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,420px)] gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="label">FDI inflows</div>
              <div className="mono text-[20px]">{lastFdi ? `$${compact(lastFdi.value)}` : "—"}</div>
              <div className="text-[10.5px] muted">{lastFdi ? `${lastFdi.period} · World Bank` : ""}</div>
            </div>
            <div>
              <div className="label">ESX listed companies</div>
              <div className="mono text-[20px]">{esx.available ? esx.companies.length : "—"}</div>
              <div className="text-[10.5px] muted">Ethiopian Securities Exchange</div>
            </div>
            <div>
              <div className="label">Interbank overnight rate</div>
              <div className="mono text-[20px]">{ibLatest ? `${ibLatest.rate.toFixed(2)}%` : "—"}</div>
              <div className="text-[10.5px] muted">{ibLatest ? `week ending ${ibLatest.end} · ESX` : ""}</div>
            </div>
            <div>
              <div className="label">World Bank pipeline</div>
              <div className="mono text-[20px]">{pipeline.available ? pipeline.projects.filter((p) => p.status === "Pipeline").length : "—"}</div>
              <div className="text-[10.5px] muted">public projects in preparation</div>
            </div>
          </div>
          <div>
            <div className="label mb-1">Foreign direct investment inflows (USD)</div>
            <div style={{ width: "100%", height: 120 }}>
              <ResponsiveContainer>
                <LineChart data={fdi.map((o) => ({ year: o.period.slice(0, 4), v: o.value }))} margin={{ top: 4, right: 6, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="year" tick={axis} interval="preserveStartEnd" />
                  <YAxis tick={axis} tickFormatter={(v) => compact(v as number)} />
                  <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 }} formatter={(v) => `$${compact(v as number)}`} />
                  <Line dataKey="v" name="FDI inflows" stroke="#0ea5c6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          <button type="button" className="ctl" onClick={() => onGo({ section: "sec-risk" })}>
            Risk: stress matrix, conflict and projections →
          </button>
          <button type="button" className="ctl" onClick={() => onGo({ section: "sec-markets" })}>
            Markets: ESX and interbank rates →
          </button>
          <button type="button" className="ctl" onClick={() => onGo({ layer: "minerals" })}>
            Map: minerals and prospects →
          </button>
          <button type="button" className="ctl" onClick={() => onGo({ section: "sec-economy" })}>
            Debt, IMF programme and humanitarian context →
          </button>
        </div>
      </section>

      {/* sectors */}
      <section id="inv-sectors" className="flex flex-col gap-2">
        <div className="panel-title panel flex-wrap">
          <span>SECTORS · {sectors.length} of {invest.sectors.length}</span>
          <span className="grow" />
          <input className="ctl" style={{ width: 200 }} placeholder="Search sectors…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sectors" />
          {["All", ...invest.groups].map((g) => (
            <button key={g} type="button" className="ctl" aria-pressed={group === g} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {sectors.map((s) => (
            <SectorCard key={s.id} s={s} onGo={onGo} />
          ))}
          {sectors.length === 0 && <div className="text-[12px] muted p-3">No sector matches.</div>}
        </div>
        <p className="text-[10.5px] muted leading-snug px-1">
          Source for all sector points unless a card says otherwise: Ethiopian Investment Commission,{" "}
          <a href={invest.eic.url} target="_blank" rel="noreferrer">
            {invest.eic.url.replace("https://", "")} ↗
          </a>
          , pages carrying a 2023 copyright. These are the agency&apos;s promotional claims and projections, not audited statistics; &quot;target&quot; and &quot;projection&quot; mark forward-looking figures.
        </p>
      </section>

      {/* pipeline */}
      <section id="inv-pipeline" className="panel">
        <div className="panel-title flex-wrap">
          <span>PUBLIC PIPELINE · World Bank projects in Ethiopia</span>
          <span className="grow" />
          {(["Pipeline", "Active", "All"] as const).map((s) => (
            <button key={s} type="button" className="ctl" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input className="ctl" style={{ width: 220 }} placeholder="Search projects…" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Search projects" />
            <span className="text-[11px] muted">
              {projects.length} projects · listed commitments ${compact(total)} · fetched {pipeline.fetchedAt.slice(0, 10)}
            </span>
          </div>
          {pipeline.available ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left muted text-[10.5px]">
                    <th className="font-normal py-1">Project</th>
                    <th className="font-normal">Status</th>
                    <th className="font-normal">Instrument</th>
                    <th className="font-normal text-right pr-2">Commitment</th>
                    <th className="font-normal pl-4">Approved</th>
                    <th className="font-normal">Bank sector label</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--line)] align-top">
                      <td className="py-1.5 pr-2" style={{ maxWidth: 420 }}>
                        <a href={p.url} target="_blank" rel="noreferrer">
                          {p.name}
                        </a>
                        {p.agency && <div className="text-[10.5px] muted">{p.agency}</div>}
                      </td>
                      <td className="pr-2">{p.status}</td>
                      <td className="pr-2 ink2">{p.instrument.replace(" Financing", "")}</td>
                      <td className="mono text-right pr-2">{p.commitmentUsd ? `$${compact(p.commitmentUsd)}` : "not stated"}</td>
                      <td className="mono pr-2 pl-4">{p.approved || "—"}</td>
                      <td className="ink2">{p.sector || "not labelled"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {projects.length > 20 && (
                <button type="button" className="ctl mt-2" onClick={() => setAllRows((v) => !v)}>
                  {allRows ? "Show first 20" : `Show all ${projects.length}`}
                </button>
              )}
            </div>
          ) : (
            <div className="text-[12px] muted">{pipeline.note}</div>
          )}
          <p className="text-[10.5px] muted leading-snug">
            {pipeline.note}{" "}
            <a href={pipeline.sourceUrl} target="_blank" rel="noreferrer">
              World Bank ↗
            </a>
          </p>
        </div>
      </section>

      {/* parks */}
      <section id="inv-parks" className="panel">
        <div className="panel-title">
          <span>INDUSTRIAL PARKS &amp; SPECIAL ECONOMIC ZONES</span>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ul className="flex flex-col gap-2">
            {invest.parks.summary.map((s) => (
              <li key={s.kind} className="text-[12px] leading-snug">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold">
                  {s.kind} ↗
                </a>
                <div className="ink2">{s.text}</div>
              </li>
            ))}
          </ul>
          <div>
            <div className="label mb-1">Agro-industrial park terms stated by EIC</div>
            <ul className="text-[12px] flex flex-col gap-1 list-disc ml-4">
              {invest.parks.agroTerms.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="px-3 pb-3 text-[10.5px] muted leading-snug">
          {invest.parks.note} Source:{" "}
          <a href={invest.parks.source.url} target="_blank" rel="noreferrer">
            {invest.parks.source.title} ↗
          </a>{" "}
          ({invest.parks.asOf}).
        </p>
      </section>

      {/* setting up */}
      <section id="inv-start" className="panel">
        <div className="panel-title">
          <span>SETTING UP · Requirements as stated by EIC</span>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <dl className="flex flex-col gap-2">
            {invest.process.items.map((i) => (
              <div key={i.label}>
                <dt className="label">{i.label}</dt>
                <dd className="text-[12.5px]">{i.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <div className="label mb-1">Typical steps (company route)</div>
            <ol className="list-decimal ml-4 text-[12px] flex flex-col gap-1">
              {invest.process.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
        <p className="px-3 pb-3 text-[10.5px] muted leading-snug">
          {invest.process.asOf}. Source:{" "}
          <a href={invest.process.source.url} target="_blank" rel="noreferrer">
            {invest.process.source.title} ↗
          </a>
          . Requirements and fees change; confirm with EIC ({invest.eic.contact}) before relying on them.
        </p>
      </section>

      {/* legal */}
      <section id="inv-legal" className="panel">
        <div className="panel-title">
          <span>LEGAL FRAMEWORK · Official documents (links only)</span>
        </div>
        <ul className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
          {invest.legal.map((l) => (
            <li key={l.url} className="text-[12px] leading-snug">
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.title} ↗
              </a>
              <div className="text-[11px] muted">{l.note}</div>
            </li>
          ))}
        </ul>
        <p className="px-3 pb-3 text-[10.5px] muted leading-snug">
          These are EIC&apos;s published documents. Some are scanned images, so this dashboard does not summarise or interpret them: which areas are open, restricted or reserved for foreign investors is set in the regulation itself. Take legal advice.
        </p>
      </section>

      {/* resources */}
      <section id="inv-resources" className="panel">
        <div className="panel-title">
          <span>RESOURCES · Where to verify and find live opportunities</span>
        </div>
        <ul className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
          {invest.resources.map((r) => (
            <li key={r.url} className="text-[12px] leading-snug">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold">
                {r.name} ↗
              </a>
              <div className="text-[11px] ink2">{r.what}</div>
            </li>
          ))}
        </ul>
        <p className="px-3 pb-3 text-[10.5px] muted leading-snug">
          Not covered here: Ethiopian Investments Holding&apos;s live privatisation list (its site did not respond when checked) and e-GP government tenders (the portal&apos;s security certificate failed verification, so it was not accessed). Ask the issuer directly for current offers.
        </p>
      </section>
    </div>
  );
}
