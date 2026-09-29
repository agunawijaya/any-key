/*
 * Plays thousands of Stickler games to check the maths:
 * every Ladder table and Daily is winnable, perfect play always wins them,
 * Master Sparky never loses a won position, and the 1981 algorithm matches the listing's rules.
 */
import { CLASSIC, dailyPuzzle, LADDER } from "../lib/stickler/modes";
import { newGame, play, total, type Game, type Rules } from "../lib/stickler/rules";
import { isWinning, quality, winningMoves } from "../lib/stickler/solver";
import { move1981, mulberry, sparkyMove, type Level } from "../lib/stickler/sparky";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log("FAIL", msg);
};

/** You play perfectly; Sparky plays at a level. Returns true if you won. */
function perfectVsSparky(rules: Rules, level: Level, seed: number) {
  const rng = mulberry(seed);
  let game: Game = newGame(rules);
  while (game.loser === null) {
    if (game.turn === 0) {
      const good = winningMoves(game.rows, rules);
      const move = good[0] ?? { row: game.rows.findIndex((n) => n > 0), take: 1 };
      game = play(game, move);
    } else {
      game = play(game, sparkyMove(game, level, rng));
    }
  }
  return game.loser === 1;
}

// Brute-force check of the closed-form solver on small positions.
function brute(rows: number[], k: number): boolean {
  if (total(rows) === 0) return true;
  for (let r = 0; r < rows.length; r++) {
    for (let t = 1; t <= Math.min(k, rows[r]); t++) {
      const next = rows.map((n, i) => (i === r ? n - t : n));
      if (total(next) === 0) continue;
      if (!brute(next, k)) return true;
    }
  }
  return false;
}
for (let n = 1; n <= 30; n++) for (const k of [3, 4, 5]) if (brute([n], k) !== isWinning([n], { maxTake: k })) fail(`single ${n} k${k}`);
for (const r of [[1, 1], [1, 2], [2, 2], [1, 3, 5], [1, 3, 5, 7], [3, 5], [2, 2, 1], [1, 1, 1], [4, 1]]) {
  if (brute(r, 99) !== isWinning(r, { maxTake: Infinity })) fail(`nim ${r}`);
}

// Every table: the side to move first is set so you (perfect) always win.
for (const table of LADDER) {
  const youMoveFirst = table.rules.first === 0;
  const youWinFromStart = youMoveFirst ? isWinning(table.rules.rows, table.rules) : !isWinning(table.rules.rows, table.rules);
  if (!youWinFromStart) fail(`table ${table.id} is not winnable`);
  for (let seed = 0; seed < 200; seed++) {
    if (!perfectVsSparky(table.rules, table.level, seed)) fail(`perfect play lost table ${table.id} (seed ${seed})`);
  }
}
console.log("ladder: all 10 tables winnable and won by perfect play");

// Classic against every level.
for (const level of ["rookie", "clever", "master"] as Level[]) {
  for (let seed = 0; seed < 300; seed++) if (!perfectVsSparky(CLASSIC, level, seed)) fail(`classic ${level} ${seed}`);
}

// Master never gives away a won position.
for (let seed = 0; seed < 500; seed++) {
  const rng = mulberry(seed);
  let game = newGame({ rows: [10 + (seed % 30)], maxTake: 3 + (seed % 3), first: 1 });
  while (game.loser === null) {
    const move = game.turn === 1 ? sparkyMove(game, "master", rng) : { row: 0, take: 1 + Math.floor(rng() * Math.min(game.rules.maxTake, game.rows[0])) };
    const before = game;
    game = play(game, move);
    if (before.turn === 1 && quality(game.history[game.history.length - 1], game.rules) === "blunder") fail(`master blundered (seed ${seed})`);
  }
}

// Daily puzzles for a year are all winnable.
for (let d = 0; d < 365; d++) {
  const date = new Date(2026, 0, 1 + d);
  const daily = dailyPuzzle(date);
  if (!isWinning(daily.rules.rows, daily.rules)) fail(`daily ${daily.key}`);
}

// The 1981 algorithm: never takes more than 3, leaves 1 mod 4 when it can, concedes at 1.
for (let m = 1; m <= 23; m++) {
  const c = move1981(m);
  if (m === 1) {
    if (c !== "concede") fail("1981 should concede at 1");
    continue;
  }
  if (c === "concede" || c < 1 || c > 3 || c >= m) fail(`1981 move from ${m} is ${c}`);
  else if (m % 4 !== 1 && (m - c) % 4 !== 1) fail(`1981 misplayed from ${m}`);
}

console.log(failures ? `${failures} failures` : "all Stickler checks passed");
