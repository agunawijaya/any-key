import { type Vec3 } from "./vec";

/*
 * A Verlet rope hanging from a moving anchor: the bull's tail, the tassels
 * at the matador's knees, the fringe on his shoulders. Each link keeps its
 * length; the root follows the body it hangs from; the rest swings.
 */

export type ChainShape = {
  links: number;
  /** Length of one link, in metres. */
  linkLength: number;
  /** 1 swings freely; lower values let the rope keep its bend, like a stiff tail. */
  limpness: number;
  damping: number;
};

export class Chain {
  readonly shape: ChainShape;
  readonly points: Vec3[];
  private readonly prev: Vec3[];

  constructor(shape: ChainShape, anchor: Vec3, hang: Vec3 = { x: 0, y: -1, z: 0 }) {
    this.shape = shape;
    this.points = [];
    this.prev = [];
    for (let i = 0; i <= shape.links; i++) {
      const p = {
        x: anchor.x + hang.x * shape.linkLength * i,
        y: anchor.y + hang.y * shape.linkLength * i,
        z: anchor.z + hang.z * shape.linkLength * i,
      };
      this.points.push(p);
      this.prev.push({ ...p });
    }
  }

  /** Moves the root to `anchor`; `rest` is the direction the rope prefers from there (a tail's set), weighted by stiffness. */
  step(dt: number, anchor: Vec3, rest: Vec3, gravity: number, wind: Vec3 = { x: 0, y: 0, z: 0 }) {
    const { points, prev, shape } = this;
    points[0] = { ...anchor };
    prev[0] = { ...anchor };
    const dt2 = dt * dt;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const q = prev[i];
      const vx = (p.x - q.x) * shape.damping;
      const vy = (p.y - q.y) * shape.damping;
      const vz = (p.z - q.z) * shape.damping;
      prev[i] = { ...p };
      points[i] = {
        x: p.x + vx + wind.x * 0.02 * dt2,
        y: Math.max(0.01, p.y + vy - gravity * dt2),
        z: p.z + vz + wind.z * 0.02 * dt2,
      };
    }
    const stiffness = 1 - shape.limpness;
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        // A stiff rope leans towards its rest direction before its length is kept.
        if (stiffness > 0) {
          // Stiff at the root, loose at the end: a tail is bone at its base and hair at its tip.
          const k = stiffness * 0.3 * (1 - i / points.length) ** 3;
          b.x += (a.x + rest.x * shape.linkLength - b.x) * k;
          b.y += (a.y + rest.y * shape.linkLength - b.y) * k;
          b.z += (a.z + rest.z * shape.linkLength - b.z) * k;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dy, dz) || 1e-9;
        const f = shape.linkLength / len;
        b.x = a.x + dx * f;
        b.y = Math.max(0.01, a.y + dy * f);
        b.z = a.z + dz * f;
      }
    }
  }
}
