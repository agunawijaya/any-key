import { describe, expect, it } from "vitest";
import { createRng, mulberry32 } from "@/lib/kit/rng";

describe("mulberry32", () => {
  it("keeps producing the numbers the first four games were built on", () => {
    // Captured from the games' own copies before they moved to the kit.
    const next = mulberry32(12345);
    expect([next(), next(), next(), next()]).toEqual([0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203]);
  });

  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(9000);
    const b = mulberry32(9000);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
});

describe("createRng", () => {
  it("is deterministic for number and string seeds", () => {
    const draw = (seed: number | string) => {
      const rng = createRng(seed);
      return Array.from({ length: 20 }, () => rng.float());
    };
    expect(draw(42)).toEqual(draw(42));
    expect(draw("daily-280")).toEqual(draw("daily-280"));
    expect(draw("daily-280")).not.toEqual(draw("daily-281"));
  });

  it("keeps floats in [0, 1) and ints inside their bounds", () => {
    const rng = createRng("bounds");
    for (let i = 0; i < 2000; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("forks streams that don't depend on how much the parent drew", () => {
    const quiet = createRng("world");
    const busy = createRng("world");
    for (let i = 0; i < 50; i++) busy.float();
    const a = quiet.fork("terrain");
    const b = busy.fork("terrain");
    expect([a.float(), a.float()]).toEqual([b.float(), b.float()]);
    expect(createRng("world").fork("weather").float()).not.toBe(createRng("world").fork("terrain").float());
  });

  it("shuffles a copy and keeps every item", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng(7).shuffle(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(list);
    expect(createRng(7).pick(list)).toBe(createRng(7).pick(list));
  });
});
