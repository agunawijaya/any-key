"use client";

import { useState } from "react";
import { Dialog } from "@/components/kit/Dialog";
import type { Lesson } from "@/lib/long-memory/learner";
import { currentMind, wipeMind, type Progress } from "@/lib/long-memory/progress";
import type { PageEntry } from "./scene/pages";
import panel from "./panel.module.css";
import styles from "./MemoryBook.module.css";

/*
 * The Learner's book, open on the table: one entry per game it failed to
 * win, with the day, the final stores, and the opening it will steer away
 * from, drawn on a little board with the moves numbered in order.
 */

const shortDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** The spread the 3D book shows: up to four entries around the one that matters now. */
export function pageEntries(lessons: Lesson[], around: number): { entries: PageEntry[]; glowing: number } {
  const first = Math.max(0, Math.min(around - 2, lessons.length - 4));
  const shown = lessons.slice(first, first + 4);
  return {
    entries: shown.map((l, i) => ({ number: first + i + 1, learned: shortDay(l.learned), moves: l.opening })),
    glowing: around - first,
  };
}

export function MemoryBook({ progress, onClose }: { progress: Progress; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const mind = currentMind(progress);
  const lessons = mind.lessons;
  const kept = progress.settings.memory === "keep";

  return (
    <Dialog title="The Memory Book" kicker={`${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} · ${kept ? "kept between visits" : "forgotten when you leave, as in 1978"}`} size="sheet" onClose={onClose}>
      <p className={styles.intro}>
        Every game the Learner fails to win goes in here: the first eight moves, yours and its own. While a new game follows one of these openings, it
        takes two points off any move that would repeat it.
      </p>
      {lessons.length === 0 ? (
        <p className={styles.empty}>No lessons yet. Beat the Learner, or hold it to a draw, to write the first page.</p>
      ) : (
        <ol className={styles.grid}>
          {lessons
            .map((lesson, i) => ({ lesson, i }))
            .reverse()
            .map(({ lesson, i }) => (
              <li key={i} className={styles.entry}>
                <header className={styles.entryHead}>
                  <span className={styles.number}>No. {i + 1}</span>
                  <span className={styles.date}>{shortDay(lesson.learned)}</span>
                </header>
                <MiniBoard opening={lesson.opening} />
                <p className={styles.score}>
                  You {lesson.you} · it {lesson.learner}
                  {lesson.you === lesson.learner ? " · a draw" : ""}
                </p>
              </li>
            ))}
        </ol>
      )}
      <footer className={styles.foot}>
        <button type="button" className={panel.quiet} onClick={() => setAsking(true)} disabled={lessons.length === 0}>
          Wipe the book
        </button>
      </footer>
      {asking && (
        <Dialog title="Wipe the Learner's book?" size="confirm" role="alertdialog" onClose={() => setAsking(false)}>
          <p className={styles.question}>All {lessons.length} lessons go, and it will play as if it had never met you. This can&rsquo;t be undone.</p>
          <div className={panel.row}>
            <button type="button" className={panel.secondary} data-autofocus onClick={() => setAsking(false)}>
              Keep the book
            </button>
            <button
              type="button"
              className={panel.primary}
              onClick={() => {
                wipeMind();
                setAsking(false);
              }}
            >
              Wipe it
            </button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}

/** Two rows of six cups and a store at each end, with the opening numbered in the pits it was played from. */
export function MiniBoard({ opening }: { opening: number[] }) {
  const x = (hole: number) => (hole < 6 ? 34 + hole * 22 : 34 + (12 - hole) * 22);
  const y = (hole: number) => (hole < 6 ? 46 : 20);
  const repeats = new Map<number, number>();
  return (
    <svg viewBox="0 0 168 66" className={styles.mini} role="img" aria-label={`Opening: ${opening.map((h) => (h < 6 ? `your ${h + 1}` : `its ${h - 6}`)).join(", ")}`}>
      <rect x="1" y="1" width="166" height="64" rx="30" className={styles.miniBoard} />
      <ellipse cx="13" cy="33" rx="7" ry="22" className={styles.miniStore} />
      <ellipse cx="155" cy="33" rx="7" ry="22" className={styles.miniStore} />
      {[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12].map((h) => (
        <circle key={h} cx={x(h)} cy={y(h)} r="8.5" className={styles.miniPit} />
      ))}
      {opening.map((hole, i) => {
        const n = repeats.get(hole) ?? 0;
        repeats.set(hole, n + 1);
        const cx = x(hole) + n * 4;
        const cy = y(hole) - n * 3;
        const learner = hole > 6;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="7" className={learner ? styles.miniLearner : styles.miniYou} />
            <text x={cx} y={cy + 3.4} className={learner ? styles.miniLearnerText : styles.miniYouText}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
