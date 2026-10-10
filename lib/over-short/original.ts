import type { RandomSource } from "@/lib/kit/rng";

/*
 * The two original programs' rules, line for line in behaviour (never in
 * words): GUNNER.BAS (1973, yards) and its IBM PC remake CANNON.BAS
 * (metres). Used by the checks to verify the notes, by the bots'
 * simulations, and by the 1970s mode in a later prompt. The messages live in
 * the originals only; here a report is data.
 */

export type Scale = "gunner" | "cannon";

/** The gun's greatest range: 20,000–59,999 yards in Gunner, 10,000–13,999 metres in Cannoneer. */
export function rollMaxRange(scale: Scale, rnd: RandomSource) {
  return scale === "gunner" ? Math.floor(40000 * rnd() + 20000) : Math.floor(4000 * rnd() + 10000);
}

/** A target somewhere from 10% to (just under) 90% of the greatest range, whole units. */
export const rollTarget = (maxRange: number, rnd: RandomSource) => Math.floor(maxRange * (0.1 + 0.8 * rnd()));

export type OriginalReport =
  | { kind: "too-low" }
  | { kind: "too-high" }
  | { kind: "hit"; error: number }
  | { kind: "over" | "short"; distance: number };

/**
 * One elevation typed at one target, as both programs judge it: degrees
 * turned to radians with 57.3, the error truncated with INT (towards minus
 * infinity), a hit when that error is under 100 either way, and "short"
 * only when it is above 100, so a round exactly 100 short is called over.
 */
export function judge(maxRange: number, target: number, elevation: number): OriginalReport {
  if (elevation > 89) return { kind: "too-high" };
  if (elevation < 1) return { kind: "too-low" };
  const impact = maxRange * Math.sin((2 * elevation) / 57.3);
  const error = Math.floor(target - impact);
  if (Math.abs(error) < 100) return { kind: "hit", error };
  return { kind: error > 100 ? "short" : "over", distance: Math.abs(error) };
}

/** What a player sees before each elevation. */
export type OriginalView = { maxRange: number; target: number; targetNumber: number; roundsAtTarget: number; totalRounds: number };

export type OriginalPlayer = (view: OriginalView, last: OriginalReport | null) => number;

export type OriginalGame = {
  maxRange: number;
  targets: number[];
  /** Rounds that counted, per target reached. */
  rounds: number[];
  total: number;
  /** Five targets destroyed, or blown up on the sixth round at one of them. */
  ending: "complete" | "destroyed";
  /** Whether the total earned the good word: 18 rounds or fewer, five targets down. */
  nice: boolean;
  /** Elevations refused for being out of 1–89 (they cost nothing). */
  refused: number;
};

/**
 * Plays one whole game the way the programs run it: the same gun for five
 * targets; a sixth elevation at one target means the enemy finds you
 * first, whatever it would have done.
 */
export function playOriginal(scale: Scale, rnd: RandomSource, player: OriginalPlayer): OriginalGame {
  const maxRange = rollMaxRange(scale, rnd);
  const targets: number[] = [];
  const rounds: number[] = [];
  let total = 0;
  let refused = 0;
  for (let n = 0; n < 5; n++) {
    const target = rollTarget(maxRange, rnd);
    targets.push(target);
    let shots = 0;
    let last: OriginalReport | null = null;
    for (;;) {
      const elevation = player({ maxRange, target, targetNumber: n + 1, roundsAtTarget: shots, totalRounds: total }, last);
      const report = judge(maxRange, target, elevation);
      if (report.kind === "too-high" || report.kind === "too-low") {
        refused++;
        last = report;
        // A player who keeps typing nonsense would never end; count it as a sixth round.
        if (refused > 50) return { maxRange, targets, rounds: [...rounds, shots], total, ending: "destroyed", nice: false, refused };
        continue;
      }
      shots++;
      if (shots >= 6) return { maxRange, targets, rounds: [...rounds, shots - 1], total, ending: "destroyed", nice: false, refused };
      last = report;
      if (report.kind === "hit") break;
    }
    rounds.push(shots);
    total += shots;
  }
  return { maxRange, targets, rounds, total, ending: "complete", nice: total <= 18, refused };
}
