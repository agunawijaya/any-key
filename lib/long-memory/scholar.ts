/*
 * The Scholar: a plain, strong search opponent for every rule set. Negamax
 * with alpha-beta pruning, iterative deepening, a transposition table and
 * captures-first move ordering. A move that earns another move is searched
 * without changing sides. Work is bounded by a node budget, never the clock,
 * so the same position always gets the same answer.
 *
 * Its taste is simple: seeds in your store against seeds in theirs. A
 * finished game is worth its final margin plus a large bonus for winning,
 * so it never trades a win for a bigger score.
 */

import type { Rng } from "@/lib/kit/rng";
import { NORTH_STORE, SOUTH_STORE } from "./board";
import type { Position, Rules } from "./rules/types";

export type Difficulty = "easy" | "normal" | "hard";

export const SCHOLAR_LEVELS: Record<Difficulty, { depth: number; budget: number; noise: number }> = {
  easy: { depth: 2, budget: 4_000, noise: 3 },
  normal: { depth: 6, budget: 60_000, noise: 0.6 },
  hard: { depth: 16, budget: 300_000, noise: 0 },
};

const WIN = 1000;

type Entry = { depth: number; value: number; flag: "exact" | "lower" | "upper"; best: number };

const keyOf = (p: Position) => `${p.board.join(",")}|${p.toMove}|${p.extraUsed ? 1 : 0}`;

/** Value of a position for the player to move. */
function evaluate(p: Position) {
  const own = p.toMove === "south" ? SOUTH_STORE : NORTH_STORE;
  const theirs = own === SOUTH_STORE ? NORTH_STORE : SOUTH_STORE;
  const margin = p.board[own] - p.board[theirs];
  if (!p.over) return margin;
  return margin + (margin > 0 ? WIN : margin < 0 ? -WIN : 0);
}

class OutOfBudget extends Error {}

export type SearchResult = { pit: number; value: number; depth: number; nodes: number; scores: Map<number, number> };

export class Searcher {
  private table = new Map<string, Entry>();
  nodes = 0;

  constructor(
    private readonly rules: Rules,
    private readonly budget: number,
  ) {}

  /** Moves likely to be good first: more seeds into the store, captures, extra turns. */
  private ordered(p: Position, hint: number | undefined) {
    const own = p.toMove === "south" ? SOUTH_STORE : NORTH_STORE;
    const moves = this.rules.legal(p).map((pit) => {
      const outcome = this.rules.play(p, pit);
      const gain = outcome.next.board[own] - p.board[own] + (outcome.extraTurn ? 2 : 0);
      return { pit, outcome, gain: pit === hint ? Infinity : gain };
    });
    return moves.sort((a, b) => b.gain - a.gain);
  }

  private negamax(p: Position, depth: number, alpha: number, beta: number): number {
    if (++this.nodes > this.budget) throw new OutOfBudget();
    if (p.over || depth <= 0) return evaluate(p);
    const key = keyOf(p);
    const entry = this.table.get(key);
    if (entry && entry.depth >= depth) {
      if (entry.flag === "exact") return entry.value;
      if (entry.flag === "lower" && entry.value >= beta) return entry.value;
      if (entry.flag === "upper" && entry.value <= alpha) return entry.value;
    }
    const start = alpha;
    let best = -Infinity;
    let bestPit = -1;
    for (const { pit, outcome } of this.ordered(p, entry?.best)) {
      const next = outcome.next;
      const same = !next.over && next.toMove === p.toMove;
      const value = same ? this.negamax(next, depth - 1, alpha, beta) : -this.negamax(next, depth - 1, -beta, -alpha);
      if (value > best) {
        best = value;
        bestPit = pit;
      }
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    const flag = best <= start ? "upper" : best >= beta ? "lower" : "exact";
    this.table.set(key, { depth, value: best, flag, best: bestPit });
    return best;
  }

  /** Scores every legal move at the deepest depth the budget allows. */
  search(p: Position, maxDepth: number): SearchResult {
    const moves = this.rules.legal(p);
    let scores = new Map<number, number>(moves.map((m) => [m, 0]));
    let reached = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const round = new Map<number, number>();
      try {
        for (const pit of moves) {
          const next = this.rules.play(p, pit).next;
          const same = !next.over && next.toMove === p.toMove;
          round.set(pit, same ? this.negamax(next, depth - 1, -Infinity, Infinity) : -this.negamax(next, depth - 1, -Infinity, Infinity));
        }
      } catch (error) {
        if (error instanceof OutOfBudget) break;
        throw error;
      }
      scores = round;
      reached = depth;
      // A decided game will not change with more depth.
      if ([...round.values()].every((v) => Math.abs(v) >= WIN - 100)) break;
    }
    let pit = moves[0];
    for (const m of moves) if ((scores.get(m) ?? -Infinity) > (scores.get(pit) ?? -Infinity)) pit = m;
    return { pit, value: scores.get(pit) ?? 0, depth: reached, nodes: this.nodes, scores };
  }
}

/** The Scholar's move at a level. Easier levels blur their judgement with seeded noise. */
export function scholarMove(rules: Rules, p: Position, level: Difficulty, rng?: Rng) {
  const { depth, budget, noise } = SCHOLAR_LEVELS[level];
  const result = new Searcher(rules, budget).search(p, depth);
  if (!noise || !rng) return result.pit;
  let best = result.pit;
  let bestValue = -Infinity;
  for (const [pit, value] of result.scores) {
    const blurred = value + (rng.float() * 2 - 1) * noise;
    if (blurred > bestValue) {
      bestValue = blurred;
      best = pit;
    }
  }
  return best;
}
