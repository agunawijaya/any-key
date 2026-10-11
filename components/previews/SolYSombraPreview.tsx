"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/components/kit/hooks";
import { bannerFont, headlineFont, printFont } from "@/components/sol-y-sombra/fonts";
import { attract } from "@/components/sol-y-sombra/scene/attract";
import { CorridaStage } from "@/components/sol-y-sombra/scene/stage";
import { createStyle } from "@/components/sol-y-sombra/styles/style";
import styles from "./SolYSombraPreview.module.css";

/**
 * The Hall's living poster: the matador passing the bull with veronicas,
 * silently, in the Vintage Poster style. The same seed plays the same loop.
 * It rests when out of view, and holds one still frame for reduced motion.
 */
export function SolYSombraPreview({ seed = "sol-y-sombra/hall" }: { seed?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const style = createStyle("poster", canvas);
    if (!style) return;
    // Half-full stands: the Hall shows several previews at once.
    const stage = new CorridaStage(style, attract(seed), 0.5);
    stage.letter("One cape · one charge · hold still", null);
    stage.configure({ slowMotion: true, stillCrowd: reduced });
    let dark = document.documentElement.dataset.theme === "dark";
    let visible = false;
    let fonts = false;

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      stage.resize(box.width, box.height, Math.min(2, window.devicePixelRatio || 1));
    };
    measure();
    const sized = new ResizeObserver(measure);
    sized.observe(canvas);
    const theme = new MutationObserver(() => (dark = document.documentElement.dataset.theme === "dark"));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(canvas);
    // Reduced motion: one still frame, at the horns' closest moment of the first veronica.
    if (reduced) stage.advance(3.1, false);
    Promise.all([headlineFont, bannerFont, printFont].map((f) => document.fonts.load(`40px ${f.style.fontFamily}`))).finally(() => {
      fonts = true;
      canvas.dataset.ready = "true";
    });

    let raf = 0;
    let last = performance.now();
    let painted = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!fonts || !visible || document.hidden) return;
      if (!reduced) stage.advance(dt);
      else if (now - painted < 500) return;
      painted = now;
      stage.paint(dark);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sized.disconnect();
      theme.disconnect();
      seen.disconnect();
    };
  }, [reduced, seed]);

  return (
    <div className={`${styles.preview} ${headlineFont.variable} ${bannerFont.variable} ${printFont.variable}`}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
