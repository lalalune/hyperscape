/**
 * possibilitiesProvider - What actions are currently possible
 *
 * Tells the LLM what actions are CURRENTLY possible based on:
 * - Inventory contents (what can be crafted/cooked/burned)
 * - Skills (what level requirements are met)
 * - Nearby entities (what can be gathered/attacked)
 * - Combat readiness (is combat advisable)
 *
 * This provider enables intelligent, context-aware goal selection.
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
  ProviderDataRecord,
} from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import type { InventoryItem, Entity, Skills } from "../types.js";
import { getCombatReadiness } from "./goalProvider.js";

// ============================================================================
// RECIPE DATA - Simplified recipe definitions for crafting possibilities
// ============================================================================

interface SmeltingRecipe {
  barId: string;
  barName: string;
  primaryOre: string;
  secondaryOre: string | null;
  coalRequired: number;
  levelRequired: number;
}

interface SmithingRecipe {
  itemId: string;
  itemName: string;
  barType: string;
  barsRequired: number;
  levelRequired: number;
  category: string;
}

interface CookingRecipe {
  rawItemId: string;
  rawName: string;
  cookedItemId: string;
  cookedName: string;
  levelRequired: number;
}

interface FiremakingRecipe {
  logId: string;
  logName: string;
  levelRequired: number;
  xp: number;
}

// Core smelting recipes (OSRS-style)
const SMELTING_RECIPES: SmeltingRecipe[] = [
  {
    barId: "bronze_bar",
    barName: "Bronze Bar",
    primaryOre: "copper_ore",
    secondaryOre: "tin_ore",
    coalRequired: 0,
    levelRequired: 1,
  },
  {
    barId: "iron_bar",
    barName: "Iron Bar",
    primaryOre: "iron_ore",
    secondaryOre: null,
    coalRequired: 0,
    levelRequired: 15,
  },
  {
    barId: "steel_bar",
    barName: "Steel Bar",
    primaryOre: "iron_ore",
    secondaryOre: null,
    coalRequired: 2,
    levelRequired: 30,
  },
  {
    barId: "mithril_bar",
    barName: "Mithril Bar",
    primaryOre: "mithril_ore",
    secondaryOre: null,
    coalRequired: 4,
    levelRequired: 50,
  },
];

// Core smithing recipes (OSRS-style)
const SMITHING_RECIPES: SmithingRecipe[] = [
  // Bronze items
  {
    itemId: "bronze_dagger",
    itemName: "Bronze Dagger",
    barType: "bronze_bar",
    barsRequired: 1,
    levelRequired: 1,
    category: "weapons",
  },
  {
    itemId: "bronze_sword",
    itemName: "Bronze Sword",
    barType: "bronze_bar",
    barsRequired: 1,
    levelRequired: 4,
    category: "weapons",
  },
  {
    itemId: "bronze_axe",
    itemName: "Bronze Axe",
    barType: "bronze_bar",
    barsRequired: 1,
    levelRequired: 1,
    category: "tools",
  },
  {
    itemId: "bronze_pickaxe",
    itemName: "Bronze Pickaxe",
    barType: "bronze_bar",
    barsRequired: 2,
    levelRequired: 5,
    category: "tools",
  },
  // Iron items
  {
    itemId: "iron_dagger",
    itemName: "Iron Dagger",
    barType: "iron_bar",
    barsRequired: 1,
    levelRequired: 15,
    category: "weapons",
  },
  {
    itemId: "iron_sword",
    itemName: "Iron Sword",
    barType: "iron_bar",
    barsRequired: 2,
    levelRequired: 19,
    category: "weapons",
  },
  {
    itemId: "iron_axe",
    itemName: "Iron Axe",
    barType: "iron_bar",
    barsRequired: 1,
    levelRequired: 16,
    category: "tools",
  },
  {
    itemId: "iron_pickaxe",
    itemName: "Iron Pickaxe",
    barType: "iron_bar",
    barsRequired: 2,
    levelRequired: 20,
    category: "tools",
  },
];

// Core cooking recipes
const COOKING_RECIPES: CookingRecipe[] = [
  {
    rawItemId: "raw_shrimp",
    rawName: "Raw Shrimp",
    cookedItemId: "shrimp",
    cookedName: "Shrimp",
    levelRequired: 1,
  },
  {
    rawItemId: "raw_anchovies",
    rawName: "Raw Anchovies",
    cookedItemId: "anchovies",
    cookedName: "Anchovies",
    levelRequired: 1,
  },
  {
    rawItemId: "raw_trout",
    rawName: "Raw Trout",
    cookedItemId: "trout",
    cookedName: "Trout",
    levelRequired: 15,
  },
  {
    rawItemId: "raw_salmon",
    rawName: "Raw Salmon",
    cookedItemId: "salmon",
    cookedName: "Salmon",
    levelRequired: 25,
  },
  {
    rawItemId: "raw_lobster",
    rawName: "Raw Lobster",
    cookedItemId: "lobster",
    cookedName: "Lobster",
    levelRequired: 40,
  },
];

// Core firemaking recipes
const FIREMAKING_RECIPES: FiremakingRecipe[] = [
  { logId: "logs", logName: "Normal Logs", levelRequired: 1, xp: 40 },
  { logId: "oak_logs", logName: "Oak Logs", levelRequired: 15, xp: 60 },
  { logId: "willow_logs", logName: "Willow Logs", levelRequired: 30, xp: 90 },
  { logId: "maple_logs", logName: "Maple Logs", levelRequired: 45, xp: 135 },
  { logId: "yew_logs", logName: "Yew Logs", levelRequired: 60, xp: 202 },
];

// Food items for healing detection
const FOOD_ITEMS = new Set([
  "shrimp",
  "anchovies",
  "trout",
  "salmon",
  "lobster",
  "swordfish",
  "monkfish",
  "bread",
  "cake",
  "pie",
  "cooked_meat",
  "cooked_chicken",
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count items in inventory by itemId
 */
function countInventoryItems(items: InventoryItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = item.id?.toLowerCase() || item.name?.toLowerCase() || "";
    const current = counts.get(id) || 0;
    counts.set(id, current + (item.quantity || 1));
  }
  return counts;
}

/**
 * Get skill level safely
 */
function getSkillLevel(skills: Skills | undefined, skillName: string): number {
  if (!skills) return 1;
  const skill = skills[skillName.toLowerCase()];
  return skill?.level ?? 1;
}

/**
 * Check if player has food in inventory
 */
function hasFood(items: InventoryItem[]): boolean {
  return items.some((item) => {
    const name = item.name?.toLowerCase() || "";
    const id = item.id?.toLowerCase() || "";
    return (
      FOOD_ITEMS.has(name) ||
      FOOD_ITEMS.has(id) ||
      name.includes("fish") ||
      name.includes("cooked")
    );
  });
}

/**
 * Check if an entity is attackable (mob/NPC)
 */
function isAttackable(entity: Entity): boolean {
  const name = entity.name?.toLowerCase() || "";
  // Common attackable mobs
  return (
    name.includes("goblin") ||
    name.includes("cow") ||
    name.includes("chicken") ||
    name.includes("rat") ||
    name.includes("spider") ||
    name.includes("skeleton") ||
    name.includes("zombie") ||
    name.includes("imp")
  );
}

/**
 * Check if entity is a gatherable resource
 */
function getResourceType(entity: Entity): string | null {
  const name = entity.name?.toLowerCase() || "";
  if (name.includes("tree") || name.includes("oak") || name.includes("willow"))
    return "tree";
  if (name.includes("rock") || name.includes("ore")) return "rock";
  if (name.includes("fishing") || name.includes("spot")) return "fishing";
  return null;
}

// ============================================================================
// POSSIBILITY DETECTION
// ============================================================================

interface CraftableSmelting {
  barId: string;
  barName: string;
  ingredients: string;
  canMake: number;
}

interface CraftableSmithing {
  itemId: string;
  itemName: string;
  barsNeeded: number;
  barType: string;
  canMake: number;
}

interface CraftableCooking {
  rawItem: string;
  cookedItem: string;
  count: number;
}

interface CraftableFiremaking {
  logName: string;
  count: number;
  xp: number;
}

interface GatherableResource {
  type: string;
  name: string;
  levelRequired: number;
  canGather: boolean;
  count: number;
}

interface AttackableTarget {
  name: string;
  entityId: string;
  count: number;
}

interface TrainableSkill {
  skill: string;
  currentLevel: number;
  canTrain: boolean;
  howToTrain: string;
}

export interface PossibilitiesData {
  craftable: {
    smelting: CraftableSmelting[];
    smithing: CraftableSmithing[];
    cooking: CraftableCooking[];
    firemaking: CraftableFiremaking[];
  };
  gatherable: GatherableResource[];
  combat: {
    attackableTargets: AttackableTarget[];
    combatReadiness: { score: number; issues: string[] };
  };
  trainableSkills: TrainableSkill[];
  hasFood: boolean;
  inventorySlotsFree: number;
}

/**
 * Calculate what smelting is possible with current inventory
 */
function getSmeltableBars(
  itemCounts: Map<string, number>,
  smithingLevel: number,
): CraftableSmelting[] {
  const results: CraftableSmelting[] = [];

  for (const recipe of SMELTING_RECIPES) {
    if (recipe.levelRequired > smithingLevel) continue;

    const primaryCount = itemCounts.get(recipe.primaryOre) || 0;
    if (primaryCount < 1) continue;

    let canMake = primaryCount;

    // Check secondary ore (bronze needs tin + copper)
    if (recipe.secondaryOre) {
      const secondaryCount = itemCounts.get(recipe.secondaryOre) || 0;
      if (secondaryCount < 1) continue;
      canMake = Math.min(canMake, secondaryCount);
    }

    // Check coal requirement
    if (recipe.coalRequired > 0) {
      const coalCount = itemCounts.get("coal") || 0;
      if (coalCount < recipe.coalRequired) continue;
      canMake = Math.min(canMake, Math.floor(coalCount / recipe.coalRequired));
    }

    const ingredients = recipe.secondaryOre
      ? `${recipe.primaryOre} + ${recipe.secondaryOre}${recipe.coalRequired > 0 ? ` + ${recipe.coalRequired} coal` : ""}`
      : `${recipe.primaryOre}${recipe.coalRequired > 0 ? ` + ${recipe.coalRequired} coal` : ""}`;

    results.push({
      barId: recipe.barId,
      barName: recipe.barName,
      ingredients,
      canMake,
    });
  }

  return results;
}

/**
 * Calculate what smithing is possible with current inventory
 */
function getSmithableItems(
  itemCounts: Map<string, number>,
  smithingLevel: number,
): CraftableSmithing[] {
  const results: CraftableSmithing[] = [];

  for (const recipe of SMITHING_RECIPES) {
    if (recipe.levelRequired > smithingLevel) continue;

    const barCount = itemCounts.get(recipe.barType) || 0;
    if (barCount < recipe.barsRequired) continue;

    results.push({
      itemId: recipe.itemId,
      itemName: recipe.itemName,
      barsNeeded: recipe.barsRequired,
      barType: recipe.barType,
      canMake: Math.floor(barCount / recipe.barsRequired),
    });
  }

  return results;
}

/**
 * Calculate what cooking is possible with current inventory
 */
function getCookableFood(
  itemCounts: Map<string, number>,
  cookingLevel: number,
): CraftableCooking[] {
  const results: CraftableCooking[] = [];

  for (const recipe of COOKING_RECIPES) {
    if (recipe.levelRequired > cookingLevel) continue;

    const rawCount = itemCounts.get(recipe.rawItemId) || 0;
    if (rawCount < 1) continue;

    results.push({
      rawItem: recipe.rawName,
      cookedItem: recipe.cookedName,
      count: rawCount,
    });
  }

  return results;
}

/**
 * Calculate what firemaking is possible with current inventory
 */
function getBurnableLogs(
  itemCounts: Map<string, number>,
  firemakingLevel: number,
): CraftableFiremaking[] {
  const results: CraftableFiremaking[] = [];

  for (const recipe of FIREMAKING_RECIPES) {
    if (recipe.levelRequired > firemakingLevel) continue;

    const logCount = itemCounts.get(recipe.logId) || 0;
    if (logCount < 1) continue;

    results.push({
      logName: recipe.logName,
      count: logCount,
      xp: recipe.xp,
    });
  }

  return results;
}

/**
 * Analyze nearby entities for gathering opportunities
 */
function getGatherableResources(
  nearbyEntities: Entity[],
  skills: Skills | undefined,
): GatherableResource[] {
  const resourceGroups = new Map<
    string,
    { type: string; name: string; count: number }
  >();

  for (const entity of nearbyEntities) {
    const resourceType = getResourceType(entity);
    if (!resourceType) continue;

    const key = entity.name?.toLowerCase() || resourceType;
    const existing = resourceGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      resourceGroups.set(key, {
        type: resourceType,
        name: entity.name || resourceType,
        count: 1,
      });
    }
  }

  const results: GatherableResource[] = [];
  for (const [, group] of resourceGroups) {
    let levelRequired = 1;
    let canGather = true;
    let requiredSkill = "";

    if (group.type === "tree") {
      requiredSkill = "woodcutting";
      const wcLevel = getSkillLevel(skills, "woodcutting");
      const name = (group.name ?? "").toLowerCase();
      if (name.includes("oak")) {
        levelRequired = 15;
        canGather = wcLevel >= 15;
      } else if (name.includes("willow")) {
        levelRequired = 30;
        canGather = wcLevel >= 30;
      } else if (name.includes("maple")) {
        levelRequired = 45;
        canGather = wcLevel >= 45;
      } else if (name.includes("yew")) {
        levelRequired = 60;
        canGather = wcLevel >= 60;
      } else {
        levelRequired = 1;
        canGather = true;
      }
    } else if (group.type === "rock") {
      requiredSkill = "mining";
      const miningLevel = getSkillLevel(skills, "mining");
      const name = (group.name ?? "").toLowerCase();
      if (name.includes("iron")) {
        levelRequired = 15;
        canGather = miningLevel >= 15;
      } else if (name.includes("coal")) {
        levelRequired = 30;
        canGather = miningLevel >= 30;
      } else if (name.includes("mithril")) {
        levelRequired = 55;
        canGather = miningLevel >= 55;
      } else {
        levelRequired = 1;
        canGather = true;
      } // copper/tin
    } else if (group.type === "fishing") {
      requiredSkill = "fishing";
      const fishingLevel = getSkillLevel(skills, "fishing");
      // Default fishing level 1
      canGather = fishingLevel >= 1;
    }

    results.push({
      type: group.type,
      name: group.name,
      levelRequired,
      canGather,
      count: group.count,
    });
  }

  return results;
}

/**
 * Analyze nearby entities for combat opportunities
 */
function getAttackableTargets(nearbyEntities: Entity[]): AttackableTarget[] {
  const targetGroups = new Map<
    string,
    { name: string; entityId: string; count: number }
  >();

  for (const entity of nearbyEntities) {
    if (!isAttackable(entity)) continue;

    const name = entity.name?.toLowerCase() || "unknown";
    const existing = targetGroups.get(name);
    if (existing) {
      existing.count++;
    } else {
      targetGroups.set(name, {
        name: entity.name || "Unknown",
        entityId: entity.id,
        count: 1,
      });
    }
  }

  return Array.from(targetGroups.values());
}

/**
 * Determine what skills can be trained based on current state
 */
function getTrainableSkills(
  skills: Skills | undefined,
  gatherable: GatherableResource[],
  attackableTargets: AttackableTarget[],
  craftable: PossibilitiesData["craftable"],
): TrainableSkill[] {
  const results: TrainableSkill[] = [];

  // Woodcutting
  const canChopTrees = gatherable.some((r) => r.type === "tree" && r.canGather);
  results.push({
    skill: "Woodcutting",
    currentLevel: getSkillLevel(skills, "woodcutting"),
    canTrain: canChopTrees,
    howToTrain: canChopTrees ? "Chop nearby trees" : "Find trees to chop",
  });

  // Mining
  const canMineRocks = gatherable.some((r) => r.type === "rock" && r.canGather);
  results.push({
    skill: "Mining",
    currentLevel: getSkillLevel(skills, "mining"),
    canTrain: canMineRocks,
    howToTrain: canMineRocks ? "Mine nearby rocks" : "Find rocks to mine",
  });

  // Fishing
  const canFish = gatherable.some((r) => r.type === "fishing" && r.canGather);
  results.push({
    skill: "Fishing",
    currentLevel: getSkillLevel(skills, "fishing"),
    canTrain: canFish,
    howToTrain: canFish ? "Fish at nearby spot" : "Find a fishing spot",
  });

  // Smithing (smelting + smithing)
  const canSmelt = craftable.smelting.length > 0;
  const canSmith = craftable.smithing.length > 0;
  results.push({
    skill: "Smithing",
    currentLevel: getSkillLevel(skills, "smithing"),
    canTrain: canSmelt || canSmith,
    howToTrain: canSmelt
      ? "Smelt bars at a furnace"
      : canSmith
        ? "Smith items at an anvil"
        : "Get ores to smelt or bars to smith",
  });

  // Firemaking
  const canBurnLogs = craftable.firemaking.length > 0;
  results.push({
    skill: "Firemaking",
    currentLevel: getSkillLevel(skills, "firemaking"),
    canTrain: canBurnLogs,
    howToTrain: canBurnLogs ? "Burn logs with tinderbox" : "Get logs to burn",
  });

  // Cooking
  const canCook = craftable.cooking.length > 0;
  results.push({
    skill: "Cooking",
    currentLevel: getSkillLevel(skills, "cooking"),
    canTrain: canCook,
    howToTrain: canCook
      ? "Cook food on a fire or range"
      : "Get raw food to cook",
  });

  // Combat skills
  const canFight = attackableTargets.length > 0;
  results.push({
    skill: "Attack",
    currentLevel: getSkillLevel(skills, "attack"),
    canTrain: canFight,
    howToTrain: canFight
      ? "Attack nearby enemies (accurate style)"
      : "Find enemies to fight",
  });

  results.push({
    skill: "Strength",
    currentLevel: getSkillLevel(skills, "strength"),
    canTrain: canFight,
    howToTrain: canFight
      ? "Attack nearby enemies (aggressive style)"
      : "Find enemies to fight",
  });

  results.push({
    skill: "Defence",
    currentLevel: getSkillLevel(skills, "defence"),
    canTrain: canFight,
    howToTrain: canFight
      ? "Attack nearby enemies (defensive style)"
      : "Find enemies to fight",
  });

  return results;
}

// ============================================================================
// PROVIDER
// ============================================================================

export const possibilitiesProvider: Provider = {
  name: "possibilities",
  description:
    "What actions are currently possible based on inventory, skills, and nearby entities",
  dynamic: true,
  position: 7, // After availableActionsProvider

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    const player = service?.getPlayerEntity();

    if (!player) {
      return {
        text: "## Possibilities\nNo player data available.",
        values: {},
        data: {},
      };
    }

    const nearbyEntities = service?.getNearbyEntities() || [];
    const inventory = player.items || [];
    const skills = player.skills;
    const itemCounts = countInventoryItems(inventory);

    // Get skill levels
    const smithingLevel = getSkillLevel(skills, "smithing");
    const cookingLevel = getSkillLevel(skills, "cooking");
    const firemakingLevel = getSkillLevel(skills, "firemaking");

    // Calculate possibilities
    const craftable = {
      smelting: getSmeltableBars(itemCounts, smithingLevel),
      smithing: getSmithableItems(itemCounts, smithingLevel),
      cooking: getCookableFood(itemCounts, cookingLevel),
      firemaking: getBurnableLogs(itemCounts, firemakingLevel),
    };

    const gatherable = getGatherableResources(nearbyEntities, skills);
    const attackableTargets = getAttackableTargets(nearbyEntities);
    const combatReadiness = getCombatReadiness(service!);
    const trainableSkills = getTrainableSkills(
      skills,
      gatherable,
      attackableTargets,
      craftable,
    );
    const playerHasFood = hasFood(inventory);
    const MAX_SLOTS = 28;
    const inventorySlotsFree = MAX_SLOTS - inventory.length;

    const data: PossibilitiesData = {
      craftable,
      gatherable,
      combat: {
        attackableTargets,
        combatReadiness: {
          score: combatReadiness.score,
          issues: combatReadiness.factors,
        },
      },
      trainableSkills,
      hasFood: playerHasFood,
      inventorySlotsFree,
    };

    // Build markdown text for LLM
    const textParts: string[] = ["## What You Can Do Right Now\n"];

    // Crafting section
    if (
      craftable.smelting.length > 0 ||
      craftable.smithing.length > 0 ||
      craftable.cooking.length > 0 ||
      craftable.firemaking.length > 0
    ) {
      textParts.push("### Crafting");

      if (craftable.smelting.length > 0) {
        textParts.push("**Smelting** (at a furnace):");
        for (const item of craftable.smelting) {
          textParts.push(
            `- ${item.barName}: You have ${item.ingredients} (can make ${item.canMake})`,
          );
        }
      }

      if (craftable.smithing.length > 0) {
        textParts.push("**Smithing** (at an anvil):");
        for (const item of craftable.smithing) {
          textParts.push(
            `- ${item.itemName}: Need ${item.barsNeeded} ${item.barType} (can make ${item.canMake})`,
          );
        }
      }

      if (craftable.cooking.length > 0) {
        textParts.push("**Cooking** (on fire/range):");
        for (const item of craftable.cooking) {
          textParts.push(
            `- ${item.rawItem} -> ${item.cookedItem} (${item.count} available)`,
          );
        }
      }

      if (craftable.firemaking.length > 0) {
        textParts.push("**Firemaking**:");
        for (const item of craftable.firemaking) {
          textParts.push(
            `- ${item.logName}: ${item.count} logs (+${item.xp} XP each)`,
          );
        }
      }
      textParts.push("");
    }

    // Gathering section
    if (gatherable.length > 0) {
      textParts.push("### Gathering (Nearby)");
      for (const resource of gatherable) {
        const status = resource.canGather
          ? "CAN gather"
          : `CANNOT (need level ${resource.levelRequired})`;
        textParts.push(
          `- ${resource.name} x${resource.count} (${resource.type}) - ${status}`,
        );
      }
      textParts.push("");
    }

    // Combat section
    if (attackableTargets.length > 0) {
      textParts.push("### Combat");
      textParts.push(`Combat Readiness: ${combatReadiness.score}%`);
      if (combatReadiness.factors.length > 0) {
        textParts.push(`Issues: ${combatReadiness.factors.join(", ")}`);
      }
      textParts.push("Attackable targets:");
      for (const target of attackableTargets) {
        textParts.push(`- ${target.name} x${target.count}`);
      }
      textParts.push("");
    }

    // Trainable skills section
    const trainable = trainableSkills.filter((s) => s.canTrain);
    if (trainable.length > 0) {
      textParts.push("### Skills You Can Train Now");
      for (const skill of trainable) {
        textParts.push(
          `- **${skill.skill}** (Level ${skill.currentLevel}): ${skill.howToTrain}`,
        );
      }
      textParts.push("");
    }

    // Status summary
    textParts.push("### Status");
    textParts.push(
      `- Food: ${playerHasFood ? "Yes" : "No (get food before combat!)"}`,
    );
    textParts.push(`- Inventory: ${inventorySlotsFree} slots free`);

    return {
      text: textParts.join("\n"),
      values: {
        canSmelt: craftable.smelting.length > 0,
        canSmith: craftable.smithing.length > 0,
        canCook: craftable.cooking.length > 0,
        canBurnLogs: craftable.firemaking.length > 0,
        hasGatherableResources: gatherable.length > 0,
        hasAttackableTargets: attackableTargets.length > 0,
        combatReadinessScore: combatReadiness.score,
        hasFood: playerHasFood,
        inventorySlotsFree,
        // Include full data in values so it's accessible in composed state
        possibilitiesData: data,
      },
      data: {
        canSmelt: craftable.smelting.length > 0,
        canSmith: craftable.smithing.length > 0,
        canCook: craftable.cooking.length > 0,
        canBurnLogs: craftable.firemaking.length > 0,
        hasGatherableResources: gatherable.length > 0,
        hasAttackableTargets: attackableTargets.length > 0,
        combatReadinessScore: combatReadiness.score,
        hasFood: playerHasFood,
        inventorySlotsFree,
      },
    };
  },
};
