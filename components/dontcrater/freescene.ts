import type { Verdict } from "@/lib/lander/physics2d";
import type { LandingLines, Outcome } from "@/lib/lander/solver";
import { bargeTilt, bargeX, footSlope, heightAt, type Site } from "@/lib/lander/terrain";
import type { Palette, World } from "@/lib/lander/worlds";
import { blend, clamp, drawAstronaut, drawLander, mix, Scene, smooth, STYLE, vnoise, withAlpha, type Ending, type SceneFrame } from "./scene";

/*
 * Free Flight, drawn on the same canvas as the other modes.
 *
 * Camera: the log-altitude zoom still sets the scale vertically. Sideways the
 * view follows the lander, looks a little ahead towards where it will come
 * down, and low down it widens to at least ±2 × the height (never under
 * ±150 m, ±70 m on a phone) so there is ground to choose from.
 *
 * High up the planet is the usual fractal one; within a few km of the site
 * the site's own ground (the same heights the physics uses) takes over, so
 * the shape you see is the shape you land on. Close in, the lander is drawn at
 * its true size (feet 8 m apart), so you can judge whether it fits.
 */

/** Height of the lander drawn at true scale (m): its feet are then 8 m apart, as in the physics. */
export const LANDER_TRUE_M = 8.5;
const DEG = Math.PI / 180;

export type FreeEnding = Ending & { x: number; alt: number; ground: number; tilt: number; vx: number; verdict: Verdict | null };

export type FreeFrame = {
  world: World;
  night: boolean;
  /** Height above the ground at the start (km): sets the zoom range. */
  startAgl: number;
  site: Site;
  /** Simulation time (s): barges rock and drift, the sea swells. */
  t: number;
  x: number;
  alt: number;
  vx: number;
  speed: number;
  tilt: number;
  /** Ground height right under the lander (km). */
  ground: number;
  throttle: number;
  now: number;
  ending: FreeEnding | null;
  stop: { alt: number | null } | null;
  assist: { lines: LandingLines | null; outcome: Outcome } | null;
  rising: { peakIn: number; peakAlt: number } | { powered: true } | null;
  /** Where the path meets the ground, and the path itself (x km, alt km). */
  impact: { x: number; t: number; path: [number, number][] } | null;
  /** The planned landing site: a flat (or barge deck), km. */
  target: { x0: number; x1: number } | null;
  scan: boolean;
  flag: HTMLImageElement | null;
  reduced: boolean;
};

type Cam = ReturnType<Scene["camera"]>;

const SCAN = { flat: "#39e58c", edge: "#ffb020", steep: "#ff4d5e" };

export class FreeScene extends Scene {
  private refG = NaN;
  private look = 0;
  /** Last frame's camera, to carry particles along with the ground when the view moves. */
  private prevCam: { camX: number; refG: number; s: number; groundY: number } | null = null;
  private camTilt = 0;
  private splashTime = -1;
  /** The ground's height on screen at a screen x, this frame. */
  private groundAtScreen: (sx: number) => number = () => 0;

  /** The Free Flight camera: log zoom for height, and wide enough sideways to choose a landing spot. */
  freeCamera(agl: number, startAgl: number) {
    const base = this.camera(agl, startAgl);
    const narrow = this.w < 700;
    const minHalf = narrow ? 0.07 : 0.15;
    const usable = this.w / 2 - (narrow ? 12 : 40);
    const s = Math.max(base.kmPerPx, Math.max(2 * agl, minHalf) / usable);
    const icon = clamp(this.h * 0.085, 42, 78);
    const trueSize = LANDER_TRUE_M / 1000 / s;
    const small = Math.max(trueSize, 22);
    const b = smooth(0.014, 0.11, agl);
    return { ...base, kmPerPx: s, gap: agl / s, landerPx: small + Math.max(0, icon - small) * b };
  }

  renderFree(f: FreeFrame) {
    const { ctx } = this;
    const dtReal = this.last ? clamp(f.now - this.last, 0, 0.1) : 0.016;
    this.last = f.now;
    const targetNight = f.night ? 1 : 0;
    this.nightMix = this.nightMix < 0 ? targetNight : this.nightMix + clamp(targetNight - this.nightMix, -dtReal * 1.6, dtReal * 1.6);
    const pal = blend(f.world.palette.day, f.world.palette.night, this.nightMix);

    const ground = f.ending ? f.ending.ground : f.ground;
    if (Number.isNaN(this.refG)) this.refG = ground;
    this.refG += (ground - this.refG) * Math.min(1, dtReal * (f.ending ? 6 : 3));
    const alt = f.ending ? f.ending.alt : f.alt;
    const agl = Math.max(0, alt - this.refG);
    const cam = this.freeCamera(agl, f.startAgl);
    // After touchdown the view closes in: tight for a tip-over or a splash, wider for a flag,
    // so the valley stays around it. Crashes keep the wide view for the fireworks.
    if (f.ending) {
      const g = f.ending.grade;
      const narrow = this.w < 700;
      const half = g === "tipped" || g === "splash" ? (narrow ? 0.028 : 0.045) : g === "butter" || g === "smooth" || g === "bumpy" ? (narrow ? 0.04 : 0.075) : 0;
      if (half) {
        const k = smooth(0.1, 1.5, Math.max(0, f.now - f.ending.at));
        const close = half / (this.w / 2 - (narrow ? 12 : 40));
        cam.kmPerPx += (Math.min(cam.kmPerPx, close) - cam.kmPerPx) * k;
        cam.landerPx = LANDER_TRUE_M / 1000 / cam.kmPerPx;
        cam.gap = agl / cam.kmPerPx;
      }
    }
    const s = cam.kmPerPx;
    const cx = this.w / 2;

    // Look a little ahead, towards where the lander will come down.
    const halfKm = (this.w / 2) * s;
    const aim = f.ending ? 0 : f.impact ? clamp(((f.impact.x - f.x) / halfKm) * 0.4, -0.3, 0.3) : clamp((f.vx * 4) / 3200 / halfKm, -0.25, 0.25);
    this.look += (aim - this.look) * Math.min(1, dtReal * 1.5);
    const x = f.ending ? f.ending.x : f.x;
    const camX = x + this.look * halfKm;
    const lx = cx + (x - camX) / s;
    const yOf = (hKm: number) => cam.groundY - (hKm - this.refG) / s;
    // Particles live on the screen; when the view pans or zooms, move them with the ground.
    const prev = this.prevCam;
    if (prev && (prev.camX !== camX || prev.refG !== this.refG || prev.s !== s)) {
      for (const p of this.particles) {
        const wx = prev.camX + (p.x - cx) * prev.s;
        const wy = prev.refG + (prev.groundY - p.y) * prev.s;
        p.x = cx + (wx - camX) / s;
        p.y = cam.groundY - (wy - this.refG) / s;
      }
    }
    this.prevCam = { camX, refG: this.refG, s, groundY: cam.groundY };

    const frame = this.frame1d(f, agl);
    if (f.ending !== this.endingSeen) {
      this.endingSeen = f.ending;
      this.sceneTime = 0;
      this.splashTime = -1;
      if (f.ending && f.ending.grade !== "tipped" && f.ending.grade !== "splash") this.onImpact(frame, { x: lx, y: yOf(f.ending.ground) }, cam.landerPx);
    }
    const tau = f.ending ? Math.max(0, f.now - f.ending.at) : 0;
    const slow = f.ending && tau < 0.7 && !f.reduced && !["tipped", "splash"].includes(f.ending.grade) ? 0.35 : 1;
    const dt = dtReal * slow;
    this.sceneTime += dt;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let sx = 0;
    let sy = 0;
    if (f.ending && !f.reduced && !["butter", "smooth", "bumpy", "lost", "tipped", "splash"].includes(f.ending.grade)) {
      const amp = (f.ending.grade === "dented" ? 5 : f.ending.grade === "crater" || f.ending.grade === "oil" ? 18 : 11) * Math.max(0, 1 - tau / 0.9);
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }
    // Tipping over: the camera leans with the roll (not with reduced motion).
    const wantTilt = f.ending?.grade === "tipped" && !f.reduced ? this.rollDir(f.ending) * 3.5 * DEG * smooth(0.25, 1.4, tau) : 0;
    this.camTilt += (wantTilt - this.camTilt) * Math.min(1, dtReal * 4);

    this.drawSky(frame, pal, agl, cam.groundY);
    ctx.save();
    ctx.translate(sx, sy);
    if (this.camTilt) {
      const py = yOf(ground);
      ctx.translate(lx, py);
      ctx.rotate(this.camTilt);
      ctx.translate(-lx, -py);
    }
    if (agl > 6) this.drawRidges(frame, pal, agl, cam, cx);
    this.drawBackdrop(f, pal, cam, cx, camX, agl);
    this.drawTerrain(f, frame, pal, cam, cx, camX, agl);
    if (!f.ending) {
      this.drawPath(f, cam, cx, camX, yOf);
      this.drawAssist(frame, cam, lx);
      this.drawRising(frame, cam, lx);
      this.drawGuide(frame, cam, lx);
      this.drawTarget(f, cam, cx, camX, yOf);
      this.drawImpact(f, cam, cx, camX, yOf);
    }
    this.groundAtScreen = (sx: number) => yOf(heightAt(f.site, camX + (sx - cx) * s, f.t) / 1000);
    this.drawFreeLander(f, frame, pal, cam, lx, yOf, tau, dt);
    this.drawClouds(frame, pal, agl, cam, cx - camX / s);
    this.updateParticles(dt, yOf(ground));
    this.drawParticles();
    ctx.restore();

    if (f.ending && tau < 0.5 && ["scrap", "confetti", "crater", "oil"].includes(f.ending.grade)) {
      ctx.fillStyle = `rgba(255,248,230,${(f.reduced ? 0.25 : 0.85) * (1 - tau / 0.5)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /** The frame the shared drawing code understands (heights above the ground under the lander). */
  private frame1d(f: FreeFrame, agl: number): SceneFrame {
    return {
      world: f.world,
      night: f.night,
      startAlt: f.startAgl,
      alt: agl,
      speed: f.speed,
      throttle: f.throttle,
      now: f.now,
      ending: f.ending,
      stop: f.stop,
      ghost: null,
      assist: f.assist,
      rising: f.rising,
      flag: f.flag,
      reduced: f.reduced,
    };
  }

  /* ---------- Ground ---------- */

  /**
   * The valley beyond the landing line: two layers of hills or mountains,
   * moving slower than the ground (parallax) and toned towards the sky, so the
   * rough valley reads around you while the landable skyline stays in front.
   * Pure scenery: nothing in it can be landed on.
   */
  private drawBackdrop(f: FreeFrame, pal: Palette, cam: Cam, cx: number, camX: number, agl: number) {
    if (f.site.kind === "sea") return;
    const show = smooth(9, 1.2, agl);
    if (show < 0.01) return;
    const { ctx, w, h } = this;
    const s = cam.kmPerPx;
    const id = f.world.id;
    const night = this.nightMix;
    for (const j of [2, 1]) {
      const far = j === 2;
      // Farther layers cover more ground per pixel and move less as the camera moves.
      const kmPerPx = s * (far ? 7 : 3) + (far ? 0.004 : 0.0015);
      const shift = camX * (far ? 0.12 : 0.3);
      const amp = (far ? 150 : 80) * (0.45 + 0.55 * smooth(4, 0.15, agl)) * show;
      const base = cam.groundY + 24;
      ctx.beginPath();
      for (let x = -8; x <= w + 8; x += 4) {
        // Features never narrower than about 70 px, so nothing aliases into spikes when zoomed out.
        const u = (shift + (x - cx) * kmPerPx) / Math.max(far ? 1.6 : 0.7, kmPerPx * 70) + j * 17.3;
        let k: number;
        if (id === "psyche") k = 1 - Math.abs(vnoise(u * 1.3, 20 + j, this.seed)) * 0.9 + 0.25 * vnoise(u * 5, 30 + j, this.seed);
        else if (id === "mars") {
          // Mesas and buttes: flat tops, steep sides.
          const m = vnoise(u, 20 + j, this.seed) * 0.8 + 0.2 * vnoise(u * 3.1, 40 + j, this.seed);
          k = 0.35 + 0.65 * smooth(-0.15, 0.1, m) * (0.8 + 0.2 * vnoise(u * 0.4, 50 + j, this.seed));
        } else {
          // Old, rounded mountains, worn smooth by billions of years of tiny impacts.
          const m = vnoise(u, 20 + j, this.seed);
          k = 0.5 + 0.5 * m * Math.abs(m) + 0.08 * vnoise(u * 2.3, 40 + j, this.seed);
        }
        const y = base - amp * Math.max(0, k);
        if (x === -8) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 8, h + 10);
      ctx.lineTo(-8, h + 10);
      ctx.closePath();
      const tone = far ? mix(mix(pal.ground[2], pal.sky[2], f.world.air ? 0.55 : 0.4), pal.shade, night * 0.3) : mix(mix(pal.ground[1], pal.sky[2], f.world.air ? 0.35 : 0.25), pal.shade, night * 0.35);
      ctx.fillStyle = withAlpha(tone, show);
      ctx.fill();
      // A thin rim of light along the tops: sunlight by day, Earthshine or starlight by night.
      ctx.strokeStyle = withAlpha(pal.rim, (far ? 0.25 : 0.35) * show * (1 - 0.4 * night));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawTerrain(f: FreeFrame, frame: SceneFrame, pal: Palette, cam: Cam, cx: number, camX: number, agl: number) {
    const { ctx, w, h } = this;
    const s = cam.kmPerPx;
    const world = f.world;
    const style = STYLE[world.id];
    const R = world.radius / (1 + 3 * smooth(5, 150, agl) * clamp((world.radius - 400) / 1000, 0, 1));
    if ((w / 2 + 60) * s >= R * 0.98) {
      // The whole little world is in view; the site is far smaller than a pixel.
      this.drawPlanet(frame, pal, agl, cam, cx);
      return;
    }
    const exag = 1 + 2.5 * smooth(3, 220, agl) * clamp((world.radius - 400) / 1000, 0, 1);
    const h0 = style.sea ? 0 : this.heightAt(style, world, 0, s);
    const n = Math.ceil((w + 120) / 2);
    const X = new Float64Array(n + 1);
    const Y = new Float64Array(n + 1);
    const U = new Float64Array(n + 1);
    let top = Infinity;
    for (let i = 0; i <= n; i++) {
      const px = -60 + ((w + 120) * i) / n;
      const urel = (px - cx) * s;
      const u = camX + urel;
      const t = urel / R;
      let lift = heightAt(f.site, u, f.t) / 1000;
      if (!style.sea) {
        const far = smooth(5.5, 8.5, Math.abs(u));
        if (far > 0) lift = lift * (1 - far) + (this.heightAt(style, world, u, s) - h0) * exag * far;
        lift += this.shape(world, u / R);
      }
      const sinHalf = Math.sin(t / 2);
      X[i] = cx + ((R + lift) * Math.sin(t)) / s;
      Y[i] = cam.groundY + (2 * R * sinHalf * sinHalf - (lift - this.refG) * Math.cos(t)) / s;
      U[i] = u;
      top = Math.min(top, Y[i]);
    }
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(X[0], Y[0]);
      for (let i = 1; i <= n; i++) ctx.lineTo(X[i], Y[i]);
    };

    // The air's glow along the horizon from high up.
    if (world.air && agl > world.air * 0.08) {
      const width = clamp(world.air / s, 3, 140);
      const a = smooth(world.air * 0.08, world.air * 0.6, agl);
      trace();
      ctx.save();
      ctx.lineJoin = "round";
      ctx.shadowColor = withAlpha(pal.limb, a);
      ctx.shadowBlur = Math.min(60, width);
      ctx.strokeStyle = withAlpha(pal.limb, 0.22 * a);
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.restore();
    }

    trace();
    ctx.lineTo(w + 80, h + 80);
    ctx.lineTo(-80, h + 80);
    ctx.closePath();
    // Light near the ground you're over, darker the deeper it goes: a canyon floor far below reads as deep.
    const anchor = cam.groundY;
    const g = ctx.createLinearGradient(0, Math.min(top, anchor - 120), 0, Math.max(anchor + 420, h));
    g.addColorStop(0, pal.ground[0]);
    g.addColorStop(clamp((anchor + 40 - Math.min(top, anchor - 120)) / (Math.max(anchor + 420, h) - Math.min(top, anchor - 120)), 0.05, 0.9), pal.ground[0]);
    g.addColorStop(0.8, pal.ground[1]);
    g.addColorStop(1, pal.shade);
    ctx.fillStyle = g;
    ctx.fill();

    if (style.sea) {
      this.drawWater(f, pal, cam, cx, camX);
      return;
    }
    this.drawRegolith(f, pal, cam, cx, camX);

    // Relief: facets turned to the light (upper left) catch it, the others fall into shade. Each facet
    // is shaded as a band along the ground's own contour, clipped to the ground, so the shading
    // follows the rock. Grouped into a few tones: the whole ground costs a handful of draw calls.
    // Flats have no tone at all, which is what makes them look calm.
    const band = clamp(0.004 / s, 2.5, 9);
    const lit = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const dark = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      const dx = X[i + 1] - X[i];
      if (dx <= 0) continue;
      const k = (Y[i] - Y[i + 1]) / dx; // positive: the ground rises to the right, facing the light
      const level = Math.min(3, Math.floor(Math.abs(k) * 2.4));
      if (level === 0) continue;
      const path = k > 0 ? lit[level] : dark[level];
      path.moveTo(X[i], Y[i]);
      path.lineTo(X[i + 1], Y[i + 1]);
    }
    const night = this.nightMix;
    ctx.save();
    trace();
    ctx.lineTo(w + 80, h + 80);
    ctx.lineTo(-80, h + 80);
    ctx.closePath();
    ctx.clip();
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    for (let level = 1; level < 4; level++) {
      ctx.lineWidth = band * (1.4 + 0.5 * level);
      ctx.strokeStyle = withAlpha(pal.shade, (0.14 + 0.11 * level) * (1 + 0.3 * night));
      ctx.stroke(dark[level]);
      ctx.lineWidth = band * (1.1 + 0.3 * level);
      ctx.strokeStyle = withAlpha(pal.rim, (0.1 + 0.07 * level) * (1 - 0.5 * night));
      ctx.stroke(lit[level]);
    }
    ctx.restore();
    // The skyline: a crisp edge everywhere (so the ground you can land on stands clear of the
    // hills behind it), and a bright rim where the light catches an edge.
    trace();
    ctx.strokeStyle = withAlpha(mix(pal.shade, "#000000", 0.35), 0.5 + 0.2 * night);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.stroke();
    for (let level = 1; level < 4; level++) {
      ctx.strokeStyle = withAlpha(pal.rim, (0.4 + 0.2 * level) * (1 - 0.3 * night));
      ctx.lineWidth = 1.1 + 0.45 * level;
      ctx.stroke(lit[level]);
    }
    if (pal.glint) this.drawMetal(f, pal, X, Y, n);
    if (f.scan && !f.ending) this.drawScan(f, X, Y, U, n, s);
  }

  /** Psyche: sparkles on the bare metal edges. */
  private drawMetal(f: FreeFrame, pal: Palette, X: Float64Array, Y: Float64Array, n: number) {
    const { ctx } = this;
    for (let i = 3; i < n; i += 11) {
      const tw = f.reduced ? 0.6 : Math.max(0, Math.sin(this.sceneTime * 2.2 + i * 1.7));
      if (tw < 0.3 || Y[i] > Y[i - 3]) continue;
      ctx.fillStyle = withAlpha(pal.glint!, 0.8 * tw);
      const r = 1 + tw * 1.5;
      ctx.fillRect(X[i] - r, Y[i] + 2, r * 2, 1);
      ctx.fillRect(X[i], Y[i] + 2 - r, 1, r * 2);
    }
  }

  /**
   * Scan assist: the ground within 1.5 km of the lander, shaded by how steep it
   * is under a footpad: green 4° or less, amber up to 8°, red beyond. A column
   * wider than a couple of metres shows the gentlest ground in it, so flats
   * still show from higher up.
   */
  private drawScan(f: FreeFrame, X: Float64Array, Y: Float64Array, U: Float64Array, n: number, s: number) {
    const { ctx } = this;
    const paths = { flat: new Path2D(), edge: new Path2D(), steep: new Path2D() };
    const glow = { flat: new Path2D(), edge: new Path2D(), steep: new Path2D() };
    const span = (U[1] - U[0]) * 1000;
    const probes = Math.max(1, Math.min(8, Math.round(span / 1.5)));
    for (let i = 0; i < n; i++) {
      const um = (U[i] + U[i + 1]) / 2;
      if (Math.abs(um - f.x) > 1.5) continue;
      let slope = Infinity;
      for (let k = 0; k < probes; k++) slope = Math.min(slope, footSlope(f.site, U[i] + ((k + 0.5) / probes) * (U[i + 1] - U[i]), f.t));
      const key = slope <= 4 ? "flat" : slope <= 8 ? "edge" : "steep";
      paths[key].moveTo(X[i], Y[i]);
      paths[key].lineTo(X[i + 1], Y[i + 1]);
      glow[key].moveTo(X[i], Y[i]);
      glow[key].lineTo(X[i + 1], Y[i + 1]);
      glow[key].lineTo(X[i + 1], Y[i + 1] + 12);
      glow[key].lineTo(X[i], Y[i] + 12);
      glow[key].closePath();
    }
    void s;
    // Steep ground is only hinted at; the gentle ground is what the eye should find.
    const style = { steep: { glow: 0.07, line: 0.65, width: 1.6 }, edge: { glow: 0.16, line: 0.95, width: 2.6 }, flat: { glow: 0.3, line: 1, width: 4 } };
    ctx.lineCap = "round";
    for (const key of ["steep", "edge", "flat"] as const) {
      ctx.fillStyle = withAlpha(SCAN[key], style[key].glow);
      ctx.fill(glow[key]);
      ctx.strokeStyle = withAlpha(SCAN[key], style[key].line);
      ctx.lineWidth = style[key].width;
      ctx.stroke(paths[key]);
    }
  }

  /** Earth: glitter on the water and the barges riding the swell. */
  private drawWater(f: FreeFrame, pal: Palette, cam: Cam, cx: number, camX: number) {
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    const seaY = cam.groundY + this.refG / s;
    if (s < 0.5) {
      for (let i = 0; i < 90; i++) {
        const x = ((((this.hashAt(i, 70) * w - (camX / s) * 0.6) % w) + w) % w);
        const depth = this.hashAt(i, 71);
        const y = seaY + 3 + depth * 60;
        const on = f.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(this.sceneTime * 3 + i);
        ctx.fillStyle = `rgba(255,255,240,${0.35 * on * (1 - depth)})`;
        ctx.fillRect(x, y, 6 + 10 * (1 - depth), 1.2);
      }
    }
    for (const b of f.site.barges) {
      const half = b.half / 1000 / s;
      if (half < 1.5) continue;
      const bx = cx + (bargeX(b, f.t) - camX) / s;
      if (bx < -half - 40 || bx > w + half + 40) continue;
      const deck = heightAt(f.site, bargeX(b, f.t), f.t) / 1000;
      const by = cam.groundY - (deck - this.refG) / s;
      const hull = Math.max(3, 0.009 / s);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(-bargeTilt(b, f.t) * DEG);
      ctx.fillStyle = "#1e2229";
      ctx.fillRect(-half, 0, half * 2, hull);
      ctx.fillStyle = "#454c5a";
      ctx.fillRect(-half, 0, half * 2, Math.max(1, hull * 0.12));
      if (half > 18) {
        const stripe = Math.max(3, half / 10);
        for (let x = -half; x < half; x += stripe * 2) {
          ctx.fillStyle = "#ffd23d";
          ctx.fillRect(x, hull * 0.22, Math.min(stripe, half - x), hull * 0.14);
        }
      }
      const blink = f.reduced || Math.sin(this.sceneTime * 4 + b.phase) > 0;
      ctx.fillStyle = blink ? "#ff5a3c" : "#7a2a20";
      ctx.fillRect(-half - 1, -3, 3, 3);
      ctx.fillRect(half - 2, -3, 3, 3);
      ctx.restore();
      // A line of foam where the hull meets the water.
      ctx.fillStyle = withAlpha("#ffffff", 0.35 + 0.15 * this.nightMix);
      ctx.fillRect(bx - half - 2, seaY - 1, half * 2 + 4, 2);
    }
    void pal;
  }

  /**
   * Texture in the ground: pebbles and little craters, fixed to the world so
   * they slide and zoom with it. Two sizes cross-fade as the zoom changes, so
   * nothing pops in.
   */
  private drawRegolith(f: FreeFrame, pal: Palette, cam: Cam, cx: number, camX: number) {
    const { ctx, w, h } = this;
    const s = cam.kmPerPx;
    const level = Math.log2(s * 26);
    const L = Math.floor(level);
    const fade = level - L;
    const night = this.nightMix;
    const dark = withAlpha(mix(pal.shade, "#000000", 0.2), 0.22 + 0.1 * night);
    const light = withAlpha(pal.rim, 0.28 * (1 - 0.5 * night));
    for (const [cell, alpha] of [
      [2 ** L, 1 - fade],
      [2 ** (L + 1), fade],
    ] as const) {
      if (alpha < 0.02) continue;
      const px = cell / s;
      const first = Math.floor((camX - (cx + 20) * s) / cell);
      const last = Math.ceil((camX + (w - cx + 20) * s) / cell);
      ctx.globalAlpha = alpha;
      for (let i = first; i <= last; i++) {
        const top = heightAt(f.site, (i + 0.5) * cell, f.t) / 1000;
        for (let row = 0; row < 9; row++) {
          const r = this.hashAt(i * 31 + row, 90 + L);
          if (r > 0.55) continue;
          const x = (i + this.hashAt(i * 31 + row, 91)) * cell;
          const depth = (row + this.hashAt(i * 31 + row, 92)) * cell * 1.1 + cell * 0.25;
          const sx = cx + (x - camX) / s;
          const sy = cam.groundY - (top - depth - this.refG) / s;
          if (sy > h + 10 || sy < 0) continue;
          const size = px * (0.05 + 0.1 * this.hashAt(i * 31 + row, 93));
          if (r < 0.14) {
            // A little crater: a dark bowl with a lit lower rim.
            ctx.fillStyle = dark;
            ctx.beginPath();
            ctx.ellipse(sx, sy, size * 2.2, size * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = light;
            ctx.lineWidth = Math.max(0.8, size * 0.35);
            ctx.beginPath();
            ctx.ellipse(sx, sy + size * 0.15, size * 2.2, size * 0.7, 0, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
          } else {
            // A pebble: lit on top, shadow beneath.
            ctx.fillStyle = dark;
            ctx.fillRect(sx - size, sy, size * 2, Math.max(0.8, size * 0.5));
            ctx.fillStyle = light;
            ctx.fillRect(sx - size * 0.7, sy - size * 0.5, size * 1.4, Math.max(0.8, size * 0.5));
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private hashAt(i: number, k: number) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(k + 1, 668265263) + Math.imul(this.seed, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* ---------- Where you're heading ---------- */

  /** The path ahead: faint dots from the lander to where it meets the ground. */
  private drawPath(f: FreeFrame, cam: Cam, cx: number, camX: number, yOf: (h: number) => number) {
    if (!f.impact || f.impact.path.length < 2) return;
    const { ctx } = this;
    const s = cam.kmPerPx;
    ctx.save();
    ctx.fillStyle = "rgba(235,246,255,0.55)";
    let last: [number, number] | null = null;
    for (const [x, alt] of f.impact.path) {
      const px = cx + (x - camX) / s;
      const py = yOf(alt);
      if (last && Math.hypot(px - last[0], py - last[1]) < 9) continue;
      last = [px, py];
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * The impact marker: a bracket as wide as the lander's feet, on the ground
   * where the path meets it at the current throttle and tilt. With the scan on
   * it takes the scan's colour; off screen, it's pinned to the edge.
   */
  private drawImpact(f: FreeFrame, cam: Cam, cx: number, camX: number, yOf: (h: number) => number) {
    if (!f.impact) return;
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    const ix = cx + (f.impact.x - camX) / s;
    const iy = yOf(heightAt(f.site, f.impact.x, f.impact.t) / 1000);
    let color = "#eef8ff";
    if (f.scan && Math.abs(f.impact.x - f.x) <= 1.5) {
      const worst = Math.max(footSlope(f.site, f.impact.x - 0.004, f.impact.t), footSlope(f.site, f.impact.x + 0.004, f.impact.t));
      color = worst <= 4 ? SCAN.flat : worst <= 8 ? SCAN.edge : SCAN.steep;
    }
    ctx.save();
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    const edge = 22;
    if (ix < edge || ix > w - edge) {
      const dir = ix < edge ? -1 : 1;
      const px = dir < 0 ? edge : w - edge;
      const py = clamp(iy, 90, this.h - 40);
      const km = Math.abs(f.impact.x - f.x);
      const text = `${dir < 0 ? "◀ " : ""}${km >= 10 ? Math.round(km) : km.toFixed(1)} km${dir > 0 ? " ▶" : ""}`;
      const tw = ctx.measureText(text).width;
      const bx = dir < 0 ? px - 6 : px - tw - 6;
      ctx.fillStyle = "rgba(8,10,20,0.75)";
      ctx.beginPath();
      ctx.roundRect(bx, py - 10, tw + 12, 20, 10);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(text, bx + 6, py + 0.5);
      ctx.restore();
      return;
    }
    // Ink by day, white by night, with a halo of the opposite so it reads on any ground.
    const ink = f.scan ? color : mix("#16131f", "#f4f1fa", this.nightMix);
    const halo = mix("rgba(255,255,255,0.85)", "rgba(8,10,20,0.8)", this.nightMix);
    const half = Math.max(9, 0.004 / s);
    const y = iy - 2;
    if (!f.reduced) {
      // A ring on the ground, spreading and fading, to catch the eye.
      const k = (this.sceneTime * 0.9) % 1;
      ctx.strokeStyle = withAlpha(ink, 0.5 * (1 - k));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(ix, iy, half * (1 + 1.6 * k), 3 + 5 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const bracket = () => {
      ctx.beginPath();
      ctx.moveTo(ix - half, y - 8);
      ctx.lineTo(ix - half, y);
      ctx.lineTo(ix + half, y);
      ctx.lineTo(ix + half, y - 8);
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = halo;
    bracket();
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ink;
    bracket();
    ctx.stroke();
    // A chevron above it.
    ctx.beginPath();
    ctx.moveTo(ix - 7, y - 22);
    ctx.lineTo(ix + 7, y - 22);
    ctx.lineTo(ix, y - 12);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = halo;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.restore();
  }

  /**
   * The target: the planned landing site. A gold bracket as wide as the flat,
   * a dashed beam above it with "LAND HERE"; off screen, an arrow at the edge
   * with the distance. Low down and close, the beam fades so it doesn't hide
   * the ground you're about to stand on.
   */
  private drawTarget(f: FreeFrame, cam: Cam, cx: number, camX: number, yOf: (h: number) => number) {
    const tg = f.target;
    if (!tg) return;
    const { ctx, w } = this;
    const s = cam.kmPerPx;
    const gold = "#ffc93d";
    const halo = "rgba(8,10,20,0.7)";
    const mid = (tg.x0 + tg.x1) / 2;
    const px = cx + (mid - camX) / s;
    const py = yOf(heightAt(f.site, mid, f.t) / 1000);
    ctx.save();
    ctx.font = "800 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    const pill = (x: number, y: number, text: string, align: "left" | "right" | "center") => {
      const tw = ctx.measureText(text).width;
      const bx = align === "left" ? x : align === "right" ? x - tw - 14 : x - tw / 2 - 7;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.roundRect(bx, y - 11, tw + 14, 22, 11);
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.fillText(text, bx + 7, y + 0.5);
    };
    const edge = 26;
    if (px < edge || px > w - edge) {
      const dir = px < edge ? -1 : 1;
      const km = Math.abs(mid - f.x);
      const dist = km >= 10 ? `${Math.round(km)} km` : km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;
      const y = clamp(py, 150, this.h - 90);
      pill(dir < 0 ? 12 : w - 12, y, dir < 0 ? `◀ LAND HERE · ${dist}` : `LAND HERE · ${dist} ▶`, dir < 0 ? "left" : "right");
      ctx.restore();
      return;
    }
    const x0 = cx + (tg.x0 - camX) / s;
    const x1 = cx + (tg.x1 - camX) / s;
    const y0 = yOf(heightAt(f.site, tg.x0, f.t) / 1000);
    const y1 = yOf(heightAt(f.site, tg.x1, f.t) / 1000);
    const wide = x1 - x0 >= 6;
    // The bracket along the flat.
    const bracket = () => {
      ctx.beginPath();
      if (wide) {
        ctx.moveTo(x0, y0 - 12);
        ctx.lineTo(x0, y0 - 3);
        ctx.lineTo(x1, y1 - 3);
        ctx.lineTo(x1, y1 - 12);
      } else {
        ctx.arc(px, py - 4, 5, 0, Math.PI * 2);
      }
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = halo;
    bracket();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = gold;
    bracket();
    ctx.stroke();
    if (!f.reduced) {
      const k = (this.sceneTime * 0.7) % 1;
      ctx.fillStyle = withAlpha(gold, 0.28 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(px, py - 2, Math.max(8, (x1 - x0) / 2) * (1 + k * 0.6), 4 + 6 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The beam and its label, fading as you close in low over the target.
    const near = clamp(Math.abs(f.x - mid) * 1000 / 60, 0, 1);
    const low = clamp((f.alt - heightAt(f.site, mid, f.t) / 1000) * 1000 / 50, 0, 1);
    const show = Math.max(near, low);
    if (show > 0.02) {
      const top = Math.max(110, py - 130);
      ctx.globalAlpha = show;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = withAlpha(gold, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py - 16);
      ctx.lineTo(px, top + 12);
      ctx.stroke();
      ctx.setLineDash([]);
      pill(px, top, "LAND HERE", "center");
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------- The lander and the endings ---------- */

  private rollDir(e: FreeEnding) {
    const v = e.verdict;
    if (!v) return 1;
    if (v.tiltOff > 10) return Math.sign(e.tilt - v.slope) || 1;
    if (Math.abs(v.slope) > 3) return v.slope > 0 ? -1 : 1;
    if (Math.abs(v.drift) > 6) return Math.sign(v.drift);
    return Math.sign(e.tilt - v.slope) || 1;
  }

  private drawFreeLander(f: FreeFrame, frame: SceneFrame, pal: Palette, cam: Cam, lx: number, yOf: (h: number) => number, tau: number, dt: number) {
    const { ctx } = this;
    const size = cam.landerPx;
    const t = this.sceneTime;
    if (!f.ending) {
      const ly = yOf(f.alt);
      this.emitFree(f, cam, lx, ly, yOf, dt);
      drawLander(ctx, lx, ly, size, { throttle: f.throttle, t, night: this.nightMix, compress: 0, tilt: f.tilt * DEG, broken: 0 });
      return;
    }
    const e = f.ending;
    const gy = yOf(e.ground);
    if (e.grade === "lost") return;
    if (e.grade === "tipped") return this.drawTipped(f, e, pal, lx, yOf, size, tau);
    if (e.grade === "splash") return this.drawSplash(f, e, pal, lx, yOf, size, tau);
    if (e.grade === "butter" || e.grade === "smooth" || e.grade === "bumpy") {
      // Settle onto both feet, at the ground's slope.
      const rest = (e.verdict?.slope ?? 0) * DEG;
      const tilt = e.tilt * DEG + (rest - e.tilt * DEG) * smooth(0, 0.25, tau);
      const bounce = e.grade === "bumpy" ? Math.max(0, Math.sin(tau * 9) * Math.exp(-tau * 3)) * size * 0.18 : 0;
      const compress = Math.exp(-tau * 5) * Math.abs(Math.cos(tau * 12)) * (e.grade === "butter" ? 0.25 : 0.6);
      drawLander(ctx, lx, gy - bounce, size, { throttle: 0, t, night: this.nightMix, compress, tilt, broken: 0 });
      if (e.grade === "butter" && tau < 1.6 && !f.reduced) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const k = 1 - tau / 1.6;
        ctx.strokeStyle = `rgba(255,236,150,${0.8 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(lx, gy, size * (0.6 + tau * 2), size * (0.12 + tau * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (e.grade !== "bumpy") this.drawFlagScene(frame, lx, gy, size, tau);
      return;
    }
    // Crashes: the usual endings, at the point of contact.
    this.drawLanderAndEnding(frame, pal, cam, lx, tau, dt, gy);
  }

  /** Exhaust along the engine's axis, and dust blown sideways where the plume meets the ground. */
  private emitFree(f: FreeFrame, cam: Cam, lx: number, ly: number, yOf: (h: number) => number, dt: number) {
    if (f.throttle <= 0.5 || f.reduced) return;
    const size = cam.landerPx;
    const k = f.throttle / 100;
    const sn = Math.sin(f.tilt * DEG);
    const cs = Math.cos(f.tilt * DEG);
    const nx = lx + size * 0.19 * sn;
    const ny = ly - size * 0.19 * cs;
    const count = Math.min(6, k * 180 * dt + Math.random());
    for (let i = 0; i < count; i++) {
      const sp = size * (4 + Math.random() * 3) * (0.6 + k);
      const side = (Math.random() - 0.5) * 40;
      this.particles.push({ x: nx + (Math.random() - 0.5) * size * 0.1, y: ny, vx: -sn * sp + cs * side, vy: cs * sp + sn * side, life: 0, max: 0.18 + Math.random() * 0.22, size: size * (0.05 + Math.random() * 0.06), color: "#ffb35c", kind: "fire", rot: 0, vr: 0 });
    }
    // Follow the plume down to the ground (within 60 m).
    let hit: { x: number; y: number; d: number } | null = null;
    for (let d = 0; d <= 60; d += 2) {
      const px = f.x - (sn * (d - 1.6)) / 1000;
      const py = f.alt - (cs * (d - 1.6)) / 1000;
      if (py <= heightAt(f.site, px, f.t) / 1000) {
        hit = { x: px, y: py, d };
        break;
      }
    }
    if (!hit) return;
    const s = cam.kmPerPx;
    const hx = lx + (hit.x - f.x) / s;
    const hy = yOf(heightAt(f.site, hit.x, f.t) / 1000);
    const near = 1 - hit.d / 60;
    const pal = f.world.palette[f.night ? "night" : "day"];
    const n = Math.min(12, near * k * 560 * dt);
    const sea = f.site.kind === "sea";
    for (let i = 0; i < n; i++) {
      // Mostly sideways, away from the side the thrust pushes towards; some the other way.
      const dir = Math.random() < 0.5 + 0.45 * clamp(-sn * 3, -1, 1) ? 1 : -1;
      this.particles.push({
        x: hx + dir * Math.random() * size * 0.2,
        y: hy - 1,
        vx: dir * (160 + Math.random() * 520) * (0.5 + near),
        vy: -Math.random() * 110 * near,
        life: 0,
        max: 0.6 + Math.random() * 0.9,
        size: 1.5 + Math.random() * 3.5,
        color: sea ? "rgba(235,245,255,0.8)" : pal.dust,
        kind: "dust",
        rot: 0,
        vr: 0,
      });
    }
  }

  /**
   * Tipped: it stands for a moment, then rolls slowly over its downhill foot,
   * the legs fold, dust puffs up; the astronaut climbs out and shrugs.
   */
  private drawTipped(f: FreeFrame, e: FreeEnding, pal: Palette, lx: number, yOf: (h: number) => number, size: number, tau: number) {
    const { ctx } = this;
    const dir = this.rollDir(e);
    const slope = (e.verdict?.slope ?? 0) * DEG;
    const from = e.tilt * DEG;
    const to = slope + dir * 100 * DEG;
    // Gravity-like: slow to start, faster as it goes, a small bounce when the body lands.
    const k = clamp((tau - 0.2) / 1.15, 0, 1);
    const fall = k * k;
    const bounce = tau > 1.35 && !f.reduced ? Math.sin((tau - 1.35) * 14) * Math.exp(-(tau - 1.35) * 6) * 0.06 : 0;
    const angle = from + (to - from) * fall - dir * bounce;
    const half = size * 0.47;
    // Pivot: the downhill foot, on the ground.
    const px = lx + dir * half * Math.cos(from);
    const py = yOf(e.ground) + dir * half * Math.sin(from) * 0.2;
    // As the legs fold, the body comes down onto the ground and slides a little downhill.
    const settle = smooth(0.7, 1.5, tau);
    const fx = px - dir * half * Math.cos(angle) + dir * size * 0.1 * settle;
    let fy = py - dir * half * Math.sin(angle) + size * 0.17 * settle;
    // Once over, the body comes to rest on whatever ground is under it (it may have rolled off a ledge).
    if (settle > 0) {
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      let gap = Infinity;
      for (const [bx, by] of [
        [-0.3, -0.5],
        [0.3, -0.5],
        [-0.3, -0.85],
        [0.3, -0.85],
        [0, -0.95],
        [-0.47, 0],
        [0.47, 0],
      ]) {
        const x = fx + (bx * c - by * sn) * size;
        const y = fy + (bx * sn + by * c) * size;
        gap = Math.min(gap, this.groundAtScreen(x) - y);
      }
      if (gap > 0) fy += gap * settle;
    }
    if (tau > 1.3 && this.splashTime < 0) {
      this.splashTime = tau;
      const n = f.reduced ? 20 : 60;
      for (let i = 0; i < n; i++) {
        const d = Math.random() < 0.5 ? -1 : 1;
        this.particles.push({ x: px + dir * Math.random() * size * 0.8, y: py - 2, vx: d * (60 + Math.random() * 260), vy: -Math.random() * 120, life: 0, max: 0.9 + Math.random() * 1.2, size: 3 + Math.random() * 6, color: pal.dust, kind: "dust", rot: 0, vr: 0 });
      }
    }
    drawLander(ctx, fx, fy, size, { throttle: 0, t: this.sceneTime, night: this.nightMix, compress: smooth(0.4, 1.3, tau) * 0.6, tilt: angle, broken: smooth(0.5, 1.3, tau) });
    if (tau > 2.1) {
      // Out of the hatch, a few steps uphill, then a shrug.
      const walk = smooth(2.1, 2.9, tau);
      const ax = px - dir * size * (0.5 + 0.55 * walk);
      const shrug = tau > 3 ? 0.5 + 0.5 * Math.abs(Math.sin((tau - 3) * 2.4)) : 0;
      drawAstronaut(ctx, ax, this.groundAtScreen(ax) - 1, size * 0.42, { walk: tau < 2.9 ? tau * 8 : 0, wave: 0, shrug: f.reduced ? (tau > 3 ? 1 : 0) : shrug });
    }
  }

  /** Splash: into the sea it goes; it bobs, half under, and later a sad little flag goes up. */
  private drawSplash(f: FreeFrame, e: FreeEnding, pal: Palette, lx: number, yOf: (h: number) => number, size: number, tau: number) {
    const { ctx } = this;
    const sea = yOf(0);
    if (this.splashTime < 0) {
      this.splashTime = tau;
      const n = f.reduced ? 30 : 90;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
        const sp = 120 + Math.random() * 420;
        this.particles.push({ x: lx + (Math.random() - 0.5) * size * 0.5, y: sea, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.8 + Math.random() * 1.1, size: 2 + Math.random() * 4, color: "rgba(220,240,255,0.9)", kind: "debris", rot: 0, vr: 0 });
      }
    }
    const dir = Math.sign(e.vx) || 1;
    const sink = smooth(0, 0.8, tau) * 0.42 * size;
    const bob = f.reduced ? 0 : Math.sin(tau * 2.1) * size * 0.035;
    const roll = dir * (0.32 * smooth(0, 1, tau)) + (f.reduced ? 0 : Math.sin(tau * 1.6) * 0.05);
    const y = sea + sink + bob;
    // Above the water line as usual; below it, faint and blue, as seen through the sea.
    const line = sea + (f.reduced ? 0 : Math.sin(tau * 3 + 1) * 1.2);
    const pose = { throttle: 0, t: this.sceneTime, night: this.nightMix, compress: 0, tilt: roll, broken: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx - size * 2, line - size * 2, size * 4, size * 2);
    ctx.clip();
    drawLander(ctx, lx, y, size, pose);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx - size * 2, line, size * 4, size * 2);
    ctx.clip();
    ctx.globalAlpha = 0.3;
    drawLander(ctx, lx, y, size, pose);
    ctx.restore();
    ctx.fillStyle = withAlpha("#ffffff", 0.5);
    ctx.fillRect(lx - size * 0.45, line - 1, size * 0.9, 2);
    if (tau > 1.8 && f.flag && f.flag.complete && f.flag.naturalWidth) {
      // A small flag on a short pole, drooping.
      const k = smooth(1.8, 2.3, tau);
      const top = y - size * 0.93;
      const poleX = lx + Math.sin(roll) * size * 0.93 * 0.2;
      ctx.strokeStyle = "#d8dbe2";
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.beginPath();
      ctx.moveTo(poleX, top + size * 0.1);
      ctx.lineTo(poleX, top - size * 0.28 * k);
      ctx.stroke();
      if (k >= 1) {
        const fw = size * 0.26;
        const fh = fw * (f.flag.naturalHeight / f.flag.naturalWidth);
        ctx.save();
        ctx.translate(poleX, top - size * 0.28);
        ctx.rotate(0.5 + (f.reduced ? 0 : Math.sin(tau * 1.3) * 0.05));
        ctx.drawImage(f.flag, 0, 0, fw, fh);
        ctx.restore();
      }
    }
  }
}
