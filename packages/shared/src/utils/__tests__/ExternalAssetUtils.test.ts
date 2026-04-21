import { beforeEach, describe, expect, it } from "vitest";
import type { ExternalResourceData } from "../../data/DataManager";
import {
  getExternalResource,
  getExternalResources,
} from "../ExternalAssetUtils";

describe("ExternalAssetUtils", () => {
  beforeEach(() => {
    delete (
      globalThis as {
        EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
      }
    ).EXTERNAL_RESOURCES;
  });

  it("hydrates missing staging tree resources from fallback data", () => {
    const resource = getExternalResource("tree_general");
    expect(resource).not.toBeNull();
    expect(resource?.id).toBe("tree_general");
    expect(resource?.modelVariants?.length).toBeGreaterThan(0);
    expect(getExternalResources().has("tree_general")).toBe(true);
  });

  it("points fallback staging tree resources at nested tree asset URIs", () => {
    const resourceIds = [
      "tree_banana",
      "tree_pineDead",
      "tree_eucalyptus",
      "tree_general",
      "tree_magic",
      "tree_mahogany",
    ];

    for (const resourceId of resourceIds) {
      const resource = getExternalResource(resourceId);
      expect(resource).not.toBeNull();
      for (const modelVariant of resource?.modelVariants ?? []) {
        expect(modelVariant).toMatch(
          /^asset:\/\/models\/trees\/[^/]+\/[^/]+\.glb$/,
        );
      }
      expect(resource?.depletedModelPath).toBe(
        "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
      );
    }
  });

  it("prefers already-loaded manifest resources over fallback data", () => {
    const resources = getExternalResources();
    resources.set("tree_general", {
      id: "tree_general",
      name: "Loaded Tree",
      type: "tree",
      modelPath: null,
      depletedModelPath: null,
      scale: 2,
      depletedScale: 1,
      harvestSkill: "woodcutting",
      toolRequired: "bronze_hatchet",
      levelRequired: 1,
      baseCycleTicks: 4,
      depleteChance: 0.5,
      respawnTicks: 10,
      harvestYield: [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1,
          xpAmount: 1,
          stackable: true,
        },
      ],
    });

    const resource = getExternalResource("tree_general");
    expect(resource?.name).toBe("Loaded Tree");
    expect(resource?.scale).toBe(2);
  });
});
