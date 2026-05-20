/**
 * inferThemedPack — themed-pack tag-inference tests.
 *
 * Phase 1.2 eleventh carve. Pins the safety-net matcher that
 * fires when the agent stays silent on PROPOSE_ASSET_PACK_INSTALL.
 * Drift here = the wrong themed pack auto-installs.
 */

import { describe, it, expect } from "vitest";

import { inferThemedPackFromCatalog } from "../inferThemedPack";

const TROPICAL = {
  manifestId: "@hyperforge/content-pack-tropical",
  tags: ["tropical", "jungle", "beach", "warm", "humid"],
};

const ARCTIC = {
  manifestId: "@hyperforge/content-pack-arctic",
  tags: ["snow", "arctic", "tundra", "cold", "ice"],
};

const HYPERIA = {
  manifestId: "@hyperforge/content-pack-hyperia-v1",
  tags: ["hyperia", "fantasy", "medieval"],
};

const CATALOG = [TROPICAL, ARCTIC, HYPERIA];

describe("inferThemedPackFromCatalog", () => {
  it("returns null when catalog is empty", () => {
    expect(
      inferThemedPackFromCatalog([{ role: "user", text: "ice" }], []),
    ).toBe(null);
  });

  it("returns null when there are no user messages", () => {
    expect(inferThemedPackFromCatalog([], CATALOG)).toBe(null);
    expect(
      inferThemedPackFromCatalog(
        [{ role: "agent", text: "Welcome!" }],
        CATALOG,
      ),
    ).toBe(null);
  });

  it("picks tropical when user describes a jungle world", () => {
    expect(
      inferThemedPackFromCatalog(
        [{ role: "user", text: "I want a tropical jungle with warm beaches" }],
        CATALOG,
      ),
    ).toBe(TROPICAL.manifestId);
  });

  it("picks arctic when user describes snow", () => {
    expect(
      inferThemedPackFromCatalog(
        [{ role: "user", text: "Snowy tundra with cold ice everywhere" }],
        CATALOG,
      ),
    ).toBe(ARCTIC.manifestId);
  });

  it("is case-insensitive on both side", () => {
    expect(
      inferThemedPackFromCatalog(
        [{ role: "user", text: "ARCTIC TUNDRA" }],
        CATALOG,
      ),
    ).toBe(ARCTIC.manifestId);
  });

  it("ignores generic tags (content-pack, built-in, etc.)", () => {
    const generic = {
      manifestId: "@hyperforge/content-pack-stub",
      tags: ["content-pack", "built-in", "starter", "fork"],
    };
    // User says all 4 generic words — should still NOT match
    expect(
      inferThemedPackFromCatalog(
        [
          {
            role: "user",
            text: "build me a content-pack built-in starter fork",
          },
        ],
        [generic, ARCTIC],
      ),
    ).toBe(null);
  });

  it("ignores packs whose id isn't @hyperforge/content-pack-*", () => {
    const assetPack = {
      manifestId: "@hyperforge/asset-pack-trees",
      tags: ["tropical", "jungle"],
    };
    // No themed pack candidate matches — assetPack is skipped
    expect(
      inferThemedPackFromCatalog(
        [{ role: "user", text: "tropical jungle" }],
        [assetPack],
      ),
    ).toBe(null);
  });

  it("concatenates all user messages when scoring", () => {
    expect(
      inferThemedPackFromCatalog(
        [
          { role: "user", text: "warm" },
          { role: "agent", text: "..." },
          { role: "user", text: "jungle" },
        ],
        CATALOG,
      ),
    ).toBe(TROPICAL.manifestId);
  });

  it("ignores agent messages even if they mention theme words", () => {
    expect(
      inferThemedPackFromCatalog(
        [
          { role: "user", text: "build a world" },
          { role: "agent", text: "How about a snowy tundra?" },
        ],
        CATALOG,
      ),
    ).toBe(null);
  });

  it("ties go to the first pack encountered", () => {
    const userText = "tropical snow"; // 1 hit each
    const result = inferThemedPackFromCatalog(
      [{ role: "user", text: userText }],
      CATALOG,
    );
    // Both packs hit once; tropical comes first in CATALOG, so
    // bestHits=1 first set by tropical, arctic's 1 doesn't beat it.
    expect(result).toBe(TROPICAL.manifestId);
  });
});
