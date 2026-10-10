/*
 * The 1978 program, modelled variable for variable so it can be replayed
 * against the original running in an interpreter. Line numbers in the
 * comments are the listing's.
 *
 * The computer's mind (lines 800–890): for each of its non-empty pits it
 * tries the move, scores it as its own store minus yours minus the best
 * capture you could answer with, and takes 2 off for every remembered lost
 * game that began the same way and went on with this pit. Two of its
 * variables are never reset: Q, the running "best answer" (the program
 * clears a different variable, G, where Q was meant), and A, the pit it
 * chose last time. Both carry over from move to move and game to game.
 *
 * Its memory (lines 200–210, 90): the first eight moves of each game, both
 * sides, as one base-6 number; a game it does not win is kept, a win is
 * forgotten. The table holds 51 games; the 52nd game cannot start.
 */

import { HOLES, NORTH_STORE, SOUTH_STORE } from "./board";

/**
 * How FOR loops behave when the start is already past the limit. Microsoft
 * BASIC of the 1970s (the dialect the 1978 book was written for) runs the
 * body once anyway; GW-BASIC and later skip it. It matters in one place:
 * the memory search before the first lesson is learned.
 */
export type ForLoops = "run-once" | "skip";

export type Candidate = {
  pit: number;
  /** The program's score for the pit, penalties included (Q at line 880). */
  value: number;
  /** The same score without the memory's penalty. */
  plain: number;
  /** Remembered games that steered away from this pit, 2 points each: their places in the memory (-1 is the current game, read by mistake). */
  remembered: number[];
};

export type Decision = {
  pit: number;
  /** Best score (D after line 885). */
  best: number;
  candidates: Candidate[];
  /** The pick came from a previous turn because no pit scored above -99 (A is never reset). */
  stale: boolean;
  /** What it would have played with an empty memory, all else equal. */
  withoutMemory: number;
};

export class OriginalCrash extends Error {
  constructor(public readonly line: number) {
    super(`Subscript out of range in ${line}`);
  }
}

/** Scratch copy of the evaluation state: the program reuses globals, so a candidate's trial leaves traces in Q and M. */
type Globals = { q: number; a: number };

const SEED_LIMIT = 50;

/** Lines 600–625: sow from M, capture into H. Returns the last hole (the program's M afterwards). */
export function sow1978(b: number[], m: number, h: number, forLoops: ForLoops): number {
  let p = b[m];
  b[m] = 0;
  // FOR P=P TO 1 STEP -1 — with P = 0 a 1970s interpreter still runs the body once.
  if (p === 0 && forLoops === "run-once") p = 1;
  for (; p >= 1; p--) {
    m += 1;
    if (m > 13) m -= 14;
    b[m] += 1;
  }
  if (b[m] === 1 && m !== SOUTH_STORE && m !== NORTH_STORE && b[12 - m] !== 0) {
    b[h] += b[12 - m] + 1;
    b[m] = 0;
    b[12 - m] = 0;
  }
  return m;
}

/** Lines 820–850 for one candidate already played on `b`: the Learner's score before memory. */
function scoreAfter(b: number[], q: number) {
  for (let i = 0; i <= 5; i++) {
    if (b[i] === 0) continue;
    let l = b[i] + i;
    let r = 0;
    while (l > 13) {
      l -= 14;
      r = 1;
    }
    if (b[l] === 0 && l !== SOUTH_STORE && l !== NORTH_STORE) r = b[12 - l] + r;
    if (r > q) q = r;
  }
  return b[NORTH_STORE] - b[SOUTH_STORE] - q;
}

/**
 * Lines 855–870: which remembered games this pit would repeat. `game` is the
 * current game's code so far (F(N)), `moves` how many moves it holds (C).
 * Returns their places in the memory.
 */
export function rememberedMatches(memory: readonly number[], game: number, moves: number, k: number, forLoops: ForLoops) {
  // FOR I=0 TO N-1 with N = 0: a 1970s interpreter runs it once, reading F(0), which is the current game itself.
  const table = memory.length > 0 ? memory.map((code, i) => [code, i]) : forLoops === "run-once" ? [[game, -1]] : [];
  const matches: number[] = [];
  for (const [code, i] of table) {
    if (game * 6 + k === Math.floor(code / 6 ** (7 - moves) + 0.1)) matches.push(i);
  }
  return matches;
}

/**
 * Lines 800–890: the computer's choice. `globals` carries Q and A between
 * calls, as the program does. `clearQ` plays it the way it was meant, with
 * Q cleared before each pit is weighed, for comparison only.
 */
export function chooseMove1978(board: readonly number[], memory: readonly number[], game: number, moves: number, globals: Globals, forLoops: ForLoops, clearQ = false): Decision {
  let best = -99;
  let picked: number | null = null;
  const candidates: Candidate[] = [];
  const plainQ = { q: globals.q };
  let plainBest = -99;
  let plainPick: number | null = null;
  for (let j = 7; j <= 12; j++) {
    if (board[j] === 0) continue;
    const b = [...board];
    sow1978(b, j, NORTH_STORE, forLoops);
    if (clearQ) {
      globals.q = 0;
      plainQ.q = 0;
    }
    let q = scoreAfter(b, globals.q);
    const plain = scoreAfter(b, plainQ.q);
    let remembered: number[] = [];
    if (moves <= 8) {
      remembered = rememberedMatches(memory, game, moves, j - 7, forLoops);
      q -= 2 * remembered.length;
    }
    globals.q = q;
    plainQ.q = plain;
    candidates.push({ pit: j, value: q, plain, remembered });
    if (q >= best) {
      best = q;
      picked = j;
    }
    if (plain >= plainBest) {
      plainBest = plain;
      plainPick = j;
    }
  }
  const stale = picked === null;
  const pit = picked ?? globals.a;
  globals.a = pit;
  return { pit, best, candidates, stale, withoutMemory: plainPick ?? pit };
}

/** Writes a move into the current game's code, the way line 210 does: only the first eight count. */
export function recordMove(game: number, moves: number, pit: number) {
  const k = pit > 6 ? pit - 7 : pit;
  const c = moves + 1;
  return { game: c < 9 ? game * 6 + k : game, moves: c };
}

export type Turn = { who: "you" | "computer"; pit: number; extra: boolean; decision?: Decision };

export type GameResult = { you: number; computer: number; turns: Turn[]; learned: boolean };

/**
 * The whole program as a machine: start a game, feed it your moves, ask for
 * its moves, and read the result. Used to replay the original move for move.
 */
export class Original1978 {
  b = new Array<number>(HOLES).fill(0);
  /** F(0..50); index 51 does not exist. */
  f = new Array<number>(SEED_LIMIT + 1).fill(0);
  n = 0;
  c = 0;
  e = 0;
  globals: Globals = { q: 0, a: 0 };
  turns: Turn[] = [];
  /** Where the latest sowing ended (the program's M after line 200). */
  lastHole = -1;

  constructor(
    public readonly forLoops: ForLoops = "run-once",
    /** For experiments: clear Q before weighing each pit, as the author meant. */
    public readonly clearQ = false,
  ) {}

  /** Lines 20–30. Throws when the memory table is full, as the original stops with an error at line 30. */
  newGame() {
    this.e = 0;
    for (let i = 0; i <= 12; i++) this.b[i] = 3;
    this.c = 0;
    if (this.n > SEED_LIMIT) throw new OriginalCrash(30);
    this.f[this.n] = 0;
    this.b[NORTH_STORE] = 0;
    this.b[SOUTH_STORE] = 0;
    this.turns = [];
  }

  get memory() {
    return this.f.slice(0, this.n);
  }

  /** Lines 200–235 after a sowing from `pit` into store `h`. Returns the last hole. */
  private move(pit: number, h: number, recordAs = pit) {
    const last = sow1978(this.b, pit, h, this.forLoops);
    this.lastHole = last;
    const recorded = recordMove(this.f[this.n], this.c, recordAs);
    this.f[this.n] = recorded.game;
    this.c = recorded.moves;
    const southEmpty = [0, 1, 2, 3, 4, 5].every((i) => this.b[i] === 0);
    const northEmpty = [7, 8, 9, 10, 11, 12].every((i) => this.b[i] === 0);
    this.e = southEmpty || northEmpty ? 0 : 1;
    return last;
  }

  /** Line 110: is this a move the program would take (1–6, a pit with seeds)? `typed` is what the player typed. */
  accepts(typed: number) {
    if (!(typed < 7 && typed > 0)) return false;
    return this.b[subscript(typed - 1)] !== 0;
  }

  /**
   * Lines 130–150. `pit` 0–5. Returns the last hole. A typed decimal (2.5)
   * sows the nearest pit but goes into the memory as typed, less one.
   */
  playYours(pit: number, extra = false, typed?: number) {
    const last = this.move(pit, SOUTH_STORE, typed === undefined ? pit : typed - 1);
    this.turns.push({ who: "you", pit, extra });
    return last;
  }

  /** Lines 800–890. Returns the decision and the last hole. */
  playMine(extra = false) {
    const decision = chooseMove1978(this.b, this.memory, this.f[this.n], this.c, this.globals, this.forLoops, this.clearQ);
    const last = this.move(decision.pit, NORTH_STORE);
    this.turns.push({ who: "computer", pit: decision.pit, extra, decision });
    return { decision, last };
  }

  get over() {
    return this.e === 0;
  }

  /** Lines 80–95: the result, and the lesson (a game the computer did not win is kept). */
  finish(): GameResult {
    const you = this.b[SOUTH_STORE];
    const computer = this.b[NORTH_STORE];
    const learned = you - computer >= 0;
    if (learned) this.n += 1;
    return { you, computer, turns: this.turns, learned };
  }

  /**
   * One whole game against a player strategy, following the program's flow
   * (lines 35–75): your move and perhaps one more, then its move and perhaps
   * one more, until a row is empty.
   */
  playGame(yourMove: (board: readonly number[], machine: Original1978) => number): GameResult {
    this.newGame();
    for (;;) {
      let last = this.playYours(yourMove(this.b, this));
      if (this.over) break;
      if (last === SOUTH_STORE) {
        this.playYours(yourMove(this.b, this), true);
        if (this.over) break;
      }
      last = this.playMine().last;
      if (this.over) break;
      if (last === NORTH_STORE) {
        this.playMine(true);
        if (this.over) break;
      }
    }
    return this.finish();
  }
}

/** An array index from a decimal, the way GW-BASIC turns 1.5 into 2 (we round halves up; PC-BASIC agrees on the cases we tried). */
export const subscript = (x: number) => Math.floor(x + 0.5);

/** The computer names its pits 1–6 by printing CHR$(42 + M): pit 7 comes out as the character "1". */
export const spokenPit = (pit: number) => String.fromCharCode(42 + pit);
