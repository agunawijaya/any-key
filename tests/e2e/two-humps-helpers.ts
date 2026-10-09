import { expect, type Page } from "@playwright/test";

/* Two Humps' test helpers, shared by its end-to-end tests and the screenshots. */

export const journal = (page: Page) => page.getByRole("dialog", { name: "Results" });

/** Waits until the trek wants something: a command, the reins, or nothing more (it's over). */
export async function settled(page: Page): Promise<"ready" | "rolling" | "caravan" | "over"> {
  const handle = await page.waitForFunction(() => {
    if (document.querySelector('[aria-label="Results"]')) return "over";
    if (document.querySelector('[aria-label="The camel is running on"]')) return "rolling";
    if ([...document.querySelectorAll("h2")].some((h) => h.textContent === "The packs are scattered")) return "caravan";
    return document.querySelector('[role="toolbar"] button:not([data-unready])') ? "ready" : null;
  });
  return (await handle.jsonValue()) as "ready" | "rolling" | "caravan" | "over";
}

/** Leaving a round in progress asks first; answers Leave if it does. */
export async function leaveIfAsked(page: Page) {
  const leave = page.getByRole("alertdialog").getByRole("button", { name: "Leave" });
  if (await leave.waitFor({ timeout: 1500 }).then(() => true, () => false)) await leave.click();
}

/** Tabs through the page until a control whose text matches has focus. */
export async function tabTo(page: Page, name: RegExp) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const text = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText ?? "");
    if (name.test(text)) return;
  }
  throw new Error(`Never reached ${name} with Tab`);
}

/** Plays a trek to its end with the keyboard: drink at the warning, camp when tired, let the camel run while it can. */
export async function playToTheEnd(page: Page) {
  for (let i = 0; i < 400; i++) {
    const state = await page.evaluate(() => {
      if (document.querySelector('[aria-label="Results"]')) return null;
      const label = (selector: string) => document.querySelector(selector)?.getAttribute("aria-label") ?? "";
      const number = (text: string, pattern: RegExp, fallback: number) => Number(text.match(pattern)?.[1] ?? fallback);
      return {
        roll: !!document.querySelector('[aria-label="The camel is running on"]'),
        caravan: [...document.querySelectorAll("h2")].some((h) => h.textContent === "The packs are scattered"),
        thirst: number(label('[aria-label$="before you must drink"]'), /^(\d+)/, 4),
        sips: number(label('[aria-label$="sips in the canteen"]'), /^(\d+)/, 0),
        stamina: number(label('[aria-label^="Camel strength"]'), /(\d+) of 7/, 7),
        ready: !!document.querySelector('[role="toolbar"] button:not([data-unready])'),
        gallop: !document.querySelector('[role="toolbar"] button[aria-keyshortcuts="3"][aria-disabled="true"]'),
      };
    });
    if (!state) return;
    if (state.roll) await page.keyboard.press(state.stamina >= 4 ? "Enter" : " ");
    else if (state.caravan) await page.keyboard.press("w");
    else if (!state.ready) await page.keyboard.press("Enter");
    else if (state.thirst <= 1 && state.sips > 0) await page.keyboard.press("1");
    else if (state.stamina <= 2) await page.keyboard.press("4");
    else await page.keyboard.press(state.stamina === 7 && state.gallop ? "3" : "2");
    await page.waitForTimeout(150);
  }
  // Still going after all that: say where it got stuck.
  const where = await page.evaluate(() => `${location.hash} · ${document.activeElement?.outerHTML.slice(0, 120)} · ${document.querySelector("main")?.innerText.slice(0, 300)}`);
  throw new Error(`The trek never ended: ${where}`);
}

/**
 * The tutorial by keyboard, up to the camel running on: walk, drink, gallop.
 * Each key waits for the coach's next lesson, which only shows once the turn
 * has played out (a key pressed before that is ignored).
 */
export async function tutorialToTheReins(page: Page) {
  const coach = page.getByRole("note");
  await expect(coach).toContainText("1 of 6");
  await page.keyboard.press("2");
  await expect(coach).toContainText("2 of 6", { timeout: 30_000 });
  await page.keyboard.press("1");
  await expect(coach).toContainText("3 of 6", { timeout: 30_000 });
  await page.keyboard.press("3");
  await page.getByRole("group", { name: "The camel is running on" }).waitFor({ timeout: 30_000 });
}

/** The tutorial's five lessons by keyboard: walk, drink, gallop, the reins, camp. Its dice are fixed, so this always works. */
export async function takeTheTutorial(page: Page) {
  const coach = page.getByRole("note");
  await tutorialToTheReins(page);
  await page.keyboard.press(" ");
  await expect(coach).toContainText("5 of 6", { timeout: 30_000 });
  await page.keyboard.press("4");
  await expect(coach).toContainText("6 of 6", { timeout: 30_000 });
}
