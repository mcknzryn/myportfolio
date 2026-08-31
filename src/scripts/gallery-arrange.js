import Muuri from "muuri";

const params = new URLSearchParams(window.location.search);
const arrangeEnabled = params.get("arrange") === "1";
const gallery = document.querySelector(".gallery");

if (arrangeEnabled && gallery) {
  document.body.classList.add("arrange-mode");

  const storageKey = "mckenzieryan-work-gallery-state";
  const legacyStorageKey = "mckenzieryan-work-gallery-order";
  const configuredColumns = JSON.parse(gallery.dataset.galleryColumns || "[]");
  const configuredUnplaced = JSON.parse(gallery.dataset.galleryUnplaced || "[]");
  const columnGroups = [...gallery.querySelectorAll(".gallery-column")];
  const unplacedGroup = gallery.querySelector(".gallery-unplaced");
  columnGroups.forEach((column) => {
    [...column.children].forEach((item) => gallery.append(item));
    column.remove();
  });
  [...(unplacedGroup?.children || [])].forEach((item) => gallery.append(item));
  unplacedGroup?.remove();

  const sourceOrder = [...gallery.children].map((item) => item.dataset.imageId);
  const configuredFavorites = JSON.parse(gallery.dataset.galleryFavorites || "[]");
  const configuredPinned = JSON.parse(gallery.dataset.galleryPinned || "[]");
  const validIds = (ids) => Array.isArray(ids)
    && new Set(ids).size === ids.length
    && ids.every((id) => sourceOrder.includes(id));
  const validColumns = (columns) => Array.isArray(columns)
    && columns.length === 3
    && columns.every(validIds)
    && validIds(columns.flat());
  const validOrder = (order) => Array.isArray(order)
    && order.length === sourceOrder.length
    && new Set(order).size === order.length
    && order.every((id) => sourceOrder.includes(id));

  const sourceColumns = validColumns(configuredColumns)
    ? configuredColumns.map((column) => [...column])
    : [[], [], []];
  const sourceUnplaced = validIds(configuredUnplaced)
    ? configuredUnplaced.filter((id) => !sourceColumns.flat().includes(id))
    : sourceOrder.filter((id) => !sourceColumns.flat().includes(id));

  let favorites = validIds(configuredFavorites) ? new Set(configuredFavorites) : new Set();
  let pinned = validIds(configuredPinned) ? new Set(configuredPinned) : new Set();
  let columns = sourceColumns.map((column) => [...column]);
  let unplaced = [...sourceUnplaced];
  let anchors = {};
  let savedState;
  let grid;
  let isDragging = false;

  try {
    savedState = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    savedState = null;
  }

  if (!savedState) {
    try {
      const legacyOrder = JSON.parse(localStorage.getItem(legacyStorageKey));
      if (validOrder(legacyOrder)) {
        savedState = { order: legacyOrder, favorites: [...favorites], pinned: [...pinned], anchors: {} };
      }
    } catch {
      savedState = null;
    }
  }

  const savedColumns = savedState?.columns;
  const savedUnplaced = savedState?.unplaced;
  if (savedState && validColumns(savedColumns) && validIds(savedUnplaced)) {
    const savedIds = savedColumns.flat();
    const savedUnplacedIds = savedUnplaced.filter((id) => !savedIds.includes(id));
    if (validIds([...savedIds, ...savedUnplacedIds]) && [...savedIds, ...savedUnplacedIds].length === sourceOrder.length) {
      columns = savedColumns.map((column) => [...column]);
      unplaced = savedUnplacedIds;
    }
  } else if (savedState && validOrder(savedState.order)) {
    const firstColumnEnd = sourceColumns[0].length;
    const secondColumnEnd = firstColumnEnd + sourceColumns[1].length;
    columns = [
      savedState.order.slice(0, firstColumnEnd),
      savedState.order.slice(firstColumnEnd, secondColumnEnd),
      savedState.order.slice(secondColumnEnd),
    ];
  }
  const itemsById = new Map([...gallery.children].map((item) => [item.dataset.imageId, item]));
  [...columns.flat(), ...unplaced].forEach((id) => {
    const item = itemsById.get(id);
    if (item) gallery.append(item);
  });

  const savedAnchors = savedState?.anchors;
  if (savedState && validIds(savedState.favorites)) favorites = new Set(savedState.favorites);
  if (savedState && validIds(savedState.pinned)) pinned = new Set(savedState.pinned);
  if (savedAnchors && typeof savedAnchors === "object" && !Array.isArray(savedAnchors)) anchors = savedAnchors;

  const getElements = () => [...gallery.querySelectorAll(".gallery-item")];
  const getOrder = () => grid
    ? grid.getItems().map((item) => item.getElement().dataset.imageId)
    : getElements().map((item) => item.dataset.imageId);
  const getWorkingColumns = () => {
    const workingColumns = columns.map((column) => [...column]);
    workingColumns[2].push(...unplaced);
    return workingColumns;
  };
  const getItemId = (item) => item.getElement().dataset.imageId;
  const getItemsById = (items) => new Map(items.map((item) => [getItemId(item), item]));
  const getColumnCount = (width) => (width <= 600 ? 1 : width <= 900 ? 2 : 3);
  const gap = 24;

  const isValidAnchor = (anchor) => anchor
    && Number.isFinite(anchor.x)
    && Number.isFinite(anchor.y)
    && Number.isFinite(anchor.width);

  const getAnchor = (id, width) => {
    const anchor = anchors[id];
    if (!isValidAnchor(anchor)) return null;
    return {
      x: anchor.x * width,
      y: anchor.y * width,
      width: anchor.width * width,
    };
  };

  const rectanglesOverlap = (a, b) => (
    a.left < b.left + b.width
      && a.left + a.width > b.left
      && a.top < b.top + b.height
      && a.top + a.height > b.top
  );

  const createLayout = (grid, layoutId, items, width, height, callback) => {
    const columns = getColumnCount(width);
    const columnWidth = (width - gap * (columns - 1)) / columns;
    const slots = [];
    const placed = [];
    const pinnedRects = [];
    const columnById = new Map(
      getWorkingColumns().flatMap((column, columnIndex) => column.map((id) => [id, columnIndex])),
    );
    const currentMode = gallery.classList.contains("is-overview") ? "overview" : "masonry";

    items.forEach((item) => {
      const id = getItemId(item);
      if (!pinned.has(id)) return;
      const anchor = getAnchor(id, width);
      if (!anchor) return;
      const itemHeight = currentMode === "overview" ? columnWidth : item.getHeight();
      const itemWidth = currentMode === "overview" ? columnWidth : Math.min(columnWidth, anchor.width || columnWidth);
      const rect = {
        left: Math.max(0, Math.min(width - itemWidth, anchor.x)),
        top: Math.max(0, anchor.y),
        width: itemWidth,
        height: itemHeight,
      };
      pinnedRects.push(rect);
      placed.push({ id, rect });
    });

    const columnBottoms = Array(columns).fill(0);
    const placeItem = (item, x, initialY, itemWidth, itemHeight) => {
      let y = initialY;
      let candidate = { left: x, top: y, width: itemWidth, height: itemHeight };
      let collision;
      do {
        collision = [...pinnedRects, ...placed.map(({ rect }) => rect)].find((rect) => rectanglesOverlap(candidate, rect));
        if (collision) {
          y = collision.top + collision.height + gap;
          candidate = { left: x, top: y, width: itemWidth, height: itemHeight };
        }
      } while (collision);
      placed.push({ id: getItemId(item), rect: candidate });
      return candidate;
    };

    items.forEach((item) => {
      const id = getItemId(item);
      const pinnedAnchor = pinned.has(id) ? getAnchor(id, width) : null;
      const rect = pinnedAnchor
        ? placed.find((entry) => entry.id === id)?.rect
        : (() => {
          const column = Math.max(0, Math.min(columns - 1, columnById.get(id) ?? 2));
          const itemWidth = currentMode === "overview" ? columnWidth : columnWidth;
          const itemHeight = currentMode === "overview" ? columnWidth : item.getHeight();
          const result = placeItem(
            item,
            column * (columnWidth + gap),
            columnBottoms[column],
            itemWidth,
            itemHeight,
          );
          columnBottoms[column] = result.top + result.height + gap;
          return result;
        })();
      slots.push(rect.left, rect.top);
    });

    const maxBottom = placed.reduce((bottom, { rect }) => Math.max(bottom, rect.top + rect.height), 0);
    callback({
      id: layoutId,
      items,
      slots,
      styles: { width: `${width}px`, height: `${Math.max(maxBottom, 1)}px` },
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
  output.setAttribute("aria-label", "Gallery order code");
  output.hidden = true;
  output.readOnly = true;
  toolbar.append(note, resetButton, randomizeButton, masonryButton, overviewButton, copyButton);
  gallery.before(toolbar, output);

  const getPublishedColumns = () => {
    const width = Math.max(gallery.getBoundingClientRect().width, 1);
    if (getColumnCount(width) !== 3 || !grid) return columns.map((column) => [...column]);
    const columnWidth = (width - gap * 2) / 3;
    const publishedColumns = [[], [], []];
    grid.getItems().forEach((item) => {
      const position = item.getPosition();
      const column = Math.max(0, Math.min(
        2,
        Math.round(position.left / Math.max(columnWidth + gap, 1)),
      ));
      publishedColumns[column].push({ id: getItemId(item), top: position.top });
    });
    return publishedColumns.map((column) => column
      .sort((first, second) => first.top - second.top)
      .map(({ id }) => id));
  };

  const syncColumnsFromLayout = () => {
    const publishedColumns = getPublishedColumns();
    const committedColumns = columns.map((column) => [...column]);
    const stagedIds = new Set(unplaced);
    const nextUnplaced = [];
    const nextColumns = publishedColumns.map((column, columnIndex) => column.filter((id, index) => {
      if (!stagedIds.has(id)) return true;
      const stagedIndex = unplaced.indexOf(id);
      const isStillStaged = columnIndex === 2
        && index === committedColumns[2].length + stagedIndex;
      if (isStillStaged) nextUnplaced.push(id);
      return !isStillStaged;
    }));
    if (nextColumns.length === 3) columns = nextColumns;
    unplaced = nextUnplaced;
  };

  const persist = () => {
    localStorage.setItem(storageKey, JSON.stringify({
      columns,
      unplaced,
      order: columns.flat(),
      favorites: [...favorites],
      pinned: [...pinned],
      anchors,
    }));
  };
  const save = () => {
    syncColumnsFromLayout();
    persist();
  };
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
    grid.layout(true);
  };

  getElements().forEach((item) => {
    item.style.position = "absolute";
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
      if (pinned.has(id)) {
        pinned.delete(id);
        delete anchors[id];
      } else {
        const rect = item.getBoundingClientRect();
        const galleryRect = gallery.getBoundingClientRect();
        const width = Math.max(galleryRect.width, 1);
        anchors[id] = {
          x: (rect.left - galleryRect.left) / width,
          y: (rect.top - galleryRect.top) / width,
          width: rect.width / width,
        };
        pinned.add(id);
      }
      updatePinButton(pinButton, id);
      grid.layout(true);
      save();
    });
    item.append(favoriteButton, pinButton);
  });

  grid = new Muuri(gallery, {
    items: ".gallery-item",
    dragEnabled: true,
    dragContainer: document.body,
    dragStartPredicate: (item, event) => {
      if (pinned.has(getItemId(item))) return false;
      if (event.isFinal) return undefined;
      return event.distance >= 8 ? true : undefined;
    },
    layout: createLayout,
    layoutOnResize: 150,
    layoutDuration: 250,
    dragRelease: { duration: 250 },
  });

  grid.on("layoutEnd", () => {
    const galleryRect = gallery.getBoundingClientRect();
    const width = Math.max(galleryRect.width, 1);
    const items = grid.getItems();
    let changed = false;
    items.forEach((item) => {
      const id = getItemId(item);
      if (!pinned.has(id) || isValidAnchor(anchors[id])) return;
      const position = item.getPosition();
      anchors[id] = { x: position.left / width, y: position.top / width, width: item.getWidth() / width };
      changed = true;
    });
    if (changed) save();
  });
  getElements().forEach((item) => {
    const image = item.querySelector("img");
    if (!image) return;
    const refresh = () => grid.refreshItems().layout();
    image.addEventListener("load", refresh, { once: true });
    image.addEventListener("error", refresh, { once: true });
    if (image.complete) refresh();
  });

  const commitDrag = (draggedItem) => {
    const draggedId = getItemId(draggedItem);
    const draggedRect = draggedItem.getElement().getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();
    const width = Math.max(galleryRect.width, 1);
    const columnWidth = (width - gap * 2) / 3;
    const centerX = draggedRect.left + draggedRect.width / 2 - galleryRect.left;
    const targetColumn = Math.max(0, Math.min(
      2,
      Math.floor(centerX / Math.max(columnWidth + gap, 1)),
    ));
    const targetTop = draggedRect.top - galleryRect.top;
    const stagedIds = new Set(unplaced);
    const workingColumns = getWorkingColumns().map((column) => column.filter((id) => id !== draggedId));
    const itemsById = getItemsById(grid.getItems());
    const targetItems = workingColumns[targetColumn]
      .map((id) => itemsById.get(id))
      .filter(Boolean)
      .sort((first, second) => first.getPosition().top - second.getPosition().top);
    const targetIndex = targetItems.findIndex((item) => {
      const position = item.getPosition();
      return position.top + item.getHeight() / 2 > targetTop;
    });
    const insertionIndex = targetIndex === -1 ? workingColumns[targetColumn].length : targetIndex;
    const draggedWasUnplaced = unplaced.includes(draggedId);

    const stagedDrop = draggedWasUnplaced
      && targetColumn === 2
      && insertionIndex >= columns[2].length;
    columns = workingColumns.map((column) => column.filter((id) => !stagedIds.has(id)));
    unplaced = unplaced.filter((id) => id !== draggedId);
    if (stagedDrop) {
      const stagedIndex = Math.max(0, insertionIndex - columns[2].length);
      unplaced.splice(Math.min(stagedIndex, unplaced.length), 0, draggedId);
    } else {
      const committedIndex = targetColumn === 2
        ? Math.min(insertionIndex, columns[2].length)
        : insertionIndex;
      columns[targetColumn].splice(Math.min(committedIndex, columns[targetColumn].length), 0, draggedId);
    }
  };

  grid.on("dragStart", () => {
    isDragging = true;
  });
  grid.on("dragEnd", (item) => {
    commitDrag(item);
    grid.synchronize();
    grid.layout(true);
    persist();
    isDragging = false;
  });
  grid.on("sort", () => {
    grid.synchronize();
    if (!isDragging) save();
  });

  const getCurrentItems = () => grid.getItems();
  const sortByIds = (ids) => {
    const itemsById = getItemsById(getCurrentItems());
    grid.sort(ids.map((id) => itemsById.get(id)), { layout: "instant" });
    grid.synchronize();
  };
  const snippet = () => {
    syncColumnsFromLayout();
    return `const galleryColumns = [\n${columns
    .map((column) => `  [${column.map((id) => JSON.stringify(id)).join(", ")}]`)
    .join(",\n")}\n];`;
  };

  resetButton.addEventListener("click", () => {
    favorites.clear();
    pinned.clear();
    anchors = {};
    columns = sourceColumns.map((column) => [...column]);
    unplaced = [...sourceUnplaced];
    sortByIds(getWorkingColumns().flat());
    getElements().forEach((item) => {
      updateFavoriteButton(item.querySelector(".arrange-favorite-button"), item.dataset.imageId);
      updatePinButton(item.querySelector(".arrange-pin-button"), item.dataset.imageId);
    });
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyStorageKey);
    setLayout("masonry");
    output.hidden = true;
  });

  randomizeButton.addEventListener("click", () => {
    const currentOrder = getOrder();
    const movable = currentOrder.filter((id) => !pinned.has(id));
    const favoriteMovable = movable.filter((id) => favorites.has(id));
    const remaining = movable.filter((id) => !favorites.has(id));
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
    }
    const randomized = [...favoriteMovable, ...remaining];
    const result = [];
    let movableIndex = 0;
    currentOrder.forEach((id) => {
      result.push(pinned.has(id) ? id : randomized[movableIndex++]);
    });
    sortByIds(result);
    save();
    output.hidden = true;
  });

  masonryButton.addEventListener("click", () => setLayout("masonry"));
  overviewButton.addEventListener("click", () => setLayout("overview"));
  setLayout("masonry");

  copyButton.addEventListener("click", async () => {
    const text = snippet();
    save();
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
}
