import { bestRange, fly, type Flight, type Gun, type ModelId } from "./models";

/*
 * An engagement: one gun against one or more targets, turn by turn. Every
 * play style builds one from its own setup (Classic's drill, a Campaign
 * mission, later Field Artillery) and the same pure `act` runs it, so the
 * firing screen, the observer's map and the bots never care which style is
 * playing.
 */

export type TargetKind = "battery" | "dump" | "bridge" | "railyard" | "convoy" | "mast";

export type TargetSpec = {
  kind: TargetKind;
  /** Metres from the gun's first position when the engagement starts. */
  distance: number;
  /** Metres above (+) or below (−) the gun. */
  height: number;
  /** m/s along the line of fire: positive drives away from the gun. */
  speed: number;
  /** A round within this many metres counts as a hit. */
  radius: number;
  /** Hits it takes to destroy it. */
  hits: number;
};

export type TableRow = { elevation: number; range: number; time: number };

/** An enemy battery ranging on the gun: each round lands closer than the last, until one lands on it. */
export type Counterfire = {
  /** How far from the gun their first round lands, metres. */
  first: number;
  /** Each round's miss is this share of the one before. */
  closing: number;
  /** A round this close or closer knocks the gun out. */
  lethal: number;
};

export type Rules = {
  model: ModelId;
  gun: Gun;
  /** Along the line of fire, m/s; positive is a tailwind. */
  wind: number;
  /** What the briefing tells the player. */
  told: {
    /** The gun's greatest range, or null when the player must find it. */
    maxRange: number | null;
    windShown: boolean;
    /** Rows of a range table handed over with the gun. */
    table: TableRow[];
  };
  /** Whether the observer gives the distance of a miss or only its direction. */
  reports: "direction" | "distance";
  /** The observer rounds distances to this many metres. */
  rounding: number;
  /** Rounds for the whole engagement, and rounds per target before the enemy finds the gun (null: no limit). */
  ammo: { total: number | null; perTarget: number | null };
  elevation: { min: number; max: number };
  /** A time limit in game seconds, and how long laying the gun takes between rounds. */
  clock: { limit: number | null; reload: number };
  counterfire: Counterfire | null;
  relocations: { count: number; step: number };
};

export type Report = { call: "hit" | "over" | "short"; distance: number | null };

export type Shot = {
  round: number;
  target: number;
  elevation: number;
  firedAt: number;
  /** The target's distance from the gun when the round came down. */
  targetDistance: number;
  flight: Flight;
  /** Landed minus target: positive is over. */
  miss: number;
  report: Report;
  hit: boolean;
  destroyed: boolean;
};

export type EnemyRound = { at: number; miss: number; onGun: boolean; emptyPit: boolean };

export type Outcome = "won" | "gun-lost" | "out-of-ammo" | "out-of-time";

export type Engagement = {
  rules: Rules;
  targets: TargetSpec[];
  index: number;
  hitsOnTarget: number;
  /** How far the gun has moved along the line of fire from where it started (relocations). */
  gunAt: number;
  /** Game seconds since the first order. */
  time: number;
  shots: Shot[];
  enemy: EnemyRound[];
  /** Rounds the enemy has fired at the gun's present position. */
  enemyRanging: number;
  relocationsLeft: number;
  outcome: Outcome | null;
};

export type Action = { kind: "fire"; elevation: number } | { kind: "relocate"; direction: 1 | -1 };

export type TurnEvent =
  | { kind: "shot"; shot: Shot }
  | { kind: "target-destroyed"; target: number }
  | { kind: "next-target"; target: number }
  | { kind: "enemy-round"; round: EnemyRound }
  | { kind: "relocated"; by: number }
  | { kind: "refused"; reason: "too-low" | "too-high" | "no-moves" }
  | { kind: "too-late"; shot: Shot }
  | { kind: "over"; outcome: Outcome };

/** Seconds it takes to move the gun to a new pit. */
export const RELOCATE_SECONDS = 90;

export function createEngagement(rules: Rules, targets: TargetSpec[]): Engagement {
  return { rules, targets, index: 0, hitsOnTarget: 0, gunAt: 0, time: 0, shots: [], enemy: [], enemyRanging: 0, relocationsLeft: rules.relocations.count, outcome: null };
}

/** The current target's distance from the gun at game time `time`. */
export function targetDistance(e: Engagement, time = e.time, index = e.index) {
  const t = e.targets[index];
  return t.distance + t.speed * time - e.gunAt;
}

export const currentTarget = (e: Engagement) => e.targets[e.index];
export const roundsAtTarget = (e: Engagement, index = e.index) => e.shots.filter((s) => s.target === index).length;

export function roundsLeft(e: Engagement): number | null {
  const { total, perTarget } = e.rules.ammo;
  const left = [total === null ? Infinity : total - e.shots.length, perTarget === null ? Infinity : perTarget - roundsAtTarget(e)];
  const least = Math.min(...left);
  return least === Infinity ? null : least;
}

export const timeLeft = (e: Engagement) => (e.rules.clock.limit === null ? null : Math.max(0, e.rules.clock.limit - e.time));

/** How the observer calls a fall of shot. */
export function observe(miss: number, radius: number, rules: Pick<Rules, "reports" | "rounding">): Report {
  if (Math.abs(miss) < radius) return { call: "hit", distance: null };
  const call = miss > 0 ? "over" : "short";
  if (rules.reports === "direction") return { call, distance: null };
  const distance = Math.max(rules.rounding, Math.round(Math.abs(miss) / rules.rounding) * rules.rounding);
  return { call, distance };
}

/** Flies a round at `elevation` from the gun's present position at the present moment, without changing anything. */
export function preview(e: Engagement, elevation: number): Flight {
  const t = currentTarget(e);
  return fly(e.rules.model, e.rules.gun, elevation, { distance: Math.max(1, targetDistance(e)), height: t.height }, { wind: e.rules.wind });
}

/** Plays one action; returns the engagement after it and what happened, in order. */
export function act(e: Engagement, action: Action): { engagement: Engagement; events: TurnEvent[] } {
  if (e.outcome) return { engagement: e, events: [] };
  if (action.kind === "relocate") return relocate(e, action.direction);
  const { min, max } = e.rules.elevation;
  if (action.elevation < min) return { engagement: e, events: [{ kind: "refused", reason: "too-low" }] };
  if (action.elevation > max) return { engagement: e, events: [{ kind: "refused", reason: "too-high" }] };
  return fire(e, action.elevation);
}

function fire(e: Engagement, elevation: number): { engagement: Engagement; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const target = currentTarget(e);
  const flight = preview(e, elevation);
  const landedAt = e.time + flight.time;
  const distance = targetDistance(e, landedAt);
  const miss = flight.landed - distance;
  const report = observe(miss, target.radius, e.rules);
  // Against the clock, a round that comes down after time is up cannot count, wherever it falls.
  const late = e.rules.clock.limit !== null && landedAt > e.rules.clock.limit;
  if (late) {
    const shot: Shot = { round: e.shots.length + 1, target: e.index, elevation, firedAt: e.time, targetDistance: distance, flight, miss, report, hit: false, destroyed: false };
    return finish({ ...e, shots: [...e.shots, shot], time: landedAt }, "out-of-time", [{ kind: "too-late", shot }]);
  }
  const hit = report.call === "hit";
  const hitsOnTarget = e.hitsOnTarget + (hit ? 1 : 0);
  const destroyed = hit && hitsOnTarget >= target.hits;
  const shot: Shot = { round: e.shots.length + 1, target: e.index, elevation, firedAt: e.time, targetDistance: distance, flight, miss, report, hit, destroyed };
  events.push({ kind: "shot", shot });

  let next: Engagement = { ...e, shots: [...e.shots, shot], hitsOnTarget, time: landedAt + e.rules.clock.reload };
  if (destroyed) {
    events.push({ kind: "target-destroyed", target: e.index });
    if (e.index + 1 >= e.targets.length) return finish(next, "won", events);
    next = { ...next, index: e.index + 1, hitsOnTarget: 0, enemyRanging: 0 };
    events.push({ kind: "next-target", target: next.index });
    // A destroyed target cannot fire back; a fresh one starts ranging from scratch.
    return { engagement: next, events };
  }
  return afterTurn(next, events);
}

function relocate(e: Engagement, direction: 1 | -1): { engagement: Engagement; events: TurnEvent[] } {
  if (e.relocationsLeft <= 0) return { engagement: e, events: [{ kind: "refused", reason: "no-moves" }] };
  const by = direction * e.rules.relocations.step;
  const events: TurnEvent[] = [{ kind: "relocated", by }];
  let next: Engagement = { ...e, gunAt: e.gunAt + by, relocationsLeft: e.relocationsLeft - 1, time: e.time + RELOCATE_SECONDS, enemyRanging: 0 };
  const coming = nextEnemyMiss(e);
  if (coming && e.enemyRanging > 0) {
    // The round they fire while the gun is on the move falls on the empty pit; then they must find it again.
    const pit: EnemyRound = { at: e.time, miss: coming.lethal ? 0 : coming.miss, onGun: false, emptyPit: true };
    next = { ...next, enemy: [...next.enemy, pit] };
    events.push({ kind: "enemy-round", round: pit });
  }
  return checkClock(next, events);
}

/** After the gun's turn: the enemy answers, then ammunition and the clock are checked. */
function afterTurn(e: Engagement, events: TurnEvent[]): { engagement: Engagement; events: TurnEvent[] } {
  let next = e;
  const cf = e.rules.counterfire;
  if (cf) {
    const miss = cf.first * cf.closing ** e.enemyRanging;
    const onGun = miss <= cf.lethal;
    const round: EnemyRound = { at: e.time, miss: onGun ? 0 : miss, onGun, emptyPit: false };
    next = { ...next, enemy: [...next.enemy, round], enemyRanging: e.enemyRanging + 1 };
    events.push({ kind: "enemy-round", round });
    if (onGun) return finish(next, "gun-lost", events);
  }
  const { total, perTarget } = next.rules.ammo;
  if (perTarget !== null && roundsAtTarget(next) >= perTarget) return finish(next, "gun-lost", events);
  if (total !== null && next.shots.length >= total) return finish(next, "out-of-ammo", events);
  return checkClock(next, events);
}

function checkClock(e: Engagement, events: TurnEvent[]) {
  if (e.rules.clock.limit !== null && e.time >= e.rules.clock.limit) return finish(e, "out-of-time", events);
  return { engagement: e, events };
}

function finish(e: Engagement, outcome: Outcome, events: TurnEvent[]) {
  return { engagement: { ...e, outcome }, events: [...events, { kind: "over" as const, outcome }] };
}

/** How close the enemy's next round will land, when a battery is ranging on the gun. */
export function nextEnemyMiss(e: Engagement): { miss: number; lethal: boolean } | null {
  const cf = e.rules.counterfire;
  if (!cf) return null;
  const miss = cf.first * cf.closing ** e.enemyRanging;
  return { miss, lethal: miss <= cf.lethal };
}

/** Range-table rows for this gun, worked out from its own model: what a battery would be handed with it. */
export function rangeTable(model: ModelId, gun: Gun, elevations: number[], wind = 0): TableRow[] {
  return elevations.map((elevation) => {
    const f = fly(model, gun, elevation, { distance: gun.vacuumRange, height: 0 }, { wind });
    return { elevation, range: Math.round(f.landed / 10) * 10, time: Math.round(f.time) };
  });
}

/** The greatest range the gun really reaches with this model, rounded as a range table would print it. */
export function statedMaxRange(model: ModelId, gun: Gun) {
  return Math.round(bestRange(model, gun).range / 10) * 10;
}
