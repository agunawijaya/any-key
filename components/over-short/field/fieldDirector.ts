import { createRng } from "@/lib/kit/rng";
import { litAt, targetAt, type FieldEngagement, type FieldEnemyRound, type FieldEvent, type FieldShot } from "@/lib/over-short/field";
import { fieldPositionAt } from "@/lib/over-short/fieldModel";
import { heightAt, highestBetween } from "@/lib/over-short/terrain";
import type { Era, TargetLook } from "../eras/types";
import { playbackSeconds } from "../play/director";
import { drawFieldArc, drawnMuzzle } from "../scene/arcs";
import { drawBurstWash, shakeTransform } from "../scene/battle";
import { earthRain, flareAt, smokePall, type StarShell } from "../scene/effects";
import { FrontView } from "../scene/front";
import { BURST_METRE, drawGunInGlare, GUN_SIZE, gunPlacement, muzzleInWorld } from "../scene/gunline";
import { clamp, hash1, smoothstep } from "../scene/noise";
import { Particles, warmSprites, type SceneLight } from "../scene/particles";
import { SideView, type Appearance } from "../scene/side";

/*
 * The Field Artillery battlefield on screen. Like the Campaign's director it
 * turns the engine's events into a sequence: the round fired and ridden
 * along its arc over the real hills, the burst on the main screen, then the
 * observer's glasses on the fall of shot, left and right as well as over
 * and short. What Field Artillery adds:
 *
 * - enemy rounds walking in on the gun, shown from close by: the camera
 *   closes on the gun, the crew get down, earth comes down on them, and at
 *   night the fire lights them from the side;
 * - the team of horses coming up to limber the gun and haul it down the
 *   road;
 * - star shells called for at night, and nothing but the burst's flash
 *   without them; the moon up in the light theme;
 * - smoke laid over the target, hiding the fall of shot;
 * - a convoy crossing the line of fire, a bridge over its river with a
 *   column on its way to it.
 */

/** How much land the side view shows across the screen, ordinarily and under fire. */
const VIEW_METRES = 4200;
const CLOSE = { view: 1900, gun: GUN_SIZE * 1.5, burst: BURST_METRE * 1.15 };
const OBSERVER_BACK = 1100;
const FOCAL = 13.3;
const SQUEEZE = 900;
/** The column on its way to the bridge drives at this speed, and its lorries keep this far apart. */
const COLUMN = { speed: 3, spacing: 62, lorries: 6 };
/** Bridges in this view span their valley from rim to rim. */
const BRIDGE_HALF = 260;
/** The light theme's night: the moon up, its light everywhere a little. */
const MOONLIGHT: SceneLight = { x: 0, y: 0, z: 0, radius: 60000, color: [200, 214, 240], intensity: 0.3 };

export type FieldCue = "fire" | "whistle" | "impact" | "hit" | "destroyed" | "incoming" | "enemy-impact" | "gun-hit" | "report" | "relocate" | "star-shell" | "telephone";

export type FieldDirectorOptions = {
  era: Era;
  follow: boolean;
  calm: boolean;
  sound?: (cue: FieldCue, detail?: { shot?: FieldShot; time?: number }) => void;
};

type Callbacks = { onReport?: (shot: FieldShot) => void; onDone?: () => void };

type Step =
  | { kind: "flight"; shot: FieldShot; duration: number }
  | { kind: "fall"; shot: FieldShot; hold: number; look?: number }
  | { kind: "enemy"; round: FieldEnemyRound; hold: number }
  | { kind: "relocate"; by: number; hold: number }
  | { kind: "illuminate"; hold: number }
  | { kind: "next-target"; hold: number }
  | { kind: "return"; hold: number };

const BURST_ON_SCREEN = { miss: 1.4, hit: 1.6, destroyed: 2 };
const RELOCATE_ON_SCREEN = 5.2;
/** With less motion the move is played this many times faster. */
const CALM_MOVE = 6.5;

export class FieldDirector {
  readonly side: SideView;
  readonly front: FrontView;
  private sideFx: Particles;
  private frontFx: Particles;
  private random = createRng("over-short/field-director").float;
  private engagement: FieldEngagement;
  private pending: FieldEngagement | null = null;
  private time = 0;
  private last = 0;
  private steps: Step[] = [];
  private stepStart = 0;
  private callbacks: Callbacks = {};
  private timers: { at: number; run: () => void }[] = [];
  /** The barrel's elevation on screen, easing towards the one the player has set. */
  private shownElevation = 25;
  aim = 25;
  private recoilAt = -10;
  private cameraX = 0;
  /** How close the side view has come in: 0 ordinarily, 1 under fire. */
  private closeness = 0;
  private flight: { shot: FieldShot; started: number; duration: number } | null = null;
  private fadingTrail: { shot: FieldShot; endedAt: number } | null = null;
  private looks: TargetLook[];
  private lookChanged: number[];
  private observerX = 0;
  private gunHit = -1;
  private ducking = -10;
  private move: { from: number; by: number; start: number } | null = null;
  private flares: StarShell[] = [];
  private frontFlares: StarShell[] = [];
  private burst: { at: number; x: number; power: number; near: boolean } | null = null;
  private shaking: { at: number; power: number } | null = null;
  private fullSince = -10;
  private frontFrameRate = 0;
  private dark = false;
  private warmedFor = "";
  private frontWarm = false;
  private sideCanvas: HTMLCanvasElement;
  paused = false;

  constructor(
    sideCanvas: HTMLCanvasElement,
    frontCanvas: HTMLCanvasElement,
    private observerFrame: HTMLElement,
    engagement: FieldEngagement,
    private options: FieldDirectorOptions,
  ) {
    this.side = new SideView(sideCanvas, options.era.side);
    this.sideCanvas = sideCanvas;
    this.front = new FrontView(frontCanvas, options.era.front, { height: 36, focal: FOCAL, horizon: 0.1 });
    this.sideFx = new Particles(createRng("over-short/field-side-fx").float);
    this.frontFx = new Particles(createRng("over-short/field-front-fx").float);
    this.engagement = engagement;
    this.looks = engagement.targets.map((t) => ({ kind: t.kind, state: "intact", since: 0 }));
    this.lookChanged = engagement.targets.map(() => 0);
    const terrain = engagement.rules.terrain;
    const far = Math.max(...engagement.targets.map((t) => t.x)) + 3000;
    this.side.setRelief({ height: (x) => heightAt(terrain, x), highest: highestBetween(terrain, -3000, far), squeeze: SQUEEZE });
    this.cameraX = this.restingCamera();
    warmSprites();
    this.placeObserver();
    this.setWind();
  }

  private setWind() {
    const { along, across } = this.engagement.rules.wind;
    this.sideFx.wind = { x: along === 0 ? 1.5 : along, z: 0.3 };
    this.frontFx.wind = { x: across === 0 ? 1.2 : across, z: along * 0.8 };
  }

  setOptions(options: Partial<FieldDirectorOptions>) {
    this.options = { ...this.options, ...options };
  }

  resize(width: number, height: number, dpr: number) {
    this.side.resize(width, height, dpr);
    this.front.resize(width, height, dpr);
  }

  /** The collection's theme: a night mission is night in both, with the moon up in the light one. */
  setTheme(dark: boolean) {
    this.dark = dark;
    const appearance: Appearance = this.engagement.rules.night || dark ? "night" : "day";
    this.side.setAppearance(appearance);
    this.front.setAppearance(appearance);
  }

  private get moonlit() {
    return this.engagement.rules.night !== null && !this.dark;
  }

  get busy() {
    return this.steps.length > 0;
  }

  /* ---------- Where things are ---------- */

  private get viewMetres() {
    return VIEW_METRES + (CLOSE.view - VIEW_METRES) * smoothstep(0, 1, this.closeness);
  }

  private get wheelShare() {
    return GUN_SIZE + (CLOSE.gun - GUN_SIZE) * smoothstep(0, 1, this.closeness);
  }

  private get burstMetre() {
    return BURST_METRE + (CLOSE.burst - BURST_METRE) * smoothstep(0, 1, this.closeness);
  }

  private gunX() {
    const m = this.move;
    if (!m) return this.engagement.gunX;
    // The gun moves only while the team hauls it: after they hook on and before they unhook.
    const k = smoothstep(0, 1, clamp((this.moveAge(m) - 1.4) / 2.6));
    return m.from + m.by * k;
  }

  /** Seconds into moving the gun, on the move's own timeline (hurried along with less motion). */
  private moveAge(m: { start: number }) {
    const age = this.time - m.start;
    return this.options.calm ? age * CALM_MOVE : age;
  }

  /** Game seconds on screen: during a flight, the moment the shell has reached. */
  private gameTime() {
    const f = this.flight;
    if (!f) return this.engagement.time;
    return f.shot.firedAt + clamp((this.time - f.started) / f.duration) * f.shot.flight.time;
  }

  private restingCamera() {
    return this.gunX() + this.viewMetres * 0.1;
  }

  /** Where the barrel pivots on screen: dragging round it lays the gun. */
  gunPivot() {
    const at = gunPlacement(this.side, this.gunX(), this.wheelShare);
    return { x: at.x + at.wheel * 0.05, y: at.y - at.wheel * 0.68, reach: at.wheel * 3.2 };
  }

  private placeObserver() {
    const target = targetAt(this.engagement);
    const distance = target.x - this.engagement.gunX;
    const back = Math.min(OBSERVER_BACK, Math.max(350, distance * 0.45));
    this.observerX = target.x - back;
    this.front.setCamera({ height: back / 30, focal: FOCAL, horizon: 0.1 });
  }

  /* ---------- What the player does ---------- */

  play(events: FieldEvent[], after: FieldEngagement, callbacks: Callbacks) {
    this.callbacks = callbacks;
    const steps: Step[] = [];
    // Shown in the order that reads best rather than the clock's: the player's own round and its report
    // first, then the enemy's rounds that fell meanwhile; the gun on the road first, then their rounds on
    // the pit it has left.
    const isEnemy = (event: FieldEvent) => event.kind === "enemy-round";
    const ordered = [...events.filter((e) => !isEnemy(e) && e.kind !== "over"), ...events.filter(isEnemy), ...events.filter((e) => e.kind === "over")];
    for (const event of ordered) {
      if (event.kind === "shot" || event.kind === "too-late") {
        steps.push({ kind: "flight", shot: event.shot, duration: playbackSeconds(event.shot.flight.time) });
        const hold = event.shot.destroyed ? (after.targets[event.shot.target].kind === "dump" ? 5.5 : 4.2) : event.shot.hit ? 3.2 : 2.6;
        steps.push({ kind: "fall", shot: event.shot, hold });
      } else if (event.kind === "enemy-round") steps.push({ kind: "enemy", round: event.round, hold: event.round.onGun ? 3.4 : 2.6 });
      else if (event.kind === "relocated") steps.push({ kind: "relocate", by: event.by, hold: this.options.calm ? RELOCATE_ON_SCREEN / CALM_MOVE : RELOCATE_ON_SCREEN });
      else if (event.kind === "illuminated") steps.push({ kind: "illuminate", hold: 2.6 });
      else if (event.kind === "next-target") steps.push({ kind: "next-target", hold: 0.01 });
    }
    steps.push({ kind: "return", hold: this.options.calm ? 0.2 : 1.1 });
    this.pending = after;
    this.steps = steps;
    this.startStep();
  }

  skip() {
    const step = this.steps[0];
    if (step?.kind === "flight") this.stepStart = this.time - step.duration;
  }

  private later(seconds: number, run: () => void) {
    this.timers.push({ at: this.time + seconds, run });
  }

  private startStep() {
    this.stepStart = this.time;
    const step = this.steps[0];
    if (!step) return this.finish();
    if (step.kind === "flight") this.launch(step.shot, step.duration);
    else if (step.kind === "fall") this.impact(step.shot);
    else if (step.kind === "enemy") this.enemyRound(step.round);
    else if (step.kind === "relocate") this.relocate(step.by);
    else if (step.kind === "illuminate") this.illuminate();
    else if (step.kind === "next-target") this.nextTarget();
    else if (step.kind === "return") this.observe(false);
  }

  private finish() {
    if (this.pending) this.engagement = this.pending;
    this.pending = null;
    this.move = null;
    const done = this.callbacks.onDone;
    this.callbacks = {};
    done?.();
  }

  private launch(shot: FieldShot, duration: number) {
    this.aim = shot.aim.elevation;
    this.shownElevation = shot.aim.elevation;
    this.recoilAt = this.time;
    this.flight = { shot, started: this.time, duration };
    this.fadingTrail = null;
    const muzzle = muzzleInWorld(this.side, this.options.era, this.gunX(), this.shownElevation, this.wheelShare);
    this.options.era.effects.muzzle(this.sideFx, { x: muzzle.x, z: 0, y: muzzle.y }, (shot.aim.elevation * Math.PI) / 180, 0.8);
    this.shake(0.35);
    this.options.sound?.("fire", { shot });
    this.options.sound?.("whistle", { shot, time: duration });
  }

  /** The round comes down: the burst on the main screen first, then the observer's glasses on it. */
  private impact(shot: FieldShot) {
    this.fadingTrail = { shot, endedAt: this.time };
    this.flight = null;
    const fx = this.options.era.effects;
    const x = shot.flight.burst.x;
    const target = this.engagement.targets[shot.target];
    const power = shot.destroyed ? 1.5 : shot.hit ? 1.25 : 1;
    const landedAt = shot.firedAt + shot.flight.time;
    const lit = this.engagement.rules.night ? litAt(this.pending ?? this.engagement, landedAt) : true;
    const smoked = shot.report.kind === "lost";
    if (this.engagement.rules.night) this.lightTarget(lit);
    if (smoked) this.laySmoke();
    fx.explosion(this.sideFx, { x, z: 0 }, power);
    if (shot.hit) {
      this.setLook(shot.target, shot.destroyed ? "destroyed" : "damaged");
      fx.hit(this.sideFx, target.kind, { x, z: 0 }, shot.destroyed, 1);
      this.options.sound?.(shot.destroyed ? "destroyed" : "hit", { shot });
    } else this.options.sound?.("impact", { shot });
    this.burst = { at: this.time, x, power, near: false };
    this.shake(power);
    if (this.options.follow && !this.options.calm && !this.inView(x)) this.cameraX = Math.max(this.restingCamera(), x);
    const look = this.inView(x) ? BURST_ON_SCREEN[shot.destroyed ? "destroyed" : shot.hit ? "hit" : "miss"] : 0;
    const step = this.steps[0];
    if (step?.kind === "fall") step.look = look;
    this.later(look, () => this.closeUp(shot));
  }

  private inView(x: number) {
    const v = this.side;
    const sx = v.width / 2 + (x - this.cameraX) * (v.width / this.viewMetres);
    return sx > v.width * 0.05 && sx < v.width * 0.95;
  }

  /** The fall of shot through the glasses, left or right as well as over or short, then the call on the telephone. */
  private closeUp(shot: FieldShot) {
    const fx = this.options.era.effects;
    const target = this.engagement.targets[shot.target];
    const away = shot.flight.burst.x - this.observerX;
    const across = shot.flight.burst.z;
    if (shot.hit) fx.hit(this.frontFx, target.kind, { x: across, z: away }, shot.destroyed, 1);
    else fx.fallOfShot(this.frontFx, { x: across, z: Math.max(160, away) }, 1.1);
    this.observe(true);
    const report = this.callbacks.onReport;
    this.options.sound?.("telephone", { shot });
    this.later(this.options.calm ? 0.3 : 0.9, () => {
      report?.(shot);
      this.options.sound?.("report", { shot });
    });
  }

  /** Smoke laid across the target just before the round arrives: the observer will see nothing of it. */
  private laySmoke() {
    const r = this.frontFx.random;
    const target = targetAt(this.engagement);
    const away = target.x - this.observerX;
    this.frontFx.anchorAt(0);
    for (let i = 0; i < 70; i++) {
      this.frontFx.add({
        kind: "smoke",
        x: (r() * 2 - 1) * 260,
        y: r() * 30,
        z: away - 120 + r() * 160,
        vx: (r() - 0.5) * 2,
        vy: 0.5 + r() * 1.5,
        life: 9 + r() * 5,
        size: 14 + r() * 16,
        grow: 1 + r() * 2,
        angle: r() * Math.PI * 2,
        spin: (r() - 0.5) * 0.2,
        color: [212, 210, 204],
        alpha: 0.95,
      });
    }
    smokePall(this.sideFx, { x: target.x, z: -20 }, 10, 2.4);
  }

  /** A night shoot: a star shell burns over the target for this round, or the dark is left as it is. */
  private lightTarget(lit: boolean) {
    const target = targetAt(this.engagement);
    if (!lit) {
      this.flares = [];
      this.frontFlares = [];
      return;
    }
    if (this.flares.some((f) => this.time - f.burst < 30)) return;
    this.starShellOver(target.x, this.time - 3);
  }

  private starShellOver(x: number, burst: number) {
    this.flares = [{ x: x + (this.random() - 0.5) * 300, z: 0, burst, altitude: 320 + this.random() * 120, seed: this.random() }];
    this.frontFlares = [{ x: (this.random() - 0.5) * 200, z: x - this.observerX + 150, burst, altitude: 150, seed: this.random() }];
  }

  private illuminate() {
    this.observe(true);
    this.options.sound?.("star-shell");
    this.later(0.5, () => this.starShellOver(targetAt(this.engagement).x, this.time));
  }

  private shake(power: number) {
    if (this.options.calm) return;
    this.shaking = { at: this.time, power };
  }

  private applyShake() {
    if (!this.shaking) return;
    const transform = this.options.calm ? "" : shakeTransform(this.shaking, this.time, this.side.height);
    if (!transform) this.shaking = null;
    this.sideCanvas.style.transform = transform;
  }

  private setLook(index: number, state: TargetLook["state"]) {
    this.looks[index] = { ...this.looks[index], state };
    this.lookChanged[index] = this.time;
  }

  private nextTarget() {
    if (this.pending) this.engagement = { ...this.engagement, index: this.pending.index, time: this.pending.time };
    this.placeObserver();
    this.frontFx = new Particles(createRng(`over-short/field-front-fx/${this.engagement.index}`).float);
    this.setWind();
  }

  /**
   * An enemy round: the camera closes on the gun, the incoming shell comes
   * screaming down from their side, and the earth goes up. Close by, the
   * crew are already down behind the shield and the earth rains on them.
   */
  private enemyRound(round: FieldEnemyRound) {
    this.observe(false);
    this.options.sound?.("incoming");
    const gunX = this.gunX();
    const close = Math.abs(round.x - gunX) < 450 && !round.emptyPit;
    if (close) this.ducking = this.time;
    const side = hash1(round.at, 7) < 0.5 ? -1 : 1;
    const z = round.onGun ? 0 : Math.max(6, Math.abs(round.z) * 0.05) * side;
    this.later(0.75, () => {
      const power = round.onGun ? 1.5 : 1.1;
      this.options.era.effects.explosion(this.sideFx, { x: round.x, z }, power);
      smokePall(this.sideFx, { x: round.x, z }, 40, 1);
      this.burst = { at: this.time, x: round.x, power, near: close };
      this.shake(round.onGun ? 2.2 : close ? 1.6 : 1);
      this.options.sound?.(round.onGun ? "gun-hit" : "enemy-impact");
      if (round.onGun) this.gunHit = this.time;
      else if (close && Math.abs(round.x - gunX) < 220) {
        // The crew, drawn larger than life, crouch some way back from the gun's spot.
        const crew = gunPlacement(this.side, gunX, this.wheelShare);
        const crewX = gunX + (crew.x - crew.wheel * 0.9 - this.side.screenX(gunX)) / this.side.scale;
        earthRain(this.sideFx, { x: crewX, z: 0 }, 9, 1.3);
      }
    });
  }

  private relocate(by: number) {
    this.move = { from: this.engagement.gunX, by, start: this.time };
    this.options.sound?.("relocate");
  }

  private observe(full: boolean) {
    if (full && this.observerFrame.dataset.full !== "true") this.fullSince = this.time;
    this.observerFrame.dataset.full = full ? "true" : "false";
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
    this.sideFx.advance(dt);
    this.frontFx.advance(dt);
    this.shownElevation += (this.aim - this.shownElevation) * Math.min(1, dt * 14);
    for (const [i, look] of this.looks.entries()) this.looks[i] = { ...look, since: this.time - this.lookChanged[i] };
    this.advanceSteps();
    this.updateFlares();
    this.updateCamera(dt);
    this.warmAhead();
    const full = this.observerFrame.dataset.full === "true";
    this.frontFrameRate++;
    if (full || this.frontFrameRate % 2 === 0) this.drawFront();
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
    const step = this.steps[0];
    // Under fire, and while the gun is moved, the view comes in close on it.
    const wantClose = !this.options.calm && (step?.kind === "enemy" || step?.kind === "relocate") ? 1 : 0;
    // A cut, not a zoom: the closer view's land was painted ahead while the player was aiming.
    const cut = wantClose !== this.closeness;
    this.closeness = wantClose;
    let target = this.restingCamera();
    const f = this.flight;
    if (f && this.options.follow && !this.options.calm) {
      const p = fieldPositionAt(f.shot.flight, ((this.time - f.started) / f.duration) * f.shot.flight.time);
      target = Math.max(target, p.x + this.viewMetres * 0.1);
    } else if (this.fadingTrail && step?.kind === "fall" && this.options.follow && !this.options.calm) {
      target = Math.max(target, this.fadingTrail.shot.flight.burst.x);
    } else if (step?.kind === "enemy") {
      target = this.gunX() + this.viewMetres * 0.25;
    }
    if (this.options.calm || cut) {
      this.cameraX = target;
      return;
    }
    this.cameraX += (target - this.cameraX) * Math.min(1, dt * (f ? 9 : 2.6));
  }

  /**
   * While nothing is happening, paints ahead the close view of the gun that
   * enemy fire and moving cut to, then the land out to the target that the
   * camera rides through with each round.
   */
  private warmAhead() {
    const key = `${this.side.generation}/${this.engagement.gunX}`;
    if (key !== this.warmedFor) {
      this.warmedFor = key;
      this.side.prepare(this.engagement.gunX + CLOSE.view * 0.25, this.side.width / CLOSE.view);
      const beyondTarget = targetAt(this.engagement).x + VIEW_METRES * 0.2;
      this.side.prepare(this.restingCamera(), this.side.width / VIEW_METRES, beyondTarget);
      this.frontWarm = true;
    }
    if (this.busy) return;
    if (!this.side.warmOne() && this.frontWarm) {
      this.frontWarm = false;
      this.front.prepare();
    }
  }

  /**
   * Star shells: on a night shoot only those the player called for; on a
   * day shoot in the dark theme, the night barrage's own, a few at a time.
   */
  private updateFlares() {
    if (this.engagement.rules.night) {
      this.flares = this.flares.filter((f) => this.time - f.burst < 40);
      this.frontFlares = this.frontFlares.filter((f) => this.time - f.burst < 40);
      return;
    }
    if (this.side.appearance !== "night") {
      this.flares = [];
      return;
    }
    this.flares = this.flares.filter((f) => this.time - f.burst < 42);
    const wanted = this.flares.length < 2 ? 1 : this.flares.length < 3 ? 0.012 : 0;
    if (this.random() < wanted) {
      const ahead = this.cameraX + (this.random() - 0.3) * this.viewMetres;
      const burst = this.time < 1 ? this.time - 4 - this.random() * 14 : this.time;
      this.flares.push({ x: ahead, z: 0, burst, altitude: 650 + this.random() * 300, seed: this.random() });
    }
  }

  private flareLights() {
    return this.flares.map((f) => flareAt(f, this.time, this.sideFx.wind.x * 0.5)).filter((f) => f.burning);
  }

  /** How brightly star shells light the ground at world x (0–1). */
  private flareLightAt(x: number, flares: { x: number; intensity: number }[]) {
    let lit = 0;
    for (const f of flares) lit += f.intensity * Math.exp(-(((x - f.x) / 480) ** 2));
    return Math.min(1, lit + (this.moonlit ? 0.22 : 0));
  }

  private drawSide() {
    const v = this.side;
    const scale = v.width / this.viewMetres;
    const night = v.appearance === "night";
    const flares = night ? this.flareLights() : [];
    const lights: SceneLight[] = [...this.sideFx.lights, ...flares.map((f) => ({ x: f.x, y: f.y, z: 0, radius: 700, color: [235, 240, 255] as [number, number, number], intensity: f.intensity })), ...(this.moonlit ? [MOONLIGHT] : [])];
    this.sideFx.magnify = (v.height * this.burstMetre) / scale;
    const era = this.options.era;
    const underFire = this.burst?.near && this.time - this.burst.at < 6;
    v.draw({
      time: this.time,
      cameraX: this.cameraX,
      scale,
      fx: this.sideFx,
      lights,
      overlay: (ctx) => drawBurstWash(ctx, v, this.burst, this.time),
      actors: (ctx) => {
        if (this.moonlit) this.drawMoon(ctx);
        this.drawTargets(ctx, flares);
        if (!underFire) this.drawGun(ctx);
        this.drawFlight(ctx);
        this.drawIncoming(ctx);
        for (const f of flares) era.drawFlare(ctx, v.screenX(f.x), v.skyY(f.x, f.y), v.height * 0.0045, f.intensity, v.height * 0.12);
      },
      // Bursts close behind the gun: it stands in front of them, black against the fire, lit by it at night.
      foreground: underFire ? (ctx) => this.drawGun(ctx) : undefined,
    });
  }

  private drawGun(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    const gx = this.gunX();
    const recoil = Math.max(0, 1 - (this.time - this.recoilAt) * 2.5);
    const m = this.move;
    const limbered = m ? clamp((this.moveAge(m) - 1.0) / 0.4) * (1 - clamp((this.moveAge(m) - 4.2) / 0.4)) : 0;
    const elevation = this.shownElevation * (1 - limbered);
    const crew = this.time - this.ducking < 4.5 ? "ducking" : "serving";
    ctx.save();
    if (this.gunHit >= 0) {
      ctx.translate(v.screenX(gx), v.groundY(gx));
      ctx.rotate(-0.3 * smoothstep(0, 0.4, this.time - this.gunHit));
      ctx.translate(-v.screenX(gx), -v.groundY(gx));
    }
    const b = this.burst;
    const age = b ? this.time - b.at : 99;
    const strength = b && b.near && age < 3 ? Math.exp(-age * 0.9) * (v.appearance === "night" ? 1 : 0.35) : 0;
    const glare = { x: b ? v.screenX(b.x) : 0, y: b ? v.groundY(b.x) - v.height * 0.07 : 0, strength, color: [255, 176, 100] as [number, number, number] };
    drawGunInGlare(ctx, v, this.options.era, gx, { elevation, recoil, crew }, glare, this.wheelShare);
    if (m) this.drawTeam(ctx, m);
    ctx.restore();
  }

  /** The horses and limber: up from the left, hooked to the trail, hauling, then away again. */
  private drawTeam(ctx: CanvasRenderingContext2D, m: { from: number; by: number; start: number }) {
    const v = this.side;
    const t = this.moveAge(m);
    const at = gunPlacement(v, this.gunX(), this.wheelShare);
    const hook = { x: at.x - at.wheel * 2.3, y: at.y };
    // Coming up from off the screen, standing while the gun is hooked on, then away once it is unhooked.
    const arrive = 1 - smoothstep(0, 1.0, t);
    const leave = smoothstep(4.4, 5.2, t);
    const offset = -(arrive + leave) * v.width * 0.5;
    const moving = t < 1.0 || (t > 1.4 && t < 4.0) || t > 4.4;
    const step = moving ? (this.time * 1.6) % 1 : 0.25;
    this.options.era.field.drawTeam(ctx, hook.x + offset, hook.y, at.wheel, { step, wheelTurn: this.time * (moving ? 3 : 0) }, v.appearance);
  }

  private drawTargets(ctx: CanvasRenderingContext2D, flares: { x: number; intensity: number }[]) {
    const v = this.side;
    const era = this.options.era;
    const size = v.height * 0.05;
    const time = this.gameTime();
    for (const [i, target] of this.engagement.targets.entries()) {
      if (i > this.engagement.index && this.looks[i].state === "intact") continue;
      const at = targetAt(this.engagement, time, i);
      const sx = v.screenX(at.x);
      if (sx < -600 || sx > v.width + 600) continue;
      if (target.kind === "bridge") this.drawCrossing(ctx, at.x, i, flares);
      else era.drawTargetSide(ctx, this.looks[i], sx, v.groundY(at.x), size, v.appearance, this.time);
      if (i === this.engagement.index && this.looks[i].state !== "destroyed") this.drawMarker(ctx, sx, v.groundY(at.x) - size * (target.kind === "bridge" ? 2.4 : 1.9));
    }
  }

  /** The river, its bridge from rim to rim, and the column on its way to it. */
  private drawCrossing(ctx: CanvasRenderingContext2D, x: number, index: number, flares: { x: number; intensity: number }[]) {
    const v = this.side;
    const era = this.options.era;
    const water = this.engagement.rules.terrain.water?.[0];
    const river = water ?? { from: x - 70, to: x + 70, level: 1 };
    const deck = Math.max(heightAt(this.engagement.rules.terrain, x - BRIDGE_HALF), heightAt(this.engagement.rules.terrain, x + BRIDGE_HALF)) + 3;
    const surface = v.heightY(river.level + 1);
    const lights = flares.map((f) => ({ x: v.screenX(f.x), intensity: f.intensity }));
    era.field.drawRiver(ctx, { left: v.screenX(river.from - 60), right: v.screenX(river.to + 60), surface, bed: surface + v.height * 0.028, bankY: (sx) => v.groundY(v.cameraX + (sx - v.width / 2) / v.scale), lights, time: this.time, moonlit: this.moonlit }, v.appearance);
    const footY = (sx: number) => {
      const wx = v.cameraX + (sx - v.width / 2) / v.scale;
      return Math.max(v.groundY(wx), surface) + 6;
    };
    era.field.drawBridge(ctx, { x0: v.screenX(x - BRIDGE_HALF), x1: v.screenX(x + BRIDGE_HALF), deckY: v.heightY(deck), footY, scale: v.height, light: this.flareLightAt(x, flares), state: this.looks[index].state }, v.appearance);
    const deadline = this.engagement.rules.deadline;
    if (deadline === null) return;
    // The column: its head reaches the far end of the bridge when time runs out; a fallen bridge stops it.
    const head = x + BRIDGE_HALF + Math.max(0, deadline - this.gameTime()) * COLUMN.speed + (this.looks[index].state === "destroyed" ? 120 : 0);
    for (let k = 0; k < COLUMN.lorries; k++) {
      const lx = head + 30 + k * COLUMN.spacing;
      const road = Math.min(v.groundY(lx), v.heightY(deck) - v.height * 0.007);
      era.field.drawLorry(ctx, v.screenX(lx), road, v.height * 0.0098, -1, v.appearance, this.flareLightAt(lx, flares), false);
    }
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
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

  private drawFlight(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    const f = this.flight;
    const fading = this.fadingTrail;
    const shot = f?.shot ?? fading?.shot;
    if (!shot) return;
    const progress = f ? clamp((this.time - f.started) / f.duration) : 1;
    const fade = fading ? 1 - clamp((this.time - fading.endedAt) / 2.5) : 1;
    if (fade <= 0) return;
    const muzzle = drawnMuzzle(v, this.options.era, shot.gunX, shot.aim.elevation, this.wheelShare);
    ctx.save();
    ctx.globalAlpha = fade;
    drawFieldArc(ctx, v, this.options.era, shot.flight, progress * shot.flight.time, { x: shot.gunX, facing: 1, muzzle });
    ctx.restore();
  }

  /** The enemy's round in its last second, screaming down from their side of the line. */
  private drawIncoming(ctx: CanvasRenderingContext2D) {
    const step = this.steps[0];
    if (step?.kind !== "enemy") return;
    const k = (this.time - this.stepStart) / 0.75;
    if (k < 0 || k >= 1) return;
    const v = this.side;
    const round = step.round;
    const from = { x: round.x + 900, y: heightAt(this.engagement.rules.terrain, round.x) + 650 };
    const to = { x: round.x, y: heightAt(this.engagement.rules.terrain, round.x) };
    const at = (s: number) => ({ x: v.screenX(from.x + (to.x - from.x) * s), y: v.heightY(from.y + (to.y - from.y) * s * s) });
    const points = [0, 0.25, 0.5, 0.75, 1].map((s) => at(Math.max(0, k - 0.5 + s * 0.5)));
    const head = at(k);
    const ahead = at(Math.min(1, k + 0.05));
    this.options.era.drawTrail(ctx, points, v.appearance, v.height * 0.0028);
    this.options.era.drawShell(ctx, head.x, head.y, Math.atan2(ahead.y - head.y, ahead.x - head.x), v.height * 0.022, v.appearance);
  }

  private drawMoon(ctx: CanvasRenderingContext2D) {
    const v = this.side;
    // Clear of the observer's glasses in the top corner.
    const x = v.width * 0.6;
    const y = v.height * 0.16;
    const r = v.height * 0.024;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 12);
    halo.addColorStop(0, "rgb(176 192 220 / 0.28)");
    halo.addColorStop(0.35, "rgb(130 150 190 / 0.08)");
    halo.addColorStop(1, "rgb(120 140 180 / 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 12, y - r * 12, r * 24, r * 24);
    ctx.restore();
    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    disc.addColorStop(0, "rgb(240 240 236)");
    disc.addColorStop(1, "rgb(214 218 224)");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFront() {
    const v = this.front;
    const era = this.options.era;
    const index = this.engagement.index;
    const target = this.engagement.targets[index];
    const moving = target.vx !== 0 || target.vz !== 0;
    const at = targetAt(this.engagement, this.gameTime(), index);
    if (!v.hasProps) v.setProps(moving ? [] : [era.targetProp(() => this.looks[index], at.z, at.x - this.observerX)]);
    const night = v.appearance === "night";
    const lights: SceneLight[] = [...this.frontFx.lights];
    const flares = night
      ? (this.engagement.rules.night ? this.frontFlares : this.flares.map((f) => ({ ...f, x: (f.seed - 0.5) * 500, z: at.x - this.observerX + 200 + f.seed * 300, altitude: 160 })))
          .map((f) => flareAt(f, this.time, 1.6))
          .filter((f) => f.burning)
      : [];
    for (const f of flares) lights.push({ x: f.x, y: f.y, z: f.z, radius: 330, color: [235, 240, 255], intensity: f.intensity });
    if (this.moonlit) lights.push({ x: 0, y: 0, z: at.x - this.observerX, radius: 4000, color: [200, 214, 240], intensity: 0.25 });
    v.draw({
      time: this.time,
      fx: this.frontFx,
      lights,
      actors: (ctx) => {
        if (moving) this.drawCrossingConvoy(ctx, at, this.looks[index].state === "destroyed");
        for (const f of flares) {
          const p = v.project(f.x, f.y, f.z);
          if (p) era.drawFlare(ctx, p.x, p.y, p.scale * 0.6, f.intensity, p.scale * 10);
        }
      },
      overlay: (ctx) => era.optic(ctx, v.width, v.height, v.appearance),
    });
  }

  /** A convoy on a road crossing the observer's view from one side to the other. */
  private drawCrossingConvoy(ctx: CanvasRenderingContext2D, at: { x: number; z: number }, wrecked: boolean) {
    const v = this.front;
    const era = this.options.era;
    const away = at.x - this.observerX;
    ctx.save();
    ctx.fillStyle = v.appearance === "night" ? "rgb(40 38 40 / 0.55)" : "rgb(120 100 76 / 0.45)";
    const left = v.project(-2000, 0, away - 4);
    const right = v.project(2000, 0, away - 4);
    const leftFar = v.project(-2000, 0, away + 4);
    const rightFar = v.project(2000, 0, away + 4);
    if (left && right && leftFar && rightFar) {
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(rightFar.x, rightFar.y);
      ctx.lineTo(leftFar.x, leftFar.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const target = this.engagement.targets[this.engagement.index];
    const heading = Math.sign(target.vz) || 1;
    for (let k = 2; k >= 0; k--) {
      const p = v.project(at.z - heading * (k - 1) * era.moverSpacing, 0, away);
      if (!p) continue;
      const lit = v.appearance === "night" && (this.frontFlares.length > 0 || this.flares.length > 0) ? "flare" : "ambient";
      era.drawMover(ctx, p.x, p.y, p.scale * 1.4, v.appearance, lit, wrecked && k === 1);
    }
  }
}
