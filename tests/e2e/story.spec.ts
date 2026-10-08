import { expect, test } from "@playwright/test";
import { seed } from "./helpers";

/* Every chapter of every game's Story renders, and every Mermaid diagram in it draws. */

for (const route of ["/music", "/stickler", "/outta-here", "/dont-crater"]) {
  test(`${route}: every Story chapter and diagram renders`, async ({ page }) => {
    await seed(page);
    await page.goto(`${route}#story`);
    const chapters = page.getByRole("navigation", { name: "Story chapters" }).getByRole("button");
    // The Story shows once the page has read #story, after hydration: wait for all six chapters.
    await expect(chapters).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await chapters.nth(i).click();
      await page.waitForTimeout(400);
      // Mermaid draws asynchronously; wait until no diagram source is left on the page.
      await expect(page.locator("pre > code.language-mermaid")).toHaveCount(0, { timeout: 15_000 });
      await expect(page.locator("[class*='diagramFallback']")).toHaveCount(0);
    }
    // The top bar stays on screen however far the reader scrolls.
    await page.mouse.wheel(0, 20_000);
    await expect(page.getByRole("button", { name: "Back to the Hall" })).toBeInViewport();
  });
}
