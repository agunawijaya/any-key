"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import { tenTurnsManifest } from "./manifest";
import type { Medals } from "./tactics";

/**
 * What Ten Turns in the Pit remembers, in this browser only (`anykey.ten-turns.save`):
 * the settings, Classic's record, the medals of every Tactics pit, the Daily
 * Pits, the 1970s terminal's games and a few counters behind the keycaps.
 */

export type PlayStyle = "classic" | "tactics";

export type Settings = {
  playStyle: PlayStyle;
  /** The look: "storybook" now; more styles arrive later. */
  style: "storybook" | "arena" | "graph-paper" | "lab";
  /** Tactics' intent arrows: always, only while you hold I, or never. */
  intent: "on" | "request" | "off";
  /** Which letters move you: the shape is the same, the keyboard isn't. */
  keys: "qwerty" | "azerty" | "qwertz";
  speed: "relaxed" | "normal" | "brisk";
};

export type ClassicRecord = { played: number; released: number; squished: number; crunched: number; streak: number; bestStreak: number };

export type PitRecord = { played: number; survived: number; best: Medals };

export type DailyRecord = { number: number; survived: boolean; tries: number; untouched: boolean; toolsUsed: number; turns: number; share: string };

export type Progress = {
  settings: Settings;
  classic: ClassicRecord;
  pits: Record<string, PitRecord>;
  daily: Record<string, DailyRecord>;
  terminal: { games: number; released: number; squished: number; crunched: number };
  counters: { carrotsEaten: number; tunnels: number; longestChain: number; stoneBonks: number; dailySurvived: number };
  achievements: string[];
};

export const DEFAULT_SETTINGS: Settings = { playStyle: "classic", style: "storybook", intent: "on", keys: "qwerty", speed: "normal" };

const EMPTY: Progress = {
  settings: DEFAULT_SETTINGS,
  classic: { played: 0, released: 0, squished: 0, crunched: 0, streak: 0, bestStreak: 0 },
  pits: {},
  daily: {},
  terminal: { games: 0, released: 0, squished: 0, crunched: 0 },
  counters: { carrotsEaten: 0, tunnels: 0, longestChain: 0, stoneBonks: 0, dailySurvived: 0 },
  achievements: [],
};

type Saved = Omit<Progress, "achievements">;

export const tenTurnsStore = createStore<Saved>(tenTurnsManifest.id, {
  version: 1,
  defaults: withoutAchievements(EMPTY),
  normalise: (saved) => ({
    ...withoutAchievements(EMPTY),
    ...saved,
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    classic: { ...EMPTY.classic, ...saved.classic },
    terminal: { ...EMPTY.terminal, ...saved.terminal },
    counters: { ...EMPTY.counters, ...saved.counters },
    pits: saved.pits ?? {},
    daily: saved.daily ?? {},
  }),
});

const total = (p: Progress) => p.classic.played + Object.values(p.pits).reduce((a, r) => a + r.played, 0) + Object.values(p.daily).reduce((a, r) => a + r.tries, 0);
const wins = (p: Progress) =>
  p.classic.released + p.classic.squished + Object.values(p.pits).reduce((a, r) => a + r.survived, 0) + Object.values(p.daily).filter((d) => d.survived).length;

const progress = createProgress<Progress>(tenTurnsManifest.id, tenTurnsStore, {
  dailies: (p) => Object.fromEntries(Object.entries(p.daily).filter(([, d]) => d.survived)),
  play: (before, after) => (total(after) > total(before) ? { won: wins(after) > wins(before) } : null),
});

export const getProgress = progress.get;

/** Updates progress; returns the keycaps this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything the game remembers, keycaps included. */
export const resetProgress = () => forgetGame(tenTurnsManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress => (p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] });

/** The better of two sets of medals, medal by medal. */
export const bestOf = (a: Medals, b: Medals): Medals => ({
  survived: a.survived || b.survived,
  toolsToSpare: a.toolsToSpare || b.toolsToSpare,
  untouched: a.untouched || b.untouched,
});
