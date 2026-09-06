// This browser script progressively reveals images on the Work page. The
// effect is optional: without JavaScript, CSS leaves every gallery image visible.
const gallery = document.querySelector(".gallery");

// Keeping the enhancement inside this guard makes the script safe on pages
// that do not render a Work gallery.
if (gallery) {
  const images = [...gallery.querySelectorAll(".gallery-item img")];
  const animatedRevealClass = "is-reveal-animated";
  const immediateRevealClass = "is-reveal-immediate";
  const revealDelayProperty = "--gallery-reveal-delay";
  // These are the gaps between opening reveal starts, in milliseconds.
  // Lower values make their respective opening patterns move faster.
  const desktopRevealInterval = 70;
  const mobileRevealInterval = 35;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const arrangeMode =
    new URLSearchParams(window.location.search).get("arrange") === "1";
  const mobileQuery = window.matchMedia("(max-width: 800px)");

  // Mobile keeps a larger group ready for its longer, narrow reading flow.
  if (mobileQuery.matches) {
    gallery.querySelectorAll(".gallery-column").forEach((column) => {
      [...column.querySelectorAll(".gallery-item img")]
        .slice(0, 3)
        .forEach((image) => {
          image.loading = "eager";
        });
    });
  }

  // One temporary class starts the shared CSS keyframe; `is-revealed` records
  // the permanent visible state used by every reveal path.
  const reveal = (image, delay = 0) => {
    if (delay) {
      image.style.setProperty(revealDelayProperty, `${delay}ms`);
    }
    image.classList.add(animatedRevealClass, "is-revealed");
  };
  const revealImmediately = () => {
    gallery.classList.add(immediateRevealClass);
    images.forEach((image) => {
      image.classList.remove(animatedRevealClass);
      image.style.removeProperty(revealDelayProperty);
      image.classList.add("is-revealed");
    });
    // Commit the visible state while transitions are disabled, then restore
    // normal post-reveal hover transitions without waiting for a painted frame.
    gallery.getBoundingClientRect();
    gallery.classList.remove(immediateRevealClass);
  };

  // Animation events bubble, so one gallery listener cleans up the temporary
  // class for opening and scroll reveals alike.
  const clearAnimatedReveal = (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    event.target.classList.remove(animatedRevealClass);
    event.target.style.removeProperty(revealDelayProperty);
  };
  gallery.addEventListener("animationend", clearAnimatedReveal);
  gallery.addEventListener("animationcancel", clearAnimatedReveal);
  // Resolve only after an image has loaded and decoded when the browser
  // supports decode(). Errors still resolve so a broken image cannot stall the
  // rest of the gallery.
  const waitForImage = (image) =>
    new Promise((resolve) => {
      const resolveAfterDecode = () => {
        if (typeof image.decode !== "function") {
          resolve();
          return;
        }

        image
          .decode()
          .catch(() => {})
          .finally(resolve);
      };

      if (image.complete) {
        resolveAfterDecode();
        return;
      }

      image.addEventListener("load", resolveAfterDecode, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });

  const revealWhenReady = (image) =>
    waitForImage(image).then(() => reveal(image));
  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, duration));

  // `images` follows the gallery's column-major DOM order. Filtering it keeps
  // that order while selecting only images intersecting the true viewport.
  const getInitialViewportImages = () => {
    return images.filter((image) => {
      const bounds = image.getBoundingClientRect();
      return (
        bounds.top < window.innerHeight &&
        bounds.bottom > 0 &&
        bounds.left < window.innerWidth &&
        bounds.right > 0
      );
    });
  };

  // On narrow screens, a spatial top-to-bottom order feels like one soft wave
  // instead of carrying the desktop column pattern into a dense viewport.
  const getMobileRevealOrder = (initialViewportImages) =>
    initialViewportImages
      .map((image) => ({ image, bounds: image.getBoundingClientRect() }))
      .sort((first, second) => {
        const topDifference = first.bounds.top - second.bounds.top;
        return Math.abs(topDifference) <= 1
          ? first.bounds.left - second.bounds.left
          : topDifference;
      })
      .map(({ image }) => image);

  const revealInitialViewportImages = async (initialViewportImages) => {
    // Start every load/decode wait together, then schedule the complete cohort
    // in one task so CSS can keep the cadence on the compositor timeline.
    await Promise.all(initialViewportImages.map(waitForImage));

    const revealOrder = mobileQuery.matches
      ? getMobileRevealOrder(initialViewportImages)
      : initialViewportImages;
    const revealInterval = mobileQuery.matches
      ? mobileRevealInterval
      : desktopRevealInterval;

    revealOrder.forEach((image, index) => {
      reveal(image, index * revealInterval);
    });

    // Hold observer reveals only until the last opening animation has started,
    // not until the opening cohort has finished fading.
    const finalRevealDelay = (revealOrder.length - 1) * revealInterval;
    if (finalRevealDelay > 0) {
      await wait(finalRevealDelay);
    }
  };

  if (
    prefersReducedMotion ||
    arrangeMode ||
    !("IntersectionObserver" in window)
  ) {
    // Motion preferences, Arrange mode, and older browsers bypass sequencing.
    revealImmediately();
  } else {
    const initialViewportImages = getInitialViewportImages();
    const initialViewportImageSet = new Set(initialViewportImages);
    const initialRevealSequence = revealInitialViewportImages(
      initialViewportImages,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          // Observer-triggered images wait until the opening cohort has started,
          // then use independent load/decode reveals while the visitor scrolls.
          initialRevealSequence.then(() => revealWhenReady(entry.target));
        });
      },
      {
        rootMargin: mobileQuery.matches
          ? "100% 0px 150% 0px"
          : "0px 0px 12% 0px",
        threshold: 0.01,
      },
    );

    // The opening cohort owns its reveal and must not also enter the observer.
    images
      .filter((image) => !initialViewportImageSet.has(image))
      .forEach((image) => observer.observe(image));
  }
}
