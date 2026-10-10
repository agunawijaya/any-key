"use client";

import { useState } from "react";
import { useHydrated } from "@/components/kit/hooks";
import { dailyDate } from "@/lib/kit/daily";
import { DAILY_EPOCH } from "@/lib/long-memory/daily";
import type { Progress } from "@/lib/long-memory/progress";
import { MemoryBook } from "./MemoryBook";
import panel from "./panel.module.css";
import styles from "./Menu.module.css";

/*
 * The game menu: the board plays itself on the right, and on the left the
 * ways in. The Learner comes first, because it is the point.
 */

type Props = {
  progress: Progress;
  onPlayLearner: () => void;
  onPick: () => void;
  onDaily: () => void;
  onTerminal: () => void;
  onRecords: () => void;
  onSettings: () => void;
};

export function Menu({ progress, onPlayLearner, onPick, onDaily, onTerminal, onRecords, onSettings }: Props) {
  const hydrated = useHydrated();
  const [book, setBook] = useState(false);
  const lessons = progress.mind.lessons.length;
  const today = hydrated ? dailyDate(new Date(), DAILY_EPOCH) : null;
  const solved = today ? progress.daily[today.key]?.solved : false;

  return (
    <>
      <section className={`${panel.panel} ${styles.menu}`} aria-labelledby="stt-title">
        <p className={panel.kicker}>A seed-sowing game · learning since 1978</p>
        <h1 id="stt-title" className={styles.wordmark}>
          Same Trick <em>Twice</em>
        </h1>
        <p className={panel.lede}>
          Sow seeds round a carved board against an opponent that keeps a book of every game it fails to win. Beat it once, and next time it will try
          something else.
        </p>

        <div className={styles.actions}>
          <button type="button" className={panel.primary} onClick={onPlayLearner} data-autofocus>
            <span className={panel.label}>
              Play the Learner
              <small>{hydrated ? (lessons ? `1978 Awari · its book holds ${lessons} ${lessons === 1 ? "lesson" : "lessons"}` : "1978 Awari · its book is empty") : "1978 Awari"}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className={panel.secondary} onClick={onPick}>
            <span className={panel.label}>
              Choose rules and opponent
              <small>1978 Awari, Oware or Kalah · the Scholar or a friend</small>
            </span>
          </button>
          <button type="button" className={panel.secondary} onClick={onDaily}>
            <span className={panel.label}>
              Daily Endgame{today ? ` #${today.number}` : ""}
              <small>{solved ? "Solved today · play it again for fun" : "One position, the same for everyone"}</small>
            </span>
            {solved && <span className={styles.done}>Solved</span>}
          </button>
          <div className={styles.pair}>
            <button type="button" className={panel.secondary} onClick={() => setBook(true)}>
              <span className={panel.label}>
                Memory Book
                <small>{hydrated ? `${lessons} ${lessons === 1 ? "lesson" : "lessons"}` : " "}</small>
              </span>
            </button>
            <button type="button" className={panel.secondary} onClick={onTerminal}>
              <span className={panel.label}>
                1970s mode
                <small>The 1978 program, turn for turn</small>
              </span>
            </button>
          </div>
        </div>

        <div className={panel.row}>
          <button type="button" className={panel.quiet} onClick={onRecords}>
            Records
          </button>
          <button type="button" className={panel.quiet} onClick={onSettings}>
            Game settings
          </button>
        </div>
      </section>
      {book && <MemoryBook progress={progress} onClose={() => setBook(false)} />}
    </>
  );
}
