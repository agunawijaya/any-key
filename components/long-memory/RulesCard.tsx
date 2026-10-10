"use client";

import { Dialog } from "@/components/kit/Dialog";
import { useReducedMotion } from "@/components/kit/hooks";
import { RULES, type RuleId } from "@/lib/long-memory/rules";
import panel from "./panel.module.css";
import styles from "./RulesCard.module.css";

/*
 * The rules card shown the first time a rule set is played: a little board
 * where a seed hops along the way sowing goes, and the rules in four lines.
 */

const LINES: Record<RuleId, string[]> = {
  awari1978: [
    "Pick up all the seeds in one of your pits and sow them one by one to the right, round the board, through both stores.",
    "End in your own store and you move once more, but only once.",
    "End in an empty pit, on either side, and you take the pit straight across, with the last seed, if it has any.",
    "When either row is empty, the game stops. Only the stores count; seeds left in pits are nobody's.",
  ],
  oware: [
    "Sow one seed a pit round the board. The stores only hold what you capture; a pit with twelve or more skips itself.",
    "End on their side making two or three, and you take them, then the pit before it, and so on while those make two or three.",
    "Never take every seed they have, and if their row is empty you must sow into it.",
    "More than half the seeds, 25, wins.",
  ],
  kalah: [
    "Sow one seed a pit round the board, into your own store but never into theirs.",
    "End in your store and you move again, as often as you manage it.",
    "End in an empty pit of your own and take the pit across, with the last seed, if it has any.",
    "When a row runs dry, each side sweeps its own seeds into its own store. Most seeds wins.",
  ],
};

/* Pit centres on the little board, holes 0–13. */
const AT: [number, number][] = [
  [62, 74],
  [92, 74],
  [122, 74],
  [152, 74],
  [182, 74],
  [212, 74],
  [246, 52],
  [212, 30],
  [182, 30],
  [152, 30],
  [122, 30],
  [92, 30],
  [62, 30],
  [28, 52],
];

/** The holes a seed visits from pit 2 under each rule set, for the hopping seed. */
const ROUTE: Record<RuleId, number[]> = {
  awari1978: [2, 3, 4, 5, 6, 7, 8],
  oware: [2, 3, 4, 5, 7, 8, 9],
  kalah: [2, 3, 4, 5, 6],
};

export function RulesCard({ rules, onClose }: { rules: RuleId; onClose: () => void }) {
  const reduced = useReducedMotion();
  const route = ROUTE[rules];
  const path = route.map((h, i) => `${i ? "L" : "M"}${AT[h][0]} ${AT[h][1]}`).join(" ");
  return (
    <Dialog title={RULES[rules].title} kicker="How this game is played" size="menu" onClose={onClose}>
      <svg viewBox="0 0 274 104" className={styles.board} role="img" aria-label="A small board: seeds travel from a pit to the right, round the board.">
        <rect x="4" y="6" width="266" height="92" rx="44" className={styles.wood} />
        {AT.map(([x, y], hole) =>
          hole === 6 || hole === 13 ? (
            <ellipse key={hole} cx={x} cy={y} rx="12" ry="32" className={styles.hollow} data-off={rules === "oware" ? "true" : undefined} />
          ) : (
            <circle key={hole} cx={x} cy={y} r="11" className={styles.hollow} data-start={hole === 2 ? "true" : undefined} />
          ),
        )}
        <path d={path} className={styles.route} />
        {route.slice(1).map((h, i) => (
          <circle key={i} cx={AT[h][0]} cy={AT[h][1]} r="3.2" className={styles.drop} style={{ animationDelay: `${0.35 * (i + 1)}s` }} data-still={reduced ? "true" : undefined} />
        ))}
        {!reduced && (
          <circle r="5" className={styles.seed}>
            <animateMotion dur={`${route.length * 0.35}s`} repeatCount="indefinite" path={path} keyPoints="0;1;1" keyTimes="0;0.85;1" calcMode="linear" />
          </circle>
        )}
      </svg>
      <ol className={styles.lines}>
        {LINES[rules].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className={panel.row}>
        <button type="button" className={panel.primary} onClick={onClose} data-autofocus>
          Got it <span aria-hidden="true">→</span>
        </button>
      </div>
    </Dialog>
  );
}
