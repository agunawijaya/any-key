"use client";

import { useEffect } from "react";
import { BadgeCap, badgeText } from "@/components/kit/BadgeCap";
import { ForgetButton } from "@/components/kit/ForgetButton";
import { hasModifier, isTypingTarget } from "@/lib/kit/keys";
import { LEGS } from "@/lib/two-humps/expedition";
import { twoHumpsManifest } from "@/lib/two-humps/manifest";
import { FOSSIL_COUNT, resetProgress, updateProgress, type Progress, type Units } from "@/lib/two-humps/progress";
import type { Difficulty, PursuerKind } from "@/lib/two-humps/rules";
import { PURSUER_NAMES } from "@/lib/two-humps/share";
import styles from "./Records.module.css";

/*
 * Records and settings: every crossing by pursuer and difficulty, the
 * keycaps, and the few choices that belong to Two Humps alone. Sound,
 * appearance and motion are the collection's, in the top bar.
 */

type Props = { progress: Progress; onBack: () => void };

const PURSUERS: PursuerKind[] = ["haboob", "rival", "gang"];
const LEVELS: { id: Difficulty; name: string }[] = [
  { id: "chill", name: "Chill" },
  { id: "normal", name: "Normal" },
  { id: "hard", name: "Hard" },
];
const UNITS: { id: Units; name: string }[] = [
  { id: "mi", name: "Miles" },
  { id: "km", name: "Kilometres" },
];

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);

export function Records({ progress, onBack }: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // The settings are radio buttons; Esc still means "back" while one of them has focus.
      const choosing = event.target instanceof HTMLInputElement && event.target.type === "radio";
      if (hasModifier(event) || (isTypingTarget(event.target) && !choosing) || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const dailies = Object.values(progress.daily);
  const choose = (patch: Partial<Progress["choices"]>) => updateProgress((p) => ({ ...p, choices: { ...p.choices, ...patch } }));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Game menu <kbd>Esc</kbd>
        </button>
        <h1 className={styles.title}>
          Records <em>and settings</em>
        </h1>
      </header>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="th-crossings">
          <h2 id="th-crossings" className={styles.h2}>
            Crossings
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Pursuer</th>
                {LEVELS.map((level) => (
                  <th key={level.id} scope="col">
                    {level.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PURSUERS.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{PURSUER_NAMES[kind]}</th>
                  {LEVELS.map((level) => {
                    const cell = progress.records[`${kind}/${level.id}`];
                    return (
                      <td key={level.id}>
                        {cell ? (
                          <>
                            <strong>
                              {cell.wins}/{cell.plays}
                            </strong>
                            <small>{cell.bestTurns ? `best ${cell.bestTurns} turns` : "no win yet"}</small>
                          </>
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <dl className={styles.totals}>
            <div>
              <dt>Treks</dt>
              <dd>{progress.plays}</dd>
            </div>
            <div>
              <dt>Arrived</dt>
              <dd>{progress.wins}</dd>
            </div>
            <div>
              <dt>Daily wins</dt>
              <dd>
                {dailies.filter((d) => d.won).length}/{dailies.length}
              </dd>
            </div>
            <div>
              <dt>Expedition</dt>
              <dd>{progress.expedition.finished ? `×${progress.expedition.finished}` : `${progress.expedition.leg}/${LEGS.length}`}</dd>
            </div>
            <div>
              <dt>Fossils</dt>
              <dd>
                {progress.expedition.fossils.length}/{FOSSIL_COUNT}
              </dd>
            </div>
            <div>
              <dt>Dunes heard</dt>
              <dd>{progress.singing}</dd>
            </div>
            <div>
              <dt>1982 mode</dt>
              <dd>
                {progress.original.wins}/{progress.original.plays}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="th-settings">
          <h2 id="th-settings" className={styles.h2}>
            Settings
          </h2>
          <fieldset className={styles.field}>
            <legend>Difficulty for Crossings and the Expedition</legend>
            <div className={styles.segments}>
              {LEVELS.map((level) => (
                <label key={level.id} className={styles.segment}>
                  <input type="radio" name="th-difficulty" checked={progress.choices.difficulty === level.id} onChange={() => choose({ difficulty: level.id })} />
                  <span>{level.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.field}>
            <legend>Pursuer the Crossing card starts on</legend>
            <div className={styles.segments}>
              {PURSUERS.map((kind) => (
                <label key={kind} className={styles.segment}>
                  <input type="radio" name="th-pursuer" checked={progress.choices.pursuer === kind} onChange={() => choose({ pursuer: kind })} />
                  <span>{capitalise(PURSUER_NAMES[kind].replace(/^The /, ""))}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.field}>
            <legend>Distances</legend>
            <div className={styles.segments}>
              {UNITS.map((unit) => (
                <label key={unit.id} className={styles.segment}>
                  <input type="radio" name="th-units" checked={progress.choices.units === unit.id} onChange={() => choose({ units: unit.id })} />
                  <span>{unit.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className={styles.hint}>Sound, light or dark, and reduced motion are in the top bar and in Settings on the pause menu. Reduced motion follows your system unless you change it there.</p>
          <ForgetButton gameTitle="Two Humps" onForget={resetProgress} className={styles.forget} />
        </section>

        <section className={`${styles.card} ${styles.caps}`} aria-labelledby="th-keycaps">
          <h2 id="th-keycaps" className={styles.h2}>
            Keycaps{" "}
            <small>
              {progress.achievements.length} of {twoHumpsManifest.achievements.length}
            </small>
          </h2>
          <ul className={styles.capList}>
            {twoHumpsManifest.achievements.map((a) => {
              const earned = progress.achievements.includes(a.id);
              const text = badgeText(a, earned);
              return (
                <li key={a.id} data-earned={earned || undefined}>
                  <BadgeCap game={twoHumpsManifest} achievement={a} earned={earned} size={46} />
                  <span>
                    <strong>{text.title}</strong>
                    <small>{text.hint}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
