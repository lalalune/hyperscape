/**
 * guardrailsProvider - Safety constraints and warnings for LLM decisions
 *
 * Provides the LLM with:
 * - Hard constraints (MUST follow)
 * - Soft constraints (SHOULD follow)
 * - Active warnings based on current state
 * - Blocked actions with reasons
 *
 * This ensures the LLM makes safe, appropriate decisions even when
 * the optimal action isn't clear.
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
import type { InventoryItem, Entity } from "../types.js";
import { getCombatReadiness } from "./goalProvider.js";

// ============================================================================
// TYPES
// ============================================================================

export type WarningLevel = "critical" | "warning" | "info";

export interface Warning {
  level: WarningLevel;
  message: string;
  action?: string; // Suggested action to resolve
}

export interface BlockedAction {
  action: string;
  reason: string;
  resolveBy?: string; // How to unblock
}

export interface GuardrailsData {
  hardConstraints: string[];
  softConstraints: string[];
  activeWarnings: Warning[];
  blockedActions: BlockedAction[];
}

// ============================================================================
// CONSTRAINT DEFINITIONS
// ============================================================================

/**
 * Hard constraints - MUST be followed at all times
 */
const HARD_CONSTRAINTS: string[] = [
  "NEVER set combat goals when health is below 30%",
  "NEVER engage in combat without a weapon equipped",
  "ALWAYS take emergency survival action when health drops below 25% (eat immediately or flee)",
  "NEVER travel more than 200 tiles from spawn point (anti-cheat protection)",
  "ALWAYS finish killing current target before switching to another",
  "NEVER drop valuable items (weapons, tools, rare resources)",
  "ALWAYS eat food before health reaches critical levels",
];

/**
 * Soft constraints - SHOULD be followed when possible
 */
const SOFT_CONSTRAINTS: string[] = [
  "Prefer goals that utilize current inventory items",
  "Prefer nearby resources over distant ones",
  "Prefer lower-risk activities when low on food",
  "Balance skill training - don't over-specialize too early",
  "Gather food supplies before extended combat sessions",
  "Smith tools (axe, pickaxe) before weapons for self-sufficiency",
  "Complete current goal before starting a new one",
  "Bank valuable items when inventory is nearly full",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if item is food (for healing)
 */
function getItemLabel(item: InventoryItem): string {
  return (item.name || item.item?.name || item.itemId || item.id || "")
    .toString()
    .toLowerCase();
}

function isFood(item: InventoryItem): boolean {
  const name = getItemLabel(item);
  const itemId = (item.itemId || item.id || "").toLowerCase();
  return (
    name.includes("shrimp") ||
    name.includes("trout") ||
    name.includes("salmon") ||
    name.includes("lobster") ||
    name.includes("swordfish") ||
    name.includes("monkfish") ||
    name.includes("bread") ||
    name.includes("cake") ||
    name.includes("pie") ||
    name.includes("cooked") ||
    itemId.includes("cooked_") ||
    itemId.includes("_fish")
  );
}

/**
 * Check if player has food in inventory
 */
function countFood(items: InventoryItem[]): number {
  return items
    .filter(isFood)
    .reduce((sum, item) => sum + (item.quantity || 1), 0);
}

/**
 * Check if player is in combat (has nearby aggressive mobs attacking them)
 */
function isInCombat(
  _nearbyEntities: Entity[],
  player: { combatTarget?: string | null; inCombat?: boolean } | null,
): boolean {
  if (player?.inCombat) return true;
  if (player?.combatTarget) return true;
  return false;
}

/**
 * Check if an entity looks like an aggressive mob
 */
function isAggressiveMob(entity: Entity): boolean {
  const name = entity.name?.toLowerCase() || "";
  return (
    name.includes("goblin") ||
    name.includes("skeleton") ||
    name.includes("zombie") ||
    name.includes("spider") ||
    name.includes("demon") ||
    name.includes("dragon")
  );
}

// ============================================================================
// WARNING DETECTION
// ============================================================================

/**
 * Generate active warnings based on current player state
 */
function generateWarnings(
  player: {
    health?: { current: number; max: number };
    equipment?: { weapon: string | null };
    items?: InventoryItem[];
    alive?: boolean;
    inCombat?: boolean;
    combatTarget?: string | null;
  } | null,
  nearbyEntities: Entity[],
  combatReadiness: { score: number; factors: string[]; ready: boolean },
): Warning[] {
  const warnings: Warning[] = [];

  if (!player) {
    warnings.push({
      level: "critical",
      message: "No player data available - cannot assess state",
    });
    return warnings;
  }

  const isDead = player.alive === false || (player.health?.current ?? 1) <= 0;
  if (isDead) {
    warnings.push({
      level: "critical",
      message: "DEAD: HP is 0. You cannot continue normal actions.",
      action: "Respawn first, then reassess goals.",
    });
    return warnings;
  }

  // Health warnings
  const healthPercent =
    player.health && player.health.max > 0
      ? (player.health.current / player.health.max) * 100
      : 100;

  if (healthPercent < 25) {
    warnings.push({
      level: "critical",
      message: `CRITICAL: Health at ${healthPercent.toFixed(0)}% - eat immediately or flee immediately`,
      action: "Use food now; if pressure continues, disengage/flee",
    });
  } else if (healthPercent < 50) {
    warnings.push({
      level: "warning",
      message: `Health at ${healthPercent.toFixed(0)}% - eat food or avoid combat`,
      action: "Eat now; if pressure rises, disengage/flee",
    });
  }

  // Food warnings
  const foodCount = countFood(player.items || []);
  if (foodCount === 0) {
    const inCombat = isInCombat(nearbyEntities, player);
    if (inCombat) {
      warnings.push({
        level: "critical",
        message: "No food in inventory while in combat - very dangerous!",
        action: "Flee and get food before continuing",
      });
    } else {
      warnings.push({
        level: "warning",
        message: "No food in inventory - get food before combat",
        action: "Fish and cook, or buy food from a shop",
      });
    }
  } else if (foodCount < 5) {
    warnings.push({
      level: "info",
      message: `Low food supplies (${foodCount} items) - consider restocking`,
      action: "Gather more food when convenient",
    });
  }

  // Weapon warnings
  if (!player.equipment?.weapon) {
    warnings.push({
      level: "warning",
      message: "No weapon equipped - combat will be ineffective",
      action: "Equip a weapon or smith one from bars",
    });
  }

  // Combat readiness warnings
  if (!combatReadiness.ready) {
    warnings.push({
      level: "warning",
      message: `Combat readiness low (${combatReadiness.score}%): ${combatReadiness.factors.join(", ")}`,
      action: "Address issues before engaging in combat",
    });
  }

  // Nearby threat warnings (when not combat ready)
  const nearbyThreats = nearbyEntities.filter(isAggressiveMob);
  if (nearbyThreats.length > 0 && !combatReadiness.ready) {
    warnings.push({
      level: "info",
      message: `${nearbyThreats.length} aggressive mob(s) nearby but not combat ready`,
      action: "Maintain distance or prepare for combat",
    });
  }

  // Inventory warnings
  const inventoryCount = player.items?.length || 0;
  if (inventoryCount >= 26) {
    warnings.push({
      level: "info",
      message: `Inventory nearly full (${inventoryCount}/28 slots)`,
      action: "Bank items or drop less valuable ones",
    });
  }

  return warnings;
}

// ============================================================================
// BLOCKED ACTION DETECTION
// ============================================================================

/**
 * Determine which actions should be blocked based on current state
 */
function generateBlockedActions(
  player: {
    health?: { current: number; max: number };
    equipment?: { weapon: string | null };
    items?: InventoryItem[];
    alive?: boolean;
  } | null,
  nearbyEntities: Entity[],
  combatReadiness: { score: number; ready: boolean },
): BlockedAction[] {
  const blocked: BlockedAction[] = [];

  if (!player) {
    blocked.push({
      action: "all",
      reason: "No player data available",
    });
    return blocked;
  }

  const isDead = player.alive === false || (player.health?.current ?? 1) <= 0;
  if (isDead) {
    blocked.push({
      action: "all (except RESPAWN)",
      reason: "Player is dead (HP is 0)",
      resolveBy: "Respawn before taking other actions",
    });
    return blocked;
  }

  const healthPercent =
    player.health && player.health.max > 0
      ? (player.health.current / player.health.max) * 100
      : 100;

  // Block combat when health is critical
  if (healthPercent < 25) {
    blocked.push({
      action: "combat",
      reason: `Health critically low (${healthPercent.toFixed(0)}%)`,
      resolveBy: "Flee and heal before fighting",
    });
    blocked.push({
      action: "SET_GOAL (combat_training)",
      reason: "Health too low for combat goals",
      resolveBy: "Heal to at least 50% health",
    });
  }

  // Block combat without weapon
  if (!player.equipment?.weapon) {
    blocked.push({
      action: "ATTACK_ENTITY",
      reason: "No weapon equipped",
      resolveBy: "Equip a weapon from inventory or smith one",
    });
  }

  // Block combat without food
  const foodCount = countFood(player.items || []);
  if (foodCount === 0 && healthPercent < 100) {
    blocked.push({
      action: "combat",
      reason: "No food for healing during combat",
      resolveBy: "Gather or buy food first",
    });
  }

  // Block smithing without materials
  const items = player.items || [];
  const hasOre = items.some((i) => getItemLabel(i).includes("ore"));
  const hasBars = items.some((i) => getItemLabel(i).includes("bar"));

  if (!hasOre && !hasBars) {
    blocked.push({
      action: "smelting",
      reason: "No ore in inventory",
      resolveBy: "Mine ore first",
    });
  }

  if (!hasBars) {
    blocked.push({
      action: "smithing",
      reason: "No bars in inventory",
      resolveBy: "Smelt ore into bars first",
    });
  }

  // Block firemaking without logs
  const hasLogs = items.some((i) => getItemLabel(i).includes("log"));
  if (!hasLogs) {
    blocked.push({
      action: "firemaking",
      reason: "No logs in inventory",
      resolveBy: "Chop trees to get logs",
    });
  }

  // Block cooking without raw food
  const hasRawFood = items.some((i) => getItemLabel(i).includes("raw"));
  if (!hasRawFood) {
    blocked.push({
      action: "cooking",
      reason: "No raw food in inventory",
      resolveBy: "Fish or kill animals for raw food",
    });
  }

  // Block gathering if inventory is full
  const inventoryFull = items.length >= 28;
  if (inventoryFull) {
    blocked.push({
      action: "gathering (woodcutting, mining, fishing)",
      reason: "Inventory is full",
      resolveBy: "Bank or drop items to make space",
    });
  }

  return blocked;
}

// ============================================================================
// PROVIDER
// ============================================================================

export const guardrailsProvider: Provider = {
  name: "guardrails",
  description: "Safety constraints and warnings for decision making",
  dynamic: true,
  position: 9, // After goalTemplatesProvider

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    const player = service?.getPlayerEntity();
    const nearbyEntities = service?.getNearbyEntities() || [];
    const combatReadiness = service
      ? getCombatReadiness(service)
      : { score: 0, factors: [], ready: false };

    // Generate warnings and blocked actions
    const activeWarnings = generateWarnings(
      player ?? null,
      nearbyEntities,
      combatReadiness,
    );
    const blockedActions = generateBlockedActions(
      player ?? null,
      nearbyEntities,
      combatReadiness,
    );

    const data: GuardrailsData = {
      hardConstraints: HARD_CONSTRAINTS,
      softConstraints: SOFT_CONSTRAINTS,
      activeWarnings,
      blockedActions,
    };

    // Build markdown text for LLM
    const textParts: string[] = ["## Safety Guardrails\n"];

    // Critical warnings first (most visible)
    const criticalWarnings = activeWarnings.filter(
      (w) => w.level === "critical",
    );
    if (criticalWarnings.length > 0) {
      textParts.push("### ⚠️ CRITICAL WARNINGS");
      for (const warning of criticalWarnings) {
        textParts.push(`**${warning.message}**`);
        if (warning.action) {
          textParts.push(`→ ${warning.action}`);
        }
      }
      textParts.push("");
    }

    // Regular warnings
    const regularWarnings = activeWarnings.filter((w) => w.level === "warning");
    if (regularWarnings.length > 0) {
      textParts.push("### ⚡ Warnings");
      for (const warning of regularWarnings) {
        textParts.push(`- ${warning.message}`);
        if (warning.action) {
          textParts.push(`  → ${warning.action}`);
        }
      }
      textParts.push("");
    }

    // Blocked actions
    if (blockedActions.length > 0) {
      textParts.push("### 🚫 Blocked Actions");
      for (const blocked of blockedActions) {
        textParts.push(`- **${blocked.action}**: ${blocked.reason}`);
        if (blocked.resolveBy) {
          textParts.push(`  → Fix by: ${blocked.resolveBy}`);
        }
      }
      textParts.push("");
    }

    // Info-level notes
    const infoNotes = activeWarnings.filter((w) => w.level === "info");
    if (infoNotes.length > 0) {
      textParts.push("### ℹ️ Notes");
      for (const note of infoNotes) {
        textParts.push(`- ${note.message}`);
      }
      textParts.push("");
    }

    // Hard constraints (always show for reference)
    textParts.push("### Hard Rules (MUST Follow)");
    for (const constraint of HARD_CONSTRAINTS.slice(0, 4)) {
      // Show top 4
      textParts.push(`- ${constraint}`);
    }
    textParts.push("");

    // Soft constraints (abbreviated)
    textParts.push("### Guidelines (SHOULD Follow)");
    for (const constraint of SOFT_CONSTRAINTS.slice(0, 3)) {
      // Show top 3
      textParts.push(`- ${constraint}`);
    }

    // Summary status
    const hasCritical = criticalWarnings.length > 0;
    const hasBlocked = blockedActions.length > 0;
    const statusEmoji = hasCritical ? "🔴" : hasBlocked ? "🟡" : "🟢";
    const statusText = hasCritical
      ? "CRITICAL ISSUES - Address immediately"
      : hasBlocked
        ? "Some actions blocked - see above"
        : "All clear - proceed with goals";

    textParts.push(`\n**Status**: ${statusEmoji} ${statusText}`);

    return {
      text: textParts.join("\n"),
      values: {
        hasCriticalWarnings: criticalWarnings.length > 0,
        warningCount: activeWarnings.length,
        blockedActionCount: blockedActions.length,
        safeToEngage: !hasCritical && combatReadiness.ready,
        // Include full data in values so it's accessible in composed state
        guardrailsData: data,
      },
      data: {
        hasCritical: criticalWarnings.length > 0,
        warningCount: activeWarnings.length,
        blockedCount: blockedActions.length,
        safeToEngage: !hasCritical && combatReadiness.ready,
      },
    };
  },
};
