"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { Trek } from "./engine";
import { twoHumpsManifest } from "./manifest";
import type { Difficulty, PursuerKind } from "./rules";

/** Everything Two Humps remembers lives in this browser only, in the kit store `anykey.two-humps.save`. */

export type Units = "mi" | "km";

export type CellRecord = { plays: number; wins: number; bestTurns: number | null };

export type Progress = {
  plays: number;
  wins: number;
  /** Per pursuer and difficulty, e.g. "gang/hard". */
  records: Partial<Record<`${PursuerKind}/${Difficulty}`, CellRecord>>;
  daily: Record<string, { won: boolean; turns: number; share: string }>;
  expedition: { leg: number; fossils: number[]; finished: number };
  /** Times the dunes have sung, across every trek. */
  singing: number;
  original: { plays: number; wins: number };
  achievements: string[];
  /** The last choices on the pursuer card, and the player's units. */
  choices: { pursuer: PursuerKind; difficulty: Difficulty; units: Units };
  tutorialSeen: boolean;
};

const EMPTY: Progress = {
  plays: 0,
  wins: 0,
  records: {},
  daily: {},
  expedition: { leg: 0, fossils: [], finished: 0 },
  singing: 0,
  original: { plays: 0, wins: 0 },
  achievements: [],
  choices: { pursuer: "haboob", difficulty: "normal", units: "mi" },
  tutorialSeen: false,
};

type Saved = Omit<Progress, "achievements">;

export const twoHumpsStore = createStore<Saved>(twoHumpsManifest.id, {
  version: 1,
  defaults: withoutAchievements(EMPTY),
  normalise: (saved) => ({
    ...withoutAchievements(EMPTY),
    ...saved,
    expedition: { ...EMPTY.expedition, ...saved.expedition },
    original: { ...EMPTY.original, ...saved.original },
    choices: { ...EMPTY.choices, ...saved.choices },
  }),
});

const progress = createProgress<Progress>(twoHumpsManifest.id, twoHumpsStore, {
  dailies: (p) => p.daily,
  play: (before, after) => (after.plays > before.plays ? { won: after.wins > before.wins } : null),
});

export const getProgress = progress.get;

/** Updates progress; returns the keycaps this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything Two Humps remembers, its keycaps included. */
export const resetProgress = () => forgetGame(twoHumpsManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress => (p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] });

export const FOSSIL_COUNT = 3;

/** What a finished crossing records, keycaps included. */
export function afterCrossing(p: Progress, trek: Trek, kind: "crossing" | "daily" | "expedition" | "tutorial", daily?: { key: string; share: string }): Progress {
  if (kind === "tutorial") return { ...p, tutorialSeen: true };
  const s = trek.state;
  const won = s.ending === "arrived";
  const cell = `${s.config.pursuer}/${s.config.difficulty}` as const;
  const old = p.records[cell] ?? { plays: 0, wins: 0, bestTurns: null };
  let next: Progress = {
    ...p,
    plays: p.plays + 1,
    wins: p.wins + (won ? 1 : 0),
    singing: p.singing + s.record.singing,
    records: {
      ...p.records,
      [cell]: { plays: old.plays + 1, wins: old.wins + (won ? 1 : 0), bestTurns: won ? Math.min(old.bestTurns ?? Infinity, s.turn) : old.bestTurns },
    },
  };
  if (kind === "daily" && daily && !next.daily[daily.key]) {
    next = { ...next, daily: { ...next.daily, [daily.key]: { won, turns: s.turn, share: daily.share } } };
    if (Object.values(next.daily).filter((d) => d.won).length >= 3) next = withAchievement(next, "daily-three");
  }
  if (kind === "expedition") {
    const fossils = [...new Set([...next.expedition.fossils, ...s.record.fossils])].sort();
    next = { ...next, expedition: { ...next.expedition, fossils } };
    if (fossils.length >= FOSSIL_COUNT) next = withAchievement(next, "fossil-hunter");
  }
  for (const id of earnedBy(trek)) next = withAchievement(next, id);
  if (next.singing >= 3) next = withAchievement(next, "singing-sands");
  return next;
}

/** An Expedition leg won: move on to the next, or finish it. */
export function afterLeg(p: Progress, legs: number): Progress {
  const leg = p.expedition.leg + 1;
  if (leg < legs) return { ...p, expedition: { ...p.expedition, leg } };
  return withAchievement({ ...p, expedition: { ...p.expedition, leg: 0, finished: p.expedition.finished + 1 } }, "expedition");
}

/** The keycaps a crossing has earned, whatever the mode. */
export function earnedBy(trek: Trek): string[] {
  const s = trek.state;
  const won = s.ending === "arrived";
  const r = s.record;
  const ids: string[] = [];
  if (won) ids.push("first-forty");
  if (won && r.gallops === 0 && !s.config.twist?.noGallop) ids.push("no-gallop");
  if (r.longestRun >= 5) ids.push("let-it-run");
  if (r.reinsAtSix > 0) ids.push("one-to-spare");
  if (won && s.sips === 0) ids.push("last-sip");
  if (s.config.pursuer === "gang" && r.nightCampsSurvived > 0) ids.push("under-their-noses");
  if (s.config.pursuer === "rival" && r.oasesBeforeRival >= 3) ids.push("oasis-thief");
  if (won && s.config.pursuer === "haboob" && s.config.difficulty === "hard") ids.push("storm-runner");
  if (won && s.config.pursuer === "gang" && r.seedsThrown === 0) ids.push("seedless");
  return ids;
}
