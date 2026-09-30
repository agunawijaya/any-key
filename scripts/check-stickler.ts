/*
 * Plays thousands of Stickler games to check the maths:
 * every Ladder table and Daily is winnable, perfect play always wins them,
 * Master Sparky never loses a won position, and the 1981 algorithm matches the listing's rules.
 * Handfuls (take min..max, sweep when fewer than min are left) gets the same treatment at the end.
 */
import { CLASSIC, dailyPuzzle, HANDFULS_PRESETS, handfulsRules, LADDER, surprisePile, VERSUS_PRESETS } from "../lib/stickler/modes";
import { describeRules, isLegal, legalMoves, newGame, play, total, type Game, type Rules } from "../lib/stickler/rules";
import { isWinning, magicZones, quality, winningMoves, zoneOf } from "../lib/stickler/solver";
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

// ---------- Handfuls ----------

// An independent brute force for one row with takes a..b: below a the only move is to take everything.
function bruteHandful(n: number, a: number, b: number, memo: Map<number, boolean>): boolean {
  if (n === 0) return true;
  const cached = memo.get(n);
  if (cached !== undefined) return cached;
  const takes = n < a ? [n] : Array.from({ length: Math.min(b, n) - a + 1 }, (_, i) => a + i);
  const result = takes.some((t) => n - t > 0 && !bruteHandful(n - t, a, b, memo));
  memo.set(n, result);
  return result;
}
let formulaChecks = 0;
for (let a = 1; a <= 4; a++) {
  for (let b = a; b <= 7; b++) {
    const memo = new Map<number, boolean>();
    for (let n = 1; n <= 60; n++) {
      const brute = bruteHandful(n, a, b, memo);
      const closed = isWinning([n], { minTake: a, maxTake: b });
      const lostByZone = n % (a + b) >= 1 && n % (a + b) <= a;
      if (brute !== closed || closed === lostByZone) fail(`handfuls closed form ${a}-${b} n${n}: brute ${brute}, closed ${closed}`);
      if ((zoneOf(n, a, b) !== undefined) !== lostByZone) fail(`zoneOf ${a}-${b} n${n}`);
      // The generic move search (winningMoves) models the sweep too: a win exists exactly when the brute force says so.
      if ((winningMoves([n], { minTake: a, maxTake: b }).length > 0) !== brute) fail(`handfuls winning moves ${a}-${b} n${n}`);
      formulaChecks++;
    }
  }
}
console.log(`handfuls: closed form matches brute force in ${formulaChecks} positions (min 1–4, max min–7, n 1–60)`);

// With min = 1 the new formula gives exactly the old answer (n mod (max+1) = 1 loses).
for (let b = 1; b <= 9; b++) for (let n = 1; n <= 80; n++) if (isWinning([n], { minTake: 1, maxTake: b }) !== (n % (b + 1) !== 1)) fail(`min 1 formula ${b} ${n}`);

// The zones the Coach shows, e.g. 2–3: 1–2, 6–7, 11–12, 16–17, 21–22.
const zones23 = magicZones(2, 3, 23).map((z) => `${z.from}-${z.to}`).join(" ");
if (zones23 !== "1-2 6-7 11-12 16-17 21-22") fail(`zones 2-3: ${zones23}`);

// The legal-move generator never offers fewer than min unless it is the sweep (which takes everything).
for (const p of HANDFULS_PRESETS) {
  for (let n = 1; n <= 60; n++) {
    const moves = legalMoves([n], { minTake: p.min, maxTake: p.max });
    for (const m of moves) {
      if (m.take > p.max) fail(`legal ${p.id} n${n} offers ${m.take}`);
      if (m.take < p.min && m.take !== n) fail(`legal ${p.id} n${n} offers ${m.take} without sweeping`);
    }
    if (n < p.min && (moves.length !== 1 || moves[0].take !== n)) fail(`legal ${p.id} n${n} should be the sweep only`);
    if (n >= p.min && moves.length !== Math.min(p.max, n) - p.min + 1) fail(`legal ${p.id} n${n} count ${moves.length}`);
    const game = newGame({ rows: [n], minTake: p.min, maxTake: p.max, first: 0 });
    for (let t = 1; t <= 9; t++) if (isLegal(game, { row: 0, take: t }) !== moves.some((m) => m.take === t)) fail(`isLegal ${p.id} n${n} take ${t}`);
  }
}

// Several rows with a floor above 1 cannot be built.
let threw = false;
try {
  newGame({ rows: [3, 5], minTake: 2, maxTake: 3, first: 0 });
} catch {
  threw = true;
}
if (!threw) fail("rows with minTake > 1 should throw");

// You can win every Handfuls table: when you open, the pile is a win for the opener; when Sparky opens,
// it is one stick shorter, on the top of a zone, so he opens on a lost position. Perfect play beats Master either way.
const youCanWin = (r: Rules) => (r.first === 0 ? isWinning(r.rows, r) : !isWinning(r.rows, r));
for (const p of HANDFULS_PRESETS) {
  for (const sparkyStarts of [false, true]) {
    const rules = handfulsRules({ preset: p.id, surprise: false, sparkyStarts }, 0);
    const pile = sparkyStarts ? p.sparkyPile : p.pile;
    if (describeRules(rules) !== `${pile} sticks · take ${p.min}–${p.max}`) fail(`describe ${p.id}: ${describeRules(rules)}`);
    if (isWinning(rules.rows, rules) === sparkyStarts) fail(`preset ${p.id} pile ${pile} (Sparky starts: ${sparkyStarts}) is not winnable for you`);
    const sweeps: number[] = [];
    let won = 0;
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry(seed);
      let game = newGame(rules);
      while (game.loser === null) game = play(game, game.turn === 0 ? winningMoves(game.rows, rules)[0] : sparkyMove(game, "master", rng));
      if (game.loser === 1) won++;
      else fail(`perfect play lost handfuls ${p.id} (Sparky starts: ${sparkyStarts}, seed ${seed})`);
      sweeps.push(game.history[game.history.length - 1].move.take);
    }
    for (const level of ["rookie", "clever"] as Level[]) for (let seed = 0; seed < 100; seed++) if (!perfectVsSparky(rules, level, seed)) fail(`handfuls ${p.id} ${level} ${seed}`);
    console.log(`handfuls ${p.id} · ${pile}${sparkyStarts ? " · Sparky starts" : ""}: perfect play beat Master ${won}/200 (Sparky swept ${Math.min(...sweeps)}–${Math.max(...sweeps)})`);
  }
}

// "Surprise pile": 1,000 seeds per preset and per opener, always inside 3–6 × (min + max) and winnable for you.
for (const p of HANDFULS_PRESETS) {
  for (const sparkyStarts of [false, true]) {
    const seen = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      const n = surprisePile(p.min, p.max, seed, sparkyStarts);
      seen.add(n);
      if (!(n >= 3 * (p.min + p.max) && n <= 6 * (p.min + p.max))) fail(`surprise ${p.id} seed ${seed}: ${n} out of range`);
      if (!youCanWin(handfulsRules({ preset: p.id, surprise: true, sparkyStarts }, seed))) fail(`surprise ${p.id} seed ${seed} (Sparky starts: ${sparkyStarts}): ${n} not winnable for you`);
    }
    if (seen.size < 5) fail(`surprise ${p.id} only ever draws ${[...seen]}`);
  }
}
console.log("handfuls: 10,000 surprise piles, all in range and winnable for you, whoever opens");

// No table anywhere in Stickler starts lost for you: Classic, the Ladder, two years of Dailies, every Handfuls setup.
let tables = 0;
const lost: string[] = [];
const audit = (name: string, r: Rules) => {
  tables++;
  if (!youCanWin(r)) lost.push(name);
};
audit("classic", CLASSIC);
LADDER.forEach((t) => audit(`ladder ${t.id}`, t.rules));
for (let d = 0; d < 730; d++) audit(`daily ${d}`, dailyPuzzle(new Date(2026, 0, 1 + d)).rules);
for (const p of HANDFULS_PRESETS)
  for (const surprise of [false, true])
    for (const sparkyStarts of [false, true])
      for (let seed = 0; seed < (surprise ? 200 : 1); seed++) audit(`handfuls ${p.id} ${surprise} ${sparkyStarts} ${seed}`, handfulsRules({ preset: p.id, surprise, sparkyStarts }, seed));
if (lost.length) fail(`tables you cannot win: ${lost.slice(0, 5).join(", ")}`);
console.log(`every table you can meet against Sparky is winnable for you (${tables} checked)`);

// Master never throws away a won position in Handfuls, and when he can end it he leaves exactly min (the biggest sweep).
let masterTurns = 0;
for (let seed = 0; seed < 1000; seed++) {
  const rng = mulberry(seed);
  const p = HANDFULS_PRESETS[seed % HANDFULS_PRESETS.length];
  let game = newGame({ rows: [p.min + (seed % 50)], minTake: p.min, maxTake: p.max, first: seed % 2 ? 1 : 0 });
  while (game.loser === null) {
    let move;
    if (game.turn === 1) {
      move = sparkyMove(game, "master", rng);
      masterTurns++;
      const n = game.rows[0];
      if (isWinning(game.rows, game.rules) && n >= 2 * p.min && n <= p.min + p.max && n - move.take !== p.min) fail(`master ${p.id} from ${n} left ${n - move.take}, not ${p.min}`);
    } else {
      const moves = legalMoves(game.rows, game.rules);
      move = moves[Math.floor(rng() * moves.length)];
    }
    const before = game;
    game = play(game, move);
    if (before.turn === 1 && quality(game.history[game.history.length - 1], game.rules) === "blunder") fail(`master blundered in handfuls ${p.id} (seed ${seed})`);
  }
}
console.log(`handfuls: Master never blundered in ${masterTurns} turns over 1,000 random games`);

// Nothing that existed before changes: old presets keep a floor of 1 and their old descriptions.
for (const r of [CLASSIC, ...LADDER.map((t) => t.rules), ...VERSUS_PRESETS.slice(0, 4).map((v) => v.rules), dailyPuzzle(new Date(2026, 8, 30)).rules]) {
  if ((r.minTake ?? 1) !== 1) fail(`old preset ${describeRules(r)} has a floor`);
  const old = r.rows.length === 1 ? `${r.rows[0]} sticks · take 1–${r.maxTake}` : `rows ${r.rows.join("-")} · take any from one row`;
  if (describeRules(r) !== old) fail(`description changed: ${describeRules(r)}`);
}

console.log(failures ? `${failures} failures` : "all Stickler checks passed");
