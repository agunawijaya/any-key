"use client";

import { useEffect, useRef, useState } from "react";
import { gameById, games } from "@/lib/catalog";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { onUnlock, type UnlockDetail } from "@/lib/kit/achievements";
import { keyringStore, levelOf, xpOf } from "@/lib/kit/keyring";
import { keycapClick } from "@/lib/kit/sound";
import { Keycap } from "./Keycap";
import styles from "./KeyringToasts.module.css";

type Toast = UnlockDetail & { key: string; levelUp?: { level: number; title: string } };

const SHOW_MS = 4600;
/** When the falling cap meets the ring in the CSS animation. */
const LANDING_MS = 420;

/**
 * Wherever the player is, a new achievement drops onto a little key ring in
 * the corner with a spring and a soft click. Reduced motion turns the drop
 * into a fade; sound off keeps it silent.
 */
export function KeyringToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const levelRef = useRef<number | null>(null);

  useEffect(() => {
    levelRef.current = levelOf(xpOf(keyringStore.get(), games)).level;
    const timers = new Set<number>();
    const stop = onUnlock((detail) => {
      const level = levelOf(xpOf(keyringStore.get(), games));
      const levelUp = levelRef.current !== null && level.level > levelRef.current ? { level: level.level, title: level.title } : undefined;
      levelRef.current = level.level;
      const toast: Toast = { ...detail, key: `${detail.gameId}:${detail.id}:${detail.at}`, levelUp };
      setToasts((list) => [...list, toast]);
      if (!prefersReducedMotion()) timers.add(window.setTimeout(keycapClick, LANDING_MS));
      else keycapClick();
      timers.add(window.setTimeout(() => setToasts((list) => list.filter((t) => t.key !== toast.key)), SHOW_MS));
    });
    return () => {
      stop();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => {
        const game = gameById(toast.gameId);
        const achievement = game?.achievements.find((a) => a.id === toast.id);
        if (!game || !achievement) return null;
        return (
          <div key={toast.key} className={styles.toast} role="status">
            <div className={styles.hook} aria-hidden>
              <svg className={styles.ring} viewBox="0 0 64 64">
                <circle cx="32" cy="20" r="15" />
                <circle className={styles.ringShine} cx="32" cy="20" r="15" />
              </svg>
              <div className={styles.cap}>
                <Keycap id={`toast-${toast.key}`} accent={game.accent} emblem={game.emblem} tier={achievement.tier} size={58} />
              </div>
            </div>
            <div className={styles.text}>
              <p className={styles.kicker}>
                New keycap · <span data-tier={achievement.tier}>{achievement.tier}</span>
              </p>
              <p className={styles.title}>{achievement.title}</p>
              <p className={styles.game}>{game.title}</p>
              {toast.levelUp && (
                <p className={styles.level}>
                  Level {toast.levelUp.level} · <strong>{toast.levelUp.title}</strong>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
