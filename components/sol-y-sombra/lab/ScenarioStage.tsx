"use client";

import { useEffect, useRef, useState } from "react";
import type { BeatRequest, RingOptions } from "@/lib/sol-y-sombra/rig/ring";
import { bannerFont, headlineFont, printFont } from "../fonts";
import { CorridaStage } from "../scene/stage";
import { PosterPainter } from "../styles/poster/PosterPainter";
import styles from "../hero/HeroStage.module.css";

/*
 * The lab's scenes: whole stretches of an afternoon (a goring and what
 * follows, the finish and the lap, the paseo and the bull's entrance) played
 * by the game's own stage, for judging the beats between passes.
 * `?scene=gored|help|retire|finish|miss|paseo`, `?t=` to freeze at a moment;
 * `?record=1` hands the clock to `window.__scene` for a recorder to step.
 */

/** A beat, or a beat worked out from the stage when its turn comes (a salute faces the best stands then). */
type Step = BeatRequest | ((stage: CorridaStage) => BeatRequest);
type Scenario = { options: RingOptions; program: Step[] };

const SCENARIOS: Record<string, Scenario> = {
  gored: {
    options: { crew: true },
    program: [
      { kind: "pass", pass: "veronica", side: -1, paw: true },
      { kind: "pass", pass: "veronica", side: 1, outcome: "gored" },
      { kind: "down", seconds: 5 },
      { kind: "rise" },
      { kind: "site" },
      { kind: "pass", pass: "veronica", side: -1, outcome: "close" },
      { kind: "wait", seconds: 2 },
    ],
  },
  help: {
    options: { crew: true },
    program: [
      { kind: "pass", pass: "veronica", side: 1, paw: true, outcome: "gored" },
      { kind: "down", seconds: 4 },
      { kind: "helped-off", serious: true },
      { kind: "wait", seconds: 2 },
    ],
  },
  retire: {
    options: { crew: true },
    program: [
      { kind: "pass", pass: "outside", side: -1, paw: true, outcome: "gored" },
      { kind: "down", seconds: 4 },
      { kind: "helped-off", serious: false },
      { kind: "wait", seconds: 2 },
    ],
  },
  finish: {
    options: { crew: true },
    program: [
      { kind: "pass", pass: "veronica", side: -1, paw: true },
      { kind: "pass", pass: "over-the-horns", side: -1, outcome: "rests" },
      (stage) => ({ kind: "salute", seconds: 4, facing: stage.saluteFacing() }),
      { kind: "bull-leaves" },
      { kind: "lap" },
      { kind: "wait", seconds: 2 },
    ],
  },
  miss: {
    options: { crew: true },
    program: [
      { kind: "pass", pass: "waiting", side: -1, paw: true },
      { kind: "site" },
      { kind: "pass", pass: "over-the-horns", side: -1, outcome: "gored" },
      { kind: "down", seconds: 4 },
      { kind: "rise" },
      { kind: "wait", seconds: 2 },
    ],
  },
  paseo: {
    options: { crew: true, opening: "paseo" },
    program: [
      { kind: "paseo" },
      { kind: "bull-enters" },
      { kind: "crew-work" },
      { kind: "site" },
      { kind: "pass", pass: "veronica", side: -1 },
      { kind: "wait", seconds: 2 },
    ],
  },
};

const readDark = () => document.documentElement.dataset.theme === "dark";

declare global {
  interface Window {
    __scene?: { advance(seconds: number): void; time(): number; beat(): string };
  }
}

export function ScenarioStage({ scene, frozen }: { scene: string; frozen: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const scenario = SCENARIOS[scene] ?? SCENARIOS.gored;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const make = () => {
      let next = 0;
      const made: CorridaStage = new CorridaStage(new PosterPainter(ctx), {
        ...scenario.options,
        program: [],
        loop: false,
        supply: () => {
          const step = scenario.program[next++];
          return typeof step === "function" ? step(made) : step;
        },
      });
      return made;
    };
    let stage = make();
    let dark = readDark();
    let width = 0;
    let height = 0;
    let ready = false;
    let lastLabel = "";

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = box.width;
      height = box.height;
      stage.resize(width, height, dpr);
    };
    measure();
    const sizing = new ResizeObserver(measure);
    sizing.observe(canvas);
    const theme = new MutationObserver(() => (dark = readDark()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const recording = new URLSearchParams(window.location.search).get("record") === "1";
    const stillAt = frozen === null ? (recording ? 0 : null) : Number(frozen);
    if (stillAt !== null) for (let t = 0; t < stillAt; t += 1 / 60) stage.advance(Math.min(1 / 60, stillAt - t));

    const end = scenario.program.length;
    Promise.all([headlineFont, bannerFont, printFont].map((f) => document.fonts.load(`40px ${f.style.fontFamily}`))).finally(() => {
      ready = true;
      canvas.dataset.ready = "true";
    });

    if (recording) {
      window.__scene = {
        advance: (seconds) => {
          for (let t = 0; t < seconds - 1e-9; t += 1 / 60) stage.advance(Math.min(1 / 60, seconds - t));
        },
        time: () => stage.seconds,
        beat: () => stage.ring.beatKind,
      };
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (stillAt === null) {
        stage.advance(dt);
        // Once the program has run out and the ring has stood a while, start again.
        if (stage.ring.beatNumber > end + 2) stage = make();
      }
      const text = `${stage.ring.beatKind} · ${stage.seconds.toFixed(1)} s`;
      if (text.split(" · ")[0] !== lastLabel) {
        lastLabel = text.split(" · ")[0];
        setLabel(lastLabel);
      }
      stage.lettering = { subtitle: `Lab scene: ${scene}`, ribbon: stage.ring.beatKind.toUpperCase() };
      if (ready) stage.paint(dark);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      theme.disconnect();
    };
  }, [scene, frozen]);

  return (
    <div className={`${styles.stage} ${headlineFont.variable} ${bannerFont.variable} ${printFont.variable}`}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label={`Lab scene: ${label}`} />
    </div>
  );
}
