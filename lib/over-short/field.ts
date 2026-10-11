import { createRng } from "@/lib/kit/rng";
import type { TargetKind } from "./engagement";
import { flyField, type Aim, type FieldFlight, type FieldGun, type Wind } from "./fieldModel";
import { heightAt, type Terrain } from "./terrain";

/*
 * Field Artillery: the full-physics engagement. The gun is laid with a
 * charge, an elevation and a line; rounds fly through gusting wind over
 * real ground; the forward observer answers in corrections ("Add 150.
 * Right 40."), unless smoke hides the fall of shot or, at night, nothing
 * but the burst's flash can be seen. An enemy battery may be firing back
 * on its own clock, its rounds walking in on the gun until the gun moves.
 *
 * Like the Campaign's engagement, it is pure: `actField` takes an order and
 * returns the engagement after it with what happened, in the order it
 * happened in game time. The randomness of each round (its gusts, the
 * observer's misjudgement, where an enemy round falls) comes from the seed
 * and the round's number, so replaying the same orders replays the battle.
 */

export type Difficulty = "easy" | "normal" | "hard";

export type FieldTarget = {
  kind: TargetKind;
  /** Where it stands at the start: metres along the line of fire from the gun's first position, and across it (right is positive). */
  x: number;
  z: number;
  /** Speed in m/s along and across the line of fire. */
  vx: number;
  vz: number;
  /** A round within this many metres counts as a hit. */
  radius: number;
  hits: number;
};

export type EnemyBattery = {
  x: number;
  z: number;
  /** Game seconds of its first round, and between rounds. */
  opensAt: number;
  interval: number;
  /** Its first round at a gun position misses by about this much; each next one by `closing` of the one before; within `lethal` the gun is knocked out. */
  first: number;
  closing: number;
  lethal: number;
  /** Whether it is one of the targets (silenced when destroyed) or only harassing the gun. */
  isTarget: boolean;
};

export type FieldRules = {
  gun: FieldGun;
  terrain: Terrain;
  /** The wind's mean; each round meets it varied by `gusts` (a share of its strength). */
  wind: Wind;
  gusts: number;
  /**
   * Why the first round rarely hits, as in any real battery: the map puts
   * the target a little off where it is (metres, told minus true), the
   * morning's forecast is not quite the wind, this barrel throws a little
   * differently from the table (a share of muzzle speed), and no two
   * rounds' powder is the same (a share either way).
   */
  told: { mapError: { along: number; across: number }; forecast: Wind };
  wear: number;
  dispersion: number;
  /** How far off the observer's judgement can be (a share of the miss) and what it rounds to; `milsHint` adds the line in mils. */
  observer: { error: number; rounding: number; milsHint: boolean };
  ammo: number;
  /** Seconds to lay and load between rounds, and the extra to change charge. */
  reload: number;
  recharge: number;
  /** Game seconds by which the job must be done (the column reaches the bridge), or null. */
  deadline: number | null;
  enemy: EnemyBattery | null;
  relocations: { count: number; step: number };
  /** The rounds at a target whose fall of shot the enemy's smoke hides (counting from 1). */
  smoke: number[];
  /** A night shoot: star shells to call for, and how long each burns. */
  night: { starShells: number; burn: number } | null;
  limits: { elevation: { min: number; max: number }; line: number };
};

/** What the observer says about one round. */
export type FieldReport =
  | { kind: "target"; destroyed: boolean }
  /** Corrections to apply, in metres: `add` (it fell short) or `drop` (it went over); `left` or `right`. Null where it was on. */
  | { kind: "correction"; range: { word: "add" | "drop"; metres: number } | null; line: { word: "left" | "right"; metres: number; mils: number } | null }
  /** At night with no light, only the burst's flash: which side of the target, no distances. */
  | { kind: "flash"; range: "over" | "short" | null; line: "left" | "right" | null }
  /** Lost in smoke: the observer saw nothing (`destroyed` when it was heard to go up). */
  | { kind: "lost"; destroyed: boolean };

export type FieldShot = {
  round: number;
  target: number;
  aim: Aim;
  firedAt: number;
  /** The wind this round actually met. */
  wind: Wind;
  flight: FieldFlight;
  /** The target's position when the round came down. */
  targetAt: { x: number; z: number };
  /** Burst minus target: positive is over, and right. */
  miss: { along: number; across: number };
  hit: boolean;
  destroyed: boolean;
  /** Where the gun stood when it fired. */
  gunX: number;
  report: FieldReport;
};

export type FieldEnemyRound = { at: number; x: number; z: number; miss: number; onGun: boolean; emptyPit: boolean };

export type FieldOutcome = "won" | "gun-lost" | "out-of-ammo" | "out-of-time";

export type FieldEngagement = {
  rules: FieldRules;
  seed: string;
  targets: FieldTarget[];
  index: number;
  hitsOnTarget: number;
  /** Where the gun stands along the line of fire (it moves when relocated). */
  gunX: number;
  time: number;
  shots: FieldShot[];
  enemyRounds: FieldEnemyRound[];
  /** Rounds the enemy has fired at the gun's present position. */
  ranging: number;
  /** Game time of the enemy's next round. */
  enemyNext: number;
  silenced: boolean;
  relocationsLeft: number;
  starShellsLeft: number;
  /** When each star shell called for burns over the target. */
  lit: { from: number; to: number }[];
  lastCharge: number | null;
  outcome: FieldOutcome | null;
};

export type FieldAction = { kind: "fire"; aim: Aim } | { kind: "relocate"; direction: 1 | -1 } | { kind: "illuminate" };

export type FieldEvent =
  | { kind: "shot"; shot: FieldShot }
  | { kind: "too-late"; shot: FieldShot }
  | { kind: "target-destroyed"; target: number }
  | { kind: "next-target"; target: number }
  | { kind: "enemy-round"; round: FieldEnemyRound }
  | { kind: "relocated"; by: number }
  | { kind: "illuminated"; from: number; to: number }
  | { kind: "refused"; reason: "elevation" | "line" | "charge" | "no-moves" | "no-star-shells" | "daylight" }
  | { kind: "over"; outcome: FieldOutcome };

/** Seconds to limber up, move along the road and bring the gun into action again. */
export const RELOCATE_SECONDS = 150;
/** Seconds from calling for a star shell to its light over the target. */
export const ILLUMINATE_SECONDS = 10;

export function createField(rules: FieldRules, targets: FieldTarget[], seed: string): FieldEngagement {
  return {
    rules,
    seed,
    targets,
    index: 0,
    hitsOnTarget: 0,
    gunX: 0,
    time: 0,
    shots: [],
    enemyRounds: [],
    ranging: 0,
    enemyNext: rules.enemy ? rules.enemy.opensAt : Infinity,
    silenced: false,
    relocationsLeft: rules.relocations.count,
    starShellsLeft: rules.night?.starShells ?? 0,
    lit: [],
    lastCharge: null,
    outcome: null,
  };
}

/* ---------- Where things are ---------- */

/** A target's position at game time `time`. */
export function targetAt(e: FieldEngagement, time = e.time, index = e.index) {
  const t = e.targets[index];
  return { x: t.x + t.vx * time, z: t.z + t.vz * time };
}

/** The current target's distance from the gun, along the line of fire, at `time`. */
export const fieldDistance = (e: FieldEngagement, time = e.time) => targetAt(e, time).x - e.gunX;

/** How far the ground at the target lies above (+) or below the gun. */
export const heightDifference = (e: FieldEngagement, time = e.time) => heightAt(e.rules.terrain, targetAt(e, time).x) - heightAt(e.rules.terrain, e.gunX);

export const fieldRoundsLeft = (e: FieldEngagement) => Math.max(0, e.rules.ammo - e.shots.length);
export const fieldTimeLeft = (e: FieldEngagement) => (e.rules.deadline === null ? null : Math.max(0, e.rules.deadline - e.time));

/** Whether a star shell is burning over the target at game time `time`. */
export const litAt = (e: FieldEngagement, time: number) => e.lit.some((l) => time >= l.from && time <= l.to);

/** The random stream for one thing that happens in this battle, the same every time it is replayed. */
const chance = (e: FieldEngagement, what: string, n: number) => createRng(`over-short/field/${e.seed}/${what}/${n}`).float;

/** The wind one round meets: the mean, pushed about by a gust in strength and a little in direction. */
export function windFor(e: FieldEngagement, round: number): Wind {
  const { wind, gusts } = e.rules;
  if (gusts === 0) return wind;
  const r = chance(e, "gust", round);
  const strength = 1 + gusts * (r() * 2 - 1);
  const turn = gusts * 0.6 * (r() * 2 - 1);
  const along = wind.along * Math.cos(turn) - wind.across * Math.sin(turn);
  const across = wind.along * Math.sin(turn) + wind.across * Math.cos(turn);
  return { along: along * strength, across: across * strength };
}

/* ---------- The observer ---------- */

const roundTo = (metres: number, step: number) => Math.round(metres / step) * step;

/**
 * What the observer reports for a round that fell `miss` metres from the
 * target (positive over and right). Their eye is good but not perfect: the
 * judged distance is off by up to `error` of the miss, then rounded.
 */
export function observeField(e: FieldEngagement, round: number, miss: { along: number; across: number }, hit: boolean, destroyed: boolean, landedAt: number, distance: number): FieldReport {
  const atTarget = e.shots.filter((s) => s.target === e.index).length + 1;
  if (e.rules.smoke.includes(atTarget)) return { kind: "lost", destroyed };
  if (hit) return { kind: "target", destroyed };
  const { error, rounding } = e.rules.observer;
  if (e.rules.night && !litAt(e, landedAt)) {
    // Only the flash: a burst beyond the target lights it from behind, one short throws its shadow.
    const range = Math.abs(miss.along) < rounding ? null : miss.along > 0 ? "over" : "short";
    const line = Math.abs(miss.across) < rounding ? null : miss.across > 0 ? "right" : "left";
    return { kind: "flash", range, line };
  }
  const r = chance(e, "observer", round);
  const judged = (metres: number) => metres * (1 + error * (r() * 2 - 1));
  const along = roundTo(judged(miss.along), rounding);
  const across = roundTo(judged(miss.across), Math.min(rounding, 10));
  return {
    kind: "correction",
    range: along === 0 ? null : { word: along > 0 ? "drop" : "add", metres: Math.abs(along) },
    line: across === 0 ? null : { word: across > 0 ? "left" : "right", metres: Math.abs(across), mils: Math.round(Math.abs(across) / Math.max(1, distance / 1000)) },
  };
}

/* ---------- Orders ---------- */

export function actField(e: FieldEngagement, action: FieldAction): { engagement: FieldEngagement; events: FieldEvent[] } {
  if (e.outcome) return { engagement: e, events: [] };
  if (action.kind === "relocate") return relocate(e, action.direction);
  if (action.kind === "illuminate") return illuminate(e);
  const { aim } = action;
  const limits = e.rules.limits;
  if (aim.elevation < limits.elevation.min || aim.elevation > limits.elevation.max) return refuse(e, "elevation");
  if (Math.abs(aim.line) > limits.line) return refuse(e, "line");
  if (aim.charge < 1 || aim.charge > e.rules.gun.charges.length || !Number.isInteger(aim.charge)) return refuse(e, "charge");
  return fire(e, aim);
}

const refuse = (e: FieldEngagement, reason: Extract<FieldEvent, { kind: "refused" }>["reason"]) => ({ engagement: e, events: [{ kind: "refused" as const, reason }] });

function fire(e: FieldEngagement, aim: Aim): { engagement: FieldEngagement; events: FieldEvent[] } {
  const round = e.shots.length + 1;
  const wind = windFor(e, round);
  const powder = 1 + e.rules.dispersion * (chance(e, "powder", round)() * 2 - 1);
  const flight = flyField(e.rules.gun, aim, e.gunX, e.rules.terrain, wind, { speed: (1 + e.rules.wear) * powder });
  const landedAt = e.time + flight.time;
  const at = targetAt(e, landedAt);
  const target = e.targets[e.index];
  const miss = { along: flight.burst.x - at.x, across: flight.burst.z - at.z };
  const hit = Math.hypot(miss.along, miss.across) < target.radius;

  // The enemy's rounds that fall while ours is in the air come first.
  let next: FieldEngagement = e;
  const events: FieldEvent[] = [];
  const before = enemyFire(next, landedAt, false);
  next = before.engagement;
  events.push(...before.events);
  const gunLost = next.outcome === "gun-lost";

  const late = e.rules.deadline !== null && landedAt > e.rules.deadline;
  const hitsOnTarget = e.hitsOnTarget + (hit && !late ? 1 : 0);
  const destroyed = hit && !late && hitsOnTarget >= target.hits;
  const report = observeField(e, round, miss, hit && !late, destroyed, landedAt, fieldDistance(e, landedAt));
  const shot: FieldShot = { round, target: e.index, aim, firedAt: e.time, wind, flight, targetAt: at, miss, hit: hit && !late, destroyed, gunX: e.gunX, report };
  const pause = e.rules.reload + (e.lastCharge !== null && e.lastCharge !== aim.charge ? e.rules.recharge : 0);
  next = { ...next, shots: [...next.shots, shot], lastCharge: aim.charge };
  // The gun was knocked out with this round in the air: it still comes down, but the battle was already lost.
  if (gunLost) return { engagement: next, events: [...events.filter((v) => v.kind !== "over"), { kind: "shot", shot }, { kind: "over", outcome: "gun-lost" }] };
  if (late) return finish({ ...next, time: landedAt }, "out-of-time", [...events, { kind: "too-late", shot }]);

  events.push({ kind: "shot", shot });
  next = { ...next, hitsOnTarget, time: landedAt };
  if (destroyed) {
    events.push({ kind: "target-destroyed", target: e.index });
    if (e.rules.enemy?.isTarget && target.kind === "battery") next = { ...next, silenced: true };
    if (e.index + 1 >= e.targets.length) return finish(next, "won", events);
    next = { ...next, index: e.index + 1, hitsOnTarget: 0 };
    events.push({ kind: "next-target", target: next.index });
  }
  if (next.shots.length >= next.rules.ammo) return finish(next, "out-of-ammo", events);
  // Laying and loading the next round, while the enemy keeps on.
  const after = enemyFire({ ...next, time: landedAt + pause }, landedAt + pause, false);
  if (after.engagement.outcome) return { engagement: after.engagement, events: [...events, ...after.events] };
  return checkClock(after.engagement, [...events, ...after.events]);
}

function relocate(e: FieldEngagement, direction: 1 | -1): { engagement: FieldEngagement; events: FieldEvent[] } {
  if (e.relocationsLeft <= 0) return refuse(e, "no-moves");
  const by = direction * e.rules.relocations.step;
  const done = e.time + RELOCATE_SECONDS;
  // While the gun is on the road, the enemy's rounds fall on the empty pit.
  const meanwhile = enemyFire(e, done, true);
  const next: FieldEngagement = { ...meanwhile.engagement, time: done, gunX: e.gunX + by, ranging: 0, relocationsLeft: e.relocationsLeft - 1 };
  return checkClock(next, [...meanwhile.events, { kind: "relocated", by }]);
}

function illuminate(e: FieldEngagement): { engagement: FieldEngagement; events: FieldEvent[] } {
  if (!e.rules.night) return refuse(e, "daylight");
  if (e.starShellsLeft <= 0) return refuse(e, "no-star-shells");
  const from = e.time + ILLUMINATE_SECONDS;
  const to = from + e.rules.night.burn;
  const meanwhile = enemyFire(e, from, false);
  const next: FieldEngagement = { ...meanwhile.engagement, time: from, starShellsLeft: e.starShellsLeft - 1, lit: [...e.lit, { from, to }] };
  if (next.outcome) return { engagement: next, events: meanwhile.events };
  return checkClock(next, [...meanwhile.events, { kind: "illuminated", from, to }]);
}

/**
 * The enemy battery's rounds due before game time `until`. Each falls
 * nearer the gun than the last as their observer corrects; the first at a
 * new position starts far out again. While the gun is on the move they fall
 * on the pit it left.
 */
function enemyFire(e: FieldEngagement, until: number, moving: boolean): { engagement: FieldEngagement; events: FieldEvent[] } {
  const enemy = e.rules.enemy;
  if (!enemy || e.silenced) return { engagement: e, events: [] };
  let next = e;
  const events: FieldEvent[] = [];
  while (next.enemyNext <= until && !next.outcome) {
    const n = next.enemyRounds.length + 1;
    const r = chance(e, "enemy", n);
    const expected = enemy.first * enemy.closing ** next.ranging;
    const miss = expected * (0.85 + r() * 0.3);
    const onGun = !moving && miss <= enemy.lethal;
    // Their rounds come in from their side of the line and walk towards the gun.
    const bearing = (r() * 2 - 1) * 0.9;
    const round: FieldEnemyRound = {
      at: next.enemyNext,
      x: next.gunX + (onGun ? 0 : Math.cos(bearing) * miss),
      z: onGun ? 0 : Math.sin(bearing) * miss,
      miss: onGun ? 0 : miss,
      onGun,
      emptyPit: moving,
    };
    next = { ...next, enemyRounds: [...next.enemyRounds, round], ranging: moving ? next.ranging : next.ranging + 1, enemyNext: next.enemyNext + enemy.interval };
    events.push({ kind: "enemy-round", round });
    if (onGun) return finish(next, "gun-lost", events);
  }
  return { engagement: next, events };
}

function checkClock(e: FieldEngagement, events: FieldEvent[]) {
  if (e.rules.deadline !== null && e.time >= e.rules.deadline) return finish(e, "out-of-time", events);
  return { engagement: e, events };
}

function finish(e: FieldEngagement, outcome: FieldOutcome, events: FieldEvent[]) {
  return { engagement: { ...e, outcome }, events: [...events, { kind: "over" as const, outcome }] };
}

/** How close the enemy's next round is expected to fall at the gun's present position. */
export function enemyExpected(e: FieldEngagement): number | null {
  const enemy = e.rules.enemy;
  if (!enemy || e.silenced) return null;
  return enemy.first * enemy.closing ** e.ranging;
}
