# McKenzie Ryan Portfolio

An Astro photography portfolio with a deliberately small layout system, one canonical photo library, and automated checks for the behaviors that have historically been fragile.

## Layout system

Every page uses `src/layouts/BaseLayout.astro` and must provide a `title` and one of two modes:

- `viewport` is a bounded, one-screen composition. Home uses a three-row `100svh` grid: header, flexible slideshow, and footer. Its shared chrome is in normal flow; the gallery sizes itself to the middle row.
- `document` grows with its content. Work, About, and Contact use normal document scrolling, a shared fixed header overlay, one shared header-clearance token, and a footer after the page content.

The ownership boundary is intentional:

- `src/styles/global.css` owns design tokens, normalization, base accessibility, and fallback behavior.
- `BaseLayout.astro` owns the page shell and placement of the header, main region, and footer.
- `Header.astro` and `Footer.astro` own their appearance and interaction.
- Page files own only the composition and spacing inside their main region.

`BaseLayout.astro` keeps `id="main-content"` on its `<main>` element as a stable fragment target, although no current feature uses it. It can support direct `#main-content` links, scripted focus or scrolling, and browser-test selectors. The `<main>` element itself provides the semantic page landmark; the ID adds no accessibility behavior on its own. Any future scrolling or focus behavior that targets it must account for the fixed header in `document` layouts.

Do not add body overflow fixes, fixed footers, page-specific header offsets, or viewport-height subtraction to an individual page. If shared chrome changes size, update the shared token and layout instead.

## Photography

`src/assets/photos/` is the only active portfolio photo library. Astro imports, optimizes, hashes, and dimensions these source images at build time. `src/assets/profile/` contains the optimized About portrait. `public/` is reserved for files that need an unchanged URL, currently the favicon.

`src/data/photos.ts` is the source of truth for:

- stable photo IDs and meaningful alt descriptions;
- Home slideshow order;
- Work's three columns;
- Arrange-mode favorites and pins.

Both galleries read the same photo records. The build validates duplicate IDs, missing files or metadata, blank alt descriptions, incorrect Work columns, invalid references, and active photos that are not used.

To add a photo:

1. Put its original in `src/assets/photos/` using a unique, stable ID as its filename.
2. Add that ID and a meaningful visual description to `photoMetadata`.
3. Add the ID to `homePhotoIds`, `workGalleryColumns`, or both.
4. Run `npm run check`, `npm run test:unit`, and `npm run build`.

Use `{ alt: "", decorative: true }` only when the image genuinely adds no information. Numeric filenames are never used as alt text.

## Arrange mode

Run the development server and open `/work/?arrange=1` in a desktop browser. Arrange mode can drag, randomize, favorite, pin, and preview the canonical IDs. “Copy order” exports `workGalleryColumns` configuration that can be pasted into `src/data/photos.ts`. It is development-only and is not shipped in the production page.

## Commands

```sh
npm install
npm run dev
npm run format
npm run format:check
npm run check
npm run test:unit
npm run build
npm run test:e2e
npm run verify
```

`npm run verify` runs formatting, Astro/TypeScript checks, a production build, gallery-data unit tests, and browser tests. Playwright covers Chromium, Firefox, and WebKit across desktop, tablet, portrait-phone, and short-landscape viewports. Install its local browser binaries once with `npx playwright install` if they are missing.

Chromium visual baselines live beside the browser tests. Review intentional visual changes before updating them with:

```sh
npx playwright test --project=chromium-desktop --update-snapshots
```

Automated emulation catches regressions but does not replace the final iPhone Safari check. Before merging layout changes, load the pushed preview on a real iPhone, start from a fresh tab, and verify the initial Home render, rotation, menu, slideshow controls, and page footers.

## Typography

The site loads Adobe Typekit kit `lgy6wgp` with connection hints. Explicit line heights and the hardened `Avenir Next`, Avenir, Helvetica Neue, Arial, sans-serif fallback stack keep the geometry usable if Typekit is delayed or unavailable.

## Content collections

There is intentionally no Astro content collection yet. About and Contact are direct pages, while gallery ordering is typed presentation data. Add a build-time `projects` collection only when real projects exist and shared fields such as title, cover, description, gallery, credits, date, status, and route are known. Project entries can then use Astro's collection `image()` schema helper to reference the canonical local photo library.

## GitHub workflow

`.github/workflows/quality.yml` runs the quality suite on pull requests and pushes to `main`. GitHub Actions only examines commits that you deliberately push. It does not create commits, push, merge, deploy, or decide when the branch reaches GitHub.

The expected flow is:

1. Edit and test locally.
2. Create logical local commits when you choose.
3. Optionally push the branch and review its checks.
4. Manually merge when the result is ready.

The site's existing deployment mechanism is unchanged.
