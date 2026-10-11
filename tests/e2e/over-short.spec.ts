import { expect, test, type Page } from "@playwright/test";
import golden from "../fixtures/over-short-1970s.json";
import { localDateKey } from "../../lib/kit/daily";
import { FIELD_GUN, firingTable } from "../../lib/over-short/fieldModel";
import { open, pauseItems, seed } from "./helpers";
import {
  campaignSave,
  difficultySave,
  elevationField,
  fieldSlip,
  readCorrection,
  tableElevation,
  fireAt,
  formulaElevation,
  playClassicByFormula,
  quietKeyring,
  readCard,
  report,
  results,
  ROUTE,
  SAVE_KEY,
  targetCard,
  waitForGun,
} from "./over-short-helpers";

/*
 * Over / Short, end to end: Classic by mouse and by keyboard alone, start
 * to finish; a Campaign mission with only over-or-short reports; the
 * counter-battery finale, moving the gun; the observer's map and the firing
 * table; the game settings, kept across a reload; records; Field Artillery
 * won by following the observer's corrections; the duel's hand-over on one
 * screen; the Daily Barrage; both 1970s terminals; and every way out of a
 * game. Reduced motion keeps the sequences short.
 */

const pauseMenu = (page: Page) => page.getByRole("group", { name: "Pause menu" });

/** Picks a setting the way a player does, by its round label; the radio inside it is hidden. */
const choose = (page: Page, name: string | RegExp) => page.locator("label", { has: page.getByRole("radio", { name }) }).click();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Over / Short", () => {
  test("the game menu offers every way to play, and Esc goes back to the Hall", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    for (const name of [/^Classic/, /^Campaign/, /^Field Artillery/, /^Counter-Battery Duel/, /^Daily Barrage #\d+/, /^The 1970s/, /^Records$/, /^Game settings$/]) await expect(page.getByRole("button", { name })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test("Classic by keyboard alone: the briefing, five targets by the formula, the standard met, then R for a new game", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Classic/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Five targets. Five rounds each." })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(targetCard(page)).toContainText("Target 1 of 5");
    await playClassicByFormula(page, "keys");
    await expect(results(page)).toContainText("All five targets down");
    await expect(results(page)).toContainText("within the standard of 18");
    await page.keyboard.press("r");
    await expect(targetCard(page)).toContainText("Target 1 of 5");
  });

  test("Classic by mouse: the arrows, a miss reported in words and figures, then the results and H for the Hall", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Classic/ }).click();
    await page.getByRole("button", { name: /Take the gun/ }).click();
    await expect(elevationField(page)).toHaveValue("30.0");
    await page.getByRole("button", { name: /^Raise one degree/ }).click();
    await page.getByRole("button", { name: /^Raise one degree/ }).click();
    await expect(elevationField(page)).toHaveValue("32.0");
    // A deliberate miss: well over the formula's elevation (or under it when that would pass 45°).
    const right = Number(await formulaElevation(page));
    await fireAt(page, String(right > 30 ? right - 8 : right + 8), "mouse");
    await expect(report(page)).toContainText(/(Over|Short)\. [A-Z][a-z][\s\S]* metres\./);
    await waitForGun(page);
    await playClassicByFormula(page, "mouse");
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });

  test("Campaign, mission 1-1: the observer gives only over or short, the bracket shows on the map, and the mission is won", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Campaign/ }).click();
    await expect(page.getByRole("button", { name: /^2-1/ })).toBeDisabled();
    await page.getByRole("button", { name: /^1-1/ }).click();
    await expect(page.getByRole("heading", { name: "First Light" })).toBeVisible();
    await page.getByRole("button", { name: /Take the gun/ }).click();
    const right = Number(await formulaElevation(page));
    await fireAt(page, (right + 6).toFixed(1), "keys");
    await expect(report(page)).toHaveText(/Over\.$/);
    await waitForGun(page);
    await fireAt(page, (right - 6).toFixed(1), "keys");
    await expect(report(page)).toHaveText(/Short\.$/);
    await waitForGun(page);
    await page.keyboard.press("m");
    await expect(page.getByRole("img", { name: /Observer's map: 2 rounds/ })).toBeVisible();
    await expect(page.getByText("1: over")).toBeVisible();
    await expect(page.getByText("2: short")).toBeVisible();
    await fireAt(page, right.toFixed(1), "keys");
    await expect(report(page)).toContainText("Direct hit");
    await expect(results(page)).toBeVisible({ timeout: 30_000 });
    await expect(results(page)).toContainText("First Light: mission won");
    await expect(results(page).getByRole("button", { name: /Next: The Long Field/ })).toBeVisible();
  });

  test("the counter-battery finale: their rounds walk in, moving the gun puts the target 300 m further off, and leaving asks first", async ({ page }) => {
    await seed(page, { ...quietKeyring, [SAVE_KEY]: campaignSave(4) });
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Campaign/ }).click();
    await page.getByRole("button", { name: /^5-4/ }).click();
    await page.keyboard.press("Enter");
    await expect(page.getByText("The enemy battery is looking for you")).toBeVisible();
    for (let k = 0; k < 2; k++) {
      await fireAt(page, "80", "keys");
      await waitForGun(page);
    }
    await expect(page.getByText(/Their last round: 240 m from the gun/)).toBeVisible();
    const before = (await readCard(page)).distance;
    await page.getByRole("button", { name: /Move the gun back 300 m · 2 left/ }).click();
    await waitForGun(page);
    expect((await readCard(page)).distance).toBe(before + 300);
    await expect(page.getByRole("button", { name: /Move the gun back 300 m · 1 left/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Restart the mission", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /^Classic/ })).toBeVisible();
  });

  test("the firing table lists every round, and the battery's table carries over into Chapter 4", async ({ page }) => {
    await seed(page, { ...quietKeyring, [SAVE_KEY]: campaignSave(3, { campaign: { missions: campaignSave(3).data.campaign.missions, table: [{ elevation: 12, range: 4650, time: 21 }] } }) });
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Campaign/ }).click();
    await page.getByRole("button", { name: /^4-1/ }).click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("t");
    await expect(page.getByText("from earlier missions")).toBeVisible();
    await fireAt(page, "20", "keys");
    await waitForGun(page);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("table")).toContainText("20.0°");
  });

  test("settings: yards and hundredths of a degree, kept after a reload", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Game settings$/ }).click();
    await choose(page, "Yards");
    await choose(page, "Hundredths");
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    await page.getByRole("button", { name: /^Classic/ }).click();
    await expect(page.getByText(/destroys the target/)).toContainText("yd");
    await page.getByRole("button", { name: /Take the gun/ }).click();
    await expect(targetCard(page)).toContainText(" yd");
    await expect(elevationField(page)).toHaveValue("30.00");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.up("Shift");
    await expect(elevationField(page)).toHaveValue("31.01");
  });

  test("records: a page of their own, and back", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Records$/ }).click();
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await page.getByRole("button", { name: "← Game menu" }).click();
    await expect(page.getByRole("button", { name: /^Classic/ })).toBeVisible();
  });

  test("Field Artillery on Easy: the observer's corrections, followed, win Registration; the map plots left and right", async ({ page }) => {
    await seed(page, { ...quietKeyring, [SAVE_KEY]: difficultySave("easy") });
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Field Artillery/ }).click();
    await page.getByRole("button", { name: /^F1 Registration/ }).click();
    await expect(page.getByRole("heading", { name: "Registration" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(targetCard(page)).toContainText("by the map");
    // Charge 2, laid from the printed table at the map's distance, then corrected round by round as the observer says.
    await page.keyboard.press("Shift+C");
    await expect(page.getByRole("radio", { name: /^Charge 2,/ })).toHaveAttribute("aria-checked", "true");
    const rows = firingTable(FIELD_GUN, 2);
    let range = (await readCard(page)).distance;
    let line = 0;
    for (let round = 0; round < 8 && !(await results(page).isVisible()); round++) {
      await elevationField(page).fill(tableElevation(rows, range).toFixed(1));
      await elevationField(page).press("Enter");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await expect(fieldSlip(page)).toBeVisible({ timeout: 30_000 });
      const said = readCorrection(await fieldSlip(page).innerText());
      await waitForGun(page);
      if (said.hit) break;
      range += said.metres;
      for (let k = 0; k < Math.abs(said.mils); k++) await page.keyboard.press(said.mils > 0 ? "ArrowRight" : "ArrowLeft");
      line += said.mils;
      if (round === 0) {
        await page.keyboard.press("m");
        await expect(page.getByRole("img", { name: /Observer's map: 1 round at this target, plotted over or short and left or right/ })).toBeVisible();
        await page.keyboard.press("m");
      }
    }
    await expect(results(page)).toBeVisible({ timeout: 30_000 });
    await expect(results(page)).toContainText("Registration: mission won");
    await expect(results(page)).toContainText(/medal/);
    expect(Math.abs(line)).toBeLessThan(60);
  });

  test("the duel on one screen: West's orders sealed behind the hand-over, East's in turn, both guns together, both observers report", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Counter-Battery Duel/ }).click();
    await page.getByRole("radio", { name: /A friend, on this screen/ }).click();
    await page.getByRole("button", { name: /To the guns/ }).click();
    const card = page.getByRole("region", { name: "The enemy battery" });
    await expect(card).toContainText("West battery · player 1");
    await elevationField(page).fill("33");
    await elevationField(page).press("Enter");
    const handover = page.getByRole("dialog", { name: "East battery, your orders" });
    await expect(handover).toBeVisible();
    await expect(handover).toContainText("West battery: look away");
    await expect(elevationField(page)).toHaveCount(0);
    await handover.getByRole("button", { name: /I am the east battery/ }).click();
    await expect(card).toContainText("East battery · player 2");
    await expect(elevationField(page)).toHaveValue("25.0");
    await elevationField(page).fill("29");
    await elevationField(page).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "West battery’s observer" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: "East battery’s observer" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "West battery, your orders" })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Enter");
    await expect(card).toContainText("West battery · player 1");
    await expect(page.getByText(/^Turn 2/)).toBeVisible();
  });

  test("the Daily Barrage: numbered by the day, one round, and the pause menu's way out; a finished one shows its marks", async ({ page }) => {
    const today = localDateKey();
    await seed(page, { ...quietKeyring, [SAVE_KEY]: { version: 1, data: { daily: { [today]: { number: 1, won: true, rounds: 3, marks: "⬆️⬇️💥" } } } } });
    await open(page, ROUTE);
    await expect(page.getByRole("button", { name: /^Daily Barrage #\d+ Done today · down in 3/ })).toBeVisible();
    await page.getByRole("button", { name: /^Daily Barrage #\d+/ }).click();
    await expect(page.getByText(/^Daily Barrage #\d+ · the same shoot for everyone today$/)).toBeVisible();
    await expect(page.getByText("Today: ⬆️⬇️💥 down in 3")).toBeVisible();
    await page.getByRole("button", { name: /Shoot it again/ }).click();
    await elevationField(page).fill("20");
    await elevationField(page).press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await waitForGun(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Restart the Daily Barrage", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /^Field Artillery/ })).toBeVisible();
  });

  test("the 1970s: Gunner fights the same war every time it is loaded and the formula hits; Cannoneer on its green screen likewise", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^The 1970s/ }).click();
    await page.getByRole("button", { name: /^Gunner, 1973/ }).click();
    const paper = page.getByRole("log", { name: "The teletype's paper" });
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    await expect(paper).toContainText("24854");
    await expect(paper).toContainText("15446");
    const gunner = golden.runs.find((r) => r.name === "gunner-calculator")!;
    await page.keyboard.type(gunner.typed[0]);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(paper).toContainText("ON TARGET. DOWN WITH 1 ROUNDS.");
    await page.getByRole("button", { name: "Cannoneer, IBM PC →" }).click();
    const screen = page.getByRole("log", { name: "The screen" });
    await expect(screen).toContainText("10485");
    await expect(screen).toContainText("6516");
    const cannoneer = golden.runs.find((r) => r.name === "cannoneer-calculator")!;
    await page.keyboard.type(cannoneer.typed[0]);
    await page.keyboard.press("Enter");
    await expect(screen).toContainText("Direct hit! Down in 1 rounds.");
    await page.getByRole("button", { name: "← Game menu" }).click();
    await expect(page.getByRole("button", { name: /^The 1970s/ })).toBeVisible();
  });

  test("ways out of Field Artillery: browser Back asks first, and the pause menu restarts the mission", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Field Artillery/ }).click();
    await page.getByRole("button", { name: /^F3 Crosswind/ }).click();
    await page.keyboard.press("Enter");
    await elevationField(page).fill("30");
    await elevationField(page).press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await waitForGun(page);
    await page.goBack();
    await page.getByRole("alertdialog").getByRole("button", { name: /Keep playing/ }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Restart the mission", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Restart the mission" }).click();
    await expect(page.getByText(/Rounds · 8 left/)).toBeVisible();
  });

  test("every way out of a round: browser Back asks first, Keep playing returns, the pause menu leaves for the Hall", async ({ page }) => {
    await seed(page, quietKeyring);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^Classic/ }).click();
    await page.keyboard.press("Enter");
    await fireAt(page, "45", "keys");
    await waitForGun(page);
    await page.goBack();
    await page.getByRole("alertdialog").getByRole("button", { name: /Keep playing/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "New game", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await pauseMenu(page).getByRole("button", { name: "Back to the Hall" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
