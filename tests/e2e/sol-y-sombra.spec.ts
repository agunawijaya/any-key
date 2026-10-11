import { expect, test, type Page } from "@playwright/test";
import { open, pauseItems, seed } from "./helpers";
import { downCards, finishCards, passCards, playAfternoon, quietSolYSombra, results, ROUTE, SAVE_KEY, SEEDS } from "./sol-y-sombra-helpers";

/*
 * Sol y Sombra, end to end: an afternoon by mouse and by keyboard alone,
 * through to the shoulders and to a lap of honour; a goring, getting up, and
 * retiring; a serious goring; the moment of truth asked for too early; the
 * 1970s terminal and its capital-letters rule; the settings and the records;
 * and every way out. Reduced motion cuts the long walks short, so the
 * afternoons here are quick.
 */

const pauseMenu = (page: Page) => page.getByRole("group", { name: "Pause menu" });

/** Picks an option the way a player does, by its label; the radio inside it is hidden. */
const choose = (page: Page, name: string | RegExp) => page.locator("label", { has: page.getByRole("radio", { name }) }).click();

const enter = async (page: Page, seedName: string) => {
  await seed(page, quietSolYSombra);
  await open(page, `${ROUTE}?seed=${seedName}`);
  await page.getByRole("button", { name: /^Enter the ring/ }).click();
  await expect(page).toHaveURL(/#play$/);
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Sol y Sombra", () => {
  test("the game menu offers every way in, and Esc goes back to the Hall", async ({ page }) => {
    await seed(page, quietSolYSombra);
    await open(page, ROUTE);
    for (const name of [/^Enter the ring/, /^1970s mode/, /^Records$/, /^Game settings$/]) await expect(page.getByRole("button", { name })).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: /Back to the Hall/ })
        .or(page.getByRole("button", { name: /Back to the Hall/ }))
        .first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test("by mouse: an afternoon through to the shoulders, with honest odds on every card, then R for another", async ({ page }) => {
    await enter(page, SEEDS.shoulders);
    await expect(passCards(page)).toBeVisible({ timeout: 60_000 });
    // The cards carry the odds the engine rolls.
    await expect(passCards(page).getByRole("button", { name: /^1 Veronica/ })).toContainText(/Goring\s*\d+%/);
    await expect(page.getByRole("region", { name: "The bull" })).toContainText("The crews' work");
    await playAfternoon(page, { by: "mouse" });
    await expect(results(page)).toContainText("Carried out on shoulders");
    await expect(results(page)).toContainText("the bull rested after 5 passes");
    await expect(results(page)).toContainText(/Before the roll: silence \d+%/);
    for (const action of [/^Another afternoon/, /^Game menu/, /^Back to the Hall/])
      await expect(results(page).getByRole("button", { name: action })).toBeVisible();
    await page.keyboard.press("r");
    await expect(results(page)).toBeHidden();
    await expect(page.getByRole("button", { name: /Skip ahead/ }).or(passCards(page))).toBeVisible();
  });

  test("keyboard only: from the menu to a lap of honour and back to the Hall", async ({ page }) => {
    await seed(page, quietSolYSombra);
    await open(page, `${ROUTE}?seed=${SEEDS.lap}`);
    await page.getByRole("button", { name: /^Enter the ring/ }).focus();
    await page.keyboard.press("Enter");
    await playAfternoon(page, { by: "keys" });
    await expect(results(page)).toContainText("A lap of honour");
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });

  test("gored, he gets up and carries on; the crowd counts it", async ({ page }) => {
    await enter(page, SEEDS.gored);
    await playAfternoon(page, { by: "keys", down: "carry on" });
    await expect(results(page)).toContainText("gorings 1");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.data.records.classic.gorings).toBe(1);
    // Getting up again earns its keycap.
    const keyring = await page.evaluate(() => JSON.parse(localStorage.getItem("anykey.keyring.save") ?? "{}"));
    expect(Object.keys(keyring.data.unlocked["sol-y-sombra"] ?? {})).toContain("back-on-your-feet");
  });

  test("gored, he retires: helped off, and the crowd gives applause at most", async ({ page }) => {
    await enter(page, SEEDS.gored);
    await playAfternoon(page, { by: "mouse", down: "retire" });
    await expect(results(page)).toContainText("retired after a goring");
    await expect(results(page)).toContainText(/lap 0% · shoulders 0%/);
  });

  test("a serious goring ends the afternoon in the infirmary, alive", async ({ page }) => {
    await enter(page, SEEDS.serious);
    await playAfternoon(page, { by: "keys", down: "carry on" });
    await expect(results(page)).toContainText("helped to the infirmary, and fine");
  });

  test("the moment of truth after one pass asks first; Esc keeps working, K goes", async ({ page }) => {
    await enter(page, SEEDS.lap);
    await expect(passCards(page)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("3");
    await expect(passCards(page)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("k");
    const ask = page.getByRole("dialog", { name: "The moment of truth already?" });
    await expect(ask).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ask).toBeHidden();
    await expect(passCards(page)).toBeVisible();
    await page.keyboard.press("k");
    await page.keyboard.press("k");
    await expect(finishCards(page)).toBeVisible();
    await expect(finishCards(page)).toContainText("try 1 of 3");
    await expect(downCards(page)).toBeHidden();
  });

  test("pausing: Esc opens the pause menu, leaving asks first, and browser Back returns to the menu", async ({ page }) => {
    await enter(page, SEEDS.lap);
    await expect(passCards(page)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("1");
    await expect(passCards(page)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Escape");
    expect(await pauseItems(page)).toEqual(expect.arrayContaining(["Resume", "Start a new afternoon", "Game menu"]));
    await page.keyboard.press("Escape");
    await expect(pauseMenu(page)).toBeHidden();
    await page.goBack();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /^Enter the ring/ })).toBeVisible();
    await expect(page).not.toHaveURL(/#play$/);
  });

  test("1970s mode: the 1978 program, capitals only, an afternoon to its end", async ({ page }) => {
    await seed(page, quietSolYSombra);
    await open(page, ROUTE);
    await page.getByRole("button", { name: /^1970s mode/ }).click();
    const line = page.getByRole("textbox");
    const type = async (text: string) => {
      await line.fill(text);
      await line.press("Enter");
    };
    await expect(page.getByText("A BULL IN THE AFTERNOON").first()).toBeVisible();
    await type("NO");
    await expect(page.getByText(/TODAY'S BULL IS CLASS \d/).first()).toBeVisible();
    await type("yes");
    await expect(page.getByText("ANSWER YES OR NO.").first()).toBeVisible();
    // Passes until the program is done, then RUN it again with Enter.
    for (let i = 0; i < 40 && !(await page.getByText("--- END OF THE AFTERNOON ---").count()); i++) {
      const prompt = (await page.locator("label[for='sys-terminal-input']").innerText()).trim();
      if (prompt.startsWith("CAPE MOVE")) await type("2");
      else if (prompt.startsWith("HOW")) await type("4");
      else if (prompt.startsWith("LEAVE")) await type("NO");
      else await type(i > 12 ? "YES" : "NO");
    }
    await expect(page.getByText("--- END OF THE AFTERNOON ---").first()).toBeVisible();
    await expect(page.getByText("Afternoons this visit:")).toContainText("1");
    await type("");
    await expect(page.getByText("A BULL IN THE AFTERNOON")).toHaveCount(2);
  });

  test("settings: what's coming is shown but can't be picked, and choices stay", async ({ page }) => {
    await seed(page, quietSolYSombra);
    await open(page, ROUTE);
    await page.getByRole("button", { name: "Game settings" }).click();
    await expect(page.getByRole("radio", { name: /Arena/ })).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Course Camarguaise/ })).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Stylized 3D/ })).toBeDisabled();
    await choose(page, "Half full");
    await page.getByRole("group", { name: "Slow motion at the closest moment" }).locator("label", { hasText: "Off" }).click();
    await page.reload();
    await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.data.settings.crowd).toBe("half");
    expect(saved.data.settings.slowMotion).toBe(false);
    await page.getByRole("button", { name: "Records" }).click();
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await page.getByRole("button", { name: "Back to the game menu" }).click();
    await expect(page.getByRole("button", { name: /^Enter the ring/ })).toBeVisible();
  });
});
