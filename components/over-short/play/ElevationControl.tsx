"use client";

import { useRef, useState } from "react";
import { elevationLabel } from "@/lib/over-short/words";
import ui from "../ui.module.css";
import styles from "./ElevationControl.module.css";

/*
 * Laying the gun: a quadrant dial whose needle is the barrel (drag it, or
 * turn the mouse wheel over it), the elevation as a figure you can type
 * over, a degree up or down, and the Fire button.
 */

type Props = {
  elevation: number;
  min: number;
  max: number;
  /** The finest step: what Shift moves and what typing keeps. */
  precision: number;
  disabled: boolean;
  onChange: (elevation: number) => void;
  /** Fires at the elevation shown, or at one just typed (the change has not reached the parent yet). */
  onFire: (elevation?: number) => void;
  /** The text field, so typing anywhere on the screen can start in it. */
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const SIZE = 168;
const PIVOT = { x: 22, y: SIZE - 22 };
const RADIUS = SIZE - 44;

const Chevron = ({ up = false }: { up?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d={up ? "M3 10.5 8 5.5l5 5" : "M3 5.5l5 5 5-5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const point = (degrees: number, r: number) => ({ x: PIVOT.x + Math.cos((degrees * Math.PI) / 180) * r, y: PIVOT.y - Math.sin((degrees * Math.PI) / 180) * r });

export function ElevationControl({ elevation, min, max, precision, disabled, onChange, onFire, inputRef }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const dragging = useRef(false);
  const round = (v: number) => Math.round(v / precision) * precision;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const set = (v: number) => onChange(clamp(round(v)));

  const fromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * SIZE - PIVOT.x;
    const y = PIVOT.y - ((event.clientY - box.top) / box.height) * SIZE;
    set((Math.atan2(Math.max(0, y), Math.max(0.001, x)) * 180) / Math.PI);
  };

  const commitDraft = () => {
    if (draft === null) return;
    const value = Number(draft.replace(",", "."));
    if (Number.isFinite(value) && draft.trim() !== "") set(value);
    setDraft(null);
  };

  const needle = point(elevation, RADIUS - 6);
  const ticks = [];
  for (let d = 0; d <= 90; d += 5) {
    const long = d % 15 === 0;
    const a = point(d, RADIUS);
    const b = point(d, RADIUS - (long ? 12 : 6));
    ticks.push(<line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={long ? styles.tickLong : styles.tick} />);
    if (long) {
      const l = point(d, RADIUS + 12);
      ticks.push(
        <text key={`l${d}`} x={l.x} y={l.y} className={styles.tickLabel} textAnchor="middle" dominantBaseline="middle">
          {d}
        </text>,
      );
    }
  }
  // The elevations this gun cannot use, shaded on the dial.
  const blocked = [
    [0, min],
    [max, 90],
  ].filter(([a, b]) => b - a > 0.5);

  return (
    <div className={styles.control}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.dial}
        role="slider"
        tabIndex={-1}
        aria-label="Elevation"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={elevation}
        aria-valuetext={`${elevationLabel(elevation, precision)}`}
        aria-disabled={disabled}
        onPointerDown={(event) => {
          if (disabled) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          fromPointer(event);
        }}
        onPointerMove={(event) => dragging.current && fromPointer(event)}
        onPointerUp={() => (dragging.current = false)}
        onWheel={(event) => {
          if (disabled) return;
          set(elevation + (event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? precision : 1));
        }}
      >
        <path d={`M${PIVOT.x} ${PIVOT.y} L${point(0, RADIUS).x} ${point(0, RADIUS).y} A${RADIUS} ${RADIUS} 0 0 0 ${point(90, RADIUS).x} ${point(90, RADIUS).y} Z`} className={styles.face} />
        {blocked.map(([a, b]) => {
          const p = point(a, RADIUS);
          const q = point(b, RADIUS);
          return <path key={a} d={`M${PIVOT.x} ${PIVOT.y} L${p.x} ${p.y} A${RADIUS} ${RADIUS} 0 0 0 ${q.x} ${q.y} Z`} className={styles.blocked} />;
        })}
        <line x1={PIVOT.x} y1={PIVOT.y} x2={point(45, RADIUS).x} y2={point(45, RADIUS).y} className={styles.fortyFive} />
        {ticks}
        <line x1={PIVOT.x} y1={PIVOT.y} x2={needle.x} y2={needle.y} className={styles.needle} />
        <circle cx={needle.x} cy={needle.y} r={7} className={styles.handle} />
        <circle cx={PIVOT.x} cy={PIVOT.y} r={6} className={styles.pivot} />
      </svg>

      <div className={styles.side}>
        <label className={styles.figure}>
          <span className={ui.kicker}>Elevation</span>
          <span className={styles.entry}>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              aria-label="Elevation in degrees"
              value={draft ?? elevation.toFixed(precision < 0.1 ? 2 : 1)}
              disabled={disabled}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  const typed = draft === null ? NaN : Number(draft.replace(",", "."));
                  setDraft(null);
                  if (draft !== null && Number.isFinite(typed) && draft.trim() !== "") {
                    const value = clamp(round(typed));
                    onChange(value);
                    onFire(value);
                  } else onFire();
                } else if (event.key === "Escape" && draft !== null) {
                  event.preventDefault();
                  setDraft(null);
                }
              }}
            />
            <span aria-hidden="true">°</span>
          </span>
        </label>
        <div className={styles.nudges}>
          <button type="button" className={ui.secondary} disabled={disabled} onClick={(event) => set(elevation + (event.shiftKey ? precision : 1))} aria-label="Raise one degree (Shift: finer)">
            <Chevron up />
          </button>
          <button type="button" className={ui.secondary} disabled={disabled} onClick={(event) => set(elevation - (event.shiftKey ? precision : 1))} aria-label="Lower one degree (Shift: finer)">
            <Chevron />
          </button>
        </div>
        <button type="button" className={`${ui.primary} ${styles.fire}`} disabled={disabled} onClick={() => onFire()}>
          Fire
          <span className={ui.key}>Enter</span>
        </button>
      </div>
    </div>
  );
}
