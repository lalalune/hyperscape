/**
 * Smithing Types - Type definitions for the smithing system
 *
 * All smithing data (levels, XP, bars required) is manifest-driven:
 * @see packages/server/world/assets/manifests/items.json for recipe data
 * @see ProcessingDataProvider for runtime accessors
 */

/**
 * Smithing category types
 */
export type SmithingCategory = "sword" | "hatchet" | "pickaxe";

/**
 * Bar tier types (matches bar IDs without "_bar" suffix)
 */
export type BarTier = "bronze" | "iron" | "steel" | "mithril";
