/*
 * Stickler's rules: sticks lie in one or more rows; on your turn you take
 * 1..maxTake sticks from a single row; whoever takes the very last stick loses.
 * The 1981 original is the one-row case: 23 sticks, take 1 to 3.
 *
 * Handfuls raises the floor: every take is minTake..maxTake sticks. When fewer
 * than minTake are left you must take them all at once (the "sweep"), which
 * takes the last stick and loses. Handfuls is always a single row.
 */

export type Player = 0 | 1;

export type Rules = {
  rows: number[];
  /** Most sticks one turn may take. Infinity means "as many as the row holds" (classic Nim rows). */
  maxTake: number;
  /** Fewest sticks one turn may take; 1 when left out. Above 1 needs a single row (see checkRules). */
  minTake?: number;
  /** Who moves first: 0 is you (or player 1 in Versus), 1 is Sparky (or player 2). */
  first: Player;
};

export type TakeRules = Pick<Rules, "maxTake" | "minTake">;

export type Move = { row: number; take: number };

export type Turn = { player: Player; move: Move; before: number[] };

export type Game = {
  rules: Rules;
  rows: number[];
  turn: Player;
  history: Turn[];
  /** Set when the game is over: the player who took the last stick. */
  loser: Player | null;
};

export const total = (rows: number[]) => rows.reduce((sum, n) => sum + n, 0);

export const minTakeOf = (rules: Pick<Rules, "minTake">) => rules.minTake ?? 1;

/** A take floor above 1 only makes sense for one row with a take limit; anything else is a bug, so it throws. */
export function checkRules(rows: number[], rules: TakeRules) {
  const min = minTakeOf(rules);
  if (!Number.isInteger(min) || min < 1) throw new Error(`minTake must be a whole number of at least 1, not ${min}`);
  if (min > 1 && (rows.length !== 1 || !Number.isFinite(rules.maxTake) || rules.maxTake < min)) {
    throw new Error(`minTake ${min} needs exactly one row and a take limit of at least ${min}`);
  }
}

export function newGame(rules: Rules): Game {
  checkRules(rules.rows, rules);
  return { rules, rows: [...rules.rows], turn: rules.first, history: [], loser: null };
}

export function maxTakeFrom(rows: number[], rules: TakeRules, row: number) {
  return Math.min(rules.maxTake, rows[row] ?? 0);
}

/** The fewest sticks a turn may take from a row: minTake, or the whole row when it holds fewer (the sweep). */
export function minTakeFrom(rows: number[], rules: TakeRules, row: number) {
  const n = rows[row] ?? 0;
  return Math.min(minTakeOf(rules), n);
}

/** True when the only legal move from a row takes every stick in it: the forced sweep of Handfuls. */
export const mustSweep = (rows: number[], rules: TakeRules, row: number) => (rows[row] ?? 0) > 0 && (rows[row] ?? 0) <= minTakeOf(rules) && minTakeOf(rules) > 1;

export function isLegal(game: Game, move: Move) {
  if (game.loser !== null) return false;
  const available = game.rows[move.row];
  return (
    Number.isInteger(move.take) &&
    move.take >= 1 &&
    available !== undefined &&
    move.take >= minTakeFrom(game.rows, game.rules, move.row) &&
    move.take <= maxTakeFrom(game.rows, game.rules, move.row)
  );
}

export function play(game: Game, move: Move): Game {
  if (!isLegal(game, move)) throw new Error(`Illegal move ${JSON.stringify(move)}`);
  const rows = game.rows.map((n, i) => (i === move.row ? n - move.take : n));
  const history = [...game.history, { player: game.turn, move, before: game.rows }];
  const loser = total(rows) === 0 ? game.turn : null;
  return { ...game, rows, history, loser, turn: (1 - game.turn) as Player };
}

/** Every legal move, smallest take first within each row. Below minTake the only move is the sweep. */
export function legalMoves(rows: number[], rules: TakeRules): Move[] {
  const min = minTakeOf(rules);
  if (min > 1) checkRules(rows, rules);
  const moves: Move[] = [];
  rows.forEach((n, row) => {
    if (n > 0 && n < min) moves.push({ row, take: n });
    for (let take = min; take <= Math.min(rules.maxTake, n); take++) moves.push({ row, take });
  });
  return moves;
}

export const describeRules = (rules: Rules) =>
  rules.rows.length === 1
    ? `${rules.rows[0]} sticks · take ${minTakeOf(rules)}–${rules.maxTake}`
    : `rows ${rules.rows.join("-")} · take any from one row`;
