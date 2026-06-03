/**
 * Initialization Module - ServerNetwork startup logic
 *
 * Handles loading and hydrating server state during the start() phase including
 * spawn points, entities, and world settings.
 *
 * Responsibilities:
 * - Load spawn point configuration from database
 * - Hydrate entities from database into world
 * - Load and deserialize world settings
 * - Parse and validate configuration data
 *
 * Usage:
 * ```typescript
 * const init = new InitializationManager(world, db);
 * const spawn = await init.loadSpawnPoint();
 * await init.hydrateEntities();
 * await init.loadSettings();
 * ```
 */

import type { World } from "@hyperforge/shared";
import { STARTER_TOWNS } from "@hyperforge/shared";
import type { SystemDatabase, SpawnData } from "../../shared/types";
import { errMsg } from "../../shared/errMsg.js";

// Default spawn point (fallback if manifest unavailable)
const DEFAULT_SPAWN = '{ "position": [0, 50, 0], "quaternion": [0, 0, 0, 1] }';

/**
 * InitializationManager - Handles ServerNetwork startup tasks
 *
 * Loads configuration and state from database during initialization.
 */
export class InitializationManager {
  /**
   * Create an InitializationManager
   *
   * @param world - Game world instance
   * @param db - Database instance for loading state
   */
  constructor(
    private world: World,
    private db: SystemDatabase,
  ) {}

  /**
   * Load spawn point configuration
   *
   * Uses Central Haven from manifest (starter town at world origin).
   *
   * @returns Spawn point configuration
   */
  async loadSpawnPoint(): Promise<SpawnData> {
    // Use manifest starter town (Central Haven at origin)
    const centralHaven = STARTER_TOWNS["central_haven"];
    if (centralHaven) {
      const centerX = (centralHaven.bounds.minX + centralHaven.bounds.maxX) / 2;
      const centerZ = (centralHaven.bounds.minZ + centralHaven.bounds.maxZ) / 2;
      console.log(
        `[InitializationManager] Using starter town: ${centralHaven.name} at (${centerX}, ${centerZ})`,
      );
      return {
        position: [centerX, 0, centerZ], // Y gets grounded to terrain later
        quaternion: [0, 0, 0, 1],
      };
    }

    // Fallback to default spawn at origin
    console.log(
      "[InitializationManager] Starter town not found, using default spawn",
    );
    return JSON.parse(DEFAULT_SPAWN) as SpawnData;
  }

  /**
   * Hydrate entities from database into world
   *
   * Loads all entities from the entities table and adds them to the world.
   * Each entity's data is parsed and state is reset to empty object.
   */
  async hydrateEntities(): Promise<void> {
    try {
      const entities = await this.db("entities");

      if (entities && Array.isArray(entities)) {
        for (const entity of entities) {
          const entityWithData = entity as { data: string };
          const data = JSON.parse(entityWithData.data);
          data.state = {}; // Reset state on load

          if (this.world.entities.add) {
            this.world.entities.add(data, true);
          }
        }

        console.log(
          `[InitializationManager] Hydrated ${entities.length} entities`,
        );
      }
    } catch (err) {
      const message = errMsg(err);

      // Legacy adapter only supports a subset of tables. If entities are not
      // supported, skip hydration without treating startup as an error.
      if (message.includes('[DatabaseAdapter] Unsupported table "entities"')) {
        console.log(
          "[InitializationManager] Entity hydration skipped (entities table not supported by legacy adapter)",
        );
        return;
      }

      console.error("[InitializationManager] Error hydrating entities:", err);
    }
  }

  /**
   * Load and deserialize world settings from database
   *
   * Queries config table for settings JSON and deserializes into world.settings.
   * Falls back to empty settings if not found or invalid.
   */
  async loadSettings(): Promise<void> {
    try {
      const settingsRow = (await this.db("config")
        .where("key", "settings")
        .first()) as { value?: string } | undefined;

      const settings = JSON.parse(settingsRow?.value || "{}");

      if (this.world.settings.deserialize) {
        this.world.settings.deserialize(settings);
      }

      console.log("[InitializationManager] Settings loaded");
    } catch (err) {
      console.error("[InitializationManager] Error loading settings:", err);
    }
  }
}
