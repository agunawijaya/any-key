import { createRng } from "@/lib/kit/rng";
import { createEngagement, type Engagement, type Rules, type TargetKind } from "./engagement";

/*
 * Classic: the 1973 drill with honest fixes. The gun's greatest range and
 * each target's distance are given; the observer reports over or short and
 * by how much; five targets, five rounds at each before the enemy finds the
 * gun; 18 rounds or fewer in all is the standard. It uses the IBM PC
 * remake's metric scale (a gun of 10,000–13,999 m), where a hit of 100 m
 * is a target a careful player can find with tenths of a degree.
 */

export const CLASSIC = { targets: 5, roundsPerTarget: 5, standard: 18, radius: 100 } as const;

const KINDS: TargetKind[] = ["battery", "dump", "bridge", "railyard", "mast"];

export function classicRules(maxRange: number): Rules {
  return {
    model: "vacuum",
    gun: { vacuumRange: maxRange, drag: 0 },
    wind: 0,
    told: { maxRange, windShown: false, table: [] },
    reports: "distance",
    rounding: 1,
    ammo: { total: null, perTarget: CLASSIC.roundsPerTarget },
    elevation: { min: 1, max: 89 },
    clock: { limit: null, reload: 20 },
    counterfire: null,
    relocations: { count: 0, step: 0 },
  };
}

/** A Classic game from a seed: one gun, five targets at 10–90% of its range, as in 1973. */
export function classicEngagement(seed: string): Engagement {
  const rng = createRng(`over-short/classic/${seed}`);
  const maxRange = rng.int(10000, 13999);
  const targets = Array.from({ length: CLASSIC.targets }, () => ({
    kind: rng.pick(KINDS),
    distance: Math.floor(maxRange * (0.1 + 0.8 * rng.float())),
    height: 0,
    speed: 0,
    radius: CLASSIC.radius,
    hits: 1,
  }));
  return createEngagement(classicRules(maxRange), targets);
}

export type ClassicScore = {
  /** Rounds fired in all. */
  total: number;
  destroyed: number;
  /** Rounds it took at each target destroyed. */
  perTarget: number[];
  firstRoundHits: number;
  /** All five down in 18 rounds or fewer. */
  metStandard: boolean;
};

export function classicScore(e: Engagement): ClassicScore {
  const perTarget = e.targets.map((_, i) => e.shots.filter((s) => s.target === i)).filter((shots) => shots.some((s) => s.destroyed)).map((shots) => shots.length);
  const destroyed = perTarget.length;
  return {
    total: e.shots.length,
    destroyed,
    perTarget,
    firstRoundHits: perTarget.filter((n) => n === 1).length,
    metStandard: e.outcome === "won" && e.shots.length <= CLASSIC.standard,
  };
}
