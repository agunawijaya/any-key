import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/kit/rng";
import { Corrida } from "@/lib/sol-y-sombra/corrida";
import { crewRating, goringChance, killChance, numberInput, OriginalBull, risk, yesNo, type OriginalEvent } from "@/lib/sol-y-sombra/original";
import { goringOdds, MAX_ATTEMPTS, type Quality, type Tell, type Work } from "@/lib/sol-y-sombra/rules";
import { award, awardOdds } from "@/lib/sol-y-sombra/verdict";

/** Plays the 1970s program with fixed answers until it ends. */
function playOriginal(seed: string, answer: (bull: OriginalBull) => string) {
  const bull = new OriginalBull(createRng(seed).float);
  const events: OriginalEvent[] = [...bull.start()];
  let guard = 0;
  while (bull.waiting !== "done" && guard++ < 300) events.push(...bull.answer(answer(bull)));
  return { bull, events };
}

const veronicasThenKill = (killAt: number) => (bull: OriginalBull) =>
  bull.waiting === "instructions"
    ? "NO"
    : bull.waiting === "kill"
      ? bull.state.pass >= killAt
        ? "YES"
        : "NO"
      : bull.waiting === "cape"
        ? "0"
        : bull.waiting === "run"
          ? "NO"
          : "4";

describe("Sol y Sombra: the 1970s program", () => {
  it("works the goring test as line 940 does", () => {
    expect(risk(3, 3, 0.3, 0.3, 1, 0.5)).toBeCloseTo((3.3 * 0.5) / ((0.6 + 0.1) * 5), 10);
    // A meek bull with poor crews can never gore a veronica on a late pass.
    expect(goringChance(5, 3, 0.5, 0.5, 7)).toBe(0);
  });

  it("has the inversion: worse crews make passes safer and kills easier", () => {
    expect(goringChance(3, 3, 0.5, 0.5, 1)).toBeLessThan(goringChance(3, 3, 0.1, 0.1, 1));
    expect(killChance(3, 0.5, 0.5, 7)).toBeGreaterThan(killChance(3, 0.1, 0.1, 7));
  });

  it("draws the crews from the bull: superb bulls get superb crews", () => {
    const rng = createRng("crews");
    const ratings = Array.from({ length: 2000 }, () => crewRating(1, rng.float).t);
    expect(ratings.filter((t) => t === 1).length / ratings.length).toBeGreaterThan(0.65);
  });

  it("never reports a horse for a poor job, only for an awful picador job", () => {
    for (let i = 0; i < 400; i++) {
      const { events } = playOriginal(`horses/${i}`, veronicasThenKill(3));
      for (const e of events) {
        if (e.kind !== "crew") continue;
        if (e.rating === 4) expect(e.casualties.horses).toBeNull();
        if (e.crew === "toreadores") expect(e.casualties.horses).toBeNull();
        if (e.rating < 4) expect(e.casualties).toEqual({ horses: null, men: null });
      }
    }
  });

  it("ignores the choice of kill: 4 and 5 end every game the same way", () => {
    for (let i = 0; i < 200; i++) {
      const a = playOriginal(`kill/${i}`, (b) => (b.waiting === "how" ? "4" : veronicasThenKill(4)(b)));
      const b = playOriginal(`kill/${i}`, (b) => (b.waiting === "how" ? "5" : veronicasThenKill(4)(b)));
      expect(a.events.map((e) => e.kind)).toEqual(b.events.map((e) => e.kind));
    }
  });

  it("panics on any other number at the moment of truth", () => {
    const { events } = playOriginal("panic", (b) => (b.waiting === "how" ? "3" : veronicasThenKill(1)(b)));
    expect(events.some((e) => e.kind === "panicked")).toBe(true);
  });

  it("accepts only YES and NO, in capitals", () => {
    expect(yesNo("YES")).toBe(true);
    expect(yesNo("NO")).toBe(false);
    expect(yesNo("yes")).toBeNull();
    expect(yesNo("Y")).toBeNull();
    const bull = new OriginalBull(createRng("asks").float);
    bull.start();
    bull.answer("NO");
    expect(bull.answer("yes")).toEqual([{ kind: "bad-yes-no" }]);
  });

  it("reads numbers as BASIC does, and refuses cape moves outside 0–2", () => {
    expect(numberInput(" 2 ")).toBe(2);
    expect(numberInput("1.5")).toBe(1.5);
    expect(numberInput("abc")).toBeNull();
    const bull = new OriginalBull(createRng("cape").float);
    bull.start();
    bull.answer("NO");
    bull.answer("NO");
    expect(bull.answer("3")).toEqual([{ kind: "bad-cape" }]);
    expect(bull.answer("1.5")).toEqual([{ kind: "bad-cape" }]);
    expect(bull.answer("-1")).toEqual([{ kind: "bad-cape" }]);
    expect(bull.answer("x")).toEqual([{ kind: "redo" }]);
  });

  it("gives awards after a fatal goring", () => {
    let checked = 0;
    for (let i = 0; i < 300 && checked < 20; i++) {
      const { events } = playOriginal(`dead/${i}`, veronicasThenKill(12));
      if (!events.some((e) => e.kind === "dead")) continue;
      checked++;
      expect(events.some((e) => e.kind === "award")).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("boos and gives nothing when the matador runs", () => {
    for (let i = 0; i < 300; i++) {
      const { events } = playOriginal(`run/${i}`, (b) => (b.waiting === "run" ? "YES" : veronicasThenKill(12)(b)));
      if (!events.some((e) => e.kind === "ran")) continue;
      expect(events.some((e) => e.kind === "boos")).toBe(true);
      expect(events.some((e) => e.kind === "award")).toBe(false);
      return;
    }
    throw new Error("no matador ran in 300 games");
  });

  it("is deterministic for a seed", () => {
    expect(playOriginal("same", veronicasThenKill(5)).events).toEqual(playOriginal("same", veronicasThenKill(5)).events);
  });
});

describe("Sol y Sombra: the Classic corrida", () => {
  const setup = { quality: 3 as Quality, tells: ["hooks-left", "tires-early"] as [Tell, Tell], picadores: 3 as Work, banderilleros: 3 as Work };

  it("rolls each pass against the odds its card shows", () => {
    const c = new Corrida("odds", setup);
    expect(c.moveOdds("veronica").goring).toBe(goringOdds("veronica", { ...setup, pass: 1, side: "right", hurt: false }));
    expect(c.moveOdds("swirl").goring).toBeLessThan(c.moveOdds("outside").goring);
    expect(c.moveOdds("outside").goring).toBeLessThan(c.moveOdds("veronica").goring);
  });

  it("makes better crews safer, as the instructions of 1978 promised", () => {
    const good = new Corrida("crew", { ...setup, picadores: 1, banderilleros: 1 });
    const poor = new Corrida("crew", { ...setup, picadores: 5, banderilleros: 5 });
    expect(good.moveOdds("veronica").goring).toBeLessThan(poor.moveOdds("veronica").goring);
  });

  it("makes passes on the side the bull hooks to riskier", () => {
    const c = new Corrida("hooks", setup);
    const right = c.moveOdds("veronica").goring;
    c.makePass("swirl");
    // The second pass goes by his left, the side he hooks to; the tiring makes it a little safer, the hook much riskier.
    expect(c.nextSide).toBe("left");
    expect(c.moveOdds("veronica").goring).toBeGreaterThan(right * 1.2);
  });

  it("keeps the meter honest and the verdict's odds summing to one", () => {
    for (const total of [0, 5, 12, 18, 25, 40]) {
      for (const cap of [1, 3] as const) {
        const odds = awardOdds(total, cap);
        expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        if (cap === 1) expect(odds[2] + odds[3]).toBe(0);
      }
    }
    expect(award(30, 0.99, 1).tier).toBe(1);
  });

  it("caps the crowd at applause without a finish", () => {
    const c = new Corrida("retire", setup);
    let guard = 0;
    while (c.phase === "pass" && guard++ < 200) c.makePass("veronica");
    if (c.phase === "down") c.retire();
    expect(c.phase).toBe("verdict");
    expect(c.cap).toBe(1);
    expect(c.decide().tier).toBeLessThanOrEqual(1);
  });

  it("carrying on after a goring is braver and riskier", () => {
    for (let i = 0; i < 200; i++) {
      const c = new Corrida(`down/${i}`, setup);
      while (c.phase === "pass" && c.passes < 30) c.makePass("veronica");
      if (c.phase !== "down") continue;
      const before = c.meter.courage;
      c.carryOn();
      expect(c.hurt).toBe(true);
      expect(c.meter.courage).toBeGreaterThan(before);
      const hurt = c.moveOdds("veronica").goring;
      const fresh = new Corrida("fresh", setup);
      for (let p = 0; p < c.passes; p++) fresh.makePass("swirl");
      if (fresh.phase === "pass") expect(hurt).toBeGreaterThan(fresh.moveOdds("veronica").goring);
      return;
    }
    throw new Error("no goring to carry on from");
  });

  it("leads the bull back to the corrals after too many misses", () => {
    for (let i = 0; i < 500; i++) {
      const c = new Corrida(`misses/${i}`, { ...setup, quality: 1, tells: ["keeps-strength", "charges-late"] });
      c.beginTruth();
      while (c.phase === "truth") c.tryFinish("waiting");
      if (c.ending === "returned") {
        expect(c.attempts).toBe(MAX_ATTEMPTS);
        return;
      }
    }
    throw new Error("never ran out of attempts");
  });

  it("is deterministic for a seed and the same choices", () => {
    const run = () => {
      const c = new Corrida("repeat");
      while (c.phase === "pass" && c.passes < 4) c.makePass("outside");
      if (c.phase === "down") c.carryOn();
      if (c.phase === "pass") c.beginTruth();
      while (c.phase === "truth") c.tryFinish("over-the-horns");
      if (c.phase === "down") c.retire();
      return [c.quality, c.tells, c.history, c.decide()];
    };
    expect(run()).toEqual(run());
  });
});
