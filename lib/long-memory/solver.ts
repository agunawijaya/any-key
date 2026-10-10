/*
 * Exact answers for small positions, used to build and referee the Daily
 * Endgame. It works for 1978 Awari and Kalah, where a position can never
 * come back (every seed only travels forward, and each lap drops a seed in
 * a store), so a plain memo of every position seen is exact.
 *
 * Two questions, both from the player's side (south) with both sides
 * playing their best:
 * - `bestMargin`: how far ahead can you finish?
 * - `fastestWin`: in how few of your own sowings can you make sure you
 *   finish ahead?
 */

import type { Position, Rules } from "./rules/types";

export class SolverBudget extends Error {}

/** One character per hole (no hole holds more than 72 seeds) and one for whose turn it is. */
const keyOf = (p: Position) => String.fromCharCode(...p.board, (p.toMove === "south" ? 0 : 2) + (p.extraUsed ? 1 : 0));
const finalMargin = (p: Position) => p.board[6] - p.board[13];

export class Solver {
  private margins = new Map<string, number>();
  private wins = new Map<string, number>();
  nodes = 0;

  constructor(
    private readonly rules: Rules,
    private readonly budget = 3_000_000,
  ) {
    if (rules.id === "oware") throw new Error("The solver needs a rule set without cycles");
  }

  private tick() {
    if (++this.nodes > this.budget) throw new SolverBudget();
  }

  /** South's final margin with best play from here (south maximises, north minimises). */
  bestMargin(p: Position): number {
    if (p.over) return finalMargin(p);
    const key = keyOf(p);
    const known = this.margins.get(key);
    if (known !== undefined) return known;
    this.tick();
    const south = p.toMove === "south";
    let best = south ? -Infinity : Infinity;
    for (const pit of this.rules.legal(p)) {
      const value = this.bestMargin(this.rules.play(p, pit).next);
      best = south ? Math.max(best, value) : Math.min(best, value);
    }
    this.margins.set(key, best);
    return best;
  }

  /** Each legal move with the margin it leads to. */
  marginsOf(p: Position) {
    return this.rules.legal(p).map((pit) => ({ pit, margin: this.bestMargin(this.rules.play(p, pit).next) }));
  }

  /**
   * The fewest south sowings that force a finished game with south ahead,
   * whatever north does; Infinity when south cannot force a win.
   */
  fastestWin(p: Position): number {
    if (p.over) return finalMargin(p) > 0 ? 0 : Infinity;
    const key = keyOf(p);
    const known = this.wins.get(key);
    if (known !== undefined) return known;
    this.tick();
    let value: number;
    if (p.toMove === "south") {
      value = Infinity;
      for (const pit of this.rules.legal(p)) value = Math.min(value, 1 + this.fastestWin(this.rules.play(p, pit).next));
    } else {
      value = 0;
      for (const pit of this.rules.legal(p)) value = Math.max(value, this.fastestWin(this.rules.play(p, pit).next));
    }
    this.wins.set(key, value);
    return value;
  }

  /** North's reply that keeps south's margin lowest, or makes the win take longest. */
  defend(p: Position, goal: "margin" | "win"): number {
    let pick = -1;
    let worst = -Infinity;
    for (const pit of this.rules.legal(p)) {
      const next = this.rules.play(p, pit).next;
      // For a win race the defender delays; a lost cause still drags the margin down.
      const value = goal === "win" ? this.fastestWin(next) * 1000 - this.bestMargin(next) : -this.bestMargin(next);
      if (value > worst) {
        worst = value;
        pick = pit;
      }
    }
    return pick;
  }
}
