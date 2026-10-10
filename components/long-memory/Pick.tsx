"use client";

import { useState } from "react";
import type { MatchConfig, Opponent } from "@/lib/long-memory/match";
import { updateProgress, type Settings } from "@/lib/long-memory/progress";
import { RULE_ORDER, RULES, type RuleId } from "@/lib/long-memory/rules";
import type { Difficulty } from "@/lib/long-memory/scholar";
import panel from "./panel.module.css";
import styles from "./Pick.module.css";

/*
 * Choosing a game: the rule set, then who sits across the board. The
 * Learner only plays the 1978 rules it was written for.
 */

export const RULE_NOTES: Record<RuleId, string> = {
  awari1978: "Three seeds a pit. Both stores are in the loop, a store landing earns one more move, and a seed ending in an empty pit takes the pit across. Seeds left at the end don't count.",
  oware: "Four seeds a pit and no stores in the loop. Make two or three on their side to capture, and never leave them without seeds. First to 25 wins.",
  kalah: "Only your own store is in the loop, store landings chain, and you capture from your own empty pits. When a row runs dry, each side sweeps up its own.",
};

const OPPONENTS: { id: Opponent; title: string; note: string }[] = [
  { id: "learner", title: "The Learner", note: "The 1978 program's mind, with its book of lessons" },
  { id: "scholar", title: "The Scholar", note: "Searches ahead; three levels" },
  { id: "friend", title: "A friend", note: "Two players, one screen, taking turns" },
];

const LEVELS: Difficulty[] = ["easy", "normal", "hard"];

export function Pick({ settings, onStart, onBack }: { settings: Settings; onStart: (config: MatchConfig) => void; onBack: () => void }) {
  const [rules, setRules] = useState<RuleId>(settings.rules);
  const [opponent, setOpponent] = useState<Opponent>(settings.rules === "awari1978" ? "learner" : "scholar");
  const [level, setLevel] = useState<Difficulty>(settings.scholar);
  const [seeds, setSeeds] = useState(settings.kalahSeeds);
  const learnerAllowed = rules === "awari1978";
  const chosen = opponent === "learner" && !learnerAllowed ? "scholar" : opponent;

  const start = () => {
    updateProgress((p) => ({ ...p, settings: { ...p.settings, rules, scholar: level, kalahSeeds: seeds } }));
    onStart({ rules, seeds: rules === "kalah" ? seeds : RULES[rules].defaultSeeds, opponent: chosen, level, first: "south" });
  };

  return (
    <section className={`${panel.panel} ${styles.pick}`} aria-labelledby="stt-pick">
      <p className={panel.kicker}>New game</p>
      <h2 id="stt-pick" className={panel.heading}>
        Choose the rules
      </h2>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Rules</legend>
        {RULE_ORDER.map((id) => (
          <label key={id} className={styles.option} data-checked={rules === id}>
            <input type="radio" name="stt-rules" value={id} checked={rules === id} onChange={() => setRules(id)} />
            <span className={styles.optionTitle}>{RULES[id].title}</span>
            <span className={styles.optionNote}>{RULE_NOTES[id]}</span>
          </label>
        ))}
      </fieldset>

      {rules === "kalah" && (
        <fieldset className={styles.inline}>
          <legend className={styles.legend}>Seeds a pit</legend>
          {RULES.kalah.seedChoices.map((n) => (
            <label key={n} className={styles.chip} data-checked={seeds === n}>
              <input type="radio" name="stt-seeds" value={n} checked={seeds === n} onChange={() => setSeeds(n)} />
              {n}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Across the board</legend>
        {OPPONENTS.map((o) => {
          const disabled = o.id === "learner" && !learnerAllowed;
          return (
            <label key={o.id} className={styles.option} data-checked={chosen === o.id} data-disabled={disabled}>
              <input type="radio" name="stt-opponent" value={o.id} checked={chosen === o.id} disabled={disabled} onChange={() => setOpponent(o.id)} />
              <span className={styles.optionTitle}>{o.title}</span>
              <span className={styles.optionNote}>{disabled ? "Plays only 1978 Awari, the game it was written for" : o.note}</span>
            </label>
          );
        })}
      </fieldset>

      {chosen === "scholar" && (
        <fieldset className={styles.inline}>
          <legend className={styles.legend}>Scholar</legend>
          {LEVELS.map((l) => (
            <label key={l} className={styles.chip} data-checked={level === l}>
              <input type="radio" name="stt-level" value={l} checked={level === l} onChange={() => setLevel(l)} />
              {l[0].toUpperCase() + l.slice(1)}
            </label>
          ))}
        </fieldset>
      )}

      <div className={`${panel.row} ${styles.actions}`}>
        <button type="button" className={panel.primary} onClick={start}>
          Start <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={panel.quiet} onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
