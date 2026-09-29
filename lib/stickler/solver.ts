import { legalMoves, type Move, type Rules, type Turn } from "./rules";

/*
 * Game theory for "last stick loses" (misère play).
 *
 * One row, take 1..k: the player to move is lost exactly when the count is
 * 1 more than a multiple of k+1 (1, 5, 9, 13, 17, 21 for k = 3). The 1981
 * program used the same rule.
 *
 * Several rows, take any amount from one row (misère Nim): play ordinary Nim
 * (make the XOR of the rows zero) until every row has at most one stick;
 * then leave an odd number of single sticks.
 */

export function isWinning(rows: number[], rules: Pick<Rules, "maxTake">): boolean {
  const live = rows.filter((n) => n > 0);
  if (live.length === 0) return true; // the previous player took the last stick and lost
  if (live.length === 1 && Number.isFinite(rules.maxTake)) {
    return live[0] % (rules.maxTake + 1) !== 1;
  }
  if (!Number.isFinite(rules.maxTake)) {
    const big = live.filter((n) => n > 1).length;
    if (big === 0) return live.length % 2 === 0;
    return live.reduce((x, n) => x ^ n, 0) !== 0;
  }
  // Several rows with a take limit is not used by any mode; fall back to a search.
  return searchWinning(rows, rules.maxTake, new Map());
}

function searchWinning(rows: number[], maxTake: number, memo: Map<string, boolean>): boolean {
  const key = [...rows].sort((a, b) => a - b).join(",");
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (rows.every((n) => n === 0)) return true;
  let result = false;
  for (const move of legalMoves(rows, { rows, maxTake, first: 0 })) {
    const next = rows.map((n, i) => (i === move.row ? n - move.take : n));
    if (next.every((n) => n === 0)) continue; // taking the last stick loses
    if (!searchWinning(next, maxTake, memo)) {
      result = true;
      break;
    }
  }
  memo.set(key, result);
  return result;
}

const after = (rows: number[], move: Move) => rows.map((n, i) => (i === move.row ? n - move.take : n));

/** Every move that leaves the opponent in a lost position (empty when there is none). */
export function winningMoves(rows: number[], rules: Pick<Rules, "maxTake">): Move[] {
  return legalMoves(rows, { rows, maxTake: rules.maxTake, first: 0 }).filter((move) => {
    const next = after(rows, move);
    if (next.every((n) => n === 0)) return false;
    return !isWinning(next, rules);
  });
}

export type MoveQuality = "best" | "blunder" | "lost";

/**
 * How good a move was: "best" kept a won position, "blunder" threw one away,
 * "lost" means there was nothing to keep (any move was as good as another).
 */
export function quality(turn: Turn, rules: Pick<Rules, "maxTake">): MoveQuality {
  if (!isWinning(turn.before, rules)) return "lost";
  const next = after(turn.before, turn.move);
  return !next.every((n) => n === 0) && !isWinning(next, rules) ? "best" : "blunder";
}

/** For one row: the "magic" counts you want to leave your opponent. */
export function magicNumbers(maxTake: number, upTo: number) {
  const out: number[] = [];
  for (let n = 1; n <= upTo; n += maxTake + 1) out.push(n);
  return out;
}
