import type { GradeId } from "@/lib/lander/grades";
import type { LandingLines, Outcome } from "@/lib/lander/solver";
import type { Palette, World } from "@/lib/lander/worlds";

/*
 * The descent, drawn on a canvas.
 *
 * Camera: the gap between the lander and the ground on screen grows with the
 * log of the altitude, so every tenfold drop in height takes the same slice of
 * screen. Each frame is drawn at one uniform scale (km per pixel) chosen to
 * give that gap, which makes the whole world zoom in smoothly as you fall: a
 * continuous version of the 1979 program's trick of redrawing the ground in
 * six ever-closer stages.
 *
 * Terrain is fractal (value noise plus craters at every scale), so there is
 * always detail at the current zoom, and it is flattened around the landing
 * spot. The lander keeps a readable size on screen whatever the scale.
 */

export type Ending = { grade: GradeId; at: number; impact: number };

export type SceneFrame = {
  world: World;
  night: boolean;
  startAlt: number;
  alt: number;
  speed: number;
  throttle: number;
  /** Real time in seconds. */
  now: number;
  ending: Ending | null;
  /** Burn guide: where a full burn from now would stop you (km), or null if it can't. */
  stop: { alt: number | null } | null;
  /** Ten-Second mode: the predicted path for the next turn. */
  ghost: { alts: number[]; stop: number | null } | null;
  /** Landing assist: the soft and limit lines, and what holding the throttle would do. */
  assist: { lines: LandingLines | null; outcome: Outcome } | null;
  /** Climbing: when and where the rise tops out, or still climbing under power. */
  rising: { peakIn: number; peakAlt: number } | { powered: true } | null;
  flag: HTMLImageElement | null;
  reduced: boolean;
};

type RGBA = [number, number, number, number];

function parse(c: string): RGBA {
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}

const cache = new Map<string, RGBA>();
function rgba(c: string) {
  let v = cache.get(c);
  if (!v) {
    v = parse(c);
    cache.set(c, v);
  }
  return v;
}

export function mix(a: string, b: string, t: number, alpha = 1) {
  const x = rgba(a);
  const y = rgba(b);
  const k = Math.min(1, Math.max(0, t));
  return `rgba(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)},${(x[3] + (y[3] - x[3]) * k) * alpha})`;
}

export const withAlpha = (c: string, a: number) => mix(c, c, 0, a);
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function hash(i: number, k: number, seed: number) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(k + 1, 668265263) + Math.imul(seed, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, k: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i, k, seed) * 2 - 1;
  const b = hash(i + 1, k, seed) * 2 - 1;
  return a + (b - a) * f * f * (3 - 2 * f);
}

export type TerrainStyle = { rough: number; craters: number; sea?: boolean; lumpy?: boolean; ridge: number };

export const STYLE: Record<World["id"], TerrainStyle> = {
  moon: { rough: 0.02, craters: 0.5, ridge: 0.9 },
  mars: { rough: 0.03, craters: 0.14, ridge: 1.3 },
  psyche: { rough: 0.034, craters: 0.55, lumpy: true, ridge: 0.8 },
  earth: { rough: 0, craters: 0, sea: true, ridge: 1.1 },
};

export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "fire" | "dust" | "debris" | "confetti" | "spark" | "smoke" | "oil"; rot: number; vr: number };

type Star = { x: number; y: number; r: number; p: number };

export const LANDER_M = 0.007; // real height of the lander, km
const PAD_KM = 0.02;

export class Scene {
  protected ctx: CanvasRenderingContext2D;
  protected w = 1;
  protected h = 1;
  protected dpr = 1;
  protected particles: Particle[] = [];
  protected stars: Star[];
  protected seed: number;
  protected last = 0;
  protected sceneTime = 0;
  protected nightMix = -1;
  protected endingSeen: Ending | null = null;
  protected pod = { x: 0, y: 0, vx: 0, vy: 0, on: false };

  constructor(protected canvas: HTMLCanvasElement, seed: number) {
    this.ctx = canvas.getContext("2d")!;
    this.seed = seed;
    this.stars = Array.from({ length: 260 }, (_, i) => ({ x: hash(i, 1, seed), y: hash(i, 2, seed), r: 0.4 + hash(i, 3, seed) ** 3 * 1.6, p: hash(i, 4, seed) * 6.28 }));
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  /** Where the ground line sits and how big things are, for a given altitude. */
  camera(alt: number, startAlt: number) {
    const groundY = this.h * (this.h < 560 ? 0.8 : 0.78);
    const landerPx0 = clamp(this.h * 0.085, 42, 78);
    // The lander's feet start low enough that its antenna clears the callouts at the top.
    const top = Math.max(this.w < 700 ? 160 : 110, this.h * 0.15) + landerPx0;
    const a0 = 0.006;
    const A = (groundY - top) / Math.log(1 + Math.max(startAlt, 1) / a0);
    const gap = A * Math.log(1 + Math.max(0, alt) / a0);
    const kmPerPx = alt > 1e-7 ? alt / gap : a0 / A;
    return { groundY, gap, kmPerPx, landerPx: Math.max(landerPx0, LANDER_M / kmPerPx), A, a0 };
  }

  render(f: SceneFrame) {
    const { ctx } = this;
    const dtReal = this.last ? clamp(f.now - this.last, 0, 0.1) : 0.016;
    this.last = f.now;

    // Theme changes fade between day and night instead of snapping.
    const targetNight = f.night ? 1 : 0;
    this.nightMix = this.nightMix < 0 ? targetNight : this.nightMix + clamp(targetNight - this.nightMix, -dtReal * 1.6, dtReal * 1.6);
    const pal = blend(f.world.palette.day, f.world.palette.night, this.nightMix);

    // A new ending: reset the slow-motion clock and the ejection pod.
    if (f.ending !== this.endingSeen) {
      this.endingSeen = f.ending;
      this.sceneTime = 0;
      if (f.ending) this.onImpact(f);
    }
    // Slow motion for the first moments after contact.
    const tau = f.ending ? Math.max(0, f.now - f.ending.at) : 0;
    const slow = f.ending && tau < 0.7 && !f.reduced ? 0.35 : 1;
    const dt = dtReal * slow;
    this.sceneTime += dt;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const alt = f.ending ? 0 : f.alt;
    const cam = this.camera(alt, f.startAlt);
    const cx = this.w / 2;

    // Camera shake on hard impacts.
    let sx = 0;
    let sy = 0;
    if (f.ending && !f.reduced && !["butter", "smooth", "bumpy", "lost"].includes(f.ending.grade)) {
      const amp = (f.ending.grade === "dented" ? 5 : f.ending.grade === "crater" || f.ending.grade === "oil" ? 18 : 11) * Math.max(0, 1 - tau / 0.9);
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }

    this.drawSky(f, pal, alt, cam.groundY);
    ctx.save();
    ctx.translate(sx, sy);
    this.drawRidges(f, pal, alt, cam, cx);
    this.drawPlanet(f, pal, alt, cam, cx);
    if (!f.ending) {
      this.drawAssist(f, cam, cx);
      this.drawRising(f, cam, cx);
      this.drawGuide(f, cam, cx);
      this.drawGhost(f, cam, cx);
    }
    this.drawLanderAndEnding(f, pal, cam, cx, tau, dt);
    this.drawClouds(f, pal, alt, cam, cx);
    this.updateParticles(dt, cam.groundY);
    this.drawParticles();
    ctx.restore();

    // Flash on violent endings.
    if (f.ending && tau < 0.5 && ["scrap", "confetti", "crater", "oil"].includes(f.ending.grade)) {
      ctx.fillStyle = `rgba(255,248,230,${(f.reduced ? 0.25 : 0.85) * (1 - tau / 0.5)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /* ---------- Sky ---------- */

  protected drawSky(f: SceneFrame, pal: Palette, alt: number, groundY: number) {
    const { ctx, w, h } = this;
    const air = f.world.air;
    const inAir = air ? smooth(air, air * 0.12, alt) : 1;
    const space = "#020309";
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, mix(space, pal.sky[0], inAir));
    g.addColorStop(0.55, mix(space, pal.sky[1], inAir));
    g.addColorStop(1, mix(space, pal.sky[2], inAir));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stars fade out inside a bright sky.
    const starAlpha = air ? pal.stars * inAir + Math.max(pal.stars, 0.35) * (1 - inAir) : pal.stars;
    if (starAlpha > 0.01) {
      if (this.nightMix > 0.3 && !air) this.drawMilkyWay(starAlpha * this.nightMix);
      for (const s of this.stars) {
        const tw = f.reduced ? 1 : 0.7 + 0.3 * Math.sin(this.sceneTime * 1.7 + s.p);
        ctx.fillStyle = `rgba(255,255,255,${starAlpha * tw * (0.35 + s.r / 2.2)})`;
        ctx.fillRect(s.x * w, s.y * groundY, s.r, s.r);
      }
    }

    // Mars at dusk: a blue glow around the low sun.
    if (pal.sunset && this.nightMix > 0.02) {
      const sxp = w * 0.24;
      const syp = groundY - 30;
      const r = Math.max(w, h) * 0.45;
      const glow = ctx.createRadialGradient(sxp, syp, 0, sxp, syp, r);
      glow.addColorStop(0, withAlpha(pal.sunset, this.nightMix));
      glow.addColorStop(0.35, withAlpha(pal.sunset, 0.35 * this.nightMix));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    if (pal.sun) {
      const night = this.nightMix;
      const sxp = night > 0.5 && pal.sunset ? w * 0.24 : w * 0.17;
      const syp = night > 0.5 && pal.sunset ? groundY - 26 : h * 0.15;
      const r = pal.sunset && night > 0.5 ? 7 : 14;
      const halo = ctx.createRadialGradient(sxp, syp, 0, sxp, syp, r * 9);
      halo.addColorStop(0, withAlpha(pal.sun, 0.9));
      halo.addColorStop(0.12, withAlpha(pal.sun, 0.35));
      halo.addColorStop(1, withAlpha(pal.sun, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sxp, syp, r * 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(sxp, syp, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pal.moon) this.drawSkyBody(f, pal.moon);
  }

  protected drawMilkyWay(alpha: number) {
    const { ctx, w, h } = this;
    ctx.save();
    ctx.translate(w * 0.55, h * 0.35);
    ctx.rotate(-0.42);
    const band = Math.max(w, h) * 0.22;
    const g = ctx.createLinearGradient(0, -band, 0, band);
    g.addColorStop(0, "rgba(160,150,255,0)");
    g.addColorStop(0.45, `rgba(190,180,255,${0.1 * alpha})`);
    g.addColorStop(0.5, `rgba(235,225,255,${0.16 * alpha})`);
    g.addColorStop(0.58, `rgba(190,180,255,${0.08 * alpha})`);
    g.addColorStop(1, "rgba(160,150,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-w * 1.5, -band, w * 3, band * 2);
    for (let i = 0; i < 160; i++) {
      const x = (hash(i, 40, this.seed) - 0.5) * w * 2.6;
      const y = (hash(i, 41, this.seed) + hash(i, 42, this.seed) - 1) * band * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * alpha * hash(i, 43, this.seed)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  /** Earth hanging over the Moon, or the Moon over Earth. */
  protected drawSkyBody(f: SceneFrame, m: NonNullable<Palette["moon"]>) {
    const { ctx, w, h } = this;
    const x = w * m.x;
    const y = h * m.y;
    const r = Math.max(10, Math.min(w, h) * m.r);
    const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.4);
    glow.addColorStop(0, m.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    if (f.world.id === "moon") {
      // Earth: ocean, two continents, a few cloud bands.
      const sea = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      sea.addColorStop(0, "#6fa8ff");
      sea.addColorStop(1, "#1d4fae");
      ctx.fillStyle = sea;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = "rgba(94,150,84,0.9)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.05, r * 0.28, r * 0.46, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(170,140,90,0.85)";
      ctx.beginPath();
      ctx.ellipse(x + r * 0.35, y + r * 0.3, r * 0.2, r * 0.26, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const [dx, dy, rx, rot] of [
        [-0.1, -0.55, 0.5, -0.2],
        [0.2, 0.05, 0.42, 0.3],
        [-0.35, 0.5, 0.36, -0.1],
      ])
        {
          ctx.beginPath();
          ctx.ellipse(x + r * dx, y + r * dy, r * rx, r * 0.07, rot, 0, Math.PI * 2);
          ctx.fill();
        }
    } else {
      // The full Moon with its grey seas.
      ctx.fillStyle = m.color;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = "rgba(140,140,140,0.35)";
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.32, 0, Math.PI * 2);
      ctx.arc(x + r * 0.25, y + r * 0.15, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    // The night side: a soft shadow over one edge.
    ctx.fillStyle = "rgba(2,3,12,0.72)";
    ctx.beginPath();
    ctx.arc(x + r * 0.62, y + r * 0.28, r * 1.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(160,200,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.55, Math.PI * 1.75);
    ctx.stroke();
  }

  /* ---------- Terrain ---------- */

  /** Surface height (km) at arc distance u (km) from the landing spot, for the current zoom. */
  protected heightAt(style: TerrainStyle, world: World, u: number, kmPerPx: number) {
    const L0 = Math.min(700, world.radius * 1.4);
    let h = 0;
    for (let k = 0; k < 26; k++) {
      const lambda = L0 / 2 ** k;
      const px = lambda / kmPerPx;
      if (px < 3) break;
      const fade = smooth(3, 14, px);
      // Big features are relatively flatter than small ones, as on real worlds.
      const amp = lambda <= 5 ? lambda : Math.sqrt(5 * lambda);
      h += vnoise(u / lambda, k, this.seed) * amp * style.rough * fade;
      if (style.craters) h += this.craters(u, lambda, k, style.craters) * fade;
    }
    return h;
  }

  protected craters(u: number, lambda: number, k: number, density: number) {
    const c0 = Math.floor(u / lambda);
    let sum = 0;
    for (let i = c0 - 1; i <= c0 + 1; i++) {
      if (hash(i, k + 50, this.seed) > density) continue;
      const center = (i + 0.2 + 0.6 * hash(i, k + 90, this.seed)) * lambda;
      const radius = lambda * (0.14 + 0.28 * hash(i, k + 130, this.seed));
      const d = Math.abs(u - center) / radius;
      if (d > 1.8) continue;
      // Small craters are deep for their size; big basins are shallow.
      const depth = radius <= 1 ? radius * 0.2 : 0.2 * Math.sqrt(radius);
      const rim = depth * 0.35;
      if (d < 1) sum -= depth * (1 - d * d);
      sum += rim * Math.exp(-(((d - 1) / 0.22) ** 2));
    }
    return sum;
  }

  /** Heights relative to the landing spot, levelled around it, plus any crater we made. */
  protected makeProfile(f: SceneFrame, kmPerPx: number, alt: number) {
    const style = STYLE[f.world.id];
    const world = f.world;
    if (style.sea) {
      return (u: number) => {
        // Gentle swell; the barge deck is the zero line, the sea sits 3 m below it.
        const swell = Math.sin(u * 700 + this.sceneTime * 1.3) * 0.00025 + Math.sin(u * 260 - this.sceneTime * 0.7) * 0.0004;
        return -0.003 + (kmPerPx < 0.002 ? swell : 0);
      };
    }
    const eps = Math.max(kmPerPx * 2, 0.0005);
    const h0 = this.heightAt(style, world, 0, kmPerPx);
    const slope = (this.heightAt(style, world, eps, kmPerPx) - this.heightAt(style, world, -eps, kmPerPx)) / (2 * eps);
    // Relief is exaggerated from high up on big worlds; a small one already shows its shape.
    const exag = 1 + 2.5 * smooth(3, 220, alt) * clamp((world.radius - 400) / 1000, 0, 1);
    const crater = this.craterMade(f);
    return (u: number) => {
      let h = this.heightAt(style, world, u, kmPerPx) - h0 - slope * u * Math.exp(-((u / 3) ** 2));
      h *= smooth(PAD_KM, PAD_KM * 3, Math.abs(u));
      h *= exag;
      if (crater) {
        const d = Math.abs(u) / crater.r;
        if (d < 1) h -= crater.depth * (1 - d * d);
        h += crater.depth * 0.3 * Math.exp(-(((d - 1) / 0.25) ** 2));
      }
      return h;
    };
  }

  protected craterMade(f: SceneFrame) {
    if (!f.ending || (f.ending.grade !== "crater" && f.ending.grade !== "oil")) return null;
    const grow = smooth(0, 0.25, this.sceneTime);
    const r = 0.012 + Math.min(1, f.ending.impact / 6000) * 0.05;
    return { r, depth: r * 0.35 * grow };
  }

  protected shape(world: World, theta: number) {
    if (!STYLE[world.id].lumpy) return 0;
    // Cosines only, so the ground is level at the landing spot (t = 0).
    const f = (t: number) => 0.12 * Math.cos(2 * t) + 0.05 * Math.cos(3 * t) + 0.03 * Math.cos(5 * t);
    return world.radius * (f(theta) - f(0));
  }

  protected drawPlanet(f: SceneFrame, pal: Palette, alt: number, cam: ReturnType<Scene["camera"]>, cx: number) {
    const { ctx, w, h } = this;
    // From high up, big worlds are drawn a little rounder than life so the curve reads.
    const R = f.world.radius / (1 + 3 * smooth(5, 150, alt) * clamp((f.world.radius - 400) / 1000, 0, 1));
    const s = cam.kmPerPx;
    const profile = this.makeProfile(f, s, alt);
    const halfKm = (w / 2 + 60) * s;
    const full = halfKm >= R * 0.98;
    const tMax = full ? Math.PI : Math.min(Math.PI, Math.asin(Math.min(1, halfKm / R)) * 1.05 + 1e-9);
    const n = full ? 900 : Math.ceil(w / 1.6);
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = -tMax + (2 * tMax * i) / n;
      const u = t * R;
      const lift = this.shape(f.world, t) + profile(u);
      const sinHalf = Math.sin(t / 2);
      const x = cx + ((R + lift) * Math.sin(t)) / s;
      const y = cam.groundY + (2 * R * sinHalf * sinHalf - lift * Math.cos(t)) / s;
      pts.push([x, y]);
    }

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    };

    // The glow of the air along the planet's edge, seen from above.
    if (f.world.air && alt > f.world.air * 0.08) {
      const width = clamp(f.world.air / s, 3, 140);
      const a = smooth(f.world.air * 0.08, f.world.air * 0.6, alt);
      trace();
      ctx.lineJoin = "round";
      ctx.save();
      ctx.shadowColor = withAlpha(pal.limb, a);
      ctx.shadowBlur = Math.min(60, width);
      ctx.strokeStyle = withAlpha(pal.limb, 0.22 * a);
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = withAlpha(pal.limb, 0.45 * a);
      ctx.lineWidth = Math.max(2, width * 0.25);
      ctx.stroke();
      ctx.restore();
    } else if (!f.world.air && alt > 20) {
      trace();
      ctx.strokeStyle = pal.limb;
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    trace();
    if (full) ctx.closePath();
    else {
      ctx.lineTo(w + 80, h + 80);
      ctx.lineTo(-80, h + 80);
      ctx.closePath();
    }
    const top = Math.min(...pts.map((p) => p[1]));
    const g = ctx.createLinearGradient(0, top, 0, Math.max(top + 40, h));
    g.addColorStop(0, pal.ground[0]);
    g.addColorStop(0.35, pal.ground[1]);
    g.addColorStop(1, pal.shade);
    ctx.fillStyle = g;
    ctx.fill();

    // Sunlight from the upper left on a whole little world.
    if (full) {
      const r = R / s;
      const shade = ctx.createRadialGradient(cx - r * 0.45, cam.groundY + r * 0.55, r * 0.2, cx, cam.groundY + r, r * 1.2);
      shade.addColorStop(0, "rgba(255,255,255,0.08)");
      shade.addColorStop(0.7, "rgba(0,0,0,0)");
      shade.addColorStop(1, withAlpha(pal.shade, 0.55));
      ctx.fillStyle = shade;
      ctx.fill();
    }

    // A thin bright rim where the light catches the ridges.
    trace();
    ctx.strokeStyle = withAlpha(pal.rim, 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (STYLE[f.world.id].sea) this.drawSea(f, pal, cam, cx);
    else if (pal.glint) this.drawGlints(f, pal, cam, cx, profile);
    this.drawPad(f, pal, cam, cx);
  }

  protected drawSea(f: SceneFrame, pal: Palette, cam: ReturnType<Scene["camera"]>, cx: number) {
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    const seaY = cam.groundY + 0.003 / s;
    // Glitter: sunlight by day, moonlight by night.
    if (s < 0.5) {
      const n = 90;
      for (let i = 0; i < n; i++) {
        const x = hash(i, 70, this.seed) * w;
        const depth = hash(i, 71, this.seed);
        const y = seaY + 3 + depth * 60;
        const on = f.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(this.sceneTime * 3 + i);
        ctx.fillStyle = `rgba(255,255,240,${0.35 * on * (1 - depth)})`;
        ctx.fillRect(x, y, 6 + 10 * (1 - depth), 1.2);
      }
    }
    // The landing barge, once it is more than a speck.
    const bargeKm = 0.036;
    if (bargeKm / s > 3) {
      const half = bargeKm / 2 / s;
      const deckY = cam.groundY;
      const hull = Math.max(2, 0.0045 / s);
      ctx.fillStyle = "#1e2229";
      ctx.fillRect(cx - half, deckY, half * 2, hull);
      ctx.fillStyle = "#3a404c";
      ctx.fillRect(cx - half, deckY, half * 2, Math.max(1, hull * 0.18));
      // Hazard stripes along the deck edge.
      if (half > 30) {
        const stripe = Math.max(4, half / 12);
        for (let x = -half; x < half; x += stripe * 2) {
          ctx.fillStyle = "#ffd23d";
          ctx.fillRect(cx + x, deckY + hull * 0.24, Math.min(stripe, half - x), hull * 0.16);
        }
      }
      // Deck lights.
      const blink = f.reduced || Math.sin(this.sceneTime * 4) > 0;
      ctx.fillStyle = blink ? "#ff5a3c" : "#7a2a20";
      ctx.fillRect(cx - half - 2, deckY - 3, 3, 3);
      ctx.fillRect(cx + half - 1, deckY - 3, 3, 3);
    }
  }

  protected drawGlints(f: SceneFrame, pal: Palette, cam: ReturnType<Scene["camera"]>, cx: number, profile: (u: number) => number) {
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 80, this.seed) * w;
      const u = (x - cx) * s;
      const y = cam.groundY - profile(u) / s + 2 + hash(i, 81, this.seed) * 30;
      const tw = f.reduced ? 0.6 : Math.max(0, Math.sin(this.sceneTime * 2.2 + i * 1.7));
      if (tw < 0.2) continue;
      ctx.fillStyle = withAlpha(pal.glint!, 0.8 * tw);
      const r = 1 + tw * 1.5;
      ctx.fillRect(x - r, y, r * 2, 1);
      ctx.fillRect(x, y - r, 1, r * 2);
    }
  }

  protected drawPad(f: SceneFrame, pal: Palette, cam: ReturnType<Scene["camera"]>, cx: number) {
    if (STYLE[f.world.id].sea) return;
    const s = cam.kmPerPx;
    const half = 0.014 / s;
    if (half < 6) return;
    const { ctx } = this;
    const blink = f.reduced || Math.sin(this.sceneTime * 3.2) > -0.2;
    for (const side of [-1, 1]) {
      const x = cx + side * half;
      const post = Math.max(4, 0.0025 / s);
      ctx.fillStyle = withAlpha(pal.shade, 0.9);
      ctx.fillRect(x - 1, cam.groundY - post, 2, post);
      ctx.fillStyle = blink ? "#39ff88" : "#1a6b40";
      ctx.beginPath();
      ctx.arc(x, cam.groundY - post, Math.max(2, post * 0.18), 0, Math.PI * 2);
      ctx.fill();
      if (blink) {
        const glow = ctx.createRadialGradient(x, cam.groundY - post, 0, x, cam.groundY - post, 14);
        glow.addColorStop(0, "rgba(57,255,136,0.5)");
        glow.addColorStop(1, "rgba(57,255,136,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 14, cam.groundY - post - 14, 28, 28);
      }
    }
  }

  /** Distant hills on the horizon, once you're low enough to see a horizon. */
  protected drawRidges(f: SceneFrame, pal: Palette, alt: number, cam: ReturnType<Scene["camera"]>, cx: number) {
    const style = STYLE[f.world.id];
    const s = cam.kmPerPx;
    const R = f.world.radius;
    const drop = ((this.w / 2) ** 2 * s) / (2 * R);
    const show = smooth(30, 6, alt) * clamp(1 - drop / 30, 0, 1);
    if (show < 0.01) return;
    const { ctx, w } = this;
    const air = f.world.air ? 0.55 : 0.2;
    for (const j of [2, 1]) {
      const sFar = s * (3 + j * 5) + 0.012 * j;
      const amp = style.ridge * (0.6 + j * 0.5);
      ctx.beginPath();
      const base = cam.groundY - 1;
      for (let x = -4; x <= w + 4; x += 3) {
        const u = (x - cx) * sFar + j * 91.7;
        let hh = 0;
        for (let k = 0; k < 7; k++) {
          const lambda = 60 / 2 ** k;
          hh += (vnoise(u / lambda, k + 20 * j, this.seed) * 0.5 + 0.5) * lambda * 0.012;
        }
        const y = base + ((x - cx) * (x - cx) * s) / (2 * R) - (hh * amp) / sFar - 2 * j;
        if (x === -4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 4, this.h + 10);
      ctx.lineTo(-4, this.h + 10);
      ctx.closePath();
      ctx.fillStyle = mix(pal.ground[j], pal.sky[2], air * (j === 2 ? 0.75 : 0.45), show);
      ctx.fill();
      if (pal.lights && this.nightMix > 0.3 && j === 1) {
        for (let i = 0; i < 70; i++) {
          const x = hash(i, 60, this.seed) * w;
          const y = cam.groundY - 2 - hash(i, 61, this.seed) * 6;
          const on = f.reduced ? 1 : 0.6 + 0.4 * Math.sin(this.sceneTime * 2 + i * 3.1);
          ctx.fillStyle = withAlpha(pal.lights, show * this.nightMix * on);
          ctx.fillRect(x, y, 1.6, 1.6);
        }
      }
    }
  }

  protected drawClouds(f: SceneFrame, pal: Palette, alt: number, cam: ReturnType<Scene["camera"]>, cx: number) {
    if (!f.world.air) return;
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    const mars = f.world.id === "mars";
    const color = mars ? mix(pal.sky[2], pal.dust, 0.4) : mix("#ffffff", "#5b6b99", this.nightMix);
    for (let i = 0; i < 26; i++) {
      const cAlt = (mars ? 5 : 2) + hash(i, 100, this.seed) * (mars ? 14 : 9);
      const x = cx + ((hash(i, 101, this.seed) - 0.5) * 70) / s;
      const y = cam.groundY - cAlt / s;
      const size = (0.8 + hash(i, 102, this.seed) * 4) / s;
      if (size < 6 || size > w * 6 || y < -size || y > this.h + size) continue;
      const a = (mars ? 0.18 : 0.75) * smooth(0, 0.4, alt);
      ctx.fillStyle = withAlpha(color, a);
      ctx.beginPath();
      if (mars) ctx.ellipse(x, y, size * 1.8, size * 0.12, 0, 0, Math.PI * 2);
      else
        for (let p = 0; p < 6; p++) {
          const px = x + (hash(i * 7 + p, 103, this.seed) - 0.5) * size * 1.4;
          const py = y + (hash(i * 7 + p, 104, this.seed) - 0.5) * size * 0.3;
          const pr = size * (0.18 + hash(i * 7 + p, 105, this.seed) * 0.22);
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, Math.PI * 2);
        }
      ctx.fill();
    }
  }

  /* ---------- Guide and ghost ---------- */

  protected altToY(alt: number, cam: ReturnType<Scene["camera"]>) {
    return cam.groundY - alt / cam.kmPerPx;
  }

  protected drawGuide(f: SceneFrame, cam: ReturnType<Scene["camera"]>, cx: number) {
    if (!f.stop) return;
    const { ctx } = this;
    const late = f.stop.alt === null || f.stop.alt <= 0;
    const alt = late ? 0 : f.stop.alt!;
    if (alt > f.alt) return;
    const y = this.altToY(alt, cam);
    const landerY = cam.groundY - cam.gap;
    const close = !late && (landerY > y - 1 ? true : alt < f.alt * 0.04);
    // Braking so hard you'd stop far above the ground wastes fuel.
    const early = !late && f.throttle >= 50 && alt > Math.max(5, f.alt * 0.3);
    const color = late ? "#ff4d5e" : close || early ? "#ffb020" : "#39e58c";
    // On narrow screens the label goes on the left, clear of the throttle lever.
    const dir = this.w < 700 ? -1 : 1;
    const half = this.w < 700 ? 60 : 90;
    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx + dir * (half + 6), y);
    ctx.lineTo(cx + dir * (half + 16), y - 6);
    ctx.lineTo(cx + dir * (half + 16), y + 6);
    ctx.fill();
    // A dark pill keeps the label readable on any sky.
    const label = late ? "CAN'T STOP" : early ? "STOP · TOO HIGH" : "STOP POINT";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    const tw = ctx.measureText(label).width;
    const lx = dir > 0 ? cx + half + 18 : cx - half - 18 - tw - 12;
    ctx.fillStyle = "rgba(8,10,20,0.72)";
    ctx.beginPath();
    ctx.roundRect(lx, y - 10, tw + 12, 20, 10);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx + 6, y + 0.5);
    ctx.restore();
  }

  /**
   * Landing assist: a green line (stay above it for 5 km/h or less) and an amber
   * one (below it even full power lands faster than 20), with the band between
   * them tinted. Lines above the top of the view are pinned there with an arrow.
   */
  protected drawAssist(f: SceneFrame, cam: ReturnType<Scene["camera"]>, cx: number) {
    const a = f.assist;
    if (!a || !a.lines) return;
    const { ctx } = this;
    const { five, twenty, strained } = a.lines;
    const topY = 64;
    const narrow = this.w < 700;
    // On phones the lines run across the screen (clear of the lever) with short labels on the far left.
    const x0 = narrow ? 12 : cx - 170;
    const x1 = narrow ? this.w - 92 : cx + 170;
    const landerY = cam.groundY - cam.gap;
    const place = (alt: number) => {
      const y = this.altToY(alt, cam);
      return { y: Math.max(topY, Math.min(cam.groundY, y)), pinned: y < topY };
    };
    ctx.save();
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    // Labels sit left of the lines on wide screens, just above them on narrow ones.
    const pill = (y: number, text: string, color: string, below = false) => {
      const tw = ctx.measureText(text).width;
      const x = narrow ? x0 : x0 - 8 - tw - 12;
      const yy = narrow ? y + (below ? 13 : -13) : y;
      ctx.fillStyle = "rgba(8,10,20,0.75)";
      ctx.beginPath();
      ctx.roundRect(x, yy - 10, tw + 12, 20, 10);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(text, x + 6, yy + 0.5);
    };
    const soft = "#39e58c";
    const limit = "#ffb020";
    if (twenty === null) {
      // Nothing can save a soft landing now: say so at the ground.
      ctx.strokeStyle = "#ff4d5e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, cam.groundY - 2);
      ctx.lineTo(x1, cam.groundY - 2);
      ctx.stroke();
      pill(cam.groundY - 14, "TOO FAST TO SURVIVE", "#ff4d5e");
      ctx.restore();
      return;
    }
    const lim = place(twenty);
    const sft = five === null ? null : place(five);
    // The band where you'd still walk away, but only by braking harder.
    if (sft && sft.y < lim.y) {
      const band = ctx.createLinearGradient(0, sft.y, 0, lim.y);
      band.addColorStop(0, "rgba(255,176,32,0.05)");
      band.addColorStop(1, "rgba(255,176,32,0.2)");
      ctx.fillStyle = band;
      ctx.fillRect(x0, sft.y, x1 - x0, lim.y - sft.y);
    }
    // A thin red glow under the limit: the crash zone starts here.
    const glow = ctx.createLinearGradient(0, lim.y, 0, lim.y + 14);
    glow.addColorStop(0, "rgba(255,77,94,0.28)");
    glow.addColorStop(1, "rgba(255,77,94,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x0, lim.y, x1 - x0, 14);

    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = limit;
    ctx.beginPath();
    ctx.moveTo(x0, lim.y);
    ctx.lineTo(x1, lim.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (sft) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = soft;
      ctx.shadowColor = "rgba(57,229,140,0.6)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x0, sft.y);
      ctx.lineTo(x1, sft.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Labels on the left; when the two lines are close, they share one row.
    const close = !!sft && Math.abs(lim.y - sft.y) < 22;
    const softText = narrow ? `🚩 5 KM/H${strained ? " · FULL" : ""}` : `🚩 UNDER 5 KM/H${strained ? " · FULL POWER" : ""}`;
    if (sft) pill(sft.y - (close && !narrow ? 11 : 0), `${sft.pinned ? "▲ " : ""}${softText}`, soft);
    pill(lim.y + (close && !narrow ? 11 : 0), `${lim.pinned ? "▲ " : ""}${narrow ? "20 LIMIT" : "20 KM/H LIMIT"}`, limit, narrow);

    // Close in: where holding this throttle would put you down.
    if (a.outcome && landerY > topY) {
      const o = a.outcome;
      const text = "lands" in o ? `→ ${Math.abs(o.lands) < 100 ? Math.abs(o.lands).toFixed(1) : Math.round(Math.abs(o.lands))} km/h` : `→ stops ${o.stops >= 1 ? o.stops.toFixed(1) + " km" : Math.round(o.stops * 1000) + " m"} up`;
      const color = "lands" in o ? (Math.abs(o.lands) < 5 ? soft : Math.abs(o.lands) < 20 ? limit : "#ff4d5e") : "#9fd2ff";
      const tw = ctx.measureText(text).width;
      // Beside the lander, or above it on phones where the lever takes the right side.
      const x = narrow ? cx - tw / 2 - 6 : cx + cam.landerPx * 0.55 + 10;
      const y = narrow ? landerY - cam.landerPx - 16 : landerY - cam.landerPx * 0.55;
      ctx.fillStyle = "rgba(8,10,20,0.75)";
      ctx.beginPath();
      ctx.roundRect(x, y - 10, tw + 12, 20, 10);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(text, x + 6, y + 0.5);
    }
    ctx.restore();
  }

  /** A chip beside a climbing lander: it keeps rising until gravity has used up its speed. */
  protected drawRising(f: SceneFrame, cam: ReturnType<Scene["camera"]>, cx: number) {
    const r = f.rising;
    if (!r) return;
    const { ctx } = this;
    const landerY = cam.groundY - cam.gap;
    const fmt = (km: number) => (km >= 10 ? `${Math.round(km)} km` : km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`);
    const text = "powered" in r ? "↑ climbing under power" : `↑ rising · top in ${r.peakIn < 10 ? r.peakIn.toFixed(1) : Math.round(r.peakIn)} s at ${fmt(r.peakAlt)}`;
    ctx.save();
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    const narrow = this.w < 700;
    const x = narrow ? cx - tw / 2 - 6 : cx + cam.landerPx * 0.55 + 10;
    const y = Math.max(78, narrow ? landerY - cam.landerPx - 16 : landerY - cam.landerPx * 0.55);
    ctx.fillStyle = "rgba(8,10,20,0.75)";
    ctx.beginPath();
    ctx.roundRect(x, y - 10, tw + 12, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#9fd2ff";
    ctx.fillText(text, x + 6, y + 0.5);
    ctx.restore();
  }

  protected drawGhost(f: SceneFrame, cam: ReturnType<Scene["camera"]>, cx: number) {
    if (!f.ghost) return;
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    f.ghost.alts.forEach((a, i) => {
      if (a < 0) return;
      const y = this.altToY(a, cam);
      ctx.beginPath();
      ctx.arc(cx + 44, y, i === f.ghost!.alts.length - 1 ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });
    const end = f.ghost.alts[f.ghost.alts.length - 1];
    if (end !== undefined && end >= 0) {
      ctx.globalAlpha = 0.35;
      drawLander(ctx, cx, this.altToY(end, cam), cam.landerPx, { throttle: 0, t: 0, night: this.nightMix, compress: 0, tilt: 0, broken: 0 });
    }
    ctx.restore();
    if (f.ghost.stop !== undefined) this.drawGuide({ ...f, stop: { alt: f.ghost.stop } }, cam, cx);
  }

  /* ---------- Lander, particles and endings ---------- */

  /** Debris, dust and the escape pod for an ending; (at, size) place it elsewhere than the middle of the ground line. */
  protected onImpact(f: SceneFrame, at?: { x: number; y: number }, landerSize?: number) {
    const cam = this.camera(0, f.startAlt);
    const cx = at ? at.x : this.w / 2;
    const y = at ? at.y : cam.groundY;
    const size = landerSize ?? cam.landerPx;
    const grade = f.ending!.grade;
    const ground = f.world.palette[f.night ? "night" : "day"].dust;
    const n = f.reduced ? 0.4 : 1;
    // A ring of dust for every touchdown.
    for (let i = 0; i < 70 * n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.particles.push({ x: cx + dir * Math.random() * size * 0.4, y: y - 2, vx: dir * (120 + Math.random() * (grade === "butter" ? 240 : 520)), vy: -Math.random() * 90, life: 0, max: 0.8 + Math.random() * 1.2, size: 2 + Math.random() * 5, color: ground, kind: "dust", rot: 0, vr: 0 });
    }
    if (["scrap", "confetti", "crater", "oil"].includes(grade)) {
      const pieces = grade === "scrap" ? 16 : grade === "confetti" ? 90 : 30;
      const colors = ["#f4f1ea", "#ff6b1a", "#e8b341", "#9aa0ab", "#1b2a4a"];
      for (let i = 0; i < pieces * n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const sp = 200 + Math.random() * (grade === "confetti" ? 700 : 450);
        this.particles.push({ x: cx, y: y - size * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 2 + Math.random() * 2.5, size: grade === "confetti" ? 4 + Math.random() * 5 : 3 + Math.random() * 9, color: colors[i % colors.length], kind: grade === "confetti" ? "confetti" : "debris", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
      }
      for (let i = 0; i < 26 * n; i++) this.particles.push({ x: cx + (Math.random() - 0.5) * size, y: y - Math.random() * size * 0.6, vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 60, life: 0, max: 2 + Math.random() * 2, size: 10 + Math.random() * 24, color: "rgba(60,58,66,0.5)", kind: "smoke", rot: 0, vr: 0 });
      // The pilot's escape capsule shoots off before the worst of it.
      this.pod = { x: cx, y: y - size, vx: 60, vy: -520, on: true };
    }
    if (grade === "crater" || grade === "oil") {
      for (let i = 0; i < 60 * n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 250 + Math.random() * 600;
        this.particles.push({ x: cx + (Math.random() - 0.5) * 20, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.6 + Math.random() * 1.6, size: 3 + Math.random() * 7, color: ground, kind: "debris", rot: 0, vr: (Math.random() - 0.5) * 8 });
      }
    }
  }

  protected emitEngine(f: SceneFrame, cam: ReturnType<Scene["camera"]>, cx: number, landerY: number, dt: number) {
    if (f.throttle <= 0.5 || f.reduced) return;
    const size = cam.landerPx;
    const k = f.throttle / 100;
    const count = Math.min(6, k * 180 * dt + Math.random());
    for (let i = 0; i < count; i++)
      this.particles.push({ x: cx + (Math.random() - 0.5) * size * 0.12, y: landerY - size * 0.16, vx: (Math.random() - 0.5) * 40, vy: size * (4 + Math.random() * 3) * (0.6 + k), life: 0, max: 0.18 + Math.random() * 0.22, size: size * (0.05 + Math.random() * 0.06), color: "#ffb35c", kind: "fire", rot: 0, vr: 0 });
    // Dust blown off the ground in the last few dozen metres.
    const near = 1 - f.alt / 0.06;
    if (near > 0) {
      const pal = f.world.palette[f.night ? "night" : "day"];
      const n = Math.min(10, near * k * 520 * dt);
      for (let i = 0; i < n; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.particles.push({ x: cx + dir * Math.random() * size * 0.25, y: cam.groundY - 1, vx: dir * (160 + Math.random() * 520) * (0.5 + near), vy: -Math.random() * 110 * near, life: 0, max: 0.6 + Math.random() * 0.9, size: 2 + Math.random() * 5, color: pal.dust, kind: "dust", rot: 0, vr: 0 });
      }
    }
  }

  protected updateParticles(dt: number, groundY: number) {
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.kind === "debris" || p.kind === "confetti" || p.kind === "oil") {
        p.vy += (p.kind === "confetti" ? 260 : 700) * dt;
        if (p.kind === "confetti") p.vx *= 1 - 1.5 * dt;
        if (p.y > groundY + 4 && p.vy > 0 && p.kind !== "oil") {
          p.vy *= -0.35;
          p.vx *= 0.6;
        }
      } else if (p.kind === "dust") {
        p.vx *= 1 - 2.2 * dt;
        p.vy = p.vy * (1 - 2 * dt) + 12 * dt;
      } else if (p.kind === "smoke" || p.kind === "spark") {
        p.vy -= 10 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      keep.push(p);
    }
    this.particles = keep.length > 1600 ? keep.slice(-1600) : keep;
  }

  protected drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const t = p.life / p.max;
      if (p.kind === "fire") {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = t < 0.4 ? `rgba(255,200,120,${0.55 * (1 - t)})` : `rgba(255,120,60,${0.4 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.kind === "dust" || p.kind === "smoke") {
        ctx.fillStyle = withAlpha(p.color, (p.kind === "dust" ? 0.55 : 1) * (1 - t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t * (p.kind === "smoke" ? 2 : 1.2)), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "spark") {
        ctx.fillStyle = `rgba(255,${180 - t * 100},80,${1 - t})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      } else if (p.kind === "oil") {
        ctx.fillStyle = `rgba(12,10,20,${1 - t * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(150,120,255,${0.5 * (1 - t)})`;
        ctx.fillRect(p.x - p.size * 0.4, p.y - p.size * 0.5, p.size * 0.5, p.size * 0.3);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = withAlpha(p.color, t > 0.8 ? (1 - t) * 5 : 1);
        if (p.kind === "confetti") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else {
          ctx.beginPath();
          ctx.moveTo(-p.size / 2, -p.size / 3);
          ctx.lineTo(p.size / 2, -p.size / 2);
          ctx.lineTo(p.size / 3, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  protected drawLanderAndEnding(f: SceneFrame, pal: Palette, cam: ReturnType<Scene["camera"]>, cx: number, tau: number, dt: number, groundY = cam.groundY) {
    const { ctx } = this;
    const size = cam.landerPx;
    const landerY = groundY - cam.gap;
    const t = this.sceneTime;

    if (!f.ending) {
      // Engine light on the ground close in.
      if (f.throttle > 0 && f.alt < 0.2) {
        const r = size * 3;
        const glow = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, r);
        glow.addColorStop(0, `rgba(255,170,90,${0.45 * (f.throttle / 100) * (1 - f.alt / 0.2)})`);
        glow.addColorStop(1, "rgba(255,170,90,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - r, groundY - r, r * 2, r * 2);
      }
      this.emitEngine(f, cam, cx, landerY, dt);
      drawLander(ctx, cx, landerY, size, { throttle: f.throttle, t, night: this.nightMix, compress: 0, tilt: 0, broken: 0 });
      return;
    }

    const grade = f.ending.grade;
    const y = groundY;
    if (grade === "lost") return;

    if (grade === "butter" || grade === "smooth" || grade === "bumpy") {
      const bounce = grade === "bumpy" ? Math.max(0, Math.sin(tau * 9) * Math.exp(-tau * 3)) * size * 0.18 : 0;
      const compress = Math.exp(-tau * 5) * Math.abs(Math.cos(tau * 12)) * (grade === "butter" ? 0.25 : 0.6);
      const tilt = grade === "bumpy" ? smooth(0, 0.5, tau) * 0.1 : 0;
      drawLander(ctx, cx, y - bounce, size, { throttle: 0, t, night: this.nightMix, compress, tilt, broken: 0 });
      if (grade === "butter" && tau < 1.6 && !f.reduced) {
        // A little shine for the softest touchdowns.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const k = 1 - tau / 1.6;
        ctx.strokeStyle = `rgba(255,236,150,${0.8 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, y, size * (0.6 + tau * 2), size * (0.12 + tau * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + tau;
          const r = size * (0.7 + tau * 0.8);
          star4(ctx, cx + Math.cos(a) * r, y - size * 0.6 + Math.sin(a) * r * 0.5, 6 * k);
        }
        ctx.restore();
      }
      if (grade !== "bumpy") this.drawFlagScene(f, cx, y, size, tau);
      return;
    }

    if (grade === "dented") {
      drawLander(ctx, cx, y + size * 0.05, size, { throttle: 0, t, night: this.nightMix, compress: 1, tilt: smooth(0, 0.4, tau) * 0.3, broken: 1 });
      // Sparks and smoke drift up from the wreck, like the 1979 version's rising pixels.
      if (!f.reduced && tau < 4 && Math.random() < 0.6) {
        this.particles.push({ x: cx + (Math.random() - 0.5) * size * 0.5, y: y - size * 0.3, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 60, life: 0, max: 1 + Math.random(), size: 2, color: "#ffb35c", kind: "spark", rot: 0, vr: 0 });
        if (Math.random() < 0.3) this.particles.push({ x: cx, y: y - size * 0.4, vx: (Math.random() - 0.5) * 20, vy: -30, life: 0, max: 2.5, size: 8 + Math.random() * 10, color: "rgba(70,68,76,0.35)", kind: "smoke", rot: 0, vr: 0 });
      }
      if (tau > 1.4) drawAstronaut(ctx, cx + size * 0.95, y, size * 0.42, { walk: 0, wave: Math.sin(tau * 6) > 0 ? 1 : 0.4 });
      return;
    }

    // Explosions, craters and oil.
    if (tau < 0.8) {
      const r = size * (grade === "scrap" ? 1.2 : 2.2) * smooth(0, 0.4, tau);
      const fire = ctx.createRadialGradient(cx, y - size * 0.3, 0, cx, y - size * 0.3, r + 1);
      fire.addColorStop(0, `rgba(255,250,220,${1 - tau / 0.8})`);
      fire.addColorStop(0.4, `rgba(255,150,60,${0.9 * (1 - tau / 0.8)})`);
      fire.addColorStop(1, "rgba(200,40,20,0)");
      ctx.fillStyle = fire;
      ctx.beginPath();
      ctx.arc(cx, y - size * 0.3, r + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((grade === "crater" || grade === "oil") && tau < 1.2) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - tau / 1.2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, y, size * tau * 9, size * tau * 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (grade === "oil" && tau > 0.7 && tau < 9 && !f.reduced) {
      const n = tau < 6 ? 6 : 2;
      for (let i = 0; i < n; i++) this.particles.push({ x: cx + (Math.random() - 0.5) * 8, y: y + 4, vx: (Math.random() - 0.5) * 140, vy: -(520 + Math.random() * 420) * (tau < 6 ? 1 : 0.5), life: 0, max: 1.8, size: 2.5 + Math.random() * 3.5, color: "#000", kind: "oil", rot: 0, vr: 0 });
    }
    if (this.pod.on) {
      this.pod.vy += 260 * dt;
      this.pod.x += this.pod.vx * dt;
      this.pod.y += this.pod.vy * dt;
      if (this.pod.y < -40 || this.pod.y > this.h + 40) this.pod.on = false;
      ctx.fillStyle = "#f4f1ea";
      ctx.beginPath();
      ctx.arc(this.pod.x, this.pod.y, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff6b1a";
      ctx.fillRect(this.pod.x - size * 0.12, this.pod.y + size * 0.06, size * 0.24, size * 0.05);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.pod.x, this.pod.y + size * 0.14);
      ctx.lineTo(this.pod.x - this.pod.vx * 0.12, this.pod.y - this.pod.vy * 0.12);
      ctx.stroke();
    }
  }

  /** The climb-out and flag plant, for landings gentle enough (5 km/h or less). */
  protected drawFlagScene(f: SceneFrame, cx: number, y: number, size: number, tau: number) {
    const { ctx } = this;
    if (tau < 1.1) return;
    const astroH = size * 0.42;
    const doorX = cx + size * 0.32;
    let ax: number;
    let ay = y;
    let walk = 0;
    if (tau < 1.9) {
      // Down the ladder.
      const k = smooth(1.1, 1.9, tau);
      ax = doorX;
      ay = y - size * 0.45 * (1 - k);
    } else {
      const k = smooth(1.9, 3.0, tau);
      ax = doorX + k * size * 0.75;
      walk = tau < 3.0 ? tau * 8 : 0;
    }
    const poleX = doorX + size * 1.0;
    const planted = smooth(3.0, 3.5, tau);
    if (planted > 0) {
      const poleH = size * 0.95 * planted;
      ctx.strokeStyle = "#d8dbe2";
      ctx.lineWidth = Math.max(1.5, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(poleX, y + 2);
      ctx.lineTo(poleX, y - poleH);
      ctx.stroke();
      if (planted >= 1 && f.flag && f.flag.complete && f.flag.naturalWidth) {
        const fw = size * 0.62;
        const fh = fw * (f.flag.naturalHeight / f.flag.naturalWidth);
        const slices = 16;
        const sw = f.flag.naturalWidth / slices;
        for (let i = 0; i < slices; i++) {
          const k = i / slices;
          const wave = f.reduced ? 0 : Math.sin(tau * 5 - i * 0.55) * fh * 0.08 * k;
          ctx.drawImage(f.flag, i * sw, 0, sw + 0.5, f.flag.naturalHeight, poleX + k * fw, y - poleH + wave, fw / slices + 0.6, fh);
        }
      }
    }
    drawAstronaut(ctx, ax, ay, astroH, { walk, wave: planted >= 1 ? (Math.sin(tau * 5) > 0 ? 1 : 0.5) : 0 });
  }
}

export function blend(a: Palette, b: Palette, t: number): Palette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const m = (x: string, y: string) => mix(x, y, t);
  return {
    ...(t < 0.5 ? a : b),
    sky: [m(a.sky[0], b.sky[0]), m(a.sky[1], b.sky[1]), m(a.sky[2], b.sky[2])],
    ground: [m(a.ground[0], b.ground[0]), m(a.ground[1], b.ground[1]), m(a.ground[2], b.ground[2])],
    rim: m(a.rim, b.rim),
    shade: m(a.shade, b.shade),
    limb: m(a.limb, b.limb),
    stars: a.stars + (b.stars - a.stars) * t,
    dust: m(a.dust, b.dust),
  };
}

export function star4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = "rgba(255,240,170,0.9)";
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.fill();
}

type LanderPose = { throttle: number; t: number; night: number; compress: number; tilt: number; broken: number };

/**
 * The lander: a cream capsule with a big round window, a gold-foil descent
 * stage, two splayed legs and an engine bell. (x, footY) is the middle of the
 * footpads; `size` is the height from footpads to antenna.
 */
export function drawLander(ctx: CanvasRenderingContext2D, x: number, footY: number, size: number, pose: LanderPose) {
  const s = size;
  const body = mix("#f4f1ea", "#c3c7d8", pose.night * 0.8);
  const bodyShade = mix("#d9d3c6", "#8a90a8", pose.night * 0.8);
  const foil = mix("#e8b341", "#a98a4a", pose.night * 0.7);
  const foilDark = mix("#b98524", "#6d5a33", pose.night * 0.7);
  const drop = pose.compress * s * 0.07;

  ctx.save();
  ctx.translate(x, footY);
  ctx.rotate(pose.tilt);

  // Flame first, so the bell sits on top of it.
  if (pose.throttle > 0.5) {
    const k = pose.throttle / 100;
    const flicker = 0.85 + 0.3 * Math.abs(Math.sin(pose.t * 37) * Math.sin(pose.t * 23 + 1));
    const len = s * (0.25 + 1.5 * Math.sqrt(k)) * flicker;
    const top = -s * 0.2 + drop;
    const wid = s * (0.1 + 0.08 * k);
    const outer = ctx.createLinearGradient(0, top, 0, top + len);
    outer.addColorStop(0, "rgba(255,190,110,0.95)");
    outer.addColorStop(0.5, "rgba(255,110,50,0.55)");
    outer.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(-wid, top);
    ctx.quadraticCurveTo(-wid * 1.5, top + len * 0.35, 0, top + len);
    ctx.quadraticCurveTo(wid * 1.5, top + len * 0.35, wid, top);
    ctx.fill();
    const core = ctx.createLinearGradient(0, top, 0, top + len * 0.55);
    core.addColorStop(0, "rgba(255,255,245,1)");
    core.addColorStop(1, "rgba(170,210,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-wid * 0.5, top);
    ctx.quadraticCurveTo(-wid * 0.6, top + len * 0.25, 0, top + len * 0.55);
    ctx.quadraticCurveTo(wid * 0.6, top + len * 0.25, wid * 0.5, top);
    ctx.fill();
  }

  // Legs (the right one folds up when the lander is wrecked).
  ctx.strokeStyle = mix("#9aa0ab", "#6b7185", pose.night * 0.6);
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const bent = side === 1 && pose.broken ? 0.55 : 1;
    const hipX = side * s * 0.26;
    const hipY = -s * 0.38 + drop;
    const footX = side * s * 0.47 * bent;
    const footYy = -s * 0.03 * (1 - bent) * 4;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footYy);
    ctx.moveTo(side * s * 0.2, -s * 0.3 + drop);
    ctx.lineTo(side * s * 0.36 * bent, -s * 0.16);
    ctx.stroke();
    ctx.fillStyle = mix("#b8bdc7", "#7a8096", pose.night * 0.6);
    ctx.beginPath();
    ctx.ellipse(footX, footYy - s * 0.01, s * 0.07, s * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Engine bell.
  ctx.fillStyle = "#3a3d48";
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.3 + drop);
  ctx.lineTo(s * 0.06, -s * 0.3 + drop);
  ctx.lineTo(s * 0.1, -s * 0.19 + drop);
  ctx.lineTo(-s * 0.1, -s * 0.19 + drop);
  ctx.fill();

  // Descent stage in gold foil.
  ctx.fillStyle = foil;
  ctx.beginPath();
  ctx.moveTo(-s * 0.31, -s * 0.28 + drop);
  ctx.lineTo(s * 0.31, -s * 0.28 + drop);
  ctx.lineTo(s * 0.28, -s * 0.52 + drop);
  ctx.lineTo(-s * 0.28, -s * 0.52 + drop);
  ctx.fill();
  ctx.strokeStyle = foilDark;
  ctx.lineWidth = Math.max(1, s * 0.015);
  ctx.beginPath();
  for (const px of [-0.14, 0, 0.14]) {
    ctx.moveTo(s * px, -s * 0.5 + drop);
    ctx.lineTo(s * px * 1.08, -s * 0.3 + drop);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(-s * 0.27, -s * 0.5 + drop, s * 0.54, s * 0.04);

  // The capsule.
  const cy = -s * 0.7 + drop;
  const g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
  g.addColorStop(0, body);
  g.addColorStop(1, bodyShade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.5 + drop);
  ctx.lineTo(s * 0.3, -s * 0.5 + drop);
  ctx.quadraticCurveTo(s * 0.33, cy - s * 0.2, 0, -s * 0.93 + drop);
  ctx.quadraticCurveTo(-s * 0.33, cy - s * 0.2, -s * 0.3, -s * 0.5 + drop);
  ctx.fill();
  // Orange racing stripe.
  ctx.fillStyle = "#ff6b1a";
  ctx.fillRect(-s * 0.305, -s * 0.585 + drop, s * 0.61, s * 0.045);
  // The big round window.
  const wx = s * 0.02;
  const wy = -s * 0.72 + drop;
  const wr = s * 0.11;
  ctx.fillStyle = "#23262f";
  ctx.beginPath();
  ctx.arc(wx, wy, wr * 1.22, 0, Math.PI * 2);
  ctx.fill();
  const glass = ctx.createRadialGradient(wx - wr * 0.4, wy - wr * 0.4, wr * 0.1, wx, wy, wr);
  glass.addColorStop(0, pose.night > 0.5 ? "#ffd89a" : "#8fc2ff");
  glass.addColorStop(1, pose.night > 0.5 ? "#b26a2a" : "#1b2a4a");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(wx, wy, wr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.beginPath();
  ctx.arc(wx, wy, wr * 0.7, 3.6, 4.4);
  ctx.stroke();
  // Antenna and a blinking nav light.
  ctx.strokeStyle = "#9aa0ab";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.93 + drop);
  ctx.lineTo(0, -s * 1.0 + drop);
  ctx.stroke();
  const on = Math.sin(pose.t * 5) > 0.3;
  ctx.fillStyle = on ? "#ff4d5e" : "#7a2a33";
  ctx.beginPath();
  ctx.arc(0, -s * 1.0 + drop, Math.max(1.5, s * 0.025), 0, Math.PI * 2);
  ctx.fill();
  if (pose.broken) {
    ctx.strokeStyle = "rgba(30,30,36,0.6)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.9 + drop);
    ctx.lineTo(s * 0.18, -s * 0.72 + drop);
    ctx.lineTo(s * 0.12, -s * 0.62 + drop);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small astronaut in a white suit with a gold visor. */
export function drawAstronaut(ctx: CanvasRenderingContext2D, x: number, footY: number, h: number, pose: { walk: number; wave: number; shrug?: number }) {
  const s = h;
  const swing = Math.sin(pose.walk) * 0.35;
  ctx.save();
  ctx.translate(x, footY);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e9ecf2";
  ctx.lineWidth = s * 0.16;
  // Legs.
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.38);
  ctx.lineTo(-s * 0.08 + Math.sin(swing) * s * 0.3, -s * 0.04);
  ctx.moveTo(s * 0.08, -s * 0.38);
  ctx.lineTo(s * 0.08 - Math.sin(swing) * s * 0.3, -s * 0.04);
  ctx.stroke();
  // Backpack and body.
  ctx.fillStyle = "#c9ccd6";
  ctx.fillRect(-s * 0.27, -s * 0.76, s * 0.16, s * 0.34);
  ctx.fillStyle = "#f4f5f8";
  ctx.beginPath();
  ctx.roundRect(-s * 0.17, -s * 0.8, s * 0.34, s * 0.46, s * 0.1);
  ctx.fill();
  // Arms: one waves once the flag is up; both go out, palms up, for a shrug.
  ctx.beginPath();
  if (pose.shrug) {
    const k = pose.shrug;
    for (const side of [-1, 1]) {
      ctx.moveTo(side * s * 0.14, -s * 0.7);
      ctx.lineTo(side * s * (0.24 + 0.08 * k), -s * (0.56 + 0.06 * k));
      ctx.lineTo(side * s * (0.34 + 0.06 * k), -s * (0.66 + 0.12 * k));
    }
  } else {
    ctx.moveTo(-s * 0.14, -s * 0.7);
    ctx.lineTo(-s * 0.2 - swing * s * 0.1, -s * 0.46);
    ctx.moveTo(s * 0.14, -s * 0.7);
    if (pose.wave) ctx.lineTo(s * 0.3, -s * (0.86 + 0.12 * pose.wave));
    else ctx.lineTo(s * 0.2 + swing * s * 0.1, -s * 0.46);
  }
  ctx.stroke();
  // Helmet with a gold visor.
  ctx.fillStyle = "#f4f5f8";
  ctx.beginPath();
  ctx.arc(0, -s * 0.9, s * 0.17, 0, Math.PI * 2);
  ctx.fill();
  const visor = ctx.createLinearGradient(0, -s * 1.0, 0, -s * 0.8);
  visor.addColorStop(0, "#ffe08a");
  visor.addColorStop(1, "#c98a1e");
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.ellipse(s * 0.04, -s * 0.9, s * 0.11, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
