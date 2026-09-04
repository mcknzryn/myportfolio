import { describe, expect, it } from "vitest";
import {
  type PhotoConfiguration,
  validatePhotoConfiguration,
} from "./photo-validation";

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
