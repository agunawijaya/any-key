"use client";

import { useSyncExternalStore } from "react";
import type { Difficulty } from "./difficulty";
import { DEFAULT_FLAG, type FlagDesign } from "./flags";
import type { FreeStart } from "./freeflight";
import type { GradeId } from "./grades";
import type { WorldId } from "./worlds";

/** Everything Don't Crater remembers lives in this browser only. */

export type Progress = {
  flights: number;
  landings: number;
  craters: number;
  /** Best (slowest) touchdown per world, km/h. */
  best: Partial<Record<WorldId, number>>;
  landed: WorldId[];
  flagged: WorldId[];
  /** Mission id → stars (1–3); present once cleared. */
  missions: Record<number, number>;
  daily: Record<string, { speed: number; grade: GradeId; share: string }>;
  dailyLandings: number;
  achievements: string[];
  flag: FlagDesign;
  guide: boolean;
  /** Landing assist: the soft (5 km/h) and limit (20 km/h) lines. */
  assist: boolean;
  world: WorldId;
  /** Fuel difficulty for every mode but 1979 mode. */
  difficulty: Difficulty;
  /** Free Flight: the scan assist, the last start chosen, the last seed flown, and the named sites' best results. */
  scan: boolean;
  freeStart: FreeStart;
  freeSeed: number;
  sites: Record<string, SiteBest>;
};

/** A named site's best: stars from the landing grade, and the precision bonuses earned there. */
export type SiteBest = { stars: number; speed: number; narrow: boolean; centre: boolean };

const KEY = "anykey.dontcrater.v1";

const EMPTY: Progress = {
  flights: 0,
  landings: 0,
  craters: 0,
  best: {},
  landed: [],
  flagged: [],
  missions: {},
  daily: {},
  dailyLandings: 0,
  achievements: [],
  flag: DEFAULT_FLAG,
  guide: true,
  assist: false,
  world: "moon",
  difficulty: "standard",
  scan: false,
  freeStart: "final",
  freeSeed: 0,
  sites: {},
};

export const ACHIEVEMENTS: { id: string; name: string; how: string; icon: string }[] = [
  { id: "first-touch", name: "First Touch", how: "Land anywhere without breaking anything", icon: "🛬" },
  { id: "butter", name: "Butter", how: "Touch down under 2 km/h", icon: "🧈" },
  { id: "postcards", name: "Postcard Set", how: "Land on all four worlds", icon: "🖼️" },
  { id: "flag-planter", name: "Flag Planter", how: "Plant your flag on all four worlds", icon: "🚩" },
  { id: "hoverslam", name: "Hoverslam", how: "Land with 90% of a perfect hoverslam's fuel left", icon: "🔥" },
  { id: "wildcatter", name: "Wildcatter", how: "Hit the ground so hard you strike oil", icon: "🛢️" },
  { id: "crater-maker", name: "Crater Maker", how: "Leave a brand new crater", icon: "🕳️" },
  { id: "ten-seconds", name: "Ten Seconds Flat", how: "Land in Ten-Second mode", icon: "⏱️" },
  { id: "time-traveller", name: "Time Traveller", how: "Land in 1979 mode", icon: "📟" },
  { id: "schrodinger", name: "Schrödinger's Lander", how: "In 1979 mode, land between 19 and 20 km/h", icon: "🐈‍⬛" },
  { id: "mission-control", name: "Mission Control", how: "Clear all ten missions", icon: "🏆" },
  { id: "daily-3", name: "Daily Driver", how: "Land three Daily Drops", icon: "📅" },
  { id: "pinpoint", name: "Pinpoint", how: "In Free Flight, stand on a flat narrower than 15 m", icon: "📍" },
  { id: "sidewinder", name: "Sidewinder", how: "Kill more than 500 km/h of drift and land standing", icon: "🐍" },
  { id: "oops", name: "Oops", how: "Tip over for the first time", icon: "🙃" },
];

let current: Progress = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
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
  updateProgress((p) => ({ ...EMPTY, flag: p.flag }));
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

export const addOnce = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);
