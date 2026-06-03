/**
 * ElizaOS Evaluators for Hyperia
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
import type { HyperiaService } from "../services/HyperiaService.js";

/**
 * Helper to calculate distance between two positions
 */
export function calculateDistance(
  pos1: [number, number, number],
  pos2: [number, number, number],
): number {
  const dx = pos1[0] - pos2[0];
  const dz = pos1[2] - pos2[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function getEntityPositionArray(entity: {
  position?: unknown;
}): [number, number, number] | null {
  const pos = entity.position;
  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }
  if (pos && typeof pos === "object" && "x" in pos && "z" in pos) {
    const p = pos as { x: number; y?: number; z: number };
    return [p.x, p.y ?? 0, p.z];
  }
  return null;
}

export function isMobLikeEntity(entity: {
  mobType?: unknown;
  type?: unknown;
  entityType?: unknown;
  name?: unknown;
}): boolean {
  if (entity.mobType) return true;
  if (entity.type === "mob" || entity.entityType === "mob") return true;
  const name = String(entity.name || "").toLowerCase();
  return /goblin|bandit|skeleton|zombie|rat|spider|wolf|cow|chicken|imp/.test(
    name,
  );
}

// ---------------------------------------------------------------------------
// Pure survival assessment — used by both evaluators and short-circuit
// ---------------------------------------------------------------------------

export interface SurvivalSnapshot {
  healthPercent: number;
  urgency: "critical" | "warning" | "safe";
  threatCount: number;
}

/**
 * Lightweight survival assessment for use in the short-circuit path.
 * Pure function: no side effects, no service calls.
 */
export function assessSurvival(
  player: {
    health?: { current?: number; max?: number };
    inCombat?: boolean;
    alive?: boolean;
    position: [number, number, number];
  },
  nearbyEntities: Array<{
    position?: unknown;
    mobType?: unknown;
    type?: unknown;
    entityType?: unknown;
    name?: unknown;
  }>,
): SurvivalSnapshot {
  const current = player.health?.current ?? 100;
  const max = player.health?.max ?? 100;
  const healthPercent = max > 0 ? (current / max) * 100 : 100;

  // Count threats within 15 units
  let threatCount = 0;
  for (const entity of nearbyEntities) {
    if (!isMobLikeEntity(entity)) continue;
    const entityPos = getEntityPositionArray(entity);
    if (!entityPos) continue;
    if (calculateDistance(player.position, entityPos) < 15) {
      threatCount++;
    }
  }

  let urgency: "critical" | "warning" | "safe" = "safe";
  if (player.alive === false || healthPercent < 30) {
    urgency = "critical";
  } else if (healthPercent < 50) {
    urgency = "warning";
  }

  return { healthPercent, urgency, threatCount };
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

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    return !!service?.isConnected() && !!service.getPlayerEntity();
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return { success: true, text: "Waiting for position data" };
    }

    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;

    const nearbyEntities = service.getNearbyEntities();

    const threats = nearbyEntities.filter((entity) => {
      if (!isMobLikeEntity(entity)) return false;
      const entityPos = getEntityPositionArray(entity);
      if (!entityPos) return false;
      const dist = calculateDistance(player.position, entityPos);
      return dist < 15;
    });

    const facts: string[] = [];
    let urgency: "critical" | "warning" | "safe" = "safe";

    if (healthPercent < 30) {
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
        const threatPos = getEntityPositionArray(t);
        if (!threatPos) return;
        const dist = calculateDistance(player.position, threatPos);
        facts.push(`  - ${t.name} at ${dist.toFixed(0)} units away`);
      });
    }

    const isAlive = player.alive !== false;
    if (!isAlive) {
      facts.push("DEAD: Player is dead and needs to respawn");
      urgency = "critical";
    }

    const recommendations: string[] = [];
    if (urgency === "critical" && isAlive) {
      if (healthPercent < 30 && threats.length > 0) {
        recommendations.push("FLEE immediately - health is critical");
      } else if (healthPercent < 30) {
        recommendations.push("Find food or safe area to recover");
      }
    }

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

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;

    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return false;
    }

    if (player.alive === false) return false;

    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    return healthPercent > 30 && !player.inCombat;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return { success: true, text: "Waiting for position data" };
    }

    const nearbyEntities = service.getNearbyEntities();
    const facts: string[] = [];

    const players = nearbyEntities.filter(
      (e) => !!e.playerId && e.id !== player.id,
    );
    const mobs = nearbyEntities.filter((e) => !!e.mobType);
    const resources = nearbyEntities.filter((e) => !!e.resourceType);

    const pointsOfInterest: Array<{
      type: string;
      name: string;
      position: [number, number, number];
      distance: number;
    }> = [];

    for (const resource of resources) {
      if (
        !resource.position ||
        !Array.isArray(resource.position) ||
        resource.position.length < 3
      )
        continue;
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

    for (const p of players) {
      if (!p.position || !Array.isArray(p.position) || p.position.length < 3)
        continue;
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
 *
 * Always runs to detect social triggers like new players entering range,
 * players in distress, or long periods without social interaction.
 */
export const socialEvaluator: Evaluator = {
  name: "SOCIAL_EVALUATOR",
  description:
    "Identifies social opportunities: new players, greetings, help offers, conversation triggers",
  alwaysRun: true,

  examples: [
    {
      prompt: "Other players are nearby",
      messages: [
        { name: "system", content: { text: "Player 'Bob' is 10 units away" } },
      ],
      outcome: "Agent could greet or interact with Bob",
    },
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player) return false;
    if (player.alive === false) return false;

    return true;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return { success: true, text: "Waiting for position data" };
    }

    const nearbyEntities = service.getNearbyEntities();
    const nearbyPlayers = nearbyEntities.filter(
      (e) =>
        !!e.playerId &&
        e.id !== player.id &&
        e.position &&
        Array.isArray(e.position) &&
        e.position.length >= 3,
    );

    const facts: string[] = [];
    const recommendations: string[] = [];

    if (nearbyPlayers.length > 0) {
      facts.push(`${nearbyPlayers.length} other player(s) nearby:`);
      nearbyPlayers.forEach((p) => {
        const dist = calculateDistance(
          player.position,
          p.position as [number, number, number],
        );
        facts.push(`  - ${p.name} at ${dist.toFixed(0)} units away`);

        if (
          p.health &&
          p.health.max > 0 &&
          p.health.current / p.health.max < 0.4
        ) {
          facts.push(`    ** ${p.name} has LOW HEALTH - might need help! **`);
          recommendations.push(`OFFER_HELP to ${p.name} (low health)`);
        }
      });

      recommendations.push("GREET_PLAYER - say hello to nearby players");
      recommendations.push("SHARE_OPINION - comment on what you're doing");
    } else {
      facts.push("No other players nearby right now.");
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
      state.socialRecommendations = recommendations;
    }

    return {
      success: true,
      text: facts.join("\n"),
      values: { nearbyPlayerCount: nearbyPlayers.length },
      data: { facts, recommendations },
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

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    return !!player && player.alive !== false;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service) return { success: true };

    const player = service.getPlayerEntity();
    if (!player) return { success: true };

    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return { success: true, text: "Waiting for position data" };
    }

    const nearbyEntities = service.getNearbyEntities();
    const mobs = nearbyEntities.filter((e) => {
      if (!isMobLikeEntity(e)) return false;
      return !!getEntityPositionArray(e);
    });

    const facts: string[] = [];

    if (player.inCombat) {
      facts.push(
        `Currently in combat with: ${player.combatTarget || "unknown"}`,
      );
      facts.push(`Combat style: ${player.combatStyle || "melee"}`);
    }

    const mobsWithDistance = mobs.map((mob) => ({
      ...mob,
      distance: calculateDistance(
        player.position,
        getEntityPositionArray(mob) as [number, number, number],
      ),
    }));

    const nearbyMobs = mobsWithDistance.filter((m) => m.distance < 30);
    if (nearbyMobs.length > 0) {
      facts.push(`Potential combat targets nearby:`);
      nearbyMobs.forEach((mob) => {
        const level = mob.level ? ` (Level ${mob.level})` : "";
        const status = mob.alive === false ? " [DEAD]" : "";
        facts.push(
          `  - ${mob.name}${level}${status} at ${mob.distance.toFixed(0)} units`,
        );
      });
    }

    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 100;
    const recommendations: string[] = [];

    if (player.inCombat && healthPercent < 30) {
      recommendations.push("FLEE - health is critically low!");
    } else if (
      !player.inCombat &&
      healthPercent > 50 &&
      nearbyMobs.length > 0
    ) {
      const aliveMobs = nearbyMobs.filter((m) => m.alive !== false);
      if (aliveMobs.length > 0) {
        const nearest = aliveMobs[0];
        recommendations.push(
          `ATTACK_ENTITY recommended - ${nearest.name} is nearby and you have ${healthPercent.toFixed(0)}% health`,
        );
        facts.push(
          `** COMBAT OPPORTUNITY: Use ATTACK_ENTITY to fight ${nearest.name} **`,
        );
      }
    } else if (
      !player.inCombat &&
      healthPercent <= 50 &&
      nearbyMobs.length > 0
    ) {
      recommendations.push("Avoid combat - health is below 50%");
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
