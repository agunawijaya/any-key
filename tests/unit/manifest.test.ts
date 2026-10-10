import { describe, expect, it } from "vitest";
import { games } from "@/lib/catalog";
import legacy from "../fixtures/achievements.v1.json";

const byId = Object.fromEntries(games.map((g) => [g.id, g]));

describe("manifests", () => {
  // The lists the games carried before the kit, captured when the emoji icons were retired. New ones may follow them.
  it.each(Object.entries(legacy))("%s keeps every achievement title and hint it had", (id, list) => {
    const now = byId[id].achievements.map(({ id, title, hint }) => ({ id, name: title, how: hint }));
    expect(now.slice(0, list.length)).toEqual(list);
  });

  it("gives Bop Box six to eight achievements of its own", () => {
    expect(byId.music.achievements.length).toBeGreaterThanOrEqual(6);
    expect(byId.music.achievements.length).toBeLessThanOrEqual(8);
  });

  it.each(games.map((g) => [g.id, g] as const))("%s has unique ids, known tiers and an emblem", (_, game) => {
    const ids = game.achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of game.achievements) expect(["common", "rare", "legendary"]).toContain(a.tier);
    expect(game.emblem).toMatch(/^M[\d.\s,a-zA-Z-]+$/);
    expect(game.route.startsWith("/")).toBe(true);
  });

  it("lists Two Humps, the rebuild of Desert, as playable", () => {
    expect(byId["two-humps"]).toMatchObject({ status: "playable", title: "Two Humps", route: "/two-humps" });
    expect(byId["two-humps"].inspiredBy).toMatchObject({ originalTitle: "Desert", file: "DESERT.BAS", year: 1982 });
  });

  it("lists Same Trick Twice, the rebuild of Awari, as playable", () => {
    expect(byId["long-memory"]).toMatchObject({ status: "playable", title: "Same Trick Twice", route: "/long-memory" });
    expect(byId["long-memory"].inspiredBy).toMatchObject({ originalTitle: "Awari", file: "AWARI.BAS", year: 1978 });
  });
});
