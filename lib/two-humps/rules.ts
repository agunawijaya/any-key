/*
 * The numbers behind a Two Humps crossing, in one place. Every value here is
 * either the 1982 program's (noted) or tuned by the simulations in
 * scripts/check-two-humps.ts against the balance targets in docs/two-humps/NOTES.md.
 */

export type PursuerKind = "haboob" | "rival" | "gang";
export type Difficulty = "chill" | "normal" | "hard";
export type CommandId = "drink" | "walk" | "gallop" | "camp" | "scan" | "signal";

/** Miles to the far side. The 1982 program's goal too: more than 39. */
export const GOAL = 40;
/** Seven humps of stamina: the 1982 camel had "7 − F good days". */
export const MAX_FATIGUE = 7;
/** Turns you can go without a drink before you must (1982: the same four). */
export const THIRST_TURNS = 4;
/** Hours one turn takes on the trek's clock. */
export const HOURS_PER_TURN = 2;
/** Handfuls of seeds for the Ladle Gang. */
export const SEED_HANDFULS = 3;

export type DifficultyRules = {
  canteen: number;
  /** Pursuers' speed against Normal. */
  pursuerPace: number;
  /** Chance a stride runs on into another when nothing else happens (1982: about 58% overall). */
  runOn: number;
  /** Chance a signal brings help (1982: one in ten). */
  help: number;
  /** Two-hour steps before the Ladle Gang picks up your trail (1982: after the third turn). */
  gangSetsOff: number;
};

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  chill: { canteen: 7, pursuerPace: 0.85, runOn: 0.62, help: 0.15, gangSetsOff: 5 },
  normal: { canteen: 6, pursuerPace: 1, runOn: 0.58, help: 0.1, gangSetsOff: 5 },
  hard: { canteen: 5, pursuerPace: 1.15, runOn: 0.55, help: 0.07, gangSetsOff: 4 },
};

export type Stride = { min: number; max: number; step: number; fatigue: number };

/** A walk covers 0–9 miles and a gallop 0–18 in even steps, as in 1982. */
export const STRIDES: Record<"walk" | "gallop", Stride> = {
  walk: { min: 0, max: 9, step: 1, fatigue: 1 },
  gallop: { min: 0, max: 18, step: 2, fatigue: 3 },
};

/** Moving in the dark is slower. */
export const NIGHT_PACE = 0.6;

/** Chances, per stride, of each event (when the stride didn't end at an oasis). */
export type EventOdds = { gust: number; sore: number; caravan: number; singing: number; fossil: number };

export const BASE_EVENTS: EventOdds = { gust: 0.04, sore: 0.04, caravan: 0.04, singing: 0.05, fossil: 0 };

export const isNight = (clock: number) => {
  const c = ((clock % 24) + 24) % 24;
  return c >= 18 || c < 6;
};

/** Hours from `clock` to the next 06:00. */
export const hoursToDawn = (clock: number) => {
  const c = ((clock % 24) + 24) % 24;
  return c < 6 ? 6 - c : 30 - c;
};

/**
 * How each pursuer moves, in miles per two-hour step at Normal pace.
 * The Haboob never stops but slows at night; the rival rests every night and
 * gallops at dawn; the Ladle Gang sleeps by day and hops wildly by night,
 * in hops like the 1982 pygmies' (2.5 to 11.5 miles), half a mile shorter
 * at the top.
 *
 * Where each starts depends on when you do. Setting off at dusk, the rival
 * left at dawn and is already camped some way ahead; the gang's burrows are
 * a few miles back from the start.
 */
export const PURSUERS = {
  haboob: { start: { dawn: -11, dusk: -11 }, setsOff: 1, day: [2.4, 5.4] as const, night: [1.4, 3.2] as const },
  rival: { start: { dawn: 0, dusk: 8 }, setsOff: 1, day: [2.5, 5.8] as const, dawn: [7, 12] as const, night: [0, 0] as const },
  gang: { start: { dawn: 0, dusk: -8 }, setsOff: 5, day: [0, 1] as const, night: [2.5, 11] as const },
} as const;

/** Where a pursuer stands when a trek starting at `clock` begins. */
export const pursuerStart = (kind: PursuerKind, clock: number) => PURSUERS[kind].start[isNight(clock) ? "dusk" : "dawn"];
