const params = new URLSearchParams(window.location.search);
const arrangeEnabled = params.get("arrange") === "1";
const gallery = document.querySelector(".gallery");

if (arrangeEnabled && gallery) {
  document.body.classList.add("arrange-mode");
  const storageKey = "mckenzieryan-work-gallery-state";
  const legacyStorageKey = "mckenzieryan-work-gallery-order";
  const sourceOrder = [...gallery.children].map((item) => item.dataset.imageId);
  const configuredFavorites = JSON.parse(gallery.dataset.galleryFavorites || "[]");
  const configuredPinned = JSON.parse(gallery.dataset.galleryPinned || "[]");
  const validIds = (ids) => Array.isArray(ids)
    && new Set(ids).size === ids.length
    && ids.every((id) => sourceOrder.includes(id));
  const validOrder = (order) => Array.isArray(order)
    && order.length === sourceOrder.length
    && new Set(order).size === order.length
    && order.every((id) => sourceOrder.includes(id));

  const getOrder = () => [...gallery.children].map((item) => item.dataset.imageId);
  const applyOrder = (order) => {
    const items = new Map([...gallery.children].map((item) => [item.dataset.imageId, item]));
    order.forEach((id) => gallery.append(items.get(id)));
  };

  let favorites = validIds(configuredFavorites) ? new Set(configuredFavorites) : new Set();
  let pinned = validIds(configuredPinned) ? new Set(configuredPinned) : new Set();
  let savedState;
  try {
    savedState = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    savedState = null;
  }

  if (!savedState) {
    try {
      const legacyOrder = JSON.parse(localStorage.getItem(legacyStorageKey));
      if (validOrder(legacyOrder)) {
        savedState = { order: legacyOrder, favorites: [...favorites], pinned: [...pinned] };
      }
    } catch {
      savedState = null;
    }
  }

  if (savedState && validOrder(savedState.order)) applyOrder(savedState.order);
  if (savedState && validIds(savedState.favorites)) favorites = new Set(savedState.favorites);
  if (savedState && validIds(savedState.pinned)) pinned = new Set(savedState.pinned);

  const toolbar = document.createElement("div");
  toolbar.className = "arrange-toolbar";
  toolbar.setAttribute("aria-label", "Gallery arrangement tools");

  const note = document.createElement("span");
  note.textContent = "Arrange mode — drag images to reorder";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset";

  const randomizeButton = document.createElement("button");
  randomizeButton.type = "button";
  randomizeButton.textContent = "Randomize";

  const masonryButton = document.createElement("button");
  masonryButton.type = "button";
  masonryButton.textContent = "Masonry";

  const overviewButton = document.createElement("button");
  overviewButton.type = "button";
  overviewButton.textContent = "Overview";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy order";

  const output = document.createElement("textarea");
  output.className = "arrange-output";
  output.setAttribute("aria-label", "Gallery order code");
  output.hidden = true;
  output.readOnly = true;

  toolbar.append(note, resetButton, randomizeButton, masonryButton, overviewButton, copyButton);
  gallery.before(toolbar, output);

  const save = () => localStorage.setItem(storageKey, JSON.stringify({
    order: getOrder(),
    favorites: [...favorites],
    pinned: [...pinned],
  }));
  const updateToggleButton = (button, active, activeLabel, inactiveLabel, activeText, inactiveText) => {
    button.classList.toggle("is-active", active);
    button.textContent = active ? activeText : inactiveText;
    button.setAttribute("aria-label", active ? activeLabel : inactiveLabel);
    button.setAttribute("aria-pressed", String(active));
  };
  const updateFavoriteButton = (button, id) => updateToggleButton(
    button, favorites.has(id), `Remove ${id} from favorites`, `Add ${id} to favorites`, "★", "☆",
  );
  const updatePinButton = (button, id) => updateToggleButton(
    button, pinned.has(id), `Unpin ${id}`, `Pin ${id} in place`, "●", "○",
  );

  const setLayout = (layout) => {
    const overview = layout === "overview";
    gallery.classList.toggle("is-overview", overview);
    masonryButton.setAttribute("aria-pressed", String(!overview));
    overviewButton.setAttribute("aria-pressed", String(overview));
  };

  gallery.querySelectorAll(".gallery-item").forEach((item) => {
    item.style.position = "relative";
    const id = item.dataset.imageId;
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "arrange-favorite-button";
    favoriteButton.dataset.imageId = id;
    updateFavoriteButton(favoriteButton, id);
    favoriteButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    favoriteButton.addEventListener("click", () => {
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      updateFavoriteButton(favoriteButton, id);
      save();
    });

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "arrange-pin-button";
    pinButton.dataset.imageId = id;
    updatePinButton(pinButton, id);
    pinButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    pinButton.addEventListener("click", () => {
      if (pinned.has(id)) pinned.delete(id);
      else pinned.add(id);
      updatePinButton(pinButton, id);
      save();
    });

    item.append(favoriteButton, pinButton);
  });

  const getPinnedPositions = () => new Map(
    getOrder().map((id, index) => [index, id]).filter(([, id]) => pinned.has(id)),
  );

  const normalizePinnedOrder = (order, pinnedPositions) => {
    const pinnedEntries = [...pinnedPositions].sort(([first], [second]) => first - second);
    const pinnedIds = new Set(pinnedEntries.map(([, id]) => id));
    const movable = order.filter((id) => !pinnedIds.has(id));
    let movableIndex = 0;
    return Array.from({ length: sourceOrder.length }, (_, index) => {
      const pinnedEntry = pinnedEntries.find(([position]) => position === index);
      return pinnedEntry ? pinnedEntry[1] : movable[movableIndex++];
    });
  };

  const snippet = () => `const galleryOrder = [\n  ${getOrder().map((id) => JSON.stringify(id)).join(", ")}\n];\n\nconst galleryFavorites = [\n  ${[...favorites].map((id) => JSON.stringify(id)).join(", ")}\n];\n\nconst galleryPinned = [\n  ${[...pinned].map((id) => JSON.stringify(id)).join(", ")}\n];`;

  resetButton.addEventListener("click", () => {
    applyOrder(sourceOrder);
    favorites.clear();
    pinned.clear();
    gallery.querySelectorAll(".arrange-favorite-button").forEach((button) => {
      updateFavoriteButton(button, button.dataset.imageId);
    });
    gallery.querySelectorAll(".arrange-pin-button").forEach((button) => {
      updatePinButton(button, button.dataset.imageId);
    });
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyStorageKey);
    setLayout("masonry");
    output.hidden = true;
  });

  randomizeButton.addEventListener("click", () => {
    const currentOrder = getOrder();
    const pinnedPositions = getPinnedPositions();
    const movable = currentOrder.filter((id) => !pinned.has(id));
    const favoriteMovable = movable.filter((id) => favorites.has(id));
    const remaining = movable.filter((id) => !favorites.has(id));
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
    }
    applyOrder(normalizePinnedOrder([...favoriteMovable, ...remaining], pinnedPositions));
    save();
    output.hidden = true;
  });

  masonryButton.addEventListener("click", () => setLayout("masonry"));
  overviewButton.addEventListener("click", () => setLayout("overview"));
  setLayout("masonry");

  copyButton.addEventListener("click", async () => {
    const text = snippet();
    output.value = text;
    output.hidden = false;
    output.select();
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      window.setTimeout(() => { copyButton.textContent = "Copy order"; }, 1400);
    } catch {
      copyButton.textContent = "Select and copy below";
    }
  });

  let dragState = null;

  const moveDraggedItem = (event) => {
    if (!dragState?.started) return;
    const { item, offsetX, offsetY } = dragState;
    item.style.left = `${event.clientX - offsetX}px`;
    item.style.top = `${event.clientY - offsetY}px`;

    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".gallery-item");
    if (!target || target === item || !gallery.contains(target) || pinned.has(target.dataset.imageId)) return;
    const targetRect = target.getBoundingClientRect();
    const before = event.clientY < targetRect.top + targetRect.height / 2;
    const reference = before ? target : target.nextElementSibling;
    if (reference !== dragState.placeholder && reference !== item) {
      gallery.insertBefore(dragState.placeholder, reference);
    }
  };

  const finishDrag = (event) => {
    if (!dragState) return;
    const { item, placeholder, started } = dragState;
    if (started) {
      item.style.cssText = dragState.originalStyle;
      item.classList.remove("is-dragging");
      gallery.insertBefore(item, placeholder);
      placeholder.remove();
      applyOrder(normalizePinnedOrder(getOrder(), dragState.pinnedPositions));
      save();
    }
    if (event?.pointerId !== undefined) event.preventDefault();
    dragState = null;
  };

  gallery.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const item = event.target.closest(".gallery-item");
    if (!item || pinned.has(item.dataset.imageId)) return;
    const rect = item.getBoundingClientRect();
    dragState = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalStyle: item.style.cssText,
      pinnedPositions: getPinnedPositions(),
      started: false,
      placeholder: document.createElement("div"),
    };
    dragState.placeholder.className = "gallery-placeholder";
    dragState.placeholder.style.width = `${rect.width}px`;
    dragState.placeholder.style.height = `${rect.height}px`;
  });

  window.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.started && distance < 8) return;
    if (!dragState.started) {
      dragState.started = true;
      dragState.item.classList.add("is-dragging");
      dragState.item.style.width = `${dragState.item.getBoundingClientRect().width}px`;
      dragState.item.style.position = "fixed";
      dragState.item.style.zIndex = "10";
      dragState.item.style.pointerEvents = "none";
      dragState.item.parentNode.insertBefore(dragState.placeholder, dragState.item);
      document.body.append(dragState.item);
    }
    event.preventDefault();
    moveDraggedItem(event);
  }, { passive: false });

  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
}
