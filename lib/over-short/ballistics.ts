/*
 * The textbook flight of a shell in a vacuum: the model the 1973 program
 * used for every round. A gun whose greatest range is R throws a shell at
 * elevation θ to R · sin 2θ; the muzzle speed that gives that range is
 * √(R·g). No air, no wind, no hills.
 */

export const GRAVITY = 9.81;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Where a round fired at `elevation` degrees comes down, for a gun of greatest range `maxRange` metres. */
export const vacuumRange = (maxRange: number, elevation: number) => maxRange * Math.sin(2 * radians(elevation));

/** The muzzle speed (m/s) that carries a shell `maxRange` metres at 45°. */
export const muzzleSpeed = (maxRange: number) => Math.sqrt(maxRange * GRAVITY);
