/*
 * 1979 mode: the original program's arithmetic, turn for turn. Every formula
 * below mirrors a line of the 1979 listing, quirks included:
 *
 *   - each turn lasts 10 seconds, unless the tank can't feed the burn that long;
 *   - the touchdown speed is estimated from the last turn with an odd formula;
 *   - running dry ends the game at once, with a fall speed and a fall "time"
 *     taken from a logarithm;
 *   - the elapsed-time clock is never reset between games.
 *
 * Only the numbers are shared with the listing. Everything the player reads is new.
 */

export type OriginalWorld = { key: number; name: string; g1: number; radius: number };

/** The four choices, with the 1979 gravity (cm/s²) and radius (km). The fourth is the original's invented asteroid. */
export const ORIGINAL_WORLDS: OriginalWorld[] = [
  { key: 1, name: "EARTH", g1: 980.7, radius: 6371 },
  { key: 2, name: "THE MOON", g1: 162, radius: 1738 },
  { key: 3, name: "MARS", g1: 374, radius: 3380 },
  { key: 4, name: "AN ASTEROID", g1: 17.5, radius: 195 },
];

export type OriginalGame = {
  world: OriginalWorld;
  g2: number;
  thrust: number;
  alt: number;
  speed: number;
  fuel: number;
  /** Length of a turn: 10 s, shortened once when the tank runs low (and never lengthened again). */
  turn: number;
  /** The speed at the end of the previous turn (the listing's B3). */
  lastSpeed: number;
  /** The mission clock. Carried over from game to game, as in the original. */
  clock: number;
};

export type OriginalEnd = {
  reason: "touchdown" | "fuel";
  /** The speed the program judges you by (can be a hair below zero on a perfect landing). */
  speed: number;
  clock: number;
};

export function newOriginalGame(world: OriginalWorld, clock: number, previousLastSpeed = 0): OriginalGame {
  const g2 = world.g1 / 36;
  const alt = Math.max(175, Math.trunc(Math.sqrt(g2) * 100));
  const fuel = Math.max(10_000, Math.trunc(alt * 55));
  const thrust = fuel * (Math.log(world.g1) / 20) + 10_000;
  return { world, g2, thrust, alt, speed: 5000, fuel, turn: 10, lastSpeed: previousLastSpeed, clock };
}

export type TurnResult = { kind: "illegal" } | { kind: "flying"; game: OriginalGame } | { kind: "end"; game: OriginalGame; end: OriginalEnd };

/** One turn at a burn rate of `burn` (0 to 100). */
export function playTurn(g: OriginalGame, burn: number): TurnResult {
  if (burn !== 0 && (burn <= 0 || burn > 100)) return { kind: "illegal" };
  let turn = g.turn;
  if (burn !== 0 && g.fuel / burn < 10) turn = g.fuel / burn;
  const fuel = g.fuel - burn * turn;
  const startSpeed = g.lastSpeed;
  const clock = g.clock + turn;
  const accel = g.g2 + (g.g2 * g.alt) / (g.world.radius * -2) - (burn * g.thrust) / (15_000 + fuel);
  const speed = g.speed + accel * turn;
  const before = g.alt;
  const alt = g.alt + ((speed + g.speed) / -6400) * turn;
  const next: OriginalGame = { ...g, alt, speed, fuel, turn, lastSpeed: speed, clock };
  if (alt < 0.01) {
    const v = Math.sqrt(Math.abs(before / (26 * accel))) * (26 * accel) + startSpeed;
    return { kind: "end", game: next, end: { reason: "touchdown", speed: v, clock } };
  }
  if (fuel <= 0) {
    const v = Math.sqrt(speed ** 2 + alt * g.g2 * 5650);
    const v3 = (Math.abs(v) * 10_000) / 3600;
    const fallTime = Math.log((v3 * alt * 10_000) / g.world.g1);
    return { kind: "end", game: next, end: { reason: "fuel", speed: v, clock: clock + fallTime } };
  }
  return { kind: "flying", game: next };
}

export type OriginalVerdict = {
  /** First line: what happened. */
  headline: string;
  /** Second line (landings and small crashes only). */
  detail: string | null;
  /** Which animation plays. The two use different cut-offs: 19 and 20 km/h. */
  animation: "boom" | "wreck" | "cheer";
  flag: boolean;
};

/**
 * The verdict, with the original's thresholds. Note the gap: the animation
 * treats anything over 19 as a wreck, while the text only calls it a crash
 * from 20. Land at 19.5 km/h and you get both.
 */
export function verdict(speed: number): OriginalVerdict {
  const animation = speed > 45 ? "boom" : speed > 19 ? "wreck" : "cheer";
  const flag = animation === "cheer" && speed <= 5;
  if (speed < 20) {
    const detail = speed < 2 ? "***** A PERFECT TOUCHDOWN! *****" : speed < 5 ? "----- NICE AND GENTLE -----" : "##### BUMPY, BUT IN ONE PIECE #####";
    return { headline: "YOU'RE DOWN!!", detail, animation, flag };
  }
  if (speed < 100) {
    const detail = speed < 30 ? "*** THE LANDER IS WRECKED ***" : speed < 45 ? "** WRECKED, AND THE CREW IS BRUISED **" : "*** NOTHING LEFT TO SALVAGE ***";
    return { headline: "YOU CRASHED!!", detail, animation, flag };
  }
  if (speed < 250) return { headline: "YOU WENT TO PIECES!!", detail: null, animation, flag };
  if (speed < 5000) return { headline: "YOU DUG A BRAND NEW CRATER!!", detail: null, animation, flag };
  return { headline: "YOU FOUND OIL!!!", detail: null, animation, flag };
}
