import { createRng } from "@/lib/kit/rng";
import { duelDistance, type DuelEngagement, type DuelEvent, type DuelShot, type DuelSide } from "@/lib/over-short/duel";
import { heightAt, highestBetween } from "@/lib/over-short/terrain";
import type { Era } from "../eras/types";
import { drawFieldArc, drawnMuzzle } from "../scene/arcs";
import { drawBurstWash, shakeTransform, type Burst } from "../scene/battle";
import { flareAt, smokePall, type StarShell } from "../scene/effects";
import { BURST_METRE, drawGunInGlare, gunPlacement, muzzleInWorld, type Facing } from "../scene/gunline";
import { clamp, smoothstep } from "../scene/noise";
import { Particles, warmSprites, type SceneLight } from "../scene/particles";
import { SideView } from "../scene/side";

/*
 * The duel on screen: the whole ridge from gun to gun, both batteries in
 * view. Both rounds leave together and fly together, each coming down in
 * its own time; a hit throws earth and fire round the gun it struck, and
 * the hit that silences a battery leaves it slewed over in a pall of smoke.
 * At night each side keeps a star shell hanging over the other's gun, and
 * its light picks the gun out in white.
 */

/** Seconds of flight shown per second on screen: the exchange is the thing. */
const PLAYBACK = 8;
/** Land shown beyond each gun: more on the west, where the aiming panel sits over the view. */
const MARGIN = { west: 2300, east: 1100 };
const SQUEEZE = 650;

export type DuelCue = "fire" | "whistle" | "impact" | "hit" | "destroyed" | "relocate";
type Callbacks = { onReports?: (shots: DuelShot[]) => void; onDone?: () => void };

type Turn = { shots: DuelShot[]; started: number; duration: number; landed: Set<DuelShot> };

export class DuelDirector {
  readonly side: SideView;
  private fx: Particles;
  private engagement: DuelEngagement;
  private pending: DuelEngagement | null = null;
  private time = 0;
  private last = 0;
  private timers: { at: number; run: () => void }[] = [];
  private callbacks: Callbacks = {};
  /** The barrels as shown: each side's elevation, easing to where it is set. */
  private shown = { west: 25, east: 25 };
  aims = { west: 25, east: 25 };
  private recoilAt = -10;
  private turn: Turn | null = null;
  private trails: { shot: DuelShot; endedAt: number }[] = [];
  private hit: Record<DuelSide, number> = { west: -1, east: -1 };
  private silenced: Record<DuelSide, number> = { west: -1, east: -1 };
  private moves: Partial<Record<DuelSide, { from: number; by: number; start: number }>> = {};
  private burst: Burst | null = null;
  private shaking: { at: number; power: number } | null = null;
  private flares: StarShell[] = [];
  private canvas: HTMLCanvasElement;
  paused = false;

  constructor(
    canvas: HTMLCanvasElement,
    engagement: DuelEngagement,
    private options: { era: Era; calm: boolean; sound?: (cue: DuelCue, detail?: { time?: number }) => void },
  ) {
    this.canvas = canvas;
    this.side = new SideView(canvas, options.era.side);
    this.fx = new Particles(createRng("over-short/duel-fx").float);
    this.fx.wind = { x: engagement.wind.along || 1.2, z: 0.3 };
    this.engagement = engagement;
    const terrain = engagement.terrain;
    this.side.setRelief({ height: (x) => heightAt(terrain, x), highest: highestBetween(terrain, -3000, duelDistance(engagement) + 5000), squeeze: SQUEEZE });
    warmSprites();
  }

  setOptions(options: Partial<DuelDirector["options"]>) {
    this.options = { ...this.options, ...options };
  }

  resize(width: number, height: number, dpr: number) {
    this.side.resize(width, height, dpr);
  }

  setTheme(dark: boolean) {
    this.side.setAppearance(dark ? "night" : "day");
  }

  /** A turn is being played out until its `onDone`. */
  get busy() {
    return this.callbacks.onDone !== undefined;
  }

  /* ---------- Where things are ---------- */

  private gunX(side: DuelSide) {
    const m = this.moves[side];
    const base = this.engagement[side].x;
    if (!m) return base;
    return m.from + m.by * smoothstep(0, 1, clamp((this.time - m.start - 1.4) / 2.6));
  }

  private get viewMetres() {
    return Math.abs(this.gunX("east") - this.gunX("west")) + MARGIN.west + MARGIN.east;
  }

  private get cameraX() {
    return (this.gunX("west") - MARGIN.west + this.gunX("east") + MARGIN.east) / 2;
  }

  /* ---------- A turn ---------- */

  play(events: DuelEvent[], after: DuelEngagement, callbacks: Callbacks) {
    this.callbacks = callbacks;
    this.pending = after;
    const shots = events.flatMap((e) => (e.kind === "fired" || e.kind === "empty-pit" ? [e.shot] : []));
    let wait = 0;
    for (const e of events) {
      if (e.kind !== "relocated") continue;
      this.moves[e.side] = { from: this.engagement[e.side].x, by: e.by, start: this.time };
      this.options.sound?.("relocate");
      wait = this.options.calm ? 0.5 : 5.2;
    }
    this.later(wait, () => {
      for (const side of ["west", "east"] as const) {
        const m = this.moves[side];
        if (m) this.engagement = { ...this.engagement, [side]: { ...this.engagement[side], x: m.from + m.by } };
      }
      this.moves = {};
      if (shots.length) this.launch(shots);
      else this.wrapUp([]);
    });
  }

  skip() {
    const t = this.turn;
    if (t) t.started = Math.min(t.started, this.time - t.duration);
  }

  private later(seconds: number, run: () => void) {
    this.timers.push({ at: this.time + seconds, run });
  }

  private launch(shots: DuelShot[]) {
    const longest = Math.max(...shots.map((s) => s.flight.time));
    const duration = this.options.calm ? 1.2 : clamp(longest / PLAYBACK, 2.4, 6);
    this.turn = { shots, started: this.time, duration, landed: new Set() };
    this.trails = [];
    this.recoilAt = this.time;
    for (const shot of shots) {
      this.shown[shot.side] = shot.aim.elevation;
      const facing: Facing = shot.side === "west" ? 1 : -1;
      const muzzle = muzzleInWorld(this.side, this.options.era, this.gunX(shot.side), shot.aim.elevation, undefined, facing);
      const angle = (shot.aim.elevation * Math.PI) / 180;
      this.options.era.effects.muzzle(this.fx, { x: muzzle.x, z: 0, y: muzzle.y }, facing === 1 ? angle : Math.PI - angle, 1.1);
    }
    this.shake(0.5);
    this.options.sound?.("fire");
    this.options.sound?.("whistle", { time: duration });
  }

  /** A round down: earth where it fell, fire and a pall at a gun it struck. */
  private land(shot: DuelShot) {
    const target: DuelSide = shot.side === "west" ? "east" : "west";
    const fx = this.options.era.effects;
    const at = { x: shot.burst.x, z: 0 };
    const power = shot.decisive ? 1.6 : shot.hit ? 1.3 : 1;
    fx.explosion(this.fx, at, power);
    smokePall(this.fx, at, 30, 1);
    if (shot.hit) {
      fx.hit(this.fx, "battery", at, shot.decisive, 1);
      this.hit[target] = this.time;
      if (shot.decisive) this.silenced[target] = this.time;
      this.options.sound?.(shot.decisive ? "destroyed" : "hit");
    } else this.options.sound?.("impact");
    this.burst = { at: this.time, x: shot.burst.x, power };
    this.shake(power);
  }

  private wrapUp(shots: DuelShot[]) {
    this.turn = null;
    this.later(this.options.calm ? 0.2 : 1.3, () => {
      this.callbacks.onReports?.(shots);
      this.later(this.options.calm ? 0.3 : 0.8, () => {
        if (this.pending) this.engagement = this.pending;
        this.pending = null;
        const done = this.callbacks.onDone;
        this.callbacks = {};
        done?.();
      });
    });
  }

  private shake(power: number) {
    if (!this.options.calm) this.shaking = { at: this.time, power };
  }

  /* ---------- Every frame ---------- */

  frame(now: number) {
    if (this.side.width < 8 || this.side.height < 8) return;
    const dt = this.paused ? 0 : this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.time += dt;
    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const t of due) t.run();
    this.fx.advance(dt);
    for (const side of ["west", "east"] as const) this.shown[side] += (this.aims[side] - this.shown[side]) * Math.min(1, dt * 14);
    const t = this.turn;
    if (t) {
      const clock = ((this.time - t.started) / t.duration) * Math.max(...t.shots.map((s) => s.flight.time));
      for (const shot of t.shots) {
        if (!t.landed.has(shot) && clock >= shot.flight.time) {
          t.landed.add(shot);
          this.trails.push({ shot, endedAt: this.time });
          this.land(shot);
        }
      }
      if (t.landed.size === t.shots.length) this.wrapUp(t.shots);
    }
    this.updateFlares();
    this.draw();
    const transform = this.options.calm ? "" : shakeTransform(this.shaking, this.time, this.side.height);
    if (!transform) this.shaking = null;
    this.canvas.style.transform = transform;
  }

  /** At night each side keeps a star shell hanging over the other's gun. */
  private updateFlares() {
    if (this.side.appearance !== "night") {
      this.flares = [];
      return;
    }
    this.flares = this.flares.filter((f) => this.time - f.burst < 40);
    for (const side of ["west", "east"] as const) {
      const x = this.gunX(side) + (side === "west" ? -60 : 60);
      if (!this.flares.some((f) => Math.abs(f.x - x) < 400)) this.flares.push({ x, z: 0, burst: this.time - (this.time < 1 ? 6 : 0), altitude: 260 + Math.random() * 60, seed: Math.random() });
    }
  }

  private draw() {
    const v = this.side;
    const scale = v.width / this.viewMetres;
    const night = v.appearance === "night";
    const flares = night ? this.flares.map((f) => flareAt(f, this.time, this.fx.wind.x * 0.5)).filter((f) => f.burning) : [];
    const lights: SceneLight[] = [...this.fx.lights, ...flares.map((f) => ({ x: f.x, y: f.y, z: 0, radius: 700, color: [235, 240, 255] as [number, number, number], intensity: f.intensity }))];
    this.fx.magnify = (v.height * BURST_METRE) / scale;
    const era = this.options.era;
    v.draw({
      time: this.time,
      cameraX: this.cameraX,
      scale,
      fx: this.fx,
      lights,
      overlay: (ctx) => drawBurstWash(ctx, v, this.burst, this.time),
      actors: (ctx) => {
        for (const side of ["west", "east"] as const) this.drawGun(ctx, side, flares);
        this.drawFlights(ctx);
        for (const f of flares) era.drawFlare(ctx, v.screenX(f.x), v.skyY(f.x, f.y), v.height * 0.0045, f.intensity, v.height * 0.12);
      },
    });
  }

  private drawGun(ctx: CanvasRenderingContext2D, side: DuelSide, flares: { x: number; intensity: number }[]) {
    const v = this.side;
    const facing: Facing = side === "west" ? 1 : -1;
    const gx = this.gunX(side);
    const recoil = this.turn ? Math.max(0, 1 - (this.time - this.recoilAt) * 2.5) : 0;
    const m = this.moves[side];
    const limbered = m ? clamp((this.time - m.start - 1.0) / 0.4) * (1 - clamp((this.time - m.start - 4.2) / 0.4)) : 0;
    const struck = this.time - this.hit[side] < 4;
    const lit = flares.reduce((best, f) => Math.max(best, f.intensity * Math.exp(-(((f.x - gx) / 500) ** 2))), 0);
    ctx.save();
    if (this.silenced[side] >= 0) {
      ctx.translate(v.screenX(gx), v.groundY(gx));
      ctx.rotate(-0.3 * facing * smoothstep(0, 0.4, this.time - this.silenced[side]));
      ctx.translate(-v.screenX(gx), -v.groundY(gx));
    }
    const glare = { x: v.screenX(gx), y: v.groundY(gx) - v.height * 0.12, strength: lit * 0.5, color: [214, 224, 255] as [number, number, number] };
    drawGunInGlare(ctx, v, this.options.era, gx, { elevation: this.shown[side] * (1 - limbered), recoil, crew: struck ? "ducking" : "serving" }, glare, undefined, facing);
    if (m) {
      const at = gunPlacement(v, gx, undefined, facing);
      const t = this.time - m.start;
      const offset = -(1 - smoothstep(0, 1, t) + smoothstep(4.4, 5.2, t)) * v.width * 0.4 * facing;
      const moving = t < 1 || (t > 1.4 && t < 4) || t > 4.4;
      ctx.save();
      // The team always faces away from the enemy, the way it hauls the gun back.
      if (facing === -1) {
        ctx.translate(at.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-at.x, 0);
      }
      this.options.era.field.drawTeam(ctx, at.x - at.wheel * 2.3 + offset * facing, at.y, at.wheel, { step: moving ? (this.time * 1.6) % 1 : 0.25, wheelTurn: this.time * (moving ? 3 : 0) }, v.appearance);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawFlights(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    const t = this.turn;
    const era = this.options.era;
    const drawn = (shot: DuelShot, clock: number, alpha: number) => {
      const facing: Facing = shot.side === "west" ? 1 : -1;
      const gx = this.engagement[shot.side].x;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawFieldArc(ctx, v, era, shot.flight, clock, { x: gx, facing, muzzle: drawnMuzzle(v, era, gx, shot.aim.elevation) }, (p) => ({ x: gx + facing * p.x, y: p.y }));
      ctx.restore();
    };
    for (const trail of this.trails) {
      const fade = 1 - clamp((this.time - trail.endedAt) / 2.5);
      if (fade > 0) drawn(trail.shot, trail.shot.flight.time, fade);
    }
    if (!t) return;
    const clock = ((this.time - t.started) / t.duration) * Math.max(...t.shots.map((s) => s.flight.time));
    for (const shot of t.shots) if (!t.landed.has(shot)) drawn(shot, Math.min(clock, shot.flight.time), 1);
  }

  /** Where a side's barrel pivots on screen, for laying it by dragging. */
  gunPivot(side: DuelSide) {
    const facing: Facing = side === "west" ? 1 : -1;
    const at = gunPlacement(this.side, this.gunX(side), undefined, facing);
    return { x: at.x + facing * at.wheel * 0.05, y: at.y - at.wheel * 0.68, reach: at.wheel * 3.2, facing };
  }
}
