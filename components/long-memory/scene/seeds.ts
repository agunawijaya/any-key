/*
 * The seeds: what each one looks like, and how they fall, bounce, roll and
 * pile up in the hollows. Physics is position-based (predict, push out of
 * the wood and out of each other, then read the velocity back), in fixed
 * steps so a replay of the same moves gives the same picture every time.
 *
 * A seed is either resting (physics moves it) or carried (the choreography
 * sets its position: lifted above a pit, or flying along an arc).
 */

import { createRng, type Rng } from "@/lib/kit/rng";
import { HOLLOWS, hollowDistance, SEED_RADIUS } from "./layout";
import {
  add,
  dot,
  length,
  normalize,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  rotate,
  scale,
  sub,
  type Quat,
  type Vec3,
} from "./math";

export type Seed = {
  id: number;
  /** The hole the seed lies in, or is on its way to. */
  hole: number;
  pos: Vec3;
  vel: Vec3;
  rotation: Quat;
  /** Angular velocity, for tumbling in flight and rolling on the wood. */
  spin: Vec3;
  radius: number;
  /** Semi-axes in centimetres: a little flattened, a little long. */
  shape: Vec3;
  color: Vec3;
  /** variety (pattern offset), freckles, egg, and a spare channel. */
  look: [number, number, number, number];
  carried: boolean;
  asleep: boolean;
  quietFor: number;
};

/*
 * Natural seed colours in linear light: mostly the greys of nickernuts, from
 * pale to slate, some olive, and a few warm browns.
 */
const PALETTE: Vec3[] = [
  [0.29, 0.28, 0.25],
  [0.22, 0.215, 0.2],
  [0.36, 0.34, 0.29],
  [0.18, 0.18, 0.165],
  [0.26, 0.25, 0.17],
  [0.31, 0.29, 0.2],
  [0.14, 0.135, 0.12],
  [0.2, 0.12, 0.065],
  [0.27, 0.17, 0.09],
  [0.4, 0.37, 0.31],
];

export function makeSeed(id: number, hole: number, rng: Rng): Seed {
  const size = 0.92 + rng.float() * 0.17;
  const shape: Vec3 = [SEED_RADIUS * size * (1.04 + rng.float() * 0.1), SEED_RADIUS * size * (0.8 + rng.float() * 0.08), SEED_RADIUS * size * (0.93 + rng.float() * 0.07)];
  const color = rng.pick(PALETTE);
  const tint = 0.9 + rng.float() * 0.2;
  return {
    id,
    hole,
    pos: [0, 0, 0],
    vel: [0, 0, 0],
    rotation: quatFromAxisAngle([rng.float() - 0.5, rng.float() - 0.5, rng.float() - 0.5], rng.float() * Math.PI * 2),
    spin: [0, 0, 0],
    radius: (shape[0] + shape[1] + shape[2]) / 3,
    shape,
    color: [color[0] * tint, color[1] * tint, color[2] * (tint * 0.97)],
    look: [rng.float(), rng.float() < 0.45 ? 0.5 + rng.float() * 0.5 : 0, (rng.float() - 0.3) * 0.16, 0],
    carried: false,
    asleep: false,
    quietFor: 0,
  };
}

/* ---------- Physics ---------- */

export const STEP = 1 / 240;
const GRAVITY = 760;
const RESTITUTION_WOOD = 0.32;
const RESTITUTION_SEED = 0.18;
const FRICTION = 0.12;
const ITERATIONS = 3;

export type Impact = { seed: Seed; speed: number; withWood: boolean };

function woodNormal(seed: Seed, p: Vec3): Vec3 {
  const h = HOLLOWS[seed.hole];
  const e = 0.02;
  return normalize([
    hollowDistance(h, [p[0] + e, p[1], p[2]]) - hollowDistance(h, [p[0] - e, p[1], p[2]]),
    hollowDistance(h, [p[0], p[1] + e, p[2]]) - hollowDistance(h, [p[0], p[1] - e, p[2]]),
    hollowDistance(h, [p[0], p[1], p[2] + e]) - hollowDistance(h, [p[0], p[1], p[2] - e]),
  ]);
}

/** Turns a seed so its flattest side faces the surface it rests on, keeping its turn about that axis. */
function settleRotation(seed: Seed, normal: Vec3, amount: number) {
  const up = rotate(seed.rotation, [0, 1, 0]);
  const facing = dot(up, normal) < 0 ? scale(normal, -1) : normal;
  const axis = [up[1] * facing[2] - up[2] * facing[1], up[2] * facing[0] - up[0] * facing[2], up[0] * facing[1] - up[1] * facing[0]] as Vec3;
  const s = length(axis);
  if (s < 1e-4) return;
  const angle = Math.asin(Math.min(1, s)) * amount;
  seed.rotation = quatNormalize(quatMultiply(quatFromAxisAngle(axis, angle), seed.rotation));
}

/**
 * One fixed step for every resting seed. Seeds only meet seeds in the same
 * hole, so the pair test stays small. Returns the hard knocks, for sound.
 */
export function stepSeeds(seeds: Seed[], impacts?: Impact[]) {
  const dt = STEP;
  const moving = seeds.filter((s) => !s.carried && !s.asleep);
  if (!moving.length) return;
  const byHole = new Map<number, Seed[]>();
  for (const s of seeds) {
    if (s.carried) continue;
    const list = byHole.get(s.hole) ?? [];
    list.push(s);
    byHole.set(s.hole, list);
  }

  const before = new Map<Seed, Vec3>();
  for (const s of moving) {
    before.set(s, s.pos);
    s.vel = [s.vel[0], s.vel[1] - GRAVITY * dt, s.vel[2]];
    s.pos = add(s.pos, scale(s.vel, dt));
  }

  const contacts = new Map<Seed, { n: Vec3; wood: boolean }>();
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    for (const s of moving) {
      const d = hollowDistance(HOLLOWS[s.hole], s.pos) - s.radius;
      if (d < 0) {
        const n = woodNormal(s, s.pos);
        s.pos = sub(s.pos, scale(n, d));
        contacts.set(s, { n, wood: true });
      }
    }
    for (const list of byHole.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (a.asleep && b.asleep) continue;
          const delta = sub(b.pos, a.pos);
          const dist = length(delta);
          const overlap = a.radius + b.radius - dist;
          if (overlap <= 0 || dist < 1e-6) continue;
          const n = scale(delta, 1 / dist);
          // A sleeping seed is pushed only half as much: piles stay put while a newcomer finds its place.
          const wa = a.asleep ? 0.15 : 0.5;
          const wb = b.asleep ? 0.15 : 0.5;
          const total = wa + wb;
          a.pos = sub(a.pos, scale(n, (overlap * wa) / total));
          b.pos = add(b.pos, scale(n, (overlap * wb) / total));
          if (!contacts.has(b)) contacts.set(b, { n, wood: false });
          if (!contacts.has(a)) contacts.set(a, { n: scale(n, -1), wood: false });
          if (overlap > 0.05 && b.asleep) b.asleep = false;
          if (overlap > 0.05 && a.asleep) a.asleep = false;
        }
      }
    }
  }

  for (const s of moving) {
    const start = before.get(s)!;
    let v = scale(sub(s.pos, start), 1 / dt);
    const contact = contacts.get(s);
    if (contact) {
      const { n, wood } = contact;
      const vn = dot(s.vel, n);
      const normalPart = scale(n, dot(v, n));
      let tangent = sub(v, normalPart);
      tangent = scale(tangent, 1 - FRICTION);
      // Bounce off the incoming velocity, not the corrected one, so drops spring back up a little.
      const bounce = vn < -18 ? -vn * (wood ? RESTITUTION_WOOD : RESTITUTION_SEED) : 0;
      v = add(tangent, scale(n, Math.max(dot(v, n), bounce)));
      if (impacts && vn < -25) impacts.push({ seed: s, speed: -vn, withWood: wood });
      // Rolling: turn about the axis across the motion.
      const axis: Vec3 = [n[1] * tangent[2] - n[2] * tangent[1], n[2] * tangent[0] - n[0] * tangent[2], n[0] * tangent[1] - n[1] * tangent[0]];
      s.spin = scale(axis, 1 / s.radius);
      settleRotation(s, n, 0.06);
    }
    s.vel = v;
    const spinRate = length(s.spin);
    if (spinRate > 1e-4) s.rotation = quatNormalize(quatMultiply(quatFromAxisAngle(s.spin, spinRate * dt), s.rotation));
    const speed = length(v);
    s.quietFor = speed < 1.2 ? s.quietFor + dt : 0;
    if (s.quietFor > 0.35) {
      s.asleep = true;
      s.vel = [0, 0, 0];
      s.spin = [0, 0, 0];
    }
  }
}

/** Wakes every seed in a hole, after one is taken out of it or dropped into it. */
export function wakeHole(seeds: Seed[], hole: number) {
  for (const s of seeds) if (s.hole === hole && !s.carried) {
    s.asleep = false;
    s.quietFor = 0;
  }
}

/** Drops seeds into their holes one after another and lets them come to rest: the opening position. */
export function settleInto(seeds: Seed[], seed: string) {
  const rng = createRng(seed);
  const perHole = new Map<number, number>();
  for (const s of seeds) {
    const n = perHole.get(s.hole) ?? 0;
    perHole.set(s.hole, n + 1);
    const h = HOLLOWS[s.hole];
    const angle = rng.float() * Math.PI * 2;
    const reach = Math.min(0.55, 0.12 + n * 0.05) * Math.min(h.ax, h.az);
    s.pos = [h.cx + Math.cos(angle) * reach * (h.ax / Math.min(h.ax, h.az)), 6.2 + 1.2 + n * 1.1, h.cz + Math.sin(angle) * reach * (h.az / Math.min(h.ax, h.az))];
    s.vel = [0, 0, 0];
    s.asleep = false;
    s.carried = false;
  }
  for (let i = 0; i < 240 * 3; i++) stepSeeds(seeds);
  for (const s of seeds) {
    s.asleep = true;
    s.vel = [0, 0, 0];
  }
}

/** Blends a carried seed's rotation toward a target, for a calm landing. */
export const easeRotation = (from: Quat, to: Quat, t: number) => quatSlerp(from, to, t);
