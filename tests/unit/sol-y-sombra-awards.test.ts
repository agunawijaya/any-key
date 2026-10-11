import { describe, expect, it } from "vitest";
import { afterCorrida, afterTerminal } from "@/lib/sol-y-sombra/awards";
import { Corrida } from "@/lib/sol-y-sombra/corrida";
import type { OriginalEvent } from "@/lib/sol-y-sombra/original";
import { DEFAULT_SETTINGS, type Progress } from "@/lib/sol-y-sombra/progress";

const fresh = (): Progress => ({ settings: DEFAULT_SETTINGS, records: {}, terminal: { games: 0, kills: 0, awards: 0 }, achievements: [] });

/** The phase read afresh: each call may have moved it on. */
const down = (c: Corrida) => c.phase === "down";

/** Five veronicas, then over the horns until the afternoon ends, getting up after any goring. */
function veronicas(seed: string) {
  const c = new Corrida(seed);
  for (let i = 0; i < 5 && c.phase === "pass"; i++) {
    c.makePass("veronica");
    if (down(c)) c.carryOn();
  }
  if (c.phase === "pass") c.beginTruth();
  while (c.phase === "truth") {
    c.tryFinish("over-the-horns");
    if (down(c)) c.carryOn();
  }
  return c;
}

describe("Sol y Sombra: records and keycaps", () => {
  it("counts an afternoon into its play style's records", () => {
    const c = veronicas("t0");
    const p = afterCorrida(fresh(), c, "classic", false);
    const r = p.records.classic!;
    expect(r.corridas).toBe(1);
    expect(r.passes).toBe(c.history.filter((h) => h.kind === "pass").length);
    expect(r.tiers.reduce((a, b) => a + b, 0)).toBe(1);
    expect(r.endings[c.ending!]).toBe(1);
    expect(p.records.arena).toBeUndefined();
    expect(p.achievements).toContain("first-paseo");
  });

  it("gives All Veronicas only for a finish after five veronicas or more", () => {
    for (let i = 0; i < 300; i++) {
      const c = veronicas(`v${i}`);
      const p = afterCorrida(fresh(), c, "classic", false);
      const all = c.history.filter((h) => h.kind === "pass").every((h) => h.kind === "pass" && h.move === "veronica");
      expect(p.achievements.includes("all-veronicas")).toBe(c.ending === "rested" && all && c.passes >= 5);
    }
  });

  it("gives Back on Your Feet for getting up, and the honours for what the crowd gave", () => {
    const c = veronicas("t0");
    const p = afterCorrida(fresh(), c, "classic", true);
    expect(p.achievements).toContain("back-on-your-feet");
    const tier = c.decide().tier;
    expect(p.achievements.includes("lap-of-honour")).toBe(tier >= 2);
    expect(p.achievements.includes("on-their-shoulders")).toBe(tier === 3);
  });

  it("keeps the secret keycap for a kill with two awful crews in the terminal", () => {
    const crew = (rating: number): OriginalEvent => ({ kind: "crew", crew: "picadores", rating, c: rating / 10, casualties: { horses: null, men: null } });
    const killed: OriginalEvent = { kind: "killed" };
    expect(afterTerminal(fresh(), [crew(5), crew(5), killed]).achievements).toContain("the-inversion");
    expect(afterTerminal(fresh(), [crew(5), crew(4), killed]).achievements).not.toContain("the-inversion");
    expect(afterTerminal(fresh(), [crew(5), crew(5)]).achievements).not.toContain("the-inversion");
    expect(afterTerminal(fresh(), [crew(5), crew(5), killed]).terminal).toEqual({ games: 1, kills: 1, awards: 0 });
  });
});
