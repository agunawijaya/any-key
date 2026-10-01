"use client";

import { useSyncExternalStore } from "react";
import type { Game } from "./engine";
import type { LevelId } from "./levels";

/** Everything Outta Here remembers lives in this browser only. */

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

const KEY = "anykey.outta.v1";

const EMPTY: Progress = { runs: 0, escapes: 0, best: {}, screens: {}, daily: {}, achievements: [], level: "normal" };

export const ACHIEVEMENTS: { id: string; name: string; how: string; icon: string }[] = [
  { id: "scape", name: "*SCAPE", how: "Get out in 1980 mode", icon: "✳️" },
  { id: "under-keys", name: "Under the Keys", how: "Hide under the keyboard", icon: "⌨️" },
  { id: "wraparound", name: "Wraparound", how: "Take an edge tunnel", icon: "↪️" },
  { id: "chain-reaction", name: "Chain Reaction", how: "Break 15 glass blocks with one chain bomb", icon: "🔗" },
  { id: "rush-hour", name: "Rush Hour", how: "Pick up a Chain Rush", icon: "⏱️" },
  { id: "spelled-it", name: "Spelled It", how: "Collect E-S-C-A-P-E in one run", icon: "🔤" },
  { id: "no-hesitation", name: "No Hesitation", how: "Get out on Normal or Hard with the meter never past half", icon: "⚡" },
  { id: "untouched", name: "Untouched", how: "Get out on Hard without a single hit", icon: "🛡️" },
  { id: "pop", name: "Pop!", how: "Pop a chaser with a bomb", icon: "💥" },
  { id: "crash-test", name: "Crash Test", how: "Crash the computer in 1980 mode", icon: "🪦" },
  { id: "daily-driver", name: "Daily Driver", how: "Get out of five Daily Escapes", icon: "📅" },
  { id: "out-of-the-machine", name: "Out of the Machine", how: "Clear all thirty Screens", icon: "🖥️" },
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
