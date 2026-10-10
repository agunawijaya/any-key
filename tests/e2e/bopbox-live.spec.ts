import { expect, test } from "@playwright/test";
import { open, seed } from "./helpers";

/*
 * Bop Box's Live view: the fifth view, after Stage. Every style has its
 * performers; each one is a button over the drawing that mutes its part.
 */

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test("the Live view draws the performers, and clicking one mutes their part", async ({ page }) => {
  await open(page, "/music");
  await page.getByRole("tab", { name: "Live" }).click();
  const canvas = page.locator("canvas[data-detail]");
  await expect(canvas).toBeVisible();
  // The Blue Danube in the Orchestra style opens on a string section: three players, one part, one button.
  const performer = page.locator("button[aria-label='Mute String section']");
  await expect(performer).toHaveCount(1);
  await performer.click();
  await expect(page.locator("button[aria-label='Unmute String section']")).toHaveAttribute("aria-pressed", "false");
  // The Band list on the right agrees.
  await expect(page.getByRole("button", { name: /String section.*muted/i })).toBeVisible();
  await page.locator("button[aria-label='Unmute String section']").click();
  await expect(page.locator("button[aria-label='Mute String section']")).toHaveAttribute("aria-pressed", "true");
});

test("V reaches the Live view, and its show follows the style", async ({ page }) => {
  await open(page, "/music");
  await page.locator("body").click({ position: { x: 5, y: 400 } });
  for (let i = 0; i < 4; i++) await page.keyboard.press("v");
  await expect(page.getByRole("tab", { name: "Live" })).toHaveAttribute("aria-selected", "true");
  const caption = page.locator("[data-caption]");
  await expect(caption).toContainText(/orchestra/i);
  await page.keyboard.press("7");
  await expect(caption).toContainText(/rooftop/i);
  await page.keyboard.press("4");
  await expect(caption).toContainText(/DJ/);
  await expect(page.getByRole("button", { name: /Mute the DJ/ })).toBeVisible();
});

test("Esc in the Live view still goes back to the Hall", async ({ page }) => {
  await open(page, "/music");
  await page.getByRole("tab", { name: "Live" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
});
