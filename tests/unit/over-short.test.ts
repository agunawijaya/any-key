import { describe, expect, it } from "vitest";
import { vacuumRange } from "@/lib/over-short/ballistics";
import { calculatorBot, gunnerBot, playOut } from "@/lib/over-short/bots";
import { classicEngagement, classicRules, classicScore } from "@/lib/over-short/classic";
import { act, createEngagement, nextEnemyMiss, observe, roundsLeft, type Engagement, type Rules, type TargetSpec } from "@/lib/over-short/engagement";
import { buildMission, missionById, MISSIONS } from "@/lib/over-short/missions";
import { fly } from "@/lib/over-short/models";
import { judge } from "@/lib/over-short/original";
import { inWords, spokenReport } from "@/lib/over-short/words";

/** The elevation that lands a vacuum round exactly at `distance`. */
const exact = (maxRange: number, distance: number) => (Math.asin(distance / maxRange) * 90) / Math.PI;

const dump = (distance: number, over: Partial<TargetSpec> = {}): TargetSpec => ({ kind: "dump", distance, height: 0, speed: 0, radius: 100, hits: 1, ...over });

const fire = (e: Engagement, elevation: number) => act(e, { kind: "fire", elevation });

describe("Over / Short engine", () => {
  it("calls a round within the radius a hit, and otherwise over or short by the rounded distance", () => {
    const rules = { reports: "distance" as const, rounding: 10 };
    expect(observe(99.9, 100, rules)).toEqual({ call: "hit", distance: null });
    expect(observe(-100, 100, rules)).toEqual({ call: "short", distance: 100 });
    expect(observe(344, 100, rules)).toEqual({ call: "over", distance: 340 });
    expect(observe(-344, 100, { reports: "direction", rounding: 10 })).toEqual({ call: "short", distance: null });
  });

  it("fixes the 1973 bug: a round exactly 100 short is short, not over", () => {
    const R = 30000;
    const B = 20;
    // The 1973 judge, with its own 57.3: a round between 100 and 101 short is called over.
    expect(judge(R, Math.ceil(R * Math.sin((2 * B) / 57.3) + 100), B).kind).toBe("over");
    // Ours, with exact radians, on a round the same distance short.
    const miss = vacuumRange(R, B) - Math.ceil(vacuumRange(R, B) + 100);
    expect(observe(miss, 100, { reports: "distance", rounding: 1 })).toEqual({ call: "short", distance: Math.round(-miss) });
  });

  it("Classic: the formula hits every target first time, and five misses at one target lose the gun", () => {
    const perfect = playOut(classicEngagement("unit"), calculatorBot, act);
    expect(perfect.outcome).toBe("won");
    expect(classicScore(perfect)).toMatchObject({ total: 5, destroyed: 5, firstRoundHits: 5, metStandard: true });

    let e = classicEngagement("unit");
    for (let k = 0; k < 4; k++) e = fire(e, 89).engagement;
    expect(roundsLeft(e)).toBe(1);
    const last = fire(e, 89);
    expect(last.engagement.outcome).toBe("gun-lost");
    expect(last.events.at(-1)).toEqual({ kind: "over", outcome: "gun-lost" });
  });

  it("refuses an elevation outside the gun's limits without spending a round", () => {
    const e = createEngagement({ ...classicRules(12000), elevation: { min: 50, max: 85 } }, [dump(6000)]);
    const turn = fire(e, 30);
    expect(turn.events).toEqual([{ kind: "refused", reason: "too-low" }]);
    expect(turn.engagement.shots).toHaveLength(0);
  });

  it("a bridge takes two hits, and the second can come from the other side of 45°", () => {
    const R = 12000;
    const e = createEngagement(classicRules(R), [dump(8000, { kind: "bridge", hits: 2 })]);
    const low = exact(R, 8000);
    const first = fire(e, low);
    expect(first.events.map((x) => x.kind)).toEqual(["shot"]);
    expect(first.engagement.hitsOnTarget).toBe(1);
    const second = fire(first.engagement, 90 - low);
    expect(second.engagement.outcome).toBe("won");
    expect(second.events.map((x) => x.kind)).toEqual(["shot", "target-destroyed", "over"]);
  });

  it("an enemy battery walks its rounds in until one lands on the gun; moving the gun makes it start again", () => {
    const rules: Rules = { ...classicRules(12000), ammo: { total: 12, perTarget: null }, counterfire: { first: 600, closing: 0.4, lethal: 100 }, relocations: { count: 1, step: 300 } };
    let e = createEngagement(rules, [dump(5000, { kind: "battery" })]);
    e = fire(e, 10).engagement;
    e = fire(e, 10).engagement;
    expect(e.enemy.map((r) => Math.round(r.miss))).toEqual([600, 240]);
    expect(nextEnemyMiss(e)?.lethal).toBe(true);
    const moved = act(e, { kind: "relocate", direction: -1 });
    expect(moved.engagement.gunAt).toBe(-300);
    expect(moved.engagement.enemyRanging).toBe(0);
    expect(moved.events[1]).toMatchObject({ kind: "enemy-round", round: { emptyPit: true, onGun: false } });
    // From the new pit the target is 300 m further off.
    expect(fire(moved.engagement, 10).engagement.shots.at(-1)!.targetDistance).toBeCloseTo(5300, 6);
    // Staying put instead: the third round finds the gun.
    expect(fire(e, 10).engagement.outcome).toBe("gun-lost");
  });

  it("against the clock, a round that lands after time is up does not count", () => {
    const R = 12000;
    const rules: Rules = { ...classicRules(R), ammo: { total: 8, perTarget: null }, clock: { limit: 40, reload: 15 } };
    const e = createEngagement(rules, [dump(6000)]);
    // The high road takes more than a minute to come down.
    const turn = fire(e, 90 - exact(R, 6000));
    expect(turn.events[0].kind).toBe("too-late");
    expect(turn.engagement.outcome).toBe("out-of-time");
  });

  it("a moving target is judged where it is when the round comes down", () => {
    const R = 12000;
    const rules: Rules = { ...classicRules(R), ammo: { total: 5, perTarget: null } };
    const e = createEngagement(rules, [dump(6000, { kind: "convoy", speed: 10 })]);
    const shot = fire(e, exact(R, 6000)).engagement.shots[0];
    expect(shot.targetDistance).toBeCloseTo(6000 + 10 * shot.flight.time, 6);
    expect(shot.report.call).toBe("short");
  });

  it("every mission builds the same way from the same seed, and differently from another", () => {
    for (const spec of MISSIONS) {
      const a = buildMission(spec, "x");
      expect(buildMission(spec, "x")).toEqual(a);
      expect(a.targets.length).toBe(spec.targets.length);
    }
    const one = buildMission(missionById("1-1")!, "a").targets[0].distance;
    const other = buildMission(missionById("1-1")!, "b").targets[0].distance;
    expect(one).not.toBe(other);
  });

  it("a sensible gunner wins the finale against the clock and the enemy", () => {
    for (const id of ["5-3", "5-4"]) {
      for (let i = 0; i < 10; i++) expect(playOut(buildMission(missionById(id)!, `unit/${i}`), gunnerBot(), act).outcome).toBe("won");
    }
  });

  it("the vacuum model lands exactly where the 1973 formula says", () => {
    const gun = { vacuumRange: 13000, drag: 0 };
    for (const e of [3, 17.5, 45, 62.25, 88]) expect(fly("vacuum", gun, e, { distance: 13000, height: 0 }).landed).toBeCloseTo(vacuumRange(13000, e), 2);
  });
});

describe("Over / Short words", () => {
  it("says numbers the British way", () => {
    expect(inWords(110)).toBe("one hundred and ten");
    expect(inWords(4717)).toBe("four thousand seven hundred and seventeen");
    expect(inWords(2040)).toBe("two thousand and forty");
    expect(inWords(12000)).toBe("twelve thousand");
  });

  it("reports in the player's units", () => {
    expect(spokenReport({ call: "short", distance: 110 }, "m", false)).toBe("Short. One hundred and ten metres.");
    expect(spokenReport({ call: "over", distance: 914.4 }, "yd", false)).toBe("Over. One thousand yards.");
    expect(spokenReport({ call: "over", distance: null }, "m", false)).toBe("Over.");
    expect(spokenReport({ call: "hit", distance: null }, "m", true)).toBe("Direct hit. Target destroyed.");
  });
});
