import { describe, expect, it } from "vitest";
import golden from "../fixtures/over-short-1970s.json";
import { buildDaily, dailyMarks, dailyOn, dailyShare } from "@/lib/over-short/daily";
import { actDuel, createDuel, DUEL_ROUNDS, type DuelEngagement } from "@/lib/over-short/duel";
import { actField, createField, litAt, type FieldEngagement, type FieldRules } from "@/lib/over-short/field";
import { fieldOracle, oracleAim } from "@/lib/over-short/fieldBots";
import { buildFieldMission, fieldMedalFor, fieldMissionById } from "@/lib/over-short/fieldMissions";
import { FIELD_GUN, firingTable, flyField, levelGround, milsFor } from "@/lib/over-short/fieldModel";
import { afterDaily, afterDuel, afterField, afterTerminal, getProgress } from "@/lib/over-short/progress";
import { bootTerminal, errorOf, readNumber, typeLine, type Program, type TerminalEvent } from "@/lib/over-short/terminal";
import { correctionWords, windWords } from "@/lib/over-short/words";

/*
 * Over / Short's Field Artillery family in small, fast cases: the 3D flight
 * model, the engagement's orders and reports, the duel's simultaneous
 * turns, the Daily's share, the 1970s terminals against the unmodified
 * programs, and what the records keep. The long simulations are in
 * scripts/check-over-short.ts.
 */

const still = { along: 0, across: 0 };

/** A plain shoot on level ground, for checking one rule at a time. */
function plainShoot(patch: Partial<FieldRules> = {}, target = { x: 4000, z: 0 }): FieldEngagement {
  const rules: FieldRules = {
    gun: FIELD_GUN,
    terrain: levelGround(20),
    wind: still,
    gusts: 0,
    told: { mapError: { along: 0, across: 0 }, forecast: still },
    wear: 0,
    dispersion: 0,
    observer: { error: 0, rounding: 10, milsHint: false },
    ammo: 6,
    reload: 25,
    recharge: 15,
    deadline: null,
    enemy: null,
    relocations: { count: 0, step: 400 },
    smoke: [],
    night: null,
    limits: { elevation: { min: 0, max: 70 }, line: 300 },
    ...patch,
  };
  return createField(rules, [{ kind: "dump", ...target, vx: 0, vz: 0, radius: 30, hits: 1 }], "unit");
}

describe("the Field Artillery flight model", () => {
  it("is the 1973 formula without air, and drifts with a crosswind by the lag rule with it", () => {
    const vacuum = flyField({ charges: [300], drag: 0 }, { charge: 1, elevation: 30, line: 0 }, 0, levelGround(), still, { muzzle: 0 });
    expect(vacuum.burst.x).toBeCloseTo((300 * 300 * Math.sin(Math.PI / 3)) / 9.81, 1);
    const drifted = flyField(FIELD_GUN, { charge: 2, elevation: 25, line: 0 }, 0, levelGround(), { along: 0, across: 5 }, { muzzle: 0 });
    const lag = 5 * (drifted.time - drifted.burst.x / (245 * Math.cos((25 * Math.PI) / 180)));
    expect(drifted.burst.z).toBeCloseTo(lag, 0);
  });

  it("lays the line in mils: 10 mils right at 4 km comes down about 39 m right", () => {
    const f = flyField(FIELD_GUN, { charge: 3, elevation: 15, line: 10 }, 0, levelGround(), still, { muzzle: 0 });
    expect(f.burst.z).toBeGreaterThan(35);
    expect(f.burst.z).toBeLessThan(45);
    expect(milsFor(f.burst.z, f.burst.x)).toBeCloseTo(10, 0);
  });

  it("prints a firing table whose wind columns agree with the flight", () => {
    const row = firingTable(FIELD_GUN, 3).find((r) => r.elevation === 20)!;
    const windy = flyField(FIELD_GUN, { charge: 3, elevation: 20, line: 0 }, 0, levelGround(), { along: 3, across: 3 }, { muzzle: 0 });
    expect(Math.abs(row.range + 3 * row.tail - windy.burst.x)).toBeLessThan(15);
    expect(Math.abs(3 * row.drift - windy.burst.z)).toBeLessThan(1);
  });
});

describe("a Field Artillery engagement", () => {
  it("refuses a lay the gun cannot take, and wins with the solved aim", () => {
    const e = plainShoot();
    expect(actField(e, { kind: "fire", aim: { charge: 5, elevation: 20, line: 0 } }).events).toEqual([{ kind: "refused", reason: "charge" }]);
    expect(actField(e, { kind: "fire", aim: { charge: 2, elevation: 80, line: 0 } }).events).toEqual([{ kind: "refused", reason: "elevation" }]);
    expect(actField(e, { kind: "illuminate" }).events).toEqual([{ kind: "refused", reason: "daylight" }]);
    const { engagement, events } = actField(e, { kind: "fire", aim: oracleAim(e)! });
    expect(engagement.outcome).toBe("won");
    expect(events.map((v) => v.kind)).toEqual(["shot", "target-destroyed", "over"]);
  });

  it("reports corrections in the observer's words: add or drop, left or right", () => {
    const e = plainShoot();
    const aim = oracleAim(e)!;
    const short = actField(e, { kind: "fire", aim: { ...aim, elevation: aim.elevation - 1.5, line: aim.line + 15 } }).engagement.shots[0];
    expect(short.report.kind).toBe("correction");
    if (short.report.kind !== "correction") return;
    expect(short.report.range?.word).toBe("add");
    expect(short.report.line?.word).toBe("left");
    expect(correctionWords(short.report, "m")).toMatch(/^Add \d+\. Left \d+\.$/);
  });

  it("loses the fall of shot in the smoke, and sees only the flash at night without a star shell", () => {
    const smoky = plainShoot({ smoke: [1] });
    expect(actField(smoky, { kind: "fire", aim: { charge: 2, elevation: 20, line: 0 } }).engagement.shots[0].report.kind).toBe("lost");
    const dark = plainShoot({ night: { starShells: 1, burn: 70 } });
    const flash = actField(dark, { kind: "fire", aim: { charge: 2, elevation: 20, line: 0 } }).engagement.shots[0].report;
    expect(flash.kind).toBe("flash");
    const lit = actField(dark, { kind: "illuminate" }).engagement;
    expect(litAt(lit, lit.time + 20)).toBe(true);
    expect(actField(lit, { kind: "fire", aim: { charge: 2, elevation: 20, line: 0 } }).engagement.shots[0].report.kind).toBe("correction");
  });

  it("moves the gun under fire: their round meanwhile falls on the empty pit, and they start ranging again", () => {
    const hunted = plainShoot({ enemy: { x: 4000, z: 0, opensAt: 10, interval: 50, first: 700, closing: 0.5, lethal: 40, isTarget: true }, relocations: { count: 1, step: 400 } });
    const ranged = actField(hunted, { kind: "fire", aim: { charge: 2, elevation: 10, line: 0 } }).engagement;
    expect(ranged.ranging).toBeGreaterThan(0);
    const moved = actField(ranged, { kind: "relocate", direction: -1 });
    expect(moved.engagement.gunX).toBe(-400);
    expect(moved.engagement.ranging).toBe(0);
    expect(moved.events.filter((v) => v.kind === "enemy-round").every((v) => v.kind === "enemy-round" && v.round.emptyPit)).toBe(true);
  });

  it("calls a round that lands after the column has crossed too late", () => {
    const e = plainShoot({ deadline: 5 });
    const { engagement, events } = actField(e, { kind: "fire", aim: oracleAim(e)! });
    expect(events.some((v) => v.kind === "too-late")).toBe(true);
    expect(engagement.outcome).toBe("out-of-time");
  });

  it("every mission is won by a player who knows the physics, and medals go by rounds and time", () => {
    for (const id of ["F1", "F6", "F9"]) {
      let e = buildFieldMission(fieldMissionById(id)!, "unit-check", "normal");
      for (let k = 0; k < 30 && !e.outcome; k++) e = actField(e, fieldOracle(e)).engagement;
      expect(e.outcome).toBe("won");
    }
    const spec = fieldMissionById("F1")!;
    expect(fieldMedalFor(spec, spec.medals.gold.rounds, spec.medals.gold.seconds)).toBe("gold");
    expect(fieldMedalFor(spec, spec.medals.gold.rounds, spec.medals.gold.seconds + 1)).toBe("silver");
    expect(fieldMedalFor(spec, 9, 9999)).toBe("bronze");
  });
});

describe("the Counter-Battery Duel", () => {
  const fire = (charge: number, elevation: number) => ({ kind: "fire" as const, aim: { charge, elevation, line: 0 } });

  it("fires both guns together; a battery that moves leaves the other's round on the empty pit", () => {
    const e = createDuel("unit", "normal", "player", "player");
    const { engagement, events } = actDuel(e, { west: { kind: "relocate" }, east: fire(3, 25) });
    expect(engagement.west.x).toBe(-400);
    expect(events.map((v) => v.kind)).toEqual(["relocated", "empty-pit"]);
  });

  it("ends when both pits are empty: the battery that took fewer hits has it", () => {
    let e: DuelEngagement = createDuel("unit-dry", "normal", "player", "player");
    e = { ...e, west: { ...e.west, rounds: 1, hitsTaken: 1 }, east: { ...e.east, rounds: 1 } };
    const end = actDuel(e, { west: fire(1, 5), east: fire(1, 5) }).engagement;
    expect(end.west.rounds + end.east.rounds).toBe(0);
    expect(end.winner).toBe("east");
    expect(DUEL_ROUNDS).toBe(20);
  });
});

describe("the Daily Barrage", () => {
  it("is the same for everyone on a day, and shares its marks, its wind and the link", () => {
    expect(dailyOn(41)).toEqual(dailyOn(41));
    const daily = { number: 42, key: "2026-11-20", ...dailyOn(41) };
    let e = buildDaily(daily);
    for (let k = 0; k < 30 && !e.outcome; k++) e = actField(e, fieldOracle(e)).engagement;
    const share = dailyShare(daily, e, "https://example.test/over-short");
    const lines = share.split("\n");
    expect(lines[0]).toBe("Over / Short · Daily Barrage #42");
    expect(lines[1]).toContain(dailyMarks(e));
    expect(lines[1]).toMatch(/target down in \d+ rounds? · wind (calm|\d+ km\/h from the [a-z-]+)/);
    expect(lines[2]).toBe("https://example.test/over-short");
  });

  it("names the wind as a forecast does, the line of fire running east", () => {
    expect(windWords({ along: 3.3, across: 0 })).toBe("12 km/h from the west");
    expect(windWords({ along: 0, across: 5 })).toBe("18 km/h from the north");
    expect(windWords({ along: -2, across: -2 })).toBe("10 km/h from the south-east");
    expect(windWords({ along: 0.2, across: 0 })).toBe("calm");
  });
});

describe("the 1970s terminals", () => {
  it.each(golden.runs.map((run) => [run.name, run] as const))("%s goes step for step with the unmodified program", (_, run) => {
    let step = bootTerminal(run.program as Program);
    const events: TerminalEvent[] = [...step.events];
    for (const typed of run.typed) {
      step = typeLine(step.state, typed);
      events.push(...step.events);
    }
    expect(events).toEqual(run.events);
  });

  it("keeps the quirks: exactly 100 short is called over, odd input is refused, Gunner wants a capital Y", () => {
    expect(errorOf(30000, 15000, 15)).toBe(Math.floor(Math.fround(15000 - Math.fround(30000 * Math.fround(Math.sin(Math.fround(30 / Math.fround(57.3))))))));
    expect(readNumber("")).toBe(0);
    expect(readNumber("abc")).toBeNull();
    expect(readNumber("12.5")).toBe(12.5);
    const gunner = bootTerminal("gunner");
    let step = gunner;
    for (let k = 0; k < 6; k++) step = typeLine(step.state, "60");
    expect(step.events).toEqual([{ kind: "found" }]);
    expect(typeLine(step.state, "y").events).toEqual([{ kind: "again", yes: false }]);
    expect(typeLine(step.state, "Y").events[0]).toEqual({ kind: "again", yes: true });
  });
});

describe("what the records keep", () => {
  it("a won mission's medal, a Daily once a day, a duel against a commander, and both terminals finished", () => {
    let e = buildFieldMission(fieldMissionById("F1")!, "unit-records", "easy");
    for (let k = 0; k < 30 && !e.outcome; k++) e = actField(e, fieldOracle(e)).engagement;
    let p = afterField(getProgress(), "F1", "easy", e);
    expect(p.field.missions["F1/easy"].wins).toBe(1);
    expect(p.field.missions["F1/easy"].medal).not.toBeNull();
    p = afterDaily(p, "2026-11-20", 42, e, dailyMarks(e));
    p = afterDaily(p, "2026-11-20", 42, { ...e, outcome: "out-of-ammo" }, "⬆️");
    expect(p.daily["2026-11-20"].won).toBe(true);
    const duel = { ...createDuel("unit-rec", "normal", "player", "methodical"), winner: "west" as const };
    p = afterDuel(p, duel);
    expect(p.duel.beat.methodical).toBe(1);
    expect(p.achievements).toContain("duelist");
    p = afterTerminal(afterTerminal(p, "gunner", true, 9), "cannoneer", true, 12);
    expect(p.achievements).toContain("old-terminals");
    expect(p.terminals.gunner.best).toBe(9);
  });
});
