"use client";
import { reloadFresh } from "@/components/shell/ChunkRecovery";

// Shown if the page itself fails to load or run (for example, an old cached copy
// of the page after an update). Offers a clean reload instead of a bare error.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="panel p-5 max-w-[480px] flex flex-col gap-3">
        <h1 className="text-[15px] font-semibold">The dashboard could not finish loading</h1>
        <p className="text-[12.5px] ink2 leading-snug">This usually means your browser kept an old copy of the page from before the latest update. Reloading fetches the current version. If it keeps happening, the detail below helps to report it.</p>
        <div className="flex gap-2">
          <button type="button" className="ctl" onClick={() => reloadFresh(false)}>
            Reload the page
          </button>
          <button type="button" className="ctl" onClick={reset}>
            Try again
          </button>
        </div>
        <p className="mono text-[10.5px] muted break-words">{error.message?.slice(0, 200)}</p>
      </div>
    </main>
  );
}
