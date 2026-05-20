/**
 * pluginManifestNpm — manifest-id → npm-name lookup tests.
 *
 * Phase 1.2 third carve. Pins the bridge map between the agent
 * server's manifest-style plugin ids and the project store's
 * npm-style names.
 */

import { describe, it, expect } from "vitest";

import { MANIFEST_TO_NPM, toNpmName } from "../pluginManifestNpm";

describe("MANIFEST_TO_NPM map", () => {
  it("maps hyperscape manifest id to its @hyperforge npm name", () => {
    expect(MANIFEST_TO_NPM["com.hyperforge.hyperscape"]).toBe(
      "@hyperforge/hyperscape",
    );
  });

  it("maps shooter-demo manifest id to its npm name", () => {
    expect(MANIFEST_TO_NPM["com.hyperforge.plugin-shooter-demo"]).toBe(
      "@hyperforge/plugin-shooter-demo",
    );
  });

  it("returns undefined for unknown manifest ids (caller defaults to input)", () => {
    expect(MANIFEST_TO_NPM["com.unknown.thing"]).toBeUndefined();
  });
});

describe("toNpmName resolver", () => {
  it("translates a known manifest id to its npm form", () => {
    expect(toNpmName("com.hyperforge.hyperscape")).toBe(
      "@hyperforge/hyperscape",
    );
  });

  it("passes through an already-npm-formatted id unchanged", () => {
    // Idempotent — already-npm ids go through the ?? fallback.
    expect(toNpmName("@hyperforge/hyperscape")).toBe("@hyperforge/hyperscape");
  });

  it("passes through an unknown manifest-style id unchanged", () => {
    // Future plugins published under their own scope don't need
    // a code change — they're treated as pass-through.
    expect(toNpmName("com.thirdparty.cool-mod")).toBe(
      "com.thirdparty.cool-mod",
    );
  });

  it("preserves the input identity for unmapped strings", () => {
    // Empty string and arbitrary strings go through the
    // pass-through path.
    expect(toNpmName("")).toBe("");
    expect(toNpmName("arbitrary-string")).toBe("arbitrary-string");
  });
});
