"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/kit/appearance";
import { eraById } from "@/components/over-short/eras";
import { appearanceOf, useDarkAppearance } from "@/components/over-short/hooks";
import { DemoLoop } from "@/components/over-short/scene/demo";
import { paintRatio } from "@/components/over-short/scene/detail";
import styles from "./OverShortPreview.module.css";

/** The field gun firing on its own, silently, the shell's arc crossing the Western Front: a grey day, or a night under star shells. Rests when out of view. */
export function OverShortPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<DemoLoop | null>(null);
  const dark = useDarkAppearance();
  const darkRef = useRef(dark);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // A bigger gun than in the game: the card is small.
    const demo = new DemoLoop(canvas, eraById("great-war"), 404, 0.09);
    loopRef.current = demo;
    demo.setAppearance(appearanceOf(darkRef.current));
    let visible = true;
    let raf = 0;
    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      demo.frame(now);
      if (!prefersReducedMotion()) raf = requestAnimationFrame(loop);
    };
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      demo.resize(Math.max(1, box.width), Math.max(1, box.height), paintRatio());
      demo.frame(performance.now());
    };
    const sized = new ResizeObserver(fit);
    sized.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    seen.observe(canvas);
    fit();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sized.disconnect();
      seen.disconnect();
      loopRef.current = null;
    };
  }, []);

  useEffect(() => {
    darkRef.current = dark;
    loopRef.current?.setAppearance(appearanceOf(dark));
    loopRef.current?.frame(performance.now());
  }, [dark]);

  return (
    <div className={styles.preview}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={dark ? "Animated preview: a field gun fires at night, its shell arcing over the front under drifting star shells" : "Animated preview: a field gun fires, its shell arcing over shell-scarred fields under a grey sky"}
      />
    </div>
  );
}
