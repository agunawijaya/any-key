import { EMPTY, GLASS, inBlast, MEGA_CARRY, MinHeap, STONE, WOOD, type Dir, type Game, type Pos } from "./engine";

/*
 * A player that behaves like a person, for balancing and tests. It sees the
 * world 0.35 s late (reaction time), takes about six steps a second, plans the
 * cheapest walk to the exit (bombing glass, pushing wood, keeping away from
 * chasers and from bombs) and replans as it goes. It picks up a Mega bomb
 * that is only a short detour away and spends it on stone in its way. It
 * never peeks at anything the screen doesn't show.
 */

type Snap = {
  t: number;
  grid: Uint8Array;
  enemies: Pos[];
  falling: Pos[];
  /** The Copycat's bombs, and a Copycat holding one up (its warning that a bomb is coming). */
  theirBombs: Pos[];
  arming: Pos[];
  megas: Pos[];
};

const MOVES: { dir: Dir; dx: number; dy: number }[] = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

/** Breaking through stone costs about as much as bombing glass: drop it, back off, wait, come back. */
const STONE_COST = 8;
/** A Mega bomb this cheap to reach is worth the detour. */
const MEGA_DETOUR = 14;

export type BotStyle = { reaction: number; stepEvery: number; seed: number };

export class HumanBot {
  private history: Snap[] = [];
  private nextStepAt = 0;
  private lastDir: Dir | null = null;
  private lastTry: { x: number; y: number; dir: Dir; t: number } | null = null;
  /** Moves that bumped, remembered for a few seconds: "that didn't work, try something else". */
  private blocked = new Map<string, number>();
  private rnd: () => number;

  constructor(private style: BotStyle = { reaction: 0.35, stepEvery: 0.16, seed: 1 }) {
    let s = style.seed * 7919 + 13;
    this.rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }

  tick(g: Game) {
    this.history.push({
      t: g.t,
      grid: g.grid.slice(),
      enemies: g.enemies.filter((e) => e.awayUntil <= g.t).map((e) => ({ x: e.x, y: e.y })),
      falling: g.falling.map((f) => ({ x: f.x, y: f.y })),
      theirBombs: g.bombs.filter((b) => b.owner !== "you").map((b) => ({ x: b.x, y: b.y })),
      arming: g.enemies.filter((e) => e.awayUntil <= g.t && e.intent?.kind === "bomb").map((e) => ({ x: e.x, y: e.y })),
      megas: g.items.filter((i) => i.kind === "mega").map((i) => ({ x: i.x, y: i.y })),
    });
    while (this.history.length > 2 && this.history[1].t <= g.t - this.style.reaction) this.history.shift();
    if (g.t < this.nextStepAt || g.state !== "playing") return;
    this.nextStepAt = g.t + this.style.stepEvery * (0.85 + this.rnd() * 0.35);
    this.decide(g, this.history[0]);
  }

  private decide(g: Game, seen: Snap) {
    if (g.underKeys()) {
      // Under the keyboard: walk along it to where the plan comes back up.
      const plan = this.plan(g, seen, g.player, () => false);
      g.move(plan?.dir ?? "down");
      return;
    }
    const me = g.player;

    // Get out of the way of bombs first: our own, which we know about at once, and the Copycat's, once seen.
    const blast = (x: number, y: number) =>
      g.bombs.some((b) => b.owner === "you" && inBlast(b, { x, y })) || [...seen.theirBombs, ...seen.arming].some((b) => inBlast(b, { x, y }));
    if (blast(me.x, me.y)) {
      const out = this.escapeRoute(g, seen, me, blast);
      if (out) g.move(out);
      return;
    }

    if (this.lastTry && this.lastTry.x === me.x && this.lastTry.y === me.y && g.t - this.lastTry.t < 1) {
      this.blocked.set(`${me.x},${me.y},${this.lastTry.dir}`, g.t + 6);
    }
    const plan = this.planOrDetour(g, seen, me, blast);
    if (!plan) return;
    const next = plan.first;
    const block = next.y < 0 ? EMPTY : seen.grid[g.idx(next.x, next.y)];
    const beside = Math.abs(next.x - me.x) + Math.abs(next.y - me.y) === 1;
    if (block === GLASS && beside) {
      if (g.canBomb()) g.bomb();
      return;
    }
    if (block === STONE && beside) {
      if (g.canMegaBomb()) g.megaBomb();
      return;
    }
    if (next.y >= 0 && blast(next.x, next.y)) return;
    // People slow down to turn: a short think whenever the way changes direction.
    if (this.lastDir && plan.dir !== this.lastDir) this.nextStepAt += 0.12 + this.rnd() * 0.25;
    this.lastDir = plan.dir;
    this.lastTry = { x: me.x, y: me.y, dir: plan.dir, t: g.t };
    g.move(plan.dir);
  }

  /** The way to the exit, unless a Mega bomb is close enough to be worth fetching first. */
  private planOrDetour(g: Game, seen: Snap, me: Pos, blast: (x: number, y: number) => boolean) {
    if (g.megas < MEGA_CARRY && seen.megas.length) {
      const fetch = this.plan(g, seen, me, blast, seen.megas[0]);
      if (fetch && fetch.cost <= MEGA_DETOUR) return fetch;
    }
    return this.plan(g, seen, me, blast);
  }

  /**
   * Cheapest walk to the exit (or to `goal`) on what we saw, with the first
   * step. The row under the keyboard counts too (cells n to n + cols - 1): a
   * person who has learnt the trick uses it to get past stone on the top row.
   */
  private plan(g: Game, seen: Snap, me: Pos, blast: (x: number, y: number) => boolean, goal: Pos = g.exit) {
    const { cols, rows } = g;
    const n = cols * rows;
    const cost = new Float64Array(n + cols).fill(Infinity);
    const first = new Int32Array(n + cols).fill(-1);
    const firstDir: Dir[] = new Array(n + cols);
    const danger = new Float64Array(n);
    for (const e of seen.enemies) {
      for (let y = e.y - 2; y <= e.y + 2; y++) {
        for (let x = e.x - 2; x <= e.x + 2; x++) {
          if (!g.inBoard(x, y)) continue;
          const d = Math.abs(x - e.x) + Math.abs(y - e.y);
          if (d <= 2) danger[g.idx(x, y)] += d === 0 ? 60 : d === 1 ? 30 : 8;
        }
      }
    }
    for (const f of seen.falling) danger[g.idx(f.x, f.y)] += 4;
    const breakStone = g.megas > 0;
    const heap = new MinHeap();
    const start = me.y < 0 ? n + me.x : g.idx(me.x, me.y);
    cost[start] = 0;
    heap.push(0, start);
    const target = g.idx(goal.x, goal.y);
    const relax = (i: number, j: number, w: number, dir: Dir) => {
      const nc = cost[i] + w;
      if (nc < cost[j]) {
        cost[j] = nc;
        first[j] = i === start ? j : first[i];
        firstDir[j] = i === start ? dir : firstDir[i];
        heap.push(nc, j);
      }
    };
    while (heap.size) {
      const [c, i] = heap.pop();
      if (c > cost[i]) continue;
      if (i === target) break;
      if (i >= n) {
        // Under the keys: along the keyboard, or back down onto an empty top-row cell.
        const kx = i - n;
        if (kx > 0) relax(i, i - 1, 1, "left");
        if (kx < cols - 1) relax(i, i + 1, 1, "right");
        if (seen.grid[kx] === EMPTY && !g.bombAt(kx, 0)) relax(i, kx, 1 + danger[kx], "down");
        continue;
      }
      const x = i % cols;
      const y = Math.floor(i / cols);
      for (const m of MOVES) {
        if ((this.blocked.get(`${x},${y},${m.dir}`) ?? 0) > g.t) continue;
        if (y === 0 && m.dir === "up") {
          relax(i, n + x, 1, "up");
          continue;
        }
        let nx = x + m.dx;
        let ny = y + m.dy;
        let tunnel = false;
        if (nx < 0 && y > 0) {
          nx = cols - 1;
          ny = y - 1;
          tunnel = true;
        } else if (nx >= cols && y < rows - 1) {
          nx = 0;
          ny = y + 1;
          tunnel = true;
        }
        if (!g.inBoard(nx, ny)) continue;
        const j = g.idx(nx, ny);
        const b = seen.grid[j];
        let w = 1;
        if (j === target) w = 1;
        else if (g.bombAt(nx, ny)) continue;
        else if (b === STONE) {
          if (!breakStone || tunnel) continue;
          w = STONE_COST;
        } else if (b === GLASS) w = 7;
        else if (b === WOOD) {
          const bx = nx + m.dx;
          const by = ny + m.dy;
          if (tunnel || !g.inBoard(bx, by) || seen.grid[g.idx(bx, by)] !== EMPTY || g.isExit(bx, by)) continue;
          if (g.s.floorClear && by === rows - 1) continue;
          w = 3;
        }
        relax(i, j, w + danger[j] + (blast(nx, ny) ? 25 : 0), m.dir);
      }
    }
    if (!Number.isFinite(cost[target])) return null;
    const f = first[target];
    if (f < 0) return null;
    return { first: f >= n ? { x: f - n, y: -1 } : { x: f % cols, y: Math.floor(f / cols) }, dir: firstDir[target], cost: cost[target] };
  }

  /** The first step towards the nearest cell out of every blast, avoiding chasers. */
  private escapeRoute(g: Game, seen: Snap, me: Pos, blast: (x: number, y: number) => boolean): Dir | null {
    const { cols } = g;
    const prev = new Map<number, { from: number; dir: Dir }>();
    const start = g.idx(me.x, me.y);
    const queue = [start];
    prev.set(start, { from: -1, dir: "up" });
    const enemyNear = (x: number, y: number) => seen.enemies.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
    while (queue.length) {
      const i = queue.shift()!;
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (i !== start && !blast(x, y) && !enemyNear(x, y)) {
        let j = i;
        while (prev.get(j)!.from !== start) j = prev.get(j)!.from;
        return prev.get(j)!.dir;
      }
      for (const m of MOVES) {
        const nx = x + m.dx;
        const ny = y + m.dy;
        if (!g.inBoard(nx, ny)) continue;
        const j = g.idx(nx, ny);
        if (prev.has(j) || g.grid[j] !== EMPTY || g.bombAt(nx, ny) || g.isExit(nx, ny)) continue;
        prev.set(j, { from: i, dir: m.dir });
        queue.push(j);
      }
    }
    // Nowhere to run on the board: hide under the keys if we're on the top row.
    return me.y === 0 ? "up" : null;
  }
}
