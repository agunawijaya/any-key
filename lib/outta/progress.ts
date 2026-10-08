"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { LEGACY_SAVES, LEGACY_VERSION } from "@/lib/kit/legacy";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { Game } from "./engine";
import type { LevelId } from "./levels";
import { outtaManifest } from "./manifest";

/** Everything Outta Here remembers lives in this browser only, in the kit store `anykey.escape.save`. */

export type Progress = {
  runs: number;
  escapes: number;
  /** Best escape time and score per difficulty. */
  best: Partial<Record<LevelId, { time: number; score: number }>>;
  /** Stars (1–3) and best time per campaign screen. */
  screens: Record<string, { stars: number; time: number }>;
  daily: Record<string, { won: boolean; time: number; share: string }>;
  achievements: string[];
  /** The difficulty last picked for a Run. */
  level: LevelId;
};

const EMPTY: Progress = { runs: 0, escapes: 0, best: {}, screens: {}, daily: {}, achievements: [], level: "normal" };

type Saved = Omit<Progress, "achievements">;

export const outtaStore = createStore<Saved>(outtaManifest.id, {
  version: 2,
  defaults: withoutAchievements(EMPTY),
  legacy: { key: LEGACY_SAVES[outtaManifest.id], version: LEGACY_VERSION },
  // Version 2 moved the achievements into the Keyring, which imports them from the old save itself.
  migrations: { 2: (old) => withoutAchievements(old as Progress) },
});

const progress = createProgress<Progress>(outtaManifest.id, outtaStore, {
  dailies: (p) => p.daily,
  play: (before, after) => (after.runs > before.runs ? { won: after.escapes > before.escapes } : null),
  seed: (p) => ({ plays: p.runs, wins: p.escapes }),
});

export const getProgress = progress.get;

/** Updates progress; returns the achievements this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything Outta Here remembers, its keycaps included. */
export const resetProgress = () => forgetGame(outtaManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress =>
  p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] };

/** The badges a finished (or still running) game has earned, whatever the mode. */
export function earnedBy(g: Game, events: { chainBest: number; popped: boolean }) {
  const ids: string[] = [];
  if (g.dives > 0) ids.push("under-keys");
  if (g.tunnels > 0) ids.push("wraparound");
  if (events.chainBest >= 15) ids.push("chain-reaction");
  if (g.rushes > 0) ids.push("rush-hour");
  if (g.collected.length === 6) ids.push("spelled-it");
  if (events.popped) ids.push("pop");
  const level = g.s.id;
  if (g.state === "won" && (level === "normal" || level === "hard" || level === "daily") && g.maxHesitation <= 0.5) ids.push("no-hesitation");
  if (g.state === "won" && level === "hard" && g.hits === 0) ids.push("untouched");
  return ids;
}
