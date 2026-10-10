/*
 * Moves seeds through a move: lifting a pit's seeds into a loose cluster in
 * the air, sending them one by one along arcs into the holes they are sown
 * into, and pouring a captured pit into a store. While a seed is carried the
 * choreography owns its position; when it reaches its hole it is handed back
 * to the physics with the velocity of its fall, and bounces and settles.
 *
 * Time runs in fixed physics steps, so a scene replayed to the same moment
 * always looks the same (the hero frames rely on it).
 */

import { BOARD, HOLLOWS, holeTop } from "./layout";
import { add, lerp3, normalize, quatFromAxisAngle, quatMultiply, quatNormalize, scale, sub, type Vec3 } from "./math";
import { STEP, stepSeeds, wakeHole, type Impact, type Seed } from "./seeds";

type Carry =
  /** Lifted into a cluster: `offset` set means the cluster follows the player's pointer (`anchor`). */
  | { kind: "lift"; from: Vec3; slot: Vec3; start: number; duration: number; offset?: Vec3 }
  | { kind: "flight"; from: Vec3; to: Vec3; start: number; duration: number; apex: number; axis: Vec3; rate: number };

export type Tempo = {
  /** Seconds between two seeds leaving the cluster while sowing. */
  interval: number;
  /** Seconds for the lift before the first seed leaves. */
  lift: number;
  /** Multiplies every flight's duration. */
  flight: number;
};

/** A flight as it was made, kept for a moment after landing so its arc can be drawn fading. */
export type FlightRecord = { from: Vec3; to: Vec3; apex: number; start: number; duration: number; hole: number; capture: boolean };

export const NORMAL_TEMPO: Tempo = { interval: 0.18, lift: 0.5, flight: 1 };

type Scheduled = { at: number; run: () => void };

/** A point on an arc: straight across, lifted by a parabola, the way a thrown seed flies. */
function arcPoint(from: Vec3, to: Vec3, apex: number, t: number): Vec3 {
  const p = lerp3(from, to, t);
  return [p[0], p[1] + 4 * apex * t * (1 - t), p[2]];
}

/** How long a sown seed takes to cross `distance` centimetres. */
const flightDuration = (distance: number) => 0.46 + distance * 0.0075;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Where a seed enters a hole: a little above the opening, off-centre by a hash of its id. */
function entryPoint(hole: number, id: number, spread: number): Vec3 {
  const h = HOLLOWS[hole];
  const angle = id * 2.399963;
  const reach = spread * (0.25 + ((id * 0.6180339) % 1) * 0.55);
  return [h.cx + Math.cos(angle) * reach * h.ax, BOARD.top + 1.6, h.cz + Math.sin(angle) * reach * h.az];
}

/** Slots in the air above a pit for a lifted cluster: a loose, slightly domed swirl, wider than it is tall. */
function clusterSlots(hole: number, count: number, height: number): Vec3[] {
  const top = holeTop(hole);
  return Array.from({ length: count }, (_, i) => {
    const r = 1.3 * Math.sqrt(i + 0.5);
    const a = i * 2.399963;
    return [top[0] + Math.cos(a) * r, top[1] + height + Math.max(0, 2.2 - r) * 0.35, top[2] + Math.sin(a) * r * 0.9] as Vec3;
  });
}

export class Choreographer {
  time = 0;
  private queue: Scheduled[] = [];
  private carries = new Map<Seed, Carry>();
  /** Recent flights, newest last; old ones are dropped once their arcs have faded. */
  flights: FlightRecord[] = [];
  /** Seeds counted in each hole, as the labels show them: a seed counts when it lands. */
  counts: number[];
  /** Where a carried cluster hangs while the player drags it. */
  private anchor: Vec3 | null = null;
  private held: Seed[] = [];
  impacts: Impact[] = [];
  onLand?: (seed: Seed, hole: number) => void;

  constructor(public seeds: Seed[]) {
    this.counts = Array.from({ length: 14 }, (_, hole) => seeds.filter((s) => s.hole === hole).length);
  }

  at(time: number, run: () => void) {
    this.queue.push({ at: time, run });
    this.queue.sort((a, b) => a.at - b.at);
  }

  get busy() {
    return this.carries.size > 0 || this.queue.length > 0;
  }

  seedsIn(hole: number) {
    return this.seeds.filter((s) => s.hole === hole && !s.carried);
  }

  /** Lifts seeds out of their hole into a cluster hovering above it. */
  lift(seeds: Seed[], hole: number, start: number, height = 3.6, duration = 0.45) {
    const slots = clusterSlots(hole, seeds.length, height);
    seeds.forEach((seed, i) => {
      this.carries.set(seed, { kind: "lift", from: seed.pos, slot: slots[i], start: start + i * 0.018, duration });
      seed.carried = true;
      seed.asleep = false;
    });
    this.counts[hole] -= seeds.length;
    wakeHole(this.seeds, hole);
  }

  /* ---------- Carrying a pit's seeds by hand ---------- */

  /** Picks up every seed in a pit into a cluster that follows `moveCarry`. */
  pickUp(hole: number) {
    const seeds = this.seedsIn(hole);
    const top = holeTop(hole);
    this.anchor = [top[0], top[1] + 5.2, top[2]];
    this.lift(seeds, hole, this.time, 5.2, 0.32);
    for (const seed of seeds) {
      const carry = this.carries.get(seed);
      if (carry?.kind === "lift") carry.offset = sub(carry.slot, this.anchor);
    }
    this.held = seeds;
    return seeds.length;
  }

  moveCarry(anchor: Vec3) {
    if (this.held.length) this.anchor = anchor;
  }

  /** Lets one seed of the carried cluster drop into a hole. */
  dropOne(hole: number) {
    const anchor = this.anchor;
    const waiting = this.held.filter((s) => this.carries.get(s)?.kind === "lift");
    if (!waiting.length || !anchor) return false;
    const target = holeTop(hole);
    waiting.sort((a, b) => Math.hypot(a.pos[0] - target[0], a.pos[2] - target[2]) - Math.hypot(b.pos[0] - target[0], b.pos[2] - target[2]));
    this.fly(waiting[0], hole, this.time, { apex: 1.5, duration: 0.3 });
    this.held = this.held.filter((s) => s !== waiting[0]);
    return true;
  }

  /** Sows what is still carried along the rest of the path, at the usual pace. Returns when the last lands. */
  sowRest(path: number[], tempo: Tempo = NORMAL_TEMPO) {
    let last = this.time;
    path.forEach((hole, k) => {
      const launch = this.time + 0.05 + k * tempo.interval;
      this.at(launch, () => {
        this.dropOne(hole);
      });
      last = launch + 0.45;
    });
    return last;
  }

  /** Puts a carried cluster back where it came from. */
  putBack(hole: number) {
    for (const seed of this.held) this.fly(seed, hole, this.time, { apex: 1.2, duration: 0.28 });
    this.held = [];
    this.anchor = null;
  }

  get carrying() {
    return this.held.length;
  }

  /**
   * Runs everything already scheduled to its end at once: for "skip" and for
   * reduced motion. A full Kalah sweep needs about ten seconds of scene time;
   * the limit only stops a seed that never comes to rest.
   */
  finish(maxSeconds = 30) {
    const end = this.time + maxSeconds;
    while ((this.busy || this.seeds.some((s) => !s.asleep && !s.carried)) && this.time < end) this.step();
  }

  /** Sends one seed along an arc into a hole. */
  fly(seed: Seed, hole: number, start: number, options: { apex?: number; duration?: number; spread?: number; capture?: boolean } = {}) {
    const from = seed.pos;
    const to = entryPoint(hole, seed.id, options.spread ?? 0.45);
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const apex = options.apex ?? 3.6 + distance * 0.2;
    const duration = options.duration ?? flightDuration(distance);
    const axis = normalize([to[2] - from[2] || 0.1, 0.3, -(to[0] - from[0])]);
    this.carries.set(seed, { kind: "flight", from, to, start, duration, apex, axis, rate: 9 + (seed.id % 5) });
    this.flights.push({ from, to, apex, start, duration, hole, capture: !!options.capture });
    this.flights = this.flights.filter((f) => start - (f.start + f.duration) < 2);
    seed.carried = true;
    seed.hole = hole;
  }

  /**
   * Sowing: the pit's seeds rise together, then leave one by one, each to the
   * next hole on the path. Returns the time the last seed lands.
   */
  sow(from: number, path: number[], start: number, tempo: Tempo = NORMAL_TEMPO) {
    const seeds = this.seedsIn(from).slice(0, path.length);
    this.lift(seeds, from, start, 5.2, tempo.lift * 0.9);
    let lastLanding = start;
    path.forEach((hole, k) => {
      const launch = start + tempo.lift + k * tempo.interval;
      this.at(launch, () => {
        // The seed nearest the hole it is going to goes first, so the cluster unwinds naturally.
        const target = holeTop(hole);
        const waiting = seeds.filter((s) => this.carries.get(s)?.kind === "lift");
        waiting.sort((a, b) => Math.hypot(a.pos[0] - target[0], a.pos[2] - target[2]) - Math.hypot(b.pos[0] - target[0], b.pos[2] - target[2]));
        if (waiting[0]) this.fly(waiting[0], hole, launch, { duration: undefined });
      });
      const target = holeTop(hole);
      const distance = Math.hypot(target[0] - holeTop(from)[0], target[2] - holeTop(from)[2]);
      lastLanding = Math.max(lastLanding, launch + flightDuration(distance) * tempo.flight + 0.08);
    });
    return lastLanding;
  }

  /** A capture: the pit's seeds lift together and pour, in a quick cascade, into the store. */
  capture(pits: number[], store: number, start: number) {
    const seeds = pits.flatMap((pit) => {
      const inPit = this.seedsIn(pit);
      if (inPit.length) this.lift(inPit, pit, start, 5.2, 0.42);
      return inPit;
    });
    seeds.forEach((seed, i) => {
      const launch = start + 0.55 + i * 0.065;
      this.at(launch, () => this.fly(seed, store, launch, { apex: 4.5 + i * 0.3, duration: 0.6 + i * 0.012, spread: 0.7, capture: true }));
    });
    return start + 0.55 + seeds.length * 0.065 + 0.7;
  }

  /** Runs the scene forward by `dt` seconds in fixed steps. */
  advance(dt: number) {
    const end = this.time + dt;
    while (this.time + STEP <= end + 1e-9) this.step();
  }

  /** Replays to an exact moment from the scene's current time. */
  advanceTo(time: number) {
    while (this.time + STEP <= time + 1e-9) this.step();
  }

  private step() {
    this.time += STEP;
    while (this.queue.length && this.queue[0].at <= this.time) this.queue.shift()!.run();
    for (const [seed, carry] of this.carries) this.moveCarried(seed, carry);
    stepSeeds(this.seeds, this.impacts);
  }

  private moveCarried(seed: Seed, carry: Carry) {
    const t = (this.time - carry.start) / carry.duration;
    if (carry.kind === "lift") {
      const k = easeOutCubic(Math.min(1, Math.max(0, t)));
      const bob = Math.sin(this.time * 3.1 + seed.id) * 0.12 * k;
      if (carry.offset && this.anchor) {
        // Following the pointer: ease toward the moving slot, so the cluster trails a little like a held handful.
        const target = add(this.anchor, carry.offset);
        const lifted = lerp3(carry.from, target, k);
        seed.pos = k < 1 ? add(lifted, [0, bob, 0]) : add(lerp3(seed.pos, target, 1 - Math.exp(-STEP * 16)), [0, bob * STEP * 4, 0]);
      } else seed.pos = add(lerp3(carry.from, carry.slot, k), [0, bob, 0]);
      const turn = quatFromAxisAngle([Math.sin(seed.id), 1, Math.cos(seed.id)], STEP * 0.9);
      seed.rotation = quatNormalize(quatMultiply(turn, seed.rotation));
      return;
    }
    if (t < 0) return;
    if (t >= 1) {
      // Hand the seed to the physics, falling the way the arc was carrying it.
      const T = carry.duration;
      const across = scale(sub(carry.to, carry.from), 1 / T);
      seed.pos = carry.to;
      seed.vel = [across[0] * 0.35, -(4 * carry.apex) / T - 20, across[2] * 0.35];
      seed.spin = scale(carry.axis, carry.rate * 0.3);
      seed.carried = false;
      seed.asleep = false;
      seed.quietFor = 0;
      this.carries.delete(seed);
      this.counts[seed.hole] += 1;
      wakeHole(this.seeds, seed.hole);
      this.onLand?.(seed, seed.hole);
      return;
    }
    seed.pos = arcPoint(carry.from, carry.to, carry.apex, t);
    seed.rotation = quatNormalize(quatMultiply(quatFromAxisAngle(carry.axis, carry.rate * STEP), seed.rotation));
  }

  /** Where a carried seed was a moment ago: for the faint trail behind a flying seed. */
  trailOf(seed: Seed, lag: number): Vec3 | null {
    const carry = this.carries.get(seed);
    if (!carry || carry.kind !== "flight") return null;
    const t = (this.time - lag - carry.start) / carry.duration;
    if (t <= 0 || t >= 1) return null;
    return arcPoint(carry.from, carry.to, carry.apex, t);
  }

  isFlying(seed: Seed) {
    return this.carries.get(seed)?.kind === "flight";
  }

  /** Every seed, those resting in the holes first and those in the air after. */
  ordered() {
    const resting = this.seeds.filter((s) => !s.carried);
    return { seeds: [...resting, ...this.seeds.filter((s) => s.carried)], resting: resting.length };
  }
}
