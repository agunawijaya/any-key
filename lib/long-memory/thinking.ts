/*
 * The questions the screens ask the computer, and how they are answered:
 * the Scholar's move, the day's endgame, the solver's defence in a daily,
 * and the best pit for the player to move (the game's hidden help).
 * They run in a worker (ai.worker.ts) so the board keeps moving meanwhile.
 */

import { dailyDate } from "@/lib/kit/daily";
import { createRng } from "@/lib/kit/rng";
import { DAILY_EPOCH, dailyPuzzleFor } from "./daily";
import { RULES, type Position, type RuleId } from "./rules";
import { scholarMove, type Difficulty } from "./scholar";
import { Solver } from "./solver";

export type AiRequest =
  | { kind: "scholar"; rules: RuleId; position: Position; level: Difficulty; seed: string }
  | { kind: "daily"; date: string }
  | { kind: "defend"; rules: RuleId; position: Position; goal: "win" | "margin" }
  | { kind: "reach"; rules: RuleId; position: Position; goal: "win" | "margin" }
  /** The pit to sow for whoever moves: exact in a daily (the goal given), the Hard Scholar's choice otherwise. */
  | { kind: "hint"; rules: RuleId; position: Position; goal?: "win" | "margin" };

export type AiAnswer = { pit: number } | { puzzle: ReturnType<typeof dailyPuzzleFor> } | { value: number };

export function answer(request: AiRequest): AiAnswer {
  switch (request.kind) {
    case "scholar":
      return { pit: scholarMove(RULES[request.rules], request.position, request.level, createRng(request.seed)) };
    case "daily": {
      const [y, m, d] = request.date.split("-").map(Number);
      return { puzzle: dailyPuzzleFor(dailyDate(new Date(y, m - 1, d), DAILY_EPOCH)) };
    }
    case "defend":
      return { pit: new Solver(RULES[request.rules]).defend(request.position, request.goal) };
    case "reach": {
      const solver = new Solver(RULES[request.rules]);
      return { value: request.goal === "win" ? solver.fastestWin(request.position) : solver.bestMargin(request.position) };
    }
    case "hint":
      return { pit: request.goal ? solvedPit(request.rules, request.position, request.goal) : scholarMove(RULES[request.rules], request.position, "hard") };
  }
}

/** The daily's player move that keeps the goal surest: the fewest sowings to a win, or the widest margin; ties go to the bigger margin. */
function solvedPit(rules: RuleId, position: Position, goal: "win" | "margin") {
  const solver = new Solver(RULES[rules]);
  let pick = -1;
  let best = -Infinity;
  for (const pit of RULES[rules].legal(position)) {
    const next = RULES[rules].play(position, pit).next;
    const margin = solver.bestMargin(next);
    const value = goal === "win" ? -solver.fastestWin(next) * 1000 + margin : margin;
    if (value > best) {
      best = value;
      pick = pit;
    }
  }
  return pick;
}
