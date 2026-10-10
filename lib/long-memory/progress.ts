"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import { freshMind, type LearnerMind } from "./learner";
import { longMemoryManifest } from "./manifest";
import type { RuleId } from "./rules";
import type { Difficulty } from "./scholar";

/**
 * Everything the game remembers lives in this browser only, in the kit store
 * `anykey.long-memory.save`: the settings, the Learner's book, the records,
 * the dailies. The Learner's book is the point of the game, so it is kept
 * unless the player wipes it (Settings) or forgets the game's data.
 */

export type Opponent = "learner" | "scholar" | "friend";

export type Settings = {
  rules: RuleId;
  /** Seeds per pit for Kalah, 3 to 6. */
  kalahSeeds: number;
  /** Hovering a pit shows where its seeds will go. */
  preview: boolean;
  /** The numbers by the pits. Off unless the player turns them on; the stores' totals always show. */
  counts: boolean;
  speed: "relaxed" | "normal" | "brisk";
  /** "keep": the book survives between visits. "1978": wiped when you leave, as the original forgot everything. */
  memory: "keep" | "1978";
  scholar: Difficulty;
};

export type Record3 = { played: number; won: number; drawn: number; lost: number };

export type Progress = {
  settings: Settings;
  mind: LearnerMind;
  /** Per rule set and opponent, e.g. "awari1978/learner". */
  records: Partial<Record<string, Record3>>;
  /** Openings (first eight moves, as the Learner codes them) you have beaten the Learner with, and how often. */
  beatenWith: Record<string, number>;
  daily: Record<string, { solved: boolean; tries: number; share: string }>;
  /** 1970s mode: games in the terminal, and how many times the table ran out. */
  terminal: { games: number; crashes: number };
  /** Rule sets whose rules card the player has seen. */
  seenRules: RuleId[];
  achievements: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  rules: "awari1978",
  kalahSeeds: 4,
  preview: true,
  counts: false,
  speed: "normal",
  memory: "keep",
  scholar: "normal",
};

const EMPTY: Progress = {
  settings: DEFAULT_SETTINGS,
  mind: freshMind(),
  records: {},
  beatenWith: {},
  daily: {},
  terminal: { games: 0, crashes: 0 },
  seenRules: [],
  achievements: [],
};

type Saved = Omit<Progress, "achievements">;

export const longMemoryStore = createStore<Saved>(longMemoryManifest.id, {
  version: 1,
  defaults: withoutAchievements(EMPTY),
  normalise: (saved) => ({
    ...withoutAchievements(EMPTY),
    ...saved,
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    mind: { ...freshMind(), ...saved.mind, lessons: Array.isArray(saved.mind?.lessons) ? saved.mind.lessons : [] },
    terminal: { ...EMPTY.terminal, ...saved.terminal },
    seenRules: Array.isArray(saved.seenRules) ? saved.seenRules : [],
  }),
});

const progress = createProgress<Progress>(longMemoryManifest.id, longMemoryStore, {
  dailies: (p) => Object.fromEntries(Object.entries(p.daily).filter(([, d]) => d.solved)),
  play: (before, after) => {
    const total = (p: Progress) => Object.values(p.records).reduce((sum, r) => sum + (r?.played ?? 0), 0);
    const wins = (p: Progress) => Object.values(p.records).reduce((sum, r) => sum + (r?.won ?? 0), 0);
    return total(after) > total(before) ? { won: wins(after) > wins(before) } : null;
  },
});

export const getProgress = progress.get;

/** Updates progress; returns the keycaps this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything the game remembers, the Learner's book and the keycaps included. */
export const resetProgress = () => forgetGame(longMemoryManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress => (p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] });

/*
 * The Learner's book when the player chose "as in 1978": it lives only as
 * long as the page, and is gone on the next visit, as the original forgot
 * everything when it stopped.
 */
let sessionMind: LearnerMind = freshMind();

export const currentMind = (p: Progress) => (p.settings.memory === "keep" ? p.mind : sessionMind);

export function keepMind(mind: LearnerMind) {
  if (getProgress().settings.memory === "keep") updateProgress((p) => ({ ...p, mind }));
  else sessionMind = mind;
}

/** Wipes the Learner's book (and its two never-cleared numbers): a fresh start, as on the day it was typed in. */
export function wipeMind() {
  sessionMind = freshMind();
  return updateProgress((p) => withAchievement({ ...p, mind: freshMind() }, "clean-slate"));
}
