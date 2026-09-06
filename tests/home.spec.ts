import { expect, test } from "@playwright/test";
import {
  desktopViewport,
  expectImageLoaded,
  phoneViewport,
  shortViewport,
} from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Home keeps its active photograph between the header and footer", async ({
  page,
}) => {
  for (const viewport of [desktopViewport, phoneViewport, shortViewport]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectImageLoaded(page.locator(".slide.active img"));

    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rectangle = document
          .querySelector(selector)
          ?.getBoundingClientRect();
        return rectangle
          ? { top: rectangle.top, bottom: rectangle.bottom }
          : undefined;
      };
      return {
        header: bounds(".site-header"),
        image: bounds(".slide.active img"),
        footer: bounds(".site-footer"),
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.documentHeight).toBeLessThanOrEqual(
      geometry.viewportHeight + 1,
    );
    expect(geometry.documentWidth).toBeLessThanOrEqual(
      geometry.viewportWidth + 1,
    );
    expect(geometry.image?.top).toBeGreaterThanOrEqual(
      (geometry.header?.bottom ?? 0) - 1,
    );
    expect(geometry.image?.bottom).toBeLessThanOrEqual(
      (geometry.footer?.top ?? Infinity) + 1,
    );
    expect(geometry.footer?.bottom).toBeLessThanOrEqual(
      geometry.viewportHeight + 1,
    );
  }
});

test("Home slideshow responds to buttons and the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const stage = page.locator("[data-slideshow]");
  await expect(stage).toHaveAttribute("data-ready", "true");
  const firstAlt = await page.locator(".slide.active img").getAttribute("alt");

  await page.getByRole("button", { name: "Next image" }).click();
  await expect(page.locator(".slide.active img")).not.toHaveAttribute(
    "alt",
    firstAlt ?? "",
  );

  await stage.focus();
  const secondAlt = await page.locator(".slide.active img").getAttribute("alt");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".slide.active img")).not.toHaveAttribute(
    "alt",
    secondAlt ?? "",
  );
});
