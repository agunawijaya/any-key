"use client";

import { useEffect, useRef } from "react";
import { DARK, draw, LIGHT, type Boom } from "@/components/outta/render";
import { HumanBot } from "@/lib/outta/bot";
import { Game } from "@/lib/outta/engine";
import styles from "./OuttaPreview.module.css";

/**
 * A live game in miniature: the same human-like bot the balance checks use
 * plays Normal screens one after another, and the camera follows its star.
 * It only runs while it is on screen; with reduced motion it shows one still.
 */
export function OuttaPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seed = 1003;
    let game = new Game("normal", seed);
    let bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed });
    let endedAt = 0;
    const booms: Boom[] = [];
    let visible = true;
    let frame = 0;
    let last = performance.now();

    const step = (dt: number, now: number) => {
      if (game.state !== "playing") {
        if (!endedAt) endedAt = now;
        if (now - endedAt > 1.6) {
          seed += 1;
          game = new Game("normal", seed);
          bot = new HumanBot({ reaction: 0.35, stepEvery: 0.16, seed });
          endedAt = 0;
        }
        return;
      }
      bot.tick(game);
      game.update(dt);
      for (const e of game.drainEvents()) if (e.kind === "boom") booms.push({ x: e.x, y: e.y, at: now, cells: e.cells, chain: e.chain });
      while (booms.length && now - booms[0].at > 0.5) booms.shift();
    };

    const render = (now: number) => {
      const width = canvas.clientWidth;
      if (!width) return;
      const cell = width / 40;
      const keysH = Math.round(cell * 1.5);
      const height = Math.round(keysH + 6 + cell * game.rows + 4);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const boardW = cell * game.cols;
      const offsetX = Math.max(width - boardW, Math.min(0, width / 2 - (game.player.x + 0.5) * cell));
      const dark = document.documentElement.dataset.theme === "dark";
      draw(ctx, game, { cell, offsetX, keysH, width, height, now, reducedMotion: reduced }, dark ? DARK : LIGHT, booms);
    };

    if (reduced) {
      // One still from a few seconds in.
      for (let i = 0; i < 60 * 6; i++) step(1 / 60, i / 60);
      render(6);
      return;
    }

    const loop = (t: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!visible || document.hidden) return;
      step(dt, t / 1000);
      render(t / 1000);
    };
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    seen.observe(canvas);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
    };
  }, []);

  return (
    <div className={styles.preview} role="img" aria-label="Animated preview: a star finds its way down a screen of wood, glass and stone blocks while chasers patrol and blocks rain in">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
