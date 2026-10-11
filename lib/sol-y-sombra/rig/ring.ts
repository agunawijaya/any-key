import { createRng } from "@/lib/kit/rng";
import { around, PLAZA } from "../plaza";
import { Bow, Down, Rise, Route, Salute, Supported, Supporting, Walk, Watching, type HelpPlan } from "./acts";
import { Bull, type BullPose } from "./bull";
import { BullLying, BullRising, BullRun, BullWatching, type BullAct } from "./bullActs";
import { Pass, TICK, type PassKind, type PassOptions, type PassOutcome } from "./choreography";
import type { Collider } from "./cloth";
import { Dust } from "./dust";
import type { Intent, Skeleton } from "./human";
import { Torero, type Act, type ActInput } from "./torero";
import { add, addScaled, bump, clamp, distance, dot, flat, flatDistance, headingDir, headingOf, headingRight, normalize, sub, type Vec3 } from "./vec";

/*
 * The ring: the matador, the two men of his crew, one bull, the capes, and
 * the dust between them, stepped 240 times a second. A queue of beats (a
 * pass, a fall, a lap of honour) says what happens next; each beat hands
 * acts to the people and to the bull, and every tick the acts cue the rigs,
 * the rigs solve their bodies, and the cloth and the dust follow.
 *
 * The ring knows nothing about drawing. A style reads its state (the
 * skeletons, the bull's pose, the capes' particles, the dust) and paints it.
 */

export type BeatRequest =
  /** A pass by the matador, or (`by` 1 or 2) by one of his crew. */
  | { kind: "pass"; pass: PassKind; side: 1 | -1; paw?: boolean; outcome?: PassOutcome; by?: number }
  | { kind: "wait"; seconds: number }
  | { kind: "walk-off"; distance: number }
  /** Walk to a fair distance from the bull, facing it, ready for the next pass. */
  | { kind: "site"; distance?: number }
  /** Turn to the stands and raise both arms, the cape held high in one hand. */
  | { kind: "salute"; seconds: number; facing: number }
  | { kind: "bow"; facing: number; seconds?: number }
  /** Sitting on the sand after a goring, while the crew draw the bull away; held until the next request. */
  | { kind: "down"; seconds?: number }
  | { kind: "rise" }
  | { kind: "helped-off"; serious: boolean }
  /** Walking off to the barrier, the cape over his arm: the afternoon is over. */
  | { kind: "leave" }
  | { kind: "lap" }
  | { kind: "paseo" }
  | { kind: "bull-enters" }
  | { kind: "crew-work" }
  | { kind: "bull-leaves" };

type Beat = { kind: BeatRequest["kind"]; untilTick: number; pass: PassAct | null };

export type RingOptions = {
  seed?: string;
  /** Beats to play, in order; `loop` starts again from the first when they run out. */
  program?: BeatRequest[];
  loop?: boolean;
  /** Asked for the next beat when the program has run out, so a beat can be worked out from the ring as it is then. */
  supply?: (ring: Ring) => BeatRequest | undefined;
  wind?: Vec3;
  /** Two men of the crew in the ring too. The lab and the hero frames have the matador alone. */
  crew?: boolean;
  /** "centre": matador and bull face to face mid-ring. "paseo": everyone at the great gate, the bull still in the pens. */
  opening?: "centre" | "paseo";
};

/** Holds a beat until something else is asked for. */
const HOLD = Number.MAX_SAFE_INTEGER;

/** How far in from the barrier the crew wait and the laps are walked. */
const POST_RADIUS = 16.5;
const LAP_RADIUS = 16.2;

/** A pass: one person's act and the bull's at once. */
export class PassAct implements Act, BullAct {
  readonly until: number;
  /** The tick the horns come closest to the passer's middle. */
  readonly closestTick: number;

  constructor(
    readonly pass: Pass,
    readonly startTick: number,
    readonly passer: Torero,
  ) {
    this.until = (startTick + pass.lengthTicks) * TICK;
    let closest = Infinity;
    let at = 0;
    const middle = pass.centrePoint();
    for (let k = pass.chargeTick; k < pass.track.stopTick; k++) {
      const d = distance(flat(pass.plannedHead(k)), middle);
      if (d < closest) {
        closest = d;
        at = k;
      }
    }
    this.closestTick = startTick + at;
  }

  private k(time: number) {
    return Math.round(time / TICK) - this.startTick;
  }

  intent(input: ActInput) {
    return this.pass.intent(this.k(input.time), input.centre, input.bullHead);
  }

  grip(input: ActInput) {
    return this.pass.grip(this.k(input.time));
  }

  cue(time: number) {
    return this.pass.bullCue(this.k(time), this.passer.capeCentre(), this.passer.skeleton.head);
  }
}

export class Ring {
  time = 0;
  tick = 0;
  readonly bull: Bull;
  readonly people: Torero[];
  readonly dust: Dust;
  wind: Vec3;
  /** Whether the bull is in the ring: not before it comes out of the pens, nor after it goes back. */
  bullPresent: boolean;
  /** The matador's pass on now, for the lab and the camera. */
  current: Pass | null = null;
  /** Counts the beats begun, so a watcher can tell a new beat from the same one. */
  beatNumber = 0;
  /** Where the beat on now is walking someone, for the camera: the hurt matador's way off. */
  route: { from: Vec3; to: Vec3 } | null = null;
  /** Which way the matador last turned for a salute or a bow, for the camera behind him (it stays for the crowd's verdict). */
  facing: number | null = null;
  private bullAct: BullAct;
  private beat: Beat;
  private queue: BeatRequest[];
  private readonly program: BeatRequest[];
  private readonly loop: boolean;
  private readonly supply: ((ring: Ring) => BeatRequest | undefined) | null;
  private readonly random: () => number;
  private schedule: { tick: number; still: () => boolean; run: () => void }[] = [];
  /** Whom the bull watches while it stands. */
  private attention: Torero;
  private lying = false;
  private rescued = false;
  private carry = 0;

  constructor(options: RingOptions = {}) {
    const rng = createRng(options.seed ?? "sol-y-sombra/ring");
    this.random = rng.float;
    this.wind = options.wind ?? { x: 0.6, y: 0, z: -0.35 };
    this.program = options.program ?? [{ kind: "pass", pass: "veronica", side: 1, paw: true }];
    this.queue = [...this.program];
    this.loop = options.loop ?? true;
    this.supply = options.supply ?? null;
    this.dust = new Dust(this.random);

    if ((options.opening ?? "centre") === "paseo") {
      // At the great gate, just inside the sand, facing across the ring; the bull waits behind its door.
      const gate = around(PLAZA.gateAzimuth, PLAZA.ring - 1.6);
      const inward = headingOf(sub({ x: 0, y: 0, z: 0 }, gate));
      const back = normalize(gate);
      const right = headingRight(inward);
      this.people = [new Torero("matador", gate, inward, { x: 0, y: 1.5, z: 0 })];
      if (options.crew) {
        for (const side of [-1, 1])
          this.people.push(new Torero("crew", addScaled(addScaled(gate, back, 1.4), right, side * 0.95), inward, { x: 0, y: 1.5, z: 0 }));
      }
      const pens = around(PLAZA.torilAzimuth, PLAZA.ring + 3);
      this.bull = new Bull(pens, headingOf(sub({ x: 0, y: 0, z: 0 }, pens)));
      this.bullPresent = false;
    } else {
      this.people = [new Torero("matador", { x: 0, y: 0, z: 0 }, 0, { x: 8, y: 1.3, z: 0 })];
      this.bull = new Bull({ x: 8.6, y: 0, z: 0.35 }, Math.PI);
      this.bullPresent = true;
      if (options.crew) {
        const posts = this.choosePosts();
        posts.forEach((post) => this.people.push(new Torero("crew", post, headingOf(sub(this.bull.front, post)), { x: 8, y: 1.3, z: 0 })));
      }
      for (const person of this.people) person.perform(this.watching(person), 0);
    }
    this.attention = this.people[0];
    this.bullAct = new BullWatching(this.bull, () => this.attentionPoint());

    this.beat = { kind: "wait", untilTick: Math.round(0.6 / TICK), pass: null };
    // Let the cloth and the tassels settle before anyone sees them.
    for (let i = 0; i < 240; i++) this.simulateSecondary();
  }

  /* ---------- The matador, as the lab and the styles read him ---------- */

  get matador(): Torero {
    return this.people[0];
  }

  get crew(): Torero[] {
    return this.people.slice(1);
  }

  get feet() {
    return this.matador.feet;
  }

  get skeleton(): Skeleton {
    return this.matador.skeleton;
  }

  get intent(): Intent {
    return this.matador.intent;
  }

  get cape() {
    return this.matador.cape;
  }

  get grip() {
    return this.matador.grip;
  }

  get tassels() {
    return this.matador.tassels;
  }

  get fringes() {
    return this.matador.fringes;
  }

  /** The bull's pose as of the last tick. */
  get bullPose(): BullPose {
    return this.bull.current;
  }

  get beatKind() {
    return this.beat.kind;
  }

  /** The pass on now, by anyone. */
  get passing(): PassAct | null {
    return this.beat.pass;
  }

  /** Whether the beat on now has played out (a held beat never does). */
  get beatOver() {
    return this.tick >= this.beat.untilTick;
  }

  /* ---------- Time ---------- */

  /** Runs the ring forward by `seconds`, in whole ticks; the remainder carries over to the next call. */
  advance(seconds: number) {
    this.carry += seconds;
    const ticks = Math.floor(this.carry / TICK + 1e-6);
    this.carry -= ticks * TICK;
    for (let i = 0; i < ticks; i++) this.step();
  }

  step() {
    this.tick++;
    this.time = this.tick * TICK;
    this.runDue();
    if (this.tick >= this.beat.untilTick) this.nextBeat();
    const pose = this.bull.current;
    for (const person of this.people) person.update(this.time, pose);
    this.bull.step(TICK, this.bullAct.cue(this.time));
    for (const kick of this.bull.kicks) this.dust.emit(kick.at, kick.push, kick.amount);
    this.simulateSecondary();
  }

  /** How much to slow time for the closest moment of the matador's pass, 1 for normal speed. */
  slowMotion(): number {
    const pass = this.beat.pass;
    if (!pass || pass.passer !== this.matador) return 1;
    const from = pass.closestTick - 0.55 / TICK;
    return 1 - 0.72 * bump(clamp((this.tick - from) / (1.05 / TICK), 0, 1));
  }

  /** Begins a beat now, whatever is playing. */
  request(beat: BeatRequest) {
    this.queue = [beat];
    this.nextBeat();
  }

  /** Does `run` at `time`, if `still` says it still makes sense then. */
  private at(time: number, still: () => boolean, run: () => void) {
    this.schedule.push({ tick: Math.max(this.tick + 1, Math.round(time / TICK)), still, run });
  }

  private runDue() {
    const due = this.schedule.filter((s) => s.tick <= this.tick);
    if (!due.length) return;
    this.schedule = this.schedule.filter((s) => s.tick > this.tick);
    for (const item of due) if (item.still()) item.run();
  }

  /* ---------- Beats ---------- */

  private nextBeat() {
    if (!this.queue.length && this.loop) this.queue = [...this.program];
    const request = this.queue.shift() ?? this.supply?.(this) ?? { kind: "wait", seconds: 1 };
    const beat: Beat = { kind: request.kind, untilTick: this.tick + 1, pass: null };
    this.beat = beat;
    this.beatNumber++;
    this.route = null;
    if (request.kind !== "pass") this.current = null;
    const matador = this.matador;
    const seconds = (s: number) => this.tick + Math.round(s / TICK);

    switch (request.kind) {
      case "wait":
        if (!(matador.act instanceof Down) && !(matador.act instanceof Watching)) this.perform(matador, this.watching(matador));
        this.watchBull();
        beat.untilTick = seconds(request.seconds);
        return;
      case "pass": {
        const passer = this.people[request.by ?? 0] ?? matador;
        const act = this.startPass(passer, { kind: request.pass, side: request.side, paw: request.paw ?? false, outcome: request.outcome });
        beat.pass = act;
        if (passer === matador) this.clearTheWay(act.pass);
        beat.untilTick = act.startTick + act.pass.lengthTicks;
        if (request.outcome === "gored" && this.crew.length) {
          this.rescued = false;
          this.at(
            (act.startTick + act.pass.contactTick) * TICK,
            () => matador.act === act,
            () => this.rescue(act),
          );
        }
        if (request.outcome === "rests") {
          this.at(
            act.until,
            () => this.bullAct === act,
            () => {
              this.lying = true;
              this.bullAct = new BullLying(this.bull);
            },
          );
        }
        return;
      }
      case "walk-off": {
        // Away from the bull, back turned, then round to face it again from a fair distance.
        const centre = matador.feet.finalCentre();
        const to = addScaled(centre, normalize(sub(centre, this.bull.front)), request.distance);
        const walk = new Walk(matador, to, headingOf(sub(this.bull.front, to)), this.time, { look: (i) => add(i.bullHead, { x: 0, y: 0.25, z: 0 }) });
        this.perform(matador, walk, () => this.watching(matador));
        this.watchBull();
        beat.untilTick = Math.round(walk.until / TICK) + Math.round(0.2 / TICK);
        return;
      }
      case "site": {
        const centre = matador.feet.finalCentre();
        const bull = flat(this.bull.front);
        const want = request.distance ?? 7;
        if (Math.abs(flatDistance(centre, bull) - want) < 1.5) return;
        const spot = this.inside(addScaled(bull, normalize(sub(centre, bull)), want), POST_RADIUS);
        const walk = new Walk(matador, spot, headingOf(sub(bull, spot)), this.time, { look: (i) => i.bullHead });
        this.perform(matador, walk, () => this.watching(matador));
        this.attention = matador;
        this.watchBull();
        this.sendCrewToPosts();
        beat.untilTick = Math.round(walk.until / TICK);
        return;
      }
      case "salute":
        this.facing = request.facing;
        this.perform(matador, new Salute(matador, request.facing, this.time, request.seconds), () => this.watching(matador));
        this.watchBull();
        beat.untilTick = seconds(request.seconds);
        return;
      case "bow": {
        this.facing = request.facing;
        const bow = new Bow(matador, request.facing, this.time, request.seconds ?? 3.4);
        this.perform(matador, bow, () => this.watching(matador));
        this.watchBull();
        beat.untilTick = Math.round(bow.until / TICK);
        return;
      }
      case "down":
        if (!(matador.act instanceof Down)) this.perform(matador, new Down(matador));
        if (this.crew.length && !this.rescued) this.rescue(null);
        beat.untilTick = request.seconds === undefined ? HOLD : seconds(request.seconds);
        return;
      case "rise": {
        const rise = new Rise(matador, this.time, this.bull.front);
        this.perform(matador, rise, () => this.watching(matador));
        this.at(
          rise.ready,
          () => matador.act === rise,
          () => {
            this.attention = matador;
            this.rescued = false;
            this.sendCrewToPosts();
          },
        );
        beat.untilTick = Math.round(rise.until / TICK);
        return;
      }
      case "helped-off":
        beat.untilTick = Math.round(this.helpOff(request.serious) / TICK);
        return;
      case "leave": {
        const m = matador.feet.finalCentre();
        const heading = this.wayOut(m);
        const to = this.inside(addScaled(m, headingDir(heading), Math.max(2, this.toBarrier(m, headingDir(heading)) - 1.4)), PLAZA.ring - 1.2);
        this.route = { from: m, to };
        const walk = new Walk(matador, to, heading, this.time, {
          carry: "bundle",
          look: () => add(addScaled(to, headingDir(heading), 3), { x: 0, y: 1.3, z: 0 }),
        });
        this.perform(matador, walk);
        beat.untilTick = Math.round(walk.until / TICK);
        return;
      }
      case "lap":
        beat.untilTick = Math.round(this.lapOfHonour() / TICK);
        return;
      case "paseo":
        beat.untilTick = Math.round(this.paseo() / TICK);
        return;
      case "bull-enters":
        beat.untilTick = Math.round(this.bullEnters() / TICK);
        return;
      case "crew-work":
        beat.untilTick = HOLD;
        this.crewWork(() => (beat.untilTick = this.tick + Math.round(0.8 / TICK)));
        return;
      case "bull-leaves":
        beat.untilTick = HOLD;
        this.bullLeaves((until) => (beat.untilTick = Math.round(until / TICK)));
        return;
    }
  }

  /** Starts someone's act; `then`, if given, takes over once it has played out (unless something else has). */
  private perform(person: Torero, act: Act, then?: () => Act) {
    person.perform(act, this.time);
    if (then && Number.isFinite(act.until))
      this.at(
        act.until,
        () => person.act === act,
        () => this.perform(person, then()),
      );
  }

  private watching(person: Torero) {
    return new Watching(person, (input) => input.bullHead);
  }

  /** The bull stands and watches whoever has its attention, unless it is lying down. */
  private watchBull() {
    if (this.lying || this.bullAct instanceof BullWatching) return;
    this.bullAct = new BullWatching(this.bull, () => this.attentionPoint());
  }

  private attentionPoint(): Vec3 | null {
    const who = this.attention;
    if (!this.bullPresent) return null;
    return who.grip.leftHold + who.grip.rightHold > 0.5 ? who.capeCentre() : who.skeleton.head;
  }

  private startPass(passer: Torero, options: PassOptions) {
    const stage = {
      feet: passer.feet,
      bullFront: this.bull.front,
      bullRear: this.bull.rear,
      bullHeading: this.bull.heading,
      capeCentre: passer.capeCentre(),
      matadorHeading: passer.intent.heading,
    };
    const pass = new Pass(options, stage, this.time);
    const act = new PassAct(pass, this.tick, passer);
    this.perform(passer, act);
    this.bullAct = act;
    this.attention = passer;
    this.lying = false;
    if (passer === this.matador) this.current = pass;
    return act;
  }

  /* ---------- The crew ---------- */

  /**
   * Where the crew wait while the matador works: by the barrier, as far as
   * can be from the matador, the bull and the line the bull runs on past
   * him, and clear of the two gates.
   */
  private choosePosts(): Vec3[] {
    const m = this.matador.feet.finalCentre();
    const b = flat(this.bull.front);
    const behind = addScaled(m, normalize(sub(m, b)), 8);
    const clearOf = (az: number, gate: number) => Math.abs(Math.atan2(Math.sin(az - gate), Math.cos(az - gate))) > 0.3;
    const score = (az: number) => {
      if (!clearOf(az, PLAZA.gateAzimuth) || !clearOf(az, PLAZA.torilAzimuth)) return -1;
      const p = around(az, POST_RADIUS);
      return Math.min(flatDistance(p, m), flatDistance(p, b), flatDistance(p, behind));
    };
    let best = 0;
    for (let k = 1; k < 72; k++) if (score((k * Math.PI) / 36) > score(best)) best = (k * Math.PI) / 36;
    const second = score(best + 0.42) >= score(best - 0.42) ? best + 0.42 : best - 0.42;
    return [around(best, POST_RADIUS), around(second, POST_RADIUS)];
  }

  /** Crew standing anywhere near the matador or the bull's run go back to the barrier. */
  private clearTheWay(pass: Pass) {
    const m = pass.centrePoint();
    const track = pass.track.front;
    const inTheWay = (p: Vec3) => flatDistance(p, m) < 7 || track.some((f, i) => i % 24 === 0 && flatDistance(p, f) < 4);
    const posts = this.choosePosts();
    this.crew.forEach((person, i) => {
      if (person.act instanceof Watching && inTheWay(person.feet.finalCentre())) this.toPost(person, posts[i]);
    });
  }

  private sendCrewToPosts() {
    const posts = this.choosePosts();
    this.crew.forEach((person, i) => this.whenFree(person, () => this.toPost(person, posts[i])));
  }

  /** Runs `then` once the person's current act has played out. */
  private whenFree(person: Torero, then: () => void) {
    const act = person.act;
    if (!Number.isFinite(act.until) || act.until <= this.time) then();
    else this.at(act.until, () => person.act === act, then);
  }

  private toPost(person: Torero, post: Vec3) {
    const walk = new Walk(person, post, headingOf(sub(this.bull.front, post)), this.time, { look: (i) => i.bullHead });
    this.perform(person, walk, () => this.watching(person));
    return walk;
  }

  /**
   * The matador is down: one of the crew runs in between him and the bull
   * and draws the bull away with a pass of his own; the other runs to the
   * matador's side and stands there, cape ready.
   */
  private rescue(gored: PassAct | null) {
    const [lurer, guard] = this.crew;
    if (!lurer) return;
    this.rescued = true;
    const m = gored ? gored.pass.centrePoint() : this.matador.feet.finalCentre();
    // Where the bull will stand once it has turned back to face him.
    const end = gored ? gored.pass.track.front[gored.pass.track.turnEnd] : flat(this.bull.front);
    const bullFree = gored ? (gored.startTick + gored.pass.track.turnEnd) * TICK : this.time;
    const u = normalize(sub(end, m));
    const across = { x: -u.z, y: 0, z: u.x };
    const spots = [1, -1].map((s) => this.inside(addScaled(addScaled(end, across, 4.2 * s), u, 1.6), POST_RADIUS));
    const lureSpot = flatDistance(spots[0], m) >= flatDistance(spots[1], m) ? spots[0] : spots[1];
    const run = new Walk(lurer, lureSpot, headingOf(sub(end, lureSpot)), this.time, { pace: "jog", look: (i) => i.bullHead, watchWhileWalking: true });
    this.perform(lurer, run);
    this.at(
      Math.max(run.until, bullFree + 0.2),
      () => lurer.act === run,
      () => {
        // The bull goes by on the side away from the matador.
        const facing = headingOf(sub(this.bull.front, lurer.feet.finalCentre()));
        const side = dot(headingRight(facing), sub(m, lurer.feet.finalCentre())) > 0 ? -1 : 1;
        const act = this.startPass(lurer, { kind: "outside", side, paw: false });
        this.perform(lurer, act, () => this.watching(lurer));
      },
    );
    if (guard) {
      const spot = this.inside(addScaled(addScaled(m, u, 1.2), across, 0.7), POST_RADIUS);
      const run2 = new Walk(guard, spot, headingOf(sub(end, spot)), this.time, { pace: "jog", look: (i) => i.bullHead, watchWhileWalking: true });
      this.perform(guard, run2, () => this.watching(guard));
    }
  }

  /**
   * Helping the hurt matador off: one man (two, if it is serious) runs to
   * his side, they get him up, and walk him slowly to the barrier, away
   * from the bull. Returns when they get there.
   */
  private helpOff(serious: boolean) {
    const matador = this.matador;
    const m = matador.feet.finalCentre();
    const heading = this.wayOut(m);
    const away = headingDir(heading);
    const to = this.inside(addScaled(m, away, Math.max(2, this.toBarrier(m, away) - 1.4)), PLAZA.ring - 1.2);
    const plan: HelpPlan = { arrive: this.time + 0.4, setOff: 0, heading, to };
    const [first, second] = this.crew;
    const helpers: { person: Torero; side: number }[] = [];
    if (second) helpers.push({ person: second, side: 1 });
    else if (first) helpers.push({ person: first, side: 1 });
    if (serious && second && first) helpers.push({ person: first, side: -1 });
    const right = headingRight(heading);
    const acts = helpers.map(({ person, side }) => {
      const spot = addScaled(m, right, side * 0.5);
      const act = new Supporting(person, matador, side, plan, spot, this.time);
      this.perform(person, act);
      plan.arrive = Math.max(plan.arrive, act.arrives);
      return { act, spot };
    });
    const turn = Math.abs(Math.atan2(Math.sin(heading - matador.plannedIntent.heading), Math.cos(heading - matador.plannedIntent.heading)));
    plan.setOff = plan.arrive + 1.5 + (turn > 0.3 ? 0.5 + turn * 0.35 : 0) + 0.1;
    acts.forEach(({ act, spot }) => act.setOff(add(spot, sub(to, m))));
    this.route = { from: m, to };
    const supported = new Supported(matador, plan, {
      right: helpers.find((h) => h.side > 0)?.person ?? null,
      left: helpers.find((h) => h.side < 0)?.person ?? null,
    });
    this.perform(matador, supported);
    // Whoever isn't helping keeps the bull's eye.
    const free = this.crew.find((p) => !helpers.some((h) => h.person === p));
    if (free) this.attention = free;
    return supported.until;
  }

  /** The lap of honour: half the ring along the barrier, an arm raised to the stands, the crew behind. */
  private lapOfHonour() {
    const matador = this.matador;
    const m = matador.feet.finalCentre();
    const start = Math.atan2(m.z, m.x);
    const arc = (offset: number, radius: number) => {
      const points = [];
      for (let k = 0; k <= 26; k++) points.push(around(start + offset + (k * Math.PI) / 26, radius));
      return points;
    };
    const towardStands = (input: ActInput) => {
      const az = Math.atan2(input.centre.z, input.centre.x);
      return around(az, PLAZA.ring + 9, 6.5);
    };
    const lap = new Route(matador, [m, ...arc(0.05, LAP_RADIUS)], this.time, { carry: "bundle", look: towardStands, wave: true });
    this.perform(matador, lap, () => this.watching(matador));
    this.crew.forEach((person, i) => {
      const walk = new Route(person, [person.feet.finalCentre(), ...arc(-0.16 - 0.12 * i, LAP_RADIUS + 0.5 * (i === 0 ? 1 : -1))], this.time, {
        carry: "bundle",
        look: towardStands,
      });
      this.perform(person, walk, () => this.watching(person));
    });
    return lap.until;
  }

  /**
   * The paseo: the three walk in from the great gate side by side, in step,
   * bow to the presidency across the ring, and go to their places by the
   * barrier. Returns when the bow is over.
   */
  private paseo() {
    const inward = headingOf(sub({ x: 0, y: 0, z: 0 }, around(PLAZA.gateAzimuth, 1)));
    const ahead = normalize(sub({ x: 0, y: 0, z: 0 }, around(PLAZA.gateAzimuth, 1)));
    const start = this.time + 0.4;
    let arrived = start;
    for (const person of this.people) {
      const to = addScaled(person.feet.finalCentre(), ahead, 8.5);
      const walk = new Walk(person, to, inward, start, { carry: "bundle", look: () => around(PLAZA.gateAzimuth + Math.PI, PLAZA.ring + 6, 5) });
      this.perform(person, walk);
      arrived = Math.max(arrived, walk.until);
    }
    let bowed = arrived;
    for (const person of this.people) {
      const bow = new Bow(person, inward, arrived + 0.2, 3.2);
      this.at(
        arrived + 0.2,
        () => true,
        () => this.perform(person, bow),
      );
      bowed = Math.max(bowed, arrived + 0.2 + 3.4);
    }
    this.at(
      bowed,
      () => true,
      () => {
        const posts = this.choosePosts();
        this.crew.forEach((person, i) => this.toPost(person, posts[i]));
        // The matador waits by the barrier between them.
        const mid = normalize(add(posts[0], posts[1]));
        this.toPost(this.matador, addScaled({ x: 0, y: 0, z: 0 }, mid, POST_RADIUS + 0.6));
      },
    );
    return bowed;
  }

  /** Out of the pens at a gallop, round into the ring, and a stop to look for something to charge. */
  private bullEnters() {
    this.bullPresent = true;
    this.lying = false;
    const az = PLAZA.torilAzimuth;
    const watched = this.crew[0] ?? this.matador;
    this.attention = watched;
    const run = new BullRun(this.bull, [around(az, PLAZA.ring - 1.5), around(az + 0.3, PLAZA.ring - 7), around(az + 0.55, 9)], this.time, {
      topSpeed: 6.2,
      face: watched.feet.finalCentre(),
      look: () => this.attentionPoint(),
    });
    this.bullAct = run;
    this.at(
      run.until,
      () => this.bullAct === run,
      () => this.watchBull(),
    );
    return run.until + 0.6;
  }

  /** The crew's work: each in turn walks out, cites the bull and takes it past with an outside pass, then goes back to his post. */
  private crewWork(done: () => void) {
    const [first, second] = this.crew;
    if (!first) return done();
    this.crewPass(first, 1, () => (second ? this.crewPass(second, -1, done) : done()));
  }

  private crewPass(person: Torero, side: 1 | -1, then: () => void) {
    const bull = flat(this.bull.front);
    const from = person.feet.finalCentre();
    const spot = this.citingSpot(person, bull);
    // A long way off, he runs out to cite the bull.
    const pace = flatDistance(from, spot) > 5 ? "jog" : "walk";
    const walk = new Walk(person, spot, headingOf(sub(bull, spot)), this.time, { pace, look: (i) => i.bullHead, watchWhileWalking: true });
    this.perform(person, walk);
    this.attention = person;
    this.watchBull();
    this.at(
      walk.until,
      () => person.act === walk,
      () => {
        const act = this.startPass(person, { kind: "outside", side, paw: false });
        this.at(
          act.until,
          () => person.act === act,
          () => {
            this.toPost(person, this.choosePosts()[this.crew.indexOf(person)]);
            this.watchBull();
            then();
          },
        );
      },
    );
  }

  /**
   * Where a man of the crew stands to cite the bull: six and a half metres
   * from it, on a line that sends its run on past him across open sand,
   * not into the barrier or the people waiting there.
   */
  private citingSpot(person: Torero, bull: Vec3): Vec3 {
    const others = this.people.filter((p) => p !== person).map((p) => p.feet.finalCentre());
    const from = person.feet.finalCentre();
    let best = this.inside(addScaled(bull, normalize(sub(from, bull)), 6.5), POST_RADIUS);
    let bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const dir = headingDir((k * Math.PI) / 12);
      const spot = addScaled(bull, dir, 6.5);
      const beyond = addScaled(bull, dir, 13);
      if (Math.hypot(spot.x, spot.z) > POST_RADIUS - 2) continue;
      const room = PLAZA.ring - Math.hypot(beyond.x, beyond.z);
      const clear = Math.min(...others.map((o) => Math.min(flatDistance(o, spot), flatDistance(o, beyond))));
      // Open sand beyond, nobody in the way, and not too far to walk.
      const score = Math.min(room, 4) + Math.min(clear, 8) - flatDistance(from, spot) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
    return best;
  }

  /** Up from the sand if it was resting, and out through its door at a steady trot, back to the pens. */
  private bullLeaves(gone: (until: number) => void) {
    const az = PLAZA.torilAzimuth;
    const leave = () => {
      const run = new BullRun(this.bull, [around(az, PLAZA.ring - 5), around(az, PLAZA.ring - 0.6), around(az, PLAZA.ring + 3)], this.time, { topSpeed: 2.3 });
      this.bullAct = run;
      this.at(
        run.until,
        () => this.bullAct === run,
        () => (this.bullPresent = false),
      );
      gone(run.until);
    };
    if (!this.lying) return leave();
    this.lying = false;
    const rising = new BullRising(this.bull, this.time);
    this.bullAct = rising;
    this.at(rising.until, () => this.bullAct === rising, leave);
  }

  /* ---------- Places ---------- */

  /** The way to the nearest stretch of barrier that doesn't lead towards the bull. */
  private wayOut(from: Vec3) {
    const fromBull = this.bullPresent ? headingOf(sub(from, flat(this.bull.front))) : headingOf(from);
    let heading = fromBull;
    for (let k = -4; k <= 4; k++) {
      const h = fromBull + k * 0.3;
      if (this.toBarrier(from, headingDir(h)) < this.toBarrier(from, headingDir(heading))) heading = h;
    }
    return heading;
  }

  /** A point pulled in to `radius` from the ring's centre if it lies beyond it. */
  private inside(point: Vec3, radius: number): Vec3 {
    const r = Math.hypot(point.x, point.z);
    return r <= radius ? flat(point) : { x: (point.x * radius) / r, y: 0, z: (point.z * radius) / r };
  }

  /** How far from `from` along `dir` the barrier is. */
  private toBarrier(from: Vec3, dir: Vec3) {
    const b = from.x * dir.x + from.z * dir.z;
    const c = from.x * from.x + from.z * from.z - PLAZA.ring * PLAZA.ring;
    return -b + Math.sqrt(Math.max(0, b * b - c));
  }

  /* ---------- What only follows ---------- */

  private simulateSecondary() {
    const bull = this.bullColliders();
    for (const person of this.people) {
      person.secondary(TICK, this.wind, bull);
      this.dragHemDust(person);
    }
    this.dust.step(TICK, this.wind);
  }

  private bullColliders(): Collider[] {
    if (!this.bullPresent) return [];
    const b = this.bull.current;
    const list: Collider[] = [
      { kind: "capsule", a: b.spine[1], b: b.withers, r: 0.36 },
      { kind: "capsule", a: b.neckBase, b: b.poll, r: 0.24 },
      { kind: "capsule", a: b.poll, b: b.muzzle, r: 0.13 },
    ];
    for (const horn of b.horns) {
      list.push({ kind: "capsule", a: horn[0], b: horn[2], r: 0.045 });
      list.push({ kind: "capsule", a: horn[2], b: horn[4], r: 0.03 });
    }
    return list;
  }

  /** A hem dragged fast across the sand lifts a thin trail of it. */
  private dragHemDust(person: Torero) {
    const { pos, prev, shape } = person.cape;
    const lastRow = (shape.rows - 1) * shape.columns;
    for (let c = 0; c < shape.columns; c += 2) {
      const k = (lastRow + c) * 3;
      if (pos[k + 1] > 0.05) continue;
      const vx = (pos[k] - prev[k]) / TICK;
      const vz = (pos[k + 2] - prev[k + 2]) / TICK;
      const speed = Math.hypot(vx, vz);
      if (speed > 1.6 && this.random() < 0.05) this.dust.emit({ x: pos[k], y: 0, z: pos[k + 2] }, { x: vx * 0.2, y: 0.35, z: vz * 0.2 }, 0.12);
    }
  }
}
