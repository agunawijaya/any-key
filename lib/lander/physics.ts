import { DRY_MASS, ENTRY_SPEED, type World } from "./worlds";

/*
 * The flight model is the 1979 program's own, run in small steps instead of
 * ten-second jumps:
 *
 *   speed (km/h, positive = falling) changes by   gravity − throttle × thrust / (dry mass + cargo + fuel)
 *   height (km) falls by                          speed / 3200 every second
 *   fuel falls by                                 throttle every second
 *
 * Gravity weakens with height by the program's straight-line rule, and the
 * 3200 is the program's own km/h → km/s conversion (a true one is 3600). We
 * keep both: they are part of how the game feels.
 */

export const SECONDS_PER_HOUR_1979 = 3200;

export type Setup = {
  world: World;
  alt: number;
  speed: number;
  fuel: number;
  /** Extra mass on board (missions). */
  cargo: number;
};

export type FlightState = { t: number; alt: number; speed: number; fuel: number };

export type Touchdown = { t: number; speed: number; fuel: number };

export type SetupOptions = { speed?: number; fuelFactor?: number; cargo?: number; alt?: number };

export function makeSetup(world: World, options: SetupOptions = {}): Setup {
  return {
    world,
    alt: options.alt ?? world.startAlt,
    speed: options.speed ?? ENTRY_SPEED,
    fuel: Math.round(world.fuel * (options.fuelFactor ?? 1)),
    cargo: options.cargo ?? 0,
  };
}

export function startState(setup: Setup): FlightState {
  return { t: 0, alt: setup.alt, speed: setup.speed, fuel: setup.fuel };
}

export function gravityAt(world: World, alt: number) {
  return world.g2 * (1 - alt / (2 * world.radius));
}

/** Change of speed per second (km/h per s) at a throttle of 0–100. */
export function acceleration(setup: Setup, state: FlightState, throttle: number) {
  return gravityAt(setup.world, state.alt) - (throttle * setup.world.thrust) / (DRY_MASS + setup.cargo + state.fuel);
}

/** The throttle that holds the speed steady right now. */
export function hoverThrottle(setup: Setup, state: FlightState) {
  return (gravityAt(setup.world, state.alt) * (DRY_MASS + setup.cargo + state.fuel)) / setup.world.thrust;
}

export type StepResult = { state: FlightState; touchdown?: Touchdown; fuelOutAt?: number };

/**
 * Advances the flight by `seconds` at a steady throttle. Stops exactly at the
 * ground (the impact speed is interpolated inside the last small step).
 */
export function advance(setup: Setup, from: FlightState, throttle: number, seconds: number, dt = 0.02): StepResult {
  let s = { ...from };
  let left = seconds;
  let fuelOutAt: number | undefined;
  while (left > 1e-9) {
    const h = Math.min(dt, left);
    left -= h;
    const burn = s.fuel > 0 ? Math.min(throttle, s.fuel / h) : 0;
    const fuel = Math.max(0, s.fuel - burn * h);
    if (s.fuel > 0 && fuel === 0 && throttle > 0) fuelOutAt = s.t + h;
    // Mass and height at the middle of the step keep long steps honest.
    const midAlt = s.alt - (s.speed * h) / 2 / SECONDS_PER_HOUR_1979;
    const a = gravityAt(setup.world, midAlt) - (burn * setup.world.thrust) / (DRY_MASS + setup.cargo + (s.fuel + fuel) / 2);
    const speed = s.speed + a * h;
    const alt = s.alt - ((s.speed + speed) / 2) * (h / SECONDS_PER_HOUR_1979);
    if (alt <= 0 && s.speed + speed > 0) {
      // Find where inside this step the ground was reached (constant acceleration).
      const k = 1 / SECONDS_PER_HOUR_1979;
      const A = (a / 2) * k;
      const B = s.speed * k;
      const C = -s.alt;
      const disc = B * B - 4 * A * C;
      let tau = Math.abs(A) < 1e-12 ? -C / B : (-B + Math.sqrt(Math.max(0, disc))) / (2 * A);
      if (!(tau >= 0 && tau <= h)) tau = h * (s.alt / (s.alt - alt));
      const impact = s.speed + a * tau;
      const t = s.t + tau;
      const f = s.fuel - burn * tau;
      return { state: { t, alt: 0, speed: impact, fuel: Math.max(0, f) }, touchdown: { t, speed: impact, fuel: Math.max(0, f) }, fuelOutAt };
    }
    s = { t: s.t + h, alt, speed, fuel };
  }
  return { state: s, fuelOutAt };
}

/**
 * Lost for good: climbing where the 1979 gravity formula has turned negative
 * (above twice the radius, reachable only on Psyche), or an absurdly long flight.
 * Anything else that climbs will come back down.
 */
export function isLost(setup: Setup, state: FlightState) {
  return (state.speed < 0 && gravityAt(setup.world, state.alt) <= 0) || state.t > 7200;
}
