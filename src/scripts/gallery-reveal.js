const gallery = document.querySelector(".gallery");

if (gallery) {
  const items = [...gallery.querySelectorAll(".gallery-item")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const arrangeMode = new URLSearchParams(window.location.search).get("arrange") === "1";

  const revealImmediately = () => {
    items.forEach((item) => item.classList.add("is-revealed"));
  };

  if (prefersReducedMotion || arrangeMode || !("IntersectionObserver" in window)) {
    revealImmediately();
  } else {
    let rows = [];
    let rowByItem = new Map();
    let pendingRows = new Set();
    let frame = 0;

    const buildRows = () => {
      const sortedItems = [...items].sort((first, second) => {
        const firstRect = first.getBoundingClientRect();
        const secondRect = second.getBoundingClientRect();
        return firstRect.top - secondRect.top || firstRect.left - secondRect.left;
      });
      const rowTolerance = 24;
      rows = [];
      rowByItem = new Map();

      sortedItems.forEach((item) => {
        const top = item.getBoundingClientRect().top;
        const row = rows.find((candidate) => Math.abs(candidate.top - top) <= rowTolerance);
        const targetRow = row || { top, items: [], revealed: false };
        if (!row) rows.push(targetRow);
        targetRow.items.push(item);
        rowByItem.set(item, targetRow);
      });
    };

    const revealPendingRows = () => {
      frame = 0;
      const visibleRows = [...pendingRows]
        .filter((row) => !row.revealed)
        .sort((first, second) => first.top - second.top);
      pendingRows = new Set();

      visibleRows.forEach((row, index) => {
        window.setTimeout(() => {
          row.revealed = true;
          row.items.forEach((item) => item.classList.add("is-revealed"));
        }, index * 120);
      });
    };

    const scheduleRowReveal = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(revealPendingRows);
    };

    buildRows();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const row = rowByItem.get(entry.target);
        if (!row || row.revealed) return;
        pendingRows.add(row);
        observer.unobserve(entry.target);
      });
      if (pendingRows.size) scheduleRowReveal();
    }, {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.08,
    });

    items.forEach((item) => observer.observe(item));
    window.addEventListener("resize", () => {
      const revealedRows = rows.filter((row) => row.revealed);
      buildRows();
      rows.forEach((row) => {
        if (revealedRows.some((revealedRow) => revealedRow.items.some((item) => row.items.includes(item)))) {
          row.revealed = true;
          row.items.forEach((item) => item.classList.add("is-revealed"));
        }
      });
    });
  }
}
