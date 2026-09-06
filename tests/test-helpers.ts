import { expect, type Locator, type Page } from "@playwright/test";

export const desktopViewport = { width: 1440, height: 900 };
export const tabletViewport = { width: 820, height: 1180 };
export const phoneViewport = { width: 390, height: 844 };
export const shortViewport = { width: 844, height: 390 };

export async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(
      () =>
        image.evaluate((element: HTMLImageElement) =>
          Boolean(element.complete && element.naturalWidth > 0),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

export async function expectDocumentPageUsable(
  page: Page,
  route: string,
  contentSelector: string,
) {
  await page.goto(route);
  await expect(page.locator(contentSelector)).toBeVisible();

  const geometry = await page.evaluate((selector) => {
    const header = document
      .querySelector(".site-header")
      ?.getBoundingClientRect();
    const content = document.querySelector(selector)?.getBoundingClientRect();
    return {
      headerBottom: header?.bottom ?? 0,
      contentTop: content?.top ?? 0,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  }, contentSelector);

  expect(geometry.contentTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(
    geometry.viewportWidth + 1,
  );

  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(page.locator(".site-footer")).toBeInViewport();
}
