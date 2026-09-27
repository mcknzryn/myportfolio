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
        lightboxLargest: largestWidth(
          picture.closest<HTMLElement>("[data-lightbox-trigger]")?.dataset
            .lightboxSrcset ?? "",
        ),
      };
    });
  expect(sources.mobileMedia).toContain("max-width: 800px");
  expect(sources.mobileLargest).toBeGreaterThan(0);
  expect(sources.desktopLargest).toBeGreaterThan(sources.mobileLargest);
  expect(sources.lightboxLargest).toBeGreaterThan(sources.desktopLargest);
});

test("Work photographs expand without captions on desktop and phone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [desktopViewport, phoneViewport]) {
    await page.setViewportSize(viewport);
    await page.goto("/work/");

    const trigger = page.locator("[data-lightbox-trigger]").first();
    const thumbnailAlt = await trigger.locator("img").getAttribute("alt");
    const dialog = page.locator("[data-lightbox]");
    const expandedImage = dialog.locator("[data-lightbox-image]");

    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(expandedImage).not.toHaveAttribute("src");
    await trigger.click();

    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("open", "");
    await expect(expandedImage).toHaveAttribute("alt", thumbnailAlt ?? "");
    await expectImageLoaded(expandedImage);
    await expect(dialog.locator("figcaption")).toHaveCount(0);
    await expect(dialog).not.toContainText(/photo\s+\d+\s+of\s+\d+/i);
    await expect(page.locator("html")).toHaveClass(/lightbox-open/);
    await expect(page.locator("body")).toHaveClass(/lightbox-open/);

    const closeButton = dialog.getByRole("button", {
      name: "Close expanded photograph",
    });
    await expect(closeButton).toContainText("Close");

    const geometry = await expandedImage.evaluate((image) => {
      const bounds = image.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        objectFit: getComputedStyle(image).objectFit,
      };
    });
    expect(geometry.objectFit).toBe("contain");
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);

    await closeButton.click();
    expect(
      await dialog.evaluate((element: HTMLDialogElement) => element.open),
    ).toBe(false);
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).not.toHaveClass(/lightbox-open/);
    await expect(page.locator("body")).not.toHaveClass(/lightbox-open/);
  }
});

test("Work lightbox fades open and remains modal through its closing fade", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/work/");

  const trigger = page.locator("[data-lightbox-trigger]").first();
  const dialog = page.locator("[data-lightbox]");
  const closeButton = dialog.getByRole("button", {
    name: "Close expanded photograph",
  });

  await trigger.click();
  await expect(dialog).toHaveClass(/is-visible/);
  await expect(dialog).toHaveCSS("opacity", "1");
  const openingStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      opacity: style.opacity,
      transitionDuration: Number.parseFloat(style.transitionDuration),
      transitionProperty: style.transitionProperty,
    };
  });
  expect(openingStyle.opacity).toBe("1");
  expect(openingStyle.transitionProperty).toContain("opacity");
  expect(openingStyle.transitionDuration).toBeGreaterThan(0);

  await closeButton.click();
  await expect(dialog).not.toHaveClass(/is-visible/);
  expect(
    await dialog.evaluate((element: HTMLDialogElement) => element.open),
  ).toBe(true);
  await expect(trigger).not.toBeFocused();

  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
});

test("Work lightbox navigation wraps and all close paths restore focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work/");

  const triggers = page.locator("[data-lightbox-trigger]");
  const alts = await triggers
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).alt),
    );
  expect(alts.length).toBeGreaterThan(2);

  const firstTrigger = triggers.first();
  const dialog = page.locator("[data-lightbox]");
  const expandedImage = dialog.locator("[data-lightbox-image]");
  const previousButton = dialog.getByRole("button", {
    name: "Previous photograph",
  });
  const nextButton = dialog.getByRole("button", {
    name: "Next photograph",
  });
  await firstTrigger.click();
  await expectImageLoaded(expandedImage);

  await expect(previousButton).toHaveText("");
  await expect(nextButton).toHaveText("");
  await expect(previousButton).toHaveCSS("cursor", "w-resize");
  await expect(nextButton).toHaveCSS("cursor", "e-resize");
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const image = element.querySelector("[data-lightbox-image]");
        const area = element.querySelector("[data-lightbox-swipe-area]");
        const previous = element.querySelector("[data-lightbox-previous]");
        const next = element.querySelector("[data-lightbox-next]");
        if (!image || !area || !previous || !next) return undefined;

        const imageBounds = image.getBoundingClientRect();
        const areaBounds = area.getBoundingClientRect();
        const previousBounds = previous.getBoundingClientRect();
        const nextBounds = next.getBoundingClientRect();
        const centerElement = document.elementFromPoint(
          imageBounds.left + imageBounds.width / 2,
          imageBounds.top + imageBounds.height / 2,
        );
        return {
          extendsLeft: previousBounds.left < imageBounds.left,
          extendsRight: nextBounds.right > imageBounds.right,
          hasCenterGap: previousBounds.right < nextBounds.left,
          centerIsNeutral: !centerElement?.closest(".lightbox-navigation"),
          spansHeight:
            Math.abs(previousBounds.top - areaBounds.top) <= 1 &&
            Math.abs(previousBounds.bottom - areaBounds.bottom) <= 1 &&
            Math.abs(nextBounds.top - areaBounds.top) <= 1 &&
            Math.abs(nextBounds.bottom - areaBounds.bottom) <= 1,
        };
      }),
    )
    .toEqual({
      extendsLeft: true,
      extendsRight: true,
      hasCenterGap: true,
      centerIsNeutral: true,
      spansHeight: true,
    });

  const clickExtendedSide = async (side: "left" | "right") => {
    const bounds = await expandedImage.boundingBox();
    if (!bounds) throw new Error("Expanded photograph has no visible bounds");
    await page.mouse.click(
      side === "left" ? bounds.x - 16 : bounds.x + bounds.width + 16,
      bounds.y + bounds.height / 2,
    );
  };

  await clickExtendedSide("left");
  await expect(expandedImage).toHaveAttribute("alt", alts.at(-1)!);
  await page.keyboard.press("ArrowRight");
  await expect(expandedImage).toHaveAttribute("alt", alts[0]);
  await clickExtendedSide("right");
  await expect(expandedImage).toHaveAttribute("alt", alts[1]);
  await page.keyboard.press("ArrowLeft");
  await expect(expandedImage).toHaveAttribute("alt", alts[0]);

  const imageBounds = await expandedImage.boundingBox();
  if (!imageBounds)
    throw new Error("Expanded photograph has no visible bounds");
  await page.mouse.click(
    imageBounds.x + imageBounds.width / 2,
    imageBounds.y + imageBounds.height / 2,
  );
  await expect(expandedImage).toHaveAttribute("alt", alts[0]);
  await expect(dialog).toHaveAttribute("open", "");

  await page.keyboard.press("Escape");
  expect(
    await dialog.evaluate((element: HTMLDialogElement) => element.open),
  ).toBe(false);
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(firstTrigger).toBeFocused();

  await firstTrigger.click();
  const swipeArea = dialog.locator("[data-lightbox-swipe-area]");
  const areaBounds = await swipeArea.boundingBox();
  if (!areaBounds) throw new Error("Lightbox canvas has no visible bounds");
  await page.mouse.click(areaBounds.x + areaBounds.width / 2, areaBounds.y + 5);
  expect(
    await dialog.evaluate((element: HTMLDialogElement) => element.open),
  ).toBe(false);
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(firstTrigger).toBeFocused();
});

test("Work lightbox restores a scrolled gallery position", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work/");

  const trigger = page.locator("[data-lightbox-trigger]").nth(8);
  await trigger.scrollIntoViewIfNeeded();
  const startingScrollPosition = await page.evaluate(() => window.scrollY);
  expect(startingScrollPosition).toBeGreaterThan(0);

  await trigger.click();
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  await page
    .locator("[data-lightbox]")
    .getByRole("button", { name: "Close expanded photograph" })
    .click();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(startingScrollPosition);
});

test("Work mobile lightbox fields support taps and swipes but ignore multi-touch", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(phoneViewport);
  await page.goto("/work/");

  const triggers = page.locator("[data-lightbox-trigger]");
  const firstAlt = await triggers.first().locator("img").getAttribute("alt");
  const secondAlt = await triggers.nth(1).locator("img").getAttribute("alt");
  const dialog = page.locator("[data-lightbox]");
  const swipeArea = dialog.locator("[data-lightbox-swipe-area]");
  const expandedImage = dialog.locator("[data-lightbox-image]");
  const previousButton = dialog.getByRole("button", {
    name: "Previous photograph",
  });
  const nextButton = dialog.getByRole("button", {
    name: "Next photograph",
  });

  await triggers.first().click();
  await expectImageLoaded(expandedImage);

  const mobileGeometry = await dialog.evaluate((element) => {
    const image = element.querySelector("[data-lightbox-image]");
    const area = element.querySelector("[data-lightbox-swipe-area]");
    const previous = element.querySelector("[data-lightbox-previous]");
    const next = element.querySelector("[data-lightbox-next]");
    if (!image || !area || !previous || !next) return undefined;

    const imageBounds = image.getBoundingClientRect();
    const areaBounds = area.getBoundingClientRect();
    const previousBounds = previous.getBoundingClientRect();
    const nextBounds = next.getBoundingClientRect();
    const centerElement = document.elementFromPoint(
      imageBounds.left + imageBounds.width / 2,
      imageBounds.top + imageBounds.height / 2,
    );
    return {
      previousWidthRatio: previousBounds.width / areaBounds.width,
      nextWidthRatio: nextBounds.width / areaBounds.width,
      centerGapRatio:
        (nextBounds.left - previousBounds.right) / areaBounds.width,
      centerIsNeutral: !centerElement?.closest(".lightbox-navigation"),
    };
  });
  expect(mobileGeometry?.previousWidthRatio).toBeCloseTo(0.28, 2);
  expect(mobileGeometry?.nextWidthRatio).toBeCloseTo(0.28, 2);
  expect(mobileGeometry?.centerGapRatio).toBeCloseTo(0.44, 2);
  expect(mobileGeometry?.centerIsNeutral).toBe(true);

  const imageBounds = await expandedImage.boundingBox();
  if (!imageBounds)
    throw new Error("Expanded photograph has no visible bounds");
  await page.mouse.click(
    imageBounds.x + imageBounds.width / 2,
    imageBounds.y + imageBounds.height / 2,
  );
  await expect(expandedImage).toHaveAttribute("alt", firstAlt ?? "");

  await nextButton.click();
  await expect(expandedImage).toHaveAttribute("alt", secondAlt ?? "");
  await previousButton.click();
  await expect(expandedImage).toHaveAttribute("alt", firstAlt ?? "");

  await swipeArea.evaluate((area) => {
    const nextControl = area.querySelector("[data-lightbox-next]");
    if (!(nextControl instanceof HTMLButtonElement)) {
      throw new Error("Next lightbox control is missing");
    }
    const dispatchTouchPointer = (type: string, x: number, y: number) =>
      nextControl.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        }),
      );

    dispatchTouchPointer("pointerdown", 300, 300);
    dispatchTouchPointer("pointerup", 200, 305);
    nextControl.dispatchEvent(
      new PointerEvent("click", {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
  });
  await expect(expandedImage).toHaveAttribute("alt", secondAlt ?? "");

  await swipeArea.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 300,
    clientY: 300,
  });
  await swipeArea.dispatchEvent("pointerdown", {
    pointerId: 3,
    pointerType: "touch",
    clientX: 260,
    clientY: 300,
  });
  await swipeArea.dispatchEvent("pointerup", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 180,
    clientY: 300,
  });
  await swipeArea.dispatchEvent("pointerup", {
    pointerId: 3,
    pointerType: "touch",
    clientX: 140,
    clientY: 300,
  });
  await expect(expandedImage).toHaveAttribute("alt", secondAlt ?? "");

  await page.keyboard.press("Escape");
  await expect(triggers.first()).toBeFocused();
  expect(firstAlt).not.toBe(secondAlt);
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
  const lightboxTrigger = page.locator("[data-lightbox-trigger]").first();
  await expect(lightboxTrigger).toHaveAttribute("aria-disabled", "true");
  await expect(lightboxTrigger).toHaveAttribute("tabindex", "-1");
  await lightboxTrigger.evaluate((trigger: HTMLAnchorElement) =>
    trigger.click(),
  );
  await expect(page.locator("[data-lightbox]")).not.toHaveAttribute("open", "");
  await expectImmediateReveal(page);
});
