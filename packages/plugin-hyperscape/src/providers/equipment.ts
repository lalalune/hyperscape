/**
 * equipmentProvider - Supplies currently equipped items
 *
 * Provides:
 * - Weapon and shield
 * - Armor pieces (helmet, body, legs, boots, gloves, cape)
 * - Accessories (amulet, ring, arrows)
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { EquipmentData } from "../types.js";

export const equipmentProvider: Provider = {
  name: "equipment",
  description: "Provides currently equipped items",
  dynamic: true,
  position: 5,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const playerEntity = service?.getPlayerEntity();

    if (!playerEntity) {
      return {
        text: "Equipment unavailable",
        values: {},
        data: {},
      };
    }

    const eq = playerEntity.equipment;

    const equipmentData: EquipmentData = {
      weapon: eq.weapon,
      shield: eq.shield,
      armor: {
        helmet: eq.helmet,
        body: eq.body,
        legs: eq.legs,
        boots: eq.boots,
        gloves: eq.gloves,
        cape: eq.cape,
      },
      accessories: {
        amulet: eq.amulet,
        ring: eq.ring,
        arrows: eq.arrows,
      },
    };

    const text = `## Your Equipment
**Weapon**: ${eq.weapon || "None"}
**Shield**: ${eq.shield || "None"}

**Armor**:
  - Helmet: ${eq.helmet || "None"}
  - Body: ${eq.body || "None"}
  - Legs: ${eq.legs || "None"}
  - Boots: ${eq.boots || "None"}
  - Gloves: ${eq.gloves || "None"}
  - Cape: ${eq.cape || "None"}

**Accessories**:
  - Amulet: ${eq.amulet || "None"}
  - Ring: ${eq.ring || "None"}
  - Arrows: ${eq.arrows || "None"}`;

    return {
      text,
      values: {
        hasWeapon: !!eq.weapon,
        hasShield: !!eq.shield,
      },
      data: equipmentData,
    };
  },
};
