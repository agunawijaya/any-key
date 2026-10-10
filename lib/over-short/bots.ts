import { roundsLeft, targetDistance, timeLeft, type Action, type Engagement, type TableRow } from "./engagement";
import type { OriginalPlayer } from "./original";

/*
 * Players for the simulations. A bot sees only what the firing screen
 * shows a player (the briefing, the target's distance, the observer's
 * reports, how long each round flew) and never the ballistic model. The
 * checks use them to prove every Campaign mission can be won within its
 * ammunition, and to measure how the 1973 drill treats different players.
 */

export type SeenShot = {
  elevation: number;
  call: "hit" | "over" | "short";
  /** The reported distance of a miss, or null when the observer gives only its direction. */
  distance: number | null;
  /** Seconds the round was seen in the air. */
  time: number;
  target: number;
  /** Where the round came down, as the player can work it out (null without a distance). */
  landed: number | null;
};

export type Seen = {
  maxRange: number | null;
  reports: "direction" | "distance";
  table: TableRow[];
  elevation: { min: number; max: number };
  target: { index: number; distance: number; speed: number; hitsLeft: number };
  roundsLeft: number | null;
  timeLeft: number | null;
  enemy: { lastMiss: number | null } | null;
  relocationsLeft: number;
  shots: SeenShot[];
};

/** What the firing screen tells the player about an engagement. */
export function seen(e: Engagement): Seen {
  const shown = (metres: number) => Math.round(metres / e.rules.rounding) * e.rules.rounding;
  const shots = e.shots.map((s): SeenShot => {
    const t = e.targets[s.target];
    // The player knows where the target was said to be, how fast it moves and how long the round flew.
    const atBurst = shown(s.targetDistance - t.speed * s.flight.time) + t.speed * s.flight.time;
    const signed = s.report.call === "hit" ? 0 : s.report.distance === null ? null : (s.report.call === "over" ? 1 : -1) * s.report.distance;
    return { elevation: s.elevation, call: s.report.call, distance: s.report.distance, time: s.flight.time, target: s.target, landed: signed === null ? null : atBurst + signed };
  });
  const target = e.targets[e.index];
  const lastEnemy = e.enemy[e.enemy.length - 1];
  return {
    maxRange: e.rules.told.maxRange,
    reports: e.rules.reports,
    table: e.rules.told.table,
    elevation: e.rules.elevation,
    target: { index: e.index, distance: shown(targetDistance(e)), speed: target.speed, hitsLeft: target.hits - e.hitsOnTarget },
    roundsLeft: roundsLeft(e),
    timeLeft: timeLeft(e),
    enemy: e.rules.counterfire ? { lastMiss: e.enemyRanging > 0 && lastEnemy ? lastEnemy.miss : null } : null,
    relocationsLeft: e.relocationsLeft,
    shots,
  };
}

export type Bot = (view: Seen) => Action;

/** Plays an engagement to its end; a budget stops a bot that would never finish. */
export function playOut(start: Engagement, bot: Bot, act: (e: Engagement, a: Action) => { engagement: Engagement }, budget = 200): Engagement {
  let e = start;
  for (let i = 0; i < budget && !e.outcome; i++) e = act(e, bot(seen(e))).engagement;
  return e;
}

const fire = (elevation: number): Action => ({ kind: "fire", elevation });
const clampTo = (v: Seen, elevation: number) => Math.min(v.elevation.max, Math.max(v.elevation.min, elevation));

/** Low angles unless the briefing forbids them. */
const highRoad = (v: Seen) => v.elevation.min > 45;

/** The rule of thumb with no formula: elevation in proportion to distance, 45° for the greatest range. */
function ruleOfThumb(v: Seen, distance: number) {
  if (v.maxRange === null) return highRoad(v) ? 60 : 30;
  const low = 45 * Math.min(1, distance / v.maxRange);
  return highRoad(v) ? 90 - low : low;
}

const atTarget = (v: Seen) => v.shots.filter((s) => s.target === v.target.index);

/** A target that takes more than one hit: the elevation that hit it last, or null. */
function lastHit(v: Seen) {
  const hits = atTarget(v).filter((s) => s.call === "hit");
  return hits.length && v.target.speed === 0 ? hits[hits.length - 1].elevation : null;
}

/** Knows the formula and the true greatest range: the first round always hits in Classic. */
export const calculatorBot: Bot = (v) => {
  const ratio = Math.min(1, v.target.distance / (v.maxRange ?? 1));
  const low = (Math.asin(ratio) * 90) / Math.PI;
  return fire(clampTo(v, highRoad(v) ? 90 - low : low));
};

/**
 * The textbook bracket, from the reports' directions alone: step by a few
 * degrees until one round falls over and one short, then split the
 * difference each time.
 */
export function bracketBot(step = 4): Bot {
  return (v) => {
    const again = lastHit(v);
    if (again !== null) return fire(again);
    const shots = atTarget(v);
    if (!shots.length) return fire(clampTo(v, ruleOfThumb(v, v.target.distance)));
    // On the high road a higher barrel throws shorter, so "too far" means raise it.
    const tooFar = (s: SeenShot) => (s.call === "over") !== highRoad(v);
    const far = shots.filter(tooFar).map((s) => s.elevation);
    const near = shots.filter((s) => !tooFar(s) && s.call !== "hit").map((s) => s.elevation);
    const tooMuch = highRoad(v) ? Math.max(...far) : Math.min(...far);
    const tooLittle = highRoad(v) ? Math.min(...near) : Math.max(...near);
    if (far.length && near.length) return fire(clampTo(v, (tooMuch + tooLittle) / 2));
    const last = shots[shots.length - 1];
    const down = tooFar(last) !== highRoad(v);
    return fire(clampTo(v, last.elevation + (down ? -step : step)));
  };
}

/**
 * The gunner's halving rule with distances: the first correction comes
 * from the reported miss and the rule of thumb (the greatest range spread
 * over 45°); each time the call flips from over to short or back, the
 * correction is halved; while it does not, it is repeated.
 */
export const halvingBot: Bot = (v) => {
  const shots = atTarget(v);
  const again = lastHit(v);
  if (again !== null) return fire(again);
  if (!shots.length) return fire(clampTo(v, ruleOfThumb(v, v.target.distance)));
  const last = shots[shots.length - 1];
  const sign = (last.call === "over") !== highRoad(v) ? -1 : 1;
  if (shots.length === 1 || last.distance === null) {
    const perDegree = (v.maxRange ?? 12000) / 45;
    return fire(clampTo(v, last.elevation + sign * ((last.distance ?? perDegree * 4) / perDegree)));
  }
  const before = shots[shots.length - 2];
  const step = Math.abs(last.elevation - before.elevation);
  const flipped = before.call !== last.call;
  return fire(clampTo(v, last.elevation + sign * (flipped ? step / 2 : step)));
};

/** Nudges one degree after every report, never halving: the slow way to the target. */
export const naiveBot: Bot = (v) => {
  const shots = atTarget(v);
  const again = lastHit(v);
  if (again !== null) return fire(again);
  if (!shots.length) return fire(clampTo(v, ruleOfThumb(v, v.target.distance)));
  const last = shots[shots.length - 1];
  const raise = (last.call === "short") !== highRoad(v);
  return fire(clampTo(v, last.elevation + (raise ? 1 : -1)));
};

type Known = { elevation: number; range: number; time: number };

/**
 * A sensible gunner who reads the observer's distances: every round with a
 * reported distance becomes a row in their own range table, and the next
 * elevation comes from the two rows nearest the target, the way a battery
 * officer interpolates. With only directions to go on, they bracket. They
 * lead a moving target by its speed times the time of flight, move the gun
 * when the enemy's rounds are landing close, and keep to the low road when
 * time is short.
 */
export function gunnerBot(options: { relocateInside?: number } = {}): Bot {
  const relocateInside = options.relocateInside ?? 300;
  const bracket = bracketBot();
  return (v) => {
    if (v.enemy?.lastMiss !== null && v.enemy?.lastMiss !== undefined && v.enemy.lastMiss < relocateInside && v.relocationsLeft > 0) return { kind: "relocate", direction: -1 };
    const again = lastHit(v);
    if (again !== null) return fire(again);
    if (v.reports === "direction") return bracket(v);
    const own: Known[] = v.shots.flatMap((s) => (s.landed === null ? [] : [{ elevation: s.elevation, range: s.landed, time: s.time }]));
    const onRoad = (k: Known) => (k.elevation > 45) === highRoad(v);
    const rows = own.filter(onRoad);
    const table = v.table.filter(onRoad);
    // A moving target: aim where it will be when the round comes down; the time of flight depends on the aim.
    let elevation = aimFor(v, v.target.distance, rows, table);
    for (let i = 0; i < 3 && v.target.speed !== 0; i++) elevation = aimFor(v, v.target.distance + v.target.speed * flightGuess(elevation, rows, table), rows, table);
    return fire(clampTo(v, elevation));
  };
}

function aimFor(v: Seen, distance: number, rows: Known[], table: TableRow[]): number {
  const own = latestPerElevation(rows);
  if (own.length >= 2) return keepToRoad(v, interpolate(v, own, distance));
  if (own.length === 1) {
    const [only] = own;
    // One round of our own: shift it by how fast range changes with elevation there.
    const slope = table.length >= 2 ? slopeAt(table, only.elevation) : highRoad(v) ? -only.range / (90 - only.elevation) : only.range / only.elevation;
    return keepToRoad(v, only.elevation + limit((distance - only.range) / slope, 8));
  }
  if (table.length >= 2) return keepToRoad(v, interpolate(v, table, distance));
  return ruleOfThumb(v, distance);
}

/** Rounds fired twice at one elevation say the same thing: keep the latest. */
function latestPerElevation(rows: Known[]) {
  const byElevation = new Map<number, Known>();
  for (const r of rows) byElevation.set(Math.round(r.elevation * 100), r);
  return [...byElevation.values()].sort((a, b) => a.elevation - b.elevation);
}

/** Never let a correction carry the barrel over to the other road. */
function keepToRoad(v: Seen, elevation: number) {
  return highRoad(v) ? Math.max(46, elevation) : Math.min(44, elevation);
}

/**
 * The elevation for `distance` from rows sorted by elevation: between two
 * neighbours that straddle it, by proportion; beyond them all, by the
 * slope of the two nearest, or a firm step where the table has gone flat
 * (near the greatest range, raising the barrel hardly adds a metre).
 */
function interpolate(v: Seen, rows: Known[], distance: number): number {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if ((a.range - distance) * (b.range - distance) <= 0 && a.range !== b.range) return a.elevation + ((distance - a.range) / (b.range - a.range)) * (b.elevation - a.elevation);
  }
  const [a, b] = [...rows].sort((p, q) => Math.abs(p.range - distance) - Math.abs(q.range - distance));
  const slope = (b.range - a.range) / (b.elevation - a.elevation);
  // Range grows with elevation on the low road and shrinks on the high road.
  const rising = highRoad(v) ? -1 : 1;
  const wantMore = distance > a.range;
  if (slope * rising < 20) return a.elevation + (wantMore === (rising > 0) ? 2 : -2);
  return a.elevation + limit((distance - a.range) / slope, 8);
}

function slopeAt(table: Known[], elevation: number) {
  const sorted = [...table].sort((p, q) => p.elevation - q.elevation);
  let i = sorted.findIndex((r) => r.elevation > elevation);
  if (i <= 0) i = i === 0 ? 1 : sorted.length - 1;
  const a = sorted[i - 1];
  const b = sorted[i];
  return (b.range - a.range) / (b.elevation - a.elevation);
}

/** Time of flight at `elevation`, scaled from the nearest round seen: longer as the barrel rises. */
function flightGuess(elevation: number, rows: Known[], table: TableRow[]) {
  const all = [...rows, ...table];
  if (!all.length) return 30;
  const near = all.reduce((best, r) => (Math.abs(r.elevation - elevation) < Math.abs(best.elevation - elevation) ? r : best));
  return (near.time * Math.sin((elevation * Math.PI) / 180)) / Math.sin((near.elevation * Math.PI) / 180);
}

const limit = (value: number, most: number) => Math.max(-most, Math.min(most, value));

/**
 * The same bots at the 1973 programs' prompt: they hear "over" or "short"
 * and a distance (wrong in direction when the round fell exactly 100
 * short, as the programs had it), see no flight, and never type an
 * elevation outside 1–89.
 */
export function asOriginalPlayer(bot: Bot): OriginalPlayer {
  // One gun for the whole game, so a player with a notepad keeps every round, not just this target's.
  let shots: SeenShot[] = [];
  let lastElevation = 0;
  let lastTarget = { number: 0, distance: 0 };
  return (view, last) => {
    if (last && (last.kind === "over" || last.kind === "short")) {
      const signed = (last.kind === "over" ? 1 : -1) * last.distance;
      shots = [...shots, { elevation: lastElevation, call: last.kind, distance: last.distance, time: 0, target: view.targetNumber - 1, landed: view.target + signed }];
    } else if (last?.kind === "hit") {
      shots = [...shots, { elevation: lastElevation, call: "hit", distance: null, time: 0, target: lastTarget.number - 1, landed: lastTarget.distance }];
    }
    lastTarget = { number: view.targetNumber, distance: view.target };
    const elevation = bot({
      maxRange: view.maxRange,
      reports: "distance",
      table: [],
      elevation: { min: 1, max: 89 },
      target: { index: view.targetNumber - 1, distance: view.target, speed: 0, hitsLeft: 1 },
      roundsLeft: 5 - view.roundsAtTarget,
      timeLeft: null,
      enemy: null,
      relocationsLeft: 0,
      shots,
    });
    lastElevation = elevation.kind === "fire" ? elevation.elevation : 45;
    return lastElevation;
  };
}
