/*
 * The best a player can do against a chain-pouncing rabbit, worked out
 * exactly. For every turn, every cell the player might stand on and every
 * cell the rabbit might stand on, the solver knows the chance of lasting
 * to the end with the best possible play from there. It works backwards
 * from the last turn, where surviving means being released.
 *
 * The rabbit's chain is the only luck: after its k-th pounce in a turn it
 * goes again with a chance of 1 in k + 1. Rule sets plug in through a `Model`.
 */

import { type Cell, keyOf, same } from "./geometry";

export type Model = {
  /** Every cell the player can stand on before a move. */
  players: Cell[];
  /** Every cell the rabbit can stand on; closed under `pounce`. */
  rabbits: Cell[];
  turns: number;
  /**
   * Where each available move takes the player, wherever the rabbit is. A move onto
   * the rabbit's cell counts as caught, which is never better than any other move,
   * so a rule set that forbids it gets the same best play.
   */
  moves(player: Cell): Cell[];
  /** One pounce towards the player. */
  pounce(rabbit: Cell, player: Cell): Cell;
  /** False when a landing in this turn goes unnoticed (the 1970s last-turn loophole). */
  landingCatches(turn: number): boolean;
  /** Pounces past this many in one turn are ignored: their chance is under 1 in 39 million. */
  maxChain?: number;
};

export type Solution = {
  /** The chance of surviving from the start of `turn` (1-based), before the player moves. */
  value(turn: number, player: Cell, rabbit: Cell): number;
  /** The index into `model.moves(player)` of a best move. */
  bestMove(turn: number, player: Cell, rabbit: Cell): number;
  /** The chance of surviving one rabbit turn and the rest, after the player has stepped to `player`. */
  afterMove(turn: number, player: Cell, rabbit: Cell): number;
};

export function solve(model: Model): Solution {
  const playerIndex = new Map(model.players.map((c, i) => [keyOf(c), i]));
  const rabbitIndex = new Map(model.rabbits.map((c, i) => [keyOf(c), i]));
  const P = model.players.length;
  const R = model.rabbits.length;
  const maxChain = model.maxChain ?? 11;

  // Each pounce, looked up once: rabbit cell x player cell -> rabbit cell.
  const pounceTable = new Int32Array(R * P);
  for (let r = 0; r < R; r++) {
    for (let p = 0; p < P; p++) {
      const to = model.pounce(model.rabbits[r], model.players[p]);
      const index = rabbitIndex.get(keyOf(to));
      if (index === undefined) throw new Error(`The rabbit can reach ${keyOf(to)}, which the model doesn't list`);
      pounceTable[r * P + p] = index;
    }
  }
  const moveTable = model.players.map((player) => Int32Array.from(model.moves(player), (to) => playerIndex.get(keyOf(to)) ?? missing(to)));
  const rabbitOn = new Int32Array(P).fill(-1);
  model.players.forEach((c, p) => {
    rabbitOn[p] = rabbitIndex.get(keyOf(c)) ?? -1;
  });

  // values[t][p * R + r]: surviving from the start of turn t; t = turns + 1 means released.
  const values: Float64Array[] = [];
  values[model.turns + 1] = new Float64Array(P * R).fill(1);
  const after: Float64Array[] = [];
  const bestMoves: Int8Array[] = [];

  for (let t = model.turns; t >= 1; t--) {
    const next = values[t + 1];
    const catches = model.landingCatches(t);
    const afterT = new Float64Array(P * R);
    for (let p = 0; p < P; p++) {
      for (let r = 0; r < R; r++) {
        if (rabbitOn[p] === r) continue;
        let value = 0;
        let inFlight = 1;
        let at = r;
        for (let k = 1; k <= maxChain; k++) {
          at = pounceTable[at * P + p];
          if (at === rabbitOn[p]) {
            if (!catches) value += inFlight;
            inFlight = 0;
            break;
          }
          const again = 1 / (k + 1);
          value += inFlight * (1 - again) * next[p * R + at];
          inFlight *= again;
        }
        afterT[p * R + r] = value + inFlight * next[p * R + at];
      }
    }
    after[t] = afterT;

    const valuesT = new Float64Array(P * R);
    const best = new Int8Array(P * R);
    for (let p = 0; p < P; p++) {
      const destinations = moveTable[p];
      for (let r = 0; r < R; r++) {
        if (rabbitOn[p] === r) continue;
        let top = 0;
        let topIndex = 0;
        for (let i = 0; i < destinations.length; i++) {
          const to = destinations[i];
          const v = rabbitOn[to] === r ? 0 : afterT[to * R + r];
          if (v > top) {
            top = v;
            topIndex = i;
          }
        }
        valuesT[p * R + r] = top;
        best[p * R + r] = topIndex;
      }
    }
    values[t] = valuesT;
    bestMoves[t] = best;
  }

  function at(turn: number, player: Cell, rabbit: Cell) {
    const p = playerIndex.get(keyOf(player));
    const r = rabbitIndex.get(keyOf(rabbit));
    if (p === undefined || r === undefined) throw new Error(`No such position: player ${keyOf(player)}, rabbit ${keyOf(rabbit)}`);
    return p * R + r;
  }

  return {
    value: (turn, player, rabbit) => (same(player, rabbit) ? 0 : values[turn][at(turn, player, rabbit)]),
    bestMove: (turn, player, rabbit) => bestMoves[turn][at(turn, player, rabbit)],
    afterMove: (turn, player, rabbit) => (same(player, rabbit) ? 0 : after[turn][at(turn, player, rabbit)]),
  };

  function missing(cell: Cell): never {
    throw new Error(`A move reaches ${keyOf(cell)}, which the model doesn't list`);
  }
}

/** All the cells a rabbit can reach from `starts` while chasing a player on any of `players`. */
export function rabbitReach(starts: Cell[], players: Cell[], pounce: (rabbit: Cell, player: Cell) => Cell): Cell[] {
  const seen = new Map(starts.map((c) => [keyOf(c), c]));
  const queue = [...starts];
  while (queue.length) {
    const r = queue.pop()!;
    for (const p of players) {
      const to = pounce(r, p);
      const k = keyOf(to);
      if (!seen.has(k)) {
        seen.set(k, to);
        queue.push(to);
      }
    }
  }
  return [...seen.values()];
}
