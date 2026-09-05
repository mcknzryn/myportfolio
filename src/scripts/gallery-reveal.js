// This browser script progressively reveals images on the Work page. Astro has
// already rendered the gallery before this code runs. The effect is optional:
// every fallback path reveals all images so JavaScript trouble cannot leave the
// portfolio hidden. See CODE_GUIDE.md for browser API and naming explanations.

// `gallery` is our name for the outer Work gallery DOM element. querySelector
// is a browser API and returns either the first match or null.
const gallery = document.querySelector(".gallery");

// This guard makes the file safe on any page that does not contain a gallery.
if (gallery) {
  // Spreading (`...`) the browser's element collection into brackets creates a
  // normal array, which gives us familiar array methods such as `forEach`.
  const images = [...gallery.querySelectorAll(".gallery-item img")];

  // `prefersReducedMotion` and `arrangeMode` are Boolean names: each records a
  // yes/no condition that changes whether animation is appropriate.
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const arrangeMode =
    new URLSearchParams(window.location.search).get("arrange") === "1";
  const mobileQuery = window.matchMedia("(max-width: 800px)");

  // Mobile displays the three HTML columns in a longer reading flow. Eagerly
  // loading the first three images from each column prepares the opening group
  // without forcing the entire portfolio to load at once.
  if (mobileQuery.matches) {
    gallery.querySelectorAll(".gallery-column").forEach((column) => {
      [...column.querySelectorAll(".gallery-item img")]
        .slice(0, 3)
        .forEach((image) => {
          image.loading = "eager";
        });
    });
  }

  // These project-authored function names describe progressively larger jobs:
  // `reveal` changes one image's CSS state; `revealImmediately` handles all
  // images; the other helpers coordinate browser loading and decoding first.
  const reveal = (image) => {
    image.classList.remove("is-reveal-pending");
    image.classList.add("is-revealed");
  };
  const revealImmediately = () => images.forEach(reveal);
  const revealAfterDecode = (image) => {
    // Older browsers may not provide decode(). In that case there is nothing
    // useful to wait for, so the image is revealed directly.
    if (typeof image.decode !== "function") {
      reveal(image);
      return;
    }

    // decode() returns a Promise. A decode failure is harmless here; `finally`
    // guarantees that reveal runs whether decoding succeeds or fails.
    image
      .decode()
      .catch(() => {})
      .finally(() => reveal(image));
  };

  const revealWhenReady = (image) => {
    // `complete` means the load attempt has already finished. Otherwise these
    // one-use event listeners wait for either success or failure.
    if (image.complete) {
      revealAfterDecode(image);
      return;
    }

    image.addEventListener("load", () => revealAfterDecode(image), {
      once: true,
    });
    image.addEventListener("error", () => reveal(image), { once: true });
  };

  // The entire enhancement is protected by try/catch. If an unexpected browser
  // or observer error occurs, the catch below restores fully visible content.
  try {
    // Motion preferences, the visual editor, and browsers without observer
    // support all use the simple non-animated path.
    if (
      prefersReducedMotion ||
      arrangeMode ||
      !("IntersectionObserver" in window)
    ) {
      revealImmediately();
    } else {
      // IntersectionObserver is a browser API that reports when watched
      // elements approach the viewport without a constantly running scroll
      // handler. `entries` is the observer's batch of image visibility reports.
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            // Once an image qualifies, this script never needs to watch it
            // again. `entry.target` is the DOM element being reported.
            observer.unobserve(entry.target);
            revealWhenReady(entry.target);
          });
        },
        {
          // rootMargin expands the watched area beyond the visible viewport so
          // loading and decoding can begin shortly before an image is seen.
          rootMargin: mobileQuery.matches
            ? "100% 0px 150% 0px"
            : "0px 0px 12% 0px",
          threshold: 0.01,
        },
      );

      images.forEach((image) => {
        // CSS hides only images that have successfully entered this observer
        // workflow. That ordering preserves the visible no-JavaScript fallback.
        image.classList.add("is-reveal-pending");
        observer.observe(image);
      });
    }
  } catch (error) {
    console.error(
      "Gallery reveal enhancement failed; showing all images.",
      error,
    );
    revealImmediately();
  }
}
