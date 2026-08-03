/**
 * Combat Spells Manifest
 * Defines all F2P combat spells (Strike and Bolt tiers).
 */

import type { RuneRequirement } from "../systems/shared/combat/RuneService";

export interface SpellData {
  id: string;
  name: string;
  level: number;
  baseMaxHit: number;
  baseXp: number;
  element: string;
  attackSpeed: number;
  runes: RuneRequirement[];
}

/** All F2P combat spells keyed by spell ID */
export const COMBAT_SPELLS: Record<string, SpellData> = {
  // Strike tier
  wind_strike: {
    id: "wind_strike",
    name: "Wind Strike",
    level: 1,
    baseMaxHit: 2,
    baseXp: 5.5,
    element: "air",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 1 },
      { runeId: "mind_rune", quantity: 1 },
    ],
  },
  water_strike: {
    id: "water_strike",
    name: "Water Strike",
    level: 5,
    baseMaxHit: 4,
    baseXp: 7.5,
    element: "water",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 1 },
      { runeId: "water_rune", quantity: 1 },
      { runeId: "mind_rune", quantity: 1 },
    ],
  },
  earth_strike: {
    id: "earth_strike",
    name: "Earth Strike",
    level: 9,
    baseMaxHit: 6,
    baseXp: 9.5,
    element: "earth",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 1 },
      { runeId: "earth_rune", quantity: 2 },
      { runeId: "mind_rune", quantity: 1 },
    ],
  },
  fire_strike: {
    id: "fire_strike",
    name: "Fire Strike",
    level: 13,
    baseMaxHit: 8,
    baseXp: 11.5,
    element: "fire",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 2 },
      { runeId: "fire_rune", quantity: 3 },
      { runeId: "mind_rune", quantity: 1 },
    ],
  },

  // Bolt tier
  wind_bolt: {
    id: "wind_bolt",
    name: "Wind Bolt",
    level: 17,
    baseMaxHit: 9,
    baseXp: 13.5,
    element: "air",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 2 },
      { runeId: "chaos_rune", quantity: 1 },
    ],
  },
  water_bolt: {
    id: "water_bolt",
    name: "Water Bolt",
    level: 23,
    baseMaxHit: 10,
    baseXp: 16.5,
    element: "water",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 2 },
      { runeId: "water_rune", quantity: 2 },
      { runeId: "chaos_rune", quantity: 1 },
    ],
  },
  earth_bolt: {
    id: "earth_bolt",
    name: "Earth Bolt",
    level: 29,
    baseMaxHit: 11,
    baseXp: 19.5,
    element: "earth",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 2 },
      { runeId: "earth_rune", quantity: 3 },
      { runeId: "chaos_rune", quantity: 1 },
    ],
  },
  fire_bolt: {
    id: "fire_bolt",
    name: "Fire Bolt",
    level: 35,
    baseMaxHit: 12,
    baseXp: 22.5,
    element: "fire",
    attackSpeed: 5,
    runes: [
      { runeId: "air_rune", quantity: 3 },
      { runeId: "fire_rune", quantity: 4 },
      { runeId: "chaos_rune", quantity: 1 },
    ],
  },
};

/** All spell IDs in order of level */
export const SPELL_ORDER = [
  "wind_strike",
  "water_strike",
  "earth_strike",
  "fire_strike",
  "wind_bolt",
  "water_bolt",
  "earth_bolt",
  "fire_bolt",
];
