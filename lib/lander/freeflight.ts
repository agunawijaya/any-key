import { GENEROUS, type Difficulty } from "./difficulty";
import { makeSetup, startState, type Setup } from "./physics";
import { start2d, type State2D, type Verdict } from "./physics2d";
import { idealPlan } from "./solver";
import { bargeTarget, flatTarget, flyAutopilot, type TargetFn } from "./solver2d";
import { mulberry32 } from "@/lib/kit/rng";
import { bargeTilt, bargeX, buildSite, heightAt, landingSpots, type Flat, type Site, type SiteKind } from "./terrain";
import { worldById, type World, type WorldId } from "./worlds";

/*
 * Free Flight: tilt, drift, and find flat ground.
 *
 * Two starts: the full descent from the world's usual height and speed, with
 * a sideways drift to kill on the way down; or the final approach from 3 km
 * up. Every flight lands on a site built from a seed. A seed is only used if
 * the autopilot, knowing everything, can land on one of its flats with the
 * fuel on board; otherwise the next seed in a fixed sequence is tried, the
 * way the Daily Drop skips unfair days. So a seed always gives the same site.
 */

export type FreeStart = "full" | "final";

/** Final approach: height above the ground (km) and the speed you arrive with (km/h, per world). */
export const FINAL_ALT = 3;
export const FINAL_SPEED: Record<WorldId, number> = { moon: 150, mars: 180, psyche: 100, earth: 250 };

/** Sideways drift at the start (km/h), smallest and largest. */
export const DRIFT: Record<FreeStart, [number, number]> = { final: [40, 140], full: [300, 650] };

/**
 * Fuel on board, Standard difficulty. Full descent: a multiple of the world's
 * own tank. Final approach: fuel units. Checked by simulation in
 * scripts/check-lander.ts: the perfect pilot flies the budget case (the
 * largest drift, then 1 km (final) or 3 km (full) sideways to flat ground)
 * and must keep at least 8%; slow human pilots must land on the target.
 */
export const TANK: { full: Record<WorldId, number>; final: Record<WorldId, number> } = {
  full: { moon: 1.1, mars: 1, psyche: 1.2, earth: 1 },
  final: { moon: 2000, mars: 2800, psyche: 1250, earth: 5400 },
};

/** Tight difficulty: the budget itself, where the perfect pilot keeps about 8% in the budget case. */
export const TIGHT_TANK: { full: Record<WorldId, number>; final: Record<WorldId, number> } = {
  full: { moon: 0.99, mars: 0.85, psyche: 1.09, earth: 0.91 },
  final: { moon: 1350, mars: 2100, psyche: 780, earth: 3800 },
};

/** The perfect pilot must keep this share of the tank in the budget case. */
export const BUDGET_MARGIN = 0.08;

/**
 * And this much when it flies to a site's target: a person steers less
 * efficiently than the autopilot (the human-pilot tests use up to 15 points
 * more on a long crossing against the drift), so the final approach keeps 20%.
 */
export const FAIR_MARGIN: Record<FreeStart, number> = { final: 0.2, full: BUDGET_MARGIN };

export type NamedSite = { id: string; name: string; world: WorldId; kind: SiteKind; seed: number; blurb: string; hour?: "night" };

/** Six named sites, unlocked in order with stars. */
export const NAMED_SITES: NamedSite[] = [
  { id: "marbles", name: "The Marbles", world: "moon", kind: "boulders", seed: 101, blurb: "A boulder field. The clearings are few, and none of them is big." },
  { id: "night-rim", name: "Night Rim", world: "moon", kind: "rim", seed: 102, blurb: "A crater rim by Earthshine. The floor is flat, if you can get down to it.", hour: "night" },
  { id: "brink", name: "The Brink", world: "mars", kind: "canyon", seed: 103, blurb: "A canyon edge, with a narrow ledge halfway down the wall." },
  { id: "blue-dunes", name: "Blue Hour Dunes", world: "mars", kind: "dunes", seed: 104, blurb: "Dunes at dusk. Only the sand between them is level.", hour: "night" },
  { id: "iron-crags", name: "Iron Crags", world: "psyche", kind: "crags", seed: 105, blurb: "Metal spires with a few shelves between them. Gravity won't hurry you." },
  { id: "barge-row", name: "Barge Row", world: "earth", kind: "sea", seed: 106, blurb: "Barges on the swell. One of them is drifting." },
];

export const namedSite = (id: string) => NAMED_SITES.find((n) => n.id === id) ?? null;

export type FreeFlight = {
  world: World;
  start: FreeStart;
  difficulty: Difficulty;
  /** The seed the player sees (and can type in to replay). */
  seed: number;
  named: NamedSite | null;
  site: Site;
  setup: Setup;
  state: State2D;
  /**
   * The target: a flat (or barge) the planner has landed on with the fuel on
   * board. It is shown to the player as the planned landing site.
   */
  plan: { spot: Flat; index: number; fuelLeft: number; verdict: Verdict };
  /** How many seeds in the sequence were skipped as unfair. */
  rerolls: number;
};

export function tankFor(world: World, start: FreeStart, difficulty: Difficulty = "standard") {
  const table = difficulty === "tight" ? TIGHT_TANK : TANK;
  const base = start === "full" ? world.fuel * table.full[world.id] : table.final[world.id];
  return Math.round(base * (difficulty === "generous" ? GENEROUS : 1));
}

/** The seed tried after `seed` when a site is unfair. */
function nextSeed(seed: number, k: number) {
  return k === 0 ? seed : 100_000 + Math.floor(mulberry32(seed * 104_729 + k * 7_919)() * 900_000);
}

/** The setup and first state for a start on a site. */
export function startOn(world: World, site: Site, start: FreeStart, seed: number, difficulty: Difficulty = "standard") {
  const rng = mulberry32(seed * 9_973 + (start === "full" ? 1 : 2));
  const [lo, hi] = DRIFT[start];
  const drift = (rng() < 0.5 ? -1 : 1) * (lo + rng() * (hi - lo));
  const fuel = tankFor(world, start, difficulty);
  if (start === "final") {
    const x = (rng() * 2 - 1) * 2.2;
    const alt = FINAL_ALT + heightAt(site, x) / 1000;
    const setup: Setup = { ...makeSetup(world, { alt, speed: FINAL_SPEED[world.id] }), fuel };
    // The drift dies away during the descent: on average you keep about 40% of it for the whole fall.
    const fall = (FINAL_ALT * 3200) / FINAL_SPEED[world.id];
    return { setup, state: start2d(setup, { x, vx: drift }), natural: x + (drift * fall * 0.4) / 3200 };
  }
  // Full descent: the drift carries you to the site while you fall; place the start so that
  // killing the drift during the main burn brings you down near the middle.
  const setup: Setup = { ...makeSetup(world), fuel };
  const plan = idealPlan(setup, startState(setup));
  const aim = (rng() * 2 - 1) * 1.5;
  const x = aim - (drift * (plan.coastSeconds + (plan.duration - plan.coastSeconds) / 2)) / 3200;
  return { setup, state: start2d(setup, { x, vx: drift }), natural: aim };
}

function targetFor(site: Site, spot: Flat, index: number): TargetFn {
  return site.kind === "sea" ? bargeTarget(site, index) : flatTarget(spot);
}

/**
 * Picks the target: the autopilot, knowing everything, must land on it with
 * fuel to spare (FAIR_MARGIN). Flats near where the drift naturally takes you come
 * first, and very narrow ones count as further away, so the target is a fair
 * one to aim for.
 */
export function planLanding(site: Site, setup: Setup, state: State2D, natural: number, start: FreeStart, tries = 4) {
  const narrowPenalty = start === "final" ? 0.7 : 2;
  const spots = landingSpots(site, state.t)
    .map((spot, index) => ({ spot, index, d: Math.abs((spot.x0 + spot.x1) / 2 - natural) + ((spot.x1 - spot.x0) * 1000 < 20 ? narrowPenalty : 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, tries);
  for (const { spot, index } of spots) {
    const r = flyAutopilot(setup, site, state, targetFor(site, spot, index));
    // Fair means fair for people too: the perfect pilot must land with fuel to spare.
    if (r.verdict?.stands && r.fuelLeft >= FAIR_MARGIN[start] * setup.fuel) return { spot, index, fuelLeft: r.fuelLeft, verdict: r.verdict };
  }
  return null;
}

/** A Free Flight on a named site or a seeded one. The same inputs always give the same flight. */
export function freeFlight(worldId: WorldId, start: FreeStart, pick: { seed: number } | { named: string }, difficulty: Difficulty = "standard"): FreeFlight {
  const named = "named" in pick ? namedSite(pick.named) : null;
  const world = worldById(named?.world ?? worldId);
  const seed = named ? named.seed : (pick as { seed: number }).seed;
  let last: FreeFlight | null = null;
  for (let k = 0; k < 24; k++) {
    const s = nextSeed(seed, k);
    // A named site keeps its ground: only where you start (and your drift) is tried again.
    const site = buildSite(world.id, named ? seed : s, named?.kind);
    const { setup, state, natural } = startOn(world, site, start, s, difficulty);
    const plan = planLanding(site, setup, state, natural, start);
    if (plan) return { world, start, difficulty, seed, named, site, setup, state, plan, rerolls: k };
    last = { world, start, difficulty, seed, named, site, setup, state, plan: { spot: landingSpots(site)[0], index: 0, fuelLeft: 0, verdict: null as unknown as Verdict }, rerolls: k };
  }
  return last!;
}

/** The target at time t (a barge's deck moves with it). */
export function targetAt(f: FreeFlight, t: number): Flat {
  if (f.site.kind !== "sea") return f.plan.spot;
  const b = f.site.barges[f.plan.index];
  const c = bargeX(b, t);
  return { x0: c - b.half / 1000, x1: c + b.half / 1000, slope: bargeTilt(b, t) };
}

/** Did the lander come down on the target? */
export function onTarget(f: FreeFlight, x: number, t: number) {
  const g = targetAt(f, t);
  return x >= g.x0 && x <= g.x1;
}

/** A fresh random seed for "New site". */
export function randomSeed() {
  return 1 + Math.floor(Math.random() * 99_999);
}
