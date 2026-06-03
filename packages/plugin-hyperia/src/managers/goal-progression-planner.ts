/**
 * Goal Progression Planner — personality-driven desire-scored goal selection
 *
 * Pure function: planNextGoal(context) → GoalPlan | null
 *
 * Two-stage architecture:
 *   Stage A — Hard constraints (strict priority, first-match-wins):
 *     Tool quests, quest turn-ins, bank withdrawals, inventory banking.
 *     These are prerequisites and always fire first.
 *
 *   Stage B — Soft desires (scored competition):
 *     Each potential goal type becomes a "desire" with a computed score
 *     based on baseWeight × personalityMul × (1 - satiation) × opportunityBonus.
 *     Highest score wins. Personality traits, recent activity history,
 *     and contextual opportunity all influence the outcome.
 *
 * Re-evaluated every time a goal completes, so prerequisite chains resolve
 * naturally: "accept quest" → tools granted → "gather resources" now valid.
 */

import { logger } from "@elizaos/core";
import type { CurrentGoal } from "./autonomous-behavior-manager.js";
import type { PlayerEntity, QuestData } from "../types.js";
import type { PersonalityTraits } from "../providers/personalityProvider.js";
import {
  hasAxe,
  hasPickaxe,
  hasFishingEquipment,
  hasTinderbox,
  hasCombatCapableItem,
  hasWeapon,
  hasOre,
  hasBars,
  hasRawFood,
  countFood,
} from "../utils/item-detection.js";
import {
  getResourcesAtLevel,
  getMonsterForCombatLevel,
  getBestEquippableTier,
} from "../utils/world-data.js";
import { SCRIPTED_AUTONOMY_CONFIG } from "../config/constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Everything the planner needs to decide — built by the caller */
export interface PlannerContext {
  player: PlayerEntity;
  quests: QuestData[];
  recentGoalCounts: Record<string, number>;
  /** Cached bank item names (lowercase) for tool-in-bank detection */
  bankItemNames?: string[];
  /** Agent personality traits for desire scoring */
  personality: PersonalityTraits;
  /** Full goal history with timestamps for satiation calculation */
  goalHistory: Array<{
    type: string;
    skill?: string;
    completedAt: number;
  }>;
}

/** What the planner outputs */
export interface GoalPlan {
  goal: CurrentGoal;
  /** Human-readable reason (for logs) */
  reason: string;
}

/** A scored desire candidate competing for selection in Stage B */
interface DesireCandidate {
  id: string;
  baseWeight: number;
  personalityMul: number;
  satiation: number;
  opportunityBonus: number;
  duelPrepBonus: number;
  score: number;
  buildGoal: () => GoalPlan;
}

/** Default personality when none is provided */
const DEFAULT_PERSONALITY: PersonalityTraits = {
  sociability: 0.5,
  helpfulness: 0.5,
  adventurousness: 0.5,
  chattiness: 0.5,
  aggression: 0.3,
  patience: 0.5,
  preferredSkills: [],
  catchphrases: [],
  quirks: [],
};

// ---------------------------------------------------------------------------
// Quest → tool mapping
// ---------------------------------------------------------------------------

interface ToolQuest {
  questId: string;
  npc: string;
  /** Checker returns true when the player already has the tool */
  hasIt: (player: PlayerEntity) => boolean;
}

/**
 * Bank item keywords to detect tools that were banked.
 * Maps quest ID → item name fragments to search for in bank.
 */
const TOOL_BANK_KEYWORDS: Record<string, string[]> = {
  goblin_slayer: ["shortsword", "longsword", "scimitar", "dagger"],
  lumberjacks_first_lesson: ["hatchet"],
  torvins_tools: ["pickaxe"],
  fresh_catch: ["fishing net", "fishing_net", "net"],
};

/**
 * Ordered list of tool-granting quests. Evaluated top-to-bottom;
 * first quest whose tool the player is missing wins.
 *
 * Non-combat resource quests come FIRST so agents learn gathering/crafting
 * skills before being sent to fight goblins. This mirrors natural player
 * progression: get an axe, pickaxe, fishing net, THEN a weapon.
 */
const TOOL_QUESTS: ToolQuest[] = [
  {
    questId: "lumberjacks_first_lesson",
    npc: "forester_wilma",
    hasIt: (p) => hasAxe(p),
  },
  {
    questId: "torvins_tools",
    npc: "torvin",
    hasIt: (p) => hasPickaxe(p),
  },
  {
    questId: "fresh_catch",
    npc: "fisherman_pete",
    hasIt: (p) => hasFishingEquipment(p),
  },
  {
    questId: "goblin_slayer",
    npc: "captain_rowan",
    hasIt: (p) => hasWeapon(p) || hasCombatCapableItem(p),
  },
];

/**
 * Reorder tool quests based on personality traits.
 * Aggressive agents prioritize weapons; adventurous agents get shuffled order.
 */
function sortToolQuestsForPersonality(
  quests: ToolQuest[],
  personality: PersonalityTraits,
): ToolQuest[] {
  const sorted = [...quests];
  if (personality.aggression > 0.6) {
    // Aggressive: weapon quest first
    const weaponIdx = sorted.findIndex((tq) => tq.questId === "goblin_slayer");
    if (weaponIdx > 0) {
      const [weapon] = sorted.splice(weaponIdx, 1);
      sorted.unshift(weapon);
    }
  } else if (personality.adventurousness > 0.7) {
    // Adventurous: shuffle (seeded by traits for consistency)
    const seed = Math.floor(
      (personality.aggression + personality.patience) * 10000,
    );
    for (let i = sorted.length - 1; i > 0; i--) {
      const x = Math.sin(seed + i) * 10000;
      const j = Math.floor((x - Math.floor(x)) * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  }
  return sorted;
}

/** Gathering skills used in desire building */
const GATHERING_SKILLS: Array<{
  goalType: CurrentGoal["type"];
  skillName: string;
  location: string;
  hasIt: (player: PlayerEntity) => boolean;
}> = [
  {
    goalType: "woodcutting",
    skillName: "woodcutting",
    location: "forest",
    hasIt: (p) => hasAxe(p),
  },
  {
    goalType: "mining",
    skillName: "mining",
    location: "mine",
    hasIt: (p) => hasPickaxe(p),
  },
  {
    goalType: "fishing",
    skillName: "fishing",
    location: "fishing",
    hasIt: (p) => hasFishingEquipment(p),
  },
];

// ---------------------------------------------------------------------------
// Desire base weights
// ---------------------------------------------------------------------------

const DESIRE_BASE_WEIGHTS: Record<string, number> = {
  quest_progress: 70,
  woodcutting: 40,
  mining: 40,
  fishing: 40,
  combat_training: 45,
  cooking: 35,
  smithing: 38,
  gear_upgrade: 55,
  combat_food_prep: 50,
  exploration: 20,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum food count before combat training is allowed */
const COMBAT_FOOD_THRESHOLD = 10;

/** Satiation window in milliseconds (15 minutes) */
const SATIATION_WINDOW_MS = 15 * 60 * 1000;

/** Last desire candidates from Stage B scoring (for dashboard display) */
let lastDesireCandidates: Array<{
  goalType: string;
  score: number;
  breakdown: string;
}> = [];

/** Get the last desire score candidates from the planner's Stage B evaluation */
export function getLastDesireCandidates(): Array<{
  goalType: string;
  score: number;
  breakdown: string;
}> {
  return lastDesireCandidates;
}

function getSkillLevel(player: PlayerEntity, skill: string): number {
  return player.skills?.[skill]?.level ?? 1;
}

/**
 * Approximate combat level (simple 5-stat average).
 * Matches the formula used in the autonomous behavior manager.
 */
function getCombatLevel(player: PlayerEntity): number {
  const s = player.skills;
  if (!s) return 1;
  return Math.floor(
    ((s.attack?.level ?? 1) +
      (s.strength?.level ?? 1) +
      (s.defense?.level ?? 1) +
      (s.constitution?.level ?? 1) +
      (s.ranged?.level ?? 1)) /
      5,
  );
}

/**
 * Rotate combat style: train whichever melee skill is lowest.
 * Natural balancing — attack → strength → defense cycling.
 */
function pickCombatStyle(player: PlayerEntity): string {
  const attack = getSkillLevel(player, "attack");
  const strength = getSkillLevel(player, "strength");
  const defense = getSkillLevel(player, "defense");

  if (attack <= strength && attack <= defense) return "attack";
  if (strength <= attack && strength <= defense) return "strength";
  return "defense";
}

/**
 * Extract the tier name from the player's equipped weapon.
 * E.g. "bronze_longsword" → "bronze", "iron_scimitar" → "iron".
 * Returns "none" if no weapon is equipped.
 */
function getEquippedWeaponTier(player: PlayerEntity): string {
  const weapon = player.equipment?.weapon;
  if (!weapon) return "none";

  // weapon can be a string itemId OR an object {itemId: string, ...}
  const weaponName =
    typeof weapon === "string"
      ? weapon
      : (weapon as Record<string, unknown>).itemId
        ? String((weapon as Record<string, unknown>).itemId)
        : (weapon as Record<string, unknown>).name
          ? String((weapon as Record<string, unknown>).name)
          : "";
  if (!weaponName) return "none";

  const lower = weaponName.toLowerCase();
  const tiers = ["rune", "adamant", "mithril", "steel", "iron", "bronze"];
  for (const tier of tiers) {
    if (lower.includes(tier)) return tier;
  }
  return "none";
}

function inventoryCount(player: PlayerEntity): number {
  return Array.isArray(player.items) ? player.items.length : 0;
}

function countCoins(player: PlayerEntity): number {
  // PlayerEntity has a direct `coins` field from the coin pouch
  if (typeof player.coins === "number" && player.coins > 0) return player.coins;
  // Fallback: check inventory items
  if (!Array.isArray(player.items)) return 0;
  for (const item of player.items) {
    const name = (item.name || item.item?.name || item.itemId || "")
      .toString()
      .toLowerCase();
    if (name === "coins" || name === "coin" || name === "gold_coins") {
      return typeof item.quantity === "number" ? item.quantity : 1;
    }
  }
  return 0;
}

function findQuest(
  quests: QuestData[],
  questId: string,
): QuestData | undefined {
  return quests.find(
    (q) =>
      q.questId === questId || (q as Record<string, unknown>).id === questId,
  );
}

function questStatus(quest: QuestData | undefined): string {
  return quest?.status ?? "unknown";
}

// ---------------------------------------------------------------------------
// Desire scoring functions
// ---------------------------------------------------------------------------

/**
 * Compute personality multiplier for a desire.
 * Maps personality traits to per-desire multipliers.
 */
function computePersonalityMul(
  desireId: string,
  traits: PersonalityTraits,
): number {
  let mul = 1.0;

  switch (desireId) {
    case "quest_progress":
      mul = 0.7 + traits.adventurousness * 0.6; // 0.7–1.3
      break;
    case "exploration":
      mul = 0.5 + traits.adventurousness * 1.0; // 0.5–1.5
      break;
    case "combat_training":
      mul = 0.8 + traits.aggression * 0.8; // 0.8–1.6
      break;
    case "combat_food_prep":
      mul = 0.8 + traits.aggression * 0.4; // combat-adjacent
      break;
    case "gear_upgrade":
      mul = 0.9 + traits.aggression * 0.3; // combat-adjacent
      break;
    // Gathering/processing skills use base 1.0
  }

  // Preferred skills get a 1.4× stacking bonus
  const skillMap: Record<string, string[]> = {
    woodcutting: ["woodcutting"],
    mining: ["mining"],
    fishing: ["fishing"],
    cooking: ["cooking"],
    smithing: ["smithing"],
    combat_training: ["attack", "strength", "defense", "combat"],
    combat_food_prep: ["fishing", "combat"],
    gear_upgrade: ["smithing"],
    quest_progress: ["questing"],
    exploration: ["exploration"],
  };
  const relatedSkills = skillMap[desireId] || [];
  for (const skill of relatedSkills) {
    if (traits.preferredSkills.includes(skill)) {
      mul *= 1.4;
      break; // only apply once per desire
    }
  }

  return mul;
}

/**
 * Compute satiation for a desire based on recent goal history.
 * Measures how "full" a desire is from recent satisfaction.
 * Returns 0.0 (fresh) to 0.8 (heavily penalized).
 */
function computeSatiation(
  desireId: string,
  goalHistory: Array<{ type: string; skill?: string; completedAt: number }>,
  patience: number,
): number {
  const now = Date.now();
  let satiation = 0;

  for (const entry of goalHistory) {
    const age = now - entry.completedAt;
    if (age > SATIATION_WINDOW_MS) continue;

    // Match desire to history entry
    const matches =
      entry.type === desireId ||
      entry.skill === desireId ||
      // Map goal types to desire IDs
      (desireId === "quest_progress" && entry.type === "questing") ||
      (desireId === "combat_food_prep" &&
        entry.type === "fishing" &&
        entry.skill === "fishing") ||
      (desireId === "gear_upgrade" && entry.type === "smithing");

    if (!matches) continue;

    // Exponential decay: recent goals contribute more
    const recencyFactor = 1 - age / SATIATION_WINDOW_MS;
    satiation += recencyFactor * 0.25;
  }

  // Patient agents tolerate repetition better (up to 40% reduction)
  const patienceReduction = patience > 0.5 ? 1 - (patience - 0.5) * 0.8 : 1.0;
  satiation *= patienceReduction;

  return Math.min(0.8, satiation);
}

/**
 * Compute contextual opportunity bonus for a desire.
 * Returns a multiplier based on whether the player has the right
 * materials, tools, or conditions for the desire.
 */
function computeOpportunityBonus(
  desireId: string,
  player: PlayerEntity,
): number {
  switch (desireId) {
    case "cooking":
      return hasRawFood(player) && hasTinderbox(player) ? 1.8 : 0.3;

    case "smithing": {
      if (hasBars(player)) return 1.6;
      if (hasOre(player)) return 1.6;
      return inventoryCount(player) > 20 ? 0.5 : 0.3;
    }

    case "gear_upgrade": {
      const attackLevel = getSkillLevel(player, "attack");
      const bestTier = getBestEquippableTier(attackLevel);
      const currentTier = getEquippedWeaponTier(player);
      if (bestTier.tierName === currentTier) return 0.1; // already best gear
      const smithLevel = getSkillLevel(player, "smithing");
      if (
        smithLevel >= bestTier.smithingLevel &&
        (hasBars(player) || hasOre(player))
      ) {
        return 1.5;
      }
      return 0.3;
    }

    case "combat_training": {
      if (!hasCombatCapableItem(player)) return 0.0;
      if (countFood(player) < COMBAT_FOOD_THRESHOLD) return 0.2;
      return 1.3;
    }

    case "combat_food_prep": {
      if (!hasCombatCapableItem(player)) return 0.2;
      if (!hasFishingEquipment(player)) return 0.0;
      if (countFood(player) >= COMBAT_FOOD_THRESHOLD) return 0.2;
      return 1.5;
    }

    case "woodcutting":
      if (!hasAxe(player)) return 0.0;
      return getResourcesAtLevel(
        "woodcutting",
        getSkillLevel(player, "woodcutting"),
      ).length > 0
        ? 1.0
        : 0.0;

    case "mining":
      if (!hasPickaxe(player)) return 0.0;
      return getResourcesAtLevel("mining", getSkillLevel(player, "mining"))
        .length > 0
        ? 1.0
        : 0.0;

    case "fishing":
      if (!hasFishingEquipment(player)) return 0.0;
      return getResourcesAtLevel("fishing", getSkillLevel(player, "fishing"))
        .length > 0
        ? 1.0
        : 0.0;

    case "quest_progress":
      return 1.0; // handled by candidate eligibility

    case "exploration":
      return 1.0; // always available

    default:
      return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Duel preparation bonus
// ---------------------------------------------------------------------------

/**
 * How much each desire contributes to duel readiness.
 *
 * Every agent knows they're preparing for duels. This additive bonus
 * lifts combat-relevant activities so agents naturally follow a
 * progression toward duel strength:
 *
 *   mining → smelting → smithing → gear upgrade → combat training
 *   fishing → cooking → food stockpile → combat endurance
 *   quests → XP rewards → higher stats
 *
 * The bonus is context-aware: activities the agent most needs right now
 * for duel readiness get a bigger lift.
 */
function computeDuelPrepBonus(desireId: string, player: PlayerEntity): number {
  const combatLevel = getCombatLevel(player);
  const foodCount = countFood(player);
  const currentTier = getEquippedWeaponTier(player);
  const attackLevel = getSkillLevel(player, "attack");
  const bestTier = getBestEquippableTier(attackLevel);
  const canUpgradeGear = bestTier.tierName !== currentTier;

  switch (desireId) {
    // Direct combat impact — highest duel-prep value
    case "combat_training":
      return 15;

    case "gear_upgrade":
      // Massive bonus if agent can actually upgrade to better gear
      return canUpgradeGear ? 20 : 0;

    // Food is survival in duels — high value when low
    case "combat_food_prep":
      return foodCount < 5 ? 20 : foodCount < COMBAT_FOOD_THRESHOLD ? 12 : 0;

    case "cooking":
      // Cooking raw food into edible food directly supports duel survival
      return foodCount < COMBAT_FOOD_THRESHOLD ? 10 : 3;

    // Smithing feeds the gear pipeline
    case "smithing":
      return canUpgradeGear ? 12 : 5;

    // Mining feeds smithing which feeds gear
    case "mining":
      return canUpgradeGear ? 8 : 3;

    // Fishing feeds cooking which feeds food
    case "fishing":
      return foodCount < COMBAT_FOOD_THRESHOLD ? 8 : 2;

    // Quests give XP → levels → stronger in duels
    case "quest_progress":
      return combatLevel < 10 ? 8 : 3;

    // Woodcutting has minimal duel impact (firemaking → cooking is indirect)
    case "woodcutting":
      return 2;

    // Exploration has no direct duel benefit
    case "exploration":
      return 0;

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Core planner
// ---------------------------------------------------------------------------

/**
 * Deterministic goal selection with personality-driven desire scoring.
 *
 * Stage A: Hard constraints (strict priority, first-match-wins)
 * Stage B: Soft desires (scored competition, personality-influenced)
 *
 * Returns the winning GoalPlan, or null when the situation is
 * ambiguous enough that the LLM should decide.
 */
export function planNextGoal(ctx: PlannerContext): GoalPlan | null {
  const { player, quests } = ctx;
  const personality = ctx.personality || DEFAULT_PERSONALITY;
  const goalHistory = ctx.goalHistory || [];

  // Personality-driven quest ordering (aggressive → weapon first, adventurous → shuffled)
  const orderedToolQuests = sortToolQuestsForPersonality(
    TOOL_QUESTS,
    personality,
  );

  // ------------------------------------------------------------------
  // Guard: Don't make decisions if quest data hasn't loaded yet.
  // When the agent is missing tools and quests array is empty, the server
  // hasn't sent quest data yet. Return null to avoid premature exploration
  // that leads to random actions (attacking goblins, talking to wrong NPCs).
  // The ABM will retry on the next tick when quest data may have arrived.
  // ------------------------------------------------------------------
  const missingTools = TOOL_QUESTS.some((tq) => !tq.hasIt(player));
  if (missingTools && quests.length === 0) {
    logger.info(
      "[GoalPlanner] Waiting for quest data — agent missing tools but quest list empty",
    );
    return null;
  }

  // ==================================================================
  // STAGE A — Hard constraints (strict priority, first-match-wins)
  // ==================================================================

  // ------------------------------------------------------------------
  // Phase 1 — Bootstrap: accept tool-granting quests
  // ------------------------------------------------------------------
  for (const tq of orderedToolQuests) {
    if (tq.hasIt(player)) continue; // already have this tool

    const quest = findQuest(quests, tq.questId);
    const status = questStatus(quest);

    if (status === "not_started") {
      return {
        goal: {
          type: "questing",
          description: `Accept quest: ${tq.questId} (get starter tool)`,
          target: 1,
          progress: 0,
          startedAt: Date.now(),
          questId: tq.questId,
          questStartNpc: tq.npc,
        },
        reason: `Missing tool → accept ${tq.questId}`,
      };
    }
  }

  // ------------------------------------------------------------------
  // Phase 2 — Turn in ready quests
  // ------------------------------------------------------------------
  const readyQuests = quests.filter((q) => q.status === "ready_to_complete");
  if (readyQuests.length > 0) {
    const q = readyQuests[0];
    const questId =
      q.questId || ((q as Record<string, unknown>).id as string) || "";
    const startNpc =
      q.startNpc || TOOL_QUESTS.find((tq) => tq.questId === questId)?.npc || "";
    return {
      goal: {
        type: "questing",
        description: `Turn in quest: ${q.name || questId}`,
        target: 1,
        progress: 0,
        startedAt: Date.now(),
        questId,
        questStartNpc: startNpc,
        questStageType: "dialogue",
      },
      reason: `Quest ${questId} ready to complete — return to ${startNpc}`,
    };
  }

  // ------------------------------------------------------------------
  // Phase 2.5 — Tools in bank → withdraw them
  // ------------------------------------------------------------------
  const bankNames = ctx.bankItemNames || [];
  if (bankNames.length > 0) {
    for (const tq of orderedToolQuests) {
      if (tq.hasIt(player)) continue;

      const toolInBank = TOOL_BANK_KEYWORDS[tq.questId]?.some((kw) =>
        bankNames.some((bn) => bn.includes(kw)),
      );

      if (toolInBank) {
        return {
          goal: {
            type: "banking",
            description: `Withdraw ${tq.questId} tool from bank`,
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: "bank",
          },
          reason: `Tool for ${tq.questId} is in bank — go withdraw it`,
        };
      }
    }

    // Also check for tinderbox in bank
    if (
      !hasTinderbox(player) &&
      bankNames.some((bn) => bn.includes("tinderbox"))
    ) {
      return {
        goal: {
          type: "banking",
          description: "Withdraw tinderbox from bank",
          target: 1,
          progress: 0,
          startedAt: Date.now(),
          location: "bank",
        },
        reason: "Tinderbox is in bank — go withdraw it",
      };
    }
  }

  // ------------------------------------------------------------------
  // Phase 2.6 — Lost tools recovery (tool quest done but tool missing)
  // ------------------------------------------------------------------
  for (const tq of orderedToolQuests) {
    if (tq.hasIt(player)) continue;

    const quest = findQuest(quests, tq.questId);
    const status = questStatus(quest);

    if (status === "completed") {
      const coins = countCoins(player);
      if (coins >= 10) {
        return {
          goal: {
            type: "shopping",
            description: `Buy replacement tool at general store`,
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: "spawn",
            targetSkill: tq.questId,
          },
          reason: `Tool lost after completing ${tq.questId} — has ${coins} coins, navigate to shop`,
        };
      }
      logger.info(
        `[GoalPlanner] Lost tool from ${tq.questId} and no coins — exploring to find replacement`,
      );
    }

    if (status === "in_progress") break; // handled by Phase 3
  }

  // ------------------------------------------------------------------
  // Phase 3 — Continue in-progress quests (hard constraint)
  // A human player finishes what they started. This stays deterministic
  // so agents don't abandon quests mid-way based on personality whims.
  // When multiple quests are active, prefer non-combat (gather/dialogue)
  // over combat (kill) so resource skills develop first.
  // ------------------------------------------------------------------
  const activeQuestsHard = quests.filter((q) => q.status === "in_progress");
  if (activeQuestsHard.length > 0) {
    // Prefer non-combat quests over kill quests
    const nonCombat = activeQuestsHard.filter((q) => q.stageType !== "kill");
    const q = nonCombat.length > 0 ? nonCombat[0] : activeQuestsHard[0];
    const questId =
      q.questId || ((q as Record<string, unknown>).id as string) || "";
    // Resolve startNpc: prefer QuestData.startNpc (from server), fallback to TOOL_QUESTS
    const startNpc =
      q.startNpc || TOOL_QUESTS.find((tq) => tq.questId === questId)?.npc || "";

    let enrichedProgress = 0;
    let enrichedTarget = 1;
    const stageCount = q.stageCount || undefined;
    if (q.stageProgress && typeof q.stageProgress === "object") {
      // Use current stage's target key for progress (not max across all keys,
      // which would show old stage progress like raw_shrimp: 8 on the cooking stage)
      const stageTargetKey = q.stageTarget;
      if (stageTargetKey && q.stageProgress[stageTargetKey] !== undefined) {
        enrichedProgress = q.stageProgress[stageTargetKey];
      } else if (stageTargetKey) {
        // Stage target exists but no progress for it yet (e.g., just advanced
        // from gather to cook) — show 0, not the old stage's progress
        enrichedProgress = 0;
      } else {
        const progressValues = Object.values(q.stageProgress);
        if (progressValues.length > 0) {
          enrichedProgress = Math.max(...progressValues);
        }
      }
    }
    if (stageCount && stageCount > 0) {
      enrichedTarget = stageCount;
    }

    return {
      goal: {
        type: "questing",
        description: `Complete quest: ${q.name || questId}${enrichedTarget > 1 ? ` (${enrichedProgress}/${enrichedTarget})` : ""}`,
        target: enrichedTarget,
        progress: enrichedProgress,
        startedAt: Date.now(),
        questId,
        questStartNpc: startNpc,
        questStageType:
          (q.stageType as CurrentGoal["questStageType"]) || undefined,
        questStageTarget: q.stageTarget || undefined,
        questStageCount: stageCount,
      },
      reason: `Quest ${questId} in progress (${enrichedProgress}/${enrichedTarget})`,
    };
  }

  // ------------------------------------------------------------------
  // Phase 4 — Inventory full → bank
  // ------------------------------------------------------------------
  if (inventoryCount(player) >= 26) {
    return {
      goal: {
        type: "banking",
        description: "Bank items — inventory nearly full",
        target: 1,
        progress: 0,
        location: "bank",
        startedAt: Date.now(),
      },
      reason: `Inventory ${inventoryCount(player)}/28 → banking`,
    };
  }

  // ==================================================================
  // STAGE B — Soft desires (scored competition)
  // ==================================================================

  const candidates: DesireCandidate[] = [];

  // Note: in-progress quests are handled as a hard constraint in Stage A (Phase 3).
  // Stage B only fires when there's no active quest to continue.

  // --- Gathering skill desires ---
  for (const g of GATHERING_SKILLS) {
    if (!g.hasIt(player)) continue;
    const level = getSkillLevel(player, g.skillName);
    const resources = getResourcesAtLevel(
      g.skillName as "woodcutting" | "mining" | "fishing",
      level,
    );
    if (resources.length === 0) continue;

    candidates.push(
      buildDesire(
        g.skillName,
        personality,
        goalHistory,
        player,
        () => ({
          goal: {
            type: g.goalType,
            description: `Train ${g.skillName} (level ${level})`,
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: g.location,
            targetSkill: g.skillName,
            targetSkillLevel: level + 1,
          },
          reason: `Desire-scored gathering → ${g.skillName} (level ${level})`,
        }),
        ctx.recentGoalCounts,
      ),
    );
  }

  // --- Combat training desire ---
  if (
    hasCombatCapableItem(player) &&
    countFood(player) >= COMBAT_FOOD_THRESHOLD
  ) {
    const combatLevel = getCombatLevel(player);
    const monster = getMonsterForCombatLevel(
      combatLevel,
      SCRIPTED_AUTONOMY_CONFIG.MOB_LEVEL_MAX_ABOVE,
    );
    const skill = pickCombatStyle(player);

    candidates.push(
      buildDesire(
        "combat_training",
        personality,
        goalHistory,
        player,
        () => ({
          goal: {
            type: "combat_training",
            description: `Train ${skill} on ${monster.name}s`,
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: monster.location,
            targetSkill: skill,
            targetSkillLevel: getSkillLevel(player, skill) + 1,
            targetEntity: monster.id,
          },
          reason: `Combat level ${combatLevel} → ${monster.name} (lvl ${monster.level}), training ${skill}`,
        }),
        ctx.recentGoalCounts,
      ),
    );
  }

  // --- Cooking desire ---
  if (hasRawFood(player) && hasTinderbox(player)) {
    candidates.push(
      buildDesire(
        "cooking",
        personality,
        goalHistory,
        player,
        () => ({
          goal: {
            type: "cooking",
            description: "Cook raw food",
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            targetSkill: "cooking",
            targetSkillLevel: getSkillLevel(player, "cooking") + 1,
          },
          reason: "Has raw food → cook",
        }),
        ctx.recentGoalCounts,
      ),
    );
  }

  // --- Smithing desire (process materials) ---
  if ((hasOre(player) || hasBars(player)) && inventoryCount(player) > 20) {
    const smithLevel = getSkillLevel(player, "smithing");
    const playerHasBars = hasBars(player);
    candidates.push(
      buildDesire(
        "smithing",
        personality,
        goalHistory,
        player,
        () => ({
          goal: {
            type: "smithing",
            description: playerHasBars
              ? "Smith bars into items"
              : "Smelt ore into bars",
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: playerHasBars ? "anvil" : "furnace",
            targetSkill: "smithing",
            targetSkillLevel: smithLevel + 1,
          },
          reason: playerHasBars
            ? "Has bars + inventory > 20 → smith"
            : "Has ore + inventory > 20 → smelt",
        }),
        ctx.recentGoalCounts,
      ),
    );
  }

  // --- Gear upgrade desire ---
  {
    const attackLevel = getSkillLevel(player, "attack");
    const bestTier = getBestEquippableTier(attackLevel);
    const currentWeaponTier = getEquippedWeaponTier(player);
    const smithLevel = getSkillLevel(player, "smithing");

    if (
      bestTier.tierName !== currentWeaponTier &&
      smithLevel >= bestTier.smithingLevel &&
      (hasBars(player) || hasOre(player))
    ) {
      const playerHasBars = hasBars(player);
      candidates.push(
        buildDesire(
          "gear_upgrade",
          personality,
          goalHistory,
          player,
          () => ({
            goal: {
              type: "smithing",
              description: playerHasBars
                ? `Smith ${bestTier.tierName} equipment`
                : `Smelt ore for ${bestTier.tierName} gear`,
              target: 1,
              progress: 0,
              startedAt: Date.now(),
              location: playerHasBars ? "anvil" : "furnace",
              targetSkill: "smithing",
              targetSkillLevel: smithLevel + 1,
            },
            reason: `Gear upgrade → ${bestTier.tierName} (attack ${attackLevel}, smithing ${smithLevel})`,
          }),
          ctx.recentGoalCounts,
        ),
      );
    }
  }

  // --- Combat food prep desire (fishing for food before combat) ---
  if (
    hasCombatCapableItem(player) &&
    countFood(player) < COMBAT_FOOD_THRESHOLD &&
    hasFishingEquipment(player)
  ) {
    candidates.push(
      buildDesire(
        "combat_food_prep",
        personality,
        goalHistory,
        player,
        () => ({
          goal: {
            type: "fishing",
            description: "Fish for food before combat",
            target: 1,
            progress: 0,
            startedAt: Date.now(),
            location: "fishing",
            targetSkill: "fishing",
            targetSkillLevel: getSkillLevel(player, "fishing") + 1,
          },
          reason: `Food count ${countFood(player)} < ${COMBAT_FOOD_THRESHOLD} → fish for food`,
        }),
        ctx.recentGoalCounts,
      ),
    );
  }

  // --- Exploration desire (always available as fallback) ---
  candidates.push(
    buildDesire(
      "exploration",
      personality,
      goalHistory,
      player,
      () => ({
        goal: {
          type: "exploration",
          description: "Explore the world",
          target: 3,
          progress: 0,
          startedAt: Date.now(),
        },
        reason: "Exploration desire",
      }),
      ctx.recentGoalCounts,
    ),
  );

  // --- Score and sort candidates ---
  candidates.sort((a, b) => b.score - a.score);

  // Store desire candidates for dashboard display
  lastDesireCandidates = candidates.map((c) => ({
    goalType: c.id,
    score: Math.round(c.score * 10) / 10,
    breakdown: `base=${c.baseWeight}+duel${c.duelPrepBonus} pers=${c.personalityMul.toFixed(2)} sat=${c.satiation.toFixed(2)} opp=${c.opportunityBonus.toFixed(1)}`,
  }));

  // Log all desire scores
  const scoreLog = candidates
    .map((c) => `${c.id}=${c.score.toFixed(1)}`)
    .join(", ");
  logger.info(`[GoalPlanner] Desire scores: ${scoreLog}`);

  // Pick the winner (first with score > 0)
  const winner = candidates.find((c) => c.score > 0);
  if (winner) {
    const plan = winner.buildGoal();
    plan.reason += ` [score=${winner.score.toFixed(1)} base=${winner.baseWeight}+duel${winner.duelPrepBonus} pers=${winner.personalityMul.toFixed(2)} sat=${winner.satiation.toFixed(2)} opp=${winner.opportunityBonus.toFixed(1)}]`;
    return plan;
  }

  // All desires scored 0 — fall through to LLM
  return null;
}

/**
 * Build a scored DesireCandidate from components.
 */
function buildDesire(
  id: string,
  personality: PersonalityTraits,
  goalHistory: Array<{ type: string; skill?: string; completedAt: number }>,
  player: PlayerEntity,
  buildGoal: () => GoalPlan,
  recentGoalCounts?: Record<string, number>,
): DesireCandidate {
  const baseWeight = DESIRE_BASE_WEIGHTS[id] ?? 20;
  const personalityMul = computePersonalityMul(id, personality);
  const satiation = computeSatiation(id, goalHistory, personality.patience);
  const opportunityBonus = computeOpportunityBonus(id, player);
  const duelPrepBonus = computeDuelPrepBonus(id, player);

  // Activity variety multiplier — penalize over-represented goal types
  let varietyMul = 1.0;
  if (recentGoalCounts) {
    const myCount = recentGoalCounts[id] ?? 0;
    const totalGoals = Object.values(recentGoalCounts).reduce(
      (sum, v) => sum + v,
      0,
    );
    if (totalGoals > 0) {
      varietyMul = Math.max(0.7, 1.3 - (myCount / totalGoals) * 0.6);
    }
  }

  // Duel-prep bonus is additive to base weight, then scaled by personality/satiation/opportunity/variety
  const effectiveBase = baseWeight + duelPrepBonus;
  const score =
    effectiveBase *
    personalityMul *
    (1 - satiation) *
    opportunityBonus *
    varietyMul;

  return {
    id,
    baseWeight,
    personalityMul,
    satiation,
    opportunityBonus,
    duelPrepBonus,
    score,
    buildGoal,
  };
}

/**
 * Convenience: build the PlannerContext from readily available data.
 */
export function buildPlannerContext(
  player: PlayerEntity,
  quests: QuestData[],
  recentGoalCounts: Record<string, number>,
  bankItemNames?: string[],
  personality?: PersonalityTraits,
  goalHistory?: Array<{ type: string; skill?: string; completedAt: number }>,
): PlannerContext {
  return {
    player,
    quests,
    recentGoalCounts,
    bankItemNames,
    personality: personality || DEFAULT_PERSONALITY,
    goalHistory: goalHistory || [],
  };
}

/**
 * Log the planner's decision at info level.
 */
export function logPlannerDecision(plan: GoalPlan): void {
  logger.info(
    `[GoalPlanner] ${plan.reason} → ${plan.goal.type}: ${plan.goal.description}`,
  );
}
