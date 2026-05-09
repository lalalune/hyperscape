/**
 * Strict-catalog discipline classifiers — unit tests.
 *
 * These two pure helpers gate the "no fake stuff" rule the user
 * emphasized in PLAN_AAA_CONTENT_SYSTEM:
 *
 *   - `isStrictAutoFillFailure(missReason)`: returns true when an
 *     auto-fill miss must HARD-REJECT the placement (vs a graceful
 *     accept-with-warning).
 *   - `describeAutoFillMiss(result, kind, type)`: renders the miss
 *     as an agent-facing hint pointing at the next concrete action.
 *
 * Existing coverage in placementValidation.test.ts goes through the
 * propose-* action surfaces (integration). These tests exercise the
 * classifiers DIRECTLY so the strict-vs-graceful policy is locked
 * in independently of any one action's wiring.
 */

import { describe, expect, it } from "vitest";
import {
  describeAutoFillMiss,
  isStrictAutoFillFailure,
  type AutoFillResult,
  type PlacementKind,
} from "../actions/placementValidators.js";

describe("isStrictAutoFillFailure", () => {
  it("returns true for `no-matching-plugin-type`", () => {
    expect(isStrictAutoFillFailure("no-matching-plugin-type")).toBe(true);
  });

  it("returns true for `no-accepted-asset-types`", () => {
    expect(isStrictAutoFillFailure("no-accepted-asset-types")).toBe(true);
  });

  it("returns true for `no-matching-pack-asset`", () => {
    expect(isStrictAutoFillFailure("no-matching-pack-asset")).toBe(true);
  });

  it("returns false for `no-context` (graceful — no project context yet)", () => {
    expect(isStrictAutoFillFailure("no-context")).toBe(false);
  });

  it("returns false for `no-packs-installed` (graceful — empty project)", () => {
    expect(isStrictAutoFillFailure("no-packs-installed")).toBe(false);
  });

  it("returns false for undefined (no miss reason)", () => {
    expect(isStrictAutoFillFailure(undefined)).toBe(false);
  });

  it("matches the comment contract — strict failures are exactly the 3 'packs were available but no match' cases", () => {
    const allReasons: ReadonlyArray<AutoFillResult["missReason"]> = [
      "no-context",
      "no-packs-installed",
      "no-matching-plugin-type",
      "no-accepted-asset-types",
      "no-matching-pack-asset",
      undefined,
    ];
    const strict = allReasons.filter((r) => isStrictAutoFillFailure(r));
    expect(strict).toEqual([
      "no-matching-plugin-type",
      "no-accepted-asset-types",
      "no-matching-pack-asset",
    ]);
  });
});

describe("describeAutoFillMiss", () => {
  const KIND: PlacementKind = "npc";
  const TYPE = "shopkeeper";

  it("returns null when the auto-fill succeeded (ref is set)", () => {
    expect(
      describeAutoFillMiss(
        { ref: "@hyperforge/asset-pack-hyperia-v1/eldric_shopkeeper" },
        KIND,
        TYPE,
      ),
    ).toBeNull();
  });

  it("`no-context` hints at calling LIST_ASSET_PACKS + PROPOSE_ASSET_PACK_INSTALL", () => {
    const hint = describeAutoFillMiss(
      { ref: null, missReason: "no-context" },
      KIND,
      TYPE,
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("LIST_ASSET_PACKS");
    expect(hint).toContain("PROPOSE_ASSET_PACK_INSTALL");
    expect(hint).toContain(TYPE);
  });

  it("`no-packs-installed` shares the same install-a-pack hint as `no-context`", () => {
    const hint = describeAutoFillMiss(
      { ref: null, missReason: "no-packs-installed" },
      KIND,
      TYPE,
    );
    expect(hint).toContain("PROPOSE_ASSET_PACK_INSTALL");
  });

  it("`no-matching-plugin-type` hints at LIST_ENTITY_TYPES + PROPOSE_PLUGIN_SET", () => {
    const hint = describeAutoFillMiss(
      { ref: null, missReason: "no-matching-plugin-type" },
      KIND,
      TYPE,
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("LIST_ENTITY_TYPES");
    expect(hint).toContain("PROPOSE_PLUGIN_SET");
    expect(hint).toContain(TYPE);
  });

  it("`no-accepted-asset-types` hints at GET_PROJECT_STATE.availableAssets", () => {
    const hint = describeAutoFillMiss(
      { ref: null, missReason: "no-accepted-asset-types" },
      KIND,
      TYPE,
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("availableAssets");
    expect(hint).toContain(TYPE);
  });

  it("`no-matching-pack-asset` hints at PROPOSE_ASSET_PACK_INSTALL", () => {
    const hint = describeAutoFillMiss(
      { ref: null, missReason: "no-matching-pack-asset" },
      KIND,
      TYPE,
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("PROPOSE_ASSET_PACK_INSTALL");
    expect(hint).toContain(TYPE);
  });

  it("includes the placement kind in the hint", () => {
    for (const kind of [
      "npc",
      "mobSpawn",
      "resource",
      "station",
    ] as const satisfies ReadonlyArray<PlacementKind>) {
      const hint = describeAutoFillMiss(
        { ref: null, missReason: "no-matching-plugin-type" },
        kind,
        TYPE,
      );
      expect(hint).toContain(kind);
    }
  });

  it("returns null for an unknown miss reason (defensive)", () => {
    const hint = describeAutoFillMiss(
      // @ts-expect-error — intentionally invalid reason to verify graceful default
      { ref: null, missReason: "bogus-reason" },
      KIND,
      TYPE,
    );
    expect(hint).toBeNull();
  });

  it("returns null when ref is set even with a missReason set (ref wins)", () => {
    // Defensive — ref is the truth; missReason should be ignored.
    expect(
      describeAutoFillMiss(
        {
          ref: "@hyperforge/asset-pack-hyperia-v1/eldric_shopkeeper",
          missReason: "no-matching-plugin-type",
        },
        KIND,
        TYPE,
      ),
    ).toBeNull();
  });
});
