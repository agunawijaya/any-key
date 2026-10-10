import { createRng } from "@/lib/kit/rng";
import { targetDistance, type EnemyRound, type Engagement, type Shot, type TurnEvent } from "@/lib/over-short/engagement";
import { positionAt } from "@/lib/over-short/models";
import { flareAt, type StarShell } from "../scene/effects";
import { FrontView } from "../scene/front";
import { clamp, hash1, smoothstep } from "../scene/noise";
import { Particles, warmSprites, type SceneLight } from "../scene/particles";
import { BURST_METRE, gunPlacement, muzzleInWorld } from "../scene/gunline";
import { lateralOf } from "./lateral";
import { SideView, type Appearance } from "../scene/side";
import type { Era, TargetLook } from "../eras/types";

/*
 * The director runs the battlefield on screen: the side view with the gun,
 * the long arc and the land rolling past, and the observer's field glasses
 * on the target. React decides what happens (it plays the engine and reads
 * its events); the director turns those events into a sequence on screen,
 * the shot, the fall of shot through the glasses, a target going up, an
 * enemy round, and says when the moment for the report has come and when
 * the sequence is over.
 */

/** How much of the land the side view shows across the screen, in metres. */
const VIEW_METRES = 4200;
/** How far the observer sits short of the target, at most. */
const OBSERVER_BACK = 1100;
const FOCAL = 13.3;

export type Cue = "fire" | "whistle" | "impact" | "hit" | "destroyed" | "incoming" | "enemy-impact" | "gun-hit" | "report" | "relocate";

export type DirectorOptions = {
  era: Era;
  /** The camera rides with the shell, or stays on the gun. */
  follow: boolean;
  /** Fewer moving parts: no camera ride or shake, cuts instead of zooms. */
  calm: boolean;
  /** Where the textbook formula says the current elevation lands, for the Campaign assist, or null. */
  textbook: ((elevation: number) => number) | null;
  sound?: (cue: Cue, detail?: { shot?: Shot; time?: number }) => void;
};

type Callbacks = { onReport?: (shot: Shot) => void; onDone?: () => void };

type Step =
  | { kind: "flight"; shot: Shot; duration: number }
  /** `look` is how long the side view shows the burst before the glasses come up (set when it lands). */
  | { kind: "fall"; shot: Shot; hold: number; look?: number }
  | { kind: "next-target"; hold: number }
  | { kind: "enemy"; round: EnemyRound; hold: number }
  | { kind: "relocate"; by: number; hold: number }
  | { kind: "return"; hold: number };

/** A moving target's road bends gently across the line of fire, so the vehicles on it stand clear of each other. */
const roadAcross = (away: number) => Math.sin(away / 260) * 40;

/** How long a burst holds the main screen before the observer's glasses come up: longer for a hit, longest for a kill. */
const BURST_ON_SCREEN = { miss: 1.4, hit: 1.6, destroyed: 2 };

/** How long a flight plays on screen: real flights take up to a minute and a half. */
export const playbackSeconds = (flightSeconds: number) => clamp(1.8 + flightSeconds * 0.065, 2.6, 6.5);

export class Director {
  readonly side: SideView;
  readonly front: FrontView;
  private sideFx: Particles;
  private frontFx: Particles;
  private random = createRng("over-short/director").float;
  private engagement: Engagement;
  private time = 0;
  private last = 0;
  /** The barrel's elevation on screen, easing towards the one the player has set. */
  private shownElevation: number;
  aim: number;
  private recoilAt = -10;
  private cameraX = 0;
  private apex = 1800;
  private steps: Step[] = [];
  private stepStart = 0;
  private callbacks: Callbacks = {};
  private flight: { shot: Shot; started: number; duration: number } | null = null;
  /** The last trail, fading after the round comes down. */
  private fadingTrail: { shot: Shot; endedAt: number } | null = null;
  private looks: TargetLook[];
  private lookChanged: number[];
  private observerX = 0;
  private gunHit = -1;
  private gunGlide: { from: number; to: number; start: number } | null = null;
  private flares: StarShell[] = [];
  private frontFrameRate = 0;
  /** The last burst on the main screen: when, where (world metres) and how hard, for the shake and the flash. */
  private burst: { at: number; x: number; power: number } | null = null;
  private shaking: { at: number; power: number } | null = null;
  private fullSince = -10;
  /** The side view's canvas: the shake moves it, which costs no repainting. */
  private sideCanvas: HTMLCanvasElement;
  /** The engagement as it will be when the sequence on screen is over. */
  private pendingEngagement: Engagement | null = null;
  /** Things to do a moment later, in scene time, so a paused game holds them too. */
  private timers: { at: number; run: () => void }[] = [];
  /** While paused the scene holds still (it is still drawn, for a change of appearance). */
  paused = false;

  constructor(
    sideCanvas: HTMLCanvasElement,
    frontCanvas: HTMLCanvasElement,
    /** The element holding the observer's view, flagged `data-full` while it fills the screen. */
    private observerFrame: HTMLElement,
    engagement: Engagement,
    private options: DirectorOptions,
  ) {
    this.side = new SideView(sideCanvas, options.era.side);
    this.sideCanvas = sideCanvas;
    this.front = new FrontView(frontCanvas, options.era.front, { height: 36, focal: FOCAL, horizon: 0.1 });
    this.sideFx = new Particles(createRng("over-short/side-fx").float);
    this.frontFx = new Particles(createRng("over-short/front-fx").float);
    this.engagement = engagement;
    this.aim = 30;
    this.shownElevation = 30;
    this.looks = engagement.targets.map((t) => ({ kind: t.kind, state: "intact", since: 0 }));
    this.lookChanged = engagement.targets.map(() => 0);
    this.cameraX = this.restingCamera();
    warmSprites();
    this.placeObserver();
    this.setWind();
  }

  /** Smoke drifts with the engagement's own wind, so a headwind can be seen; a still day still has a breath of air. */
  private setWind() {
    const wind = this.engagement.rules.wind;
    this.sideFx.wind = { x: wind === 0 ? 2.2 : wind, z: 0.4 };
    this.frontFx.wind = { x: 1.6, z: wind === 0 ? 0.4 : wind * 0.8 };
  }

  setOptions(options: Partial<DirectorOptions>) {
    this.options = { ...this.options, ...options };
  }

  resize(width: number, height: number, dpr: number) {
    this.side.resize(width, height, dpr);
    this.front.resize(width, height, dpr);
  }

  setAppearance(appearance: Appearance) {
    this.side.setAppearance(appearance);
    this.front.setAppearance(appearance);
  }

  get busy() {
    return this.steps.length > 0;
  }

  /** Where the barrel pivots on screen, in CSS pixels: dragging round it lays the gun. */
  gunPivot() {
    const at = gunPlacement(this.side, this.gunX());
    return { x: at.x + at.wheel * 0.05, y: at.y - at.wheel * 0.68, reach: at.wheel * 3.2 };
  }

  /* ---------- Where things are ---------- */

  private gunX() {
    const glide = this.gunGlide;
    if (!glide) return this.engagement.gunAt;
    const k = smoothstep(0, 1, clamp((this.time - glide.start) / 1.6));
    return glide.from + (glide.to - glide.from) * k;
  }

  /** Game seconds on screen: during a flight, the moment the shell has reached. */
  private gameTime() {
    const f = this.flight;
    if (!f) return this.engagement.time;
    const k = clamp((this.time - f.started) / f.duration);
    return f.shot.firedAt + k * f.shot.flight.time;
  }

  private targetWorldX(index = this.engagement.index, time = this.gameTime()) {
    return targetDistance(this.engagement, time, index) + this.engagement.gunAt;
  }

  /** At rest the gun stands two fifths of the way across, clear of the elevation panel in the corner. */
  private restingCamera() {
    return this.gunX() + VIEW_METRES * 0.1;
  }

  /** The observer sits short of the target on the line of fire, looking at it through the glasses. */
  private placeObserver() {
    const distance = targetDistance(this.engagement);
    const back = Math.min(OBSERVER_BACK, Math.max(350, distance * 0.45));
    this.observerX = this.targetWorldX(this.engagement.index, this.engagement.time) - back;
    this.front.setCamera({ height: back / 30, focal: FOCAL, horizon: 0.1 });
  }

  private observerAway(worldX: number) {
    return worldX - this.observerX;
  }

  private across(round: number) {
    return lateralOf(round);
  }

  /* ---------- What the player does ---------- */

  /** Plays the events of one turn; `after` is the engagement once they are over. */
  play(events: TurnEvent[], after: Engagement, callbacks: Callbacks) {
    this.callbacks = callbacks;
    const steps: Step[] = [];
    for (const event of events) {
      if (event.kind === "shot" || event.kind === "too-late") {
        steps.push({ kind: "flight", shot: event.shot, duration: playbackSeconds(event.shot.flight.time) });
        const kind = after.targets[event.shot.target].kind;
        const hold = event.shot.destroyed ? (kind === "dump" ? 5.5 : 4.2) : event.shot.hit ? 3.2 : 2.6;
        steps.push({ kind: "fall", shot: event.shot, hold });
      } else if (event.kind === "next-target") steps.push({ kind: "next-target", hold: 0.01 });
      else if (event.kind === "enemy-round") steps.push({ kind: "enemy", round: event.round, hold: event.round.onGun ? 3.2 : 2.3 });
      else if (event.kind === "relocated") steps.push({ kind: "relocate", by: event.by, hold: 2.4 });
    }
    steps.push({ kind: "return", hold: this.options.calm ? 0.2 : 1.1 });
    this.pendingEngagement = after;
    this.steps = steps;
    this.startStep();
  }

  private later(seconds: number, run: () => void) {
    this.timers.push({ at: this.time + seconds, run });
  }

  /** Space or a click during a flight: straight to the fall of shot. */
  skip() {
    if (this.steps[0]?.kind === "flight") this.stepStart = this.time - this.steps[0].duration;
  }

  private startStep() {
    this.stepStart = this.time;
    const step = this.steps[0];
    if (!step) return this.finish();
    if (step.kind === "flight") this.launch(step.shot, step.duration);
    else if (step.kind === "fall") this.impact(step.shot);
    else if (step.kind === "next-target") this.nextTarget();
    else if (step.kind === "enemy") this.enemyRound(step.round);
    else if (step.kind === "relocate") this.relocate(step.by);
    else if (step.kind === "return") this.observe(false);
  }

  private finish() {
    if (this.pendingEngagement) this.engagement = this.pendingEngagement;
    this.pendingEngagement = null;
    this.gunGlide = null;
    const done = this.callbacks.onDone;
    this.callbacks = {};
    done?.();
  }

  private launch(shot: Shot, duration: number) {
    this.aim = shot.elevation;
    this.shownElevation = shot.elevation;
    this.recoilAt = this.time;
    this.flight = { shot, started: this.time, duration };
    this.fadingTrail = null;
    this.apex = Math.max(400, shot.flight.apex);
    const direction = (shot.elevation * Math.PI) / 180;
    const muzzle = this.muzzleWorld();
    this.options.era.effects.muzzle(this.sideFx, { x: muzzle.x, z: 0, y: muzzle.y }, direction, 0.8);
    this.shake(0.35);
    this.options.sound?.("fire", { shot });
    this.options.sound?.("whistle", { shot, time: duration });
  }

  /** The muzzle in world metres, from where the gun is drawn on screen (the gun is drawn larger than life). */
  private muzzleWorld() {
    return muzzleInWorld(this.side, this.options.era, this.gunX(), this.shownElevation);
  }

  /**
   * The round comes down. First the main screen: the burst where it fell,
   * the view shaking with it. Then, if the burst was in view, a moment later
   * the observer's glasses come up on the same burst, close.
   */
  private impact(shot: Shot) {
    this.fadingTrail = { shot, endedAt: this.time };
    this.flight = null;
    const fx = this.options.era.effects;
    const landedX = this.gunX() + shot.flight.landed;
    const target = this.engagement.targets[shot.target];
    const kind = target.kind;
    const power = shot.destroyed ? 1.5 : shot.hit ? 1.25 : 1;
    fx.explosion(this.sideFx, { x: landedX, z: 0 }, power);
    if (shot.hit) {
      this.setLook(shot.target, shot.destroyed ? "destroyed" : "damaged");
      fx.hit(this.sideFx, kind, { x: landedX, z: 0 }, shot.destroyed, 1);
      this.options.sound?.(shot.destroyed ? "destroyed" : "hit", { shot });
    } else this.options.sound?.("impact", { shot });
    this.burst = { at: this.time, x: landedX, power };
    this.shake(power);

    // Riding with the shell, the camera is there for the burst, even when the flight was skipped: cut to it.
    if (this.options.follow && !this.options.calm && !this.inView(landedX)) this.cameraX = Math.max(this.restingCamera(), landedX);
    const look = this.inView(landedX) ? BURST_ON_SCREEN[shot.destroyed ? "destroyed" : shot.hit ? "hit" : "miss"] : 0;
    const step = this.steps[0];
    if (step?.kind === "fall") step.look = look;
    this.later(look, () => this.closeUp(shot));
  }

  /** Whether world metre `x` is on the main screen with the camera where it is now. */
  private inView(x: number) {
    const v = this.side;
    const sx = v.width / 2 + (x - this.cameraX) * (v.width / VIEW_METRES);
    return sx > v.width * 0.05 && sx < v.width * 0.95;
  }

  /** The fall of shot through the observer's glasses, and the report a moment later. */
  private closeUp(shot: Shot) {
    const fx = this.options.era.effects;
    const target = this.engagement.targets[shot.target];
    const landedX = this.gunX() + shot.flight.landed;
    const away = this.observerAway(landedX);
    if (shot.hit) fx.hit(this.frontFx, target.kind, { x: target.speed !== 0 ? roadAcross(away) : this.across(shot.round) * 0.2, z: away }, shot.destroyed, 1);
    else fx.fallOfShot(this.frontFx, { x: this.across(shot.round), z: Math.max(160, away) }, 1.1);
    this.observe(true);
    // The observer takes a moment to see where it fell, then reports.
    const report = this.callbacks.onReport;
    this.later(this.options.calm ? 0.3 : 0.7, () => {
      report?.(shot);
      this.options.sound?.("report", { shot });
    });
  }

  /** Shakes the main screen; `power` 1 is a round landing in view. Never with less motion. */
  private shake(power: number) {
    if (this.options.calm) return;
    this.shaking = { at: this.time, power };
  }

  private applyShake() {
    const s = this.shaking;
    const style = this.sideCanvas.style;
    if (!s) return;
    const age = this.time - s.at;
    const fade = Math.exp(-age * 5.5);
    if (fade < 0.02 || this.options.calm) {
      this.shaking = null;
      style.transform = "";
      return;
    }
    const amp = this.side.height * 0.009 * s.power * fade;
    // A little larger than the view, so the edges never show while it moves.
    style.transform = `translate(${Math.sin(age * 71) * amp}px, ${Math.cos(age * 57) * amp}px) scale(1.025)`;
  }

  /** The heat of the last burst washing over the main screen for a moment. */
  private drawBurstFlash(ctx: CanvasRenderingContext2D) {
    const b = this.burst;
    if (!b) return;
    const age = this.time - b.at;
    if (age > 0.6) return;
    const v = this.side;
    const x = v.screenX(b.x);
    const y = v.groundY(b.x) - v.height * 0.04;
    const night = v.appearance === "night";
    const strength = (1 - age / 0.6) ** 2 * (night ? 0.55 : 0.32) * Math.min(1.4, b.power);
    const reach = v.width * 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, `rgb(255 236 200 / ${strength})`);
    g.addColorStop(0.18, `rgb(255 170 90 / ${strength * 0.45})`);
    g.addColorStop(1, "rgb(255 120 60 / 0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.width, v.height);
    ctx.restore();
  }

  private setLook(index: number, state: TargetLook["state"]) {
    this.looks[index] = { ...this.looks[index], state };
    this.lookChanged[index] = this.time;
  }

  private nextTarget() {
    if (this.pendingEngagement) this.engagement = { ...this.engagement, index: this.pendingEngagement.index, time: this.pendingEngagement.time };
    this.placeObserver();
    // The glasses turn to new ground: the last target's fires are out of their field now.
    this.frontFx = new Particles(createRng(`over-short/front-fx/${this.engagement.index}`).float);
    this.setWind();
  }

  private enemyRound(round: EnemyRound) {
    this.observe(false);
    this.options.sound?.("incoming");
    const side = hash1(this.engagement.enemy.length + round.at, 7) < 0.5 ? -1 : 1;
    const x = this.gunX() + (round.onGun ? 0 : side * round.miss);
    this.later(0.65, () => {
      const power = round.onGun ? 1.5 : 1;
      this.options.era.effects.explosion(this.sideFx, { x, z: round.onGun ? 0 : 30 }, power);
      this.burst = { at: this.time, x, power };
      // Close to the gun: the ground under the crew jumps.
      this.shake(round.onGun ? 2.2 : 1.4);
      this.options.sound?.(round.onGun ? "gun-hit" : "enemy-impact");
      if (round.onGun) this.gunHit = this.time;
    });
  }

  private relocate(by: number) {
    this.gunGlide = { from: this.engagement.gunAt, to: this.engagement.gunAt + by, start: this.time + 0.4 };
    this.options.sound?.("relocate");
  }

  /** The observer's glasses fill the screen for the fall of shot, and go back to their corner afterwards. */
  private observe(full: boolean) {
    if (full && this.observerFrame.dataset.full !== "true") this.fullSince = this.time;
    this.observerFrame.dataset.full = full ? "true" : "false";
  }

  /* ---------- Every frame ---------- */

  frame(now: number) {
    // A canvas with no room (hidden behind the Story, mid-resize) has nothing to show.
    if (this.side.width < 8 || this.side.height < 8) return;
    const dt = this.paused ? 0 : this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.time += dt;
    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const t of due) t.run();
    this.sideFx.advance(dt);
    this.frontFx.advance(dt);
    this.shownElevation += (this.aim - this.shownElevation) * Math.min(1, dt * 14);
    for (const [i, look] of this.looks.entries()) this.looks[i] = { ...look, since: this.time - this.lookChanged[i] };
    this.advanceSteps();
    this.updateFlares();
    this.updateCamera(dt);
    const full = this.observerFrame.dataset.full === "true";
    // The glasses in their corner are small and slow-moving: half the frame rate is plenty.
    this.frontFrameRate++;
    if (full || this.frontFrameRate % 2 === 0) this.drawFront();
    // While the glasses grow to fill the screen, the battlefield behind them still shows.
    if (!full || this.time - this.fullSince < 0.45) this.drawSide();
    this.applyShake();
  }

  private advanceSteps() {
    const step = this.steps[0];
    if (!step) return;
    const length = step.kind === "flight" ? step.duration : step.kind === "fall" ? step.hold + (step.look ?? 0) : step.hold;
    if (this.time - this.stepStart < length) return;
    this.steps.shift();
    this.startStep();
  }

  private updateCamera(dt: number) {
    let target = this.restingCamera();
    const f = this.flight;
    if (f && this.options.follow && !this.options.calm) {
      const p = positionAt(f.shot.flight, (this.time - f.started) / f.duration * f.shot.flight.time);
      target = Math.max(target, this.gunX() + p.x + VIEW_METRES * 0.1);
    } else if (this.fadingTrail && this.steps[0]?.kind === "fall" && this.options.follow && !this.options.calm) {
      target = Math.max(target, this.gunX() + this.fadingTrail.shot.flight.landed);
    }
    if (this.options.calm) {
      this.cameraX = target;
      return;
    }
    // Riding with a shell the camera keeps right up with it; going home it glides.
    const rate = f ? 9 : 2.6;
    this.cameraX += (target - this.cameraX) * Math.min(1, dt * rate);
  }

  /** Star shells keep going up over the line at night, a few at a time. */
  private updateFlares() {
    if (this.side.appearance !== "night") {
      this.flares = [];
      return;
    }
    this.flares = this.flares.filter((f) => this.time - f.burst < 42);
    // A night barrage is never without a star shell or two hanging over it.
    const wanted = this.flares.length < 2 ? 1 : this.flares.length < 3 ? 0.012 : 0;
    if (this.random() < wanted) {
      const ahead = this.cameraX + (this.random() - 0.3) * VIEW_METRES;
      // The first ones of the night are already burning when the scene opens.
      const burst = this.time < 1 ? this.time - 4 - this.random() * 14 : this.time;
      this.flares.push({ x: ahead, z: 0, burst, altitude: 650 + this.random() * 300, seed: this.random() });
    }
  }

  private flareLights(): { x: number; y: number; intensity: number }[] {
    return this.flares.map((f) => flareAt(f, this.time, 2)).filter((f) => f.burning);
  }

  private drawSide() {
    const v = this.side;
    const scale = v.width / VIEW_METRES;
    const night = v.appearance === "night";
    const lights: SceneLight[] = [...this.sideFx.lights];
    const flares = night ? this.flareLights() : [];
    for (const f of flares) lights.push({ x: f.x, y: f.y, z: 0, radius: 700, color: [235, 240, 255], intensity: f.intensity });
    // Bursts are drawn as large as the gun is drawn, around where each one went off.
    this.sideFx.magnify = (v.height * BURST_METRE) / scale;
    v.draw({
      time: this.time,
      cameraX: this.cameraX,
      scale,
      apex: this.apex,
      fx: this.sideFx,
      lights,
      overlay: (ctx) => this.drawBurstFlash(ctx),
      actors: (ctx) => {
        const era = this.options.era;
        const size = v.height * 0.05;
        for (const [i] of this.engagement.targets.entries()) {
          if (i > this.engagement.index && this.looks[i].state === "intact") continue;
          const x = this.targetWorldX(i);
          const sx = v.screenX(x);
          if (sx < -200 || sx > v.width + 200) continue;
          era.drawTargetSide(ctx, this.looks[i], sx, v.groundY(x), size, v.appearance, this.time);
          if (i === this.engagement.index && this.looks[i].state !== "destroyed") this.drawTargetMarker(ctx, sx, v.groundY(x) - size * 1.9);
        }
        this.drawTextbook(ctx);
        this.drawGunOnScreen(ctx);
        this.drawFlight(ctx);
        for (const f of flares) era.drawFlare(ctx, v.screenX(f.x), v.skyY(f.x, f.y), v.height * 0.0045, f.intensity, v.height * 0.12);
      },
    });
  }

  /** A small pennant over the current target, so it can be found among the fields kilometres off. */
  private drawTargetMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const s = this.side.height * 0.012;
    const night = this.side.appearance === "night";
    ctx.save();
    ctx.strokeStyle = night ? "rgb(236 214 170 / 0.75)" : "rgb(60 46 28 / 0.7)";
    ctx.lineWidth = Math.max(1, s * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, y + s * 1.6);
    ctx.lineTo(x, y - s * 1.4);
    ctx.stroke();
    ctx.fillStyle = night ? "rgb(214 166 94)" : "rgb(163 39 27)";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.4);
    ctx.lineTo(x + s * 1.6, y - s * 0.9);
    ctx.lineTo(x, y - s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGunOnScreen(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    const gx = this.gunX();
    const recoil = Math.max(0, 1 - (this.time - this.recoilAt) * 2.5);
    ctx.save();
    if (this.gunHit >= 0) {
      // Knocked out: the gun slewed over on its side, the crew gone back to cover.
      ctx.translate(v.screenX(gx), v.groundY(gx));
      ctx.rotate(-0.3 * smoothstep(0, 0.4, this.time - this.gunHit));
      ctx.translate(-v.screenX(gx), -v.groundY(gx));
    }
    const at = gunPlacement(v, gx);
    this.options.era.drawGun(ctx, at.x, at.y, at.wheel, { elevation: this.shownElevation, recoil }, v.appearance);
    ctx.restore();
  }

  /** The shell and its trail, from the muzzle along the model's own path. */
  private drawFlight(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    const f = this.flight;
    const fading = this.fadingTrail;
    const shot = f?.shot ?? fading?.shot;
    if (!shot) return;
    const progress = f ? clamp((this.time - f.started) / f.duration) : 1;
    const fade = fading ? 1 - clamp((this.time - fading.endedAt) / 2.5) : 1;
    if (fade <= 0) return;
    const gx = this.gunX();
    const flight = shot.flight;
    const wheel = gunPlacement(v, gx).wheel;
    const muzzleLift = wheel * 1.1;
    const baseAt = (x: number) => {
      const k = flight.landed ? x / flight.landed : 0;
      return v.groundY(gx) - muzzleLift * (1 - k) + (v.groundY(gx + flight.landed) - v.groundY(gx)) * k;
    };
    const toScreen = (x: number, y: number) => ({ x: v.screenX(gx + x), y: v.altitudeY(baseAt(x), y - (flight.landedHeight * x) / (flight.landed || 1), this.apex) });
    const until = progress * flight.time;
    const points = flight.path.filter((p) => p.t <= until).map((p) => toScreen(p.x, p.y));
    const here = positionAt(flight, until);
    const head = toScreen(here.x, here.y);
    points.push(head);
    ctx.save();
    ctx.globalAlpha = fade;
    this.options.era.drawTrail(ctx, points, v.appearance, v.height * 0.0032);
    ctx.restore();
    if (!f) return;
    const ahead = positionAt(flight, until + 0.3);
    const next = toScreen(ahead.x, ahead.y);
    this.options.era.drawShell(ctx, head.x, head.y, Math.atan2(next.y - head.y, next.x - head.x), v.height * 0.022, v.appearance);
  }

  /** The Campaign assist: a dashed arc to where the textbook formula says this elevation would land. */
  private drawTextbook(ctx: CanvasRenderingContext2D) {
    const textbook = this.options.textbook;
    if (!textbook || this.flight) return;
    const v = this.side;
    const gx = this.gunX();
    const range = textbook(this.shownElevation);
    const apex = (range * Math.tan((this.shownElevation * Math.PI) / 180)) / 4;
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = v.appearance === "night" ? "rgb(214 166 94 / 0.75)" : "rgb(120 84 40 / 0.75)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const x = (k / 40) * range;
      const y = 4 * apex * (k / 40) * (1 - k / 40);
      const sx = v.screenX(gx + x);
      const sy = v.altitudeY(v.groundY(gx + x), y, this.apex);
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawFront() {
    const v = this.front;
    const era = this.options.era;
    const index = this.engagement.index;
    const target = this.engagement.targets[index];
    if (!v.hasProps) v.setProps(target.speed === 0 ? [era.targetProp(() => this.looks[index], 0, this.observerAway(this.targetWorldX(index)))] : []);
    const night = v.appearance === "night";
    const lights: SceneLight[] = [...this.frontFx.lights];
    const flares = night ? this.flares.map((f) => flareAt({ ...f, x: (f.seed - 0.5) * 500, z: this.observerAway(this.targetWorldX()) + 200 + f.seed * 300, altitude: 160 }, this.time, 1.6)).filter((f) => f.burning) : [];
    for (const f of flares) lights.push({ x: f.x, y: f.y, z: f.z, radius: 330, color: [235, 240, 255], intensity: f.intensity });
    v.draw({
      time: this.time,
      fx: this.frontFx,
      lights,
      actors: (ctx) => {
        if (target.speed !== 0) this.drawConvoy(ctx);
        for (const f of flares) {
          const at = v.project(f.x, f.y, f.z);
          if (at) era.drawFlare(ctx, at.x, at.y, at.scale * 0.6, f.intensity, at.scale * 10);
        }
      },
      overlay: (ctx) => era.optic(ctx, v.width, v.height, v.appearance),
    });
  }

  private drawConvoy(ctx: CanvasRenderingContext2D) {
    const v = this.front;
    const era = this.options.era;
    const index = this.engagement.index;
    const lead = this.observerAway(this.targetWorldX(index));
    const wrecked = this.looks[index].state === "destroyed";
    ctx.save();
    ctx.fillStyle = v.appearance === "night" ? "rgb(40 38 40 / 0.55)" : "rgb(120 100 76 / 0.45)";
    ctx.beginPath();
    const edge: { x: number; y: number }[] = [];
    for (let away = 300; away <= 4000; away += 50) {
      const at = v.project(roadAcross(away) - 3, 0, away);
      if (at) edge.push(at);
    }
    for (let away = 4000; away >= 300; away -= 50) {
      const at = v.project(roadAcross(away) + 3, 0, away);
      if (at) edge.push(at);
    }
    edge.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // The vehicles down the road, the farthest drawn first.
    for (let k = 2; k >= 0; k--) {
      const away = lead + (k - 1) * era.moverSpacing;
      const at = v.project(roadAcross(away), 0, away);
      if (!at) continue;
      const lit = v.appearance === "night" && this.flares.length > 0 ? "flare" : "ambient";
      era.drawMover(ctx, at.x, at.y, at.scale * 1.4, v.appearance, lit, wrecked && k === 1);
    }
  }
}
