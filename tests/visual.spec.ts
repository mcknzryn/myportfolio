import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(/https:\/\/(use|p)\.typekit\.net\/.*/, (route) =>
    route.abort(),
  );
});

test("reviewed Home and Work compositions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".slide.active img")).toBeVisible();
  await expect(page).toHaveScreenshot("home.png");

  await page.goto("/work/");
  await expect
    .poll(
      () =>
        page
          .locator(".gallery-item img")
          .evaluateAll((images) =>
            (images as HTMLImageElement[])
              .filter(
                (image) => image.getBoundingClientRect().top < innerHeight,
              )
              .every((image) => image.complete && image.naturalWidth > 0),
          ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await expect(page).toHaveScreenshot("work.png");
});
