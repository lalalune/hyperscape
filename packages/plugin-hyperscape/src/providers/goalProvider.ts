/**
 * goalProvider - Provides current agent goal context and available goals
 *
 * Goals are stored in the AutonomousBehaviorManager for reliability.
 * This provider reads the current goal and available goal options
 * based on the agent's current state (skills, health, nearby entities).
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { AvailableGoalType } from "../types.js";
import type { WorldMapData } from "../types.js";
import type { Entity } from "../types.js";
import {
  hasWeapon as detectHasWeapon,
  hasCombatCapableItem,
  hasFood as detectHasFood,
  countFood as detectCountFood,
  hasAxe as detectHasAxe,
  hasPickaxe as detectHasPickaxe,
  hasFishingEquipment as detectHasFishingEquipment,
} from "../utils/item-detection.js";

/**
 * Known locations in the game world (FALLBACK DEFAULTS)
 *
 * These are used as fallbacks when dynamic entity lookup doesn't find
 * the target entity nearby. The agent prefers to find actual entity
 * positions at runtime using findNearestEntityPosition() in the behavior manager.
 *
 * NOTE: Coordinates are approximate and may change as the world evolves.
 * Must be within 200 tiles of spawn for anti-cheat compliance.
 */
export const KNOWN_LOCATIONS: Record<
  string,
  {
    position?: [number, number, number];
    description: string;
    entities?: string[];
  }
> = {
  spawn: {
    description: "Spawn area where goblins roam - good for combat training",
    entities: ["goblin"],
  },
  forest: {
    description: "Nearby grove with trees for woodcutting",
    entities: ["tree"],
  },
  fishing: {
    description: "Fishing spot by the water - good for catching fish",
    entities: ["fishing_spot", "fishing spot"],
  },
  mine: {
    description: "Mining area with rocks - good for mining ore",
    entities: ["rock", "ore"],
  },
  furnace: {
    description: "Furnace for smelting ore into bars",
    entities: ["furnace"],
  },
  anvil: {
    description: "Anvil for smithing bars into weapons and armor",
    entities: ["anvil"],
  },
};

function getEntityPosition(entity: Entity): [number, number, number] | null {
  const pos = entity.position;
  if (!pos) return null;
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  if (typeof pos === "object" && "x" in pos && "z" in pos) {
    const p = pos as { x: number; y?: number; z: number };
    return [p.x, p.y ?? 0, p.z];
  }
  return null;
}

function getPositionXZ(pos: unknown): { x: number; z: number } | null {
  if (Array.isArray(pos) && pos.length >= 3) {
    return { x: pos[0], z: pos[2] };
  }
  if (pos && typeof pos === "object" && "x" in pos && "z" in pos) {
    const p = pos as { x: number; z: number };
    return { x: p.x, z: p.z };
  }
  return null;
}

function setKnownLocationPosition(
  key: string,
  position: [number, number, number],
): void {
  if (!KNOWN_LOCATIONS[key]) return;
  KNOWN_LOCATIONS[key] = {
    ...KNOWN_LOCATIONS[key],
    position,
  };
}

/**
 * Populate KNOWN_LOCATIONS from world map data (towns, POIs, resources, stations, NPCs).
 * Called once by mapProvider when world data first arrives from the server.
 * This allows NAVIGATE_TO to route to any town, POI, resource, or station by name.
 */
export function populateKnownLocationsFromWorldMap(
  worldMap: WorldMapData,
): void {
  const candidateSources = [...worldMap.towns, ...worldMap.pois];
  const findCandidate = (
    patterns: string[],
  ): [number, number, number] | null => {
    const match = candidateSources.find((entry) => {
      const name = entry.name.toLowerCase();
      return patterns.some((p) => name.includes(p));
    });
    if (!match) return null;
    return [match.position.x, match.position.y, match.position.z];
  };

  // Refresh canonical navigation anchors from current world map when available.
  const spawnPos = findCandidate(["spawn", "start", "home", "origin"]);
  if (spawnPos) setKnownLocationPosition("spawn", spawnPos);

  // For forest/fishing/mine, prefer manifest resources over town/POI name matches
  const firstResourcePos = (
    types: string[],
  ): [number, number, number] | null => {
    const resources = worldMap.resources ?? [];
    const match = resources.find((r) =>
      types.some((t) => r.type.includes(t) || r.resourceId.includes(t)),
    );
    if (!match) return null;
    return [match.position.x, match.position.y, match.position.z];
  };

  const forestPos =
    firstResourcePos(["tree"]) ??
    findCandidate(["forest", "wood", "tree", "grove"]);
  if (forestPos) setKnownLocationPosition("forest", forestPos);

  const fishingPos =
    firstResourcePos(["fishing"]) ??
    findCandidate(["fishing", "dock", "wharf", "river", "lake"]);
  if (fishingPos) setKnownLocationPosition("fishing", fishingPos);

  const minePos =
    firstResourcePos(["mine", "rock"]) ??
    findCandidate(["mine", "mining", "ore", "quarry"]);
  if (minePos) setKnownLocationPosition("mine", minePos);

  // For stations, prefer manifest station positions
  const firstStationPos = (
    types: string[],
  ): [number, number, number] | null => {
    const stations = worldMap.stations ?? [];
    const match = stations.find((s) => types.some((t) => s.type.includes(t)));
    if (!match) return null;
    return [match.position.x, match.position.y, match.position.z];
  };

  const furnacePos =
    firstStationPos(["furnace"]) ?? findCandidate(["furnace", "smelt"]);
  if (furnacePos) setKnownLocationPosition("furnace", furnacePos);

  const anvilPos =
    firstStationPos(["anvil"]) ?? findCandidate(["anvil", "smith"]);
  if (anvilPos) setKnownLocationPosition("anvil", anvilPos);

  // Add towns
  for (const town of worldMap.towns) {
    const key = town.name.toLowerCase().replace(/\s+/g, "_");
    if (!KNOWN_LOCATIONS[key]) {
      const buildingTypes = town.buildings.map((b) => b.type);
      const entities: string[] = [];
      if (buildingTypes.includes("bank")) entities.push("banker");
      if (buildingTypes.includes("store")) entities.push("shopkeeper");
      if (buildingTypes.includes("inn")) entities.push("innkeeper");
      if (buildingTypes.includes("smithy")) entities.push("blacksmith");

      KNOWN_LOCATIONS[key] = {
        position: [town.position.x, town.position.y, town.position.z],
        description: `${town.name} (${town.size} ${town.biome} town) - has: ${buildingTypes.join(", ") || "houses"}`,
        entities: entities.length > 0 ? entities : undefined,
      };
    }
  }

  // Add POIs
  for (const poi of worldMap.pois) {
    const key = poi.name.toLowerCase().replace(/\s+/g, "_");
    if (!KNOWN_LOCATIONS[key]) {
      KNOWN_LOCATIONS[key] = {
        position: [poi.position.x, poi.position.y, poi.position.z],
        description: `${poi.name} (${poi.category}) in ${poi.biome}`,
      };
    }
  }

  // Add stations as known locations (bank, furnace, anvil, range, altar)
  for (const station of worldMap.stations ?? []) {
    const key = `${station.type}_${station.areaId}`;
    if (!KNOWN_LOCATIONS[key]) {
      KNOWN_LOCATIONS[key] = {
        position: [station.position.x, station.position.y, station.position.z],
        description: `${station.type} station in ${station.areaId.replace(/_/g, " ")}`,
        entities: [station.type],
      };
    }
  }

  // Add NPC locations
  for (const npc of worldMap.npcs ?? []) {
    const key = npc.id;
    if (!KNOWN_LOCATIONS[key]) {
      KNOWN_LOCATIONS[key] = {
        position: [npc.position.x, npc.position.y, npc.position.z],
        description: `${npc.name ?? npc.type} (${npc.type}) in ${npc.areaId.replace(/_/g, " ")}`,
        entities: [npc.type],
      };
    }
  }

  // Add resource clusters as known locations (group by type per area)
  const resourcesByArea = new Map<
    string,
    Map<string, { x: number; y: number; z: number }>
  >();
  for (const resource of worldMap.resources ?? []) {
    const areaKey = resource.areaId;
    if (!resourcesByArea.has(areaKey)) {
      resourcesByArea.set(areaKey, new Map());
    }
    const areaResources = resourcesByArea.get(areaKey)!;
    // Store first position per resource type per area
    if (!areaResources.has(resource.type)) {
      areaResources.set(resource.type, resource.position);
    }
  }
  for (const [areaId, types] of resourcesByArea) {
    for (const [type, pos] of types) {
      const key = `${type}_${areaId}`;
      if (!KNOWN_LOCATIONS[key]) {
        KNOWN_LOCATIONS[key] = {
          position: [pos.x, pos.y, pos.z],
          description: `${type.replace(/_/g, " ")} resources in ${areaId.replace(/_/g, " ")}`,
          entities: [type],
        };
      }
    }
  }
}

/**
 * Learn dynamic location anchors from currently visible entities.
 * This keeps navigation tied to live world state rather than fixed coordinates.
 */
export function updateKnownLocationsFromNearbyEntities(
  service: HyperscapeService,
): void {
  const nearbyEntities = service.getNearbyEntities();
  const playerPos = getPositionXZ(service.getPlayerEntity()?.position);
  if (nearbyEntities.length === 0) return;

  const nearestMatch = (
    predicate: (entity: Entity) => boolean,
  ): [number, number, number] | null => {
    let best: [number, number, number] | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const entity of nearbyEntities) {
      if (!predicate(entity)) continue;
      const pos = getEntityPosition(entity);
      if (!pos) continue;
      if (!playerPos) return pos;
      const dx = pos[0] - playerPos.x;
      const dz = pos[2] - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = pos;
      }
    }
    return best;
  };

  const spawnCandidate = nearestMatch((entity) => {
    const name = entity.name?.toLowerCase() || "";
    return (
      name.includes("starter chest") ||
      name.includes("goblin") ||
      entity.mobType === "goblin"
    );
  });
  if (spawnCandidate) setKnownLocationPosition("spawn", spawnCandidate);

  const forestCandidate = nearestMatch((entity) => {
    const name = entity.name?.toLowerCase() || "";
    const resourceType = entity.resourceType?.toLowerCase() || "";
    return resourceType === "tree" || name.includes("tree");
  });
  if (forestCandidate) setKnownLocationPosition("forest", forestCandidate);

  const fishingCandidate = nearestMatch((entity) => {
    const name = entity.name?.toLowerCase() || "";
    const resourceType = entity.resourceType?.toLowerCase() || "";
    return resourceType === "fishing_spot" || name.includes("fishing spot");
  });
  if (fishingCandidate) setKnownLocationPosition("fishing", fishingCandidate);

  const mineCandidate = nearestMatch((entity) => {
    const name = entity.name?.toLowerCase() || "";
    const resourceType = entity.resourceType?.toLowerCase() || "";
    return (
      resourceType === "mining_rock" ||
      resourceType === "ore" ||
      name.includes("rock") ||
      name.includes("ore")
    );
  });
  if (mineCandidate) setKnownLocationPosition("mine", mineCandidate);

  const furnaceCandidate = nearestMatch((entity) =>
    (entity.name?.toLowerCase() || "").includes("furnace"),
  );
  if (furnaceCandidate) setKnownLocationPosition("furnace", furnaceCandidate);

  const anvilCandidate = nearestMatch((entity) =>
    (entity.name?.toLowerCase() || "").includes("anvil"),
  );
  if (anvilCandidate) setKnownLocationPosition("anvil", anvilCandidate);
}

/**
 * Goal option that can be selected by the LLM
 */
export interface GoalOption {
  id: string;
  type:
    | "combat_training"
    | "woodcutting"
    | "mining"
    | "smithing"
    | "fishing"
    | "firemaking"
    | "cooking"
    | "exploration"
    | "idle"
    | "questing"
    | "banking";
  description: string;
  targetSkill?: string;
  targetSkillLevel?: number;
  targetEntity?: string;
  location?: string;
  priority: number; // Higher = more recommended
  reason: string; // Why this goal is available/recommended
  warning?: string; // Optional warning for low readiness
}

/**
 * Combat readiness assessment
 */
export interface CombatReadiness {
  score: number; // 0-100
  factors: string[]; // Reasons for deductions
  ready: boolean; // score >= 50
}

/**
 * Assess combat readiness based on equipment, food, and health
 * Returns a score (0-100) with detailed factors
 */
export function getCombatReadiness(
  service: HyperscapeService,
): CombatReadiness {
  const player = service.getPlayerEntity();
  const factors: string[] = [];
  let score = 100;

  if (!player) {
    return { score: 0, factors: ["No player data"], ready: false };
  }

  // Check health (deduct up to 30 points for low health)
  const healthPercent = player?.health
    ? (player.health.current / player.health.max) * 100
    : 100;

  if (healthPercent < 30) {
    score -= 30;
    factors.push(`Low health (${healthPercent.toFixed(0)}%)`);
  } else if (healthPercent < 50) {
    score -= 15;
    factors.push(`Health below 50% (${healthPercent.toFixed(0)}%)`);
  }

  // Check for weapon (deduct points based on combat capability)
  // In OSRS, hatchets and pickaxes can be equipped and used as melee weapons
  const hasWeaponEquipped = detectHasWeapon(player);
  const hasCombatItem = hasCombatCapableItem(player);

  if (!hasWeaponEquipped) {
    if (hasCombatItem) {
      // Has combat-capable item but not equipped - small penalty
      score -= 10;
      factors.push("Weapon not equipped (have axe/pickaxe that can be used)");
    } else {
      // No combat-capable item at all - full penalty
      score -= 25;
      factors.push("No weapon available");
    }
  }

  // Check for food in inventory (deduct 20 points if no food)
  // Use centralized item detection utility
  const hasFood = detectHasFood(player);

  if (!hasFood) {
    score -= 20;
    factors.push("No food in inventory");
  }

  return {
    score: Math.max(0, score),
    factors,
    ready: score >= 50,
  };
}

/**
 * Generate available goal options based on current state
 */
export function getAvailableGoals(service: HyperscapeService): GoalOption[] {
  const goals: GoalOption[] = [];
  const player = service.getPlayerEntity();
  updateKnownLocationsFromNearbyEntities(service);

  // Get current skill levels
  const skills = player?.skills as
    | Record<string, { level: number; xp: number }>
    | undefined;
  const attackLevel = skills?.attack?.level ?? 1;
  const strengthLevel = skills?.strength?.level ?? 1;
  const defenseLevel = skills?.defence?.level ?? 1;
  const woodcuttingLevel = skills?.woodcutting?.level ?? 1;
  const fishingLevel = skills?.fishing?.level ?? 1;
  const miningLevel = skills?.mining?.level ?? 1;

  // Get health status
  const healthPercent = player?.health
    ? (player.health.current / player.health.max) * 100
    : 100;

  // Get nearby entities
  const nearbyEntities = service.getNearbyEntities();
  const hasGoblins = nearbyEntities.some((e) =>
    e.name?.toLowerCase().includes("goblin"),
  );
  const hasTrees = nearbyEntities.some((e) => {
    const resourceType = e.resourceType?.toLowerCase() || "";
    const name = e.name?.toLowerCase() || "";
    return resourceType === "tree" || name.includes("tree");
  });
  const hasFishingSpots = nearbyEntities.some((e) => {
    const resourceType = e.resourceType?.toLowerCase() || "";
    const name = e.name?.toLowerCase() || "";
    return resourceType === "fishing_spot" || name.includes("fishing spot");
  });
  const hasMiningRocks = nearbyEntities.some((e) => {
    const resourceType = e.resourceType?.toLowerCase() || "";
    const name = e.name?.toLowerCase() || "";
    return (
      resourceType === "mining_rock" ||
      resourceType === "ore" ||
      name.includes("rock") ||
      name.includes("ore")
    );
  });
  // Check if player has basic tools using centralized item detection
  const hasAxe = detectHasAxe(player);
  const hasPickaxe = detectHasPickaxe(player);
  const hasFishingGear = detectHasFishingEquipment(player);

  // Duel preparation: check food status for priority boosting
  const hasFood = detectHasFood(player);
  const foodCount = detectCountFood(player);
  // Boost food-producing skills when inventory is low on food
  const needsFood = !hasFood || foodCount < 5;
  const foodPriorityBoost = needsFood ? 25 : 0;

  // Quest-based tool acquisition — highest priority when player has no basic tools
  if (!hasAxe || !hasPickaxe || !hasFishingGear) {
    const missingTools: string[] = [];
    if (!hasAxe)
      missingTools.push(
        "axe (accept Lumberjack's First Lesson from Forester Wilma)",
      );
    if (!hasPickaxe)
      missingTools.push("pickaxe (accept Torvin's Tools from Torvin)");
    if (!hasFishingGear)
      missingTools.push("fishing net (accept Fresh Catch from Fisherman Pete)");

    goals.push({
      id: "get_tools_via_quests",
      type: "questing",
      description: "Talk to NPCs and accept quests to get starter tools",
      location: "spawn",
      priority: 100, // Highest priority - need tools to do anything!
      reason: `You are MISSING essential tools: ${missingTools.join("; ")}. Accept quests from nearby NPCs to receive these tools immediately.`,
    });
  }

  // Banking goal — when inventory is nearly full
  const inventoryItems = Array.isArray(player?.items) ? player.items : [];
  if (inventoryItems.length >= 25) {
    goals.push({
      id: "bank_items",
      type: "banking",
      description:
        "Go to bank and deposit non-essential items to free inventory space",
      location: "spawn",
      priority: 90, // Very high — can't gather/loot with full inventory
      reason: `Inventory is ${inventoryItems.length}/28 — almost full! Bank your gathered items to make room for more.`,
    });
  }

  // Combat training goals - check readiness before recommending
  const combatReadiness = getCombatReadiness(service);
  const readinessMultiplier = combatReadiness.ready
    ? combatReadiness.score / 100
    : 0.3; // Heavily penalize if not ready

  // Only add combat goals if health allows (30%+ threshold)
  if (healthPercent >= 30) {
    // Build warning message for low readiness
    const combatWarning = !combatReadiness.ready
      ? `⚠️ NOT RECOMMENDED: ${combatReadiness.factors.join(", ")}`
      : combatReadiness.factors.length > 0
        ? `Note: ${combatReadiness.factors.join(", ")}`
        : undefined;

    // Attack training
    const attackPriority = Math.round(
      (hasGoblins ? 80 : 60) * readinessMultiplier,
    );
    goals.push({
      id: "train_attack",
      type: "combat_training",
      description: `Train attack from ${attackLevel} to ${attackLevel + 2} by killing goblins`,
      targetSkill: "attack",
      targetSkillLevel: attackLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: attackPriority,
      reason: hasGoblins
        ? `Goblins nearby - great for attack training! (Readiness: ${combatReadiness.score}%)`
        : `Goblins at spawn area for attack training (Readiness: ${combatReadiness.score}%)`,
      warning: combatWarning,
    });

    // Strength training
    const strengthPriority = Math.round(
      (hasGoblins ? 75 : 55) * readinessMultiplier,
    );
    goals.push({
      id: "train_strength",
      type: "combat_training",
      description: `Train strength from ${strengthLevel} to ${strengthLevel + 2} by killing goblins`,
      targetSkill: "strength",
      targetSkillLevel: strengthLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: strengthPriority,
      reason: hasGoblins
        ? `Goblins nearby - good for strength training (Readiness: ${combatReadiness.score}%)`
        : `Train strength on goblins at spawn (Readiness: ${combatReadiness.score}%)`,
      warning: combatWarning,
    });

    // Defense training
    const defencePriority = Math.round(
      (hasGoblins ? 70 : 50) * readinessMultiplier,
    );
    goals.push({
      id: "train_defence",
      type: "combat_training",
      description: `Train defence from ${defenseLevel} to ${defenseLevel + 2} by killing goblins`,
      targetSkill: "defence",
      targetSkillLevel: defenseLevel + 2,
      targetEntity: "goblin",
      location: "spawn",
      priority: defencePriority,
      reason: `Train defence by taking hits from goblins (Readiness: ${combatReadiness.score}%)`,
      warning: combatWarning,
    });
  }

  // Woodcutting goal
  goals.push({
    id: "train_woodcutting",
    type: "woodcutting",
    description: `Train woodcutting from ${woodcuttingLevel} to ${woodcuttingLevel + 2} by chopping trees in the forest`,
    targetSkill: "woodcutting",
    targetSkillLevel: woodcuttingLevel + 2,
    targetEntity: "tree",
    location: "forest",
    priority: hasTrees ? 65 : 40,
    reason: hasTrees
      ? "Trees nearby - safe way to train"
      : "Head to the western forest for woodcutting",
  });

  // Fishing goal — boosted when agent needs food for duel preparation
  goals.push({
    id: "train_fishing",
    type: "fishing",
    description: `Train fishing from ${fishingLevel} to ${fishingLevel + 2} by catching fish${needsFood ? " (PRIORITY: need food for duels!)" : ""}`,
    targetSkill: "fishing",
    targetSkillLevel: fishingLevel + 2,
    targetEntity: "fishing_spot",
    location: "fishing",
    priority: (hasFishingSpots ? 60 : 35) + foodPriorityBoost,
    reason: needsFood
      ? `Need food for duels! Only ${foodCount} food items in inventory. Fish provide food AND fishing XP.`
      : hasFishingSpots
        ? "Fishing spots nearby - steady XP gains"
        : "Look for fishing spots near water",
  });

  // Mining goal
  goals.push({
    id: "train_mining",
    type: "mining",
    description: `Train mining from ${miningLevel} to ${miningLevel + 2} by mining rocks`,
    targetSkill: "mining",
    targetSkillLevel: miningLevel + 2,
    targetEntity: "mining_rock",
    location: "mine",
    priority: hasMiningRocks ? 60 : 35,
    reason: hasMiningRocks
      ? "Mining rocks nearby - good for mining practice"
      : "Search for rocks to mine",
  });

  // Exploration goal (good when health is low)
  goals.push({
    id: "explore",
    type: "exploration",
    description: "Explore the world and discover new areas",
    location: "spawn",
    priority: healthPercent < 50 ? 90 : 30, // High priority when hurt
    reason:
      healthPercent < 50
        ? "Health is low - explore safely while recovering"
        : "Discover new areas and resources",
  });

  // Idle/rest goal (when health is very low)
  if (healthPercent < 30) {
    goals.push({
      id: "rest",
      type: "idle",
      description: "Rest and recover health before continuing",
      priority: 95,
      reason: "Health critically low - rest to recover",
    });
  }

  // Sort by priority (highest first)
  return goals.sort((a, b) => b.priority - a.priority);
}

export const goalProvider: Provider = {
  name: "currentGoal",
  description:
    "Provides current agent goal, progress, and available goal options",
  dynamic: true,
  position: 0, // Run first

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const behaviorManager = service?.getBehaviorManager();
    const goal = behaviorManager?.getGoal();

    // Build duel history context for strategy awareness
    const duelHistory = behaviorManager?.getDuelHistory() ?? [];
    let duelContextText = "";
    if (duelHistory.length > 0) {
      const wins = duelHistory.filter((d) => d.won).length;
      const losses = duelHistory.length - wins;
      const recentDuels = duelHistory
        .slice(-3)
        .map((d) => {
          const result = d.won ? "Won" : "Lost";
          return `- ${result} vs ${d.opponentName} (${d.myHealth}hp remaining)`;
        })
        .join("\n");

      // Generate strategy suggestion based on patterns
      const avgEndHealth =
        duelHistory.reduce((sum, d) => sum + d.myHealth, 0) /
        duelHistory.length;
      let suggestion = "";
      if (losses > wins) {
        suggestion =
          "Focus on gathering food (fishing/cooking) and training combat skills to improve.";
      } else if (avgEndHealth < 10) {
        suggestion =
          "Fights are very close. Stockpile more food to have a cushion.";
      } else {
        suggestion = "Good win rate! Keep training to maintain your edge.";
      }

      duelContextText = `\n\n## Recent Duel Performance
**Record**: ${wins}W / ${losses}L
${recentDuels}
**Strategy**: ${suggestion}`;
    }

    // Get available goals based on current state
    const availableGoals = service ? getAvailableGoals(service) : [];
    const goalsText = availableGoals
      .slice(0, 5) // Show top 5 options
      .map((g, i) => {
        let text = `${i + 1}. **${g.id}** (priority ${g.priority}): ${g.description}\n   _${g.reason}_`;
        if (g.warning) {
          text += `\n   **${g.warning}**`;
        }
        return text;
      })
      .join("\n");

    if (!goal) {
      return {
        text: `## Goal Status
**No active goal** - You need to choose a goal!

## Available Goals (choose one):
${goalsText}
${duelContextText}
Use SET_GOAL to select one of these objectives based on your situation.`,
        values: {
          hasGoal: false,
          availableGoalCount: availableGoals.length,
          topGoalId: availableGoals[0]?.id || null,
        },
        data: {
          currentGoal: null,
          availableGoals,
        },
      };
    }

    const progressPercent =
      goal.target > 0 ? Math.round((goal.progress / goal.target) * 100) : 0;

    return {
      text: `## Current Goal
**Type**: ${goal.type}
**Objective**: ${goal.description}
**Progress**: ${goal.progress}/${goal.target} (${progressPercent}%)
**Location**: ${goal.location || "anywhere"}
**Target**: ${goal.targetEntity || "any"}
${goal.targetSkill ? `**Training**: ${goal.targetSkill} to level ${goal.targetSkillLevel}` : ""}${duelContextText}`,
      values: {
        hasGoal: true,
        goalType: goal.type,
        goalProgress: goal.progress,
        goalTarget: goal.target,
        goalProgressPercent: progressPercent,
        goalLocation: goal.location,
        goalTargetEntity: goal.targetEntity,
        goalTargetSkill: goal.targetSkill,
        goalTargetSkillLevel: goal.targetSkillLevel,
      },
      data: {
        currentGoal: goal,
        availableGoals, // Still include for reference
      },
    };
  },
};
