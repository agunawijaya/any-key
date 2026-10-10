import { expect, test } from "@playwright/test";
import { crashTenSecond, open, pauseItems, seed, stepOffIn1980, winClassic } from "./helpers";

/* The navigation standard (docs/NAVIGATION.md), game by game. */

const GAMES = [
  { route: "/music", title: "Bop Box" },
  { route: "/stickler", title: "Stickler" },
  { route: "/outta-here", title: "Outta Here" },
  { route: "/dont-crater", title: "Don't Crater" },
  { route: "/two-humps", title: "Two Humps" },
  { route: "/long-memory", title: "Same Trick Twice" },
];

test.beforeEach(async ({ page }) => seed(page));

for (const game of GAMES) {
  test(`${game.title}: Esc on the game menu goes back to the Hall`, async ({ page }) => {
    await open(page, game.route);
    await expect(page.getByRole("button", { name: "Back to the Hall" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });

  test(`${game.title}: browser Back from the game menu returns to the Hall`, async ({ page }) => {
    await page.goto("/");
    await open(page, game.route);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test(`${game.title}: the Story tab has its own address and Esc returns to Play`, async ({ page }) => {
    await open(page, game.route);
    await page.getByRole("tab", { name: "Story" }).click();
    await expect(page).toHaveURL(/#story$/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/#story/);
    await expect(page.getByRole("tab", { name: "Play" })).toHaveAttribute("aria-selected", "true");
  });
}

test("Back to the Hall button leaves a game menu at once", async ({ page }) => {
  await open(page, "/stickler");
  await page.getByRole("button", { name: "Back to the Hall" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe("Stickler", () => {
  test("Back mid-game asks first; Keep playing stays, Leave goes to the game menu", async ({ page }) => {
    await open(page, "/stickler");
    await page.getByRole("button", { name: /Play Classic 23/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await page.keyboard.press("2");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.goBack();
    const ask = page.getByRole("alertdialog");
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: /Keep playing/ }).click();
    await expect(page.locator("[data-board]")).toBeVisible();
    await page.goBack();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /Play Classic 23/ })).toBeVisible();
    await expect(page).not.toHaveURL(/#/);
  });

  test("the Keyring button mid-game asks first, and Leave opens the Keyring", async ({ page }) => {
    await open(page, "/stickler");
    await page.getByRole("button", { name: /Play Classic 23/ }).click();
    await page.keyboard.press("2");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.getByRole("link", { name: /^Keyring/ }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page).toHaveURL(/\/stickler#play$/);
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/keyring$/);
  });

  test("Esc pauses with the fixed menu order, and Esc resumes", async ({ page }) => {
    await open(page, "/stickler");
    await page.getByRole("button", { name: /Play Classic 23/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect(await pauseItems(page)).toEqual(["Resume", "Start this game again", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toHaveCount(0);
  });

  test("Results: the three standard actions in order, and R plays again", async ({ page }) => {
    await open(page, "/stickler");
    await winClassic(page);
    const results = page.getByRole("dialog", { name: "Results" });
    const actions = (await results.getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0].trim()).slice(-3);
    expect(actions).toEqual(["Rematch", "Game menu", "Back to the Hall"]);
    await page.keyboard.press("r");
    await expect(results).toHaveCount(0);
    await expect(page.locator("[data-count]").first()).toHaveAttribute("data-count", "23");
  });

  test("How to play shows the manual, and its links open that chapter of the Story", async ({ page }) => {
    await open(page, "/stickler");
    await page.getByRole("button", { name: /Play Classic 23/ }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "How to play" }).click();
    const manual = page.getByRole("dialog", { name: "How to play" });
    await expect(manual.getByRole("heading", { name: "Controls" })).toBeVisible();
    const link = manual.locator('a[href^="#chapter-"]').first();
    const chapter = (await link.getAttribute("href"))!.replace("#chapter-", "");
    await link.click();
    await expect(page).toHaveURL(/#story$/);
    const labels: Record<string, string> = { about: "About", original: "How the original worked", changes: "What we changed", architecture: "How we rebuilt it", notes: "Notes" };
    await expect(page.getByRole("navigation", { name: "Story chapters" }).getByRole("button", { name: labels[chapter] })).toHaveAttribute("aria-pressed", "true");
  });

  test("K on the game menu opens the Keyring", async ({ page }) => {
    await open(page, "/stickler");
    await page.keyboard.press("k");
    await expect(page).toHaveURL(/\/keyring$/);
  });
});

test.describe("Don't Crater", () => {
  test("Pause menu order, and Game menu mid-flight asks first", async ({ page }) => {
    await open(page, "/dont-crater");
    await page.getByRole("button", { name: /Fly to the Moon/ }).click();
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Pause" }).click();
    expect(await pauseItems(page)).toEqual(["Resume", "Restart flight", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "Game menu" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /Fly to the Moon/ })).toBeVisible();
  });

  test("Back before the descent starts doesn't ask", async ({ page }) => {
    await open(page, "/dont-crater");
    await page.getByRole("button", { name: /Fly to the Moon/ }).click();
    await page.goBack();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Fly to the Moon/ })).toBeVisible();
  });

  test("Results: H goes back to the Hall", async ({ page }) => {
    await open(page, "/dont-crater");
    await crashTenSecond(page);
    await expect(page.getByRole("button", { name: /Back to the Hall/ }).last()).toBeVisible();
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Outta Here", () => {
  test("Back mid-run asks first; P opens the pause menu with the game's items", async ({ page }) => {
    await open(page, "/outta-here");
    await page.keyboard.press("r");
    await expect(page).toHaveURL(/#play$/);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.press("p");
    expect(await pauseItems(page)).toEqual(["Resume", "Try again", "New screen", "How to play", "Settings", "Game menu", "Back to the Hall"]);
    await page.keyboard.press("Escape");
    await page.goBack();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: /^Run/ })).toBeVisible();
  });

  test("1980 mode: after the run, Esc goes to the game menu", async ({ page }) => {
    await open(page, "/outta-here");
    await stepOffIn1980(page);
    await expect(page.getByRole("button", { name: /Switch it off and on/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /1980 mode/ })).toBeVisible();
  });
});

test.describe("Bop Box", () => {
  test("the studio's own letters stay the studio's: K picks a tune, ? opens the shortcuts", async ({ page }) => {
    await open(page, "/music");
    await page.keyboard.press("k");
    await expect(page).toHaveURL(/\/music$/);
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Shortcuts" })).toHaveCount(0);
  });
});
