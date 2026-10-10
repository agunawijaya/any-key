import type { Pt } from "./paint";

/*
 * A small pinhole camera for the scenes that need real perspective (a
 * keyboard seen over a pianist's shoulder, a DJ's decks). Points are in
 * centimetres, y up; the projection lands in the scene's 2D world units,
 * where the painter takes over. Nothing here touches WebGL: the shapes are
 * still painted flat, only their corners are projected.
 */

export type V3 = { x: number; y: number; z: number };

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const vadd = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vsub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vscale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const vdot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vcross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const vlen = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const vnorm = (a: V3): V3 => vscale(a, 1 / (vlen(a) || 1));
export const vlerp = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export type Projected = Pt & { /** World units per centimetre at that depth. */ k: number; depth: number };

export class Lens {
  private eye: V3;
  private right: V3;
  private up: V3;
  private forward: V3;
  /** World units per (centimetre / depth). */
  focal: number;
  /** Where the look-at point lands in the 2D world. */
  centre: Pt;

  constructor(eye: V3, target: V3, focal: number, centre: Pt = { x: 0, y: 0 }) {
    this.eye = eye;
    this.forward = vnorm(vsub(target, eye));
    this.right = vnorm(vcross(v3(0, 1, 0), this.forward));
    this.up = vcross(this.forward, this.right);
    this.focal = focal;
    this.centre = centre;
  }

  project(p: V3): Projected {
    const rel = vsub(p, this.eye);
    const depth = Math.max(1, vdot(rel, this.forward));
    const k = this.focal / depth;
    return { x: this.centre.x + vdot(rel, this.right) * k, y: this.centre.y - vdot(rel, this.up) * k, k, depth };
  }

  /** Distance from the eye along the view: for sorting what is drawn first. */
  depth(p: V3) {
    return vdot(vsub(p, this.eye), this.forward);
  }
}

/**
 * Two-bone IK in 3D: the elbow (or knee) for a reach from `root` to `target`,
 * bending towards `pole`.
 */
export function reach3(root: V3, target: V3, a: number, b: number, pole: V3): { mid: V3; end: V3 } {
  const to = vsub(target, root);
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, vlen(to)));
  const dir = vnorm(to);
  const end = vadd(root, vscale(dir, d));
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const along = a * cosA;
  const out = Math.sqrt(Math.max(0, a * a - along * along));
  // The pole, with its component along the reach removed, says which way the joint sticks out.
  const towardsPole = vsub(pole, root);
  const side = vnorm(vsub(towardsPole, vscale(dir, vdot(towardsPole, dir))));
  return { mid: vadd(root, vadd(vscale(dir, along), vscale(side, out))), end };
}
