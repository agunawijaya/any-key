import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { crashTenSecond, keyringSeed, seed, winClassic } from "../e2e/helpers";
import { LESSON, playToTheEnd as playSameTrickTwice, returningSave, withSave } from "../e2e/long-memory-helpers";
import { fireAt, formulaElevation, playClassicByFormula, waitForGun } from "../e2e/over-short-helpers";
import { playToTheEnd, settled, takeTheTutorial, tutorialToTheReins } from "../e2e/two-humps-helpers";
import { dropByClick, stepPads } from "../e2e/ten-turns-helpers";
import { downCards, finishCards, passCards, playAfternoon, SEEDS } from "../e2e/sol-y-sombra-helpers";

/*
 * Every route and key screen, light and dark, at a laptop and a desktop size,
 * as JPEGs in docs/media/shots/. They are documentation, not game art. Later
 * prompts add their own screens to SCREENS.
 *
 * Written straight to docs/ (not Playwright's output folder, which it empties
 * on every run).
 */

const OUT = join(__dirname, "..", "..", "docs", "media", "shots");
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: "1280", width: 1280, height: 720 },
  { name: "1920", width: 1920, height: 1080 },
];
const THEMES = ["light", "dark"] as const;

type Screen = { name: string; path: string; hall?: "wall" | "orbit" | "device"; go?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { name: "hall-wall", path: "/", hall: "wall" },
  { name: "hall-orbit", path: "/", hall: "orbit" },
  { name: "hall-device", path: "/", hall: "device" },
  { name: "keyring", path: "/keyring" },
  { name: "music-studio", path: "/music" },
  { name: "music-story", path: "/music#story" },
  { name: "stickler-menu", path: "/stickler" },
  {
    name: "stickler-board",
    path: "/stickler",
    go: async (page) => {
      await page.getByRole("button", { name: /Play Classic 23/ }).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "stickler-pause",
    path: "/stickler",
    go: async (page) => {
      await page.getByRole("button", { name: /Play Classic 23/ }).click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Pause" }).click();
    },
  },
  { name: "stickler-results", path: "/stickler", go: winClassic },
  { name: "outta-menu", path: "/outta-here" },
  {
    name: "outta-play",
    path: "/outta-here",
    go: async (page) => {
      await page.keyboard.press("r");
      await page.waitForTimeout(900);
    },
  },
  {
    name: "outta-1980",
    path: "/outta-here",
    go: async (page) => {
      await page.keyboard.press("1");
      await page.waitForTimeout(600);
    },
  },
  { name: "lander-menu", path: "/dont-crater" },
  {
    name: "lander-flight",
    path: "/dont-crater",
    go: async (page) => {
      await page.getByRole("button", { name: /Fly to the Moon/ }).click();
      await page.keyboard.press("Space");
      await page.waitForTimeout(5000);
    },
  },
  {
    name: "lander-pause",
    path: "/dont-crater",
    go: async (page) => {
      await page.getByRole("button", { name: /Fly to the Moon/ }).click();
      await page.keyboard.press("Space");
      await page.waitForTimeout(3000);
      await page.getByRole("button", { name: "Pause" }).click();
    },
  },
  { name: "lander-results", path: "/dont-crater", go: crashTenSecond },
  { name: "two-humps-menu", path: "/two-humps" },
  { name: "two-humps-pick", path: "/two-humps", go: (page) => page.getByRole("button", { name: /^Crossing/ }).click() },
  {
    name: "two-humps-trek",
    path: "/two-humps",
    go: async (page) => {
      await page.getByRole("button", { name: /^Crossing/ }).click();
      await page.getByRole("button", { name: /Set off/ }).click();
      await page.keyboard.press("2");
      await settled(page);
      await page.waitForTimeout(1500);
    },
  },
  {
    // The tutorial's dice are fixed, so the camel always runs on after its first gallop.
    name: "two-humps-roll",
    path: "/two-humps",
    go: async (page) => {
      await page.getByRole("button", { name: /New here/ }).click();
      await tutorialToTheReins(page);
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "two-humps-journal",
    path: "/two-humps",
    go: async (page) => {
      // Shorter pauses: the whole crossing is played before the picture is taken.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.getByRole("button", { name: /New here/ }).click();
      await takeTheTutorial(page);
      await playToTheEnd(page);
      await page.waitForTimeout(1500);
    },
  },
  { name: "two-humps-map", path: "/two-humps", go: (page) => page.getByRole("button", { name: /^Expedition/ }).click() },
  {
    name: "two-humps-1982",
    path: "/two-humps",
    go: async (page) => {
      await page.getByRole("button", { name: /^1982 mode/ }).click();
      for (const command of ["2", "5", "2"]) {
        await page.keyboard.type(command);
        await page.keyboard.press("Enter");
      }
    },
  },
  { name: "two-humps-records", path: "/two-humps", go: (page) => page.getByRole("button", { name: /Records and settings/ }).click() },
  { name: "long-memory-menu", path: "/long-memory" },
  { name: "long-memory-rules", path: "/long-memory", go: (page) => page.getByRole("button", { name: /^Play the Learner/ }).click() },
  {
    name: "long-memory-match",
    path: "/long-memory",
    go: async (page) => {
      await page.getByRole("button", { name: /^Play the Learner/ }).click();
      await page.getByRole("button", { name: /^Got it/ }).click();
      await page.keyboard.press("2");
      await page.getByRole("status").filter({ hasText: "Your move" }).waitFor();
      await page.waitForTimeout(1500);
    },
  },
  {
    // Caught while the remembered sowing is replayed in ghost seeds over the board.
    name: "long-memory-remembers",
    path: "/long-memory",
    go: async (page) => {
      await withSave(page, returningSave({ mind: { lessons: [LESSON], q: 0, a: 0 } }));
      await page.getByRole("button", { name: /^Play the Learner/ }).click();
      await page.keyboard.press("3");
      await page.getByText("It remembers this").waitFor();
      await page.waitForTimeout(900);
    },
  },
  {
    name: "long-memory-book",
    path: "/long-memory",
    go: async (page) => {
      const lessons = ["2026-10-04", "2026-10-06", "2026-10-07", "2026-10-09"].map((learned, i) => ({ ...LESSON, learned, you: LESSON.you - i }));
      await withSave(page, returningSave({ mind: { lessons, q: 0, a: 0 } }));
      await page.getByRole("button", { name: /^Memory Book/ }).click();
    },
  },
  { name: "long-memory-pick", path: "/long-memory", go: (page) => page.getByRole("button", { name: /^Choose rules and opponent/ }).click() },
  {
    name: "long-memory-daily",
    path: "/long-memory",
    go: async (page) => {
      await page.getByRole("button", { name: /^Daily Endgame/ }).click();
      await page.getByText(/^Daily Endgame #\d+ · /).first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "long-memory-results",
    path: "/long-memory",
    go: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await withSave(page, returningSave());
      await page.getByRole("button", { name: /^Play the Learner/ }).click();
      await playSameTrickTwice(page, "mouse");
    },
  },
  {
    name: "long-memory-1978",
    path: "/long-memory",
    go: async (page) => {
      await page.getByRole("button", { name: /^1970s mode/ }).click();
      for (const pit of ["3", "5"]) {
        await page.keyboard.type(pit);
        await page.keyboard.press("Enter");
      }
    },
  },
  { name: "over-short-menu", path: "/over-short", go: (page) => page.waitForTimeout(2500) },
  { name: "over-short-campaign", path: "/over-short", go: (page) => page.getByRole("button", { name: /^Campaign/ }).click() },
  {
    name: "over-short-firing",
    path: "/over-short",
    go: async (page) => {
      await page.getByRole("button", { name: /^Classic/ }).click();
      await page.getByRole("button", { name: /Take the gun/ }).click();
      await page.waitForTimeout(1500);
    },
  },
  {
    // Caught as the observer's report comes in, the glasses filling the screen.
    name: "over-short-fall",
    path: "/over-short",
    go: async (page) => {
      await page.getByRole("button", { name: /^Classic/ }).click();
      await page.getByRole("button", { name: /Take the gun/ }).click();
      await fireAt(page, String(Number(await formulaElevation(page)) + 3), "keys");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "over-short-map",
    path: "/over-short",
    go: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.getByRole("button", { name: /^Classic/ }).click();
      await page.getByRole("button", { name: /Take the gun/ }).click();
      await fireAt(page, String(Number(await formulaElevation(page)) + 3), "keys");
      await waitForGun(page);
      await page.keyboard.press("m");
    },
  },
  {
    name: "over-short-results",
    path: "/over-short",
    go: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.getByRole("button", { name: /^Classic/ }).click();
      await page.getByRole("button", { name: /Take the gun/ }).click();
      await playClassicByFormula(page, "keys");
    },
  },
  { name: "over-short-field", path: "/over-short", go: (page) => page.getByRole("button", { name: /^Field Artillery/ }).click() },
  {
    // Counter-Battery at the gun: charge, line and elevation, and the battery already ranging on it.
    name: "over-short-field-firing",
    path: "/over-short",
    go: (page) => openShoot(page, /^F6 Counter-Battery/),
  },
  {
    // A night shoot at the gun: the dark (the moon up in the light theme), three star shells to call for.
    name: "over-short-field-night",
    path: "/over-short",
    go: (page) => openShoot(page, /^F8 Night Shoot/),
  },
  {
    // The observer's map after one round: left and right as well as over and short.
    name: "over-short-field-map",
    path: "/over-short",
    go: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openShoot(page, /^F1 Registration/);
      await fireAt(page, "25", "keys");
      await waitForGun(page);
      await page.getByRole("tab", { name: /^Map/ }).click();
    },
  },
  { name: "over-short-duel", path: "/over-short", go: (page) => page.getByRole("button", { name: /^Counter-Battery Duel/ }).click() },
  {
    name: "over-short-duel-ridge",
    path: "/over-short",
    go: async (page) => {
      await page.getByRole("button", { name: /^Counter-Battery Duel/ }).click();
      await page.getByRole("button", { name: /To the guns/ }).click();
      await page.waitForTimeout(2500);
    },
  },
  { name: "over-short-daily", path: "/over-short", go: (page) => page.getByRole("button", { name: /^Daily Barrage/ }).click() },
  {
    name: "over-short-gunner",
    path: "/over-short",
    go: async (page) => {
      await page.getByRole("button", { name: /^The 1970s/ }).click();
      await page.getByRole("button", { name: /^Gunner, 1973/ }).click();
      await page.waitForTimeout(500);
      await page.keyboard.press("Space");
      await page.keyboard.type("30");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
    },
  },
  {
    name: "over-short-cannoneer",
    path: "/over-short",
    go: async (page) => {
      await page.getByRole("button", { name: /^The 1970s/ }).click();
      await page.getByRole("button", { name: /Cannoneer, IBM PC/ }).click();
      await page.waitForTimeout(1500);
      await page.keyboard.type("25");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3500);
    },
  },
  { name: "ten-turns-menu", path: "/ten-turns", go: (page) => page.waitForTimeout(2500) },
  { name: "ten-turns-chapters", path: "/ten-turns", go: openChapters },
  {
    name: "ten-turns-turn",
    path: "/ten-turns",
    go: async (page) => {
      await openChapters(page);
      await page.getByRole("button", { name: /^First Drop/ }).click();
      await dropByClick(page);
      await stepPads(page).first().waitFor();
      await page.waitForTimeout(800);
    },
  },
  {
    // Caught in the slow-motion fall, just before the rabbit is flattened.
    name: "ten-turns-squish",
    path: "/ten-turns",
    go: async (page) => {
      await openChapters(page);
      await page.getByRole("button", { name: /^First Drop/ }).click();
      await dropOnFirstRabbit(page);
      await page.waitForTimeout(2300);
    },
  },
  {
    name: "ten-turns-results",
    path: "/ten-turns",
    go: async (page) => {
      await openChapters(page);
      await page.getByRole("button", { name: /^First Drop/ }).click();
      await dropOnFirstRabbit(page);
      await page.getByRole("dialog", { name: "Results" }).waitFor({ timeout: 20_000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "ten-turns-1970s",
    path: "/ten-turns",
    go: async (page) => {
      await page.getByRole("button", { name: /^1970s mode/ }).click();
      for (const line of ["3,4", "90", "90", "0"]) {
        await page.keyboard.type(line);
        await page.keyboard.press("Enter");
      }
    },
  },
  { name: "ten-turns-settings", path: "/ten-turns", go: (page) => page.getByRole("button", { name: /^Game settings$/ }).click() },
  { name: "sol-y-sombra-menu", path: "/sol-y-sombra", go: (page) => page.waitForTimeout(3000) },
  {
    name: "sol-y-sombra-paseo",
    path: `/sol-y-sombra?seed=${SEEDS.shoulders}`,
    go: async (page) => {
      await page.getByRole("button", { name: /^Enter the ring/ }).click();
      await page.waitForTimeout(5000);
    },
  },
  { name: "sol-y-sombra-cards", path: `/sol-y-sombra?seed=${SEEDS.shoulders}`, go: toTheCards },
  {
    name: "sol-y-sombra-pass",
    path: `/sol-y-sombra?seed=${SEEDS.shoulders}`,
    go: async (page) => {
      await toTheCards(page);
      await page.keyboard.press("1");
      // Skip the walk out to the bull; the pass itself starts with the bull pawing the sand.
      await page.waitForTimeout(400);
      await page.keyboard.press("Space");
      await page.waitForTimeout(3000);
    },
  },
  {
    name: "sol-y-sombra-down",
    path: `/sol-y-sombra?seed=${SEEDS.gored}`,
    go: async (page) => {
      // This afternoon's first veronica gores.
      await toTheCards(page);
      await page.keyboard.press("1");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await downCards(page).waitFor({ timeout: 90_000 });
      await page.waitForTimeout(2500);
    },
  },
  {
    name: "sol-y-sombra-truth",
    path: `/sol-y-sombra?seed=${SEEDS.shoulders}`,
    go: async (page) => {
      await toTheCards(page);
      for (const key of ["1", "1", "2"]) {
        await passCards(page).waitFor({ timeout: 90_000 });
        await page.keyboard.press(key);
        await page.waitForTimeout(300);
        await page.keyboard.press("Space");
      }
      await passCards(page).waitFor({ timeout: 90_000 });
      await page.keyboard.press("k");
      await finishCards(page).waitFor();
    },
  },
  {
    name: "sol-y-sombra-results",
    path: `/sol-y-sombra?seed=${SEEDS.shoulders}`,
    go: async (page) => {
      await page.getByRole("button", { name: /^Enter the ring/ }).click();
      await playAfternoon(page, { by: "keys" }, 170_000);
    },
  },
  {
    name: "sol-y-sombra-1970s",
    path: "/sol-y-sombra",
    go: async (page) => {
      await page.getByRole("button", { name: /^1970s mode/ }).click();
      for (const line of ["NO", "NO", "0", "NO", "2", "NO", "1"]) {
        await page.keyboard.type(line);
        await page.keyboard.press("Enter");
      }
    },
  },
  { name: "sol-y-sombra-settings", path: "/sol-y-sombra", go: (page) => page.getByRole("button", { name: /^Game settings$/ }).click() },
];

/** Sol y Sombra: into the ring, past the paseo, the bull's entrance and the crews' work, to the first cards. */
async function toTheCards(page: Page) {
  await page.getByRole("button", { name: /^Enter the ring/ }).click();
  while (!(await passCards(page).isVisible())) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(800);
}

/** Over / Short: a Field Artillery shoot's briefing, then at the gun. */
async function openShoot(page: Page, title: RegExp) {
  await page.getByRole("button", { name: /^Field Artillery/ }).click();
  await page.getByRole("button", { name: title }).click();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
}

/** Ten Turns: choose Tactics on the game menu and open the chapter map. */
async function openChapters(page: Page) {
  await page.locator("label", { has: page.getByRole("radio", { name: /^Tactics/ }) }).click();
  await page.getByRole("button", { name: /^Play Tactics/ }).click();
}

/** Ten Turns: First Drop's rabbit hides at (6, 6) and the drop cursor starts at (0, -6). */
async function dropOnFirstRabbit(page: Page) {
  for (let i = 0; i < 6; i++) await page.keyboard.press("d");
  for (let i = 0; i < 12; i++) await page.keyboard.press("w");
  await page.keyboard.press("Enter");
}

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      test(`${screen.name} · ${theme} · ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await seed(page, { ...keyringSeed, "anykey.hall": screen.hall ?? "wall" }, theme);
        await page.goto(screen.path, { waitUntil: "networkidle" });
        await page.waitForTimeout(700);
        await screen.go?.(page);
        await page.mouse.move(2, size.height - 2);
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(OUT, `${screen.name}-${theme}-${size.name}.jpg`), type: "jpeg", quality: 70 });
      });
    }
  }
}
