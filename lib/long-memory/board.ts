/*
 * The fourteen holes, numbered the way the 1978 program numbered them, so
 * the faithful module and the notes can quote its indices directly:
 *
 *        13 | 12 11 10  9  8  7 |          north: the opponent
 *           |  0  1  2  3  4  5 | 6        south: the player
 *
 * Seeds travel counter-clockwise: along the south row to the right, into
 * hole 6, back along the north row to the left, into hole 13. Holes 6 and
 * 13 are the stores (in Oware, the piles of captured seeds).
 */

export type Side = "south" | "north";

export const HOLES = 14;
export const PITS_PER_SIDE = 6;
export const SOUTH_STORE = 6;
export const NORTH_STORE = 13;

/** Seeds per hole, length 14, indexed as above. */
export type Board = readonly number[];

export const isStore = (hole: number) => hole === SOUTH_STORE || hole === NORTH_STORE;
export const sideOf = (hole: number): Side => (hole <= SOUTH_STORE ? "south" : "north");
export const storeOf = (side: Side) => (side === "south" ? SOUTH_STORE : NORTH_STORE);
/** The pit straight across the board. */
export const oppositeOf = (pit: number) => 12 - pit;
/** A side's six pits, in sowing order. */
export const pitsOf = (side: Side) => (side === "south" ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
/** 0 to 5, counted in sowing order from the side's own left. */
export const pitIndexOf = (pit: number) => (pit > SOUTH_STORE ? pit - 7 : pit);
export const nextHole = (hole: number) => (hole + 1) % HOLES;

export function boardOf(south: number[], north: number[], southStore = 0, northStore = 0): Board {
  return [...south, southStore, ...north, northStore];
}

export const seedsOn = (board: Board) => board.reduce((sum, n) => sum + n, 0);
