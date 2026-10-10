"use client";

import { useEffect, useRef, useState } from "react";
import { bookFont, shoutFont } from "./fonts";
import type { SceneFrame } from "./scene/view";
import { styleEntry } from "./styles";
import type { PitStyle, ReleaseMoment, StyleId } from "./styles/style";

/*
 * One canvas behind every screen of the game, drawn by the chosen style.
 * Whatever screen is showing hands it a painter: called every animation
 * frame with the time, it says what to draw (a moment in the pit, or the
 * release page). The loop sleeps while the canvas is off screen or the
 * Story tab covers it.
 */

export type Painting = { kind: "pit"; frame: SceneFrame } | { kind: "release"; moment: ReleaseMoment };
export type Painter = (time: number, dt: number) => Painting | null;

export function usePitCanvas(styleId: StyleId, night: boolean, running: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const styleRef = useRef<PitStyle | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const nightRef = useRef(night);
  const runningRef = useRef(running);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    nightRef.current = night;
    styleRef.current?.setNight(night);
  }, [night]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const fonts = { shout: shoutFont.style.fontFamily, book: bookFont.style.fontFamily };
    const style = styleEntry(styleId).create(ctx, fonts);
    style.setNight(nightRef.current);
    styleRef.current = style;
    let radius = -1;
    let raf = 0;
    let visible = true;
    let fontsReady = false;
    let last = performance.now();

    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
      style.resize(Math.max(1, box.width), Math.max(1, box.height), dpr);
      setSize({ width: box.width, height: box.height });
    };
    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const painting = runningRef.current && fontsReady ? painterRef.current?.(now / 1000, dt) : null;
      if (painting?.kind === "pit") {
        if (painting.frame.board.radius !== radius) {
          radius = painting.frame.board.radius;
          style.setBoard(painting.frame.board);
        }
        style.render(painting.frame);
      } else if (painting?.kind === "release") style.renderRelease(painting.moment);
      raf = requestAnimationFrame(loop);
    };
    const sizing = new ResizeObserver(fit);
    sizing.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    seen.observe(canvas);
    fit();
    // Canvas text only uses a web font once it has loaded.
    Promise.all([document.fonts.load(`64px ${fonts.shout}`), document.fonts.load(`32px ${fonts.book}`)]).finally(() => {
      fontsReady = true;
      setReady(true);
      canvas.dataset.ready = "true";
    });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      seen.disconnect();
      style.dispose();
      styleRef.current = null;
    };
  }, [styleId]);

  // What screens get: stable functions, so nothing reaches into the refs while React renders.
  const [api] = useState<PitCanvasApi>(() => ({
    setPainter: (painter) => {
      painterRef.current = painter;
    },
    style: () => styleRef.current,
  }));

  return { canvasRef, api, ready, size };
}

export type PitCanvasApi = {
  /** Hands the canvas the screen's painter; null leaves the last picture. */
  setPainter(painter: Painter | null): void;
  /** The style drawing the canvas, for laying buttons over it; null before it starts. */
  style(): PitStyle | null;
};
