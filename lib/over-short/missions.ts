import { createRng, type Rng } from "@/lib/kit/rng";
import { createEngagement, rangeTable, statedMaxRange, type Counterfire, type Engagement, type Rules, type TargetKind, type TargetSpec } from "./engagement";
import { bestRange, type Gun, type ModelId } from "./models";

/*
 * The Campaign: twenty missions in five chapters, each breaking the
 * perfect formula a little more. Missions are data; `buildMission` turns
 * one into an engagement from a seed, so every attempt differs in its
 * numbers but never in its lesson. `scripts/check-over-short.ts` proves a
 * sensible gunner wins every mission within its ammunition.
 *
 * Briefings name targets by kind (`{target}`); the era supplies the words.
 */

type Band = readonly [number, number];

export type TargetPlan = {
  kind: TargetKind;
  /** Distance as a share of the gun's real greatest range. */
  share: Band;
  height?: Band;
  /** m/s; the sign is picked at random (towards or away). */
  speed?: Band;
  radius: number;
  hits?: number;
};

export type MissionSpec = {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5;
  title: string;
  brief: string;
  model: ModelId;
  /** The gun's greatest range in a vacuum. */
  vacuumRange: Band;
  drag?: number;
  /** Whether the briefing gives the greatest range; `worn` makes the given figure this much too generous. */
  told: { maxRange: boolean; worn?: Band; table?: number[] };
  reports: "direction" | "distance";
  targets: TargetPlan[];
  /** Along the line of fire, m/s; the sign gives head (−) or tail (+). */
  wind?: Band;
  ammo: number;
  elevation?: { min: number; max: number };
  clock?: { limit: number; reload: number };
  counterfire?: Counterfire;
  relocations?: { count: number; step: number };
  /** Rounds for a gold and a silver medal; anything that wins is bronze. */
  medals: { gold: number; silver: number };
};

/** The drag of a Great War field shell in the Campaign's air, per metre. */
export const AIR_DRAG = 4e-5;

const VACUUM_GUN: Band = [10000, 14000];
/**
 * From Chapter 4 on the player keeps one gun, the battery's own, so the
 * range table they build from its rounds stays true from mission to mission.
 */
export const BATTERY_GUN = 14000;
const AIR_GUN: Band = [BATTERY_GUN, BATTERY_GUN];

export const CHAPTERS = [
  { chapter: 1, title: "Drill", lesson: "Bracketing: one over, one short, then halve the difference." },
  { chapter: 2, title: "Unknown Gun", lesson: "Finding a gun's range from its own fall of shot." },
  { chapter: 3, title: "Hills and Wind", lesson: "Why the formula is only a place to start." },
  { chapter: 4, title: "Real Air", lesson: "Building your own range table." },
  { chapter: 5, title: "Pressure", lesson: "Speed and nerve." },
] as const;

export const MISSIONS: MissionSpec[] = [
  {
    id: "1-1",
    chapter: 1,
    title: "First Light",
    brief: "{target} at the far edge of the map. The observer's line is bad: you will hear only over or short. Find it by bracketing.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "direction",
    targets: [{ kind: "dump", share: [0.35, 0.65], radius: 150 }],
    ammo: 10,
    medals: { gold: 3, silver: 6 },
  },
  {
    id: "1-2",
    chapter: 1,
    title: "The Long Field",
    brief: "{target} near the limit of the gun's reach. Out there a degree moves the fall of shot less than you would think.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "direction",
    targets: [{ kind: "railyard", share: [0.72, 0.88], radius: 150 }],
    ammo: 10,
    medals: { gold: 3, silver: 6 },
  },
  {
    id: "1-3",
    chapter: 1,
    title: "Close Work",
    brief: "{target} barely a tenth of the gun's range away. Down at low elevations the smallest change throws the round a long way.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "direction",
    targets: [{ kind: "mast", share: [0.12, 0.25], radius: 150 }],
    ammo: 10,
    medals: { gold: 3, silver: 6 },
  },
  {
    id: "1-4",
    chapter: 1,
    title: "Two Roads",
    brief: "{target} built of stone: it takes two hits. An old gunner's trick: every distance short of the greatest can be reached at two elevations, one either side of 45°.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "direction",
    targets: [{ kind: "bridge", share: [0.4, 0.8], radius: 150, hits: 2 }],
    ammo: 12,
    medals: { gold: 4, silver: 7 },
  },
  {
    id: "2-1",
    chapter: 2,
    title: "New Gun",
    brief: "A gun fresh from the depot, and nobody has its range table. The observer gives distances again. Let the first rounds tell you what this gun can do.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: false },
    reports: "distance",
    targets: [{ kind: "dump", share: [0.3, 0.8], radius: 100 }],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "2-2",
    chapter: 2,
    title: "Captured Piece",
    brief: "A gun taken from the other side, its markings in a language no one reads. Six rounds and {target} to find with them.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: false },
    reports: "distance",
    targets: [{ kind: "battery", share: [0.25, 0.85], radius: 100 }],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "2-3",
    chapter: 2,
    title: "Worn Barrel",
    brief: "The range table says what this gun did when it was new. It has fired a great many rounds since. Trust the observer over the paper.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true, worn: [1.07, 1.12] },
    reports: "distance",
    targets: [{ kind: "railyard", share: [0.3, 0.8], radius: 100 }],
    ammo: 5,
    medals: { gold: 2, silver: 3 },
  },
  {
    id: "2-4",
    chapter: 2,
    title: "One Gun, Two Targets",
    brief: "An unknown gun and two targets. Whatever you learn on the first is yours to keep for the second.",
    model: "vacuum",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: false },
    reports: "distance",
    targets: [
      { kind: "dump", share: [0.25, 0.5], radius: 100 },
      { kind: "mast", share: [0.6, 0.85], radius: 100 },
    ],
    ammo: 8,
    medals: { gold: 4, silver: 6 },
  },
  {
    id: "3-1",
    chapter: 3,
    title: "Up the Ridge",
    brief: "{target} on high ground, well above the gun. The shell meets the hillside before it reaches the distance the formula promises.",
    model: "modified",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "mast", share: [0.4, 0.75], height: [180, 320], radius: 100 }],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "3-2",
    chapter: 3,
    title: "Into the Valley",
    brief: "{target} down in a valley floor, well below the gun. Falling further, the shell flies further.",
    model: "modified",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "railyard", share: [0.4, 0.75], height: [-300, -150], radius: 100 }],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "3-3",
    chapter: 3,
    title: "Headwind",
    brief: "A strong wind blowing straight into the gunners' faces. The longer a round stays up, the more of it the wind takes.",
    model: "modified",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "dump", share: [0.45, 0.8], radius: 100 }],
    wind: [-13, -9],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "3-4",
    chapter: 3,
    title: "Ridge and Gale",
    brief: "{target} up on a ridge, a gale at your back. Two effects at once, and only five rounds.",
    model: "modified",
    vacuumRange: VACUUM_GUN,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "battery", share: [0.4, 0.75], height: [120, 260], radius: 100 }],
    wind: [8, 12],
    ammo: 5,
    medals: { gold: 2, silver: 3 },
  },
  {
    id: "4-1",
    chapter: 4,
    title: "Thick Air",
    brief: "From here on the shells fly through real air, and air pushes back. Every round you fire goes into your own range table.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "dump", share: [0.4, 0.7], radius: 100 }],
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "4-2",
    chapter: 4,
    title: "Not Forty-Five",
    brief: "{target} almost at the greatest range. In air, the elevation that throws furthest is not the one in the textbook.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "railyard", share: [0.9, 0.96], radius: 100 }],
    ammo: 7,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "4-3",
    chapter: 4,
    title: "The High Road",
    brief: "A ridge in front of the gun: only rounds fired above 50° clear it. In air, the high road and the low road no longer meet at the same place.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "battery", share: [0.45, 0.75], radius: 100 }],
    elevation: { min: 50, max: 85 },
    ammo: 6,
    medals: { gold: 2, silver: 4 },
  },
  {
    id: "4-4",
    chapter: 4,
    title: "Table Maker",
    brief: "Three targets near, middle and far. Let the table you have been building do the work.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [
      { kind: "mast", share: [0.25, 0.4], radius: 100 },
      { kind: "dump", share: [0.5, 0.65], radius: 100 },
      { kind: "railyard", share: [0.75, 0.88], radius: 100 },
    ],
    ammo: 10,
    medals: { gold: 4, silver: 7 },
  },
  {
    id: "5-1",
    chapter: 5,
    title: "Convoy",
    brief: "{target} on the road, moving. A round takes half a minute or more to arrive: aim where it will be, not where it is.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "convoy", share: [0.45, 0.6], speed: [8, 11], radius: 100 }],
    ammo: 7,
    medals: { gold: 3, silver: 5 },
  },
  {
    id: "5-2",
    chapter: 5,
    title: "Last Shells",
    brief: "Three rounds left in the pit, and yesterday's range table pinned to the shield. Make them count.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true, table: [15, 25, 35] },
    reports: "distance",
    targets: [{ kind: "dump", share: [0.5, 0.8], radius: 100 }],
    ammo: 3,
    medals: { gold: 1, silver: 2 },
  },
  {
    id: "5-3",
    chapter: 5,
    title: "Against the Clock",
    brief: "{target} must be down within three minutes and twenty seconds, and it takes two hits. A round that lands late does not count, and a high round is a slow round.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true, table: [15, 25, 35] },
    reports: "distance",
    targets: [{ kind: "bridge", share: [0.55, 0.8], radius: 100, hits: 2 }],
    ammo: 8,
    clock: { limit: 200, reload: 15 },
    medals: { gold: 2, silver: 3 },
  },
  {
    id: "5-4",
    chapter: 5,
    title: "Counter-Battery",
    brief: "{target} has found your position, and each of its rounds lands closer than the last. Hit it first, or move the gun and make them start again.",
    model: "air",
    vacuumRange: AIR_GUN,
    drag: AIR_DRAG,
    told: { maxRange: true },
    reports: "distance",
    targets: [{ kind: "battery", share: [0.55, 0.85], radius: 100 }],
    ammo: 9,
    counterfire: { first: 600, closing: 0.4, lethal: 100 },
    relocations: { count: 2, step: 300 },
    medals: { gold: 3, silver: 5 },
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);

const within = (rng: Rng, [lo, hi]: Band) => lo + (hi - lo) * rng.float();

/** One attempt at a mission: its gun, its targets, its weather, from a seed. */
export function buildMission(spec: MissionSpec, seed: string): Engagement {
  const rng = createRng(`over-short/mission/${spec.id}/${seed}`);
  const gun: Gun = { vacuumRange: Math.round(within(rng, spec.vacuumRange) / 10) * 10, drag: spec.drag ?? 0 };
  const truest = spec.model === "air" ? bestRange("air", gun).range : gun.vacuumRange;
  const targets: TargetSpec[] = spec.targets.map((plan) => ({
    kind: plan.kind,
    distance: Math.round((within(rng, plan.share) * truest) / 10) * 10,
    height: plan.height ? Math.round(within(rng, plan.height) / 10) * 10 : 0,
    speed: plan.speed ? (rng.float() < 0.5 ? -1 : 1) * Math.round(within(rng, plan.speed) * 10) / 10 : 0,
    radius: plan.radius,
    hits: plan.hits ?? 1,
  }));
  const wind = spec.wind ? Math.round(within(rng, spec.wind)) : 0;
  const stated = spec.model === "air" ? statedMaxRange("air", gun) : gun.vacuumRange;
  const rules: Rules = {
    model: spec.model,
    gun,
    wind,
    told: {
      maxRange: spec.told.maxRange ? Math.round((stated * (spec.told.worn ? within(rng, spec.told.worn) : 1)) / 10) * 10 : null,
      windShown: wind !== 0,
      table: spec.told.table ? rangeTable(spec.model, gun, spec.told.table) : [],
    },
    reports: spec.reports,
    rounding: 10,
    ammo: { total: spec.ammo, perTarget: null },
    elevation: spec.elevation ?? { min: 1, max: 89 },
    clock: spec.clock ? { limit: spec.clock.limit, reload: spec.clock.reload } : { limit: null, reload: 20 },
    counterfire: spec.counterfire ?? null,
    relocations: spec.relocations ?? { count: 0, step: 0 },
  };
  return createEngagement(rules, targets);
}

export type Medal = "gold" | "silver" | "bronze";

/** The medal a won mission earns for the rounds it took. */
export function medalFor(spec: MissionSpec, rounds: number): Medal {
  if (rounds <= spec.medals.gold) return "gold";
  if (rounds <= spec.medals.silver) return "silver";
  return "bronze";
}

export const missionsIn = (chapter: number) => MISSIONS.filter((m) => m.chapter === chapter);

/** A chapter opens when the last mission of the one before has been won. */
export function chapterOpen(chapter: number, won: (id: string) => boolean) {
  if (chapter <= 1) return true;
  const before = missionsIn(chapter - 1);
  return won(before[before.length - 1].id);
}
