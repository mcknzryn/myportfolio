const gallery = document.querySelector(".gallery");

if (gallery) {
  const images = [...gallery.querySelectorAll(".gallery-item img")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const arrangeMode = new URLSearchParams(window.location.search).get("arrange") === "1";
  const mobileQuery = window.matchMedia("(max-width: 800px)");

  if (mobileQuery.matches) {
    gallery.querySelectorAll(".gallery-column").forEach((column) => {
      [...column.querySelectorAll(".gallery-item img")]
        .slice(0, 3)
        .forEach((image) => { image.loading = "eager"; });
    });
  }

  const reveal = (image) => image.classList.add("is-revealed");
  const revealImmediately = () => images.forEach(reveal);
  const revealAfterDecode = (image) => {
    if (typeof image.decode !== "function") {
      reveal(image);
      return;
    }

    image.decode().catch(() => {}).finally(() => reveal(image));
  };

  const revealWhenReady = (image) => {
    if (image.complete) {
      revealAfterDecode(image);
      return;
    }

    image.addEventListener("load", () => revealAfterDecode(image), { once: true });
    image.addEventListener("error", () => reveal(image), { once: true });
  };

  if (prefersReducedMotion || arrangeMode || !("IntersectionObserver" in window)) {
    revealImmediately();
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        revealWhenReady(entry.target);
      });
    }, {
      rootMargin: mobileQuery.matches ? "100% 0px 150% 0px" : "0px 0px 12% 0px",
      threshold: 0.01,
    });

    images.forEach((image) => observer.observe(image));
  }
}
