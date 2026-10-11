"use client";

import { useEffect, useRef } from "react";
import { bannerFont, headlineFont, printFont } from "../fonts";
import { Camera } from "../render/camera";
import { PosterPainter } from "../styles/poster/PosterPainter";
import { SHOTS } from "./shots";
import styles from "./HeroStage.module.css";

/*
 * A stage for the hero frames: one shot, painted live in the Vintage Poster
 * style by the real rig. `?shot=veronica|crowd|shoulders` picks it; `?t=`
 * freezes it at a moment (the shot's own still if `t=still`).
 */

const readDark = () => document.documentElement.dataset.theme === "dark";

export function HeroStage({ shot: name, frozen }: { shot: string; frozen: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shot = SHOTS[name] ?? SHOTS.veronica;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const painter = new PosterPainter(ctx);
    const camera = new Camera();
    let state = shot.create();
    let dark = readDark();
    let width = 0;
    let height = 0;
    let ready = false;

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = box.width;
      height = box.height;
      painter.resize(width, height, dpr);
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(canvas);
    const theme = new MutationObserver(() => (dark = readDark()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const stillAt = frozen === null ? null : frozen === "still" ? shot.still : Number(frozen);
    if (stillAt !== null) for (let t = 0; t < stillAt; t += 1 / 60) shot.advance(state, Math.min(1 / 60, stillAt - t));

    // `?view=eye.x,eye.y,eye.z,at.x,at.y,at.z,fov` overrides the shot's camera, for composing.
    const view = new URLSearchParams(window.location.search).get("view")?.split(",").map(Number);
    const paint = () => {
      const scene = shot.compose(state, camera);
      if (view && view.length === 7) camera.look({ x: view[0], y: view[1], z: view[2] }, { x: view[3], y: view[4], z: view[5] }, view[6]);
      painter.paint(scene, camera, dark);
    };
    // The lettering waits for its fonts, so the first frame isn't printed in a fallback face.
    Promise.all([headlineFont, bannerFont, printFont].map((f) => document.fonts.load(`40px ${f.style.fontFamily}`))).finally(() => {
      ready = true;
      canvas.dataset.ready = "true";
    });

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (stillAt === null) {
        shot.advance(state, dt);
        if (state.time > shot.loop) state = shot.create();
      }
      if (ready) paint();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      theme.disconnect();
    };
  }, [name, frozen]);

  return (
    <div className={`${styles.stage} ${headlineFont.variable} ${bannerFont.variable} ${printFont.variable}`}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="A bullfight poster brought to life" />
    </div>
  );
}
