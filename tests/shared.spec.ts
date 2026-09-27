import { expect, test } from "@playwright/test";
import {
  desktopViewport,
  expectImageLoaded,
  phoneViewport,
} from "./test-helpers";

const routeTitles = [
  ["/", "McKenzie Ryan"],
  ["/work/", "Work | McKenzie Ryan"],
  ["/about/", "About | McKenzie Ryan"],
  ["/contact/", "Contact | McKenzie Ryan"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Every page exposes its intended browser title and shared navigation", async ({
  page,
}) => {
  for (const [route, title] of routeTitles) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(
      page.getByRole("link", { name: "McKenzie Ryan" }),
    ).toBeVisible();
    await expect(page.locator(".site-footer")).toBeAttached();
  }
});

test("Mobile navigation opens accessibly and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize(phoneViewport);
  await page.goto("/");
  const menu = page.locator(".mobile-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await expect(menu.getByRole("link", { name: "WORK" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(menu.locator("summary")).toBeFocused();
});

test("Back to top appears only after scrolling on desktop and phone", async ({
  page,
}) => {
  for (const viewport of [desktopViewport, phoneViewport]) {
    await page.setViewportSize(viewport);
    await page.goto("/work/");
    const backToTop = page.locator("[data-back-to-top]");

    await expect(backToTop).toBeHidden();
    await expect(backToTop).toHaveAttribute("aria-hidden", "true");
    await expect(backToTop).toHaveAttribute("tabindex", "-1");

    await page.evaluate(() => window.scrollTo(0, window.innerHeight));
    await expect(backToTop).toBeVisible();
    await expect(backToTop).not.toHaveAttribute("aria-hidden", "true");
    await expect(backToTop).not.toHaveAttribute("tabindex", "-1");

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(backToTop).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const button = document
            .querySelector("[data-back-to-top]")
            ?.getBoundingClientRect();
          const footer = document
            .querySelector(".site-footer")
            ?.getBoundingClientRect();
          return (button?.bottom ?? Infinity) <= (footer?.top ?? -Infinity) + 1;
        }),
      )
      .toBe(true);

    await backToTop.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(backToTop).toBeHidden();
    await expect(backToTop).toHaveAttribute("tabindex", "-1");
  }
});

test("Back to top stays hidden when a page does not overflow", async ({
  page,
}) => {
  for (const [route, viewport] of [
    ["/", desktopViewport],
    ["/contact/", phoneViewport],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto(route);
    const backToTop = page.locator("[data-back-to-top]");
    const pageCanScroll = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1,
    );

    expect(pageCanScroll).toBe(false);
    await expect(backToTop).toBeHidden();
    await expect(backToTop).toHaveAttribute("aria-hidden", "true");
    await expect(backToTop).toHaveAttribute("tabindex", "-1");
  }
});

test("Essential content and navigation remain available without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: phoneViewport,
  });
  const page = await context.newPage();

  await page.goto("/");
  await expectImageLoaded(page.locator(".slide.active img"));
  const menu = page.locator(".mobile-menu");
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: "WORK" })).toBeVisible();

  await page.goto("/work/");
  const workImages = page.locator(".gallery-item img");
  const workImageLinks = page.locator("[data-lightbox-trigger]");
  expect(await workImages.count()).toBeGreaterThan(0);
  await expect(workImageLinks).toHaveCount(await workImages.count());
  await expect(workImageLinks.first()).toHaveAttribute("href", /.+/);
  for (const image of await workImages.all()) {
    await expect(image).toBeVisible();
  }

  await context.close();
});

test("The fallback font keeps document content usable", async ({ page }) => {
  await page.route(/https:\/\/(use|p)\.typekit\.net\/.*/, (route) =>
    route.abort(),
  );
  await page.goto("/contact/");
  await expect(page.locator(".container")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeAttached();
  const widths = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth + 1);
});
