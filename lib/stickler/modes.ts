import type { Rules } from "./rules";
import { isWinning } from "./solver";
import { mulberry, type Level } from "./sparky";

export type ModeId = "classic" | "ladder" | "daily" | "versus" | "1981";

export const MODES: { id: ModeId; name: string; blurb: string; emoji: string }[] = [
  { id: "classic", name: "Classic 23", blurb: "The 1981 game: 23 sticks, take 1–3, you start.", emoji: "🔥" },
  { id: "ladder", name: "Ladder", blurb: "Ten tables, new twists, one very smug final boss.", emoji: "🪜" },
  { id: "daily", name: "Daily", blurb: "One puzzle a day for everyone. Share your streak.", emoji: "📅" },
  { id: "versus", name: "Versus", blurb: "Two players, one screen. Pass it over.", emoji: "🤝" },
  { id: "1981", name: "1981 mode", blurb: "The original behaviour, text and all.", emoji: "📟" },
];

export type Table = { id: number; name: string; rules: Rules; level: Level; blurb: string };

const one = (n: number, k: number, sparkyFirst = false): Rules => ({ rows: [n], maxTake: k, first: sparkyFirst ? 1 : 0 });
const rows = (r: number[], sparkyFirst = false): Rules => ({ rows: r, maxTake: Infinity, first: sparkyFirst ? 1 : 0 });

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
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000);
  const rng = mulberry(9_000 + day);
  const maxTake = [3, 4, 5][Math.floor(rng() * 3)];
  let sticks = 17 + Math.floor(rng() * 25);
  while (!isWinning([sticks], { maxTake })) sticks++;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { number: day + 1, key, rules: one(sticks, maxTake), level: "master" as Level };
}

export const VERSUS_PRESETS: { name: string; rules: Rules }[] = [
  { name: "Classic 23", rules: one(23, 3) },
  { name: "Quick 15", rules: one(15, 3) },
  { name: "Big 31 · take 1–4", rules: one(31, 4) },
  { name: "Marienbad 1-3-5-7", rules: rows([1, 3, 5, 7]) },
];
