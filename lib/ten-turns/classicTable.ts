import type { Cell } from "./geometry";
import { classicModel } from "./models";
import { solve, type Solution } from "./solver";

/*
 * Classic's solved values, worked out once per visit (a few tenths of a
 * second) and kept: they decide where the rabbit may turn out to be after a
 * blind drop, so that no Classic game is lost before it starts.
 */

let solution: Solution | null = null;

export function classicSolution(): Solution {
  solution ??= solve(classicModel());
  return solution;
}

/** The chance best play survives a Classic game that starts with the player at `drop` and the rabbit at `start`. */
export const classicSurvival = (drop: Cell, start: Cell) => classicSolution().value(1, drop, start);
