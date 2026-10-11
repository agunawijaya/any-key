"use client";

import type { FieldShot } from "@/lib/over-short/field";
import { correctionWords, type Units } from "@/lib/over-short/words";
import type { Era } from "../eras/types";
import { TelephoneIcon } from "../icons";
import ui from "../ui.module.css";
import play from "../play/FiringScreen.module.css";

/** The observer's correction as it comes down the line: "Add 150. Right 40." */
export function FieldSlip({ shot, late, era, units, milsHint, hitsLeft }: { shot: FieldShot; late: boolean; era: Era; units: Units; milsHint: boolean; hitsLeft: number }) {
  const text = late ? "Too late: the column was already across." : correctionWords(shot.report, units, milsHint);
  return (
    <div className={`${ui.slip} ${play.slip}`} role="status" aria-live="assertive" data-call={shot.report.kind}>
      <p className={ui.kicker}>
        <TelephoneIcon /> {era.words.observer} · round {shot.round}
      </p>
      <p className={play.message}>{text}</p>
      {shot.hit && !shot.destroyed && hitsLeft > 0 && <p className={play.note}>One more on the same spot will finish it.</p>}
      {shot.destroyed && <p className={ui.stamp}>Target destroyed</p>}
    </div>
  );
}
