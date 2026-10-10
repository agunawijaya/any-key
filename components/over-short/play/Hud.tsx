"use client";

import { currentTarget, nextEnemyMiss, roundsAtTarget, roundsLeft, targetDistance, timeLeft, type Engagement } from "@/lib/over-short/engagement";
import { distanceLabel, type Units } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { BurstIcon, ClockIcon, MoveIcon, RoundIcon, WindIcon } from "../icons";
import ui from "../ui.module.css";
import styles from "./Hud.module.css";

/*
 * What the gun crew knows, in two cards: the target (what it is, how far,
 * what the range table says) at the top, and at the bottom the rounds left
 * and whatever else this engagement brings (wind, the clock, the enemy).
 */

type Props = { engagement: Engagement; era: Era; units: Units; busy: boolean; onRelocate: (direction: 1 | -1) => void };

/** Beyond this the target is past the right edge of the side view while the gun is being laid. */
const OFF_SCREEN = 2400;

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function Hud({ engagement: e, era, units, busy, onRelocate }: Props) {
  const target = currentTarget(e);
  const distance = Math.round(targetDistance(e) / e.rules.rounding) * e.rules.rounding;
  const told = e.rules.told.maxRange;
  const left = roundsLeft(e);
  const total = e.rules.ammo.perTarget ?? e.rules.ammo.total ?? 0;
  const used = e.rules.ammo.perTarget ? roundsAtTarget(e) : e.shots.length;
  const clock = timeLeft(e);
  const enemy = nextEnemyMiss(e);
  const lastEnemy = e.enemyRanging > 0 ? e.enemy[e.enemy.length - 1] : null;

  return (
    <>
      <section className={`${ui.panel} ${styles.target}`} aria-label="The target">
        <p className={ui.kicker}>
          Target {e.index + 1} of {e.targets.length} · {era.words.target(target.kind)}
        </p>
        <p className={styles.distance}>{distanceLabel(distance, units)}</p>
        <p className={styles.line}>
          {target.speed !== 0
            ? `now, and ${target.speed > 0 ? "moving away" : "coming closer"} at ${Math.abs(Math.round(target.speed))} m/s`
            : target.height !== 0
              ? `${distanceLabel(Math.abs(target.height), units)} ${target.height > 0 ? "above" : "below"} the gun`
              : "from the gun"}
          {target.hits > 1 && ` · ${target.hits - e.hitsOnTarget} ${target.hits - e.hitsOnTarget === 1 ? "hit" : "hits"} to bring it down`}
        </p>
        <p className={styles.line}>
          {told === null ? "Gun's greatest range: unknown" : `Range table: greatest range ${distanceLabel(told, units)}`}
          {e.rules.reports === "direction" && " · the observer gives over or short only"}
        </p>
      </section>

      {distance > OFF_SCREEN && (
        <p className={styles.beyond} aria-hidden="true">
          {era.words.target(target.kind)} · {distanceLabel(distance, units)} <span>→</span>
        </p>
      )}

      <section className={`${ui.panel} ${styles.status}`} aria-label="Rounds and conditions">
        <div className={styles.rounds}>
          <span className={styles.label}>
            {e.rules.ammo.perTarget ? "Rounds at this target" : "Rounds"} · {left ?? "∞"} left
          </span>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <RoundIcon key={i} size={16} className={i < used ? styles.spent : styles.ready} />
            ))}
          </span>
        </div>
        {e.rules.told.windShown && (
          <p className={styles.chip}>
            <WindIcon size={16} /> Wind {Math.abs(e.rules.wind)} m/s {e.rules.wind < 0 ? "in your face" : "behind you"}
          </p>
        )}
        {clock !== null && (
          <p className={styles.chip} data-urgent={clock < 60}>
            <ClockIcon size={16} /> {minutes(clock)} left
          </p>
        )}
        {enemy && (
          <div className={styles.enemy}>
            <p className={styles.chip} data-urgent={lastEnemy !== null && lastEnemy.miss < 300}>
              <BurstIcon size={16} /> {lastEnemy ? `Their last round: ${distanceLabel(lastEnemy.miss, units)} from the gun` : "The enemy battery is looking for you"}
            </p>
            <button type="button" className={ui.secondary} disabled={busy || e.relocationsLeft <= 0} onClick={() => onRelocate(-1)}>
              <MoveIcon size={16} /> Move the gun back {distanceLabel(e.rules.relocations.step, units)} · {e.relocationsLeft} left
            </button>
          </div>
        )}
      </section>
    </>
  );
}
