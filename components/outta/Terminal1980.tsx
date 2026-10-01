"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Escape1980, VIDEO, type Key } from "@/lib/outta/original";
import { updateProgress, withAchievement } from "@/lib/outta/progress";
import styles from "./Terminal1980.module.css";

/*
 * 1980 mode: the original program on a TRS-80-sized screen, 64 × 16
 * characters, white phosphor, no colours, no score. Nothing is added to the
 * screen itself; the notes about where your star has got to sit underneath.
 */

/** Our own 5 × 7 dot letters for the few characters the program and BASIC ever show. */
const GLYPHS: Record<string, string[]> = {
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  A: ["00100", "01010", "10001", "10001", "11111", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

const KEYS: Record<string, Key> = {
  ArrowLeft: ",",
  ",": ",",
  ArrowRight: ".",
  ".": ".",
  ArrowUp: "[",
  "[": "[",
  ArrowDown: "\n",
};

const PHOSPHOR = "#DCE8FF";
const BEFORE = new Uint8Array(1024).fill(32);
"READY".split("").forEach((c, i) => (BEFORE[i] = c.charCodeAt(0)));
">RUN".split("").forEach((c, i) => (BEFORE[64 + i] = c.charCodeAt(0)));

type Hud = { state: Escape1980["state"] | "ready"; t: number; keys: number; blocks: number; where: ReturnType<Escape1980["where"]>; p: number };

/** One character cell: a letter from GLYPHS, or one of the TRS-80's 2 × 3 block graphics (codes 128–191). */
function drawCell(ctx: CanvasRenderingContext2D, code: number, x: number, y: number, dw: number, dh: number) {
  const left = x * 6 * dw;
  const top = y * 12 * dh;
  if (code >= 128 && code <= 191) {
    const bits = code - 128;
    for (let k = 0; k < 6; k++) {
      if (bits & (1 << k)) ctx.fillRect(left + (k % 2) * 3 * dw, top + Math.floor(k / 2) * 4 * dh, 3 * dw + 0.5, 4 * dh + 0.5);
    }
    return;
  }
  const glyph = GLYPHS[String.fromCharCode(code)];
  if (!glyph) return;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) if (glyph[r][c] === "1") ctx.fillRect(left + c * dw, top + (r + 2) * dh, dw + 0.4, dh + 0.4);
  }
}

export function Terminal1980({ onExit, onUnlock }: { onExit: () => void; onUnlock: (ids: string[]) => void }) {
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState<Hud>({ state: "ready", t: 0, keys: 0, blocks: 0, where: "screen", p: VIDEO });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<Escape1980 | null>(null);
  const startedRef = useRef(false);
  const unlockRef = useRef(onUnlock);

  useEffect(() => {
    unlockRef.current = onUnlock;
  });

  useEffect(() => {
    const machine = new Escape1980(1 + Math.floor(Math.random() * 1e9));
    machineRef.current = machine;
    startedRef.current = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let garbage: Uint8Array | null = null;
    let crashedAt = 0;
    let reported = false;
    let last = performance.now();
    let lastHud = 0;
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (startedRef.current) machine.update(dt);
      if (machine.state !== "running" && !reported) {
        reported = true;
        crashedAt = now;
        unlockRef.current(updateProgress((p) => withAchievement(p, machine.state === "ended" ? "scape" : "crash-test")));
      }
      // Our impression of the crash: the picture freezes, then memory spills onto the screen.
      if (machine.state === "crashed" && !garbage && now - crashedAt > 700) {
        garbage = machine.screen.slice();
        for (let i = 0; i < garbage.length; i++) if (Math.random() < 0.55) garbage[i] = Math.random() < 0.7 ? 128 + Math.floor(Math.random() * 64) : 65 + Math.floor(Math.random() * 26);
      }

      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (canvas && wrap) {
        const width = wrap.clientWidth;
        const height = Math.round(width * 0.75);
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(width * dpr)) {
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
          canvas.style.height = `${height}px`;
        }
        const ctx = canvas.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = PHOSPHOR;
        const dw = width / 384;
        const dh = height / 192;
        const screen = !startedRef.current ? BEFORE : (garbage ?? machine.screen);
        for (let i = 0; i < 1024; i++) if (screen[i] !== 32) drawCell(ctx, screen[i], i % 64, Math.floor(i / 64), dw, dh);
        // BASIC's cursor, blinking after the prompt.
        const prompt = !startedRef.current ? 64 + 4 : machine.state === "ended" ? 2 * 64 + 1 : -1;
        if (prompt >= 0 && (reduced || Math.floor(now / 500) % 2 === 0)) drawCell(ctx, 128 + 48, prompt % 64, Math.floor(prompt / 64), dw, dh);
      }
      if (now - lastHud > 100) {
        lastHud = now;
        setHud({ state: startedRef.current ? machine.state : "ready", t: machine.t, keys: machine.keys, blocks: machine.blocks, where: machine.where(), p: machine.p });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const again = useCallback(() => setRun((r) => r + 1), []);
  const press = useCallback((key: Key | "enter") => {
    const machine = machineRef.current;
    if (!machine) return;
    if (!startedRef.current) {
      if (key === "enter") startedRef.current = true;
      return;
    }
    machine.press(key === "enter" ? "other" : key);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (/^(Shift|Control|Alt|Meta|CapsLock|Tab)$/.test(e.key)) return;
      const machine = machineRef.current;
      if (e.key === "Escape") return onExit();
      if (machine && machine.state !== "running") {
        if (e.key === "r" || e.key === "R" || e.key === "Enter") again();
        return;
      }
      e.preventDefault();
      // The TRS-80 has no key repeat for INKEY$: one press, one step.
      press(e.key === "Enter" ? "enter" : (KEYS[e.key] ?? "other"));
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [again, onExit, press]);

  const row = Math.floor((hud.p - VIDEO) / 64);
  const col = (((hud.p - VIDEO) % 64) + 64) % 64;
  const place =
    hud.where === "screen"
      ? `row ${row}, column ${col}`
      : hud.where === "keyboard"
        ? `${VIDEO - hud.p} bytes below the screen, in the keyboard's memory: your star is there, but nothing shows`
        : hud.p >= VIDEO + 1024
          ? "past the end of the screen, in the computer's working memory"
          : "further down, below the keyboard's memory: invisible, and rather lost";

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onExit}>
          ← Lobby
        </button>
        <span className={styles.pill}>1980 mode</span>
        <p className={styles.note}>The original program: no score, no messages, and every bug still in it. Only the letters are ours.</p>
      </div>

      <div className={styles.bezel}>
        <div className={styles.glass} ref={wrapRef}>
          <canvas ref={canvasRef} className={styles.canvas} aria-label={`TRS-80 screen. ${hud.state === "ready" ? "Press Enter to run the program." : `Your star is at ${place}.`}`} />
        </div>
      </div>

      <div className={styles.readout} aria-live="polite">
        {hud.state === "ready" && (
          <p>
            Press <kbd>Enter</kbd> to run it. Then reach the <b>+</b>. Every moment you aren&rsquo;t pressing a key, another block falls.
          </p>
        )}
        {hud.state === "running" && (
          <p>
            <span className={styles.addr}>P = {hud.p}</span> {place}
          </p>
        )}
        {hud.state === "ended" && (
          <p>
            That&rsquo;s it: the program just stops. You got out in <b>{hud.t.toFixed(1)} s</b> with {hud.keys} key presses, while {hud.blocks} blocks
            fell. <button type="button" className={styles.again} onClick={again}>Run it again <kbd>R</kbd></button>
          </p>
        )}
        {hud.state === "crashed" && (
          <p>
            You walked off the end of the screen to address {hud.p}, and the star was written over the start of the computer&rsquo;s working
            memory. The real machine would almost certainly have crashed; this is our impression of it. <button type="button" className={styles.again} onClick={again}>Switch it off and on <kbd>R</kbd></button>
          </p>
        )}
      </div>

      <div className={styles.keys}>
        <span>
          <kbd>,</kbd> left
        </span>
        <span>
          <kbd>.</kbd> right
        </span>
        <span>
          <kbd>↑</kbd> up
        </span>
        <span>
          <kbd>↓</kbd> down
        </span>
        <span>(arrow keys work too) · any other key clears a block that lands on you</span>
      </div>

      <div className={styles.touch} aria-label="Touch keys">
        {(
          [
            [",", ","],
            [".", "."],
            ["↑", "["],
            ["↓", "\n"],
          ] as [string, Key][]
        ).map(([label, key]) => (
          <button key={label} type="button" onPointerDown={() => press(key)}>
            {label}
          </button>
        ))}
        <button type="button" onPointerDown={() => (hud.state === "ready" ? press("enter") : hud.state === "running" ? press("other") : again())}>
          {hud.state === "ready" ? "RUN" : hud.state === "running" ? "any key" : "again"}
        </button>
      </div>
    </div>
  );
}
