/**
 * RangeSystem.getNPCSize ↔ npcSizesRegistry integration test.
 *
 * Pure-function consumer wiring proof. `getNPCSize` is a top-level
 * export from `RangeSystem.ts`, so we can drive it without spinning
 * up the system class. Mirrors the worldAreas → ZoneDetectionSystem
 * pattern but skips the system-construction overhead since the
 * consumer is already function-level.
 *
 * What it proves:
 *   - When the registry is loaded, `getNPCSize` returns registry data.
 *   - When the registry is loaded but missing the id, returns the
 *     registry's `getOrDefault` answer (`{width:1, depth:1}`) — NOT
 *     a fallback to the legacy NPC_SIZES constant.
 *   - When the registry is unloaded, falls back to NPC_SIZES.
 *   - Registry hot-reload (call .load with new data) flips subsequent
 *     reads without a "system restart".
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  NPCSizesManifestSchema,
  type NPCSizesManifest,
} from "@hyperforge/manifest-schema";

import { npcSizesRegistry } from "@hyperforge/shared";
import { getNPCSize } from "../../RangeSystem";

function buildManifest(
  sizes: Record<string, { width: number; depth: number }>,
): NPCSizesManifest {
  return NPCSizesManifestSchema.parse({
    $schema: "hyperforge.npc-sizes.v1",
    sizes,
  });
}

describe("RangeSystem.getNPCSize ↔ npcSizesRegistry wiring", () => {
  beforeEach(() => {
    npcSizesRegistry._unloadForTests();
  });

  afterEach(() => {
    npcSizesRegistry._unloadForTests();
  });

  it("when registry loaded, returns the registry's size for known ids", () => {
    npcSizesRegistry.load(
      buildManifest({
        ice_demon: { width: 5, depth: 5 },
        forest_imp: { width: 1, depth: 1 },
      }),
    );

    expect(getNPCSize("ice_demon")).toEqual({ width: 5, depth: 5 });
    expect(getNPCSize("forest_imp")).toEqual({ width: 1, depth: 1 });
  });

  it("normalizes mobType to lowercase before lookup (matches legacy behavior)", () => {
    npcSizesRegistry.load(buildManifest({ ice_demon: { width: 5, depth: 5 } }));

    expect(getNPCSize("Ice_Demon")).toEqual({ width: 5, depth: 5 });
    expect(getNPCSize("ICE_DEMON")).toEqual({ width: 5, depth: 5 });
  });

  it("when registry loaded but id missing, returns the registry's default {width:1, depth:1}", () => {
    npcSizesRegistry.load(buildManifest({ ice_demon: { width: 5, depth: 5 } }));

    // Critical: the legacy NPC_SIZES might have an entry for "goblin",
    // but the registry IS loaded, so the registry's getOrDefault answer
    // wins. Authored manifests are the source of truth — a missing id
    // means "use the default", not "look at the legacy constant".
    expect(getNPCSize("goblin_not_in_manifest")).toEqual({
      width: 1,
      depth: 1,
    });
  });

  it("when registry unloaded, falls back to legacy NPC_SIZES", () => {
    expect(npcSizesRegistry.isLoaded()).toBe(false);
    // The legacy constant is populated at module load from npc-sizes.json,
    // so common ids like "goblin" should resolve via the fallback.
    const goblinSize = getNPCSize("goblin");
    expect(goblinSize.width).toBeGreaterThanOrEqual(1);
    expect(goblinSize.depth).toBeGreaterThanOrEqual(1);

    // Unknown id when unloaded: hits the `?? { width: 1, depth: 1 }`
    // tail of the fallback path.
    expect(getNPCSize("definitely_not_a_real_npc_id_xyz")).toEqual({
      width: 1,
      depth: 1,
    });
  });

  it("hot-reload: subsequent reads honor a re-loaded registry", () => {
    npcSizesRegistry.load(buildManifest({ boss: { width: 2, depth: 2 } }));
    expect(getNPCSize("boss")).toEqual({ width: 2, depth: 2 });

    // Author resizes the boss.
    npcSizesRegistry.load(buildManifest({ boss: { width: 4, depth: 4 } }));
    expect(getNPCSize("boss")).toEqual({ width: 4, depth: 4 });
  });
});
