# Repository Instructions

These instructions apply to every coding agent working in this repository.

## Testing responsibilities

- Read `TESTING.md` before changing application behavior or test coverage.
- Before editing, identify the user-visible contract being changed and the
  existing checks that protect it.
- If implementation changes while intended behavior stays the same, preserve
  the existing expectations and fix regressions in the implementation.
- If the user intentionally changes behavior, update the relevant test names
  and assertions in the same work. Do this proactively; do not wait for the
  user to ask how their tests should change.
- Add focused coverage for new behavior when a regression would matter to a
  visitor, an accessibility path, responsive layout, loading, or a documented
  workflow.
- Keep coverage proportional to this small portfolio. Prefer essential
  visitor-visible outcomes and broad behavioral boundaries over exact spacing,
  alignment, photograph IDs/counts, animation milliseconds, easing values, or
  other routinely tuned design details.
- Treat subjective appearance as a manual review responsibility. Keep visual
  screenshots in the optional `npm run test:visual` command; do not add them to
  `npm test`, `npm run test:all`, the pre-push hook, or GitHub automation.
- Never delete, weaken, skip, or regenerate an expectation solely to make a
  failing suite pass. Diagnose whether the code or the intended contract is
  wrong first.
- Treat a green suite as the normal baseline. Do not label failures “known” or
  leave them unresolved without understanding the cause and obtaining explicit
  user acceptance for the blocker.
- Run the matching page command during development, then `npm test`. Use
  `npm run test:all` when changing cross-browser infrastructure or preparing a
  release, as described in `TESTING.md`.
- Respect the repository's pre-push verification. Do not disable or bypass the
  hook to avoid a failure; diagnose the failure and leave the relevant suite
  green. Mention any user-authorized emergency bypass in the final handoff.
- When adding a test category, command, fixture, browser project, screenshot,
  or maintenance rule, update `TESTING.md` and any affected README command list
  in the same change.

## User handoff

Every completed coding task must explain:

- what behavior was changed;
- what tests were added or updated and what each protects;
- which verification commands ran and whether anything failed;
- when the user would need to update those tests during a future intentional
  change; and
- where any new tuning control or workflow is documented.

Do not assume the user already understands a tool-generated test matrix or
testing-library terminology. Explain counts, skips, browser duplication, and
failure implications in plain language when they are relevant.
