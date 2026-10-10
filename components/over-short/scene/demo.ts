import { createRng } from "@/lib/kit/rng";
import { fly, positionAt, type Flight } from "@/lib/over-short/models";
import type { Era } from "../eras/types";
import { flareAt, type StarShell } from "./effects";
import { BURST_METRE, GUN_SIZE, gunPlacement, muzzleInWorld } from "./gunline";
import { Particles, warmSprites, type SceneLight } from "./particles";
import { SideView, type Appearance } from "./side";

/*
 * The battlefield playing by itself, with no one at the controls: the gun
 * fires every few seconds, the camera rides the shell along its arc, the
 * round comes down in a fountain of earth, and the camera drifts home. It
 * makes no sound. The game menu runs it behind its panel, and the Hall runs
 * it in the game's card.
 */

const VIEW_METRES = 4200;
const GUN = { vacuumRange: 13600, drag: 0 };
const PAUSE = 2.4;

export class DemoLoop {
  readonly view: SideView;
  private fx: Particles;
  private random: () => number;
  private time = 0;
  private last = 0;
  private cameraX = VIEW_METRES * 0.3;
  private flight: { flight: Flight; started: number; landed: boolean } | null = null;
  private nextShot = 1.2;
  private recoilAt = -10;
  private elevation = 24;
  private flares: StarShell[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private era: Era,
    seed: number,
    /** Pixels of the view taken by the gun's wheel, as a share of its height (bigger in a small card). */
    private gunScale = GUN_SIZE,
  ) {
    this.view = new SideView(canvas, era.side);
    this.random = createRng(`over-short/demo/${seed}`).float;
    this.fx = new Particles(createRng(`over-short/demo-fx/${seed}`).float);
    this.fx.wind = { x: 2.2, z: 0.4 };
    warmSprites();
  }

  resize(width: number, height: number, dpr: number) {
    this.view.resize(width, height, dpr);
  }

  setAppearance(appearance: Appearance) {
    this.view.setAppearance(appearance);
  }

  frame(now: number) {
    if (this.view.width < 8 || this.view.height < 8) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.time += dt;
    this.fx.advance(dt);
    this.fire();
    this.drawFrame(dt);
  }

  /** Playback runs at about seven times real time, so a long flight lasts a few seconds. */
  private flightClock() {
    const f = this.flight;
    return f ? Math.min(f.flight.time, (this.time - f.started) * 7) : 0;
  }

  private fire() {
    const f = this.flight;
    if (f && !f.landed && this.flightClock() >= f.flight.time) {
      f.landed = true;
      this.era.effects.explosion(this.fx, { x: f.flight.landed, z: 0 }, 1);
      this.nextShot = this.time + PAUSE + 1.5;
    }
    if (this.time < this.nextShot || (f && !f.landed)) return;
    this.elevation = 12 + this.random() * 26;
    this.flight = { flight: fly("vacuum", GUN, this.elevation, { distance: 10000, height: 0 }), started: this.time, landed: false };
    this.recoilAt = this.time;
    const muzzle = muzzleInWorld(this.view, this.era, 0, this.elevation, this.gunScale);
    this.era.effects.muzzle(this.fx, { x: muzzle.x, z: 0, y: muzzle.y }, (this.elevation * Math.PI) / 180, 0.8);
    this.nextShot = Infinity;
  }

  private drawFrame(dt: number) {
    const v = this.view;
    const f = this.flight;
    const clock = this.flightClock();
    const shell = f ? positionAt(f.flight, clock) : null;
    const target = f && !f.landed && shell ? Math.max(VIEW_METRES * 0.3, shell.x + VIEW_METRES * 0.1) : f?.landed && this.time < this.nextShot - PAUSE ? f.flight.landed : VIEW_METRES * 0.3;
    this.cameraX += (target - this.cameraX) * Math.min(1, dt * (f && !f.landed ? 9 : 1.8));
    const night = v.appearance === "night";
    const lights: SceneLight[] = [...this.fx.lights];
    if (night) {
      if (this.flares.length < 2 && this.random() < 0.012) this.flares.push({ x: this.cameraX + (this.random() - 0.3) * VIEW_METRES, z: 0, burst: this.time, altitude: 700, seed: this.random() });
      this.flares = this.flares.filter((s) => this.time - s.burst < 42);
    }
    const flares = night ? this.flares.map((s) => flareAt(s, this.time, 2)).filter((s) => s.burning) : [];
    for (const s of flares) lights.push({ x: s.x, y: s.y, z: 0, radius: 700, color: [235, 240, 255], intensity: s.intensity });
    const apex = f ? Math.max(400, f.flight.apex) : 1800;
    // Bursts and smoke are drawn as much larger than life as the gun is (see Particles.magnify).
    this.fx.magnify = (v.height * BURST_METRE) / (v.width / VIEW_METRES);
    v.draw({
      time: this.time,
      cameraX: this.cameraX,
      scale: v.width / VIEW_METRES,
      apex,
      fx: this.fx,
      lights,
      actors: (ctx) => {
        const gun = gunPlacement(v, 0, this.gunScale);
        const wheel = gun.wheel;
        const recoil = Math.max(0, 1 - (this.time - this.recoilAt) * 2.5);
        this.era.drawGun(ctx, gun.x, gun.y, wheel, { elevation: this.elevation, recoil }, v.appearance);
        if (f && !f.landed && shell) {
          const flight = f.flight;
          const base = (x: number) => v.groundY(0) - wheel * 1.1 * (1 - x / flight.landed) + (v.groundY(flight.landed) - v.groundY(0)) * (x / flight.landed);
          const toScreen = (x: number, y: number) => ({ x: v.screenX(x), y: v.altitudeY(base(x), y, apex) });
          const points = flight.path.filter((p) => p.t <= clock).map((p) => toScreen(p.x, p.y));
          const head = toScreen(shell.x, shell.y);
          points.push(head);
          this.era.drawTrail(ctx, points, v.appearance, v.height * 0.0032);
          const ahead = positionAt(flight, clock + 0.3);
          const next = toScreen(ahead.x, ahead.y);
          this.era.drawShell(ctx, head.x, head.y, Math.atan2(next.y - head.y, next.x - head.x), v.height * 0.022, v.appearance);
        }
        for (const s of flares) this.era.drawFlare(ctx, v.screenX(s.x), v.skyY(s.x, s.y), v.height * 0.0045, s.intensity, v.height * 0.12);
      },
    });
  }
}
