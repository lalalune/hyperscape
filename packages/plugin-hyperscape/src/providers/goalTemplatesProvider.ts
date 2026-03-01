/**
 * goalTemplatesProvider - Structured goal templates for OSRS beginner flows
 *
 * Provides the LLM with recommended goal templates based on:
 * - Current player state (skills, inventory, equipment)
 * - Nearby resources and entities
 * - Prerequisites and progression paths
 *
 * Goal templates represent common OSRS activities:
 * - Woodcutting basics
 * - Bronze gear crafting chain (mine -> smelt -> smith)
 * - Combat training
 * - Firemaking and cooking
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { InventoryItem, Skills, Entity, Equipment } from "../types.js";
import { getCombatReadiness } from "./goalProvider.js";
import {
  hasWeapon as detectHasWeapon,
  hasAxe as detectHasAxe,
  hasPickaxe as detectHasPickaxe,
  hasTinderbox as detectHasTinderbox,
  hasFishingEquipment as detectHasFishingEquipment,
  hasLogs as detectHasLogs,
  hasOre as detectHasOre,
  hasBars as detectHasBars,
  hasRawFood as detectHasRawFood,
  hasFood as detectHasFood,
} from "../utils/item-detection.js";

// ============================================================================
// GOAL TEMPLATE TYPES
// ============================================================================

export interface GoalTemplate {
  id: string;
  name: string;
  type:
    | "woodcutting"
    | "mining"
    | "smithing"
    | "combat"
    | "firemaking"
    | "cooking"
    | "fishing"
    | "exploration"
    | "questing"
    | "banking";
  description: string;
  prerequisites: string[]; // Human-readable prerequisite descriptions
  hardRequirements: string[]; // Machine-checkable requirements that MUST be met (e.g., "has_axe", "mining >= 15")
  steps: string[];
  successCondition: string;
  recommendedWhen: string[]; // Conditions that make this goal recommended (soft factors)
  priority: number; // Base priority (0-100)
  estimatedTime: string; // e.g., "5-10 minutes"
}

export interface ScoredGoalTemplate extends GoalTemplate {
  score: number; // Calculated score based on current state
  applicable: boolean; // Whether prerequisites are met
  reason: string; // Why this template is recommended/not recommended
}

// ============================================================================
// GOAL TEMPLATES - OSRS Beginner Flows
// ============================================================================

const GOAL_TEMPLATES: GoalTemplate[] = [
  // === ACQUISITION GOALS (for getting starter equipment) ===
  {
    id: "acquire_starter_tools",
    name: "Get Starter Tools via Quests",
    type: "questing",
    description:
      "Accept quests from NPCs to get basic tools (axe, pickaxe, tinderbox, fishing net)",
    prerequisites: [],
    hardRequirements: [], // No requirements - this is the bootstrap goal
    steps: [
      "Talk to Forester Wilma and ACCEPT_QUEST 'lumberjacks_first_lesson' for bronze hatchet + tinderbox",
      "Talk to Torvin and ACCEPT_QUEST 'torvins_tools' for bronze pickaxe + hammer",
      "Talk to Fisherman Pete and ACCEPT_QUEST 'fresh_catch' for small fishing net",
      "Quest items are granted immediately on accept!",
    ],
    successCondition: "Have axe AND pickaxe in inventory",
    recommendedWhen: ["no_axe", "no_pickaxe", "no_tools"],
    priority: 95, // Highest priority - can't do anything without tools
    estimatedTime: "2-5 minutes",
  },

  {
    id: "acquire_fishing_equipment",
    name: "Get Fishing Equipment",
    type: "exploration",
    description: "Acquire fishing rod or net to start fishing",
    prerequisites: [],
    hardRequirements: [], // No requirements - bootstrap goal
    steps: [
      "Find starter chest or shop that sells fishing equipment",
      "Small fishing net: catches shrimp (level 1)",
      "Fishing rod + bait: catches sardine, herring (level 5+)",
      "Fly fishing rod + feathers: catches trout, salmon (level 20+)",
    ],
    successCondition: "Have fishing net OR fishing rod in inventory",
    recommendedWhen: ["no_fishing_equipment", "needs_food"],
    priority: 70,
    estimatedTime: "2-5 minutes",
  },

  // === GATHERING SKILLS ===
  {
    id: "woodcutting_basics",
    name: "Learn Woodcutting",
    type: "woodcutting",
    description: "Chop trees to gather logs and train woodcutting skill",
    prerequisites: ["Have an axe equipped or in inventory"],
    hardRequirements: ["has_axe"], // MUST have axe
    steps: [
      "Ensure you have an axe (bronze axe works for beginners)",
      "Travel to an area with trees (forest location)",
      "Click on a tree to start chopping",
      "Continue until inventory is full or target level reached",
    ],
    successCondition: "Woodcutting level 10+ OR inventory full of logs",
    recommendedWhen: ["trees_nearby", "woodcutting < 20", "inventory_not_full"],
    priority: 70,
    estimatedTime: "5-10 minutes",
  },

  {
    id: "mining_basics",
    name: "Learn Mining",
    type: "mining",
    description: "Mine rocks to gather ore and train mining skill",
    prerequisites: ["Have a pickaxe equipped or in inventory"],
    hardRequirements: ["has_pickaxe"], // MUST have pickaxe
    steps: [
      "Ensure you have a pickaxe (bronze pickaxe works for beginners)",
      "Travel to a mining area with rocks",
      "Click on rocks to start mining",
      "Collect copper and tin ore for bronze bars",
    ],
    successCondition: "Mining level 10+ OR inventory full of ore",
    recommendedWhen: ["rocks_nearby", "mining < 20", "inventory_not_full"],
    priority: 65,
    estimatedTime: "5-10 minutes",
  },

  {
    id: "fishing_basics",
    name: "Learn Fishing",
    type: "fishing",
    description: "Catch fish to gather food and train fishing skill",
    prerequisites: ["Have fishing net or rod in inventory"],
    hardRequirements: ["has_fishing_equipment"], // MUST have fishing equipment
    steps: [
      "Ensure you have a fishing net (for shrimp) or rod (for other fish)",
      "Travel to a fishing spot (look for water with fish)",
      "Click on the fishing spot to start fishing",
      "Catch fish until inventory is full",
      "Cook the fish for food supplies",
    ],
    successCondition: "Fishing level 10+ OR have raw fish to cook",
    recommendedWhen: ["fishing_spot_nearby", "fishing < 20", "needs_food"],
    priority: 60,
    estimatedTime: "5-10 minutes",
  },

  // === CRAFTING CHAINS ===
  {
    id: "bronze_gear_chain",
    name: "Craft Bronze Equipment",
    type: "smithing",
    description: "Complete crafting chain: mine ore, smelt bars, smith gear",
    prerequisites: ["Mining level 1+", "Smithing level 1+", "Have pickaxe"],
    hardRequirements: ["has_pickaxe"], // Need pickaxe to mine ore
    steps: [
      "Mine copper ore (need pickaxe)",
      "Mine tin ore (same location)",
      "Travel to a furnace",
      "Smelt copper + tin into bronze bars",
      "Travel to an anvil",
      "Smith bronze equipment (dagger, sword, axe, etc.)",
    ],
    successCondition: "Have bronze weapon or tool crafted",
    recommendedWhen: ["no_weapon", "near_furnace_or_mine", "smithing < 15"],
    priority: 75,
    estimatedTime: "10-15 minutes",
  },

  {
    id: "smelt_bars",
    name: "Smelt Metal Bars",
    type: "smithing",
    description: "Smelt ore into metal bars at a furnace",
    prerequisites: ["Have ore in inventory"],
    hardRequirements: ["has_ore"], // MUST have ore to smelt
    steps: [
      "Travel to a furnace location",
      "Use ore on the furnace",
      "Smelt all available ore into bars",
    ],
    successCondition: "All ore converted to bars",
    recommendedWhen: ["no_bars", "near_furnace"],
    priority: 65,
    estimatedTime: "2-5 minutes",
  },

  {
    id: "smith_items",
    name: "Smith Equipment",
    type: "smithing",
    description: "Smith metal bars into weapons and tools at an anvil",
    prerequisites: ["Have metal bars in inventory"],
    hardRequirements: ["has_bars"], // MUST have bars to smith
    steps: [
      "Travel to an anvil location",
      "Use bars on the anvil",
      "Select item to smith (dagger, sword, axe, etc.)",
      "Repeat until bars are used",
    ],
    successCondition: "Bars converted to equipment",
    recommendedWhen: ["near_anvil", "needs_weapon_or_tool"],
    priority: 70,
    estimatedTime: "2-5 minutes",
  },

  // === PROCESSING SKILLS ===
  {
    id: "firemaking_basics",
    name: "Train Firemaking",
    type: "firemaking",
    description: "Burn logs to train firemaking skill and create cooking fires",
    prerequisites: ["Have logs in inventory", "Have tinderbox"],
    hardRequirements: ["has_logs", "has_tinderbox"], // MUST have both
    steps: [
      "Ensure you have logs in inventory",
      "Use tinderbox on logs to light a fire",
      "Move to clear space and repeat",
      "Fires can be used for cooking",
    ],
    successCondition: "Firemaking level 15+ OR all logs burned",
    recommendedWhen: ["firemaking < woodcutting"],
    priority: 50,
    estimatedTime: "3-5 minutes",
  },

  {
    id: "cooking_basics",
    name: "Cook Food",
    type: "cooking",
    description: "Cook raw fish or meat to create food supplies",
    prerequisites: [
      "Have raw food in inventory",
      "Near a fire or cooking range",
    ],
    hardRequirements: ["has_raw_food"], // MUST have raw food
    steps: [
      "Gather raw fish or meat",
      "Find a fire or cooking range",
      "Use raw food on the fire/range",
      "Cooked food heals health in combat",
    ],
    successCondition: "Have 10+ cooked food items",
    recommendedWhen: ["near_fire", "needs_food", "cooking < 30"],
    priority: 60,
    estimatedTime: "3-5 minutes",
  },

  // === COMBAT ===
  {
    id: "combat_training_goblins",
    name: "Train Combat on Goblins",
    type: "combat",
    description:
      "Fight goblins to improve attack, strength, and defence skills",
    prerequisites: [
      "Have weapon equipped",
      "Have food in inventory",
      "Combat readiness 50%+",
    ],
    hardRequirements: ["has_weapon", "has_food", "combat_ready"], // ALL must be met for combat
    steps: [
      "Ensure weapon is equipped",
      "Ensure food is in inventory for healing",
      "Travel to goblin spawn area near spawn point",
      "Attack goblins one at a time",
      "Eat food when health drops below 50%",
      "Flee if health drops below 25%",
    ],
    successCondition: "Combat skill level increased by 2+",
    recommendedWhen: ["goblins_nearby"],
    priority: 80,
    estimatedTime: "10-20 minutes",
  },

  {
    id: "get_combat_ready",
    name: "Prepare for Combat",
    type: "exploration",
    description: "Gather necessary supplies before engaging in combat",
    prerequisites: [],
    hardRequirements: [], // No hard requirements - this is a preparation goal
    steps: [
      "If no weapon: mine ore and smith a bronze weapon",
      "If no food: fish and cook some food",
      "Equip your best weapon",
      "Ensure at least 5 pieces of food in inventory",
    ],
    successCondition: "Have weapon equipped AND 5+ food items",
    recommendedWhen: ["no_weapon", "no_food"],
    priority: 85,
    estimatedTime: "10-15 minutes",
  },

  // === EXPLORATION ===
  {
    id: "explore_area",
    name: "Explore New Areas",
    type: "exploration",
    description: "Wander and discover new resources, NPCs, and locations",
    prerequisites: [],
    hardRequirements: [],
    steps: [
      "Move in a direction away from current position",
      "Look for new resources (trees, rocks, fishing spots)",
      "Note locations of useful NPCs and stations",
      "Stay within safe distance of spawn (200 tiles)",
    ],
    successCondition: "Discover new resource location",
    recommendedWhen: ["no_nearby_resources", "healthy", "inventory_not_full"],
    priority: 30,
    estimatedTime: "5-10 minutes",
  },

  // === MULTI-STEP CHAINS ===
  {
    id: "gear_upgrade_chain",
    name: "Upgrade My Gear",
    type: "smithing",
    description:
      "Complete gear upgrade chain: mine ore, travel to furnace, smelt bars, travel to anvil, smith equipment",
    prerequisites: ["Have a pickaxe"],
    hardRequirements: ["has_pickaxe"],
    steps: [
      "Mine copper and tin ore until inventory has enough for several bars",
      "Travel to a furnace location",
      "Smelt all ore into bronze bars (SMELT_ORE)",
      "Travel to an anvil location",
      "Smith the bars into weapons or armor (SMITH_ITEM)",
      "Equip the new gear (EQUIP_ITEM)",
    ],
    successCondition: "Have new smithed equipment equipped",
    recommendedWhen: ["no_weapon", "has_pickaxe", "rocks_nearby"],
    priority: 78,
    estimatedTime: "15-20 minutes",
  },

  {
    id: "food_supply_chain",
    name: "Stock Up on Food",
    type: "fishing",
    description:
      "Gather food supplies: catch fish, cook them, bank extras for later",
    prerequisites: ["Have fishing equipment"],
    hardRequirements: ["has_fishing_equipment"],
    steps: [
      "Travel to a fishing spot",
      "Catch fish until inventory is nearly full (CATCH_FISH)",
      "Light a fire or find a cooking range",
      "Cook all raw fish (COOK_FOOD)",
      "Eat some for health, bank the rest if near a bank",
    ],
    successCondition: "Have 10+ cooked food items",
    recommendedWhen: [
      "no_food",
      "has_fishing_equipment",
      "fishing_spot_nearby",
    ],
    priority: 72,
    estimatedTime: "10-15 minutes",
  },

  // === QUEST GOALS ===
  {
    id: "find_quest",
    name: "Find a Quest",
    type: "exploration",
    description: "Travel to town and talk to NPCs to find and accept a quest",
    prerequisites: [],
    hardRequirements: [],
    steps: [
      "Travel towards spawn/town area where NPCs are",
      "Look for NPCs (quest givers, trainers, etc.)",
      "Talk to an NPC using TALK_TO_NPC",
      "Accept any available quest using ACCEPT_QUEST",
    ],
    successCondition: "Have an active quest",
    recommendedWhen: ["healthy", "no_nearby_resources"],
    priority: 55,
    estimatedTime: "5-10 minutes",
  },

  // === SOCIAL GOALS ===
  {
    id: "social_round",
    name: "Be Social",
    type: "exploration",
    description:
      "Take a break from grinding to socialize, share opinions, and greet players",
    prerequisites: [],
    hardRequirements: [],
    steps: [
      "Look around for nearby players",
      "Greet anyone you see (GREET_PLAYER)",
      "Share your thoughts about what you've been doing (SHARE_OPINION)",
      "Offer help if someone looks like they need it (OFFER_HELP)",
      "Check if any shops or NPCs are nearby for a visit",
    ],
    successCondition: "Had at least one social interaction",
    recommendedWhen: ["healthy"],
    priority: 25,
    estimatedTime: "3-5 minutes",
  },
];

// ============================================================================
// PREREQUISITE CHECKING
// ============================================================================

interface PlayerContext {
  skills: Skills | undefined;
  items: InventoryItem[];
  equipment: Equipment | undefined;
  nearbyEntities: Entity[];
  hasFood: boolean;
  hasWeapon: boolean;
  hasAxe: boolean;
  hasPickaxe: boolean;
  hasTinderbox: boolean;
  hasFishingEquipment: boolean; // Fishing net, fishing rod, etc.
  hasLogs: boolean;
  hasOre: boolean;
  hasBars: boolean;
  hasRawFood: boolean;
  inventoryFull: boolean;
  combatReady: boolean;
  healthPercent: number;
  /** Recent goal counts by type/skill for diversity scoring */
  recentGoalCounts: Record<string, number>;
}

/**
 * Build player context for prerequisite checking
 */
function buildPlayerContext(
  player: {
    skills: Skills;
    items: InventoryItem[];
    equipment: Equipment;
    health: { current: number; max: number };
  } | null,
  nearbyEntities: Entity[],
  combatReadiness: { score: number },
  recentGoalCounts: Record<string, number> = {},
): PlayerContext {
  if (!player) {
    return {
      skills: undefined,
      items: [],
      equipment: undefined,
      nearbyEntities: [],
      hasFood: false,
      hasWeapon: false,
      hasAxe: false,
      hasPickaxe: false,
      hasTinderbox: false,
      hasFishingEquipment: false,
      hasLogs: false,
      hasOre: false,
      hasBars: false,
      hasRawFood: false,
      inventoryFull: false,
      combatReady: false,
      healthPercent: 100,
      recentGoalCounts: {},
    };
  }

  const items = player.items || [];

  // Use centralized item detection utility for consistent detection
  const hasWeapon = detectHasWeapon(player);
  const hasAxe = detectHasAxe(player);
  const hasPickaxe = detectHasPickaxe(player);
  const hasTinderbox = detectHasTinderbox(player);
  const hasFishingEquipment = detectHasFishingEquipment(player);
  const hasLogs = detectHasLogs(player);
  const hasOre = detectHasOre(player);
  const hasBars = detectHasBars(player);
  const hasRawFood = detectHasRawFood(player);
  const hasFood = detectHasFood(player);

  return {
    skills: player.skills,
    items,
    equipment: player.equipment,
    nearbyEntities,
    hasFood,
    hasWeapon,
    hasAxe,
    hasPickaxe,
    hasTinderbox,
    hasFishingEquipment,
    hasLogs,
    hasOre,
    hasBars,
    hasRawFood,
    inventoryFull: items.length >= 28,
    combatReady: combatReadiness.score >= 50,
    healthPercent: player.health
      ? (player.health.current / player.health.max) * 100
      : 100,
    recentGoalCounts,
  };
}

/**
 * Check if nearby entities contain specific types
 */
function hasNearbyType(entities: Entity[], type: string): boolean {
  const lowerType = type.toLowerCase();
  return entities.some((e) => {
    const name = e.name?.toLowerCase() || "";
    return name.includes(lowerType);
  });
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
 * Check a single condition against player context
 * Returns true if condition is met, false otherwise
 */
function checkCondition(condition: string, ctx: PlayerContext): boolean {
  const lc = condition.toLowerCase();

  // Equipment possession checks
  if (lc === "has_axe") return ctx.hasAxe;
  if (lc === "has_pickaxe") return ctx.hasPickaxe;
  if (lc === "has_tinderbox") return ctx.hasTinderbox;
  if (lc === "has_fishing_equipment") return ctx.hasFishingEquipment;
  if (lc === "has_weapon") return ctx.hasWeapon;

  // Equipment absence checks (for acquisition goals)
  if (lc === "no_axe") return !ctx.hasAxe;
  if (lc === "no_pickaxe") return !ctx.hasPickaxe;
  if (lc === "no_tools") return !ctx.hasAxe && !ctx.hasPickaxe;
  if (lc === "no_fishing_equipment") return !ctx.hasFishingEquipment;
  if (lc === "no_weapon") return !ctx.hasWeapon;

  // Inventory item checks
  if (lc === "has_logs") return ctx.hasLogs;
  if (lc === "has_ore") return ctx.hasOre;
  if (lc === "has_bars") return ctx.hasBars;
  if (lc === "has_raw_food") return ctx.hasRawFood;
  if (lc === "has_food") return ctx.hasFood;
  if (lc === "no_food") return !ctx.hasFood;
  if (lc === "needs_food") return !ctx.hasFood;
  if (lc === "no_bars") return !ctx.hasBars;
  if (lc === "inventory_not_full") return !ctx.inventoryFull;

  // Nearby entity checks
  if (lc === "trees_nearby") return hasNearbyType(ctx.nearbyEntities, "tree");
  if (lc === "rocks_nearby") return hasNearbyType(ctx.nearbyEntities, "rock");
  if (lc === "goblins_nearby")
    return hasNearbyType(ctx.nearbyEntities, "goblin");
  if (lc === "fishing_spot_nearby")
    return hasNearbyType(ctx.nearbyEntities, "fishing");
  if (lc === "near_fire") return hasNearbyType(ctx.nearbyEntities, "fire");
  if (lc === "near_furnace")
    return hasNearbyType(ctx.nearbyEntities, "furnace");
  if (lc === "near_anvil") return hasNearbyType(ctx.nearbyEntities, "anvil");
  if (lc === "no_nearby_resources") {
    return (
      !hasNearbyType(ctx.nearbyEntities, "tree") &&
      !hasNearbyType(ctx.nearbyEntities, "rock") &&
      !hasNearbyType(ctx.nearbyEntities, "fishing")
    );
  }

  // Combat/health checks
  if (lc === "combat_ready") return ctx.combatReady;
  if (lc === "healthy") return ctx.healthPercent > 50;

  // Skill level checks (e.g., "woodcutting < 20", "mining >= 15")
  const skillLtMatch = lc.match(/^(\w+)\s*<\s*(\d+)$/);
  if (skillLtMatch) {
    const [, skillName, levelStr] = skillLtMatch;
    const level = getSkillLevel(ctx.skills, skillName);
    return level < parseInt(levelStr, 10);
  }

  const skillGteMatch = lc.match(/^(\w+)\s*>=\s*(\d+)$/);
  if (skillGteMatch) {
    const [, skillName, levelStr] = skillGteMatch;
    const level = getSkillLevel(ctx.skills, skillName);
    return level >= parseInt(levelStr, 10);
  }

  // Unknown condition - default to false (be conservative)
  return false;
}

/**
 * Check if ALL hard requirements are met for a template
 * Hard requirements are things the player MUST have to attempt the goal
 */
function checkHardRequirements(
  template: GoalTemplate,
  ctx: PlayerContext,
): { allMet: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const requirement of template.hardRequirements) {
    if (!checkCondition(requirement, ctx)) {
      // Generate human-readable missing requirement message
      const lc = requirement.toLowerCase();
      if (lc === "has_axe") missing.push("Need an axe");
      else if (lc === "has_pickaxe") missing.push("Need a pickaxe");
      else if (lc === "has_tinderbox") missing.push("Need a tinderbox");
      else if (lc === "has_fishing_equipment")
        missing.push("Need fishing equipment (net or rod)");
      else if (lc === "has_weapon") missing.push("Need a weapon equipped");
      else if (lc === "has_food") missing.push("Need food in inventory");
      else if (lc === "has_logs") missing.push("Need logs in inventory");
      else if (lc === "has_ore") missing.push("Need ore in inventory");
      else if (lc === "has_bars") missing.push("Need metal bars in inventory");
      else if (lc === "has_raw_food")
        missing.push("Need raw food in inventory");
      else if (lc === "combat_ready")
        missing.push("Not combat ready (need weapon + food)");
      else missing.push(`Missing: ${requirement}`);
    }
  }

  return { allMet: missing.length === 0, missing };
}

/**
 * Check if a template's recommendedWhen conditions are met (soft factors)
 */
function checkRecommendedConditions(
  template: GoalTemplate,
  ctx: PlayerContext,
): { met: number; total: number; reasons: string[] } {
  const reasons: string[] = [];
  let met = 0;
  const total = template.recommendedWhen.length;

  for (const condition of template.recommendedWhen) {
    if (checkCondition(condition, ctx)) {
      met++;
      // Generate reason for notable conditions
      const lc = condition.toLowerCase();
      if (lc === "no_weapon") reasons.push("No weapon equipped");
      else if (lc === "no_food") reasons.push("No food available");
      else if (lc === "needs_food") reasons.push("Need food supplies");
      else if (lc === "no_axe") reasons.push("No axe - need to acquire tools");
      else if (lc === "no_pickaxe")
        reasons.push("No pickaxe - need to acquire tools");
      else if (lc === "no_tools") reasons.push("No gathering tools");
      else if (lc === "no_fishing_equipment")
        reasons.push("No fishing equipment");
      else if (lc === "trees_nearby") reasons.push("Trees nearby");
      else if (lc === "rocks_nearby") reasons.push("Rocks nearby");
      else if (lc === "goblins_nearby") reasons.push("Goblins nearby");
      else if (lc === "combat_ready") reasons.push("Combat ready");
      else if (lc === "no_nearby_resources")
        reasons.push("No resources nearby");
      else if (lc.match(/^(\w+)\s*<\s*(\d+)$/)) {
        const skillMatch = lc.match(/^(\w+)\s*<\s*(\d+)$/);
        if (skillMatch) {
          const level = getSkillLevel(ctx.skills, skillMatch[1]);
          reasons.push(`${skillMatch[1]} level ${level} (room to grow)`);
        }
      }
    }
  }

  return { met, total, reasons };
}

/**
 * Calculate score for a goal template based on current state
 * Includes diversity penalty to encourage variety in goal selection
 */
function scoreTemplate(
  template: GoalTemplate,
  ctx: PlayerContext,
): ScoredGoalTemplate {
  // First check hard requirements - these MUST be met
  const hardReqs = checkHardRequirements(template, ctx);

  // Then check soft recommendation conditions
  const conditions = checkRecommendedConditions(template, ctx);
  const conditionScore =
    conditions.total > 0 ? (conditions.met / conditions.total) * 100 : 50;

  // Combine base priority with condition matching
  let score = Math.round(template.priority * 0.4 + conditionScore * 0.6);

  // If hard requirements not met, this goal is NOT applicable
  // But still give it a score (so it shows up as "blocked" option)
  const applicable = hardReqs.allMet;

  // Penalize score heavily if hard requirements not met
  if (!applicable) {
    score = Math.max(0, score - 50);
  }

  // === DIVERSITY PENALTY ===
  // Penalize goals that match recently completed goal types/skills
  // Aggressive penalty to prevent repetitive grinding
  const goalType = template.type;
  const recentCount = ctx.recentGoalCounts[goalType] || 0;

  if (recentCount > 0) {
    // -25 points per recent completion (was 15)
    // Max penalty of -60 (harder to repeat same activity)
    const diversityPenalty = Math.min(recentCount * 25, 60);
    score = Math.max(0, score - diversityPenalty);
  }

  // Bonus for goals that haven't been tried recently
  const totalRecentGoals = Object.values(ctx.recentGoalCounts).reduce(
    (sum, c) => sum + c,
    0,
  );
  if (totalRecentGoals > 0 && recentCount === 0) {
    // +15 bonus to unexplored goal types (was 10)
    score = Math.min(100, score + 15);
  }

  // Build reason string
  let reason = "";
  if (!applicable) {
    // Show what's missing
    reason = `BLOCKED: ${hardReqs.missing.slice(0, 2).join(", ")}`;
  } else if (recentCount > 0) {
    // Note the diversity penalty
    reason =
      conditions.reasons.length > 0
        ? `${conditions.reasons.slice(0, 2).join(", ")} (recently did ${recentCount}x)`
        : `Recently completed ${recentCount}x - trying other activities recommended`;
  } else if (conditions.reasons.length > 0) {
    reason = conditions.reasons.slice(0, 3).join(", ");
  } else {
    reason = "General recommendation based on progression";
  }

  return {
    ...template,
    score,
    applicable,
    reason,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export const goalTemplatesProvider: Provider = {
  name: "goalTemplates",
  description: "Structured goal templates for OSRS beginner activities",
  dynamic: true,
  position: 8, // After possibilitiesProvider

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const player = service?.getPlayerEntity();
    const nearbyEntities = service?.getNearbyEntities() || [];
    const combatReadiness = service
      ? getCombatReadiness(service)
      : { score: 0, factors: [], ready: false };

    // Get recent goal counts for diversity scoring
    const behaviorManager = service?.getBehaviorManager();
    const recentGoalCounts = behaviorManager?.getRecentGoalCounts() || {};

    // Build context
    const ctx = buildPlayerContext(
      player as {
        skills: Skills;
        items: InventoryItem[];
        equipment: Equipment;
        health: { current: number; max: number };
      } | null,
      nearbyEntities,
      combatReadiness,
      recentGoalCounts,
    );

    // Score all templates
    const scoredTemplates = GOAL_TEMPLATES.map((template) =>
      scoreTemplate(template, ctx),
    ).sort((a, b) => b.score - a.score);

    // Filter to applicable templates
    const applicableTemplates = scoredTemplates.filter((t) => t.applicable);
    const topTemplates = applicableTemplates.slice(0, 5);

    // Build markdown text for LLM
    const textParts: string[] = ["## Recommended Goals\n"];

    if (topTemplates.length === 0) {
      textParts.push(
        "No strongly recommended goals at this time. Consider exploring or gathering resources.",
      );
    } else {
      textParts.push(
        "Based on your current situation, here are recommended goals:\n",
      );

      for (let i = 0; i < topTemplates.length; i++) {
        const template = topTemplates[i];
        textParts.push(
          `### ${i + 1}. ${template.name} (Score: ${template.score})`,
        );
        textParts.push(`**Type**: ${template.type}`);
        textParts.push(`**Description**: ${template.description}`);
        textParts.push(`**Why**: ${template.reason}`);
        textParts.push(`**Steps**:`);
        for (const step of template.steps) {
          textParts.push(`  - ${step}`);
        }
        textParts.push(`**Success**: ${template.successCondition}`);
        textParts.push("");
      }
    }

    // Add quick reference for goal types
    textParts.push("### Goal Type Reference");
    textParts.push("- **woodcutting**: Chop trees for logs");
    textParts.push("- **mining**: Mine rocks for ore");
    textParts.push("- **smithing**: Smelt bars and smith equipment");
    textParts.push("- **combat**: Fight monsters for XP");
    textParts.push("- **firemaking**: Burn logs for XP");
    textParts.push("- **cooking**: Cook food for healing items");
    textParts.push("- **fishing**: Catch fish for food");
    textParts.push("- **exploration**: Discover new areas");

    return {
      text: textParts.join("\n"),
      values: {
        topGoalId: topTemplates[0]?.id || null,
        topGoalType: topTemplates[0]?.type || null,
        topGoalScore: topTemplates[0]?.score || 0,
        applicableGoalCount: applicableTemplates.length,
        // Include templates in values so they're accessible in composed state
        goalTemplatesData: {
          templates: scoredTemplates,
          applicableTemplates,
          topTemplates,
        },
      },
      data: {
        templates: scoredTemplates,
        applicableTemplates,
        topTemplates,
      },
    };
  },
};
