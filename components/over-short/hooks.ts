"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { paintRatio } from "./scene/detail";
import type { Appearance } from "./scene/side";

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readDark = () => document.documentElement.dataset.theme === "dark";

/** True while the collection wears its dark appearance, live as the player switches it. */
export function useDarkAppearance() {
  return useSyncExternalStore(subscribeTheme, readDark, () => false);
}

/** The battlefield's own word for the appearance: day in light, a night barrage in dark. */
export const appearanceOf = (dark: boolean): Appearance => (dark ? "night" : "day");

export type Painter = {
  resize(width: number, height: number, dpr: number): void;
  setAppearance(appearance: Appearance): void;
  frame(now: number): void;
};

/**
 * Makes a painter for a canvas, keeps it sized to the canvas and in the
 * collection's appearance, and runs it every frame while `running` (when not
 * running it paints once whenever something changes, so a still scene stays
 * right). The painter is made again when `make` changes.
 */
export function useCanvasPainter<P extends Painter>(canvas: React.RefObject<HTMLCanvasElement | null>, make: (canvas: HTMLCanvasElement) => P, running: boolean) {
  const painter = useRef<P | null>(null);
  const dark = useDarkAppearance();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const p = make(element);
    painter.current = p;
    p.setAppearance(appearanceOf(readDark()));
    let raf = 0;
    const measure = () => {
      const box = element.getBoundingClientRect();
      p.resize(Math.max(1, box.width), Math.max(1, box.height), paintRatio());
      if (!running) p.frame(performance.now());
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(element);
    const loop = (now: number) => {
      p.frame(now);
      raf = requestAnimationFrame(loop);
    };
    if (running) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      painter.current = null;
    };
  }, [canvas, make, running]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    p.setAppearance(appearanceOf(dark));
    if (!running) p.frame(performance.now());
  }, [dark, running]);

  return painter;
}
