"use client";

import { useState } from "react";
import type { Arrangement } from "@/lib/music/arrange/types";
import type { BopEngine } from "@/lib/music/engine";
import { barIndexAt, secondsAt } from "@/lib/music/tempo";
import styles from "./Transport.module.css";

type Props = {
  playing: boolean;
  loadState: { state: "loading" | "ready" | "error"; progress: number };
  position: number;
  arrangement: Arrangement;
  rate: number;
  loop: boolean;
  engine: React.RefObject<BopEngine | null>;
  fileName: string;
  onToggle: () => void;
  onSeek: (beat: number) => void;
  onRate: (rate: number) => void;
  onLoop: (loop: boolean) => void;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5];

const clockText = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function Transport({ playing, loadState, position, arrangement, rate, loop, engine, fileName, onToggle, onSeek, onRate, onLoop }: Props) {
  const [rendering, setRendering] = useState(false);
  const total = arrangement.length;
  const seconds = (beat: number) => secondsAt(arrangement.tempos, beat);
  const grid = arrangement.grid;
  const bar = barIndexAt(grid, position);
  // One bar forward or back from where you are (bars can change length in a long piece).
  const stepBar = (direction: 1 | -1) => position + direction * (grid[direction === 1 ? bar : Math.max(0, bar - 1)]?.len ?? arrangement.barBeats);
  const progress = Math.min(1, position / total);
  const loading = loadState.state === "loading";

  async function saveWav() {
    const e = engine.current;
    if (!e || rendering) return;
    setRendering(true);
    try {
      download(await e.renderWav(arrangement), `${fileName}.wav`);
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.play}
        onClick={onToggle}
        disabled={loading && arrangement.styleId !== "pc81"}
        aria-label={playing ? "Pause" : "Play"}
        style={{ "--load": `${Math.round(loadState.progress * 100)}%` } as React.CSSProperties}
        data-loading={loading || undefined}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="5" width="4.5" height="14" rx="1.5" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2z" />
          </svg>
        )}
      </button>

      <div className={styles.timeline}>
        <div className={styles.status}>
          {loadState.state === "loading" ? (
            <span>Tuning the band… {Math.round(loadState.progress * 100)}%</span>
          ) : loadState.state === "error" ? (
            <span>Couldn’t load the instruments. Check your connection and reload.</span>
          ) : (
            <span>
              {clockText(seconds(position) / rate)} <span className={styles.dim}>/ {clockText(seconds(total) / rate)}</span>
            </span>
          )}
          <span className={styles.dim}>
            Bar {bar + 1} of {grid.length}
          </span>
        </div>
        <div
          className={styles.scrub}
          role="slider"
          tabIndex={0}
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={Math.round(seconds(total))}
          aria-valuenow={Math.round(seconds(position))}
          aria-valuetext={clockText(seconds(position))}
          onPointerDown={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            onSeek(((e.clientX - box.left) / box.width) * total);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(stepBar(1));
            else if (e.key === "ArrowLeft") onSeek(stepBar(-1));
            else if (e.key === "Home") onSeek(0);
            else return;
            e.preventDefault();
          }}
        >
          {arrangement.passes.map((pass, i) => (
            <span key={i} className={styles.pass} style={{ left: `${(pass.at / total) * 100}%`, width: `${(pass.length / total) * 100}%` }} />
          ))}
          <span className={styles.fill} style={{ width: `${progress * 100}%` }} />
          <span className={styles.thumb} style={{ left: `${progress * 100}%` }} />
        </div>
      </div>

      <div className={styles.tools}>
        <button type="button" className={styles.tool} onClick={() => onSeek(0)} aria-label="Back to start" title="Back to start">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 5v14M19 5.5v13a1 1 0 0 1-1.5.8L8.8 12.8a1 1 0 0 1 0-1.6l8.7-6.5a1 1 0 0 1 1.5.8z" />
          </svg>
        </button>
        <button type="button" className={styles.tool} aria-pressed={loop} onClick={() => onLoop(!loop)} aria-label="Loop" title="Loop">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
        <label className={styles.rate}>
          <span className={styles.srOnly}>Speed</span>
          <select value={rate} onChange={(e) => onRate(Number(e.target.value))}>
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.save}
          onClick={() => {
            const e = engine.current;
            if (e) download(e.midiFile(arrangement), `${fileName}.mid`);
          }}
        >
          MIDI
        </button>
        <button type="button" className={styles.save} onClick={saveWav} disabled={rendering || loading}>
          {rendering ? "Rendering…" : "WAV"}
        </button>
      </div>
    </div>
  );
}
