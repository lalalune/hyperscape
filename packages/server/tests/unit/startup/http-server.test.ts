import { describe, expect, it } from "vitest";
import {
  buildPagesPreviewOriginPatterns,
  createOriginValidator,
} from "../../../src/startup/http-server.js";

describe("buildPagesPreviewOriginPatterns", () => {
  it("matches preview origins for the configured Pages project", () => {
    const patterns = buildPagesPreviewOriginPatterns(
      "https://hyperscape-enoomian-staging.pages.dev",
    );

    expect(patterns).toHaveLength(1);
    expect(
      patterns[0]?.test(
        "https://enoomian-staging.hyperscape-enoomian-staging.pages.dev",
      ),
    ).toBe(true);
    expect(
      patterns[0]?.test(
        "https://preview-123.hyperscape-enoomian-staging.pages.dev",
      ),
    ).toBe(true);
    expect(
      patterns[0]?.test("https://foo.hyperscape.pages.dev"),
    ).toBe(false);
  });

  it("normalizes an existing preview origin back to its Pages project host", () => {
    const patterns = buildPagesPreviewOriginPatterns(
      "https://enoomian-staging.hyperscape-enoomian-staging.pages.dev",
    );

    expect(patterns).toHaveLength(1);
    expect(
      patterns[0]?.test(
        "https://branch.hyperscape-enoomian-staging.pages.dev",
      ),
    ).toBe(true);
  });

  it("ignores non-Pages origins", () => {
    expect(
      buildPagesPreviewOriginPatterns("https://46.4.80.150.sslip.io"),
    ).toEqual([]);
  });
});

describe("createOriginValidator", () => {
  it("accepts preview origins derived from the configured Pages project", () => {
    const validator = createOriginValidator([
      "https://hyperscape-enoomian-staging.pages.dev",
      ...buildPagesPreviewOriginPatterns(
        "https://hyperscape-enoomian-staging.pages.dev",
      ),
    ]);

    expect(
      validator(
        "https://enoomian-staging.hyperscape-enoomian-staging.pages.dev",
      ),
    ).toBe(true);
    expect(validator("https://foo.hyperscape.pages.dev")).toBe(false);
  });
});
