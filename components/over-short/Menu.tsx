"use client";

import { useHydrated } from "@/components/kit/hooks";
import { dailyBarrage } from "@/lib/over-short/daily";
import { FIELD_MISSIONS } from "@/lib/over-short/fieldMissions";
import { MISSIONS } from "@/lib/over-short/missions";
import type { Progress } from "@/lib/over-short/progress";
import ui from "./ui.module.css";
import styles from "./Menu.module.css";

/*
 * The game menu: the gun firing on the battlefield behind, and on the left
 * the ways to play. Classic first, because it is the 1973 game; then the
 * Campaign that breaks its formula; then the full-physics field, the duel
 * across the ridge, the day's barrage, and the two 1970s terminals.
 */

type Props = {
  progress: Progress;
  onClassic: () => void;
  onCampaign: () => void;
  onField: () => void;
  onDuel: () => void;
  onDaily: () => void;
  onTerminals: () => void;
  onRecords: () => void;
  onSettings: () => void;
};

export function Menu({ progress, onClassic, onCampaign, onField, onDuel, onDaily, onTerminals, onRecords, onSettings }: Props) {
  const hydrated = useHydrated();
  const won = MISSIONS.filter((m) => (progress.campaign.missions[m.id]?.wins ?? 0) > 0).length;
  const fieldWon = FIELD_MISSIONS.filter((m) => ["easy", "normal", "hard"].some((d) => (progress.field.missions[`${m.id}/${d}`]?.wins ?? 0) > 0)).length;
  const best = progress.classic.best;
  const today = hydrated ? dailyBarrage() : null;
  const doneToday = today ? progress.daily[today.key] : undefined;

  // The way of playing chosen last is the one the menu offers first.
  const last = hydrated ? progress.settings.style : "classic";
  const modes = [
    { style: "classic", title: "Classic", note: hydrated && best !== null ? `The 1973 drill · your best: ${best} rounds` : "The 1973 drill · five targets, five rounds each", onSelect: onClassic },
    { style: "campaign", title: "Campaign", note: hydrated && won ? `${won} of ${MISSIONS.length} missions won` : `${MISSIONS.length} missions that break the formula`, onSelect: onCampaign },
    { style: "field", title: "Field Artillery", note: hydrated && fieldWon ? `${fieldWon} of ${FIELD_MISSIONS.length} shoots won` : "Charge, line and wind over real ground", onSelect: onField },
    { style: "duel", title: "Counter-Battery Duel", note: hydrated && progress.duel.played ? `${progress.duel.won} won of ${progress.duel.played}` : "Two guns, one ridge: a friend or the computer", onSelect: onDuel },
    {
      style: "daily",
      title: today ? `Daily Barrage #${today.number}` : "Daily Barrage",
      note: doneToday ? (doneToday.won ? `Done today · down in ${doneToday.rounds}` : "Played today · the target stood") : "One shoot a day, the same for everyone",
      onSelect: onDaily,
    },
    { style: "terminals", title: "The 1970s", note: "Gunner and Cannoneer on their own terminals", onSelect: onTerminals },
  ].map((mode) => ({ ...mode, primary: mode.style === last }));

  return (
    <section className={`${ui.panel} ${styles.menu}`} aria-labelledby="os-title">
      <p className={ui.kicker}>An artillery game · first fired in 1973</p>
      <h1 id="os-title" className={styles.wordmark}>
        Over <span aria-hidden="true">/</span>
        <span className={ui.srOnly}>or</span> Short
      </h1>
      <p className={ui.lede}>Call an elevation, fire, and wait for the observer down the line: over, short, or on target. Bracket it, split the difference, and put the round where it belongs.</p>

      <div className={styles.actions}>
        {modes.map((mode) => (
          <button key={mode.title} type="button" className={mode.primary ? ui.primary : ui.secondary} onClick={mode.onSelect} data-autofocus={mode.primary || undefined}>
            <span className={ui.label}>
              {mode.title}
              <small>{mode.note}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
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
