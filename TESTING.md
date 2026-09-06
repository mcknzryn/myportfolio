# Testing Guide

This guide explains what the automated checks protect, which ones to run, and
when a test should or should not change. Tests are behavioral agreements, not
obstacles to clear after coding.

## The central rule

You do **not** update tests after every code edit.

- If the implementation changes but the intended result stays the same, keep
  the tests unchanged. A failure probably means the implementation regressed or
  the test exposed an assumption that needs investigation.
- If you intentionally change visible behavior, content, an interface, or a
  data rule, update the relevant test name and assertions in the same change.
- If you add behavior that matters to visitors or protects a fragile workflow,
  add focused coverage for it.
- Never remove or weaken an assertion merely to turn a failure green. First
  decide what the correct behavior should be.

For example, changing Contact from `centered-desktop` to `centered-all` changes
the intended desktop class and mobile alignment. Its layout tests must change.
Reorganizing the layout implementation while preserving the same visible
alignment should not require changing those expectations.

## What the checks cover

| Check                        | What it protects                                                                                               | When its expectations should change                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`       | Consistent formatting                                                                                          | Do not edit a rule to excuse one file; format the affected code.                                                              |
| `npm run check`              | Astro and TypeScript contracts, including valid layout names                                                   | When an intentional interface or type changes, update its callers together.                                                   |
| `npm run test:unit`          | Photo metadata, ordering, references, uniqueness, and validation rules                                         | When the photo-data contract or an intentional invariant changes. Ordinary photo additions should satisfy the existing rules. |
| `npm run test:contact`       | Contact's centered layout, viewport fit, content, and emergency scrolling                                      | When Contact's intended content or layout behavior changes.                                                                   |
| `npm run test:gallery`       | Work image loading, responsive sources, reveal timing, cache behavior, fallbacks, and no-JavaScript visibility | When the intended gallery loading or reveal contract changes.                                                                 |
| `npm run test:browser:quick` | Representative Chromium desktop, phone, and short-landscape behavior                                           | Assertions change only for intentional user-visible changes.                                                                  |
| `npm run test:e2e`           | The complete Chromium, Firefox, and WebKit viewport matrix                                                     | Assertions change only for intentional behavior changes or a demonstrated browser-specific requirement.                       |
| `npm run build`              | Production rendering and Astro image generation                                                                | Build configuration or asset changes must continue to produce a successful site.                                              |

The browser suite also covers page titles and headings, fixed-header clearance,
footer reachability, Home viewport geometry, slideshow controls, mobile
navigation, reduced motion, Arrange mode, font failure, and reviewed Home and
Work screenshots.

## Why Playwright prints so many results

`tests/site.spec.ts` contains a much smaller set of logical scenarios than the
final number shown in the terminal. `playwright.config.ts` defines 12 projects:
Chromium, Firefox, and WebKit across desktop, tablet, portrait-phone, and
short-landscape configurations. Playwright considers every scenario for every
project, then `test.skip` excludes combinations that are not relevant.

A skipped result is normal. The total count grows by the browser matrix and
does not mean that hundreds of separate tests were handwritten. To inspect the
current expanded list without running it, use:

```sh
npx playwright test --list
```

Playwright starts a dedicated Astro development server on port `4322`. It does
not reuse the regular `npm run dev` server on port `4321`, so browser-test
results do not depend on whether that server is already open or how it was
started. The test configuration keeps that server in the foreground so
Playwright can stop it cleanly when the run ends.

## Which command to run

Use the smallest relevant check while developing, then run a broader check
before treating the work as finished.

| You changed                                           | Run while working                       | Run before finishing   |
| ----------------------------------------------------- | --------------------------------------- | ---------------------- |
| Contact content or layout                             | `npm run test:contact`                  | `npm run verify:quick` |
| Work gallery, images, or reveal behavior              | `npm run test:gallery`                  | `npm run verify:quick` |
| Photo metadata or gallery ordering                    | `npm run test:unit` and `npm run build` | `npm run verify:quick` |
| Header, footer, BaseLayout, navigation, or shared CSS | `npm run test:browser:quick`            | `npm run verify`       |
| TypeScript or Astro component interfaces              | `npm run check`                         | `npm run verify:quick` |
| Broad, cross-browser, or release-ready work           | `npm run verify:quick`                  | `npm run verify`       |

`npm run verify:quick` runs formatting, Astro checks, the production build,
unit tests, and representative Chromium viewports. `npm run verify` runs those
checks plus the complete browser matrix.

## A safe coding and testing workflow

1. State the intended result in plain language before editing. For a design
   change, be explicit about desktop, mobile, reduced-motion, and no-JavaScript
   behavior when they matter.
2. Use the table above to identify the existing test that protects that result.
3. Make the implementation change.
4. Run the smallest relevant command and read the first failure completely.
5. If the requested behavior changed, update the test name and assertions to
   describe the new contract. If behavior was meant to stay the same, fix the
   implementation instead.
6. Run `npm run verify:quick`. Use the full `npm run verify` for shared layout,
   cross-browser, or release-ready changes.
7. Manually inspect animation, typography, and responsive layout changes. Tests
   complement visual judgment; they do not replace it.

## Reading a browser-test failure

Start with the test name and the project in brackets, such as
`[webkit-phone]`. Multiple failures with the same test name often mean one
logical expectation was repeated across several browser engines, not several
independent bugs.

Read the first failed assertion and compare its “Expected” and “Received”
values. Playwright writes supporting material under `test-results/`, including
an `error-context.md` file when available. Traces are retained on the first CI
retry. Diagnose the difference before editing either code or tests.

The normal baseline is a green suite. Do not label failures “known” or leave
them unresolved unless the reason is understood, documented, and explicitly
accepted for the current work.

## Screenshot updates

Home and Work have reviewed Chromium desktop baselines. A screenshot mismatch
is a prompt to inspect the rendered page, not automatic permission to replace
the expected image.

Only after confirming that the visual change is intentional, update the
baselines with:

```sh
npx playwright test --project=chromium-desktop \
  --grep "reviewed Chromium viewport snapshots" --update-snapshots
```

Review the changed images before keeping them. A functional code refactor with
no intended visual change should not update screenshots.

## Adding or changing tests

Prefer assertions about visitor-visible behavior: accessible names, computed
layout, actual animation timing, image loading, and interaction results. Assert
an internal class or implementation detail only when it represents an explicit
component contract, such as `content-layout-centered-all`.

Give every test a name that states the expected behavior. Limit expensive or
browser-specific cases with `test.skip`, and explain why that representative
project is sufficient. If a new feature introduces a new test category,
command, fixture, or maintenance rule, update this guide in the same change.

Automated emulation does not replace final device review. Before merging a
meaningful mobile layout or interaction change, check the pushed preview in a
fresh tab on a real iPhone, including rotation and page scrolling.
