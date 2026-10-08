import { mulberry32 } from "@/lib/kit/rng";
import { LEVELS, type LevelId, type Settings } from "./levels";

/*
 * Outta Here: the game as plain data and rules, with no drawing and no DOM.
 *
 * A star starts in the top-left corner of a 64 × 16 screen and has to reach
 * the exit on the bottom row while blocks rain in. Wood can be pushed, glass
 * can be bombed, stone has to be walked round. Two tricks come from the 1980
 * program's own bugs: walking off the left or right edge comes back in on the
 * row above or below, and walking off the top row hides you under the
 * keyboard (row -1), where nothing can follow.
 *
 * Everything random comes from one seeded generator, so a seed replays the
 * same run for the same inputs (the Daily Escape relies on it).
 */

export const EMPTY = 0;
export const WOOD = 1;
export const GLASS = 2;
export const STONE = 3;
export type Block = typeof EMPTY | typeof WOOD | typeof GLASS | typeof STONE;

export type Dir = "up" | "down" | "left" | "right";
export type Pos = { x: number; y: number };
export type ItemKind = "letter" | "chain3" | "rush";
export type Item = { id: number; x: number; y: number; kind: ItemKind; letter?: string; until: number };
export type Falling = { id: number; x: number; y: number; at: number; block?: Block; item?: ItemKind };
export type Bomb = { id: number; x: number; y: number; at: number; placed: number; chain: boolean };
export type EnemyKind = "bouncer" | "eraser" | "glitch";
export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  home: Pos;
  /** When it moves next, and how often. */
  next: number;
  every: number;
  /** Not yet on the board (the Eraser waits before setting off) or popped by a bomb until this time. */
  awayUntil: number;
  pausedUntil: number;
  /** Bouncer: its lane. */
  axis?: "x" | "y";
  dir?: 1 | -1;
  min?: number;
  max?: number;
  /** Eraser: how far along your trail it has come. */
  trailIndex?: number;
  /** Glitch: where it last saw you. */
  lastSeen?: Pos;
};
export type TrailStep = { x: number; y: number; gap: boolean };
export type GameEvent =
  | { kind: "step" | "push" | "bump" | "dive" | "rise" | "tunnel" | "bomb" | "win" | "lose" }
  | { kind: "land"; x: number; y: number; block: Block }
  | { kind: "shatter"; x: number; y: number }
  | { kind: "boom"; x: number; y: number; broken: number; chain: boolean; cells: number[] }
  | { kind: "pickup"; item: ItemKind; letter?: string }
  | { kind: "bonus"; x: number; y: number; item: ItemKind }
  | { kind: "hit"; by: "rain" | "bomb" | EnemyKind }
  | { kind: "pop"; enemy: EnemyKind };

export const LETTERS = ["E", "S", "C", "A", "P", "E"];
const STEP_GAP = 0.11;
const ITEM_LIFE = 8;
const RUSH_TIME = 30;
const DIRS: Record<Dir, Pos> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export class Game {
  readonly s: Settings;
  readonly seed: number;
  readonly cols: number;
  readonly rows: number;
  readonly grid: Uint8Array;
  readonly exit: Pos;
  /** The rows the starting walls run along. */
  readonly wallRows: number[];
  t = 0;
  player: Pos = { x: 0, y: 0 };
  hearts: number;
  hits = 0;
  invulnerableUntil = 0;
  stunnedUntil = 0;
  lastStepAt = 0;
  steps = 0;
  items: Item[] = [];
  falling: Falling[] = [];
  bombs: Bomb[] = [];
  enemies: Enemy[] = [];
  trail: TrailStep[] = [{ x: 0, y: 0, gap: false }];
  chainCharges = 0;
  rushUntil = 0;
  collected: string[] = [];
  broken = 0;
  bestChain = 0;
  state: "playing" | "won" | "lost" = "playing";
  events: GameEvent[] = [];
  /** One letter per second, for the Daily's share text: m moving, h hesitating, k under the keys, b bomb, x hurt. */
  timeline: string[] = [];
  maxHesitation = 0;
  tunnels = 0;
  dives = 0;
  pops = 0;
  rushes = 0;
  private secondFlags = { hit: false, bomb: false };

  private rng: () => number;
  private nextId = 1;
  private rainClock = 0;
  private nextBonusAt: number;
  private pendingMove: Dir | null = null;
  private lastMoveAt = -1;
  private lastBoardPos: Pos = { x: 0, y: 0 };

  constructor(level: LevelId | Settings, seed: number) {
    this.s = typeof level === "string" ? LEVELS[level] : level;
    this.seed = seed;
    this.cols = this.s.cols;
    this.rows = this.s.rows;
    this.rng = mulberry32(seed);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.hearts = this.s.hearts;
    this.wallRows = Array.from({ length: this.s.floors }, (_, k) => Math.round(((k + 1) * this.rows) / (this.s.floors + 1)));
    // The exit sits on the far side from the last wall's gap, so the last corridor has to be crossed too.
    const lastGapRight = this.s.floors % 2 === 1;
    const span = this.cols * 0.3;
    const ex = lastGapRight ? 4 + this.rng() * span : this.cols - 5 - this.rng() * span;
    // In the finale the way out is the bottom-left corner, where the 1980 program crashed the computer.
    this.exit = this.s.exitMode === "crash" ? { x: 0, y: this.rows - 1 } : { x: Math.floor(ex), y: this.rows - 1 };
    this.nextBonusAt = this.bonusGap();
    this.prefill();
    this.placeLetters();
    this.placeEnemies();
  }

  // ---------- Queries ----------

  idx(x: number, y: number) {
    return y * this.cols + x;
  }

  inBoard(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  at(x: number, y: number): Block {
    return this.inBoard(x, y) ? (this.grid[this.idx(x, y)] as Block) : STONE;
  }

  underKeys() {
    return this.player.y < 0;
  }

  bombAt(x: number, y: number) {
    return this.bombs.find((b) => b.x === x && b.y === y);
  }

  itemAt(x: number, y: number) {
    return this.items.find((i) => i.x === x && i.y === y);
  }

  enemyAt(x: number, y: number) {
    return this.enemies.find((e) => e.awayUntil <= this.t && e.x === x && e.y === y);
  }

  isExit(x: number, y: number) {
    return x === this.exit.x && y === this.exit.y;
  }

  /** 0 while you keep moving, rising to 1 as you stand still. */
  hesitation() {
    const idle = this.t - this.lastStepAt;
    return Math.max(0, Math.min(1, (idle - this.s.hesitateAfter) / (this.s.hesitateFull - this.s.hesitateAfter)));
  }

  rushLeft() {
    return Math.max(0, this.rushUntil - this.t);
  }

  canBomb() {
    return this.state === "playing" && !this.underKeys() && this.bombs.length < this.s.bombsOnScreen && !this.bombAt(this.player.x, this.player.y);
  }

  /** Stars earned: escaped, under par, all six letters. */
  stars() {
    return [this.state === "won", this.state === "won" && this.t <= this.s.par, this.collected.length === LETTERS.length];
  }

  score() {
    if (this.state !== "won") return this.collected.length * 100 + this.broken * 5;
    const time = Math.max(0, Math.round((this.s.par * 2 - this.t) * 20));
    return 1000 + time + this.collected.length * 100 + this.broken * 5 + this.bestChain * 10 - this.hits * 150;
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- Input ----------

  /** Queues one step; it is taken as soon as the star can move again. */
  move(dir: Dir) {
    this.pendingMove = dir;
  }

  bomb() {
    if (!this.canBomb()) return false;
    const rush = this.rushLeft() > 0;
    const chain = rush || this.chainCharges > 0;
    if (!rush && this.chainCharges > 0) this.chainCharges--;
    this.bombs.push({ id: this.nextId++, x: this.player.x, y: this.player.y, at: this.t + this.s.fuse, placed: this.t, chain });
    this.events.push({ kind: "bomb" });
    return true;
  }

  // ---------- The clock ----------

  update(dt: number) {
    if (this.state !== "playing") return;
    const before = Math.floor(this.t);
    this.t += Math.min(dt, 0.1);
    const t = this.t;
    this.maxHesitation = Math.max(this.maxHesitation, this.hesitation());
    if (Math.floor(t) > before) {
      const f = this.secondFlags;
      this.timeline.push(f.hit ? "x" : this.underKeys() ? "k" : f.bomb ? "b" : this.hesitation() > 0.4 ? "h" : "m");
      this.secondFlags = { hit: false, bomb: false };
    }

    if (this.pendingMove && t >= this.stunnedUntil && t - this.lastMoveAt >= STEP_GAP) {
      const dir = this.pendingMove;
      this.pendingMove = null;
      this.step(dir);
      if (this.state !== "playing") return;
    }

    for (const bomb of [...this.bombs].sort((a, b) => a.at - b.at)) {
      if (bomb.at <= t && this.bombs.includes(bomb)) this.explode(bomb);
    }
    if (this.state !== "playing") return;

    for (const f of [...this.falling]) {
      if (f.at <= t) {
        this.falling.splice(this.falling.indexOf(f), 1);
        this.land(f);
      }
    }
    if (this.state !== "playing") return;

    this.rainClock += (this.s.rain + this.s.rainHesitant * this.hesitation()) * Math.min(dt, 0.1);
    while (this.rainClock >= 1) {
      this.rainClock -= 1;
      this.spawnFalling(this.pickBlock());
    }
    if (t >= this.nextBonusAt) {
      this.nextBonusAt = t + this.bonusGap();
      this.spawnFalling(undefined, this.rng() < this.s.rushShare ? "rush" : "chain3");
    }

    for (const enemy of this.enemies) this.enemyTick(enemy);
    this.items = this.items.filter((i) => i.until > t);
  }

  // ---------- Moving ----------

  private step(dir: Dir) {
    const d = DIRS[dir];
    const p = this.player;
    this.lastMoveAt = this.t;

    if (p.y < 0) {
      // Under the keys: walk along the keyboard, or drop back onto the top row.
      if (dir === "left" || dir === "right") {
        const x = p.x + d.x;
        if (x < 0 || x >= this.cols) return this.bump();
        this.player = { x, y: -1 };
        return this.stepped();
      }
      if (dir === "down") {
        if (!this.walkable(p.x, 0)) return this.bump();
        this.player = { x: p.x, y: 0 };
        this.trail.push({ x: p.x, y: 0, gap: true });
        this.events.push({ kind: "rise" });
        return this.arrive();
      }
      return this.bump();
    }

    let x = p.x + d.x;
    let y = p.y + d.y;
    let tunnel = false;
    if (dir === "up" && p.y === 0) {
      this.lastBoardPos = { ...p };
      this.player = { x: p.x, y: -1 };
      this.dives++;
      this.events.push({ kind: "dive" });
      return this.stepped();
    }
    if (x < 0) {
      if (p.y === 0) return this.bump();
      x = this.cols - 1;
      y = p.y - 1;
      tunnel = true;
    } else if (x >= this.cols) {
      if (p.y === this.rows - 1) return this.bump();
      x = 0;
      y = p.y + 1;
      tunnel = true;
    }
    if (!this.inBoard(x, y)) return this.bump();
    if (this.isExit(x, y)) {
      this.player = { x, y };
      this.steps++;
      this.lastStepAt = this.t;
      this.state = "won";
      this.events.push({ kind: "win" });
      return;
    }
    if (this.bombAt(x, y)) return this.bump();
    const block = this.at(x, y);
    if (block === WOOD) {
      if (tunnel || !this.push(x, y, d)) return this.bump();
      this.events.push({ kind: "push" });
    } else if (block !== EMPTY) {
      return this.bump();
    }
    this.player = { x, y };
    this.trail.push({ x, y, gap: false });
    if (tunnel) {
      this.tunnels++;
      this.events.push({ kind: "tunnel" });
    }
    this.arrive();
  }

  private push(x: number, y: number, d: Pos) {
    const bx = x + d.x;
    const by = y + d.y;
    if (!this.inBoard(bx, by) || this.at(bx, by) !== EMPTY || this.isExit(bx, by)) return false;
    if (this.bombAt(bx, by) || this.itemAt(bx, by) || this.enemyAt(bx, by)) return false;
    if (this.s.floorClear && by === this.rows - 1) return false;
    this.grid[this.idx(x, y)] = EMPTY;
    this.grid[this.idx(bx, by)] = WOOD;
    // Wood won't budge if the push would box you in for good (no way out, even with bombs).
    if (!this.openPath({ x, y })) {
      this.grid[this.idx(x, y)] = WOOD;
      this.grid[this.idx(bx, by)] = EMPTY;
      return false;
    }
    return true;
  }

  private walkable(x: number, y: number) {
    return this.inBoard(x, y) && this.at(x, y) === EMPTY && !this.bombAt(x, y);
  }

  private bump() {
    this.events.push({ kind: "bump" });
  }

  private stepped() {
    this.steps++;
    this.lastStepAt = this.t;
    this.events.push({ kind: "step" });
  }

  private arrive() {
    this.stepped();
    const item = this.itemAt(this.player.x, this.player.y);
    if (item) this.pickUp(item);
    const enemy = this.enemyAt(this.player.x, this.player.y);
    if (enemy) this.caught(enemy);
  }

  private pickUp(item: Item) {
    this.items.splice(this.items.indexOf(item), 1);
    if (item.kind === "letter") this.collected.push(item.letter!);
    else if (item.kind === "chain3") this.chainCharges = 3;
    else {
      this.rushUntil = this.t + RUSH_TIME;
      this.rushes++;
    }
    this.events.push({ kind: "pickup", item: item.kind, letter: item.letter });
  }

  // ---------- Getting hurt ----------

  private hit(by: "rain" | "bomb" | EnemyKind) {
    if (this.t < this.invulnerableUntil) return;
    this.hearts -= 1;
    this.hits++;
    this.secondFlags.hit = true;
    this.invulnerableUntil = this.t + 2;
    this.events.push({ kind: "hit", by });
    if (this.hearts <= 0) {
      this.state = "lost";
      this.events.push({ kind: "lose" });
    }
  }

  private caught(enemy: Enemy) {
    if (this.underKeys() || this.t < this.invulnerableUntil) return;
    enemy.pausedUntil = this.t + 1.5;
    // The Eraser is knocked back along your trail, so one catch doesn't turn into three.
    if (enemy.kind === "eraser") {
      const back = Math.max(0, enemy.trailIndex! - 20);
      enemy.trailIndex = back;
      enemy.x = this.trail[back].x;
      enemy.y = this.trail[back].y;
    }
    this.hit(enemy.kind);
  }

  // ---------- Bombs ----------

  private explode(bomb: Bomb) {
    this.bombs.splice(this.bombs.indexOf(bomb), 1);
    let broken = 0;
    const flood: number[] = [];
    const cells: number[] = [];
    for (let y = bomb.y - 1; y <= bomb.y + 1; y++) {
      for (let x = bomb.x - 1; x <= bomb.x + 1; x++) {
        if (!this.inBoard(x, y)) continue;
        if (this.at(x, y) === GLASS) {
          this.grid[this.idx(x, y)] = EMPTY;
          broken++;
          cells.push(this.idx(x, y));
          if (bomb.chain) flood.push(this.idx(x, y));
        }
        const other = this.bombAt(x, y);
        if (other) other.at = Math.min(other.at, this.t);
        const enemy = this.enemyAt(x, y);
        if (enemy) this.pop(enemy);
        if (this.player.x === x && this.player.y === y) this.hit("bomb");
      }
    }
    // A chain runs on through every glass block touching one that broke.
    while (flood.length) {
      const i = flood.pop()!;
      const x = i % this.cols;
      const y = Math.floor(i / this.cols);
      for (const d of Object.values(DIRS)) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (this.inBoard(nx, ny) && this.at(nx, ny) === GLASS) {
          this.grid[this.idx(nx, ny)] = EMPTY;
          broken++;
          cells.push(this.idx(nx, ny));
          flood.push(this.idx(nx, ny));
        }
      }
    }
    this.broken += broken;
    this.secondFlags.bomb = true;
    this.bestChain = Math.max(this.bestChain, bomb.chain ? broken : 0);
    this.events.push({ kind: "boom", x: bomb.x, y: bomb.y, broken, chain: bomb.chain, cells });
  }

  private pop(enemy: Enemy) {
    enemy.awayUntil = this.t + 6;
    this.pops++;
    enemy.x = enemy.home.x;
    enemy.y = enemy.home.y;
    if (enemy.kind === "eraser") enemy.trailIndex = -1;
    this.events.push({ kind: "pop", enemy: enemy.kind });
  }

  // ---------- The rain ----------

  private pickBlock(): Block {
    const { wood, glass } = this.s.mix;
    const r = this.rng();
    return r < wood ? WOOD : r < wood + glass ? GLASS : STONE;
  }

  private bonusGap() {
    return this.s.bonusEvery * (0.6 + this.rng() * 0.8);
  }

  private spawnFalling(block?: Block, item?: ItemKind) {
    const trapOk = this.t - this.lastStepAt >= this.s.trapAfter;
    for (let tries = 0; tries < 40; tries++) {
      const x = Math.floor(this.rng() * this.cols);
      const y0 = Math.floor(this.rng() * this.rows);
      if (!this.freeForRain(x, y0)) continue;
      // Sand: the block falls down its column until something stops it (through a gap, too).
      let y = y0;
      if (this.s.rainStyle === "sand") {
        while (y + 1 < this.rows && this.freeForRain(x, y + 1)) y++;
      }
      // Nothing lands next to you until you have stood still too long; on Hard a block can land on you.
      const onYou = !this.underKeys() && x === this.player.x && y === this.player.y;
      const near = !this.underKeys() && Math.abs(x - this.player.x) <= 1 && Math.abs(y - this.player.y) <= 1;
      if (onYou ? !(this.s.rainHits && block !== undefined) : near && !trapOk) continue;
      this.falling.push({ id: this.nextId++, x, y, at: this.t + this.s.warning, block, item });
      return;
    }
  }

  private freeForRain(x: number, y: number) {
    if (this.s.floorClear && y === this.rows - 1) return false;
    if (this.at(x, y) !== EMPTY || this.isExit(x, y)) return false;
    if (Math.abs(x - this.exit.x) <= 1 && y >= this.exit.y - 1 && this.t < 3) return false;
    if (this.bombAt(x, y) || this.itemAt(x, y) || this.enemyAt(x, y)) return false;
    return !this.falling.some((f) => f.x === x && f.y === y);
  }

  private land(f: Falling) {
    const { x, y } = f;
    if (this.at(x, y) !== EMPTY || this.bombAt(x, y) || this.itemAt(x, y) || this.enemyAt(x, y) || this.isExit(x, y)) return;
    if (this.player.x === x && this.player.y === y) {
      if (f.block !== undefined && this.s.rainHits) this.hit("rain");
      return;
    }
    if (f.item) {
      this.items.push({ id: this.nextId++, x, y, kind: f.item, until: this.t + ITEM_LIFE });
      this.events.push({ kind: "bonus", x, y, item: f.item });
      return;
    }
    let block = f.block!;
    this.grid[this.idx(x, y)] = block;
    // Nothing cuts the last way to the exit that bombs could open: wood or stone there lands as glass,
    // and if even glass would seal it (beyond a tunnel, say) the block shatters as it lands.
    if (!this.openPath()) {
      block = GLASS;
      this.grid[this.idx(x, y)] = GLASS;
      if (!this.openPath()) {
        this.grid[this.idx(x, y)] = EMPTY;
        this.events.push({ kind: "shatter", x, y });
        return;
      }
    }
    this.events.push({ kind: "land", x, y, block });
  }

  /**
   * Is there a way to the exit through empty cells and glass (which a bomb can
   * open)? The edge tunnels count, and so does the row under the keyboard
   * (cells n to n + cols - 1), but only into empty cells: glass on the far
   * side of a tunnel, or under the keys, is out of a bomb's reach.
   */
  openPath(from: Pos = this.underKeys() ? { x: this.player.x, y: -1 } : this.player) {
    const n = this.cols * this.rows;
    const seen = new Uint8Array(n + this.cols);
    const start = from.y < 0 ? n + from.x : this.idx(from.x, from.y);
    const queue = [start];
    seen[start] = 1;
    const target = this.idx(this.exit.x, this.exit.y);
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (i === target) return true;
      for (const [j, far] of this.links(i)) {
        if (seen[j]) continue;
        const b = j < n ? this.grid[j] : EMPTY;
        if (b === WOOD || b === STONE || (far && b !== EMPTY)) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    return false;
  }

  /**
   * Where one step can take you from cell i: the four sides, the edge tunnels
   * and the keyboard above the top row (cells n and up). `far` marks a step a
   * bomb can't clear the way for (through a tunnel, or down from the keys).
   */
  private links(i: number): [number, boolean][] {
    const n = this.cols * this.rows;
    const out: [number, boolean][] = [];
    if (i >= n) {
      const kx = i - n;
      out.push([kx, true]);
      if (kx > 0) out.push([i - 1, false]);
      if (kx < this.cols - 1) out.push([i + 1, false]);
      return out;
    }
    const x = i % this.cols;
    const y = Math.floor(i / this.cols);
    out.push(y === 0 ? [n + x, false] : [i - this.cols, false]);
    if (y < this.rows - 1) out.push([i + this.cols, false]);
    if (x > 0) out.push([i - 1, false]);
    else if (y > 0) out.push([this.idx(this.cols - 1, y - 1), true]);
    if (x < this.cols - 1) out.push([i + 1, false]);
    else if (y < this.rows - 1) out.push([this.idx(0, y + 1), true]);
    return out;
  }

  // ---------- Setting up ----------

  private prefill() {
    const protectedCell = (x: number, y: number) => (x <= 2 && y <= 2) || (Math.abs(x - this.exit.x) <= 1 && y >= this.exit.y - 1);
    this.wallRows.forEach((wy, k) => {
      for (let x = 0; x < this.cols; x++) this.grid[this.idx(x, wy)] = STONE;
      // Gaps alternate between the right third and the left third. Not the very ends: the edge
      // tunnels join the far right of one row to the far left of the next, which would make the
      // zigzag a few steps long.
      const right = k % 2 === 0;
      for (let g = 0; g < this.s.gaps; g++) {
        const third = Math.floor(this.cols / 3);
        const thirds = right ? 2 * third + Math.floor(this.rng() * (third / 2)) : Math.floor(third / 2) + Math.floor(this.rng() * (third / 2));
        const ends = right ? this.cols - 3 - Math.floor(this.rng() * 2) : 1 + Math.floor(this.rng() * 2);
        const gx = g === 0 ? (this.s.gapStyle === "ends" ? ends : thirds) : 8 + Math.floor(this.rng() * (this.cols - 16));
        this.grid[this.idx(gx, wy)] = EMPTY;
        this.grid[this.idx(gx + 1, wy)] = EMPTY;
      }
    });
    for (let y = 0; y < this.rows; y++) {
      if (this.wallRows.includes(y)) continue;
      for (let x = 0; x < this.cols; x++) {
        if (protectedCell(x, y) || (this.s.floorClear && y === this.rows - 1)) continue;
        if (this.rng() < this.s.prefill) this.grid[this.idx(x, y)] = STONE;
      }
    }
    // Pillars across the top corridor: the way past them is under the keyboard. The corridor's right
    // edge is stone too, or the tunnel off its left edge would be a way round them.
    const firstWall = this.wallRows[0] ?? this.rows;
    const pillars = this.s.pillars ?? 0;
    for (let k = 0; k < pillars; k++) {
      const px = 6 + Math.floor(((k + 0.5 + (this.rng() - 0.5) * 0.6) * (this.cols * 0.6)) / pillars);
      for (let y = 0; y < firstWall; y++) this.grid[this.idx(px, y)] = STONE;
    }
    if (pillars) for (let y = 0; y < firstWall - 1; y++) this.grid[this.idx(this.cols - 1, y)] = STONE;
    // Make sure a way exists: the cheapest route (walls count as one) has its walls turned into glass.
    // The keyboard row and the tunnels are part of the route, as they are for you.
    const n = this.cols * this.rows;
    const cost = new Int32Array(n + this.cols).fill(1e9);
    const prev = new Int32Array(n + this.cols).fill(-1);
    const start = this.idx(0, 0);
    const deque = [start];
    cost[start] = 0;
    while (deque.length) {
      const i = deque.shift()!;
      for (const [j, far] of this.links(i)) {
        const solid = j < n && (this.grid[j] === WOOD || this.grid[j] === STONE);
        if (far && solid) continue;
        const w = solid ? 1 : 0;
        if (cost[i] + w < cost[j]) {
          cost[j] = cost[i] + w;
          prev[j] = i;
          if (w) deque.push(j);
          else deque.unshift(j);
        }
      }
    }
    for (let i = this.idx(this.exit.x, this.exit.y); i !== -1; i = prev[i]) {
      if (i < n && (this.grid[i] === WOOD || this.grid[i] === STONE)) this.grid[i] = GLASS;
    }
  }

  private placeLetters() {
    const bands = LETTERS.length;
    const span = (this.cols - 8) / bands;
    LETTERS.forEach((letter, k) => {
      for (let tries = 0; tries < 200; tries++) {
        const x = Math.floor(8 + k * span + this.rng() * span);
        const y = 1 + Math.floor(this.rng() * (this.rows - 2));
        if (this.wallRows.includes(y) || this.at(x, y) !== EMPTY || this.isExit(x, y) || this.itemAt(x, y)) continue;
        this.items.push({ id: this.nextId++, x, y, kind: "letter", letter, until: Infinity });
        return;
      }
    });
  }

  private placeEnemies() {
    for (let k = 0; k < this.s.bouncers; k++) {
      for (let tries = 0; tries < 400; tries++) {
        const x = Math.floor(this.rng() * this.cols);
        const y = Math.floor(this.rng() * (this.rows - 1));
        if (x + y < 14 || this.wallRows.includes(y) || this.at(x, y) !== EMPTY || this.itemAt(x, y) || this.enemyAt(x, y)) continue;
        const axis: "x" | "y" = this.rng() < 0.85 ? "x" : "y";
        const run = (dir: 1 | -1) => {
          let n = 0;
          for (let s = 1; s <= 5; s++) {
            const cx = axis === "x" ? x + s * dir : x;
            const cy = axis === "y" ? y + s * dir : y;
            if (!this.inBoard(cx, cy) || this.at(cx, cy) !== EMPTY) break;
            n = s;
          }
          return n;
        };
        const back = run(-1);
        const ahead = run(1);
        if (back + ahead < 4) continue;
        const c = axis === "x" ? x : y;
        this.enemies.push({
          id: this.nextId++,
          kind: "bouncer",
          x,
          y,
          home: { x, y },
          next: 0,
          every: this.s.bouncerStep,
          awayUntil: 0,
          pausedUntil: 0,
          axis,
          dir: 1,
          min: c - back,
          max: c + ahead,
        });
        break;
      }
    }
    if (this.s.eraser) {
      // The Eraser comes out of the middle of the screen, well away from you, and makes for your trail.
      const mid = Math.floor(this.wallRows.length / 2);
      const top = (this.wallRows[mid - 1] ?? -1) + 1;
      const bottom = (this.wallRows[mid] ?? this.rows) - 1;
      let home = { x: Math.floor(this.cols / 2), y: top };
      for (let tries = 0; tries < 400; tries++) {
        const x = Math.floor(this.rng() * this.cols);
        const y = top + Math.floor(this.rng() * (bottom - top + 1));
        if (x + y >= 25 && this.at(x, y) === EMPTY && !this.itemAt(x, y) && !this.enemyAt(x, y)) {
          home = { x, y };
          break;
        }
      }
      this.grid[this.idx(home.x, home.y)] = EMPTY;
      this.enemies.push({
        id: this.nextId++,
        kind: "eraser",
        x: home.x,
        y: home.y,
        home,
        next: this.s.eraser.delay,
        every: this.s.eraser.step,
        awayUntil: this.s.eraser.delay,
        pausedUntil: 0,
        trailIndex: -1,
      });
    }
    if (this.s.glitch) {
      let home = { x: this.cols - 1, y: 0 };
      for (let x = this.cols - 1; x > this.cols / 2; x--) {
        if (this.at(x, 0) === EMPTY) {
          home = { x, y: 0 };
          break;
        }
      }
      this.grid[this.idx(home.x, home.y)] = EMPTY;
      this.enemies.push({
        id: this.nextId++,
        kind: "glitch",
        x: home.x,
        y: home.y,
        home,
        next: this.s.glitch.delay,
        every: this.s.glitch.step,
        awayUntil: this.s.glitch.delay,
        pausedUntil: 0,
      });
    }
  }

  // ---------- Chasers ----------

  private enemyFree(x: number, y: number, self: Enemy) {
    if (!this.inBoard(x, y) || this.at(x, y) !== EMPTY || this.isExit(x, y) || this.bombAt(x, y)) return false;
    return !this.enemies.some((e) => e !== self && e.awayUntil <= this.t && e.x === x && e.y === y);
  }

  private enemyTick(e: Enemy) {
    if (e.awayUntil > this.t) return;
    if (e.next > this.t) return;
    e.next = Math.max(e.next + e.every, this.t);
    if (e.pausedUntil > this.t) return;
    if (e.kind === "bouncer") this.bounce(e);
    else if (e.kind === "eraser") this.erase(e);
    else this.hunt(e);
    if (!this.underKeys() && e.x === this.player.x && e.y === this.player.y) this.caught(e);
  }

  private bounce(e: Enemy) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const c = (e.axis === "x" ? e.x : e.y) + e.dir!;
      const x = e.axis === "x" ? c : e.x;
      const y = e.axis === "y" ? c : e.y;
      const playerThere = !this.underKeys() && this.player.x === x && this.player.y === y;
      if (c >= e.min! && c <= e.max! && (this.enemyFree(x, y, e) || playerThere)) {
        e.x = x;
        e.y = y;
        return;
      }
      e.dir = e.dir === 1 ? -1 : 1;
    }
  }

  private erase(e: Enemy) {
    const i = e.trailIndex!;
    const next = this.trail[i + 1];
    if (!next) return;
    // Not on the trail yet (just arrived, or back from a bomb): head for the nearest point of it.
    if (i < 0) {
      const onTrail = new Map<number, number>();
      this.trail.forEach((p, k) => onTrail.set(this.idx(p.x, p.y), k));
      const stepTo = this.pathStep(e, (j) => onTrail.has(j)) ?? this.closer(e, this.player);
      if (stepTo) {
        e.x = stepTo.x;
        e.y = stepTo.y;
        const k = onTrail.get(this.idx(e.x, e.y));
        if (k !== undefined) e.trailIndex = k;
      }
      return;
    }
    const onPlayer = !this.underKeys() && next.x === this.player.x && next.y === this.player.y;
    const adjacent = Math.abs(next.x - e.x) + Math.abs(next.y - e.y) === 1 || (Math.abs(next.y - e.y) === 1 && Math.abs(next.x - e.x) === this.cols - 1);
    if (!next.gap && adjacent && (this.enemyFree(next.x, next.y, e) || onPlayer)) {
      e.x = next.x;
      e.y = next.y;
      e.trailIndex = i + 1;
      return;
    }
    // The trail is blocked or broken (a block landed on it, or you hid under the keys): find it again further on.
    const later = new Map<number, number>();
    for (let k = this.trail.length - 1; k > i; k--) later.set(this.idx(this.trail[k].x, this.trail[k].y), k);
    const stepTo = this.pathStep(e, (j) => later.has(j));
    if (stepTo) {
      e.x = stepTo.x;
      e.y = stepTo.y;
      const k = later.get(this.idx(e.x, e.y));
      if (k !== undefined) e.trailIndex = k;
    }
  }

  private hunt(e: Enemy) {
    if (!this.underKeys()) e.lastSeen = { ...this.player };
    const goal = e.lastSeen;
    if (!goal) return;
    const target = this.idx(goal.x, goal.y);
    // The shortest way if there is one; otherwise it still edges closer instead of waiting.
    const stepTo = this.pathStep(e, (j) => j === target) ?? this.closer(e, goal);
    if (stepTo) {
      e.x = stepTo.x;
      e.y = stepTo.y;
    }
  }

  /** A free neighbouring cell nearer to `goal` (or any free one, so a chaser never just stands there). */
  private closer(e: Enemy, goal: Pos): Pos | null {
    const options: { p: Pos; d: number }[] = [];
    for (const d of Object.values(DIRS)) {
      const x = e.x + d.x;
      const y = e.y + d.y;
      const playerThere = !this.underKeys() && this.player.x === x && this.player.y === y;
      if (this.enemyFree(x, y, e) || playerThere) options.push({ p: { x, y }, d: Math.abs(x - goal.x) + Math.abs(y - goal.y) });
    }
    if (!options.length) return null;
    const here = Math.abs(e.x - goal.x) + Math.abs(e.y - goal.y);
    const better = options.filter((o) => o.d < here).sort((a, b) => a.d - b.d);
    if (better.length) return better[0].p;
    return options[Math.floor(this.rng() * options.length)].p;
  }

  /** The first step of the shortest walk (no tunnels, nothing solid) towards any cell that `goal` accepts. */
  private pathStep(e: Enemy, goal: (i: number) => boolean): Pos | null {
    const start = this.idx(e.x, e.y);
    const prev = new Int32Array(this.cols * this.rows).fill(-2);
    prev[start] = -1;
    const queue = [start];
    const playerIdx = this.underKeys() ? -1 : this.idx(this.player.x, this.player.y);
    while (queue.length) {
      const i = queue.shift()!;
      if (i !== start && goal(i)) {
        let j = i;
        while (prev[j] !== start) j = prev[j];
        return { x: j % this.cols, y: Math.floor(j / this.cols) };
      }
      const x = i % this.cols;
      const y = Math.floor(i / this.cols);
      for (const d of Object.values(DIRS)) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (!this.inBoard(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (prev[j] !== -2) continue;
        if (j !== playerIdx && !this.enemyFree(nx, ny, e)) continue;
        prev[j] = i;
        queue.push(j);
      }
    }
    return null;
  }
}
