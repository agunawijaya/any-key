"use client";

import { fieldTimeLeft, heightDifference, targetAt, type FieldEngagement } from "@/lib/over-short/field";
import { heightAt } from "@/lib/over-short/terrain";
import { distanceLabel, windWords, type Units } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { BurstIcon, ClockIcon, FlareIcon, MoveIcon, RoundIcon, WindIcon } from "../icons";
import ui from "../ui.module.css";
import hud from "../play/Hud.module.css";
import styles from "./Field.module.css";

/*
 * What the battery knows in Field Artillery, in two cards. At the top, the
 * target as the map gives it: how far, how high, the crest in the way, a
 * convoy's road, a bridge's column. At the bottom, the rounds left and the
 * day's conditions: the forecast wind, the clock, the star shells, the
 * enemy hunting the gun, with the orders that go with them.
 */

type Props = {
  engagement: FieldEngagement;
  era: Era;
  units: Units;
  busy: boolean;
  onIlluminate: () => void;
  onRelocate: () => void;
};

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** The highest ground standing above the line from the gun to the target, as the map's contours show it. */
export function crestOf(e: FieldEngagement) {
  const at = targetAt(e);
  const ground = (x: number) => heightAt(e.rules.terrain, x);
  const from = ground(e.gunX);
  const to = ground(at.x);
  let crest: { out: number; up: number } | null = null;
  // Only ground standing well clear of the line of sight counts: a swell of a few metres is not a crest.
  let worst = 30;
  for (let x = e.gunX + 200; x < at.x - 60; x += 20) {
    const over = ground(x) - (from + ((x - e.gunX) / (at.x - e.gunX)) * (to - from));
    if (over > worst) {
      worst = over;
      crest = { out: x - e.gunX, up: ground(x) - from };
    }
  }
  return crest;
}

export function FieldHud({ engagement: e, era, units, busy, onIlluminate, onRelocate }: Props) {
  const target = e.targets[e.index];
  const told = e.rules.told;
  const at = targetAt(e);
  const distance = Math.round((at.x - e.gunX + told.mapError.along) / 10) * 10;
  const height = Math.round(heightDifference(e) / 5) * 5;
  const crest = crestOf(e);
  const clock = fieldTimeLeft(e);
  const left = e.rules.ammo - e.shots.length;
  const lastEnemy = e.ranging > 0 ? (e.enemyRounds.at(-1) ?? null) : null;
  const enemy = e.rules.enemy && !e.silenced;
  const moving = target.vz !== 0 || target.vx !== 0;

  return (
    <>
      <section className={`${ui.panel} ${hud.target}`} aria-label="The target">
        <p className={ui.kicker}>
          {e.targets.length > 1 ? `Target ${e.index + 1} of ${e.targets.length} · ` : ""}
          {era.words.target(target.kind)}
        </p>
        <p className={hud.distance}>{distanceLabel(distance, units)}</p>
        <p className={hud.line}>
          by the map
          {height !== 0 && ` · ${distanceLabel(Math.abs(height), units)} ${height > 0 ? "above" : "below"} the gun`}
          {target.hits - e.hitsOnTarget > 1 && ` · ${target.hits - e.hitsOnTarget} hits to bring it down`}
        </p>
        {moving && (
          <p className={hud.line}>
            On the road, crossing {target.vz > 0 ? "left to right" : "right to left"} at about {Math.round(Math.abs(target.vz))} m/s
          </p>
        )}
        {crest && (
          <p className={hud.line}>
            Crest in the way: {distanceLabel(Math.max(5, Math.round(crest.up / 5) * 5), units)} up, {distanceLabel(Math.round(crest.out / 10) * 10, units)} out
          </p>
        )}
      </section>

      <section className={`${ui.panel} ${hud.status}`} aria-label="Rounds and conditions">
        <div className={hud.rounds}>
          <span className={hud.label}>Rounds · {left} left</span>
          <span className={hud.pips} aria-hidden="true">
            {Array.from({ length: e.rules.ammo }, (_, i) => (
              <RoundIcon key={i} size={15} className={i < e.shots.length ? hud.spent : hud.ready} />
            ))}
          </span>
        </div>
        <p className={hud.chip}>
          <WindIcon size={16} /> Forecast: {windWords(told.forecast)}
          {e.rules.gusts > 0.1 && ", gusting"}
        </p>
        {clock !== null && (
          <p className={hud.chip} data-urgent={clock < 90}>
            <ClockIcon size={16} /> {target.kind === "bridge" ? `The column reaches the bridge in ${minutes(clock)}` : `${minutes(clock)} left`}
          </p>
        )}
        {e.rules.night && (
          <div className={hud.enemy}>
            <p className={hud.chip}>
              <FlareIcon size={16} /> {e.starShellsLeft} star {e.starShellsLeft === 1 ? "shell" : "shells"} left · each burns about {e.rules.night.burn} s
            </p>
            <button type="button" className={ui.secondary} disabled={busy || e.starShellsLeft <= 0} onClick={onIlluminate}>
              <FlareIcon size={16} /> Light it up <span className={ui.key}>L</span>
            </button>
          </div>
        )}
        {enemy && (
          <div className={hud.enemy}>
            <p className={hud.chip} data-urgent={lastEnemy !== null && lastEnemy.miss < 250}>
              <BurstIcon size={16} /> {lastEnemy ? `Their last round: ${distanceLabel(lastEnemy.miss, units)} from the gun` : e.rules.enemy?.isTarget ? "Their battery is ranging on you" : "A battery further back is hunting you"}
            </p>
            <button type="button" className={ui.secondary} disabled={busy || e.relocationsLeft <= 0} onClick={onRelocate}>
              <MoveIcon size={16} /> Move the gun back {distanceLabel(e.rules.relocations.step, units)} · {e.relocationsLeft} left <span className={ui.key}>R</span>
            </button>
          </div>
        )}
        {e.rules.smoke.length > 0 && <p className={styles.smokeNote}>They are laying smoke: some falls of shot will be hidden.</p>}
      </section>
    </>
  );
}
