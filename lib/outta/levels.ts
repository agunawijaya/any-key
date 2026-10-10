/*
 * Difficulty settings for Outta Here. Every number that shapes a run lives
 * here, so balancing is one file (and the bot check in scripts/check-outta.ts
 * says what each change does to a human-like player's chances).
 */

export type LevelId = "chill" | "normal" | "hard";

export type Settings = {
  /** A difficulty ("normal"), or a campaign screen ("micro-3"). */
  id: string;
  name: string;
  blurb: string;
  cols: number;
  rows: number;
  /**
   * The screen starts as stone floors: walls across the screen, each with a
   * gap (right, left, right... so the way down zigzags), plus a few loose
   * stones. Wood and glass only ever arrive with the rain.
   */
  floors: number;
  gaps: number;
  /** Where the gaps go: thirds (the usual zigzag) or the very ends (where the edge tunnels join rows). */
  gapStyle?: "thirds" | "ends";
  /** Stone pillars that cut the top corridor; the way past them is under the keys. */
  pillars?: number;
  /** "sand": blocks drop down their column and pile up instead of landing anywhere. */
  rainStyle?: "anywhere" | "sand";
  /** "crash": no exit; the way out is the bottom-left corner, where the 1980 program crashed. */
  exitMode?: "plus" | "crash";
  /** Share of each corridor holding a loose stone at the start. */
  prefill: number;
  /** Chances of wood (push), glass (bomb) and stone (go round), for the prefill and the rain. */
  mix: { wood: number; glass: number; stone: number };
  /** Blocks per second while you keep moving. */
  rain: number;
  /** Extra blocks per second at full hesitation. */
  rainHesitant: number;
  /** Seconds of standing still before hesitation starts, and until it is full. */
  hesitateAfter: number;
  hesitateFull: number;
  /** Seconds of standing still after which the rain may land right next to you. */
  trapAfter: number;
  /** Warning before a block lands (a dashed shadow), seconds. */
  warning: number;
  /** The bottom row never gets a block (the 1980 program's rule). */
  floorClear: boolean;
  /** A block landing on you costs a heart (otherwise it never lands on you). */
  rainHits: boolean;
  hearts: number;
  bombsOnScreen: number;
  fuse: number;
  /** Average seconds between bonuses; share of them that are Chain Rush. */
  bonusEvery: number;
  rushShare: number;
  bouncers: number;
  bouncerStep: number;
  /** Eraser: seconds before it sets off, seconds per step (null: none). */
  eraser: { delay: number; step: number } | null;
  glitch: { delay: number; step: number } | null;
  /**
   * The Copycat, who pushes and bombs by your rules: seconds before it sets
   * off, seconds per step, seconds after dropping a bomb before it may drop
   * another, and how long it shows what it is about to do before a push and
   * before a bomb (null: none).
   */
  copycat: { delay: number; step: number; reload: number; brace: number; arm: number } | null;
  /** Mega bombs waiting on the screen at once (0: none). You carry one at a time. */
  megaBombs: number;
  /** Seconds for the second star. */
  par: number;
};

const base = {
  cols: 64,
  rows: 16,
  warning: 0.55,
  fuse: 2.5,
};

export const LEVELS: Record<LevelId, Settings> = {
  chill: {
    ...base,
    id: "chill",
    name: "Chill",
    blurb: "No chasers, a slow rain and a floor that stays clear.",
    floors: 3,
    gaps: 2,
    prefill: 0.03,
    mix: { wood: 0.4, glass: 0.45, stone: 0.15 },
    rain: 1.6,
    rainHesitant: 3,
    hesitateAfter: 1.5,
    hesitateFull: 6,
    trapAfter: Infinity,
    floorClear: true,
    rainHits: false,
    hearts: Infinity,
    bombsOnScreen: 2,
    bonusEvery: 9,
    rushShare: 0.25,
    bouncers: 0,
    bouncerStep: 0.4,
    eraser: null,
    glitch: null,
    copycat: null,
    megaBombs: 0,
    par: 18,
  },
  normal: {
    ...base,
    id: "normal",
    name: "Normal",
    blurb: "The Eraser follows your trail, Bouncers guard their lanes, and a Mega bomb waits to be found.",
    floors: 4,
    gaps: 1,
    prefill: 0.05,
    mix: { wood: 0.35, glass: 0.4, stone: 0.25 },
    rain: 3,
    rainHesitant: 6,
    hesitateAfter: 0.8,
    hesitateFull: 4,
    trapAfter: 2.5,
    floorClear: false,
    rainHits: false,
    hearts: 3,
    bombsOnScreen: 1,
    bonusEvery: 12,
    rushShare: 0.2,
    bouncers: 3,
    bouncerStep: 0.34,
    eraser: { delay: 6, step: 0.3 },
    glitch: null,
    copycat: null,
    megaBombs: 1,
    par: 45,
  },
  hard: {
    ...base,
    id: "hard",
    name: "Hard",
    blurb: "All four chasers, the Copycat too, a heavy rain, and it can land on you.",
    floors: 4,
    gaps: 1,
    prefill: 0.07,
    mix: { wood: 0.3, glass: 0.38, stone: 0.32 },
    rain: 3.3,
    rainHesitant: 8,
    hesitateAfter: 0.6,
    hesitateFull: 3,
    trapAfter: 1.5,
    floorClear: false,
    rainHits: true,
    hearts: 2,
    bombsOnScreen: 1,
    bonusEvery: 15,
    rushShare: 0.15,
    bouncers: 4,
    bouncerStep: 0.3,
    eraser: { delay: 4, step: 0.28 },
    glitch: { delay: 6, step: 0.34 },
    copycat: { delay: 7, step: 0.22, reload: 5, brace: 0.45, arm: 0.75 },
    megaBombs: 1,
    par: 50,
  },
};
