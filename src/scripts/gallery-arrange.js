const params = new URLSearchParams(window.location.search);
const arrangeEnabled = params.get("arrange") === "1";
const gallery = document.querySelector(".gallery");

if (arrangeEnabled && gallery) {
  document.body.classList.add("arrange-mode");
  const storageKey = "mckenzieryan-work-gallery-order";
  const sourceOrder = [...gallery.children].map((item) => item.dataset.imageId);
  const validOrder = (order) => {
    if (!Array.isArray(order)) return false;
    const available = new Set(sourceOrder);
    return order.length === sourceOrder.length
      && new Set(order).size === order.length
      && order.every((id) => available.has(id));
  };

  const getOrder = () => [...gallery.children].map((item) => item.dataset.imageId);
  const applyOrder = (order) => {
    const items = new Map([...gallery.children].map((item) => [item.dataset.imageId, item]));
    order.forEach((id) => gallery.append(items.get(id)));
  };

  let savedOrder;
  try {
    savedOrder = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    savedOrder = null;
  }
  if (validOrder(savedOrder)) applyOrder(savedOrder);

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

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy order";

  const output = document.createElement("textarea");
  output.className = "arrange-output";
  output.setAttribute("aria-label", "Gallery order code");
  output.hidden = true;
  output.readOnly = true;

  toolbar.append(note, resetButton, randomizeButton, copyButton);
  gallery.before(toolbar, output);

  const save = () => localStorage.setItem(storageKey, JSON.stringify(getOrder()));
  const snippet = () => `const galleryOrder = [\n  ${getOrder().map((id) => JSON.stringify(id)).join(", ")}\n];`;

  resetButton.addEventListener("click", () => {
    applyOrder(sourceOrder);
    localStorage.removeItem(storageKey);
    output.hidden = true;
  });

  randomizeButton.addEventListener("click", () => {
    const randomized = getOrder();
    for (let index = randomized.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [randomized[index], randomized[swapIndex]] = [randomized[swapIndex], randomized[index]];
    }
    applyOrder(randomized);
    save();
    output.hidden = true;
  });

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
    if (!target || target === item || !gallery.contains(target)) return;
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
      save();
    }
    if (event?.pointerId !== undefined) event.preventDefault();
    dragState = null;
  };

  gallery.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const item = event.target.closest(".gallery-item");
    if (!item) return;
    const rect = item.getBoundingClientRect();
    dragState = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalStyle: item.style.cssText,
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
