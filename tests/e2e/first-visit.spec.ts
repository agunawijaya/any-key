import { expect, test } from "@playwright/test";
import { seed } from "./helpers";

test("the first-visit hint shows once and goes when dismissed", async ({ page }) => {
  await seed(page, {});
  await page.goto("/stickler");
  const hint = page.getByRole("note");
  await expect(hint).toContainText("pause and menu");
  await hint.getByRole("button", { name: /Dismiss/ }).click();
  await page.reload();
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("Bop Box's hint says what Esc does there", async ({ page }) => {
  await seed(page, {});
  await page.goto("/music");
  await expect(page.getByRole("note")).toContainText("back to the Hall");
});
