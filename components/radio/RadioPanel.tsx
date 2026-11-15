"use client";
// Live radio: one shared <audio> element, loaded only when a listener presses
// play (preload="none"), streaming straight from the station's own host. A small
// fixed player keeps the controls on screen while the page scrolls.
import { useEffect, useRef, useState } from "react";
import type { RadioFile, RadioStation } from "@/lib/schema";

type Status = "idle" | "loading" | "playing" | "error";

export function RadioPanel({ data }: { data: RadioFile }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<RadioStation | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audio.current;
    return () => {
      el?.pause();
    };
  }, []);

  const play = (s: RadioStation) => {
    const el = audio.current;
    if (!el) return;
    if (current?.id === s.id && status === "playing") {
      el.pause();
      return;
    }
    setCurrent(s);
    setStatus("loading");
    el.src = s.url;
    el.play().catch(() => setStatus("error"));
  };

  const stop = () => {
    const el = audio.current;
    if (!el) return;
    el.pause();
    el.removeAttribute("src");
    el.load();
    setCurrent(null);
    setStatus("idle");
  };

  return (
    <div className="panel">
      <div className="panel-title flex-wrap">
        <span>RADIO · Ethiopian stations</span>
        <span className="grow" />
        {data.available && <span className="mono normal-case tracking-normal muted">{data.stations.length} stations</span>}
      </div>
      <div className="p-3 flex flex-col gap-2">
        {/* the one audio element; its events drive the status */}
        <audio
          ref={audio}
          preload="none"
          onPlaying={() => setStatus("playing")}
          onWaiting={() => setStatus((s) => (s === "idle" ? s : "loading"))}
          onPause={() => setStatus((s) => (s === "error" ? s : "idle"))}
          onError={() => setStatus("error")}
        />
        {!data.available || data.stations.length === 0 ? (
          <div className="text-[12px] muted">{data.note}</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4">
            {data.stations.map((s) => {
              const active = current?.id === s.id;
              const st = active ? status : "idle";
              return (
                <li key={s.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-b-0">
                  <button
                    type="button"
                    className="ctl shrink-0"
                    style={{ width: 54 }}
                    aria-pressed={st === "playing" || st === "loading"}
                    aria-label={`${st === "playing" ? "Pause" : "Play"} ${s.name}`}
                    onClick={() => play(s)}
                  >
                    {st === "playing" ? "❚❚" : st === "loading" ? "…" : "▶"}
                  </button>
                  <div className="min-w-0 grow">
                    <div className="text-[12.5px] truncate" title={s.name}>
                      {s.name}
                    </div>
                    <div className="text-[10.5px] muted truncate">
                      {[s.language, s.codec && `${s.codec} ${s.bitrate} kbps`, s.tags && s.tags.split(",").slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                      {st === "error" && <span style={{ color: "var(--warn)" }}> · stream unavailable</span>}
                    </div>
                  </div>
                  {s.homepage && (
                    <a href={s.homepage} target="_blank" rel="noreferrer" className="text-[10.5px] shrink-0" aria-label={`${s.name} website`}>
                      site ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10.5px] muted leading-snug">
          {data.note} Pressing play connects your browser to the station&apos;s stream host, not to this site. Directory:{" "}
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            Radio Browser ↗
          </a>
          . Last directory check of the listed streams: {data.stations.map((s) => s.lastCheck).sort().at(-1) ?? "—"}.
        </p>
      </div>

      {current && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-3 z-40 flex items-center gap-3 px-3 py-2 border" style={{ background: "var(--panel)", borderColor: "var(--line-strong)", maxWidth: "calc(100vw - 24px)" }} role="status" aria-live="polite">
          <span className="mono text-[10.5px] muted">{status === "playing" ? "LIVE" : status === "loading" ? "CONNECTING" : status === "error" ? "UNAVAILABLE" : "PAUSED"}</span>
          <span className="text-[12.5px] truncate" style={{ maxWidth: 220 }}>
            {current.name}
          </span>
          <button type="button" className="ctl" onClick={() => (status === "playing" ? audio.current?.pause() : play(current))}>
            {status === "playing" ? "Pause" : "Play"}
          </button>
          <label className="flex items-center gap-1 text-[11px] muted">
            Vol
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" />
          </label>
          <button type="button" className="ctl" onClick={stop} aria-label="Stop and close player">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
