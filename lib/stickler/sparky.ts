import { legalMoves, minTakeOf, total, type Game, type Move } from "./rules";
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

const pick = <T,>(list: T[], rng: Rng) => list[Math.floor(rng() * list.length)];

/**
 * Sparky's move. When he is lost (or slips), he picks any move that doesn't take the last stick if he can help it.
 * In Handfuls a winning Master always takes the smallest winning handful: that leaves you as high inside the zone
 * as he can, so the game ends with you sweeping minTake sticks whenever the zones allow it.
 */
export function sparkyMove(game: Game, level: Level, rng: Rng): Move {
  const good = winningMoves(game.rows, game.rules);
  if (good.length && rng() >= MISTAKE_RATE[level]) return level === "master" && minTakeOf(game.rules) > 1 ? good[0] : pick(good, rng);
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
  helloHandfuls: {
    mood: "happy",
    lines: [
      "Handfuls! Take {min} to {max}. Never just one.",
      "Big bites only: {min} to {max} a turn. And never the last stick.",
      "Fewer than {min} left means you sweep the lot. Just saying.",
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
  protestMin: {
    mood: "cross",
    lines: ["Handfuls means at least {min}.", "That's not a handful. {min} or more.", "At least {min}. I'm a stickler."],
  },
  protestSweep: {
    mood: "cross",
    lines: ["Fewer than {min} left. Sweep them all.", "No picking and choosing now. It's a sweep.", "All {n} of them. Rules are rules."],
  },
  iWin: {
    mood: "happy",
    lines: ["You took the last one! I win!", "Burnt! Rematch?", "Ha! The last stick gets you every time."],
  },
  iLose: {
    mood: "sad",
    lines: ["I… have to take the last one. Ugh.", "Fine. FINE. You win.", "How did you do that? Tell me. No, don't."],
  },
  sweepYou: {
    mood: "smug",
    lines: ["{n} left. Sweep them up!", "That's a sweep for you. All {n}.", "Go on. All {n}. I'll wait."],
  },
  dread: { mood: "shocked", lines: ["Wait. All {n}? That's every stick.", "Oh no. Oh no no. A sweep.", "{n} left and I can't leave any. Hmm."] },
  iWinSweep: {
    mood: "happy",
    lines: ["Sweep them up! All {n}! I win!", "All {n} of them, please. Thank you!", "Now that's a handful. I win!"],
  },
  iLoseSweep: {
    mood: "sad",
    lines: ["I have to sweep all {n}? Ugh.", "A sweep. A whole sweep. Fine. You win.", "All {n} at once. How did you do that?"],
  },
  rematch: { mood: "happy", lines: ["Again? I'm ready.", "New table, new me.", "Best of three?"] },
} satisfies Record<string, LineSet>;

export type LineKind = keyof typeof LINES;

/** A random line of a kind. {n} is a count; {min} and {max} are the Handfuls take range. */
export function line(kind: LineKind, rng: Rng, n?: number, range?: { min: number; max: number }) {
  const set: LineSet = LINES[kind];
  const text = pick(set.lines, rng)
    .replaceAll("{n}", String(n ?? ""))
    .replaceAll("{min}", String(range?.min ?? ""))
    .replaceAll("{max}", String(range?.max ?? ""));
  return { mood: set.mood, text };
}
