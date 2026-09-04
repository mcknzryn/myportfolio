import Muuri from "muuri";

const params = new URLSearchParams(window.location.search);
const gallery = document.querySelector(".gallery");
const arrangeRequested = params.get("arrange") === "1";
const desktopQuery = window.matchMedia("(min-width: 901px)");

if (arrangeRequested && gallery && desktopQuery.matches) {
  document.body.classList.add("arrange-mode");

  const storageKey = "mckenzieryan-work-gallery-state-v2";
  const previousStorageKeys = [
    "mckenzieryan-work-gallery-state",
    "mckenzieryan-work-gallery-order",
  ];
  const storageVersion = 2;
  const columnGroups = [
    ...gallery.querySelectorAll(":scope > .gallery-column"),
  ];
  const unplacedGroup = gallery.querySelector(":scope > .gallery-unplaced");
  const configuredColumns = JSON.parse(gallery.dataset.galleryColumns || "[]");
  const configuredUnplaced = JSON.parse(
    gallery.dataset.galleryUnplaced || "[]",
  );
  const configuredFavorites = JSON.parse(
    gallery.dataset.galleryFavorites || "[]",
  );
  const configuredPinned = JSON.parse(gallery.dataset.galleryPinned || "[]");

  if (columnGroups.length !== 3) {
    throw new Error("Arrange mode requires exactly three gallery columns.");
  }

  const itemElements = columnGroups.flatMap((column) => [...column.children]);
  const unplacedElements = [...(unplacedGroup?.children || [])];
  const allElements = [...itemElements, ...unplacedElements];
  const sourceOrder = allElements.map((item) => item.dataset.imageId);
  const validIds = (ids) =>
    Array.isArray(ids) &&
    new Set(ids).size === ids.length &&
    ids.every((id) => sourceOrder.includes(id));
  const validColumns = (columns) =>
    Array.isArray(columns) &&
    columns.length === 3 &&
    columns.every(validIds) &&
    validIds(columns.flat());
  const validPinSlots = (slots) =>
    slots &&
    typeof slots === "object" &&
    !Array.isArray(slots) &&
    Object.values(slots).every(
      (slot) =>
        slot &&
        Number.isInteger(slot.column) &&
        Number.isInteger(slot.index) &&
        slot.column >= 0 &&
        slot.column < 3 &&
        slot.index >= 0,
    );

  const sourceColumns = validColumns(configuredColumns)
    ? configuredColumns.map((column) => [...column])
    : [[], [], []];
  const sourceUnplaced = validIds(configuredUnplaced)
    ? configuredUnplaced.filter((id) => !sourceColumns.flat().includes(id))
    : sourceOrder.filter((id) => !sourceColumns.flat().includes(id));

  let favorites = validIds(configuredFavorites)
    ? new Set(configuredFavorites)
    : new Set();
  let pinned = validIds(configuredPinned)
    ? new Set(configuredPinned)
    : new Set();
  let columns = sourceColumns.map((column) => [...column]);
  let unplaced = [...sourceUnplaced];
  let pinSlots = {};
  let savedState;
  let grids = [];
  let isDragging = false;
  let isApplyingState = false;

  try {
    savedState = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    savedState = null;
  }

  if (
    savedState?.version === storageVersion &&
    validColumns(savedState.columns) &&
    validIds(savedState.unplaced)
  ) {
    const savedIds = savedState.columns.flat();
    const savedUnplaced = savedState.unplaced.filter(
      (id) => !savedIds.includes(id),
    );
    const allSavedIds = [...savedIds, ...savedUnplaced];
    if (allSavedIds.length === sourceOrder.length && validIds(allSavedIds)) {
      columns = savedState.columns.map((column) => [...column]);
      unplaced = savedUnplaced;
    }
  } else if (savedState) {
    // Do not restore the previous single-grid editor's layout. Its coordinates
    // were not guaranteed to represent the committed production columns.
    savedState = null;
  }

  if (savedState && validIds(savedState.favorites))
    favorites = new Set(savedState.favorites);
  if (savedState && validIds(savedState.pinned))
    pinned = new Set(savedState.pinned);
  if (savedState && validPinSlots(savedState.pinSlots))
    pinSlots = savedState.pinSlots;

  const itemsById = new Map(
    allElements.map((item) => [item.dataset.imageId, item]),
  );
  const placeElements = () => {
    columns.forEach((column, columnIndex) => {
      column.forEach((id) => {
        const item = itemsById.get(id);
        if (item) columnGroups[columnIndex].append(item);
      });
    });
    unplaced.forEach((id) => {
      const item = itemsById.get(id);
      if (item) columnGroups[2].append(item);
    });
    unplacedGroup?.remove();
  };
  const getItemId = (item) => item.getElement().dataset.imageId;
  const getItemsById = (items) =>
    new Map(items.map((item) => [getItemId(item), item]));
  const getElements = () => [...gallery.querySelectorAll(".gallery-item")];
  pinned.forEach((id) => {
    if (pinSlots[id]) return;
    const column = columns.findIndex((items) => items.includes(id));
    const index = column === -1 ? 0 : columns[column].indexOf(id);
    if (column !== -1) pinSlots[id] = { column, index };
  });

  const normalizedSourceColumns = columns.map((column) => [...column]);

  const normalizePinnedSlots = (nextColumns) => {
    const normalized = nextColumns.map((column) =>
      column.filter((id) => !pinned.has(id)),
    );
    Object.entries(pinSlots).forEach(([id, slot]) => {
      if (!pinned.has(id) || !itemsById.has(id)) return;
      const targetColumn = Math.max(0, Math.min(2, slot.column));
      const targetIndex = Math.max(
        0,
        Math.min(slot.index, normalized[targetColumn].length),
      );
      normalized[targetColumn].splice(targetIndex, 0, id);
    });
    return normalized;
  };

  columns = normalizePinnedSlots(normalizedSourceColumns);
  placeElements();

  const syncColumnsFromGrids = () => {
    const stagedIds = new Set(unplaced);
    const gridColumns = grids.map((grid) => grid.getItems().map(getItemId));
    const lastCommittedIndex = gridColumns[2].reduce(
      (lastIndex, id, index) => (stagedIds.has(id) ? lastIndex : index),
      -1,
    );
    const nextUnplaced = gridColumns[2].filter(
      (id, index) => stagedIds.has(id) && index > lastCommittedIndex,
    );
    const nextColumns = gridColumns.map((column, columnIndex) =>
      column.filter(
        (id, index) =>
          columnIndex !== 2 ||
          !stagedIds.has(id) ||
          index <= lastCommittedIndex,
      ),
    );
    columns = normalizePinnedSlots(nextColumns);
    unplaced = nextUnplaced;
  };

  const persist = () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: storageVersion,
        columns,
        unplaced,
        favorites: [...favorites],
        pinned: [...pinned],
        pinSlots,
      }),
    );
  };
  const syncAndPersist = () => {
    syncColumnsFromGrids();
    applyColumnsToGrids();
    persist();
  };

  const galleryGap = () => {
    const value = getComputedStyle(columnGroups[0]).rowGap;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const stackLayout = (_grid, layoutId, items, width, _height, callback) => {
    const gap = galleryGap();
    const overview = gallery.classList.contains("is-overview");
    let top = 0;
    const slots = [];
    items.forEach((item) => {
      const itemHeight = overview ? width : item.getHeight();
      slots.push(0, top);
      top += itemHeight + gap;
    });
    callback({
      id: layoutId,
      items,
      slots,
      styles: { width: `${width}px`, height: `${Math.max(top - gap, 1)}px` },
    });
  };

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
  output.setAttribute("aria-label", "Gallery columns code");
  output.hidden = true;
  output.readOnly = true;
  toolbar.append(
    note,
    resetButton,
    randomizeButton,
    masonryButton,
    overviewButton,
    copyButton,
  );
  gallery.before(toolbar, output);

  const updateToggleButton = (
    button,
    active,
    activeLabel,
    inactiveLabel,
    activeText,
    inactiveText,
  ) => {
    button.classList.toggle("is-active", active);
    button.textContent = active ? activeText : inactiveText;
    button.setAttribute("aria-label", active ? activeLabel : inactiveLabel);
    button.setAttribute("aria-pressed", String(active));
  };
  const updateFavoriteButton = (button, id) =>
    updateToggleButton(
      button,
      favorites.has(id),
      `Remove ${id} from favorites`,
      `Add ${id} to favorites`,
      "★",
      "☆",
    );
  const updatePinButton = (button, id) =>
    updateToggleButton(
      button,
      pinned.has(id),
      `Unpin ${id}`,
      `Pin ${id} in place`,
      "●",
      "○",
    );

  getElements().forEach((item) => {
    item.style.position = "absolute";
    const id = item.dataset.imageId;
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "arrange-favorite-button";
    favoriteButton.dataset.imageId = id;
    updateFavoriteButton(favoriteButton, id);
    favoriteButton.addEventListener("pointerdown", (event) =>
      event.stopPropagation(),
    );
    favoriteButton.addEventListener("click", () => {
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      updateFavoriteButton(favoriteButton, id);
      persist();
    });

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "arrange-pin-button";
    pinButton.dataset.imageId = id;
    updatePinButton(pinButton, id);
    pinButton.addEventListener("pointerdown", (event) =>
      event.stopPropagation(),
    );
    pinButton.addEventListener("click", () => {
      const grid = grids.find((candidate) => candidate.getItem(item));
      const currentIndex = grid
        ? grid.getItems().indexOf(grid.getItem(item))
        : -1;
      const currentColumn = grids.indexOf(grid);
      if (pinned.has(id)) {
        pinned.delete(id);
        delete pinSlots[id];
      } else {
        pinned.add(id);
        pinSlots[id] = {
          column: currentColumn === -1 ? 0 : currentColumn,
          index: Math.max(0, currentIndex),
        };
      }
      updatePinButton(pinButton, id);
      grids.forEach((candidate) => candidate.layout(true));
      syncAndPersist();
    });
    item.append(favoriteButton, pinButton);
  });

  grids = columnGroups.map(
    (column) =>
      new Muuri(column, {
        items: ".gallery-item",
        dragEnabled: true,
        dragContainer: document.body,
        dragSort: () => grids,
        dragStartPredicate: (item, event) => {
          if (pinned.has(getItemId(item))) return false;
          if (event.isFinal) return undefined;
          return event.distance >= 8 ? true : undefined;
        },
        layout: stackLayout,
        layoutOnResize: 150,
        layoutDuration: 250,
        dragRelease: { duration: 250 },
      }),
  );

  const applyColumnsToGrids = () => {
    isApplyingState = true;
    grids.forEach((grid, index) => {
      const itemsById = getItemsById(grid.getItems());
      const ids =
        index === 2 ? [...columns[index], ...unplaced] : columns[index];
      const orderedItems = ids.map((id) => itemsById.get(id)).filter(Boolean);
      const currentItems = grid.getItems();
      const isAlreadyOrdered =
        orderedItems.length === currentItems.length &&
        orderedItems.every(
          (item, itemIndex) => item === currentItems[itemIndex],
        );
      if (!isAlreadyOrdered) grid.sort(orderedItems, { layout: "instant" });
    });
    isApplyingState = false;
  };

  const setLayout = (layout) => {
    const overview = layout === "overview";
    gallery.classList.toggle("is-overview", overview);
    masonryButton.setAttribute("aria-pressed", String(!overview));
    overviewButton.setAttribute("aria-pressed", String(overview));
    grids.forEach((grid) => grid.refreshItems().layout(true));
  };

  grids.forEach((grid) => {
    grid.on("dragStart", () => {
      isDragging = true;
    });
    grid.on("dragEnd", () => {
      grids.forEach((candidate) => candidate.synchronize());
      syncAndPersist();
      isDragging = false;
    });
    grid.on("sort", () => {
      grid.synchronize();
      if (!isDragging && !isApplyingState) syncAndPersist();
    });
    grid.on("send", () => {
      if (!isDragging && !isApplyingState) syncAndPersist();
    });
    grid.on("receive", () => {
      if (!isDragging && !isApplyingState) syncAndPersist();
    });
  });

  getElements().forEach((item) => {
    const image = item.querySelector("img");
    if (!image) return;
    const refresh = () => grids.forEach((grid) => grid.refreshItems().layout());
    image.addEventListener("load", refresh, { once: true });
    image.addEventListener("error", refresh, { once: true });
    if (image.complete) refresh();
  });

  const randomize = () => {
    columns = columns.map((column) => {
      const movable = column.filter((id) => !pinned.has(id));
      const favoriteMovable = movable.filter((id) => favorites.has(id));
      const remaining = movable.filter((id) => !favorites.has(id));
      for (let index = remaining.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[swapIndex]] = [
          remaining[swapIndex],
          remaining[index],
        ];
      }
      const randomized = [...favoriteMovable, ...remaining];
      let movableIndex = 0;
      return column.map((id) =>
        pinned.has(id) ? id : randomized[movableIndex++],
      );
    });
    syncAndPersist();
  };

  resetButton.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    previousStorageKeys.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  });
  randomizeButton.addEventListener("click", () => {
    randomize();
    output.hidden = true;
  });
  masonryButton.addEventListener("click", () => setLayout("masonry"));
  overviewButton.addEventListener("click", () => setLayout("overview"));

  copyButton.addEventListener("click", async () => {
    syncAndPersist();
    const text = `export const workGalleryColumns = [\n${columns
      .map(
        (column) => `  [${column.map((id) => JSON.stringify(id)).join(", ")}]`,
      )
      .join(",\n")}\n] as const;`;
    output.value = text;
    output.hidden = false;
    output.select();
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy order";
      }, 1400);
    } catch {
      copyButton.textContent = "Select and copy below";
    }
  });

  setLayout("masonry");
}
