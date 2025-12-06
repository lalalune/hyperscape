/**
 * Item Display Utilities
 *
 * Shared functions for displaying items across all panels.
 * Consolidates duplicate code from StorePanel and BankPanel.
 */

/**
 * Get emoji icon for item based on itemId.
 * Comprehensive list - includes all cases from both panels.
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

  // Accessories
  if (id.includes("amulet") || id.includes("necklace")) return "📿";
  if (id.includes("ring")) return "💍";

  // Resources
  if (id.includes("coins") || id.includes("gold")) return "🪙";
  if (id.includes("fish") || id.includes("shrimp") || id.includes("lobster"))
    return "🐟";
  if (id.includes("log") || id.includes("wood")) return "🪵";
  if (id.includes("ore") || id.includes("bar")) return "🪨";

  // Consumables
  if (id.includes("food") || id.includes("bread") || id.includes("meat"))
    return "🍖";
  if (id.includes("potion")) return "🧪";

  // Tools (was only in StorePanel - now shared)
  if (id.includes("fishing") || id.includes("rod")) return "🎣";
  if (id.includes("tinderbox")) return "🔥";
  if (id.includes("hatchet") || id.includes("axe")) return "🪓";
  if (id.includes("pickaxe")) return "⛏️";

  // Other
  if (id.includes("rune")) return "🔮";
  if (id.includes("bone")) return "🦴";

  return "📦";
}

/**
 * Format itemId to display name (snake_case -> Title Case)
 */
export function formatItemName(itemId: string): string {
  return itemId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format quantity with K/M abbreviations
 */
export function formatQuantity(quantity: number): string {
  if (quantity >= 10_000_000) return `${Math.floor(quantity / 1_000_000)}M`;
  if (quantity >= 100_000) return `${Math.floor(quantity / 1_000)}K`;
  if (quantity >= 1_000) return `${(quantity / 1_000).toFixed(1)}K`;
  return String(quantity);
}

/**
 * Format price with K/M abbreviations
 * Slightly different from formatQuantity for large values
 */
export function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `${Math.floor(price / 1_000)}K`;
  return String(price);
}
