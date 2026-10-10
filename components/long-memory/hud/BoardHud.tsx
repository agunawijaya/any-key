"use client";

import type { CSSProperties } from "react";
import styles from "./BoardHud.module.css";

/*
 * Everything written over the board: how many seeds lie in each hole (the
 * numbers sit just past each pit, on the table), the two stores' totals at
 * the ends, the match line, the turn line, and the Learner's note when it
 * steers away from a move it remembers. Positions come from the renderer's
 * camera, in CSS pixels over the canvas.
 */

export type ScreenPoint = { x: number; y: number };

export type HudAnchors = {
  /** One point per hole, 0–13, where its count is written. */
  counts: ScreenPoint[];
  learnerScore: ScreenPoint;
  playerScore: ScreenPoint;
};

export type HudProps = {
  anchors: HudAnchors | null;
  counts: number[];
  match: { rules: string; opponent: string; move: number };
  /** Whose store is at each end: the north player's name on the left, "You" on the right. */
  names: { north: string; south: string };
  turn: { who: "player" | "learner"; title: string; detail: string; keys?: boolean };
  callout?: { at: ScreenPoint; kicker: string; text: string } | null;
  /** A store that just gained seeds, for its "+n". */
  gain?: { hole: number; amount: number } | null;
  /** Holes picked out (the sowing path, the pit about to be played). */
  marked?: number[];
  /** The numbers by the pits: a setting, off unless the player turns it on. The stores' totals always show. */
  showCounts?: boolean;
  /** With the numbers off, the pit under the pointer or the keyboard still shows its count. */
  peek?: number | null;
  /** A short word over the turn line: "Another move". */
  notice?: string | null;
};

const at = (p: ScreenPoint): CSSProperties => ({ left: `${p.x}px`, top: `${p.y}px` });

export function BoardHud({ anchors, counts, match, names, turn, callout, gain, marked = [], showCounts = false, peek = null, notice = null }: HudProps) {
  return (
    <div className={styles.hud}>
      <header className={styles.match}>
        <span className={styles.kicker}>{match.rules}</span>
        <span className={styles.matchTitle}>{match.opponent}</span>
        <span className={styles.matchMove}>Move {match.move}</span>
      </header>

      {anchors && (
        <>
          {anchors.counts.map((p, hole) =>
            (!showCounts && hole !== peek) || hole === 6 || hole === 13 ? null : (
              <span key={hole} className={`${styles.count} ${hole < 6 ? styles.near : styles.far} ${marked.includes(hole) ? styles.marked : ""}`} style={at(p)}>
                {counts[hole]}
              </span>
            ),
          )}
          <Score label={names.north} value={counts[13]} side="left" style={at(anchors.learnerScore)} />
          <Score label={names.south} value={counts[6]} side="right" style={at(anchors.playerScore)} gain={gain?.hole === 6 ? gain.amount : 0} />
        </>
      )}

      {callout && (
        <div className={styles.callout} style={at(callout.at)}>
          <span className={styles.calloutKicker}>
            <BookGlyph /> {callout.kicker}
          </span>
          <span className={styles.calloutText}>{callout.text}</span>
        </div>
      )}

      {notice && (
        <p className={styles.notice} key={notice + (turn.title ?? "")}>
          {notice}
        </p>
      )}

      <div className={`${styles.turn} ${turn.who === "learner" ? styles.turnLearner : ""}`} role="status">
        <span className={styles.turnMark} aria-hidden="true">
          {turn.who === "learner" ? <BookGlyph /> : <SeedGlyph />}
        </span>
        <span className={styles.turnText}>
          <strong>{turn.title}</strong>
          <span>{turn.detail}</span>
        </span>
        {turn.keys && (
          <span className={styles.keys} aria-label="Keys 1 to 6">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function Score({ label, value, side, style, gain = 0 }: { label: string; value: number; side: "left" | "right"; style: CSSProperties; gain?: number }) {
  return (
    <div className={`${styles.score} ${side === "left" ? styles.scoreLeft : styles.scoreRight}`} style={style}>
      <span className={styles.scoreLabel}>{label}</span>
      <span className={styles.scoreValue}>{value}</span>
      <span className={styles.scoreUnit}>{value === 1 ? "seed" : "seeds"}</span>
      {gain > 0 && <span className={styles.gain}>+{gain}</span>}
    </div>
  );
}

function SeedGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M12 3.5c4.6 0 8 3.6 8 8.3 0 4.4-3.5 8.7-8 8.7s-8-4.3-8-8.7c0-4.7 3.4-8.3 8-8.3z" fill="currentColor" opacity="0.9" />
      <ellipse cx="9.2" cy="8.6" rx="2.2" ry="1.4" fill="var(--hud-surface)" opacity="0.55" transform="rotate(-28 9.2 8.6)" />
    </svg>
  );
}

function BookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M3 5.2c3-.9 6-.6 9 1.3v13c-3-1.9-6-2.2-9-1.3zM21 5.2c-3-.9-6-.6-9 1.3v13c3-1.9 6-2.2 9-1.3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.4 4.7 3 5.2v2.4M18.6 4.7l2.4.5v2.4" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}
