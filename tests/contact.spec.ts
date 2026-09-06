import { expect, test } from "@playwright/test";
import {
  desktopViewport,
  expectDocumentPageUsable,
  phoneViewport,
  shortViewport,
} from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Contact exposes usable email and Instagram links", async ({ page }) => {
  await page.goto("/contact/");
  await expect(
    page.getByRole("heading", { level: 1, name: "get in touch..." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "knockknock@mckenzieryan.co" }),
  ).toHaveAttribute("href", "mailto:knockknock@mckenzieryan.co");
  await expect(
    page
      .locator("#main-content")
      .getByRole("link", { name: "@thisspotstaken" }),
  ).toHaveAttribute("href", "https://www.instagram.com/thisspotstaken/");
});

test("Contact remains readable and scrollable at varied viewport sizes", async ({
  page,
}) => {
  for (const viewport of [desktopViewport, phoneViewport, shortViewport]) {
    await page.setViewportSize(viewport);
    await expectDocumentPageUsable(page, "/contact/", ".container");
  }

  await page.setViewportSize(shortViewport);
  await page.goto("/contact/");
  await page.addStyleTag({ content: ".container { min-height: 50rem; }" });
  const heights = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(heights.documentHeight).toBeGreaterThan(heights.viewportHeight);
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(page.locator(".site-footer")).toBeInViewport();
});
