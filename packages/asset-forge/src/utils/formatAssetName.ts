/**
 * Format asset names for display
 * Converts "sword-bronze-base" to "Bronze Sword (Base)"
 */

export function formatAssetName(name: string): string {
  if (!name) return "Unnamed Asset";

  // Split by hyphens
  const parts = name.split("-");

  // Check if it's a base model
  const isBase = parts[parts.length - 1] === "base";
  if (isBase) {
    parts.pop(); // Remove 'base' from parts
  }

  // Check if it's a variant (has material at the end)
  const materials = [
    "bronze",
    "steel",
    "mithril",
    "iron",
    "wood",
    "oak",
    "willow",
    "leather",
  ];
  const _lastPart = parts[parts.length - 1];
  const _hasMaterial = materials.includes(_lastPart);

  // Format the name
  let formatted = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  // Add (Base) suffix if it's a base model
  if (isBase) {
    formatted += " (Base)";
  }

  return formatted;
}
