/*
 * Outta Here balance and rule checks.
 *
 *   npx tsx scripts/check-outta.ts [runs per level]
 *
 * Plays every level and every campaign screen with human-like bots (0.35 s
 * reaction, about six steps a second, no peeking) and reports how often they
 * get out, how long it takes and what hurts them. Also checks the rules that
 * must always hold, the Daily Escape, and the 1980 simulation's quirks.
 */
import { HumanBot } from "../lib/outta/bot";
import { SCREENS } from "../lib/outta/campaign";
import { dailyFor, timelineSquares } from "../lib/outta/daily";
import { EMPTY, GLASS, Game, STONE, WOOD } from "../lib/outta/engine";
import { LEVELS, type LevelId } from "../lib/outta/levels";
import { BLOCK, Escape1980, EXIT, VIDEO, type Key } from "../lib/outta/original";

const runs = Number(process.argv[2] ?? 120);
let failures = 0;
/** Runs the clock in real frames (the engine never takes more than 0.1 s at once). */
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60);
};
const check = (ok: boolean, what: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

// ---------- Rules ----------

{
  // Every fresh screen has a way out that bombs can open, from the start.
  let fine = 0;
  for (let seed = 1; seed <= 500; seed++) if (new Game("normal", seed).openPath()) fine++;
  check(fine === 500, `a way out exists at the start of 500 Normal screens (${fine})`);
}
{
  // The same seed and inputs replay the same run.
  const a = new Game("hard", 42);
  const b = new Game("hard", 42);
  const botA = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed: 3 });
  const botB = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed: 3 });
  for (let i = 0; i < 60 * 40; i++) {
    botA.tick(a);
    a.update(1 / 60);
    botB.tick(b);
    b.update(1 / 60);
  }
  check(a.grid.every((v, i) => v === b.grid[i]) && a.player.x === b.player.x && a.player.y === b.player.y && a.state === b.state, "a seed replays exactly");
}
{
  // Edge tunnels: off the left edge onto the row above's right end, and the other way.
  const g = new Game("chill", 7);
  g.grid.fill(EMPTY);
  g.player = { x: 0, y: 5 };
  g.move("left");
  run(g, 0.2);
  const left = g.player.x === g.cols - 1 && g.player.y === 4;
  g.move("right");
  run(g, 0.2);
  check(left && g.player.x === 0 && g.player.y === 5, "edge tunnels wrap to the neighbouring row");
}
{
  // Under the keys: off the top row, along the keyboard, back down elsewhere; nothing can reach you there.
  const g = new Game("chill", 8);
  g.grid.fill(EMPTY);
  g.player = { x: 3, y: 0 };
  g.move("up");
  run(g, 0.2);
  const hidden = g.underKeys();
  for (let i = 0; i < 5; i++) {
    g.move("right");
    run(g, 0.2);
  }
  g.move("down");
  run(g, 0.2);
  check(hidden && g.player.x === 8 && g.player.y === 0, "diving under the keys and coming back up elsewhere");
}
{
  // Pushing wood, and not through stone.
  const g = new Game("chill", 9);
  g.grid.fill(EMPTY);
  g.player = { x: 10, y: 5 };
  g.grid[g.idx(11, 5)] = WOOD;
  g.move("right");
  run(g, 0.2);
  const pushed = g.player.x === 11 && g.at(12, 5) === WOOD;
  g.grid[g.idx(13, 5)] = STONE;
  g.move("right");
  run(g, 0.2);
  check(pushed && g.player.x === 11 && g.at(12, 5) === WOOD, "wood slides one cell, and stops against stone");
}
{
  // A plain bomb breaks the glass around it only; a chain bomb breaks every glass block touching those.
  const make = (chain: boolean) => {
    const g = new Game("chill", 10);
    g.grid.fill(EMPTY);
    g.player = { x: 20, y: 8 };
    for (let x = 21; x <= 30; x++) g.grid[g.idx(x, 8)] = GLASS;
    if (chain) g.chainCharges = 3;
    g.bomb();
    for (let i = 0; i < 3; i++) {
      g.move("left");
      run(g, 0.2);
    }
    for (let i = 0; i < 20; i++) run(g, 0.2);
    return g;
  };
  const plain = make(false);
  const chained = make(true);
  const left = (g: Game) => Array.from({ length: 10 }, (_, k) => g.at(21 + k, 8)).filter((b) => b === GLASS).length;
  check(left(plain) === 9 && left(chained) === 0 && chained.chainCharges === 2, `bomb reach: plain breaks 1 of the row (${10 - left(plain)}), chain breaks all (${10 - left(chained)})`);
}

{
  // Wood refuses a push that would shut the last way out: a one-wide corridor to the exit.
  const g = new Game("normal", 11);
  g.grid.fill(STONE);
  for (let x = 0; x <= g.exit.x; x++) g.grid[g.idx(x, 8)] = EMPTY;
  for (let y = 8; y < g.rows; y++) g.grid[g.idx(g.exit.x, y)] = EMPTY;
  g.player = { x: 2, y: 8 };
  g.grid[g.idx(3, 8)] = WOOD;
  g.move("right");
  run(g, 0.2);
  check(g.player.x === 2 && g.at(3, 8) === WOOD, "a push that would box you in doesn't move the wood");
}

{
  // Under the keys counts as a way round: a stone pillar on the top row doesn't need breaking.
  const g = new Game("normal", 12);
  g.grid.fill(STONE);
  for (let x = 0; x < g.cols; x++) g.grid[g.idx(x, 0)] = EMPTY;
  for (let y = 0; y < g.rows; y++) g.grid[g.idx(g.exit.x, y)] = EMPTY;
  g.grid[g.idx(5, 0)] = STONE;
  g.player = { x: 2, y: 0 };
  check(g.exit.x > 5 && g.openPath(), "the row under the keyboard is part of the way out");
}

// ---------- The Daily Escape ----------

{
  const a = dailyFor(new Date(2026, 9, 1, 8));
  const b = dailyFor(new Date(2026, 9, 1, 23));
  const c = dailyFor(new Date(2026, 9, 2, 8));
  check(a.seed === b.seed && a.number === b.number && c.number === a.number + 1 && c.seed !== a.seed, `one Daily per day (#${a.number} on 1 October 2026, #${c.number} the day after)`);
  const squares = [...timelineSquares(["m", "m", "h", "b", "m", "x", "k", "m", "m", "m", "m", "m"])];
  check(squares.length === 10, "the share text sums a run up in ten squares");
}

// ---------- 1980 mode ----------

{
  const keys = (m: Escape1980, ...ks: Key[]) => {
    for (const k of ks) {
      m.press(k);
      m.update(1 / m.speed);
    }
  };
  const text = (m: Escape1980, row: number, n: number) => String.fromCharCode(...m.screen.slice(row * 64, row * 64 + n));
  const m = new Escape1980(1);
  check(text(m, 0, 6) === "*SCAPE" && m.screen[EXIT - VIDEO] === 43, "the star starts on the E of ESCAPE, the + sits on the bottom row");
  keys(m, ".", ",");
  check(m.p === VIDEO, "from the very first cell you can't step right (the copied check)");
  keys(m, "[");
  const hidden = m.where() === "keyboard";
  keys(m, "[");
  const deeper = m.p === VIDEO - 128;
  keys(m, "[");
  check(hidden && deeper && m.p === VIDEO - 128, "up from the top row walks two rows into the keyboard's memory, then stops");
  keys(m, "\n", "\n");
  check(m.p === VIDEO && m.screen[0] === 42, "and back down onto the screen");

  const wrap = new Escape1980(2);
  wrap.screen.fill(32);
  wrap.p = VIDEO + 64 * 3 + 63;
  keys(wrap, ".");
  check(wrap.p === VIDEO + 64 * 4, "off the right end of a row is the start of the next");

  const crash = new Escape1980(3);
  crash.screen.fill(32);
  crash.p = VIDEO + 64 * 15;
  keys(crash, "\n");
  const crash2 = new Escape1980(4);
  crash2.screen.fill(32);
  crash2.p = VIDEO + 1023;
  keys(crash2, ".");
  check(crash.state === "crashed" && crash2.state === "crashed", "down from the bottom-left corner, or right from the bottom-right, writes past the screen");

  const rain = new Escape1980(5);
  for (let i = 0; i < 20000; i++) rain.update(1 / rain.speed);
  const bottom = Array.from({ length: 63 }, (_, k) => rain.screen[15 * 64 + 1 + k]).filter((c) => c === BLOCK).length;
  check(bottom === 0 && rain.screen[EXIT - VIDEO] === 43 && rain.blocks === 20000, "blocks land everywhere but the bottom row (bar its first cell) and the exit");

  const clear = new Escape1980(6);
  clear.p = VIDEO + 64 * 5 + 5;
  clear.screen[clear.p - VIDEO] = BLOCK;
  keys(clear, "other");
  check(clear.screen[clear.p - VIDEO] === 42, "any key clears a block that landed on you");

  const out = new Escape1980(7);
  out.screen.fill(32);
  out.p = EXIT - 64;
  keys(out, "\n");
  check(out.state === "ended" && text(out, 1, 5) === "READY", "reaching the + ends the program at BASIC's prompt");
}

// ---------- Human-like bots ----------

console.log(`\nHuman-like bots, ${runs} runs per level (0.35 s reaction, ~6 steps a second)`);
const targets: Record<LevelId, [number, number]> = { chill: [0.9, 1], normal: [0.55, 0.85], hard: [0.25, 0.6] };
for (const level of Object.keys(LEVELS) as LevelId[]) {
  let won = 0;
  const times: number[] = [];
  const causes: Record<string, number> = {};
  let hits = 0;
  let bombs = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const g = new Game(level, 1000 + seed);
    const bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed });
    while (g.state === "playing" && g.t < 240) {
      bot.tick(g);
      g.update(1 / 60);
      for (const e of g.drainEvents()) {
        if (e.kind === "hit") causes[e.by] = (causes[e.by] ?? 0) + 1;
        if (e.kind === "bomb") bombs++;
      }
    }
    if (g.state === "won") {
      won++;
      times.push(g.t);
    } else if (g.state === "playing") causes.stuck = (causes.stuck ?? 0) + 1;
    hits += g.hits;
  }
  times.sort((a, b) => a - b);
  const rate = won / runs;
  const median = times.length ? times[Math.floor(times.length / 2)] : NaN;
  console.log(
    `  ${LEVELS[level].name.padEnd(7)} escaped ${(rate * 100).toFixed(0)}% · median ${median.toFixed(1)} s · ${(hits / runs).toFixed(2)} hits/run · ${(bombs / runs).toFixed(1)} bombs/run · hurt by ${JSON.stringify(causes)}`,
  );
  const [lo, hi] = targets[level];
  check(rate >= lo && rate <= hi, `${LEVELS[level].name}: escape rate within ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
}

// ---------- Screens ----------

console.log("\nScreens: ten bots on each (the same bots that picked the seeds)");
check(new Set(SCREENS.map((s) => s.seed)).size === SCREENS.length, `${SCREENS.length} screens, each with its own seed`);
for (const sc of SCREENS) {
  let won = 0;
  let dives = 0;
  let tunnels = 0;
  const times: number[] = [];
  for (let b = 1; b <= 10; b++) {
    const g = new Game(sc.settings, sc.seed);
    const bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed: b });
    while (g.state === "playing" && g.t < 240) {
      bot.tick(g);
      g.update(1 / 60);
    }
    if (g.state === "won") {
      won++;
      times.push(g.t);
    }
    dives += g.dives;
    tunnels += g.tunnels;
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? NaN;
  const trick = sc.computer === "micro" ? dives > 0 : sc.computer === "amber" ? tunnels > 0 : true;
  check(won >= 5 && trick, `${sc.id.padEnd(8)} ${won * 10}% out · median ${median.toFixed(1)} s (par ${sc.settings.par}) · ${dives} dives · ${tunnels} tunnels`);
}

console.log(failures ? `\n${failures} checks failed` : "\nall Outta Here checks passed");
process.exitCode = failures ? 1 : 0;
