"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/kit/daily";
import type { DailyPuzzle } from "@/lib/long-memory/daily";
import { ask } from "./ai";
import { MatchScreen } from "./MatchScreen";
import type { BoardState } from "./useBoardScene";
import styles from "./Daily.module.css";

/*
 * The Daily Endgame: today's position is built in the thinking worker (it
 * takes a moment), then played on the match screen against a defender that
 * never makes a mistake.
 */

type Props = { board: BoardState; onMenu: () => void; onAgain: () => void };

export function Daily({ board, onMenu, onAgain }: Props) {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    ask({ kind: "daily", date: localDateKey() })
      .then((answer) => live && setPuzzle((answer as { puzzle: DailyPuzzle }).puzzle))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className={styles.waiting} role="status">
        <p>Today&rsquo;s endgame could not be set out.</p>
        <button type="button" onClick={onMenu}>
          Back to the game menu
        </button>
      </div>
    );
  }
  if (!puzzle) {
    return (
      <div className={styles.waiting} role="status">
        <p>Setting out today&rsquo;s position&hellip;</p>
      </div>
    );
  }
  return <MatchScreen config={{ rules: puzzle.rules, seeds: 4, opponent: "scholar", level: "hard", first: "south" }} daily={puzzle} board={board} onMenu={onMenu} onAgain={onAgain} />;
}
