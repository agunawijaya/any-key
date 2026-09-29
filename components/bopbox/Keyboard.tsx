"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Arrangement } from "@/lib/music/arrange/types";
import type { BopEngine } from "@/lib/music/engine";
import { pitchName } from "@/lib/music/theory";
import { indexTracks, keyShapes, litKeys } from "@/lib/music/timeline";
import type { Clock } from "./BopBox";
import styles from "./Keyboard.module.css";

type Props = {
  arrangement: Arrangement;
  clock: Clock;
  range: [number, number];
  muted: Set<string>;
  engine: React.RefObject<BopEngine | null>;
  /** The 1981 look: only the 26 keys MUSIC.BAS drew, with a warning for notes off the edge. */
  vintage?: boolean;
};

const HEIGHT = 5.2;

export function Keyboard({ arrangement, clock, range, muted, engine, vintage }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const edgeLow = useRef<HTMLSpanElement>(null);
  const edgeHigh = useRef<HTMLSpanElement>(null);
  const { keys, width } = useMemo(() => keyShapes(range[0], range[1]), [range]);
  const indexes = useMemo(() => indexTracks(arrangement), [arrangement]);
  const held = useRef(new Set<number>());

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rects = new Map<number, SVGRectElement>();
    svg.querySelectorAll<SVGRectElement>("[data-pitch]").forEach((r) => rects.set(Number(r.dataset.pitch), r));
    let frame = 0;
    let previous = new Map<number, string>();

    const tick = () => {
      const beat = clock.beat();
      const lit = beat > 0.001 ? litKeys(indexes, beat, muted) : new Map<number, string>();
      for (const [pitch] of previous) {
        if (!lit.has(pitch)) {
          const rect = rects.get(pitch);
          rect?.style.removeProperty("--lit");
          rect?.classList.remove(styles.on);
        }
      }
      let low = false;
      let high = false;
      for (const [pitch, color] of lit) {
        const rect = rects.get(pitch);
        if (rect) {
          rect.style.setProperty("--lit", color);
          rect.classList.add(styles.on);
        } else if (pitch < range[0]) low = true;
        else if (pitch > range[1]) high = true;
      }
      edgeLow.current?.classList.toggle(styles.edgeOn, low);
      edgeHigh.current?.classList.toggle(styles.edgeOn, high);
      previous = lit;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [indexes, clock, muted, range]);

  function press(pitch: number) {
    held.current.add(pitch);
    void engine.current?.keyDown(pitch);
  }

  function release(pitch: number) {
    if (!held.current.delete(pitch)) return;
    engine.current?.keyUp(pitch);
  }

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);

  return (
    <div className={`${styles.wrap} ${vintage ? styles.vintage : ""}`}>
      {vintage && (
        <span ref={edgeLow} className={`${styles.edge} ${styles.edgeLeft}`}>
          ♫ off the edge
        </span>
      )}
      <svg
        ref={svgRef}
        className={styles.keys}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="group"
        aria-label="Piano keyboard. Keys light up with the music; click or tap to play."
      >
        {[...whites, ...blacks].map((key) => (
          <rect
            key={key.pitch}
            data-pitch={key.pitch}
            className={key.black ? styles.black : styles.white}
            x={key.x + (key.black ? 0 : 0.04)}
            y={0}
            width={key.w - (key.black ? 0 : 0.08)}
            height={key.black ? HEIGHT * 0.62 : HEIGHT}
            rx={key.black ? 0.08 : 0.12}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              press(key.pitch);
            }}
            onPointerUp={() => release(key.pitch)}
            onPointerCancel={() => release(key.pitch)}
            onPointerLeave={() => release(key.pitch)}
          >
            <title>{pitchName(key.pitch)}</title>
          </rect>
        ))}
        {whites
          .filter((k) => k.pitch % 12 === 0)
          .map((k) => (
            <text key={`c${k.pitch}`} className={styles.label} x={k.x + 0.5} y={HEIGHT - 0.35} textAnchor="middle">
              C{Math.floor(k.pitch / 12) - 1}
            </text>
          ))}
      </svg>
      {vintage && (
        <span ref={edgeHigh} className={`${styles.edge} ${styles.edgeRight}`}>
          off the edge ♫
        </span>
      )}
    </div>
  );
}
