/**
 * Mock for @hyperscape/shared
 *
 * Provides mock implementations for all exports used by BankPanel components.
 */

// Mock getItem function
export function getItem(itemId: string): {
  equipSlot?: string;
  equipable?: boolean;
} | null {
  // Mock item data based on itemId patterns
  const mockItems: Record<string, { equipSlot?: string; equipable?: boolean }> =
    {
      bronze_sword: { equipSlot: "weapon", equipable: true },
      iron_helmet: { equipSlot: "helmet", equipable: true },
      oak_logs: {},
      coins: {},
      lobster: {},
      rune_platebody: { equipSlot: "body", equipable: true },
    };

  // Check for exact match first
  if (mockItems[itemId]) {
    return mockItems[itemId];
  }

  // Pattern matching for unknown items
  if (
    itemId.includes("sword") ||
    itemId.includes("dagger") ||
    itemId.includes("scimitar")
  ) {
    return { equipSlot: "weapon", equipable: true };
  }
  if (
    itemId.includes("helmet") ||
    itemId.includes("helm") ||
    itemId.includes("hat")
  ) {
    return { equipSlot: "helmet", equipable: true };
  }
  if (
    itemId.includes("body") ||
    itemId.includes("platebody") ||
    itemId.includes("chainmail")
  ) {
    return { equipSlot: "body", equipable: true };
  }
  if (itemId.includes("legs") || itemId.includes("platelegs")) {
    return { equipSlot: "legs", equipable: true };
  }
  if (itemId.includes("shield") || itemId.includes("defender")) {
    return { equipSlot: "shield", equipable: true };
  }

  // Non-equipable items return empty object
  return {};
}

// Mock PlayerEquipmentItems type
export interface PlayerEquipmentItems {
  helmet: { id: string; slot: string } | null;
  body: { id: string; slot: string } | null;
  legs: { id: string; slot: string } | null;
  weapon: { id: string; slot: string } | null;
  shield: { id: string; slot: string } | null;
  arrows: { id: string; slot: string } | null;
}

// Re-export empty objects for any other imports that might be needed
export const Nodes = {};
