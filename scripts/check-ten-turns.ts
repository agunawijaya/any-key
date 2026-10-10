/*
 * Ten Turns in the Pit: the 1970s module against the original program,
 * the survival numbers recorded in docs/ten-turns/NOTES.md, Classic's fair
 * start, the Tactics solver against the engine, and proof that every
 * campaign pit and a run of Daily Pits can be survived with good play.
 *
 *   npx tsx scripts/check-ten-turns.ts          (everything, in parallel)
 *   npx tsx scripts/check-ten-turns.ts --quick  (fewer games per pit)
 */

import { availableParallelism } from "node:os";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { createRng } from "@/lib/kit/rng";
import { classicStart, FAIR_FLOOR, playTurn as classicTurn, rabbitAfterDrop, type ClassicState, checkMove } from "@/lib/ten-turns/classic";
import { dailyPitFor, FAIR_START, TOO_EASY } from "@/lib/ten-turns/daily";
import { cellsInCircle, type Cell, DIRECTIONS, inCircle, kingDistance } from "@/lib/ten-turns/geometry";
import { classicModel, originalModel, originalMoves, ORIGINAL_ANGLES } from "@/lib/ten-turns/models";
import { ALL_FIXED, AS_WRITTEN, drop as originalDrop, newGame, pounceAngle, pounceFrom, type Quirks, run, runTarget } from "@/lib/ten-turns/original";
import { PITS } from "@/lib/ten-turns/pits";
import { solve } from "@/lib/ten-turns/solver";
import { drop, legalActions, lockOn, medalsOf, type PitPlan, playTurn, startPit, type TacticsState } from "@/lib/ten-turns/tactics";
import { branches, brainFor, chooseAction, chooseDrop } from "@/lib/ten-turns/tacticsPolicy";

const quick = process.argv.includes("--quick");

/** The least share of games the policy must survive, by chapter. */
const PROOF_FLOOR: Record<number, number> = { 0: 0.7, 1: 0.88, 2: 0.83, 3: 0.83, 4: 0.78, 5: 0.72 };
const GAMES_PER_PIT = quick ? 60 : 200;
const DAILY_DAYS = quick ? 6 : 24;
const GAMES_PER_DAILY = quick ? 40 : 80;

/* ---------- Jobs that run in worker threads ---------- */

type Job = { kind: "pit"; id: string } | { kind: "daily"; day: number };
type JobResult = { label: string; chapter: number; survived: number; untouched: number; spare: number; detail: string };

function proveGames(plan: PitPlan, games: number, label: string): Omit<JobResult, "chapter" | "detail"> & { drop: Cell } {
  const brain = brainFor(plan);
  const dropCell = chooseDrop(brain);
  let survived = 0;
  let untouched = 0;
  let spare = 0;
  for (let g = 0; g < games; g++) {
    const rng = createRng(`check/${label}/${g}`);
    let state = drop(startPit(plan), dropCell);
    while (!state.outcome) state = playTurn(state, chooseAction(brain, state), (chance) => rng.float() < chance).state;
    const medals = medalsOf(state);
    survived += +medals.survived;
    untouched += +medals.untouched;
    spare += +medals.toolsToSpare;
  }
  return { label, survived: survived / games, untouched: untouched / games, spare: spare / games, drop: dropCell };
}

function runJob(job: Job): JobResult {
  if (job.kind === "pit") {
    const plan = PITS.find((p) => p.id === job.id)!;
    const r = proveGames(plan, GAMES_PER_PIT, plan.id);
    return { ...r, chapter: plan.chapter, detail: `drop ${r.drop.x},${r.drop.y}` };
  }
  const { plan, attempt, fairness } = dailyPitFor(job.day);
  const r = proveGames(plan, GAMES_PER_DAILY, `daily-${job.day}`);
  return { ...r, chapter: 0, label: `daily #${job.day + 1}`, detail: `attempt ${attempt}, solved fairness ${fairness}` };
}

/* ---------- The main thread ---------- */

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const started = Date.now();
  const workers = runInWorkers();
  checkOriginal();
  checkSimulations();
  checkClassic();
  checkSolverAgainstEngine();
  const results = await workers;
  for (const r of results) {
    const floor = PROOF_FLOOR[r.chapter];
    check(r.survived >= floor, `${r.label} survivable`, `policy survived ${pct(r.survived)} of games (floor ${pct(floor)}), untouched ${pct(r.untouched)}, tools to spare ${pct(r.spare)}; ${r.detail}`);
  }
  console.log(`\n${failures ? `${failures} check(s) failed` : "All Ten Turns checks passed"} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  process.exit(failures ? 1 : 0);
}

function runInWorkers(): Promise<JobResult[]> {
  const jobs: Job[] = [...PITS.map((p) => ({ kind: "pit", id: p.id }) as Job), ...Array.from({ length: DAILY_DAYS }, (_, day) => ({ kind: "daily", day }) as Job)];
  const slots = Math.max(1, Math.min(availableParallelism() - 1, 8));
  const results: JobResult[] = [];
  let next = 0;
  return new Promise((resolve, reject) => {
    let running = 0;
    const launch = () => {
      if (next >= jobs.length && running === 0) return resolve(results);
      while (running < slots && next < jobs.length) {
        const job = jobs[next++];
        running++;
        // Workers start as plain JavaScript: register tsx, then load this same file in worker mode.
        const worker = new Worker(`require("tsx/cjs"); require(${JSON.stringify(__filename)});`, { eval: true, workerData: job });
        worker.once("message", (result: JobResult) => results.push(result));
        worker.once("error", reject);
        worker.once("exit", () => {
          running--;
          launch();
        });
      }
    };
    launch();
  });
}

/* ---------- The 1970s module ---------- */

function checkOriginal() {
  console.log("The 1970s rules");
  const q = AS_WRITTEN;
  // Angles: whole degrees cut before rounding, so 22.6 degrees still counts as straight on.
  check(pounceAngle({ x: 0, y: 0 }, { x: 12, y: 5 }, q) === 0, "a pounce at 22.6 degrees is cut to 22 and rounds to east");
  check(pounceAngle({ x: 0, y: 0 }, { x: 7, y: 3 }, q) === 45, "a pounce at 23.2 degrees rounds to north-east");
  check(pounceAngle({ x: 0, y: 0 }, { x: -5, y: 2 }, q) === 180, "second quarter: 158.2 degrees rounds to west");
  check(pounceAngle({ x: 0, y: 0 }, { x: -3, y: -3 }, q) === 225, "third quarter: south-west");
  check(pounceAngle({ x: 0, y: 0 }, { x: 4, y: -9 }, q) === 315, "fourth quarter: 294 degrees rounds to south-east");
  check(pounceAngle({ x: 0, y: 0 }, { x: 2, y: -9 }, q) === 270, "fourth quarter: 283 degrees rounds to south");
  check(pounceAngle({ x: 0, y: 0 }, { x: 6, y: 0 }, q) === 0, "due east goes through the program's B = 1 and rounds to 0");
  check(pounceAngle({ x: 2, y: 2 }, { x: 2, y: 7 }, q) === null, "player due north: the rabbit's move is skipped");
  check(pounceAngle({ x: 2, y: 2 }, { x: 2, y: 7 }, ALL_FIXED) === 90, "with the quirk off it pounces north");
  check(pounceAngle({ x: 2, y: 2 }, { x: 2, y: -3 }, q) === 270, "player due south: it pounces south");
  // Steps: 1.5 on a diagonal rounds to one cell each way, like a king.
  const diagonal = pounceFrom({ x: 0, y: 0 }, 45);
  check(diagonal.x === 1 && diagonal.y === 1, "a diagonal pounce of 1.5 lands one cell across and one up");
  const west = pounceFrom({ x: 3, y: -2 }, 180);
  check(west.x === 2 && west.y === -2, "a straight pounce of 1 lands one cell over");

  // Line 131: wherever you stand, a run drags your y to 0, 1 or 2.
  let pulled = true;
  for (const c of cellsInCircle()) {
    for (const angle of ORIGINAL_ANGLES) {
      const game = newGame({ x: 50, y: 50 }, q);
      game.player = { ...c };
      const t = runTarget(game, angle);
      if (t.ok && ![0, 1, 2].includes(t.to.y)) pulled = false;
    }
  }
  check(pulled, "line 131: after any run the player's y is 0, 1 or 2");
  const fixedRun = runTarget({ ...newGame({ x: 50, y: 50 }, ALL_FIXED), player: { x: 3, y: -6 } }, 270);
  check(fixedRun.ok && fixedRun.to.y === -7, "with the slip fixed, running south from y = -6 reaches -7");
  const outside = originalMoves({ x: -9, y: -1 }, q)[ORIGINAL_ANGLES.indexOf(135)];
  check(!!outside && !inCircle(outside), "the slip can carry the player a step past the wall", outside ? `(-9,-1) north-west lands on (${outside.x},${outside.y})` : "");
  const escape = pounceFrom({ x: 0, y: 10 }, pounceAngle({ x: 0, y: 10 }, { x: 3, y: 9 }, q)!);
  check(!inCircle(escape), "nothing keeps the rabbit in the pit", `(0,10) chasing (3,9) lands on (${escape.x},${escape.y})`);

  // The last-turn loophole: a landing in turn ten goes unnoticed. You stand at (4,1) with the rabbit
  // at (4,2); you run west to (3,1) and it pounces south-west straight onto you.
  const landing = (quirks: Quirks) => {
    const game = newGame({ x: 4, y: 2 }, quirks);
    originalDrop(game, 4, 1);
    game.turn = 10;
    return run(game, 180, () => 0.9).at(-1)?.kind;
  };
  check(landing(q) === "released", "turn ten: the rabbit lands on you and you are released anyway");
  check(landing(ALL_FIXED) === "crunch", "with the loophole closed the same landing is a crunch");

  // Chain odds: 1 in 2, then 1 in 3, then 1 in 4.
  const rng = createRng("check/chain");
  const counts = new Array(10).fill(0);
  const games = 200_000;
  for (let i = 0; i < games; i++) {
    const game = newGame({ x: -9, y: 0 }, ALL_FIXED);
    originalDrop(game, 9, 0);
    const events = run(game, 0, rng.float);
    counts[Math.min(9, events.filter((e) => e.kind === "pounce").length)]++;
  }
  const atLeast = (k: number) => counts.slice(k).reduce((a, b) => a + b, 0) / games;
  check(near(atLeast(2), 1 / 2, 0.005), "a second pounce one time in two", pct(atLeast(2)));
  check(near(atLeast(3), 1 / 6, 0.004), "a third one time in six (1/2 x 1/3)", pct(atLeast(3)));
  check(near(atLeast(4), 1 / 24, 0.002), "a fourth one time in 24", pct(atLeast(4)));
  const mean = counts.reduce((a, n, k) => a + n * k, 0) / games;
  check(near(mean, Math.E - 1, 0.01), "on average e - 1 pounces a turn", mean.toFixed(3));
}

/* ---------- Survival numbers ---------- */

/** Recorded in NOTES.md: [exact best, simulated run-away, simulated random]. */
const RECORDED: Record<string, [number, number, number]> = {
  "as written": [0.869, 0.334, 0.051],
  "line 131 fixed": [0.962, 0.505, 0.085],
  "all quirks fixed": [0.337, 0.241, 0.024],
};

function checkSimulations() {
  console.log("\nSurvival in the 1970s game");
  const sets: [string, Quirks][] = [
    ["as written", AS_WRITTEN],
    ["line 131 fixed", { ...AS_WRITTEN, middleRowPull: false }],
    ["all quirks fixed", ALL_FIXED],
  ];
  const cells = cellsInCircle();
  for (const [name, quirks] of sets) {
    const solution = solve(originalModel(quirks));
    let bestValue = 0;
    for (const d of cells) {
      let total = 0;
      for (const r of cells) total += d.x === r.x && d.y === r.y ? 1 : solution.value(1, d, r);
      bestValue = Math.max(bestValue, total / cells.length);
    }
    const [best, away, random] = RECORDED[name];
    check(near(bestValue, best, 0.002), `${name}: best play survives ${pct(bestValue)}`, `recorded ${pct(best)}`);
    const games = quick ? 3000 : 12000;
    const runAway = simulateOriginal(quirks, "away", games);
    const blind = simulateOriginal(quirks, "random", games);
    check(near(runAway, away, 0.025), `${name}: a player who runs straight away survives ${pct(runAway)}`, `recorded ${pct(away)}`);
    check(near(blind, random, 0.015), `${name}: a player picking at random survives ${pct(blind)}`, `recorded ${pct(random)}`);
  }
}

function simulateOriginal(quirks: Quirks, policy: "away" | "random", games: number) {
  const rng = createRng(`check/original/${policy}/${JSON.stringify(quirks)}`);
  const cells = cellsInCircle();
  let survived = 0;
  for (let g = 0; g < games; g++) {
    const game = newGame(cells[Math.floor(rng.float() * cells.length)], quirks);
    const d = policy === "random" ? cells[Math.floor(rng.float() * cells.length)] : { x: 0, y: 0 };
    originalDrop(game, d.x, d.y);
    while (!game.outcome) {
      const options = originalMoves(game.player, quirks);
      const legal = ORIGINAL_ANGLES.filter((_, i) => options[i] !== null);
      let angle = legal[Math.floor(rng.float() * legal.length)];
      if (policy === "away") {
        const aim = Math.atan2(game.player.y - game.rabbit.y, game.player.x - game.rabbit.x);
        angle = legal.reduce((b, a) => (headingGap(a, aim) < headingGap(b, aim) ? a : b));
      }
      run(game, angle, rng.float);
    }
    if (game.outcome === "released" || game.outcome === "squish") survived++;
  }
  return survived / games;
}

function headingGap(degrees: number, radians: number) {
  const g = Math.abs((degrees * Math.PI) / 180 - radians) % (Math.PI * 2);
  return g > Math.PI ? Math.PI * 2 - g : g;
}

/* ---------- Classic ---------- */

function checkClassic() {
  console.log("\nClassic");
  const solution = solve(classicModel());
  const survival = (d: Cell, s: Cell) => solution.value(1, d, s);
  const cells = cellsInCircle();
  let fewest = Infinity;
  let worstStart = 1;
  let average = 0;
  for (const d of cells) {
    const fair = cells.filter((c) => (c.x !== d.x || c.y !== d.y) && survival(d, c) >= FAIR_FLOOR);
    fewest = Math.min(fewest, fair.length);
    for (const c of fair) worstStart = Math.min(worstStart, survival(d, c));
    average += fair.reduce((a, c) => a + survival(d, c), 0) / fair.length / cells.length;
  }
  check(fewest > 0, "every drop leaves somewhere fair for the rabbit to be", `at least ${fewest} cells`);
  check(worstStart >= FAIR_FLOOR, `no Classic start is worse than ${pct(FAIR_FLOOR)} with best play`, `worst ${pct(worstStart)}`);
  console.log(`     best play survives ${pct(average)} on average, whatever the drop`);

  // Play the real rules with the best moves: the rate should match the solved average for that drop.
  const rng = createRng("check/classic");
  const dropAt = { x: 0, y: 0 };
  const games = 8000;
  let wins = 0;
  for (let g = 0; g < games; g++) {
    let state: ClassicState = { ...classicStart(rng.float), player: dropAt };
    state.rabbit = rabbitAfterDrop(dropAt, rng.float, survival);
    if (state.rabbit.x === dropAt.x && state.rabbit.y === dropAt.y) {
      wins++;
      continue;
    }
    while (!state.outcome) {
      const moves = DIRECTIONS.filter((d) => inCircle({ x: state.player!.x + d.dx, y: state.player!.y + d.dy }));
      const best = moves[solution.bestMove(state.turn, state.player!, state.rabbit)];
      const move = best && checkMove(state, best).ok ? best : DIRECTIONS.find((d) => checkMove(state, d).ok)!;
      state = classicTurn(state, move, rng.float)!.state;
    }
    if (state.outcome === "released") wins++;
  }
  const fair = cells.filter((c) => (c.x || c.y) && survival(dropAt, c) >= FAIR_FLOOR);
  const expected = (1 / cells.length) * 1 + (1 - 1 / cells.length) * (fair.reduce((a, c) => a + survival(dropAt, c), 0) / fair.length);
  check(near(wins / games, expected, 0.02), `played with best moves from the middle: ${pct(wins / games)}`, `solved ${pct(expected)}`);
}

/* ---------- The Tactics solver agrees with the engine ---------- */

function checkSolverAgainstEngine() {
  console.log("\nTactics solver against the engine");
  // Burrows and tools are judged by the policy, not the solver: compare on the ground the solver models.
  const plans = ["hat-trick", "the-big-one", "double-trouble", "stampede"].map((id) => {
    const p = PITS.find((x) => x.id === id)!;
    return { ...p, burrows: [], tunnels: [], tools: { carrot: 0, stone: 0, dig: 0 }, rabbits: p.rabbits.slice(0, 1) } satisfies PitPlan;
  });
  const variants: PitPlan[] = [...plans, { ...plans[2], rabbits: [{ ...PITS.find((x) => x.id === "double-trouble")!.rabbits[1] }] }];
  for (const plan of variants) {
    const brain = brainFor(plan);
    const rng = createRng(`check/bellman/${plan.id}/${plan.rabbits[0].temperament}`);
    const cells = brain.solutions[0].cells;
    let worst = 0;
    const samples = quick ? 150 : 500;
    for (let i = 0; i < samples; i++) {
      const player = cells[Math.floor(rng.float() * cells.length)];
      const rabbit = cells[Math.floor(rng.float() * cells.length)];
      if (kingDistance(player, rabbit) === 0 || plan.patches.some((c) => c.x === player.x && c.y === player.y)) continue;
      const turn = 1 + Math.floor(rng.float() * plan.turns);
      const hat = rng.float() < 0.5;
      const dazed = rng.float() < 0.3;
      const state: TacticsState = lockOn({ ...startPit(plan), player, turn, hat, rabbits: [{ at: rabbit, temperament: plan.rabbits[0].temperament, dazed }] });
      let best = 0;
      for (const action of legalActions(state)) {
        let value = 0;
        for (const b of branches(state, action, 1e-9)) {
          const s = b.state;
          value += b.chance * (s.outcome === "crunch" ? 0 : s.outcome === "released" ? 1 : brain.solutions[0].value(s.turn, s.player!, s.rabbits[0].at, s.hat, s.rabbits[0].dazed));
        }
        best = Math.max(best, value);
      }
      worst = Math.max(worst, Math.abs(best - brain.solutions[0].value(turn, player, rabbit, hat, dazed)));
    }
    check(worst < 2e-4, `${plan.id} (${plan.rabbits[0].temperament}): solver and engine agree on every sampled position`, `largest gap ${worst.toExponential(1)}`);
  }
  console.log(`     Daily Pits are kept between ${pct(FAIR_START)} and ${pct(TOO_EASY)} solved fairness`);
}

if (!isMainThread) parentPort!.postMessage(runJob(workerData as Job));
else main();
