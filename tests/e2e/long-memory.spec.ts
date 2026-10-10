import { expect, test, type Locator, type Page } from "@playwright/test";
import { open, pauseItems, quietKeyring, seed } from "./helpers";
import { choices, keyFor, LESSON, playToTheEnd, results, returning } from "./long-memory-helpers";

/*
 * Same Trick Twice, end to end: every rule set against every kind of
 * opponent, by mouse and by keyboard alone; seeds carried by hand; the
 * Memory Book, kept across a reload and wiped; the Learner remembering; the
 * Daily Endgame; the 1970s terminal; settings; and every way out. Moves land
 * at once under reduced motion, so most games here are quick.
 */

const ROUTE = "/long-memory";

const pauseMenu = (page: Page) => page.getByRole("group", { name: "Pause menu" });

/** Picks an option the way a player does, by its round label; the radio inside it is hidden. */
const choose = (page: Page, name: string | RegExp, within: Page | Locator = page) => within.locator("label", { has: page.getByRole("radio", { name }) }).click();

const centreOf = async (page: Page, name: RegExp) => {
  const box = (await page.getByRole("button", { name }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Same Trick Twice", () => {
  test("the game menu offers every mode, and Esc goes back to the Hall", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    for (const mode of [/^Play the Learner/, /^Choose rules and opponent/, /^Daily Endgame/, /^Memory Book/, /^1970s mode/, /^Records$/, /^Game settings$/]) {
      await expect(page.getByRole("button", { name: mode })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test("1978 Awari against the Learner by mouse: the rules card first, a whole game, then R plays again", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    await expect(page.getByRole("dialog", { name: "1978 Awari" })).toBeVisible();
    await page.getByRole("button", { name: /^Got it/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await playToTheEnd(page, "mouse");
    await expect(results(page)).toContainText("1978 Awari · the Learner");
    for (const action of [/^Play again/, /^Game menu/, /^Back to the Hall/, /^Open the Memory Book/]) await expect(results(page).getByRole("button", { name: action })).toBeVisible();
    await page.keyboard.press("r");
    await expect(results(page)).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Your move" })).toBeVisible();
  });

  test("keyboard only: Kalah against the easy Scholar, start to finish", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    // Tab order from the first menu button: the picker is the next one.
    await page.getByRole("button", { name: /^Play the Learner/ }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.getByRole("radio", { name: /^1978 Awari/ }).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /^Kalah/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^The Scholar/ })).toBeChecked();
    await page.getByRole("radio", { name: "Easy" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: "Easy" })).toBeChecked();
    await page.getByRole("button", { name: /^Start/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("You vs the Scholar")).toBeVisible();
    await playToTheEnd(page, "keys");
    await expect(results(page)).toContainText("Kalah · the Scholar, easy");
  });

  test("1978 Awari and Oware against the normal Scholar, by mouse", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    for (const rules of ["1978 Awari", "Oware"]) {
      await page.getByRole("button", { name: /^Choose rules and opponent/ }).click();
      await choose(page, new RegExp(`^${rules}`));
      await choose(page, /^The Scholar/);
      await choose(page, /^Normal$/);
      await page.getByRole("button", { name: /^Start/ }).click();
      await playToTheEnd(page, "mouse");
      await expect(results(page)).toContainText(`${rules} · the Scholar, normal`);
      await results(page).getByRole("button", { name: /^Game menu/ }).click();
    }
  });

  test("two players on one screen: Oware by keys, turns passing back and forth, then out through the pause menu", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Choose rules and opponent/ }).click();
    await choose(page, /^Oware/);
    await choose(page, /^A friend/);
    await page.getByRole("button", { name: /^Start/ }).click();
    await expect(page.getByText("Two players")).toBeVisible();
    for (let move = 0; move < 8; move++) {
      await expect(page.getByRole("status").filter({ hasText: move % 2 === 0 ? "Player 1's move" : "Player 2's move" })).toBeVisible();
      const label = (await choices(page).first().getAttribute("aria-label")) ?? "";
      expect(label).toMatch(move % 2 === 0 ? /^Player 1's pit/ : /^Player 2's pit/);
      await page.keyboard.press(keyFor(label));
    }
    await page.keyboard.press("Escape");
    await pauseMenu(page).getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /^Play the Learner/ })).toBeVisible();
  });

  test("two players, Kalah and 1978 Awari: a whole game each by mouse", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    for (const rules of ["Kalah", "1978 Awari"]) {
      await page.getByRole("button", { name: /^Choose rules and opponent/ }).click();
      await choose(page, new RegExp(`^${rules}`));
      await choose(page, /^A friend/);
      await page.getByRole("button", { name: /^Start/ }).click();
      await playToTheEnd(page, "mouse");
      await expect(results(page)).toContainText(`${rules} · two players`);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /^Play the Learner/ })).toBeVisible();
    }
  });

  test("taking a move back against the Scholar, with Z", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Choose rules and opponent/ }).click();
    await choose(page, /^Kalah/);
    await page.getByRole("button", { name: /^Start/ }).click();
    await page.getByRole("button", { name: "Your pit 1, 4 seeds" }).click();
    await expect(page.getByRole("button", { name: "Your pit 1, 0 seeds" })).toBeAttached();
    await expect(page.getByRole("button", { name: /^Take back/ })).toBeEnabled();
    await page.keyboard.press("z");
    await expect(page.getByRole("button", { name: "Your pit 1, 4 seeds" })).toBeEnabled();
    await expect(page.getByText("Move 1", { exact: true })).toBeVisible();
  });

  test("seeds carried by hand: put back without a move, then dropped pit by pit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your move" })).toBeVisible();

    // Lifted from pit 2 and set down in it again: nothing is played.
    const second = await centreOf(page, /^Your pit 2,/);
    await page.mouse.move(second.x, second.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y - 70, { steps: 8 });
    await expect(page.getByRole("status").filter({ hasText: "Drop them one by one" })).toBeVisible();
    await page.mouse.move(second.x, second.y, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("status").filter({ hasText: "Your move" })).toBeVisible();
    await expect(page.getByText("Move 1", { exact: true })).toBeVisible();

    // Pit 1's three seeds, one into each of the next three pits.
    const path = [/^Your pit 1,/, /^Your pit 2,/, /^Your pit 3,/, /^Your pit 4,/];
    const points = [];
    for (const name of path) points.push(await centreOf(page, name));
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(p.x, p.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText(/^Move [2-9]$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Your pit 4, 4 seeds/ })).toBeAttached();
  });

  test("the Learner remembers a lost opening and says so", async ({ page }) => {
    // With motion the moment of remembering lasts nearly four seconds, not one and a half.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await seed(page, returning({ mind: { lessons: [LESSON], q: 0, a: 0 } }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    await page.keyboard.press("3");
    // The moment lasts a few seconds, so all three are looked for at once.
    await Promise.all([
      expect(page.getByText("It remembers this")).toBeVisible(),
      expect(page.getByText("This move lost it the game of 4 October · lesson No. 1")).toBeVisible(),
      expect(page.getByRole("status").filter({ hasText: "The Learner checks its book" })).toBeVisible(),
    ]);
  });

  test("Ctrl+Alt+C quietly marks the pit to sow, and takes the mark away again", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.keyboard.press("Control+Alt+KeyC");
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    const suggested = page.locator("button[aria-label$=', suggested']");
    await expect(suggested).toHaveCount(1);
    await expect(suggested).toBeEnabled();
    await expect(suggested).toHaveAttribute("aria-label", /^Your pit/);
    await page.keyboard.press("Control+Alt+KeyC");
    await expect(suggested).toHaveCount(0);
  });

  test("the Memory Book: lessons shown, kept across a reload, then wiped", async ({ page }) => {
    await seed(page, returning({ mind: { lessons: [LESSON, { ...LESSON, learned: "2026-10-05" }], q: 0, a: 0 } }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Memory Book/ }).click();
    const book = page.getByRole("dialog", { name: "The Memory Book" });
    await expect(book.getByRole("listitem")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    await expect(page.getByRole("button", { name: /its book holds 2 lessons/ })).toBeVisible();
    await page.getByRole("button", { name: /^Memory Book/ }).click();
    await expect(book.getByRole("listitem")).toHaveCount(2);
    await book.getByRole("button", { name: "Wipe the book" }).click();
    await page.getByRole("alertdialog", { name: "Wipe the Learner's book?" }).getByRole("button", { name: "Wipe it" }).click();
    await expect(book.getByText(/^No lessons yet/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /its book is empty/ })).toBeVisible();
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    await expect(page.getByRole("button", { name: /its book is empty/ })).toBeVisible();
  });

  test("a game the Learner fails to win goes into its book, and B opens it", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    await page.keyboard.press("b");
    await expect(page.getByRole("dialog", { name: "The Memory Book" })).toBeVisible();
    await page.keyboard.press("Escape");
    await playToTheEnd(page, "mouse");
    const learnerWon = (await results(page).getByRole("heading").textContent())?.startsWith("The Learner wins");
    await results(page).getByRole("button", { name: /^Game menu/ }).click();
    await expect(page.getByRole("button", { name: learnerWon ? /its book is empty/ : /its book holds 1 lesson/ })).toBeVisible();
  });

  test("the Daily Endgame: today's position, played to a verdict", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Daily Endgame/ }).click();
    await expect(page.getByText(/^Daily Endgame #\d+ · /).first()).toBeVisible({ timeout: 30_000 });
    await playToTheEnd(page, "mouse", 60_000);
    await expect(results(page).getByRole("heading")).toHaveText(/^(Solved in \d+ moves?|It slipped away)$/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Daily Endgame/ })).toBeVisible();
  });

  test("1970s mode: the program answers, refuses an empty pit and asks again", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^1970s mode/ }).click();
    await page.getByLabel("WHICH PIT (1-6)?").fill("3");
    await page.getByLabel("WHICH PIT (1-6)?").press("Enter");
    await expect(page.getByText(/^MINE: [1-6]/).first()).toBeVisible();
    await page.getByLabel("WHICH PIT (1-6)?").fill("3");
    await page.getByLabel("WHICH PIT (1-6)?").press("Enter");
    await expect(page.getByText("THAT PIT WON'T DO.")).toBeVisible();
    await expect(page.getByLabel("SOW AGAIN?")).toBeVisible();
    await page.getByRole("button", { name: "Leave the terminal" }).click();
    await expect(page.getByRole("button", { name: /^1970s mode/ })).toBeVisible();
  });

  test("settings: the numbers by the pits are off until turned on, and stay on after a reload", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: "Game settings" }).click();
    const numbers = () => page.getByRole("group", { name: "Numbers by the pits" });
    await expect(numbers().getByRole("radio", { name: "Off" })).toBeChecked();
    await choose(page, "On", numbers());
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    await page.getByRole("button", { name: "Game settings" }).click();
    await expect(numbers().getByRole("radio", { name: "On" })).toBeChecked();
    await page.getByRole("button", { name: "Back to the game menu" }).click();
    await expect(page.getByRole("button", { name: /^Play the Learner/ })).toBeVisible();
  });

  test("records: a page of its own, and back", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: "Records" }).click();
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await page.getByRole("button", { name: "Back to the game menu" }).click();
    await expect(page.getByRole("button", { name: /^Play the Learner/ })).toBeVisible();
  });

  test("every way out of a game: browser Back asks first, the pause menu leaves for the Hall", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play the Learner/ }).click();
    await page.keyboard.press("1");
    await expect(page.getByText(/^Move [2-9]$/)).toBeVisible();
    await page.goBack();
    const ask = page.getByRole("alertdialog");
    await ask.getByRole("button", { name: /Keep playing/ }).click();
    await expect(page).toHaveURL(/#play$/);
    // Keep playing returns to the game paused; Esc resumes and pauses again.
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Start this game again", "Open the Memory Book", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Back to the Hall" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("results: H goes back to the Hall", async ({ page }) => {
    await seed(page, returning());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Choose rules and opponent/ }).click();
    await choose(page, /^Kalah/);
    await choose(page, /^A friend/);
    await page.getByRole("button", { name: /^Start/ }).click();
    await playToTheEnd(page, "keys");
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });
});
