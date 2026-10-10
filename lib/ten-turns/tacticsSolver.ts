/*
 * The best play in a Tactics pit against one rabbit, worked out exactly for
 * plain steps: for every turn, every cell you and the rabbit can stand on,
 * whether you still have your hat and whether the rabbit is dazed, the
 * chance of lasting to the ladder. Burrows, carrots, stones and digging are
 * one-off resources; they are judged a turn at a time on top of these values
 * (see tacticsPolicy), so here a burrow is just ground.
 *
 * For speed the hops are re-stated over lookup tables. The checks compare
 * every transition with the engine on random positions, so the two can't
 * drift apart unnoticed.
 */

import { type Cell, DIRECTIONS, directionToward, inCircle, keyOf, same, step } from "./geometry";
import { chainChance, type PitPlan, pitCells, type Temperament } from "./tactics";

export type PitSolution = {
  plan: PitPlan;
  temperament: Temperament;
  cells: Cell[];
  /** Chance of surviving from the start of `turn`, before you act. */
  value(turn: number, player: Cell, rabbit: Cell, hat: boolean, dazed?: boolean): number;
};

const MAX_CHAIN = 9;
/** The order a rabbit tries directions in when it steps round something: straight on, then either side, then wider. */
export const SWERVE = [0, 1, -1, 2, -2];

export type PitTables = ReturnType<typeof pitTables>;

/** Lookups for one pit: open cells, their neighbours, and the steps open from each. */
export function pitTables(plan: PitPlan) {
  const rocks = new Set(plan.rocks.map(keyOf));
  const patches = new Set(plan.patches.map(keyOf));
  const cells = pitCells(plan).filter((c) => !rocks.has(keyOf(c)));
  const index = new Map(cells.map((c, i) => [keyOf(c), i]));
  const N = cells.length;
  const idx = (c: Cell) => index.get(keyOf(c)) ?? -1;
  const neighbour = new Int32Array(N * 8);
  cells.forEach((c, i) => DIRECTIONS.forEach((d, k) => (neighbour[i * 8 + k] = inCircle(step(c, d), plan.radius) ? idx(step(c, d)) : -1)));
  // Your steps: any open neighbour that isn't a carrot patch.
  const stepCount = new Int32Array(N);
  const steps = new Int32Array(N * 8);
  for (let p = 0; p < N; p++) {
    for (let k = 0; k < 8; k++) {
      const n = neighbour[p * 8 + k];
      if (n >= 0 && !patches.has(keyOf(cells[n]))) steps[p * 8 + stepCount[p]++] = n;
    }
  }
  const directions = new Int8Array(N * N).fill(-1);
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const d = directionToward(cells[a], cells[b]);
      if (d) directions[a * N + b] = DIRECTIONS.indexOf(d);
    }
  }
  return { cells, N, idx, neighbour, steps, stepCount, directions };
}

export function solvePit(plan: PitPlan, temperament: Temperament, tables = pitTables(plan)): PitSolution {
  const { cells, N, idx, neighbour, steps, stepCount, directions } = tables;
  const reach = temperament === "stalker" ? 2 : 1;
  const clever = temperament === "clever";

  /**
   * One pounce, as the engine's pounceTarget does it, packed into a number:
   * the landing cell plus one, negative when something stopped it.
   */
  const pounce = (from: number, aim: number, player: number, routing: boolean) => {
    let d = directions[from * N + aim];
    if (d < 0) return from + 1;
    if (routing) {
      for (const turn of SWERVE) {
        const dd = (d + turn + 8) % 8;
        if (neighbour[from * 8 + dd] >= 0) {
          d = dd;
          break;
        }
      }
    }
    let at = from;
    for (let i = 0; i < reach; i++) {
      const next = neighbour[at * 8 + d];
      if (next < 0) return -(at + 1);
      at = next;
      if (at === aim || at === player) break;
    }
    return at + 1;
  };
  // One-cell pounces don't care where the player is: table them for both moods.
  const table = reach === 1 ? [new Int32Array(N * N), new Int32Array(N * N)] : null;
  if (table) {
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        table[0][a * N + b] = pounce(a, b, -1, clever);
        table[1][a * N + b] = pounce(a, b, -1, true);
      }
    }
  }

  /** The clever rabbit's guess at your escape: the open cell next to you furthest from it. */
  const escapeOf = (p: number, r: number) => {
    let best = p;
    let bestGap = -1;
    for (let k = 0; k < 8; k++) {
      const c = neighbour[p * 8 + k];
      if (c < 0) continue;
      const gap = Math.hypot(cells[c].x - cells[r].x, cells[c].y - cells[r].y);
      if (gap > bestGap) {
        bestGap = gap;
        best = c;
      }
    }
    return best;
  };

  const chances = Float64Array.from({ length: MAX_CHAIN + 1 }, (_, k) => (k === 0 ? 0 : chainChance(temperament, k)));
  const at = (p: number, r: number, hat: number, dazed: number) => ((p * N + r) * 2 + hat) * 2 + dazed;
  const size = N * N * 4;
  const values: Float32Array[] = [];
  values[plan.turns + 1] = new Float32Array(size).fill(1);

  for (let t = plan.turns; t >= 1; t--) {
    const next = values[t + 1];
    const now = new Float32Array(size);

    // The rabbit's whole turn after you stepped to `player`, worth this much to you
    // without your hat (worth0) and with it (worth1): both come out of one walk of the chain.
    let worth0 = 0;
    let worth1 = 0;
    const turnValue = (player: number, start: number, dazed: number, lock: number) => {
      let v0 = 0;
      let v1 = 0;
      let mass = 1;
      let pos = start;
      const mood = clever || dazed === 1 ? 1 : 0;
      for (let k = 1; k <= MAX_CHAIN; k++) {
        const aim = k === 1 ? lock : player;
        const packed = table ? table[mood][pos * N + aim] : pounce(pos, aim, player, mood === 1);
        const blocked = packed < 0;
        const to = (blocked ? -packed : packed) - 1;
        const chance = chances[k];
        if (blocked && to === pos) {
          worth0 = v0 + mass * next[at(player, pos, 0, 1)];
          worth1 = v1 + mass * next[at(player, pos, 1, 1)];
          return;
        }
        if (to === player) {
          // Caught: the hat buys another turn, with the rabbit back where it sprang from.
          worth0 = v0;
          worth1 = v1 + mass * next[at(player, pos, 0, 0)];
          return;
        }
        pos = to;
        if (blocked) {
          worth0 = v0 + mass * next[at(player, pos, 0, 1)];
          worth1 = v1 + mass * next[at(player, pos, 1, 1)];
          return;
        }
        const stop = mass * (1 - chance);
        v0 += stop * next[at(player, pos, 0, 0)];
        v1 += stop * next[at(player, pos, 1, 0)];
        mass *= chance;
        if (chance === 0) {
          worth0 = v0;
          worth1 = v1;
          return;
        }
      }
      worth0 = v0 + mass * next[at(player, pos, 0, 0)];
      worth1 = v1 + mass * next[at(player, pos, 1, 0)];
    };

    for (let p = 0; p < N; p++) {
      const count = stepCount[p];
      for (let r = 0; r < N; r++) {
        if (p === r) continue;
        const lock = clever ? escapeOf(p, r) : p;
        // A clever rabbit always steps round things, so being dazed changes nothing for it.
        for (let dazed = 0; dazed < (clever ? 1 : 2); dazed++) {
          let best0 = 0;
          let best1 = 0;
          let any = false;
          for (let i = 0; i < count; i++) {
            const to = steps[p * 8 + i];
            if (to === r) continue;
            any = true;
            turnValue(to, r, dazed, lock);
            if (worth0 > best0) best0 = worth0;
            if (worth1 > best1) best1 = worth1;
          }
          if (!any) {
            turnValue(p, r, dazed, lock);
            best0 = worth0;
            best1 = worth1;
          }
          now[at(p, r, 0, dazed)] = best0;
          now[at(p, r, 1, dazed)] = best1;
          if (clever) {
            now[at(p, r, 0, 1)] = best0;
            now[at(p, r, 1, 1)] = best1;
          }
        }
      }
    }
    values[t] = now;
  }

  return {
    plan,
    temperament,
    cells,
    value(turn, player, rabbit, hat, dazed = false) {
      if (turn > plan.turns) return 1;
      const p = idx(player);
      const r = idx(rabbit);
      if (p < 0 || r < 0 || p === r) return 0;
      return values[turn][at(p, r, hat ? 1 : 0, dazed ? 1 : 0)];
    },
  };
}

/**
 * The best drop for a pit, judged by the solved values: the cell that does
 * best on average over every place each rabbit could be hiding.
 */
export function bestDrop(plan: PitPlan, solutions: PitSolution[], hiding: Cell[][]): { cell: Cell; value: number } {
  const blocked = new Set([...plan.rocks, ...plan.burrows, ...plan.patches].map(keyOf));
  let best = { cell: plan.rabbits[0].start, value: -1 };
  for (const c of solutions[0].cells) {
    if (blocked.has(keyOf(c))) continue;
    let value = 1;
    solutions.forEach((solution, i) => {
      const spots = hiding[i];
      let sum = 0;
      for (const r of spots) sum += same(r, c) ? 1 : solution.value(1, c, r, true);
      value *= sum / spots.length;
    });
    if (value > best.value) best = { cell: c, value };
  }
  return best;
}
