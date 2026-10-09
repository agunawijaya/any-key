import { expect, test } from "@playwright/test";
import { seed } from "./helpers";

test("appearance switches live between Light, Dark and System, and is remembered", async ({ page }) => {
  await seed(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/stickler");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("menuitemradio", { name: /Dark/ }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("menuitemradio", { name: /System/ }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("menuitemradio", { name: /Dark/ }).click();
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("the Hall shows the Keyring button, today's dailies and the newest game, in every style", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Keyring/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today's dailies" })).toBeVisible();
  for (const style of ["Wall", "Orbit", "Device"]) {
    await page.getByRole("button", { name: style, exact: true }).click();
    const view = page.locator(`[data-view="${style.toLowerCase()}"]`);
    // Orbit draws its planets, so the name is the planet's label rather than text on the page.
    const newest = style === "Orbit" ? view.getByRole("button", { name: /Two Humps/ }) : view.getByText("Two Humps");
    await expect(newest.first()).toBeVisible();
  }
});
