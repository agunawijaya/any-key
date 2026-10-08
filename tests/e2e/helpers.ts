import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export type Seed = Record<string, unknown>;

const GAMES = ["music", "23mtch", "escape", "lander"];

/** A keyring where every game's first-visit hint was already dismissed, so the bar stays tidy in tests. */
export const quietKeyring = { "anykey.keyring.save": { version: 1, data: { unlocked: {}, dailies: {}, levelSeen: 1, hintsDismissed: GAMES } } };

export const keyringSeed: Seed = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "keyring-seed.json"), "utf8"));

/** Starts every test like a visitor with this storage (only on the first page load of the test). */
export async function seed(page: Page, values: Seed = quietKeyring, theme: "light" | "dark" | "system" = "light") {
  await page.addInitScript(
    ([s, t]) => {
      if (sessionStorage.getItem("anykey-test-seeded")) return;
      sessionStorage.setItem("anykey-test-seeded", "1");
      localStorage.clear();
      localStorage.setItem("anykey.theme", t);
      for (const [key, value] of Object.entries(s)) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    },
    [values, theme] as const,
  );
}

/**
 * Opens a page and waits until React has taken it over: the server-rendered
 * page shows its buttons before their key listeners exist, and a key pressed
 * in that gap is lost. The top bar's Keyring level only appears once hydrated.
 */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
}

/** Plays Classic 23 perfectly (always leave 4k + 1) until the results card shows. */
export async function winClassic(page: Page) {
  await page.getByRole("button", { name: /Play Classic 23/ }).click();
  for (let turn = 0; turn < 20; turn++) {
    await page.waitForTimeout(1200);
    if (await page.getByRole("dialog", { name: "Results" }).count()) return;
    const left = Number(await page.locator("[data-count]").first().getAttribute("data-count"));
    if (!left) continue;
    const take = Math.max(1, Math.min(3, (left - 1) % 4 || 1));
    await page.keyboard.press(String(take));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2200);
  }
  await page.getByRole("dialog", { name: "Results" }).waitFor();
}

/** Ten-Second mode with no burn at all: the quickest way into the ground. */
export async function crashTenSecond(page: Page) {
  await page.getByRole("button", { name: /Ten-Second/ }).click();
  await page.waitForTimeout(500);
  for (let turn = 0; turn < 40; turn++) {
    if (await page.getByRole("button", { name: /Fly again/ }).count()) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  }
  await page.getByRole("button", { name: /Fly again/ }).waitFor({ timeout: 20_000 });
}

/**
 * Outta Here's 1980 mode, run straight off the bottom-left corner. The keys go
 * in as one burst from inside the page: pressed one by one from the test, the
 * blocks get a few frames between presses and sometimes land on the runner.
 */
export async function stepOffIn1980(page: Page) {
  await page.keyboard.press("1");
  await page.getByRole("button", { name: /Game menu/ }).first().waitFor();
  await page.evaluate(() => {
    const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    press("Enter");
    for (let i = 0; i < 16; i++) press("ArrowDown");
  });
}

/** The pause menu's items, top to bottom, without their key hints. */
export async function pauseItems(page: Page) {
  const labels = await page.getByRole("dialog", { name: "Paused" }).getByRole("button").allInnerTexts();
  return labels.map((text) => text.split("\n")[0].trim());
}
