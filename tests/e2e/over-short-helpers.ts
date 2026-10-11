import { expect, type Page } from "@playwright/test";

/* Over / Short's test helpers, shared by its end-to-end tests and the screenshots. */

export const ROUTE = "/over-short";
export const SAVE_KEY = "anykey.over-short.save";

/** A Keyring where every first-visit hint is already gone, Over / Short's included. */
export const quietKeyring = {
  "anykey.keyring.save": { version: 1, data: { unlocked: {}, dailies: {}, levelSeen: 1, hintsDismissed: ["music", "23mtch", "escape", "lander", "two-humps", "long-memory", "over-short"] } },
};

/** A player who has won the first `chapters` chapters of the Campaign, so the next ones are open. */
export function campaignSave(chapters: number, extra: Record<string, unknown> = {}) {
  const missions: Record<string, unknown> = {};
  for (let c = 1; c <= chapters; c++) for (let m = 1; m <= 4; m++) missions[`${c}-${m}`] = { tries: 1, wins: 1, best: 4, medal: "silver" };
  return { version: 1, data: { campaign: { missions, table: [] }, ...extra } };
}

export const results = (page: Page) => page.getByRole("dialog", { name: "Results" });
export const elevationField = (page: Page) => page.getByRole("textbox", { name: "Elevation in degrees" });
export const fireButton = (page: Page) => page.getByRole("button", { name: /^Fire/ });
export const targetCard = (page: Page) => page.getByRole("region", { name: "The target" });
export const report = (page: Page) => page.getByRole("status");

/** The target's distance and the gun's greatest range, read off the target card as a player reads them. */
export async function readCard(page: Page) {
  const text = await targetCard(page).innerText();
  const metres = (pattern: RegExp) => Number((pattern.exec(text)?.[1] ?? "0").replace(/,/g, ""));
  return { distance: metres(/\n([\d,]+) m\n/), greatest: metres(/greatest range ([\d,]+) m/) };
}

/** The elevation the 1973 formula gives for what the card says, to a tenth of a degree. */
export async function formulaElevation(page: Page) {
  const { distance, greatest } = await readCard(page);
  return ((Math.asin(Math.min(1, distance / greatest)) * 90) / Math.PI).toFixed(1);
}

/** Waits until the gun can be fired again, or the game is over. */
export async function waitForGun(page: Page, within = 60_000) {
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Fire/.test(b.textContent ?? "") && !b.disabled) || !!document.querySelector("[role=dialog][aria-label=Results]"), null, { timeout: within });
}

/** Fires one round at `elevation`: by typing it and pressing Enter, or with the mouse in the field and on Fire. Skips the flight. */
export async function fireAt(page: Page, elevation: string, by: "keys" | "mouse") {
  if (by === "keys") {
    // Typing anywhere starts the elevation field.
    await page.keyboard.type(elevation);
    await page.keyboard.press("Enter");
  } else {
    await elevationField(page).fill(elevation);
    await fireButton(page).click();
  }
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect(report(page)).toBeVisible({ timeout: 30_000 });
}

/** Plays Classic with the formula until the results card shows, firing one round at each target. */
export async function playClassicByFormula(page: Page, by: "keys" | "mouse") {
  for (let round = 0; round < 12; round++) {
    if (await results(page).isVisible()) break;
    await fireAt(page, await formulaElevation(page), by);
    await waitForGun(page);
  }
  await expect(results(page)).toBeVisible();
}

/* ---------- Field Artillery ---------- */

/** A save with the difficulty set, for Field Artillery and the duel. */
export const difficultySave = (difficulty: "easy" | "normal" | "hard") => ({ version: 1, data: { settings: { difficulty } } });

export const fieldSlip = (page: Page) => page.getByRole("status").filter({ hasText: /observer/i });

/** The elevation the printed table gives for `range` with a charge, read between its rows on the low road. */
export function tableElevation(rows: { elevation: number; range: number }[], range: number) {
  const low = rows.filter((r) => r.elevation <= 45);
  for (let i = 0; i + 1 < low.length; i++) {
    const a = low[i];
    const b = low[i + 1];
    if ((a.range - range) * (b.range - range) <= 0) return a.elevation + ((range - a.range) / (b.range - a.range)) * (b.elevation - a.elevation);
  }
  return range > low[low.length - 1].range ? 45 : 5;
}

/** A correction as the slip gives it: metres to add (positive) or drop, and mils to move right (positive) or left. */
export function readCorrection(text: string) {
  const range = /(Add|Drop) (\d+)/.exec(text);
  const line = /(Left|Right) \d+ \((\d+) mils\)/.exec(text);
  return {
    hit: /Target!/.test(text),
    metres: range ? (range[1] === "Add" ? 1 : -1) * Number(range[2]) : 0,
    mils: line ? (line[1] === "Right" ? 1 : -1) * Number(line[2]) : 0,
  };
}
