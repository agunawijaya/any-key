import { legalMoves, minTakeOf, type Move, type TakeRules, type Turn } from "./rules";

/*
 * Game theory for "last stick loses" (misère play).
 *
 * One row, take a..b (a = 1 in every mode but Handfuls): the player to move is
 * lost exactly when the count, taken mod (a + b), is 1..a. From 1..a every move
 * takes the last stick (below a it is the forced sweep); from a+1..a+b you can
 * always leave 1..a; from a+b+1..2a+b every move lands in a+1..a+b; and so on
 * with period a + b. With a = 1 these are the counts 1 more than a multiple of
 * b + 1 (1, 5, 9, 13, 17, 21 for b = 3), the rule the 1981 program used.
 *
 * Several rows, take any amount from one row (misère Nim): play ordinary Nim
 * (make the XOR of the rows zero) until every row has at most one stick;
 * then leave an odd number of single sticks.
 */

export function isWinning(rows: number[], rules: TakeRules): boolean {
  const live = rows.filter((n) => n > 0);
  if (live.length === 0) return true; // the previous player took the last stick and lost
  if (live.length === 1 && Number.isFinite(rules.maxTake)) {
    const min = minTakeOf(rules);
    const r = live[0] % (min + rules.maxTake);
    return r === 0 || r > min;
  }
  if (!Number.isFinite(rules.maxTake)) {
    const big = live.filter((n) => n > 1).length;
    if (big === 0) return live.length % 2 === 0;
    return live.reduce((x, n) => x ^ n, 0) !== 0;
  }
  // Several rows with a take limit is not used by any mode; fall back to a search.
  return searchWinning(rows, rules, new Map());
}

function searchWinning(rows: number[], rules: TakeRules, memo: Map<string, boolean>): boolean {
  const key = [...rows].sort((a, b) => a - b).join(",");
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (rows.every((n) => n === 0)) return true;
  let result = false;
  for (const move of legalMoves(rows, rules)) {
    const next = rows.map((n, i) => (i === move.row ? n - move.take : n));
    if (next.every((n) => n === 0)) continue; // taking the last stick (a sweep included) loses
    if (!searchWinning(next, rules, memo)) {
      result = true;
      break;
    }
  }
  memo.set(key, result);
  return result;
}

const after = (rows: number[], move: Move) => rows.map((n, i) => (i === move.row ? n - move.take : n));

/**
 * Every move that leaves the opponent in a lost position (empty when there is none),
 * smallest take first. In Handfuls the first one lands highest inside the zone.
 */
export function winningMoves(rows: number[], rules: TakeRules): Move[] {
  return legalMoves(rows, rules).filter((move) => {
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
export function quality(turn: Turn, rules: TakeRules): MoveQuality {
  if (!isWinning(turn.before, rules)) return "lost";
  const next = after(turn.before, turn.move);
  return !next.every((n) => n === 0) && !isWinning(next, rules) ? "best" : "blunder";
}

/** For one row with takes of 1..maxTake: the "magic" counts you want to leave your opponent. */
export function magicNumbers(maxTake: number, upTo: number) {
  const out: number[] = [];
  for (let n = 1; n <= upTo; n += maxTake + 1) out.push(n);
  return out;
}

export type Zone = { from: number; to: number };

/**
 * Handfuls, one row with takes of min..max: the "magic zones" you want to leave your
 * opponent in. They start at 1 and repeat every min + max sticks; each is min wide.
 */
export function magicZones(minTake: number, maxTake: number, upTo: number): Zone[] {
  const out: Zone[] = [];
  for (let n = 1; n <= upTo; n += minTake + maxTake) out.push({ from: n, to: n + minTake - 1 });
  return out;
}

/** The zone that holds this count, if any. */
export function zoneOf(n: number, minTake: number, maxTake: number): Zone | undefined {
  const r = n % (minTake + maxTake);
  if (n <= 0 || r === 0 || r > minTake) return undefined;
  return { from: n - r + 1, to: n - r + minTake };
}
