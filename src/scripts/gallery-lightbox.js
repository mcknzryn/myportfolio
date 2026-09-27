// This browser script progressively enhances the Work gallery's large-image
// links into one accessible, full-screen dialog. Without JavaScript or native
// dialog support, each link still opens its optimized photograph directly.
const lightboxGallery = document.querySelector(".gallery");
const lightbox = document.querySelector("[data-lightbox]");

if (
  lightboxGallery &&
  typeof HTMLDialogElement !== "undefined" &&
  lightbox instanceof HTMLDialogElement
) {
  const triggers = [
    ...lightboxGallery.querySelectorAll("[data-lightbox-trigger]"),
  ];
  const expandedImage = lightbox.querySelector("[data-lightbox-image]");
  const surface = lightbox.querySelector("[data-lightbox-surface]");
  const swipeArea = lightbox.querySelector("[data-lightbox-swipe-area]");
  const closeButton = lightbox.querySelector("[data-lightbox-close]");
  const previousButton = lightbox.querySelector("[data-lightbox-previous]");
  const nextButton = lightbox.querySelector("[data-lightbox-next]");
  const arrangeMode =
    new URLSearchParams(window.location.search).get("arrange") === "1";

  // Arrange mode owns photograph pointer input. Prevent its fallback links
  // from navigating while leaving the figures available to Muuri dragging.
  if (arrangeMode) {
    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-disabled", "true");
      trigger.setAttribute("tabindex", "-1");
      trigger.addEventListener("click", (event) => event.preventDefault());
    });
  } else if (
    triggers.length &&
    expandedImage instanceof HTMLImageElement &&
    surface instanceof HTMLElement &&
    swipeArea instanceof HTMLElement &&
    closeButton instanceof HTMLButtonElement &&
    previousButton instanceof HTMLButtonElement &&
    nextButton instanceof HTMLButtonElement &&
    typeof lightbox.showModal === "function"
  ) {
    let currentIndex = 0;
    let activeTrigger;
    let lockedScrollPosition = 0;
    let imageRequest = 0;
    let swipeStart;
    let openingFrame;
    let navigationFrame;
    let touchControlClickReset;
    let closing = false;
    let suppressTouchControlClick = false;
    const activeTouchPointers = new Set();
    const preloadedImages = new Map();
    const desktopQuery = window.matchMedia("(min-width: 801px)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const desktopControlMargin = 32;
    const desktopCenterGap = 160;
    const closeTransitionFallback = 800;

    const browserIsZoomed = () =>
      Boolean(window.visualViewport && window.visualViewport.scale > 1.01);

    const updateBrowserZoomState = () => {
      surface.classList.toggle("is-browser-zoomed", browserIsZoomed());
    };

    // Match Home's navigation geometry: desktop fields extend slightly beyond
    // the photograph while preserving a neutral center. Mobile CSS supplies
    // fixed side fields, so desktop-only properties are removed there.
    const updateNavigationFields = () => {
      navigationFrame = undefined;
      if (!lightbox.open) return;

      if (!desktopQuery.matches) {
        swipeArea.style.removeProperty("--lightbox-navigation-width");
        swipeArea.style.removeProperty("--lightbox-navigation-left");
        swipeArea.style.removeProperty("--lightbox-navigation-right");
        return;
      }

      const areaBounds = swipeArea.getBoundingClientRect();
      const imageBounds = expandedImage.getBoundingClientRect();
      if (imageBounds.width <= 0 || imageBounds.height <= 0) return;

      const imageLeft = Math.max(
        0,
        imageBounds.left - areaBounds.left - desktopControlMargin,
      );
      const imageRight = Math.max(
        0,
        areaBounds.right - imageBounds.right - desktopControlMargin,
      );
      const controlWidth = Math.max(
        0,
        Math.min(
          imageBounds.width / 2 + desktopControlMargin - desktopCenterGap / 2,
          areaBounds.width / 2,
        ),
      );

      swipeArea.style.setProperty(
        "--lightbox-navigation-width",
        `${controlWidth}px`,
      );
      swipeArea.style.setProperty(
        "--lightbox-navigation-left",
        `${imageLeft}px`,
      );
      swipeArea.style.setProperty(
        "--lightbox-navigation-right",
        `${imageRight}px`,
      );
    };

    const scheduleNavigationFieldUpdate = () => {
      if (navigationFrame === undefined) {
        navigationFrame = window.requestAnimationFrame(updateNavigationFields);
      }
    };

    const normalizedIndex = (index) =>
      (index + triggers.length) % triggers.length;

    const imageData = (trigger) => {
      const thumbnail = trigger.querySelector("img");
      return {
        src: trigger.dataset.lightboxSrc || trigger.href,
        srcset: trigger.dataset.lightboxSrcset || "",
        width: Number.parseInt(trigger.dataset.lightboxWidth || "", 10),
        height: Number.parseInt(trigger.dataset.lightboxHeight || "", 10),
        alt: thumbnail?.alt || "",
      };
    };

    const preload = (trigger) => {
      const data = imageData(trigger);
      if (preloadedImages.has(data.src)) return;

      const image = new Image();
      image.sizes = "100vw";
      image.srcset = data.srcset;
      image.src = data.src;
      preloadedImages.set(data.src, image);
    };

    const showPhotograph = (index) => {
      currentIndex = normalizedIndex(index);
      const trigger = triggers[currentIndex];
      const data = imageData(trigger);
      const request = ++imageRequest;

      expandedImage.classList.add("is-loading");
      expandedImage.alt = data.alt;
      if (Number.isFinite(data.width)) expandedImage.width = data.width;
      if (Number.isFinite(data.height)) expandedImage.height = data.height;
      expandedImage.sizes = "100vw";
      expandedImage.srcset = data.srcset;
      expandedImage.src = data.src;
      scheduleNavigationFieldUpdate();

      const revealLoadedImage = () => {
        if (request === imageRequest) {
          expandedImage.classList.remove("is-loading");
          scheduleNavigationFieldUpdate();
        }
      };
      expandedImage.addEventListener("load", revealLoadedImage, { once: true });
      expandedImage.addEventListener("error", revealLoadedImage, {
        once: true,
      });
      if (expandedImage.complete) revealLoadedImage();

      preload(triggers[normalizedIndex(currentIndex - 1)]);
      preload(triggers[normalizedIndex(currentIndex + 1)]);
    };

    const lockPage = () => {
      lockedScrollPosition = window.scrollY;
      document.body.style.setProperty(
        "--lightbox-scroll-offset",
        `-${lockedScrollPosition}px`,
      );
      document.documentElement.classList.add("lightbox-open");
      document.body.classList.add("lightbox-open");
    };

    const unlockPage = () => {
      document.documentElement.classList.remove("lightbox-open");
      document.body.classList.remove("lightbox-open");
      document.body.style.removeProperty("--lightbox-scroll-offset");
      window.scrollTo({ top: lockedScrollPosition, behavior: "auto" });
    };

    const openLightbox = (trigger) => {
      activeTrigger = trigger;
      showPhotograph(triggers.indexOf(trigger));
      lockPage();
      lightbox.showModal();
      closeButton.focus();
      updateBrowserZoomState();
      scheduleNavigationFieldUpdate();

      if (reducedMotionQuery.matches) {
        lightbox.classList.add("is-visible");
        return;
      }

      // Establish the transparent dialog state before starting the transition.
      // This also makes cached-page openings animate reliably.
      void getComputedStyle(lightbox).opacity;
      openingFrame = window.requestAnimationFrame(() => {
        openingFrame = undefined;
        lightbox.classList.add("is-visible");
      });
    };

    const closeLightbox = () => {
      if (!lightbox.open || closing) return;

      if (openingFrame !== undefined) {
        window.cancelAnimationFrame(openingFrame);
        openingFrame = undefined;
      }

      if (
        reducedMotionQuery.matches ||
        !lightbox.classList.contains("is-visible")
      ) {
        lightbox.classList.remove("is-visible");
        lightbox.close();
        return;
      }

      closing = true;
      let fallback;

      const finishClose = () => {
        if (!closing) return;
        closing = false;
        window.clearTimeout(fallback);
        lightbox.removeEventListener("transitionend", handleTransitionEnd);
        if (lightbox.open) lightbox.close();
      };
      const handleTransitionEnd = (event) => {
        if (event.target === lightbox && event.propertyName === "opacity") {
          finishClose();
        }
      };

      lightbox.addEventListener("transitionend", handleTransitionEnd);
      fallback = window.setTimeout(finishClose, closeTransitionFallback);
      lightbox.classList.remove("is-visible");
    };

    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openLightbox(trigger);
      });
    });

    closeButton.addEventListener("click", closeLightbox);
    const navigateFromControl = (offset) => (event) => {
      // A browser can synthesize a click after pointerup. When that pointerup
      // already completed a swipe, ignore the click rather than moving twice.
      if (suppressTouchControlClick) {
        event.preventDefault();
        return;
      }
      showPhotograph(currentIndex + offset);
    };

    previousButton.addEventListener("click", navigateFromControl(-1));
    nextButton.addEventListener("click", navigateFromControl(1));

    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPhotograph(currentIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showPhotograph(currentIndex + 1);
      }
    });

    // Native Escape would otherwise close the dialog before its exit
    // transition. Keep the dialog modal until the shared close path finishes.
    lightbox.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLightbox();
    });

    // Only the empty canvas closes on click. Clicking the photograph itself
    // leaves the lightbox open, as do all three controls.
    lightbox.addEventListener("click", (event) => {
      if (
        event.target === lightbox ||
        event.target === surface ||
        event.target === swipeArea
      ) {
        closeLightbox();
      }
    });

    lightbox.addEventListener("close", () => {
      if (openingFrame !== undefined) {
        window.cancelAnimationFrame(openingFrame);
        openingFrame = undefined;
      }
      closing = false;
      lightbox.classList.remove("is-visible");
      swipeStart = undefined;
      suppressTouchControlClick = false;
      activeTouchPointers.clear();
      window.clearTimeout(touchControlClickReset);
      if (navigationFrame !== undefined) {
        window.cancelAnimationFrame(navigationFrame);
        navigationFrame = undefined;
      }
      surface.classList.remove("is-browser-zoomed");
      unlockPage();
      activeTrigger?.focus({ preventScroll: true });
    });

    // A single, mostly-horizontal touch changes images at ordinary scale.
    // Multi-touch and browser-zoomed gestures remain entirely browser-owned.
    swipeArea.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      window.clearTimeout(touchControlClickReset);
      activeTouchPointers.add(event.pointerId);

      if (activeTouchPointers.size === 1 && !browserIsZoomed()) {
        swipeStart = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      } else {
        swipeStart = undefined;
        suppressTouchControlClick = true;
      }
    });

    swipeArea.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") return;

      const canNavigate =
        swipeStart?.pointerId === event.pointerId &&
        activeTouchPointers.size === 1 &&
        !browserIsZoomed();
      const horizontalDistance = canNavigate ? event.clientX - swipeStart.x : 0;
      const verticalDistance = canNavigate ? event.clientY - swipeStart.y : 0;

      activeTouchPointers.delete(event.pointerId);
      swipeStart = undefined;

      if (
        Math.abs(horizontalDistance) >= 50 &&
        Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.25
      ) {
        suppressTouchControlClick = true;
        showPhotograph(
          horizontalDistance < 0 ? currentIndex + 1 : currentIndex - 1,
        );
      }

      if (activeTouchPointers.size === 0) {
        touchControlClickReset = window.setTimeout(() => {
          suppressTouchControlClick = false;
          touchControlClickReset = undefined;
        }, 0);
      }
    });

    swipeArea.addEventListener("pointercancel", (event) => {
      activeTouchPointers.delete(event.pointerId);
      swipeStart = undefined;
      if (activeTouchPointers.size === 0) suppressTouchControlClick = false;
    });

    window.addEventListener("resize", scheduleNavigationFieldUpdate);
    desktopQuery.addEventListener("change", scheduleNavigationFieldUpdate);
    window.visualViewport?.addEventListener("resize", () => {
      updateBrowserZoomState();
      scheduleNavigationFieldUpdate();
    });
    window.visualViewport?.addEventListener("scroll", updateBrowserZoomState);
  }
}
