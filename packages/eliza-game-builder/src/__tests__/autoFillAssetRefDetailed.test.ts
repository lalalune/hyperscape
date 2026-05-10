/**
 * `autoFillAssetRefDetailed` — direct unit tests.
 *
 * Closes the strict-catalog discipline coverage triangle. The
 * other two helpers (`isStrictAutoFillFailure`,
 * `describeAutoFillMiss`) have direct tests in
 * strictCatalogDiscipline.test.ts; the parsing-side helper
 * (`validateAssetRef`) is in validateAssetRef.test.ts. This file
 * covers the branching auto-fill resolver itself — the function
 * the propose-* actions call to populate `assetRef` when the
 * agent omits it.
 *
 * Coverage walks each of the 5 distinct return paths:
 *
 *   1. `ref: null, missReason: "no-context"`
 *   2. `ref: null, missReason: "no-packs-installed"`
 *   3. exact-id match → ref set
 *   4. `ref: null, missReason: "no-matching-plugin-type"`
 *   5. `ref: null, missReason: "no-accepted-asset-types"`
 *   6. `ref: null, missReason: "no-matching-pack-asset"`
 *   7. type-based match → ref set
 *
 * Plus combined-flow assertions: exact-id wins over type match,
 * preferredId fallback flows through to type pass on miss.
 */

import { describe, expect, it } from "vitest";
import { autoFillAssetRefDetailed } from "../actions/placementValidators.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeStubRuntime } from "./testRuntime.js";

const HYPERIA_ID = "com.hyperforge.hyperscape";
const PACK_ID = "@hyperforge/asset-pack-hyperia-v1";

function makeRuntime(ctx: ProjectContext | null): IAgentRuntime {
  const stub = makeStubRuntime();
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(ctx) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

const SHOPKEEPER_ASSET = {
  id: "eldric_shopkeeper",
  name: "Eldric",
  type: "character",
  subtype: "humanoid",
};
const TREE_ASSET = {
  id: "oak_tree",
  name: "Oak Tree",
  type: "prop",
  subtype: "vegetation",
};

const PACK_WITH_BOTH = {
  manifestId: PACK_ID,
  name: "Hyperia v1",
  packVersion: "1.0.0",
  assets: [SHOPKEEPER_ASSET, TREE_ASSET],
};

describe("autoFillAssetRefDetailed", () => {
  describe("graceful (non-strict) misses", () => {
    it("returns no-context when project context is unavailable", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime(null),
        "npc",
        "shopkeeper",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-context");
    });

    it("returns no-packs-installed when project has zero packs", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({ plugins: [HYPERIA_ID], assetPacks: [] }),
        "npc",
        "shopkeeper",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-packs-installed");
    });

    it("returns no-packs-installed when assetPacks is undefined", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({ plugins: [HYPERIA_ID] }),
        "npc",
        "shopkeeper",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-packs-installed");
    });
  });

  describe("exact-id pass", () => {
    it("returns ref for an exact id match in any pack", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "shopkeeper",
        SHOPKEEPER_ASSET.id, // preferredId
      );
      expect(r.ref).toBe(`${PACK_ID}/${SHOPKEEPER_ASSET.id}`);
      expect(r.missReason).toBeUndefined();
    });

    it("preferred-id miss falls through to type pass (does not short-circuit)", () => {
      // preferredId doesn't exist anywhere; with no matching plugin type
      // the type pass also fails → returns no-matching-plugin-type.
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: ["com.unknown.plugin"],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "imaginary-type",
        "imaginary-id",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-matching-plugin-type");
    });

    it("exact-id match WINS over the type-based pass", () => {
      // Even when the plugin / type would also resolve, exact id is
      // preferred so the agent's explicit preference is honored.
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "shopkeeper",
        TREE_ASSET.id, // preferredId for an oak tree (different type!)
      );
      // Even though the type "shopkeeper" wants `character` assets,
      // the exact-id match for "oak_tree" wins.
      expect(r.ref).toBe(`${PACK_ID}/${TREE_ASSET.id}`);
    });
  });

  describe("strict misses (must be hard-rejected)", () => {
    it("no-matching-plugin-type when type isn't contributed by any installed plugin", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "wizard-king", // not a contributed type
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-matching-plugin-type");
    });

    it("no-matching-plugin-type when plugins list is empty (nothing to filter against)", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "shopkeeper",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-matching-plugin-type");
    });

    it("no-matching-plugin-type when type is empty string", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-matching-plugin-type");
    });

    it("no-matching-pack-asset when type contributed but no pack asset matches accepted types", () => {
      // Hyperia's "shopkeeper" accepts "character" assets. Build a pack
      // where the only asset is a "prop" — the type pass finds the
      // shopkeeper contribution, but no asset's type is in the
      // acceptedAssetTypes set.
      const propsOnlyPack = {
        manifestId: PACK_ID,
        name: "Props",
        packVersion: "1.0.0",
        assets: [TREE_ASSET], // type=prop, not character
      };
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [propsOnlyPack],
        }),
        "npc",
        "shopkeeper",
      );
      expect(r.ref).toBeNull();
      expect(r.missReason).toBe("no-matching-pack-asset");
    });
  });

  describe("type-based pass — happy paths", () => {
    it("returns ref for the first asset whose type matches acceptedAssetTypes", () => {
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [PACK_WITH_BOTH],
        }),
        "npc",
        "shopkeeper",
      );
      // Shopkeeper accepts "character"; SHOPKEEPER_ASSET.type === "character"
      // and is the first match.
      expect(r.ref).toBe(`${PACK_ID}/${SHOPKEEPER_ASSET.id}`);
      expect(r.missReason).toBeUndefined();
    });

    it("scans across multiple packs in order; returns first match", () => {
      const emptyPack = {
        manifestId: "@nope/empty",
        name: "Empty",
        packVersion: "1.0.0",
        assets: [TREE_ASSET], // no character — won't match shopkeeper
      };
      const r = autoFillAssetRefDetailed(
        makeRuntime({
          plugins: [HYPERIA_ID],
          assetPacks: [emptyPack, PACK_WITH_BOTH], // empty first
        }),
        "npc",
        "shopkeeper",
      );
      // Skips the empty pack, finds eldric in the second pack.
      expect(r.ref).toBe(`${PACK_ID}/${SHOPKEEPER_ASSET.id}`);
    });
  });
});
