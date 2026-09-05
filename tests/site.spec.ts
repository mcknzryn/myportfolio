// These Playwright browser tests exercise the running site as a visitor would.
// Playwright supplies `test`, `expect`, and callback fixtures such as `page` and
// `browser`; route names, geometry objects, and scenario names are project-made.
// CODE_GUIDE.md explains how these differ from the smaller Vitest unit tests.

import { expect, test } from "@playwright/test";

// `documentRoutes` is our shared name for pages that use the scrolling document
// layout. `as const` preserves the exact route strings as a readonly tuple.
const documentRoutes = ["/work/", "/about/", "/contact/"] as const;
const routeTitles = [
  ["/", "McKenzie Ryan"],
  ["/work/", "Work | McKenzie Ryan"],
  ["/about/", "About | McKenzie Ryan"],
  ["/contact/", "Contact | McKenzie Ryan"],
] as const;

// beforeEach establishes the same reduced-motion condition before every case,
// removing animation timing as a source of unrelated test failures.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("routes expose their canonical browser titles", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Browser titles are viewport-independent",
  );

  for (const [route, title] of routeTitles) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
  }
});

test("About and Contact expose their editorial headings", async ({ page }) => {
  await page.goto("/about/");
  const aboutHeading = page.getByRole("heading", {
    level: 1,
    name: "bio & cv",
    exact: true,
  });
  await expect(aboutHeading).toHaveCount(1);
  await expect(aboutHeading).toBeVisible();

  await page.goto("/contact/");
  const contactHeading = page.getByRole("heading", {
    level: 1,
    name: "get in touch...",
    exact: true,
  });
  await expect(contactHeading).toHaveCount(1);
  await expect(contactHeading).toBeVisible();
});

// `page` is Playwright's prepared browser-tab fixture. evaluate() temporarily
// crosses into that page's browser context to read layout values from the DOM.
test("Home is contained by its viewport shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".slide.active img")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const rectangle = document
        .querySelector(selector)
        ?.getBoundingClientRect();
      return rectangle
        ? {
            top: rectangle.top,
            bottom: rectangle.bottom,
            height: rectangle.height,
          }
        : undefined;
    };
    return {
      shell: bounds(".site-shell"),
      header: bounds(".site-header"),
      image: bounds(".slide.active img"),
      footer: bounds(".site-footer"),
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    };
  });

  expect(geometry.shell?.height).toBeCloseTo(geometry.viewportHeight, 0);
  expect(geometry.documentHeight).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
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
});

test("slideshow controls and keyboard navigation change the active photo", async ({
  page,
}) => {
  await page.goto("/");
  const stage = page.locator("[data-slideshow]");
  await expect(stage).toHaveAttribute("data-ready", "true");
  const initialAlt = await page
    .locator(".slide.active img")
    .getAttribute("alt");

  await page.getByRole("button", { name: "Next image" }).click();
  await expect(page.locator(".slide.active img")).not.toHaveAttribute(
    "alt",
    initialAlt ?? "",
  );

  await stage.focus();
  const secondAlt = await page.locator(".slide.active img").getAttribute("alt");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".slide.active img")).not.toHaveAttribute(
    "alt",
    secondAlt ?? "",
  );
});

// The loop generates the same header/footer contract test for every document
// route while still giving each result a descriptive test name.
for (const route of documentRoutes) {
  test(`${route} clears the fixed header and reaches its footer`, async ({
    page,
  }) => {
    await page.goto(route);
    const firstContent = route === "/work/" ? ".work-page" : ".container";
    const geometry = await page.evaluate((selector) => {
      const header = document
        .querySelector(".site-header")
        ?.getBoundingClientRect();
      const content = document.querySelector(selector)?.getBoundingClientRect();
      return {
        headerPosition: getComputedStyle(
          document.querySelector(".site-header")!,
        ).position,
        headerBottom: header?.bottom,
        contentTop: content?.top,
      };
    }, firstContent);

    expect(geometry.headerPosition).toBe("fixed");
    expect(geometry.contentTop).toBeGreaterThanOrEqual(
      (geometry.headerBottom ?? 0) - 1,
    );

    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await expect(page.locator(".site-footer")).toBeInViewport();
  });
}

test("Contact centers within the desktop main region", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.endsWith("-desktop"),
    "Desktop-specific layout",
  );
  await page.goto("/contact/");

  const geometry = await page.evaluate(() => {
    const header = document
      .querySelector(".site-header")!
      .getBoundingClientRect();
    const contentElement = document.querySelector(".container")!;
    const content = contentElement.getBoundingClientRect();
    const footer = document
      .querySelector(".site-footer")!
      .getBoundingClientRect();
    const main = document.querySelector(".site-main")!;

    return {
      availableCenter: (header.bottom + footer.top) / 2,
      contentCenter: (content.top + content.bottom) / 2,
      documentHeight: document.documentElement.scrollHeight,
      footerBottom: footer.bottom,
      mainClass: main.className,
      textAlign: getComputedStyle(contentElement).textAlign,
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.mainClass).toContain("content-layout-centered-desktop");
  expect(geometry.contentCenter).toBeCloseTo(geometry.availableCenter, 0);
  expect(geometry.textAlign).toBe("center");
  expect(geometry.documentHeight).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  );
  expect(geometry.footerBottom).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  );
});

test("Contact uses default document flow on mobile", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("phone"), "Phone-specific layout");
  await page.goto("/contact/");

  const textAlign = await page
    .locator(".container")
    .evaluate((element) => getComputedStyle(element).textAlign);

  expect(textAlign).not.toBe("center");
});

test("Contact permits emergency document scrolling", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-short-landscape",
    "Representative short viewport",
  );
  await page.goto("/contact/");
  await page.addStyleTag({ content: ".container { min-height: 50rem; }" });

  const heights = await page.evaluate(() => ({
    document: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));

  expect(heights.document).toBeGreaterThan(heights.viewport);
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(page.locator(".site-footer")).toBeInViewport();
});

test("mobile navigation opens accessibly and closes with Escape", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("phone"),
    "Phone-specific interaction",
  );
  await page.goto("/");
  const menu = page.locator(".mobile-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await expect(menu.getByRole("link", { name: "WORK" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
});

test("images load successfully", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The geometry suite loads representative images in every browser",
  );
  await page.goto("/work/");
  const firstImageInEachColumn = page.locator(
    ".gallery-column > :first-child img",
  );
  await expect(firstImageInEachColumn).toHaveCount(3);
  for (const image of await firstImageInEachColumn.all()) {
    await expect(image).toBeVisible();
    await expect
      .poll(
        () =>
          image.evaluate((element: HTMLImageElement) =>
            Boolean(element.complete && element.naturalWidth),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
  }
});

test("Arrange mode uses canonical photo IDs in development", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Desktop development tool",
  );
  await page.goto("/work/?arrange=1");
  await expect(
    page.getByText("Arrange mode — drag images to reorder"),
  ).toBeVisible();
  await expect(page.locator(".gallery-item[data-image-id]")).toHaveCount(33);
});

test("content and mobile navigation work without JavaScript", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "webkit-phone",
    "No-JavaScript mobile check",
  );

  // Unlike the usual `page` fixture, this case creates its own browser context
  // with JavaScript disabled to verify the site's progressive fallbacks.
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".slide.active img")).toBeVisible();
  await expect(page.getByRole("link", { name: /McKenzie Ryan/ })).toBeVisible();
  const menu = page.locator(".mobile-menu");
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: "WORK" })).toBeVisible();
  await context.close();
});

test("font failure does not break document geometry", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Representative fallback-font check",
  );
  await page.route(/https:\/\/(use|p)\.typekit\.net\/.*/, (route) =>
    route.abort(),
  );
  await page.goto("/contact/");
  await expect(page.locator(".container")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeAttached();
});

test("reviewed Chromium viewport snapshots", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Reviewed in Chromium desktop",
  );
  await page.route(/https:\/\/(use|p)\.typekit\.net\/.*/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page).toHaveScreenshot("home.png");
  await page.goto("/work/");
  await expect
    .poll(
      () =>
        page
          .locator(".gallery-column > :first-child img")
          .evaluateAll((images) =>
            (images as HTMLImageElement[]).every(
              (image) => image.complete && image.naturalWidth > 0,
            ),
          ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await expect(page).toHaveScreenshot("work.png");
});
