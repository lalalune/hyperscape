/**
 * BankPanel Utility Functions
 *
 * Pure utility functions for item display and formatting.
 */

// ============================================================================
// ITEM UTILITIES
// ============================================================================

/**
 * Check if an item is a bank note (itemId ends with "_noted")
 *
 * Mirrors: @hyperscape/shared isNotedItemId() from NoteGenerator.ts
 * Keep in sync with NOTE_SUFFIX = "_noted" constant
 *
 * Note: Client-side duplicate to avoid bundle bloat from importing shared.
 * The canonical implementation lives in packages/shared/src/data/NoteGenerator.ts
 */
export function isNotedItem(itemId: string): boolean {
  return itemId.endsWith("_noted");
}

/**
 * Get emoji icon for item based on itemId patterns
 */
export function getItemIcon(itemId: string): string {
  const id = itemId.toLowerCase();

  // Weapons
  if (id.includes("sword") || id.includes("dagger") || id.includes("scimitar"))
    return "⚔️";
  if (id.includes("bow")) return "🎯";
  if (id.includes("arrow") || id.includes("bolt")) return "🏹";

  // Armor
  if (id.includes("shield") || id.includes("defender")) return "🛡️";
  if (id.includes("helmet") || id.includes("helm") || id.includes("hat"))
    return "⛑️";
  if (
    id.includes("body") ||
    id.includes("platebody") ||
    id.includes("chainmail")
  )
    return "👕";
  if (id.includes("legs") || id.includes("platelegs")) return "👖";
  if (id.includes("boots") || id.includes("boot")) return "👢";
  if (id.includes("glove") || id.includes("gauntlet")) return "🧤";
  if (id.includes("cape") || id.includes("cloak")) return "🧥";
  if (id.includes("amulet") || id.includes("necklace")) return "📿";
  if (id.includes("ring")) return "💍";

  // Resources
  if (id.includes("coins") || id.includes("gold")) return "🪙";
  if (id.includes("fish") || id.includes("shrimp") || id.includes("lobster"))
    return "🐟";
  if (id.includes("log") || id.includes("wood")) return "🪵";
  if (id.includes("ore") || id.includes("bar")) return "🪨";
  if (id.includes("bone")) return "🦴";

  // Consumables
  if (id.includes("food") || id.includes("bread") || id.includes("meat"))
    return "🍖";
  if (id.includes("potion")) return "🧪";
  if (id.includes("rune")) return "🔮";

  // Tools
  if (id.includes("hatchet") || id.includes("axe")) return "🪓";
  if (id.includes("pickaxe")) return "⛏️";

  // Default
  return "📦";
}

/**
 * Format item name from itemId (snake_case to Title Case)
 */
export function formatItemName(itemId: string): string {
  return itemId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format quantity for display (OSRS-style K/M abbreviations)
 */
export function formatQuantity(quantity: number): string {
  if (quantity >= 10_000_000) return `${Math.floor(quantity / 1_000_000)}M`;
  if (quantity >= 100_000) return `${Math.floor(quantity / 1_000)}K`;
  if (quantity >= 1_000) return `${(quantity / 1_000).toFixed(1)}K`;
  return String(quantity);
}

/**
 * Get quantity text color based on OSRS thresholds
 */
export function getQuantityColor(quantity: number): string {
  if (quantity >= 10_000_000) return "#00ff00"; // Green: 10M+
  if (quantity >= 100_000) return "#ffffff"; // White: 100K - 9.99M
  return "#ffff00"; // Yellow: < 100K
}
