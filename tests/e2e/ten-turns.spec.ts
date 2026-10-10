import { expect, test, type Page } from "@playwright/test";
import { open, pauseItems, seed } from "./helpers";
import { dropByClick, pit, playToTheEnd, quiet, results, ROUTE, stepPads, withSettings } from "./ten-turns-helpers";

/*
 * Ten Turns in the Pit, end to end: Classic and Tactics by mouse and by
 * keyboard alone, the drop, a squish, the tools, the Daily Pit, the 1970s
 * terminal, settings, records and every way out. Under reduced motion the
 * rabbit's turns take a moment, so whole games are quick.
 */

const pauseMenu = (page: Page) => page.getByRole("group", { name: "Pause menu" });

/** Picks an option the way a player does, by its round label; the radio inside it is hidden. */
const choose = (page: Page, name: string | RegExp) => page.locator("label", { has: page.getByRole("radio", { name }) }).click();

/**
 * Where the cell east of the kid is on screen, worked out from the step pads:
 * they sit on an ellipse 1.7 cells wide and 1.55 tall round a point 1.25
 * cells above the kid's feet.
 */
async function cellEastOfKid(page: Page) {
  const centre = async (name: string) => {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const [e, w, n, s] = [await centre("Step east"), await centre("Step west"), await centre("Step north"), await centre("Step south")];
  const cell = (e.x - w.x) / 3.4;
  const middle = { x: (e.x + w.x) / 2, y: (n.y + s.y) / 2 };
  return { x: middle.x + cell, y: middle.y + cell * 1.25 };
}

/** The outcome titles a game can end with. */
const ENDING = /Squish!|You are free!|Crunch\./;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Ten Turns in the Pit", () => {
  test("the game menu offers every mode, and Esc goes back to the Hall", async ({ page }) => {
    await seed(page, quiet);
    await open(page, ROUTE);
    await expect(page.getByRole("banner").getByRole("button", { name: "Back to the Hall" })).toBeVisible();
    for (const mode of [/^Play Classic/, /^Daily Pit/, /^1970s mode/, /^Records$/, /^Game settings$/]) await expect(page.getByRole("button", { name: mode })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Arena/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test("Classic by mouse: a click to drop in, pads to the end, then R plays again", async ({ page }) => {
    await seed(page, withSettings());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Classic/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await expect(page.getByText("The drop")).toBeVisible();
    await dropByClick(page);
    await playToTheEnd(page, "mouse");
    await expect(results(page)).toContainText(ENDING);
    await expect(results(page)).toContainText("Classic");
    for (const action of [/^New game|^Play again|^Try/, /^Game menu/, /^Back to the Hall/]) await expect(results(page).getByRole("button", { name: action }).first()).toBeVisible();
    await page.keyboard.press("r");
    await expect(results(page)).toBeHidden();
    await expect(page.getByText("The drop")).toBeVisible();
  });

  test("keyboard only: Classic from the menu to the end", async ({ page }) => {
    await seed(page, withSettings());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Classic/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("The drop")).toBeVisible();
    // The cursor starts low in the pit; walk it two cells east, then drop.
    await page.keyboard.press("d");
    await page.keyboard.press("d");
    await page.keyboard.press("Enter");
    await playToTheEnd(page, "keys");
    await expect(results(page)).toContainText(ENDING);
  });

  test("Tactics: dropped right on the rabbit, a squish with every medal, and the next pit opens", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await expect(page.getByRole("heading", { name: "Twenty pits" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Read the Arrow, locked/ })).toBeVisible();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    await expect(page.getByText(/The grass is rustling/)).toBeVisible();
    // First Drop's rabbit hides at (6, 6); the cursor starts at (0, -6).
    for (let i = 0; i < 6; i++) await page.keyboard.press("d");
    for (let i = 0; i < 12; i++) await page.keyboard.press("w");
    await page.keyboard.press("Enter");
    await expect(results(page)).toBeVisible();
    await expect(results(page)).toContainText("Squish!");
    await expect(results(page)).toContainText("Tactics · First Drop");
    const medals = results(page).getByRole("list", { name: "Medals" });
    await expect(medals.getByText("earned", { exact: true })).toHaveCount(3);
    await results(page).getByRole("button", { name: /^Next pit/ }).click();
    await expect(page.getByText(/The grass is rustling/)).toBeVisible();
    await page.keyboard.press("Escape");
    await pauseMenu(page).getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await expect(page.getByRole("button", { name: /^First Drop, survived/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Read the Arrow$/ })).toBeVisible();
  });

  test("Tactics by mouse: a stone from the tray set down by a click, then pads to the end", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    await dropByClick(page);
    await expect(stepPads(page).first()).toBeVisible();
    await expect(page.getByText(/^Turn 1 of 10\./)).toBeAttached();
    // The pads ring the kid; from them, find the floor cell just east of the kid's feet.
    const east = await cellEastOfKid(page);
    await page.getByRole("button", { name: /^Stone, 2 left/ }).click();
    await expect(page.getByRole("status")).toContainText("Set the stone");
    await page.mouse.click(east.x, east.y);
    await expect(page.getByRole("button", { name: /^Stone, 1 left/ })).toBeVisible();
    await playToTheEnd(page, "mouse");
    await expect(results(page)).toContainText(ENDING);
    await expect(results(page).getByRole("list", { name: "Medals" })).toBeVisible();
  });

  test("keyboard only: Tactics with a tool, Esc to put it back, and the plan held on I", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics", intent: "request" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^First Drop/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/The grass is rustling/)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(stepPads(page).first()).toBeVisible();
    const plan = page.getByRole("button", { name: /Hold to see its plan/ });
    await expect(plan).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.down("i");
    await expect(plan).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.up("i");
    await expect(plan).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("2");
    await expect(page.getByRole("status")).toContainText("Set the stone");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("status")).toContainText("Step with");
    await expect(page.getByRole("dialog", { name: "Paused" })).toHaveCount(0);
    await page.keyboard.press("2");
    await page.keyboard.press("w");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Stone, 1 left/ })).toBeVisible();
    await playToTheEnd(page, "keys");
    await expect(results(page)).toContainText(ENDING);
  });

  test("a step into the wall is refused, with a reason", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    // Walk the cursor to the bottom of the pit and drop there, against the wall.
    for (let i = 0; i < 4; i++) await page.keyboard.press("x");
    await page.keyboard.press("Enter");
    await expect(stepPads(page).first()).toBeVisible();
    await page.keyboard.press("x");
    await expect(page.getByRole("status")).toContainText("That's the pit wall.");
  });

  test("the Daily Pit: dug, played to the end, with a share button", async ({ page }) => {
    await seed(page, withSettings());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Daily Pit #\d+/ }).click();
    await expect(page.getByText(/The grass is rustling/)).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Enter");
    await playToTheEnd(page, "keys");
    await expect(results(page)).toContainText(/Daily Pit #\d+/);
    await expect(results(page).getByRole("button", { name: /^Share/ })).toBeVisible();
    // The menu remembers today's result.
    await results(page).getByRole("button", { name: /^Game menu/ }).click();
    await expect(page.getByRole("button", { name: /^Daily Pit #\d+/ })).toContainText(/today/);
  });

  test("1970s mode: the program asks, refuses, and plays a game to its end", async ({ page }) => {
    await seed(page, quiet);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^1970s mode/ }).click();
    const input = page.getByRole("textbox", { name: /WHERE SHALL WE DROP YOU/ });
    await expect(input).toBeFocused();
    await page.keyboard.type("30,30");
    await page.keyboard.press("Enter");
    await expect(page.getByText("THAT IS OUTSIDE THE PIT. AGAIN.")).toBeVisible();
    await page.keyboard.type("3,4");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/^RABBIT AT/).first()).toBeVisible();
    const angle = page.getByRole("textbox", { name: /RUN WHICH WAY/ });
    await expect(angle).toBeFocused();
    await page.keyboard.type("30");
    await page.keyboard.press("Enter");
    await expect(page.getByText("MULTIPLES OF 45 ONLY.")).toBeVisible();
    const plotter = page.getByRole("complementary", { name: "Where everyone really is" });
    await expect(plotter).toBeVisible();
    // Run east and west by turns until the program is done with us.
    const done = page.getByRole("textbox", { name: /TYPE RUN TO GO AGAIN/ });
    for (let turn = 0; turn < 12 && !(await done.count()); turn++) {
      await page.keyboard.type(turn % 2 ? "180" : "0");
      await page.keyboard.press("Enter");
    }
    await expect(done).toBeVisible();
    await page.getByRole("button", { name: /Game menu/ }).first().click();
    await expect(page.getByRole("button", { name: /^1970s mode/ })).toBeVisible();
  });

  test("settings: the play style, the keyboard and the plan stay chosen after a reload", async ({ page }) => {
    await seed(page, withSettings());
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Game settings$/ }).click();
    await choose(page, "Tactics");
    await choose(page, "AZERTY");
    await choose(page, "While I hold I");
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    await page.getByRole("button", { name: /^Game settings$/ }).click();
    for (const name of ["Tactics", "AZERTY", "While I hold I"]) await expect(page.getByRole("radio", { name })).toBeChecked();
    await page.getByRole("button", { name: /Game menu/ }).first().click();
    await expect(page.getByRole("button", { name: /^Play Tactics/ })).toBeVisible();
  });

  test("AZERTY: the same square of keys moves the drop cursor", async ({ page }) => {
    await seed(page, withSettings({ keys: "azerty" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Classic/ }).click();
    await expect(page.getByRole("status")).toContainText("A Z E · Q D · W X C");
    // Z is north on AZERTY: from (0, -6) up to (0, -5), then drop.
    await page.keyboard.press("z");
    await page.keyboard.press("Enter");
    await expect(stepPads(page).first().or(results(page))).toBeVisible();
  });

  test("records: a page of its own, and back", async ({ page }) => {
    await seed(page, quiet);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Records$/ }).click();
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await page.getByRole("button", { name: /Game menu/ }).first().click();
    await expect(page.getByRole("button", { name: /^Records$/ })).toBeVisible();
  });

  test("every way out of a game: browser Back asks first, the pause menu leaves for the Hall", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    await dropByClick(page);
    await expect(stepPads(page).first()).toBeVisible();
    await page.goBack();
    const ask = page.getByRole("alertdialog");
    await ask.getByRole("button", { name: /Keep playing/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Pause/ }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Start this pit again", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Back to the Hall" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the pause menu starts the pit again, and results H goes back to the Hall", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }));
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    await dropByClick(page);
    await expect(stepPads(page).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await pauseMenu(page).getByRole("button", { name: "Start this pit again" }).click();
    const leave = page.getByRole("alertdialog").getByRole("button", { name: /Leave|Start again/ });
    if (await leave.count()) await leave.click();
    await expect(page.getByText(/The grass is rustling/)).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press("d");
    for (let i = 0; i < 12; i++) await page.keyboard.press("w");
    await page.keyboard.press("Enter");
    await expect(results(page)).toBeVisible();
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });

  test("the pit and its pads in dark", async ({ page }) => {
    await seed(page, withSettings({ playStyle: "tactics" }), "dark");
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Play Tactics/ }).click();
    await page.getByRole("button", { name: /^First Drop/ }).click();
    await dropByClick(page);
    await expect(stepPads(page).first()).toBeVisible();
    await expect(pit(page)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
