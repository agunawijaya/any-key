"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { LEGACY_SAVES, LEGACY_VERSION } from "@/lib/kit/legacy";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import { sticklerManifest } from "./manifest";
import { DEFAULT_HANDFULS, HANDFULS_PRESETS, type HandfulsSetup } from "./modes";

/** Everything Stickler remembers lives in this browser only, in the kit store `anykey.23mtch.save`. */

export type Skin = "matches" | "glow" | "candy";

export const SKINS: { id: Skin; name: string; blurb: string }[] = [
  { id: "matches", name: "Matches", blurb: "The original. Strike, flare, done." },
  { id: "glow", name: "Glow sticks", blurb: "Snap them. Neon everything." },
  { id: "candy", name: "Candy sticks", blurb: "Sweet, stripy and very crunchy." },
];

export type Progress = {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  ladder: Record<number, number>; // table id → stars (1–3)
  daily: Record<string, { won: boolean; share: string }>;
  achievements: string[];
  skinsUsed: Skin[];
  skin: Skin;
  level: "rookie" | "clever" | "master";
  hintsSeen: number;
  /** Handfuls wins per preset id ("3-5"), and how many of them were against Master. */
  handfuls: Record<string, { wins: number; masterWins: number }>;
  /** The last Handfuls table set up in the lobby. */
  handfulsSetup: HandfulsSetup;
};

const EMPTY: Progress = {
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  ladder: {},
  daily: {},
  achievements: [],
  skinsUsed: [],
  skin: "matches",
  level: "clever",
  hintsSeen: 0,
  handfuls: {},
  handfulsSetup: DEFAULT_HANDFULS,
};

type Saved = Omit<Progress, "achievements">;

const SAVED_DEFAULTS: Saved = withoutAchievements(EMPTY);

/** Saves from before Handfuls lack its fields; fill them in and ignore a preset id this version doesn't know. */
export function normalise(saved: Partial<Saved>): Saved {
  const p = { ...SAVED_DEFAULTS, ...saved };
  const setup = { ...DEFAULT_HANDFULS, ...(saved.handfulsSetup ?? {}) };
  if (!HANDFULS_PRESETS.some((x) => x.id === setup.preset)) setup.preset = DEFAULT_HANDFULS.preset;
  return { ...p, handfuls: p.handfuls ?? {}, handfulsSetup: setup };
}

export const sticklerStore = createStore<Saved>(sticklerManifest.id, {
  version: 2,
  defaults: SAVED_DEFAULTS,
  legacy: { key: LEGACY_SAVES[sticklerManifest.id], version: LEGACY_VERSION },
  // Version 2 moved the achievements into the Keyring, which imports them from the old save itself.
  migrations: { 2: (old) => withoutAchievements(old as Progress) },
  normalise,
});

const progress = createProgress<Progress>(sticklerManifest.id, sticklerStore, {
  dailies: (p) => p.daily,
  play: (before, after) =>
    after.wins + after.losses > before.wins + before.losses ? { won: after.wins > before.wins } : null,
  seed: (p) => ({ plays: p.wins + p.losses, wins: p.wins, streak: p.streak, bestStreak: p.bestStreak }),
});

export const getProgress = progress.get;

/** Updates progress; returns the achievements this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything Stickler remembers, its keycaps included. */
export const resetProgress = () => forgetGame(sticklerManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress =>
  p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] };
