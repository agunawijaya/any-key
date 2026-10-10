"use client";

import { CHAPTERS, PITS } from "@/lib/ten-turns/pits";
import type { Progress } from "@/lib/ten-turns/progress";
import type { PitPlan } from "@/lib/ten-turns/tactics";
import { CarrotIcon, HatIcon, RabbitIcon, SpadeIcon, StoneIcon } from "./icons";
import panel from "./panel.module.css";
import styles from "./ChapterMap.module.css";

/*
 * The Tactics campaign: five chapters of four pits. A pit opens once the one
 * before it has been survived; each shows its three medals.
 */

type Props = { progress: Progress; onPick: (plan: PitPlan, last: boolean) => void; onBack: () => void };

export function ChapterMap({ progress, onPick, onBack }: Props) {
  const open = (index: number) => index === 0 || !!progress.pits[PITS[index - 1].id]?.best.survived;
  return (
    <section className={`${panel.panel} ${panel.wide} ${styles.map}`} aria-labelledby="tt-chapters">
      <button type="button" className={`${panel.quiet} ${panel.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <p className={panel.kicker}>Tactics</p>
      <h2 id="tt-chapters" className={panel.title}>
        Twenty pits
      </h2>
      <ol className={styles.chapters}>
        {CHAPTERS.map((chapter) => (
          <li key={chapter.number} className={styles.chapter}>
            <h3 className={styles.chapterTitle}>
              <span className={styles.chapterNumber}>{chapter.number}</span> {chapter.title}
              <small>{chapter.idea}</small>
            </h3>
            <ul className={styles.pits}>
              {PITS.filter((p) => p.chapter === chapter.number).map((plan) => {
                const index = PITS.indexOf(plan);
                const record = progress.pits[plan.id];
                const unlocked = open(index);
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      className={styles.pit}
                      disabled={!unlocked}
                      data-survived={!!record?.best.survived}
                      onClick={() => onPick(plan, index === PITS.length - 1)}
                      aria-label={`${plan.title}${unlocked ? "" : ", locked: survive the pit before it"}${record?.best.survived ? ", survived" : ""}`}
                    >
                      <span className={styles.pitTitle}>{plan.title}</span>
                      <span className={styles.pitNote}>{unlocked ? plan.note : "Survive the pit before this one."}</span>
                      <span className={styles.pitFacts} aria-hidden="true">
                        {plan.rabbits.map((r, i) => (
                          <span key={i} title={r.temperament}>
                            <RabbitIcon size={16} />
                          </span>
                        ))}
                        {plan.tools.carrot + plan.patches.length > 0 && <CarrotIcon size={16} />}
                        {plan.tools.stone > 0 && <StoneIcon size={16} />}
                        {plan.tools.dig > 0 && <SpadeIcon size={16} />}
                        <span className={styles.turns}>{plan.turns} turns</span>
                      </span>
                      <span className={styles.medals}>
                        <Dot on={!!record?.best.survived} label="Survived" />
                        <Dot on={!!record?.best.toolsToSpare} label="Tools to spare" />
                        <Dot on={!!record?.best.untouched} label="Untouched" icon={<HatIcon size={14} />} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Dot({ on, label, icon }: { on: boolean; label: string; icon?: React.ReactNode }) {
  return (
    <span className={styles.dot} data-on={on} title={`${label}${on ? "" : " (not yet)"}`}>
      {icon ?? <span className={styles.coin} />}
      <span className={styles.srOnly}>
        {label}: {on ? "earned" : "not yet"}
      </span>
    </span>
  );
}
