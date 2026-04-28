import { describe, expect, it } from "vitest";
import { resolveEquipmentVisualUrls } from "../EquipmentVisualHelpers";

describe("EquipmentVisualHelpers", () => {
  it("uses the packaged arrow visual when an ammo item is explicitly model-less", () => {
    const urls = resolveEquipmentVisualUrls({
      assetsUrl: "https://example.com/game-assets",
      itemId: "iron_arrow",
      slot: "arrows",
      itemData: {
        modelPath: null,
        equippedModelPath: undefined,
      },
    });

    expect(urls).toEqual({
      primaryUrl:
        "https://example.com/game-assets/models/arrows/arrows-bronze/arrows-bronze.glb",
      fallbackUrl: null,
    });
  });

  it("keeps heuristic model resolution for regular equipment items", () => {
    const urls = resolveEquipmentVisualUrls({
      assetsUrl: "https://example.com/game-assets",
      itemId: "iron_sword",
      slot: "mainHand",
      itemData: {
        modelPath: undefined,
        equippedModelPath: undefined,
      },
    });

    expect(urls).toEqual({
      primaryUrl:
        "https://example.com/game-assets/models/swords-old/sword-iron-aligned.glb",
      fallbackUrl:
        "https://example.com/game-assets/models/swords-old/sword-iron/sword-iron-aligned.glb",
    });
  });
});
