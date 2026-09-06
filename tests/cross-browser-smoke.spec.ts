import { expect, test } from "@playwright/test";
import { expectImageLoaded } from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Important portfolio content works in this browser", async ({ page }) => {
  await page.goto("/");
  await expectImageLoaded(page.locator(".slide.active img"));
  await expect(page.getByRole("button", { name: "Next image" })).toBeVisible();

  await page.goto("/work/");
  await expectImageLoaded(page.locator(".gallery-item img").first());

  await page.goto("/about/");
  await expect(
    page.getByRole("heading", { level: 1, name: "bio & cv" }),
  ).toBeVisible();
  await expectImageLoaded(page.getByAltText("Portrait of McKenzie Ryan"));

  await page.goto("/contact/");
  await expect(
    page.getByRole("link", { name: "knockknock@mckenzieryan.co" }),
  ).toBeVisible();
});

test("Shared navigation works in this browser", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 0) <= 800) {
    const menu = page.locator(".mobile-menu");
    await menu.locator("summary").click();
    await menu.getByRole("link", { name: "WORK" }).click();
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "WORK" })
      .click();
  }
  await expect(page).toHaveURL(/\/work\/$/);
  await expect(page.locator(".work-page")).toBeVisible();
});
