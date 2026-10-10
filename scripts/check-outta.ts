/*
 * Outta Here balance and rule checks.
 *
 *   npx tsx scripts/check-outta.ts [runs per level]
 *
 * Plays every level and every campaign screen with human-like bots (0.35 s
 * reaction, about six steps a second, no peeking) and reports how often they
 * get out, how long it takes and what hurts them. Also checks the rules that
 * must always hold (the Mega bomb's and the Copycat's among them), the Daily
 * Escape, and the 1980 simulation's quirks.
 */
import { HumanBot } from "../lib/outta/bot";
import { SCREENS } from "../lib/outta/campaign";
import { dailyFor, timelineSquares } from "../lib/outta/daily";
import { EMPTY, GLASS, Game, STONE, WOOD, type Block, type Enemy, type Pos } from "../lib/outta/engine";
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

// ---------- Mega bombs ----------

/** An empty screen with nobody on it but you, for setting up one rule at a time. */
const bare = (level: LevelId, seed: number, still = false) => {
  const g = new Game(still ? { ...LEVELS[level], rain: 0, rainHesitant: 0, bonusEvery: 1e9 } : level, seed);
  g.grid.fill(EMPTY);
  g.items = [];
  g.enemies = [];
  return g;
};
/** Can you walk (or bomb your way) to `to`, by the way-out rule's measure? Written apart from the engine on purpose. */
const reachable = (g: Game, to: Pos) => {
  const n = g.cols * g.rows;
  const id = (p: Pos) => (p.y < 0 ? n + p.x : g.idx(p.x, p.y));
  const seen = new Set([id(g.underKeys() ? { x: g.player.x, y: -1 } : g.player)]);
  const queue = [...seen];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (i === id(to)) return true;
    const steps: [number, boolean][] = [];
    if (i >= n) {
      const kx = i - n;
      steps.push([kx, true]);
      if (kx > 0) steps.push([i - 1, false]);
      if (kx < g.cols - 1) steps.push([i + 1, false]);
    } else {
      const x = i % g.cols;
      const y = Math.floor(i / g.cols);
      steps.push([y === 0 ? n + x : i - g.cols, false]);
      if (y < g.rows - 1) steps.push([i + g.cols, false]);
      if (x > 0) steps.push([i - 1, false]);
      else if (y > 0) steps.push([g.idx(g.cols - 1, y - 1), true]);
      if (x < g.cols - 1) steps.push([i + 1, false]);
      else if (y < g.rows - 1) steps.push([g.idx(0, y + 1), true]);
    }
    for (const [j, far] of steps) {
      const b = j < n ? g.grid[j] : EMPTY;
      if (seen.has(j) || b === WOOD || b === STONE || (far && b !== EMPTY)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return false;
};

{
  // A bomb breaks only glass; a Mega bomb breaks every block in the same 3 × 3, and nothing beyond.
  const blast = (mega: boolean) => {
    const g = bare("normal", 13, true);
    g.player = { x: 20, y: 8 };
    const mix: Block[] = [WOOD, GLASS, STONE, WOOD, STONE, GLASS, STONE, WOOD];
    let k = 0;
    for (let y = 7; y <= 9; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 8) g.grid[g.idx(x, y)] = mix[k++];
    g.grid[g.idx(20, 9)] = EMPTY;
    g.grid[g.idx(23, 8)] = STONE;
    if (mega) g.megas = 1;
    const dropped = mega ? g.megaBomb() : g.bomb();
    for (const dir of ["down", "down", "left", "left"] as const) {
      g.move(dir);
      run(g, 0.2);
    }
    run(g, 3);
    return { g, dropped };
  };
  const plain = blast(false);
  const mega = blast(true);
  const count = (g: Game, b: Block) => g.grid.filter((v) => v === b).length;
  check(
    plain.dropped && count(plain.g, WOOD) === 3 && count(plain.g, GLASS) === 0 && count(plain.g, STONE) === 3,
    `a bomb breaks the glass round it and leaves wood and stone (${count(plain.g, WOOD)} wood, ${count(plain.g, STONE)} stone left)`,
  );
  check(
    mega.dropped && count(mega.g, WOOD) === 0 && count(mega.g, GLASS) === 0 && count(mega.g, STONE) === 1 && mega.g.stoneBroken === 2 && mega.g.megas === 0,
    `a Mega bomb breaks wood, glass and stone in its 3 × 3, and nothing beyond (${mega.g.stoneBroken} stone broken, ${count(mega.g, STONE)} left)`,
  );
  check(mega.g.bombsLeft() === mega.g.s.bombsOnScreen && plain.g.broken === 2 && mega.g.broken === 2, "a Mega bomb doesn't use up a regular bomb, and the glass it breaks counts for your score");
}
{
  // Walking onto a Mega bomb carries it; another appears at once somewhere else; with your hands full the next one waits.
  const g = new Game("normal", 21);
  const first = g.items.find((i) => i.kind === "mega")!;
  const fair = reachable(g, first);
  g.grid.fill(EMPTY);
  g.enemies = [];
  g.player = { x: first.x - 1, y: first.y };
  g.move("right");
  run(g, 0.2);
  const second = g.items.find((i) => i.kind === "mega");
  const moved = !!second && (second.x !== first.x || second.y !== first.y);
  g.player = { x: second!.x - 1, y: second!.y };
  g.move("right");
  run(g, 0.2);
  const now = g.items.filter((i) => i.kind === "mega");
  check(fair && g.megas === 1 && moved && now.length === 1 && now[0] === second, "a Mega bomb is carried, another appears elsewhere at once, and with one in hand the next one stays put");
  check(new Game("chill", 22).items.every((i) => i.kind !== "mega"), "Chill has no Mega bombs");
}
{
  // A Mega bomb walled in by the rain moves to where you can reach it.
  const g = bare("normal", 23, true);
  g.player = { x: 2, y: 2 };
  g.items = [{ id: 999, x: 30, y: 8, kind: "mega", until: Infinity }];
  for (const [x, y] of [
    [29, 8],
    [31, 8],
    [30, 7],
  ])
    g.grid[g.idx(x, y)] = STONE;
  g.falling.push({ id: 998, x: 30, y: 9, at: 0, block: STONE });
  run(g, 0.1);
  const now = g.items.find((i) => i.kind === "mega");
  check(!!now && (now.x !== 30 || now.y !== 8) && reachable(g, now), "a Mega bomb sealed in by the rain moves somewhere you can reach");
}

// ---------- The Copycat ----------

/** A still screen (no rain) with only the Copycat on it, awake, at `at`. */
const withCopycat = (at: Pos, you: Pos) => {
  const g = bare("hard", 31, true);
  g.player = you;
  const cat: Enemy = { id: 77, kind: "copycat", x: at.x, y: at.y, home: { ...at }, next: 0, every: g.s.copycat!.step, awayUntil: 0, pausedUntil: 0, reloadAt: 0 };
  g.enemies = [cat];
  return { g, cat };
};
{
  // It pushes wood in its way exactly as you do, after leaning into it for a moment.
  const { g, cat } = withCopycat({ x: 10, y: 8 }, { x: 30, y: 8 });
  g.grid[g.idx(11, 8)] = WOOD;
  let bracedAt = -1;
  let pushedAt = -1;
  for (let i = 0; i < 120 && pushedAt < 0; i++) {
    g.update(1 / 60);
    for (const e of g.drainEvents()) {
      if (e.kind === "copycat" && e.act === "brace") bracedAt = g.t;
      if (e.kind === "copycat" && e.act === "push") pushedAt = g.t;
    }
  }
  check(
    bracedAt >= 0 && pushedAt - bracedAt >= g.s.copycat!.brace - 0.02 && g.at(12, 8) === WOOD && cat.x === 11,
    `the Copycat leans into wood for ${g.s.copycat!.brace} s, then pushes it one cell`,
  );
}
{
  // It won't push wood where the push would shut your last way out, any more than you can: your way out runs
  // down column 3, and the only push that brings it to you would slide the wood into that column.
  const { g } = withCopycat({ x: 6, y: 8 }, { x: 1, y: 8 });
  g.grid.fill(STONE);
  for (let x = 0; x <= 8; x++) g.grid[g.idx(x, 8)] = EMPTY;
  for (let y = 8; y < g.rows; y++) g.grid[g.idx(3, y)] = EMPTY;
  for (let x = Math.min(3, g.exit.x); x <= Math.max(3, g.exit.x); x++) g.grid[g.idx(x, g.rows - 1)] = EMPTY;
  g.grid[g.idx(4, 8)] = WOOD;
  const before = g.openPath();
  let braced = false;
  for (let i = 0; i < 180; i++) {
    g.update(1 / 60);
    if (g.drainEvents().some((e) => e.kind === "copycat")) braced = true;
  }
  check(before && !braced && g.at(4, 8) === WOOD && g.at(3, 8) === EMPTY && g.openPath(), "the Copycat won't even lean into wood whose push would box you in");
}
{
  // It bombs glass in its way after holding the bomb up, by your rules: 3 × 3, glass only, and it gets clear first.
  const { g, cat } = withCopycat({ x: 8, y: 8 }, { x: 20, y: 8 });
  for (let y = 0; y < g.rows; y++) g.grid[g.idx(12, y)] = y >= 7 && y <= 9 ? GLASS : STONE;
  let armedAt = -1;
  let droppedAt = -1;
  let blocks: Block[] | null = null;
  let chain = true;
  let catCaught = false;
  for (let i = 0; i < 60 * 8 && !blocks; i++) {
    g.update(1 / 60);
    for (const e of g.drainEvents()) {
      if (e.kind === "copycat" && e.act === "arm") armedAt = g.t;
      if (e.kind === "bomb" && e.by === "copycat") droppedAt = g.t;
      if (e.kind === "pop" && e.enemy === "copycat") catCaught = true;
      if (e.kind === "boom" && e.by === "copycat") {
        blocks = e.blocks;
        chain = e.chain;
      }
    }
  }
  check(
    armedAt >= 0 && droppedAt - armedAt >= g.s.copycat!.arm - 0.02 && !!blocks && blocks.every((b) => b === GLASS) && !chain && g.at(12, 8) === EMPTY && g.at(12, 6) === STONE && !catCaught && cat.awayUntil <= g.t,
    `the Copycat holds a bomb up for ${g.s.copycat!.arm} s, drops it against glass, breaks only glass and gets clear`,
  );
}
{
  // It bombs you only when you are in its blast, out of its reach, and have room to step clear.
  const armedWithin = (g: Game, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) {
      g.update(1 / 60);
      if (g.drainEvents().some((e) => e.kind === "copycat" && e.act === "arm")) return true;
    }
    return false;
  };
  // You are diagonal to it with glass on both corners between you: in its blast, out of its reach.
  const open = withCopycat({ x: 10, y: 8 }, { x: 11, y: 7 });
  open.g.grid[open.g.idx(11, 8)] = GLASS;
  open.g.grid[open.g.idx(10, 7)] = GLASS;
  // The same, but in a pocket with no free cell to step to (a way out through glass only).
  const boxed = withCopycat({ x: 10, y: 8 }, { x: 11, y: 7 });
  boxed.g.grid.fill(STONE);
  for (const [x, y] of [
    [10, 8],
    [11, 7],
    [10, 9],
  ])
    boxed.g.grid[boxed.g.idx(x, y)] = EMPTY;
  boxed.g.grid[boxed.g.idx(11, 8)] = GLASS;
  boxed.g.grid[boxed.g.idx(10, 7)] = GLASS;
  for (let y = 9; y < boxed.g.rows; y++) boxed.g.grid[boxed.g.idx(11, y)] = GLASS;
  for (let x = 11; x <= boxed.g.exit.x; x++) boxed.g.grid[boxed.g.idx(x, boxed.g.rows - 1)] = GLASS;
  for (let x = boxed.g.exit.x; x < 11; x++) boxed.g.grid[boxed.g.idx(x, boxed.g.rows - 1)] = GLASS;
  check(boxed.g.openPath() && armedWithin(open.g, 0.5) && !armedWithin(boxed.g, 0.5), "the Copycat bombs you behind glass when you can step clear, and never when you can't");
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
// Normal's top was 85% until the Mega bomb, which lifts it by about seven points (see docs/escape/NOTES.md).
const targets: Record<LevelId, [number, number]> = { chill: [0.9, 1], normal: [0.55, 0.9], hard: [0.25, 0.6] };
/** Rules that must hold all through every bot run, counted when they don't. */
const misses = { megaSpot: 0, megaCount: 0, noTell: 0, catBombRules: 0, wayShut: 0 };
for (const level of Object.keys(LEVELS) as LevelId[]) {
  let won = 0;
  const times: number[] = [];
  const causes: Record<string, number> = {};
  let hits = 0;
  let bombs = 0;
  const extra = { megasTaken: 0, megasDropped: 0, stone: 0, catPushes: 0, catBombs: 0, catPopped: 0 };
  for (let seed = 1; seed <= runs; seed++) {
    const g = new Game(level, 1000 + seed);
    const bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed });
    const cat = g.s.copycat;
    let bracedAt = -Infinity;
    let armedAt = -Infinity;
    while (g.state === "playing" && g.t < 240) {
      bot.tick(g);
      g.update(1 / 60);
      for (const e of g.drainEvents()) {
        if (e.kind === "hit") causes[e.by] = (causes[e.by] ?? 0) + 1;
        if (e.kind === "bomb" && e.by === "you") bombs++;
        if (e.kind === "bomb" && e.mega) extra.megasDropped++;
        if (e.kind === "pickup" && e.item === "mega") extra.megasTaken++;
        if (e.kind === "pop" && e.enemy === "copycat") extra.catPopped++;
        if (e.kind === "copycat" && e.act === "brace") bracedAt = g.t;
        if (e.kind === "copycat" && e.act === "arm") armedAt = g.t;
        if (e.kind === "copycat" && e.act === "push") {
          extra.catPushes++;
          if (g.t - bracedAt < cat!.brace - 0.02) misses.noTell++;
          if (!g.openPath()) misses.wayShut++;
        }
        if (e.kind === "bomb" && e.by === "copycat") {
          extra.catBombs++;
          if (g.t - armedAt < cat!.arm - 0.02) misses.noTell++;
        }
        if (e.kind === "boom" && e.by === "copycat" && (e.chain || e.mega || e.blocks.some((b) => b !== GLASS))) misses.catBombRules++;
        if (e.kind === "land" && !g.openPath()) misses.wayShut++;
      }
      // Once a second: as many Mega bombs as the level calls for, each on an empty cell you can reach.
      if (g.s.megaBombs && Math.floor(g.t) !== Math.floor(g.t - 1 / 60)) {
        const megas = g.items.filter((i) => i.kind === "mega");
        if (megas.length !== g.s.megaBombs) misses.megaCount++;
        for (const m of megas) if (g.at(m.x, m.y) !== EMPTY || g.isExit(m.x, m.y) || g.wallRows.includes(m.y) || !reachable(g, m)) misses.megaSpot++;
      }
    }
    extra.stone += g.stoneBroken;
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
  if (LEVELS[level].megaBombs) {
    const per = (n: number) => (n / runs).toFixed(2);
    const copycat = LEVELS[level].copycat ? ` · Copycat ${per(extra.catPushes)} pushes and ${per(extra.catBombs)} bombs a run, caught in a blast ${extra.catPopped} times` : "";
    console.log(`          Mega bombs ${per(extra.megasTaken)} taken and ${per(extra.megasDropped)} dropped a run, ${per(extra.stone)} stone broken a run${copycat}`);
  }
  const [lo, hi] = targets[level];
  check(rate >= lo && rate <= hi, `${LEVELS[level].name}: escape rate within ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
}

check(misses.megaSpot + misses.megaCount === 0, `every second of every run, one Mega bomb waits on an empty cell you can reach (${misses.megaSpot + misses.megaCount} misses)`);
check(misses.noTell + misses.catBombRules === 0, `every Copycat push and bomb was shown first, and its bombs broke only glass (${misses.noTell + misses.catBombRules} misses)`);
check(misses.wayShut === 0, `no landing and no Copycat push ever shut your way out (${misses.wayShut} misses)`);

// ---------- Screens ----------

console.log("\nScreens: ten bots on each (the same bots that picked the seeds)");
check(new Set(SCREENS.map((s) => s.seed)).size === SCREENS.length, `${SCREENS.length} screens, each with its own seed`);
/*
 * Chill and the Screens were balanced (and the Screens' seeds picked) before
 * the Mega bomb and the Copycat, and neither appears in them. This print of
 * 40 Chill runs and the 300 Screens runs below was taken with the engine as it
 * was before them, so a match shows both still play exactly as they did.
 */
const BEFORE_MEGA_AND_COPYCAT = "5d9572d";
let print = 2166136261;
const fold = (g: Game, seed: number, botSeed: number) => {
  const line = `${seed}:${botSeed}:${g.state}:${g.t.toFixed(4)}:${g.steps}:${g.hits}:${g.broken};`;
  for (let i = 0; i < line.length; i++) print = Math.imul(print ^ line.charCodeAt(i), 16777619) >>> 0;
};
for (let seed = 1; seed <= 40; seed++) {
  const g = new Game("chill", 1000 + seed);
  const bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed });
  while (g.state === "playing" && g.t < 240) {
    bot.tick(g);
    g.update(1 / 60);
  }
  fold(g, 1000 + seed, seed);
}
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
    fold(g, sc.seed, b);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? NaN;
  const trick = sc.computer === "micro" ? dives > 0 : sc.computer === "amber" ? tunnels > 0 : true;
  check(won >= 5 && trick, `${sc.id.padEnd(8)} ${won * 10}% out · median ${median.toFixed(1)} s (par ${sc.settings.par}) · ${dives} dives · ${tunnels} tunnels`);
}

check(print.toString(16) === BEFORE_MEGA_AND_COPYCAT, `Chill and the Screens play exactly as before the Mega bomb and the Copycat (print ${print.toString(16)})`);

console.log(failures ? `\n${failures} checks failed` : "\nall Outta Here checks passed");
process.exitCode = failures ? 1 : 0;
