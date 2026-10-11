import { enemyExpected, fieldDistance, fieldRoundsLeft, fieldTimeLeft, heightDifference, litAt, targetAt, type FieldAction, type FieldEngagement, type FieldReport } from "./field";
import { firingTable, flyField, milsFor, muzzleSpeedOf, type Aim, type FiringTableRow } from "./fieldModel";
import { heightAt } from "./terrain";

/*
 * Players for Field Artillery's simulations.
 *
 * The gunner sees what the screen shows: the firing table for each charge,
 * the map (the target's distance, the ground's heights, the crest in the
 * way), the wind forecast, the observer's corrections, the enemy's last
 * round. Like a battery officer they register the gun: every corrected
 * round says how far this charge is really throwing compared with the
 * table, and the next round is laid for the target less that difference.
 *
 * The oracle knows the physics and the mean wind exactly and solves for
 * the aim; it hears nothing. It exists for the checks: if it wins every
 * attempt, no mission was ever dealt that cannot be won.
 */

export type FieldSeen = {
  tables: FiringTableRow[][];
  limits: FieldEngagement["rules"]["limits"];
  target: { distance: number; across: number; height: number; along: number; acrossSpeed: number; radius: number; hitsLeft: number };
  /** The highest ground between the gun and the target, as the map shows it: where, and how far above the gun. */
  crest: { at: number; height: number } | null;
  /** The forecast: the mean wind, to the nearest half metre a second. */
  wind: { along: number; across: number };
  /** This target's rounds: the aim, the observer's report, the time of flight, where the gun and target were. */
  shots: { aim: Aim; report: FieldReport; time: number; firedAt: number; distanceAtBurst: number; acrossAtBurst: number }[];
  roundsLeft: number;
  timeLeft: number | null;
  now: number;
  night: { lit: (time: number) => boolean; starShellsLeft: number } | null;
  enemy: { lastMiss: number | null; expected: number | null } | null;
  relocationsLeft: number;
};

/** What the firing screen tells the player about a Field Artillery engagement. */
export function fieldSeen(e: FieldEngagement): FieldSeen {
  const target = e.targets[e.index];
  const at = targetAt(e);
  const gunHeight = heightAt(e.rules.terrain, e.gunX);
  const targetHeight = heightAt(e.rules.terrain, at.x);
  // A crest is ground standing above the straight line from the gun to the target: a slope rising to the target is not one.
  let crest: FieldSeen["crest"] = null;
  let worst = 15;
  for (let x = e.gunX + 200; x < at.x - 60; x += 20) {
    const h = heightAt(e.rules.terrain, x);
    const sight = gunHeight + ((x - e.gunX) / (at.x - e.gunX)) * (targetHeight - gunHeight);
    if (h - sight > worst) {
      worst = h - sight;
      crest = { at: x - e.gunX, height: Math.round(h - gunHeight) };
    }
  }
  const told = e.rules.told;
  // Where the map put the target when each round came down: the player never learns where it truly was.
  const shots = e.shots
    .filter((s) => s.target === e.index)
    .map((s) => ({ aim: s.aim, report: s.report, time: s.flight.time, firedAt: s.firedAt, distanceAtBurst: s.targetAt.x - s.gunX + told.mapError.along, acrossAtBurst: s.targetAt.z + told.mapError.across }));
  const lastEnemy = e.ranging > 0 ? (e.enemyRounds.at(-1) ?? null) : null;
  return {
    tables: e.rules.gun.charges.map((_, i) => firingTable(e.rules.gun, i + 1)),
    limits: e.rules.limits,
    target: {
      distance: Math.round((fieldDistance(e) + told.mapError.along) / 10) * 10,
      across: Math.round((at.z + told.mapError.across) / 10) * 10,
      height: Math.round(heightDifference(e) / 5) * 5,
      along: Math.round(target.vx * 2) / 2,
      acrossSpeed: Math.round(target.vz * 2) / 2,
      radius: target.radius,
      hitsLeft: target.hits - e.hitsOnTarget,
    },
    crest,
    wind: told.forecast,
    shots,
    roundsLeft: fieldRoundsLeft(e),
    timeLeft: fieldTimeLeft(e),
    now: e.time,
    night: e.rules.night ? { lit: (time) => litAt(e, time), starShellsLeft: e.starShellsLeft } : null,
    enemy: e.rules.enemy && !e.silenced ? { lastMiss: lastEnemy ? lastEnemy.miss : null, expected: enemyExpected(e) } : null,
    relocationsLeft: e.relocationsLeft,
  };
}

export type FieldBot = (view: FieldSeen) => FieldAction;

export function playField(start: FieldEngagement, bot: FieldBot, act: (e: FieldEngagement, a: FieldAction) => { engagement: FieldEngagement }, budget = 60): FieldEngagement {
  let e = start;
  for (let i = 0; i < budget && !e.outcome; i++) e = act(e, bot(fieldSeen(e))).engagement;
  return e;
}

/* ---------- Reading the table ---------- */

/** The elevation for `range` in one charge's table, on the low road (up to 45°) or the high one. */
export function elevationFromTable(table: FiringTableRow[], range: number, high: boolean): number | null {
  const rows = high ? table.filter((r) => r.elevation >= 45) : table.filter((r) => r.elevation <= 45);
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if ((a.range - range) * (b.range - range) <= 0 && a.range !== b.range) return a.elevation + ((range - a.range) / (b.range - a.range)) * (b.elevation - a.elevation);
  }
  return null;
}

/** A table column at an elevation, read between the rows. */
export function tableAt(table: FiringTableRow[], elevation: number, column: "range" | "time" | "apex" | "drift" | "tail"): number {
  for (let i = 0; i + 1 < table.length; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (elevation >= a.elevation && elevation <= b.elevation) return a[column] + ((elevation - a.elevation) / (b.elevation - a.elevation)) * (b[column] - a[column]);
  }
  return elevation < table[0].elevation ? table[0][column] : table[table.length - 1][column];
}

/** How high the path stands above the gun at `x`, read from the table as a parabola, a little pessimistic on the way down. */
function heightOnPath(table: FiringTableRow[], elevation: number, x: number) {
  const range = tableAt(table, elevation, "range");
  const apex = tableAt(table, elevation, "apex");
  const k = x / range;
  return 4 * apex * k * (1 - k) * (k > 0.5 ? 0.85 : 1);
}

/* ---------- The gunner ---------- */

type Plan = { charge: number; elevation: number; high: boolean; time: number };
type SeenShot = FieldSeen["shots"][number];

/** Where the observer's report says the round came down, relative to the target (positive over and right), or null. */
function burstFrom(report: FieldReport): { along: number | null; across: number | null } {
  if (report.kind === "target") return { along: 0, across: 0 };
  if (report.kind !== "correction") return { along: null, across: null };
  const along = report.range ? (report.range.word === "drop" ? report.range.metres : -report.range.metres) : 0;
  const across = report.line ? (report.line.word === "left" ? report.line.metres : -report.line.metres) : 0;
  return { along, across };
}

/** Before any round: how much longer than the table a charge should throw, for the forecast wind and the target's height. */
function expectedBias(v: FieldSeen, charge: number, elevation: number) {
  const table = v.tables[charge - 1];
  const fall = Math.max(0.15, ((4 * tableAt(table, elevation, "apex")) / tableAt(table, elevation, "range")) * 1.3);
  return v.wind.along * tableAt(table, elevation, "tail") - v.target.height / fall;
}

/**
 * What the rounds so far say the table and the forecast cannot: how much
 * further every round has come down than expected (the map's error, this
 * barrel's wear, the forecast's), the same for every charge and road. From
 * the observer's corrections, the latest counting most; with only flashes,
 * the middle of what has been seen too long and too short. Null before any
 * round has said anything.
 */
function registeredExcess(v: FieldSeen): number | null {
  let weighted = 0;
  let weights = 0;
  let atLeast = -Infinity;
  let atMost = Infinity;
  v.shots.forEach((s, i) => {
    const table = v.tables[s.aim.charge - 1];
    const expected = tableAt(table, s.aim.elevation, "range") + expectedBias(v, s.aim.charge, s.aim.elevation);
    const burst = burstFrom(s.report);
    if (burst.along !== null) {
      weighted += (s.distanceAtBurst + burst.along - expected) * (i + 1);
      weights += i + 1;
    } else if (s.report.kind === "flash" && s.report.range) {
      if (s.report.range === "over") atLeast = Math.max(atLeast, s.distanceAtBurst - expected);
      else atMost = Math.min(atMost, s.distanceAtBurst - expected);
    }
  });
  if (weights) return weighted / weights;
  if (Number.isFinite(atLeast) && Number.isFinite(atMost)) return (atLeast + atMost) / 2;
  if (Number.isFinite(atLeast)) return atLeast + 120;
  if (Number.isFinite(atMost)) return atMost - 120;
  return null;
}

/** How much longer than the table a charge will throw at an elevation: the expected wind and height, and whatever the rounds have shown besides. */
const biasFor = (v: FieldSeen, charge: number, elevation: number) => expectedBias(v, charge, elevation) + (registeredExcess(v) ?? 0);

/** How far right of where it was laid the last corrected round came down (wind and map together), or null. */
function registeredDrift(v: FieldSeen, charge: number, elevation: number): number | null {
  const latest = [...v.shots].reverse().find((s: SeenShot) => burstFrom(s.report).across !== null);
  if (!latest) return null;
  const laid = Math.tan((latest.aim.line * 2 * Math.PI) / 6400) * latest.distanceAtBurst;
  const drift = latest.acrossAtBurst + (burstFrom(latest.report).across ?? 0) - laid;
  if (latest.aim.charge === charge) return drift;
  // Another charge: the map's part carries over, the wind's part scales with this charge's own drift.
  const was = v.wind.across * tableAt(v.tables[latest.aim.charge - 1], latest.aim.elevation, "drift");
  return drift - was + v.wind.across * tableAt(v.tables[charge - 1], elevation, "drift");
}

/**
 * The charge, road and elevation for this round. Every charge is tried on
 * both roads: the path must clear any crest with room to spare; then an
 * elevation in the comfortable middle of the table, a charge already
 * registered over a fresh one, and for a moving target the shortest flight.
 */
function choosePlan(v: FieldSeen, lastCharge: number | null, margin = 45, fast = false): (Plan & { distance: number; across: number }) | null {
  const plans: (Plan & { distance: number; across: number; score: number })[] = [];
  const moving = v.target.along !== 0 || v.target.acrossSpeed !== 0;
  v.tables.forEach((table, i) => {
    const charge = i + 1;
    for (const high of [false, true]) {
      let elevation = high ? 55 : 25;
      let time = tableAt(table, elevation, "time");
      let ok = true;
      for (let pass = 0; pass < 3; pass++) {
        // A moving target: aim where it will be when the round comes down.
        const distance = v.target.distance + v.target.along * time;
        const found = elevationFromTable(table, distance - biasFor(v, charge, elevation), high);
        if (found === null) {
          ok = false;
          break;
        }
        elevation = found;
        time = tableAt(table, elevation, "time");
      }
      if (!ok || elevation < v.limits.elevation.min || elevation > v.limits.elevation.max) continue;
      if (v.crest && heightOnPath(table, elevation, v.crest.at) < v.crest.height + margin) continue;
      const score = (moving || fast ? time : Math.abs(elevation - 27)) + (high ? 30 : 0) + (lastCharge !== null && charge !== lastCharge ? 12 : 0);
      plans.push({ charge, elevation, high, time, score, distance: v.target.distance + v.target.along * time, across: v.target.across + v.target.acrossSpeed * time });
    }
  });
  plans.sort((a, b) => a.score - b.score);
  // Nothing clears the crest with room to spare: settle for less room rather than none.
  if (!plans.length && v.crest && margin > 0) return choosePlan(v, lastCharge, margin > 20 ? 20 : 0, fast);
  return plans[0] ?? null;
}

/** `fast` prefers the charge with the shortest flight (the duel's aggressive commander); `moveInside` 0 never moves the gun. */
export function fieldGunnerBot(options: { moveInside?: number; fast?: boolean } = {}): FieldBot {
  const moveInside = options.moveInside ?? 170;
  return (v) => {
    if (v.enemy?.lastMiss !== null && v.enemy?.lastMiss !== undefined && v.enemy.lastMiss < moveInside && v.relocationsLeft > 0) return { kind: "relocate", direction: -1 };
    const last = v.shots[v.shots.length - 1];
    const plan = choosePlan(v, last ? last.aim.charge : null, 45, options.fast);
    if (!plan) return { kind: "fire", aim: { charge: v.tables.length, elevation: 40, line: 0 } };
    // At night, light the target up for the round about to be fired, while the star shells last.
    if (v.night && v.night.starShellsLeft > 0 && !v.night.lit(v.now + 10 + plan.time)) return { kind: "illuminate" };
    const drift = registeredDrift(v, plan.charge, plan.elevation) ?? v.wind.across * tableAt(v.tables[plan.charge - 1], plan.elevation, "drift");
    const line = Math.max(-v.limits.line, Math.min(v.limits.line, milsFor(plan.across - drift, plan.distance)));
    return { kind: "fire", aim: { charge: plan.charge, elevation: Math.round(plan.elevation * 100) / 100, line: Math.round(line) } };
  };
}

/**
 * A player at the screen rather than a battery officer: the first round
 * straight from the table at the map's distance, then each report taken
 * at its word but only partly trusted (`share` of each correction), with
 * flashes bracketed in steps that halve when the call flips. They respect
 * the crest, lead a convoy, call star shells and move under fire like the
 * gunner. The checks use them to show each mission's twist matters and to
 * set the medals.
 */
export function fieldHumanBot(
  options: { share?: number; respectsCrest?: boolean; leads?: boolean; lights?: boolean; moves?: boolean; movesInside?: number; minds?: boolean; fast?: boolean } = {},
): FieldBot {
  const share = options.share ?? 0.7;
  const { respectsCrest = true, leads = true, lights = true, moves = true, minds = true } = options;
  const movesInside = options.movesInside ?? 170;
  let plan: { charge: number; high: boolean } | null = null;
  return (v) => {
    if (moves && v.enemy?.lastMiss !== null && v.enemy?.lastMiss !== undefined && v.enemy.lastMiss < movesInside && v.relocationsLeft > 0) return { kind: "relocate", direction: -1 };
    const seen = respectsCrest ? v : { ...v, crest: null };
    const target = leads ? seen.target : { ...seen.target, along: 0, acrossSpeed: 0 };
    const replan = () => {
      const first = choosePlan({ ...seen, target: { ...target, height: 0 }, shots: [], wind: { along: 0, across: minds ? v.wind.across : 0 } }, null, 45, options.fast);
      return first ? { charge: first.charge, high: first.high } : { charge: v.tables.length, high: false };
    };
    // A new charge when the target has moved out of this one's reach (the duel's guns move back).
    if (!plan || elevationFromTable(v.tables[plan.charge - 1], target.distance, plan.high) === null) plan = replan();
    const { charge, high } = plan;
    const table = v.tables[charge - 1];
    const timeAt = (elevation: number) => tableAt(table, elevation, "time");
    if (lights && v.night && v.night.starShellsLeft > 0 && !v.night.lit(v.now + 10 + timeAt(high ? 55 : 25))) return { kind: "illuminate" };
    // Where the target will be when a round laid now comes down, on the map.
    const ahead = (time: number) => ({ distance: target.distance + target.along * time, across: target.across + target.acrossSpeed * time });
    const last = v.shots[v.shots.length - 1];
    let range: number;
    let offset: number;
    if (!last) {
      range = ahead(timeAt(25)).distance;
      offset = minds ? -milsFor(v.wind.across * tableAt(table, 25, "drift"), range) : 0;
    } else {
      // Take the last report at its word, but only partly: drop 200 becomes drop 140.
      const laid = tableAt(table, last.aim.elevation, "range");
      const burst = burstFrom(last.report);
      let along = burst.along ?? 0;
      if (burst.along === null && last.report.kind === "flash" && last.report.range) {
        const flashes = v.shots.filter((s) => s.report.kind === "flash").length;
        along = (last.report.range === "over" ? 1 : -1) * Math.max(60, 280 / 2 ** Math.max(0, flashes - 1));
      }
      range = laid - share * along + (ahead(timeAt(last.aim.elevation)).distance - last.distanceAtBurst);
      const across = burst.across ?? (last.report.kind === "flash" && last.report.line ? (last.report.line === "right" ? 40 : -40) : 0);
      offset = last.aim.line - milsFor(last.acrossAtBurst, last.distanceAtBurst) - milsFor(share * across, range);
    }
    const elevation = elevationFromTable(table, range, high) ?? (high ? 50 : 40);
    const line = milsFor(ahead(timeAt(elevation)).across, range) + offset;
    return { kind: "fire", aim: { charge, elevation: Math.round(elevation * 10) / 10, line: Math.round(Math.max(-v.limits.line, Math.min(v.limits.line, line))) } };
  };
}

/* ---------- The oracle ---------- */

/** Solves for the aim that puts a round on the target in the mean wind, with this barrel's true wear, trying charges from the comfortable middle out. */
export function oracleAim(e: FieldEngagement): Aim | null {
  const { gun: issued, terrain, wind, limits, wear } = e.rules;
  const gun = { ...issued, charges: issued.charges.map((v) => v * (1 + wear)) };
  for (const charge of [3, 2, 4, 1].filter((c) => c <= gun.charges.length)) {
    for (const high of [false, true]) {
      let aim: Aim = { charge, elevation: high ? 55 : 20, line: 0 };
      let ok = false;
      for (let pass = 0; pass < 4; pass++) {
        const time = flyField(gun, aim, e.gunX, terrain, wind).time;
        const at = targetAt(e, e.time + time);
        const lo0 = high ? 45 : limits.elevation.min + 0.5;
        const hi0 = high ? limits.elevation.max : 45;
        let lo = lo0;
        let hi = hi0;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          const f = flyField(gun, { ...aim, elevation: mid }, e.gunX, terrain, wind);
          const long = f.burst.x > at.x;
          if (long !== high) hi = mid;
          else lo = mid;
        }
        const elevation = (lo + hi) / 2;
        const f = flyField(gun, { ...aim, elevation }, e.gunX, terrain, wind);
        const line = aim.line + milsFor(at.z - f.burst.z, at.x - e.gunX);
        aim = { charge, elevation, line };
        const check = flyField(gun, aim, e.gunX, terrain, wind);
        const there = targetAt(e, e.time + check.time);
        ok = Math.hypot(check.burst.x - there.x, check.burst.z - there.z) < 8;
      }
      if (ok && muzzleSpeedOf(gun, charge) > 0) return { ...aim, line: Math.round(aim.line * 10) / 10 };
    }
  }
  return null;
}

/** The oracle as a player: moves when the next enemy round would land close, and otherwise fires its solution. */
export const fieldOracle = (e: FieldEngagement): FieldAction => {
  const expected = enemyExpected(e);
  if (expected !== null && expected < 110 && e.relocationsLeft > 0) return { kind: "relocate", direction: -1 };
  const aim = oracleAim(e);
  return aim ? { kind: "fire", aim } : { kind: "fire", aim: { charge: 4, elevation: 40, line: 0 } };
};
