"use client";

import type { Corrida } from "@/lib/sol-y-sombra/corrida";
import { crewFactor, QUALITIES, TELLS, WORK } from "@/lib/sol-y-sombra/rules";
import { meterTotal, SWING, THRESHOLDS, TIERS } from "@/lib/sol-y-sombra/verdict";
import panel from "../panel.module.css";
import styles from "./play.module.css";

/*
 * The HUD's printed cards: the bill for the afternoon's bull, the crews'
 * work, the crowd's mood, a line after each pass. Every number on them is
 * the engine's own.
 */

export type Toast = { title: string; detail: string; tone: "good" | "brave" | "hurt" | "plain" };

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

/** The bill for the afternoon's bull, and (once they have worked him) what the crews' work did to your odds. */
export function BullCard({ corrida, number, crews }: { corrida: Corrida; number: number; crews: boolean }) {
  const q = QUALITIES[corrida.quality];
  return (
    <section className={styles.card} aria-label="The bull">
      <p className={panel.kicker}>The bull · No. {number}</p>
      <h2 className={styles.cardTitle}>{q.name}</h2>
      <p className={styles.cardLine}>{q.line}</p>
      <ul className={styles.tells}>
        {corrida.tells.map((t) => (
          <li key={t}>
            <strong>{TELLS[t].name}.</strong> <span>{TELLS[t].line}</span>
          </li>
        ))}
      </ul>
      <p className={styles.cardNumbers}>
        Risk ×{q.danger.toFixed(2)} on every pass · the crowd credits {q.credit === 0 ? "nothing" : `+${q.credit}`} for him
      </p>
      {crews && <Crews corrida={corrida} />}
    </section>
  );
}

function Crews({ corrida }: { corrida: Corrida }) {
  const change = Math.round((1 - crewFactor(corrida.picadores, corrida.banderilleros)) * 100);
  return (
    <div className={styles.crews}>
      <p className={panel.kicker}>The crews&apos; work</p>
      <p className={styles.crewLine}>
        Picadores <strong>{WORK[corrida.picadores].name.toLowerCase()}</strong>, banderilleros <strong>{WORK[corrida.banderilleros].name.toLowerCase()}</strong>
        : {change > 0 ? `your passes are ${change}% safer for it.` : change < 0 ? `your passes are ${-change}% riskier for it.` : "no safer, no riskier."}
      </p>
    </div>
  );
}

/** The crowd's mood: the meter, where each award begins, and the band the crowd's one roll will land in. */
export function MeterCard({ corrida }: { corrida: Corrida }) {
  const m = corrida.meter;
  const total = meterTotal(m) + (corrida.ending === "infirmary" ? 2 : 0);
  const top = 30;
  const at = (v: number) => `${(Math.max(0, Math.min(top, v)) / top) * 100}%`;
  const capped = corrida.cap < 2;
  const rows: [string, number][] = [
    ["Bravery", m.bravery],
    ["Artistry", m.artistry],
    ["The bull", m.bull],
    ["Risk taken", m.risk],
    ["The finish", m.finish],
    ["Courage", m.courage],
  ];
  return (
    <section className={styles.card} aria-label={`The crowd's mood: ${total.toFixed(1)}`}>
      <p className={panel.kicker}>The crowd</p>
      <div className={styles.meter} aria-hidden="true">
        <div className={styles.meterFill} style={{ width: at(total) }} />
        <div className={styles.meterBand} style={{ left: at(total - SWING), width: `${((2 * SWING) / top) * 100}%` }} />
        {([1, 2, 3] as const).map((t) => (
          <div key={t} className={styles.meterMark} style={{ left: at(THRESHOLDS[t]) }} data-locked={capped && t >= 2}>
            <span>{t === 1 ? "Applause" : t === 2 ? "Lap" : "Shoulders"}</span>
          </div>
        ))}
      </div>
      <p className={styles.meterTotal}>
        <strong>{total.toFixed(1)}</strong> · {TIERS[Math.min(tierAt(total), corrida.cap) as 0 | 1 | 2 | 3].name.toLowerCase()} if the crowd decided now
      </p>
      <dl className={styles.meterRows}>
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{signed(value)}</dd>
          </div>
        ))}
      </dl>
      {capped && <p className={styles.cardNote}>A lap or the shoulders only after the bull rests.</p>}
      <p className={styles.cardNumbers}>
        {corrida.phase === "truth" ? `Moment of truth · attempt ${corrida.attempts + 1} of 3` : `Pass ${corrida.passes + 1} next · by his ${corrida.nextSide}`}
        {corrida.hurt ? " · hurt" : ""}
      </p>
    </section>
  );
}

const tierAt = (total: number) => (total >= THRESHOLDS[3] ? 3 : total >= THRESHOLDS[2] ? 2 : total >= THRESHOLDS[1] ? 1 : 0);

export function PassToast({ toast }: { toast: Toast }) {
  return (
    <div className={styles.toast} data-tone={toast.tone}>
      <strong>{toast.title}</strong>
      <span>{toast.detail}</span>
    </div>
  );
}

export function SkipHint({ onSkip }: { onSkip: () => void }) {
  return (
    <button type="button" className={styles.skip} onClick={onSkip}>
      Skip ahead <kbd className={panel.key}>Space</kbd>
    </button>
  );
}
