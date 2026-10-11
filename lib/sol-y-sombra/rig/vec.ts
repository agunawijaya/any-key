/*
 * Small 3D maths for the rig: vectors and quaternions as plain objects.
 *
 * The ring is measured in metres with y up. A body's own frame has x
 * forward, y up and z to its right, so a heading of 0 faces +x and a
 * positive heading turns left (counter-clockwise seen from above).
 */

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const copy = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const scale = (v: Vec3, s: number): Vec3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});
/** a + b·s, the most common step in the rig. */
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => ({
  x: a.x + b.x * s,
  y: a.y + b.y * s,
  z: a.z + b.z * s,
});
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
/** The same point on the sand. */
export const flat = (v: Vec3, y = 0): Vec3 => ({ x: v.x, y, z: v.z });

export function normalize(v: Vec3, fallback: Vec3 = { x: 1, y: 0, z: 0 }): Vec3 {
  const len = length(v);
  return len > 1e-9 ? scale(v, 1 / len) : copy(fallback);
}

export const UP: Vec3 = Object.freeze({ x: 0, y: 1, z: 0 });

/** The direction a heading faces, on the sand. */
export const headingDir = (heading: number): Vec3 => ({
  x: Math.cos(heading),
  y: 0,
  z: -Math.sin(heading),
});
/** A body's right, for a heading. */
export const headingRight = (heading: number): Vec3 => ({
  x: Math.sin(heading),
  y: 0,
  z: Math.cos(heading),
});
/** The heading of a direction on the sand. */
export const headingOf = (dir: Vec3) => Math.atan2(-dir.z, dir.x);

/** The shortest signed turn from angle a to angle b. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* ---------- Quaternions ---------- */

export const IDENTITY: Quat = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

export function axisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(angle / 2),
  };
}

export function mul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  // v' = v + 2w(q×v) + 2q×(q×v)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let ka = 1 - t;
  let kb = t;
  if (cos < 0.9995) {
    const angle = Math.acos(cos);
    const sin = Math.sin(angle);
    ka = Math.sin((1 - t) * angle) / sin;
    kb = Math.sin(t * angle) / sin;
  }
  const q = {
    x: a.x * ka + bx * kb,
    y: a.y * ka + by * kb,
    z: a.z * ka + bz * kb,
    w: a.w * ka + bw * kb,
  };
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

const X_AXIS: Vec3 = { x: 1, y: 0, z: 0 };
const Z_AXIS: Vec3 = { x: 0, y: 0, z: 1 };

/**
 * A body's orientation: turned to `heading`, bent forward by `lean`
 * (nose down) and tipped to its right by `tilt`, all in radians.
 */
export function bodyQuat(heading: number, lean = 0, tilt = 0): Quat {
  return mul(mul(axisAngle(UP, heading), axisAngle(Z_AXIS, -lean)), axisAngle(X_AXIS, tilt));
}

/** The same three turns, relative to a parent orientation. */
export const relativeQuat = (parent: Quat, turn: number, lean = 0, tilt = 0) => mul(parent, bodyQuat(turn, lean, tilt));

/** A frame's forward, up and right in the world. */
export const forwardOf = (q: Quat) => rotate(q, X_AXIS);
export const upOf = (q: Quat) => rotate(q, UP);
export const rightOf = (q: Quat) => rotate(q, Z_AXIS);

/** A point given in a frame's own axes (forward, up, right), placed in the world. */
export const local = (origin: Vec3, q: Quat, forward: number, up: number, right: number) => add(origin, rotate(q, { x: forward, y: up, z: right }));

/** The shortest rotation taking direction a onto direction b (both unit length). */
export function rotationBetween(a: Vec3, b: Vec3): Quat {
  const d = dot(a, b);
  if (d < -0.999999) {
    const axis = normalize(cross(Math.abs(a.x) < 0.9 ? X_AXIS : UP, a));
    return axisAngle(axis, Math.PI);
  }
  const c = cross(a, b);
  const q = { x: c.x, y: c.y, z: c.z, w: 1 + d };
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

/* ---------- Scalars ---------- */

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 before `a`, 1 after `b`, a smooth S between. */
export function smoothstep(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** A smoother S with zero acceleration at both ends, so blends never jolt. */
export function smootherstep(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export const easeInOut = (t: number) => smootherstep(0, 1, t);
/** Rises from 0 to 1 and back to 0 over [0, 1], smoothly. */
export const bump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) ** 2);
