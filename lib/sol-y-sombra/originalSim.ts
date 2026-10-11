import { createRng } from "@/lib/kit/rng";
import { OriginalBull, type Mends, type OriginalEvent } from "./original";

/*
 * Bots that play the 1970s program, for measuring it: how often a strategy
 * kills the bull, dies, runs, and what the crowd gives it. Used by the check
 * script and for the numbers in NOTES.md.
 */

export type OriginalStrategy = {
  name: string;
  /** The cape move every pass: 0 veronica, 1 outside, 2 swirl. */
  move: 0 | 1 | 2;
  /** The pass on which to answer YES and try the kill. */
  killAt: number;
  /** 4 over the horns or 5 in the chest. */
  method: 4 | 5;
  /** After surviving a goring: stay in the ring (true) or run (false). */
  stay: boolean;
};

export type Ending = "killed" | "dead" | "ran" | "stood";

export type OriginalGame = {
  ending: Ending;
  award: 0 | 1 | 2 | 3 | null;
  merit: number | null;
  passes: number;
  quality: number;
  crews: [number, number];
  gorings: number;
};

/** Plays one game to the end. */
export function playOriginal(strategy: OriginalStrategy, random: () => number, mends: Mends = {}): OriginalGame {
  const bull = new OriginalBull(random, mends);
  const events: OriginalEvent[] = [...bull.start(), ...bull.answer("NO")];
  let guard = 0;
  while (bull.waiting !== "done" && guard++ < 500) {
    let typed: string;
    if (bull.waiting === "kill") typed = bull.state.pass >= strategy.killAt ? "YES" : "NO";
    else if (bull.waiting === "cape") typed = String(strategy.move);
    else if (bull.waiting === "run") typed = strategy.stay ? "NO" : "YES";
    else typed = String(strategy.method);
    events.push(...bull.answer(typed));
  }
  const award = events.find((e) => e.kind === "award");
  const crews = events.filter((e) => e.kind === "crew").map((e) => (e.kind === "crew" ? e.rating : 0)) as [number, number];
  let ending: Ending = "stood";
  if (events.some((e) => e.kind === "killed")) ending = "killed";
  else if (events.some((e) => e.kind === "dead")) ending = "dead";
  else if (events.some((e) => e.kind === "ran")) ending = "ran";
  return {
    ending,
    award: award?.kind === "award" ? award.tier : null,
    merit: award?.kind === "award" ? award.merit : null,
    passes: bull.state.pass,
    quality: bull.state.a,
    crews,
    gorings: events.filter((e) => e.kind === "gored").length,
  };
}

export type Tally = {
  games: number;
  endings: Record<Ending, number>;
  /** Award tiers 0–3 as shares of all games; "booed" when the matador ran. */
  awards: [number, number, number, number];
  booed: number;
  meanPasses: number;
};

/** Plays many seeded games and sums them up as shares. */
export function tally(strategy: OriginalStrategy, games: number, seed: string, mends: Mends = {}, filter?: (g: OriginalGame) => boolean): Tally {
  const rng = createRng(seed);
  const endings: Record<Ending, number> = { killed: 0, dead: 0, ran: 0, stood: 0 };
  const awards: [number, number, number, number] = [0, 0, 0, 0];
  let booed = 0;
  let passes = 0;
  let counted = 0;
  for (let i = 0; i < games; i++) {
    const g = playOriginal(strategy, rng.float, mends);
    if (filter && !filter(g)) continue;
    counted++;
    endings[g.ending]++;
    if (g.award === null) booed++;
    else awards[g.award]++;
    passes += g.passes;
  }
  const share = (n: number) => n / Math.max(1, counted);
  return {
    games: counted,
    endings: { killed: share(endings.killed), dead: share(endings.dead), ran: share(endings.ran), stood: share(endings.stood) },
    awards: awards.map(share) as Tally["awards"],
    booed: share(booed),
    meanPasses: passes / Math.max(1, counted),
  };
}

export const STRATEGIES: OriginalStrategy[] = [
  { name: "always veronica, kill at pass 3", move: 0, killAt: 3, method: 4, stay: true },
  { name: "always veronica, wait for pass 7", move: 0, killAt: 7, method: 4, stay: true },
  { name: "always swirl, kill at pass 3", move: 2, killAt: 3, method: 4, stay: true },
  { name: "always swirl, wait for pass 7", move: 2, killAt: 7, method: 4, stay: true },
  { name: "kill at once", move: 0, killAt: 1, method: 4, stay: true },
];
