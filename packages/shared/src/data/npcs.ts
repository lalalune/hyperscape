/**
 * NPC Database
 *
 * ALL NPC data is loaded from JSON manifests at runtime by DataManager.
 * This keeps NPC definitions data-driven and separate from code.
 *
 * Available 3D model types (in /assets/world/forge/):
 * - goblin/goblin_rigged.glb     → Used for goblins
 * - thug/thug_rigged.glb         → Used for bandits
 * - human/human_rigged.glb       → Used for guards, knights, warriors, rangers, shopkeepers
 * - troll/troll_rigged.glb       → Used for hobgoblins
 * - imp/imp_rigged.glb           → Used for dark warriors
 *
 * To add new NPCs:
 * 1. Add entry to world/assets/manifests/npcs.json
 * 2. Use one of the existing modelPath types above
 * 3. OR generate new model in 3D Asset Forge
 * 4. Restart server to reload manifests
 *
 * DO NOT add NPC data here - keep it in JSON!
 */

import type { NPCData, NPCCategory } from "../types/core/core";

/**
 * NPC Database - Populated at runtime from JSON manifests
 * DataManager.loadNPCs() reads world/assets/manifests/npcs.json
 */
export const ALL_NPCS: Map<string, NPCData> = new Map();

/**
 * Helper Functions
 */

// Get NPC by ID
export function getNPCById(npcId: string): NPCData | null {
  return ALL_NPCS.get(npcId) || null;
}

// Get NPCs by category
export function getNPCsByCategory(category: NPCCategory): NPCData[] {
  return Array.from(ALL_NPCS.values()).filter(
    (npc) => npc.category === category,
  );
}

// Get NPCs by biome
export function getNPCsByBiome(biome: string): NPCData[] {
  return Array.from(ALL_NPCS.values()).filter((npc) =>
    npc.spawnBiomes?.includes(biome),
  );
}

// Get NPCs by level range
export function getNPCsByLevelRange(
  minLevel: number,
  maxLevel: number,
): NPCData[] {
  return Array.from(ALL_NPCS.values()).filter(
    (npc) => npc.stats.level >= minLevel && npc.stats.level <= maxLevel,
  );
}

// Get combat NPCs (mob, boss, quest with combat)
export function getCombatNPCs(): NPCData[] {
  return Array.from(ALL_NPCS.values()).filter(
    (npc) =>
      npc.category === "mob" ||
      npc.category === "boss" ||
      npc.category === "quest",
  );
}

// Get service NPCs (neutral)
export function getServiceNPCs(): NPCData[] {
  return Array.from(ALL_NPCS.values()).filter(
    (npc) => npc.category === "neutral",
  );
}

// Check if NPC can drop specific item
export function canNPCDropItem(npcId: string, itemId: string): boolean {
  const npc = getNPCById(npcId);
  if (!npc) return false;

  // Check default drop
  if (
    npc.drops.defaultDrop.enabled &&
    npc.drops.defaultDrop.itemId === itemId
  ) {
    return true;
  }

  // Check all drop tiers
  const allDrops = [
    ...npc.drops.always,
    ...npc.drops.common,
    ...npc.drops.uncommon,
    ...npc.drops.rare,
    ...npc.drops.veryRare,
  ];

  return allDrops.some((drop) => drop.itemId === itemId);
}

// Calculate NPC drops with RNG
export function calculateNPCDrops(
  npcId: string,
): Array<{ itemId: string; quantity: number }> {
  const npc = getNPCById(npcId);
  if (!npc) return [];

  const drops: Array<{ itemId: string; quantity: number }> = [];

  // Add default drop if enabled
  if (npc.drops.defaultDrop.enabled) {
    drops.push({
      itemId: npc.drops.defaultDrop.itemId,
      quantity: npc.drops.defaultDrop.quantity,
    });
  }

  // Process all drop tiers
  const processDrop = (drop: {
    itemId: string;
    minQuantity: number;
    maxQuantity: number;
    chance: number;
  }) => {
    if (Math.random() < drop.chance) {
      const quantity = Math.floor(
        Math.random() * (drop.maxQuantity - drop.minQuantity + 1) +
          drop.minQuantity,
      );
      drops.push({ itemId: drop.itemId, quantity });
    }
  };

  // Always drops (100% chance)
  npc.drops.always.forEach(processDrop);

  // Roll for other tiers
  npc.drops.common.forEach(processDrop);
  npc.drops.uncommon.forEach(processDrop);
  npc.drops.rare.forEach(processDrop);
  npc.drops.veryRare.forEach(processDrop);

  return drops;
}

/**
 * Calculate NPC combat level using standard formula
 * Same formula as players for consistency
 */
export function calculateNPCCombatLevel(npc: NPCData): number {
  const stats = npc.stats;
  const attack = stats.attack;
  const strength = stats.strength;
  const defense = stats.defense;
  const hitpoints = stats.health; // OSRS: hitpoints = max HP directly
  const ranged = stats.ranged * 1.5; // Ranged counts for 1.5x

  const combatLevel = Math.floor(
    (defense + hitpoints + Math.floor(ranged / 2)) * 0.25 +
      Math.max(attack + strength, (ranged * 2) / 3) * 0.325,
  );

  return Math.max(3, combatLevel);
}

/**
 * Spawning Constants per GDD
 */
export const NPC_SPAWN_CONSTANTS = {
  GLOBAL_RESPAWN_TIME: 900000, // 15 minutes per GDD
  MAX_NPCS_PER_ZONE: 10,
  SPAWN_RADIUS_CHECK: 5, // Don't spawn if player within 5 meters
  AGGRO_LEVEL_THRESHOLD: 5, // Some NPCs ignore players above this combat level
} as const;
