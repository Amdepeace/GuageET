"use client";
import type { EsxCalendar, EsxFile, HealthStatus } from "@/lib/schema";

type Parts = { date: string; dow: number; minutes: number };

/** wall-clock date, weekday (0 = Sunday) and minutes since midnight in Addis Ababa */
function eat(d: Date): Parts {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, dow, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type Status = { label: string; tone: "open" | "pre" | "closed"; detail: string };

function status(cal: EsxCalendar, now: Date): Status {
  const t = eat(now);
  const lastHoliday = cal.holidays.map((h) => h.date).sort().at(-1) ?? "";
  const holiday = cal.holidays.find((h) => h.date === t.date);
  const beyond = t.date > lastHoliday;
  const weekend = t.dow === 0 || t.dow === 6;
  const [pre, cont] = cal.sessions;
  if (holiday) return { label: "CLOSED", tone: "closed", detail: `Holiday: ${holiday.name}${holiday.tentative ? " (tentative date)" : ""}` };
  if (weekend) return { label: "CLOSED", tone: "closed", detail: "Weekend (assumed non-trading)" };
  const caveat = beyond ? " Scheduled hours only: ESX's published holiday list ends " + lastHoliday + ", so a holiday closure may not be reflected." : "";
  if (t.minutes >= mins(pre.from) && t.minutes < mins(pre.to)) return { label: "PRE-OPEN", tone: "pre", detail: `Opening auction until ${pre.to} EAT.${caveat}` };
  if (t.minutes >= mins(cont.from) && t.minutes < mins(cont.to)) return { label: "OPEN", tone: "open", detail: `Continuous trading until ${cont.to} EAT.${caveat}` };
  return { label: "CLOSED", tone: "closed", detail: (t.minutes < mins(pre.from) ? `Opens ${pre.from} EAT today.` : "Closed for the day.") + caveat };
}

export function EsxPanel({ data, cal, now, health }: { data: EsxFile; cal: EsxCalendar; now: Date | null; health: HealthStatus }) {
  const st = now ? status(cal, now) : null;
  const tone = st?.tone === "open" ? "var(--ok)" : st?.tone === "pre" ? "var(--warn)" : "var(--ink-3)";
  const sectors = new Map<string, number>();
  for (const c of data.companies) sectors.set(c.sector, (sectors.get(c.sector) ?? 0) + 1);
  const upcoming = now ? cal.holidays.filter((h) => h.date >= eat(now).date) : [];

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>MARKETS · Ethiopian Securities Exchange</span>
        <span className="grow" />
        <span className={`st ${health}`}>{health}</span>
      </div>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="label">Market status</div>
            {st ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: tone }} />
                  <span className="mono text-[20px]">{st.label}</span>
                </div>
                <p className="text-[11.5px] ink2 leading-snug">{st.detail}</p>
              </>
            ) : (
              <span className="mono muted">—</span>
            )}
          </div>
          <div>
            <div className="label mb-1">Sessions (EAT)</div>
            <ul className="text-[12px]">
              {cal.sessions.map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="mono">
                    {s.from} – {s.to}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label mb-1">Closing days listed by ESX</div>
            {upcoming.length ? (
              <ul className="text-[12px]">
                {upcoming.map((h) => (
                  <li key={h.date} className="flex justify-between gap-2">
                    <span>{h.name}{h.tentative ? " (tentative)" : ""}</span>
                    <span className="mono">{h.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11.5px] muted">None listed after today. ESX&apos;s list runs to {cal.holidays.map((h) => h.date).sort().at(-1)}.</p>
            )}
          </div>
        </div>

        <div>
          <div className="label mb-1">
            Listed companies · {data.available ? data.companies.length : "—"}
            {data.available && <span className="muted normal-case tracking-normal"> · {[...sectors.entries()].map(([s, n]) => `${n} ${s.toLowerCase()}`).join(", ")}</span>}
          </div>
          {data.available ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left muted text-[10.5px]">
                    <th className="font-normal py-1">Company</th>
                    <th className="font-normal">Symbol</th>
                    <th className="font-normal">Sector</th>
                    <th className="font-normal text-right">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((c) => (
                    <tr key={c.symbol} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-2">
                        <a href={c.url} target="_blank" rel="noreferrer">
                          {c.name.replace(/ Share Company$/, "")}
                        </a>
                      </td>
                      <td className="mono">{c.symbol}</td>
                      <td className="ink2">{c.sector}</td>
                      <td className="mono text-right">{c.listed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12px] muted">{data.note}</p>
          )}
        </div>
      </div>
      <p className="px-3 pb-3 text-[10.5px] muted leading-snug">
        Status is computed in your browser from ESX&apos;s published hours and holiday list (verified {cal.lastVerified}); it is not a live feed from the exchange. {cal.note}{" "}
        <b>No prices are shown:</b> these ESX pages do not publish any, and nothing is estimated. Sources:{" "}
        <a href={cal.source.url} target="_blank" rel="noreferrer">
          Trading &amp; Operations ↗
        </a>
        ,{" "}
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          Listed Companies ↗
        </a>
        .
      </p>
    </div>
  );
}
