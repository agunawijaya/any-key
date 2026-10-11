"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { Ending } from "./corrida";
import { solYSombraManifest } from "./manifest";
import type { PlayStyleId } from "./playStyles";
import type { TraditionId } from "./traditions";

/**
 * Everything the game remembers lives in this browser only, in the kit store
 * `anykey.sol-y-sombra.save`: the settings, the records of each play style,
 * and the 1970s terminal's tally.
 */

/** The looks: the Vintage Poster now, the Stylized 3D style to come. */
export type StyleId = "poster" | "stylized-3d";

export type Settings = {
  playStyle: PlayStyleId;
  tradition: TraditionId;
  style: StyleId;
  /** Slow the closest moment of each pass. */
  slowMotion: boolean;
  /** How full the stands are: fewer people draw faster on a slow machine. */
  crowd: "full" | "half";
  /** The game's own sounds (crowd, hooves, cape); the collection's switch in the top bar silences everything. */
  sound: boolean;
};

/** One play style's records: every play style keeps its own. */
export type Records = {
  corridas: number;
  endings: Record<Ending, number>;
  /** How many afternoons ended at each of the crowd's four tiers, silence to shoulders. */
  tiers: [number, number, number, number];
  passes: number;
  closeCalls: number;
  gorings: number;
  /** The warmest the crowd has been at the end of an afternoon. */
  bestTotal: number;
  /** The most passes made before going to the moment of truth. */
  mostPasses: number;
};

export type Progress = {
  settings: Settings;
  records: Partial<Record<PlayStyleId, Records>>;
  /** 1970s mode: afternoons in the terminal, bulls killed there, awards given. */
  terminal: { games: number; kills: number; awards: number };
  achievements: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  playStyle: "classic",
  tradition: "corrida",
  style: "poster",
  slowMotion: true,
  crowd: "full",
  sound: true,
};

export const emptyRecords = (): Records => ({
  corridas: 0,
  endings: { rested: 0, retired: 0, infirmary: 0, returned: 0 },
  tiers: [0, 0, 0, 0],
  passes: 0,
  closeCalls: 0,
  gorings: 0,
  bestTotal: 0,
  mostPasses: 0,
});

const EMPTY: Progress = {
  settings: DEFAULT_SETTINGS,
  records: {},
  terminal: { games: 0, kills: 0, awards: 0 },
  achievements: [],
};

type Saved = Omit<Progress, "achievements">;

export const solYSombraStore = createStore<Saved>(solYSombraManifest.id, {
  version: 1,
  defaults: withoutAchievements(EMPTY),
  normalise: (saved) => ({
    ...withoutAchievements(EMPTY),
    ...saved,
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    records: saved.records ?? {},
    terminal: { ...EMPTY.terminal, ...saved.terminal },
  }),
});

const totalCorridas = (p: Progress) => Object.values(p.records).reduce((sum, r) => sum + (r?.corridas ?? 0), 0);
const totalHonours = (p: Progress) => Object.values(p.records).reduce((sum, r) => sum + (r ? r.tiers[2] + r.tiers[3] : 0), 0);

const progress = createProgress<Progress>(solYSombraManifest.id, solYSombraStore, {
  // An afternoon counts as won when the crowd gives a lap of honour or more.
  play: (before, after) => (totalCorridas(after) > totalCorridas(before) ? { won: totalHonours(after) > totalHonours(before) } : null),
});

export const getProgress = progress.get;

/** Updates progress; returns the keycaps this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything the game remembers, the keycaps included. */
export const resetProgress = () => forgetGame(solYSombraManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress => (p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] });
