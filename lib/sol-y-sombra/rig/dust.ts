import { type Vec3 } from "./vec";

/*
 * Sand kicked up by hooves, scraped by the pawing foot and dragged up by the
 * cape's hem: a pool of soft puffs that rise, drift, spread and fade.
 */

const CAPACITY = 900;

export class Dust {
  readonly x = new Float32Array(CAPACITY);
  readonly y = new Float32Array(CAPACITY);
  readonly z = new Float32Array(CAPACITY);
  readonly vx = new Float32Array(CAPACITY);
  readonly vy = new Float32Array(CAPACITY);
  readonly vz = new Float32Array(CAPACITY);
  readonly age = new Float32Array(CAPACITY);
  readonly life = new Float32Array(CAPACITY);
  readonly size = new Float32Array(CAPACITY);
  /** Live particles are packed at the front. */
  count = 0;
  private readonly random: () => number;

  constructor(random: () => number) {
    this.random = random;
  }

  emit(at: Vec3, push: Vec3, amount: number) {
    const n = Math.round(amount * 9);
    for (let k = 0; k < n && this.count < CAPACITY; k++) {
      const i = this.count++;
      const spread = 0.35 + amount * 0.4;
      this.x[i] = at.x + (this.random() - 0.5) * 0.18;
      this.y[i] = 0.02 + this.random() * 0.05;
      this.z[i] = at.z + (this.random() - 0.5) * 0.18;
      this.vx[i] = push.x * (0.5 + this.random()) + (this.random() - 0.5) * spread;
      this.vy[i] = push.y * (0.4 + this.random() * 0.8);
      this.vz[i] = push.z * (0.5 + this.random()) + (this.random() - 0.5) * spread;
      this.age[i] = 0;
      this.life[i] = 0.9 + this.random() * 1.1 + amount * 0.6;
      this.size[i] = 0.06 + this.random() * 0.08;
    }
  }

  step(dt: number, wind: Vec3) {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.swapOut(i);
        continue;
      }
      // Sand is heavy and the air thick with it: quick to slow down, slow to fall.
      const drag = Math.exp(-3.2 * dt);
      this.vx[i] = this.vx[i] * drag + wind.x * (1 - drag);
      this.vz[i] = this.vz[i] * drag + wind.z * (1 - drag);
      this.vy[i] = this.vy[i] * drag - 0.9 * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] = Math.max(0.02, this.y[i] + this.vy[i] * dt);
      this.z[i] += this.vz[i] * dt;
      this.size[i] += dt * 0.28;
      i++;
    }
  }

  /** 0–1: how visible a puff is now; it fades in fast and out slowly. */
  opacity(i: number) {
    const t = this.age[i] / this.life[i];
    return Math.min(1, t * 8) * (1 - t) * (1 - t);
  }

  private swapOut(i: number) {
    const last = --this.count;
    this.x[i] = this.x[last];
    this.y[i] = this.y[last];
    this.z[i] = this.z[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.vz[i] = this.vz[last];
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
  }
}
