"use client";

import { useEffect } from "react";
import { CHAPTERS, missionById, type MissionSpec } from "@/lib/over-short/missions";
import type { Progress } from "@/lib/over-short/progress";
import { distanceLabel, type Units } from "@/lib/over-short/words";
import type { Era } from "./eras/types";
import { MedalIcon } from "./icons";
import ui from "./ui.module.css";
import styles from "./Briefing.module.css";

/*
 * The briefings: what the player is told before taking the gun. Classic's
 * is the drill's standing orders; a mission's says what is different this
 * time, without giving away the numbers.
 */

/** Enter takes the gun from a briefing. */
function useEnterToStart(onStart: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.defaultPrevented) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "INPUT" || tag === "A") return;
      event.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);
}

export function ClassicBriefing({ units, onStart, onBack }: { units: Units; onStart: () => void; onBack: () => void }) {
  useEnterToStart(onStart);
  return (
    <section className={`${ui.panel} ${styles.brief}`} aria-labelledby="os-brief-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <p className={ui.kicker}>Classic · the 1973 drill</p>
      <h2 id="os-brief-title" className={ui.heading}>
        Five targets. Five rounds each.
      </h2>
      <ul className={styles.orders}>
        <li>You are told the gun&rsquo;s greatest range and how far away each target is.</li>
        <li>Call an elevation from 1° to 89°. The observer reports whether the round fell over or short, and by how much.</li>
        <li>A round within {distanceLabel(100, units)} destroys the target. Miss five times at one target and the enemy finds your gun first.</li>
        <li>All five in 18 rounds or fewer is the standard.</li>
      </ul>
      <button type="button" className={ui.primary} onClick={onStart} data-autofocus>
        <span className={ui.label}>
          Take the gun
          <small>Enter</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A mission's briefing in the era's words: `{target}` becomes "a supply dump", or "A stone bridge" to start a sentence. */
export function briefText(spec: MissionSpec, era: Era) {
  const name = era.words.target(spec.targets[0].kind);
  const phrase = `${article(name)} ${name}`;
  return spec.brief.split("{target}").reduce((text, part) => {
    const opensSentence = text === "" || /[.!?]\s$/.test(text);
    return text + (opensSentence ? capital(phrase) : phrase) + part;
  });
}

/** What is different about a mission, in a few plain facts. */
export function missionFacts(spec: MissionSpec, units: Units): string[] {
  const facts: string[] = [];
  facts.push(spec.told.maxRange ? (spec.told.worn ? "Range table: the gun's, when it was new" : "Range table: the gun's greatest range is given") : "Range table: none, the gun is unknown");
  facts.push(spec.reports === "direction" ? "Observer: over or short only" : "Observer: over or short, and by how much");
  if (spec.model === "air") facts.push("The shells fly through real air");
  if (spec.told.table) facts.push(`A range table for ${spec.told.table.map((e) => `${e}°`).join(", ")} comes with the gun`);
  const plan = spec.targets[0];
  if (plan.height) facts.push(plan.height[0] > 0 ? "Target on high ground above the gun" : "Target in a valley below the gun");
  if (spec.wind) facts.push(spec.wind[0] < 0 ? "A strong headwind" : "A strong wind behind the gun");
  if (plan.speed) facts.push("Target on the move");
  if (plan.hits && plan.hits > 1) facts.push(`It takes ${plan.hits} hits`);
  if (spec.targets.length > 1) facts.push(`${spec.targets.length} targets, one after another`);
  if (spec.elevation) facts.push(`Only elevations from ${spec.elevation.min}° to ${spec.elevation.max}° clear the ridge`);
  if (spec.clock) facts.push(`${Math.floor(spec.clock.limit / 60)} min ${spec.clock.limit % 60} s on the clock`);
  if (spec.counterfire) facts.push(`An enemy battery ranging on you · ${spec.relocations?.count ?? 0} moves of ${distanceLabel(spec.relocations?.step ?? 0, units)}`);
  facts.push(`${spec.ammo} rounds · a hit within ${distanceLabel(plan.radius, units)}`);
  return facts;
}

type MissionProps = { id: string; progress: Progress; era: Era; onStart: () => void; onBack: () => void };

export function MissionBriefing({ id, progress, era, onStart, onBack }: MissionProps) {
  useEnterToStart(onStart);
  const spec = missionById(id);
  if (!spec) return null;
  const chapter = CHAPTERS[spec.chapter - 1];
  const record = progress.campaign.missions[id];
  const units = progress.settings.units;
  return (
    <section className={`${ui.panel} ${styles.brief}`} aria-labelledby="os-brief-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Campaign
      </button>
      <p className={ui.kicker}>
        Chapter {spec.chapter} · {chapter.title} · Mission {spec.id}
      </p>
      <h2 id="os-brief-title" className={ui.heading}>
        {spec.title}
      </h2>
      <p className={ui.lede}>{briefText(spec, era)}</p>
      <ul className={styles.facts}>
        {missionFacts(spec, units).map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <div className={styles.medals} aria-label="Medals">
        <span>
          <MedalIcon medal="gold" /> {spec.medals.gold} {spec.medals.gold === 1 ? "round" : "rounds"} or fewer
        </span>
        <span>
          <MedalIcon medal="silver" /> {spec.medals.silver} or fewer
        </span>
        <span>
          <MedalIcon medal="bronze" /> any win
        </span>
      </div>
      {record?.medal && (
        <p className={styles.best}>
          Your best: <MedalIcon medal={record.medal} /> {record.best} {record.best === 1 ? "round" : "rounds"}
        </p>
      )}
      {progress.settings.hint && <p className={styles.note}>The textbook hint is on: this mission can earn silver at most.</p>}
      <button type="button" className={ui.primary} onClick={onStart} data-autofocus>
        <span className={ui.label}>
          Take the gun
          <small>Enter</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
