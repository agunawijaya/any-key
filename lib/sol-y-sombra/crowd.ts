import { createRng } from "@/lib/kit/rng";
import { around, inAisle, inGate, PLAZA, row } from "./plaza";
import { type Vec3 } from "./rig/vec";

/*
 * The crowd: a few thousand people in the tiers, each with a seat, a look and
 * a temper of their own, and a handful of cheap movements: sit, rise, lift
 * their arms, wave, throw. Nobody is simulated as a body; each person is a
 * few numbers eased towards what the mood of the ring asks of them, so the
 * whole crowd costs less to update than the bull's tail.
 *
 * Thrown flowers and hats are real projectiles, though: they arc down onto
 * the sand and stay there.
 */

export type Mood = {
  /** 0 quiet, 1 on their feet: how many stand. */
  standing: number;
  /** 0 hands in laps, 1 everyone with arms up. */
  arms: number;
  /** The angle round the ring where a wave of rising people has got to, or null. */
  wave: number | null;
  /** Whether hands are waving overhead. */
  waving: boolean;
};

export type Thrown = {
  kind: "flower" | "hat";
  look: number;
  pos: Vec3;
  vel: Vec3;
  spin: number;
  angle: number;
  landed: boolean;
};

const SEAT_SPACING = 0.62;
/** How many looks (colourways) people come in; styles decide what each looks like. */
export const LOOKS = 12;

export class Crowd {
  readonly count: number;
  /** Per person: angle round the ring, distance from the centre, the height of the seat. */
  readonly azimuth: Float32Array;
  readonly radius: Float32Array;
  readonly seat: Float32Array;
  readonly rowOf: Uint8Array;
  readonly look: Uint8Array;
  /** Per person, 0–1: sitting to standing, arms down to up. */
  readonly rise: Float32Array;
  readonly arms: Float32Array;
  /** A personal clock offset, so nobody moves quite in step. */
  readonly phase: Float32Array;
  /** Personal eagerness: who stands first when the ring warms up. */
  private readonly eagerness: Float32Array;
  private readonly riseSpeed: Float32Array;
  private readonly armsSpeed: Float32Array;
  readonly thrown: Thrown[] = [];
  private time = 0;
  private readonly random: () => number;

  /** `density` thins the stands (1 full); fewer people draw faster on a slow machine. */
  constructor(seed = "sol-y-sombra/crowd", density = 1) {
    const rng = createRng(seed);
    this.random = rng.float;
    const seats: { a: number; r: number; h: number; row: number }[] = [];
    for (let i = 0; i < PLAZA.rows; i++) {
      const { radius, height } = row(i);
      const r = radius + PLAZA.rowDepth * 0.45;
      const n = Math.floor((Math.PI * 2 * r) / SEAT_SPACING);
      for (let k = 0; k < n; k++) {
        const a = ((k + rng.float() * 0.25) / n) * Math.PI * 2;
        if (inAisle(a, r)) continue;
        if (height < PLAZA.gateHeight + 1 && inGate(a, r)) continue;
        // Not every seat is taken.
        if (rng.float() < 1 - 0.94 * density) continue;
        seats.push({ a, r, h: height, row: i });
      }
    }
    this.count = seats.length;
    this.azimuth = Float32Array.from(seats.map((s) => s.a));
    this.radius = Float32Array.from(seats.map((s) => s.r));
    this.seat = Float32Array.from(seats.map((s) => s.h));
    this.rowOf = Uint8Array.from(seats.map((s) => s.row));
    this.look = Uint8Array.from(seats.map(() => Math.floor(rng.float() * LOOKS)));
    this.phase = Float32Array.from(seats.map(() => rng.float() * Math.PI * 2));
    this.eagerness = Float32Array.from(seats.map(() => rng.float()));
    this.rise = new Float32Array(this.count);
    this.arms = new Float32Array(this.count);
    this.riseSpeed = new Float32Array(this.count);
    this.armsSpeed = new Float32Array(this.count);
  }

  /** Where a person sits, at seat height. */
  seatOf(i: number): Vec3 {
    return around(this.azimuth[i], this.radius[i], this.seat[i]);
  }

  /** How far a person's hands are lifted and swaying right now, for drawing their arms. */
  sway(i: number) {
    return Math.sin(this.time * 6 + this.phase[i]) * this.arms[i];
  }

  update(dt: number, mood: Mood) {
    this.time += dt;
    for (let i = 0; i < this.count; i++) {
      let standTarget = this.eagerness[i] < mood.standing ? 1 : 0;
      let armsTarget = this.eagerness[i] < mood.arms ? 1 : 0;
      if (mood.wave !== null) {
        const d = Math.atan2(Math.sin(this.azimuth[i] - mood.wave), Math.cos(this.azimuth[i] - mood.wave));
        // The wave lifts people just behind its front and lets them sit again after it passes.
        if (d < 0.05 && d > -0.5) {
          standTarget = 1;
          armsTarget = 1;
        }
      }
      // People are springs: quick to jump up, a little slower to sit down.
      const k = standTarget > this.rise[i] ? 90 : 40;
      this.riseSpeed[i] += (k * (standTarget - this.rise[i]) - 2 * Math.sqrt(k) * this.riseSpeed[i]) * dt;
      this.rise[i] = Math.min(1, Math.max(0, this.rise[i] + this.riseSpeed[i] * dt));
      const ka = 70;
      this.armsSpeed[i] += (ka * (armsTarget - this.arms[i]) - 2 * Math.sqrt(ka) * this.armsSpeed[i]) * dt;
      this.arms[i] = Math.min(1, Math.max(0, this.arms[i] + this.armsSpeed[i] * dt));
    }
    this.stepThrown(dt);
  }

  /**
   * Some of the people nearest the sand throw flowers and hats at a spot,
   * each aimed to land within `spread` metres of it.
   */
  throwAt(target: Vec3, howMany: number, spread = 4) {
    const near: number[] = [];
    for (let i = 0; i < this.count; i++) if (this.rowOf[i] < 6) near.push(i);
    for (let n = 0; n < howMany && near.length; n++) {
      const i = near[Math.floor(this.random() * near.length)];
      const from = this.seatOf(i);
      from.y += 1.5;
      const land = { x: target.x + (this.random() - 0.5) * 2 * spread, y: 0.02, z: target.z + (this.random() - 0.5) * 2 * spread };
      const flight = 1.2 + this.random() * 0.9;
      const g = 9.8;
      this.thrown.push({
        kind: this.random() < 0.84 ? "flower" : "hat",
        look: Math.floor(this.random() * 6),
        pos: from,
        vel: { x: (land.x - from.x) / flight, y: (land.y - from.y) / flight + (g * flight) / 2, z: (land.z - from.z) / flight },
        spin: (this.random() - 0.5) * 14,
        angle: this.random() * Math.PI * 2,
        landed: false,
      });
    }
  }

  private stepThrown(dt: number) {
    for (const t of this.thrown) {
      if (t.landed) continue;
      t.vel.y -= 9.8 * dt;
      t.pos = { x: t.pos.x + t.vel.x * dt, y: t.pos.y + t.vel.y * dt, z: t.pos.z + t.vel.z * dt };
      t.angle += t.spin * dt;
      if (t.pos.y <= 0.02) {
        t.pos.y = 0.02;
        t.landed = true;
      }
    }
  }
}
