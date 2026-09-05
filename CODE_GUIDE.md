# Code Guide

This guide is a plain-language companion to the JavaScript and TypeScript in the portfolio. It is meant to help you open a source file, recognize the pieces, and understand why they are there.

The comments inside the source files explain local details. This guide explains ideas that appear in several files so those ideas do not need to be re-taught beside every line.

## First: which names belong to whom?

Code mixes several kinds of vocabulary. It helps to know whether a name is part of the language, supplied by another tool, or simply a name chosen for this project.

- **JavaScript and TypeScript language names** include `const`, `let`, `if`, `return`, `new`, `typeof`, `interface`, and `readonly`. Their meanings are defined by the languages.
- **Browser API names** include `document`, `window`, `localStorage`, `IntersectionObserver`, `URLSearchParams`, `Map`, and `Set`. Browsers provide these objects when client-side code runs.
- **Astro names** include `Astro.props`, `Astro.url`, `Image`, `ImageMetadata`, `import.meta.glob`, and `import.meta.env.DEV`.
- **Testing-library names** include Vitest's `describe`, `it`, and `expect`, plus Playwright's `test`, `page`, and browser projects.
- **Muuri names** include `Muuri`, a `grid`, and Muuri methods such as `getItems`, `sort`, `layout`, and `synchronize`.
- **Project names** include `photoMetadata`, `homePhotoIds`, `workGalleryColumns`, `revealWhenReady`, `pinSlots`, and almost every other descriptive variable or function name. These are not secret JavaScript commands. They were chosen to describe this particular site's ideas.

When a source comment says “we call this…,” it is calling attention to a project-created name.

## JavaScript, TypeScript, and Astro

### JavaScript

JavaScript supplies the behavior that runs in a visitor's browser. The files in `src/scripts/` find HTML elements that Astro has already rendered and progressively enhance them:

- `gallery-reveal.js` reveals Work images as they approach the viewport.
- `gallery-arrange.js` turns the Work gallery into a development-only visual editor.

These particular files use plain `.js`, although browser code can also be written in TypeScript. Their values come from a live page, so the scripts must still check for elements at runtime; TypeScript annotations could assist development but could not guarantee what a browser page actually contains.

### TypeScript

TypeScript is JavaScript with extra descriptions of what values are allowed. Those descriptions are called **types**. Astro and the test runner check the types before the site is built, but the descriptions do not become extra browser behavior.

For example, `PhotoId` says that a valid photo ID must be one of the keys in `photoMetadata`. If a mistyped ID is added to a gallery list, TypeScript can report the error before the page runs.

TypeScript appears in `.ts` files and inside Astro frontmatter or Astro `<script>` blocks. Syntax such as `: number`, `<HTMLElement>`, `interface`, and `satisfies` is TypeScript.

### The two worlds inside an Astro component

An `.astro` file can contain code that runs at different times:

1. Code between the opening and closing `---` fences runs while Astro renders the page. It can import photo records and decide which HTML to produce.
2. The component's HTML is sent to the browser.
3. Code inside a `<script>` element runs in the visitor's browser after that HTML exists. It can listen for clicks, measure images, or change classes.

This distinction explains why `WorkGallery.astro` can read typed photo data during rendering, while `gallery-reveal.js` later finds the resulting `<img>` elements with `document.querySelectorAll`.

## How a photograph moves through the site

```text
image file in src/assets/photos/
             |
             v
src/data/photos.ts pairs its filename ID with alt text and gallery placement
             |
             v
photo-validation.ts checks that the complete configuration agrees
             |
             +--------------------------+
             v                          v
HomeSlideshow.astro                WorkGallery.astro
renders Home HTML                  renders Work HTML and photo IDs
             |                          |
             v                          +-------------------------+
Home browser script                v                         v
controls slides           gallery-reveal.js         gallery-arrange.js
                          reveals images             edits DEV order only
```

The image file's basename is its stable ID. For example, `29.jpg` has the ID `"29"`. Code uses that short ID to join four things that have different jobs:

- A **photo ID** is a stable string used in configuration and saved state.
- A **photo record** is a TypeScript object containing the ID, optimized Astro image metadata, and alt text.
- A **DOM element** is the browser's live representation of a rendered `.gallery-item` HTML element.
- A **Muuri item** is Muuri's wrapper around that DOM element. It also stores layout and drag information.

Those are four representations of one photograph, not four photographs. Suffixes such as `Ids`, `Elements`, and `Items` make it clearer which representation a variable holds.

## Project naming conventions

The names are designed to carry small clues about their values and responsibilities.

### Common verbs

- `get...` retrieves something and returns it, such as `getPhoto` or `getItemId`.
- `update...` changes presentation or recalculates a derived value, such as `updateDesktopControls`.
- `apply...` takes state the script already knows and makes another system reflect it. `applyColumnsToGrids`, for example, makes Muuri's order match the `columns` arrays.
- `sync...` reads one representation and reconciles another with it. `syncColumnsFromGrids` reads Muuri's current order back into ordinary arrays.
- `persist...` writes the current state somewhere that survives the immediate operation. In arrange mode it means saving to `localStorage`.
- `normalize...` takes values that may have several valid-looking shapes and produces the single valid shape the rest of the script expects.
- `show...`, `start...`, `stop...`, and `reveal...` describe direct actions.
- `validate...` checks rules and reports invalid data rather than changing it.

These verbs are conventions chosen for readability; JavaScript does not give them special behavior.

### Boolean questions

Names beginning with `is...`, `has...`, or `can...` normally hold or return `true`/`false`:

- `isDragging` answers “is a drag happening now?”
- `isApplyingState` answers “is the script itself currently reordering Muuri?”
- `has(id)` is a standard `Set` or `Map` method that asks whether a value exists.
- `canAutoplay()` answers whether all current conditions permit autoplay.

The word `valid`, as in `validIds`, is also being used as a Boolean question even though it does not begin with `is`.

### Collection suffixes

- `...Ids` contains strings such as `"29"`.
- `...Elements` contains browser DOM elements.
- `...Items` contains items, often Muuri item wrappers in arrange mode.
- `...Columns` contains three arrays, one for each visible Work column.
- `...ById` is a lookup keyed by photo ID. It avoids repeatedly searching a larger list.

A singular name such as `image`, `slide`, or `column` usually means one value. The plural form usually means an array, set, map, or other collection.

### Capitalization and smaller naming clues

- `camelCase` names such as `currentIndex` and `showSlide` are ordinary values and functions created by the project.
- `PascalCase` names such as `PhotoId`, `PhotoRecord`, `Image`, and `Muuri` are types, components, or classes. Some come from this project and others come from libraries, so capitalization alone does not identify the owner.
- A leading underscore in `_grid` or `_height` says “Muuri passes this required callback argument, but our layout calculation does not use it.” The underscore has no special JavaScript power.
- `...Index` is a numbered position in an ordered collection; indexes begin at zero in JavaScript.
- `...Button`, `...Image`, and `...Group` usually name DOM elements. `...Query` usually names the result of `matchMedia`, which can report and watch a media-query condition.
- `...Key` is commonly a lookup or storage key, `...Version` identifies a data format, and `...Rect` is a rectangle returned by the browser's `getBoundingClientRect` API.
- `candidate` means one possible value currently being tested, while `entry` means one member supplied while iterating a collection or observer report.
- A **predicate** is a function that answers a Boolean question. `dragStartPredicate` is Muuri's configured decision function for whether a pointer movement may begin a drag.

### Names that describe a processing stage

- `source...` is the trusted starting arrangement derived from rendered page content.
- `configured...` came from the data attributes that Astro rendered from `photos.ts`.
- `saved...` came from the browser's previous `localStorage` state.
- `next...` is a candidate value being calculated but not yet committed as current state.
- `normalized...` has been transformed so it obeys the script's rules.
- `current...` describes the state active now.
- `previous...` describes an older value or version.

This vocabulary matters in arrange mode because configuration, rendered HTML, saved browser state, and a live Muuri grid can all contain an order at the same time.

### Gallery vocabulary

- `gallery` is the outer element containing the complete visual feature.
- `stage` is the area where Home displays one active slideshow image. The name suggests a place where one current subject is presented.
- `slide` is one Home slideshow entry.
- `column` is one of the three ordinary arrays or rendered Work columns.
- `grid` is a live Muuri instance attached to a rendered column. The production design looks like three columns; Muuri calls each managed container a grid.
- `item` means one member of a collection. In Muuri callbacks it specifically means a Muuri item, while names such as `itemElements` make DOM elements explicit.
- `unplaced` means photos known to arrange mode but staged after the committed third column. They have not yet been included in exported production columns.
- `favorite` marks a photo that randomization should prioritize among movable images.
- `pinned` marks a photo that randomization and dragging should not move.
- `pinSlots` records the column and index where each pinned photo belongs. `slots` here means saved positions, not Astro's `<slot>` feature.

One current name needs a caveat: `normalizedSourceColumns` in arrange mode is a historical, slightly imprecise name. At that line it is a copied snapshot of already validated/restored columns; the following call to `normalizePinnedSlots` performs the pin-position normalization. The source comment calls this out rather than pretending that the variable name is a TypeScript term.

## Reading `photos.ts`

`photos.ts` is the canonical bridge between image files and the rest of the site.

### Imports and the asset glob

`import type { ImageMetadata }` imports only a TypeScript description. It produces no runtime import.

`import.meta.glob` is an Astro/Vite feature. The filename pattern finds supported image files at build time. `<{ default: ImageMetadata }>` describes the shape of each imported module, and `{ eager: true }` asks for all matches immediately instead of creating functions that load them later.

### Metadata and IDs

`photoMetadata` is an object whose keys are stable photo IDs and whose values describe the images. `as const` tells TypeScript to preserve exact keys and values instead of widening them to generic strings.

`keyof typeof photoMetadata` asks TypeScript for the union of all keys in that object. Therefore `PhotoId` is derived from the actual metadata rather than being maintained as a separate list.

The Home and Work arrays use `satisfies` to check that every entry is a `PhotoId` while keeping the array's exact values. `readonly` and `as const` communicate that these exported configuration lists are not intended to be mutated at runtime.

### From imported modules to photo records

`assetsById` is a `Map`: a lookup from an ID string to Astro's information about an image. `assetIds` is a separate array because validation also needs to detect duplicates, which a `Map` would collapse into one key.

`Object.entries(imageModules).forEach(...)` visits every matched file. The callback extracts the basename, removes the extension, and stores the result.

`validatePhotoConfiguration(...)` runs as the module loads. An invalid library stops the build close to the source of the error.

`getPhoto` turns an ID into the richer `PhotoRecord` that components need. The final `map` calls create a Home record array and three Work record arrays while preserving the configured order.

## Reading `photo-validation.ts`

`PhotoConfiguration` is an interface: a TypeScript contract describing the object the validator accepts. It deliberately uses general `string` IDs rather than `PhotoId` so tests can pass invented sample names and so runtime validation can inspect untrusted or mismatched data.

The private `duplicates` helper uses two `Set` objects. A `Set` stores each value only once, so `seen` answers whether an ID appeared earlier and `repeated` collects each duplicate once.

`validatePhotoConfiguration` derives a few convenient views, checks each invariant, and accumulates readable messages in `errors`. It does not stop at the first problem. At the end, one thrown `Error` reports every discovered problem together.

Important invariants include:

- Asset basenames and metadata IDs must match.
- Every active asset must appear on Home, Work, or both.
- Home cannot repeat an ID, and Work cannot place one photo more than once.
- Work must have exactly three columns.
- Every informative image needs meaningful alt text.
- Arrange-mode favorites and pins must refer to photos already placed in Work.

## Reading `gallery-reveal.js`

This script is a progressive enhancement: the gallery is readable without it, but it adds a gentle reveal when JavaScript is available.

It first finds the gallery and uses `if (gallery)` as a guard. Everything else is inside that guard so the script safely does nothing on a page without a gallery.

On small screens, the first three images in each column are changed to eager loading. This prepares enough content ahead of the longer mobile reading flow.

The reveal functions form a progression:

- `reveal` changes CSS classes.
- `revealImmediately` applies that action to every image.
- `revealAfterDecode` waits for the browser to decode an already-loaded image when possible.
- `revealWhenReady` chooses whether to decode now or first wait for `load`/`error`.

An `IntersectionObserver` watches without running a scroll handler continuously. Its callback receives entries describing observed images. When an image approaches the visible area, the script stops observing it and begins the load/decode/reveal process.

The outer `try`/`catch` protects the enhancement. If setup fails, the catch reveals everything so a visual effect can never hide the portfolio permanently.

## Reading `gallery-arrange.js`

Arrange mode is a development tool, not part of the production page. `WorkGallery.astro` only includes it when `import.meta.env.DEV` is true, and the script only activates for `?arrange=1` on a desktop-sized viewport.

The script has several representations to coordinate:

1. Astro configuration arrives in `data-*` attributes.
2. Rendered DOM elements provide the trusted set of available photos.
3. Ordinary `columns`, `unplaced`, `favorites`, `pinned`, and `pinSlots` values hold the editor's current state.
4. Muuri grids manage live layout and drag operations.
5. `localStorage` remembers work across reloads.

The source comments divide the script according to those phases. The most important round trip is:

```text
ordinary columns arrays
      | applyColumnsToGrids
      v
live Muuri order
      | user drags
      v
new live Muuri order
      | syncColumnsFromGrids
      v
updated columns arrays
      | persist
      v
localStorage
```

`isDragging` and `isApplyingState` prevent Muuri events from treating programmatic reordering as a new user edit. Without those flags, applying state could trigger synchronization recursively.

The “Copy order” button creates TypeScript source text rather than directly editing `photos.ts`. That keeps the development tool inside the browser's security boundary and leaves the final source-code change under human control.

## Reading the Home slideshow

The frontmatter in `HomeSlideshow.astro` receives typed photo records and renders all slides. The first image loads eagerly; later images can load lazily.

The browser script then manages one `currentIndex`. `showSlide` uses modulo arithmetic to wrap from the last slide to the first and from the first to the last.

Autoplay is split into small decisions and actions:

- `canAutoplay` checks slide count, tab visibility, reduced-motion preference, and keyboard focus.
- `startAutoplay` creates one interval only when allowed.
- `stopAutoplay` clears the interval and resets the tracking variable.
- `resumeAutoplayAfterClick` gives a manual choice a short pause before autoplay resumes.

The script listens for button clicks, arrow keys, focus changes, touch gestures, tab visibility, reduced-motion changes, viewport changes, and image loads. `requestAnimationFrame` groups control-position measurements with the browser's next paint rather than measuring repeatedly in the middle of other work.

Type expressions such as `querySelector<HTMLElement>` tell TypeScript which kind of element is expected. Optional chaining (`?.`) safely skips work if an optional button or image was not found.

## Reading navigation and layout code

`Header.astro` defines its navigation links once, then maps them into desktop and mobile markup. `as const` preserves the exact link values. Its small browser script closes the mobile `<details>` menu after a link click or Escape, and restores focus after Escape for keyboard accessibility.

`BaseLayout.astro` defines a small vocabulary of permitted layout modes. A union such as `"viewport" | "document"` means no other string is valid. `Props` is the contract each page follows when it uses the layout. Destructuring `Astro.props` extracts those values and supplies defaults for optional ones.

`WorkGallery.astro` is the bridge between typed build-time data and browser enhancements. It renders `PhotoRecord` values as images. In development only, it serializes selected configuration arrays with `JSON.stringify` into HTML `data-*` attributes so the plain JavaScript arrange tool can read them.

## Syntax used throughout the project

### Imports and exports

`import` brings a value or type from another module into the current file. `export` makes a value or type available to import elsewhere. `export default` means a module has one primary exported value, as the config files do.

### `const` and `let`

`const` prevents the variable name from being assigned a different value. It does not make an object or array deeply unchangeable. `let` is used where the variable itself must later point to a new value, such as `currentIndex`, `columns`, or a timer ID.

### Functions and callbacks

An arrow function such as `(id) => itemsById.get(id)` is a function expression. A callback is a function passed to another function so it can be called later or for each item. Array methods, event listeners, promises, observers, timers, and Muuri all use callbacks.

### Common array methods

- `map` transforms every entry and returns a new array.
- `forEach` performs an action for every entry and does not create a result array.
- `filter` returns entries that pass a Boolean test.
- `findIndex` returns the position of the first matching entry.
- `flat` removes one level of nested arrays.
- `flatMap` maps entries and then flattens one level.
- `reduce` combines a collection into one result.
- `includes` asks whether an array contains a value.

### Spread syntax

`...` spreads entries out of an array or object. `[...favorites]` converts a `Set` into an array. `{ ...configuration.metadata, two: { alt: "" } }` makes a new object with one property replaced. A `...` parameter can also gather values, depending on where it appears.

### Optional chaining and nullish coalescing

`value?.property` or `value?.method()` continues only when `value` is not `null` or `undefined`. `left ?? right` uses `right` only when `left` is `null` or `undefined`; unlike `||`, it does not replace valid values such as `0` or an empty string.

### Maps and sets

A `Map` stores key/value pairs and is useful for looking up a photo or item by ID. A `Set` stores unique values and is useful for membership questions such as whether an ID is pinned.

### Events, timers, and observers

`addEventListener` registers a callback for a browser event. `{ once: true }` removes it after its first call. `{ passive: true }` promises that a touch handler will not cancel scrolling.

`setTimeout` runs once after a delay. `setInterval` repeats until cleared. Their returned numeric IDs let the script cancel the correct pending work.

An observer receives browser-managed notifications. `IntersectionObserver` is used here to learn when images approach the viewport.

### Promises

A promise represents work that may finish later. `image.decode()` and `navigator.clipboard.writeText()` return promises. `.catch(...)` handles failure, `.finally(...)` runs regardless of success or failure, and `await` pauses an `async` function until a promise settles.

### JSON and `data-*` attributes

HTML attributes store text, so arrays and objects must be converted to JSON text with `JSON.stringify`. The browser exposes `data-gallery-columns` as `gallery.dataset.galleryColumns`. `JSON.parse` converts that text back into JavaScript values. Because parsed or saved data could be malformed or outdated, arrange mode validates it before trusting it.

## Reading the tests

### Unit tests

`photo-validation.test.ts` exercises one TypeScript function without opening a browser. `describe` groups related cases, `it` states one expected behavior, and `expect` makes the assertion. `validConfiguration()` returns a fresh object for every case so a mutation in one test cannot leak into another.

### Browser tests

`tests/site.spec.ts` uses Playwright to open the actual site in browser engines and viewport sizes configured by `playwright.config.ts`. It checks visible behavior, accessibility state, layout geometry, image loading, JavaScript fallbacks, and reviewed screenshots.

The names `page`, `browser`, `baseURL`, and `testInfo` are Playwright-provided fixtures. A fixture is a prepared value the test runner passes into a test callback. `test.skip` limits a scenario to the browser or viewport where it is relevant.

### Tool configuration

- `astro.config.mjs` holds Astro configuration. The project currently uses Astro defaults.
- `vitest.config.ts` tells Vitest which unit-test filenames to run.
- `playwright.config.ts` defines browser projects, viewports, the development server, retries, traces, and screenshot behavior.
- `prettier.config.mjs` tells Prettier how to format Astro files.
- `src/env.d.ts` loads Astro's ambient type declarations; it is intentionally only one reference line.

These files are concise contracts with their tools, so they are described here rather than filled with comments that repeat each option.

## A practical way to read a script

When a block feels dense, read it in this order:

1. Read the file header to learn when the code runs and what it owns.
2. Find the section heading and identify the phase of the feature.
3. Identify the main nouns: are the values IDs, records, DOM elements, or Muuri items?
4. Read function names as short sentences: `syncColumnsFromGrids` means “reconcile our column arrays from the live grids.”
5. Find the guard clauses—the short `if` statements that stop invalid or unnecessary work.
6. Follow where state is read, changed, displayed, and saved.
7. Use the nearby comments for local reasoning and return to this guide for reusable syntax.

You do not need to memorize every method. The important first skill is recognizing which layer supplies a name and what representation of the data you are looking at.
