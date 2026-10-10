import { add, blob, capsule, ellipse, norm, perp, scale, type Pt } from "../paint";

/*
 * A local frame along an instrument: u runs along its length (a flute from
 * the lips outwards, a guitar from the bridge to the head), v across it.
 * `fs` foreshortens u when the instrument points towards the audience.
 */

export type Axis = { o: Pt; ax: Pt; ay: Pt; fs: number; size: number };

export function axisFrom(o: Pt, direction: Pt, fs = 1, size = 1): Axis {
  const ax = norm(direction);
  return { o, ax, ay: perp(ax), fs, size };
}

export const along = (f: Axis, u: number, v = 0): Pt => add(f.o, add(scale(f.ax, u * f.fs * f.size), scale(f.ay, v * f.size)));

/** A tube from u0 to u1, its radius changing from r0 to r1. */
export const tube = (f: Axis, u0: number, u1: number, r0: number, r1 = r0) => capsule(along(f, u0), along(f, u1), r0 * f.size, r1 * f.size);

/** A shape given as (u, half-width) pairs, mirrored across the axis. */
export function profile(f: Axis, half: [number, number][]): Path2D {
  const a = half.map(([u, w]) => along(f, u, w));
  const b = half.map(([u, w]) => along(f, u, -w)).reverse();
  return blob([...a, ...b], 0.85);
}

/** A bell's open mouth: an ellipse across the axis at u, narrowed by how much it faces away. */
export const mouthOf = (f: Axis, u: number, r: number, open = 0.45) => {
  const c = along(f, u);
  return ellipse(c.x, c.y, Math.max(0.4, r * f.size * open), r * f.size, Math.atan2(f.ax.y, f.ax.x));
};
