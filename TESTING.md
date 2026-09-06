# Testing Handbook

This is the practical testing guide for working on the portfolio without an
agent. The normal process is intentionally short:

1. Make the change.
2. Look at the changed page in your browser.
3. Run that page's test while you work.
4. Run `npm test` when you are finished.

You do not need to design a new testing strategy for every edit.

## The commands to remember

| Command                | When to use it                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run test:home`    | While changing Home or its slideshow.                                             |
| `npm run test:about`   | While changing the About page.                                                    |
| `npm run test:contact` | While changing Contact.                                                           |
| `npm run test:work`    | While changing Work, its photographs, reveal, loading, or Arrange mode.           |
| `npm test`             | The everyday safety check after a meaningful change. The pre-push hook runs this. |
| `npm run test:all`     | The release check: `npm test` plus Firefox desktop and WebKit phone smoke tests.  |
| `npm run test:visual`  | An optional visual comparison for Home and Work.                                  |

`npm test` checks formatting, Astro and TypeScript, the production build,
photo-data rules, and essential behavior in Chromium. It is the one everyday
command to remember.

GitHub runs `npm run test:all` for pull requests and pushes to `main`. You do
not normally need to run it after every small edit. Run it yourself before a
release, after shared browser-sensitive work, or when investigating a Firefox
or Safari/WebKit problem.

The older command names still work:

- `npm run test:gallery` is an alias for `npm run test:work`.
- `npm run test:browser:quick` runs the essential Chromium tests.
- `npm run verify:quick` is an alias for `npm test`.
- `npm run verify` is an alias for `npm run test:all`.
- `npm run test:e2e` runs Chromium plus the cross-browser smoke tests.

## Run browser tests with VS Code buttons

VS Code can display the Home, About, Contact, Work, and shared browser tests in
its Testing panel.

1. Install Microsoft's **Playwright Test for VS Code** extension when VS Code
   recommends it for this repository.
2. Select the test-tube icon in the left sidebar.
3. Find the page or individual behavior you changed.
4. Select its triangle button to run it. Use its debug button when you want to
   watch the steps or pause on a failure.

The panel reports a green check for a pass and opens the relevant error for a
failure. These buttons are shortcuts for the page commands above; use whichever
feels easier.

The Testing panel runs Playwright browser tests. It does not run formatting,
Astro checks, the production build, or unit tests, so finish with `npm test`.

### Why Playwright is involved

The VS Code panel is the control panel; Playwright is the browser-testing engine
underneath it. Playwright opens the site in a real browser, changes viewport
sizes, clicks controls, presses keys, scrolls, and reports the result to VS
Code. It is how the project checks behavior that Astro or TypeScript cannot see,
such as the mobile menu and gallery reveal.

Playwright is development-only. It is not included in the published website,
visitors do not download it, and it does not affect the site's loading speed.

## What the tests protect

The automated tests focus on failures that would matter to a visitor:

- important content and images are present and load;
- pages do not develop serious horizontal overflow or hide content under the
  fixed header;
- footers remain reachable, including in short viewports;
- navigation, slideshow buttons, and keyboard controls work;
- the Work reveal remains ordered, staggered, overlapping, and visible on a
  warm mobile load;
- offscreen Work images reveal after scrolling;
- responsive sources, reduced motion, no-JavaScript behavior, Arrange mode,
  and browser fallbacks keep working;
- photo metadata and ordering remain valid;
- the production site can still be built.

Tests intentionally do not freeze every visual decision. Exact alignment,
spacing, gallery IDs, photograph count, animation milliseconds, easing values,
and other tuning choices remain editable. The tests use current markup and
broad behavioral boundaries when the exact value is not the important part.

## When a test needs to change

Tests are the site's automated memory. Change one only when the behavior it
describes intentionally changes.

- **You refactor code but want the same result:** keep the test unchanged. A
  failure probably means the refactor changed behavior accidentally.
- **You intentionally replace behavior:** update the relevant test name and
  expectation so they describe the new result.
- **You add important behavior that no test would notice:** add one focused
  test.
- **You make a subjective visual adjustment:** inspect it yourself; a new
  automated test is usually unnecessary.

Examples:

- Changing About or Contact's `contentLayout` is a design choice. Check the page
  at desktop and phone sizes. The essential page test should continue checking
  readability, overflow, and footer access without locking an exact alignment.
- Moving CSS or renaming an internal helper without changing the result should
  not require a test edit.
- Changing the gallery reveal should retain coverage for a visible stagger,
  overlap, mobile softness, scrolling, and fallback behavior. Exact timing is a
  tuning choice documented in `CODE_GUIDE.md`, not a fixed test contract.
- Adding a photograph under the existing data rules needs no new test; the unit
  tests already validate the photo configuration.
- Copy, color, and small spacing changes usually need inspection and the
  existing tests, not additional coverage.
- A bug likely to return should receive a focused test that fails with the bug
  and passes with the fix.

Never delete, skip, weaken, or regenerate an expectation only to make a red
result green. First decide whether the code is wrong or the intended behavior
really changed.

## Optional visual comparison

Run `npm run test:visual` when you want to compare Home and Work against their
reviewed reference screenshots. Good examples include changing:

- Work gallery column widths or spacing;
- image sizes or crops;
- page margins;
- header positioning; or
- the overall Home or Work composition.

You generally do not need it for an internal refactor, photo-data validation, or
copy that does not materially alter the composition.

A screenshot difference is not automatically a bug:

- **The difference is unexpected:** fix the code and run the test again.
- **The difference is an intentional improvement:** inspect the result closely,
  then update the saved images with:

  ```sh
  npm run test:visual -- --update-snapshots
  ```

Review the changed PNG files before keeping them. Never update screenshots just
to silence a failure. Visual tests are deliberately excluded from `npm test`,
`npm run test:all`, the pre-push hook, and GitHub automation because design
changes require your judgment.

## Find existing coverage

The browser files have straightforward names:

```text
tests/home.spec.ts
tests/about.spec.ts
tests/contact.spec.ts
tests/work.spec.ts
tests/shared.spec.ts
tests/cross-browser-smoke.spec.ts
tests/visual.spec.ts
```

Search by the page and behavior you are changing:

```sh
rg -ni "about|portrait|overflow" tests src
rg -ni "contact|email|scroll" tests src
rg -ni "gallery|reveal|animation|image" tests src
```

List the tests without running them:

```sh
npx playwright test --list
npx playwright test --list | rg -i "about|contact|work"
```

Read the matching test name as a sentence and ask, “Should this still be true
after my change?” Preserve it when the answer is yes; update it when the answer
is intentionally no.

## Automatic protection when you push

The tracked `.githooks/pre-push` hook automatically runs `npm test` when you use
Git Push, Publish Branch, or Sync Changes in VS Code.

You do not need to install it now. Run this only after downloading the project
into a new folder or onto a new computer:

```sh
npm run hooks:install
```

If you are unsure whether it is enabled, run:

```sh
git config --local --get core.hooksPath
```

It should print `.githooks`.

When `npm test` passes, the push continues. When it fails, the push stops and
your files and commits remain unchanged. The hook never formats files, edits
tests, changes screenshots, commits, or pushes on its own.

`git push --no-verify` bypasses the protection. Reserve it for a genuine
emergency, never as a way to avoid understanding a failure.

## What GitHub runs

GitHub runs `npm run test:all` for pull requests and pushes to `main`. An
ordinary feature-branch push without an open pull request does not start the
workflow.

GitHub Actions time means time spent testing on GitHub's computers, not your
computer. Standard runners are free for public repositories. Private
repositories receive an included monthly allowance based on the account plan,
so limiting the workflow to pull requests and `main` avoids needless runs.

GitHub reports the result but never edits, commits, merges, deploys, or decides
whether a design change is correct.

## If a test fails

Start with the first failure and read its plain-language test name.

1. If the behavior should not have changed, fix the implementation.
2. If you intentionally changed that behavior, update only the relevant
   expectation and name.
3. If the new behavior is important but uncovered, add one focused test.
4. If the failure seems unrelated, rerun that page's test and investigate it.
5. If it is a visual screenshot difference, inspect the images and decide
   whether the code or the reviewed reference is correct.

Playwright places screenshots, traces, and error details under `test-results/`.
The VS Code Testing panel can also show the failed step and open a debugging
browser.

## What still requires your eyes

Automation cannot decide whether photographic sequencing, animation character,
typography, or spacing feels beautiful. Inspect meaningful visual changes at
desktop and phone sizes. Before publishing substantial mobile changes, also
open the pushed preview in a fresh tab on a real iPhone and check navigation,
scrolling, interactions, rotation, and footer access.

The intended workflow is simple: **make the change, look at it, run the test.**
