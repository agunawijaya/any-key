import { distance, lerp, normalize, sub, type Vec3 } from "./vec";

/*
 * A smooth path through waypoints on the sand (a centripetal Catmull–Rom
 * spline, which never loops or overshoots between close points), measured
 * by distance so a body can travel it at a chosen speed.
 */

export class Path {
  private readonly samples: Vec3[] = [];
  private readonly lengths: number[] = [];
  readonly length: number;

  /** `lead` and `tail` are phantom points that set the tangents at the two ends. */
  constructor(points: Vec3[], lead: Vec3, tail: Vec3, samplesPerSpan = 60) {
    const all = [lead, ...points, tail];
    for (let i = 1; i < all.length - 2; i++) {
      for (let k = 0; k < samplesPerSpan; k++) this.samples.push(catmullRom(all[i - 1], all[i], all[i + 1], all[i + 2], k / samplesPerSpan));
    }
    this.samples.push(points[points.length - 1]);
    let total = 0;
    this.lengths.push(0);
    for (let i = 1; i < this.samples.length; i++) {
      total += distance(this.samples[i - 1], this.samples[i]);
      this.lengths.push(total);
    }
    this.length = total;
  }

  /** The point `s` metres along the path (clamped to its ends). */
  at(s: number): Vec3 {
    const { index, t } = this.locate(s);
    return lerp(this.samples[index], this.samples[Math.min(index + 1, this.samples.length - 1)], t);
  }

  tangent(s: number): Vec3 {
    const a = this.at(Math.max(0, s - 0.05));
    const b = this.at(Math.min(this.length, s + 0.05));
    return normalize(sub(b, a));
  }

  /** The distance along the path of the sample nearest to a point. */
  nearest(point: Vec3) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const d = distance(point, this.samples[i]);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return this.lengths[best];
  }

  private locate(s: number) {
    if (s <= 0) return { index: 0, t: 0 };
    if (s >= this.length) return { index: this.samples.length - 1, t: 0 };
    let lo = 0;
    let hi = this.lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.lengths[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = this.lengths[hi] - this.lengths[lo];
    return { index: lo, t: span > 0 ? (s - this.lengths[lo]) / span : 0 };
  }
}

function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  // Centripetal knots: the spacing grows with the square root of the distance between points.
  const k0 = 0;
  const k1 = k0 + Math.sqrt(Math.max(distance(p0, p1), 1e-4));
  const k2 = k1 + Math.sqrt(Math.max(distance(p1, p2), 1e-4));
  const k3 = k2 + Math.sqrt(Math.max(distance(p2, p3), 1e-4));
  const u = k1 + (k2 - k1) * t;
  const blend = (a: Vec3, b: Vec3, ka: number, kb: number) => lerp(a, b, (u - ka) / (kb - ka));
  const a1 = blend(p0, p1, k0, k1);
  const a2 = blend(p1, p2, k1, k2);
  const a3 = blend(p2, p3, k2, k3);
  const b1 = blend(a1, a2, k0, k2);
  const b2 = blend(a2, a3, k1, k3);
  return blend(b1, b2, k1, k2);
}
