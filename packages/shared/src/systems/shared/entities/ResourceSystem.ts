import { SystemBase } from "../infrastructure/SystemBase";
// NOTE: Import directly to avoid circular dependency through barrel file
import { TerrainSystem } from "../world/TerrainSystem";
import { uuid } from "../../../utils";
import type { World } from "../../../types";
import { ResourceEntity } from "../../../entities/world/ResourceEntity";
import { disposeFishingSpotTextures } from "../../../entities/world/visuals/FishingSpotVisualStrategy";

import { EventType } from "../../../types/events";
import { Resource, ResourceDrop } from "../../../types/core/core";
import { PlayerID, ResourceID } from "../../../types/core/identifiers";
import {
  calculateDistance,
  calculateDistance2D,
} from "../../../utils/game/EntityUtils";
import {
  createPlayerID,
  createResourceID,
} from "../../../utils/IdentifierUtils";
import type { TerrainResourceSpawnPoint } from "../../../types/world/terrain";
import {
  TICK_DURATION_MS,
  snapToTileCenter,
  worldToTile,
  isCardinallyAdjacentToResource,
  type TileCoord,
} from "../movement/TileSystem";
import {
  FOOTPRINT_SIZES,
  type ResourceFootprint,
} from "../../../types/game/resource-processing-types";
import {
  getExternalResource,
  getExternalToolsForSkill,
} from "../../../utils/ExternalAssetUtils";
import type { GatheringToolData } from "../../../data/DataManager";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import { isPositionInsideDuelArenaZone } from "../../../data/duel-manifest";
import { GATHERING_CONSTANTS } from "../../../constants/GatheringConstants";
import { TERRAIN_CONSTANTS } from "../../../constants/GameConstants";
import { findWaterEdgePoints, shuffleArray } from "../../../utils/ShoreUtils";
import type { WorldArea } from "../../../types/world/world-types";
// Note: quaternionPool no longer used here - face rotation is deferred to FaceDirectionManager

// SOLID: Extracted pure utility functions
import { rollDrop as rollDropUtil } from "./gathering/DropRoller";
import {
  getToolCategory as getToolCategoryUtil,
  getToolDisplayName as getToolDisplayNameUtil,
  itemMatchesToolCategory,
} from "./gathering/ToolUtils";
import {
  computeSuccessRate as computeSuccessRateUtil,
  computeCycleTicks as computeCycleTicksUtil,
  getSuccessRateValues as getSuccessRateValuesUtil,
  ticksToMs as ticksToMsUtil,
} from "./gathering/SuccessRateCalculator";
import { DEBUG_GATHERING } from "./gathering/debug";

/**
 * Player entity interface for emote operations.
 * Used for type-safe access to player emote properties.
 */
interface PlayerWithEmote {
  emote?: string;
  data?: { e?: string };
  markNetworkDirty?: () => void;
}

/**
 * Resource entity interface for respawn/deplete operations.
 * Used for type-safe access to resource entity methods.
 */
interface ResourceEntityMethods {
  respawn?: () => void;
  deplete?: () => void;
}

/**
 * ResourceSystem - Manages resource gathering for all skills (woodcutting, mining, fishing)
 *
 * ## Architecture
 *
 * ### Data Flow
 * 1. Client clicks resource → ResourceInteractionHandler
 * 2. Handler sends network message → resources.ts handler
 * 3. Handler emits RESOURCE_GATHER event with server-authoritative position
 * 4. ResourceSystem.startGathering() validates and creates session
 * 5. TickSystem calls processGatheringTick() every 600ms (OSRS tick rate)
 * 6. On success: drops item via manifest data, awards XP, may deplete resource
 *
 * ### Manifest Integration
 * All resource data comes from resources.json manifest:
 * - harvestSkill, levelRequired: Skill validation
 * - toolRequired: Tool validation (via tools.json manifest)
 * - baseCycleTicks, depleteChance, respawnTicks: Timing configuration
 * - harvestYield: Drop table with itemId, itemName, quantity, chance, xpAmount, stackable
 *
 * ### Session Management
 * Active gathering sessions stored in activeGathering Map (keyed by PlayerID).
 * Sessions cache tuning data at start to avoid per-tick allocations (performance).
 * Sessions end on: resource depletion, player movement, inventory full, or disconnect.
 *
 * ### Security Features
 * - Rate limiting: 600ms minimum between gather requests (1 tick)
 * - Server-authoritative position: Client position ignored, uses world state
 * - Resource ID validation: Alphanumeric with length limit to prevent injection
 * - Proximity checks: Uses server-side player position for range validation
 *
 * ### Tool Tier System (OSRS-Accurate, Manifest-Driven)
 * Tool definitions loaded from tools.json manifest:
 * - Woodcutting: Axe tier affects SUCCESS RATE (not speed), fixed 4-tick rolls
 * - Mining: Pickaxe tier affects ROLL FREQUENCY (not success), variable ticks
 * - Fishing: Equipment doesn't affect speed or success, fixed 5-tick rolls
 *
 * @see GATHERING_CONSTANTS for skill-specific mechanics
 * @see tools.json for tool definitions
 * @see resources.json for resource definitions
 */
export class ResourceSystem extends SystemBase {
  private resources = new Map<ResourceID, Resource>();

  // Tick-based gathering sessions (OSRS-accurate timing)
  // Session includes cached data to avoid per-tick allocations
  private activeGathering = new Map<
    PlayerID,
    {
      playerId: PlayerID;
      resourceId: ResourceID;
      startTick: number; // Tick when gathering started
      nextAttemptTick: number; // Next tick to roll for success
      cycleTickInterval: number; // Ticks between attempts
      attempts: number;
      successes: number;
      // Skill being used (woodcutting, mining, fishing)
      skill: string;
      // Tool item ID being used (for visual display, e.g., fishing rod)
      toolItemId: string | null;
      // PERFORMANCE: Cached at session start to avoid per-tick allocations
      cachedTuning: {
        levelRequired: number;
        xpPerLog: number;
        depleteChance: number;
        respawnTicks: number;
      };
      cachedSuccessRate: number;
      cachedDrops: ResourceDrop[];
      cachedResourceName: string; // For messages without lookup
      // OSRS-ACCURACY: Store start position to detect movement (cancels gathering)
      cachedStartPosition: { x: number; y: number; z: number };
      // DEBUG: Cached for logging (only used when DEBUG_GATHERING=true)
      debugInfo?: {
        skill: string;
        variant: string;
        toolTier: string | null;
        lowHigh: { low: number; high: number };
      };
    }
  >();
  // Tick-based respawn tracking (replaces legacy setTimeout approach)
  private respawnAtTick = new Map<ResourceID, number>();
  private playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();
  private resourceVariants = new Map<ResourceID, string>();
  // Track manifest-spawned resources (from world-areas.json) - these should NOT be deleted on tile unload
  private manifestResourceIds = new Set<ResourceID>();
  // Terrain system reference for height lookups
  private terrainSystem: TerrainSystem | null = null;

  // ===== FORESTRY-STYLE RESOURCE TIMERS (OSRS-accurate) =====
  /**
   * Per-resource depletion timer for Forestry-style tree mechanics.
   * - Timer starts on FIRST LOG (not first interaction)
   * - Counts down at 1 tick/tick while anyone is gathering
   * - Regenerates at 1 tick/tick when no one is gathering
   * - Tree depletes when timer=0 AND player receives a log
   * - Multiple players share the same timer (no penalty)
   *
   * @see https://oldschool.runescape.wiki/w/Forestry
   */
  private resourceTimers = new Map<
    ResourceID,
    {
      currentTicks: number; // Current timer value (counts down while gathering)
      maxTicks: number; // Max timer value from TREE_DESPAWN_TICKS
      hasReceivedFirstLog: boolean; // Timer only starts after first log
      activeGatherers: Set<PlayerID>; // Players currently gathering this resource
      lastUpdateTick: number; // For calculating tick deltas
    }
  >();

  // ===== SECURITY: Rate limiting to prevent gather request spam =====
  private gatherRateLimits = new Map<PlayerID, number>();

  // ===== SECURITY: Suspicious pattern tracking =====
  /**
   * Tracks suspicious patterns per player for security monitoring.
   * - rapidDisconnects: Count of disconnects during active gathering within 5s window
   * - lastDisconnect: Timestamp of last disconnect during active gather
   * - rapidGatherAttempts: Count of attempts on same resource within 60s window
   * - lastAttempt: Timestamp of last gather attempt
   */
  private suspiciousPatterns = new Map<
    PlayerID,
    {
      rapidDisconnects: number;
      lastDisconnect: number;
      rapidGatherAttempts: number;
      lastAttempt: number;
    }
  >();

  // ===== OSRS-ACCURACY: Fishing spot movement timers =====
  /**
   * Fishing spots don't deplete - they periodically move to nearby tiles.
   * Each spot has a random timer that triggers relocation.
   *
   * @see https://oldschool.runescape.wiki/w/Fishing
   */
  private fishingSpotMoveTimers = new Map<
    ResourceID,
    {
      moveAtTick: number; // Tick when spot will move
      originalPosition: { x: number; y: number; z: number }; // For reference
    }
  >();

  // ===== PERFORMANCE: Pre-allocated buffers for zero-allocation hot paths =====
  // These buffers are reused every tick to avoid GC pressure from array allocations
  // Pattern: buffer.length = 0 to clear, then push items, then process
  private readonly _completedSessionsBuffer: PlayerID[] = [];
  private readonly _respawnedResourcesBuffer: ResourceID[] = [];
  private readonly _spotsToMoveBuffer: ResourceID[] = [];
  private _stuckSessionLog?: Set<string>;

  // =============================================================================
  // TOOL DATA - Now loaded from tools.json manifest
  // =============================================================================
  //
  // Tool definitions are in packages/server/world/assets/manifests/tools.json
  // Loaded at runtime via DataManager → getExternalToolsForSkill()
  //
  // OSRS-ACCURATE MECHANICS:
  // - Woodcutting: tier affects success rate, roll frequency is fixed (4 ticks)
  // - Mining: rollTicks affects roll frequency, success rate is level-only
  // - Fishing: Equipment doesn't affect speed or success
  //
  // @see https://oldschool.runescape.wiki/w/Axe
  // @see https://oldschool.runescape.wiki/w/Pickaxe
  // =============================================================================

  constructor(world: World) {
    super(world, {
      name: "resource",
      dependencies: {
        required: [], // Resource system can work independently
        optional: ["inventory", "skills", "ui", "terrain"], // Better with inventory, skills, and terrain systems
      },
      autoCleanup: true,
    });
  }

  /**
   * Helper to send network messages (DRY principle)
   */
  private sendNetworkMessage(method: string, data: unknown): void {
    const network = this.world.network as
      | { send?: (method: string, data: unknown) => void }
      | undefined;
    if (network?.send) {
      network.send(method, data);
    }
  }

  /**
   * Calculate all tiles occupied by a resource based on its anchor tile and footprint
   *
   * OSRS-ACCURACY: Multi-tile resources (like large trees) occupy multiple tiles.
   * The anchor tile is the SW corner, and this function returns all tiles
   * in the rectangular footprint.
   *
   * @param anchorTile - SW corner tile of the resource
   * @param footprint - Footprint type (standard=1×1, large=2×2, massive=3×3)
   * @returns Array of all occupied tile coordinates
   */
  private getOccupiedTiles(
    anchorTile: TileCoord,
    footprint: ResourceFootprint,
  ): TileCoord[] {
    const size = FOOTPRINT_SIZES[footprint];
    const tiles: TileCoord[] = [];

    for (let dx = 0; dx < size.x; dx++) {
      for (let dz = 0; dz < size.z; dz++) {
        tiles.push({
          x: anchorTile.x + dx,
          z: anchorTile.z + dz,
        });
      }
    }

    return tiles;
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions for resource management
    this.subscribe<{ spawnPoints: TerrainResourceSpawnPoint[] }>(
      EventType.RESOURCE_SPAWN_POINTS_REGISTERED,
      async (data) => {
        await this.registerTerrainResources(data);
      },
    );

    // Subscribe to direct harvest requests from ResourceEntity interactions
    this.subscribe(EventType.RESOURCE_HARVEST_REQUEST, (data) => {
      // Forward to RESOURCE_GATHER handler with correct format
      this.world.emit(EventType.RESOURCE_GATHER, {
        playerId: data.playerId,
        resourceId: data.entityId, // entityId is the resource entity ID
        playerPosition: undefined, // Will be looked up from player entity
      });
    });

    this.subscribe<{
      playerId: string;
      resourceId: string;
      playerPosition?: { x: number; y: number; z: number };
    }>(EventType.RESOURCE_GATHER, (data) => {
      const playerPosition =
        data.playerPosition ||
        (() => {
          const player = this.world.getPlayer?.(data.playerId);
          return player &&
            (player as { position?: { x: number; y: number; z: number } })
              .position
            ? (player as { position: { x: number; y: number; z: number } })
                .position
            : { x: 0, y: 0, z: 0 };
        })();
      this.startGathering({
        playerId: data.playerId,
        resourceId: data.resourceId,
        playerPosition,
      });
    });

    // Set up player gathering event subscriptions (RESOURCE_GATHER only to avoid loops)
    this.subscribe<{ playerId: string; resourceId: string }>(
      EventType.RESOURCE_GATHERING_STOPPED,
      (data) => this.stopGathering(data),
    );
    this.subscribe<{ id: string }>(EventType.PLAYER_UNREGISTERED, (data) =>
      this.cleanupPlayerGathering(data.id),
    );

    // OSRS-ACCURACY: Cancel gathering when player clicks to move anywhere
    // In OSRS, gathering uses "weak queue" which is cancelled by ANY click (even same tile)
    // This ensures clicking ground under yourself cancels gathering, matching OSRS behavior
    this.subscribe<{
      playerId: string;
      targetPosition: { x: number; y: number; z: number };
    }>(EventType.MOVEMENT_CLICK_TO_MOVE, (data) => {
      const playerId = createPlayerID(data.playerId);
      const session = this.activeGathering.get(playerId);
      if (session) {
        // Cancel gathering - player clicked to move (weak queue behavior)
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: data.playerId,
          resourceId: session.resourceId,
        });
        this.resetGatheringEmote(data.playerId);
        this.activeGathering.delete(playerId);
      }
    });

    // OSRS-ACCURACY: Cancel gathering when player dies
    // Critical: Dead players cannot continue gathering
    this.subscribe<{ playerId: string }>(EventType.PLAYER_DIED, (data) => {
      this.cancelGatheringForPlayer(data.playerId, "died");
    });

    // OSRS-ACCURACY: Cancel gathering when player teleports
    // Cannot gather from a resource across the map
    this.subscribe<{
      playerId: string;
      position: { x: number; y: number; z: number };
    }>(EventType.PLAYER_TELEPORT_REQUEST, (data) => {
      this.cancelGatheringForPlayer(data.playerId, "teleported");
    });

    // OSRS-ACCURACY: Cancel gathering when player initiates combat
    // Attacking a mob/player is a new action that replaces gathering
    this.subscribe<{
      attackerId?: string;
      playerId?: string;
      targetId: string;
      attackerType: string;
      targetType: string;
    }>(EventType.COMBAT_ATTACK_REQUEST, (data) => {
      const playerId = data.attackerId || data.playerId;
      if (playerId) {
        this.cancelGatheringForPlayer(playerId, "combat");
      }
    });

    // OSRS-ACCURACY: Cancel gathering when player opens bank
    // Opening interface = new action
    this.subscribe<{ playerId: string; bankId?: string }>(
      EventType.BANK_OPEN,
      (data) => {
        this.cancelGatheringForPlayer(data.playerId, "bank_open");
      },
    );

    // OSRS-ACCURACY: Cancel gathering when player opens store
    // Opening interface = new action
    this.subscribe<{ playerId: string; storeId?: string }>(
      EventType.STORE_OPEN,
      (data) => {
        this.cancelGatheringForPlayer(data.playerId, "store_open");
      },
    );

    // OSRS-ACCURACY: Cancel gathering when player interacts with any entity
    // Clicking on an entity (NPC, player, object) = new action
    // Exception: Don't cancel if interacting with the same resource we're gathering
    this.subscribe<{
      playerId: string;
      entityId: string;
      interactionType: string;
    }>(EventType.ENTITY_INTERACT_REQUEST, (data) => {
      const playerId = createPlayerID(data.playerId);
      const session = this.activeGathering.get(playerId);
      // Only cancel if interacting with a DIFFERENT entity than what we're gathering
      if (session && session.resourceId !== data.entityId) {
        this.cancelGatheringForPlayer(data.playerId, "entity_interact");
      }
    });

    // OSRS-ACCURACY: Cancel gathering when player drops an item
    // Dropping is an action that should cancel gathering
    // Also prevents database deadlocks between inventory insert (gathering) and delete (drop)
    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity?: number;
      slot?: number;
    }>(EventType.ITEM_DROP, (data) => {
      this.cancelGatheringForPlayer(data.playerId, "item_drop");
    });

    // OSRS-ACCURACY: Cancel gathering when equipping/unequipping items
    // In OSRS, equipment changes are distinct actions that interrupt gathering
    this.subscribe<{
      playerId: string;
      itemId: string;
      slot?: string;
    }>(EventType.EQUIPMENT_EQUIP, (data) => {
      this.cancelGatheringForPlayer(data.playerId, "equip_item");
    });

    this.subscribe<{
      playerId: string;
      itemId: string;
      slot?: string;
    }>(EventType.EQUIPMENT_UNEQUIP, (data) => {
      this.cancelGatheringForPlayer(data.playerId, "unequip_item");
    });

    // Terrain resources now flow through RESOURCE_SPAWN_POINTS_REGISTERED only
    this.subscribe<{ tileId: string }>("terrain:tile:unloaded", (data) =>
      this.onTerrainTileUnloaded(data),
    );

    // Listen to skills updates for reactive patterns
    this.subscribe<{
      playerId: string;
      skills: Record<string, { level: number; xp: number }>;
    }>(EventType.SKILLS_UPDATED, (data) => {
      this.playerSkills.set(data.playerId, data.skills);
    });

    // Get terrain system for height lookups
    this.terrainSystem = this.world.getSystem(
      "terrain",
    ) as TerrainSystem | null;
  }

  private sendChat(_playerId: string | PlayerID, text: string): void {
    // Note: playerId unused - system messages are broadcast, not targeted
    const chat = this.world.chat;
    const msg = {
      id: uuid(),
      from: "System",
      fromId: null,
      body: text,
      text,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };
    chat.add(msg, true);
  }

  /**
   * Set gathering emote for a player
   */
  private setGatheringEmote(playerId: string, emote: string): void {
    const playerEntity = this.world.getPlayer?.(playerId);
    if (playerEntity) {
      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] 🪓 Setting ${emote} emote for ${playerId}`,
        );
      }

      // Set emote STRING KEY (players use emote strings which get mapped to URLs)
      const playerWithEmote = playerEntity as PlayerWithEmote;
      if (playerWithEmote.emote !== undefined) {
        playerWithEmote.emote = emote;
      }
      if (playerWithEmote.data) {
        playerWithEmote.data.e = emote;
      }

      // Send immediate network update for emote (same pattern as CombatSystem)
      // This ensures the emote update arrives at clients immediately
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: playerId,
          e: emote,
        });
      }

      playerWithEmote.markNetworkDirty?.();
    }
  }

  /**
   * Reset gathering emote back to idle
   */
  private resetGatheringEmote(playerId: string): void {
    const playerEntity = this.world.getPlayer?.(playerId);
    if (playerEntity) {
      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] 🪓 Resetting emote to idle for ${playerId}`,
        );
      }

      // Reset to idle
      const playerWithEmote = playerEntity as PlayerWithEmote;
      if (playerWithEmote.emote !== undefined) {
        playerWithEmote.emote = "idle";
      }
      if (playerWithEmote.data) {
        playerWithEmote.data.e = "idle";
      }

      // Send immediate network update for emote reset (same pattern as CombatSystem)
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: playerId,
          e: "idle",
        });
      }

      playerWithEmote.markNetworkDirty?.();
    }
  }

  async start(): Promise<void> {
    // Resources will be spawned procedurally by TerrainSystem across all terrain tiles
    // No need for manual default spawning - TerrainSystem generates resources based on biome
    // NOTE: Gathering is now processed via processGatheringTick() called by TickSystem
    // The old 500ms interval has been removed in favor of OSRS-accurate 600ms tick-based processing
    // Registration happens in ServerNetwork/index.ts at TickPriority.RESOURCES

    // Load explicit resource placements from world-areas.json (server only)
    // This must be in start() not init() because network broadcast isn't ready during init()
    if (this.world.isServer) {
      this.initializeWorldAreaResources();

      // SECURITY: Periodic cleanup of stale rate limit entries
      // Prevents memory leak from disconnected players
      this.createInterval(() => {
        const now = Date.now();
        for (const [playerId, timestamp] of this.gatherRateLimits) {
          if (now - timestamp > GATHERING_CONSTANTS.STALE_RATE_LIMIT_MS) {
            this.gatherRateLimits.delete(playerId);
          }
        }
      }, GATHERING_CONSTANTS.RATE_LIMIT_CLEANUP_INTERVAL_MS);
    }
  }

  update(_dt: number): void {}

  /**
   * Initialize resources from world-areas.json manifest
   * Called once on server startup to spawn explicit resource placements
   */
  private initializeWorldAreaResources(): void {
    // Type mapping: resources.json type → TerrainResourceSpawnPoint type
    const typeMap: Record<string, TerrainResourceSpawnPoint["type"]> = {
      tree: "tree",
      fishing_spot: "fish",
      herb_patch: "herb",
      rock: "rock",
      ore: "ore",
    };

    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] initializeWorldAreaResources() called. ALL_WORLD_AREAS keys: ${Object.keys(ALL_WORLD_AREAS).join(", ")}`,
      );
    }

    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (!area.resources || area.resources.length === 0) continue;
      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] Processing area "${areaId}" with ${area.resources.length} resources`,
        );
      }

      const spawnPoints: TerrainResourceSpawnPoint[] = [];

      for (const r of area.resources) {
        // Look up resource in manifest to get authoritative type
        const resourceData = getExternalResource(r.resourceId);
        if (DEBUG_GATHERING) {
          console.log(
            `[ResourceSystem] getExternalResource("${r.resourceId}") returned: ${resourceData ? resourceData.type : "null"}`,
          );
        }
        if (!resourceData) {
          console.warn(
            `[ResourceSystem] Unknown resource ID in world-areas: ${r.resourceId}`,
          );
          continue;
        }

        // Map type (e.g., "fishing_spot" → "fish")
        const mappedType = typeMap[resourceData.type] || resourceData.type;

        // Extract subType by removing type prefix from resourceId
        // "tree_oak" - "tree_" = "oak"
        // "tree_normal" - "tree_" = "normal" → undefined
        const suffix = r.resourceId.replace(resourceData.type + "_", "");
        const subType = suffix === "normal" ? undefined : suffix;

        // Ground Y position to terrain height
        let groundedY = r.position.y;
        if (this.terrainSystem) {
          const terrainHeight = this.terrainSystem.getHeightAt(
            r.position.x,
            r.position.z,
          );
          if (Number.isFinite(terrainHeight)) {
            groundedY = terrainHeight; // Feet at ground level
          }
        }

        spawnPoints.push({
          position: { x: r.position.x, y: groundedY, z: r.position.z },
          type: mappedType as TerrainResourceSpawnPoint["type"],
          subType: subType as TerrainResourceSpawnPoint["subType"],
        });
      }

      if (spawnPoints.length > 0) {
        if (DEBUG_GATHERING) {
          console.log(
            `[ResourceSystem] Spawning ${spawnPoints.length} explicit resources for area "${areaId}"`,
          );
        }
        // Pass isManifest: true to protect these resources from tile unload deletion
        this.registerTerrainResources({ spawnPoints, isManifest: true });
      }

      // Spawn dynamic fishing spots if configured for this area
      if (area.fishing?.enabled) {
        this.spawnDynamicFishingSpots(areaId, area);
      }
    }
  }

  /**
   * Dynamically spawn fishing spots at detected shore positions within an area.
   * Uses terrain height sampling to find valid water edges.
   *
   * @param areaId - Area identifier for logging
   * @param area - World area configuration with fishing config
   */
  private spawnDynamicFishingSpots(areaId: string, area: WorldArea): void {
    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] 🎣 spawnDynamicFishingSpots called for ${areaId} ` +
          `bounds: (${area.bounds.minX},${area.bounds.minZ}) to (${area.bounds.maxX},${area.bounds.maxZ})`,
      );
    }

    if (!this.terrainSystem) {
      console.warn(
        `[ResourceSystem] No terrain system available - skipping dynamic fishing for ${areaId}`,
      );
      return;
    }

    // Debug: Sample heights across the bounds to find water
    const sampleStep = 50; // Sample every 50m
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let waterCount = 0;
    let shoreCount = 0;
    let totalSamples = 0;
    let lowestPoint = { x: 0, z: 0, h: Infinity };

    for (let x = area.bounds.minX; x <= area.bounds.maxX; x += sampleStep) {
      for (let z = area.bounds.minZ; z <= area.bounds.maxZ; z += sampleStep) {
        const h = this.terrainSystem!.getHeightAt(x, z);
        totalSamples++;
        if (h < minHeight) {
          minHeight = h;
          lowestPoint = { x, z, h };
        }
        if (h > maxHeight) maxHeight = h;
        if (h < 5.4) waterCount++;
        if (h >= 5.4 && h <= 20.0) shoreCount++;
      }
    }

    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] 🎣 Terrain scan in ${areaId}: ` +
          `min=${minHeight.toFixed(1)}m, max=${maxHeight.toFixed(1)}m, ` +
          `water=${waterCount}/${totalSamples}, shore=${shoreCount}/${totalSamples}`,
      );
      console.log(
        `[ResourceSystem] 🎣 Lowest point: (${lowestPoint.x},${lowestPoint.z})=${lowestPoint.h.toFixed(2)}m`,
      );
      console.log(
        `[ResourceSystem] 🎣 Looking for: water < 5.4m adjacent to shore 5.4-20.0m`,
      );
    }

    const fishing = area.fishing!;

    // Find water edge points (IN the water, adjacent to walkable land)
    // sampleInterval=1 matches tile size for tile-accurate adjacency checks
    const waterEdgePoints = findWaterEdgePoints(
      area.bounds,
      this.terrainSystem.getHeightAt.bind(this.terrainSystem),
      {
        sampleInterval: 1, // 1m = 1 tile for tile-accurate detection
        waterThreshold: TERRAIN_CONSTANTS.WATER_THRESHOLD,
        shoreMaxHeight: 20.0, // Higher to accommodate elevated island terrain
        minSpacing: 8, // Increased spacing to spread spots out more
      },
    );

    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] 🎣 findWaterEdgePoints found ${waterEdgePoints.length} water edge points in ${areaId}`,
      );
    }

    if (waterEdgePoints.length === 0) {
      console.warn(
        `[ResourceSystem] ⚠️ No water edge points found in ${areaId} - no dynamic fishing spots spawned. ` +
          `Area may not have shallow water near walkable shore.`,
      );
      return;
    }

    // Randomize order for variety
    shuffleArray(waterEdgePoints);

    // Determine how many spots to spawn (at least one of each type if possible)
    const spotsToSpawn = Math.min(fishing.spotCount, waterEdgePoints.length);

    // Build spawn points (round-robin through spot types to ensure variety)
    const spawnPoints: TerrainResourceSpawnPoint[] = [];
    const spawnedTypes: string[] = [];

    for (let i = 0; i < spotsToSpawn; i++) {
      const point = waterEdgePoints[i];
      const spotTypeId = fishing.spotTypes[i % fishing.spotTypes.length];

      // Extract subType: "fishing_spot_net" -> "net"
      const subType = spotTypeId.replace("fishing_spot_", "");

      spawnPoints.push({
        position: { x: point.x, y: point.y, z: point.z },
        type: "fish",
        subType: subType as TerrainResourceSpawnPoint["subType"],
      });
      spawnedTypes.push(subType);
    }

    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] 🎣 Spawning fishing spots in ${areaId}: ${spawnedTypes.join(", ")}`,
      );
    }

    // Use existing spawn infrastructure
    if (spawnPoints.length > 0) {
      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] Spawning ${spawnPoints.length} dynamic fishing spots in ${areaId} ` +
            `(found ${waterEdgePoints.length} water edge points)`,
        );
      }
      this.registerTerrainResources({ spawnPoints, isManifest: true });
    }
  }

  /**
   * Handle terrain system resource registration (new procedural system)
   * @param data.spawnPoints - Resource spawn points to register
   * @param data.isManifest - If true, resources are from world-areas.json and won't be deleted on tile unload
   */
  private async registerTerrainResources(data: {
    spawnPoints: TerrainResourceSpawnPoint[];
    isManifest?: boolean;
  }): Promise<void> {
    const { spawnPoints, isManifest = false } = data;

    if (spawnPoints.length === 0) return;

    // Only spawn actual entities on the server (authoritative)
    if (!this.world.isServer) {
      return;
    }

    // Get EntityManager for spawning
    const entityManager = this.world.getSystem("entity-manager") as {
      spawnEntity?: (config: unknown) => Promise<unknown>;
    } | null;
    if (!entityManager?.spawnEntity) {
      console.error(
        "[ResourceSystem] EntityManager not available, cannot spawn resources!",
      );
      return;
    }

    let spawned = 0;

    for (const spawnPoint of spawnPoints) {
      const resource = this.createResourceFromSpawnPoint(spawnPoint);
      if (!resource) {
        continue;
      }

      // Store in map for tracking
      const rid = createResourceID(resource.id);
      this.resources.set(rid, resource);

      // Mark manifest resources so they're not deleted on tile unload
      if (isManifest) {
        this.manifestResourceIds.add(rid);
      }

      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] Stored resource in map: id="${resource.id}", rid="${rid}", map size=${this.resources.size}${isManifest ? " (manifest)" : ""}`,
        );
      }
      // Track variant/subtype for tuning (e.g., 'tree_oak', 'ore_copper', 'fishing_spot_net')
      if (resource.type === "tree") {
        // Build full key: if subType is "normal", key is "tree_normal"
        const variant = spawnPoint.subType
          ? `tree_${spawnPoint.subType}`
          : "tree_normal";
        this.resourceVariants.set(rid, variant);
      } else if (resource.type === "ore") {
        // Build ore variant key: e.g., "ore_essence", "ore_copper"
        // Prefer subType (e.g. "copper" → "ore_copper"), then fall back to
        // resourceId which already encodes the full variant (e.g. "ore_essence").
        const variant = spawnPoint.subType
          ? `ore_${spawnPoint.subType}`
          : resource.id || "ore_copper";
        this.resourceVariants.set(rid, variant);
      } else if (resource.type === "fishing_spot") {
        // Build fishing spot variant key: e.g., "fishing_spot_net", "fishing_spot_bait"
        const variant = spawnPoint.subType
          ? `fishing_spot_${spawnPoint.subType}`
          : resource.id || "fishing_spot_net";
        this.resourceVariants.set(rid, variant);
      }

      // OSRS-ACCURACY: Initialize fishing spot movement timer
      if (
        resource.type === "fishing_spot" ||
        resource.skillRequired === "fishing"
      ) {
        this.initializeFishingSpotTimer(rid, resource.position);
      }

      // Spawn actual ResourceEntity instance
      // Use rotation from spawn point if available (deterministic from BiomeResourceGenerator)
      // Otherwise fall back to random rotation
      const yRotation = spawnPoint.rotation ?? Math.random() * Math.PI * 2;
      const quat = {
        x: 0,
        y: Math.sin(yRotation / 2),
        z: 0,
        w: Math.cos(yRotation / 2),
      };

      // OSRS-ACCURACY: Calculate tile footprint data for proper interaction positioning
      const footprint: ResourceFootprint = resource.footprint || "standard";
      const anchorTile = worldToTile(resource.position.x, resource.position.z);
      const occupiedTiles = this.getOccupiedTiles(anchorTile, footprint);

      // Get base scale from manifest and multiply by spawn point variation
      const baseScale = this.getScaleForResource(
        resource.type,
        spawnPoint.subType,
      );
      const scaleVariation = spawnPoint.scale ?? 1.0;
      const finalScale = baseScale * scaleVariation;

      // Same for depleted model scale
      const baseDepletedScale = this.getDepletedScaleForResource(
        resource.type,
        spawnPoint.subType,
      );
      const finalDepletedScale = baseDepletedScale * scaleVariation;

      const resourceConfig = {
        id: resource.id,
        type: "resource" as const,
        name: resource.name,
        position: {
          x: resource.position.x,
          y: resource.position.y,
          z: resource.position.z,
        },
        rotation: quat, // Quaternion from spawn point or random
        scale: { x: 1, y: 1, z: 1 }, // ALWAYS uniform scale - ResourceEntity handles mesh scale
        visible: true,
        interactable: true,
        interactionType: "harvest",
        interactionDistance: 3,
        description: `${resource.name} - Requires level ${resource.levelRequired} ${resource.skillRequired}`,
        model: this.getModelPathForResource(resource.type, spawnPoint.subType),
        properties: {},
        // ResourceEntity specific
        // Map manifest type to ResourceType enum value
        // Manifest uses: "tree", "ore", "fishing_spot"
        // Enum expects: "tree", "mining_rock", "fishing_spot"
        resourceType: resource.type === "ore" ? "mining_rock" : resource.type,
        resourceId: spawnPoint.subType
          ? `${resource.type}_${spawnPoint.subType}`
          : `${resource.type}_normal`,
        harvestSkill: resource.skillRequired,
        requiredLevel: resource.levelRequired,
        harvestTime: 3000,
        harvestYield: resource.drops.map((drop) => ({
          itemId: drop.itemId,
          quantity: drop.quantity,
          chance: drop.chance,
        })),
        respawnTime: resource.respawnTime,
        depleted: false,
        // Manifest-driven model config with scale variation applied
        depletedModelPath: this.getDepletedModelPathForResource(
          resource.type,
          spawnPoint.subType,
        ),
        modelScale: finalScale,
        depletedModelScale: finalDepletedScale,
        // LOD support - use LOD1 model for medium distance rendering
        lod1Model: this.getLod1ModelPathForResource(
          resource.type,
          spawnPoint.subType,
        ),
        lod1ModelScale: finalScale, // Same scale variation as main model
        // Procgen preset for runtime procedural tree generation
        procgenPreset: this.getProcgenPresetForResource(
          resource.type,
          spawnPoint.subType,
        ),
        // OSRS-ACCURACY: Tile-based positioning for face direction and interaction
        footprint,
        anchorTile,
        occupiedTiles,
      };

      try {
        const spawnedEntity = (await entityManager.spawnEntity(
          resourceConfig,
        )) as { id?: string } | null;
        if (spawnedEntity) {
          spawned++;
        }
      } catch (err) {
        console.error(
          `[ResourceSystem] Failed to spawn resource entity ${resource.id}:`,
          err,
        );
      }
    }

    if (spawned > 0) {
      // Resources spawned successfully
    }
  }

  /**
   * Get model path for resource type from manifest
   * Fails fast if manifest data not found
   */
  private getModelPathForResource(type: string, subType?: string): string {
    // Build resource ID to look up in manifest
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    const path = manifestData.modelPath;
    if (!path || path === "null") return "";
    return path;
  }

  /**
   * Get depleted model path for resource type from manifest
   * Fails fast if manifest data not found
   */
  private getDepletedModelPathForResource(
    type: string,
    subType?: string,
  ): string | null {
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    return manifestData.depletedModelPath;
  }

  /**
   * Get scale for resource type from manifest
   * Fails fast if manifest data not found
   */
  private getScaleForResource(type: string, subType?: string): number {
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    return manifestData.scale;
  }

  /**
   * Get LOD1 model path for resource type from manifest
   * Returns null if not specified (full model used until imposter)
   */
  private getLod1ModelPathForResource(
    type: string,
    subType?: string,
  ): string | null {
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    return manifestData.lod1ModelPath ?? null;
  }

  /**
   * Get depleted scale for resource type from manifest
   * Fails fast if manifest data not found
   */
  private getDepletedScaleForResource(type: string, subType?: string): number {
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    return manifestData.depletedScale;
  }

  /**
   * Get procgen preset for resource type from manifest.
   * Returns undefined if not specified (will fall back to GLB model).
   */
  private getProcgenPresetForResource(
    type: string,
    subType?: string,
  ): string | undefined {
    const variantKey = subType ? `${type}_${subType}` : `${type}_normal`;
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      // Don't throw - procgen is optional
      return undefined;
    }

    return manifestData.procgenPreset;
  }

  /**
   * Get drops for resource type from manifest
   * Fails fast if manifest data not found
   */
  private getDropsFromManifest(variantKey: string): ResourceDrop[] {
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    if (!manifestData.harvestYield || manifestData.harvestYield.length === 0) {
      throw new Error(
        `[ResourceSystem] Resource '${variantKey}' has no harvestYield defined in manifest.`,
      );
    }

    return manifestData.harvestYield.map((yield_) => ({
      itemId: yield_.itemId,
      itemName: yield_.itemName,
      quantity: yield_.quantity,
      chance: yield_.chance,
      xpAmount: yield_.xpAmount,
      stackable: yield_.stackable,
      // OSRS-ACCURACY: Include fishing priority rolling fields
      levelRequired: yield_.levelRequired,
      catchLow: yield_.catchLow,
      catchHigh: yield_.catchHigh,
    }));
  }

  /**
   * Create a Resource from a spawn point - ALL values come from resources.json manifest
   * No hardcoded values - manifest is the single source of truth
   */
  private createResourceFromSpawnPoint(
    spawnPoint: TerrainResourceSpawnPoint,
  ): Resource | undefined {
    const { position, type } = spawnPoint;

    // Map spawn type to resource type for manifest lookup
    const resourceType: "tree" | "fishing_spot" | "ore" | "herb_patch" =
      type === "rock" || type === "ore" || type === "gem" || type === "rare_ore"
        ? "ore"
        : type === "fish"
          ? "fishing_spot"
          : type === "herb"
            ? "herb_patch"
            : "tree";

    // Build variant key for manifest lookup
    // e.g., "tree_normal", "tree_oak", "ore_copper", "fishing_spot_normal"
    // Uses subType if available, otherwise defaults to "_normal"
    const variantKey = spawnPoint.subType
      ? `${resourceType}_${spawnPoint.subType}`
      : `${resourceType}_normal`;

    // Get manifest data - fail fast if not found
    const manifestData = getExternalResource(variantKey);
    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    // OSRS-ACCURACY: Snap position to tile center for proper face direction and interaction
    // This ensures resources are always at tile centers (e.g., 15.5, -9.5) not corners (15, -10)
    const snappedPosition = snapToTileCenter(position);

    // Duel arena tiles should not contain harvestable resources or trees.
    if (isPositionInsideDuelArenaZone(snappedPosition.x, snappedPosition.z)) {
      return undefined;
    }

    // All values come from manifest - no hardcoding
    const resource: Resource = {
      id: `${type}_${snappedPosition.x.toFixed(0)}_${snappedPosition.z.toFixed(0)}`,
      type: resourceType,
      name: manifestData.name,
      position: {
        x: snappedPosition.x,
        y: snappedPosition.y,
        z: snappedPosition.z,
      },
      skillRequired: manifestData.harvestSkill,
      levelRequired: manifestData.levelRequired,
      toolRequired: manifestData.toolRequired || "",
      secondaryRequired: manifestData.secondaryRequired,
      respawnTime: this.ticksToMs(manifestData.respawnTicks),
      isAvailable: true,
      lastDepleted: 0,
      drops: this.getDropsFromManifest(variantKey),
    };

    return resource;
  }

  /**
   * Handle terrain tile unloading - remove resources from unloaded tiles
   * Note: Manifest resources (from world-areas.json) are protected and never deleted
   */
  private onTerrainTileUnloaded(data: { tileId: string }): void {
    // Extract tileX and tileZ from tileId (format: "x,z")
    const [tileX, tileZ] = data.tileId.split(",").map(Number);

    // Remove resources that belong to this tile (but not manifest resources)
    for (const [resourceId, resource] of this.resources) {
      // Skip manifest resources - they are permanent and shouldn't be deleted on tile unload
      if (this.manifestResourceIds.has(resourceId)) {
        continue;
      }

      // Check if resource belongs to this tile (based on position)
      const resourceTileX = Math.floor(resource.position.x / 100); // 100m tile size
      const resourceTileZ = Math.floor(resource.position.z / 100);

      if (resourceTileX === tileX && resourceTileZ === tileZ) {
        this.resources.delete(resourceId);

        // Clean up any active gathering on this resource
        // Note: activeGathering is keyed by PlayerID, not ResourceID
        // We need to find and remove any gathering sessions for this resource
        for (const [playerId, session] of this.activeGathering) {
          if (session.resourceId === resourceId) {
            this.activeGathering.delete(playerId);
          }
        }
      }
    }
  }

  /**
   * Start a gathering session for a player on a resource
   *
   * Validates:
   * - Rate limit not exceeded (600ms between requests)
   * - Resource ID format is valid (security)
   * - Resource exists and is available
   * - Player has required skill level (from manifest levelRequired)
   * - Player has required tool category (from manifest toolRequired)
   * - Tool level requirement met (from TOOL_TIERS)
   *
   * Creates tick-based gathering session processed by processGatheringTick().
   * Session data is cached at start to avoid per-tick allocations.
   *
   * @param data.playerId - Player attempting to gather
   * @param data.resourceId - Target resource entity ID
   * @param data.playerPosition - Player position (used for proximity fallback)
   *
   * @emits RESOURCE_GATHERING_STARTED on successful session start
   * @emits UI_MESSAGE on validation failure with error details
   *
   * @example
   * ```typescript
   * world.emit(EventType.RESOURCE_GATHER, {
   *   playerId: 'player_123',
   *   resourceId: 'tree_50_100',
   *   playerPosition: { x: 50, y: 0, z: 100 },
   * });
   * ```
   */
  private startGathering(data: {
    playerId: string;
    resourceId: string;
    playerPosition: { x: number; y: number; z: number };
  }): void {
    // Only server should handle actual gathering logic
    if (!this.world.isServer) {
      return;
    }

    const playerId = createPlayerID(data.playerId);

    // ===== SECURITY: Rate limiting - prevent gather request spam =====
    // Silently drops requests faster than 1 tick (600ms), just like OSRS
    // This allows normal spam clicking without punishment
    const now = Date.now();
    const lastAttempt = this.gatherRateLimits.get(playerId);
    if (lastAttempt && now - lastAttempt < GATHERING_CONSTANTS.RATE_LIMIT_MS) {
      // Silently drop rapid requests (OSRS behavior - no punishment for spam clicking)
      return;
    }
    this.gatherRateLimits.set(playerId, now);

    // ===== SECURITY: Validate resource ID format =====
    if (!this.isValidResourceId(data.resourceId)) {
      console.warn(
        "[ResourceSystem] Invalid resource ID format:",
        data.resourceId,
      );
      return;
    }

    const resourceId = createResourceID(data.resourceId);

    let resource = this.resources.get(resourceId);

    if (!resource) {
      for (const r of this.resources.values()) {
        const derived = `${r.type}_${Math.round(r.position.x)}_${Math.round(r.position.z)}`;
        if (derived === (data.resourceId || "")) {
          resource = r;
          break;
        }
      }
    }

    if (!resource) {
      let nearest: Resource | null = null;
      let nearestDist = Infinity;
      for (const r of this.resources.values()) {
        if (!r.isAvailable) continue;
        const d = calculateDistance(data.playerPosition, r.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = r;
        }
      }
      if (
        nearest &&
        nearestDist < GATHERING_CONSTANTS.PROXIMITY_SEARCH_RADIUS
      ) {
        console.warn(
          "[ResourceSystem] Matched nearest resource",
          nearest.id,
          "at",
          nearestDist.toFixed(2),
          "m",
        );
        resource = nearest;
      } else {
        console.warn(
          "[ResourceSystem] Resource not found for id",
          data.resourceId,
          "available ids:",
          Array.from(this.resources.keys()).slice(0, 10),
        );
        this.sendChat(data.playerId, `Resource not found. Please try again.`);
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `Resource not found: ${data.resourceId}`,
          type: "error",
        });
        return;
      }
    }

    // ===== FIX #488: Prevent duplicate sessions on spam click =====
    // Check AFTER resource resolution so we compare the exact resolved resource ID
    const existingSession = this.activeGathering.get(playerId);
    if (existingSession) {
      // If already gathering this EXACT resource, silently ignore (prevents duplicate rewards)
      if (existingSession.resourceId === resource.id) {
        return;
      }
      // If switching to a DIFFERENT resource, cancel the old session first
      this.cancelGatheringForPlayer(playerId, "switch_resource");
    }

    // Check if resource is available
    if (!resource.isAvailable) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `This ${resource.type.replace("_", " ")} is depleted. Please wait for it to respawn.`,
        type: "info",
      });
      return;
    }

    // ===== CARDINAL ADJACENCY CHECK =====
    // Validate player is on a cardinal tile (N/E/S/W) adjacent to the resource
    // This prevents gathering while standing ON the resource or from diagonal tiles
    const footprint = resource.footprint || "standard";
    const size = FOOTPRINT_SIZES[footprint];
    const resourceAnchorTile = worldToTile(
      resource.position.x,
      resource.position.z,
    );
    const playerTile = worldToTile(
      data.playerPosition.x,
      data.playerPosition.z,
    );

    // FISHING: Use simple world-distance check (shore/water boundary doesn't align with tiles)
    // OTHER SKILLS: Use strict tile-based cardinal adjacency
    const isFishing = resource.skillRequired === "fishing";

    if (isFishing) {
      // Fishing uses 2D (X/Z) world-distance check - player can be up to 4m away from the fishing spot
      // This is more forgiving since the player stands on shore and casts into water
      // IMPORTANT: Use 2D distance because fishing spots are in water (different Y than player on shore)
      // This matches PendingGatherManager which also uses 2D distance for fishing arrival checks
      const FISHING_INTERACTION_RANGE = 4.0; // meters
      const worldDistance = calculateDistance2D(
        data.playerPosition,
        resource.position,
      );

      if (worldDistance > FISHING_INTERACTION_RANGE) {
        console.warn(
          `[ResourceSystem] Player ${data.playerId} at (${data.playerPosition.x.toFixed(1)}, ${data.playerPosition.z.toFixed(1)}) ` +
            `is ${worldDistance.toFixed(1)}m from fishing spot at (${resource.position.x.toFixed(1)}, ${resource.position.z.toFixed(1)}). ` +
            `Max range: ${FISHING_INTERACTION_RANGE}m. Rejecting gather.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `Move closer to the fishing spot.`,
          type: "info",
        });
        return;
      }

      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] ✅ Player ${data.playerId} is ${worldDistance.toFixed(1)}m from fishing spot (max ${FISHING_INTERACTION_RANGE}m). Proceeding with fishing.`,
        );
      }
    } else {
      // Non-fishing resources use strict tile-based cardinal adjacency
      // Check if player is standing ON the resource
      const isOnResource =
        playerTile.x >= resourceAnchorTile.x &&
        playerTile.x < resourceAnchorTile.x + size.x &&
        playerTile.z >= resourceAnchorTile.z &&
        playerTile.z < resourceAnchorTile.z + size.z;

      if (isOnResource) {
        console.warn(
          `[ResourceSystem] Player ${data.playerId} at tile (${playerTile.x}, ${playerTile.z}) is ON resource ` +
            `at anchor (${resourceAnchorTile.x}, ${resourceAnchorTile.z}) with footprint ${size.x}x${size.z}. Rejecting gather.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You can't gather while standing on the resource. Move to an adjacent tile.`,
          type: "error",
        });
        return;
      }

      // Check if player is on a cardinal adjacent tile (not diagonal)
      const isOnCardinal = isCardinallyAdjacentToResource(
        playerTile,
        resourceAnchorTile,
        size.x,
        size.z,
      );

      if (!isOnCardinal) {
        console.warn(
          `[ResourceSystem] Player ${data.playerId} at tile (${playerTile.x}, ${playerTile.z}) is NOT on cardinal tile ` +
            `adjacent to resource at (${resourceAnchorTile.x}, ${resourceAnchorTile.z}). Rejecting gather.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `Move closer to the ${resource.name.toLowerCase()}.`,
          type: "info",
        });
        return;
      }

      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] ✅ Player ${data.playerId} at tile (${playerTile.x}, ${playerTile.z}) is on CARDINAL tile ` +
            `adjacent to resource at anchor (${resourceAnchorTile.x}, ${resourceAnchorTile.z}). Proceeding with gather.`,
        );
      }
    }

    // Check player skill level (reactive pattern)
    const cachedSkills = this.playerSkills.get(data.playerId);
    const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;

    if (
      resource.levelRequired !== undefined &&
      skillLevel < resource.levelRequired
    ) {
      this.resetGatheringEmote(data.playerId);
      this.sendChat(
        data.playerId,
        `You need level ${resource.levelRequired} ${resource.skillRequired} to use this resource.`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `You need level ${resource.levelRequired} ${resource.skillRequired} to use this resource.`,
        type: "error",
      });
      return;
    }

    // Tool check using manifest's toolRequired field (RuneScape-style: any tier qualifies; tier affects speed)
    if (resource.toolRequired) {
      const toolCategory = this.getToolCategory(resource.toolRequired);
      const hasTool = this.playerHasToolCategory(data.playerId, toolCategory);

      if (!hasTool) {
        this.resetGatheringEmote(data.playerId);
        const toolName = this.getToolDisplayName(toolCategory);
        this.sendChat(
          data.playerId,
          `You need a ${toolName} to harvest the ${resource.name.toLowerCase()}.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need a ${toolName} to harvest the ${resource.name.toLowerCase()}.`,
          type: "error",
        });
        return;
      }

      // Enforce tool level requirement using manifest-driven tool system
      const bestTool = this.getBestTool(data.playerId, resource.skillRequired);
      if (bestTool) {
        const cached = this.playerSkills.get(data.playerId);
        const currentSkillLevel = cached?.[resource.skillRequired]?.level ?? 1;
        if (currentSkillLevel < bestTool.levelRequired) {
          this.resetGatheringEmote(data.playerId);
          const toolName = this.getToolDisplayName(toolCategory);
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: data.playerId,
            message: `You need level ${bestTool.levelRequired} ${resource.skillRequired} to use this ${toolName}.`,
            type: "error",
          });
          return;
        }
      }
    }

    // OSRS-ACCURACY: Check for secondary consumable (bait, feathers, etc.)
    // @see https://oldschool.runescape.wiki/w/Fishing - "Bait fishing requires fishing bait"
    if (resource.secondaryRequired) {
      const hasSecondary = this.playerHasItem(
        data.playerId,
        resource.secondaryRequired,
      );
      if (!hasSecondary) {
        this.resetGatheringEmote(data.playerId);
        const secondaryName = resource.secondaryRequired.replace(/_/g, " ");
        this.sendChat(data.playerId, `You need ${secondaryName} to fish here.`);
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need ${secondaryName} to fish here.`,
          type: "error",
        });
        return;
      }
    }

    // If player is already gathering, replace session with the latest request
    if (this.activeGathering.has(playerId)) {
      this.activeGathering.delete(playerId);
    }

    // Start RS-like timed gathering session with OSRS-accurate messages
    const resourceName = resource.name || resource.type.replace("_", " ");

    // OSRS-ACCURACY: Skill-specific gathering start messages
    // @see https://oldschool.runescape.wiki/w/Woodcutting
    // @see https://oldschool.runescape.wiki/w/Mining
    // @see https://oldschool.runescape.wiki/w/Fishing
    const gatheringStartMessage = (() => {
      switch (resource.skillRequired) {
        case "woodcutting":
          return `You swing your axe at the ${resourceName.toLowerCase()}.`;
        case "mining":
          return `You swing your pickaxe at the ${resourceName.toLowerCase()}.`;
        case "fishing":
          return "You attempt to catch some fish.";
        default:
          return `You start gathering from the ${resourceName.toLowerCase()}.`;
      }
    })();

    // Create tick-based session
    const sessionResourceId = createResourceID(resource.id);

    // Get current tick from world (OSRS-accurate tick-based timing)
    const currentTick = this.world.currentTick || 0;

    // Compute tick-based cycle interval
    const variant =
      this.resourceVariants.get(sessionResourceId) || "tree_normal";
    const tuned = this.getVariantTuning(variant);

    // Get best tool tier using unified tool system
    const toolInfo = this.getBestTool(data.playerId, resource.skillRequired);

    // OSRS-ACCURATE: Compute cycle ticks based on skill-specific mechanics
    // - Woodcutting: Fixed 4 ticks (axe affects success rate, not speed)
    // - Mining: Variable ticks based on pickaxe tier
    // - Fishing: Fixed 5 ticks
    const cycleTickInterval = this.computeCycleTicks(
      resource.skillRequired,
      tuned,
      toolInfo,
    );

    // PERFORMANCE: Pre-compute success rate to avoid per-tick calculation
    // OSRS-ACCURATE: Uses LERP formula with skill-specific tables
    // - Woodcutting: Tree type + axe tier determines success
    // - Mining/Fishing: Resource type only (tool doesn't affect success)
    const successRate = this.computeSuccessRate(
      skillLevel,
      resource.skillRequired,
      variant,
      toolInfo?.tier ?? null,
    );

    // OSRS-ACCURACY: Get server-authoritative player position for movement detection
    const player = this.world.getPlayer?.(data.playerId);
    const startPosition = player?.position
      ? { x: player.position.x, y: player.position.y, z: player.position.z }
      : {
          x: data.playerPosition.x,
          y: data.playerPosition.y,
          z: data.playerPosition.z,
        };

    // OSRS-ACCURACY: Rotate player to face the resource (instant rotation like OSRS)
    // This happens before session starts so animation plays in correct direction
    const footprintForRotation = resource.footprint || "standard";
    if (DEBUG_GATHERING) {
      console.log(
        `[ResourceSystem] startGathering: Calling rotatePlayerToFaceResource for ${data.playerId}, ` +
          `resource at (${resource.position.x.toFixed(1)}, ${resource.position.z.toFixed(1)}), ` +
          `footprint=${footprintForRotation}, player at (${startPosition.x.toFixed(1)}, ${startPosition.z.toFixed(1)})`,
      );
    }
    this.rotatePlayerToFaceResource(
      data.playerId,
      resource.position,
      footprintForRotation,
    );

    // Get low/high values for debug logging
    const toolTier = toolInfo?.tier ?? null;
    const lowHigh = this.getSuccessRateValues(
      resource.skillRequired,
      variant,
      toolTier,
    );

    // Schedule first attempt on next tick with CACHED data
    this.activeGathering.set(playerId, {
      playerId,
      resourceId: sessionResourceId,
      startTick: currentTick,
      nextAttemptTick: currentTick + 1, // First attempt next tick
      cycleTickInterval,
      attempts: 0,
      successes: 0,
      // Store skill and tool for visual display
      skill: resource.skillRequired,
      toolItemId: toolInfo?.itemId ?? null,
      // PERFORMANCE: Cache everything needed during tick processing
      cachedTuning: tuned,
      cachedSuccessRate: successRate,
      cachedDrops: resource.drops,
      cachedResourceName: resourceName,
      // OSRS-ACCURACY: Store position to detect movement (any movement cancels gathering)
      cachedStartPosition: startPosition,
      // DEBUG: Store for logging (only used when DEBUG_GATHERING=true)
      debugInfo: DEBUG_GATHERING
        ? {
            skill: resource.skillRequired,
            variant,
            toolTier,
            lowHigh,
          }
        : undefined,
    });

    // DEBUG: Log session start with OSRS mechanics details
    if (DEBUG_GATHERING) {
      const mechanics =
        GATHERING_CONSTANTS.SKILL_MECHANICS[
          resource.skillRequired as keyof typeof GATHERING_CONSTANTS.SKILL_MECHANICS
        ];
      console.log(
        `[Gathering DEBUG] ═══════════════════════════════════════════════════════`,
      );
      console.log(`[Gathering DEBUG] Session started for ${playerId}`);
      console.log(
        `[Gathering DEBUG] Resource: ${variant} (${resource.skillRequired})`,
      );
      console.log(
        `[Gathering DEBUG] Tool: ${toolInfo?.itemId ?? "none"} (tier: ${toolTier ?? "none"})`,
      );
      console.log(
        `[Gathering DEBUG] Mechanics: ${mechanics?.type ?? "unknown"}`,
      );
      console.log(
        `[Gathering DEBUG] Cycle: ${cycleTickInterval} ticks (${(cycleTickInterval * 0.6).toFixed(1)}s)`,
      );
      console.log(
        `[Gathering DEBUG] Success Rate: ${(successRate * 100).toFixed(1)}% (low=${lowHigh.low}, high=${lowHigh.high}, level=${skillLevel})`,
      );
      console.log(
        `[Gathering DEBUG] ═══════════════════════════════════════════════════════`,
      );
    }

    // FORESTRY: Track as active gatherer for timer-based resources
    this.addActiveGatherer(playerId, sessionResourceId, currentTick);

    // Set gathering emote based on skill (generalized)
    const skillEmotes: Record<string, string> = {
      woodcutting: "chopping",
      mining: "mining",
      fishing: "fishing",
    };
    const emote = skillEmotes[resource.skillRequired] ?? resource.skillRequired;
    this.setGatheringEmote(data.playerId, emote);

    // Emit gathering started event with tick timing info for client progress bar
    this.emitTypedEvent(EventType.RESOURCE_GATHERING_STARTED, {
      playerId: data.playerId,
      resourceId: resource.id,
      skill: resource.skillRequired,
      cycleTicks: cycleTickInterval,
      tickDurationMs: TICK_DURATION_MS,
    });

    // OSRS-STYLE: Show gathering tool in hand during gathering skills
    // Tool appears in hand even though it's in inventory, not equipped as a weapon
    if (toolInfo?.itemId) {
      this.emitTypedEvent(EventType.GATHERING_TOOL_SHOW, {
        playerId: data.playerId,
        itemId: toolInfo.itemId,
        slot: "weapon",
      });
    }

    // OSRS-ACCURACY: Send OSRS-style gathering start message via chat and UI
    this.sendChat(data.playerId, gatheringStartMessage);
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: gatheringStartMessage,
      type: "info",
    });

    // Broadcast toast to client via network
    this.sendNetworkMessage("showToast", {
      playerId: data.playerId,
      message: gatheringStartMessage,
      type: "info",
    });
  }

  private stopGathering(data: { playerId: string | PlayerID }): void {
    const playerId = createPlayerID(data.playerId);
    const session = this.activeGathering.get(playerId);
    if (session) {
      // FORESTRY: Remove from active gatherers (timer will regenerate if no other gatherers)
      this.removeActiveGatherer(playerId, session.resourceId);

      this.activeGathering.delete(playerId);

      // Reset emote back to idle when gathering stops
      this.resetGatheringEmote(data.playerId);

      // OSRS-STYLE: Hide gathering tool visual when gathering stops
      if (session.toolItemId) {
        this.emitTypedEvent(EventType.GATHERING_TOOL_HIDE, {
          playerId: data.playerId,
          slot: "weapon",
        });
      }

      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: data.playerId,
        resourceId: session.resourceId,
      });
    }
  }

  private cleanupPlayerGathering(playerId: string): void {
    const pid = createPlayerID(playerId);
    const session = this.activeGathering.get(pid);

    if (session) {
      // SECURITY: Track rapid disconnect during active gather (potential bot/exploit)
      const now = Date.now();
      const patterns = this.suspiciousPatterns.get(pid) || {
        rapidDisconnects: 0,
        lastDisconnect: 0,
        rapidGatherAttempts: 0,
        lastAttempt: 0,
      };

      // Check for rapid disconnect pattern (multiple disconnects within 5s while gathering)
      if (now - patterns.lastDisconnect < 5000) {
        patterns.rapidDisconnects++;
        if (patterns.rapidDisconnects > 3) {
          this.logSuspiciousPattern(
            pid,
            `rapid-disconnect-during-gather (${patterns.rapidDisconnects}x in 5s)`,
          );
        }
      } else {
        // Reset counter if >5s since last disconnect
        patterns.rapidDisconnects = 1;
      }
      patterns.lastDisconnect = now;
      this.suspiciousPatterns.set(pid, patterns);

      // OSRS-STYLE: Hide gathering tool visual if fishing
      if (session.skill === "fishing" && session.toolItemId) {
        this.emitTypedEvent(EventType.GATHERING_TOOL_HIDE, {
          playerId: playerId,
          slot: "weapon",
        });
      }

      // FORESTRY: Remove from active gatherers before deleting session
      this.removeActiveGatherer(pid, session.resourceId);
    }
    this.activeGathering.delete(pid);
    // SECURITY: Clean up rate limit tracking on disconnect
    this.gatherRateLimits.delete(pid);
  }

  /**
   * Log suspicious activity pattern for security monitoring.
   * Could be extended to emit to analytics system or trigger alerts.
   *
   * @param playerId - Player exhibiting suspicious behavior
   * @param pattern - Description of the suspicious pattern
   */
  private logSuspiciousPattern(playerId: PlayerID, pattern: string): void {
    console.warn(
      `[Security] Suspicious pattern detected: ${pattern} for player ${playerId}`,
    );
    // Could emit to analytics system for monitoring
    // this.emitTypedEvent(EventType.SECURITY_ALERT, { playerId, pattern });
  }

  /**
   * Cancel gathering for a player due to an action/event (OSRS weak queue behavior)
   * Used by event subscriptions to cancel gathering when player performs another action.
   *
   * @param playerId - The player whose gathering should be cancelled
   * @param reason - Debug reason for logging (e.g., "died", "teleported", "combat")
   */
  private cancelGatheringForPlayer(playerId: string, reason: string): void {
    const pid = createPlayerID(playerId);
    const session = this.activeGathering.get(pid);
    if (session) {
      console.warn(
        `[ResourceSystem] Cancelling gather for ${playerId} - reason: ${reason} skill=${session.skill}`,
      );
      // FORESTRY: Remove from active gatherers (timer will regenerate if no other gatherers)
      this.removeActiveGatherer(pid, session.resourceId);

      // OSRS-STYLE: Hide gathering tool visual if fishing
      if (session.skill === "fishing" && session.toolItemId) {
        this.emitTypedEvent(EventType.GATHERING_TOOL_HIDE, {
          playerId: playerId,
          slot: "weapon",
        });
      }

      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: playerId,
        resourceId: session.resourceId,
      });
      this.resetGatheringEmote(playerId);
      this.activeGathering.delete(pid);
    }
  }

  /**
   * Set face target for player to face a resource (OSRS-accurate deferred rotation)
   *
   * OSRS-ACCURACY: Face direction is NOT applied immediately. Instead:
   * 1. A faceTarget is set on the player
   * 2. At END of the server tick, if player did NOT move, rotation is applied
   * 3. If player moved, rotation is skipped but faceTarget persists
   * 4. Player will face the resource when they eventually stop moving
   *
   * For multi-tile resources (2×2, 3×3), the player faces the center of the
   * occupied tile area, not just a single tile.
   *
   * @see https://osrs-docs.com/docs/packets/outgoing/updating/masks/face-direction/
   *
   * @param playerId - The player to set face target for
   * @param resourcePosition - The position of the resource (tile-centered)
   * @param footprint - The resource's tile footprint (defaults to "standard")
   */
  private rotatePlayerToFaceResource(
    playerId: string,
    resourcePosition: { x: number; y: number; z: number },
    footprint: ResourceFootprint = "standard",
  ): void {
    // OSRS-ACCURACY: Use FaceDirectionManager for deferred tick-end processing
    // The manager will apply rotation at end of tick only if player didn't move
    //
    // CARDINAL-ONLY: Uses deterministic cardinal face direction for AAA quality.
    // Player standing N of resource faces S, E faces W, S faces N, W faces E.
    const faceManager = (
      this.world as {
        faceDirectionManager?: {
          setFaceTarget: (playerId: string, x: number, z: number) => void;
          setCardinalFaceTarget: (
            playerId: string,
            anchorTile: { x: number; z: number },
            footprintX: number,
            footprintZ: number,
          ) => void;
        };
      }
    ).faceDirectionManager;

    if (faceManager) {
      const size = FOOTPRINT_SIZES[footprint];
      const anchorTile = worldToTile(resourcePosition.x, resourcePosition.z);

      if (DEBUG_GATHERING) {
        console.log(
          `[ResourceSystem] rotatePlayerToFaceResource: ` +
            `resourcePos=(${resourcePosition.x.toFixed(1)}, ${resourcePosition.z.toFixed(1)}), ` +
            `anchorTile=(${anchorTile.x}, ${anchorTile.z}), size=${size.x}x${size.z}`,
        );
      }

      // Use cardinal-only face direction for deterministic behavior
      if (faceManager.setCardinalFaceTarget) {
        if (DEBUG_GATHERING) {
          console.log(`[ResourceSystem] Using setCardinalFaceTarget`);
        }
        faceManager.setCardinalFaceTarget(playerId, anchorTile, size.x, size.z);
      } else {
        // Fallback to legacy center-based targeting
        if (DEBUG_GATHERING) {
          console.log(
            `[ResourceSystem] FALLBACK: Using setFaceTarget (no setCardinalFaceTarget)`,
          );
        }
        const targetX = anchorTile.x + size.x / 2;
        const targetZ = anchorTile.z + size.z / 2;
        faceManager.setFaceTarget(playerId, targetX, targetZ);
      }
    } else {
      console.warn(
        `[ResourceSystem] rotatePlayerToFaceResource: No faceManager found!`,
      );
    }
  }

  /**
   * Process resource timers for Forestry-style depletion/regeneration.
   * Called every tick to:
   * - Decrement timers for resources being gathered
   * - Regenerate timers for resources not being gathered
   *
   * @param tickNumber - Current server tick
   */
  private processResourceTimers(tickNumber: number): void {
    for (const [resourceId, timer] of this.resourceTimers) {
      const ticksDelta = tickNumber - timer.lastUpdateTick;
      timer.lastUpdateTick = tickNumber;

      if (timer.activeGatherers.size > 0 && timer.hasReceivedFirstLog) {
        // Being gathered AND first log received - decrement timer
        // OSRS-ACCURACY: Timer only counts down AFTER first log is received
        const oldTicks = timer.currentTicks;
        timer.currentTicks = Math.max(
          0,
          timer.currentTicks -
            ticksDelta * GATHERING_CONSTANTS.TIMER_REGEN_PER_TICK,
        );
        if (oldTicks !== timer.currentTicks) {
          if (DEBUG_GATHERING) {
            console.log(
              `[Forestry] ⏬ ${resourceId}: timer ${oldTicks} → ${timer.currentTicks} ` +
                `(${timer.activeGatherers.size} gatherer${timer.activeGatherers.size > 1 ? "s" : ""})`,
            );
          }
        }
      } else if (
        timer.activeGatherers.size === 0 &&
        timer.hasReceivedFirstLog
      ) {
        // Not being gathered but was started - regenerate
        const oldTicks = timer.currentTicks;
        timer.currentTicks = Math.min(
          timer.maxTicks,
          timer.currentTicks +
            ticksDelta * GATHERING_CONSTANTS.TIMER_REGEN_PER_TICK,
        );

        if (oldTicks !== timer.currentTicks) {
          if (DEBUG_GATHERING) {
            console.log(
              `[Forestry] ⏫ ${resourceId}: timer REGEN ${oldTicks} → ${timer.currentTicks}/${timer.maxTicks} (no gatherers)`,
            );
          }
        }

        // If fully regenerated, reset the "first log" state
        if (timer.currentTicks >= timer.maxTicks) {
          if (DEBUG_GATHERING) {
            console.log(
              `[Forestry] ✅ ${resourceId}: timer FULLY REGENERATED - resetting firstLog flag`,
            );
          }
          timer.hasReceivedFirstLog = false;
        }
      }
    }
  }

  /**
   * Add a player to a resource's active gatherers set.
   * Creates the timer structure if it doesn't exist (for Forestry resources).
   *
   * @param playerId - Player starting to gather
   * @param resourceId - Resource being gathered
   * @param tickNumber - Current tick for timer initialization
   */
  private addActiveGatherer(
    playerId: PlayerID,
    resourceId: ResourceID,
    tickNumber: number,
  ): void {
    // Only track for timer-based resources
    const despawnTicks = this.getResourceDespawnTicks(resourceId);
    if (despawnTicks <= 0) {
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] ℹ️ ${resourceId}: NOT timer-based (despawnTicks=0), using chance depletion`,
        );
      }
      return;
    }

    let timer = this.resourceTimers.get(resourceId);
    if (!timer) {
      // Create timer structure (but don't start countdown yet - that's on first log)
      timer = {
        currentTicks: despawnTicks,
        maxTicks: despawnTicks,
        hasReceivedFirstLog: false,
        activeGatherers: new Set(),
        lastUpdateTick: tickNumber,
      };
      this.resourceTimers.set(resourceId, timer);
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] 🌲 ${resourceId}: Created timer structure (${despawnTicks} ticks max)`,
        );
      }
    }

    timer.activeGatherers.add(playerId);
    if (DEBUG_GATHERING) {
      console.log(
        `[Forestry] 👤+ ${resourceId}: Added gatherer ${playerId} ` +
          `(now ${timer.activeGatherers.size} total, timer=${timer.currentTicks}/${timer.maxTicks}, started=${timer.hasReceivedFirstLog})`,
      );
    }
  }

  /**
   * Remove a player from a resource's active gatherers set.
   *
   * @param playerId - Player stopping gathering
   * @param resourceId - Resource that was being gathered
   */
  private removeActiveGatherer(
    playerId: PlayerID,
    resourceId: ResourceID,
  ): void {
    const timer = this.resourceTimers.get(resourceId);
    if (timer) {
      const hadPlayer = timer.activeGatherers.has(playerId);
      timer.activeGatherers.delete(playerId);
      if (hadPlayer) {
        if (DEBUG_GATHERING) {
          console.log(
            `[Forestry] 👤- ${resourceId}: Removed gatherer ${playerId} ` +
              `(now ${timer.activeGatherers.size} total, timer=${timer.currentTicks}/${timer.maxTicks})` +
              (timer.activeGatherers.size === 0 && timer.hasReceivedFirstLog
                ? " - will start REGENERATING"
                : ""),
          );
        }
      }
    }
  }

  /**
   * Handle receiving a log from a Forestry-timer resource.
   * Initializes the timer on first log and checks for depletion.
   *
   * @param playerId - Player who received the log
   * @param resourceId - Resource being gathered
   * @param tickNumber - Current tick
   * @returns true if resource should deplete, false otherwise
   */
  private handleForestryLog(
    playerId: PlayerID,
    resourceId: ResourceID,
    tickNumber: number,
  ): boolean {
    const timer = this.resourceTimers.get(resourceId);
    if (!timer) {
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] ⚠️ ${resourceId}: handleForestryLog called but no timer exists!`,
        );
      }
      return false;
    }

    // First log starts the timer countdown
    if (!timer.hasReceivedFirstLog) {
      timer.hasReceivedFirstLog = true;
      timer.lastUpdateTick = tickNumber;
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] 🪵 ${resourceId}: FIRST LOG received by ${playerId}! ` +
            `Timer NOW ACTIVE: ${timer.currentTicks}/${timer.maxTicks} ticks`,
        );
      }
    } else {
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] 🪵 ${resourceId}: Log received by ${playerId}, ` +
            `timer=${timer.currentTicks}/${timer.maxTicks}`,
        );
      }
    }

    // Check if tree should deplete (timer at 0 AND player receives log)
    if (timer.currentTicks <= 0) {
      if (DEBUG_GATHERING) {
        console.log(
          `[Forestry] 🌳💥 ${resourceId}: Timer=0 AND log received - TREE FALLS! ` +
            `(${timer.activeGatherers.size} gatherers were active)`,
        );
      }
      // Clean up timer
      this.resourceTimers.delete(resourceId);
      return true; // Deplete the resource
    }

    return false; // Don't deplete yet
  }

  /**
   * Process resource respawns on tick (OSRS-accurate tick-based timing)
   * Replaces setTimeout-based respawn with deterministic tick counting
   */
  private processRespawns(tickNumber: number): void {
    // PERFORMANCE: Use pre-allocated buffer to avoid GC pressure
    const respawnedResources = this._respawnedResourcesBuffer;
    respawnedResources.length = 0;

    for (const [resourceId, respawnTick] of this.respawnAtTick.entries()) {
      if (tickNumber >= respawnTick) {
        const resource = this.resources.get(resourceId);
        if (resource) {
          resource.isAvailable = true;
          resource.lastDepleted = 0;

          // Call entity respawn method if available
          const ent = this.world.entities.get(resourceId);
          // ResourceEntity has a respawn method - check if entity is ResourceEntity
          const resourceEntity = ent as ResourceEntityMethods | undefined;
          if (resourceEntity?.respawn) {
            resourceEntity.respawn();
          }

          this.emitTypedEvent(EventType.RESOURCE_RESPAWNED, {
            resourceId: resourceId,
            position: resource.position,
          });
          this.sendNetworkMessage("resourceRespawned", {
            resourceId: resourceId,
            position: resource.position,
            depleted: false,
          });
        }
        respawnedResources.push(resourceId);
      }
    }

    // Clean up processed respawns
    for (const resourceId of respawnedResources) {
      this.respawnAtTick.delete(resourceId);
    }
  }

  /**
   * Initialize a fishing spot movement timer with random delay.
   * OSRS-ACCURACY: Fishing spots move periodically instead of depleting.
   */
  private initializeFishingSpotTimer(
    resourceId: ResourceID,
    position: { x: number; y: number; z: number },
  ): void {
    const currentTick = this.world.currentTick || 0;
    const { baseTicks, varianceTicks } = GATHERING_CONSTANTS.FISHING_SPOT_MOVE;

    // Random delay: baseTicks ± varianceTicks
    const randomVariance =
      Math.floor(Math.random() * varianceTicks * 2) - varianceTicks;
    const moveAtTick = currentTick + baseTicks + randomVariance;

    this.fishingSpotMoveTimers.set(resourceId, {
      moveAtTick,
      originalPosition: { ...position },
    });

    if (DEBUG_GATHERING) {
      console.log(
        `[Fishing] Initialized spot ${resourceId} move timer: will move at tick ${moveAtTick} (${((moveAtTick - currentTick) * 0.6).toFixed(0)}s)`,
      );
    }
  }

  /**
   * Process fishing spot movement on each tick.
   * OSRS-ACCURACY: Fishing spots don't deplete - they move to nearby tiles periodically.
   *
   * @see https://oldschool.runescape.wiki/w/Fishing
   */
  private processFishingSpotMovement(tickNumber: number): void {
    // PERFORMANCE: Use pre-allocated buffer to avoid GC pressure
    const spotsToMove = this._spotsToMoveBuffer;
    spotsToMove.length = 0;

    for (const [resourceId, timer] of this.fishingSpotMoveTimers.entries()) {
      if (tickNumber >= timer.moveAtTick) {
        spotsToMove.push(resourceId);
      }
    }

    for (const resourceId of spotsToMove) {
      this.relocateFishingSpot(resourceId, tickNumber);
    }
  }

  /**
   * Relocate a fishing spot to a nearby valid shore position.
   * Uses terrain-based shore detection to find valid water edges.
   * Cancels gathering for any players fishing at the old location.
   */
  private relocateFishingSpot(
    resourceId: ResourceID,
    _currentTick: number,
  ): void {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      this.fishingSpotMoveTimers.delete(resourceId);
      return;
    }

    const timer = this.fishingSpotMoveTimers.get(resourceId);
    if (!timer) return;

    // If no terrain system, stay put and try again later
    if (!this.terrainSystem) {
      this.initializeFishingSpotTimer(resourceId, resource.position);
      return;
    }

    const oldPos = resource.position;

    // Search for valid water edge points near current position
    const searchRadius = 15;
    const searchBounds = {
      minX: oldPos.x - searchRadius,
      maxX: oldPos.x + searchRadius,
      minZ: oldPos.z - searchRadius,
      maxZ: oldPos.z + searchRadius,
    };

    const nearbyWaterEdges = findWaterEdgePoints(
      searchBounds,
      this.terrainSystem.getHeightAt.bind(this.terrainSystem),
      {
        waterThreshold: TERRAIN_CONSTANTS.WATER_THRESHOLD,
        shoreMaxHeight: 20.0, // Higher to accommodate elevated island terrain
        minSpacing: 3, // Smaller spacing for relocation candidates
        sampleInterval: 2, // 2m sampling for relocation (4x faster, sufficient accuracy)
      },
    );

    // Filter out positions too close to current location (must move at least 5m)
    const candidates = nearbyWaterEdges.filter((p) => {
      const dist = Math.sqrt((p.x - oldPos.x) ** 2 + (p.z - oldPos.z) ** 2);
      return dist >= 5;
    });

    // If no valid spots nearby, stay put and try again later
    if (candidates.length === 0) {
      if (DEBUG_GATHERING) {
        console.log(
          `[Fishing] Spot ${resourceId} couldn't find new shore position - staying put`,
        );
      }
      this.initializeFishingSpotTimer(resourceId, resource.position);
      return;
    }

    // Pick random candidate
    const newPos = candidates[Math.floor(Math.random() * candidates.length)];

    // Cancel gathering for any players fishing at this spot
    for (const [playerId, session] of this.activeGathering.entries()) {
      if (session.resourceId === resourceId) {
        // Send message to player
        this.sendChat(playerId, "The fishing spot has moved!");
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId,
          message: "The fishing spot has moved!",
          type: "info",
        });

        // Stop gathering
        this.stopGathering({ playerId });
      }
    }

    // Update resource position
    resource.position = { x: newPos.x, y: newPos.y, z: newPos.z };

    // Update entity position if it exists
    const entity = this.world.entities.get(resourceId);
    if (entity?.position) {
      entity.position.x = newPos.x;
      entity.position.y = newPos.y;
      entity.position.z = newPos.z;
    }

    // Broadcast position update to clients
    this.sendNetworkMessage("fishingSpotMoved", {
      resourceId: resourceId,
      oldPosition: oldPos,
      newPosition: resource.position,
    });

    if (DEBUG_GATHERING) {
      console.log(
        `[Fishing] Spot ${resourceId} moved from ` +
          `(${oldPos.x.toFixed(1)}, ${oldPos.z.toFixed(1)}) to ` +
          `(${newPos.x.toFixed(1)}, ${newPos.z.toFixed(1)})`,
      );
    }

    // Reset timer for next movement
    this.initializeFishingSpotTimer(resourceId, resource.position);
  }

  /**
   * Process all active gathering sessions on each server tick (OSRS-accurate 600ms)
   *
   * Called by TickSystem at RESOURCES priority. Handles:
   * 1. Resource respawn checks (tick-based, not setTimeout)
   * 2. Proximity validation (server-authoritative position)
   * 3. Inventory capacity checks
   * 4. Success/failure rolls using cached success rate
   * 5. Drop rolling from manifest harvestYield
   * 6. XP awards and inventory updates
   * 7. Resource depletion with tick-based respawn scheduling
   *
   * Uses cached session data to avoid per-tick allocations (performance).
   * Sessions are cleaned up immediately when conditions fail.
   *
   * @param tickNumber - Current server tick number for timing calculations
   *
   * @emits INVENTORY_ITEM_ADDED on successful gather
   * @emits SKILLS_XP_GAINED on successful gather
   * @emits RESOURCE_GATHERING_STOPPED when session ends
   * @emits RESOURCE_DEPLETED when resource is exhausted
   */
  public processGatheringTick(tickNumber: number): void {
    // Process respawns first (tick-based)
    this.processRespawns(tickNumber);

    // OSRS-ACCURACY: Process fishing spot movement
    this.processFishingSpotMovement(tickNumber);

    // FORESTRY: Process resource timers (depletion/regeneration)
    this.processResourceTimers(tickNumber);

    // Process active gathering sessions
    // PERFORMANCE: Use pre-allocated buffer to avoid GC pressure
    const completedSessions = this._completedSessionsBuffer;
    completedSessions.length = 0;

    for (const [playerId, session] of this.activeGathering.entries()) {
      const resource = this.resources.get(session.resourceId);
      if (!resource?.isAvailable) {
        // Resource depleted, end session
        console.warn(
          `[ResourceSystem] Gathering cancelled: resource ${session.resourceId} not available/not found`,
        );
        completedSessions.push(playerId);
        continue;
      }

      // Only process when it's time for the next attempt (tick-based)
      if (tickNumber < session.nextAttemptTick) {
        if (session.attempts === 0) {
          // Log once per session to detect stuck sessions
          const key = `${playerId}_${session.startTick}`;
          if (
            !this._stuckSessionLog?.has(key) &&
            tickNumber > session.startTick + 2
          ) {
            this._stuckSessionLog = this._stuckSessionLog || new Set<string>();
            this._stuckSessionLog.add(key);
            console.warn(
              `[ResourceSystem] Session for ${playerId} stuck: tickNumber=${tickNumber} nextAttemptTick=${session.nextAttemptTick} startTick=${session.startTick} resourceId=${session.resourceId}`,
            );
          }
        }
        continue;
      }

      // OSRS-ACCURACY: Server-authoritative movement detection
      // In OSRS, ANY movement cancels gathering (weak queue action)
      // Position is fetched from world state, never from client payload
      const p = this.world.getPlayer?.(playerId);
      const playerPos =
        p && (p as { position?: { x: number; y: number; z: number } }).position
          ? (p as { position: { x: number; y: number; z: number } }).position
          : null;

      if (!playerPos) {
        // Player not found - cancel session
        console.warn(
          `[ResourceSystem] Gathering cancelled: player ${playerId} not found (getPlayer returned null)`,
        );
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId,
          resourceId: session.resourceId,
        });
        completedSessions.push(playerId);
        continue;
      }

      // Check if player moved from their starting position (OSRS: any movement cancels)
      const startPos = session.cachedStartPosition;
      const epsilon = GATHERING_CONSTANTS.POSITION_EPSILON;
      const movedX = Math.abs(playerPos.x - startPos.x) > epsilon;
      const movedZ = Math.abs(playerPos.z - startPos.z) > epsilon;

      if (movedX || movedZ) {
        // Player moved - cancel gathering (OSRS: weak queue cancelled on any movement)
        console.warn(
          `[ResourceSystem] Gathering cancelled: player ${playerId} moved from (${startPos.x.toFixed(2)}, ${startPos.z.toFixed(2)}) to (${playerPos.x.toFixed(2)}, ${playerPos.z.toFixed(2)})`,
        );
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId,
          resourceId: session.resourceId,
        });
        this.resetGatheringEmote(playerId);
        completedSessions.push(playerId);
        continue;
      }

      // Secondary check: still within interaction range (safety net)
      const dist3d = calculateDistance(playerPos, resource.position);
      if (dist3d > GATHERING_CONSTANTS.DEFAULT_INTERACTION_RANGE) {
        console.warn(
          `[ResourceSystem] Gathering cancelled: player ${playerId} too far (${dist3d.toFixed(2)}m > ${GATHERING_CONSTANTS.DEFAULT_INTERACTION_RANGE}m) from ${session.resourceId} at (${resource.position.x.toFixed(1)}, ${resource.position.y.toFixed(1)}, ${resource.position.z.toFixed(1)}), player at (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, ${playerPos.z.toFixed(1)})`,
        );
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId,
          resourceId: session.resourceId,
        });
        this.resetGatheringEmote(playerId);
        completedSessions.push(playerId);
        continue;
      }

      // Inventory capacity guard - if full, stop session
      const inventorySystem = this.world.getSystem?.("inventory") as {
        getInventory?: (playerId: string) => {
          items?: Array<{ itemId: string; quantity: number }>;
          capacity?: number;
        };
      } | null;
      if (inventorySystem?.getInventory) {
        const inv = inventorySystem.getInventory(playerId);
        const capacity = (inv?.capacity as number) ?? 28;
        const count = Array.isArray(inv?.items) ? inv!.items!.length : 0;
        if (count >= capacity) {
          // PERFORMANCE: Use cached drops instead of resource.drops lookup
          const dropName =
            session.cachedDrops[0]?.itemName?.toLowerCase() || "items";
          // Exception: if the drop item is stackable and already has a slot, there is room.
          const dropItemId = session.cachedDrops[0]?.itemId;
          const isStackable = session.cachedDrops[0]?.stackable ?? false;
          const hasExistingSlot =
            isStackable &&
            dropItemId != null &&
            Array.isArray(inv?.items) &&
            (inv!.items! as Array<{ itemId: string }>).some(
              (i) => i.itemId === dropItemId,
            );
          if (!hasExistingSlot) {
            this.emitTypedEvent(EventType.UI_MESSAGE, {
              playerId: playerId,
              message: `Your inventory is too full to hold any more ${dropName}.`,
              type: "warning",
            });
            this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
              playerId: playerId,
              resourceId: session.resourceId,
            });
            completedSessions.push(playerId);
            continue;
          }
        }
      }

      // OSRS-ACCURACY: Check for secondary consumable (bait, feathers) on each tick
      // Stop gathering if player runs out of bait/feathers
      if (resource.secondaryRequired) {
        const hasSecondary = this.playerHasItem(
          playerId,
          resource.secondaryRequired,
        );
        if (!hasSecondary) {
          const secondaryName = resource.secondaryRequired.replace(/_/g, " ");
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: playerId,
            message: `You have run out of ${secondaryName}.`,
            type: "warning",
          });
          this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
            playerId: playerId,
            resourceId: session.resourceId,
          });
          this.resetGatheringEmote(playerId);
          completedSessions.push(playerId);
          continue;
        }
      }

      // PERFORMANCE: Use cached tuning data (zero allocation per tick)
      const tuned = session.cachedTuning;

      // Schedule next attempt (tick-based)
      session.nextAttemptTick = tickNumber + session.cycleTickInterval;
      session.attempts++;

      // PERFORMANCE: Use cached success rate (zero allocation per tick)
      const roll = Math.random();
      const isSuccessful = roll < session.cachedSuccessRate;

      // DEBUG: Log each roll result
      if (DEBUG_GATHERING) {
        const debug = session.debugInfo;
        console.log(
          `[Gathering DEBUG] Roll #${session.attempts}: ${(roll * 100).toFixed(1)}% vs ${(session.cachedSuccessRate * 100).toFixed(1)}% → ${isSuccessful ? "SUCCESS" : "FAIL"} ` +
            `(${debug?.skill ?? "?"} | ${debug?.variant ?? "?"} | ${debug?.toolTier ?? "no tool"})`,
        );
      }

      if (isSuccessful) {
        session.successes++;

        // OSRS-ACCURACY: Get player's skill level for priority-based fish rolling
        const cachedSkills = this.playerSkills.get(playerId);
        const playerSkillLevel =
          cachedSkills?.[resource.skillRequired]?.level ?? 1;

        // PERFORMANCE: Roll against cached drop table (avoids resource lookup)
        // For fishing, this uses OSRS priority rolling with per-fish catch rates
        const drop = this.rollDrop(session.cachedDrops, playerSkillLevel);

        // Add item to inventory using manifest data
        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId: playerId,
          item: {
            id: `inv_${playerId}_${Date.now()}_${drop.itemId}`,
            itemId: drop.itemId, // FROM MANIFEST
            quantity: drop.quantity, // FROM MANIFEST
            slot: -1,
            metadata: drop.stackable ? { stackable: true } : null,
          },
        });

        // Award XP from the rolled drop (fixes multi-drop XP bug)
        const xpAmount = drop.xpAmount;
        this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
          playerId: playerId,
          skill: resource.skillRequired,
          amount: xpAmount,
        });

        // OSRS-ACCURACY: Consume secondary item (bait, feathers) on successful harvest
        // @see https://oldschool.runescape.wiki/w/Fishing - "One bait is used per fish caught"
        if (resource.secondaryRequired) {
          this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
            playerId: playerId,
            itemId: resource.secondaryRequired,
            quantity: 1,
          });
        }

        // Feedback using manifest data
        this.sendChat(
          playerId,
          `You receive ${drop.quantity}x ${drop.itemName}.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId,
          message: `You get some ${drop.itemName.toLowerCase()}. (+${xpAmount} ${resource.skillRequired} XP)`,
          type: "success",
        });

        // ===== DEPLETION CHECK =====
        // OSRS-ACCURACY: Use Forestry timer for higher-level trees, chance-based for mining/regular trees
        let shouldDeplete = false;

        if (this.usesTimerBasedDepletion(session.resourceId)) {
          // FORESTRY: Timer-based depletion (oak, willow, maple, yew, magic, redwood)
          // Timer started on first log, depletes when timer=0 AND player receives log
          shouldDeplete = this.handleForestryLog(
            playerId,
            session.resourceId,
            tickNumber,
          );
        } else if (
          resource.type === "ore" ||
          resource.skillRequired === "mining"
        ) {
          // MINING: Chance-based depletion (1/8 for most rocks)
          const roll = Math.random();
          shouldDeplete = roll < GATHERING_CONSTANTS.MINING_DEPLETE_CHANCE;
          console.log(
            `[Forestry] ⛏️ ${session.resourceId}: Mining roll=${roll.toFixed(3)} vs ${GATHERING_CONSTANTS.MINING_DEPLETE_CHANCE} → ${shouldDeplete ? "DEPLETE" : "continue"}`,
          );
        } else if (
          resource.type === "fishing_spot" ||
          resource.skillRequired === "fishing"
        ) {
          // FISHING: Spots don't deplete (they move, handled elsewhere)
          shouldDeplete = false;
        } else {
          // REGULAR TREES & FALLBACK: Use manifest depleteChance (1/8 for regular trees)
          const roll = Math.random();
          shouldDeplete = roll < tuned.depleteChance;
          console.log(
            `[Forestry] 🌲 ${session.resourceId}: Chance roll=${roll.toFixed(3)} vs ${tuned.depleteChance} → ${shouldDeplete ? "DEPLETE" : "continue"}`,
          );
        }

        if (shouldDeplete) {
          // Deplete resource and schedule tick-based respawn
          resource.isAvailable = false;
          resource.lastDepleted = Date.now();

          const resourceEntity = this.world.entities.get(session.resourceId) as
            | ResourceEntityMethods
            | undefined;
          if (resourceEntity?.deplete) {
            resourceEntity.deplete();
          }

          this.emitTypedEvent(EventType.RESOURCE_DEPLETED, {
            resourceId: session.resourceId,
            position: resource.position,
          });
          // PERFORMANCE: Use cached resource name
          this.sendChat(
            playerId,
            `The ${session.cachedResourceName.toLowerCase()} is depleted.`,
          );
          this.sendNetworkMessage("resourceDepleted", {
            resourceId: session.resourceId,
            position: resource.position,
            depleted: true,
          });

          // Schedule tick-based respawn (replaces setTimeout)
          const respawnTick = tickNumber + tuned.respawnTicks;
          this.respawnAtTick.set(session.resourceId, respawnTick);

          // Emit completion for this session
          this.emitTypedEvent(EventType.RESOURCE_GATHERING_COMPLETED, {
            playerId: playerId,
            resourceId: session.resourceId,
            successful: true,
            skill: resource.skillRequired,
          });

          completedSessions.push(playerId);
        }
      } else {
        // Failure feedback (optional gentle info)
        // PERFORMANCE: Use cached resource name
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId,
          message: `You fail to gather from the ${session.cachedResourceName.toLowerCase()}.`,
          type: "info",
        });
      }
    }

    // Clean up completed sessions
    for (const playerId of completedSessions) {
      const session = this.activeGathering.get(playerId);
      if (session) {
        // FORESTRY: Remove from active gatherers (timer will regenerate if no other gatherers)
        this.removeActiveGatherer(playerId, session.resourceId);
      }
      this.activeGathering.delete(playerId);
      // Reset emote back to idle when gathering completes
      this.resetGatheringEmote(playerId);
    }
  }

  // Legacy completeGathering() method removed - continuous loop in updateGathering() handles all gathering now

  // ===== Tuning helpers (TICK-BASED for OSRS accuracy) =====
  // OSRS Reference: https://oldschool.runescape.wiki/w/Tick_manipulation
  // Standard woodcutting = 4 ticks (2.4 seconds) per attempt
  // Respawn times from OSRS Wiki: https://oldschool.runescape.wiki/w/Tree
  private getVariantTuning(variantKey: string): {
    levelRequired: number;
    xpPerLog: number;
    baseCycleTicks: number; // Ticks between attempts (600ms each)
    depleteChance: number;
    respawnTicks: number; // Respawn time in ticks
  } {
    // Load from manifest - fail fast if not found
    const manifestData = getExternalResource(variantKey);

    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    if (!manifestData.harvestYield || manifestData.harvestYield.length === 0) {
      throw new Error(
        `[ResourceSystem] Resource '${variantKey}' has no harvestYield defined in manifest.`,
      );
    }

    // Get XP from first harvest yield entry
    const xpPerLog = manifestData.harvestYield[0].xpAmount;
    return {
      levelRequired: manifestData.levelRequired,
      xpPerLog,
      baseCycleTicks: manifestData.baseCycleTicks,
      depleteChance: manifestData.depleteChance,
      respawnTicks: manifestData.respawnTicks,
    };
  }

  /**
   * Compute gathering cycle in ticks (OSRS-accurate, skill-specific).
   * SERVER-SIDE: Rolls for dragon/crystal pickaxe bonus speed here to maintain determinism.
   * @see gathering/SuccessRateCalculator.ts for implementation
   */
  private computeCycleTicks(
    skill: string,
    tuned: { levelRequired: number; baseCycleTicks: number },
    toolData: GatheringToolData | null,
  ): number {
    // Roll for dragon/crystal pickaxe bonus speed server-side
    // Dragon: 1/6 chance (0.167), Crystal: 1/4 chance (0.25)
    const bonusRollTriggered =
      toolData?.bonusTickChance !== undefined &&
      Math.random() < toolData.bonusTickChance;

    return computeCycleTicksUtil(
      skill,
      tuned.baseCycleTicks,
      toolData,
      bonusRollTriggered,
    );
  }

  /**
   * Convert ticks to milliseconds for client progress bar.
   * @see gathering/SuccessRateCalculator.ts for implementation
   */
  private ticksToMs(ticks: number): number {
    return ticksToMsUtil(ticks);
  }

  /**
   * Compute success rate using OSRS's LERP interpolation formula.
   * @see gathering/SuccessRateCalculator.ts for implementation
   */
  private computeSuccessRate(
    skillLevel: number,
    skill: string,
    resourceVariant: string,
    toolTier: string | null,
  ): number {
    return computeSuccessRateUtil(skillLevel, skill, resourceVariant, toolTier);
  }

  /**
   * Get low/high success rate values from the appropriate table.
   * @see gathering/SuccessRateCalculator.ts for implementation
   */
  private getSuccessRateValues(
    skill: string,
    resourceVariant: string,
    toolTier: string | null,
  ): { low: number; high: number } {
    return getSuccessRateValuesUtil(skill, resourceVariant, toolTier);
  }

  /**
   * Roll against harvestYield chances to determine drop.
   * @see gathering/DropRoller.ts for implementation
   */
  private rollDrop(drops: ResourceDrop[], playerLevel?: number): ResourceDrop {
    return rollDropUtil(drops, playerLevel, DEBUG_GATHERING);
  }

  /**
   * SECURITY: Validate resource ID format to prevent injection attacks
   * Valid IDs are alphanumeric with underscores/hyphens, reasonable length
   */
  private isValidResourceId(resourceId: string): boolean {
    if (!resourceId || typeof resourceId !== "string") {
      return false;
    }
    if (resourceId.length > GATHERING_CONSTANTS.MAX_RESOURCE_ID_LENGTH) {
      return false;
    }
    // Only allow alphanumeric, underscores, hyphens, and periods
    if (!GATHERING_CONSTANTS.VALID_RESOURCE_ID_PATTERN.test(resourceId)) {
      return false;
    }
    return true;
  }

  /**
   * Get best tool for a skill from player inventory (manifest-driven)
   * Returns tool data from tools.json manifest
   *
   * Tools are loaded from packages/server/world/assets/manifests/tools.json
   * and sorted by priority (1 = best, higher = worse)
   *
   * @param playerId - Player to check inventory for
   * @param skill - Skill name (woodcutting, mining, fishing)
   */
  private getBestTool(
    playerId: string,
    skill: string,
  ): GatheringToolData | null {
    // Get tools for this skill from manifest, sorted by priority (best first)
    const skillTools = getExternalToolsForSkill(
      skill as "woodcutting" | "mining" | "fishing",
    );

    if (skillTools.length === 0) {
      // No tools defined for this skill in manifest
      return null;
    }

    // Build a set of item IDs from inventory
    const inventorySystem = this.world.getSystem?.("inventory") as {
      getInventory?: (playerId: string) => {
        items?: Array<{ itemId?: string }>;
      };
    } | null;

    const inv = inventorySystem?.getInventory?.(playerId);
    const items = inv?.items || [];

    const playerItemIds = new Set(
      items.map((item) => item?.itemId).filter(Boolean),
    );

    // Also check equipped weapon slot (tools go in weapon slot)
    const equipmentSystem = this.world.getSystem?.("equipment") as {
      getPlayerEquipment?: (playerId: string) =>
        | {
            weapon?: { itemId?: string | number | null };
          }
        | undefined;
    } | null;

    if (equipmentSystem?.getPlayerEquipment) {
      const equipment = equipmentSystem.getPlayerEquipment(playerId);
      const weaponItemId = equipment?.weapon?.itemId;

      if (weaponItemId) {
        const itemIdStr =
          typeof weaponItemId === "number"
            ? weaponItemId.toString()
            : weaponItemId;
        playerItemIds.add(itemIdStr);
      }
    }

    // Check tools in priority order (best first) - exact itemId match
    for (const tool of skillTools) {
      if (playerItemIds.has(tool.itemId)) {
        return tool;
      }
    }

    return null; // No tool found for this skill
  }

  /**
   * Extract tool category from toolRequired field.
   * @see gathering/ToolUtils.ts for implementation
   */
  private getToolCategory(toolRequired: string): string {
    return getToolCategoryUtil(toolRequired);
  }

  /**
   * Get display name for tool category.
   * @see gathering/ToolUtils.ts for implementation
   */
  private getToolDisplayName(category: string): string {
    return getToolDisplayNameUtil(category);
  }

  /**
   * Get the despawn ticks for a resource based on its type (Forestry system).
   * Returns 0 for resources that use chance-based depletion (regular trees, mining).
   *
   * @param resourceId - The resource ID to look up
   * @returns Despawn time in ticks, or 0 if chance-based
   */
  private getResourceDespawnTicks(resourceId: ResourceID): number {
    // Get the variant key (e.g., "tree_oak", "tree_willow")
    const variantKey = this.resourceVariants.get(resourceId) || "tree_normal";

    // Extract tree type from variant key (e.g., "tree_oak" -> "oak")
    const parts = variantKey.split("_");
    const resourceType = parts[0];
    const subType = parts.length > 1 ? parts[1] : "tree";

    // Only trees use the Forestry timer system
    if (resourceType !== "tree") {
      return 0; // Mining, fishing, etc. use chance-based or don't deplete
    }

    // Map subType to TREE_DESPAWN_TICKS key
    const treeType = subType === "normal" ? "tree" : subType;
    const despawnTicks =
      GATHERING_CONSTANTS.TREE_DESPAWN_TICKS[
        treeType as keyof typeof GATHERING_CONSTANTS.TREE_DESPAWN_TICKS
      ];

    return despawnTicks ?? 0;
  }

  /**
   * Check if a resource uses timer-based depletion (Forestry) vs chance-based.
   *
   * @param resourceId - The resource ID
   * @returns true if uses Forestry timer, false if chance-based
   */
  private usesTimerBasedDepletion(resourceId: ResourceID): boolean {
    return this.getResourceDespawnTicks(resourceId) > 0;
  }

  /**
   * Check if player has a specific item in their inventory
   * Used for secondary consumable checks (bait, feathers, etc.)
   */
  private playerHasItem(playerId: string, itemId: string): boolean {
    const inventorySystem = this.world.getSystem?.("inventory") as {
      getInventory?: (playerId: string) => {
        items?: Array<{ itemId?: string; quantity?: number }>;
      };
    } | null;

    if (!inventorySystem?.getInventory) {
      return false;
    }

    const inv = inventorySystem.getInventory(playerId);
    const items = inv?.items || [];

    return items.some(
      (item) =>
        item?.itemId?.toLowerCase() === itemId.toLowerCase() &&
        (item.quantity ?? 1) > 0,
    );
  }

  /**
   * Check if player has any tool matching the required category.
   * Checks both inventory AND equipped items (tools in weapon slot).
   * @see gathering/ToolUtils.ts for matching logic
   */
  private playerHasToolCategory(playerId: string, category: string): boolean {
    // Check inventory first
    const inventorySystem = this.world.getSystem?.("inventory") as {
      getInventory?: (playerId: string) => {
        items?: Array<{ itemId?: string }>;
      };
    } | null;

    if (inventorySystem?.getInventory) {
      const inv = inventorySystem.getInventory(playerId);
      const items = inv?.items || [];

      const hasInInventory = items.some((item) => {
        if (!item?.itemId) return false;
        return itemMatchesToolCategory(item.itemId, category);
      });

      if (hasInInventory) {
        return true;
      }
    }

    // Check equipped items (tools go in weapon slot)
    const equipmentSystem = this.world.getSystem?.("equipment") as {
      getPlayerEquipment?: (playerId: string) =>
        | {
            weapon?: { itemId?: string | number | null };
          }
        | undefined;
    } | null;

    if (equipmentSystem?.getPlayerEquipment) {
      const equipment = equipmentSystem.getPlayerEquipment(playerId);
      const weaponItemId = equipment?.weapon?.itemId;

      if (weaponItemId) {
        const itemIdStr =
          typeof weaponItemId === "number"
            ? weaponItemId.toString()
            : weaponItemId;
        if (itemMatchesToolCategory(itemIdStr, category)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all resources for testing/debugging
   */
  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources by type
   */
  getResourcesByType(type: string): Resource[] {
    return this.getAllResources().filter((resource) => resource.type === type);
  }

  /**
   * Check if a player has the required tool for a resource.
   * Used by PendingGatherManager to decide whether to set arrival emotes.
   */
  playerHasRequiredToolForResource(
    playerId: string,
    resourceId: string,
  ): boolean {
    const resource = this.resources.get(createResourceID(resourceId));
    if (!resource?.toolRequired) return true;
    const category = this.getToolCategory(resource.toolRequired);
    return this.playerHasToolCategory(playerId, category);
  }

  /**
   * Get resource by ID
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(createResourceID(resourceId));
  }

  /**
   * Cleanup when system is destroyed
   * Clears all active sessions, resources, and rate limits
   */
  destroy(): void {
    // Clear all active gathering sessions
    this.activeGathering.clear();

    // Clear tick-based respawn tracking
    this.respawnAtTick.clear();

    // FORESTRY: Clear resource timer tracking
    this.resourceTimers.clear();

    // OSRS-ACCURACY: Clear fishing spot movement timers
    this.fishingSpotMoveTimers.clear();

    // Clear all resource data
    this.resources.clear();
    this.manifestResourceIds.clear();

    // SECURITY: Clear rate limit tracking
    this.gatherRateLimits.clear();

    // Dispose shared GPU resources (cached textures) used by fishing spot glow
    disposeFishingSpotTextures();

    // Call parent cleanup (automatically clears all tracked timers, intervals, and listeners)
    super.destroy();
  }
}
