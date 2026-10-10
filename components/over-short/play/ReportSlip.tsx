"use client";

import type { Engagement, Shot } from "@/lib/over-short/engagement";
import { spokenReport, type Units } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { TelephoneIcon } from "../icons";
import ui from "../ui.module.css";
import styles from "./FiringScreen.module.css";

/** The observer's report as it comes down the line: a slip torn from the message pad. */
export function ReportSlip({ shot, late, engagement, era, units }: { shot: Shot; late: boolean; engagement: Engagement; era: Era; units: Units }) {
  const target = engagement.targets[shot.target];
  const text = late ? "Too late. Time was up before it came down." : spokenReport(shot.report, units, shot.destroyed);
  const further = target.hits > 1 && shot.hit && !shot.destroyed;
  return (
    <div className={`${ui.slip} ${styles.slip}`} role="status" aria-live="assertive" data-call={shot.report.call}>
      <p className={ui.kicker}>
        <TelephoneIcon /> {era.words.observer} · round {shot.round}
      </p>
      <p className={styles.message}>{text}</p>
      {further && <p className={styles.note}>One more on the same spot will finish it.</p>}
      {shot.destroyed && <p className={ui.stamp}>Target destroyed</p>}
    </div>
  );
}
