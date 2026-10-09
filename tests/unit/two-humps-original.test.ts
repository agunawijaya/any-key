import { describe, expect, it } from "vitest";
import { createOriginal, type Happening } from "@/lib/two-humps/original";

/*
 * Golden tests for 1982 mode: each pins one behaviour read from DESERT.BAS.
 * The dice are scripted. `d(k, n)` is a random number that makes INT(n * RND)
 * come out as k, so each test lists the rolls the listing makes, in order.
 */

const d = (k: number, n: number) => (k + 0.5) / n;

/** A random source that plays back the given numbers, then fails loudly. */
function script(...values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`the script ran out after ${values.length} rolls`);
    return values[i++];
  };
}

/** The pursuers' step is drawn at the top of every turn: one roll per turn. */
const turn = (step = 0) => d(step, 10);
/** An event roll sequence that ends in an oasis (no ambush, then the oasis roll). */
const oasis = [d(50, 100), d(0, 10)];
/** An event roll sequence with nothing happening: no ambush, oasis, sandstorm or hump, so the command runs again. */
const nothing = [d(50, 100), d(5, 10), d(50, 100), d(50, 100)];

const kinds = (h: Happening[]) => h.map((x) => x.kind);

describe("1982 mode", () => {
  it("a repeated stride costs fatigue and rolls again but adds no miles: only the last stride counts", () => {
    // Turn 1, then: walk → nothing (repeat) → oasis → the walk's miles (7).
    const game = createOriginal(script(turn(), ...nothing, ...oasis, d(7, 10), turn()));
    game.take();
    game.command(2);
    expect(game.state.fatigue).toBe(2);
    expect(game.state.miles).toBe(7);
    expect(game.state.repeatsTotal).toBe(1);
    // The repeat never returned: its address is still on the stack.
    expect(game.state.staleReturns).toBe(1);
  });

  it("a fresh camel's gallop that repeats twice runs it to death", () => {
    const game = createOriginal(script(turn(), ...nothing, ...nothing, d(0, 10)));
    game.take();
    game.command(3);
    expect(game.state.ending).toBe("died");
    expect(game.take().at(-1)).toMatchObject({ kind: "died", cause: "camel" });
  });

  it("the status report runs on into a drink", () => {
    const game = createOriginal(script(turn(), turn()));
    game.take();
    game.command(5);
    expect(game.state.sips).toBe(5);
    expect(game.state.thirst).toBe(4);
    expect(kinds(game.take())).toEqual(["status", "drink", "prompt"]);
  });

  it("drinking from an empty canteen is fatal", () => {
    const game = createOriginal(script(turn(), d(3, 10)));
    game.take();
    for (let i = 0; i < 6; i++) game.command(1);
    expect(game.state.sips).toBe(0);
    game.command(1);
    expect(game.state.ending).toBe("died");
    expect(game.take().at(-1)).toMatchObject({ kind: "died", cause: "empty-canteen" });
  });

  it("any number other than 1–6 is a call for help, answered one time in ten", () => {
    const rescued = createOriginal(script(turn(), d(1, 10), turn()));
    rescued.take();
    rescued.command(7);
    expect(kinds(rescued.take())).toContain("rescued");
    expect(rescued.state.sips).toBe(3);

    const unlucky = createOriginal(script(turn(), d(4, 10), d(0, 10)));
    unlucky.take();
    unlucky.command(0);
    expect(unlucky.state.ending).toBe("died");
  });

  it("after an ambush, waiting is always safe: the captive flag is never set", () => {
    for (const ransom of [d(10, 100), d(80, 100)]) {
      const game = createOriginal(script(turn(), d(3, 100), ransom, turn()));
      game.take();
      game.command(2);
      expect(game.state.phase).toBe("subcommand");
      game.subcommand(8);
      expect(game.state.ending).toBeNull();
      expect(game.state.phase).toBe("command");
    }
  });

  it("an escape attempt fails half the time, and anything but 8 counts as one", () => {
    const game = createOriginal(script(turn(), d(3, 100), d(4, 10), d(0, 10)));
    game.take();
    game.command(2);
    game.subcommand(7.9);
    expect(game.state.ending).toBe("died");
  });

  it("the 'hurt hump' moves the pursuers a mile closer", () => {
    const game = createOriginal(script(turn(), d(50, 100), d(5, 10), d(50, 100), d(3, 100), d(4, 10), turn()));
    game.take();
    game.command(2);
    expect(game.state.pursuers).toBe(1);
  });

  it("the pursuers set off after the third turn, in steps of 2.5 to 11.5", () => {
    const rolls = [turn(9)];
    for (let i = 0; i < 3; i++) rolls.push(...oasis, d(9, 10), turn(9));
    const game = createOriginal(script(...rolls));
    game.take();
    for (let i = 0; i < 3; i++) game.command(2);
    // Three turns went by unchased; the fourth turn's step of 11.5 is the first one taken.
    expect(game.state.turn).toBe(4);
    expect(game.state.pursuers).toBe(11.5);
    expect(game.state.miles).toBe(27);
  });

  it("you win at more than 39 miles, checked at the top of a turn", () => {
    // Five walks of nine miles, each ending at an oasis: 45 miles, and the sixth turn opens with the win.
    const rolls = [turn()];
    for (let i = 0; i < 4; i++) rolls.push(...oasis, d(9, 10), turn());
    rolls.push(...oasis, d(9, 10));
    const game = createOriginal(script(...rolls));
    game.take();
    for (let i = 0; i < 5; i++) game.command(2);
    expect(game.state.miles).toBe(45);
    expect(game.state.ending).toBe("won");
  });
});
