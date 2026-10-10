"use client";

import { useHydrated } from "@/components/kit/hooks";
import type { Opponent } from "@/lib/long-memory/match";
import { currentMind, type Progress } from "@/lib/long-memory/progress";
import { RULE_ORDER, RULES } from "@/lib/long-memory/rules";
import panel from "./panel.module.css";
import styles from "./Records.module.css";

/* What this browser remembers of the player's games. */

const OPPONENT_NAMES: Record<Opponent, string> = { learner: "the Learner", scholar: "the Scholar", friend: "a friend" };

export function Records({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const hydrated = useHydrated();
  const rows = RULE_ORDER.flatMap((rules) =>
    (["learner", "scholar", "friend"] as Opponent[])
      .map((opponent) => ({ rules, opponent, record: progress.records[`${rules}/${opponent}`] }))
      .filter((r) => r.record && r.record.played > 0),
  );
  const solved = Object.values(progress.daily).filter((d) => d.solved).length;
  const encores = Object.values(progress.beatenWith).filter((n) => n >= 2).length;
  return (
    <section className={`${panel.panel} ${styles.records}`} aria-labelledby="stt-records">
      <p className={panel.kicker}>Kept in this browser</p>
      <h2 id="stt-records" className={panel.heading}>
        Records
      </h2>
      {hydrated && rows.length === 0 && <p className={panel.lede}>No games yet. Your record starts with the first one you finish.</p>}
      {hydrated && rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">Played</th>
              <th scope="col">Won</th>
              <th scope="col">Drawn</th>
              <th scope="col">Lost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rules, opponent, record }) => (
              <tr key={`${rules}/${opponent}`}>
                <th scope="row">
                  {RULES[rules].title} <span>against {OPPONENT_NAMES[opponent]}</span>
                </th>
                <td>{record!.played}</td>
                <td>{record!.won}</td>
                <td>{record!.drawn}</td>
                <td>{record!.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hydrated && (
        <dl className={styles.facts}>
          <div>
            <dt>Lessons in the Learner&rsquo;s book</dt>
            <dd>{currentMind(progress).lessons.length}</dd>
          </div>
          <div>
            <dt>Openings that beat it twice</dt>
            <dd>{encores}</dd>
          </div>
          <div>
            <dt>Daily Endgames solved</dt>
            <dd>{solved}</dd>
          </div>
          <div>
            <dt>Games on the terminal</dt>
            <dd>{progress.terminal.games}</dd>
          </div>
        </dl>
      )}
      <div className={panel.row}>
        <button type="button" className={panel.secondary} onClick={onBack} data-autofocus>
          Back to the game menu
        </button>
      </div>
    </section>
  );
}
