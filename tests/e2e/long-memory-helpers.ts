import { expect, type Page } from "@playwright/test";
import { quietKeyring } from "./helpers";

/* Same Trick Twice's test helpers, shared by its end-to-end tests and the screenshots. */

export const SAVE_KEY = "anykey.long-memory.save";

/**
 * A real lesson: the game where you open with pit 3 and the Learner answers
 * from its pit 12 (hole 12), which it then lost 14 to 21. With it in the
 * book, the Learner turns away from pit 12 after the same first move.
 */
export const LESSON = { code: 833672, opening: [2, 12, 5, 8, 1, 10, 3, 9], learned: "2026-10-04", you: 21, learner: 14 };

/** The game's save for a returning player: every rules card already read, plus whatever else is given. */
export const returningSave = (data: Record<string, unknown> = {}) => ({
  version: 1,
  data: { seenRules: ["awari1978", "oware", "kalah"], ...data },
});

/** Storage for a returning player, in the shape `seed` takes. */
export const returning = (data: Record<string, unknown> = {}) => ({ ...quietKeyring, [SAVE_KEY]: returningSave(data) });

export const results = (page: Page) => page.getByRole("dialog", { name: "Results" });

/** The pits the player to move may sow (the others are disabled). */
export const choices = (page: Page) => page.locator("button[aria-label*=' pit ']:not([disabled])");

/** The key for a pit: 1–6 count the mover's pits from left to right as the board is seen. */
export function keyFor(label: string) {
  const number = Number(/ pit (\d)/.exec(label)?.[1] ?? 1);
  const farSide = !/^(Your|Player 1's) /.test(label);
  return String(farSide ? 7 - number : number);
}

/** Sows the first pit that may be sown, by mouse or by key, whenever it is a person's turn, until the game ends. */
export async function playToTheEnd(page: Page, by: "mouse" | "keys", within = 150_000) {
  const deadline = Date.now() + within;
  while (Date.now() < deadline) {
    if (await results(page).isVisible()) return;
    const pit = choices(page).first();
    if (!(await pit.count())) {
      await page.waitForTimeout(150);
      continue;
    }
    if (by === "mouse") await pit.click({ timeout: 2000 }).catch(() => {});
    else await page.keyboard.press(keyFor((await pit.getAttribute("aria-label").catch(() => null)) ?? ""));
    await page.waitForTimeout(150);
  }
  await expect(results(page)).toBeVisible();
}

/** Writes the game's save into the open page and reloads with it (for the screenshots, which seed only the Keyring). */
export async function withSave(page: Page, save: unknown) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, save] as const);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Keyring, level \d+/ }).waitFor();
}
