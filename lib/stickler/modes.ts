import type { Rules } from "./rules";
import { isWinning } from "./solver";
import { dailyDate } from "@/lib/kit/daily";
import { mulberry32 } from "@/lib/kit/rng";
import { sticklerManifest } from "./manifest";
import type { Level } from "./sparky";

export type ModeId = "classic" | "handfuls" | "ladder" | "daily" | "versus" | "1981";

export const MODES: { id: ModeId; name: string; blurb: string }[] = [
  { id: "classic", name: "Classic 23", blurb: "The 1981 game: 23 sticks, take 1–3, you start." },
  { id: "handfuls", name: "Handfuls", blurb: "Every turn is a handful. Never just one." },
  { id: "ladder", name: "Ladder", blurb: "Ten tables, new twists, one very smug final boss." },
  { id: "daily", name: "Daily", blurb: "One puzzle a day for everyone. Share your streak." },
  { id: "versus", name: "Versus", blurb: "Two players, one screen. Pass it over." },
  { id: "1981", name: "1981 mode", blurb: "The original game, move for move, on a green screen." },
];

export type Table = { id: number; name: string; rules: Rules; level: Level; blurb: string };

const one = (n: number, k: number, sparkyFirst = false): Rules => ({ rows: [n], minTake: 1, maxTake: k, first: sparkyFirst ? 1 : 0 });
const rows = (r: number[], sparkyFirst = false): Rules => ({ rows: r, minTake: 1, maxTake: Infinity, first: sparkyFirst ? 1 : 0 });
const handful = (n: number, min: number, max: number, sparkyFirst = false): Rules => ({ rows: [n], minTake: min, maxTake: max, first: sparkyFirst ? 1 : 0 });

/** Every table is winnable with perfect play: the tests check it. */
export const LADDER: Table[] = [
  { id: 1, name: "Warm-up", rules: one(11, 3), level: "rookie", blurb: "Eleven sticks and a sleepy Sparky." },
  { id: 2, name: "Getting warmer", rules: one(15, 3), level: "rookie", blurb: "A little longer. Watch what's left after his turn." },
  { id: 3, name: "The Classic", rules: one(23, 3), level: "clever", blurb: "The 1981 table. He knows the trick. Do you?" },
  { id: 4, name: "Sparky starts", rules: one(21, 3, true), level: "clever", blurb: "He goes first from 21. Is that good for him?" },
  { id: 5, name: "Take up to four", rules: one(27, 4), level: "clever", blurb: "New limit, new magic number." },
  { id: 6, name: "Take up to five", rules: one(34, 5), level: "master", blurb: "Bigger bites. Same idea, different number." },
  { id: 7, name: "Bonfire", rules: one(45, 6), level: "master", blurb: "Forty-five sticks and no mercy." },
  { id: 8, name: "Two rows", rules: rows([3, 5]), level: "clever", blurb: "Take as many as you like, from one row only." },
  { id: 9, name: "Three rows", rules: rows([1, 3, 5]), level: "master", blurb: "Rows 1, 3 and 5. Think in pairs." },
  {
    id: 10,
    name: "Marienbad",
    rules: rows([1, 3, 5, 7], true),
    level: "master",
    blurb: "The famous 1-3-5-7 from a 1961 film. The boss goes first.",
  },
];

export const CLASSIC: Rules = one(23, 3);

/** The Daily: the same puzzle for everyone on a given date. Always winnable for you. */
export function dailyPuzzle(date = new Date()) {
  const { day, key, number } = dailyDate(date, sticklerManifest.daily?.epoch);
  const rng = mulberry32(9_000 + day);
  const maxTake = [3, 4, 5][Math.floor(rng() * 3)];
  let sticks = 17 + Math.floor(rng() * 25);
  while (!isWinning([sticks], { maxTake })) sticks++;
  return { number, key, rules: one(sticks, maxTake), level: "master" as Level };
}

// ---------- Handfuls: every take is min..max, and fewer than min left means a sweep ----------

export type HandfulsPresetId = "2-3" | "2-4" | "3-4" | "3-5" | "4-6";

/**
 * `pile` is dealt when you open and is a win for the opener. `sparkyPile` is dealt when Sparky opens:
 * one stick fewer, which sits on the top of a magic zone, so he opens on a lost position and a player
 * who answers correctly always wins. Every Handfuls table can be won by you: the tests check it.
 */
export type HandfulsPreset = { id: HandfulsPresetId; min: number; max: number; pile: number; sparkyPile: number };

export const HANDFULS_PRESETS: HandfulsPreset[] = [
  { id: "2-3", min: 2, max: 3, pile: 23, sparkyPile: 22 },
  { id: "2-4", min: 2, max: 4, pile: 27, sparkyPile: 26 },
  { id: "3-4", min: 3, max: 4, pile: 32, sparkyPile: 31 },
  { id: "3-5", min: 3, max: 5, pile: 36, sparkyPile: 35 },
  { id: "4-6", min: 4, max: 6, pile: 45, sparkyPile: 44 },
];

export type HandfulsSetup = { preset: HandfulsPresetId; surprise: boolean; sparkyStarts: boolean };

export const DEFAULT_HANDFULS: HandfulsSetup = { preset: "2-3", surprise: false, sparkyStarts: false };

export const handfulsPreset = (id: string) => HANDFULS_PRESETS.find((p) => p.id === id) ?? HANDFULS_PRESETS[0];

/** The range as players read it: "3–5". */
export const rangeLabel = (p: Pick<HandfulsPreset, "min" | "max">) => `${p.min}–${p.max}`;

/**
 * "Surprise pile": a count between 3 and 6 times (min + max) that you can win, drawn evenly from all
 * such counts, like the Daily draws its pile. When you open, that is a win for the opener; when Sparky
 * opens, it is a count inside a magic zone, a loss for the opener.
 */
export function surprisePile(min: number, max: number, seed: number, sparkyStarts = false) {
  const period = min + max;
  const fair: number[] = [];
  for (let n = 3 * period; n <= 6 * period; n++) if (isWinning([n], { minTake: min, maxTake: max }) !== sparkyStarts) fair.push(n);
  return fair[Math.floor(mulberry32(seed)() * fair.length)];
}

/** The table for a Handfuls setup. Whoever opens, you can always win it with the right answers. */
export function handfulsRules(setup: HandfulsSetup, seed: number): Rules {
  const p = handfulsPreset(setup.preset);
  const pile = setup.surprise ? surprisePile(p.min, p.max, seed, setup.sparkyStarts) : setup.sparkyStarts ? p.sparkyPile : p.pile;
  return handful(pile, p.min, p.max, setup.sparkyStarts);
}

/** The pile a setup deals, as the lobby shows it before you play (a surprise pile is only known when dealt). */
export const handfulsPile = (setup: HandfulsSetup) => (setup.sparkyStarts ? handfulsPreset(setup.preset).sparkyPile : handfulsPreset(setup.preset).pile);

export const VERSUS_PRESETS: { name: string; rules: Rules }[] = [
  { name: "Classic 23", rules: one(23, 3) },
  { name: "Quick 15", rules: one(15, 3) },
  { name: "Big 31 · take 1–4", rules: one(31, 4) },
  { name: "Marienbad 1-3-5-7", rules: rows([1, 3, 5, 7]) },
  { name: "Handfuls 2–3 · 23", rules: handful(23, 2, 3) },
  { name: "Handfuls 3–5 · 36", rules: handful(36, 3, 5) },
];
