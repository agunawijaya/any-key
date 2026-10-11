import { createRng, type Rng } from "@/lib/kit/rng";
import type { TargetKind } from "./engagement";
import { createField, type Difficulty, type EnemyBattery, type FieldEngagement, type FieldRules, type FieldTarget } from "./field";
import { FIELD_GUN } from "./fieldModel";
import type { SurveyPoint, Terrain } from "./terrain";

/*
 * Field Artillery's missions: ten shoots on real ground, each built around
 * one thing the full physics brings (a crest, a crosswind, a convoy, smoke,
 * an enemy battery, a bridge against the clock, the dark). Like the
 * Campaign's, a mission is data and a seed makes each attempt's numbers;
 * the difficulty sets the wind, the observer's eye and the enemy's speed.
 * `scripts/check-over-short.ts` proves every one can be won.
 */

type Band = readonly [number, number];

const within = (rng: Rng, [lo, hi]: Band) => lo + (hi - lo) * rng.float();
const either = (rng: Rng) => (rng.float() < 0.5 ? -1 : 1);

/** The lie of the land for one attempt, given the target's distance. */
type Ground = (rng: Rng, distance: number) => SurveyPoint[];

export type FieldMissionSpec = {
  id: string;
  title: string;
  /** One line for the list; the briefing names the target by kind with `{target}`. */
  lesson: string;
  brief: string;
  kind: TargetKind;
  distance: Band;
  ground: Ground;
  /** Mean wind in m/s: along the line of fire (positive behind the gun) and across it (either side). */
  wind: { along: Band; across: Band };
  /** A convoy's speed in m/s, along and across the line of fire (across either way). */
  speed?: { along: Band; across: Band };
  radius: number;
  hits?: number;
  ammo: number;
  deadline?: Band;
  /** An enemy battery: the target itself or another further back; `ranging` is how many rounds it has already fired at the gun. */
  enemy?: { isTarget: boolean; beyond?: Band; opensAt: number; ranging?: number };
  relocations?: number;
  smoke?: number[];
  night?: { starShells: number; burn: number };
  /** Rounds and game seconds for gold and silver; any win is bronze. */
  medals: { gold: { rounds: number; seconds: number }; silver: { rounds: number; seconds: number } };
};

export type FieldMedal = "gold" | "silver" | "bronze";

/* ---------- The ground ---------- */

/** Gentle farmland: a few swells either side of a mean height. */
const rolling =
  (swell: number): Ground =>
  (rng, distance) => {
    const points: SurveyPoint[] = [];
    const base = within(rng, [25, 45]);
    for (let x = -2400; x <= distance + 2400; x += 700 + rng.float() * 500) points.push({ x, height: base + (rng.float() * 2 - 1) * swell });
    return points;
  };

/** A crest between the gun and a target on its far slope, out of the gun's sight. */
const reverseSlope: Ground = (rng, distance) => {
  const base = within(rng, [25, 40]);
  const crestAt = distance - within(rng, [280, 360]);
  const crest = base + within(rng, [130, 160]);
  return [
    { x: -2000, height: base - 5 },
    { x: 0, height: base },
    { x: crestAt * 0.45, height: base + (crest - base) * 0.35 },
    { x: crestAt, height: crest },
    { x: crestAt + 160, height: crest - 8 },
    { x: distance, height: crest - within(rng, [55, 75]) },
    { x: distance + 900, height: crest - within(rng, [85, 110]) },
    { x: distance + 2600, height: base + 10 },
  ];
};

/** A river valley across the line of fire, its bridge at the bottom. */
const riverValley: Ground = (rng, distance) => {
  const base = within(rng, [40, 60]);
  return [
    { x: -2000, height: base + 8 },
    { x: 0, height: base },
    { x: distance - 1400, height: base - 4 },
    { x: distance - 300, height: base - 18 },
    { x: distance - 120, height: 4 },
    { x: distance - 70, height: 0 },
    { x: distance + 70, height: 0 },
    { x: distance + 120, height: 4 },
    { x: distance + 320, height: base - 16 },
    { x: distance + 1600, height: base - 2 },
    { x: distance + 3000, height: base + 6 },
  ];
};

/** Higher ground beyond, the target on a forward slope facing the gun. */
const forwardSlope: Ground = (rng, distance) => {
  const base = within(rng, [20, 35]);
  const rise = within(rng, [60, 110]);
  return [
    { x: -2000, height: base },
    { x: 0, height: base },
    { x: distance * 0.5, height: base + 8 },
    { x: distance - 600, height: base + rise * 0.4 },
    { x: distance, height: base + rise * 0.75 },
    { x: distance + 700, height: base + rise },
    { x: distance + 2500, height: base + rise + 15 },
  ];
};

/* ---------- The missions ---------- */

export const FIELD_MISSIONS: FieldMissionSpec[] = [
  {
    id: "F1",
    title: "Registration",
    lesson: "Charge, elevation and line",
    brief:
      "A quiet morning to register the gun on {target}. Pick a charge from the firing table, lay the elevation, and listen: the observer now gives corrections, how far to add or drop and how far left or right.",
    kind: "dump",
    distance: [3600, 4800],
    ground: rolling(10),
    wind: { along: [-2, 2], across: [1.5, 3] },
    radius: 30,
    ammo: 8,
    medals: { gold: { rounds: 2, seconds: 80 }, silver: { rounds: 3, seconds: 140 } },
  },
  {
    id: "F2",
    title: "Behind the Crest",
    lesson: "A low charge drops over a ridge",
    brief:
      "{target} sits on the far side of a crest, out of the gun's sight. Laid flat with a big charge, the round buries itself in the hillside. A small charge at a steep angle falls over the top.",
    kind: "battery",
    distance: [2200, 2700],
    ground: reverseSlope,
    wind: { along: [-2, 2], across: [0.5, 2] },
    radius: 25,
    ammo: 8,
    medals: { gold: { rounds: 2, seconds: 110 }, silver: { rounds: 4, seconds: 190 } },
  },
  {
    id: "F3",
    title: "Crosswind",
    lesson: "Wind across the line carries rounds sideways",
    brief: "A strong wind across the line of fire, gusting. The longer a round is in the air, the further it is carried: lay off the wind, and let the observer's left and right guide you in.",
    kind: "railyard",
    distance: [5200, 6400],
    ground: rolling(18),
    wind: { along: [-1, 1], across: [10, 13] },
    radius: 35,
    ammo: 8,
    medals: { gold: { rounds: 2, seconds: 90 }, silver: { rounds: 3, seconds: 140 } },
  },
  {
    id: "F4",
    title: "The Supply Road",
    lesson: "Lead a target that crosses the line",
    brief:
      "{target} driving along a road that crosses your line of fire. Wherever it is when you fire, it will be somewhere else when the round arrives. Aim ahead of it along the road, and a high charge keeps the flight short.",
    kind: "convoy",
    distance: [3800, 5000],
    ground: rolling(12),
    wind: { along: [-2, 2], across: [1, 3] },
    speed: { along: [-1.5, 1.5], across: [4, 6] },
    radius: 30,
    ammo: 9,
    medals: { gold: { rounds: 2, seconds: 65 }, silver: { rounds: 3, seconds: 110 } },
  },
  {
    id: "F5",
    title: "Smoke",
    lesson: "Keep count when the observer is blind",
    brief: "The other side is laying smoke over {target}. Twice the observer will lose a fall of shot in it. Keep your own count of where the rounds have been going.",
    kind: "railyard",
    distance: [5400, 6800],
    ground: rolling(14),
    wind: { along: [-3, 3], across: [2, 5] },
    radius: 35,
    smoke: [2, 4],
    ammo: 9,
    medals: { gold: { rounds: 2, seconds: 100 }, silver: { rounds: 4, seconds: 210 } },
  },
  {
    id: "F6",
    title: "Counter-Battery",
    lesson: "Silence them first, or move",
    brief:
      "{target} has found your position and is ranging on it, a round every minute, each one closer. Silence it first. If their rounds come too close, limber up and move down the road: they will have to find you all over again.",
    kind: "battery",
    distance: [5000, 6600],
    ground: rolling(16),
    wind: { along: [-3, 3], across: [2, 5] },
    radius: 25,
    enemy: { isTarget: true, opensAt: 25, ranging: 2 },
    relocations: 2,
    ammo: 10,
    medals: { gold: { rounds: 2, seconds: 120 }, silver: { rounds: 4, seconds: 340 } },
  },
  {
    id: "F7",
    title: "Drop the Bridge",
    lesson: "Two hits before the column crosses",
    brief:
      "An enemy column is on its way to {target}. It takes two hits to bring the bridge down, and they have to land before the first lorry reaches it. A round still in the air when the column crosses is too late.",
    kind: "bridge",
    distance: [4600, 5800],
    ground: riverValley,
    wind: { along: [-3, 3], across: [2, 4] },
    radius: 22,
    hits: 2,
    deadline: [330, 390],
    ammo: 10,
    medals: { gold: { rounds: 4, seconds: 180 }, silver: { rounds: 5, seconds: 260 } },
  },
  {
    id: "F8",
    title: "Night Shoot",
    lesson: "Star shells: light to see the fall of shot",
    brief:
      "A shoot by night on {target}. In the dark the observer sees only the flash: over or short, left or right, no distances. Call for a star shell and for a minute they can see it all. You have three.",
    kind: "dump",
    distance: [4200, 5600],
    ground: forwardSlope,
    wind: { along: [-2, 2], across: [2, 4] },
    radius: 30,
    night: { starShells: 3, burn: 70 },
    ammo: 9,
    medals: { gold: { rounds: 2, seconds: 110 }, silver: { rounds: 3, seconds: 200 } },
  },
  {
    id: "F9",
    title: "Bridge by Night",
    lesson: "The dark and the clock together",
    brief: "The same job as before, by night: {target}, two hits, a column on the road. Spend your star shells on the rounds that matter.",
    kind: "bridge",
    distance: [4400, 5600],
    ground: riverValley,
    wind: { along: [-3, 3], across: [2, 4] },
    radius: 22,
    hits: 2,
    deadline: [420, 480],
    night: { starShells: 3, burn: 70 },
    ammo: 10,
    medals: { gold: { rounds: 4, seconds: 215 }, silver: { rounds: 6, seconds: 300 } },
  },
  {
    id: "F10",
    title: "Under Fire",
    lesson: "Do the job while being hunted",
    brief:
      "{target} to destroy while an enemy battery further back hunts your gun, its rounds walking in on you. It is out of your reach: move when you must, and keep shooting.",
    kind: "mast",
    distance: [4800, 6200],
    ground: forwardSlope,
    wind: { along: [-3, 3], across: [3, 6] },
    radius: 22,
    enemy: { isTarget: false, beyond: [3200, 4200], opensAt: 40, ranging: 1 },
    relocations: 2,
    ammo: 10,
    medals: { gold: { rounds: 3, seconds: 120 }, silver: { rounds: 4, seconds: 200 } },
  },
];

export const fieldMissionById = (id: string) => FIELD_MISSIONS.find((m) => m.id === id);

/* ---------- Difficulty ---------- */

type Setting = {
  wind: number;
  gusts: number;
  error: number;
  rounding: number;
  milsHint: boolean;
  interval: number;
  closing: number;
  /** How far off the map and the forecast can be, and the spread of one round's powder from the next. */
  map: { along: number; across: number };
  forecast: number;
  dispersion: number;
};

/** What each difficulty does: the wind and its gusts, the observer's eye, the map and forecast, how fast the enemy finds the gun. */
export const DIFFICULTY: Record<Difficulty, Setting> = {
  easy: { wind: 0.6, gusts: 0.06, error: 0, rounding: 10, milsHint: true, interval: 75, closing: 0.62, map: { along: 70, across: 20 }, forecast: 0.5, dispersion: 0.0015 },
  normal: { wind: 1, gusts: 0.15, error: 0.08, rounding: 25, milsHint: false, interval: 55, closing: 0.52, map: { along: 160, across: 45 }, forecast: 1.5, dispersion: 0.0025 },
  hard: { wind: 1.3, gusts: 0.28, error: 0.15, rounding: 50, milsHint: false, interval: 44, closing: 0.45, map: { along: 260, across: 80 }, forecast: 2.5, dispersion: 0.0035 },
};

/** How much this battle's barrel throws differently from its table, either way. */
const WEAR = 0.012;

/** The enemy's first round at a new position lands this far off, and a round this close knocks the gun out. */
const ENEMY = { first: 720, lethal: 40 };

/** One attempt at a mission: its ground, target, weather and enemy, from a seed and a difficulty. */
export function buildFieldMission(spec: FieldMissionSpec, seed: string, difficulty: Difficulty): FieldEngagement {
  const rng = createRng(`over-short/field-mission/${spec.id}/${seed}`);
  const setting = DIFFICULTY[difficulty];
  const distance = Math.round(within(rng, spec.distance) / 10) * 10;
  const terrain: Terrain = { survey: spec.ground(rng, distance), roughness: 2, seed: rng.int(1, 1000) };
  const wind = { along: within(rng, spec.wind.along) * setting.wind, across: either(rng) * within(rng, spec.wind.across) * setting.wind };
  const speed = spec.speed ? { along: within(rng, spec.speed.along), across: either(rng) * within(rng, spec.speed.across) } : { along: 0, across: 0 };
  // The gun is laid on the point where the road crosses the line of fire; the convoy is still a minute short of it.
  const target: FieldTarget = { kind: spec.kind, x: distance, z: -speed.across * 60, vx: speed.along, vz: speed.across, radius: spec.radius, hits: spec.hits ?? 1 };
  let enemy: EnemyBattery | null = null;
  if (spec.enemy) {
    const x = spec.enemy.isTarget ? distance : distance + Math.round(within(rng, spec.enemy.beyond ?? [3000, 4000]) / 10) * 10;
    enemy = { x, z: spec.enemy.isTarget ? 0 : either(rng) * within(rng, [300, 900]), opensAt: spec.enemy.opensAt, interval: setting.interval, first: ENEMY.first, closing: setting.closing, lethal: ENEMY.lethal, isTarget: spec.enemy.isTarget };
  }
  const off = (most: number) => (rng.float() * 2 - 1) * most;
  const rules: FieldRules = {
    gun: FIELD_GUN,
    terrain,
    wind,
    gusts: setting.gusts,
    told: {
      mapError: { along: Math.round(off(setting.map.along) / 10) * 10, across: Math.round(off(setting.map.across) / 5) * 5 },
      forecast: { along: Math.round((wind.along + off(setting.forecast)) * 2) / 2, across: Math.round((wind.across + off(setting.forecast)) * 2) / 2 },
    },
    wear: off(WEAR),
    dispersion: setting.dispersion,
    observer: { error: setting.error, rounding: setting.rounding, milsHint: setting.milsHint },
    ammo: spec.ammo,
    reload: 25,
    recharge: 15,
    deadline: spec.deadline ? Math.round(within(rng, spec.deadline) / 10) * 10 : null,
    enemy,
    relocations: { count: spec.relocations ?? 0, step: 400 },
    smoke: spec.smoke ?? [],
    night: spec.night ?? null,
    limits: { elevation: { min: 0, max: 70 }, line: 300 },
  };
  const start = createField(rules, [target], seed);
  return spec.enemy?.ranging ? { ...start, ranging: spec.enemy.ranging } : start;
}

/** The medal a won mission earns for its rounds and the game time it took. */
export function fieldMedalFor(spec: Pick<FieldMissionSpec, "medals">, rounds: number, seconds: number): FieldMedal {
  const { gold, silver } = spec.medals;
  if (rounds <= gold.rounds && seconds <= gold.seconds) return "gold";
  if (rounds <= silver.rounds && seconds <= silver.seconds) return "silver";
  return "bronze";
}
