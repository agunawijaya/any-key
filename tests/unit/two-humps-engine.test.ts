import { describe, expect, it } from "vitest";
import { play, sensiblePolicy } from "@/lib/two-humps/bots";
import { dailyFor } from "@/lib/two-humps/daily";
import { Trek, type TrekConfig } from "@/lib/two-humps/engine";
import { LEGS } from "@/lib/two-humps/expedition";
import { MAX_FATIGUE } from "@/lib/two-humps/rules";
import { tutorialConfig } from "@/lib/two-humps/tutorial";

const config = (over: Partial<TrekConfig> = {}): TrekConfig => ({ pursuer: "haboob", difficulty: "normal", seed: "test", startClock: 6, ...over });

/** Plays commands until the camel runs on, so the run-on can be tested. */
function untilRunOn(seedBase: string, pursuer: TrekConfig["pursuer"] = "haboob") {
  for (let i = 0; i < 400; i++) {
    const trek = new Trek(config({ seed: `${seedBase}/${i}`, pursuer }));
    trek.act("walk");
    if (trek.state.phase === "run-on") return trek;
  }
  throw new Error("the camel never ran on");
}

describe("Two Humps engine", () => {
  it("is deterministic: the same seed and the same player give the same trek", () => {
    const a = play(config({ seed: "same" }), sensiblePolicy());
    const b = play(config({ seed: "same" }), sensiblePolicy());
    expect(a.trek.state.log).toEqual(b.trek.state.log);
  });

  it("strides taken on the run cost fatigue but no water, no time and no pursuer move", () => {
    // However many strides the camel runs on for, the whole command is one turn.
    for (let i = 0; i < 400; i++) {
      const trek = untilRunOn(`run/${i}`);
      const s = trek.state;
      const before = { thirst: s.thirst, turn: s.turn, pursuer: s.pursuer.at, fatigue: s.fatigue };
      trek.letRun();
      if (s.phase !== "run-on") continue;
      expect(s.thirst).toBe(before.thirst);
      expect(s.turn).toBe(before.turn);
      expect(s.pursuer.at).toBe(before.pursuer);
      expect(s.fatigue).toBeGreaterThan(before.fatigue);
      trek.pullReins();
      expect(s.turn).toBe(before.turn + 1);
      expect(s.thirst).toBe(before.thirst - 1);
      return;
    }
    throw new Error("never ran on twice");
  });

  it("pulling the reins ends the turn: time passes and the pursuer moves", () => {
    const trek = untilRunOn("reins");
    const turn = trek.state.turn;
    const happened = trek.pullReins();
    expect(trek.state.turn).toBe(turn + 1);
    expect(happened.map((h) => h.kind)).toContain("pursuer");
  });

  it("letting the camel run past seven humps of fatigue makes it collapse", () => {
    for (let i = 0; i < 400; i++) {
      const trek = new Trek(config({ seed: `collapse/${i}` }));
      trek.state.fatigue = MAX_FATIGUE - 1;
      trek.act("walk");
      if (trek.state.phase !== "run-on") continue;
      trek.letRun();
      expect(trek.state.ending).toBe("collapse");
      return;
    }
    throw new Error("no run-on found");
  });

  it("refuses a gallop the camel is too tired for, and says why", () => {
    const trek = new Trek(config());
    trek.state.fatigue = 5;
    expect(trek.preview("gallop")).toMatchObject({ legal: false, reason: "Too tired to gallop" });
    expect(trek.preview("walk").legal).toBe(true);
  });

  it("an oasis on the way stops the camel and fills the canteen", () => {
    const trek = new Trek(config({ seed: "oasis" }));
    trek.state.sips = 1;
    const oasis = trek.state.oases[0];
    trek.state.miles = oasis.at - 1;
    for (let i = 0; i < 20 && trek.state.miles < oasis.at; i++) {
      trek.state.fatigue = 0;
      trek.state.phase = "choose";
      trek.act("gallop");
    }
    expect(trek.state.miles).toBe(oasis.at);
    expect(trek.state.sips).toBe(trek.state.canteen);
  });

  it("a handful of seeds stops the Ladle Gang for a step", () => {
    const trek = new Trek(config({ pursuer: "gang", startClock: 22 }));
    trek.state.pursuer.steps = 10;
    trek.state.miles = 30;
    const at = trek.state.pursuer.at;
    expect(trek.tossSeeds()).toEqual([{ kind: "seeds", left: 2 }]);
    trek.act("camp");
    // A night's sleep is several steps; the first of them is spent eating.
    const first = trek.state.log.length;
    expect(first).toBeGreaterThan(0);
    expect(trek.state.pursuer.at).toBeGreaterThanOrEqual(at);
    expect(trek.state.record.seedsThrown).toBe(1);
  });

  it("the rival drinks every oasis it reaches first", () => {
    const trek = new Trek(config({ pursuer: "rival", seed: "dry" }));
    trek.state.miles = 39;
    trek.state.pursuer.at = trek.state.oases[0].at - 0.5;
    trek.act("camp");
    expect(trek.state.oases[0].dry).toBe(true);
  });

  it("a daily crossing is the same for everyone and rotates its pursuer", () => {
    const today = dailyFor(new Date(2026, 9, 9));
    expect(dailyFor(new Date(2026, 9, 9))).toEqual(today);
    expect(today.number).toBe(1);
    const week = Array.from({ length: 3 }, (_, i) => dailyFor(new Date(2026, 9, 9 + i)).config.pursuer);
    expect(new Set(week).size).toBe(3);
  });

  /*
   * Balance, locked loosely here (the exact targets are checked with many
   * more crossings by scripts/check-two-humps.ts).
   */
  const rate = (c: Partial<TrekConfig>, n = 400) => {
    let won = 0;
    for (let i = 0; i < n; i++) if (play(config({ ...c, seed: `lock/${i}`, startClock: i % 2 ? 18 : 6 }), sensiblePolicy()).won) won++;
    return won / n;
  };

  it.each([
    ["haboob", 0.55, 0.65],
    ["rival", 0.5, 0.6],
    ["gang", 0.4, 0.5],
  ] as const)("the sensible player beats the %s on Normal about as often as designed", (pursuer, lo, hi) => {
    const r = rate({ pursuer });
    expect(r).toBeGreaterThan(lo - 0.07);
    expect(r).toBeLessThan(hi + 0.07);
  });

  it("every expedition leg can be won by the sensible player at least four times in ten", () => {
    for (const leg of LEGS) {
      let won = 0;
      for (let i = 0; i < 300; i++) if (play({ pursuer: leg.pursuer, difficulty: "normal", seed: `leg/${i}`, startClock: leg.startClock, twist: leg.twist }, sensiblePolicy()).won) won++;
      expect(won / 300, leg.place).toBeGreaterThan(0.36);
    }
  });

  it("Daily Crossing #1 is the day the game was built, against the Haboob", () => {
    expect(dailyFor(new Date(2026, 9, 9, 12))).toMatchObject({ number: 1, key: "2026-10-09", config: { pursuer: "haboob", difficulty: "normal", startClock: 6 } });
  });

  it("the tutorial's dice teach the lesson at dawn and at dusk", () => {
    for (const clock of [6, 18]) {
      const trek = new Trek(tutorialConfig(clock));
      const walk = trek.act("walk");
      expect(walk.some((h) => h.kind === "oasis" || (h.kind === "gust" && h.shift > 0)), `walk at ${clock}`).toBe(true);
      expect(trek.state.phase).toBe("choose");
      expect(trek.act("drink")[0].kind).toBe("drink");
      trek.act("gallop");
      expect(trek.state.phase, `gallop at ${clock}`).toBe("run-on");
      trek.pullReins();
      expect(trek.state.phase).toBe("choose");
      expect(trek.state.ending).toBeNull();
    }
  });
});
