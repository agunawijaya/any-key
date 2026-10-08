"use client";

import { Keycap } from "@/components/kit/Keycap";
import { levelOf, xpForLevel, type Level } from "@/lib/kit/keyring";
import styles from "./LevelPanel.module.css";

type Props = {
  level: Level;
  xp: number;
  collected: number;
  total: number;
  /** Bumped when a level-up should be celebrated: the title is stamped again. */
  stamp: number;
};

/** The level, its title stamped on a blank wide cap, and the XP bar drawn as a space bar filling up. */
export function LevelPanel({ level, xp, collected, total, stamp }: Props) {
  const fill = level.span ? level.into / level.span : 0;
  const nextTitle = levelOf(xpForLevel(level.level + 1)).title;
  return (
    <section className={styles.panel} aria-label="Level">
      <div className={styles.levelRow}>
        <p className={styles.level}>
          <span className={styles.levelLabel}>Level</span>
          <span className={styles.levelNumber}>{level.level}</span>
        </p>
        <div key={stamp} className={styles.titleCap} data-stamp={stamp > 0 || undefined}>
          <Keycap id="level-title" wide accent="#efe6d6" emblem="" tier="common" text={level.title} size={86} title={`Level title: ${level.title}`} />
        </div>
      </div>

      <div className={styles.xp}>
        <div className={styles.spaceBar} role="meter" aria-label="XP towards the next level" aria-valuemin={0} aria-valuemax={level.span} aria-valuenow={level.into}>
          <span className={styles.spaceFill} style={{ transform: `scaleX(${fill})` }} />
          <span className={styles.spaceText}>
            {level.into} / {level.span} XP
          </span>
        </div>
        <p className={styles.xpNote}>
          <b>{xp}</b> XP in all · <b>{level.span - level.into}</b> more to level {level.level + 1}
          {nextTitle !== level.title && (
            <>
              , <em>{nextTitle}</em>
            </>
          )}
        </p>
      </div>

      <p className={styles.count}>
        <b>{collected}</b> of {total} keycaps on the ring
      </p>
    </section>
  );
}
