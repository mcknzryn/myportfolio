// This browser script is a development-only visual editor for the Work gallery.
// It coordinates Astro's configured photo IDs, rendered DOM elements, Muuri's
// draggable item wrappers, and state saved in localStorage. WorkGallery.astro
// only ships it in DEV; this file also requires ?arrange=1 and a desktop width.
// See CODE_GUIDE.md for the full state diagram and naming glossary.

// Muuri is an external layout/drag library. `Muuri` is its exported class name,
// while most other names in this file were chosen specifically for this site.
import Muuri from "muuri";

// --- Activation and configuration -----------------------------------------

// `params`, `gallery`, and `desktopQuery` describe the current browser page.
// URLSearchParams and matchMedia are browser APIs; `.gallery` is our outer Work
// gallery element, and `arrangeRequested` is a project-authored Boolean name.
const params = new URLSearchParams(window.location.search);
const gallery = document.querySelector(".gallery");
const arrangeRequested = params.get("arrange") === "1";
const desktopQuery = window.matchMedia("(min-width: 901px)");

// Keeping all editor work inside this guard means production-like visits and
// small viewports retain the normal static gallery even if this file is loaded.
if (arrangeRequested && gallery && desktopQuery.matches) {
  document.body.classList.add("arrange-mode");

  // The versioned storage key prevents an older saved-state shape from being
  // mistaken for the current one. `previousStorageKeys` are removed by Reset.
  const storageKey = "mckenzieryan-work-gallery-state-v2";
  const previousStorageKeys = [
    "mckenzieryan-work-gallery-state",
    "mckenzieryan-work-gallery-order",
  ];
  const storageVersion = 2;

  // In this file, `columnGroups` are the three rendered column DOM elements.
  // Later, `grids` will mean three Muuri instances attached to those elements.
  const columnGroups = [
    ...gallery.querySelectorAll(":scope > .gallery-column"),
  ];
  const unplacedGroup = gallery.querySelector(":scope > .gallery-unplaced");

  // Names beginning with `configured` come from data-* attributes rendered by
  // WorkGallery.astro. HTML attributes contain text, so JSON.parse reconstructs
  // the arrays. `|| "[]"` provides safe empty JSON when an attribute is absent.
  const configuredColumns = JSON.parse(gallery.dataset.galleryColumns || "[]");
  const configuredUnplaced = JSON.parse(
    gallery.dataset.galleryUnplaced || "[]",
  );
  const configuredFavorites = JSON.parse(
    gallery.dataset.galleryFavorites || "[]",
  );
  const configuredPinned = JSON.parse(gallery.dataset.galleryPinned || "[]");

  // Exactly three Work columns are both a production and editor invariant.
  if (columnGroups.length !== 3) {
    throw new Error("Arrange mode requires exactly three gallery columns.");
  }

  // --- Discovering and validating the available photos -------------------

  // `itemElements` and `unplacedElements` are browser DOM elements, not Muuri
  // items. `allElements` is their combined collection. `sourceOrder` reduces
  // each element to the stable photo ID stored in data-image-id.
  const itemElements = columnGroups.flatMap((column) => [...column.children]);
  const unplacedElements = [...(unplacedGroup?.children || [])];
  const allElements = [...itemElements, ...unplacedElements];
  const sourceOrder = allElements.map((item) => item.dataset.imageId);

  // These `valid...` helpers are Boolean questions. They protect the editor
  // from malformed HTML attributes or old localStorage rather than assuming
  // that parsed JSON has the expected shape.
  const validIds = (ids) =>
    Array.isArray(ids) &&
    new Set(ids).size === ids.length &&
    ids.every((id) => sourceOrder.includes(id));
  const validColumns = (columns) =>
    Array.isArray(columns) &&
    columns.length === 3 &&
    columns.every(validIds) &&
    validIds(columns.flat());

  // A pin slot is our { column, index } description of a pinned position.
  // The checks ensure both coordinates are non-negative integers in range.
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

  // `source...` names mean the trusted starting state. Prefer valid configured
  // columns; otherwise fall back to empty columns and derive unplaced IDs from
  // the rendered source order. Array spreads create copies before editing.
  const sourceColumns = validColumns(configuredColumns)
    ? configuredColumns.map((column) => [...column])
    : [[], [], []];
  const sourceUnplaced = validIds(configuredUnplaced)
    ? configuredUnplaced.filter((id) => !sourceColumns.flat().includes(id))
    : sourceOrder.filter((id) => !sourceColumns.flat().includes(id));

  // --- Mutable editor state and saved-state restoration -------------------

  // Sets suit favorites and pins because they store unique IDs and provide a
  // quick `has(id)` membership question. `columns` and `unplaced` are ordinary
  // arrays because their order matters. `pinSlots` maps pinned IDs to positions.
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

  // localStorage returns text or null. JSON.parse may throw when text is
  // malformed, so a failed restore deliberately becomes `savedState = null`.
  try {
    savedState = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    savedState = null;
  }

  // A saved order is restored only when its schema version and each collection
  // are valid, and when it accounts for every current rendered photo exactly
  // once. This prevents renamed/added assets from corrupting the editor.
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

  // Favorites, pins, and slots can be restored independently after the main
  // photo order is accepted. A missing property simply fails its validity test.
  if (savedState && validIds(savedState.favorites))
    favorites = new Set(savedState.favorites);
  if (savedState && validIds(savedState.pinned))
    pinned = new Set(savedState.pinned);
  if (savedState && validPinSlots(savedState.pinSlots))
    pinSlots = savedState.pinSlots;

  // --- Turning IDs into placed DOM elements -------------------------------

  // `itemsById` is a Map from stable ID to DOM element. It avoids repeatedly
  // searching the page whenever an ordered ID must become a visible element.
  const itemsById = new Map(
    allElements.map((item) => [item.dataset.imageId, item]),
  );

  // `placeElements` makes the initial DOM match our arrays before Muuri takes
  // ownership. append() moves an existing element; it does not duplicate it.
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

  // From this point, a plain `item` received from Muuri is a Muuri item wrapper.
  // getItemId reaches through it to the DOM element and its data-image-id.
  const getItemId = (item) => item.getElement().dataset.imageId;
  const getItemsById = (items) =>
    new Map(items.map((item) => [getItemId(item), item]));

  // `getElements` explicitly returns DOM elements, preserving the important
  // Elements-versus-Muuri-Items naming distinction.
  const getElements = () => [...gallery.querySelectorAll(".gallery-item")];

  // Configured pins may not yet have explicit saved slots. Derive each missing
  // slot from its current configured column and index.
  pinned.forEach((id) => {
    if (pinSlots[id]) return;
    const column = columns.findIndex((items) => items.includes(id));
    const index = column === -1 ? 0 : columns[column].indexOf(id);
    if (column !== -1) pinSlots[id] = { column, index };
  });

  // Despite its historical name, `normalizedSourceColumns` is a copied snapshot
  // of the validated/restored columns before pin normalization. The next helper
  // performs the actual normalization. The name is not a TypeScript concept.
  const normalizedSourceColumns = columns.map((column) => [...column]);

  // `normalizePinnedSlots` removes pinned IDs from candidate columns, then
  // inserts them once at their recorded positions. Clamping protects against a
  // saved index that is larger than a changed column.
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

  // --- Synchronizing live Muuri order back into ordinary state ------------

  // `syncColumnsFromGrids` reads what Muuri currently displays and makes our
  // `columns`/`unplaced` arrays agree. In the third grid, staged unplaced photos
  // remain unplaced only while they stay after the last committed photo.
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

  // `persist` has one precise meaning here: serialize the current editor state
  // as JSON and write it to browser localStorage for a future reload.
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

  // Most user operations need the same three-step transaction: read the grids,
  // reapply normalized pin positions, then save the resulting arrays.
  const syncAndPersist = () => {
    syncColumnsFromGrids();
    applyColumnsToGrids();
    persist();
  };

  // --- Muuri layout calculation -------------------------------------------

  // Convert the CSS row-gap text (for example, "24px") into a usable number.
  // A missing or unparseable value safely becomes zero.
  const galleryGap = () => {
    const value = getComputedStyle(columnGroups[0]).rowGap;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Muuri calls this custom layout function with its items and a completion
  // callback. `slots` is Muuri's flat [x, y, x, y...] coordinate array; it is
  // unrelated to our `pinSlots`. Overview treats every item as a square.
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

  // --- Building the editor toolbar ----------------------------------------

  // These controls exist only in arrange mode, so JavaScript creates them
  // rather than shipping hidden editor markup in the production component.
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

  // --- Shared favorite and pin button presentation ------------------------

  // `updateToggleButton` changes the visible symbol and accessibility state for
  // an existing button. The two smaller helpers supply feature-specific labels
  // and decide whether their ID is currently active.
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

  // --- Adding controls to every photo -------------------------------------

  // Here `item` is a DOM element returned by getElements, not a Muuri item.
  // The controls remember the same stable ID as their parent photograph.
  getElements().forEach((item) => {
    item.style.position = "absolute";
    const id = item.dataset.imageId;
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "arrange-favorite-button";
    favoriteButton.dataset.imageId = id;
    updateFavoriteButton(favoriteButton, id);

    // Stopping pointerdown prevents pressing the small button from also
    // beginning a Muuri drag on its parent item.
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
      // Find the live Muuri wrapper and its present grid coordinates so a newly
      // pinned photo can remember exactly where it was when pinned.
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

  // --- Creating the three live Muuri grids --------------------------------

  // Each rendered column gets one Muuri instance. `dragSort` returns all three,
  // allowing items to move between them. The drag predicate blocks pinned IDs
  // and requires a small movement threshold before treating a pointer as drag.
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

  // --- Applying ordinary column state to Muuri ----------------------------

  // `applyColumnsToGrids` is the opposite direction from
  // syncColumnsFromGrids: it makes each live Muuri grid reflect our arrays.
  // `isApplyingState` prevents the resulting sort events from being mistaken
  // for a fresh user edit.
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

  // Masonry uses natural image heights; overview uses square items. The mode is
  // reflected both in a CSS class and each toggle button's aria-pressed state.
  const setLayout = (layout) => {
    const overview = layout === "overview";
    gallery.classList.toggle("is-overview", overview);
    masonryButton.setAttribute("aria-pressed", String(!overview));
    overviewButton.setAttribute("aria-pressed", String(overview));
    grids.forEach((grid) => grid.refreshItems().layout(true));
  };

  // --- Responding to Muuri drag and sort events ---------------------------

  // A drag can emit several Muuri events. The Boolean flags ensure one user
  // operation is synchronized without recursive work during programmatic sorts.
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

  // Image dimensions affect the custom stack layout. Refresh after each image
  // succeeds or fails to load, and immediately when it is already complete.
  getElements().forEach((item) => {
    const image = item.querySelector("img");
    if (!image) return;
    const refresh = () => grids.forEach((grid) => grid.refreshItems().layout());
    image.addEventListener("load", refresh, { once: true });
    image.addEventListener("error", refresh, { once: true });
    if (image.complete) refresh();
  });

  // --- Randomizing movable photos -----------------------------------------

  // Favorites are placed before other movable photos; pinned photos keep their
  // slots. The backwards loop is the Fisher-Yates shuffle for unbiased order.
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

  // --- Toolbar actions -----------------------------------------------------

  // Reset clears current and legacy saved keys, then reloads the configured
  // source state. The layout buttons only change the editor's visual view.
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

  // --- Exporting an arrangement back to TypeScript ------------------------

  // `async` allows this callback to await the Clipboard Promise. The template
  // literal converts current columns into paste-ready TypeScript source; it
  // does not edit photos.ts itself. The textarea remains a manual fallback when
  // browser clipboard permission is unavailable.
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

  // Initialize the visible editor only after state, controls, grids, and event
  // handlers are ready.
  setLayout("masonry");
}
