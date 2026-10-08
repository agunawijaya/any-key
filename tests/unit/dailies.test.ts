import { describe, expect, it } from "vitest";
import { dailyDrop } from "@/lib/lander/missions";
import { dailyFor } from "@/lib/outta/daily";
import { dailyPuzzle } from "@/lib/stickler/modes";

/* Captured before the games moved to the kit's date maths: today's puzzles must not change for anyone. */
const day = new Date(2026, 9, 7, 12);

describe("the games' dailies after the move to the kit", () => {
  it("Stickler deals the same puzzle", () => {
    expect(dailyPuzzle(day)).toEqual({ number: 280, key: "2026-10-07", rules: { rows: [22], minTake: 1, maxTake: 3, first: 0 }, level: "master" });
  });

  it("Outta Here builds the same screen", () => {
    expect(dailyFor(day)).toMatchObject({ number: 280, key: "2026-10-07", seed: 79599 });
  });

  it("Don't Crater drops the same lander", () => {
    expect(dailyDrop(day)).toEqual({ number: 280, key: "2026-10-07", world: "psyche", speed: 4200, fuelFactor: 1.01, cargo: 4000 });
  });
});
