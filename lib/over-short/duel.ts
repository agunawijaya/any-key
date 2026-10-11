import { createRng, type Rng } from "@/lib/kit/rng";
import type { Difficulty, FieldReport } from "./field";
import { fieldHumanBot, type FieldBot, type FieldSeen } from "./fieldBots";
import { DIFFICULTY } from "./fieldMissions";
import { FIELD_GUN, firingTable, flyField, type Aim, type FieldFlight, type Wind } from "./fieldModel";
import { heightAt, type Terrain } from "./terrain";

/*
 * The Counter-Battery Duel: two guns on opposite sides of a ridge, out of
 * each other's sight, each with an observer up on the crest. Each turn both
 * guns are laid in secret and fire together; the round that comes down
 * first is the one that counts, so a quick, flat flight can win a turn that
 * a slow lob would have won too late. Two hits silence a battery. Instead
 * of firing, a battery may limber up and move back along its road: the
 * other side's round falls on the empty pit, and their observer has to find
 * the gun all over again. Each battery has twenty rounds; if both run dry,
 * the one that took fewer hits has won.
 *
 * World metres run from the west gun's first position towards the east
 * gun; across is positive to the south (the west gunner's right). The east
 * gun fires the other way, so its rounds are flown in its own mirrored
 * frame and turned back into the world's.
 */

export type DuelSide = "west" | "east";
export type Commander = "cautious" | "aggressive" | "methodical";
export type DuelPlayer = "player" | Commander;

export type DuelOrder = { kind: "fire"; aim: Aim } | { kind: "relocate" };

export type DuelShot = {
  round: number;
  side: DuelSide;
  aim: Aim;
  wind: Wind;
  /** The flight in the firing gun's own frame (along its line of fire from where it stood). */
  flight: FieldFlight;
  /** Where it came down in the world, and how far from the enemy gun (along the firer's line: positive over; across: positive to the firer's right). */
  burst: { x: number; z: number };
  miss: { along: number; across: number };
  /** Seconds after the turn began. */
  landedAt: number;
  /** Where the firing battery's map put the enemy gun when it fired: metres out along its line, and across to its right. */
  told: { along: number; across: number };
  hit: boolean;
  /** The hit that silenced the other battery. */
  decisive: boolean;
  report: FieldReport;
};

export type DuelBattery = {
  side: DuelSide;
  player: DuelPlayer;
  /** World metres the gun stands at now. */
  x: number;
  hitsTaken: number;
  relocationsLeft: number;
  /** What this battery's map says about the enemy gun: metres off along and across. */
  mapError: { along: number; across: number };
  /** This barrel's wear, a share of muzzle speed. */
  wear: number;
  /** Own rounds fired at the enemy's present position. */
  shots: DuelShot[];
  /** Rounds left in the pit. */
  rounds: number;
};

export type DuelEngagement = {
  seed: string;
  difficulty: Difficulty;
  terrain: Terrain;
  wind: Wind;
  forecast: Wind;
  gusts: number;
  observer: { error: number; rounding: number };
  west: DuelBattery;
  east: DuelBattery;
  turn: number;
  time: number;
  winner: DuelSide | "draw" | null;
};

export type DuelEvent =
  | { kind: "fired"; shot: DuelShot }
  | { kind: "relocated"; side: DuelSide; by: number }
  | { kind: "empty-pit"; shot: DuelShot }
  | { kind: "over"; winner: DuelSide | "draw" };

export const HITS_TO_SILENCE = 2;
export const DUEL_RADIUS = 25;
/** Rounds each battery brings up: when both are spent, the battery with more hits on the other has won. */
export const DUEL_ROUNDS = 20;
const STEP = 400;
const RELOCATIONS = 2;
const RELOAD = 25;

const within = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng.float();

/** A ridge between two gun positions. */
function duelGround(rng: Rng, distance: number): Terrain {
  const base = within(rng, 25, 40);
  const crestAt = distance * within(rng, 0.42, 0.58);
  const crest = base + within(rng, 110, 150);
  const east = base + within(rng, -5, 20);
  return {
    survey: [
      { x: -2600, height: base - 6 },
      { x: 0, height: base },
      { x: crestAt * 0.4, height: base + (crest - base) * 0.3 },
      { x: crestAt - 350, height: crest - 15 },
      { x: crestAt, height: crest },
      { x: crestAt + 400, height: crest - 25 },
      { x: crestAt + (distance - crestAt) * 0.65, height: east + (crest - east) * 0.3 },
      { x: distance, height: east },
      { x: distance + 2600, height: east - 6 },
    ],
    roughness: 2,
    seed: rng.int(1, 1000),
  };
}

export function createDuel(seed: string, difficulty: Difficulty, west: DuelPlayer, east: DuelPlayer): DuelEngagement {
  const rng = createRng(`over-short/duel/${seed}`);
  const setting = DIFFICULTY[difficulty];
  const distance = Math.round(within(rng, 4200, 6200) / 10) * 10;
  const off = (most: number) => (rng.float() * 2 - 1) * most;
  const wind = { along: off(4) * setting.wind, across: off(6) * setting.wind };
  const battery = (side: DuelSide, player: DuelPlayer, x: number): DuelBattery => ({
    side,
    player,
    x,
    hitsTaken: 0,
    relocationsLeft: RELOCATIONS,
    mapError: { along: Math.round(off(setting.map.along) / 10) * 10, across: Math.round(off(setting.map.across) / 5) * 5 },
    wear: off(0.012),
    shots: [],
    rounds: DUEL_ROUNDS,
  });
  return {
    seed,
    difficulty,
    terrain: duelGround(rng, distance),
    wind,
    forecast: { along: Math.round((wind.along + off(setting.forecast)) * 2) / 2, across: Math.round((wind.across + off(setting.forecast)) * 2) / 2 },
    gusts: setting.gusts,
    observer: { error: setting.error, rounding: setting.rounding },
    west: battery("west", west, 0),
    east: battery("east", east, distance),
    turn: 0,
    time: 0,
    winner: null,
  };
}

/* ---------- Each side's frame ---------- */

/** +1 for the west gun, which fires towards larger world x; −1 for the east. */
const facing = (side: DuelSide) => (side === "west" ? 1 : -1);
export const enemyOf = (side: DuelSide): DuelSide => (side === "west" ? "east" : "west");

/** The wind as one side's gunners feel it: along their line of fire, and across it to their right. */
export const windFor = (wind: Wind, side: DuelSide): Wind => ({ along: wind.along * facing(side), across: wind.across * facing(side) });

/** The ground along one side's line of fire, metres out from its gun. */
const groundFor = (e: DuelEngagement, side: DuelSide) => (x: number) => heightAt(e.terrain, e[side].x + facing(side) * x);

/** How far apart the guns stand now. */
export const duelDistance = (e: DuelEngagement) => e.east.x - e.west.x;

/* ---------- A turn ---------- */

const chance = (e: DuelEngagement, what: string) => createRng(`over-short/duel/${e.seed}/${what}`).float;

function gusted(e: DuelEngagement, side: DuelSide): Wind {
  const r = chance(e, `gust/${e.turn}/${side}`);
  const strength = 1 + e.gusts * (r() * 2 - 1);
  return { along: e.wind.along * strength, across: e.wind.across * strength };
}

function report(e: DuelEngagement, side: DuelSide, miss: { along: number; across: number }, hit: boolean, decisive: boolean, distance: number): FieldReport {
  if (hit) return { kind: "target", destroyed: decisive };
  const r = chance(e, `observer/${e.turn}/${side}`);
  const judged = (metres: number) => metres * (1 + e.observer.error * (r() * 2 - 1));
  const along = Math.round(judged(miss.along) / e.observer.rounding) * e.observer.rounding;
  const across = Math.round(judged(miss.across) / 10) * 10;
  return {
    kind: "correction",
    range: along === 0 ? null : { word: along > 0 ? "drop" : "add", metres: Math.abs(along) },
    line: across === 0 ? null : { word: across > 0 ? "left" : "right", metres: Math.abs(across), mils: Math.round(Math.abs(across) / Math.max(1, distance / 1000)) },
  };
}

/**
 * Plays one turn: both orders at once. Relocations happen first (the gun
 * is gone before the other side's round arrives); then both rounds fly and
 * the one that lands first is judged first.
 */
export function actDuel(e: DuelEngagement, orders: Record<DuelSide, DuelOrder>): { engagement: DuelEngagement; events: DuelEvent[] } {
  if (e.winner) return { engagement: e, events: [] };
  const events: DuelEvent[] = [];
  let next: DuelEngagement = { ...e, turn: e.turn + 1 };
  const before = { west: e.west.x, east: e.east.x };
  for (const side of ["west", "east"] as const) {
    if (orders[side].kind !== "relocate" || next[side].relocationsLeft <= 0) continue;
    const by = -facing(side) * STEP;
    next = { ...next, [side]: { ...next[side], x: next[side].x + by, relocationsLeft: next[side].relocationsLeft - 1 } };
    // The other side has lost the gun: their rounds so far no longer bear on it.
    const other = enemyOf(side);
    next = { ...next, [other]: { ...next[other], shots: [] } };
    events.push({ kind: "relocated", side, by });
  }
  const shots: DuelShot[] = [];
  for (const side of ["west", "east"] as const) {
    const order = orders[side];
    if (order.kind !== "fire" || next[side].rounds <= 0) continue;
    next = { ...next, [side]: { ...next[side], rounds: next[side].rounds - 1 } };
    const own = next[side];
    const wind = gusted(e, side);
    const powder = 1 + DIFFICULTY[e.difficulty].dispersion * (chance(e, `powder/${e.turn}/${side}`)() * 2 - 1);
    const flight = flyField(FIELD_GUN, order.aim, 0, groundFor(next, side), windFor(wind, side), { speed: (1 + own.wear) * powder });
    const f = facing(side);
    const burst = { x: own.x + f * flight.burst.x, z: f * flight.burst.z };
    // Aimed at where the enemy gun stood when the orders were given; if it has moved, the round falls on the empty pit.
    const enemyNow = next[enemyOf(side)].x;
    const miss = { along: f * (burst.x - enemyNow), across: f * burst.z };
    const hit = Math.hypot(miss.along, miss.across) < DUEL_RADIUS;
    const told = { along: Math.abs(enemyNow - own.x) + own.mapError.along, across: own.mapError.across };
    shots.push({ round: own.shots.length + 1, side, aim: order.aim, wind, flight, burst, miss, landedAt: flight.time, told, hit, decisive: false, report: { kind: "lost", destroyed: false } });
  }
  // The first round down is judged first: a hit that silences the other gun stops its round from counting.
  shots.sort((a, b) => a.landedAt - b.landedAt);
  let winner: DuelSide | "draw" | null = null;
  let decidedAt = Infinity;
  for (const shot of shots) {
    const target = enemyOf(shot.side);
    const late = shot.landedAt > decidedAt + 0.05;
    const hit = shot.hit && !late;
    const hitsTaken = next[target].hitsTaken + (hit ? 1 : 0);
    const decisive = hit && hitsTaken >= HITS_TO_SILENCE;
    if (decisive) {
      winner = winner && Math.abs(shot.landedAt - decidedAt) <= 0.05 ? "draw" : shot.side;
      decidedAt = Math.min(decidedAt, shot.landedAt);
    }
    const judged: DuelShot = { ...shot, hit, decisive, report: report(next, shot.side, shot.miss, hit, decisive, Math.abs(next.east.x - next.west.x)) };
    next = { ...next, [target]: { ...next[target], hitsTaken }, [shot.side]: { ...next[shot.side], shots: [...next[shot.side].shots, judged] } };
    const pitEmpty = next[target].x !== before[target];
    events.push(pitEmpty ? { kind: "empty-pit", shot: judged } : { kind: "fired", shot: judged });
  }
  const longest = Math.max(0, ...shots.map((s) => s.landedAt));
  next = { ...next, time: next.time + longest + RELOAD };
  if (!winner && next.west.rounds <= 0 && next.east.rounds <= 0) {
    // Both pits empty: the battery that took fewer hits has the better of it.
    winner = next.west.hitsTaken === next.east.hitsTaken ? "draw" : next.west.hitsTaken < next.east.hitsTaken ? "west" : "east";
  }
  if (winner) {
    next = { ...next, winner };
    events.push({ kind: "over", winner });
  }
  return { engagement: next, events };
}

/* ---------- What each side sees, and the computer's commanders ---------- */

/** One side's view of the duel, in the shape the Field Artillery players read. */
export function duelSeen(e: DuelEngagement, side: DuelSide): FieldSeen {
  const own = e[side];
  const enemy = e[enemyOf(side)];
  const distance = Math.abs(enemy.x - own.x);
  const ground = groundFor(e, side);
  const gunHeight = ground(0);
  const targetHeight = ground(distance);
  let crest: FieldSeen["crest"] = null;
  let worst = 15;
  for (let x = 200; x < distance - 60; x += 20) {
    const over = ground(x) - (gunHeight + (x / distance) * (targetHeight - gunHeight));
    if (over > worst) {
      worst = over;
      crest = { at: x, height: Math.round(ground(x) - gunHeight) };
    }
  }
  const lastIn = enemy.shots[enemy.shots.length - 1];
  const told = { along: distance + own.mapError.along, across: own.mapError.across };
  return {
    tables: FIELD_GUN.charges.map((_, i) => firingTable(FIELD_GUN, i + 1)),
    limits: { elevation: { min: 0, max: 70 }, line: 300 },
    target: { distance: Math.round(told.along / 10) * 10, across: Math.round(told.across / 10) * 10, height: Math.round((targetHeight - gunHeight) / 5) * 5, along: 0, acrossSpeed: 0, radius: DUEL_RADIUS, hitsLeft: HITS_TO_SILENCE - enemy.hitsTaken },
    crest,
    wind: windFor(e.forecast, side),
    shots: own.shots.map((s) => ({ aim: s.aim, report: s.report, time: s.flight.time, firedAt: 0, distanceAtBurst: s.told.along, acrossAtBurst: s.told.across })),
    roundsLeft: own.rounds,
    timeLeft: null,
    now: e.time,
    night: null,
    enemy: { lastMiss: lastIn ? Math.hypot(lastIn.miss.along, lastIn.miss.across) : null, expected: null },
    relocationsLeft: own.relocationsLeft,
  };
}

/**
 * The computer's three commanders, each with their own way:
 *
 * - cautious trusts only part of each report and moves the gun as soon as
 *   the enemy's rounds come within a couple of hundred metres;
 * - aggressive never moves, over-corrects every report to get there
 *   sooner, and loads the biggest charge it can so its rounds arrive first;
 * - methodical follows the observer exactly and moves only when a round
 *   lands right beside it.
 */
export function commander(kind: Commander): (view: FieldSeen) => DuelOrder {
  const bots: Record<Commander, FieldBot> = {
    cautious: fieldHumanBot({ share: 0.6, movesInside: 230 }),
    aggressive: fieldHumanBot({ share: 1.15, moves: false, fast: true }),
    methodical: fieldHumanBot({ share: 0.85, movesInside: 120 }),
  };
  const bot = bots[kind];
  return (view) => {
    const action = bot(view);
    if (action.kind === "relocate") return { kind: "relocate" };
    if (action.kind === "fire") return { kind: "fire", aim: action.aim };
    return { kind: "fire", aim: { charge: 2, elevation: 40, line: 0 } };
  };
}
