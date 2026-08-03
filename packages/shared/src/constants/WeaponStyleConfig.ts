/**
 * WeaponStyleConfig - rules-accurate combat style availability per weapon type
 *
 * In classic MMORPG, different weapon types have different available combat styles.
 * This configuration maps weapon types to their allowed combat styles.
 *
 */

import { WeaponType } from "../types/game/item-types";
import type { CombatStyleExtended } from "../types/game/combat-types";

/**
 * Combat styles available for each weapon type.
 * rules-accurate: Not all weapons have all 4 styles.
 */
export const WEAPON_STYLE_CONFIG: Record<WeaponType, CombatStyleExtended[]> = {
  // Swords - full style selection (slash/stab versatility)
  [WeaponType.SWORD]: ["accurate", "aggressive", "defensive", "controlled"],

  // Scimitars - full style selection (curved blade versatility)
  [WeaponType.SCIMITAR]: ["accurate", "aggressive", "defensive", "controlled"],

  // Maces - full style selection (crush weapon with defensive option)
  [WeaponType.MACE]: ["accurate", "aggressive", "defensive", "controlled"],

  // Spears - full style selection (reach weapon)
  [WeaponType.SPEAR]: ["accurate", "aggressive", "defensive", "controlled"],

  // Longswords - full style selection (slash weapon)
  [WeaponType.LONGSWORD]: ["accurate", "aggressive", "defensive", "controlled"],

  // Two-handed swords - full style selection (2H melee)
  [WeaponType.TWO_HAND_SWORD]: [
    "accurate",
    "aggressive",
    "defensive",
    "controlled",
  ],

  // Halberds - full style selection (2H reach weapon)
  [WeaponType.HALBERD]: ["accurate", "aggressive", "defensive", "controlled"],

  // Axes - no controlled (pure damage weapons in classic MMORPG)
  [WeaponType.AXE]: ["accurate", "aggressive", "defensive"],

  // Daggers - no controlled (quick stabbing weapons)
  [WeaponType.DAGGER]: ["accurate", "aggressive", "defensive"],

  // Unarmed - no controlled (punching)
  [WeaponType.NONE]: ["accurate", "aggressive", "defensive"],

  // Ranged weapons - rules-accurate styles
  // Accurate: +3 ranged level, normal speed
  // Rapid: no bonus, -1 tick faster attack
  // Longrange: +2 attack range, XP split to ranged/defence
  [WeaponType.BOW]: ["accurate", "rapid", "longrange"],
  [WeaponType.CROSSBOW]: ["accurate", "rapid", "longrange"],

  // Magic weapons - rules-accurate styles
  // Staves/wands have both melee and magic styles:
  //   Melee (crush): Bash=accurate, Pound=aggressive, Focus=defensive
  //   Magic: Spell=autocast (defensive autocast is a toggle, not a separate style)
  [WeaponType.STAFF]: ["accurate", "aggressive", "defensive", "autocast"],
  [WeaponType.WAND]: ["accurate", "aggressive", "defensive", "autocast"],

  // Shield - not a weapon, but if somehow selected, default to defensive
  [WeaponType.SHIELD]: ["defensive"],
};

/**
 * Get available combat styles for a weapon type
 * @param weaponType - The type of weapon equipped
 * @returns Array of available combat styles
 */
export function getAvailableStyles(
  weaponType: WeaponType,
): CombatStyleExtended[] {
  return WEAPON_STYLE_CONFIG[weaponType] ?? ["accurate"];
}

/**
 * Check if a combat style is valid for the given weapon type
 * @param weaponType - The type of weapon equipped
 * @param style - The combat style to check
 * @returns true if the style is valid for this weapon
 */
export function isStyleValidForWeapon(
  weaponType: WeaponType,
  style: CombatStyleExtended,
): boolean {
  const availableStyles = getAvailableStyles(weaponType);
  return availableStyles.includes(style);
}

/**
 * Get the default combat style for a weapon type
 * Falls back to "accurate" if the weapon's first style is not available
 * @param weaponType - The type of weapon equipped
 * @returns The default combat style for this weapon
 */
export function getDefaultStyleForWeapon(
  weaponType: WeaponType,
): CombatStyleExtended {
  const availableStyles = getAvailableStyles(weaponType);
  return availableStyles[0] ?? "accurate";
}
