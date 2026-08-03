/**
 * Combat Level Color Utility
 *
 * rules-accurate combat level color calculation for context menus.
 *
 * Colors range from bright green (-10 or lower difference) through
 * yellow (same level) to bright red (+10 or higher difference).
 *
 */

/**
 * Get the color for a combat level relative to the player's level.
 *
 * classic MMORPG color gradient:
 * - +10 or higher: #ff0000 (bright red)
 * - 0 (same level): #ffff00 (yellow)
 * - -10 or lower: #00ff00 (bright green)
 *
 * Linear interpolation between these points.
 *
 * @param targetLevel - The combat level of the target entity
 * @param playerLevel - The local player's combat level
 * @returns Hex color string (e.g., "#ff0000")
 */
export function getCombatLevelColor(
  targetLevel: number,
  playerLevel: number,
): string {
  const diff = targetLevel - playerLevel;

  // Clamp to -10 to +10 range (classic MMORPG behavior)
  const clampedDiff = Math.max(-10, Math.min(10, diff));

  if (clampedDiff === 0) {
    return "#ffff00"; // Yellow - same level
  }

  if (clampedDiff > 0) {
    // Higher level: yellow → red gradient
    // diff 1 = #ffd000, diff 10 = #ff0000
    // Green channel decreases from 255 to 0
    const ratio = clampedDiff / 10;
    const green = Math.round(255 * (1 - ratio));
    return `#ff${green.toString(16).padStart(2, "0")}00`;
  } else {
    // Lower level: yellow → green gradient
    // diff -1 = #d0ff00, diff -10 = #00ff00
    // Red channel decreases from 255 to 0
    const ratio = Math.abs(clampedDiff) / 10;
    const red = Math.round(255 * (1 - ratio));
    return `#${red.toString(16).padStart(2, "0")}ff00`;
  }
}

/**
 * Get a human-readable description of relative combat level.
 *
 * @param targetLevel - The combat level of the target entity
 * @param playerLevel - The local player's combat level
 * @returns Description string (e.g., "3 levels higher")
 */
export function getCombatLevelDescription(
  targetLevel: number,
  playerLevel: number,
): string {
  const diff = targetLevel - playerLevel;
  if (diff === 0) return "Same level";
  if (diff > 0) return `${diff} level${diff > 1 ? "s" : ""} higher`;
  return `${Math.abs(diff)} level${Math.abs(diff) > 1 ? "s" : ""} lower`;
}
