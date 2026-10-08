import { describeRules, type Rules } from "./rules";
import type { MoveQuality } from "./solver";

/*
 * What a Daily result looks like when it's pasted into a chat. Coloured
 * squares are text for other apps, not art in this one: the results card
 * draws its own squares.
 */

/** Green for a perfect move, red for the one that gave the game away, white where no move could win. */
const SQUARE: Record<MoveQuality, string> = { best: "🟩", blunder: "🟥", lost: "⬜" };

export const moveSquares = (moves: MoveQuality[]) => moves.map((q) => SQUARE[q]).join("");

export function dailyShareText({ number, rules, moves, won, hints }: { number: number; rules: Rules; moves: MoveQuality[]; won: boolean; hints: number }) {
  return [`Stickler Daily #${number}`, describeRules(rules), `${moveSquares(moves)} ${won ? "won" : "burnt"}${hints ? ` · ${hints} hint${hints > 1 ? "s" : ""}` : " · no hints"}`].join("\n");
}
