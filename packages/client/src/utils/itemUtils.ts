/**
 * Item Display Utilities
 *
 * Consolidated utility functions for item display across all panels.
 * Provides consistent emoji icons, formatting, and display helpers.
 *
 * @packageDocumentation
 */

/**
 * Note suffix used for noted items.
 * Mirrors the NOTE_SUFFIX constant from @hyperforge/shared NoteGenerator.ts
 */
const NOTE_SUFFIX = "_noted";

/**
 * Check if an item is a bank note (itemId ends with "_noted")
 *
 * @param itemId - Item ID to check
 * @returns true if this is a noted item ID
 */
export function isNotedItem(itemId: string): boolean {
  return itemId.endsWith(NOTE_SUFFIX);
}

/**
 * Get emoji icon for item based on itemId patterns.
 *
 * IMPORTANT: Order matters! More specific checks must come before general ones.
 * e.g., "pickaxe" before "axe", "hatchet" before "hat"
 *
 * @param itemId - The item's ID (e.g., "bronze_sword", "oak_logs")
 * @returns Emoji icon representing the item type
 */
export function getItemIcon(itemId: string): string {
  const id = itemId.toLowerCase();

  // Tools - check specific tool names FIRST (before partial matches)
  if (id.includes("pickaxe")) return "🪓"; // Pickaxe uses axe icon for consistency
  if (id.includes("hatchet")) return "🪓";
  if (id.includes("fishing") || id.includes("rod")) return "🎣";
  if (id.includes("tinderbox")) return "🔥";

  // Weapons
  if (id.includes("sword") || id.includes("dagger") || id.includes("scimitar"))
    return "⚔️";
  if (id.includes("bow")) return "🎯";
  if (id.includes("arrow") || id.includes("bolt")) return "🏹";

  // Armor - check AFTER tools (hatchet checked above, so "hat" is safe now)
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

  // Accessories
  if (id.includes("amulet") || id.includes("necklace")) return "📿";
  if (id.includes("ring")) return "💍";

  // Resources
  if (id.includes("coins") || id.includes("gold")) return "🪙";
  if (
    id.includes("fish") ||
    id.includes("shrimp") ||
    id.includes("lobster") ||
    id.includes("trout") ||
    id.includes("salmon") ||
    id.includes("sardine") ||
    id.includes("shark")
  )
    return "🐟";
  if (id.includes("log") || id.includes("wood")) return "🪵";
  if (id.includes("ore") || id.includes("bar")) return "🪨";
  if (id.includes("coal")) return "⚫";
  if (id.includes("bone")) return "🦴";

  // Consumables
  if (id.includes("food") || id.includes("bread") || id.includes("meat"))
    return "🍖";
  if (id.includes("potion") || id.includes("vial")) return "🧪";

  // Fallback for general "axe" (after hatchet/pickaxe checks)
  if (id.includes("axe")) return "🪓";

  // Magic
  if (id.includes("rune")) return "🔮";

  // Default fallback
  return "📦";
}

/**
 * Format itemId to display name (snake_case -> Title Case)
 *
 * @param itemId - The item's ID (e.g., "bronze_sword")
 * @returns Formatted display name (e.g., "Bronze Sword")
 */
export function formatItemName(itemId: string): string {
  return itemId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format quantity with K/M abbreviations (OSRS-style)
 *
 * @param quantity - The quantity to format
 * @returns Formatted string (e.g., "1.5K", "10M")
 */
export function formatQuantity(quantity: number): string {
  if (quantity >= 10_000_000) return `${Math.floor(quantity / 1_000_000)}M`;
  if (quantity >= 100_000) return `${Math.floor(quantity / 1_000)}K`;
  if (quantity >= 1_000) return `${(quantity / 1_000).toFixed(1)}K`;
  return String(quantity);
}

/**
 * Format price with K/M abbreviations
 * Slightly different from formatQuantity for large values (uses decimals for millions)
 *
 * @param price - The price to format
 * @returns Formatted string (e.g., "1.5K", "2.5M")
 */
export function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `${Math.floor(price / 1_000)}K`;
  return String(price);
}

/**
 * Get quantity text color based on OSRS thresholds
 *
 * @param quantity - The quantity to check
 * @returns CSS color string
 */
export function getQuantityColor(quantity: number): string {
  if (quantity >= 10_000_000) return "#00ff00"; // Green: 10M+
  if (quantity >= 100_000) return "#ffffff"; // White: 100K - 9.99M
  return "#ffff00"; // Yellow: < 100K
}
