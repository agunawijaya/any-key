"use client";

import { useRef } from "react";
import { useModalFocus } from "@/components/kit/hooks";
import type { Corrida } from "@/lib/sol-y-sombra/corrida";
import { FINISHES, MAX_ATTEMPTS, MOVES, MOVE_LIST, type FinishId, type MoveId } from "@/lib/sol-y-sombra/rules";
import panel from "../panel.module.css";
import { FinishIcon, MoveIcon } from "./icons";
import styles from "./play.module.css";

/*
 * What the player chooses, as cards: the three cape moves, the two
 * finishes, what to do when down. Each card shows exactly the odds the
 * engine will roll and what the crowd will make of it.
 */

const percent = (p: number) => `${Math.round(p * 100)}%`;

function Odds({ label, value, tone }: { label: string; value: number; tone: "risk" | "good" }) {
  return (
    <div className={styles.odds} data-tone={tone}>
      <span>{label}</span>
      <span className={styles.oddsBar} aria-hidden="true">
        <span style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
      </span>
      <strong>{percent(value)}</strong>
    </div>
  );
}

export function MoveTray({ corrida, onMove, onTruth }: { corrida: Corrida; onMove: (m: MoveId) => void; onTruth: () => void }) {
  return (
    <div className={styles.tray} role="group" aria-label="Choose the next pass">
      {MOVE_LIST.map((id, i) => {
        const spec = MOVES[id];
        const odds = corrida.moveOdds(id);
        const gain = corrida.moveGain(id);
        return (
          <button key={id} type="button" className={styles.choice} onClick={() => onMove(id)} data-autofocus={i === 0 || undefined}>
            <span className={styles.choiceHead}>
              <kbd className={panel.key}>{i + 1}</kbd>
              <span className={styles.choiceName}>{spec.name}</span>
            </span>
            <MoveIcon move={id} />
            <Odds label="Goring" value={odds.goring} tone="risk" />
            <Odds label="Close call" value={odds.close * (1 - odds.goring)} tone="good" />
            <span className={styles.choiceGain}>
              Crowd +{(gain.bravery + gain.artistry).toFixed(1)}
              {gain.artistry < spec.artistry ? " · they've seen it twice" : ""}
            </span>
          </button>
        );
      })}
      <button type="button" className={`${styles.choice} ${styles.truth}`} onClick={onTruth}>
        <span className={styles.choiceHead}>
          <kbd className={panel.key}>K</kbd>
          <span className={styles.choiceName}>The moment of truth</span>
        </span>
        <span className={styles.truthLine}>
          Finish now: over the horns {percent(corrida.finishChance("over-the-horns").success)}, waiting {percent(corrida.finishChance("waiting").success)}. Each
          pass first makes it likelier.
        </span>
      </button>
    </div>
  );
}

export function FinishTray({ corrida, onFinish }: { corrida: Corrida; onFinish: (f: FinishId) => void }) {
  const ids: FinishId[] = ["over-the-horns", "waiting"];
  return (
    <div className={styles.tray} role="group" aria-label={`The moment of truth, attempt ${corrida.attempts + 1} of ${MAX_ATTEMPTS}`}>
      {ids.map((id, i) => {
        const spec = FINISHES[id];
        const odds = corrida.finishChance(id);
        return (
          <button key={id} type="button" className={`${styles.choice} ${styles.finish}`} onClick={() => onFinish(id)} data-autofocus={i === 0 || undefined}>
            <span className={styles.choiceHead}>
              <kbd className={panel.key}>{i + 1}</kbd>
              <span className={styles.choiceName}>{spec.name}</span>
            </span>
            <FinishIcon finish={id} />
            <span className={styles.choiceLine}>{spec.line}</span>
            <Odds label="He rests" value={odds.success} tone="good" />
            <Odds label="A miss gores" value={odds.goringOnMiss} tone="risk" />
            <span className={styles.choiceGain}>
              Crowd +{spec.bonus} · a miss −1.5 · try {corrida.attempts + 1} of {MAX_ATTEMPTS}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DownTray({ serious, corrida, onCarryOn, onRetire }: { serious: boolean; corrida: Corrida; onCarryOn: () => void; onRetire: () => void }) {
  if (serious) return null;
  const next = corrida.attempts > 0 ? "the finish" : "the next pass";
  return (
    <div className={styles.tray} role="group" aria-label="You are down">
      <button type="button" className={`${styles.choice} ${styles.wide}`} onClick={onCarryOn} data-autofocus>
        <span className={styles.choiceHead}>
          <kbd className={panel.key}>1</kbd>
          <span className={styles.choiceName}>Get up and carry on</span>
        </span>
        <span className={styles.choiceLine}>The crowd loves it (+2.5 courage). From {next} on, every goring chance is a third higher.</span>
      </button>
      <button type="button" className={`${styles.choice} ${styles.wide}`} onClick={onRetire}>
        <span className={styles.choiceHead}>
          <kbd className={panel.key}>2</kbd>
          <span className={styles.choiceName}>Retire</span>
        </span>
        <span className={styles.choiceLine}>Helped off to the barrier. The afternoon ends here (−3 courage), and the crowd gives applause at most.</span>
      </button>
    </div>
  );
}

export function ConfirmTruth({ corrida, onConfirm, onCancel }: { corrida: Corrida; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, true);
  const now = corrida.finishChance("over-the-horns").success;
  return (
    <div className={styles.confirmBackdrop}>
      <div
        ref={ref}
        className={`${panel.panel} ${styles.confirm}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sys-confirm"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
      >
        <p className={panel.kicker}>
          After {corrida.passes} {corrida.passes === 1 ? "pass" : "passes"}
        </p>
        <h2 id="sys-confirm" className={panel.heading}>
          The moment of truth already?
        </h2>
        <p className={panel.lede}>
          The bull is still fresh: over the horns works {percent(now)} of the time now, and each pass you make first adds to it. The crowd, too, likes to see a
          few more.
        </p>
        <div className={panel.row}>
          <button type="button" className={panel.primary} onClick={onConfirm} data-autofocus>
            Yes, now <kbd className={panel.key}>K</kbd>
          </button>
          <button type="button" className={panel.secondary} onClick={onCancel}>
            Keep working <kbd className={panel.key}>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
