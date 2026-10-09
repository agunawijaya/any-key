"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { Diorama, type DioramaFrame, type SceneHooks } from "./scene/Diorama";

/*
 * A canvas with the Gobi in it. The scene says what to draw (hooks) and when
 * (frame, read every animation frame). The loop sleeps while the canvas is
 * off screen, and with reduced motion the ambient animation holds still:
 * only real changes (the camel moving on, the clock turning) are drawn.
 */

export type FrameSource = (seconds: number, reduced: boolean) => DioramaFrame;

type Props = {
  hooks: SceneHooks;
  frame: FrameSource;
  seed?: number;
  className?: string;
  /** What the picture shows, for screen readers. */
  label: string;
};

export function SceneCanvas({ hooks, frame, seed = 2004, className, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hooksRef = useRef(hooks);
  const frameRef = useRef(frame);

  useEffect(() => {
    hooksRef.current = hooks;
    frameRef.current = frame;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const diorama = new Diorama(canvas, seed);
    let visible = true;
    let raf = 0;
    const start = performance.now();
    const paint = () => {
      const reduced = prefersReducedMotion();
      diorama.render(frameRef.current((performance.now() - start) / 1000, reduced), hooksRef.current);
    };
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      diorama.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2, window.devicePixelRatio || 1));
      paint();
    };
    const loop = () => {
      raf = 0;
      if (!visible) return;
      paint();
      raf = requestAnimationFrame(loop);
    };
    const resize = new ResizeObserver(fit);
    resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    seen.observe(canvas);
    fit();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
    };
  }, [seed]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />;
}
