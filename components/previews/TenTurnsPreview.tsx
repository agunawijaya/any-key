"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { useDarkAppearance } from "@/components/ten-turns/hooks";
import { createDemo } from "@/components/ten-turns/play/demo";
import { usePitCanvas } from "@/components/ten-turns/usePitCanvas";
import styles from "./TenTurnsPreview.module.css";

/** The card is wide and short: come in close enough that the kid and the rabbit read at a glance. */
const CLOSER = { factor: 1.55, focus: { x: 0, y: 0.5 } };

/** The pit playing itself, silently: a kid stepping away from a rabbit that pounces, and pounces again, by day or by moonlight. */
export function TenTurnsPreview() {
  const dark = useDarkAppearance();
  const reduced = useReducedMotion();
  const { canvasRef, api } = usePitCanvas("storybook", dark, true);
  const { setPainter } = api;

  useEffect(() => {
    const demo = createDemo("hall", reduced);
    setPainter((time, dt) => ({ kind: "pit", frame: { ...demo(time, dt), zoom: CLOSER } }));
    return () => setPainter(null);
  }, [reduced, setPainter]);

  return (
    <div className={styles.preview}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={dark ? "Animated preview: a white rabbit pounces after a small kid in a moonlit pit" : "Animated preview: a white rabbit pounces after a small kid in an earth pit in a sunny meadow"}
      />
    </div>
  );
}
