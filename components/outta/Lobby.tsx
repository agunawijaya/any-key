"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SCREENS } from "@/lib/outta/campaign";
import { dailyFor, type Daily } from "@/lib/outta/daily";
import { LEVELS, type LevelId } from "@/lib/outta/levels";
import { ACHIEVEMENTS, updateProgress, useProgress } from "@/lib/outta/progress";
import { fmt } from "./shared";
import styles from "./Lobby.module.css";

export type ModeId = "run" | "screens" | "daily" | "versus" | "1980";

const MODES: { id: ModeId; name: string; blurb: string; key: string }[] = [
  { id: "run", name: "Run", blurb: "One screen, the rain, three speeds", key: "R" },
  { id: "screens", name: "Screens", blurb: "Thirty screens on five old computers", key: "S" },
  { id: "daily", name: "Daily Escape", blurb: "The same screen for everyone today", key: "D" },
  { id: "versus", name: "Versus", blurb: "Two stars, one keyboard, first one out", key: "V" },
  { id: "1980", name: "1980 mode", blurb: "The original program, bugs and all", key: "1" },
];

let cachedDaily: Daily | null = null;
const noSubscribe = () => () => {};

/** Today's Daily Escape, by this browser's date (so it is only known once the page runs in the browser). */
export function useDaily() {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const now = dailyFor();
      if (!cachedDaily || cachedDaily.key !== now.key) cachedDaily = now;
      return cachedDaily;
    },
    () => null,
  );
}

/** The hero's little screen: a fixed scatter of blocks, the same on the server and in the browser. */
const MINI = (() => {
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out: number[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 24; c++) {
      const clear = (r >= 2 && r <= 7 && c <= 15) || r === 12;
      const roll = rnd();
      out.push(!clear && roll < 0.3 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  }
  return out;
})();

function Icon({ mode }: { mode: ModeId }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (mode === "run")
    return (
      <svg {...common}>
        <path d="M5 12h12" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    );
  if (mode === "screens")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
      </svg>
    );
  if (mode === "daily")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </svg>
    );
  if (mode === "versus")
    return (
      <svg {...common}>
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="9" r="3" />
        <path d="M3 19c1-3 3-4 5-4s4 1 5 4" />
        <path d="M11 19c1-3 3-4 5-4s4 1 5 4" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 9l3 2-3 2" />
      <path d="M12 14h4" />
    </svg>
  );
}

export function Lobby({ onChoose }: { onChoose: (mode: ModeId) => void }) {
  const progress = useProgress();
  const daily = useDaily();
  const today = daily ? progress.daily[daily.key] : undefined;
  const starCount = Object.values(progress.screens).reduce((a, b) => a + b.stars, 0);
  const level = progress.level;
  const setLevel = (id: LevelId) => updateProgress((p) => ({ ...p, level: id }));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      const mode = MODES.find((m) => m.key.toLowerCase() === e.key.toLowerCase());
      if (mode) onChoose(mode.id);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onChoose]);

  const meta = (id: ModeId) => {
    if (id === "run") {
      const best = progress.best[level];
      return `${LEVELS[level].name}${best ? ` · best ${fmt(best.time)} s` : ""}`;
    }
    if (id === "screens") return `${starCount} / ${SCREENS.length * 3} ★`;
    if (id === "daily") {
      if (!daily) return " ";
      return today ? (today.won ? `#${daily.number} · out in ${fmt(today.time)} s ✓` : `#${daily.number} · caught today, practise on`) : `#${daily.number} · not tried yet`;
    }
    if (id === "versus") return "2 players · one keyboard";
    return "TRS-80 · white phosphor";
  };

  return (
    <div className={styles.lobby}>
      <section className={styles.hero}>
        <div className={styles.monitorWrap} aria-hidden>
          <div className={styles.monitor}>
            <div className={styles.mini}>
              {MINI.map((b, i) => (
                <span key={i} data-b={b} />
              ))}
            </div>
            <div className={styles.scape}>
              <svg className={styles.heroStar} viewBox="-35 -35 70 70">
                <ellipse cx="0" cy="30" rx="18" ry="4" className={styles.shadow} />
                <g className={styles.starBody}>
                  <rect x="-7" y="-27" width="14" height="54" rx="7" />
                  <rect x="-7" y="-27" width="14" height="54" rx="7" transform="rotate(60)" />
                  <rect x="-7" y="-27" width="14" height="54" rx="7" transform="rotate(-60)" />
                </g>
                <g className={styles.face}>
                  <circle cx="-6" cy="-3" r="3.4" />
                  <circle cx="6" cy="-3" r="3.4" />
                  <path d="M-5 6 Q0 10 5 6" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                </g>
              </svg>
              <span>SCAPE</span>
            </div>
          </div>
          <span className={styles.flyingE}>E</span>
          <svg className={styles.flight} width="90" height="60" viewBox="0 0 90 60">
            <path d="M4 50 Q30 20 70 18" fill="none" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.words}>
          <h1 className={styles.wordmark}>Outta Here</h1>
          <p className={styles.tagline}>The walls grow while you hesitate.</p>
          <p className={styles.lead}>
            You are the star of a 1980 program called ESCAPE: an asterisk on a TRS-80 screen that has to reach the exit while blocks fall
            around it. Now the blocks come in wood, glass and stone, you have bombs, and three chasers want you caught.
          </p>
        </div>
      </section>

      <nav className={styles.modes} aria-label="Modes">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={styles.mode} data-mode={m.id} onClick={() => onChoose(m.id)}>
            <span className={styles.modeIcon}>
              <Icon mode={m.id} />
            </span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>{m.name}</span>
              <span className={styles.modeBlurb}>{m.blurb}</span>
              <span className={styles.modeMeta}>{meta(m.id)}</span>
            </span>
            <kbd>{m.key}</kbd>
          </button>
        ))}
      </nav>

      <section className={styles.settings} aria-label="Run settings">
        <div>
          <h2 className={styles.h2}>Run difficulty</h2>
          <div className={styles.segmented} role="radiogroup" aria-label="Run difficulty">
            {(Object.keys(LEVELS) as LevelId[]).map((id) => (
              <button key={id} type="button" role="radio" aria-checked={level === id} onClick={() => setLevel(id)}>
                {LEVELS[id].name}
              </button>
            ))}
          </div>
          <p className={styles.hint}>{LEVELS[level].blurb} Also used for Versus.</p>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>Runs</dt>
            <dd>{progress.runs}</dd>
          </div>
          <div>
            <dt>Got out</dt>
            <dd>{progress.escapes}</dd>
          </div>
          {(Object.keys(LEVELS) as LevelId[]).map((id) => (
            <div key={id}>
              <dt>Best {LEVELS[id].name}</dt>
              <dd>{progress.best[id] ? `${fmt(progress.best[id]!.time)} s` : "–"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.badges} aria-label="Badges">
        <h2 className={styles.h2}>
          Badges <span>{progress.achievements.length} / {ACHIEVEMENTS.length}</span>
        </h2>
        <ul>
          {ACHIEVEMENTS.map((a) => {
            const got = progress.achievements.includes(a.id);
            return (
              <li key={a.id} data-got={got}>
                <span className={styles.badgeIcon} aria-hidden>
                  {got ? a.icon : "?"}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.how}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
