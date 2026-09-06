const gallery = document.querySelector(".gallery");

if (gallery) {
  const images = [...gallery.querySelectorAll(".gallery-item img")];
  const initialRevealDelay = 120;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const arrangeMode =
    new URLSearchParams(window.location.search).get("arrange") === "1";
  const mobileQuery = window.matchMedia("(max-width: 800px)");

  if (mobileQuery.matches) {
    gallery.querySelectorAll(".gallery-column").forEach((column) => {
      [...column.querySelectorAll(".gallery-item img")]
        .slice(0, 3)
        .forEach((image) => {
          image.loading = "eager";
        });
    });
  }

  const reveal = (image) => image.classList.add("is-revealed");
  const revealImmediately = () => images.forEach(reveal);
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

  const revealInitialViewportImages = async (initialViewportImages) => {
    await Promise.all(initialViewportImages.map(waitForImage));

    for (const [index, image] of initialViewportImages.entries()) {
      reveal(image);

      if (index < initialViewportImages.length - 1) {
        await wait(initialRevealDelay);
      }
    }
  };

  if (
    prefersReducedMotion ||
    arrangeMode ||
    !("IntersectionObserver" in window)
  ) {
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

    images
      .filter((image) => !initialViewportImageSet.has(image))
      .forEach((image) => observer.observe(image));
  }
}
