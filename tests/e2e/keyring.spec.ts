import { expect, test, type Page } from "@playwright/test";
import { crashTenSecond, keyringSeed, open, seed, stepOffIn1980 } from "./helpers";

/* One real unlock in every game reaches the Keyring and drops its keycap toast. */

const toast = (page: Page, title: string) => page.getByRole("status").filter({ hasText: "New keycap" }).filter({ hasText: title });

test.beforeEach(async ({ page }) => seed(page));

test("Bop Box: a tune on the 1981 speaker unlocks First Note and Beep Beep", async ({ page }) => {
  await open(page, "/music");
  await expect(async () => {
    await page.keyboard.press("9");
    await expect(page.locator('[data-style="pc81"]')).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(toast(page, "First Note")).toBeVisible();
  await expect(toast(page, "Beep Beep")).toBeVisible();
});

test("Stickler: taking too many unlocks Rule Bender", async ({ page }) => {
  await open(page, "/stickler");
  await page.getByRole("button", { name: /Play Classic 23/ }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press("4");
  await expect(toast(page, "Rule Bender")).toBeVisible();
});

test("Don't Crater: no burn at all leaves a new crater", async ({ page }) => {
  await open(page, "/dont-crater");
  await crashTenSecond(page);
  await expect(toast(page, "Crater Maker")).toBeVisible();
});

test("Outta Here: stepping off the bottom-left corner in 1980 mode crashes the computer", async ({ page }) => {
  await open(page, "/outta-here");
  await stepOffIn1980(page);
  await expect(toast(page, "Crash Test")).toBeVisible();
});

test("the unlock shows on the Keyring page, with its XP", async ({ page }) => {
  await open(page, "/stickler");
  await page.getByRole("button", { name: /Play Classic 23/ }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press("4");
  await expect(toast(page, "Rule Bender")).toBeVisible();
  await page.goto("/keyring");
  await expect(page.getByText("1 of 75 keycaps on the ring")).toBeVisible();
  await expect(page.getByText("10 / 40 XP")).toBeVisible();
});

test("Keyring: forgetting one game asks first and keeps the others", async ({ page }) => {
  await page.context().clearCookies();
  await page.addInitScript((s) => {
    if (sessionStorage.getItem("seeded-full")) return;
    sessionStorage.setItem("seeded-full", "1");
    localStorage.setItem("anykey.keyring.save", JSON.stringify(s["anykey.keyring.save"]));
  }, keyringSeed);
  await page.goto("/keyring");
  await expect(page.getByText("20 of 75 keycaps on the ring")).toBeVisible();
  await page.getByRole("button", { name: "Forget my Stickler data" }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByText("20 of 75 keycaps on the ring")).toBeVisible();
  await page.getByRole("button", { name: "Forget my Stickler data" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Forget", exact: true }).click();
  await expect(page.getByText("14 of 75 keycaps on the ring")).toBeVisible();
});

test("Keyring: the week's streak and today's dailies", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded-daily")) return;
    sessionStorage.setItem("seeded-daily", "1");
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem("anykey.keyring.save", JSON.stringify({ version: 1, data: { unlocked: {}, dailies: { [key]: ["23mtch"] }, levelSeen: 1, hintsDismissed: [] } }));
  });
  await page.goto("/keyring");
  await expect(page.getByText("1 day", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Stickler.*done/ }).first()).toBeVisible();
});
