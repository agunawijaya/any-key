"use client";

import { useHydrated } from "@/components/kit/hooks";
import { PLAY_STYLES } from "@/lib/sol-y-sombra/playStyles";
import type { Progress } from "@/lib/sol-y-sombra/progress";
import { TIERS } from "@/lib/sol-y-sombra/verdict";
import panel from "./panel.module.css";
import styles from "./Records.module.css";

/* What this browser remembers of the player's afternoons, one play style at a time. */

export function Records({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const hydrated = useHydrated();
  const style = progress.settings.playStyle;
  const r = progress.records[style];
  return (
    <section className={`${panel.panel} ${styles.records}`} aria-labelledby="sys-records">
      <p className={panel.kicker}>Kept in this browser · {PLAY_STYLES[style].name}</p>
      <h2 id="sys-records" className={panel.heading}>
        Records
      </h2>
      {hydrated && !r && <p className={panel.lede}>No afternoons yet. The record starts with the first one the crowd judges.</p>}
      {hydrated && r && (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>Afternoons</dt>
              <dd>{r.corridas}</dd>
            </div>
            <div>
              <dt>Passes</dt>
              <dd>{r.passes}</dd>
            </div>
            <div>
              <dt>Close calls</dt>
              <dd>{r.closeCalls}</dd>
            </div>
            <div>
              <dt>Gorings</dt>
              <dd>{r.gorings}</dd>
            </div>
            <div>
              <dt>Most passes before the finish</dt>
              <dd>{r.mostPasses}</dd>
            </div>
            <div>
              <dt>The warmest crowd</dt>
              <dd>{r.bestTotal.toFixed(1)}</dd>
            </div>
          </dl>
          <table className={styles.table}>
            <caption>What the crowd gave</caption>
            <tbody>
              {([3, 2, 1, 0] as const).map((t) => (
                <tr key={t}>
                  <th scope="row">{TIERS[t].name}</th>
                  <td>{r.tiers[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className={styles.table}>
            <caption>How the afternoons ended</caption>
            <tbody>
              <tr>
                <th scope="row">The bull rested</th>
                <td>{r.endings.rested}</td>
              </tr>
              <tr>
                <th scope="row">Retired after a goring</th>
                <td>{r.endings.retired}</td>
              </tr>
              <tr>
                <th scope="row">Carried to the infirmary</th>
                <td>{r.endings.infirmary}</td>
              </tr>
              <tr>
                <th scope="row">The bull went back to the pens</th>
                <td>{r.endings.returned}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      {hydrated && (
        <p className={styles.terminal}>
          1970s mode: {progress.terminal.games} {progress.terminal.games === 1 ? "afternoon" : "afternoons"} at the terminal, {progress.terminal.kills}{" "}
          {progress.terminal.kills === 1 ? "bull" : "bulls"} killed, {progress.terminal.awards} {progress.terminal.awards === 1 ? "award" : "awards"} from its
          crowd.
        </p>
      )}
      <div className={panel.row}>
        <button type="button" className={panel.secondary} onClick={onBack} data-autofocus>
          Back to the game menu
        </button>
      </div>
    </section>
  );
}
