/*
 * The Daily Pit: one Tactics pit a day, the same for everyone. It is built
 * from the day's number: a rabbit, a scatter of rocks, maybe burrows,
 * patches and a tool or two. A candidate is kept only if the solved values
 * say good play can get out (from the best drop, with no tools at all, at
 * least FAIR_START of the time); otherwise the next candidate is tried.
 * The checks play many days with the strong policy to show it holds.
 */

import { dailyDate } from "@/lib/kit/daily";
import { createRng, type Rng } from "@/lib/kit/rng";
import { type Cell, cellsInCircle, inCircle, keyOf, kingDistance } from "./geometry";
import { tenTurnsManifest } from "./manifest";
import { type PitPlan, rustleCells, type Temperament, type Tools } from "./tactics";
import { bestDrop, pitTables, solvePit } from "./tacticsSolver";

/**
 * How hard a Daily may be, solved with no tools from the best drop: at least
 * FAIR_START of games last (never a lost cause), at most TOO_EASY (never a stroll).
 */
export const FAIR_START = 0.7;
export const TOO_EASY = 0.92;

const MAX_ATTEMPTS = 8;

export type DailyPit = { number: number; key: string; day: number; plan: PitPlan; attempt: number; fairness: number };

const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
];

/** A cell at a whole-number distance band from the middle of the pit. */
function ringCell(rng: Rng, near: number, far: number, radius: number): Cell {
  const choices = cellsInCircle(radius).filter((c) => {
    const d = Math.hypot(c.x, c.y);
    return d >= near && d <= far;
  });
  return rng.pick(choices);
}

/**
 * One try at the day's ground: rocks, burrows, patches, the tools in your
 * pockets and the kind of rabbit. Where the rabbit hides is settled later,
 * once the ground is solved (see dailyPitFor).
 */
export function dailyGround(day: number, attempt: number): PitPlan {
  const rng = createRng(`ten-turns/daily/${day}/${attempt}`);
  const radius = 10;
  const taken = new Set<string>();
  const free = (c: Cell) => inCircle(c, radius) && !taken.has(keyOf(c));
  const claim = (c: Cell) => taken.add(keyOf(c));

  const rocks: Cell[] = [];
  for (let g = rng.int(0, 2); g > 0; g--) {
    const at = ringCell(rng, 2, 8, radius);
    for (const [dx, dy] of rng.pick(SHAPES)) {
      const c = { x: at.x + dx, y: at.y + dy };
      if (free(c)) {
        rocks.push(c);
        claim(c);
      }
    }
  }
  const burrows: Cell[] = [];
  for (let b = rng.int(0, 3); b > 0; b--) {
    const c = ringCell(rng, 4, 9, radius);
    if (free(c)) {
      burrows.push(c);
      claim(c);
    }
  }
  const tunnels: [Cell, Cell][] = burrows.length >= 2 && kingDistance(burrows[0], burrows[1]) >= 8 && rng.float() < 0.7 ? [[burrows[0], burrows[1]]] : [];
  const patches: Cell[] = [];
  for (let p = rng.int(0, 2); p > 0; p--) {
    const c = ringCell(rng, 5, 9, radius);
    if (free(c)) {
      patches.push(c);
      claim(c);
    }
  }
  const tools: Tools = { carrot: 0, stone: 0, dig: 0 };
  for (let t = rng.int(1, 2); t > 0; t--) tools[rng.pick(["carrot", "stone", "dig"] as const)] += 1;
  const temperament: Temperament = rng.float() < 0.35 ? "jumper" : "plain";

  return {
    id: `daily-${day}`,
    chapter: 0,
    title: `Daily Pit`,
    note: describe(temperament, rocks.length, burrows.length, tunnels.length, patches.length, tools),
    radius,
    turns: 10,
    rocks,
    burrows,
    tunnels,
    patches,
    // A placeholder until a fair hiding place is chosen.
    rabbits: [{ start: { x: 0, y: 0 }, temperament, rustle: { x: 0, y: 0 } }],
    tools,
  };
}

const WORDS = ["no", "one", "two", "three", "four"];

/** One line for the day's card: what is waiting in the pit. */
function describe(temperament: Temperament, rocks: number, burrows: number, tunnels: number, patches: number, tools: Tools): string {
  const count = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${WORDS[n] ?? n} ${many}`);
  const parts = [temperament === "jumper" ? "a jumper" : "a rabbit"];
  if (rocks) parts.push(rocks > 4 ? "plenty of rocks" : "a few rocks");
  if (tunnels) parts.push("a tunnel");
  else if (burrows) parts.push(count(burrows, "burrow", "burrows"));
  if (patches) parts.push(count(patches, "carrot patch", "carrot patches"));
  const kit = [tools.carrot && count(tools.carrot, "carrot", "carrots"), tools.stone && count(tools.stone, "stone", "stones"), tools.dig && "a spade"].filter(Boolean);
  const head = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `${head[0].toUpperCase()}${head.slice(1)}. In your pockets: ${kit.join(" and ")}.`;
}

/**
 * The pit for a day. The ground is solved once (about a second; run it off the
 * main thread); then hiding places are tried in a seeded order until one gives
 * a fair fight: from the best drop, with no tools at all, good play lasts
 * between FAIR_START and TOO_EASY of the time.
 */
export function dailyPitFor(day: number): { plan: PitPlan; attempt: number; fairness: number } {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ground = dailyGround(day, attempt);
    const solution = solvePit(ground, ground.rabbits[0].temperament, pitTables(ground));
    const rng = createRng(`ten-turns/daily/${day}/${attempt}/hiding`);
    const blocked = new Set([...ground.rocks, ...ground.burrows, ...ground.patches].map(keyOf));
    const spots = rng.shuffle(cellsInCircle(ground.radius).filter((c) => !blocked.has(keyOf(c)) && Math.hypot(c.x, c.y) >= 2 && Math.hypot(c.x, c.y) <= 8));
    for (const start of spots) {
      // The rustle sits a step off the rabbit, so the middle of the grass isn't a sure squish.
      const nudge = { x: start.x + rng.int(-1, 1), y: start.y + rng.int(-1, 1) };
      const rustle = inCircle(nudge, ground.radius) ? nudge : start;
      const plan = { ...ground, rabbits: [{ ...ground.rabbits[0], start, rustle }] };
      // Rounded so a hair's difference in floating point between browsers can't change the day's pit.
      const fairness = Math.round(bestDrop(plan, [solution], [rustleCells(plan)]).value * 1000) / 1000;
      if (fairness >= FAIR_START && fairness <= TOO_EASY) return { plan, attempt, fairness };
    }
  }
  throw new Error(`No fair Daily Pit for day ${day} in ${MAX_ATTEMPTS} tries`);
}

export function dailyFor(date = new Date()): DailyPit {
  const { day, key, number } = dailyDate(date, tenTurnsManifest.daily?.epoch);
  const found = dailyPitFor(day);
  return { number, key, day, ...found, plan: { ...found.plan, title: `Daily Pit #${number}` } };
}
