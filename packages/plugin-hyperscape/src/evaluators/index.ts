/**
 * ElizaOS Evaluators for Hyperscape
 *
 * Evaluators run on each decision cycle and add facts/assessments to state.
 * They help the LLM understand the current situation before choosing actions.
 *
 * Architecture:
 * - Each evaluator has validate() to check if it should run
 * - handler() adds facts and recommendations to state
 * - Facts are included in the LLM prompt for action selection
 */

import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

/**
 * Helper to calculate distance between two positions
 */
function calculateDistance(
  pos1: [number, number, number],
  pos2: [number, number, number],
): number {
  const dx = pos1[0] - pos2[0];
  const dz = pos1[2] - pos2[2];
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Survival Evaluator - Assesses health, threats, and survival needs
 *
 * This evaluator runs FIRST to check if the agent needs to take
 * immediate survival actions (flee, heal, etc.)
 */
export const survivalEvaluator: Evaluator = {
  name: "SURVIVAL_EVALUATOR",
  description: "Assesses health status and immediate survival needs",
  alwaysRun: true,

  examples: [
    {
      prompt: "Agent has low health and enemies nearby",
      messages: [
        { name: "system", content: { text: "Health: 15/100, Goblin nearby" } },
      ],
      outcome: "Agent should flee or heal immediately",
    },
  ],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    return !!service?.isConnected() && !!service.getPlayerEntity();
  },

  handler: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    // Defensive health calculation - handle missing/malformed health data
    const currentHealth =
      player.health?.current ??
      (player as unknown as { hp?: number }).hp ??
      100;
    const maxHealth =
      player.health?.max ??
      (player as unknown as { maxHp?: number }).maxHp ??
      100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;

    const nearbyEntities = service.getNearbyEntities();

    // Check for nearby threats (hostile mobs)
    const threats = nearbyEntities.filter((entity) => {
      if (!("mobType" in entity)) return false;
      const dist = calculateDistance(
        player.position,
        entity.position as [number, number, number],
      );
      return dist < 15; // Within threat range
    });

    // Build survival assessment
    const facts: string[] = [];
    let urgency: "critical" | "warning" | "safe" = "safe";

    if (healthPercent < 20) {
      facts.push(`CRITICAL: Health is very low (${healthPercent.toFixed(0)}%)`);
      urgency = "critical";
    } else if (healthPercent < 50) {
      facts.push(
        `WARNING: Health is below half (${healthPercent.toFixed(0)}%)`,
      );
      urgency = "warning";
    }

    if (player.inCombat) {
      facts.push(
        `IN COMBAT: Currently fighting ${player.combatTarget || "unknown"}`,
      );
      if (healthPercent < 30) urgency = "critical";
    }

    if (threats.length > 0) {
      facts.push(
        `THREATS NEARBY: ${threats.length} hostile entity/entities within attack range`,
      );
      threats.forEach((t) => {
        const dist = calculateDistance(
          player.position,
          t.position as [number, number, number],
        );
        facts.push(`  - ${t.name} at ${dist.toFixed(0)} units away`);
      });
    }

    // Check alive status - only treat as dead if explicitly false
    // undefined or missing alive property means alive
    const isAlive = player.alive !== false;
    if (!isAlive) {
      facts.push("DEAD: Player is dead and needs to respawn");
      urgency = "critical";
    }

    // Add recommendations based on urgency
    const recommendations: string[] = [];
    if (urgency === "critical" && isAlive) {
      if (healthPercent < 20 && threats.length > 0) {
        recommendations.push("FLEE immediately - health is critical");
      } else if (healthPercent < 20) {
        recommendations.push("Find food or safe area to recover");
      }
    }

    // Store assessment in state for action selection
    if (state) {
      state.survivalAssessment = {
        healthPercent,
        urgency,
        inCombat: player.inCombat ?? false,
        threats: threats.map((t) => t.name),
        alive: isAlive,
      };
      state.survivalFacts = facts;
      state.survivalRecommendations = recommendations;
    }

    return {
      success: true,
      text: facts.join("\n"),
      values: { urgency, healthPercent, threatCount: threats.length },
      data: { facts, recommendations },
    };
  },
};

/**
 * Exploration Evaluator - Assesses exploration opportunities
 *
 * Runs when the agent is safe and could explore
 */
export const explorationEvaluator: Evaluator = {
  name: "EXPLORATION_EVALUATOR",
  description: "Identifies exploration opportunities and interesting locations",
  alwaysRun: true,

  examples: [
    {
      prompt: "Agent is idle with no threats nearby",
      messages: [
        {
          name: "system",
          content: { text: "Safe area, no combat, high health" },
        },
      ],
      outcome: "Agent should consider exploring",
    },
  ],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;

    // Only treat as dead if explicitly false
    if (player.alive === false) return false;

    // Only run exploration evaluator when not in immediate danger
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    return healthPercent > 30 && !player.inCombat;
  },

  handler: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    const nearbyEntities = service.getNearbyEntities();
    const facts: string[] = [];

    // Categorize nearby entities
    const players = nearbyEntities.filter(
      (e) => "playerId" in e && e.id !== player.id,
    );
    const mobs = nearbyEntities.filter((e) => "mobType" in e);
    const resources = nearbyEntities.filter((e) => "resourceType" in e);

    // Identify points of interest
    const pointsOfInterest: Array<{
      type: string;
      name: string;
      position: [number, number, number];
      distance: number;
    }> = [];

    // Add resources as POIs
    for (const resource of resources) {
      const dist = calculateDistance(
        player.position,
        resource.position as [number, number, number],
      );
      if (dist < 50) {
        pointsOfInterest.push({
          type: "resource",
          name: resource.name,
          position: resource.position as [number, number, number],
          distance: dist,
        });
      }
    }

    // Add other players as social POIs
    for (const p of players) {
      const dist = calculateDistance(
        player.position,
        p.position as [number, number, number],
      );
      if (dist < 100) {
        pointsOfInterest.push({
          type: "player",
          name: p.name,
          position: p.position as [number, number, number],
          distance: dist,
        });
      }
    }

    // Generate exploration suggestions
    facts.push(
      `Current position: [${player.position[0].toFixed(1)}, ${player.position[2].toFixed(1)}]`,
    );

    if (pointsOfInterest.length > 0) {
      facts.push(`Points of interest nearby:`);
      pointsOfInterest.slice(0, 5).forEach((poi) => {
        facts.push(
          `  - ${poi.type}: ${poi.name} (${poi.distance.toFixed(0)} units away)`,
        );
      });
    } else {
      facts.push(
        "No specific points of interest nearby - open area for exploration",
      );
    }

    // Generate random exploration direction suggestion
    const directions = [
      { name: "north", dx: 0, dz: 25 },
      { name: "south", dx: 0, dz: -25 },
      { name: "east", dx: 25, dz: 0 },
      { name: "west", dx: -25, dz: 0 },
      { name: "northeast", dx: 18, dz: 18 },
      { name: "northwest", dx: -18, dz: 18 },
      { name: "southeast", dx: 18, dz: -18 },
      { name: "southwest", dx: -18, dz: -18 },
    ];
    const suggestion =
      directions[Math.floor(Math.random() * directions.length)];
    const suggestedTarget: [number, number, number] = [
      player.position[0] + suggestion.dx,
      player.position[1],
      player.position[2] + suggestion.dz,
    ];

    facts.push(
      `Exploration suggestion: head ${suggestion.name} towards [${suggestedTarget[0].toFixed(1)}, ${suggestedTarget[2].toFixed(1)}]`,
    );

    // Store in state
    if (state) {
      state.explorationAssessment = {
        currentPosition: player.position,
        pointsOfInterest,
        suggestedDirection: suggestion.name,
        suggestedTarget,
        nearbyPlayerCount: players.length,
        nearbyResourceCount: resources.length,
        nearbyMobCount: mobs.length,
      };
      state.explorationFacts = facts;
    }

    return {
      success: true,
      text: facts.join("\n"),
      values: {
        poiCount: pointsOfInterest.length,
        suggestedDirection: suggestion.name,
      },
      data: { facts, pointsOfInterest, suggestedTarget },
    };
  },
};

/**
 * Social Evaluator - Assesses social interaction opportunities
 */
export const socialEvaluator: Evaluator = {
  name: "SOCIAL_EVALUATOR",
  description: "Identifies other players and social interaction opportunities",
  alwaysRun: false,

  examples: [
    {
      prompt: "Other players are nearby",
      messages: [
        { name: "system", content: { text: "Player 'Bob' is 10 units away" } },
      ],
      outcome: "Agent could greet or interact with Bob",
    },
  ],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;

    // Only treat as dead if explicitly false
    if (player.alive === false) return false;

    // Check if there are other players nearby
    const nearbyEntities = service.getNearbyEntities();
    const nearbyPlayers = nearbyEntities.filter(
      (e) => "playerId" in e && e.id !== player.id,
    );

    return nearbyPlayers.length > 0;
  },

  handler: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    const nearbyEntities = service.getNearbyEntities();
    const nearbyPlayers = nearbyEntities.filter(
      (e) => "playerId" in e && e.id !== player.id,
    );

    const facts: string[] = [];

    if (nearbyPlayers.length > 0) {
      facts.push(`${nearbyPlayers.length} other player(s) nearby:`);
      nearbyPlayers.forEach((p) => {
        const dist = calculateDistance(
          player.position,
          p.position as [number, number, number],
        );
        facts.push(`  - ${p.name} at ${dist.toFixed(0)} units away`);
      });
      facts.push("Consider greeting or interacting with nearby players");
    }

    if (state) {
      state.socialAssessment = {
        nearbyPlayers: nearbyPlayers.map((p) => ({
          name: p.name,
          id: p.id,
          distance: calculateDistance(
            player.position,
            p.position as [number, number, number],
          ),
        })),
      };
      state.socialFacts = facts;
    }

    return {
      success: true,
      text: facts.join("\n"),
      values: { nearbyPlayerCount: nearbyPlayers.length },
      data: { facts },
    };
  },
};

/**
 * Combat Evaluator - Assesses combat opportunities and threats
 */
export const combatEvaluator: Evaluator = {
  name: "COMBAT_EVALUATOR",
  description: "Identifies combat opportunities and assesses combat situations",
  alwaysRun: true,

  examples: [
    {
      prompt: "Weak mobs nearby that agent could fight",
      messages: [
        {
          name: "system",
          content: { text: "Level 2 Goblin nearby, agent is level 10" },
        },
      ],
      outcome: "Agent could engage the goblin for combat training",
    },
  ],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    // Only treat as dead if explicitly false
    return !!player && player.alive !== false;
  },

  handler: async (runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    const nearbyEntities = service.getNearbyEntities();
    const mobs = nearbyEntities.filter((e) => "mobType" in e);

    const facts: string[] = [];

    // Current combat status
    if (player.inCombat) {
      facts.push(
        `Currently in combat with: ${player.combatTarget || "unknown"}`,
      );
      facts.push(`Combat style: ${player.combatStyle || "melee"}`);
    }

    // Nearby mobs
    const mobsWithDistance = mobs.map((mob) => ({
      ...mob,
      distance: calculateDistance(
        player.position,
        mob.position as [number, number, number],
      ),
    }));

    const nearbyMobs = mobsWithDistance.filter((m) => m.distance < 30);
    if (nearbyMobs.length > 0) {
      facts.push(`Potential combat targets nearby:`);
      nearbyMobs.forEach((mob) => {
        const mobEntity = mob as unknown as {
          name: string;
          level?: number;
          alive?: boolean;
        };
        const level = mobEntity.level ? ` (Level ${mobEntity.level})` : "";
        const status = mobEntity.alive === false ? " [DEAD]" : "";
        facts.push(
          `  - ${mob.name}${level}${status} at ${mob.distance.toFixed(0)} units`,
        );
      });
    }

    // Combat recommendations based on health - defensive calculation
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    const recommendations: string[] = [];

    if (player.inCombat && healthPercent < 30) {
      recommendations.push("Consider fleeing - health is low");
    } else if (
      !player.inCombat &&
      healthPercent > 70 &&
      nearbyMobs.length > 0
    ) {
      const aliveMobs = nearbyMobs.filter(
        (m) => (m as unknown as { alive?: boolean }).alive !== false,
      );
      if (aliveMobs.length > 0) {
        recommendations.push("Could engage nearby mobs for combat training");
      }
    }

    if (state) {
      state.combatAssessment = {
        inCombat: player.inCombat,
        combatTarget: player.combatTarget,
        combatStyle: player.combatStyle,
        nearbyMobs: nearbyMobs.map((m) => ({
          name: m.name,
          id: m.id,
          distance: m.distance,
        })),
        healthPercent,
      };
      state.combatFacts = facts;
      state.combatRecommendations = recommendations;
    }

    return {
      success: true,
      text: facts.join("\n"),
      values: { inCombat: player.inCombat, nearbyMobCount: nearbyMobs.length },
      data: { facts, recommendations },
    };
  },
};

// Export all evaluators
export const evaluators = [
  survivalEvaluator,
  explorationEvaluator,
  socialEvaluator,
  combatEvaluator,
];
