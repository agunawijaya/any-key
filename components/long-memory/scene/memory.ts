/*
 * "It remembers": the Learner consulting its Memory Book before a move it
 * once lost with. The book opens, a page turns, the remembered entry glows,
 * and a ghost of the old move (seeds made of light) rises from the pit it
 * is avoiding and drifts along the arcs it took that day, then fades.
 * Everything here is a pure function of the time since the moment began.
 */

import { BOOK, glowPoint, type BookPose } from "./book";
import { BOARD, HOLLOWS, holeTop } from "./layout";
import { clamp, lerp3, quatFromAxisAngle, smoothstep, type Vec3 } from "./math";
import type { SeedPose, Sprite } from "./Renderer";

export type Remembering = {
  /** Scene time the moment began. */
  start: number;
  /** The pit the Learner steers away from; null when it only reads its book and nothing in it applies. */
  avoided: number | null;
  /** Where that move's seeds went, hole by hole. */
  path: number[];
};

export const REMEMBER_TIMING = { open: 0.6, turnStart: 0.5, turn: 0.7, glowStart: 1.0, ghostStart: 1.15, ghostStagger: 0.2, ghostFlight: 0.9, fadeOut: 3.4, close: 4.2 };

const ease = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export function bookPoseAt(memory: Remembering | null, time: number): BookPose {
  if (!memory) return { open: 0, turn: -1, glow: 0 };
  const T = REMEMBER_TIMING;
  const t = time - memory.start;
  const closing = ease((t - T.close) / 0.6);
  const open = ease(t / T.open) * (1 - closing);
  const turning = (t - T.turnStart) / T.turn;
  const turn = turning > 0 && turning < 1 ? ease(turning) : -1;
  const glow = smoothstep(T.glowStart, T.glowStart + 0.5, t) * (1 - smoothstep(T.fadeOut, T.close, t));
  return { open, turn, glow };
}

/** A seed-sized pose for a ghost; ghosts share one shape so the eye reads them as one remembered move. */
function ghostPose(pos: Vec3, fade: number, i: number): SeedPose {
  return {
    pos,
    rotation: quatFromAxisAngle([0.3, 1, 0.2], i * 1.3),
    shape: [0.86, 0.68, 0.8],
    color: [1, 1, 1],
    look: [0, 0, 0, 1 - fade],
    radius: 0.78,
  };
}

function arc(from: Vec3, to: Vec3, apex: number, t: number): Vec3 {
  const p = lerp3(from, to, t);
  return [p[0], p[1] + 4 * apex * t * (1 - t), p[2]];
}

/** The ghost seeds of the remembered move at this moment. */
export function ghostsAt(memory: Remembering | null, time: number): SeedPose[] {
  if (!memory || memory.avoided === null) return [];
  const T = REMEMBER_TIMING;
  const t = time - memory.start - T.ghostStart;
  if (t < 0) return [];
  const fade = smoothstep(0, 0.35, t) * (1 - smoothstep(T.fadeOut - T.ghostStart - 0.8, T.fadeOut - T.ghostStart, t));
  const start = holeTop(memory.avoided);
  const lifted: Vec3 = [start[0], start[1] + 3.2, start[2]];
  return memory.path.map((hole, i) => {
    const local = (t - i * T.ghostStagger) / T.ghostFlight;
    const target = holeTop(hole);
    const to: Vec3 = [target[0], BOARD.top + 1.2, target[2]];
    const rise = smoothstep(0, 0.3, t);
    const from = lerp3([start[0], start[1] - 0.8, start[2]], lifted, rise);
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const pos = local <= 0 ? from : arc(from, to, 2.6 + distance * 0.16, ease(local));
    return ghostPose(pos, fade * (local > 1.2 ? 0.45 : 0.85), i);
  });
}

/** Light around the moment: the halo over the open book, motes rising off the page, a ring round the avoided pit, the old path in dots. */
export function memorySprites(memory: Remembering | null, time: number, book: BookPose, ghostColor: Vec3, glowColor: Vec3, night: boolean): Sprite[] {
  const sprites: Sprite[] = [];
  // Light added to a sunlit table washes out fast, so by day the glow is quieter.
  const strength = night ? 1 : 0.35;
  if (book.glow > 0.01) {
    const at = glowPoint(book);
    sprites.push({ kind: "glow", pos: at, size: 13, color: glowColor, alpha: 0.5 * book.glow * strength });
    sprites.push({ kind: "glow", pos: [at[0], at[1] - 1.5, at[2]], size: 6, color: glowColor, alpha: 0.6 * book.glow * strength });
    for (let i = 0; i < 16; i++) {
      const phase = (i * 0.618) % 1;
      const rise = (time * 0.32 + phase) % 1;
      const angle = i * 2.4;
      const spread = 2.5 + (i % 5) * 0.9;
      const p: Vec3 = [at[0] + Math.cos(angle) * spread, BOOK.cover + BOOK.pages + rise * 9, at[2] + Math.sin(angle) * spread * 0.7];
      sprites.push({ kind: "glow", pos: p, size: 0.45 + (i % 3) * 0.15, color: glowColor, alpha: book.glow * Math.sin(Math.PI * rise) * (night ? 0.9 : 1) });
    }
  }
  if (!memory || memory.avoided === null) return sprites;
  const T = REMEMBER_TIMING;
  const t = time - memory.start - T.ghostStart;
  if (t < -0.3) return sprites;
  const fade = smoothstep(-0.3, 0.3, t) * (1 - smoothstep(T.fadeOut - T.ghostStart - 0.8, T.fadeOut - T.ghostStart, t));
  const pit = HOLLOWS[memory.avoided];
  sprites.push({ kind: "ring", pos: [pit.cx, BOARD.top + 0.08, pit.cz], size: pit.ax * 1.32, color: ghostColor, alpha: 0.85 * fade, ring: 0.8 });
  sprites.push({ kind: "glow", pos: [pit.cx, BOARD.top + 1.2, pit.cz], size: 6, color: ghostColor, alpha: 0.3 * fade });
  for (const ghost of ghostsAt(memory, time)) sprites.push({ kind: "glow", pos: ghost.pos, size: 1.7, color: ghostColor, alpha: (night ? 0.5 : 0.3) * (1 - ghost.look[3]) });
  // The old route, dotted: each arc the remembered seeds flew.
  const start = holeTop(memory.avoided);
  const from: Vec3 = [start[0], start[1] + 3.2, start[2]];
  memory.path.forEach((hole, i) => {
    const target = holeTop(hole);
    const to: Vec3 = [target[0], BOARD.top + 1.2, target[2]];
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const shown = ease(clamp((t - i * T.ghostStagger) / T.ghostFlight));
    // A trail of light behind each ghost, brightest where the ghost is now.
    const steps = 26;
    for (let k = 1; k < steps; k++) {
      const u = k / steps;
      if (u > shown) break;
      const recent = 1 - (shown - u) / Math.max(shown, 0.01);
      sprites.push({ kind: "glow", pos: arc(from, to, 2.6 + distance * 0.16, u), size: 0.26 + 0.14 * recent, color: ghostColor, alpha: (0.25 + 0.6 * recent) * fade });
    }
    sprites.push({ kind: "ring", pos: [target[0], BOARD.top + 0.08, target[2]], size: HOLLOWS[hole].ax * 1.25, color: ghostColor, alpha: 0.35 * fade * shown, ring: 0.82, stretch: HOLLOWS[hole].az / HOLLOWS[hole].ax });
  });
  return sprites;
}
