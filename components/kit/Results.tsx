"use client";

import { useEffect } from "react";
import { gameById } from "@/lib/catalog";
import { isFreeKey, SHELL_KEYS, whenUnclaimed } from "@/lib/kit/keys";
import { HallIcon, MenuIcon, RestartIcon } from "./icons";
import { Keycap } from "./Keycap";
import { useShell } from "./shell-context";
import styles from "./Results.module.css";

export type ResultsExtra = { label: React.ReactNode; onSelect?: () => void; primary?: boolean; shortcut?: string; node?: React.ReactNode };

type Props = {
  title: React.ReactNode;
  tone?: "win" | "loss" | "neutral";
  kicker?: React.ReactNode;
  /** A character or picture beside the title. */
  art?: React.ReactNode;
  children?: React.ReactNode;
  /** The game's own words for playing again ("Rematch", "Fly again"); the key is always R. */
  playAgainLabel?: string;
  onPlayAgain: () => void;
  /** Back to the game menu. */
  onMenu: () => void;
  /** Keycaps this round unlocked. */
  unlocked?: { gameId: string; ids: string[] };
  /** The game's extra actions ("Next table", "Share"), in their own row above the standard three. */
  extras?: ResultsExtra[];
};

/**
 * The shared results card. Its last row never changes: Play again (R),
 * Game menu, Back to the Hall (H). Esc goes to the game menu (the shell
 * handles that key).
 */
export function Results({ title, tone = "neutral", kicker, art, children, playAgainLabel = "Play again", onPlayAgain, onMenu, unlocked, extras = [] }: Props) {
  const shell = useShell();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (isFreeKey(event, SHELL_KEYS.playAgain)) whenUnclaimed(event, onPlayAgain);
      else if (isFreeKey(event, SHELL_KEYS.hall)) whenUnclaimed(event, shell.toHall);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPlayAgain, shell]);

  const game = unlocked ? gameById(unlocked.gameId) : undefined;
  const caps = game ? unlocked!.ids.map((id) => game.achievements.find((a) => a.id === id)).filter((a) => !!a) : [];

  return (
    <div className={styles.backdrop}>
      <section className={styles.card} data-tone={tone} role="dialog" aria-modal="false" aria-label="Results">
        <div className={styles.head}>
          {art && <div className={styles.art}>{art}</div>}
          <div>
            {kicker && <p className={styles.kicker}>{kicker}</p>}
            <h2 className={styles.title}>{title}</h2>
          </div>
        </div>

        {children && <div className={styles.body}>{children}</div>}

        {game && caps.length > 0 && (
          <ul className={styles.unlocked} aria-label="New keycaps">
            {caps.map((a) => (
              <li key={a.id}>
                <Keycap id={`result-${a.id}`} accent={game.accent} emblem={game.emblem} tier={a.tier} size={54} />
                <span>
                  <small>New keycap</small>
                  <strong>{a.title}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}

        {extras.length > 0 && (
          <div className={styles.extras}>
            {extras.map((extra, i) =>
              extra.node ? (
                <span key={i}>{extra.node}</span>
              ) : (
                <button key={i} type="button" className={extra.primary ? styles.primary : styles.secondary} onClick={extra.onSelect}>
                  {extra.label}
                  {extra.shortcut && <kbd>{extra.shortcut}</kbd>}
                </button>
              ),
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={extras.some((e) => e.primary) ? styles.secondary : styles.primary} onClick={onPlayAgain} data-autofocus>
            <RestartIcon size={18} />
            {playAgainLabel}
            <kbd>R</kbd>
          </button>
          <button type="button" className={styles.secondary} onClick={onMenu}>
            <MenuIcon size={18} />
            Game menu
            <kbd>Esc</kbd>
          </button>
          <button type="button" className={styles.secondary} onClick={shell.toHall}>
            <HallIcon size={18} />
            Back to the Hall
            <kbd>H</kbd>
          </button>
        </div>
      </section>
    </div>
  );
}
