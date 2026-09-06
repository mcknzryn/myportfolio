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
const representativeWorkImageSelector = ["29", "99", "02"]
  .map((id) => `.gallery-item[data-image-id="${id}"] img`)
  .join(", ");

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
  const representativeImages = page.locator(representativeWorkImageSelector);
  await expect(representativeImages).toHaveCount(3);
  for (const image of await representativeImages.all()) {
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

test("Work gallery uses viewport-specific opening reveals before independent reveals", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "chromium-tablet", "chromium-phone"].includes(
      testInfo.project.name,
    ),
    "Representative desktop, tablet, and phone reveal timing check",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const revealEvents: Array<{ id: string; time: number; delay: number }> = [];
    Object.assign(window, { __galleryRevealEvents: revealEvents });

    document.addEventListener("animationstart", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const id = image.closest<HTMLElement>(".gallery-item")?.dataset.imageId;
      if (!id || revealEvents.some((revealEvent) => revealEvent.id === id)) {
        return;
      }

      revealEvents.push({
        id,
        time: performance.now(),
        delay: Number.parseFloat(getComputedStyle(image).animationDelay) * 1000,
      });
    });
  });

  await page.goto("/work/");
  const initialViewportGeometry = await page.evaluate(() => {
    const columns = [
      ...document.querySelectorAll<HTMLElement>(".gallery-column"),
    ]
      .map((column) =>
        [...column.querySelectorAll<HTMLElement>(".gallery-item")].map(
          (item) => {
            const bounds = item.getBoundingClientRect();
            return {
              id: item.dataset.imageId ?? "",
              top: bounds.top,
              bottom: bounds.bottom,
              left: bounds.left,
              right: bounds.right,
            };
          },
        ),
      )
      .map((column) =>
        column.filter(({ top, bottom, left, right }) => {
          return (
            top < window.innerHeight &&
            bottom > 0 &&
            left < window.innerWidth &&
            right > 0
          );
        }),
      );
    return columns;
  });
  const initialViewportColumns = initialViewportGeometry.map((column) =>
    column.map(({ id }) => id),
  );
  const initialViewportIds =
    testInfo.project.name === "chromium-phone"
      ? initialViewportGeometry
          .flat()
          .sort((first, second) => {
            const topDifference = first.top - second.top;
            return Math.abs(topDifference) <= 1
              ? first.left - second.left
              : topDifference;
          })
          .map(({ id }) => id)
      : initialViewportColumns.flat();

  if (testInfo.project.name === "chromium-desktop") {
    expect(initialViewportIds).toEqual(["29", "16", "99", "22", "02", "28"]);
  }

  await expect
    .poll(() =>
      page.evaluate((ids) => {
        const events = (
          window as typeof window & {
            __galleryRevealEvents: Array<{
              id: string;
              time: number;
              delay: number;
            }>;
          }
        ).__galleryRevealEvents;
        return events.filter((event) => ids.includes(event.id));
      }, initialViewportIds),
    )
    .toHaveLength(initialViewportIds.length);

  const initialViewportEvents = await page.evaluate((ids) => {
    const events = (
      window as typeof window & {
        __galleryRevealEvents: Array<{
          id: string;
          time: number;
          delay: number;
        }>;
      }
    ).__galleryRevealEvents;
    return events.filter((event) => ids.includes(event.id));
  }, initialViewportIds);
  expect(initialViewportEvents.map((event) => event.id)).toEqual(
    initialViewportIds,
  );
  const expectedInterval = testInfo.project.name === "chromium-phone" ? 35 : 70;
  for (const [index, event] of initialViewportEvents.entries()) {
    expect(event.delay).toBe(index * expectedInterval);
    if (index === 0) continue;
    const startInterval = event.time - initialViewportEvents[index - 1].time;
    expect(startInterval).toBeGreaterThanOrEqual(expectedInterval - 25);
    expect(startInterval).toBeLessThanOrEqual(expectedInterval + 40);
  }

  if (testInfo.project.name !== "chromium-phone") {
    for (let index = 1; index < initialViewportColumns.length; index += 1) {
      const previousColumn = initialViewportColumns[index - 1];
      const currentColumn = initialViewportColumns[index];
      if (!previousColumn.length || !currentColumn.length) continue;

      const previousFinalEvent = initialViewportEvents.find(
        (event) => event.id === previousColumn.at(-1),
      )!;
      const currentFirstEvent = initialViewportEvents.find(
        (event) => event.id === currentColumn[0],
      )!;
      expect(currentFirstEvent.time - previousFinalEvent.time).toBeLessThan(
        900,
      );
    }
  }

  if (testInfo.project.name === "chromium-phone") return;

  const offscreenId = await page.locator(".gallery-item").evaluateAll(
    (items) =>
      items
        .map((item) => ({
          id: (item as HTMLElement).dataset.imageId ?? "",
          top: item.getBoundingClientRect().top,
        }))
        .sort((first, second) => second.top - first.top)[0].id,
  );
  const offscreenImage = page.locator(
    `.gallery-item[data-image-id="${offscreenId}"] img`,
  );
  await expect(offscreenImage).not.toHaveClass(/is-revealed/);
  await offscreenImage.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate((imageId) => {
        return (
          window as typeof window & {
            __galleryRevealEvents: Array<{
              id: string;
              time: number;
              delay: number;
            }>;
          }
        ).__galleryRevealEvents.find((event) => event.id === imageId);
      }, offscreenId),
    )
    .toEqual(expect.objectContaining({ id: offscreenId, delay: 0 }));
});

test("Work gallery visibly animates mobile reveals on cold and cached loads", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-phone",
    "Representative mobile animation check",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const animationEvents: Array<{
      id: string;
      time: number;
      delay: number;
      duration: number;
      easing: string;
      opacity: number;
      intermediateOpacity: number | null;
    }> = [];
    Object.assign(window, { __galleryAnimationEvents: animationEvents });

    document.addEventListener("animationstart", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const id = image.closest<HTMLElement>(".gallery-item")?.dataset.imageId;
      const animation = image.getAnimations()[0];
      if (!id || !animation) return;

      const animationEvent: (typeof animationEvents)[number] = {
        id,
        time: performance.now(),
        delay: Number.parseFloat(getComputedStyle(image).animationDelay) * 1000,
        duration: Number(animation.effect?.getTiming().duration),
        easing: getComputedStyle(image).animationTimingFunction,
        opacity: Number.parseFloat(getComputedStyle(image).opacity),
        intermediateOpacity: null,
      };
      animationEvents.push(animationEvent);
      window.setTimeout(() => {
        animationEvent.intermediateOpacity = Number.parseFloat(
          getComputedStyle(image).opacity,
        );
      }, 180);
    });
  });

  const getInitialViewportIds = () =>
    page.locator(".gallery-item img").evaluateAll((images) =>
      images
        .filter((image) => {
          const bounds = image.getBoundingClientRect();
          return (
            bounds.top < window.innerHeight &&
            bounds.bottom > 0 &&
            bounds.left < window.innerWidth &&
            bounds.right > 0
          );
        })
        .map((image) => ({
          id:
            image.closest<HTMLElement>(".gallery-item")?.dataset.imageId ?? "",
          bounds: image.getBoundingClientRect(),
        }))
        .sort((first, second) => {
          const topDifference = first.bounds.top - second.bounds.top;
          return Math.abs(topDifference) <= 1
            ? first.bounds.left - second.bounds.left
            : topDifference;
        })
        .map(({ id }) => id),
    );
  const getAnimationEvents = (ids: string[]) =>
    page.evaluate((initialIds) => {
      const events = (
        window as typeof window & {
          __galleryAnimationEvents: Array<{
            id: string;
            time: number;
            delay: number;
            duration: number;
            easing: string;
            opacity: number;
            intermediateOpacity: number | null;
          }>;
        }
      ).__galleryAnimationEvents;
      return events.filter((event) => initialIds.includes(event.id));
    }, ids);
  const expectVisibleOpeningAnimation = async (ids: string[]) => {
    await expect.poll(() => getAnimationEvents(ids)).toHaveLength(ids.length);
    await expect
      .poll(async () =>
        (await getAnimationEvents(ids)).every(
          (event) => event.intermediateOpacity !== null,
        ),
      )
      .toBe(true);
    const events = await getAnimationEvents(ids);
    expect(events.map((event) => event.id)).toEqual(ids);
    events.forEach((event, index) => {
      expect(event.delay).toBe(index * 35);
      expect(event.duration).toBe(900);
      // Chromium serializes cubic-bezier(0.42, 0, 0.58, 1) as its equivalent
      // CSS keyword.
      expect(event.easing).toBe("ease-in-out");
      expect(event.opacity).toBeLessThan(0.15);
      expect(event.intermediateOpacity!).toBeGreaterThan(0);
      expect(event.intermediateOpacity!).toBeLessThan(0.2);

      if (index > 0) {
        const startInterval = event.time - events[index - 1].time;
        expect(startInterval).toBeGreaterThanOrEqual(10);
        expect(startInterval).toBeLessThanOrEqual(75);
      }
    });
  };

  await page.goto("/work/");
  await expectVisibleOpeningAnimation(await getInitialViewportIds());

  await page.reload();
  await expectVisibleOpeningAnimation(await getInitialViewportIds());

  await page.setViewportSize({ width: 390, height: 300 });
  await page.reload();
  const offscreenId = await page.locator(".gallery-item").evaluateAll(
    (items) =>
      items
        .map((item) => ({
          id: (item as HTMLElement).dataset.imageId ?? "",
          top: item.getBoundingClientRect().top,
        }))
        .sort((first, second) => second.top - first.top)[0].id,
  );
  const offscreenImage = page.locator(
    `.gallery-item[data-image-id="${offscreenId}"] img`,
  );
  await expect(offscreenImage).not.toHaveClass(/is-revealed/);
  await offscreenImage.scrollIntoViewIfNeeded();
  await expect
    .poll(() => getAnimationEvents([offscreenId]))
    .toEqual([
      expect.objectContaining({ id: offscreenId, delay: 0, duration: 900 }),
    ]);
});

test("Work gallery emits separate mobile and high-quality desktop sources", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Generated image markup is viewport-independent",
  );
  await page.goto("/work/");

  const representativePicture = page.locator(
    '.gallery-item[data-image-id="29"] picture',
  );
  await expect(representativePicture.locator("source")).toHaveAttribute(
    "media",
    "(max-width: 800px)",
  );
  await expect(representativePicture.locator("source")).toHaveAttribute(
    "srcset",
    /800w/,
  );
  await expect(representativePicture.locator("img")).toHaveAttribute(
    "srcset",
    /1600w/,
  );
  await expect(representativePicture.locator("img")).toHaveAttribute(
    "width",
    "1600",
  );
});

test("Work gallery reveals immediately for reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Representative reduced-motion check",
  );
  await page.goto("/work/");
  await expect(page.locator(".gallery-item img.is-revealed")).toHaveCount(33);
  await expect(
    page.locator(".gallery-item img.is-reveal-animated"),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".gallery-item img")
      .evaluateAll((images) =>
        images.reduce(
          (count, image) => count + image.getAnimations().length,
          0,
        ),
      ),
  ).toBe(0);
  expect(
    await page
      .locator(".gallery-item img")
      .evaluateAll((images) =>
        images.every(
          (image) => !image.style.getPropertyValue("--gallery-reveal-delay"),
        ),
      ),
  ).toBe(true);
});

test("Work gallery reveals immediately without IntersectionObserver", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Representative unsupported-observer fallback",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    delete (window as Partial<typeof window>).IntersectionObserver;
  });
  await page.goto("/work/");
  await expect(page.locator(".gallery-item img.is-revealed")).toHaveCount(33);
  await expect(
    page.locator(".gallery-item img.is-reveal-animated"),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".gallery-item img")
      .evaluateAll((images) =>
        images.every(
          (image) => !image.style.getPropertyValue("--gallery-reveal-delay"),
        ),
      ),
  ).toBe(true);
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
  await expect(page.locator(".gallery-item img.is-revealed")).toHaveCount(33);
  await expect(
    page.locator(".gallery-item img.is-reveal-animated"),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".gallery-item img")
      .evaluateAll((images) =>
        images.every(
          (image) => !image.style.getPropertyValue("--gallery-reveal-delay"),
        ),
      ),
  ).toBe(true);
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
  await page.goto("/work/");
  const representativeImages = page.locator(representativeWorkImageSelector);
  await expect(representativeImages).toHaveCount(3);
  for (const image of await representativeImages.all()) {
    await expect(image).toBeVisible();
  }
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
          .locator(representativeWorkImageSelector)
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
