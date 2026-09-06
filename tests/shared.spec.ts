import { expect, test } from "@playwright/test";
import { expectImageLoaded, phoneViewport } from "./test-helpers";

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
  expect(await workImages.count()).toBeGreaterThan(0);
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
