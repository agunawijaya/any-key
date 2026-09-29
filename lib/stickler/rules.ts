/*
 * Stickler's rules: sticks lie in one or more rows; on your turn you take
 * 1..maxTake sticks from a single row; whoever takes the very last stick loses.
 * The 1981 original is the one-row case: 23 sticks, take 1 to 3.
 */

export type Player = 0 | 1;

export type Rules = {
  rows: number[];
  /** Most sticks one turn may take. Infinity means "as many as the row holds" (classic Nim rows). */
  maxTake: number;
  /** Who moves first: 0 is you (or player 1 in Versus), 1 is Sparky (or player 2). */
  first: Player;
};

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

export function newGame(rules: Rules): Game {
  return { rules, rows: [...rules.rows], turn: rules.first, history: [], loser: null };
}

export function maxTakeFrom(rows: number[], rules: Rules, row: number) {
  return Math.min(rules.maxTake, rows[row] ?? 0);
}

export function isLegal(game: Game, move: Move) {
  if (game.loser !== null) return false;
  const available = game.rows[move.row];
  return Number.isInteger(move.take) && move.take >= 1 && available !== undefined && move.take <= maxTakeFrom(game.rows, game.rules, move.row);
}

export function play(game: Game, move: Move): Game {
  if (!isLegal(game, move)) throw new Error(`Illegal move ${JSON.stringify(move)}`);
  const rows = game.rows.map((n, i) => (i === move.row ? n - move.take : n));
  const history = [...game.history, { player: game.turn, move, before: game.rows }];
  const loser = total(rows) === 0 ? game.turn : null;
  return { ...game, rows, history, loser, turn: (1 - game.turn) as Player };
}

export function legalMoves(rows: number[], rules: Rules): Move[] {
  const moves: Move[] = [];
  rows.forEach((n, row) => {
    for (let take = 1; take <= Math.min(rules.maxTake, n); take++) moves.push({ row, take });
  });
  return moves;
}

export const describeRules = (rules: Rules) =>
  rules.rows.length === 1
    ? `${rules.rows[0]} sticks · take 1–${rules.maxTake}`
    : `rows ${rules.rows.join("-")} · take any from one row`;
