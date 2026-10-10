"use client";

import { useEffect, useRef } from "react";
import type { Engagement } from "@/lib/over-short/engagement";
import { paintRatio } from "../scene/detail";
import { appearanceOf, useDarkAppearance } from "../hooks";
import { Director, type DirectorOptions } from "./director";
import styles from "./Battlefield.module.css";

/*
 * The two canvases of the firing screen and the director that paints them:
 * the side view filling the screen, and the observer's field glasses, which
 * sit in a corner while the player aims and fill the screen for the fall of
 * shot. The director is made once per game; options change it in place.
 */

type Props = {
  engagement: Engagement;
  options: DirectorOptions;
  /** Hands the director to the firing screen, which plays the engine's events through it. */
  onDirector: (director: Director | null) => void;
  paused: boolean;
  /** Drawn while the shell is in the air or the glasses are up: a click skips ahead. */
  onSkip: () => void;
  /** Pointer handlers for laying the gun by dragging its barrel. */
  pointer: {
    onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
  };
  observerLabel: string;
};

export function Battlefield({ engagement, options, onDirector, paused, onSkip, pointer, observerLabel }: Props) {
  const side = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const director = useRef<Director | null>(null);
  const dark = useDarkAppearance();
  // The engagement and options at the moment the director is made; later changes reach it through `play` and `setOptions`.
  const first = useRef({ engagement, options });

  useEffect(() => {
    if (!side.current || !front.current || !frame.current) return;
    const d = new Director(side.current, front.current, frame.current, first.current.engagement, first.current.options);
    director.current = d;
    d.setAppearance(appearanceOf(document.documentElement.dataset.theme === "dark"));
    const canvas = side.current;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      d.resize(Math.max(1, box.width), Math.max(1, box.height), paintRatio());
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(canvas);
    let raf = 0;
    const loop = (now: number) => {
      d.frame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onDirector(d);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      director.current = null;
      onDirector(null);
    };
  }, [onDirector]);

  useEffect(() => {
    director.current?.setAppearance(appearanceOf(dark));
  }, [dark]);

  useEffect(() => {
    director.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    if (director.current) director.current.paused = paused;
  }, [paused]);

  return (
    <div className={styles.field}>
      <canvas ref={side} className={styles.side} aria-label="The battlefield, side on: your gun on the left, the land stretching towards the target" {...pointer} />
      <div ref={frame} className={styles.observer} data-full="false" onClick={onSkip}>
        <canvas ref={front} className={styles.front} aria-label={observerLabel} />
        <span className={styles.label} aria-hidden="true">
          {observerLabel}
        </span>
      </div>
    </div>
  );
}
