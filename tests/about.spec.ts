import { expect, test } from "@playwright/test";
import {
  desktopViewport,
  expectDocumentPageUsable,
  expectImageLoaded,
  phoneViewport,
} from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("About presents the biography, portrait, and CV accessibly", async ({
  page,
}) => {
  await page.goto("/about/");
  await expect(
    page.getByRole("heading", { level: 1, name: "bio & cv" }),
  ).toBeVisible();
  await expect(page.locator("#bio")).toContainText("McKenzie Ryan");
  await expect(page.locator("#cv")).toContainText("Education");
  await expectImageLoaded(page.getByAltText("Portrait of McKenzie Ryan"));
});

test("About remains readable on desktop and phone", async ({ page }) => {
  for (const viewport of [desktopViewport, phoneViewport]) {
    await page.setViewportSize(viewport);
    await expectDocumentPageUsable(page, "/about/", ".container");
  }
});
