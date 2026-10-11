import { expect, type Page } from "@playwright/test";
import { quietKeyring } from "./helpers";

/* Sol y Sombra's test helpers, shared by its end-to-end tests and the screenshots. */

export const ROUTE = "/sol-y-sombra";
export const SAVE_KEY = "anykey.sol-y-sombra.save";

/**
 * Afternoons that go a known way when the passes are veronica, veronica,
 * outside, veronica, veronica (getting up after a goring) and then the
 * finish over the horns (found with the engine, `lib/sol-y-sombra/corrida.ts`).
 */
export const SEEDS = {
  /** No goring; the bull rests at the first try; carried out on shoulders. */
  shoulders: "t0",
  /** No goring; a lap of honour. */
  lap: "t2",
  /** Gored on the first pass (not badly); carrying on, a lap of honour in the end. */
  gored: "t4",
  /** Gored on the first pass, and again, seriously, on the second: helped to the infirmary. */
  serious: "t14",
};

/** The Keyring with this game's first-visit hint already dismissed, so the bar stays tidy. */
export const quietSolYSombra = (() => {
  const keyring = quietKeyring["anykey.keyring.save"] as { version: number; data: { hintsDismissed: string[] } };
  return { "anykey.keyring.save": { ...keyring, data: { ...keyring.data, hintsDismissed: [...keyring.data.hintsDismissed, "sol-y-sombra"] } } };
})();

export const results = (page: Page) => page.getByRole("dialog", { name: "Results" });
export const passCards = (page: Page) => page.getByRole("group", { name: "Choose the next pass" });
export const finishCards = (page: Page) => page.getByRole("group", { name: /^The moment of truth, attempt/ });
export const downCards = (page: Page) => page.getByRole("group", { name: "You are down" });

const MOVES = ["Veronica", "Veronica", "Outside pass", "Veronica", "Veronica"];
const KEYS = ["1", "1", "2", "1", "1"];

export type Way = { by: "mouse" | "keys"; down?: "carry on" | "retire" };

/**
 * Plays an afternoon the way the seeds above expect: skipping each scene,
 * five passes, then the finish over the horns, and on to the results.
 */
export async function playAfternoon(page: Page, way: Way, within = 200_000) {
  const deadline = Date.now() + within;
  let passes = 0;
  const press = (key: string) => page.keyboard.press(key);
  while (Date.now() < deadline) {
    if (await results(page).isVisible()) return;
    if (await passCards(page).isVisible()) {
      if (passes < MOVES.length) {
        if (way.by === "mouse")
          await passCards(page)
            .getByRole("button", { name: new RegExp(`^${KEYS[passes]} ${MOVES[passes]}`) })
            .click();
        else await press(KEYS[passes]);
        passes++;
      } else if (way.by === "mouse")
        await passCards(page)
          .getByRole("button", { name: /The moment of truth/ })
          .click();
      else await press("k");
      await page.waitForTimeout(300);
      continue;
    }
    if (await finishCards(page).isVisible()) {
      if (way.by === "mouse")
        await finishCards(page)
          .getByRole("button", { name: /^1 Over the horns/ })
          .click();
      else await press("1");
      await page.waitForTimeout(300);
      continue;
    }
    if (await downCards(page).isVisible()) {
      const retire = way.down === "retire";
      if (way.by === "mouse")
        await downCards(page)
          .getByRole("button", { name: retire ? /^2 Retire/ : /^1 Get up and carry on/ })
          .click();
      else await press(retire ? "2" : "1");
      await page.waitForTimeout(300);
      continue;
    }
    const proceed = page.getByRole("button", { name: "Continue" });
    if ((await proceed.isVisible()) && (await proceed.isEnabled())) {
      if (way.by === "mouse") await proceed.click();
      else await press("Enter");
      await page.waitForTimeout(300);
      continue;
    }
    const skip = page.getByRole("button", { name: /Skip ahead/ });
    if (await skip.isVisible()) {
      if (way.by === "mouse") await skip.click().catch(() => {});
      else await press("Space");
    }
    await page.waitForTimeout(250);
  }
  await expect(results(page)).toBeVisible();
}
