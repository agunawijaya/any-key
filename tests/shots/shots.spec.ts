import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { crashTenSecond, keyringSeed, seed, winClassic } from "../e2e/helpers";

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
];

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
