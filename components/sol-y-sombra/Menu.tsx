"use client";

import { useHydrated } from "@/components/kit/hooks";
import { PLAY_STYLES } from "@/lib/sol-y-sombra/playStyles";
import type { Progress } from "@/lib/sol-y-sombra/progress";
import { TRADITIONS } from "@/lib/sol-y-sombra/traditions";
import panel from "./panel.module.css";
import styles from "./Menu.module.css";

/*
 * The game menu: the poster's ring plays itself behind, and on the left
 * the ways in. An afternoon in the ring comes first.
 */

type Props = {
  progress: Progress;
  onPlay: () => void;
  onTerminal: () => void;
  onRecords: () => void;
  onSettings: () => void;
};

export function Menu({ progress, onPlay, onTerminal, onRecords, onSettings }: Props) {
  const hydrated = useHydrated();
  const { playStyle, tradition } = progress.settings;
  const records = progress.records[playStyle];
  const afternoons = records?.corridas ?? 0;
  const honours = records ? records.tiers[2] + records.tiers[3] : 0;

  return (
    <section className={`${panel.panel} ${styles.menu}`} aria-labelledby="sys-title">
      <p className={panel.kicker}>A cape, a bull and a crowd · after a program of 1978</p>
      <h1 id="sys-title" className={styles.wordmark}>
        Sol <span>y</span> Sombra
      </h1>
      <p className={panel.lede}>
        Stand in the ring with a red cape and half a tonne of bull coming at you. Choose how close to let it pass, read the crowd, and earn your place on the
        poster.
      </p>

      <div className={styles.actions}>
        <button type="button" className={panel.primary} onClick={onPlay} data-autofocus>
          <span className={panel.label}>
            Enter the ring
            <small>
              {PLAY_STYLES[playStyle].name} · {TRADITIONS[tradition].name} · one bull, about five minutes
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={panel.secondary} onClick={onTerminal}>
          <span className={panel.label}>
            1970s mode
            <small>The 1978 program, question for question</small>
          </span>
        </button>
      </div>

      <p className={styles.soon}>Arena and Career play, and the bloodless Course Camarguaise and Recortes, are on their way.</p>

      <div className={styles.footer}>
        <p className={styles.tally}>
          {hydrated && afternoons > 0 ? `${afternoons} ${afternoons === 1 ? "afternoon" : "afternoons"} · ${honours} called round the ring` : " "}
        </p>
        <div className={panel.row}>
          <button type="button" className={panel.quiet} onClick={onRecords}>
            Records
          </button>
          <button type="button" className={panel.quiet} onClick={onSettings}>
            Game settings
          </button>
        </div>
      </div>
    </section>
  );
}
