/*
 * Two Humps' balance and the 1982 program, by simulation.
 *
 *   npx tsx scripts/check-two-humps.ts            the checks (exits 1 if a target is missed)
 *   npx tsx scripts/check-two-humps.ts --n=4000   more crossings per cell
 *
 * Crossings: the prompt's "sensible" bot (drinks at the warning, camps at
 * fatigue 5–6, pulls the reins at 6) against each pursuer at each difficulty,
 * starting at dawn and at dusk; a random player; a searched best plan; and
 * blind fixed routines, none of which may win more than 80%.
 * The 1982 program: how often the hidden repeat fires, how often a gallop on
 * a fresh camel kills it, how many return addresses pile up on BASIC's stack,
 * and how a random, a sensible and the best simple player fare.
 */

import { play, planPolicy, randomPolicy, routinePolicy, SENSIBLE, sensiblePolicy, type Plan, type Policy } from "../lib/two-humps/bots";
import type { TrekConfig } from "../lib/two-humps/engine";
import { dailyFor } from "../lib/two-humps/daily";
import { LEGS } from "../lib/two-humps/expedition";
import { createOriginal } from "../lib/two-humps/original";
import { dailyShare } from "../lib/two-humps/share";
import { mulberry32 } from "../lib/kit/rng";
import type { Difficulty, PursuerKind } from "../lib/two-humps/rules";

const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 1500);
let failures = 0;
const fail = (message: string) => {
  failures++;
  console.log(`FAIL ${message}`);
};
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const PURSUERS: PursuerKind[] = ["haboob", "rival", "gang"];
const DIFFICULTIES: Difficulty[] = ["chill", "normal", "hard"];
const STARTS = [6, 18];

type Tally = { win: number; turns: number[]; causes: Record<string, number> };

function run(pursuer: PursuerKind, difficulty: Difficulty, policy: (i: number) => Policy, starts = STARTS, n = N): Tally {
  const tally: Tally = { win: 0, turns: [], causes: {} };
  for (let i = 0; i < n; i++) {
    const startClock = starts[i % starts.length];
    const config: TrekConfig = { pursuer, difficulty, seed: `${pursuer}/${difficulty}/${i}`, startClock };
    const result = play(config, policy(i));
    if (result.won) {
      tally.win++;
      tally.turns.push(result.turns);
    }
    tally.causes[result.cause] = (tally.causes[result.cause] ?? 0) + 1;
  }
  return tally;
}

const winRate = (t: Tally) => t.win / Object.values(t.causes).reduce((a, b) => a + b, 0);

/* ---------- Crossings: the sensible bot against the targets ---------- */

const TARGETS: Record<PursuerKind, [number, number]> = { haboob: [0.55, 0.65], rival: [0.5, 0.6], gang: [0.4, 0.5] };
const SHIFT: Record<Difficulty, number> = { chill: 0.15, normal: 0, hard: -0.15 };
const SLACK = 0.03;

console.log(`Crossings, ${N} per cell, half from dawn and half from dusk\n`);
const allTurns: number[] = [];
for (const pursuer of PURSUERS) {
  for (const difficulty of DIFFICULTIES) {
    const tally = run(pursuer, difficulty, () => sensiblePolicy());
    const rate = winRate(tally);
    const [lo, hi] = TARGETS[pursuer].map((x) => x + SHIFT[difficulty]);
    const byStart = STARTS.map((start) => pct(winRate(run(pursuer, difficulty, () => sensiblePolicy(), [start], Math.round(N / 2)))));
    allTurns.push(...(difficulty === "normal" ? tally.turns : []));
    const causes = Object.entries(tally.causes)
      .sort((a, b) => b[1] - a[1])
      .map(([cause, n]) => `${cause} ${pct(n / N)}`)
      .join(", ");
    console.log(`sensible  ${pursuer.padEnd(7)} ${difficulty.padEnd(6)} ${pct(rate).padStart(6)}  (dawn ${byStart[0]}, dusk ${byStart[1]})  target ${pct(lo)}–${pct(hi)}  median ${median(tally.turns)} turns  · ${causes}`);
    if (rate < lo - SLACK || rate > hi + SLACK) fail(`sensible vs ${pursuer} on ${difficulty}: ${pct(rate)} outside ${pct(lo)}–${pct(hi)}`);
  }
}
const medianTurns = median(allTurns);
console.log(`\nmedian winning crossing on Normal: ${medianTurns} turns (target 10–14)`);
if (medianTurns < 10 || medianTurns > 14) fail(`median crossing ${medianTurns} turns, outside 10–14`);

/* ---------- A random player ---------- */

console.log("");
for (const pursuer of PURSUERS) {
  const tally = run(pursuer, "normal", (i) => randomPolicy(i));
  console.log(`random    ${pursuer.padEnd(7)} normal ${pct(winRate(tally)).padStart(6)}`);
}

/* ---------- The best plan we can find ---------- */

console.log("");
const grid: Plan[] = [];
for (const gallopUpTo of [-1, 0, 1, 2, 3, 4])
  for (const campAt of [3, 4, 5, 6, 7])
    for (const runUpTo of [3, 4, 5, 6, 7])
      for (const dayCamps of [false, true]) grid.push({ ...SENSIBLE, gallopUpTo, campAt, runUpTo, dayCamps });
for (const pursuer of PURSUERS) {
  let best = { rate: 0, plan: SENSIBLE };
  for (const plan of grid) {
    const rate = winRate(run(pursuer, "normal", () => planPolicy(plan), STARTS, 200));
    if (rate > best.rate) best = { rate, plan };
  }
  const confirmed = winRate(run(pursuer, "normal", () => planPolicy(best.plan)));
  const { gallopUpTo, campAt, runUpTo, dayCamps } = best.plan;
  console.log(`best      ${pursuer.padEnd(7)} normal ${pct(confirmed).padStart(6)}  gallop at fatigue ≤${gallopUpTo}, camp at ${campAt}, run on to ${runUpTo}${dayCamps ? ", camp by day" : ""}`);
}

/* ---------- Blind routines ---------- */

console.log("");
const routines: ("walk" | "gallop" | "camp")[][] = [["walk"], ["gallop", "camp"], ["gallop", "gallop", "camp"], ["gallop", "walk", "walk", "camp"], ["walk", "walk", "walk", "camp"], ["walk", "walk", "walk", "walk", "walk", "camp"], ["gallop", "walk", "camp"]];
for (const order of routines) {
  for (const pursuer of PURSUERS) {
    const rate = winRate(run(pursuer, "normal", () => routinePolicy(order)));
    if (rate > 0.8) fail(`routine ${order.join("-")} wins ${pct(rate)} against ${pursuer}`);
    if (pursuer === "haboob") process.stdout.write(`routine   ${order.join("-").padEnd(32)} `);
    process.stdout.write(`${pursuer} ${pct(rate).padStart(6)}  `);
  }
  console.log("");
}

/* ---------- The Expedition: every leg winnable by the sensible bot ---------- */

console.log("\nExpedition, sensible bot on Normal\n");
for (const leg of LEGS) {
  let won = 0;
  for (let i = 0; i < N; i++) {
    if (play({ pursuer: leg.pursuer, difficulty: "normal", seed: `leg/${leg.id}/${i}`, startClock: leg.startClock, twist: leg.twist }, sensiblePolicy()).won) won++;
  }
  const rate = won / N;
  console.log(`${leg.place.padEnd(16)} ${leg.pursuer.padEnd(7)} ${pct(rate).padStart(6)}`);
  if (rate < 0.4) fail(`Expedition leg ${leg.place} won only ${pct(rate)} by the sensible bot`);
}

/* ---------- The Daily Crossing ---------- */

const day = dailyFor(new Date(2026, 9, 9));
const again = dailyFor(new Date(2026, 9, 9));
const first = play(day.config, sensiblePolicy());
const second = play(again.config, sensiblePolicy());
if (JSON.stringify(first.trek.state.log) !== JSON.stringify(second.trek.state.log)) fail("the same Daily Crossing played twice came out differently");
const pursuers = new Set(Array.from({ length: 3 }, (_, i) => dailyFor(new Date(2026, 9, 9 + i)).config.pursuer));
if (pursuers.size !== 3) fail("the Daily Crossing doesn't rotate through all three pursuers");
console.log(`\nDaily #${day.number} (${day.config.pursuer}) plays the same twice; a sample share:\n${dailyShare(first.trek, day.number)}`);

/* ---------- The 1982 program ---------- */

console.log("\nThe 1982 program\n");
type OriginalPlayer = (s: ReturnType<typeof createOriginal>["state"]) => number;
const original = (player: OriginalPlayer, sub: () => number, games = N * 4, seed = 1982) => {
  const counts: Record<string, number> = {};
  const turns: number[] = [];
  const stale: number[] = [];
  let moves = 0;
  let repeats = 0;
  for (let g = 0; g < games; g++) {
    const random = mulberry32(seed * 1000003 + g);
    const game = createOriginal(random);
    for (let guard = 0; guard < 500 && game.state.phase !== "over"; guard++) {
      if (game.state.phase === "subcommand") game.subcommand(sub());
      else {
        const command = player(game.state);
        const before = game.state.repeatsTotal;
        if (command === 2 || command === 3) moves++;
        game.command(command);
        repeats += game.state.repeatsTotal - before;
      }
      game.take();
    }
    const ending = game.state.ending ?? "stalled";
    const key = ending === "died" ? `died` : ending;
    counts[key] = (counts[key] ?? 0) + 1;
    if (ending === "won") turns.push(game.state.turn);
    stale.push(game.state.staleReturns);
  }
  return { counts, turns, stale, repeatsPerMove: repeats / Math.max(1, moves), games };
};

// The hidden repeat: how often a fresh camel's first gallop kills it.
let killed = 0;
const trials = N * 20;
for (let g = 0; g < trials; g++) {
  const game = createOriginal(mulberry32(7000 + g));
  game.take();
  game.command(3);
  if (game.state.ending === "died") killed++;
}
const expectedKill = 0.94 * 0.7 * 0.94 * 0.94;
console.log(`a fresh camel's first gallop kills it in ${pct(killed / trials)} of ${trials} games (two repeats in a row: ${pct(expectedKill ** 2)})`);
if (Math.abs(killed / trials - expectedKill ** 2) > 0.02) fail("1982 first-gallop death rate is off");

const rnd = mulberry32(42);
const randomPlayer: OriginalPlayer = () => 1 + Math.floor(rnd() * 6);
const sensible1982: OriginalPlayer = (s) => (s.thirst <= 1 && s.sips > 0 ? 1 : s.fatigue >= 5 ? 4 : 2);
const describe = (name: string, r: ReturnType<typeof original>) => {
  const total = r.games;
  const causes = Object.entries(r.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, n]) => `${cause} ${pct(n / total)}`)
    .join(", ");
  const staleSorted = [...r.stale].sort((a, b) => a - b);
  console.log(`${name.padEnd(28)} won ${pct((r.counts.won ?? 0) / total).padStart(6)}  median winning game ${median(r.turns)} turns · ${causes}`);
  return { staleMedian: median(r.stale), staleMax: staleSorted[staleSorted.length - 1], repeatsPerMove: r.repeatsPerMove };
};
const r1 = describe("random player", original(randomPlayer, () => (rnd() < 0.5 ? 7 : 8)));
const r2 = describe("sensible (walk, camp at 5)", original(sensible1982, () => 8));

// The best simple policy: thresholds for galloping, camping and drinking, always waiting when held.
let best1982 = { rate: 0, name: "" };
for (const gallopAt of [-1, 0])
  for (const campAt of [1, 2, 3, 4, 5, 6, 7])
    for (const drinkAt of [0, 1, 2]) {
      const player: OriginalPlayer = (s) => (s.thirst <= drinkAt && s.sips > 0 ? 1 : s.fatigue >= campAt ? 4 : s.fatigue <= gallopAt ? 3 : 2);
      const r = original(player, () => 8, 2000, 77);
      const rate = (r.counts.won ?? 0) / r.games;
      if (rate > best1982.rate) best1982 = { rate, name: `${gallopAt >= 0 ? "gallop when fresh" : "never gallop"}, camp at ${campAt}, drink at ${drinkAt}` };
    }
console.log(`best simple policy           won ${pct(best1982.rate).padStart(6)}  (${best1982.name})`);
console.log(`hidden repeats per walk or gallop: ${r2.repeatsPerMove.toFixed(2)} (expected ${(expectedKill / (1 - expectedKill)).toFixed(2)})`);
console.log(`return addresses left on the stack at the end of a game: median ${r2.staleMedian}, most ${Math.max(r1.staleMax, r2.staleMax)}`);

console.log(failures ? `\n${failures} checks failed` : "\nall Two Humps checks passed");
process.exitCode = failures ? 1 : 0;
