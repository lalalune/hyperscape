/**
 * World Module - Game world initialization and entity loading
 *
 * Handles creation of the Hyperscape ECS world, system registration,
 * world configuration, and entity loading from world.json.
 *
 * Responsibilities:
 * - Create server world instance
 * - Register server-specific systems (DatabaseSystem, ServerNetwork, etc.)
 * - Attach database connections to world
 * - Configure world settings (environment model, assets URL)
 * - Initialize world and start systems
 * - Load entities from world.json
 *
 * Usage:
 * ```typescript
 * const world = await initializeWorld(config, dbContext);
 * // World is now ready with all systems running and entities loaded
 * ```
 */

import fs from "fs-extra";
import path from "path";
import {
  createServerWorld,
  installThreeJSExtensions,
} from "@hyperscape/shared";
import { NodeStorage as Storage } from "@hyperscape/shared";
import type { World, SystemDatabase } from "@hyperscape/shared";
import { ServerNetwork } from "../systems/ServerNetwork/index.js";
import type { ServerConfig } from "./config.js";
import type { DatabaseContext } from "./database.js";

/**
 * Entity data structure from world.json
 */
interface EntityData {
  id: string;
  type?: string;
  position?: number[];
  quaternion?: number[];
  rotation?: number[];
  scale?: number[];
  [key: string]: unknown;
}

/**
 * World config from world.json
 */
interface WorldConfig {
  entities: EntityData[];
}

/**
 * Initialize Hyperscape world with systems and entities
 *
 * This function creates the game world, registers all server systems,
 * configures world settings, initializes the ECS, and loads entities
 * from the world configuration file.
 *
 * @param config - Server configuration
 * @param dbContext - Database context with connections
 * @returns Promise resolving to initialized World instance
 */
export async function initializeWorld(
  config: ServerConfig,
  dbContext: DatabaseContext,
): Promise<World> {
  // Set ASSETS_DIR env var for DataManager to load manifests from filesystem
  process.env.ASSETS_DIR = config.assetsDir;

  console.log("[World] Installing Three.js extensions...");
  installThreeJSExtensions();

  console.log("[World] Creating server world...");
  const world = await createServerWorld();

  // Register server-specific systems
  console.log("[World] Registering server systems...");
  const { DatabaseSystem: ServerDatabaseSystem } =
    await import("../systems/DatabaseSystem/index.js");
  const { KillTrackerSystem } =
    await import("../systems/KillTrackerSystem/index.js");

  world.register("database", ServerDatabaseSystem);
  world.register("kill-tracker", KillTrackerSystem);
  world.register("network", ServerNetwork);
  console.log("[World] ✅ Systems registered");

  // Make PostgreSQL pool and Drizzle DB available for DatabaseSystem to use
  world.pgPool = dbContext.pgPool;
  world.drizzleDb = dbContext.drizzleDb;

  // Set up default environment model
  world.settings.model = {
    url: "asset://world/base-environment.glb",
  };

  // Configure assets URL
  world.assetsUrl = config.assetsUrl;

  // Initialize storage
  const storage = new Storage();

  // Initialize world (this starts all systems)
  console.log("[World] Initializing world...");
  await world.init({
    db: dbContext.db as SystemDatabase | undefined,
    storage,
    assetsUrl: config.assetsUrl,
    assetsDir: undefined,
  });

  // Ensure assetsUrl has trailing slash
  if (!world.assetsUrl.endsWith("/")) {
    world.assetsUrl += "/";
  }

  console.log("[World] ✅ World initialized");

  // Load entities from world.json
  await loadWorldEntities(world, config);

  console.log("[World] ✅ World ready");
  return world;
}

/**
 * Load entities from world.json configuration file
 *
 * Reads world.json and spawns all configured entities into the world.
 * Handles position, rotation/quaternion, and scale for each entity.
 *
 * @param world - The world instance to add entities to
 * @param config - Server configuration with worldDir path
 * @private
 */
async function loadWorldEntities(
  world: World,
  config: ServerConfig,
): Promise<void> {
  const worldConfigPath = path.join(config.worldDir, "world.json");

  if (!(await fs.pathExists(worldConfigPath))) {
    console.log("[World] No world.json found, skipping entity loading");
    return;
  }

  console.log("[World] Loading entities from world.json...");
  const worldConfig: WorldConfig = await fs.readJson(worldConfigPath);

  if (!worldConfig.entities || worldConfig.entities.length === 0) {
    console.log("[World] No entities in world.json");
    return;
  }

  for (const entityData of worldConfig.entities) {
    // Create complete entity data structure with defaults
    const entityToAdd = {
      ...entityData,
      type: entityData.type || "app",
      position: entityData.position || [0, 0, 0],
      quaternion: entityData.quaternion || [0, 0, 0, 1],
      scale: entityData.scale || [1, 1, 1],
      state: {},
    };

    // Handle rotation field if present (convert to quaternion)
    if (entityData.rotation && !entityData.quaternion) {
      const [_x, y, _z] = entityData.rotation;
      const halfY = y * 0.5;
      entityToAdd.quaternion = [0, Math.sin(halfY), 0, Math.cos(halfY)];
    }

    // Add entity to world
    world.entities.add!(entityToAdd, true);
  }

  console.log(
    `[World] ✅ Loaded ${worldConfig.entities.length} entities from world.json`,
  );
}
