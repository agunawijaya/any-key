import type { BeatRequest, RingOptions } from "@/lib/sol-y-sombra/rig/ring";

/*
 * The ring when nobody is playing: behind the game menu and in the Hall's
 * preview, the matador alone with the bull, passing it over and over,
 * nobody keeping score.
 */

/** Three veronicas (the last one close), an outside pass and a swirl, a walk to give the bull room, and again. */
const ATTRACT_PROGRAM: BeatRequest[] = [
  { kind: "pass", pass: "veronica", side: -1, paw: true },
  { kind: "pass", pass: "veronica", side: 1 },
  { kind: "pass", pass: "veronica", side: -1, outcome: "close" },
  { kind: "pass", pass: "outside", side: 1 },
  { kind: "pass", pass: "swirl", side: -1 },
  { kind: "walk-off", distance: 5 },
  { kind: "wait", seconds: 0.8 },
];

/** The looping ring for a seed: the same seed, the same loop. */
export const attract = (seed = "sol-y-sombra/menu"): RingOptions => ({ seed, program: ATTRACT_PROGRAM, loop: true });

export const ATTRACT: RingOptions = { seed: "sol-y-sombra/menu", program: ATTRACT_PROGRAM, loop: true };
