import { dailyDate } from "@/lib/kit/daily";
import { createRng } from "@/lib/kit/rng";
import type { FieldEngagement, FieldShot } from "./field";
import { buildFieldMission, FIELD_MISSIONS, type FieldMissionSpec } from "./fieldMissions";
import { overShortManifest } from "./manifest";
import { windWords } from "./words";

/*
 * The Daily Barrage: one Field Artillery mission a day, the same for
 * everyone, on Normal. The day picks one of the ten missions and its seed
 * (the ground, the target, the wind); on some days an enemy battery
 * further back joins in and hunts the gun. The checks play months of days
 * to prove every one can be won.
 */

export type DailyBarrage = {
  number: number;
  /** The local date, the key the result is kept under. */
  key: string;
  spec: FieldMissionSpec;
  seed: string;
};

export function dailyBarrage(date = new Date()): DailyBarrage {
  const { day, key, number } = dailyDate(date, overShortManifest.daily?.epoch);
  return { number, key, ...dailyOn(day, number) };
}

/** The mission for a day numbered from the epoch (0 is the first). */
export function dailyOn(day: number, number = day + 1): { spec: FieldMissionSpec; seed: string } {
  const rng = createRng(`over-short/daily/${day}`);
  // Each run of ten days plays all ten missions, in an order of its own.
  const count = FIELD_MISSIONS.length;
  const order = createRng(`over-short/daily-order/${Math.floor(day / count)}`).shuffle([...FIELD_MISSIONS.keys()]);
  const base = FIELD_MISSIONS[order[((day % count) + count) % count]];
  const hunted = !base.enemy && rng.float() < 0.35;
  const spec: FieldMissionSpec = {
    ...base,
    id: `daily-${number}`,
    title: `Daily Barrage #${number}`,
    ...(hunted ? { enemy: { isTarget: false, beyond: [3000, 4000] as const, opensAt: 70 }, relocations: 2 } : {}),
  };
  return { spec, seed: `daily-${day}` };
}

export const buildDaily = (daily: Pick<DailyBarrage, "spec" | "seed">): FieldEngagement => buildFieldMission(daily.spec, daily.seed, "normal");

/* ---------- Sharing ---------- */

/** One mark a round: beyond, short, off to one side, lost in smoke, a hit. */
function markFor(shot: FieldShot): string {
  const r = shot.report;
  if (r.kind === "target") return shot.destroyed ? "💥" : "🎯";
  if (r.kind === "lost") return shot.destroyed ? "💥" : "🌫️";
  const range = r.kind === "correction" ? (r.range ? (r.range.word === "drop" ? "over" : "short") : null) : r.range;
  if (range === "over") return "⬆️";
  if (range === "short") return "⬇️";
  return "↔️";
}

/** The rounds of a shoot as the share string's marks, one a round. */
export const dailyMarks = (e: FieldEngagement) => e.shots.map(markFor).join("");

/** The text players paste: the rounds as marks, the result and the day's wind, and the link. */
export function dailyShare(daily: DailyBarrage, e: FieldEngagement, url: string): string {
  const marks = dailyMarks(e);
  const rounds = e.shots.length;
  const result = e.outcome === "won" ? `target down in ${rounds} ${rounds === 1 ? "round" : "rounds"}` : e.outcome === "gun-lost" ? `gun lost after ${rounds} ${rounds === 1 ? "round" : "rounds"}` : `target still standing after ${rounds} ${rounds === 1 ? "round" : "rounds"}`;
  return [`${overShortManifest.title} · Daily Barrage #${daily.number}`, `${marks}  ${result} · wind ${windWords(e.rules.told.forecast)}`, url].join("\n");
}
