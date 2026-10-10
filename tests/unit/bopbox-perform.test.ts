import { describe, expect, it } from "vitest";
import { arrange } from "@/lib/music/arrange";
import { PATCH } from "@/lib/music/arrange/patches";
import type { Track } from "@/lib/music/arrange/types";
import { cast } from "@/lib/music/perform/cast";
import { Lane, Performance, strike, type Hit } from "@/lib/music/perform/cues";
import { handAt, planHand } from "@/lib/music/perform/fingering";
import { bowStrokes, splitKit, splitMallets } from "@/lib/music/perform/hands";
import { barMap, dancePlan, djPlan } from "@/lib/music/perform/plans";
import { closedHoles, slidePosition, valvesFor } from "@/lib/music/perform/winds";

/*
 * The Live view's performers move from these: when a stick lands, which
 * limb plays a drum, which way a bow goes, where a hand sits, what a dancer
 * or a DJ does in each bar. They are pure, so they are tested here without
 * drawing anything.
 */

const hit = (t: number, pitch: number, dur = 0.2, vel = 100): Hit => ({ at: t * 2, dur: dur * 2, pitch, vel, t, end: t + dur });
const lane = (...hits: Hit[]) => new Lane(hits);

const track = (name: string, patch: Track["patch"], role: Track["role"] = "melody"): Track => ({ id: name, name, role, patch, color: "#fff", notes: [], automation: [], volume: 100, pan: 64, reverb: 0, chorus: 0 });

describe("strike", () => {
  const l = lane(hit(1, 60), hit(2, 62));

  it("touches down exactly on each note and lifts between them", () => {
    expect(strike(l, 1).lift).toBeCloseTo(0, 5);
    expect(strike(l, 2).lift).toBeCloseTo(0, 5);
    expect(strike(l, 1.5).lift).toBeGreaterThan(0.4);
  });

  it("travels from the last note towards the next one", () => {
    const early = strike(l, 1.1).travel;
    const late = strike(l, 1.8).travel;
    expect(late).toBeGreaterThan(early);
    expect(strike(l, 1.99).travel).toBeCloseTo(1, 1);
  });
});

describe("splitKit", () => {
  it("puts the kick on the right foot, the snare in the left hand and the hi-hat in the right", () => {
    const kit = splitKit(lane(hit(0, 36), hit(0, 42), hit(0.5, 38), hit(0.5, 42)));
    expect(kit.rightFoot.hits.map((h) => h.pitch)).toEqual([36]);
    expect(kit.leftHand.hits.map((h) => h.pitch)).toEqual([38]);
    expect(kit.rightHand.hits.map((h) => h.pitch)).toEqual([42, 42]);
  });

  it("shares a fast hi-hat roll between both hands", () => {
    const roll = Array.from({ length: 8 }, (_, i) => hit(i * 0.06, 42));
    const kit = splitKit(lane(...roll));
    expect(kit.leftHand.hits.length).toBeGreaterThan(2);
    expect(kit.rightHand.hits.length).toBeGreaterThan(2);
  });
});

describe("splitMallets", () => {
  it("gives the lower note of a pair to the left mallet", () => {
    const hands = splitMallets(lane(hit(0, 48), hit(0, 60)), 40, 70);
    expect(hands.left.hits[0].pitch).toBe(48);
    expect(hands.right.hits[0].pitch).toBe(60);
  });
});

describe("bowStrokes", () => {
  const bow = bowStrokes(lane(hit(0, 60, 0.5), hit(0.5, 62, 0.5), hit(1, 64, 1.5), hit(4, 65, 0.5)));

  it("starts a phrase on a down-bow and turns at every note", () => {
    expect(bow(0.2).dir).toBe(1);
    expect(bow(0.7).dir).toBe(-1);
    expect(bow(1.2).dir).toBe(1);
    // After a long rest the next phrase starts down-bow again.
    expect(bow(4.1).dir).toBe(1);
  });

  it("keeps the bow on its length and lifts it between phrases", () => {
    for (let t = 0; t < 5; t += 0.05) {
      const b = bow(t);
      expect(b.pos).toBeGreaterThanOrEqual(0);
      expect(b.pos).toBeLessThanOrEqual(1);
    }
    expect(bow(3).lift).toBeGreaterThan(0.5);
  });
});

describe("planHand", () => {
  const keyX = (pitch: number) => pitch;

  it("stays put while the notes fit under five fingers", () => {
    const plan = planHand(lane(hit(0, 60), hit(0.5, 62), hit(1, 64)), keyX, 1, 62);
    expect(new Set(plan.steps.map((s) => s.centre)).size).toBe(1);
  });

  it("shifts when a note falls outside the hand, and gives each note of a chord its own finger", () => {
    const plan = planHand(lane(hit(0, 60), hit(1, 72), hit(1, 74), hit(1, 76)), keyX, 1, 60);
    expect(plan.steps[1].centre).not.toBe(plan.steps[0].centre);
    const fingers = plan.steps[1].presses.map((p) => p.finger);
    expect(new Set(fingers).size).toBe(fingers.length);
    expect(handAt(plan, 1.05).down.length).toBe(3);
  });
});

describe("wind fingerings", () => {
  it("presses real trumpet valve combinations", () => {
    // Concert B-flat (written C) is open; concert A (written B) is the second valve.
    expect(valvesFor(58)).toEqual([]);
    expect(valvesFor(57)).toEqual([2]);
    expect(valvesFor(56)).toEqual([1]);
  });

  it("moves a trombone's slide out one position per semitone below each harmonic", () => {
    expect(slidePosition(58)).toBe(1);
    expect(slidePosition(57)).toBe(2);
    expect(slidePosition(53)).toBe(1);
    expect(slidePosition(52)).toBe(2);
    expect(slidePosition(40)).toBe(7);
  });

  it("closes more holes for lower notes", () => {
    expect(closedHoles(60)).toBe(6);
    expect(closedHoles(70)).toBeLessThan(closedHoles(62));
  });
});

describe("cast", () => {
  it("seats sections and knows plucked strings from bowed", () => {
    expect(cast(track("String section", PATCH.stringsFast))).toMatchObject({ role: "violin", players: 3 });
    expect(cast(track("Pizzicato strings", PATCH.pizz))).toMatchObject({ role: "violin", pizzicato: true });
    expect(cast(track("Cellos", PATCH.cello)).role).toBe("cello");
    expect(cast(track("Guitarrón (bass)", PATCH.fingerBass)).role).toBe("plucked");
    expect(cast(track("Kendang (dhut)", PATCH.kendang)).role).toBe("kendang");
  });
});

describe("plans", () => {
  const perf = new Performance(arrange("blue", "hiphop"));
  const bars = barMap(perf);

  it("finds the drop: the first bar of the tune after the intro", () => {
    const drop = bars.find((b) => b.drop)!;
    expect(drop.section).toBe("main");
    expect(bars[drop.index - 1].build).toBe(true);
  });

  it("drops to the floor on the last beat of the intro and freezes on the tune's first downbeat", () => {
    const steps = dancePlan(bars);
    const drop = bars.find((b) => b.drop)!;
    expect(steps.find((s) => s.move === "drop")!.to).toBeCloseTo(drop.at, 6);
    expect(steps.find((s) => Math.abs(s.from - drop.at) < 1e-6)!.move).toBe("freeze");
  });

  it("has the DJ cue in the intro and raise a hand on the drop", () => {
    const house = new Performance(arrange("stars", "house"));
    const houseBars = barMap(house);
    const moves = djPlan(houseBars);
    expect(moves[0]).toBe("cue");
    expect(moves[houseBars.findIndex((b) => b.drop)]).toBe("raise");
  });
});
