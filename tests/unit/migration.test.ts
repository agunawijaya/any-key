/*
 * Every player's progress from before the kit must survive the move: each
 * game's fixture is today's real save shape, written under its old key.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "fixtures", name), "utf8");
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("Stickler", () => {
  it("keeps every badge, ladder star, daily, Handfuls record and setting", async () => {
    const old = fixture("stickler.v1.json");
    localStorage.setItem("anykey.stickler.v1", old);
    const { getProgress } = await import("@/lib/stickler/progress");
    const p = getProgress();

    expect(p.achievements.sort()).toEqual(["clean-sweep", "climber", "collector", "daily-3", "first-light", "hot-streak", "stickler"]);
    expect(p.ladder).toEqual({ 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2, 7: 1 });
    expect(Object.keys(p.daily)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(p.daily["2026-10-05"].share).toContain("Stickler Daily #278");
    expect(p).toMatchObject({ wins: 12, losses: 5, streak: 2, bestStreak: 4, skin: "glow", level: "master", hintsSeen: 7 });
    expect(p.skinsUsed).toEqual(["matches", "glow", "candy"]);
    expect(p.handfuls["2-3"]).toEqual({ wins: 2, masterWins: 1 });
    expect(p.handfulsSetup).toEqual({ preset: "3-5", surprise: false, sparkyStarts: true });

    // The old key is left alone for a rollback; the new save has no achievements of its own.
    expect(localStorage.getItem("anykey.stickler.v1")).toBe(old);
    const saved = JSON.parse(localStorage.getItem("anykey.23mtch.save")!);
    expect(saved.version).toBe(2);
    expect(saved.data.achievements).toBeUndefined();

    await settle();
    const { statsFor } = await import("@/lib/kit/stats");
    expect(statsFor("23mtch")).toMatchObject({ plays: 17, wins: 12, streak: 2, bestStreak: 4 });
  });

  it("fills in Handfuls for a save from before it existed", async () => {
    localStorage.setItem("anykey.stickler.v1", fixture("stickler.v1-before-handfuls.json"));
    const { getProgress } = await import("@/lib/stickler/progress");
    const p = getProgress();
    expect(p.handfuls).toEqual({});
    expect(p.handfulsSetup.preset).toBe("2-3");
    expect(p.ladder).toEqual({ 1: 2 });
    expect(p.achievements).toEqual(["first-light"]);
  });

  it("unlocks new badges in the Keyring and counts the daily", async () => {
    localStorage.setItem("anykey.stickler.v1", fixture("stickler.v1.json"));
    const { updateProgress, withAchievement } = await import("@/lib/stickler/progress");
    const { keyringStore } = await import("@/lib/kit/keyring");
    const fresh = updateProgress((p) => ({
      ...withAchievement(withAchievement(p, "flawless"), "first-light"),
      wins: p.wins + 1,
      daily: { ...p.daily, "2026-10-07": { won: true, share: "" } },
    }));
    expect(fresh).toEqual(["flawless"]);
    expect(keyringStore.get().unlocked["23mtch"].flawless).toBeGreaterThan(0);
    expect(keyringStore.get().dailies["2026-10-07"]).toEqual(["23mtch"]);
  });
});

describe("Outta Here", () => {
  it("keeps best times, screens, dailies, badges and the chosen speed", async () => {
    const old = fixture("outta.v1.json");
    localStorage.setItem("anykey.outta.v1", old);
    const { getProgress } = await import("@/lib/outta/progress");
    const p = getProgress();

    expect(p.achievements.sort()).toEqual(["crash-test", "pop", "rush-hour", "scape", "under-keys", "wraparound"]);
    expect(p.best).toEqual({ normal: { time: 31.4, score: 1820 }, hard: { time: 44.9, score: 2410 } });
    expect(p.screens).toEqual({ "green-1": { stars: 3, time: 28.1 }, "green-2": { stars: 2, time: 39.5 }, "amber-1": { stars: 1, time: 51.2 } });
    expect(p.daily["2026-10-04"]).toMatchObject({ won: true, time: 33.3 });
    expect(p).toMatchObject({ runs: 40, escapes: 22, level: "hard" });
    expect(localStorage.getItem("anykey.outta.v1")).toBe(old);
  });
});

describe("Don't Crater", () => {
  it("keeps the flag design, missions, worlds, sites, badges and flight settings", async () => {
    const old = fixture("lander.v1.json");
    localStorage.setItem("anykey.dontcrater.v1", old);
    const { getProgress } = await import("@/lib/lander/progress");
    const p = getProgress();

    // The design survives; its emoji emblem becomes the drawn emblem of the same name.
    expect(p.flag).toEqual({ shape: "swallow", pattern: "stripes", colors: ["#ff6b1a", "#1b2a6b", "#ffd23d"], emblem: "butter" });
    expect(p.missions).toEqual({ 1: 3, 2: 2, 3: 1, 4: 3 });
    expect(p.best).toEqual({ moon: 1.6, mars: 7.9, earth: 12.4 });
    expect(p.landed).toEqual(["moon", "mars", "earth"]);
    expect(p.flagged).toEqual(["moon"]);
    expect(p.sites.brink).toEqual({ stars: 2, speed: 6.1, narrow: true, centre: false });
    expect(p.achievements.sort()).toEqual(["butter", "crater-maker", "first-touch", "oops", "ten-seconds", "time-traveller", "wildcatter"]);
    expect(p).toMatchObject({ flights: 31, landings: 17, craters: 9, dailyLandings: 1, guide: false, assist: true, world: "mars", difficulty: "tight", scan: true, freeStart: "full", freeSeed: 123456 });
    expect(localStorage.getItem("anykey.dontcrater.v1")).toBe(old);
  });

  it("turns every old emoji emblem into a drawn one", async () => {
    const { EMBLEM_FROM_EMOJI, emblemById } = await import("@/lib/lander/emblems");
    for (const [emoji, id] of Object.entries(EMBLEM_FROM_EMOJI)) {
      localStorage.clear();
      vi.resetModules();
      localStorage.setItem("anykey.dontcrater.v1", JSON.stringify({ flag: { shape: "rect", pattern: "solid", colors: ["#000000", "#ffffff", "#ff0000"], emblem: emoji } }));
      const { getProgress } = await import("@/lib/lander/progress");
      expect(getProgress().flag.emblem).toBe(id);
      expect(emblemById(id).id).toBe(id);
    }
  });

  it("forgets everything but the flag when asked", async () => {
    localStorage.setItem("anykey.dontcrater.v1", fixture("lander.v1.json"));
    const { getProgress, resetProgress } = await import("@/lib/lander/progress");
    getProgress();
    resetProgress();
    const p = getProgress();
    expect(p.flag.shape).toBe("swallow");
    expect(p.achievements).toEqual([]);
    expect(p.missions).toEqual({});
    expect(localStorage.getItem("anykey.dontcrater.v1")).toBeNull();
  });
});

describe("Bop Box", () => {
  it("keeps the length switch", async () => {
    localStorage.setItem("anykey.bopbox.v1", fixture("music.v1.json"));
    const { bopStore } = await import("@/lib/music/prefs");
    expect(bopStore.get()).toEqual({ version: "full", tunesPlayed: [], stylesTried: [], fullHeard: [] });
  });
});

describe("the Keyring's first visit", () => {
  it("collects badges and finished dailies from every old save, once", async () => {
    localStorage.setItem("anykey.stickler.v1", fixture("stickler.v1.json"));
    localStorage.setItem("anykey.outta.v1", fixture("outta.v1.json"));
    localStorage.setItem("anykey.dontcrater.v1", fixture("lander.v1.json"));
    const { keyringStore } = await import("@/lib/kit/keyring");
    const data = keyringStore.get();
    expect(Object.keys(data.unlocked["23mtch"])).toHaveLength(7);
    expect(Object.keys(data.unlocked.escape)).toHaveLength(6);
    expect(Object.keys(data.unlocked.lander)).toHaveLength(7);
    expect(data.dailies["2026-10-06"].sort()).toEqual(["23mtch", "escape", "lander"]);
    expect(data.dailies["2026-10-04"]).toEqual(["escape"]);

    // A later visit must not import again (or a forgotten game would come back).
    localStorage.setItem("anykey.outta.v1", JSON.stringify({ achievements: ["untouched"], daily: {} }));
    vi.resetModules();
    const again = await import("@/lib/kit/keyring");
    expect(again.keyringStore.get().unlocked.escape.untouched).toBeUndefined();
  });
});

describe("Forget my data", () => {
  it("forgets one game: its save, old key, keycaps, dailies and stats", async () => {
    localStorage.setItem("anykey.stickler.v1", fixture("stickler.v1.json"));
    localStorage.setItem("anykey.outta.v1", fixture("outta.v1.json"));
    const stickler = await import("@/lib/stickler/progress");
    const outta = await import("@/lib/outta/progress");
    stickler.getProgress();
    outta.getProgress();
    await settle();
    const { forgetGame } = await import("@/lib/kit/forget");
    const { keyringStore } = await import("@/lib/kit/keyring");
    const { statsFor } = await import("@/lib/kit/stats");

    forgetGame("23mtch");
    expect(localStorage.getItem("anykey.stickler.v1")).toBeNull();
    expect(localStorage.getItem("anykey.23mtch.save")).toBeNull();
    expect(stickler.getProgress().achievements).toEqual([]);
    expect(stickler.getProgress().ladder).toEqual({});
    expect(keyringStore.get().dailies["2026-10-05"]).toBeUndefined();
    expect(statsFor("23mtch").plays).toBe(0);
    // Outta Here is untouched.
    expect(outta.getProgress().achievements).toHaveLength(6);
    expect(keyringStore.get().dailies["2026-10-06"]).toEqual(["escape"]);
  });

  it("forgets everything but keeps the preferences", async () => {
    localStorage.setItem("anykey.theme", "dark");
    localStorage.setItem("anykey.stickler.v1", fixture("stickler.v1.json"));
    localStorage.setItem("anykey.dontcrater.v1", fixture("lander.v1.json"));
    const lander = await import("@/lib/lander/progress");
    lander.getProgress();
    const { forgetEverything } = await import("@/lib/kit/forget");
    const { keyringStore } = await import("@/lib/kit/keyring");
    forgetEverything(["music", "23mtch", "escape", "lander"]);

    expect(localStorage.getItem("anykey.theme")).toBe("dark");
    expect(localStorage.getItem("anykey.stickler.v1")).toBeNull();
    expect(localStorage.getItem("anykey.dontcrater.v1")).toBeNull();
    expect(keyringStore.get().unlocked).toEqual({});
    expect(lander.getProgress().achievements).toEqual([]);
    expect(lander.getProgress().flights).toBe(0);
  });
});
