import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameManifest } from "@/lib/kit/manifest";

async function fresh() {
  vi.resetModules();
  const keyring = await import("@/lib/kit/keyring");
  const achievements = await import("@/lib/kit/achievements");
  return { ...keyring, ...achievements };
}

beforeEach(() => localStorage.clear());

const game = (id: string, tiers: GameManifest["achievements"][number]["tier"][]): GameManifest =>
  ({ id, achievements: tiers.map((tier, i) => ({ id: `a${i}`, title: `A${i}`, hint: "", tier })) }) as unknown as GameManifest;

describe("achievements", () => {
  it("unlocks once, announces once, and returns only what was new", async () => {
    const { unlock, unlockedIds, UNLOCK_EVENT } = await fresh();
    const heard: string[] = [];
    window.addEventListener(UNLOCK_EVENT, (e) => heard.push((e as CustomEvent).detail.id));
    expect(unlock("23mtch", ["first-light", "flawless", "first-light"])).toEqual(["first-light", "flawless"]);
    expect(unlock("23mtch", "first-light")).toEqual([]);
    expect(unlock("23mtch", ["flawless", "summit"])).toEqual(["summit"]);
    expect(heard).toEqual(["first-light", "flawless", "summit"]);
    expect(unlockedIds("23mtch").sort()).toEqual(["first-light", "flawless", "summit"]);
  });

  it("keeps the same id apart in different games", async () => {
    const { unlock, isUnlocked } = await fresh();
    unlock("23mtch", "time-traveller");
    expect(isUnlocked("23mtch", "time-traveller")).toBe(true);
    expect(isUnlocked("lander", "time-traveller")).toBe(false);
  });
});

describe("XP and levels", () => {
  it("prices each level at 40·n XP", async () => {
    const { xpForLevel, levelOf } = await fresh();
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 40, 120, 240, 400]);
    expect(levelOf(0)).toMatchObject({ level: 1, title: "Home Row", into: 0, span: 40 });
    expect(levelOf(39).level).toBe(1);
    expect(levelOf(40)).toMatchObject({ level: 2, title: "Space Bar", into: 0, span: 80 });
    expect(levelOf(130)).toMatchObject({ level: 3, into: 10, span: 120 });
  });

  it("keeps the last title past the end of the list", async () => {
    const { levelOf, xpForLevel, LEVEL_TITLES } = await fresh();
    expect(levelOf(xpForLevel(20)).title).toBe(LEVEL_TITLES[LEVEL_TITLES.length - 1]);
  });

  it("counts 10, 30 and 80 XP by tier and 5 per finished daily", async () => {
    const { xpOf } = await fresh();
    const games = [game("x", ["common", "rare", "legendary"]), game("y", ["common"])];
    const data = {
      unlocked: { x: { a0: 1, a1: 1, a2: 1 }, y: { a0: 1 }, gone: { a0: 1 } },
      dailies: { "2026-10-06": ["x", "y"], "2026-10-07": ["x"] },
      levelSeen: 1,
      hintsDismissed: [],
    };
    expect(xpOf(data, games)).toBe(10 + 30 + 80 + 10 + 3 * 5);
  });
});

describe("streak", () => {
  const wednesday = new Date(2026, 9, 7, 10);

  it("counts back from today when today is played", async () => {
    const { streakOf } = await fresh();
    const s = streakOf({ "2026-10-07": ["x"], "2026-10-06": ["y"], "2026-10-05": ["x"], "2026-10-03": ["x"] }, wednesday);
    expect(s.current).toBe(3);
  });

  it("stays alive through today until it is over", async () => {
    const { streakOf } = await fresh();
    expect(streakOf({ "2026-10-06": ["x"], "2026-10-05": ["x"] }, wednesday).current).toBe(2);
    expect(streakOf({ "2026-10-05": ["x"] }, wednesday).current).toBe(0);
  });

  it("lays the week out Monday to Sunday", async () => {
    const { streakOf } = await fresh();
    const { week } = streakOf({ "2026-10-05": ["x"], "2026-10-07": ["x"] }, wednesday);
    expect(week.map((d) => d.key)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(week.map((d) => d.played)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.today)).toBe(2);
    expect(week.filter((d) => d.future).length).toBe(4);
  });

  it("records a daily once per game and day", async () => {
    const { completeDaily, keyringStore } = await fresh();
    expect(completeDaily("escape", wednesday)).toBe(true);
    expect(completeDaily("escape", wednesday)).toBe(false);
    expect(completeDaily("lander", wednesday)).toBe(true);
    expect(keyringStore.get().dailies["2026-10-07"]).toEqual(["escape", "lander"]);
  });
});

describe("holding announcements", () => {
  it("keeps toasts back until the game lets them out", async () => {
    const { unlock, holdAnnouncements, UNLOCK_EVENT } = await fresh();
    const heard: string[] = [];
    window.addEventListener(UNLOCK_EVENT, (e) => heard.push((e as CustomEvent).detail.id));
    const release = holdAnnouncements();
    expect(unlock("lander", "butter")).toEqual(["butter"]);
    expect(heard).toEqual([]);
    release();
    release();
    expect(heard).toEqual(["butter"]);
  });
});
