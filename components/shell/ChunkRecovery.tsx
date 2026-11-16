"use client";
// After a deploy, a page cached in the browser (or on the Pages CDN) can point at
// script files that no longer exist, which leaves parts of the page stuck on a
// loading message. This reloads once, bypassing the cache, when a script chunk
// fails to load, and offers a manual reload button if the map is slow.
import { useEffect, useState } from "react";

const CHUNK_ERR = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/** reload to a cache-busted URL; at most once per tab session so it can never loop */
export function reloadFresh(auto: boolean) {
  try {
    if (auto) {
      if (sessionStorage.getItem("ev-chunk-reload")) return;
      sessionStorage.setItem("ev-chunk-reload", String(Date.now()));
    }
  } catch {
    if (auto) return; // storage blocked: do not risk a reload loop
  }
  const u = new URL(window.location.href);
  u.searchParams.set("v", String(Date.now()));
  window.location.replace(u.toString());
}

export function ChunkRecovery() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      if (CHUNK_ERR.test(e.message ?? "") || CHUNK_ERR.test(String(e.error?.name ?? ""))) reloadFresh(true);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; name?: string } | undefined;
      if (CHUNK_ERR.test(r?.message ?? "") || CHUNK_ERR.test(r?.name ?? "")) reloadFresh(true);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}

/** the map placeholder: after 12 seconds it says so and offers a reload */
export function MapLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="panel h-full min-h-[380px] flex flex-col items-center justify-center gap-2 label" role="status">
      <span>Acquiring map…</span>
      {slow && (
        <>
          <span className="normal-case tracking-normal text-[12px] muted max-w-[320px] text-center">This is taking longer than expected. A recent update may have left an old copy of the page in your browser, or the connection is slow.</span>
          <button type="button" className="ctl" onClick={() => reloadFresh(false)}>
            Reload the page
          </button>
        </>
      )}
    </div>
  );
}
