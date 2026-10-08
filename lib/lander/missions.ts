import { dailyDate } from "@/lib/kit/daily";
import { mulberry32 } from "@/lib/kit/rng";
import { landerManifest } from "./manifest";
import { makeSetup, startState, type Setup } from "./physics";
import { idealPlan } from "./solver";
import { worldById, WORLDS, type WorldId } from "./worlds";

export type Mission = {
  id: number;
  name: string;
  world: WorldId;
  blurb: string;
  speed?: number;
  fuelFactor?: number;
  cargo?: number;
  /** The burn guide is switched off for this one. */
  noGuide?: boolean;
  /** The speed readout stays dark above this height (km). */
  speedDarkAbove?: number;
  /** Must touch down slower than this (km/h) to clear. Default: 20, a survivable landing. */
  clearBelow?: number;
};

/** Ten missions, each proved landable (with fuel to spare) by scripts/check-lander.ts. */
export const MISSIONS: Mission[] = [
  { id: 1, name: "First Contact", world: "moon", blurb: "The classic descent. Fall, wait for the line, then burn hard." },
  { id: 2, name: "Red Planet", world: "mars", blurb: "More gravity, more fuel, and a butterscotch sky." },
  { id: 3, name: "Metal World", world: "psyche", blurb: "Gravity is almost nothing here. Stop early, then drift down." },
  { id: 4, name: "Homecoming", world: "earth", blurb: "The heaviest pull and the longest fall. Aim for the barge." },
  { id: 5, name: "Cargo Run", world: "moon", cargo: 3000, blurb: "Three tonnes of supplies on board. Your engine feels every one." },
  { id: 6, name: "Running on Fumes", world: "mars", fuelFactor: 0.75, blurb: "Someone forgot to top up the tank. No wasted burns." },
  { id: 7, name: "Hot Entry", world: "moon", speed: 5800, blurb: "You're coming in 800 km/h faster than usual. Burn earlier." },
  { id: 8, name: "Instruments Out", world: "mars", noGuide: true, speedDarkAbove: 40, blurb: "No guide, and the speedometer is dead above 40 km. Remember where you braked on Red Planet." },
  { id: 9, name: "Needle", world: "psyche", clearBelow: 5, blurb: "Land gently enough to plant your flag: under 5 km/h." },
  { id: 10, name: "Express Delivery", world: "earth", speed: 5600, noGuide: true, blurb: "Earth, faster, and nobody to tell you when to burn." },
];

export function missionSetup(m: Mission): Setup {
  return makeSetup(worldById(m.world), { speed: m.speed, fuelFactor: m.fuelFactor, cargo: m.cargo });
}

/* ---------- Daily Drop: the same descent for everyone on a given date ---------- */

export type DailyDrop = { number: number; key: string; world: WorldId; speed: number; fuelFactor: number; cargo: number };

/** A perfect hoverslam must still land with at least this share of the tank left. */
export const DAILY_MARGIN = 0.06;

export function fuelMargin(setup: Setup) {
  const plan = idealPlan(setup, startState(setup));
  return plan.possible ? plan.fuelLeft / setup.fuel : 0;
}

/**
 * A seeded world, entry speed, cargo and tank. Proposals that a perfect
 * hoverslam couldn't land with fuel to spare are skipped (the test script
 * checks every day of the year).
 */
export function dailyDrop(date = new Date()): DailyDrop {
  const { day, key, number } = dailyDate(date, landerManifest.daily?.epoch);
  const rng = mulberry32(51_979 + day * 7);
  let drop: DailyDrop = { number, key, world: "moon", speed: 5000, fuelFactor: 1, cargo: 0 };
  for (let attempt = 0; attempt < 40; attempt++) {
    const world = WORLDS[Math.floor(rng() * WORLDS.length)].id;
    drop = {
      number,
      key,
      world,
      speed: 4200 + Math.round(rng() * 18) * 100,
      fuelFactor: Math.round((0.86 + rng() * 0.26) * 100) / 100,
      cargo: Math.round(rng() * 12) * 500,
    };
    if (fuelMargin(dailySetup(drop)) >= DAILY_MARGIN) return drop;
  }
  return { ...drop, speed: 5000, fuelFactor: 1, cargo: 0 };
}

export function dailySetup(d: DailyDrop): Setup {
  return makeSetup(worldById(d.world), { speed: d.speed, fuelFactor: d.fuelFactor, cargo: d.cargo });
}
