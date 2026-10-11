import { type Vec3 } from "./vec";

/*
 * A Verlet cloth: a grid of particles held together by distance constraints,
 * pushed by gravity and by the air, pushed out of the bodies it meets, and
 * pinned where a hand holds it. The cape is one, the banners in the stands
 * are others.
 *
 * Particles live in flat typed arrays (x, y, z per particle) because the
 * cape runs at 240 steps a second. Column 0 is the cloth's left edge as seen
 * from its front face, row 0 its top edge.
 */

export type ClothShape = {
  columns: number;
  rows: number;
  /** Width along the top edge and along the hem, in metres: a cape flares towards its hem. */
  topWidth: number;
  bottomWidth: number;
  height: number;
  /** The whole cloth's weight, in kilograms. */
  mass: number;
};

export type Sphere = { kind: "sphere"; c: Vec3; r: number };
export type Capsule = { kind: "capsule"; a: Vec3; b: Vec3; r: number };
export type Collider = Sphere | Capsule;

export type ClothForces = {
  gravity: number;
  wind: Vec3;
  /** How strongly the air pushes on the cloth's faces: half the air's density times a drag coefficient. */
  airDrag: number;
};

type Pin = { index: number; target: Vec3; weight: number };

const STRETCH = 1;
const SHEAR = 0.7;
const BEND = 0.12;
const DAMPING = 0.998;
const GROUND = 0.012;
const GROUND_FRICTION = 0.55;
const BODY_FRICTION = 0.05;

/** The furthest a loosely held pin pulls its particle in one step, in metres. */
const MAX_GATHER = 0.012;

export class Cloth {
  readonly shape: ClothShape;
  readonly count: number;
  readonly pos: Float64Array;
  readonly prev: Float64Array;
  /** Where each particle sits on the flat cloth, 0–1 across and down: for drawing patterns and hems. */
  readonly uv: Float32Array;
  /** Triangles, three particle indices each, wound so the normal faces the front. */
  readonly triangles: Uint16Array;
  private readonly links: Uint16Array;
  private readonly restLengths: Float32Array;
  private readonly stiffness: Float32Array;
  private readonly pinned: Uint8Array;
  private pins: Pin[] = [];
  private readonly particleMass: number;
  private readonly force: Float64Array;
  iterations = 4;
  colliders: Collider[] = [];

  constructor(shape: ClothShape) {
    this.shape = shape;
    const { columns, rows } = shape;
    this.count = columns * rows;
    this.pos = new Float64Array(this.count * 3);
    this.prev = new Float64Array(this.count * 3);
    this.force = new Float64Array(this.count * 3);
    this.uv = new Float32Array(this.count * 2);
    this.pinned = new Uint8Array(this.count);
    this.particleMass = shape.mass / this.count;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const i = r * columns + c;
        this.uv[i * 2] = c / (columns - 1);
        this.uv[i * 2 + 1] = r / (rows - 1);
      }
    }

    const tris: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < columns - 1; c++) {
        const a = r * columns + c;
        const b = a + 1;
        const d = a + columns;
        const e = d + 1;
        tris.push(a, d, b, b, d, e);
      }
    }
    this.triangles = Uint16Array.from(tris);

    const links: number[] = [];
    const kinds: number[] = [];
    const link = (c1: number, r1: number, c2: number, r2: number, k: number) => {
      if (c2 < 0 || c2 >= columns || r2 >= rows) return;
      links.push(r1 * columns + c1, r2 * columns + c2);
      kinds.push(k);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        link(c, r, c + 1, r, STRETCH);
        link(c, r, c, r + 1, STRETCH);
        link(c, r, c + 1, r + 1, SHEAR);
        link(c, r, c - 1, r + 1, SHEAR);
        link(c, r, c + 2, r, BEND);
        link(c, r, c, r + 2, BEND);
      }
    }
    this.links = Uint16Array.from(links);
    this.stiffness = Float32Array.from(kinds);
    this.restLengths = new Float32Array(kinds.length);
    this.layFlat({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    for (let k = 0; k < kinds.length; k++) {
      const i = this.links[k * 2] * 3;
      const j = this.links[k * 2 + 1] * 3;
      this.restLengths[k] = Math.hypot(this.pos[i] - this.pos[j], this.pos[i + 1] - this.pos[j + 1], this.pos[i + 2] - this.pos[j + 2]);
    }
  }

  /** Where a point of the flat cloth sits, given its top-left corner and the directions across and down. */
  private flatPoint(origin: Vec3, across: Vec3, down: Vec3, u: number, v: number) {
    const { topWidth, bottomWidth, height } = this.shape;
    const width = topWidth + (bottomWidth - topWidth) * v;
    const x = (u - 0.5) * width + topWidth / 2;
    return {
      x: origin.x + across.x * x + down.x * v * height,
      y: origin.y + across.y * x + down.y * v * height,
      z: origin.z + across.z * x + down.z * v * height,
    };
  }

  /** Spreads the cloth flat and still, its top edge starting at `origin` and running along `across`. */
  layFlat(origin: Vec3, across: Vec3, down: Vec3) {
    for (let i = 0; i < this.count; i++) {
      const p = this.flatPoint(origin, across, down, this.uv[i * 2], this.uv[i * 2 + 1]);
      this.pos[i * 3] = this.prev[i * 3] = p.x;
      this.pos[i * 3 + 1] = this.prev[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = this.prev[i * 3 + 2] = p.z;
    }
  }

  /** Hangs the cloth still from its top edge, which runs from `left` to `right` (the hands). */
  hangBetween(left: Vec3, right: Vec3, gripLeft: number, gripRight: number) {
    const span = (gripRight - gripLeft) * this.shape.topWidth;
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const dz = right.z - left.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const across = { x: dx / len, y: dy / len, z: dz / len };
    // Hands closer than the cloth is wide leave a sag; start with the edge straight and let it settle.
    const stretch = len / Math.max(span, 1e-3);
    const origin = {
      x: left.x - across.x * gripLeft * this.shape.topWidth * stretch,
      y: left.y,
      z: left.z - across.z * gripLeft * this.shape.topWidth * stretch,
    };
    this.layFlat(origin, across, { x: 0, y: -1, z: 0 });
  }

  particle(index: number): Vec3 {
    return {
      x: this.pos[index * 3],
      y: this.pos[index * 3 + 1],
      z: this.pos[index * 3 + 2],
    };
  }

  /** The particle on the top edge nearest to `u` (0 left, 1 right). */
  topIndex(u: number) {
    return Math.round(u * (this.shape.columns - 1));
  }

  /**
   * Holds particles at targets for this step. A weight below 1 lets a hand
   * take hold gradually, so grabbing the cloth never yanks it.
   */
  setPins(pins: Pin[]) {
    this.pinned.fill(0);
    this.pins = pins;
    for (const pin of pins) if (pin.weight >= 0.999) this.pinned[pin.index] = 1;
  }

  step(dt: number, forces: ClothForces) {
    this.accumulateAir(dt, forces);
    const { pos, prev, force } = this;
    const g = forces.gravity;
    const dt2 = dt * dt;
    const invMass = 1 / this.particleMass;
    for (let i = 0; i < this.count; i++) {
      if (this.pinned[i]) continue;
      const k = i * 3;
      for (let a = 0; a < 3; a++) {
        const p = pos[k + a];
        const accel = force[k + a] * invMass - (a === 1 ? g : 0);
        pos[k + a] = p + (p - prev[k + a]) * DAMPING + accel * dt2;
        prev[k + a] = p;
      }
    }
    this.applyPins(true);
    for (let it = 0; it < this.iterations; it++) {
      this.relax();
      this.applyPins(false);
    }
    this.collide();
  }

  private applyPins(moveHistory: boolean) {
    for (const { index, target, weight } of this.pins) {
      const k = index * 3;
      if (moveHistory && weight >= 0.999) {
        this.prev[k] = this.pos[k];
        this.prev[k + 1] = this.pos[k + 1];
        this.prev[k + 2] = this.pos[k + 2];
      }
      let dx = (target.x - this.pos[k]) * weight;
      let dy = (target.y - this.pos[k + 1]) * weight;
      let dz = (target.z - this.pos[k + 2]) * weight;
      // A hand taking hold gathers the cloth to it; it never yanks a far corner across in one tick.
      const pull = Math.hypot(dx, dy, dz);
      if (weight < 0.999 && pull > MAX_GATHER) {
        dx *= MAX_GATHER / pull;
        dy *= MAX_GATHER / pull;
        dz *= MAX_GATHER / pull;
      }
      this.pos[k] += dx;
      this.pos[k + 1] += dy;
      this.pos[k + 2] += dz;
    }
  }

  private relax() {
    const { pos, links, restLengths, stiffness, pinned } = this;
    const k = 1 / this.iterations;
    for (let n = 0; n < restLengths.length; n++) {
      const i = links[n * 2];
      const j = links[n * 2 + 1];
      const wi = pinned[i] ? 0 : 1;
      const wj = pinned[j] ? 0 : 1;
      const w = wi + wj;
      if (w === 0) continue;
      const a = i * 3;
      const b = j * 3;
      const dx = pos[b] - pos[a];
      const dy = pos[b + 1] - pos[a + 1];
      const dz = pos[b + 2] - pos[a + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const rest = restLengths[n];
      // Stiff links are solved fully each pass; soft ones a little each pass, so their strength doesn't depend on the pass count.
      const s = stiffness[n] >= 1 ? 1 : 1 - Math.pow(1 - stiffness[n], k);
      // Cloth resists stretching far more than squashing, which lets it fold.
      const diff = len > rest ? (len - rest) / len : ((len - rest) / len) * (stiffness[n] >= 1 ? 0.6 : 1);
      const f = (diff * s) / w;
      pos[a] += dx * f * wi;
      pos[a + 1] += dy * f * wi;
      pos[a + 2] += dz * f * wi;
      pos[b] -= dx * f * wj;
      pos[b + 1] -= dy * f * wj;
      pos[b + 2] -= dz * f * wj;
    }
  }

  /** Air pushes on each face against the face's motion through it, and the wind pushes along. */
  private accumulateAir(dt: number, { wind, airDrag }: ClothForces) {
    const { pos, prev, force, triangles } = this;
    force.fill(0);
    const inv = 1 / dt;
    for (let t = 0; t < triangles.length; t += 3) {
      const a = triangles[t] * 3;
      const b = triangles[t + 1] * 3;
      const c = triangles[t + 2] * 3;
      const e1x = pos[b] - pos[a];
      const e1y = pos[b + 1] - pos[a + 1];
      const e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a];
      const e2y = pos[c + 1] - pos[a + 1];
      const e2z = pos[c + 2] - pos[a + 2];
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const twiceArea = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (twiceArea < 1e-9) continue;
      nx /= twiceArea;
      ny /= twiceArea;
      nz /= twiceArea;
      const vx = ((pos[a] - prev[a] + pos[b] - prev[b] + pos[c] - prev[c]) * inv) / 3 - wind.x;
      const vy = ((pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[c + 1] - prev[c + 1]) * inv) / 3 - wind.y;
      const vz = ((pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[c + 2] - prev[c + 2]) * inv) / 3 - wind.z;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const normalSpeed = vx * nx + vy * ny + vz * nz;
      const push = (-airDrag * (twiceArea / 2) * normalSpeed * speed) / 3;
      force[a] += nx * push;
      force[a + 1] += ny * push;
      force[a + 2] += nz * push;
      force[b] += nx * push;
      force[b + 1] += ny * push;
      force[b + 2] += nz * push;
      force[c] += nx * push;
      force[c + 1] += ny * push;
      force[c + 2] += nz * push;
    }
  }

  private collide() {
    const { pos, prev, pinned } = this;
    for (let i = 0; i < this.count; i++) {
      if (pinned[i]) continue;
      const k = i * 3;
      if (pos[k + 1] < GROUND) {
        pos[k + 1] = GROUND;
        prev[k + 1] = Math.min(prev[k + 1], GROUND);
        prev[k] += (pos[k] - prev[k]) * GROUND_FRICTION;
        prev[k + 2] += (pos[k + 2] - prev[k + 2]) * GROUND_FRICTION;
      }
      for (const body of this.colliders) this.pushOut(k, body);
    }
  }

  private pushOut(k: number, body: Collider) {
    const { pos, prev } = this;
    let cx: number;
    let cy: number;
    let cz: number;
    if (body.kind === "sphere") {
      cx = body.c.x;
      cy = body.c.y;
      cz = body.c.z;
    } else {
      const abx = body.b.x - body.a.x;
      const aby = body.b.y - body.a.y;
      const abz = body.b.z - body.a.z;
      const len2 = abx * abx + aby * aby + abz * abz;
      let t = len2 > 0 ? ((pos[k] - body.a.x) * abx + (pos[k + 1] - body.a.y) * aby + (pos[k + 2] - body.a.z) * abz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      cx = body.a.x + abx * t;
      cy = body.a.y + aby * t;
      cz = body.a.z + abz * t;
    }
    const dx = pos[k] - cx;
    const dy = pos[k + 1] - cy;
    const dz = pos[k + 2] - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const r = body.r;
    if (d2 >= r * r || d2 < 1e-12) return;
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    pos[k] += dx * push;
    pos[k + 1] += dy * push;
    pos[k + 2] += dz * push;
    // A little friction, so cloth caught on a horn doesn't skate off it.
    prev[k] += (pos[k] - prev[k]) * BODY_FRICTION;
    prev[k + 1] += (pos[k + 1] - prev[k + 1]) * BODY_FRICTION;
    prev[k + 2] += (pos[k + 2] - prev[k + 2]) * BODY_FRICTION;
  }
}
