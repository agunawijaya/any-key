"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Arrangement } from "@/lib/music/arrange/types";
import { barIndexAt } from "@/lib/music/tempo";
import { firstSoundingFrom, indexTracks, keyShapes } from "@/lib/music/timeline";
import type { Clock } from "../BopBox";
import styles from "./FallingView.module.css";

type Props = { arrangement: Arrangement; clock: Clock; range: [number, number]; muted: Set<string> };

/** Notes rain down onto the keyboard below, like a piano tutorial video. */
export function FallingView({ arrangement, clock, range, muted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexes = useMemo(() => indexTracks(arrangement).filter((i) => !i.track.patch.drums), [arrangement]);
  const { keys, width: whiteCount } = useMemo(() => keyShapes(range[0], range[1]), [range]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const byPitch = new Map(keys.map((k) => [k.pitch, k]));
    const lookahead = arrangement.barBeats * 2;
    // Stage colours come from CSS so the canvas follows light and dark themes.
    let palette = { faint: "", line: "", shade: 0 };
    let frames = 0;
    const readPalette = () => {
      const css = getComputedStyle(canvas);
      palette = {
        faint: css.getPropertyValue("--stage-faint").trim() || "rgb(255 255 255 / 0.05)",
        line: css.getPropertyValue("--stage-line").trim() || "rgb(255 255 255 / 0.16)",
        shade: parseFloat(css.getPropertyValue("--lit-shade")) || 0,
      };
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (frames++ % 20 === 0) readPalette();
      const beat = clock.beat();
      const unit = w / whiteCount;
      const pxPerBeat = h / lookahead;

      // Octave lanes and moving bar lines.
      ctx.fillStyle = palette.faint;
      for (const key of keys) if (!key.black && key.pitch % 12 === 0) ctx.fillRect(key.x * unit, 0, 1, h);
      const grid = arrangement.grid;
      for (let i = barIndexAt(grid, beat); i < grid.length && grid[i].at <= beat + lookahead; i++) {
        const bar = grid[i];
        const step = bar.len / (bar.len % 3 === 0 ? 3 : 4);
        for (let b = bar.at; b < bar.at + bar.len - 1e-6 && b <= beat + lookahead; b += step) {
          ctx.fillStyle = b === bar.at ? palette.line : palette.faint;
          ctx.fillRect(0, h - (b - beat) * pxPerBeat, w, 1);
        }
      }

      for (const index of indexes) {
        if (muted.has(index.track.id)) continue;
        const color = darken(index.track.color, palette.shade / 100);
        for (let i = firstSoundingFrom(index, beat - 0.1); i < index.notes.length; i++) {
          const note = index.notes[i];
          if (note.at > beat + lookahead) break;
          if (note.at + note.dur < beat - 0.1) continue;
          const key = byPitch.get(note.pitch);
          if (!key) continue;
          const x = key.x * unit + 1.5;
          const nw = key.w * unit - 3;
          const bottom = h - (note.at - beat) * pxPerBeat;
          const top = Math.max(-10, bottom - Math.max(0.12, note.dur) * pxPerBeat);
          const active = note.at <= beat && note.at + note.dur > beat;
          ctx.globalAlpha = active ? 1 : 0.35 + (note.vel / 127) * 0.55;
          ctx.shadowColor = color;
          ctx.shadowBlur = active ? 18 : 0;
          ctx.fillStyle = color;
          roundRect(ctx, x, top, nw, Math.max(3, Math.min(bottom, h) - top), Math.min(6, nw / 2));
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [arrangement, clock, indexes, keys, muted, whiteCount]);

  return (
    <div className={styles.view}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
      <p className={styles.caption}>Each colour is a different instrument. Notes land on their keys below.</p>
    </div>
  );
}

/** Mixes a hex colour toward black, for bright notes on a light stage. */
function darken(hex: string, amount: number) {
  if (!amount) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${f(n >> 16)} ${f((n >> 8) & 255)} ${f(n & 255)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
