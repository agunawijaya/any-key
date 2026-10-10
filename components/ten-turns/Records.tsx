"use client";

import { CHAPTERS, PITS } from "@/lib/ten-turns/pits";
import type { Progress } from "@/lib/ten-turns/progress";
import panel from "./panel.module.css";
import styles from "./Records.module.css";

/** Records, kept per play style: Classic's tally, the campaign's medals, the dailies and the 1970s terminal. */
export function Records({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const c = progress.classic;
  const medals = PITS.reduce((n, pit) => {
    const best = progress.pits[pit.id]?.best;
    return n + (best ? +best.survived + +best.toolsToSpare + +best.untouched : 0);
  }, 0);
  const dailies = Object.values(progress.daily);
  const t = progress.terminal;
  return (
    <section className={`${panel.panel} ${panel.roomy} ${styles.records}`} aria-labelledby="tt-records">
      <button type="button" className={`${panel.quiet} ${panel.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <h2 id="tt-records" className={panel.title}>
        Records
      </h2>

      <h3 className={styles.heading}>Classic</h3>
      <dl className={styles.facts}>
        <Fact label="Games" value={c.played} />
        <Fact label="Climbed out" value={c.released} />
        <Fact label="Squished it" value={c.squished} />
        <Fact label="Crunched" value={c.crunched} />
        <Fact label="Best run" value={c.bestStreak} />
      </dl>

      <h3 className={styles.heading}>Tactics</h3>
      <p className={styles.line}>
        {medals} of {PITS.length * 3} medals
      </p>
      <ul className={styles.chapters}>
        {CHAPTERS.map((ch) => {
          const pits = PITS.filter((p) => p.chapter === ch.number);
          const done = pits.filter((p) => progress.pits[p.id]?.best.survived).length;
          return (
            <li key={ch.number}>
              <span>
                {ch.number}. {ch.title}
              </span>
              <span>
                {done} of {pits.length}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className={styles.heading}>Daily Pit</h3>
      <dl className={styles.facts}>
        <Fact label="Days played" value={dailies.length} />
        <Fact label="Survived" value={dailies.filter((d) => d.survived).length} />
      </dl>

      <h3 className={styles.heading}>1970s mode</h3>
      <dl className={styles.facts}>
        <Fact label="Games" value={t.games} />
        <Fact label="Released" value={t.released} />
        <Fact label="Squished it" value={t.squished} />
        <Fact label="Crunched" value={t.crunched} />
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
