/**
 * Rune Data Manifest
 * Defines elemental staff mappings and rune metadata for magic combat.
 */

/**
 * Elemental staff to rune mapping.
 * Staff IDs that provide infinite elemental runes.
 */
export const ELEMENTAL_STAVES: Record<string, string[]> = {
  staff_of_air: ["air_rune"],
  staff_of_water: ["water_rune"],
  staff_of_earth: ["earth_rune"],
  staff_of_fire: ["fire_rune"],
};

/** Human-readable rune names for UI display */
export const RUNE_NAMES: Record<string, string> = {
  air_rune: "Air runes",
  water_rune: "Water runes",
  earth_rune: "Earth runes",
  fire_rune: "Fire runes",
  mind_rune: "Mind runes",
  chaos_rune: "Chaos runes",
};

/** All valid F2P rune IDs */
export const VALID_RUNES = [
  "air_rune",
  "water_rune",
  "earth_rune",
  "fire_rune",
  "mind_rune",
  "chaos_rune",
] as const;
