"use client";

import { useEffect } from "react";
import { useHydrated } from "@/components/kit/hooks";
import type { DailyBarrage } from "@/lib/over-short/daily";
import type { Difficulty } from "@/lib/over-short/field";
import { FIELD_MISSIONS, fieldMissionById, type FieldMissionSpec } from "@/lib/over-short/fieldMissions";
import { updateSettings, type Progress } from "@/lib/over-short/progress";
import { distanceLabel, type Units } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { MedalIcon } from "../icons";
import ui from "../ui.module.css";
import brief from "../Briefing.module.css";
import map from "../CampaignMap.module.css";
import styles from "./FieldMissions.module.css";

/*
 * Field Artillery's screens before the gun: the ten shoots with the medal
 * won on each at the chosen difficulty, a shoot's briefing, and the day's
 * Daily Barrage.
 */

const DIFFICULTIES: { id: Difficulty; title: string; note: string }[] = [
  { id: "easy", title: "Easy", note: "Light winds, a sharp-eyed observer who gives the line in mils too, a slow enemy" },
  { id: "normal", title: "Normal", note: "The war as it comes" },
  { id: "hard", title: "Hard", note: "Strong gusting wind, an observer who rounds to 50 m, a map further out, a quick enemy" },
];

function DifficultyPicker({ value }: { value: Difficulty }) {
  return (
    <div className={styles.difficulty} role="radiogroup" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={value === d.id} className={styles.level} onClick={() => updateSettings({ difficulty: d.id })} title={d.note}>
          {d.title}
        </button>
      ))}
    </div>
  );
}

type ListProps = { progress: Progress; era: Era; onMission: (id: string) => void; onBack: () => void };

export function FieldMissions({ progress, era, onMission, onBack }: ListProps) {
  const hydrated = useHydrated();
  const difficulty = progress.settings.difficulty;
  return (
    <section className={`${ui.panel} ${map.map}`} aria-labelledby="os-field-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <div className={styles.head}>
        <div>
          <p className={ui.kicker}>Field Artillery · {era.name}</p>
          <h2 id="os-field-title" className={`${ui.heading} ${map.heading}`}>
            Real ground, real air
          </h2>
          <p className={ui.lede}>Charge, elevation and line; wind that carries rounds sideways; an observer who calls the corrections.</p>
        </div>
        <DifficultyPicker value={difficulty} />
      </div>
      <p className={styles.levelNote}>{DIFFICULTIES.find((d) => d.id === difficulty)?.note}</p>
      <div className={styles.grid}>
        {FIELD_MISSIONS.map((m) => {
          const record = hydrated ? progress.field.missions[`${m.id}/${difficulty}`] : undefined;
          return (
            <button key={m.id} type="button" className={map.mission} onClick={() => onMission(m.id)} data-won={!!record?.wins}>
              <span className={map.missionId}>{m.id}</span>
              <span className={map.missionTitle}>{m.title}</span>
              <span className={styles.lesson}>{m.lesson}</span>
              <span className={map.missionMedal}>{record?.medal ? <MedalIcon medal={record.medal} size={20} /> : <span className={map.empty} aria-label="Not yet won" />}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Briefings ---------- */

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

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A shoot's briefing in the era's words: `{target}` becomes "a supply dump", or "A stone bridge" to open a sentence. */
export function fieldBriefText(spec: FieldMissionSpec, era: Era) {
  const name = era.words.target(spec.kind);
  const phrase = `${article(name)} ${name}`;
  return spec.brief.split("{target}").reduce((text, part) => text + (text === "" || /[.!?]\s$/.test(text) ? capital(phrase) : phrase) + part);
}

/** What is different about a shoot, in a few plain facts. */
export function fieldFacts(spec: FieldMissionSpec, units: Units): string[] {
  const facts: string[] = [];
  if (spec.id === "F2" || spec.lesson.includes("crest")) facts.push("A crest stands between the gun and the target");
  if (spec.kind === "bridge") facts.push("A river valley, its bridge, and a column on the road to it");
  if (spec.wind.across[0] >= 8) facts.push("A strong wind across the line of fire, gusting");
  if (spec.speed) facts.push("The target is on the move, crossing your line of fire");
  if (spec.smoke) facts.push(`Smoke: ${spec.smoke.length === 2 ? "twice" : `${spec.smoke.length} times`} the observer will see nothing`);
  if (spec.night) facts.push(`Night: ${spec.night.starShells} star shells to light the target`);
  if (spec.enemy) facts.push(spec.enemy.isTarget ? "The target is an enemy battery, already ranging on you" : "A battery further back is hunting your gun");
  if (spec.relocations) facts.push(`You can move the gun back ${spec.relocations} times`);
  if (spec.hits && spec.hits > 1) facts.push(`It takes ${spec.hits} hits`);
  facts.push(`${spec.ammo} rounds · a hit within ${distanceLabel(spec.radius, units)}`);
  return facts;
}

function Medals({ spec }: { spec: FieldMissionSpec }) {
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className={brief.medals} aria-label="Medals">
      <span>
        <MedalIcon medal="gold" /> {spec.medals.gold.rounds} {spec.medals.gold.rounds === 1 ? "round" : "rounds"} within {clock(spec.medals.gold.seconds)}
      </span>
      <span>
        <MedalIcon medal="silver" /> {spec.medals.silver.rounds} within {clock(spec.medals.silver.seconds)}
      </span>
      <span>
        <MedalIcon medal="bronze" /> any win
      </span>
    </div>
  );
}

type BriefingProps = { id: string; progress: Progress; era: Era; onStart: () => void; onBack: () => void };

export function FieldBriefing({ id, progress, era, onStart, onBack }: BriefingProps) {
  useEnterToStart(onStart);
  const spec = fieldMissionById(id);
  if (!spec) return null;
  const difficulty = progress.settings.difficulty;
  const record = progress.field.missions[`${id}/${difficulty}`];
  return (
    <section className={`${ui.panel} ${brief.brief}`} aria-labelledby="os-brief-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Field Artillery
      </button>
      <p className={ui.kicker}>
        Field Artillery · {spec.id} · {spec.lesson}
      </p>
      <h2 id="os-brief-title" className={ui.heading}>
        {spec.title}
      </h2>
      <p className={ui.lede}>{fieldBriefText(spec, era)}</p>
      <ul className={brief.facts}>
        {fieldFacts(spec, progress.settings.units).map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <Medals spec={spec} />
      <div className={styles.startRow}>
        <DifficultyPicker value={difficulty} />
        {record?.medal && (
          <p className={brief.best}>
            Your best: <MedalIcon medal={record.medal} /> {record.best?.rounds} {record.best?.rounds === 1 ? "round" : "rounds"}
          </p>
        )}
      </div>
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

type DailyProps = { daily: DailyBarrage; progress: Progress; era: Era; onStart: () => void; onBack: () => void };

export function DailyBriefing({ daily, progress, era, onStart, onBack }: DailyProps) {
  useEnterToStart(onStart);
  const done = progress.daily[daily.key];
  return (
    <section className={`${ui.panel} ${brief.brief}`} aria-labelledby="os-brief-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <p className={ui.kicker}>Daily Barrage #{daily.number} · the same shoot for everyone today</p>
      <h2 id="os-brief-title" className={ui.heading}>
        {daily.spec.lesson}
      </h2>
      <p className={ui.lede}>{fieldBriefText(daily.spec, era)}</p>
      <ul className={brief.facts}>
        {fieldFacts(daily.spec, progress.settings.units).map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
        <li>Normal difficulty, whatever your setting</li>
      </ul>
      <Medals spec={daily.spec} />
      {done && (
        <p className={brief.best}>
          Today: {done.marks} {done.won ? `down in ${done.rounds}` : "the target stood"}. Your first go is the one that counts.
        </p>
      )}
      <button type="button" className={ui.primary} onClick={onStart} data-autofocus>
        <span className={ui.label}>
          {done ? "Shoot it again" : "Take the gun"}
          <small>Enter</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
