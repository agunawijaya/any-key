import { hash1 } from "../scene/noise";

/**
 * Rounds never fall exactly on the line of fire: each lands a little to
 * one side, the same side every time it is drawn, in the glasses and on the
 * map alike. Metres, positive to the right.
 */
export const lateralOf = (round: number) => (hash1(round, 41) - 0.5) * 50;
