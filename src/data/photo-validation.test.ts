// These are unit tests: they exercise the validation function directly without
// rendering Astro or opening a browser. Vitest supplies `describe`, `it`, and
// `expect`; the configuration and test-case names are project-authored.

import { describe, expect, it } from "vitest";
import {
  type PhotoConfiguration,
  validatePhotoConfiguration,
} from "./photo-validation";

// A function creates a fresh valid object for every test. Individual tests can
// then replace one property without leaking that mutation into another test.
const validConfiguration = (): PhotoConfiguration => ({
  assetIds: ["one", "two", "three"],
  metadata: {
    one: { alt: "First photograph" },
    two: { alt: "Second photograph" },
    three: { alt: "", decorative: true },
  },
  homeIds: ["one"],
  workColumns: [["one"], ["two"], ["three"]],
  favoriteIds: ["two"],
  pinnedIds: ["three"],
});

// `describe` groups related behavior. Each `it` callback changes or checks one
// rule, and `expect` states the outcome that makes the case pass.
describe("validatePhotoConfiguration", () => {
  it("accepts a complete three-column configuration", () => {
    expect(() =>
      validatePhotoConfiguration(validConfiguration()),
    ).not.toThrow();
  });

  it("rejects duplicate IDs", () => {
    const configuration = validConfiguration();
    configuration.homeIds = ["one", "one"];

    expect(() => validatePhotoConfiguration(configuration)).toThrow(
      "Duplicate Home photo IDs: one",
    );
  });

  it("rejects missing alt text", () => {
    const configuration = validConfiguration();
    configuration.metadata = {
      ...configuration.metadata,
      two: { alt: "" },
    };

    expect(() => validatePhotoConfiguration(configuration)).toThrow(
      "Photo two needs meaningful alt text",
    );
  });

  it("rejects missing, unreferenced, and multiply placed assets", () => {
    const configuration = validConfiguration();
    configuration.assetIds = [...configuration.assetIds, "unused"];
    configuration.metadata = {
      ...configuration.metadata,
      unused: { alt: "Unused photograph" },
    };
    configuration.workColumns = [["one"], ["two", "one"], ["three"]];

    expect(() => validatePhotoConfiguration(configuration)).toThrow(
      /Photos placed more than once in Work: one[\s\S]*Photo asset unused is not used/,
    );
  });
});
