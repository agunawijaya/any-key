"use client";

import { useEffect, useRef } from "react";
import type { FieldEngagement } from "@/lib/over-short/field";
import { useDarkAppearance } from "../hooks";
import { paintRatio } from "../scene/detail";
import field from "../play/Battlefield.module.css";
import { FieldDirector, type FieldDirectorOptions } from "./fieldDirector";

/*
 * Field Artillery's two canvases, as in the Campaign: the side view filling
 * the screen and the observer's glasses in their corner, both painted by
 * one director made once per shoot.
 */

type Props = {
  engagement: FieldEngagement;
  options: FieldDirectorOptions;
  onDirector: (director: FieldDirector | null) => void;
  paused: boolean;
  onSkip: () => void;
  pointer: {
    onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
    onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
  };
  observerLabel: string;
};

export function FieldBattlefield({ engagement, options, onDirector, paused, onSkip, pointer, observerLabel }: Props) {
  const side = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const director = useRef<FieldDirector | null>(null);
  const dark = useDarkAppearance();
  const first = useRef({ engagement, options });

  useEffect(() => {
    if (!side.current || !front.current || !frame.current) return;
    const d = new FieldDirector(side.current, front.current, frame.current, first.current.engagement, first.current.options);
    director.current = d;
    d.setTheme(document.documentElement.dataset.theme === "dark");
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
    director.current?.setTheme(dark);
  }, [dark]);

  useEffect(() => {
    director.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    if (director.current) director.current.paused = paused;
  }, [paused]);

  return (
    <div className={field.field}>
      <canvas ref={side} className={field.side} aria-label="The battlefield, side on: your gun on the left, the ground rising and falling towards the target" {...pointer} />
      <div ref={frame} className={field.observer} data-full="false" onClick={onSkip}>
        <canvas ref={front} className={field.front} aria-label={observerLabel} />
        <span className={field.label} aria-hidden="true">
          {observerLabel}
        </span>
      </div>
    </div>
  );
}
