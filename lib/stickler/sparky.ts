import { legalMoves, total, type Game, type Move } from "./rules";
import { winningMoves } from "./solver";

/*
 * Sparky, the opponent. A stickler for rules, a sore loser, a gracious winner
 * (not really). Every line here is written for Stickler; none comes from the
 * 1981 program.
 */

export type Level = "rookie" | "clever" | "master";

export const LEVELS: { id: Level; name: string; blurb: string }[] = [
  { id: "rookie", name: "Rookie", blurb: "Half his moves are guesses" },
  { id: "clever", name: "Clever", blurb: "Knows the trick, sometimes forgets" },
  { id: "master", name: "Master", blurb: "Plays like the 1981 program: perfect" },
];

const MISTAKE_RATE: Record<Level, number> = { rookie: 0.5, clever: 0.2, master: 0 };

export type Rng = () => number;

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(list: T[], rng: Rng) => list[Math.floor(rng() * list.length)];

/** Sparky's move. When he is lost (or slips), he picks any move that doesn't take the last stick if he can help it. */
export function sparkyMove(game: Game, level: Level, rng: Rng): Move {
  const good = winningMoves(game.rows, game.rules);
  if (good.length && rng() >= MISTAKE_RATE[level]) return pick(good, rng);
  const moves = legalMoves(game.rows, game.rules);
  const safe = moves.filter((m) => total(game.rows) - m.take > 0);
  return pick(safe.length ? safe : moves, rng);
}

/**
 * The original algorithm, move for move: with R = sticks mod 4 it takes (R+3) mod 4,
 * and when R = 1 it takes INT(3 * RND(0)) + 1. In GW-BASIC, RND(0) returns the
 * stored seed without advancing it, and the program never draws a new number, so on
 * a PC it is always .3116351 and the "random" take is always 1 (see docs/23mtch).
 */
export const RND0_ON_A_PC = 0.3116351;

export function move1981(sticks: number): number | "concede" {
  if (sticks === 1) return "concede";
  const r = sticks % 4;
  if (r !== 1) return (r + 3) % 4;
  return Math.floor(3 * RND0_ON_A_PC) + 1;
}

// ---------- Lines ----------

export type Mood = "idle" | "thinking" | "smug" | "worried" | "shocked" | "sad" | "cross" | "happy";

type LineSet = { mood: Mood; lines: string[] };

const LINES = {
  hello: {
    mood: "happy",
    lines: [
      "Hi! I'm Sparky. I'm a stickler for rules.",
      "Sticks on the table. Rules on the table. Let's go.",
      "Take one, two or three. Just never the last one.",
    ],
  },
  think: { mood: "thinking", lines: ["Hmm…", "Let me count…", "One sec, doing maths.", "Calculating. Dramatically."] },
  took: { mood: "idle", lines: ["I'll take {n}.", "{n} for me.", "Just {n}. Your turn.", "I take {n}. Obviously."] },
  gotGift: { mood: "smug", lines: ["Oh, that's generous.", "Thanks! Heh.", "You sure about that?", "I like where this is going."] },
  inTrouble: { mood: "worried", lines: ["Wait. Hold on.", "Hmm. That was a good move.", "Uh-oh.", "You've done this before, haven't you?"] },
  protest: {
    mood: "cross",
    lines: [
      "Nope. That's more than the rules allow.",
      "Rules are rules. I'm a stickler.",
      "Nice try, rule-bender.",
      "I saw that. Try again.",
    ],
  },
  iWin: {
    mood: "happy",
    lines: ["You took the last one! I win!", "Burnt! Rematch?", "Ha! The last stick gets you every time."],
  },
  iLose: {
    mood: "sad",
    lines: ["I… have to take the last one. Ugh.", "Fine. FINE. You win.", "How did you do that? Tell me. No, don't."],
  },
  rematch: { mood: "happy", lines: ["Again? I'm ready.", "New table, new me.", "Best of three?"] },
} satisfies Record<string, LineSet>;

export type LineKind = keyof typeof LINES;

export function line(kind: LineKind, rng: Rng, n?: number) {
  const set: LineSet = LINES[kind];
  return { mood: set.mood, text: pick(set.lines, rng).replace("{n}", String(n ?? "")) };
}
