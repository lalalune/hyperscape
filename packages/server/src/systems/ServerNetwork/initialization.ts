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

import type { World } from "@hyperscape/shared";
import type { SystemDatabase, SpawnData } from "../../shared/types";

// Default spawn point (safe height above terrain)
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
   * Load spawn point configuration from database
   *
   * Queries the config table for spawn point data and returns parsed result.
   * Falls back to default spawn if not found or invalid.
   *
   * @returns Spawn point configuration
   */
  async loadSpawnPoint(): Promise<SpawnData> {
    try {
      const spawnRow = (await this.db("config")
        .where("key", "spawn")
        .first()) as { value?: string } | undefined;

      const spawnValue = spawnRow?.value || DEFAULT_SPAWN;
      return JSON.parse(spawnValue) as SpawnData;
    } catch (err) {
      console.error(
        "[InitializationManager] Error loading spawn point, using default:",
        err,
      );
      return JSON.parse(DEFAULT_SPAWN) as SpawnData;
    }
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
