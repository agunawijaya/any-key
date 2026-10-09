import type { TrekConfig } from "./engine";

/*
 * The tutorial is a real crossing on Chill against the Haboob, with dice
 * picked so the lesson always plays out the same way: the first walk meets
 * something (an oasis at dawn, a tailwind at dusk), and the first gallop
 * leaves the camel running on, ready for the reins. The seeds were found by
 * search; tests/unit/two-humps-engine.test.ts replays the lesson.
 */

const SEEDS = { dawn: 318, dusk: 2766 };

export function tutorialConfig(startClock: number): TrekConfig {
  const seed = startClock >= 12 ? SEEDS.dusk : SEEDS.dawn;
  return { pursuer: "haboob", difficulty: "chill", seed: `two-humps/tutorial/${seed}`, startClock };
}
