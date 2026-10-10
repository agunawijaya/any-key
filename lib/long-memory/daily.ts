/*
 * The Daily Endgame: one position a day, the same for everyone, taken from
 * a game the computer plays against itself from the day's seed. Days take
 * turns between 1978 Awari and Kalah, and between two kinds of goal:
 *
 * - "Win in N": finish ahead within N of your own sowings, whatever the
 *   other side does;
 * - "Win by K": finish at least K seeds ahead.
 *
 * Every puzzle is checked by the solver before it is offered: the goal is
 * reachable with best play, not by just any move (at most half the first
 * moves work), and at least one first move loses, so the game is still in
 * the balance.
 */

import { createRng, type Rng } from "@/lib/kit/rng";
import { dailyDate, type DailyDate } from "@/lib/kit/daily";
import { seedsOn } from "./board";
import { RULES, type Position, type RuleId } from "./rules";
import { scholarMove } from "./scholar";
import { Solver } from "./solver";

export const DAILY_EPOCH = "2026-10-09";

export type DailyGoal = { kind: "win"; moves: number } | { kind: "margin"; seeds: number };

export type DailyPuzzle = {
  number: number;
  key: string;
  rules: RuleId;
  position: Position;
  goal: DailyGoal;
  /** First moves that keep the goal in reach. */
  answers: number[];
};

const ATTEMPTS = 120;

/** A position near the end of a game the computer plays against itself, the player to move. */
function endgameFrom(rules: RuleId, rng: Rng): Position | null {
  const r = RULES[rules];
  let p = r.start();
  const leaveAt = rng.int(7, 11);
  for (let ply = 0; ply < 200 && !p.over; ply++) {
    if (p.toMove === "south" && !p.extraUsed && seedsOn(p.board) - p.board[6] - p.board[13] <= leaveAt) return p;
    const pit = rng.float() < 0.25 ? rng.pick(r.legal(p)) : scholarMove(r, p, "easy", rng);
    p = r.play(p, pit).next;
  }
  return null;
}

/** The puzzle for this position and goal kind, if it is a fair and not-too-easy one. */
function puzzleFrom(rules: RuleId, p: Position, kind: DailyGoal["kind"]): Omit<DailyPuzzle, "number" | "key"> | null {
  const solver = new Solver(RULES[rules], 250_000);
  const moves = RULES[rules].legal(p);
  if (moves.length < 3) return null;
  // The game must still be in the balance: at least one first move throws the win away.
  const margins = solver.marginsOf(p);
  if (!margins.some((m) => m.margin <= 0)) return null;
  if (kind === "win") {
    const n = solver.fastestWin(p);
    if (!Number.isFinite(n) || n < 2 || n > 5) return null;
    // An extra turn is still one of your sowings, so every first move costs one.
    const answers = moves.filter((pit) => 1 + solver.fastestWin(RULES[rules].play(p, pit).next) <= n);
    if (answers.length * 2 > moves.length) return null;
    return { rules, position: p, goal: { kind, moves: n }, answers };
  }
  const k = solver.bestMargin(p);
  if (k < 1) return null;
  const answers = margins.filter((m) => m.margin >= k).map((m) => m.pit);
  if (answers.length * 2 > moves.length) return null;
  return { rules, position: p, goal: { kind, seeds: k }, answers };
}

export function dailyPuzzleFor(date: DailyDate): DailyPuzzle {
  const rules: RuleId = date.day % 2 === 0 ? "awari1978" : "kalah";
  const kind: DailyGoal["kind"] = Math.floor(date.day / 2) % 2 === 0 ? "win" : "margin";
  // The day's own rule set and goal first; on the rare day none turns up, the other goal, then the other rules.
  const other = (r: RuleId): RuleId => (r === "kalah" ? "awari1978" : "kalah");
  const plans: [RuleId, DailyGoal["kind"]][] = [
    [rules, kind],
    [rules, kind === "win" ? "margin" : "win"],
    [other(rules), kind],
    [other(rules), kind === "win" ? "margin" : "win"],
  ];
  for (const [planRules, planKind] of plans) {
    const rng = createRng(`same-trick-twice/daily/${date.key}/${planRules}/${planKind}`);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const p = endgameFrom(planRules, rng.fork(`game-${attempt}`));
      if (!p) continue;
      try {
        const puzzle = puzzleFrom(planRules, p, planKind);
        if (puzzle) return { ...puzzle, number: date.number, key: date.key };
      } catch {
        // Too big for the solver's budget: try another game.
      }
    }
  }
  throw new Error(`No daily endgame found for ${date.key}`);
}

export const todaysPuzzle = (now = new Date()) => dailyPuzzleFor(dailyDate(now, DAILY_EPOCH));
