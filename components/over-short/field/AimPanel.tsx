"use client";

import type { Aim } from "@/lib/over-short/fieldModel";
import { distanceLabel, type Units } from "@/lib/over-short/words";
import { ElevationControl } from "../play/ElevationControl";
import ui from "../ui.module.css";
import styles from "./Field.module.css";

/*
 * Laying a Field Artillery gun: the charge (a few bags of propellant, from
 * a lob to the longest throw), the line (how far left or right of the
 * target's bearing, in mils, with what that comes to at the target), and the
 * elevation on the same quadrant dial as the Campaign, with the Fire button.
 */

type Props = {
  aim: Aim;
  /** Each charge's greatest range, from the firing table. */
  reaches: number[];
  limits: { elevation: { min: number; max: number }; line: number };
  precision: number;
  /** How far off the target is, for what a mil comes to there. */
  distance: number;
  units: Units;
  disabled: boolean;
  onChange: (aim: Aim) => void;
  onFire: (elevation?: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const Arrow = ({ left = false }: { left?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d={left ? "M10.5 3 5.5 8l5 5" : "M5.5 3l5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "R 12", "L 5" or "0": the line as the gun's dial reads it. */
export const lineLabel = (mils: number) => (mils === 0 ? "0" : `${mils > 0 ? "R" : "L"} ${Math.abs(mils)}`);

export function AimPanel({ aim, reaches, limits, precision, distance, units, disabled, onChange, onFire, inputRef }: Props) {
  const setLine = (line: number) => onChange({ ...aim, line: Math.max(-limits.line, Math.min(limits.line, Math.round(line))) });
  const atTarget = Math.round(Math.tan((aim.line * 2 * Math.PI) / 6400) * distance);
  return (
    <div className={styles.aimPanel}>
      <div className={styles.charges} role="radiogroup" aria-label="Charge">
        <span className={ui.kicker}>Charge</span>
        <div className={styles.segments}>
          {reaches.map((reach, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={aim.charge === i + 1}
              className={styles.segment}
              disabled={disabled}
              onClick={() => onChange({ ...aim, charge: i + 1 })}
              aria-label={`Charge ${i + 1}, up to ${distanceLabel(reach, units)}`}
            >
              <strong>{i + 1}</strong>
              <small>{(reach / 1000).toFixed(1)} km</small>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.line}>
        <span className={ui.kicker}>Line</span>
        <div className={styles.lineRow}>
          <button type="button" className={ui.secondary} disabled={disabled} onClick={(event) => setLine(aim.line - (event.shiftKey ? 10 : 1))} aria-label="One mil left (Shift: ten)">
            <Arrow left />
          </button>
          <output className={styles.lineValue} aria-live="off" aria-label={`Line ${aim.line === 0 ? "on the target" : `${Math.abs(aim.line)} mils ${aim.line > 0 ? "right" : "left"}`}`}>
            {lineLabel(aim.line)}
            <small> mils</small>
          </output>
          <button type="button" className={ui.secondary} disabled={disabled} onClick={(event) => setLine(aim.line + (event.shiftKey ? 10 : 1))} aria-label="One mil right (Shift: ten)">
            <Arrow />
          </button>
        </div>
        <p className={styles.lineNote}>{atTarget === 0 ? "On the target's bearing" : `${distanceLabel(Math.abs(atTarget), units)} ${atTarget > 0 ? "right" : "left"} at the target`}</p>
      </div>

      <ElevationControl
        elevation={aim.elevation}
        min={limits.elevation.min}
        max={limits.elevation.max}
        precision={precision}
        disabled={disabled}
        onChange={(elevation) => onChange({ ...aim, elevation })}
        onFire={onFire}
        inputRef={inputRef}
      />
    </div>
  );
}
