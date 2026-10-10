import { expect, type Page } from "@playwright/test";
import { quietKeyring } from "./helpers";

/* Ten Turns in the Pit's test helpers, shared by its end-to-end tests and the screenshots. */

export const ROUTE = "/ten-turns";
export const SAVE_KEY = "anykey.ten-turns.save";

/** A Keyring that has already shown this game's first-visit hint, so the bar stays tidy. */
const keyring = quietKeyring["anykey.keyring.save"];
export const quiet = {
  "anykey.keyring.save": { ...keyring, data: { ...keyring.data, hintsDismissed: [...keyring.data.hintsDismissed, "ten-turns"] } },
};

export type TestSettings = { playStyle: "classic" | "tactics"; style: "storybook"; intent: "on" | "request" | "off"; keys: "qwerty" | "azerty" | "qwertz"; speed: "relaxed" | "normal" | "brisk" };

/** Storage for a player who has chosen these settings (Classic, QWERTY and the plan always shown unless given). */
export const withSettings = (settings: Partial<TestSettings> = {}) => ({
  ...quiet,
  [SAVE_KEY]: { version: 1, data: { settings: { playStyle: "classic", style: "storybook", intent: "on", keys: "qwerty", speed: "brisk", ...settings } } },
});

export const results = (page: Page) => page.getByRole("dialog", { name: "Results" });

/** The pit's own surface: clicks on it drop you in or step you. */
export const pit = (page: Page) => page.getByRole("application");

/** The step pads round the kid, present only when it is your move. */
export const stepPads = (page: Page) => page.locator("button[aria-label^='Step ']");

/** The letter for a direction on a QWERTY keyboard, by the name the pads use. */
const QWERTY: Record<string, string> = { east: "d", "north-east": "e", north: "w", "north-west": "q", west: "a", "south-west": "z", south: "x", "south-east": "c" };

/** Drops in by clicking low in the pit, well away from where the campaign's first rabbit hides. */
export async function dropByClick(page: Page) {
  const box = (await pit(page).boundingBox())!;
  await pit(page).click({ position: { x: box.width / 2, y: box.height * 0.74 } });
}

/** The turn the screen reader was last told about ("Turn 3 of 10."), or 0 between turns. */
async function turnAnnounced(page: Page) {
  const text = await page.getByText(/^Turn \d+ of \d+\./).textContent({ timeout: 500 }).catch(() => null);
  return Number(/^Turn (\d+)/.exec(text ?? "")?.[1] ?? 0);
}

/** Waits until it is your move (a pad shows and the turn is announced) or the game is over; true if it is your move. */
async function yourMove(page: Page, until: number) {
  while (Date.now() < until) {
    if (await results(page).isVisible()) return false;
    const pads = (await stepPads(page).count()) + (await page.getByRole("button", { name: /^Stay put/ }).count());
    if (pads && (await turnAnnounced(page))) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

/**
 * Steps every turn, by pad or by key, until the results card shows. The step
 * taken turns round the compass from turn to turn, so the kid wanders rather
 * than pressing itself into the wall.
 */
export async function playToTheEnd(page: Page, by: "mouse" | "keys", within = 150_000) {
  const deadline = Date.now() + within;
  while (Date.now() < deadline) {
    if (!(await yourMove(page, deadline))) break;
    const turn = await turnAnnounced(page);
    const pads = stepPads(page);
    const count = await pads.count();
    if (!count) {
      if (by === "mouse") await page.getByRole("button", { name: /^Stay put/ }).click({ timeout: 2000 }).catch(() => {});
      else await page.keyboard.press("Enter");
    } else {
      const pad = pads.nth((turn * 3) % count);
      if (by === "mouse") await pad.click({ timeout: 2000 }).catch(() => {});
      else {
        const label = (await pad.getAttribute("aria-label").catch(() => null)) ?? "Step north";
        await page.keyboard.press(QWERTY[label.replace("Step ", "")] ?? "w");
      }
    }
    // Wait for the rabbits to finish: the next turn is announced, or the game ends.
    const next = new RegExp(`^Turn ${turn + 1} of`);
    await expect(page.getByText(next).or(results(page))).toBeVisible({ timeout: 10_000 }).catch(() => {});
  }
  await expect(results(page)).toBeVisible();
}

/** Writes the game's save into the open page and reloads with it (for the screenshots, which seed only the Keyring). */
export async function withSave(page: Page, save: unknown) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, save] as const);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
}
