import { createRng, type Rng } from "@/lib/kit/rng";
import {
  BASE_EVENTS,
  DIFFICULTY,
  GOAL,
  HOURS_PER_TURN,
  hoursToDawn,
  isNight,
  MAX_FATIGUE,
  NIGHT_PACE,
  PURSUERS,
  pursuerStart,
  SEED_HANDFULS,
  STRIDES,
  THIRST_TURNS,
  type CommandId,
  type Difficulty,
  type EventOdds,
  type PursuerKind,
} from "./rules";

/*
 * A Two Humps crossing, as pure rules: no drawing, no timers. The screen asks
 * it what each command would do (`preview`), sends commands, and animates the
 * happenings it reports.
 *
 * The heart is the camel's run-on. After a walk or a gallop, if nothing else
 * happens, the camel may keep going by itself, as it did in 1982 when the
 * program jumped back to the last command. Here the player sees the chance,
 * sees what one more stride gives and costs, and can pull the reins. Strides
 * taken on the run cost fatigue but no water and no time, so the pursuer
 * doesn't move.
 *
 * Randomness comes from three separate seeded streams: the map (oases and
 * terrain), the dice (strides and events) and the pursuer (its steps). The
 * pursuer's k-th step is therefore the same whatever the player does, which
 * keeps a daily crossing fair between players.
 */

export type Terrain = "dunes" | "gravel";

export type Oasis = { at: number; known: boolean; used: boolean; dry: boolean };

/** What a leg of an expedition changes. */
export type Twist = {
  name?: string;
  goal?: number;
  /** No thirst at all (an ice gorge). */
  noThirst?: boolean;
  /** Strides go this much slower. */
  pace?: number;
  noGallop?: boolean;
  /** Herders' gers nearby: signals are far likelier to be seen. */
  helpNearby?: number;
  events?: Partial<EventOdds>;
};

export type TrekConfig = {
  pursuer: PursuerKind;
  difficulty: Difficulty;
  seed: number | string;
  /** Hours since midnight when the trek starts: dawn or dusk. */
  startClock: number;
  twist?: Twist;
};

export type Phase = "choose" | "run-on" | "caravan" | "over";

export type EndCause = "arrived" | "caught" | "beaten" | "thirst" | "collapse";

export type Happening =
  | { kind: "stride"; command: "walk" | "gallop"; miles: number; from: number; to: number; onTheRun: boolean }
  | { kind: "oasis"; at: number; dry: boolean }
  | { kind: "gust"; shift: number }
  | { kind: "sore" }
  | { kind: "singing" }
  | { kind: "fossil"; index: number }
  | { kind: "caravan" }
  | { kind: "caravan-chased"; lucky: boolean }
  | { kind: "caravan-waited" }
  | { kind: "run-on"; chance: number }
  | { kind: "reins" }
  | { kind: "drink"; sips: number }
  | { kind: "empty-canteen" }
  | { kind: "scan"; revealed: number[] }
  | { kind: "camp"; slept: boolean; hours: number }
  | { kind: "signal"; answered: boolean }
  | { kind: "seeds"; left: number }
  | { kind: "thirsty" }
  | { kind: "pursuer"; from: number; to: number; night: boolean; stopped: boolean }
  | { kind: "rival-drank"; at: number }
  | { kind: "dawn" }
  | { kind: "dusk" }
  | { kind: "end"; cause: EndCause };

/** One line of the trek's diary: a turn, or a free action between turns. */
export type LogEntry = {
  action: CommandId | "seeds" | "caravan";
  /** The turn count when it finished. */
  turn: number;
  clock: number;
  miles: number;
  pursuer: number;
  happened: Happening["kind"][];
};

export type TrekState = {
  config: TrekConfig;
  goal: number;
  miles: number;
  sips: number;
  canteen: number;
  /** Turns left before a drink is needed; below zero you faint. */
  thirst: number;
  fatigue: number;
  /** Two-hour turns on the trek's clock so far. */
  turn: number;
  clock: number;
  pursuer: { at: number; steps: number; fed: boolean; plume: boolean };
  seeds: number;
  oases: Oasis[];
  terrain: Terrain[];
  /** Effects waiting for the next stride. */
  nextStride: { sore: boolean; singing: boolean };
  phase: Phase;
  runOn: { command: "walk" | "gallop"; strides: number; chance: number } | null;
  pendingCaravan: "walk" | "gallop" | null;
  ending: EndCause | null;
  log: LogEntry[];
  /** Things the achievements look at. */
  record: {
    gallops: number;
    longestRun: number;
    seedsThrown: number;
    nightCamps: number;
    nightCampsSurvived: number;
    oasesBeforeRival: number;
    singing: number;
    fossils: number[];
    reinsAtSix: number;
  };
};

export type CommandPreview = {
  command: CommandId;
  legal: boolean;
  /** Why not, in a few words, when it isn't legal. */
  reason?: string;
  miles?: [number, number];
  fatigueAfter: number;
  /** Takes a turn, so thirst ticks and the pursuer moves. */
  takesTurn: boolean;
  pursuerGain?: [number, number];
  /** The chance the camel runs on after a stride, when nothing else happens. */
  runOn?: number;
  /** Chance a signal is answered. */
  help?: number;
  /** For a night camp: hours asleep. */
  sleepHours?: number;
};

const FOSSILS = 3;

export class Trek {
  readonly state: TrekState;
  private dice: Rng;
  private pursuerDice: Rng;
  /** What has happened in the turn still under way, across run-ons and choices. */
  private turnSoFar: { action: LogEntry["action"]; happened: Happening["kind"][] } | null = null;

  constructor(config: TrekConfig) {
    const rng = createRng(config.seed);
    this.dice = rng.fork("dice");
    this.pursuerDice = rng.fork("pursuer");
    const map = rng.fork("map");
    const rules = DIFFICULTY[config.difficulty];
    const goal = config.twist?.goal ?? GOAL;
    this.state = {
      config,
      goal,
      miles: 0,
      sips: rules.canteen,
      canteen: rules.canteen,
      thirst: THIRST_TURNS,
      fatigue: 0,
      turn: 0,
      clock: config.startClock,
      pursuer: { at: pursuerStart(config.pursuer, config.startClock), steps: 0, fed: false, plume: false },
      seeds: config.pursuer === "gang" ? SEED_HANDFULS : 0,
      oases: placeOases(map, goal, config.difficulty),
      terrain: Array.from({ length: Math.ceil(goal / 5) }, () => (map.float() < 0.55 ? "dunes" : "gravel")),
      nextStride: { sore: false, singing: false },
      phase: "choose",
      runOn: null,
      pendingCaravan: null,
      ending: null,
      log: [],
      record: { gallops: 0, longestRun: 0, seedsThrown: 0, nightCamps: 0, nightCampsSurvived: 0, oasesBeforeRival: 0, singing: 0, fossils: [], reinsAtSix: 0 },
    };
    this.spotOases();
  }

  /* ---------- Asking ---------- */

  get night() {
    return isNight(this.state.clock);
  }

  /** The pursuer's possible gain over the next `steps` two-hour steps from now. */
  pursuerGain(steps = 1): [number, number] {
    const s = this.state;
    let lo = 0;
    let hi = 0;
    let clock = s.clock;
    let taken = s.pursuer.steps;
    let fed = s.pursuer.fed;
    for (let i = 0; i < steps; i++) {
      const [a, b] = stepRange(s.config.pursuer, clock, taken, s.config.difficulty, fed);
      lo += a;
      hi += b;
      fed = false;
      clock += HOURS_PER_TURN;
      taken += 1;
    }
    return [lo, hi];
  }

  preview(command: CommandId): CommandPreview {
    const s = this.state;
    const rules = DIFFICULTY[s.config.difficulty];
    const twist = s.config.twist ?? {};
    const base: CommandPreview = { command, legal: s.phase === "choose", fatigueAfter: s.fatigue, takesTurn: false };
    if (s.phase !== "choose") return { ...base, reason: "Not now" };
    switch (command) {
      case "drink":
        return s.sips > 0 ? base : { ...base, legal: false, reason: "The canteen is empty" };
      case "scan":
        return s.sips > 0 ? base : { ...base, legal: false, reason: "No sip to spare" };
      case "walk":
      case "gallop": {
        const stride = STRIDES[command];
        const after = s.fatigue + stride.fatigue;
        const preview: CommandPreview = {
          ...base,
          takesTurn: true,
          fatigueAfter: after,
          miles: this.strideRange(command),
          pursuerGain: this.pursuerGain(1),
          runOn: this.runOnChance(),
        };
        if (command === "gallop" && twist.noGallop) return { ...preview, legal: false, reason: "No room to gallop in the canyons" };
        if (after > MAX_FATIGUE) return { ...preview, legal: false, reason: command === "gallop" ? "Too tired to gallop" : "Too tired to take a step" };
        return preview;
      }
      case "camp": {
        const sleepHours = this.night ? hoursToDawn(s.clock) : HOURS_PER_TURN;
        return { ...base, takesTurn: true, fatigueAfter: 0, sleepHours, pursuerGain: this.pursuerGain(sleepHours / HOURS_PER_TURN) };
      }
      case "signal":
        return { ...base, takesTurn: true, help: twist.helpNearby ?? rules.help, pursuerGain: this.pursuerGain(1) };
    }
  }

  /** Miles one stride can cover now, after night, terrain and lingering effects. */
  strideRange(command: "walk" | "gallop"): [number, number] {
    const stride = STRIDES[command];
    return [this.adjustStride(stride.min), this.adjustStride(stride.max)];
  }

  private adjustStride(miles: number) {
    const s = this.state;
    let m = miles * (this.night ? NIGHT_PACE : 1) * (s.config.twist?.pace ?? 1);
    if (s.nextStride.sore) m *= 0.5;
    m = Math.floor(m);
    if (s.nextStride.singing) m += 2;
    return m;
  }

  /** Chance the camel runs on after the next stride: nothing else happens, then the 1982 repeat. */
  runOnChance() {
    const odds = this.eventOdds();
    const quiet = 1 - (odds.gust + odds.sore + odds.caravan + odds.singing + odds.fossil);
    return quiet * DIFFICULTY[this.state.config.difficulty].runOn;
  }

  /** The event chances for the stretch the camel is on. */
  eventOdds(): EventOdds {
    const s = this.state;
    const segment = s.terrain[Math.min(s.terrain.length - 1, Math.max(0, Math.floor(s.miles / 5)))];
    const terrain: Partial<EventOdds> = segment === "dunes" ? { singing: 0.09, gust: 0.05, sore: 0.03 } : { singing: 0.01, gust: 0.03, sore: 0.05 };
    const odds = { ...BASE_EVENTS, ...terrain, ...(s.config.twist?.events ?? {}) };
    if (odds.fossil > 0 && s.record.fossils.length >= FOSSILS) odds.fossil = 0;
    return odds;
  }

  /** The next oasis ahead that the camel knows of, if any. */
  nextKnownOasis() {
    return this.state.oases.find((o) => o.known && !o.used && o.at > this.state.miles) ?? null;
  }

  /* ---------- Acting ---------- */

  act(command: CommandId): Happening[] {
    if (!this.preview(command).legal) return [];
    this.turnSoFar = { action: command, happened: [] };
    return this.diary(this.perform(command));
  }

  private perform(command: CommandId): Happening[] {
    const preview = this.preview(command);
    const s = this.state;
    const out: Happening[] = [];
    switch (command) {
      case "drink":
        s.sips -= 1;
        s.thirst = THIRST_TURNS;
        out.push({ kind: "drink", sips: s.sips });
        return out;
      case "scan": {
        // A sip for the climb to a lookout. It shows the oases within 15 miles and this stretch's odds.
        s.sips -= 1;
        const revealed = s.oases.filter((o) => !o.known && o.at > s.miles && o.at <= s.miles + 15);
        for (const o of revealed) o.known = true;
        out.push({ kind: "scan", revealed: revealed.map((o) => o.at) });
        return out;
      }
      case "walk":
      case "gallop":
        if (command === "gallop") s.record.gallops += 1;
        s.runOn = { command, strides: 0, chance: 0 };
        this.stride(command, false, out);
        return out;
      case "camp": {
        const slept = this.night;
        const hours = slept ? hoursToDawn(s.clock) : HOURS_PER_TURN;
        s.fatigue = 0;
        out.push({ kind: "camp", slept, hours });
        if (slept) s.record.nightCamps += 1;
        this.endTurn(out, hours / HOURS_PER_TURN);
        if (slept && s.ending === null) s.record.nightCampsSurvived += 1;
        return out;
      }
      case "signal": {
        const answered = this.dice.float() < (preview.help ?? 0);
        out.push({ kind: "signal", answered });
        if (answered) {
          // Herders arrive with water and let the camel rest.
          s.sips = Math.min(s.canteen, s.sips + 3);
          s.thirst = THIRST_TURNS;
          s.fatigue = 0;
        }
        this.endTurn(out, 1);
        return out;
      }
    }
  }

  /** Let the camel run on for another stride. */
  letRun(): Happening[] {
    const s = this.state;
    if (s.phase !== "run-on" || !s.runOn) return [];
    const out: Happening[] = [];
    s.phase = "choose";
    this.stride(s.runOn.command, true, out);
    return this.diary(out);
  }

  /** Stop the camel: the turn ends. */
  pullReins(): Happening[] {
    const s = this.state;
    if (s.phase !== "run-on") return [];
    const out: Happening[] = [{ kind: "reins" }];
    if (s.fatigue === MAX_FATIGUE - 1) s.record.reinsAtSix += 1;
    s.runOn = null;
    s.phase = "choose";
    this.endTurn(out, 1);
    return this.diary(out);
  }

  /** A dust devil has scattered the packs: chase them (risky) or wait it out (safe, but the pursuer gains). */
  chooseCaravan(choice: "chase" | "wait"): Happening[] {
    const s = this.state;
    if (s.phase !== "caravan") return [];
    const out: Happening[] = [];
    s.phase = "choose";
    s.pendingCaravan = null;
    if (choice === "chase") {
      const lucky = this.dice.float() < 0.5;
      out.push({ kind: "caravan-chased", lucky });
      if (!lucky) {
        // Everything is found, but the camel ran itself ragged doing it.
        s.fatigue = Math.min(MAX_FATIGUE, s.fatigue + 2);
      }
      this.endTurn(out, 1);
    } else {
      out.push({ kind: "caravan-waited" });
      // The pursuer gets a free step while you gather the packs.
      this.pursuerStep(out);
      if (s.ending === null) this.endTurn(out, 1);
    }
    return this.diary(out);
  }

  /** Toss a handful of seeds: the Ladle Gang stops to eat and skips its next step. */
  tossSeeds(): Happening[] {
    const s = this.state;
    if (s.config.pursuer !== "gang" || s.seeds <= 0 || s.pursuer.fed || s.phase === "over") return [];
    s.seeds -= 1;
    s.pursuer.fed = true;
    s.record.seedsThrown += 1;
    const out: Happening[] = [{ kind: "seeds", left: s.seeds }];
    this.writeDiary("seeds", out.map((h) => h.kind));
    return out;
  }

  /**
   * Notes what happened. A turn's line is written when the turn is over,
   * which may be several calls after it began (run-ons, a scattered caravan);
   * free actions get a line of their own.
   */
  private diary(out: Happening[]): Happening[] {
    const s = this.state;
    const current = this.turnSoFar;
    if (!current) return out;
    current.happened.push(...out.map((h) => h.kind));
    const free = current.action === "drink" || current.action === "scan";
    const turnOver = free || s.phase === "choose" || s.phase === "over";
    if (turnOver) {
      this.writeDiary(current.action, current.happened);
      this.turnSoFar = null;
    }
    return out;
  }

  private writeDiary(action: LogEntry["action"], happened: Happening["kind"][]) {
    const s = this.state;
    s.log.push({ action, turn: s.turn, clock: s.clock, miles: s.miles, pursuer: s.pursuer.at, happened });
  }

  /* ---------- Inside a turn ---------- */

  private stride(command: "walk" | "gallop", onTheRun: boolean, out: Happening[]) {
    const s = this.state;
    const rule = STRIDES[command];
    s.fatigue += rule.fatigue;
    if (s.fatigue > MAX_FATIGUE) {
      out.push({ kind: "end", cause: "collapse" });
      return this.finish("collapse");
    }
    const steps = (rule.max - rule.min) / rule.step;
    const miles = this.adjustStride(rule.min + rule.step * this.dice.int(0, steps));
    s.nextStride = { sore: false, singing: false };
    const from = s.miles;
    let to = Math.min(s.goal, from + miles);

    // A known or unknown oasis on the way stops the camel: it smells the water.
    const oasis = s.oases.find((o) => !o.used && o.at > from && o.at <= to);
    if (oasis) to = oasis.at;
    s.miles = to;
    out.push({ kind: "stride", command, miles: to - from, from, to, onTheRun });
    if (s.runOn) {
      s.runOn.strides += onTheRun ? 1 : 0;
      s.record.longestRun = Math.max(s.record.longestRun, s.runOn.strides);
    }
    this.spotOases();
    if (s.miles >= s.goal) {
      out.push({ kind: "end", cause: "arrived" });
      return this.finish("arrived");
    }
    if (oasis) {
      oasis.used = true;
      oasis.known = true;
      out.push({ kind: "oasis", at: oasis.at, dry: oasis.dry });
      if (!oasis.dry) {
        s.sips = s.canteen;
        s.thirst = THIRST_TURNS;
        // The camel eats and drinks too.
        s.fatigue = Math.max(0, s.fatigue - 2);
        if (s.config.pursuer === "rival" && s.pursuer.at < oasis.at) s.record.oasesBeforeRival += 1;
      }
      s.runOn = null;
      return this.endTurn(out, 1);
    }

    // Something may happen on the way.
    const odds = this.eventOdds();
    let r = this.dice.float();
    if ((r -= odds.gust) < 0) {
      const shift = (this.dice.float() < 0.55 ? 1 : -1) * this.dice.int(1, 6);
      s.miles = Math.max(0, Math.min(s.goal, s.miles + shift));
      out.push({ kind: "gust", shift });
      if (s.miles >= s.goal) {
        out.push({ kind: "end", cause: "arrived" });
        return this.finish("arrived");
      }
      s.runOn = null;
      return this.endTurn(out, 1);
    }
    if ((r -= odds.sore) < 0) {
      s.nextStride.sore = true;
      out.push({ kind: "sore" });
      s.runOn = null;
      return this.endTurn(out, 1);
    }
    if ((r -= odds.caravan) < 0) {
      out.push({ kind: "caravan" });
      s.runOn = null;
      s.phase = "caravan";
      s.pendingCaravan = command;
      return;
    }
    if ((r -= odds.singing) < 0) {
      s.nextStride.singing = true;
      s.record.singing += 1;
      out.push({ kind: "singing" });
      s.runOn = null;
      return this.endTurn(out, 1);
    }
    if ((r -= odds.fossil) < 0) {
      const index = s.record.fossils.length;
      s.record.fossils.push(index);
      out.push({ kind: "fossil", index });
      s.runOn = null;
      return this.endTurn(out, 1);
    }

    // Nothing happened: the camel may run on by itself.
    if (this.dice.float() < DIFFICULTY[s.config.difficulty].runOn) {
      const chance = this.runOnChance();
      s.runOn = { command, strides: s.runOn?.strides ?? 0, chance };
      s.phase = "run-on";
      out.push({ kind: "run-on", chance });
      return;
    }
    s.runOn = null;
    this.endTurn(out, 1);
  }

  /** The end of a turn: time passes, thirst grows, the pursuer moves. A night's sleep is several steps. */
  private endTurn(out: Happening[], steps: number) {
    const s = this.state;
    // A turn is two hours on the trek's clock, so a night's sleep counts as several.
    s.turn += steps;
    if (!s.config.twist?.noThirst) {
      s.thirst -= 1;
      if (s.thirst === 1) out.push({ kind: "thirsty" });
      if (s.thirst < 0) {
        out.push({ kind: "end", cause: "thirst" });
        return this.finish("thirst");
      }
    }
    for (let i = 0; i < steps; i++) {
      const wasNight = this.night;
      this.pursuerStep(out);
      if (s.phase === "over") return;
      s.clock = (s.clock + HOURS_PER_TURN) % 24;
      if (wasNight && !this.night) out.push({ kind: "dawn" });
      if (!wasNight && this.night) out.push({ kind: "dusk" });
    }
  }

  private pursuerStep(out: Happening[]) {
    const s = this.state;
    const kind = s.config.pursuer;
    const [lo, hi] = stepRange(kind, s.clock, s.pursuer.steps, s.config.difficulty, s.pursuer.fed);
    const setOff = s.pursuer.steps + 1 >= setsOff(kind, s.config.difficulty);
    // Drawn every step, fed or not, so the stream stays the same for everyone.
    const roll = this.pursuerDice.float();
    const plumeRoll = this.pursuerDice.float();
    // By night the gang hops like the 1982 pygmies: INT(10 * RND) + 2.5, in whole-mile steps.
    const hops = kind === "gang" && this.night && hi > lo;
    const gain = hops ? lo + Math.floor(roll * 10) * ((hi - lo) / 9) : lo + roll * (hi - lo);
    const from = s.pursuer.at;
    const stopped = s.pursuer.fed;
    s.pursuer.at = from + gain;
    s.pursuer.steps += 1;
    s.pursuer.fed = false;
    s.pursuer.plume = kind === "rival" && plumeRoll < 0.25;
    out.push({ kind: "pursuer", from, to: s.pursuer.at, night: this.night, stopped });

    if (kind === "rival") {
      // The rival drinks every oasis it reaches first; they're dry when you get there.
      for (const o of s.oases) {
        if (!o.used && !o.dry && o.at > from && o.at <= s.pursuer.at) {
          o.dry = true;
          out.push({ kind: "rival-drank", at: o.at });
        }
      }
      if (s.pursuer.at >= s.goal) {
        out.push({ kind: "end", cause: "beaten" });
        this.finish("beaten");
      }
      return;
    }
    // Like the 1982 pygmies, a pursuer that hasn't set off can't catch anyone yet.
    if (setOff && s.pursuer.at >= s.miles) {
      out.push({ kind: "end", cause: "caught" });
      this.finish("caught");
    }
  }

  /** Oases within five miles ahead can be seen from the camel's back. */
  private spotOases() {
    const s = this.state;
    for (const o of s.oases) if (!o.known && o.at > s.miles && o.at <= s.miles + 5) o.known = true;
  }

  private finish(cause: EndCause) {
    this.state.ending = cause;
    this.state.phase = "over";
    this.state.runOn = null;
  }
}

/** How many steps a pursuer waits before it sets off. */
const setsOff = (kind: PursuerKind, difficulty: Difficulty) => (kind === "gang" ? DIFFICULTY[difficulty].gangSetsOff : PURSUERS[kind].setsOff);

/** One pursuer step's range, in miles, for a two-hour step starting at `clock`. */
export function stepRange(kind: PursuerKind, clock: number, stepsTaken: number, difficulty: Difficulty, fed: boolean): [number, number] {
  const model = PURSUERS[kind];
  if (fed || stepsTaken + 1 < setsOff(kind, difficulty)) return [0, 0];
  const pace = DIFFICULTY[difficulty].pursuerPace;
  const night = isNight(clock);
  let range: readonly [number, number];
  if (kind === "rival") {
    const dawn = !night && isNight(clock - HOURS_PER_TURN);
    range = night ? PURSUERS.rival.night : dawn ? PURSUERS.rival.dawn : PURSUERS.rival.day;
  } else {
    range = night ? model.night : model.day;
  }
  return [range[0] * pace, range[1] * pace];
}

/** Three oases, one in each third of the way, never too near the start or the end. */
function placeOases(map: Rng, goal: number, difficulty: Difficulty): Oasis[] {
  const count = difficulty === "chill" ? 4 : 3;
  const span = goal / (count + 1);
  return Array.from({ length: count }, (_, i) => {
    const centre = span * (i + 1);
    const at = Math.round(centre + (map.float() - 0.5) * span * 0.6);
    return { at: Math.max(4, Math.min(goal - 4, at)), known: false, used: false, dry: false };
  });
}
