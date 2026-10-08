"use client";

import Link from "next/link";
import { Keycap } from "@/components/kit/Keycap";
import type { KeyringData } from "@/lib/kit/keyring";
import type { GameManifest } from "@/lib/kit/manifest";
import styles from "./KeycapGrid.module.css";

const TIER_NAME = { common: "Common", rare: "Rare", legendary: "Legendary" } as const;

/** Every keycap in the collection, grouped by game like the rows of a keyboard: earned, still to earn, and secret. */
export function KeycapGrid({ games, keyring, hydrated }: { games: GameManifest[]; keyring: KeyringData; hydrated: boolean }) {
  return (
    <div className={styles.games}>
      {games.map((game) => {
        const unlocked = (hydrated && keyring.unlocked[game.id]) || {};
        const earned = game.achievements.filter((a) => unlocked[a.id]).length;
        return (
          <section key={game.id} className={styles.game} style={{ "--accent": game.accent } as React.CSSProperties} aria-labelledby={`caps-${game.id}`}>
            <header className={styles.head}>
              <svg className={styles.emblem} viewBox="0 0 24 24" aria-hidden>
                <path d={game.emblem} />
              </svg>
              <h3 id={`caps-${game.id}`} className={styles.title}>
                <Link href={game.route}>{game.title}</Link>
              </h3>
              <span className={styles.tally}>
                {earned} / {game.achievements.length}
              </span>
              <span className={styles.meter} aria-hidden>
                <span style={{ width: `${(100 * earned) / game.achievements.length}%` }} />
              </span>
            </header>
            <ul className={styles.deck}>
              {game.achievements.map((a) => {
                const got = !!unlocked[a.id];
                const state = got ? "earned" : a.secret ? "secret" : "locked";
                return (
                  <li key={a.id} className={styles.cell} data-state={state}>
                    <div className={styles.well}>
                      <Keycap id={`grid-${game.id}-${a.id}`} accent={game.accent} emblem={game.emblem} tier={a.tier} state={state} size={78} />
                    </div>
                    <p className={styles.name}>{state === "secret" ? "Secret" : a.title}</p>
                    <p className={styles.hint}>{got ? <span data-tier={a.tier}>{TIER_NAME[a.tier]}</span> : state === "secret" ? "Earn it to see it" : a.hint}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
