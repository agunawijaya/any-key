import { hash1 } from "@/lib/two-humps/noise";
import { css, smoothstep, type Light, type RGB } from "./light";

/*
 * The sky: a gradient keyed to the sun, the sun and its halo, and at night a
 * star field with the Milky Way that wheels round the celestial pole. The
 * Gobi sits near 43° N, so the pole stands well up in the northern sky (to
 * the left of the scene) and the stars turn about it through the night.
 */

export type SkyView = { width: number; height: number; horizon: number };

export function drawSkyGradient(ctx: CanvasRenderingContext2D, view: SkyView, light: Light) {
  const g = ctx.createLinearGradient(0, 0, 0, view.horizon);
  g.addColorStop(0, css(light.zenith));
  g.addColorStop(0.55, css(light.midSky));
  g.addColorStop(1, css(light.horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.width, view.horizon + 2);
}

/** Where the sun sits on screen. Low suns sit just above the horizon line. */
export function sunPosition(view: SkyView, light: Light) {
  const lift = Math.sin((Math.max(-6, light.sunElevation) * Math.PI) / 180);
  return { x: light.sunX * view.width, y: view.horizon - lift * view.horizon * 1.25 };
}

export function drawSun(ctx: CanvasRenderingContext2D, view: SkyView, light: Light) {
  if (light.sunElevation < -7) return;
  const { x, y } = sunPosition(view, light);
  const unit = view.height / 1000;
  const low = 1 - smoothstep(4, 24, light.sunElevation);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // A wide halo that colours the whole side of the sky at golden hour, and a tighter bloom.
  for (const [radius, alpha] of [
    [900 * unit, 0.22 + 0.28 * low],
    [260 * unit, 0.35],
    [90 * unit, 0.5],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, css(light.glow, alpha));
    g.addColorStop(1, css(light.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  // The disc: squashed and redder as it nears the horizon, with a white-hot core.
  const r = 26 * unit;
  const disc: RGB = [255, 246 - 60 * low, 214 - 120 * low];
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgb(255 252 240)");
  g.addColorStop(0.6, css(disc));
  g.addColorStop(1, css(disc, 0.85));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (1 - 0.12 * low), 0, 0, Math.PI * 2);
  ctx.fill();
}

type Star = { r: number; theta: number; size: number; alpha: number; twinkle: number; tint: number };

const STAR_TINTS: RGB[] = [
  [255, 255, 255],
  [200, 216, 255],
  [255, 226, 190],
  [255, 200, 170],
];

/**
 * A night sky that turns about the pole. Stars are kept in polar coordinates
 * round the pole and placed every frame (a few thousand points, grouped into
 * one path per brightness); the Milky Way's glow is painted once into a small
 * offscreen canvas and drawn rotated and scaled up, since a glow can be soft.
 */
export class NightSky {
  private stars: Star[] = [];
  private glow: HTMLCanvasElement | null = null;
  private radius = 0;
  private glowScale = 0.25;

  constructor(private seed: number) {}

  /** Lays out the sky for a screen; call when the view's size changes. */
  build(view: SkyView, pole: { x: number; y: number }) {
    const corners = [
      [0, 0],
      [view.width, 0],
      [0, view.horizon],
      [view.width, view.horizon],
    ];
    this.radius = Math.max(...corners.map(([x, y]) => Math.hypot(x - pole.x, y - pole.y))) * 1.05;
    const R = this.radius;
    const area = (view.width * view.height) / (1920 * 1080);
    const rand = (i: number, k: number) => hash1(i * 7 + k, this.seed);

    this.stars = [];
    // Field stars, scattered evenly over the disc round the pole.
    const fieldCount = Math.round(2600 * area);
    for (let i = 0; i < fieldCount; i++) {
      const bright = rand(i, 1) ** 9;
      this.stars.push({
        r: Math.sqrt(rand(i, 2)) * R,
        theta: rand(i, 3) * Math.PI * 2,
        size: 0.5 + bright * 2.4,
        alpha: 0.25 + 0.75 * Math.max(bright * 1.4, rand(i, 4) * 0.6),
        twinkle: rand(i, 5),
        tint: Math.floor(rand(i, 6) * STAR_TINTS.length),
      });
    }
    // The Milky Way's own stars: crowded along the band, thinning away from it.
    const bandCount = Math.round(9000 * area);
    for (let i = 0; i < bandCount; i++) {
      const along = rand(i, 11) * 2 - 1;
      const across = gaussian(rand(i, 12), rand(i, 13)) * 0.05;
      const p = this.bandPoint(along, across);
      this.stars.push({
        r: Math.hypot(p.x, p.y),
        theta: Math.atan2(p.y, p.x),
        size: 0.4 + rand(i, 14) ** 6 * 1.4,
        alpha: 0.12 + 0.45 * rand(i, 15) ** 2,
        twinkle: rand(i, 16),
        tint: rand(i, 17) > 0.7 ? 2 : 0,
      });
    }

    this.paintGlow();
  }

  /** A point on the Milky Way band, relative to the pole: `along` runs −1…1 down its length, `across` is in units of R. */
  private bandPoint(along: number, across: number) {
    const R = this.radius;
    // The band arcs past the pole at about half the radius, tilted like the summer Milky Way.
    const tilt = -0.95;
    const dx = Math.cos(tilt);
    const dy = Math.sin(tilt);
    const centre = { x: -dy * 0.48 * R, y: dx * 0.48 * R };
    const bow = along * along * 0.18 * R;
    return {
      x: centre.x + dx * along * R + -dy * (across * R + bow),
      y: centre.y + dy * along * R + dx * (across * R + bow),
    };
  }

  private paintGlow() {
    const size = Math.ceil(this.radius * 2 * this.glowScale);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d")!;
    const s = this.glowScale;
    const toGlow = (p: { x: number; y: number }) => ({ x: size / 2 + p.x * s, y: size / 2 + p.y * s });
    const rand = (i: number, k: number) => hash1(i * 13 + k, this.seed + 7);

    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 900; i++) {
      const along = rand(i, 1) * 2 - 1;
      // The galactic core: brighter and warmer near one end of the band.
      const core = Math.exp(-((along - 0.35) ** 2) / 0.04);
      const p = toGlow(this.bandPoint(along, gaussian(rand(i, 2), rand(i, 3)) * 0.035));
      const r = (0.02 + rand(i, 4) * 0.05) * this.radius * s * (1 + core * 0.5);
      const tint: RGB = core > 0.3 ? [255, 206, 172] : rand(i, 5) > 0.5 ? [186, 198, 255] : [226, 220, 255];
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, css(tint, 0.022 + core * 0.03));
      grad.addColorStop(1, css(tint, 0));
      g.fillStyle = grad;
      g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    // Dust lanes: two ragged rifts that wander down the band, broken by gaps.
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 700; i++) {
      const along = rand(i, 21) * 1.6 - 0.8;
      const lane = rand(i, 25) > 0.4 ? 0 : 1;
      const path = lane === 0 ? Math.sin(along * 5 + 1.3) * 0.014 + Math.sin(along * 13 + 4) * 0.006 : 0.02 + Math.sin(along * 4 + 2.2) * 0.01;
      // Gaps: some stretches of each rift fade away entirely.
      const presence = Math.sin(along * 11 + lane * 3) * 0.5 + Math.sin(along * 23 + lane) * 0.5;
      if (presence < -0.3) continue;
      const p = toGlow(this.bandPoint(along, path + gaussian(rand(i, 23), rand(i, 26)) * 0.006));
      const r = (0.003 + rand(i, 24) ** 3 * 0.02) * this.radius * s;
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, "rgb(0 0 0 / 0.32)");
      grad.addColorStop(1, "rgb(0 0 0 / 0)");
      g.fillStyle = grad;
      g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    this.glow = canvas;
  }

  /** `turn` is the sky's rotation in radians; `visible` fades the whole sky in at dusk. */
  draw(ctx: CanvasRenderingContext2D, pole: { x: number; y: number }, turn: number, visible: number, time: number) {
    if (visible <= 0.01 || !this.glow) return;
    ctx.save();
    ctx.globalAlpha = visible;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(pole.x, pole.y);
    ctx.rotate(turn);
    const size = this.glow.width / this.glowScale;
    ctx.drawImage(this.glow, -size / 2, -size / 2, size, size);
    ctx.restore();

    // Stars in brightness buckets, one path each.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const buckets: Path2D[][] = STAR_TINTS.map(() => [new Path2D(), new Path2D(), new Path2D(), new Path2D()]);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (const star of this.stars) {
      const x0 = Math.cos(star.theta) * star.r;
      const y0 = Math.sin(star.theta) * star.r;
      const x = pole.x + x0 * cos - y0 * sin;
      const y = pole.y + x0 * sin + y0 * cos;
      const twinkle = 0.75 + 0.25 * Math.sin(time * (1.5 + star.twinkle * 3) + star.twinkle * 40);
      const level = Math.min(3, Math.floor(star.alpha * twinkle * 4));
      buckets[star.tint][level].rect(x - star.size / 2, y - star.size / 2, star.size, star.size);
    }
    buckets.forEach((levels, tint) =>
      levels.forEach((path, level) => {
        ctx.fillStyle = css(STAR_TINTS[tint], ((level + 1) / 4) * visible);
        ctx.fill(path);
      }),
    );
    ctx.restore();
  }
}

/** A standard normal sample from two uniforms (Box–Muller). */
function gaussian(u: number, v: number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, u))) * Math.cos(2 * Math.PI * v);
}
