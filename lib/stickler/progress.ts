"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_HANDFULS, HANDFULS_PRESETS, type HandfulsSetup } from "./modes";

/** Everything Stickler remembers lives in this browser only. */

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

const KEY = "anykey.stickler.v1";

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

export const ACHIEVEMENTS: { id: string; name: string; how: string; icon: string }[] = [
  { id: "first-light", name: "First Light", how: "Win your first game", icon: "🔥" },
  { id: "stickler", name: "Rule Bender", how: "Try to take more (or fewer) than the rules allow", icon: "🙅" },
  { id: "secret-four", name: "The Secret Four", how: "Beat Master Sparky in Classic without a hint", icon: "4️⃣" },
  { id: "flawless", name: "Flawless", how: "Win a game where every move was perfect", icon: "💎" },
  { id: "hot-streak", name: "Hot Streak", how: "Win three games in a row", icon: "📈" },
  { id: "climber", name: "Climber", how: "Clear five Ladder tables", icon: "🪜" },
  { id: "summit", name: "Summit", how: "Clear all ten Ladder tables", icon: "🏔️" },
  { id: "marienbad", name: "Last Year at Marienbad", how: "Beat the 1-3-5-7 table", icon: "🎞️" },
  { id: "daily-3", name: "Daily Habit", how: "Win three Daily puzzles", icon: "📅" },
  { id: "time-traveller", name: "Time Traveller", how: "Win in 1981 mode", icon: "📟" },
  { id: "rivals", name: "Rivals", how: "Finish a Versus game", icon: "🤝" },
  { id: "collector", name: "Collector", how: "Play with all three stick styles", icon: "🎨" },
  { id: "clean-sweep", name: "Clean Sweep", how: "Make Sparky sweep 3 or more sticks in Handfuls", icon: "🧹" },
  { id: "handful-master", name: "Handful Master", how: "Beat Master Sparky on every Handfuls preset", icon: "🖐️" },
];

let current: Progress = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/** Saves from before Handfuls lack its fields; fill them in and ignore a preset id this version doesn't know. */
function normalise(saved: Partial<Progress>): Progress {
  const p = { ...EMPTY, ...saved };
  const setup = { ...DEFAULT_HANDFULS, ...(saved.handfulsSetup ?? {}) };
  if (!HANDFULS_PRESETS.some((x) => x.id === setup.preset)) setup.preset = DEFAULT_HANDFULS.preset;
  return { ...p, handfuls: p.handfuls ?? {}, handfulsSetup: setup };
}

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalise(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot() {
  if (!loaded) {
    current = read();
    loaded = true;
  }
  return current;
}

export function getProgress() {
  return snapshot();
}

/** Updates progress; returns the achievements this update unlocked. */
export function updateProgress(change: (p: Progress) => Progress): string[] {
  const before = snapshot();
  const next = change(before);
  const unlocked = next.achievements.filter((a) => !before.achievements.includes(a));
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows may refuse storage; progress then lasts for this visit only.
  }
  listeners.forEach((l) => l());
  return unlocked;
}

export function resetProgress() {
  updateProgress(() => ({ ...EMPTY }));
}

export function useProgress() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => EMPTY,
  );
}

export const withAchievement = (p: Progress, id: string): Progress =>
  p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] };
