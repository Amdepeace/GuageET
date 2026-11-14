"use client";
import type { DashboardData } from "@/lib/data";
import { EXPORTS, download } from "@/lib/export";
import type { HealthStatus } from "@/lib/schema";
import sourcesJson from "@/config/sources.json";

type SourceMeta = { name: string; provides: string; cadence: string; access: string; url: string; statusKey: string | null };
const SOURCES = (sourcesJson as { sources: SourceMeta[] }).sources;

export function AboutPanel({ data, statusOf }: { data: DashboardData; statusOf: (key: string) => HealthStatus | null }) {
  return (
    <>
      <section>
        <div className="label mb-1">How to read this dashboard</div>
        <ul className="text-[12px] flex flex-col gap-1.5 leading-snug">
          <li>
            <b>Every figure shows its source and the period it describes.</b> Annual statistics lag by one to two years; the period label says so instead of implying they are current.
          </li>
          <li>
            <span className="st NOMINAL">NOMINAL</span> last fetch succeeded on time · <span className="st DELAYED">DELAYED</span> the latest fetch failed but the last good value is still fresh ·{" "}
            <span className="st OFFLINE">OFFLINE</span> no success within twice the expected interval; values shown are the last good ones, marked <span className="stale-tag">STALE</span>.
          </li>
          <li>
            <b>Nothing is estimated.</b> A failed fetch keeps the last good value with its original date. The one computed line is &ldquo;Other (residual)&rdquo; in the debt breakdown, labelled as such.
          </li>
          <li>
            <b>Curated</b> records (infrastructure, relations profiles, bloc membership, IMF-programme and event dates) are written by hand with source links and a last-verified date.{" "}
            <span className="unverified-tag">UNVERIFIED</span> means sources conflict or no current status was found.
          </li>
          <li>
            <b>Sources can disagree.</b> The vital shown is the primary source (World Bank); other sources, such as the IMF, are listed in the detail card with their own period.
          </li>
          <li>
            <b>The detailed map is volunteer-mapped.</b> Roads, rivers, towns and facilities come from OpenStreetMap (© OpenStreetMap contributors, ODbL). Coverage is uneven, so an empty area may simply be unmapped, and details can be out of date.
          </li>
          <li>
            <b>This dashboard reports; it does not forecast.</b> Map lines for infrastructure are schematic, not surveyed routes. Disputed areas are drawn dashed, never as settled borders.
          </li>
        </ul>
      </section>

      <section>
        <div className="label mb-1">Download the data</div>
        <div className="flex flex-col gap-1.5">
          {EXPORTS.map((set) => (
            <button key={set.key} type="button" className="ctl text-left" onClick={() => download(set, data)}>
              ⤓ {set.label}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] muted mt-1">Built in your browser from what is on this page; each row keeps its source, source link and fetch time.</p>
      </section>

      <section>
        <div className="label mb-1">Sources · {SOURCES.length}</div>
        <ul className="flex flex-col">
          {SOURCES.map((s) => {
            const st = s.statusKey ? statusOf(s.statusKey) : null;
            return (
              <li key={s.name} className="py-2 border-b last:border-b-0 border-[var(--line)] text-[12px]">
                <div className="flex items-center gap-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="grow font-semibold" style={{ color: "var(--ink)" }}>
                    {s.name} ↗
                  </a>
                  {st && <span className={`st ${st}`}>{st}</span>}
                </div>
                <div className="ink2">{s.provides}</div>
                <div className="text-[10.5px] muted">
                  {s.cadence} · {s.access}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[10.5px] muted">
        An independent monitoring tool built from open data; not affiliated with any of the organisations listed. Source code and data:{" "}
        <a href="https://github.com/Amdepeace/GuageET" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        .
      </p>
    </>
  );
}
