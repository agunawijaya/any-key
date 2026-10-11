/*
 * The 1970s program, rule for rule.
 *
 * This module replays the original's logic exactly: the same formulas, the
 * same order of random draws, the same mistakes. It never produces the
 * original's wording; it emits events (the bull was drawn, the crew did a
 * fair job, the matador was gored), and the 1970s terminal writes its own
 * lines for them.
 *
 * Kept on purpose:
 * - the inversion: a worse crew makes passes safer and kills easier;
 * - the ignored choice: both ways to kill use the same test, because the
 *   test reads a variable that is never set;
 * - the triple roll: each award tier is tested against a fresh random number;
 * - awards given after a fatal goring;
 * - answers that must be exactly YES or NO, in capitals.
 *
 * Variable names follow the listing where it helps to check one against the
 * other (A, C, D1–D5, L, M, F, K).
 */

export type Random = () => number;

/** The ratings printed for the bull and the crews, best first. */
export const RATINGS = ["superb", "good", "fair", "poor", "awful"] as const;
export type Rating = (typeof RATINGS)[number];

/** The three cape moves the program accepts, by the number typed. */
export const CAPE_MOVES = [
  { number: 0, name: "veronica", bravery: 3 },
  { number: 1, name: "outside", bravery: 2 },
  { number: 2, name: "swirl", bravery: 0.5 },
] as const;

export type OriginalEvent =
  | { kind: "title" }
  | { kind: "ask-instructions" }
  | { kind: "instructions" }
  | { kind: "bull"; quality: number }
  | { kind: "crew"; crew: "picadores" | "toreadores"; rating: number; c: number; casualties: { horses: number | null; men: number | null } }
  | { kind: "pass"; number: number }
  | { kind: "ask-kill"; early: boolean }
  | { kind: "ask-cape" }
  | { kind: "bad-cape" }
  | { kind: "bad-yes-no" }
  | { kind: "redo" }
  | { kind: "pass-survived"; f: number }
  | { kind: "gored"; f: number | null }
  | { kind: "dead" }
  | { kind: "alive" }
  | { kind: "ask-run" }
  | { kind: "ran" }
  | { kind: "stayed" }
  | { kind: "gored-again" }
  | { kind: "moment-of-truth" }
  | { kind: "ask-how" }
  | { kind: "panicked" }
  | { kind: "kill-attempt"; method: number; k: number }
  | { kind: "killed" }
  | { kind: "boos" }
  | { kind: "cheers"; wildly: boolean }
  | { kind: "award"; tier: 0 | 1 | 2 | 3; merit: number; rolls: number[] }
  | { kind: "end" };

/**
 * For comparison only (the 1970s mode never uses them): the program with its
 * mistakes mended, to measure what each one changed.
 */
export type Mends = {
  /** Better crews make passes safer and kills easier, as the instructions promise. */
  inversion?: boolean;
  /** Going over the horns (4) uses the forgiving test the listing meant it to have. */
  killChoice?: boolean;
  /** The crowd decides with one roll. */
  singleRoll?: boolean;
};

/** What the program is waiting for. */
export type Waiting = "instructions" | "kill" | "cape" | "run" | "how" | "done";

/* ---------- The formulas, as written ---------- */

/** Line 1610: a crew's rating C from 0.1 (superb) to 0.5 (awful), drawn from the bull's quality A. */
export function crewRating(a: number, random: Random) {
  const b = (3 / a) * random();
  const c = b < 0.37 ? 0.5 : b < 0.5 ? 0.4 : b < 0.63 ? 0.3 : b < 0.87 ? 0.2 : 0.1;
  // Line 1750: T = INT(10C + 0.2), 1 superb … 5 awful.
  return { b, c, t: Math.floor(10 * c + 0.2) };
}

/** Line 940: the goring test's value; the matador is gored when it reaches 0.51. */
export const risk = (a: number, m: number, d1: number, d2: number, pass: number, rnd: number) => ((6 - a + m / 10) * rnd) / ((d1 + d2 + pass / 10) * 5);

/** Line 1230: the kill's value; the bull is killed when it is 0.2 or less (for both methods, line 1240's bug). */
export const killValue = (a: number, d1: number, d2: number, pass: number, rnd: number) => ((6 - a) * 10 * rnd) / ((d1 + d2) * 5 * pass);

/** Line 1390: the crowd's measure of the fight, FND. */
export const merit = (l: number, d1: number, d2: number, d4: number, d5: number, pass: number, a: number) =>
  4.5 + l / 6 - (d1 + d2) * 2.5 + 4 * d4 + 2 * d5 - (pass * pass) / 120 - a;

/** The chance of a goring on a pass, worked out from line 940 (the random number is uniform on [0, 1)). */
export function goringChance(a: number, m: number, d1: number, d2: number, pass: number) {
  const threshold = (0.51 * (d1 + d2 + pass / 10) * 5) / (6 - a + m / 10);
  return Math.max(0, 1 - threshold);
}

/** The chance a kill succeeds, from line 1230, with the threshold the program really uses (0.2) or the one it meant for 4 (0.8). */
export function killChance(a: number, d1: number, d2: number, pass: number, threshold = 0.2) {
  return Math.min(1, (threshold * (d1 + d2) * 5 * pass) / ((6 - a) * 10));
}

/* ---------- The program ---------- */

type State = {
  a: number;
  d1: number;
  d2: number;
  pass: number;
  d4: number;
  d5: number;
  l: number;
  z: boolean;
};

/**
 * The program as a machine: start it, then feed it what the player types.
 * Each call returns the events it produced, ending with what it waits for.
 */
export class OriginalBull {
  private readonly random: Random;
  private readonly mends: Mends;
  waiting: Waiting = "instructions";
  readonly state: State = { a: 0, d1: 0, d2: 0, pass: 0, d4: 1, d5: 1, l: 1, z: false };
  /** Every random number drawn, in order, for checks. */
  readonly draws: number[] = [];

  constructor(random: Random, mends: Mends = {}) {
    this.random = random;
    this.mends = mends;
  }

  /** The crews' ratings as the risk and kill formulas read them: as written, or mended so better means safer. */
  private crews() {
    const { d1, d2 } = this.state;
    return this.mends.inversion ? { d1: 0.6 - d1, d2: 0.6 - d2 } : { d1, d2 };
  }

  private rnd() {
    const r = this.random();
    this.draws.push(r);
    return r;
  }

  /** FNA: 1 or 2, evenly. */
  private coin() {
    return Math.floor(this.rnd() * 2 + 1);
  }

  start(): OriginalEvent[] {
    // Line 202: bravery starts at one.
    return [{ kind: "title" }, { kind: "ask-instructions" }];
  }

  /** Feeds one typed line to whatever the program is waiting for. */
  answer(typed: string): OriginalEvent[] {
    switch (this.waiting) {
      case "instructions":
        return this.afterInstructions(typed);
      case "kill":
        return this.afterKillQuestion(typed);
      case "cape":
        return this.afterCape(typed);
      case "run":
        return this.afterRun(typed);
      case "how":
        return this.afterHow(typed);
      default:
        return [];
    }
  }

  /* ---------- The opening ---------- */

  private afterInstructions(typed: string): OriginalEvent[] {
    const out: OriginalEvent[] = [];
    // Line 207: only an exact NO skips them.
    if (stringInput(typed) !== "NO") out.push({ kind: "instructions" });
    const s = this.state;
    s.a = Math.floor(this.rnd() * 5 + 1);
    out.push({ kind: "bull", quality: s.a });
    out.push(this.crew("picadores"));
    out.push(this.crew("toreadores"));
    return [...out, ...this.nextPass()];
  }

  private crew(who: "picadores" | "toreadores"): OriginalEvent {
    const { c, t } = crewRating(this.state.a, () => this.rnd());
    if (who === "picadores") this.state.d1 = c;
    else this.state.d2 = c;
    let horses: number | null = null;
    let men: number | null = null;
    if (t === 5) {
      // Line 1870: an awful job; horses only for the picadores, who ride.
      if (who === "picadores") horses = this.coin();
      men = this.coin();
    } else if (t === 4) {
      // Line 1790: a poor job; one man or none. The horse line after it (1800–1810) is never reached.
      men = this.coin() === 1 ? 1 : 0;
    }
    return { kind: "crew", crew: who, rating: t, c, casualties: { horses, men } };
  }

  /* ---------- The passes ---------- */

  /** Line 660–770: the verdict if the moment of truth has been tried, else the next pass. */
  private nextPass(): OriginalEvent[] {
    if (this.state.z) return this.verdict();
    this.state.pass += 1;
    this.waiting = "kill";
    return [
      { kind: "pass", number: this.state.pass },
      { kind: "ask-kill", early: this.state.pass < 3 },
    ];
  }

  private afterKillQuestion(typed: string): OriginalEvent[] {
    const yes = yesNo(typed);
    if (yes === null) return [{ kind: "bad-yes-no" }];
    if (yes) return this.momentOfTruth();
    this.waiting = "cape";
    return [{ kind: "ask-cape" }];
  }

  private afterCape(typed: string): OriginalEvent[] {
    const e = numberInput(typed);
    if (e === null) return [{ kind: "redo" }];
    // Lines 810–840: a whole number from 0 to 2.
    if (e !== Math.floor(Math.abs(e)) || e >= 3) return [{ kind: "bad-cape" }];
    const m = CAPE_MOVES[e].bravery;
    const s = this.state;
    s.l += m;
    const { d1, d2 } = this.crews();
    const f = risk(s.a, m, d1, d2, s.pass, this.rnd());
    if (f < 0.51) return [{ kind: "pass-survived", f }, ...this.nextPass()];
    return [{ kind: "gored", f }, ...this.goring()];
  }

  /* ---------- Gorings ---------- */

  /** Line 970: a coin decides life or death. */
  private goring(): OriginalEvent[] {
    if (this.coin() === 1) {
      this.state.d4 = 1.5;
      return [{ kind: "dead" }, ...this.verdict()];
    }
    this.waiting = "run";
    return [{ kind: "alive" }, { kind: "ask-run" }];
  }

  private afterRun(typed: string): OriginalEvent[] {
    const yes = yesNo(typed);
    if (yes === null) return [{ kind: "bad-yes-no" }];
    if (yes) {
      this.state.d4 = 0;
      return [{ kind: "ran" }, ...this.verdict()];
    }
    const out: OriginalEvent[] = [{ kind: "stayed" }];
    // Line 1080: half the time the brave carry on, half the time they are gored again.
    if (this.coin() === 1) {
      this.state.d4 = 2;
      return [...out, ...this.nextPass()];
    }
    return [...out, { kind: "gored-again" }, ...this.goring()];
  }

  /* ---------- The moment of truth ---------- */

  private momentOfTruth(): OriginalEvent[] {
    this.state.z = true;
    this.waiting = "how";
    return [{ kind: "moment-of-truth" }, { kind: "ask-how" }];
  }

  private afterHow(typed: string): OriginalEvent[] {
    const h = numberInput(typed);
    if (h === null) return [{ kind: "redo" }];
    if (h !== 4 && h !== 5) return [{ kind: "panicked" }, ...this.goring()];
    const s = this.state;
    const { d1, d2 } = this.crews();
    const k = killValue(s.a, d1, d2, s.pass, this.rnd());
    // Line 1240 tests J, which nothing ever sets: both methods face the 0.2 test.
    const threshold = this.mends.killChoice && h === 4 ? 0.8 : 0.2;
    const out: OriginalEvent[] = [{ kind: "kill-attempt", method: h, k }];
    if (k > threshold) return [...out, { kind: "gored", f: null }, ...this.goring()];
    s.d5 = 2;
    return [...out, { kind: "killed" }, ...this.verdict()];
  }

  /* ---------- The crowd ---------- */

  private verdict(): OriginalEvent[] {
    this.waiting = "done";
    const s = this.state;
    if (s.d4 === 0) return [{ kind: "boos" }, { kind: "end" }];
    const out: OriginalEvent[] = [];
    if (s.d4 === 2) out.push({ kind: "cheers", wildly: true });
    else if (s.d5 === 2) out.push({ kind: "cheers", wildly: false });
    const value = merit(s.l, s.d1, s.d2, s.d4, s.d5, s.pass, s.a);
    // FNC re-rolls: each comparison multiplies the merit by a fresh random number.
    const rolls: number[] = [];
    const roll = () => {
      const r = this.mends.singleRoll && rolls.length ? rolls[0] : this.rnd();
      rolls.push(r);
      return value * r;
    };
    let tier: 0 | 1 | 2 | 3;
    if (roll() < 2.4) tier = 0;
    else if (roll() < 4.9) tier = 1;
    else if (roll() < 7.4) tier = 2;
    else tier = 3;
    out.push({ kind: "award", tier, merit: value, rolls }, { kind: "end" });
    return out;
  }
}

/* ---------- How the interpreter read what was typed ---------- */

/** A string INPUT: leading and trailing blanks dropped, nothing else changed. */
export function stringInput(typed: string) {
  return typed.trim();
}

/** YES or NO exactly, in capitals; anything else is asked again. */
export function yesNo(typed: string): boolean | null {
  const s = stringInput(typed);
  return s === "YES" ? true : s === "NO" ? false : null;
}

/**
 * A numeric INPUT: a number as BASIC would read it, or null when it would
 * answer "redo from start". An empty line reads as zero.
 */
export function numberInput(typed: string): number | null {
  const s = typed.trim();
  if (s === "") return 0;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?$/.test(s)) return null;
  return Number(s.replace(/[dD]/, "e"));
}
