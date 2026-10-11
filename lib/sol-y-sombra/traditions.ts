import { FINISHES, MOVES, type FinishSpec, type MoveSpec } from "./rules";

/*
 * Traditions decide what the afternoon is for: the moves the player picks
 * from, how it ends, and what the crowd judges. The rig, the ring and the
 * controls stay the same across all of them.
 *
 * 11a builds the Corrida. The Course Camarguaise (racers snatching cockades
 * and strings from the bull's horns, the bull the star and unharmed) and the
 * Recortes (dodges and leaps over a charging bull, no capes, no harm) arrive
 * in 11c: they plug in here with their own moves and finale, and the
 * verdict and the engine's pass loop serve them unchanged.
 */

export type TraditionId = "corrida" | "course-camarguaise" | "recortes";

export type Tradition = {
  id: TraditionId;
  name: string;
  /** One line for the picker. */
  line: string;
  available: boolean;
  /** The moves offered on each pass. */
  moves: MoveSpec[];
  /** How the afternoon ends: the moment of truth, or a time limit with no finish. */
  finale: { kind: "finish"; finishes: FinishSpec[] } | { kind: "time"; passes: number };
};

export const TRADITIONS: Record<TraditionId, Tradition> = {
  corrida: {
    id: "corrida",
    name: "Corrida",
    line: "Cape passes, the crowd's judgement, and a finish shown without wounds.",
    available: true,
    moves: [MOVES.veronica, MOVES.outside, MOVES.swirl],
    finale: { kind: "finish", finishes: [FINISHES["over-the-horns"], FINISHES.waiting] },
  },
  "course-camarguaise": {
    id: "course-camarguaise",
    name: "Course Camarguaise",
    line: "Snatch the ribbons from the horns and vault the barrier. The bull is the star, and goes home.",
    available: false,
    moves: [],
    finale: { kind: "time", passes: 15 },
  },
  recortes: {
    id: "recortes",
    name: "Recortes",
    line: "No cape, no harm: dodge, swerve and leap over the charge.",
    available: false,
    moves: [],
    finale: { kind: "time", passes: 12 },
  },
};

export const TRADITION_LIST: TraditionId[] = ["corrida", "course-camarguaise", "recortes"];
