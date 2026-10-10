"use client";

import { useHydrated } from "@/components/kit/hooks";
import { MISSIONS } from "@/lib/over-short/missions";
import type { Progress } from "@/lib/over-short/progress";
import ui from "./ui.module.css";
import styles from "./Menu.module.css";

/*
 * The game menu: the gun firing on the battlefield behind, and on the left
 * the two ways to play. Classic first, because it is the 1973 game.
 */

type Props = {
  progress: Progress;
  onClassic: () => void;
  onCampaign: () => void;
  onRecords: () => void;
  onSettings: () => void;
};

export function Menu({ progress, onClassic, onCampaign, onRecords, onSettings }: Props) {
  const hydrated = useHydrated();
  const won = MISSIONS.filter((m) => (progress.campaign.missions[m.id]?.wins ?? 0) > 0).length;
  const best = progress.classic.best;

  return (
    <section className={`${ui.panel} ${styles.menu}`} aria-labelledby="os-title">
      <p className={ui.kicker}>An artillery game · first fired in 1973</p>
      <h1 id="os-title" className={styles.wordmark}>
        Over <span aria-hidden="true">/</span>
        <span className={ui.srOnly}>or</span> Short
      </h1>
      <p className={ui.lede}>
        Call an elevation, fire, and wait for the observer down the line: over, short, or on target. Bracket it, split the difference, and put the round where it
        belongs.
      </p>

      <div className={styles.actions}>
        <button type="button" className={ui.primary} onClick={onClassic} data-autofocus>
          <span className={ui.label}>
            Classic
            <small>{hydrated && best !== null ? `The 1973 drill · your best: ${best} rounds` : "The 1973 drill · five targets, five rounds each"}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={ui.secondary} onClick={onCampaign}>
          <span className={ui.label}>
            Campaign
            <small>{hydrated && won ? `${won} of ${MISSIONS.length} missions won` : `${MISSIONS.length} missions that break the formula, one twist at a time`}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={ui.row}>
        <button type="button" className={ui.quiet} onClick={onRecords}>
          Records
        </button>
        <button type="button" className={ui.quiet} onClick={onSettings}>
          Game settings
        </button>
      </div>
    </section>
  );
}
