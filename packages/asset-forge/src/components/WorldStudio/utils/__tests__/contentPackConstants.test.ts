/**
 * contentPackConstants — identifier + predicate tests.
 *
 * Pins the canonical id literals + the two predicates so a
 * future rename of the @hyperforge scope, the content-pack
 * prefix, or the Hyperia pack id is a single-line change.
 */

import { describe, it, expect } from "vitest";

import {
  CONTENT_PACK_ID_PREFIX,
  HYPERIA_CONTENT_PACK_ID,
  HYPERIA_CONTENT_PACK_PREFIX,
  isContentPackId,
  isHyperiaContentPackId,
} from "../contentPackConstants";

describe("constants — literal values", () => {
  it("CONTENT_PACK_ID_PREFIX is the @hyperforge content-pack prefix", () => {
    expect(CONTENT_PACK_ID_PREFIX).toBe("@hyperforge/content-pack-");
  });

  it("HYPERIA_CONTENT_PACK_ID is the canonical v1 id", () => {
    expect(HYPERIA_CONTENT_PACK_ID).toBe("@hyperforge/content-pack-hyperia-v1");
  });

  it("HYPERIA_CONTENT_PACK_PREFIX is version-agnostic Hyperia prefix", () => {
    expect(HYPERIA_CONTENT_PACK_PREFIX).toBe(
      "@hyperforge/content-pack-hyperia-",
    );
  });

  it("HYPERIA_CONTENT_PACK_ID starts with both prefixes", () => {
    expect(HYPERIA_CONTENT_PACK_ID.startsWith(CONTENT_PACK_ID_PREFIX)).toBe(
      true,
    );
    expect(
      HYPERIA_CONTENT_PACK_ID.startsWith(HYPERIA_CONTENT_PACK_PREFIX),
    ).toBe(true);
  });
});

describe("isContentPackId", () => {
  it("returns true for themed content packs", () => {
    expect(isContentPackId("@hyperforge/content-pack-tropical-v1")).toBe(true);
    expect(isContentPackId("@hyperforge/content-pack-arctic-v1")).toBe(true);
    expect(isContentPackId("@hyperforge/content-pack-desert-v1")).toBe(true);
    expect(isContentPackId(HYPERIA_CONTENT_PACK_ID)).toBe(true);
  });

  it("returns false for asset packs (different prefix)", () => {
    expect(isContentPackId("@hyperforge/asset-pack-hyperia-trees-v1")).toBe(
      false,
    );
    expect(isContentPackId("@hyperforge/asset-pack-hyperia-npcs-v1")).toBe(
      false,
    );
  });

  it("returns false for plugin manifest ids", () => {
    expect(isContentPackId("com.hyperforge.hyperscape")).toBe(false);
    expect(isContentPackId("@hyperforge/hyperscape")).toBe(false);
  });

  it("returns false for empty / unrelated strings", () => {
    expect(isContentPackId("")).toBe(false);
    expect(isContentPackId("random-string")).toBe(false);
  });
});

describe("isHyperiaContentPackId", () => {
  it("matches both v1 and hypothetical v2/v3", () => {
    expect(isHyperiaContentPackId(HYPERIA_CONTENT_PACK_ID)).toBe(true);
    expect(isHyperiaContentPackId("@hyperforge/content-pack-hyperia-v2")).toBe(
      true,
    );
    expect(isHyperiaContentPackId("@hyperforge/content-pack-hyperia-v99")).toBe(
      true,
    );
  });

  it("does not match other themed content packs", () => {
    expect(isHyperiaContentPackId("@hyperforge/content-pack-tropical-v1")).toBe(
      false,
    );
    expect(isHyperiaContentPackId("@hyperforge/content-pack-arctic-v1")).toBe(
      false,
    );
  });

  it("does not match the generic content-pack prefix without -hyperia-", () => {
    expect(isHyperiaContentPackId("@hyperforge/content-pack-")).toBe(false);
  });
});
