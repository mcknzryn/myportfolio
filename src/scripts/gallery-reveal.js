const gallery = document.querySelector(".gallery");

if (gallery) {
  const images = [...gallery.querySelectorAll(".gallery-item img")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const arrangeMode = new URLSearchParams(window.location.search).get("arrange") === "1";

  const reveal = (image) => image.classList.add("is-revealed");
  const revealImmediately = () => images.forEach(reveal);

  const revealWhenReady = (image) => {
    if (image.complete) {
      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).finally(() => reveal(image));
      } else {
        reveal(image);
      }
      return;
    }

    image.addEventListener("load", () => reveal(image), { once: true });
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
      rootMargin: "0px 0px 12% 0px",
      threshold: 0.01,
    });

    images.forEach((image) => observer.observe(image));
  }
}
