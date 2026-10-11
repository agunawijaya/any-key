import { Crowd, type Mood } from "@/lib/sol-y-sombra/crowd";
import { afternoonSun, around, PLAZA, standsLit, sunPatch } from "@/lib/sol-y-sombra/plaza";
import { TICK } from "@/lib/sol-y-sombra/rig/choreography";
import { Procession } from "@/lib/sol-y-sombra/rig/procession";
import { Ring, type BeatRequest, type RingOptions } from "@/lib/sol-y-sombra/rig/ring";
import { addScaled, clamp, flat, flatDistance, headingDir, headingRight, smootherstep, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { Camera } from "../render/camera";
import { CREW_DRESS } from "../styles/poster/dress";
import type { Figure, RingFrame, RingStyle } from "../styles/style";
import { Director, type Framing } from "./director";

/*
 * The ring as the game shows it: the rig's ring, the crowd in the stands, a
 * director choosing the shots, and the style painting them. The game asks
 * for beats (a pass, a fall, the lap of honour) and waits for them to play
 * out; it sets the poster's lettering and how worked up the crowd is.
 *
 * Nothing here knows the rules. The corrida's engine decides; the stage acts
 * the decision out.
 */

/** Late afternoon: low enough for the stands' shadow to cut the sand roughly in half. */
const SUN = afternoonSun(-0.45, 0.4);
const PATCH = sunPatch(SUN);
const TITLE = "SOL Y SOMBRA";

/** Moments the stage notices as it plays, for the sound to follow. */
export type StageEvent =
  { kind: "hoof"; level: number } | { kind: "snort" } | { kind: "ole"; level: number } | { kind: "swish"; speed: number } | { kind: "thud" };

export type Lettering = {
  subtitle: string;
  /** The banner across the poster's foot: the pass being made. */
  ribbon: string | null;
};

export class CorridaStage {
  ring: Ring;
  crowd: Crowd;
  /** How full the stands are, 1 full. */
  private density: number;
  readonly camera = new Camera();
  framing: Framing = "ring";
  lettering: Lettering = { subtitle: "", ribbon: null };
  /** 0–1: how worked up the crowd is, from the meter. */
  excitement = 0.2;
  /** Slow the closest moment of each pass (a setting). */
  slowMotion = true;
  /** Reduced motion: the crowd keeps still. */
  stillCrowd = false;
  /** Carried out on shoulders: the last scene, played by its own little cast. */
  procession: Procession | null = null;
  private readonly director = new Director();
  private readonly style: RingStyle;
  private time = 0;
  private stamp: { text: string; at: number } | null = null;
  private risingSince: number | null = null;
  private waiters: { beat: number; resolve: () => void }[] = [];

  private showering = false;
  private showered = 0;
  /** Told of hoofbeats, the olé and the rest as they happen. */
  onEvent: ((event: StageEvent) => void) | null = null;
  private heard = { landings: 0, tick: 0, capeFast: false };

  constructor(style: RingStyle, options: RingOptions, density = 1) {
    this.style = style;
    this.ring = new Ring(options);
    this.density = density;
    this.crowd = new Crowd("sol-y-sombra/crowd", density);
  }

  /** Back to the game menu's ring: the matador alone with the bull, passing it over and over. */
  toMenu(options: RingOptions, density: number) {
    this.reset(options, density);
    this.framing = "menu";
    this.lettering = { subtitle: "The grand corrida · every afternoon, sun and shade", ribbon: null };
    this.excitement = 0.25;
  }

  /** A new afternoon: everyone at the great gate, the bull still in the pens. */
  toAfternoon(seed: string, density: number) {
    this.reset({ seed: `${seed}/ring`, crew: true, opening: "paseo", program: [], loop: false }, density);
    this.excitement = 0.2;
  }

  /** How the stage behaves for the player's settings. */
  configure(options: { slowMotion: boolean; stillCrowd: boolean }) {
    this.slowMotion = options.slowMotion;
    this.stillCrowd = options.stillCrowd;
  }

  /** How worked up the crowd is, 0 to 1. */
  warm(level: number) {
    this.excitement = clamp(level, 0, 1);
  }

  /** Which kind of shot the director takes: the beat's own, the crowd behind the matador, the menu's. */
  frame(framing: Framing) {
    this.framing = framing;
  }

  /** Whoever wants to hear the hoofbeats, the olé and the rest, or null. */
  listenWith(listener: ((event: StageEvent) => void) | null) {
    this.onEvent = listener;
  }

  /** The poster's lettering: the line under the title and the ribbon at the foot. */
  letter(subtitle: string, ribbon: string | null) {
    this.lettering = { subtitle, ribbon };
  }

  /** A fresh ring (and crowd) for a new afternoon. */
  reset(options: RingOptions, density = this.density) {
    this.ring = new Ring(options);
    this.density = density;
    this.crowd = new Crowd("sol-y-sombra/crowd", density);
    this.framing = "ring";
    this.showering = false;
    this.procession = null;
    this.stamp = null;
    this.risingSince = null;
    this.release();
  }

  get seconds() {
    return this.time;
  }

  /* ---------- Beats ---------- */

  /** Starts a beat now and resolves when it has played out (a held beat resolves at once). */
  play(beat: BeatRequest): Promise<void> {
    this.ring.request(beat);
    const number = this.ring.beatNumber;
    if (this.ring.beatOver) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ beat: number, resolve }));
  }

  /**
   * Skips to the end of the beat on now (the player pressed Space, or
   * reduced motion asks for short cuts): the ring runs on unseen, and the
   * next frame shows where everyone has got to.
   */
  cut(limit = 60) {
    const until = this.ring.beatNumber;
    for (let t = 0; t < limit && this.ring.beatNumber === until && !this.ring.beatOver; t += 1 / 30) this.advance(1 / 30, false);
  }

  /** Lets anything waiting on a beat go: the game is moving on. */
  release() {
    const waiting = this.waiters;
    this.waiters = [];
    for (const w of waiting) w.resolve();
  }

  /* ---------- The crowd ---------- */

  /** The crowd comes to its feet, a wave runs round, and flowers and hats rain onto the sand round `at`. */
  rise(at: Vec3 | null, flowers = 60) {
    this.risingSince = this.time;
    if (at && !this.stillCrowd) this.crowd.throwAt(at, flowers, 4.5);
  }

  settle() {
    this.risingSince = null;
    this.showering = false;
  }

  /** Flowers keep coming down round the matador wherever he walks (the lap of honour). */
  shower(on: boolean) {
    this.showering = on && !this.stillCrowd;
  }

  /**
   * Which way the matador should turn to salute: towards stands in the sun,
   * with the camera's place behind him clear of the bull.
   */
  saluteFacing(): number {
    const m = this.ring.matador.feet.finalCentre();
    const bull = this.ring.bullPresent ? flat(this.ring.bull.front) : null;
    let best = 0;
    let bestScore = -Infinity;
    for (let k = 0; k < 36; k++) {
      const h = (k * Math.PI) / 18;
      const dir = headingDir(h);
      const eye = addScaled(addScaled(m, dir, -5.6), headingRight(h), 1.6);
      // Where he looks, the stands: lit ones make the picture.
      const far = addScaled(m, dir, 30);
      let score = standsLit(Math.atan2(far.z, far.x), SUN) ? 3 : 0;
      if (Math.hypot(eye.x, eye.z) > PLAZA.ring - 1) score -= 10;
      if (bull) {
        // The bull must be well clear of the camera, and not lying across the picture between it and him.
        score += Math.min(8, flatDistance(eye, bull)) * 0.6;
        const t = Math.max(0, Math.min(1, ((bull.x - eye.x) * (m.x - eye.x) + (bull.z - eye.z) * (m.z - eye.z)) / Math.max(1e-6, flatDistance(eye, m) ** 2)));
        const sight = flatDistance(bull, { x: eye.x + (m.x - eye.x) * t, y: 0, z: eye.z + (m.z - eye.z) * t });
        if (sight < 3.2) score -= 8;
        if (flatDistance(eye, bull) < 5) score -= 6;
      }
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  }

  /** Carried out on shoulders: from the sand towards the great gate, the stands on their feet, flowers already down. */
  carryOut() {
    const gate = around(PLAZA.gateAzimuth, PLAZA.ring);
    this.procession = new Procession(around(PLAZA.gateAzimuth, PLAZA.ring - 9.5), gate);
    if (!this.stillCrowd) this.crowd.throwAt(around(PLAZA.gateAzimuth, PLAZA.ring - 7), 50, 6);
  }

  /** The matador's name stamped across the poster. */
  stampName(text: string | null) {
    this.stamp = text ? { text, at: this.time } : null;
  }

  private mood(): Mood {
    const ring = this.ring;
    const pass = ring.passing;
    // The olé: the stands lift as the horns go by.
    const near = pass && pass.passer === ring.matador ? Math.max(0, 1 - (Math.abs(ring.tick - pass.closestTick) * TICK) / 1.5) : 0;
    const rising = this.risingSince === null ? 0 : smootherstep(0.2, 1.8, this.time - this.risingSince);
    const since = this.risingSince === null ? 0 : this.time - this.risingSince;
    const warm = clamp(this.excitement, 0, 1);
    return {
      standing: Math.max(0.05 + 0.25 * warm + 0.22 * near, 0.15 + 0.8 * rising),
      arms: Math.max(0.03 + 0.12 * warm + 0.17 * near, 0.1 + 0.85 * rising),
      wave: rising > 0 ? -Math.PI / 2 - 1.6 + since * 0.9 : null,
      waving: near > 0.5 || rising > 0.4,
    };
  }

  /* ---------- Time and paint ---------- */

  advance(dt: number, slowable = true) {
    const slow = this.slowMotion && slowable ? this.ring.slowMotion() : 1;
    const step = dt * slow;
    const from = this.ring.tick;
    this.ring.advance(step);
    if (slowable) this.listen(from);
    this.procession?.advance(step);
    this.time += step;
    if (this.showering) {
      this.showered += step * 4;
      if (this.showered >= 1) {
        const n = Math.floor(this.showered);
        this.showered -= n;
        this.crowd.throwAt(this.ring.matador.feet.centre(), n, 3);
      }
    }
    if (!this.stillCrowd) this.crowd.update(step, this.procession ? { standing: 0.95, arms: 0.9, wave: null, waving: true } : this.mood());
    if (this.waiters.length) {
      // A beat is over when it has played out, or when another has taken its place.
      const done = this.waiters.filter((w) => w.beat < this.ring.beatNumber || (w.beat === this.ring.beatNumber && this.ring.beatOver));
      this.waiters = this.waiters.filter((w) => !done.includes(w));
      for (const w of done) w.resolve();
    }
  }

  /** What happened in the ticks just played, told to whoever listens (skipped ahead, nothing is heard). */
  private listen(from: number) {
    const tell = this.onEvent;
    const ring = this.ring;
    const bull = ring.bull;
    if (!tell) {
      this.heard.landings = bull.landings;
      return;
    }
    const to = ring.tick;
    const steps = bull.landings - this.heard.landings;
    this.heard.landings = bull.landings;
    if (steps > 0 && ring.bullPresent) {
      const speed = bull.currentSpeed;
      // A walk is soft, a charge drums.
      if (speed > 0.6) tell({ kind: "hoof", level: clamp(speed / 6, 0.15, 1) });
    }
    const pass = ring.passing;
    if (pass) {
      const start = pass.startTick;
      const at = (k: number) => from < start + k && start + k <= to;
      if (pass.pass.paw && at(pass.pass.chargeTick - Math.round(0.6 / TICK))) tell({ kind: "snort" });
      if (pass.passer === ring.matador && pass.pass.outcome !== "gored" && pass.pass.outcome !== "rests" && at(pass.closestTick - start)) {
        tell({ kind: "ole", level: pass.pass.outcome === "close" ? 1 : 0.6 });
      }
      if (pass.pass.outcome === "gored" && at(pass.pass.contactTick + Math.round(0.9 / TICK))) tell({ kind: "thud" });
    }
    // The matador's cape whipping through the air.
    const { pos, prev, count } = ring.matador.cape;
    let fastest = 0;
    for (let i = 0; i < count * 3; i += 9) fastest = Math.max(fastest, Math.hypot(pos[i] - prev[i], pos[i + 1] - prev[i + 1], pos[i + 2] - prev[i + 2]) / TICK);
    const fast = fastest > 6;
    if (fast && !this.heard.capeFast) tell({ kind: "swish", speed: fastest });
    this.heard.capeFast = fastest > 4.5 && (fast || this.heard.capeFast);
  }

  resize(width: number, height: number, dpr: number) {
    this.style.resize(width, height, dpr);
  }

  paint(dark: boolean) {
    this.style.paint(this.procession ? this.processionScene() : this.ringScene(), this.camera, dark);
  }

  private ringScene(): RingFrame {
    const ring = this.ring;
    this.director.frame(ring, this.camera, this.framing);
    const figures: Figure[] = ring.people.map((person, i) => ({
      skeleton: person.skeleton,
      strands: [...person.tassels.map((c) => c.points), ...person.fringes.map((c) => c.points)],
      holds: { left: person.grip.leftHold, right: person.grip.rightHold },
      dress: i === 0 ? undefined : CREW_DRESS[i - 1],
    }));
    const pass = ring.passing;
    const near = pass && pass.passer === ring.matador && Math.abs(ring.tick - pass.closestTick) * TICK < 0.9;
    return {
      figures,
      bull: ring.bullPresent ? ring.bullPose : null,
      capes: ring.people.map((p) => p.cape),
      dust: ring.dust,
      crowd: this.crowd,
      thrown: this.crowd.thrown,
      sun: SUN,
      patch: PATCH,
      text: {
        title: TITLE,
        subtitle: this.lettering.subtitle,
        ribbon: this.lettering.ribbon,
        stamp: this.stamp ? { text: this.stamp.text, t: this.time - this.stamp.at } : null,
      },
      breakout: !!near && this.framing === "ring",
      gateGlow: 0,
      torilOpen:
        (ring.beatKind === "bull-enters" || ring.beatKind === "bull-leaves") && flatDistance(ring.bull.front, around(PLAZA.torilAzimuth, PLAZA.ring)) < 6,
      time: this.time,
    };
  }

  /** Carried out on shoulders, through the great gate into the evening. */
  private processionScene(): RingFrame {
    const procession = this.procession!;
    const c = procession.centre();
    const gate = procession.gate;
    const toGate = { x: gate.x - c.x, z: gate.z - c.z };
    const length = Math.hypot(toGate.x, toGate.z) || 1;
    const dir = { x: toGate.x / length, y: 0, z: toGate.z / length };
    const side = { x: -dir.z, y: 0, z: dir.x };
    this.camera.look(
      { x: c.x - dir.x * 7.8 + side.x * 0.5, y: 1.9, z: c.z - dir.z * 7.8 + side.z * 0.5 },
      { x: gate.x + dir.x * 2.2, y: 2.4, z: gate.z + dir.z * 2.2 },
      0.6,
    );
    const figures: Figure[] = procession.walkers.map((w, i) => ({
      skeleton: w.performer.skeleton,
      strands: [],
      holds: { left: 0, right: 0 },
      dress: CREW_DRESS[i],
      hat: false,
    }));
    figures.push({ skeleton: procession.hero, strands: [], holds: { left: 0, right: 0 } });
    const evening = afternoonSun(PLAZA.gateAzimuth + Math.PI + 0.35, 0.24);
    return {
      sky: { top: "#e9946a", low: "#f7dcaa" },
      figures,
      bull: null,
      capes: [],
      dust: null,
      crowd: this.crowd,
      thrown: this.crowd.thrown,
      sun: evening,
      patch: sunPatch(evening),
      text: {
        title: TITLE,
        subtitle: this.lettering.subtitle,
        ribbon: this.lettering.ribbon,
        stamp: this.stamp ? { text: this.stamp.text, t: this.time - this.stamp.at } : null,
      },
      breakout: false,
      gateGlow: 1,
      time: this.time,
    };
  }
}
