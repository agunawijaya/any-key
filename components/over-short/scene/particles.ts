import { css, mix, type Rgb } from "./color";
import { fbm2, hash1, smoothstep } from "./noise";
import { context, makeCanvas, type Ctx } from "./paint";

/*
 * Smoke, dust, fire, sparks, debris and clods of earth, simulated in metres
 * (x across, y up, z into the scene) with fixed steps, so a seed and a time
 * always give the same picture. A view supplies the projection when drawing:
 * the side view and the observer's view share the same effects.
 */

export type Projected = { x: number; y: number; scale: number };
/** Metres in the scene to pixels on screen; `scale` is pixels per metre at that point. */
export type Projector = (x: number, y: number, z: number) => Projected | null;

/** `blaze` is the body of a fireball: a billow that burns yellow, then red, then rolls on as black smoke. */
export type ParticleKind = "smoke" | "dust" | "blaze" | "fire" | "spark" | "spray" | "debris" | "clod" | "flash" | "ring";

export type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  /** Radius (or length) in metres when born, and how fast it grows. */
  size: number;
  grow: number;
  angle: number;
  spin: number;
  color: Rgb;
  /** 0–1 per particle, for variety in shape and shade. */
  seed: number;
  /** Peak opacity. */
  alpha: number;
  /** Smoke only: billows with a lit side and a shadowed side (rather than soft haze), lit from the sky or from a fire below. */
  billow?: "above" | "below";
  /** Smoke only: the colour it fades to as it ages, like smoke cooling as it leaves the fire. */
  cools?: Rgb;
  /** Smoke and dust only: pale spray that the star shells light up, so the night does not darken it. */
  pale?: boolean;
  /** Where along x the effect it belongs to started: the point it is drawn larger around (see `magnify`). */
  ax: number;
};

/** Light thrown by an effect: a burst, a fire, a flare. */
export type SceneLight = { x: number; y: number; z: number; radius: number; color: Rgb; intensity: number };

type Scheduled = { at: number; run: () => void };
type LightTrack = { light: SceneLight; born: number; curve: (age: number) => number; life: number; ax: number };

const GRAVITY = 9.81;
export const STEP = 1 / 60;

export class Particles {
  items: Particle[] = [];
  /** The effects' own seeded randomness, so a seed and a time always give the same picture. */
  constructor(readonly random: () => number) {}

  time = 0;
  /** Wind in metres per second along x (and a little along z). */
  wind = { x: 2.5, z: 0 };
  /**
   * How much larger than life the effects are drawn, each around the point
   * where it started. The side view needs it: its land is a few kilometres
   * across, so a burst at true size would be a few pixels, while its gun and
   * targets are drawn many times larger than life. The motion is unchanged;
   * only the drawing grows.
   */
  magnify = 1;
  private anchorX = 0;
  private queue: Scheduled[] = [];
  private tracks: LightTrack[] = [];

  /** Effects call this first: the particles and lights they add belong to a burst centred on `x`. */
  anchorAt(x: number) {
    this.anchorX = x;
  }

  add(p: Partial<Particle> & Pick<Particle, "kind" | "x" | "y" | "z" | "life" | "size" | "color">) {
    this.items.push({ vx: 0, vy: 0, vz: 0, age: 0, grow: 0, angle: 0, spin: 0, seed: this.random(), alpha: 1, ax: this.anchorX, ...p });
  }

  /** Runs `run` when the effect's clock reaches `delay` seconds from now. */
  after(delay: number, run: () => void) {
    this.queue.push({ at: this.time + delay, run });
    this.queue.sort((a, b) => a.at - b.at);
  }

  /** A light whose strength follows `curve(age)` (0–1) for `life` seconds. */
  light(light: SceneLight, life: number, curve: (age: number) => number) {
    this.tracks.push({ light, born: this.time, curve, life, ax: this.anchorX });
  }

  get lights(): SceneLight[] {
    const m = this.magnify;
    return this.tracks.map((t) => ({
      ...t.light,
      x: t.ax + (t.light.x - t.ax) * m,
      y: t.light.y * m,
      radius: t.light.radius * m,
      intensity: t.light.intensity * t.curve(this.time - t.born),
    }));
  }

  get busy() {
    return this.items.length > 0 || this.queue.length > 0;
  }

  /** Runs the simulation forward by `dt` seconds in fixed steps. */
  advance(dt: number) {
    const end = this.time + dt;
    while (this.time + STEP <= end + 1e-9) this.step();
  }

  private step() {
    this.time += STEP;
    while (this.queue.length && this.queue[0].at <= this.time) this.queue.shift()!.run();
    this.tracks = this.tracks.filter((t) => this.time - t.born < t.life);
    const dt = STEP;
    for (const p of this.items) {
      p.age += dt;
      switch (p.kind) {
        case "blaze": {
          // Burning gas rises hard at first, then the cooling smoke drifts like any other.
          p.vy += 9 * Math.exp(-p.age * 1.4) * dt;
          const drag = Math.exp(-dt * 1.4);
          p.vx = (p.vx - this.wind.x) * drag + this.wind.x;
          p.vz *= drag;
          p.vy *= Math.exp(-dt * 0.6);
          break;
        }
        case "smoke":
        case "dust": {
          // Hot smoke rises and slows; everything drifts with the wind and spreads.
          const rise = p.kind === "smoke" ? 1.6 * Math.exp(-p.age * 0.35) : 0.25;
          p.vy += rise * dt;
          const drag = Math.exp(-dt * 0.9);
          p.vx = (p.vx - this.wind.x) * drag + this.wind.x;
          p.vz = (p.vz - this.wind.z) * drag + this.wind.z;
          p.vy *= Math.exp(-dt * 0.35);
          break;
        }
        case "fire":
          p.vy += 3 * dt;
          p.vx *= Math.exp(-dt * 2);
          p.vz *= Math.exp(-dt * 2);
          break;
        case "spark":
        case "spray":
        case "debris":
        case "clod":
          p.vy -= GRAVITY * dt;
          p.vx *= Math.exp(-dt * (p.kind === "spark" ? 0.6 : 0.15));
          if (p.y <= 0 && p.vy < 0) {
            // Landed: clods and debris stop, sparks die.
            p.y = 0;
            p.vx = p.vy = p.vz = 0;
            p.spin = 0;
            if (p.kind === "spark" || p.kind === "spray") p.age = p.life;
          }
          break;
        default:
          break;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += p.grow * dt;
      p.angle += p.spin * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  /**
   * Draws every particle through `project`, back layers first; `ambient`
   * darkens smoke at night. Smoke and dust are soft, so they are painted
   * into a half-size layer and laid over the view in one go: big billows
   * cost a quarter of the pixels.
   */
  draw(ctx: Ctx, project: Projector, ambient: { night: number }) {
    const order: ParticleKind[] = ["dust", "smoke", "blaze", "ring", "spray", "debris", "clod", "fire", "flash", "spark"];
    // Farther first within a kind, so nearer smoke covers farther smoke; a fireball's hottest billows on top.
    const sorted = [...this.items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.kind === "blaze" ? coolness(b) - coolness(a) : b.z - a.z));
    const soft = sorted.filter((p) => p.kind === "smoke" || p.kind === "dust");
    if (soft.length) {
      const layer = softLayer(ctx.canvas.width, ctx.canvas.height);
      const s = context(layer);
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = "source-over";
      s.globalAlpha = 1;
      s.clearRect(0, 0, layer.width, layer.height);
      const m = ctx.getTransform();
      s.setTransform(m.a * SOFT_SCALE, m.b, m.c, m.d * SOFT_SCALE, m.e * SOFT_SCALE, m.f * SOFT_SCALE);
      for (const p of soft) {
        const at = this.place(project, p);
        if (at) drawParticle(s, p, at, ambient.night);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    for (const p of sorted) {
      if (p.kind === "smoke" || p.kind === "dust") continue;
      const at = this.place(project, p);
      if (at) drawParticle(ctx, p, at, ambient.night);
    }
  }

  /** Where a particle is drawn, and at what size: magnified around its effect's centre. */
  private place(project: Projector, p: Particle): Projected | null {
    const m = this.magnify;
    if (m === 1) return project(p.x, p.y, p.z);
    const at = project(p.ax + (p.x - p.ax) * m, p.y * m, p.z);
    return at && { ...at, scale: at.scale * m };
  }
}

const SOFT_SCALE = 0.5;
let softBuffer: HTMLCanvasElement | null = null;

function softLayer(width: number, height: number) {
  const w = Math.ceil(width * SOFT_SCALE);
  const h = Math.ceil(height * SOFT_SCALE);
  if (!softBuffer || softBuffer.width !== w || softBuffer.height !== h) softBuffer = makeCanvas(w, h);
  return softBuffer;
}

/* ---------- Drawing ---------- */

const life01 = (p: Particle) => p.age / p.life;

/** How far a fireball's billow has cooled, 0 to past 1: each billow burns at its own pace. */
const coolness = (p: Particle) => life01(p) / (0.8 + p.seed * 0.5);

function drawParticle(ctx: Ctx, p: Particle, at: Projected, night: number) {
  const r = Math.max(0.5, p.size * at.scale);
  const t = life01(p);
  switch (p.kind) {
    case "smoke":
    case "dust": {
      // Fades in fast, out slowly.
      const a = p.alpha * smoothstep(0, 0.08, t) * (1 - smoothstep(0.35, 1, t));
      // Smoke over a fire glows orange only at night; by day the fire is lost in daylight and the smoke is simply black.
      const fireLit = p.billow === "below" && night > 0.5;
      const born = fireLit && p.cools ? mix(p.color, p.cools, smoothstep(0, 0.28, t)) : (p.cools ?? p.color);
      // Unlit smoke at night is a dark shape against the sky; smoke lit by a fire below keeps its glow.
      const darken = p.pale ? night * 0.35 : fireLit ? night * smoothstep(0.08, 0.35, t) : night;
      const color = darken > 0 ? mix(born, [born[0] * 0.28, born[1] * 0.3, born[2] * 0.36], darken) : born;
      const sprite = puff(Math.floor(p.seed * PUFF_VARIANTS), color, p.billow ? (fireLit ? "below" : "above") : undefined);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(at.x, at.y);
      ctx.rotate(p.angle);
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case "blaze": {
      // Yellow-white at the heart, red as it cools, then the black smoke it becomes; each billow at its own pace.
      const cooled = coolness(p);
      const hot = mix(mix([255, 232, 160], [255, 196, 96], p.seed), [214, 82, 30], smoothstep(0, 0.3, cooled));
      const color = mix(hot, mix([30, 26, 24], [64, 54, 46], p.seed), smoothstep(0.25, 0.7, cooled));
      const a = p.alpha * smoothstep(0, 0.04, t) * (1 - smoothstep(0.6, 1, t));
      const sprite = puff(Math.floor(p.seed * PUFF_VARIANTS), color, "below");
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(at.x, at.y);
      ctx.rotate(p.angle);
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
      ctx.restore();
      // While it is still burning it glows from inside.
      const glow = 1 - smoothstep(0, 0.45, t);
      if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, glow * 0.7 * p.alpha);
        ctx.drawImage(flame(t * 1.8), at.x - r * 0.75, at.y - r * 0.75, r * 1.5, r * 1.5);
        ctx.restore();
      }
      break;
    }
    case "fire": {
      const heat = 1 - t;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, p.alpha * Math.min(1, heat * 1.6));
      ctx.drawImage(flame(t), at.x - r, at.y - r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case "flash": {
      const a = p.alpha * (1 - smoothstep(0, 1, t));
      const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
      g.addColorStop(0, css([255, 250, 230], a));
      g.addColorStop(0.25, css([255, 200, 120], a * 0.6));
      g.addColorStop(1, css([255, 120, 40], 0));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case "ring": {
      // A pressure ring racing outwards along the ground: a thin bright ellipse.
      // Seen only as a faint ripple in the air and dust, gone in a moment.
      const a = p.alpha * (1 - t) * (1 - t) * (night > 0.5 ? 0.35 : 0.45);
      ctx.save();
      ctx.strokeStyle = css(night > 0.5 ? [255, 210, 170] : [250, 245, 235], a);
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, r, r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "spark": {
      const a = p.alpha * (1 - t);
      const len = Math.max(2, Math.min(28, Math.hypot(p.vx, p.vy) * 0.02 * at.scale));
      const dir = Math.atan2(-p.vy, p.vx);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = css(mix([255, 245, 200], [255, 120, 30], t), a);
      ctx.lineWidth = Math.max(0.8, Math.min(2, r * 0.6));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x - Math.cos(dir) * len, at.y - Math.sin(dir) * len);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "spray": {
      // Wet earth thrown out in jets: a dark streak along its flight.
      const a = p.alpha * (1 - smoothstep(0.6, 1, t));
      const len = Math.max(2, Math.min(24, Math.hypot(p.vx, p.vy) * 0.025 * at.scale));
      const dir = Math.atan2(-p.vy, p.vx);
      ctx.save();
      ctx.strokeStyle = css(p.color, a);
      ctx.lineWidth = Math.max(1.4, r);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x - Math.cos(dir) * len, at.y - Math.sin(dir) * len);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "debris": {
      const a = p.alpha * (1 - smoothstep(0.8, 1, t));
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = css(p.color, a);
      ctx.fillRect(-r, -r * 0.28, r * 2, r * 0.56);
      ctx.restore();
      break;
    }
    case "clod": {
      const a = p.alpha * (1 - smoothstep(0.85, 1, t));
      ctx.save();
      ctx.fillStyle = css(p.color, a);
      ctx.beginPath();
      // A lumpy clod rather than a perfect dot.
      for (let k = 0; k < 7; k++) {
        const ang = p.angle + (k / 7) * Math.PI * 2;
        const rr = r * (0.75 + hash1(k, Math.floor(p.seed * 1e6)) * 0.5);
        const x = at.x + Math.cos(ang) * rr;
        const y = at.y + Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
  }
}

/* ---------- Sprites ---------- */

const FLAME_STEPS = 10;
const flames: HTMLCanvasElement[] = [];

/** A ball of flame as it cools: white-gold at first, then orange, then dull red. Made once per step. */
function flame(t: number) {
  const step = Math.min(FLAME_STEPS - 1, Math.floor(t * FLAME_STEPS));
  if (flames[step]) return flames[step];
  const k = step / (FLAME_STEPS - 1);
  const canvas = makeCanvas(64, 64);
  const ctx = context(canvas);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, css(mix([255, 236, 190], [255, 150, 60], k)));
  g.addColorStop(0.45, css(mix([255, 150, 50], [200, 60, 20], k), 0.7));
  g.addColorStop(1, css([120, 30, 10], 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  flames[step] = canvas;
  return canvas;
}

export const PUFF_VARIANTS = 6;
const PUFF_SIZE = 96;
/** Shading is stored in the grey shape at up to this much over white, then restored when tinting. */
const SHADE_HEADROOM = 1.4;
const shapes = new Map<string, HTMLCanvasElement>();
const tints = new Map<string, HTMLCanvasElement>();

/**
 * A billow of smoke in a colour: the grey shape for its variant, tinted.
 * Tints are cheap canvas operations, kept for re-use (colours are rounded
 * so smoke that changes colour as it cools reuses a handful of them).
 */
export function puff(variant: number, color: Rgb, billow?: "above" | "below") {
  const q = (v: number) => Math.round(v / 10) * 10;
  const key = `${variant}/${billow ?? "soft"}/${q(color[0])},${q(color[1])},${q(color[2])}`;
  const known = tints.get(key);
  if (known) return known;
  const shape = puffShape(variant, billow);
  const canvas = makeCanvas(PUFF_SIZE, PUFF_SIZE);
  const ctx = context(canvas);
  ctx.drawImage(shape, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = css([Math.min(255, q(color[0]) * SHADE_HEADROOM), Math.min(255, q(color[1]) * SHADE_HEADROOM), Math.min(255, q(color[2]) * SHADE_HEADROOM)]);
  ctx.fillRect(0, 0, PUFF_SIZE, PUFF_SIZE);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(shape, 0, 0);
  if (tints.size > 600) tints.delete(tints.keys().next().value!);
  tints.set(key, canvas);
  return canvas;
}

/**
 * Builds every billow shape and flame sprite ahead of time. Each shape is
 * worked out pixel by pixel, which takes a few milliseconds; done all at
 * once at the first burst, it would stall that frame.
 */
export function warmSprites() {
  for (let v = 0; v < PUFF_VARIANTS; v++) for (const billow of [undefined, "above", "below"] as const) puffShape(v, billow);
  for (let step = 0; step < FLAME_STEPS; step++) flame(step / FLAME_STEPS);
}

/**
 * The shape of a billow, in grey: a disc whose edge is eaten by noise, its
 * brightness the light falling on it. Soft haze is pale on top; billows
 * are shaded like a lumpy ball lit from above, or from a fire below.
 */
function puffShape(variant: number, billow?: "above" | "below") {
  const key = `${variant}/${billow ?? "soft"}`;
  const known = shapes.get(key);
  if (known) return known;
  const canvas = makeCanvas(PUFF_SIZE, PUFF_SIZE);
  const ctx = context(canvas);
  const image = ctx.createImageData(PUFF_SIZE, PUFF_SIZE);
  const half = PUFF_SIZE / 2;
  const light = billow === "above" ? [-0.45, -0.75, 0.5] : [0.15, 0.85, 0.5];
  for (let y = 0; y < PUFF_SIZE; y++) {
    for (let x = 0; x < PUFF_SIZE; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const d = Math.hypot(dx, dy);
      const n = fbm2(dx * 2.2 + variant * 9.1, dy * 2.2 + variant * 3.7, 77, 4);
      const edge = billow ? 1 - smoothstep(0.62 + n * 0.22, 0.92 + n * 0.1, d) : 1 - smoothstep(0.45 + n * 0.3, 1.0 + n * 0.15, d);
      const density = edge * (0.75 + 0.25 * fbm2(dx * 5 + variant, dy * 5, 31, 3));
      let shade: number;
      if (billow) {
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d * d)));
        const wobble = fbm2(dx * 3 + variant, dy * 3, 53, 2) * 0.35;
        const lambert = Math.max(0, (dx + wobble) * light[0] + (dy + wobble) * light[1] + nz * light[2]);
        shade = 0.5 + 0.85 * lambert;
      } else shade = 1.08 - 0.22 * smoothstep(-0.8, 0.9, dy);
      const v = Math.min(255, (shade / SHADE_HEADROOM) * 255);
      const i = (y * PUFF_SIZE + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = Math.max(0, Math.min(255, density * 255));
    }
  }
  ctx.putImageData(image, 0, 0);
  shapes.set(key, canvas);
  return canvas;
}
