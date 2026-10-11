"use client";

import { useEffect, useRef, useState } from "react";
import type { StyleId } from "@/lib/sol-y-sombra/progress";
import type { RingOptions } from "@/lib/sol-y-sombra/rig/ring";
import { bannerFont, headlineFont, printFont } from "../fonts";
import { createStyle } from "../styles/style";
import { CorridaStage } from "./stage";

/*
 * The one canvas behind every screen of the game: the ring in the Vintage
 * Poster style, made once, sized with its box, following the appearance,
 * and resting while the page is hidden, the Story tab is open or the game
 * is paused.
 */

/** A stable handle for the screens; the stage itself arrives once the canvas exists. */
export class StageHandle {
  stage: CorridaStage | null = null;
  /** Nothing moves while this is set (the pause menu, the Story tab, a covering screen). */
  frozen = false;

  attach(stage: CorridaStage | null) {
    this.stage = stage;
  }

  freeze(on: boolean) {
    this.frozen = on;
  }
}

const readDark = () => document.documentElement.dataset.theme === "dark";

export function useCorridaStage(opening: RingOptions, density: number, style: StyleId) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => new StageHandle());
  const [ready, setReady] = useState(false);
  // The stage is made once, with whatever the ring and the stands were when the game opened.
  const [first] = useState(() => ({ opening, density, style }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const style = createStyle(first.style, canvas);
    if (!style) return;
    const stage = new CorridaStage(style, first.opening, first.density);
    handle.attach(stage);
    let dark = readDark();
    let width = 0;
    let height = 0;
    let fonts = false;

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = box.width;
      height = box.height;
      stage.resize(width, height, dpr);
      // The poster's unit, for the HUD to sit inside the poster's window as the painter lays it out.
      canvas.parentElement?.style.setProperty("--u", `${Math.min(width / 1920, height / 1080)}px`);
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(canvas);
    const theme = new MutationObserver(() => (dark = readDark()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // The lettering waits for its fonts, so the first frame isn't printed in a fallback face.
    Promise.all([headlineFont, bannerFont, printFont].map((f) => document.fonts.load(`40px ${f.style.fontFamily}`))).finally(() => {
      fonts = true;
      canvas.dataset.ready = "true";
      setReady(true);
    });

    let raf = 0;
    let last = performance.now();
    let painted = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = handle.stage;
      if (!s || !fonts || width === 0) return;
      if (!handle.frozen && !document.hidden) s.advance(dt);
      // Frozen, the picture only needs repainting now and then (a theme switch, a resize).
      if (handle.frozen && now - painted < 250) return;
      painted = now;
      s.paint(dark);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      theme.disconnect();
      stage.release();
      handle.attach(null);
    };
  }, [first, handle]);

  return { canvasRef, handle, ready };
}
