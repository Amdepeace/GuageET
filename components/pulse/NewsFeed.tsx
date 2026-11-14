"use client";
import type { HealthStatus, NewsFile } from "@/lib/schema";
import { ago, shortDate } from "@/lib/format";

export function NewsFeed({ news, status, now }: { news: NewsFile; status: HealthStatus; now: number | null }) {
  const items = news.items ?? [];
  return (
    <div className="panel flex flex-col">
      <div className="panel-title">
        <span>COMMS · Headlines</span>
        <span className="grow" />
        <span className={`st ${status}`}>{status}</span>
      </div>
      <div className="max-h-[240px] overflow-y-auto scroll-thin">
        {items.length === 0 ? (
          <div className="px-3 py-3 text-[12px] muted">
            No headlines yet. The scheduled job pulls Ethiopia economy and infrastructure headlines from GDELT and Ethiopian outlets; they appear here after the first successful run.
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map((it, i) => (
              <li key={i} className="px-3 py-1.5 border-b last:border-b-0 border-[var(--line)] text-[12px] leading-snug">
                <a href={it.url} target="_blank" rel="noreferrer" className="block">
                  {it.title}
                </a>
                <div className="text-[10px] muted mono mt-0.5">
                  {it.domain} · {now ? `${ago(it.seenAt, now)} ago` : shortDate(it.seenAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-3 py-2 text-[10px] muted flex flex-wrap gap-x-2">
        <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer">
          GDELT
        </a>
        <span>
          · Capital Ethiopia · The Reporter · Addis Fortune (RSS, headlines and links only) · economy and infrastructure topics
        </span>
        {news.fetchedAt && now && <span className="mono">· fetched {ago(news.fetchedAt, now)} ago</span>}
      </div>
    </div>
  );
}
