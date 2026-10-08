"use client";

import Link from "next/link";
import { games } from "@/lib/catalog";
import { dailyDate } from "@/lib/kit/daily";
import { dailyDoneToday, streakOf } from "@/lib/kit/keyring";
import { isPlayable } from "@/lib/kit/manifest";
import { useHydrated, useKeyring } from "./hooks";
import styles from "./TodayStrip.module.css";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const dailyGames = games.filter((game) => isPlayable(game) && game.daily);

/**
 * Today's dailies across the collection, done or waiting, and the week's
 * streak as a row of seven small keys. Dates are the player's own, so the
 * strip only fills in once the page runs in the browser.
 */
export function TodayStrip({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const keyring = useKeyring();
  const hydrated = useHydrated();
  const now = new Date();
  const streak = streakOf(keyring.dailies, now);
  const done = dailyGames.filter((game) => dailyDoneToday(keyring, game.id, now)).length;

  return (
    <section className={`${styles.strip} ${compact ? styles.compact : ""} ${className}`} aria-label="Today's dailies">
      <p className={styles.today}>
        <span className={styles.label}>Today</span>
        <span className={styles.count}>{hydrated ? `${done} of ${dailyGames.length} dailies` : "Dailies"}</span>
      </p>

      <ul className={styles.games}>
        {dailyGames.map((game) => {
          const finished = hydrated && dailyDoneToday(keyring, game.id, now);
          const number = hydrated ? dailyDate(now, game.daily?.epoch).number : null;
          return (
            <li key={game.id}>
              <Link href={game.route} className={styles.game} data-done={finished || undefined} style={{ "--accent": game.accent } as React.CSSProperties}>
                <svg className={styles.emblem} viewBox="0 0 24 24" aria-hidden>
                  <path d={game.emblem} />
                </svg>
                <span className={styles.gameTitle}>{game.title}</span>
                <span className={styles.state}>
                  {finished ? (
                    <>
                      <svg viewBox="0 0 16 16" aria-hidden className={styles.tick}>
                        <path d="M3 8.5l3.2 3L13 4.5" />
                      </svg>
                      done
                    </>
                  ) : number ? (
                    `#${number}`
                  ) : (
                    "daily"
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.streak} aria-label={hydrated ? `Daily streak: ${streak.current} day${streak.current === 1 ? "" : "s"}` : "Daily streak"}>
        <ol className={styles.week} aria-hidden>
          {streak.week.map((day, i) => (
            <li key={day.key} data-played={(hydrated && day.played) || undefined} data-today={(hydrated && day.today) || undefined} data-future={(hydrated && day.future) || undefined}>
              {DAY_LETTERS[i]}
            </li>
          ))}
        </ol>
        <span className={styles.streakText}>
          <b>{hydrated ? streak.current : 0}</b> day streak
        </span>
      </div>
    </section>
  );
}
