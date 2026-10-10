import { shareString } from "@/lib/kit/daily";
import type { DailyPuzzle } from "./daily";
import { RULES } from "./rules";

/*
 * The Daily Endgame's share text. Emoji live only here, in the text that
 * gets pasted into other apps; the page itself draws its own pictures.
 * One chestnut for solving it, three for solving it on the first try.
 */

const NUT = "\u{1F330}";
const EMPTY = "\u{25CB}";

export const goalLine = (puzzle: Pick<DailyPuzzle, "goal">) => (puzzle.goal.kind === "win" ? `win in ${puzzle.goal.moves}` : `win by ${puzzle.goal.seeds}`);

export function dailyShare(puzzle: DailyPuzzle, result: { solved: boolean; moves: number; tries: number }): string {
  const nuts = result.solved ? Math.max(1, 4 - result.tries) : 0;
  const outcome = result.solved ? `solved in ${result.moves} ${result.moves === 1 ? "move" : "moves"}` : "not solved";
  const head = shareString({ title: "Same Trick Twice", label: "Daily Endgame", number: puzzle.number });
  return [head, `${RULES[puzzle.rules].title} · ${goalLine(puzzle)} · ${outcome}`, NUT.repeat(nuts) + EMPTY.repeat(3 - nuts)].join("\n");
}
