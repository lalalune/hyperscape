/**
 * World Module - Game world initialization and entity loading
 *
 * Handles creation of the Hyperia ECS world, system registration,
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
} from "@hyperforge/shared";
import { NodeStorage as Storage } from "@hyperforge/shared";
import type { World, SystemDatabase } from "@hyperforge/shared";
import { ServerNetwork } from "@hyperforge/shared";
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
 * Initialize Hyperia world with systems and entities
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
  installThreeJSExtensions();

  const world = await createServerWorld();
  const terrainSeedRaw = process.env.TERRAIN_SEED;
  const terrainSeed =
    terrainSeedRaw !== undefined
      ? Number.parseInt(terrainSeedRaw, 10)
      : undefined;
  if (terrainSeed !== undefined && Number.isFinite(terrainSeed)) {
    const worldWithConfig = world as { config?: { terrainSeed?: number } };
    worldWithConfig.config = {
      ...worldWithConfig.config,
      terrainSeed,
    };
  }

  // Register server-specific systems
  const { DatabaseSystem: ServerDatabaseSystem } =
    await import("../systems/DatabaseSystem/index.js");
  const { KillTrackerSystem } =
    await import("../systems/KillTrackerSystem/index.js");
  const { ActivityLoggerSystem } =
    await import("../systems/ActivityLoggerSystem/index.js");

  world.register("database", ServerDatabaseSystem);
  world.register("kill-tracker", KillTrackerSystem);
  if (process.env.DISABLE_ACTIVITY_LOGGER !== "true") {
    world.register("activity-logger", ActivityLoggerSystem);
  }

  // Agent bridges expose Eliza singletons as world systems so shared-side
  // handlers can reach them via world.getSystem() — part of the
  // ServerNetwork → @hyperforge/shared migration (Step 5e).
  const { AgentManagerBridgeSystem, AgentRuntimeLookupBridgeSystem } =
    await import("../systems/AgentBridgeSystems/index.js");
  world.register("agent-manager", AgentManagerBridgeSystem);
  world.register("agent-runtime-lookup", AgentRuntimeLookupBridgeSystem);

  // Auth bridge exposes createJWT/verifyJWT as a world system so shared-side
  // handlers can access them via world.getSystem("auth") — Step 5e (JWT wiring).
  const { AuthBridgeSystem } =
    await import("../systems/AuthBridgeSystem/index.js");
  world.register("auth", AuthBridgeSystem);

  // Packet handler registry — concrete storage for packet-name → handler
  // dispatch, populated at startup by server-side registration code and
  // consumed by ServerNetwork (post-Step 6, once it lives in shared).
  // Step 5d alternative in PLAN_SERVERNETWORK_MIGRATION.md.
  const { PacketHandlerBridgeSystem } =
    await import("../systems/PacketHandlerBridgeSystem/index.js");
  world.register("packet-handlers", PacketHandlerBridgeSystem);

  // Duel stake transfer bridge — wraps the server-only
  // `executeDuelStakeTransferWithRetry` so ServerNetwork (post-Step 6, in
  // shared) can reach it via `world.getSystem("duel-stake-transfer")`.
  const { DuelStakeTransferBridgeSystem } =
    await import("../systems/DuelStakeTransferBridgeSystem/index.js");
  world.register("duel-stake-transfer", DuelStakeTransferBridgeSystem);

  // Server-network sub-manager factory — constructs the three server-only
  // managers (BroadcastManager, EventBridge, ConnectionHandler) that
  // depend on uWebSockets.js / Drizzle and therefore cannot live in
  // shared. ServerNetwork (post-Step 6) will look it up via
  // `world.getSystem("server-network-factory")`.
  const { ServerNetworkManagerFactoryBridgeSystem } =
    await import("../systems/ServerNetworkManagerFactoryBridgeSystem/index.js");
  world.register(
    "server-network-factory",
    ServerNetworkManagerFactoryBridgeSystem,
  );

  world.register("network", ServerNetwork);

  // Boot the in-binary plugin set (Phase I production-wiring step).
  // All plugins are no-op today — this just proves the gameplay-
  // framework runtime executes inside the production server. Future
  // Hyperscape→meta-plugin migrations attach their `onLoad` here.
  // Session is stashed on the world so a graceful shutdown can call
  // `pluginSession.stop()` for clean disposer teardown.
  const { bootServerPlugins } = await import("./plugins.js");
  // Phase 0.2b — when launched with `--projectManifest <path>`, the
  // manifest's `boot.plugins` array drives the plugin set; the
  // accepts-plugin-id-list overload of `bootServerPlugins` (added by
  // R3.P11) handles both legacy gameId strings and plugin-id arrays.
  // When no manifest is present, fall through to the env-driven
  // default (`HYPERSCAPE_GAME_PLUGIN` → "hyperscape" | "shooter-demo")
  // so `bun run dev` keeps working unchanged.
  const manifestBoot = config.projectManifest?.boot;
  const pluginSession = manifestBoot
    ? await bootServerPlugins(
        world,
        manifestBoot.plugins,
        manifestBoot.contentPacks,
        // Phase 0.2c — pass the full manifest through so plugins can
        // read manifest.registries to override their data loading.
        config.projectManifest,
      )
    : await bootServerPlugins(world);
  (world as { pluginSession?: typeof pluginSession }).pluginSession =
    pluginSession;

  // Make PostgreSQL pool and Drizzle DB available for DatabaseSystem to use
  world.pgPool = dbContext.pgPool;
  world.drizzleDb = dbContext.drizzleDb;

  // Set up default environment model
  world.settings.model = "asset://world/base-environment.glb";

  // Configure assets URL
  world.assetsUrl = config.assetsUrl;

  // Initialize storage
  const storage = new Storage();

  // Initialize world (this starts all systems)
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

  // DuelScheduler and DuelBettingBridge — constructed here rather than
  // inside ServerNetwork.init() so ServerNetwork (post-Step 6, in shared)
  // does not import these server-only classes. Both are fire-and-forget
  // after construction; ServerNetwork never touched the stored references.
  // PLAN_SERVERNETWORK_MIGRATION.md Step 6.
  const { DuelScheduler, DuelBettingBridge } =
    await import("../systems/DuelScheduler/index.js");
  const legacyDuelSchedulerEnabled =
    process.env.DUEL_SCHEDULER_ENABLED !== "false" &&
    process.env.STREAMING_DUEL_ENABLED !== "true";
  if (legacyDuelSchedulerEnabled) {
    const duelScheduler = new DuelScheduler(world);
    duelScheduler.init();
    (
      world as { duelScheduler?: InstanceType<typeof DuelScheduler> }
    ).duelScheduler = duelScheduler;
  }
  const duelBettingBridge = new DuelBettingBridge(world);
  duelBettingBridge.init();
  (
    world as { duelBettingBridge?: InstanceType<typeof DuelBettingBridge> }
  ).duelBettingBridge = duelBettingBridge;

  // Register packet handlers migrated to the IPacketHandlerRegistry bridge.
  // PLAN_SERVERNETWORK_MIGRATION.md Step 5d alternative — handlers are moved
  // out of ServerNetwork/index.ts into this registration module one at a
  // time. ServerNetwork's dispatcher consults the registry first, so any
  // registered handler takes precedence over the legacy static dict.
  const { registerMigratedPacketHandlers } =
    await import("./packetHandlerRegistration.js");
  registerMigratedPacketHandlers(world);

  // Load entities from world.json
  await loadWorldEntities(world, config);
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
    return;
  }

  const worldConfig: WorldConfig = await fs.readJson(worldConfigPath);

  if (!worldConfig.entities || worldConfig.entities.length === 0) {
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
}
