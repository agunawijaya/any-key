/*
 * The modern rules, as data and pure functions: the bull's quality and its
 * tells, the crews' work, the cape moves, the two ways to finish, and the
 * odds each choice carries. The cards on screen show these numbers; the
 * engine rolls against the same ones.
 */

/* ---------- The bull ---------- */

export type Quality = 1 | 2 | 3 | 4 | 5;

export const QUALITIES: Record<Quality, { name: string; line: string; danger: number; credit: number; hold: number }> = {
  1: {
    name: "Magnificent",
    line: "Charges hard and true, and keeps charging. The crowd will remember a pass close to this one.",
    danger: 1.5,
    credit: 4,
    hold: 0.86,
  },
  2: { name: "Noble", line: "Brave and honest. Dangerous, but he follows the cape.", danger: 1.25, credit: 3, hold: 0.93 },
  3: { name: "Honest", line: "Neither great nor poor: he gives what he is given.", danger: 1, credit: 2, hold: 1 },
  4: { name: "Uneven", line: "Comes when he feels like it. Easier, and the crowd knows it.", danger: 0.82, credit: 1, hold: 1.07 },
  5: { name: "Meek", line: "Gentle and slow. Safe, and hard to make anyone cheer for.", danger: 0.62, credit: 0, hold: 1.14 },
};

export type Tell = "hooks-left" | "hooks-right" | "charges-late" | "tires-early" | "fixes-on-cape" | "keeps-strength";

/** Habits a bull shows in the corrals; each changes the odds in a way the cards spell out. */
export const TELLS: Record<Tell, { name: string; line: string }> = {
  "hooks-left": { name: "Hooks left", line: "Passes on his left are riskier." },
  "hooks-right": { name: "Hooks right", line: "Passes on his right are riskier." },
  "charges-late": { name: "Charges late", line: "The first two passes are riskier: he hesitates, then comes at once." },
  "tires-early": { name: "Tires early", line: "Each pass after the third is safer than the last, and the finish comes easier." },
  "fixes-on-cape": { name: "Fixes on the cape", line: "Close moves are less risky: he follows the cloth, not the man." },
  "keeps-strength": { name: "Keeps his strength", line: "The finish is harder: he is still strong at the end." },
};

export const TELL_LIST = Object.keys(TELLS) as Tell[];

/* ---------- The crews ---------- */

export type Work = 1 | 2 | 3 | 4 | 5;

export const WORK: Record<Work, { name: string; line: string }> = {
  1: { name: "Masterly", line: "They read him perfectly. Your passes are safer." },
  2: { name: "Good", line: "Clean, careful work. Your passes are a little safer." },
  3: { name: "Fair", line: "Nothing gained, nothing lost." },
  4: { name: "Rough", line: "They left him unsettled. Your passes are a little riskier." },
  5: { name: "Poor", line: "He comes out of it unpredictable. Your passes are riskier." },
};

/**
 * What both crews' work does to every pass's risk: better work, safer passes
 * (the 1970s program had this backwards). From 0.82 for two masterly crews
 * to 1.18 for two poor ones.
 */
export const crewFactor = (picadores: Work, banderilleros: Work) => 0.82 + 0.045 * (picadores - 1 + banderilleros - 1);

/* ---------- The cape moves ---------- */

export type MoveId = "veronica" | "outside" | "swirl";

export type MoveSpec = {
  id: MoveId;
  name: string;
  line: string;
  /** Risk of a goring on a first pass, for an honest bull and fair crews. */
  risk: number;
  /** Chance of a close call (a bravery bonus) when the pass is clean. */
  close: number;
  bravery: number;
  artistry: number;
  /** A close move: the bull's habits about close work apply to it. */
  closeWork: boolean;
};

export const MOVES: Record<MoveId, MoveSpec> = {
  veronica: {
    id: "veronica",
    name: "Veronica",
    line: "The cape swept slowly across, the horns past your waist.",
    risk: 0.075,
    close: 0.3,
    bravery: 1.5,
    artistry: 1,
    closeWork: true,
  },
  outside: {
    id: "outside",
    name: "Outside pass",
    line: "The cape held out at arm's length; the bull goes by at a distance.",
    risk: 0.035,
    close: 0.12,
    bravery: 1,
    artistry: 0.6,
    closeWork: false,
  },
  swirl: {
    id: "swirl",
    name: "Swirl",
    line: "A spin with the cape flared wide: showy, and the safest of the three.",
    risk: 0.012,
    close: 0.04,
    bravery: 0.25,
    artistry: 0.8,
    closeWork: false,
  },
};

export const MOVE_LIST: MoveId[] = ["veronica", "outside", "swirl"];

/** After a close call the crowd adds this much bravery and artistry. */
export const CLOSE_CALL = { bravery: 1, artistry: 0.5 };

/* ---------- The finish ---------- */

export type FinishId = "over-the-horns" | "waiting";

export type FinishSpec = { id: FinishId; name: string; line: string; base: number; perPass: number; cap: number; goreOnMiss: number; bonus: number };

export const FINISHES: Record<FinishId, FinishSpec> = {
  "over-the-horns": {
    id: "over-the-horns",
    name: "Over the horns",
    line: "You go in to him. The steadier way, and what the crowd expects.",
    base: 0.6,
    perPass: 0.05,
    cap: 0.92,
    goreOnMiss: 0.18,
    bonus: 2,
  },
  waiting: {
    id: "waiting",
    name: "Waiting for the charge",
    line: "You stand and let him come to you. Rarer, riskier, and the crowd will rise for it.",
    base: 0.38,
    perPass: 0.04,
    cap: 0.75,
    goreOnMiss: 0.5,
    bonus: 4,
  },
};

/** The most attempts at the finish before the bull is led back to the corrals. */
export const MAX_ATTEMPTS = 3;

/* ---------- Odds ---------- */

export type PassContext = {
  quality: Quality;
  tells: Tell[];
  picadores: Work;
  banderilleros: Work;
  /** The pass about to be made, from 1. */
  pass: number;
  /** Which of the bull's sides the pass goes by: alternates each pass. */
  side: "left" | "right";
  /** Gored before and carried on: everything is riskier. */
  hurt: boolean;
};

/** How the bull tires: each pass a little safer than the last, down to a floor. */
export function fatigue(pass: number, tells: Tell[]) {
  const steady = Math.max(0.55, 1.12 - 0.06 * pass);
  if (!tells.includes("tires-early") || pass <= 3) return steady;
  return Math.max(0.45, steady - 0.05 * (pass - 3));
}

/** The chance a pass ends in a goring. */
export function goringOdds(move: MoveId, c: PassContext) {
  const spec = MOVES[move];
  let risk = spec.risk * QUALITIES[c.quality].danger * crewFactor(c.picadores, c.banderilleros) * fatigue(c.pass, c.tells);
  if ((c.tells.includes("hooks-left") && c.side === "left") || (c.tells.includes("hooks-right") && c.side === "right")) risk *= 1.35;
  if (c.tells.includes("charges-late") && c.pass <= 2) risk *= 1.4;
  if (c.tells.includes("fixes-on-cape") && spec.closeWork) risk *= 0.75;
  if (c.hurt) risk *= 1.35;
  return Math.min(0.6, risk);
}

/** The chance of a close call, given the pass is clean. */
export const closeCallOdds = (move: MoveId) => MOVES[move].close;

export type FinishContext = { quality: Quality; tells: Tell[]; picadores: Work; banderilleros: Work; pass: number; attempt: number };

/** The chance the finish succeeds on this attempt. */
export function finishOdds(finish: FinishId, c: FinishContext) {
  const spec = FINISHES[finish];
  let p = Math.min(spec.cap, spec.base + spec.perPass * (c.pass - 1)) * QUALITIES[c.quality].hold;
  // Good crews leave the bull well placed for the finish.
  p *= 1.08 - 0.02 * (c.picadores - 1 + c.banderilleros - 1);
  if (c.tells.includes("tires-early")) p *= 1.1;
  if (c.tells.includes("keeps-strength")) p *= 0.85;
  // A second try is harder: the bull has learned.
  p *= Math.pow(0.85, c.attempt - 1);
  return Math.min(0.95, p);
}

/** The chance a failed finish ends in a goring rather than a clean miss. */
export const missGoringOdds = (finish: FinishId) => FINISHES[finish].goreOnMiss;

/** The chance a goring is serious: the corrida ends and the matador is carried to the infirmary. */
export const seriousOdds = (gorings: number) => (gorings <= 1 ? 0.3 : 0.6);
