/**
 * ExplorationManager - Autonomous exploration behavior for AI agents
 *
 * This manager runs a tick loop that periodically moves the agent to
 * new locations, enabling autonomous exploration without human input.
 *
 * Architecture:
 * - Ticks every N seconds (configurable)
 * - Checks if agent is connected, alive, and safe to move
 * - Uses LLM to decide where to explore based on context
 * - Executes movement via HyperscapeService
 *
 * This is the foundation for more complex autonomous behaviors
 * (combat, gathering, social) that will be added later.
 */

import { logger, ModelType, type IAgentRuntime } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

// Configuration defaults
const DEFAULT_TICK_INTERVAL = 12000; // 12 seconds between movements (LLM calls take time)
const DEFAULT_EXPLORATION_RADIUS = 30; // Max distance from current position
const MIN_EXPLORATION_DISTANCE = 8; // Minimum distance to move

// Exploration prompt template
const EXPLORATION_PROMPT = `You are an AI agent exploring a 3D game world. You need to decide where to walk next.

CURRENT POSITION: X={{currentX}}, Z={{currentZ}}
EXPLORATION SEED: {{randomSeed}}

NEARBY ENTITIES:
{{nearbyEntities}}

Your character name: {{agentName}}
Your bio: {{agentBio}}

Choose a NEW destination to walk to. IMPORTANT: Pick a DIFFERENT direction each time!
- Move 10-30 units away from current position
- Vary your direction: sometimes north (+Z), south (-Z), east (+X), west (-X)
- If no entities nearby, explore in a random direction
- Use the exploration seed to pick your direction

Respond with ONLY coordinates in this exact format:
DESTINATION: X, Z

Example responses:
DESTINATION: -485.0, 60.0
DESTINATION: -520.0, 30.0
DESTINATION: -490.0, 20.0`;

export class ExplorationManager {
  private isRunning = false;
  private runtime: IAgentRuntime;
  private service: HyperscapeService | null = null;
  private tickInterval: number;
  private explorationRadius: number;

  constructor(
    runtime: IAgentRuntime,
    options?: {
      tickInterval?: number;
      explorationRadius?: number;
    },
  ) {
    this.runtime = runtime;
    this.tickInterval = options?.tickInterval ?? DEFAULT_TICK_INTERVAL;
    this.explorationRadius =
      options?.explorationRadius ?? DEFAULT_EXPLORATION_RADIUS;
  }

  /**
   * Check if exploration is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Start autonomous exploration
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("[ExplorationManager] Already running, ignoring start");
      return;
    }

    this.service =
      this.runtime.getService<HyperscapeService>("hyperscapeService");
    if (!this.service) {
      logger.error(
        "[ExplorationManager] HyperscapeService not found, cannot start",
      );
      return;
    }

    logger.info("[ExplorationManager] Starting autonomous exploration...");
    logger.info(`[ExplorationManager] Tick interval: ${this.tickInterval}ms`);
    logger.info(
      `[ExplorationManager] Exploration radius: ${this.explorationRadius} units`,
    );

    this.isRunning = true;
    this.runLoop().catch((err) => {
      logger.error(
        "[ExplorationManager] Loop crashed:",
        err instanceof Error ? err.message : String(err),
      );
      this.isRunning = false;
    });
  }

  /**
   * Stop autonomous exploration
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn("[ExplorationManager] Not running, ignoring stop");
      return;
    }

    logger.info("[ExplorationManager] Stopping autonomous exploration...");
    this.isRunning = false;
  }

  /**
   * Main exploration loop
   */
  private async runLoop(): Promise<void> {
    // Initial delay to let things settle after spawn
    await this.sleep(2000);

    while (this.isRunning) {
      try {
        await this.tick();
      } catch (error) {
        logger.error(
          "[ExplorationManager] Error in tick:",
          error instanceof Error ? error.message : String(error),
        );
      }

      await this.sleep(this.tickInterval);
    }

    logger.info("[ExplorationManager] Exploration loop ended");
  }

  /**
   * Single exploration tick - decide and execute movement
   */
  private async tick(): Promise<void> {
    // Validate we can move
    if (!this.canMove()) {
      return;
    }

    const player = this.service!.getPlayerEntity();
    if (!player) {
      logger.debug("[ExplorationManager] No player entity, skipping tick");
      return;
    }

    // Get exploration target from LLM (no fallback - fail fast)
    const currentPos = player.position;
    const target = await this.getExplorationTarget(currentPos);

    // Skip if LLM failed
    if (!target) {
      return;
    }

    // Execute movement
    logger.info(
      `[ExplorationManager] Exploring: [${currentPos[0].toFixed(1)}, ${currentPos[2].toFixed(1)}] → [${target[0].toFixed(1)}, ${target[2].toFixed(1)}]`,
    );

    try {
      await this.service!.executeMove({
        target,
        runMode: false, // Walk, don't run (more natural exploration)
      });
    } catch (error) {
      logger.error(
        "[ExplorationManager] Failed to execute move:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Check if agent can currently move
   */
  private canMove(): boolean {
    if (!this.service) {
      logger.debug("[ExplorationManager] No service");
      return false;
    }

    if (!this.service.isConnected()) {
      logger.debug("[ExplorationManager] Not connected");
      return false;
    }

    const player = this.service.getPlayerEntity();
    if (!player) {
      logger.debug("[ExplorationManager] No player entity");
      return false;
    }

    if (player.alive === false) {
      logger.debug("[ExplorationManager] Player is dead");
      return false;
    }

    // Don't explore during combat (could add config to allow this)
    if (player.inCombat) {
      logger.debug("[ExplorationManager] In combat, skipping exploration");
      return false;
    }

    // Don't explore if health is low (survival instinct)
    const healthPercent = player.health.current / player.health.max;
    if (healthPercent < 0.3) {
      logger.debug("[ExplorationManager] Low health, skipping exploration");
      return false;
    }

    return true;
  }

  /**
   * Get nearby entities as context string for LLM
   */
  private getNearbyEntitiesContext(): string {
    if (!this.service) return "No entities nearby";

    const player = this.service.getPlayerEntity();
    if (!player?.position) return "No entities nearby";

    const currentPos = player.position;
    const nearbyEntities = this.service.getNearbyEntities();
    const entities: string[] = [];

    for (const entity of nearbyEntities) {
      if (entity.id === player.id) continue; // Skip self
      if (
        !entity.position ||
        !Array.isArray(entity.position) ||
        entity.position.length < 3
      )
        continue; // Skip entities without valid position

      const dist = this.calculateDistance(currentPos, entity.position);
      if (dist > 50) continue; // Skip entities too far away

      const x = entity.position[0]?.toFixed(1) ?? "?";
      const z = entity.position[2]?.toFixed(1) ?? "?";

      // Determine entity type and format accordingly
      if ("playerId" in entity) {
        // It's a player
        entities.push(
          `- Player "${entity.name}" at X=${x}, Z=${z} (${dist.toFixed(0)} units away)`,
        );
      } else if ("mobType" in entity) {
        // It's a mob/NPC
        const mob = entity as {
          name: string;
          mobType: string;
          alive?: boolean;
        };
        const status = mob.alive === false ? " (dead)" : "";
        entities.push(
          `- ${mob.name}${status} at X=${x}, Z=${z} (${dist.toFixed(0)} units away)`,
        );
      } else if ("resourceType" in entity) {
        // It's a resource
        const resource = entity as { name: string; resourceType: string };
        entities.push(
          `- ${resource.name} (${resource.resourceType}) at X=${x}, Z=${z} (${dist.toFixed(0)} units away)`,
        );
      } else {
        // Generic entity
        entities.push(
          `- ${entity.name} at X=${x}, Z=${z} (${dist.toFixed(0)} units away)`,
        );
      }
    }

    if (entities.length === 0) {
      return "No entities nearby - open area for exploration";
    }

    return entities.join("\n");
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(
    pos1: [number, number, number],
    pos2: [number, number, number],
  ): number {
    const x1 = pos1[0] ?? 0;
    const z1 = pos1[2] ?? 0;
    const x2 = pos2[0] ?? 0;
    const z2 = pos2[2] ?? 0;
    const dx = x1 - x2;
    const dz = z1 - z2;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Use LLM to decide exploration target
   */
  private async getLLMExplorationTarget(
    currentPos: [number, number, number],
  ): Promise<[number, number, number] | null> {
    try {
      // Build context for LLM
      const nearbyEntities = this.getNearbyEntitiesContext();
      const agentName = this.runtime.character?.name || "Agent";
      const agentBio = Array.isArray(this.runtime.character?.bio)
        ? this.runtime.character.bio.join(" ")
        : this.runtime.character?.bio || "An explorer";

      // Generate random seed for variety
      const randomSeed = Math.floor(Math.random() * 10000);
      const directions = [
        "north (+Z)",
        "south (-Z)",
        "east (+X)",
        "west (-X)",
        "northeast",
        "northwest",
        "southeast",
        "southwest",
      ];
      const suggestedDirection =
        directions[Math.floor(Math.random() * directions.length)];

      // Fill in the prompt template
      const prompt = EXPLORATION_PROMPT.replace(
        "{{currentX}}",
        currentPos[0].toFixed(1),
      )
        .replace("{{currentZ}}", currentPos[2].toFixed(1))
        .replace(
          "{{randomSeed}}",
          `${randomSeed} (try going ${suggestedDirection})`,
        )
        .replace("{{nearbyEntities}}", nearbyEntities)
        .replace("{{agentName}}", agentName)
        .replace("{{agentBio}}", agentBio);

      logger.debug("[ExplorationManager] LLM Prompt:", prompt);

      // Call the LLM with high temperature for variety
      const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        max_tokens: 100,
        temperature: 1.2, // High temperature for exploration variety
      });

      // Parse response - extract coordinates from "DESTINATION: X, Z"
      const responseText =
        typeof response === "string"
          ? response
          : (response as { text?: string }).text || String(response);

      logger.info("[ExplorationManager] LLM Response:", responseText);

      // Match "DESTINATION: X, Z" pattern
      const match = responseText.match(
        /DESTINATION:\s*([-\d.]+),?\s*([-\d.]+)/i,
      );
      if (!match) {
        logger.warn(
          "[ExplorationManager] Could not parse LLM response, falling back to random",
        );
        return null;
      }

      const targetX = parseFloat(match[1]);
      const targetZ = parseFloat(match[2]);

      if (isNaN(targetX) || isNaN(targetZ)) {
        logger.warn(
          "[ExplorationManager] Invalid coordinates from LLM, falling back to random",
        );
        return null;
      }

      // Clamp to reasonable exploration distance
      const dx = targetX - currentPos[0];
      const dz = targetZ - currentPos[2];
      const distance = Math.sqrt(dx * dx + dz * dz);

      // If too far, scale down to max radius
      if (distance > this.explorationRadius) {
        const scale = this.explorationRadius / distance;
        const clampedX = currentPos[0] + dx * scale;
        const clampedZ = currentPos[2] + dz * scale;
        logger.debug(
          `[ExplorationManager] Clamped target from ${distance.toFixed(1)} to ${this.explorationRadius} units`,
        );
        return [clampedX, currentPos[1], clampedZ];
      }

      // If too close, push out to minimum distance
      if (distance < MIN_EXPLORATION_DISTANCE && distance > 0) {
        const scale = MIN_EXPLORATION_DISTANCE / distance;
        const pushedX = currentPos[0] + dx * scale;
        const pushedZ = currentPos[2] + dz * scale;
        return [pushedX, currentPos[1], pushedZ];
      }

      return [targetX, currentPos[1], targetZ];
    } catch (error) {
      logger.error(
        "[ExplorationManager] LLM call failed:",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Get exploration target from LLM - no fallback, fail fast for debugging
   */
  private async getExplorationTarget(
    currentPos: [number, number, number],
  ): Promise<[number, number, number] | null> {
    const target = await this.getLLMExplorationTarget(currentPos);
    if (!target) {
      logger.error(
        "[ExplorationManager] LLM failed to provide exploration target - skipping tick",
      );
      return null;
    }
    return target;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
