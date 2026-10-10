import { mix, type Rgb } from "./color";
import { clamp, smoothstep } from "./noise";
import type { Particles } from "./particles";

/*
 * The big moments, made of particles: a round landing in earth, a supply
 * dump going up with its secondary blasts, and the star shells that light a
 * night barrage. Positions are metres in the scene (x across, y up, z into
 * the scene); the same effect works in the side view and the observer's.
 */

type At = { x: number; z: number };

const between = (r: () => number, a: number, b: number) => a + (b - a) * r();
const pick = <T>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];

const EARTH: Rgb[] = [
  [58, 44, 32],
  [72, 55, 38],
  [46, 36, 28],
  [88, 70, 50],
];
const MUD_SPRAY: Rgb[] = [
  [62, 50, 38],
  [74, 60, 46],
  [52, 42, 34],
];

/** A shell bursting in soft ground: a flash, a fountain of earth, a grey-brown cloud, a ring of blast. */
export function earthFountain(fx: Particles, at: At, power = 1) {
  fx.anchorAt(at.x);
  const r = fx.random;
  fx.add({ kind: "flash", x: at.x, y: 2, z: at.z, life: 0.28, size: 14 * power, color: [255, 240, 210], alpha: 1 });
  fx.add({ kind: "ring", x: at.x, y: 0.2, z: at.z, life: 0.45, size: 3, grow: 90 * power, color: [255, 255, 255], alpha: 0.55 });
  fx.light({ x: at.x, y: 6, z: at.z, radius: 160 * power, color: [255, 190, 120], intensity: 1 }, 0.6, (age) => Math.exp(-age * 9));
  // Clods thrown high in a cone, falling back.
  for (let i = 0; i < 70 * power; i++) {
    const a = between(r, -0.65, 0.65) + Math.PI / 2;
    const speed = between(r, 12, 42) * Math.sqrt(power);
    fx.add({
      kind: "clod",
      x: at.x + between(r, -1.5, 1.5),
      y: 0.5,
      z: at.z + between(r, -1.5, 1.5),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      vz: between(r, -6, 6),
      life: between(r, 2.4, 4),
      size: between(r, 0.1, 0.38),
      spin: between(r, -8, 8),
      color: pick(r, EARTH),
    });
  }
  // Jets of wet earth fanning out of the crater.
  for (let i = 0; i < 70 * power; i++) {
    const a = between(r, -0.55, 0.55) + Math.PI / 2;
    const speed = between(r, 18, 48) * Math.sqrt(power);
    fx.add({
      kind: "spray",
      x: at.x + between(r, -1, 1),
      y: 0.5,
      z: at.z + between(r, -1, 1),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      vz: between(r, -4, 4),
      life: between(r, 0.6, 1.1),
      size: between(r, 0.08, 0.18),
      color: pick(r, EARTH),
      alpha: 0.8,
    });
  }
  // The column: earth and water thrown up together, densest low down, opening out as it rises, then slumping.
  const columns = Math.round(42 * power);
  for (let i = 0; i < columns; i++) {
    const k = i / columns;
    const up = (8 + k * 40) * Math.sqrt(power) * between(r, 0.85, 1.1);
    fx.add({
      kind: "dust",
      x: at.x + between(r, -1, 1) * (0.3 + k * 0.8),
      y: between(r, 0.5, 2),
      z: at.z + between(r, -1, 1),
      vx: between(r, -2, 2) * (0.2 + k),
      vy: up,
      vz: between(r, -1.5, 1.5),
      life: between(r, 2.4, 4),
      size: (0.9 + k * 2.6) * power * between(r, 0.8, 1.15),
      grow: between(r, 1.4, 2.8) * (0.4 + k),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.4, 0.4),
      color: pick(r, MUD_SPRAY),
      alpha: 0.95,
      billow: "above",
    });
  }
  // The burst's own smoke, darker and slower, drifting off with the wind.
  for (let i = 0; i < 14 * power; i++) {
    fx.add({
      kind: "smoke",
      x: at.x + between(r, -4, 4),
      y: between(r, 1, 6),
      z: at.z + between(r, -2, 2),
      vx: between(r, -3, 3),
      vy: between(r, 2, 9),
      life: between(r, 5, 9),
      size: between(r, 3, 6) * power,
      grow: between(r, 1.4, 2.6),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.2, 0.2),
      color: mix([66, 62, 58], [104, 96, 86], r()),
      alpha: 0.85,
      billow: "above",
    });
  }
  for (let i = 0; i < 16 * power; i++) {
    const a = between(r, 0.15, Math.PI - 0.15);
    const speed = between(r, 25, 70);
    fx.add({ kind: "spark", x: at.x, y: 1, z: at.z, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: between(r, 0.3, 0.8), size: 0.18, color: [255, 220, 150] });
  }
}

/**
 * A shell bursting as the far view shows it, where the flash has to carry
 * kilometres: a ball of fire first, then the column of earth with chunks
 * flung out of it, a skirt of dust racing along the ground, and a dark pall
 * of smoke that leans with the wind and stays.
 */
export function explosion(fx: Particles, at: At, power = 1) {
  fx.anchorAt(at.x);
  const r = fx.random;
  fx.add({ kind: "flash", x: at.x, y: 4, z: at.z, life: 0.4, size: 30 * power, color: [255, 244, 220], alpha: 1 });
  fx.light({ x: at.x, y: 10, z: at.z, radius: 160 * power, color: [255, 180, 100], intensity: 1.6 }, 1.4, (age) => Math.exp(-age * 3.5));
  // The white-hot heart, gone in a moment.
  for (let i = 0; i < 10 * power; i++) {
    const a = r() * Math.PI * 2;
    const out = between(r, 2, 10);
    fx.add({
      kind: "fire",
      x: at.x + Math.cos(a),
      y: between(r, 1, 4),
      z: at.z + Math.sin(a),
      vx: Math.cos(a) * out,
      vy: between(r, 4, 14),
      life: between(r, 0.25, 0.5),
      size: between(r, 3, 5) * power,
      grow: between(r, 10, 18) * power,
      color: [255, 220, 150],
      alpha: 1,
    });
  }
  // The fireball's body: billows that burn yellow, then red, and roll up into black smoke.
  for (let i = 0; i < 22 * power; i++) {
    const a = r() * Math.PI * 2;
    const out = between(r, 2, 12);
    fx.add({
      kind: "blaze",
      x: at.x + Math.cos(a) * between(r, 0, 3),
      y: between(r, 1, 6),
      z: at.z + Math.sin(a) * 2,
      vx: Math.cos(a) * out,
      vy: between(r, 8, 26),
      vz: Math.sin(a) * out * 0.3,
      life: between(r, 1.8, 3),
      size: between(r, 4, 7) * power,
      grow: between(r, 4, 8) * power,
      angle: r() * Math.PI * 2,
      spin: between(r, -0.5, 0.5),
      color: [255, 200, 120],
      alpha: 0.95,
    });
  }
  earthFountain(fx, at, power);
  // Black smoke boiling up round the fireball's edge, so it has a dark rim from the first instant.
  for (let i = 0; i < 12 * power; i++) {
    const a = r() * Math.PI * 2;
    fx.add({
      kind: "smoke",
      x: at.x + Math.cos(a) * between(r, 5, 10),
      y: between(r, 2, 10),
      z: at.z + Math.sin(a) * 2,
      vx: Math.cos(a) * between(r, 4, 12),
      vy: between(r, 10, 24),
      life: between(r, 4, 7),
      size: between(r, 4, 7) * power,
      grow: between(r, 3, 6),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.3, 0.3),
      color: mix([36, 32, 30], [70, 62, 54], r()),
      alpha: 0.9,
      billow: "above",
    });
  }
  // A jet of earth punched straight up through the middle, the tallest part of the column.
  for (let i = 0; i < 24 * power; i++) {
    fx.add({
      kind: "dust",
      x: at.x + between(r, -3, 3),
      y: between(r, 1, 4),
      z: at.z + between(r, -1, 1),
      vx: between(r, -7, 7),
      vy: between(r, 30, 75),
      life: between(r, 2.6, 4),
      size: between(r, 3, 6) * power,
      grow: between(r, 2, 4),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.4, 0.4),
      color: pick(r, MUD_SPRAY),
      alpha: 0.95,
      billow: "above",
    });
  }
  // Chunks of earth big enough to see from far off, flung high out of the column.
  for (let i = 0; i < 26 * power; i++) {
    const a = between(r, -0.85, 0.85) + Math.PI / 2;
    const speed = between(r, 25, 70);
    fx.add({
      kind: "clod",
      x: at.x + between(r, -2, 2),
      y: 1,
      z: at.z + between(r, -2, 2),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      vz: between(r, -6, 6),
      life: between(r, 3, 4.5),
      size: between(r, 0.35, 0.9),
      spin: between(r, -9, 9),
      color: pick(r, EARTH),
    });
  }
  // The base surge: dust thrown out sideways along the ground.
  for (let i = 0; i < 16 * power; i++) {
    const side = r() < 0.5 ? -1 : 1;
    fx.add({
      kind: "dust",
      x: at.x + side * between(r, 1, 4),
      y: between(r, 0.5, 2),
      z: at.z + between(r, -2, 2),
      vx: side * between(r, 10, 26),
      vy: between(r, 0.5, 2),
      life: between(r, 1.8, 3.2),
      size: between(r, 2, 4) * power,
      grow: between(r, 2, 4),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.4, 0.4),
      color: pick(r, MUD_SPRAY),
      alpha: 0.8,
      billow: "above",
    });
  }
  // The pall that stays after the column has fallen back.
  for (let i = 0; i < 10 * power; i++) {
    fx.add({
      kind: "smoke",
      x: at.x + between(r, -5, 5),
      y: between(r, 6, 20),
      z: at.z + between(r, -2, 2),
      vx: between(r, -2, 2),
      vy: between(r, 3, 8),
      life: between(r, 8, 13),
      size: between(r, 4, 8) * power,
      grow: between(r, 2, 3.5),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.15, 0.15),
      color: mix([48, 44, 40], [86, 78, 68], r()),
      alpha: 0.9,
      billow: "above",
    });
  }
}

/** The gun's own smoke: a grey-white cloud punched out of the muzzle, then drifting off. */
export function muzzleSmoke(fx: Particles, at: At & { y?: number }, direction: number, power = 1) {
  fx.anchorAt(at.x);
  const r = fx.random;
  const y0 = at.y ?? 2;
  fx.add({ kind: "flash", x: at.x, y: y0, z: at.z, life: 0.18, size: 18 * power, color: [255, 236, 200] });
  fx.light({ x: at.x, y: y0, z: at.z, radius: 260 * power, color: [255, 200, 130], intensity: 1.2 }, 0.4, (age) => Math.exp(-age * 12));
  for (let i = 0; i < 28 * power; i++) {
    const speed = between(r, 4, 40) * power;
    const a = direction + between(r, -0.35, 0.35);
    fx.add({
      kind: "smoke",
      x: at.x + between(r, -2, 2),
      y: y0 + between(r, 0, 3),
      z: at.z + between(r, -2, 2),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed * 0.6 + between(r, 0, 3),
      vz: between(r, -3, 3),
      life: between(r, 6, 12),
      size: between(r, 3, 8) * power,
      grow: between(r, 2, 5) * power,
      angle: r() * Math.PI * 2,
      spin: between(r, -0.2, 0.2),
      color: mix([206, 202, 194], [150, 146, 140], r()),
      alpha: 0.7,
    });
  }
}

/** A fireball: flash, sparks, flying timber and a burst of fire-lit black smoke. `size` 1 is a dump's first blast. */
export function blast(fx: Particles, at: At & { y?: number }, size: number) {
  fx.anchorAt(at.x);
  const r = fx.random;
  const y0 = at.y ?? 2;
  fx.add({ kind: "flash", x: at.x, y: y0 + 4, z: at.z, life: 0.45, size: 40 * size, color: [255, 240, 210] });
  fx.add({ kind: "ring", x: at.x, y: 0.3, z: at.z, life: 0.6, size: 4, grow: 160 * size, color: [255, 255, 255], alpha: 0.5 });
  fx.light({ x: at.x, y: 20 * size, z: at.z, radius: 650 * size, color: [255, 170, 90], intensity: 1.4 * size }, 2.2, (age) => Math.exp(-age * 2.2));
  for (let i = 0; i < 46 * size; i++) {
    const a = r() * Math.PI * 2;
    const out = between(r, 3, 16) * size;
    fx.add({
      kind: "fire",
      x: at.x + Math.cos(a) * between(r, 0, 4) * size,
      y: y0 + between(r, 0, 6) * size,
      z: at.z + Math.sin(a) * between(r, 0, 3) * size,
      vx: Math.cos(a) * out,
      vy: between(r, 4, 22) * size,
      vz: Math.sin(a) * out * 0.5,
      life: between(r, 0.7, 1.7),
      size: between(r, 3, 8) * size,
      grow: between(r, 4, 10) * size,
      color: [255, 180, 80],
      alpha: 0.9,
    });
  }
  for (let i = 0; i < 120 * size; i++) {
    const a = between(r, 0.05, Math.PI - 0.05);
    const speed = between(r, 20, 95) * Math.sqrt(size);
    fx.add({ kind: "spark", x: at.x, y: y0 + 2, z: at.z, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: between(r, -10, 10), life: between(r, 0.5, 1.6), size: 0.22, color: [255, 220, 150] });
  }
  for (let i = 0; i < 18 * size; i++) {
    const a = between(r, 0.3, Math.PI - 0.3);
    const speed = between(r, 14, 55) * Math.sqrt(size);
    fx.add({
      kind: "debris",
      x: at.x + between(r, -3, 3),
      y: y0 + 1,
      z: at.z + between(r, -2, 2),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      vz: between(r, -8, 8),
      life: between(r, 2.5, 4.5),
      size: between(r, 0.3, 0.9),
      spin: between(r, -12, 12),
      color: mix([40, 30, 22], [70, 54, 36], r()),
    });
  }
  for (let i = 0; i < 22 * size; i++) {
    fx.add({
      kind: "smoke",
      x: at.x + between(r, -6, 6) * size,
      y: y0 + between(r, 2, 14) * size,
      z: at.z + between(r, -3, 3),
      vx: between(r, -4, 4),
      vy: between(r, 8, 22) * size,
      life: between(r, 7, 12),
      size: between(r, 6, 12) * size,
      grow: between(r, 2.5, 4.5),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.15, 0.15),
      color: mix([150, 90, 50], [190, 120, 60], r()),
      cools: mix([22, 19, 17], [56, 48, 42], r()),
      alpha: 0.95,
      billow: "below",
    });
  }
}

/**
 * A supply dump going up: the big blast, then a chain of secondary
 * explosions as stacked shells and fuel catch, a fire that keeps burning
 * and a column of black smoke climbing out of the frame.
 */
export function dumpGoesUp(fx: Particles, at: At, burn = 14) {
  const r = fx.random;
  blast(fx, at, 1);
  const secondaries = 7;
  for (let i = 0; i < secondaries; i++) {
    const delay = 0.35 + (i / secondaries) * 3.4 + between(r, -0.15, 0.25);
    const where = { x: at.x + between(r, -22, 22), z: at.z + between(r, -10, 10), y: between(r, 0, 6) };
    fx.after(delay, () => blast(fx, where, between(r, 0.35, 0.65)));
  }
  fx.after(0.6, () => burning(fx, at, burn - 0.6, 1));
}

/**
 * A fire that stays after a hit: flames licking up and a column of smoke,
 * lit orange as it leaves the fire and cooling to black as it climbs.
 * `size` 1 is a burning dump; a lorry or a hut is far less.
 */
export function burning(fx: Particles, at: At, seconds: number, size: number) {
  fx.anchorAt(at.x);
  const r = fx.random;
  const spread = 14 * size;
  fx.light({ x: at.x, y: 12 * size, z: at.z, radius: 380 * size, color: [255, 140, 60], intensity: 0.9 }, seconds, (age) => smoothstep(0, 0.6, age) * (1 - smoothstep(seconds - 3, seconds, age)) * (0.85 + 0.15 * Math.sin(age * 23) * Math.sin(age * 7.1)));
  const feed = (left: number) => {
    if (left <= 0) return;
    fx.anchorAt(at.x);
    for (let k = 0; k < Math.max(1, Math.round(3 * size)); k++) {
      fx.add({
        kind: "fire",
        x: at.x + between(r, -spread, spread),
        y: between(r, 0, 3),
        z: at.z + between(r, -spread / 2, spread / 2),
        vx: between(r, -1, 1),
        vy: between(r, 2, 8),
        life: between(r, 0.6, 1.3),
        size: between(r, 2, 5) * Math.sqrt(size),
        grow: between(r, 1, 3),
        color: [255, 170, 70],
        alpha: 0.8,
      });
    }
    fx.add({
      kind: "smoke",
      x: at.x + between(r, -spread * 0.7, spread * 0.7),
      y: between(r, 6, 14) * size,
      z: at.z + between(r, -4, 4),
      vx: between(r, -1, 2),
      vy: between(r, 20, 32) * Math.sqrt(size),
      life: between(r, 10, 15),
      size: between(r, 6, 16) * Math.sqrt(size),
      grow: between(r, 3, 5) * Math.sqrt(size),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.1, 0.1),
      color: mix([140, 82, 44], [196, 120, 62], r()),
      cools: mix([16, 14, 13], [62, 55, 48], r() ** 2),
      alpha: 0.95,
      billow: "below",
    });
    fx.after(0.16, () => feed(left - 0.16));
  };
  feed(seconds);
}

/** A round on stonework: chunks of masonry flung out and a pale cloud of dust and powdered stone. */
export function masonryBurst(fx: Particles, at: At & { y?: number }, power = 1) {
  fx.anchorAt(at.x);
  const r = fx.random;
  const y0 = at.y ?? 4;
  fx.add({ kind: "flash", x: at.x, y: y0, z: at.z, life: 0.25, size: 16 * power, color: [255, 240, 210] });
  fx.light({ x: at.x, y: y0, z: at.z, radius: 200 * power, color: [255, 190, 120], intensity: 1 }, 0.5, (age) => Math.exp(-age * 9));
  for (let i = 0; i < 40 * power; i++) {
    const a = between(r, 0.2, Math.PI - 0.2);
    const speed = between(r, 10, 40) * Math.sqrt(power);
    fx.add({
      kind: "debris",
      x: at.x + between(r, -3, 3),
      y: y0,
      z: at.z + between(r, -2, 2),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      vz: between(r, -6, 6),
      life: between(r, 2, 3.5),
      size: between(r, 0.3, 1.1),
      spin: between(r, -10, 10),
      color: mix([120, 112, 100], [168, 158, 140], r()),
    });
  }
  for (let i = 0; i < 26 * power; i++) {
    fx.add({
      kind: "dust",
      x: at.x + between(r, -8, 8),
      y: y0 + between(r, -2, 4),
      z: at.z + between(r, -3, 3),
      vx: between(r, -4, 4),
      vy: between(r, 2, 12),
      life: between(r, 4, 7),
      size: between(r, 3, 7) * power,
      grow: between(r, 1.5, 3),
      angle: r() * Math.PI * 2,
      spin: between(r, -0.3, 0.3),
      color: mix([150, 142, 128], [188, 180, 164], r()),
      alpha: 0.85,
      billow: "above",
    });
  }
}

/* ---------- Star shells ---------- */

/** A parachute flare: fired up, bursts into light, then sinks slowly, drifting with the wind. */
export type StarShell = { x: number; z: number; burst: number; altitude: number; seed: number };

export type FlareState = { x: number; y: number; z: number; intensity: number; burning: boolean };

const FLARE_BURN = 40;
const SINK = 2.8;

/** Where a flare is and how bright, `t` seconds after it burst. */
export function flareAt(flare: StarShell, t: number, windX: number): FlareState {
  const age = t - flare.burst;
  const burning = age >= 0 && age < FLARE_BURN;
  const flicker = 0.9 + 0.06 * Math.sin(age * 31 + flare.seed * 9) + 0.04 * Math.sin(age * 13.7 + flare.seed * 3);
  const intensity = burning ? smoothstep(0, 0.5, age) * (1 - smoothstep(FLARE_BURN - 6, FLARE_BURN, age)) * flicker : 0;
  return {
    x: flare.x + windX * 0.8 * clamp(age, 0, FLARE_BURN),
    y: flare.altitude - SINK * clamp(age, 0, FLARE_BURN),
    z: flare.z,
    intensity,
    burning,
  };
}
