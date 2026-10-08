/*
 * The Keyring: one local profile across the whole collection. It holds every
 * unlocked achievement (each one is a keycap), the dates of finished dailies,
 * and a few collection-wide flags. XP, levels and the daily streak are
 * derived from that, never stored, so they can't drift out of step.
 */

import { localDateKey, shiftDateKey } from "./daily";
import { LEGACY_SAVES, legacyAchievementsAndDailies } from "./legacy";
import type { AchievementTier, GameManifest } from "./manifest";
import { createStore, storage } from "./save";

export type KeyringData = {
  /** gameId → achievement id → when it was unlocked (ms since 1970). */
  unlocked: Record<string, Record<string, number>>;
  /** Local date key → ids of the games whose daily was finished that day. */
  dailies: Record<string, string[]>;
  /** The highest level whose celebration the player has seen. */
  levelSeen: number;
  /** Games whose first-visit hint ("Esc — pause and menu") was dismissed. */
  hintsDismissed: string[];
};

const EMPTY: KeyringData = { unlocked: {}, dailies: {}, levelSeen: 1, hintsDismissed: [] };

/** On a first visit after the retrofit, collect what the old per-game saves had earned. */
export function importLegacyKeyring(read: (key: string) => string | null, now = Date.now()): KeyringData {
  const data: KeyringData = { ...EMPTY, unlocked: {}, dailies: {} };
  for (const [gameId, key] of Object.entries(LEGACY_SAVES)) {
    let parsed: unknown;
    try {
      const raw = read(key);
      parsed = raw === null ? undefined : JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const { achievements, dailies } = legacyAchievementsAndDailies(parsed);
    if (achievements.length) data.unlocked[gameId] = Object.fromEntries(achievements.map((id) => [id, now]));
    for (const date of dailies) data.dailies[date] = [...(data.dailies[date] ?? []), gameId];
  }
  return data;
}

const store = createStore<KeyringData>("keyring", {
  version: 1,
  defaults: EMPTY,
  normalise: (data) => ({ ...EMPTY, ...data }),
});

let importChecked = false;

/** The keyring key is created by the first import, so the old saves are read exactly once. */
function ensureImported() {
  if (importChecked || typeof window === "undefined") return;
  importChecked = true;
  if (storage.read(store.key) !== null) return;
  store.initialise(importLegacyKeyring((key) => storage.read(key)));
}

/** The Keyring store. Every read and write first makes sure the old saves were imported. */
export const keyringStore = {
  key: store.key,
  defaults: store.defaults,
  subscribe: store.subscribe,
  get(): KeyringData {
    ensureImported();
    return store.get();
  },
  set(update: KeyringData | ((current: KeyringData) => KeyringData)): KeyringData {
    ensureImported();
    return store.set(update);
  },
};

/* ---------- Dailies and the streak ---------- */

/** Marks a game's daily for the local date `key` ("2026-10-07") as finished. Returns false if it already was. */
export function completeDailyOn(gameId: string, key: string): boolean {
  if ((keyringStore.get().dailies[key] ?? []).includes(gameId)) return false;
  keyringStore.set((data) => ({ ...data, dailies: { ...data.dailies, [key]: [...(data.dailies[key] ?? []), gameId] } }));
  return true;
}

/** Marks a game's daily as finished today. Returns false if it already was. */
export const completeDaily = (gameId: string, date = new Date()) => completeDailyOn(gameId, localDateKey(date));

export const dailyDoneToday = (data: KeyringData, gameId: string, date = new Date()) => (data.dailies[localDateKey(date)] ?? []).includes(gameId);

export type Streak = {
  /** Days in a row with at least one daily, ending today, or yesterday while today is still open. */
  current: number;
  /** Monday to Sunday of this week: true where a daily was played. */
  week: { key: string; played: boolean; today: boolean; future: boolean }[];
};

export function streakOf(dailies: KeyringData["dailies"], date = new Date()): Streak {
  const today = localDateKey(date);
  const played = (key: string) => (dailies[key]?.length ?? 0) > 0;
  let cursor = played(today) ? today : shiftDateKey(today, -1);
  let current = 0;
  while (played(cursor)) {
    current++;
    cursor = shiftDateKey(cursor, -1);
  }
  // getDay(): Sunday is 0. The week row starts on Monday.
  const fromMonday = (date.getDay() + 6) % 7;
  const monday = shiftDateKey(today, -fromMonday);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = shiftDateKey(monday, i);
    return { key, played: played(key), today: key === today, future: i > fromMonday };
  });
  return { current, week };
}

/* ---------- XP and levels ---------- */

export const TIER_XP: Record<AchievementTier, number> = { common: 10, rare: 30, legendary: 80 };
export const DAILY_XP = 5;

/** Our own keyboard words, from first press to master. Levels past the list keep the last title. */
export const LEVEL_TITLES = [
  "Home Row",
  "Space Bar",
  "Shift",
  "Tab",
  "Caps Lock",
  "Hotkey",
  "Function",
  "Macro",
  "Power User",
  "Mechanical",
  "Any Key",
  "Escape Artist",
] as const;

export function xpOf(data: KeyringData, games: readonly GameManifest[]): number {
  let xp = 0;
  for (const game of games) {
    const unlocked = data.unlocked[game.id] ?? {};
    for (const achievement of game.achievements) if (unlocked[achievement.id]) xp += TIER_XP[achievement.tier];
  }
  for (const ids of Object.values(data.dailies)) xp += ids.length * DAILY_XP;
  return xp;
}

/** XP needed to reach `level` from nothing. Going from level n to n + 1 costs 40·n. */
export const xpForLevel = (level: number) => 20 * level * (level - 1);

export type Level = {
  level: number;
  title: string;
  /** XP earned inside this level, and what the whole level takes. */
  into: number;
  span: number;
};

export function levelOf(xp: number): Level {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    into: xp - floor,
    span: xpForLevel(level + 1) - floor,
  };
}

/* ---------- Small flags ---------- */

export function dismissHint(gameId: string) {
  keyringStore.set((data) => (data.hintsDismissed.includes(gameId) ? data : { ...data, hintsDismissed: [...data.hintsDismissed, gameId] }));
}

export function markLevelSeen(level: number) {
  keyringStore.set((data) => (data.levelSeen >= level ? data : { ...data, levelSeen: level }));
}

/** Removes one game from the Keyring: its keycaps and its finished dailies. */
export function forgetGameInKeyring(gameId: string) {
  keyringStore.set((data) => {
    const unlocked = { ...data.unlocked };
    delete unlocked[gameId];
    const dailies: KeyringData["dailies"] = {};
    for (const [key, ids] of Object.entries(data.dailies)) {
      const kept = ids.filter((id) => id !== gameId);
      if (kept.length) dailies[key] = kept;
    }
    return { ...data, unlocked, dailies, hintsDismissed: data.hintsDismissed.filter((id) => id !== gameId) };
  });
}

/** Wipes the Keyring. The import does not run again: the old saves are deleted with it. */
export function forgetKeyring() {
  keyringStore.set({ ...EMPTY, unlocked: {}, dailies: {} });
}
