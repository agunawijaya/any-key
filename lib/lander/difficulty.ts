import { startState, type Setup } from "./physics";
import { idealPlan } from "./solver";

/*
 * Fuel difficulty, one setting for every mode except 1979 mode (which keeps
 * the original's numbers exactly). Standard is the tank the game was
 * balanced on. Generous adds 30%. Tight trims the tank until a perfect run
 * keeps only about 7% of it (never below 60% of the standard tank): still
 * winnable, as the human-pilot tests in scripts/check-lander.ts show, but
 * with no fuel to waste.
 */

export type Difficulty = "generous" | "standard" | "tight";

export const DIFFICULTIES: { id: Difficulty; name: string; how: string; mark: string }[] = [
  { id: "generous", name: "Generous", how: "30% more fuel: room to learn and to change your mind.", mark: "🟢" },
  { id: "standard", name: "Standard", how: "The tank every mode was balanced on.", mark: "" },
  { id: "tight", name: "Tight", how: "Only just enough. A perfect run keeps about 7%.", mark: "🔥" },
];

export const difficultyOf = (id: Difficulty) => DIFFICULTIES.find((d) => d.id === id)!;

export const GENEROUS = 1.3;
export const TIGHT_MARGIN = 0.07;
export const TIGHT_FLOOR = 0.6;

/** A perfect hoverslam's leftover fuel, as a share of the tank. */
function spare(setup: Setup) {
  const plan = idealPlan(setup, startState(setup));
  return plan.possible ? plan.fuelLeft / setup.fuel : -1;
}

/** The same flight with the tank set for a difficulty (the 1D modes). */
export function withDifficulty(setup: Setup, d: Difficulty): Setup {
  if (d === "standard") return setup;
  if (d === "generous") return { ...setup, fuel: Math.round(setup.fuel * GENEROUS) };
  const target = TIGHT_MARGIN;
  if (spare(setup) <= target) return setup;
  // The leftover share grows with the tank: halve the interval until it is about 6%.
  let lo = TIGHT_FLOOR;
  let hi = 1;
  if (spare({ ...setup, fuel: Math.round(setup.fuel * lo) }) >= target) return { ...setup, fuel: Math.round(setup.fuel * lo) };
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (spare({ ...setup, fuel: Math.round(setup.fuel * mid) }) >= target) hi = mid;
    else lo = mid;
  }
  return { ...setup, fuel: Math.round(setup.fuel * hi) };
}

/** " · 🔥 Tight fuel" for share texts and titles, nothing for Standard. */
export function difficultyTag(d: Difficulty) {
  const x = difficultyOf(d);
  return d === "standard" ? "" : `${x.mark} ${x.name} fuel`;
}
