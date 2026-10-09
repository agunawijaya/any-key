import { expect, test } from "@playwright/test";
import { open, seed } from "./helpers";
import { journal, leaveIfAsked, playToTheEnd, settled, tabTo, takeTheTutorial } from "./two-humps-helpers";

/*
 * Two Humps, end to end: every mode by mouse and by keyboard alone, the
 * tutorial, the reins, the seeds and every way out. Treks use fresh dice, so
 * the long ones are played by a plain, sensible player that reads the gauges.
 */

const ROUTE = "/two-humps";

const quiet = {
  "anykey.keyring.save": { version: 1, data: { unlocked: {}, dailies: {}, levelSeen: 1, hintsDismissed: ["music", "23mtch", "escape", "lander", "two-humps"] } },
};

/** Someone who has already taken the tutorial. */
const returning = {
  ...quiet,
  "anykey.two-humps.save": {
    version: 1,
    data: { plays: 0, wins: 0, records: {}, daily: {}, expedition: { leg: 0, fossils: [], finished: 0 }, singing: 0, original: { plays: 0, wins: 0 }, choices: { pursuer: "haboob", difficulty: "normal", units: "mi" }, tutorialSeen: true },
  },
};

test.beforeEach(async ({ page }) => {
  // Shorter pauses, and the same game.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Two Humps", () => {
  test("the game menu offers every mode, and Esc goes back to the Hall", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    for (const mode of [/^Crossing/, /^Expedition/, /^Daily Crossing/, /^1982 mode/, /Records and settings/]) await expect(page.getByRole("button", { name: mode })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test("a Crossing by mouse: pick the gang, walk, pull the reins, toss seeds, leave from the pause menu", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Crossing/ }).click();
    await page.getByRole("radio", { name: /Ladle Gang/ }).click();
    await page.getByRole("button", { name: /Set off/ }).click();
    await expect(page).toHaveURL(/#play$/);

    const seeds = page.getByRole("button", { name: /Seeds 3/ });
    await seeds.click();
    await expect(page.getByRole("button", { name: /Seeds 2/ })).toBeVisible();

    // Walk until the camel runs on, then pull the reins by clicking the button.
    for (let i = 0; i < 12; i++) {
      const now = await settled(page);
      if (now === "over") break;
      if (now === "rolling") {
        await page.getByRole("group", { name: "The camel is running on" }).getByRole("button", { name: /Pull the reins/ }).click();
        break;
      }
      if (now === "caravan") {
        await page.getByRole("button", { name: /Wait it out/ }).click();
        continue;
      }
      await page.getByRole("button", { name: i % 3 === 2 ? /^4\s*Make camp/ : /^2\s*Walk/ }).click();
    }
    // The gang may have caught up by now; either way, out to the game menu.
    if ((await settled(page)) === "over") {
      await journal(page).getByRole("button", { name: /Game menu/ }).click();
    } else {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("group", { name: "Pause menu" }).getByRole("button", { name: "Game menu" }).click();
      await leaveIfAsked(page);
    }
    await expect(page.getByRole("button", { name: /^Expedition/ })).toBeVisible();
  });

  test("a Crossing by keyboard alone, to the journal page, then Play again and back to the Hall", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await tabTo(page, /^Crossing/);
    await page.keyboard.press("Enter");
    await tabTo(page, /Set off/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("toolbar", { name: "Commands" })).toBeVisible();
    await playToTheEnd(page);
    await expect(journal(page).getByRole("button", { name: /Play again/ })).toBeVisible();
    await page.keyboard.press("r");
    await expect(page.getByRole("toolbar", { name: "Commands" })).toBeVisible();
    await expect(journal(page)).toHaveCount(0);
    await playToTheEnd(page);
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });

  test("Esc pauses and resumes a trek; browser Back mid-trek asks first", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Crossing/ }).click();
    await page.getByRole("button", { name: /Set off/ }).click();
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Pause menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Pause menu" })).toHaveCount(0);
    await page.goBack();
    const ask = page.getByRole("alertdialog");
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: /Keep playing/ }).click();
    await expect(page.getByRole("toolbar", { name: "Commands" })).toBeVisible();
  });

  test("the tutorial by keyboard: walk, drink, gallop, the reins, camp, then on to the pursuers", async ({ page }) => {
    await seed(page, quiet);
    await open(page, ROUTE);
    await tabTo(page, /New here/);
    await page.keyboard.press("Enter");
    const coach = page.getByRole("note");
    await expect(coach).toContainText("1 of 6");
    await page.keyboard.press("2");
    await expect(coach).toContainText("2 of 6", { timeout: 15_000 });
    await page.keyboard.press("1");
    await expect(coach).toContainText("3 of 6");
    await page.keyboard.press("3");
    await expect(page.getByRole("group", { name: "The camel is running on" })).toBeVisible({ timeout: 15_000 });
    await expect(coach).toContainText("4 of 6");
    await page.keyboard.press(" ");
    await expect(coach).toContainText("5 of 6", { timeout: 15_000 });
    await page.keyboard.press("4");
    await expect(coach).toContainText("6 of 6", { timeout: 15_000 });
    await coach.getByRole("button", { name: "Pick a pursuer" }).click();
    await expect(page.getByRole("radiogroup", { name: "Pursuer" })).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`after its last lesson the tutorial is a whole crossing (${theme}: setting off at ${theme === "light" ? "dawn" : "dusk"})`, async ({ page }) => {
      await seed(page, quiet, theme);
      await open(page, ROUTE);
      await page.getByRole("button", { name: /New here/ }).click();
      await takeTheTutorial(page);
      // Every command stays open now, even when the camel runs on again.
      await playToTheEnd(page);
      await expect(journal(page)).toContainText(/Tutorial/);
    });
  }

  test("the tutorial by mouse, skipped at once", async ({ page }) => {
    await seed(page, quiet);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /New here/ }).click();
    await page.getByRole("button", { name: /^2\s*Walk/ }).click();
    await page.getByRole("button", { name: "Skip the tutorial" }).click({ timeout: 15_000 });
    await expect(page.getByRole("radiogroup", { name: "Pursuer" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Take the one-minute tutorial/ })).toHaveCount(0);
  });

  test("the Expedition by mouse: the canyons refuse a gallop, and the leg can be left", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Expedition/ }).click();
    await expect(page.getByRole("button", { name: /Set off for Khermen Tsav/ })).toBeVisible();
    await page.getByRole("button", { name: /Set off for Khermen Tsav/ }).click();
    await expect(page.getByText(/Leg 1 of 5/)).toBeVisible();
    // A refused card still takes a click, to say why.
    await page.getByRole("button", { name: /^3\s*Gallop/ }).click({ force: true });
    await expect(page.getByText("No room to gallop in the canyons").first()).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("group", { name: "Pause menu" }).getByRole("button", { name: "Game menu" }).click();
    await leaveIfAsked(page);
    await expect(page.getByRole("button", { name: /^Expedition/ })).toBeVisible();
  });

  test("the Expedition by keyboard: the first leg played to its journal page", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await tabTo(page, /^Expedition/);
    await page.keyboard.press("Enter");
    await tabTo(page, /Set off for/);
    await page.keyboard.press("Enter");
    await playToTheEnd(page);
    await expect(journal(page)).toContainText(/Leg 1 of 5/);
  });

  test("the Daily by keyboard: the first try shares, a replay is practice", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seed(page, returning);
    await open(page, ROUTE);
    await tabTo(page, /^Daily Crossing/);
    await page.keyboard.press("Enter");
    await playToTheEnd(page);
    await expect(journal(page).getByRole("button", { name: /Share/ })).toBeVisible();
    await page.keyboard.press("r");
    await expect(journal(page)).toHaveCount(0);
    await playToTheEnd(page);
    await expect(journal(page)).toContainText("practice");
    await expect(journal(page).getByRole("button", { name: /Share/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Daily Crossing/ })).toContainText(/Done for today/);
  });

  test("1982 mode by keyboard: status costs a drink, a typo calls for help", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await tabTo(page, /^1982 mode/);
    await page.keyboard.press("Enter");
    await page.keyboard.type("5");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/CAMEL: STRONG FOR/)).toBeVisible();
    await expect(page.getByText(/Asking for your status cost a drink/)).toBeVisible();
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/anything but 1 to 6 counts as hoping for help/)).toBeVisible();
  });

  test("1982 mode by mouse: the function keys play, and the menu button leaves", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^1982 mode/ }).click();
    await page.getByRole("button", { name: /^2\s*WALK/ }).click();
    await expect(page.getByText(/WHAT NEXT\? 2/)).toBeVisible();
    await page.getByRole("button", { name: "← Game menu" }).click();
    await leaveIfAsked(page);
    await expect(page.getByRole("button", { name: /^1982 mode/ })).toBeVisible();
  });

  test("Records: kilometres show on the route, and Esc goes back", async ({ page }) => {
    await seed(page, returning);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /Records and settings/ }).click();
    await page.getByText("Kilometres").click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Crossing/ }).click();
    await page.getByRole("button", { name: /Set off/ }).click();
    await expect(page.getByText(/of 64 km/)).toBeVisible();
  });
});
