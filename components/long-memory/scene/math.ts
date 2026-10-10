/*
 * The little linear algebra the board scene needs: column-major 4×4
 * matrices as WebGL expects them, three-vectors as plain tuples, and unit
 * quaternions for the seeds' tumbling. Lengths are in centimetres.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Mat4 = Float32Array;

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function normalize(a: Vec3): Vec3 {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function mat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
  const m = mat4();
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = -2 / (far - near);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = -(far + near) / (far - near);
  return m;
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const m = mat4();
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  return m;
}

/** The inverse of a 4×4 matrix (cofactor expansion). */
export function invert(m: Mat4): Mat4 {
  const a = m;
  const out = new Float32Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4];
  const b01 = a[0] * a[6] - a[2] * a[4];
  const b02 = a[0] * a[7] - a[3] * a[4];
  const b03 = a[1] * a[6] - a[2] * a[5];
  const b04 = a[1] * a[7] - a[3] * a[5];
  const b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12];
  const b07 = a[8] * a[14] - a[10] * a[12];
  const b08 = a[8] * a[15] - a[11] * a[12];
  const b09 = a[9] * a[14] - a[10] * a[13];
  const b10 = a[9] * a[15] - a[11] * a[13];
  const b11 = a[10] * a[15] - a[11] * a[14];
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  const d = det ? 1 / det : 0;
  out[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d;
  out[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
  out[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d;
  out[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  out[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d;
  out[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
  out[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d;
  out[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  out[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d;
  out[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
  out[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d;
  out[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  out[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d;
  out[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
  out[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d;
  out[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return out;
}

/** Where a world point lands on screen, in CSS pixels from the top left; `w` < 0 means behind the camera. */
export function project(viewProjection: Mat4, p: Vec3, width: number, height: number) {
  const m = viewProjection;
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return { x: ((x / w) * 0.5 + 0.5) * width, y: (0.5 - (y / w) * 0.5) * height, w };
}

/* ---------- Quaternions ---------- */

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let end = b;
  if (cos < 0) {
    cos = -cos;
    end = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (cos > 0.9995) return quatNormalize([lerp(a[0], end[0], t), lerp(a[1], end[1], t), lerp(a[2], end[2], t), lerp(a[3], end[3], t)]);
  const angle = Math.acos(cos);
  const s = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / s;
  const wb = Math.sin(t * angle) / s;
  return [a[0] * wa + end[0] * wb, a[1] * wa + end[1] * wb, a[2] * wa + end[2] * wb, a[3] * wa + end[3] * wb];
}

/** Rotates a vector by a unit quaternion. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}

/** The shortest rotation that turns unit vector `from` onto unit vector `to`. */
export function quatBetween(from: Vec3, to: Vec3): Quat {
  const d = dot(from, to);
  if (d > 0.99999) return IDENTITY_QUAT;
  if (d < -0.99999) {
    const axis = Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]);
    return quatFromAxisAngle(axis, Math.PI);
  }
  const c = cross(from, to);
  return quatNormalize([c[0], c[1], c[2], 1 + d]);
}
