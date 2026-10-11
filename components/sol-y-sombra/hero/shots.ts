import { Crowd, type Mood } from "@/lib/sol-y-sombra/crowd";
import { afternoonSun, around, PLAZA, sunPatch } from "@/lib/sol-y-sombra/plaza";
import { Ring, type BeatRequest } from "@/lib/sol-y-sombra/rig/ring";
import { Procession } from "@/lib/sol-y-sombra/rig/procession";
import { distance, flat, sub } from "@/lib/sol-y-sombra/rig/vec";
import type { Camera } from "../render/camera";
import { CREW_DRESS } from "../styles/poster/dress";
import type { Figure, RingFrame } from "../styles/style";

/*
 * The hero frames: the three moments the art is judged by, played live by
 * the real rig and painted by the real style. Each shot builds its ring,
 * moves its crowd, places its camera and writes its poster's lettering.
 */

export type ShotState = { ring: Ring; crowd: Crowd; time: number };

export type Shot = {
  /** The moment the still is taken, in seconds. */
  still: number;
  /** How long the live version runs before starting again. */
  loop: number;
  create(): ShotState;
  advance(state: ShotState, dt: number): void;
  compose(state: ShotState, camera: Camera): RingFrame;
};

/** Late afternoon: low enough for the stands' shadow to cut the sand roughly in half. */
const SUN = afternoonSun(-0.45, 0.4);
const PATCH = sunPatch(SUN);
const TITLE = "SOL Y SOMBRA";

const figureOf = (ring: Ring): Figure => ({
  skeleton: ring.skeleton,
  strands: [...ring.tassels.map((c) => c.points), ...ring.fringes.map((c) => c.points)],
  holds: { left: ring.grip.leftHold, right: ring.grip.rightHold },
});

/* ---------- (a) The veronica at its closest ---------- */

const VERONICA: BeatRequest[] = [{ kind: "pass", pass: "veronica", side: -1, paw: true }];

let closestMoment: number | null = null;

/** When the horns come closest to the matador in the hero pass: found once by playing it through. */
function veronicaClosest() {
  if (closestMoment !== null) return closestMoment;
  const ring = new Ring({ program: VERONICA, loop: false });
  let best = Infinity;
  let at = 0;
  for (let t = 0; t < 12 * 240; t++) {
    ring.step();
    const d = distance(flat(ring.bullPose.poll), flat(ring.skeleton.pelvis));
    if (ring.time > 2 && d < best) {
      best = d;
      at = ring.time;
    }
  }
  closestMoment = at;
  return at;
}

export const veronicaShot: Shot = {
  get still() {
    return veronicaClosest() - 0.08;
  },
  loop: 11,
  create: () => ({ ring: new Ring({ program: VERONICA, loop: true }), crowd: new Crowd(), time: 0 }),
  advance(state, dt) {
    const slow = state.ring.slowMotion();
    state.ring.advance(dt * slow);
    state.time += dt * slow;
    const near = Math.max(0, 1 - Math.abs(state.ring.time - veronicaClosest()) / 1.5);
    const mood: Mood = { standing: 0.08 + 0.22 * near, arms: 0.03 + 0.17 * near, wave: null, waving: near > 0.5 };
    state.crowd.update(dt * slow, mood);
  },
  compose(state, camera) {
    // From the sand, a little below the horns: the bull runs past the matador and out of the frame.
    // From a little above, three-quarters on: the horns in the cape, the shadow line cutting across the sand behind.
    camera.look({ x: 4.5, y: 2.0, z: 6.3 }, { x: 0.35, y: 1.55, z: -0.7 }, 0.56);
    const near = Math.abs(state.ring.time - veronicaClosest()) < 0.9;
    return {
      figures: [figureOf(state.ring)],
      bull: state.ring.bullPose,
      capes: [state.ring.cape],
      dust: state.ring.dust,
      crowd: state.crowd,
      thrown: state.crowd.thrown,
      sun: SUN,
      patch: PATCH,
      text: { title: TITLE, subtitle: "The grand corrida · the first bull of the afternoon", ribbon: "VERONICA", stamp: null },
      breakout: near,
      gateGlow: 0,
      time: state.time,
    };
  },
};

/* ---------- (b) The crowd rises ---------- */

/** He salutes the stands in the sun, across the ring from where the light comes. */
const FACING_STANDS = -2.2;
/** For this shot the sun stands behind him, higher, so he and the stands he faces are both in its light. */
const CROWD_SUN = afternoonSun(-0.94, 0.5);
const CROWD_PATCH = sunPatch(CROWD_SUN);
// A veronica, a walk away from the bull with his back to it, then the salute to the stands.
const CROWD_PROGRAM: BeatRequest[] = [
  { kind: "pass", pass: "veronica", side: -1, paw: true },
  { kind: "walk-off", distance: 6 },
  { kind: "salute", seconds: 30, facing: FACING_STANDS },
];

/** When the salute begins in the crowd shot's program. */
let saluteMoment: number | null = null;
function saluteStart() {
  if (saluteMoment !== null) return saluteMoment;
  const ring = new Ring({ program: CROWD_PROGRAM, loop: false });
  while (ring.beatKind !== "salute" && ring.time < 30) ring.step();
  saluteMoment = ring.time;
  return saluteMoment;
}

export const crowdShot: Shot = {
  get still() {
    return saluteStart() + 3.1;
  },
  loop: 22,
  create: () => ({ ring: new Ring({ program: CROWD_PROGRAM, loop: false }), crowd: new Crowd(), time: 0 }),
  advance(state, dt) {
    state.ring.advance(dt);
    state.time += dt;
    const since = state.ring.time - saluteStart();
    const rising = Math.max(0, Math.min(1, (since - 0.3) / 1.6));
    const mood: Mood = {
      standing: 0.15 + 0.8 * rising,
      arms: 0.1 + 0.85 * rising,
      // A wave runs round the stands, through the part we can see.
      wave: since > 0 ? -Math.PI / 2 - 1.6 + since * 0.9 : null,
      waving: rising > 0.4,
    };
    state.crowd.update(dt, mood);
    // Flowers and hats rain down on the matador for a couple of seconds.
    if (since > 0.6 && since < 3.2) {
      const centre = state.ring.feet.centre();
      const perSecond = 40;
      const n = Math.floor(since * perSecond) - Math.floor((since - dt) * perSecond);
      if (n > 0) state.crowd.throwAt(centre, n, 4.5);
    }
  },
  compose(state, camera) {
    const m = state.ring.feet.centre();
    // Behind the matador and low, looking past his raised arms at the sunlit stands on their feet.
    const ahead = { x: Math.cos(FACING_STANDS), z: -Math.sin(FACING_STANDS) };
    const right = { x: Math.sin(FACING_STANDS), z: Math.cos(FACING_STANDS) };
    camera.look(
      { x: m.x - ahead.x * 5.6 + right.x * 1.6, y: 0.9, z: m.z - ahead.z * 5.6 + right.z * 1.6 },
      { x: m.x + ahead.x * 20, y: 5.2, z: m.z + ahead.z * 20 },
      0.92,
    );
    const since = state.ring.time - saluteStart();
    return {
      figures: [figureOf(state.ring)],
      bull: state.ring.bullPose,
      capes: [state.ring.cape],
      dust: state.ring.dust,
      crowd: state.crowd,
      thrown: state.crowd.thrown,
      sun: CROWD_SUN,
      patch: CROWD_PATCH,
      text: {
        title: TITLE,
        subtitle: "The crowd on its feet · flowers on the sand",
        ribbon: "THE CROWD RISES",
        stamp: since > 0.8 ? { text: "EL NOVATO", t: since - 0.8 } : null,
      },
      breakout: false,
      gateGlow: 0,
      time: state.time,
    };
  },
};

/* ---------- (c) Carried out on shoulders ---------- */

/** The gate's middle, where it meets the sand. */
const GATE = around(PLAZA.gateAzimuth, PLAZA.ring, 0);
/** Where the procession sets off, out on the sand. */
const PROCESSION_START = around(PLAZA.gateAzimuth, PLAZA.ring - 9.5, 0);
/** A low evening sun behind the camera, gilding the gate side. */
const EVENING_SUN = afternoonSun(PLAZA.gateAzimuth + Math.PI + 0.35, 0.24);
const EVENING_PATCH = sunPatch(EVENING_SUN);

type ProcessionState = ShotState & { procession: Procession };

export const shouldersShot: Shot = {
  still: 4.6,
  loop: 9,
  create() {
    const crowd = new Crowd();
    const state: ProcessionState = {
      ring: new Ring({ program: [{ kind: "wait", seconds: 60 }], loop: false }),
      crowd,
      time: 0,
      procession: new Procession(PROCESSION_START, GATE),
    };
    // The sand is already strewn with flowers and hats by the time he is carried out.
    crowd.throwAt(around(PLAZA.gateAzimuth, PLAZA.ring - 7, 0), 70, 6);
    crowd.update(3, { standing: 1, arms: 1, wave: null, waving: true });
    return state;
  },
  advance(state, dt) {
    const { procession } = state as ProcessionState;
    procession.advance(dt);
    state.time += dt;
    state.crowd.update(dt, { standing: 0.95, arms: 0.9, wave: null, waving: true });
  },
  compose(state, camera) {
    const { procession } = state as ProcessionState;
    const c = procession.centre();
    const toGate = sub(GATE, c);
    const dir = { x: toGate.x / Math.hypot(toGate.x, toGate.z), y: 0, z: toGate.z / Math.hypot(toGate.x, toGate.z) };
    // Behind and a little to one side of the procession, low, looking past them at the open gate.
    const side = { x: -dir.z, y: 0, z: dir.x };
    // Behind them, eye level with the riders' raised hands: the matador framed in the arch of light.
    camera.look(
      { x: c.x - dir.x * 7.8 + side.x * 0.5, y: 1.9, z: c.z - dir.z * 7.8 + side.z * 0.5 },
      { x: GATE.x + dir.x * 2.2, y: 2.4, z: GATE.z + dir.z * 2.2 },
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
    return {
      sky: { top: "#e9946a", low: "#f7dcaa" },
      figures,
      bull: null,
      capes: [],
      dust: null,
      crowd: state.crowd,
      thrown: state.crowd.thrown,
      sun: EVENING_SUN,
      patch: EVENING_PATCH,
      text: {
        title: TITLE,
        subtitle: "Through the great gate \u00b7 the end of a grand afternoon",
        ribbon: "ON THEIR SHOULDERS",
        stamp: null,
      },
      breakout: false,
      gateGlow: 1,
      time: state.time,
    };
  },
};

export const SHOTS: Record<string, Shot> = { veronica: veronicaShot, crowd: crowdShot, shoulders: shouldersShot };
