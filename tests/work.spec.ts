import { expect, test, type Page } from "@playwright/test";
import {
  desktopViewport,
  expectDocumentPageUsable,
  expectImageLoaded,
  phoneViewport,
  tabletViewport,
} from "./test-helpers";

type RevealEvent = {
  id: string;
  time: number;
  delay: number;
  duration: number;
  opacity: number;
  intermediateOpacity: number | null;
};

async function recordGalleryAnimations(page: Page) {
  await page.addInitScript(() => {
    const events: RevealEvent[] = [];
    Object.assign(window, { __galleryRevealEvents: events });

    document.addEventListener("animationstart", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const id = image.closest<HTMLElement>(".gallery-item")?.dataset.imageId;
      const animation = image.getAnimations()[0];
      if (!id || !animation || events.some((entry) => entry.id === id)) return;

      const entry: RevealEvent = {
        id,
        time: performance.now(),
        delay: Number.parseFloat(getComputedStyle(image).animationDelay) * 1000,
        duration: Number(animation.effect?.getTiming().duration),
        opacity: Number.parseFloat(getComputedStyle(image).opacity),
        intermediateOpacity: null,
      };
      events.push(entry);
      window.setTimeout(() => {
        entry.intermediateOpacity = Number.parseFloat(
          getComputedStyle(image).opacity,
        );
      }, 180);
    });
  });
}

async function initialViewportGeometry(page: Page, mobile: boolean) {
  return page.evaluate((useVisualOrder) => {
    const columns = [
      ...document.querySelectorAll<HTMLElement>(".gallery-column"),
    ].map((column) =>
      [...column.querySelectorAll<HTMLElement>(".gallery-item")]
        .map((item) => {
          const bounds = item.getBoundingClientRect();
          return {
            id: item.dataset.imageId ?? "",
            top: bounds.top,
            bottom: bounds.bottom,
            left: bounds.left,
            right: bounds.right,
          };
        })
        .filter(
          ({ top, bottom, left, right }) =>
            top < window.innerHeight &&
            bottom > 0 &&
            left < window.innerWidth &&
            right > 0,
        ),
    );
    const order = useVisualOrder
      ? columns
          .flat()
          .sort((first, second) => {
            const topDifference = first.top - second.top;
            return Math.abs(topDifference) <= 1
              ? first.left - second.left
              : topDifference;
          })
          .map(({ id }) => id)
      : columns.flat().map(({ id }) => id);
    return {
      columns: columns.map((column) => column.map(({ id }) => id)),
      order,
    };
  }, mobile);
}

async function revealEvents(page: Page, ids: string[]) {
  return page.evaluate((initialIds) => {
    const events = (
      window as typeof window & { __galleryRevealEvents: RevealEvent[] }
    ).__galleryRevealEvents;
    return events.filter((event) => initialIds.includes(event.id));
  }, ids);
}

async function expectOpeningReveal(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto("/work/");
  const mobile = viewport.width <= 800;
  const geometry = await initialViewportGeometry(page, mobile);

  expect(geometry.order.length).toBeGreaterThan(1);
  await expect
    .poll(() => revealEvents(page, geometry.order))
    .toHaveLength(geometry.order.length);
  await expect
    .poll(async () =>
      (await revealEvents(page, geometry.order)).every(
        (event) => event.intermediateOpacity !== null,
      ),
    )
    .toBe(true);

  const events = await revealEvents(page, geometry.order);
  expect(events.map(({ id }) => id)).toEqual(geometry.order);
  expect(Math.abs(events[0].delay)).toBeLessThanOrEqual(10);

  for (const [index, event] of events.entries()) {
    expect(event.duration).toBeGreaterThan(300);
    expect(event.duration).toBeLessThanOrEqual(2_000);
    expect(event.opacity).toBeLessThan(0.2);
    expect(event.intermediateOpacity).toBeGreaterThan(0);
    expect(event.intermediateOpacity).toBeLessThan(1);

    if (index === 0) continue;
    const scheduledGap = event.delay - events[index - 1].delay;
    expect(scheduledGap).toBeGreaterThan(0);
    expect(scheduledGap).toBeLessThanOrEqual(mobile ? 150 : 250);
    expect(event.time).toBeGreaterThanOrEqual(events[index - 1].time);
  }

  if (!mobile) {
    for (let index = 1; index < geometry.columns.length; index += 1) {
      const previousColumn = geometry.columns[index - 1];
      const currentColumn = geometry.columns[index];
      if (!previousColumn.length || !currentColumn.length) continue;
      const previousFinal = events.find(
        ({ id }) => id === previousColumn.at(-1),
      )!;
      const currentFirst = events.find(({ id }) => id === currentColumn[0])!;
      expect(currentFirst.delay - previousFinal.delay).toBeLessThan(
        previousFinal.duration,
      );
    }
  }

  return geometry.order;
}

async function expectImmediateReveal(page: Page) {
  const images = page.locator(".gallery-item img");
  const total = await images.count();
  expect(total).toBeGreaterThan(0);
  await expect(page.locator(".gallery-item img.is-revealed")).toHaveCount(
    total,
  );
  await expect(
    page.locator(".gallery-item img.is-reveal-animated"),
  ).toHaveCount(0);
  expect(
    await images.evaluateAll((elements) =>
      elements.every(
        (image) =>
          image.getAnimations().length === 0 &&
          !image.style.getPropertyValue("--gallery-reveal-delay"),
      ),
    ),
  ).toBe(true);
}

test("Work loads responsive portfolio images", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work/");
  const images = page.locator(".gallery-item img");
  expect(await images.count()).toBeGreaterThan(0);

  for (const image of await images.evaluateAll((elements) =>
    elements
      .slice(0, 3)
      .map(
        (element) =>
          element.closest<HTMLElement>(".gallery-item")?.dataset.imageId,
      ),
  )) {
    await expectImageLoaded(
      page.locator(`.gallery-item[data-image-id="${image}"] img`),
    );
  }

  const sources = await page
    .locator(".gallery-item picture")
    .first()
    .evaluate((picture) => {
      const source = picture.querySelector("source")!;
      const image = picture.querySelector("img")!;
      const largestWidth = (srcset: string) =>
        Math.max(
          ...srcset.split(",").map((candidate) => {
            const match = candidate.trim().match(/\s(\d+)w$/);
            return Number(match?.[1] ?? 0);
          }),
        );
      return {
        mobileMedia: source.media,
        mobileLargest: largestWidth(source.srcset),
        desktopLargest: largestWidth(image.srcset),
      };
    });
  expect(sources.mobileMedia).toContain("max-width: 800px");
  expect(sources.mobileLargest).toBeGreaterThan(0);
  expect(sources.desktopLargest).toBeGreaterThan(sources.mobileLargest);
});

test("Work remains usable on desktop and phone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [desktopViewport, phoneViewport]) {
    await page.setViewportSize(viewport);
    await expectDocumentPageUsable(page, "/work/", ".work-page");
  }
});

test("Work opening reveals are ordered, staggered, and overlapping", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await recordGalleryAnimations(page);
  await expectOpeningReveal(page, desktopViewport);
  await expectOpeningReveal(page, tabletViewport);
});

test("Work mobile reveal stays soft after a warm-cache reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await recordGalleryAnimations(page);
  await expectOpeningReveal(page, phoneViewport);
  await page.reload();
  await expectOpeningReveal(page, phoneViewport);
});

test("Work reveals an initially offscreen image after scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await recordGalleryAnimations(page);
  await page.setViewportSize(desktopViewport);
  await page.goto("/work/");
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
    .poll(() => revealEvents(page, [offscreenId]))
    .toEqual([expect.objectContaining({ id: offscreenId, delay: 0 })]);
});

test("Work reveals immediately for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work/");
  await expectImmediateReveal(page);
});

test("Work reveals immediately without IntersectionObserver", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    delete (window as Partial<typeof window>).IntersectionObserver;
  });
  await page.goto("/work/");
  await expectImmediateReveal(page);
});

test("Work Arrange mode uses the gallery's current photographs", async ({
  page,
}) => {
  await page.goto("/work/?arrange=1");
  await expect(
    page.getByText("Arrange mode — drag images to reorder"),
  ).toBeVisible();
  const items = page.locator(".gallery-item[data-image-id]");
  expect(await items.count()).toBeGreaterThan(0);
  await expectImmediateReveal(page);
});
