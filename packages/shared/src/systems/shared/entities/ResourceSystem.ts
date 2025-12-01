import { SystemBase } from "..";
import { uuid } from "../../../utils";
import type { World } from "../../../types";
import { EventType } from "../../../types/events";
import { Resource, ResourceDrop } from "../../../types/core/core";
import { PlayerID, ResourceID } from "../../../types/core/identifiers";
import { calculateDistance } from "../../../utils/game/EntityUtils";
import {
  createPlayerID,
  createResourceID,
  createItemID,
} from "../../../utils/IdentifierUtils";
import type { TerrainResourceSpawnPoint } from "../../../types/world/terrain";
import { TICK_DURATION_MS } from "../movement/TileSystem";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import { ResourceType } from "../../../types/entities/entities";

/**
 * Resource System
 * Manages resource gathering per GDD specifications:
 *
 * Woodcutting:
 * - Click tree with hatchet equipped
 * - Success rates based on skill level
 * - Produces logs
 *
 * Fishing:
 * - Click water edge with fishing rod equipped
 * - Success rates based on skill level
 * - Produces raw fish
 *
 * Resource respawning and depletion mechanics
 */
export class ResourceSystem extends SystemBase {
  private resources = new Map<ResourceID, Resource>();
  // Track which resources are from world-areas.json (static, shouldn't be unloaded)
  private staticResources = new Set<ResourceID>();
  // Tick-based gathering sessions (OSRS-accurate timing)
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
    }
  >();
  // Tick-based respawn tracking (replaces setTimeout)
  private respawnAtTick = new Map<ResourceID, number>();
  // Legacy respawn timers (for backwards compatibility during transition)
  private respawnTimers = new Map<ResourceID, NodeJS.Timeout>();
  private playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();
  private resourceVariants = new Map<ResourceID, string>();

  // Resource drop tables per GDD
  private readonly RESOURCE_DROPS = new Map<string, ResourceDrop[]>([
    [
      "tree_normal",
      [
        {
          itemId: "logs", // Use canonical item id from items.ts
          itemName: "Logs",
          quantity: 1,
          chance: 1.0, // Always get logs
          xpAmount: 25, // Woodcutting XP per log (per normal tree)
          stackable: true,
        },
      ],
    ],
    [
      "tree_oak",
      [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1.0,
          xpAmount: 38, // Approx RS 37.5 rounded
          stackable: true,
        },
      ],
    ],
    [
      "tree_willow",
      [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1.0,
          xpAmount: 68, // Approx RS 67.5 rounded
          stackable: true,
        },
      ],
    ],
    [
      "tree_maple",
      [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1.0,
          xpAmount: 100,
          stackable: true,
        },
      ],
    ],
    [
      "tree_yew",
      [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1.0,
          xpAmount: 175,
          stackable: true,
        },
      ],
    ],
    [
      "tree_magic",
      [
        {
          itemId: "logs",
          itemName: "Logs",
          quantity: 1,
          chance: 1.0,
          xpAmount: 250,
          stackable: true,
        },
      ],
    ],
    // Mining ore drops (OSRS-accurate XP values)
    [
      "ore_copper",
      [
        {
          itemId: "copper_ore",
          itemName: "Copper Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 17.5, // OSRS: 17.5 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_tin",
      [
        {
          itemId: "tin_ore",
          itemName: "Tin Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 17.5, // OSRS: 17.5 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_iron",
      [
        {
          itemId: "iron_ore",
          itemName: "Iron Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 35, // OSRS: 35 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_coal",
      [
        {
          itemId: "coal_ore",
          itemName: "Coal Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 50, // OSRS: 50 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_mithril",
      [
        {
          itemId: "mithril_ore",
          itemName: "Mithril Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 80, // OSRS: 80 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_adamantite",
      [
        {
          itemId: "adamantite_ore",
          itemName: "Adamantite Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 95, // OSRS: 95 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "ore_runite",
      [
        {
          itemId: "runite_ore",
          itemName: "Runite Ore",
          quantity: 1,
          chance: 1.0,
          xpAmount: 125, // OSRS: 125 XP per ore
          stackable: false,
        },
      ],
    ],
    [
      "herb_patch_normal",
      [
        {
          itemId: "herbs", // Use string ID
          itemName: "Herbs",
          quantity: 1,
          chance: 1.0, // Always get herbs
          xpAmount: 20, // Herbalism XP per herb
          stackable: true,
        },
      ],
    ],
    [
      "fishing_spot_normal",
      [
        {
          itemId: "raw_shrimps", // Use string ID that matches items.ts
          itemName: "Raw Shrimps",
          quantity: 1,
          chance: 1.0, // Always get fish (when successful)
          xpAmount: 10, // Fishing XP per fish
          stackable: true,
        },
      ],
    ],
  ]);

  constructor(world: World) {
    super(world, {
      name: "resource",
      dependencies: {
        required: [], // Resource system can work independently
        optional: ["inventory", "xp", "skills", "ui", "terrain"], // Better with inventory, skills, and terrain systems
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

  async init(): Promise<void> {
    // Set up type-safe event subscriptions for resource management
    this.subscribe<{
      spawnPoints: Array<{
        id: string;
        type: string;
        position: { x: number; y: number; z: number };
        subType?: string;
      }>;
    }>(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, async (data) => {
      console.log(
        `[ResourceSystem] Received RESOURCE_SPAWN_POINTS_REGISTERED event with ${data.spawnPoints.length} spawn points`,
      );
      // Convert event payload back to TerrainResourceSpawnPoint format
      const terrainSpawnPoints: TerrainResourceSpawnPoint[] =
        data.spawnPoints.map((sp) => ({
          position: sp.position,
          type: sp.type as TerrainResourceSpawnPoint["type"],
          subType: (sp.subType ||
            (sp.type === "tree"
              ? "oak"
              : sp.type === "ore"
                ? "copper"
                : "oak")) as TerrainResourceSpawnPoint["subType"],
        }));
      await this.registerTerrainResources({ spawnPoints: terrainSpawnPoints });
    });

    // Subscribe to direct harvest requests from ResourceEntity interactions
    this.subscribe(EventType.RESOURCE_HARVEST_REQUEST, (data) => {
      // Forward to RESOURCE_GATHER handler with correct format
      // Use entityId directly - it should match the resource.id we stored
      this.world.emit(EventType.RESOURCE_GATHER, {
        playerId: data.playerId,
        resourceId: data.entityId, // entityId is the resource entity ID (e.g., "ore_3_-25")
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

    // Set up player gathering event subscriptions
    // NOTE: We do NOT subscribe to RESOURCE_GATHERING_STOPPED here to avoid circular calls
    // stopGathering() emits RESOURCE_GATHERING_STOPPED, but we handle cleanup internally
    // Other systems can listen to RESOURCE_GATHERING_STOPPED for their own purposes
    this.subscribe<{ id: string }>(EventType.PLAYER_UNREGISTERED, (data) =>
      this.cleanupPlayerGathering(data.id),
    );

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
  }
  private sendChat(playerId: string, text: string): void {
    const chat = (
      this.world as unknown as {
        chat: { add: (msg: unknown, broadcast?: boolean) => void };
      }
    ).chat;
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
      console.log(`[ResourceSystem] 🪓 Setting ${emote} emote for ${playerId}`);

      // Set emote STRING KEY (players use emote strings which get mapped to URLs)
      if ((playerEntity as any).emote !== undefined) {
        (playerEntity as any).emote = emote;
      }
      if ((playerEntity as any).data) {
        (playerEntity as any).data.e = emote;
      }

      // Send immediate network update for emote (same pattern as CombatSystem)
      // This ensures the emote update arrives at clients immediately
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: playerId,
          e: emote,
        });
      }

      (playerEntity as any).markNetworkDirty?.();
    }
  }

  /**
   * Reset gathering emote back to idle
   */
  private resetGatheringEmote(playerId: string): void {
    const playerEntity = this.world.getPlayer?.(playerId);
    if (playerEntity) {
      console.log(
        `[ResourceSystem] 🪓 Resetting emote to idle for ${playerId}`,
      );

      // Reset to idle
      if ((playerEntity as any).emote !== undefined) {
        (playerEntity as any).emote = "idle";
      }
      if ((playerEntity as any).data) {
        (playerEntity as any).data.e = "idle";
      }

      // Send immediate network update for emote reset (same pattern as CombatSystem)
      if (this.world.isServer && this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: playerId,
          e: "idle",
        });
      }

      (playerEntity as any).markNetworkDirty?.();
    }
  }

  async start(): Promise<void> {
    // Resources will be spawned procedurally by TerrainSystem across all terrain tiles
    // No need for manual default spawning - TerrainSystem generates resources based on biome
    // NOTE: Gathering is now processed via processGatheringTick() called by TickSystem
    // The old 500ms interval has been removed in favor of OSRS-accurate 600ms tick-based processing
    // Registration happens in ServerNetwork/index.ts at TickPriority.RESOURCES

    // Load resource spawn points from world-areas.json
    // Only on server - clients receive entities via network
    if (this.world.isServer) {
      await this.loadWorldAreaResources();
    }
  }

  /**
   * Load resource spawn points from world-areas.json and emit them
   */
  private async loadWorldAreaResources(): Promise<void> {
    const spawnPoints: TerrainResourceSpawnPoint[] = [];

    // Process all world areas
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      if (!area.resources || area.resources.length === 0) {
        continue;
      }

      // Convert BiomeResource to TerrainResourceSpawnPoint
      for (const resource of area.resources) {
        // Get subType from resource (world-areas.json has subType field directly)
        // Also try extracting from resourceId as fallback (e.g., "ore_copper" -> "copper")
        let subType: string | undefined;
        const resourceWithSubType = resource as {
          subType?: string;
          resourceId?: string;
        };
        if (resourceWithSubType.subType) {
          subType = resourceWithSubType.subType;
        } else if (resourceWithSubType.resourceId) {
          // Fallback: extract from resourceId (e.g., "ore_copper" -> "copper")
          const parts = resourceWithSubType.resourceId.split("_");
          if (parts.length >= 2) {
            subType = parts.slice(1).join("_"); // Handle multi-part subTypes
          }
        }

        // Map resource type to TerrainResourceSpawnPoint type
        let terrainType: TerrainResourceSpawnPoint["type"];
        const resourceTypeStr = resource.type as string;
        if (resourceTypeStr === "tree") {
          terrainType = "tree";
        } else if (resourceTypeStr === "ore" || resourceTypeStr === "mine") {
          terrainType = "ore";
        } else if (resourceTypeStr === "fishing_spot") {
          terrainType = "fish";
        } else if (resourceTypeStr === "herb_patch") {
          terrainType = "herb";
        } else {
          // Skip unknown types
          continue;
        }

        // Validate subType matches the union type
        const validSubTypes = [
          "willow",
          "oak",
          "yew",
          "coal",
          "iron",
          "mithril",
          "adamant",
          "runite",
          "copper",
          "tin",
        ];

        // Create spawn point - subType is required in the type
        const spawnPoint: TerrainResourceSpawnPoint = {
          position: {
            x: resource.position.x,
            y: resource.position.y,
            z: resource.position.z,
          },
          type: terrainType,
          // Use validated subType or default based on type
          subType: (subType && validSubTypes.includes(subType)
            ? subType
            : terrainType === "tree"
              ? "oak" // Default tree subType
              : terrainType === "ore"
                ? "copper" // Default ore subType
                : "oak") as TerrainResourceSpawnPoint["subType"],
        };

        spawnPoints.push(spawnPoint);
      }
    }

    // Emit spawn points event to trigger registration
    if (spawnPoints.length > 0) {
      console.log(
        `[ResourceSystem] Loaded ${spawnPoints.length} resource spawn points from world areas`,
      );
      console.log(
        `[ResourceSystem] Spawn points:`,
        spawnPoints.map(
          (sp) =>
            `${sp.type}_${sp.subType} at (${sp.position.x}, ${sp.position.y}, ${sp.position.z})`,
        ),
      );
      console.log(
        `[ResourceSystem] Emitting RESOURCE_SPAWN_POINTS_REGISTERED event...`,
      );
      // Convert TerrainResourceSpawnPoint[] to event payload format (adds id field)
      // Note: Event payload expects { id, type, position } but we need subType, so we'll pass the full TerrainResourceSpawnPoint
      // The subscription handler will convert it back
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints: spawnPoints.map((sp) => ({
          id: `${sp.type}_${sp.position.x}_${sp.position.z}`,
          type: sp.type,
          position: sp.position,
          // Include subType in a way that the handler can access it
          subType: sp.subType,
        })) as Array<{
          id: string;
          type: string;
          position: { x: number; y: number; z: number };
          subType?: string;
        }>,
      });
      console.log(
        `[ResourceSystem] Event emitted, waiting for registerTerrainResources to be called...`,
      );
    } else {
      console.warn(
        "[ResourceSystem] No resource spawn points found in world areas",
      );
    }
  }

  /**
   * Handle terrain system resource registration (new procedural system)
   */
  private async registerTerrainResources(data: {
    spawnPoints: TerrainResourceSpawnPoint[];
  }): Promise<void> {
    console.log(
      `[ResourceSystem] registerTerrainResources called with ${data.spawnPoints.length} spawn points`,
    );
    const { spawnPoints } = data;

    if (spawnPoints.length === 0) {
      console.warn(
        `[ResourceSystem] registerTerrainResources called with 0 spawn points, returning`,
      );
      return;
    }

    // Only spawn actual entities on the server (authoritative)
    if (!this.world.isServer) {
      console.log(
        `[ResourceSystem] Not server, skipping resource registration`,
      );
      return;
    }

    console.log(
      `[ResourceSystem] Starting resource registration on server for ${spawnPoints.length} spawn points`,
    );

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
    let failed = 0;

    for (const spawnPoint of spawnPoints) {
      console.log(
        `[ResourceSystem] Processing spawn point: ${spawnPoint.type}_${spawnPoint.subType} at (${spawnPoint.position.x}, ${spawnPoint.position.y}, ${spawnPoint.position.z})`,
      );

      const resource = this.createResourceFromSpawnPoint(spawnPoint);
      if (!resource) {
        console.error(
          `[ResourceSystem] Failed to create resource from spawn point: ${spawnPoint.type}_${spawnPoint.subType}`,
        );
        failed++;
        continue;
      }

      // Store in map for tracking
      // resource.id is the entity ID (e.g., "ore_3_-25")
      // We store it with createResourceID wrapper for type safety
      const rid = createResourceID(resource.id);
      this.resources.set(rid, resource);
      // Mark as static resource (from world-areas.json) - don't unload with tiles
      this.staticResources.add(rid);

      console.log(
        `[ResourceSystem] ✅ Registered ${resource.type} resource ${resource.id} (key: ${rid}) at (${resource.position.x}, ${resource.position.y}, ${resource.position.z}) as STATIC`,
      );
      // Track variant/subtype for tuning (e.g., 'tree_oak', 'ore_copper')
      // Variant key is constructed as: type_subType (e.g., "tree_oak", "ore_copper")
      if (resource.type === "tree") {
        const variant = spawnPoint.subType
          ? `tree_${spawnPoint.subType}`
          : "tree_normal";
        this.resourceVariants.set(rid, variant);
        console.log(
          `[ResourceSystem] Set variant for ${resource.id}: ${variant}`,
        );
      } else if (resource.type === "ore") {
        const variant = spawnPoint.subType
          ? `ore_${spawnPoint.subType}`
          : "ore_copper";
        this.resourceVariants.set(rid, variant);
        console.log(
          `[ResourceSystem] Set variant for ${resource.id}: ${variant} (subType: ${spawnPoint.subType})`,
        );
        // Verify drop table exists for this variant
        const drops = this.RESOURCE_DROPS.get(variant);
        if (drops && drops.length > 0) {
          console.log(
            `[ResourceSystem] ✅ Drop table found for ${variant}: will produce ${drops[0].itemId} (${drops[0].itemName})`,
          );
        } else {
          console.warn(
            `[ResourceSystem] ⚠️ No drop table found for variant ${variant}!`,
          );
        }
      }

      // Spawn actual ResourceEntity instance
      // Create proper quaternion for random Y-axis rotation
      const randomYRotation = Math.random() * Math.PI * 2;
      const quat = {
        x: 0,
        y: Math.sin(randomYRotation / 2),
        z: 0,
        w: Math.cos(randomYRotation / 2),
      };

      // Ground Y position to terrain height
      const terrain = this.world.getSystem("terrain") as
        | { getHeightAt: (x: number, z: number) => number | null }
        | undefined;
      let yPosition = resource.position.y;
      if (terrain?.getHeightAt) {
        const terrainHeight = terrain.getHeightAt(
          resource.position.x,
          resource.position.z,
        );
        if (Number.isFinite(terrainHeight) && terrainHeight !== null) {
          yPosition = (terrainHeight as number) + 0.1; // Slightly above terrain
        } else {
          yPosition = 10; // Fallback safe height
        }
      }

      const resourceConfig = {
        id: resource.id,
        type: "resource" as const,
        name: resource.name,
        position: {
          x: resource.position.x,
          y: yPosition,
          z: resource.position.z,
        },
        rotation: quat, // Proper quaternion for random Y-axis rotation
        scale: { x: 1, y: 1, z: 1 }, // ALWAYS uniform scale - ResourceEntity handles mesh scale
        visible: true,
        interactable: true,
        interactionType: "harvest",
        interactionDistance: 3,
        description: `${resource.name} - Requires level ${resource.levelRequired} ${resource.skillRequired}`,
        model: this.getModelPathForResource(resource.type, spawnPoint.subType),
        properties: {},
        // ResourceEntity specific
        // Map string resource.type to ResourceType enum
        resourceType:
          resource.type === "tree"
            ? ResourceType.TREE
            : resource.type === "ore"
              ? ResourceType.MINING_ROCK
              : resource.type === "fishing_spot"
                ? ResourceType.FISHING_SPOT
                : ResourceType.TREE, // Default fallback
        resourceId: spawnPoint.subType || `${resource.type}_normal`,
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
      };

      try {
        console.log(
          `[ResourceSystem] Spawning ${resource.type} ${resource.name} (harvestSkill: ${resourceConfig.harvestSkill}, resourceType: ${resourceConfig.resourceType}) at (${resourceConfig.position.x}, ${resourceConfig.position.y}, ${resourceConfig.position.z}) with model: ${resourceConfig.model}`,
        );
        const spawnedEntity = (await entityManager.spawnEntity(
          resourceConfig,
        )) as { id?: string } | null;
        if (spawnedEntity) {
          spawned++;
          console.log(
            `[ResourceSystem] ✅ Successfully spawned ${resource.name} (${spawnedEntity.id})`,
          );
        } else {
          failed++;
          console.error(
            `[ResourceSystem] ❌ EntityManager returned null for ${resource.id}`,
          );
        }
      } catch (err) {
        failed++;
        console.error(
          `[ResourceSystem] Failed to spawn resource entity ${resource.id}:`,
          err,
        );
      }
    }

    if (spawned > 0) {
      console.log(
        `[ResourceSystem] ✅ Spawned ${spawned} resources (${failed} failed)`,
      );
    } else if (failed > 0) {
      console.error(`[ResourceSystem] ❌ Failed to spawn ${failed} resources`);
    }
  }

  /**
   * Get model path for resource type
   * Note: Trees use the same model for all variants (subType only affects tuning)
   * Ores can use the same model for all variants (like trees) or different models per variant
   */
  private getModelPathForResource(type: string, subType?: string): string {
    switch (type) {
      case "tree":
        // All tree variants use the same model (subType only affects tuning)
        // subType like "oak", "willow", "maple" all use basic-tree.glb
        return "asset://models/basic-reg-tree/basic-tree.glb";
      case "fishing_spot":
        return ""; // Fishing spots don't need models
      case "ore":
      case "rock":
      case "gem":
      case "rare_ore":
        // All ore variants use the same model (like trees)
        // subType like "copper", "tin", "iron" all use the same model
        // If you want different models per ore type, uncomment the conditional logic below
        return "asset://models/ore-copper/copper.glb"; // Single model for all ores

      // OPTIONAL: Use different models per ore type (uncomment to enable):
      // if (subType === "copper" || subType === "ore_copper" || subType?.includes("copper")) {
      //   return "asset://models/ore-copper/copper.glb";
      // }
      // if (subType === "tin" || subType === "ore_tin" || subType?.includes("tin")) {
      //   return "asset://models/ore-tin/tin.glb";
      // }
      // return "asset://models/ore-copper/copper.glb"; // Default
      case "herb_patch":
        return ""; // Use placeholder for herbs (no model yet)
      default:
        return "";
    }
  }

  /**
   * Create resource from terrain spawn point
   */
  private createResourceFromSpawnPoint(
    spawnPoint: TerrainResourceSpawnPoint,
  ): Resource | undefined {
    const { position, type, subType: _subType } = spawnPoint;

    let skillRequired: string;
    let toolRequired: string;
    let respawnTime: number;
    let levelRequired: number = 1;

    switch (type) {
      case "tree":
        skillRequired = "woodcutting";
        toolRequired = "bronze_hatchet"; // Bronze Hatchet
        respawnTime = 10000; // 10s respawn for MVP
        break;

      case "fish":
        skillRequired = "fishing";
        toolRequired = "fishing_rod"; // Fishing Rod
        respawnTime = 30000; // 30 second respawn
        break;

      case "rock":
      case "ore":
      case "gem":
      case "rare_ore":
        skillRequired = "mining";
        toolRequired = "bronze_pickaxe"; // Bronze Pickaxe
        respawnTime = 120000; // 2 minute respawn
        levelRequired = 5;
        break;

      case "herb":
        skillRequired = "herbalism";
        toolRequired = ""; // No tool required for herbs
        respawnTime = 45000; // 45 second respawn
        levelRequired = 1;
        break;

      default:
        throw new Error(`Unknown resource type: ${type}`);
    }

    const resourceType: "tree" | "fishing_spot" | "ore" | "herb_patch" =
      type === "rock" || type === "ore" || type === "gem" || type === "rare_ore"
        ? "ore"
        : type === "fish"
          ? "fishing_spot"
          : type === "herb"
            ? "herb_patch"
            : "tree";

    // Determine variant key and tuned parameters
    // For trees: subType like "oak", "willow" becomes "tree_oak", "tree_willow"
    // For ores: subType like "copper", "tin" becomes "ore_copper", "ore_tin"
    const variantKey =
      resourceType === "tree"
        ? spawnPoint.subType
          ? `tree_${spawnPoint.subType}`
          : "tree_normal"
        : resourceType === "ore"
          ? spawnPoint.subType
            ? `ore_${spawnPoint.subType}`
            : "ore_copper" // Default to copper for mining
          : `${resourceType}_normal`;
    const tuned = this.getVariantTuning(variantKey);

    // Generate resource ID using the spawnPoint type (e.g., "ore") not resourceType
    // This ensures the ID matches what the entity will have
    const resource: Resource = {
      id: `${type}_${position.x.toFixed(0)}_${position.z.toFixed(0)}`,
      type: resourceType,
      name:
        type === "fish"
          ? "Fishing Spot"
          : type === "tree"
            ? "Tree"
            : type === "herb"
              ? "Herb"
              : resourceType === "ore"
                ? variantKey.includes("copper")
                  ? "Copper Rock"
                  : variantKey.includes("tin")
                    ? "Tin Rock"
                    : variantKey.includes("iron")
                      ? "Iron Rock"
                      : variantKey.includes("coal")
                        ? "Coal Rock"
                        : variantKey.includes("mithril")
                          ? "Mithril Rock"
                          : variantKey.includes("adamantite")
                            ? "Adamantite Rock"
                            : variantKey.includes("runite")
                              ? "Runite Rock"
                              : "Rock"
                : "Rock",
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      skillRequired,
      levelRequired:
        resourceType === "tree" || resourceType === "ore"
          ? tuned.levelRequired
          : levelRequired,
      toolRequired,
      respawnTime:
        resourceType === "tree" || resourceType === "ore"
          ? this.ticksToMs(tuned.respawnTicks)
          : respawnTime,
      isAvailable: true,
      lastDepleted: 0,
      drops:
        resourceType === "tree"
          ? this.RESOURCE_DROPS.get(variantKey) ||
            this.RESOURCE_DROPS.get("tree_normal") ||
            []
          : resourceType === "ore"
            ? this.RESOURCE_DROPS.get(variantKey) ||
              this.RESOURCE_DROPS.get("ore_copper") ||
              []
            : this.RESOURCE_DROPS.get(`${resourceType}_normal`) || [],
    };

    return resource;
  }

  /**
   * Handle terrain tile unloading - remove resources from unloaded tiles
   */
  private onTerrainTileUnloaded(data: { tileId: string }): void {
    // Extract tileX and tileZ from tileId (format: "x,z")
    const [tileX, tileZ] = data.tileId.split(",").map(Number);

    console.log(
      `[ResourceSystem] Tile unloaded: ${data.tileId} (tileX: ${tileX}, tileZ: ${tileZ}), checking ${this.resources.size} resources`,
    );

    // Remove resources that belong to this tile
    // BUT: Don't remove static resources from world-areas.json
    let removedCount = 0;
    for (const [resourceId, resource] of this.resources) {
      // Skip static resources (from world-areas.json) - they should never be unloaded
      if (this.staticResources.has(resourceId)) {
        continue;
      }

      // Check if resource belongs to this tile (based on position)
      const resourceTileX = Math.floor(resource.position.x / 100); // 100m tile size
      const resourceTileZ = Math.floor(resource.position.z / 100);

      if (resourceTileX === tileX && resourceTileZ === tileZ) {
        console.log(
          `[ResourceSystem] Removing resource ${resourceId} (${resource.type}) from unloaded tile (${resourceTileX}, ${resourceTileZ})`,
        );
        this.resources.delete(resourceId);
        removedCount++;

        // Clean up any active gathering on this resource
        // Note: activeGathering is keyed by PlayerID, not ResourceID
        // We need to find and remove any gathering sessions for this resource
        for (const [playerId, session] of this.activeGathering) {
          if (session.resourceId === resourceId) {
            this.activeGathering.delete(playerId);
          }
        }

        // Clean up respawn timer (now managed by SystemBase auto-cleanup)
        this.respawnTimers.delete(resourceId);
      }
    }

    if (removedCount > 0) {
      console.log(
        `[ResourceSystem] Removed ${removedCount} resources from unloaded tile ${data.tileId}. Remaining: ${this.resources.size} (${this.staticResources.size} static)`,
      );
    } else {
      console.log(
        `[ResourceSystem] No resources removed from tile ${data.tileId} (all are static or in different tiles). Total: ${this.resources.size} (${this.staticResources.size} static)`,
      );
    }
  }

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
    const resourceId = createResourceID(data.resourceId);

    console.log(
      `[ResourceSystem] Looking up resource with ID: ${data.resourceId} (wrapped: ${resourceId})`,
    );
    console.log(
      `[ResourceSystem] Available resource IDs:`,
      Array.from(this.resources.keys()).slice(0, 10),
    );

    // Try direct lookup first
    let resource = this.resources.get(resourceId);

    // If still not found, try matching by position (fallback for ID mismatches)
    if (!resource) {
      for (const r of this.resources.values()) {
        const derived = `${r.type}_${Math.round(r.position.x)}_${Math.round(r.position.z)}`;
        if (derived === (data.resourceId || "")) {
          resource = r;
          console.log(
            `[ResourceSystem] Matched resource by position: ${derived} -> ${r.id}`,
          );
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
      if (nearest && nearestDist < 15) {
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

    // Check if resource is available
    if (!resource.isAvailable) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `This ${resource.type.replace("_", " ")} is depleted. Please wait for it to respawn.`,
        type: "info",
      });
      return;
    }

    // Check player skill level (reactive pattern)
    const cachedSkills = this.playerSkills.get(data.playerId);
    const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;

    if (
      resource.levelRequired !== undefined &&
      skillLevel < resource.levelRequired
    ) {
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

    // Tool check (RuneScape-style: any hatchet qualifies; tier affects speed)
    if (resource.skillRequired === "woodcutting") {
      const axeInfo = this.getBestAxeTier(data.playerId);
      if (!axeInfo) {
        this.sendChat(data.playerId, `You need an axe to chop this tree.`);
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need an axe to chop this tree.`,
          type: "error",
        });
        return;
      }

      // Enforce axe level requirement
      const cached = this.playerSkills.get(data.playerId);
      const wcLevel = cached?.[resource.skillRequired]?.level ?? 1;
      if (wcLevel < axeInfo.levelRequired) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need level ${axeInfo.levelRequired} woodcutting to use this axe.`,
          type: "error",
        });
        return;
      }
    }

    // Tool check for mining (RuneScape-style: any pickaxe qualifies; tier affects speed)
    if (resource.skillRequired === "mining") {
      const pickaxeInfo = this.getBestPickaxeTier(data.playerId);
      if (!pickaxeInfo) {
        this.sendChat(data.playerId, `You need a pickaxe to mine this rock.`);
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need a pickaxe to mine this rock.`,
          type: "error",
        });
        return;
      }

      // Enforce pickaxe level requirement
      const cached = this.playerSkills.get(data.playerId);
      const miningLevel = cached?.[resource.skillRequired]?.level ?? 1;
      if (miningLevel < pickaxeInfo.levelRequired) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `You need level ${pickaxeInfo.levelRequired} mining to use this pickaxe.`,
          type: "error",
        });
        return;
      }
    }

    // If player is already gathering, replace session with the latest request
    if (this.activeGathering.has(playerId)) {
      this.activeGathering.delete(playerId);
    }

    // Start RS-like timed gathering session
    const actionName =
      resource.skillRequired === "woodcutting"
        ? "chopping"
        : resource.skillRequired === "mining"
          ? "mining"
          : resource.skillRequired === "fishing"
            ? "fishing"
            : "gathering";
    const resourceName = resource.name || resource.type.replace("_", " ");

    // Create tick-based session
    const sessionResourceId = createResourceID(resource.id);

    // Get current tick from world (OSRS-accurate tick-based timing)
    const currentTick = this.world.currentTick || 0;

    // Compute tick-based cycle interval
    const variant =
      this.resourceVariants.get(sessionResourceId) ||
      (resource.type === "ore" ? "ore_copper" : "tree_normal");
    const tuned = this.getVariantTuning(variant);
    // Get appropriate tool multiplier based on skill type
    const axe =
      resource.skillRequired === "woodcutting"
        ? this.getBestAxeTier(data.playerId)
        : null;
    const pickaxe =
      resource.skillRequired === "mining"
        ? this.getBestPickaxeTier(data.playerId)
        : null;
    const toolMultiplier = axe
      ? axe.cycleMultiplier
      : pickaxe
        ? pickaxe.cycleMultiplier
        : 1.0;
    const cycleTickInterval = this.computeCycleTicks(
      skillLevel,
      tuned,
      toolMultiplier,
    );

    // Schedule first attempt on next tick
    // IMPORTANT: Set nextAttemptTick to currentTick + cycleTickInterval (not +1)
    // This gives the player time to get into position before the first attempt
    this.activeGathering.set(playerId, {
      playerId,
      resourceId: sessionResourceId,
      startTick: currentTick,
      nextAttemptTick: currentTick + cycleTickInterval, // First attempt after one full cycle
      cycleTickInterval,
      attempts: 0,
      successes: 0,
    });

    console.log(
      `[ResourceSystem] Started gathering session for ${data.playerId} on ${resource.id} (variant: ${variant}, cycleTicks: ${cycleTickInterval}, nextAttemptTick: ${currentTick + cycleTickInterval})`,
    );

    // Set gathering emote for the player
    if (resource.skillRequired === "woodcutting") {
      this.setGatheringEmote(data.playerId, "chopping");
    } else if (resource.skillRequired === "mining") {
      this.setGatheringEmote(data.playerId, "mining");
      console.log(
        `[ResourceSystem] Set mining emote for ${data.playerId}, gathering session active: ${this.activeGathering.has(playerId)}`,
      );
    }

    // Emit gathering started event with tick timing info for client progress bar
    this.emitTypedEvent(EventType.RESOURCE_GATHERING_STARTED, {
      playerId: data.playerId,
      resourceId: resource.id,
      skill: resource.skillRequired,
      cycleTicks: cycleTickInterval,
      tickDurationMs: TICK_DURATION_MS,
    });

    // Send feedback to player via chat and UI
    this.sendChat(data.playerId, `You start ${actionName}...`);
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: `You start ${actionName} the ${resourceName.toLowerCase()}...`,
      type: "info",
    });

    // Broadcast toast to client via network
    this.sendNetworkMessage("showToast", {
      playerId: data.playerId,
      message: `You start ${actionName} the ${resourceName.toLowerCase()}...`,
      type: "info",
    });
  }

  private stopGathering(data: { playerId: string }): void {
    const playerId = createPlayerID(data.playerId);
    const session = this.activeGathering.get(playerId);
    if (session) {
      console.log(
        `[ResourceSystem] Stopping gathering for ${data.playerId}, resource: ${session.resourceId}`,
      );
      this.activeGathering.delete(playerId);

      // Reset emote back to idle when gathering stops
      this.resetGatheringEmote(data.playerId);

      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: data.playerId,
        resourceId: session.resourceId,
      });
    } else {
      console.warn(
        `[ResourceSystem] stopGathering called for ${data.playerId} but no active session found`,
      );
    }
  }

  private cleanupPlayerGathering(playerId: string): void {
    this.activeGathering.delete(createPlayerID(playerId));
  }

  /**
   * Process resource respawns on tick (OSRS-accurate tick-based timing)
   * Replaces setTimeout-based respawn with deterministic tick counting
   */
  private processRespawns(tickNumber: number): void {
    const respawnedResources: ResourceID[] = [];

    for (const [resourceId, respawnTick] of this.respawnAtTick.entries()) {
      if (tickNumber >= respawnTick) {
        const resource = this.resources.get(resourceId);
        if (resource) {
          resource.isAvailable = true;
          resource.lastDepleted = 0;

          // Call entity respawn method if available
          const ent = this.world.entities.get(resourceId);
          if (
            ent &&
            typeof (ent as unknown as { respawn?: () => void }).respawn ===
              "function"
          ) {
            (ent as unknown as { respawn: () => void }).respawn();
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
   * Process gathering on each server tick (OSRS-accurate)
   * Called by TickSystem at RESOURCES priority
   */
  public processGatheringTick(tickNumber: number): void {
    // Process respawns first (tick-based)
    this.processRespawns(tickNumber);

    // Process active gathering sessions
    const completedSessions: PlayerID[] = [];

    for (const [playerId, session] of this.activeGathering.entries()) {
      const resource = this.resources.get(session.resourceId);
      if (!resource?.isAvailable) {
        console.log(
          `[ResourceSystem] Resource ${session.resourceId} not available, ending session for ${playerId}`,
        );
        // Resource depleted, end session
        completedSessions.push(playerId);
        continue;
      }

      // Only process when it's time for the next attempt (tick-based)
      if (tickNumber < session.nextAttemptTick) {
        // IMPORTANT: Keep emote active while waiting for next attempt
        // The emote should loop continuously during gathering (VRM factory loops by default)
        // Re-apply emote periodically to ensure it stays active (every 5 ticks = 3 seconds)
        // This ensures the animation keeps looping even if something resets it
        if (tickNumber % 5 === 0) {
          const resource = this.resources.get(session.resourceId);
          if (resource) {
            if (resource.skillRequired === "woodcutting") {
              this.setGatheringEmote(playerId as unknown as string, "chopping");
            } else if (resource.skillRequired === "mining") {
              this.setGatheringEmote(playerId as unknown as string, "mining");
            }
          }
        }
        continue;
      }

      console.log(
        `[ResourceSystem] Processing gathering attempt for ${playerId} on ${session.resourceId} (tick ${tickNumber}, nextAttemptTick: ${session.nextAttemptTick})`,
      );

      // Proximity check before attempt
      // Try multiple ways to get player position (robust lookup)
      let playerPos: { x: number; y: number; z: number } | null = null;

      // Method 1: Try world.getPlayer
      const p = this.world.getPlayer?.(playerId as unknown as string);
      if (
        p &&
        (p as { position?: { x: number; y: number; z: number } }).position
      ) {
        playerPos = (p as { position: { x: number; y: number; z: number } })
          .position;
      }

      // Method 2: Try entities.getPlayer directly
      if (!playerPos && this.world.entities?.getPlayer) {
        const p2 = this.world.entities.getPlayer(playerId as unknown as string);
        if (
          p2 &&
          (p2 as { position?: { x: number; y: number; z: number } }).position
        ) {
          playerPos = (p2 as { position: { x: number; y: number; z: number } })
            .position;
        }
      }

      // Method 3: Try entities.getPlayers and find by ID
      if (!playerPos && this.world.entities?.getPlayers) {
        const players = this.world.entities.getPlayers();
        const foundPlayer = players.find(
          (pl: { id?: string }) => pl.id === (playerId as unknown as string),
        );
        if (
          foundPlayer &&
          (foundPlayer as { position?: { x: number; y: number; z: number } })
            .position
        ) {
          playerPos = (
            foundPlayer as { position: { x: number; y: number; z: number } }
          ).position;
        }
      }

      // Method 4: Try direct access to entities.players Map (server-side players may be here)
      if (
        !playerPos &&
        this.world.entities &&
        (this.world.entities as { players?: Map<string, unknown> }).players
      ) {
        const playersMap = (
          this.world.entities as { players: Map<string, unknown> }
        ).players;
        const playerFromMap = playersMap.get(playerId as unknown as string);
        if (
          playerFromMap &&
          (playerFromMap as { position?: { x: number; y: number; z: number } })
            .position
        ) {
          playerPos = (
            playerFromMap as { position: { x: number; y: number; z: number } }
          ).position;
        }
      }

      // Method 5: Try PlayerSystem.players Map (server-side player storage)
      if (!playerPos) {
        const playerSystem = this.world.getSystem?.("player") as {
          players?: Map<
            string,
            { position?: { x: number; y: number; z: number } }
          >;
        } | null;
        if (playerSystem?.players) {
          const playerFromSystem = playerSystem.players.get(
            playerId as unknown as string,
          );
          if (playerFromSystem?.position) {
            playerPos = playerFromSystem.position;
          }
        }
      }

      if (!playerPos) {
        console.warn(
          `[ResourceSystem] Player ${playerId} position not found (tried all methods), stopping gathering`,
        );
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId as unknown as string,
          resourceId: session.resourceId,
        });
        completedSessions.push(playerId);
        continue;
      }
      const distance = calculateDistance(playerPos, resource.position);
      if (distance > 4.0) {
        console.warn(
          `[ResourceSystem] Player ${playerId} too far from resource (${distance.toFixed(2)}m > 4.0m), stopping gathering`,
        );
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId as unknown as string,
          resourceId: session.resourceId,
        });
        completedSessions.push(playerId);
        continue;
      }

      // Get variant tuning for this resource
      const variant =
        this.resourceVariants.get(session.resourceId) ||
        (resource.type === "ore" ? "ore_copper" : "tree_normal");
      const tuned = this.getVariantTuning(variant);

      // Get drop table for this variant
      const drops = this.RESOURCE_DROPS.get(variant) || [];
      const primaryDrop = drops[0] as ResourceDrop | undefined;
      const itemId = primaryDrop?.itemId || "logs";
      const itemName = primaryDrop?.itemName || "Logs";

      // Debug logging for ore production
      if (resource.skillRequired === "mining") {
        console.log(
          `[ResourceSystem] Mining attempt - variant: ${variant}, drops: ${drops.length}, itemId: ${itemId}, itemName: ${itemName}`,
        );
      }

      // Inventory capacity guard - if full, stop session
      const inventorySystem = this.world.getSystem?.("inventory") as {
        getInventory?: (playerId: string) => {
          items?: unknown[];
          capacity?: number;
        };
      } | null;
      if (inventorySystem?.getInventory) {
        const inv = inventorySystem.getInventory(playerId as unknown as string);
        const capacity = (inv?.capacity as number) ?? 28;
        const count = Array.isArray(inv?.items) ? inv!.items!.length : 0;
        if (count >= capacity) {
          const resourceTypeName =
            resource.skillRequired === "mining"
              ? "ore"
              : resource.skillRequired === "woodcutting"
                ? "logs"
                : "items";
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: playerId as unknown as string,
            message: `Your inventory is too full to hold any more ${resourceTypeName}.`,
            type: "warning",
          });
          this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
            playerId: playerId as unknown as string,
            resourceId: session.resourceId,
          });
          completedSessions.push(playerId);
          continue;
        }
      }

      // Schedule next attempt (tick-based)
      session.nextAttemptTick = tickNumber + session.cycleTickInterval;
      session.attempts++;

      // IMPORTANT: Re-apply emote after each attempt to ensure it keeps looping
      // This ensures the mining/chopping animation continues swinging continuously
      if (resource.skillRequired === "woodcutting") {
        this.setGatheringEmote(playerId as unknown as string, "chopping");
      } else if (resource.skillRequired === "mining") {
        this.setGatheringEmote(playerId as unknown as string, "mining");
      }

      // Attempt success roll
      const cachedSkills = this.playerSkills.get(playerId);
      const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;
      const successRate = this.computeSuccessRate(skillLevel, tuned);
      const isSuccessful = Math.random() < successRate;

      if (isSuccessful) {
        session.successes++;

        // Add item to inventory (ore for mining, logs for woodcutting, etc.)
        console.log(
          `[ResourceSystem] ✅ Mining success! Adding ${itemId} (${itemName}) to inventory for ${playerId}`,
        );

        // IMPORTANT: Use createItemID to ensure proper ID format (same as woodcutting)
        // This ensures the itemId is properly validated and formatted
        const validItemId = createItemID(itemId);

        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId: playerId as unknown as string,
          item: {
            id: `inv_${playerId}_${Date.now()}_${itemId}`,
            itemId: validItemId,
            quantity: 1,
            slot: -1,
            metadata: null,
          },
        });

        // Award XP immediately
        const xpAmount = tuned.xpPerLog; // Also used as xpPerOre for mining
        this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
          playerId: playerId as unknown as string,
          skill: resource.skillRequired,
          amount: xpAmount,
        });

        // Feedback (resource-aware)
        this.sendChat(
          playerId as unknown as string,
          `You receive 1x ${itemName}.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId as unknown as string,
          message: `You get some ${itemName.toLowerCase()}. (+${xpAmount} ${resource.skillRequired} XP)`,
          type: "success",
        });

        // Depletion roll
        if (Math.random() < tuned.depleteChance) {
          // Deplete resource and schedule tick-based respawn
          resource.isAvailable = false;
          resource.lastDepleted = Date.now();

          const resourceEntity = this.world.entities.get(session.resourceId);
          if (
            resourceEntity &&
            typeof (resourceEntity as unknown as { deplete?: () => void })
              .deplete === "function"
          ) {
            (resourceEntity as unknown as { deplete: () => void }).deplete();
          }

          this.emitTypedEvent(EventType.RESOURCE_DEPLETED, {
            resourceId: session.resourceId,
            position: resource.position,
          });

          // Resource-aware depletion message
          const depletionMessage =
            resource.skillRequired === "mining"
              ? "The rock is depleted of ore."
              : resource.skillRequired === "woodcutting"
                ? "The tree is chopped down."
                : "The resource is depleted.";
          this.sendChat(playerId as unknown as string, depletionMessage);
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

          // Stop gathering when resource depletes (emote will be reset)
          completedSessions.push(playerId);
        }
        // IMPORTANT: If successful but resource doesn't deplete, gathering CONTINUES
        // The emote stays active and the player keeps swinging until:
        // - Resource depletes (handled above)
        // - Player moves away (handled in proximity check)
        // - Inventory fills (handled in inventory check)
        // - Player explicitly stops gathering
      } else {
        // Failure feedback (resource-aware)
        // IMPORTANT: On failure, gathering CONTINUES - player keeps swinging
        // The emote stays active and we'll try again on the next cycle
        const failureMessage =
          resource.skillRequired === "mining"
            ? "You fail to mine any ore."
            : resource.skillRequired === "woodcutting"
              ? "You fail to chop the tree."
              : "You fail to gather the resource.";
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId as unknown as string,
          message: failureMessage,
          type: "info",
        });
        // Don't add to completedSessions - gathering continues!
      }
    }

    // Clean up completed sessions
    for (const playerId of completedSessions) {
      this.activeGathering.delete(playerId);
      // Reset emote back to idle when gathering completes
      this.resetGatheringEmote(playerId as unknown as string);
    }
  }

  // Legacy completeGathering() method removed - continuous loop in updateGathering() handles all gathering now

  // ===== Tuning helpers (TICK-BASED for OSRS accuracy) =====
  // OSRS Reference: https://oldschool.runescape.wiki/w/Tick_manipulation
  // Standard woodcutting = 4 ticks (2.4 seconds) per attempt
  // Respawn times from OSRS Wiki: https://oldschool.runescape.wiki/w/Tree
  // Mining respawn times from OSRS Wiki: https://oldschool.runescape.wiki/w/Rocks
  private getVariantTuning(variantKey: string): {
    levelRequired: number;
    xpPerLog: number; // Also used as xpPerOre for mining
    baseCycleTicks: number; // Ticks between attempts (600ms each)
    depleteChance: number;
    respawnTicks: number; // Respawn time in ticks
  } {
    // OSRS-accurate: All trees use 4-tick base cycle (2.4 seconds per attempt)
    // Respawn times are OSRS-accurate from the wiki
    // Defaults for normal tree: respawns in 36-60 seconds (~60-100 ticks)
    const defaults = {
      levelRequired: 1,
      xpPerLog: 25,
      baseCycleTicks: 4, // OSRS standard: 4 ticks = 2.4s
      depleteChance: 0.125, // ~1/8 chance per log
      respawnTicks: 80, // ~48 seconds (middle of 36-60s range)
    };
    switch (variantKey) {
      case "tree_oak":
        // OSRS Wiki: Oak respawns in 14 ticks (8.4 seconds)
        return {
          levelRequired: 15,
          xpPerLog: 38, // OSRS: 37.5 rounded
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per log
          respawnTicks: 14, // OSRS-accurate: 8.4 seconds
        };
      case "tree_willow":
        // OSRS Wiki: Willow respawns in 14 ticks (8.4 seconds)
        return {
          levelRequired: 30,
          xpPerLog: 68, // OSRS: 67.5 rounded
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per log
          respawnTicks: 14, // OSRS-accurate: 8.4 seconds
        };
      case "tree_maple":
        // OSRS Wiki: Maple respawns in 59 ticks (35.4 seconds)
        return {
          levelRequired: 45,
          xpPerLog: 100,
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per log
          respawnTicks: 59, // OSRS-accurate: 35.4 seconds
        };
      case "tree_yew":
        // OSRS Wiki: Yew respawns in 99 ticks (59.4 seconds)
        return {
          levelRequired: 60,
          xpPerLog: 175,
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per log
          respawnTicks: 99, // OSRS-accurate: ~1 minute
        };
      case "tree_magic":
        // OSRS Wiki: Magic respawns in 199 ticks (119.4 seconds)
        return {
          levelRequired: 75,
          xpPerLog: 250,
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per log
          respawnTicks: 199, // OSRS-accurate: ~2 minutes
        };
      // Mining ore variants (OSRS-accurate)
      case "ore_copper":
        // OSRS Wiki: Copper rocks respawn in ~3 ticks (1.8 seconds)
        return {
          levelRequired: 1,
          xpPerLog: 17.5, // OSRS: 17.5 XP per ore
          baseCycleTicks: 4, // OSRS standard: 4 ticks = 2.4s
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 3, // OSRS-accurate: ~1.8 seconds
        };
      case "ore_tin":
        // OSRS Wiki: Tin rocks respawn in ~3 ticks (1.8 seconds)
        return {
          levelRequired: 1,
          xpPerLog: 17.5, // OSRS: 17.5 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 3, // OSRS-accurate: ~1.8 seconds
        };
      case "ore_iron":
        // OSRS Wiki: Iron rocks respawn in ~9 ticks (5.4 seconds)
        return {
          levelRequired: 15,
          xpPerLog: 35, // OSRS: 35 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 9, // OSRS-accurate: ~5.4 seconds
        };
      case "ore_coal":
        // OSRS Wiki: Coal rocks respawn in ~49 ticks (29.4 seconds)
        return {
          levelRequired: 30,
          xpPerLog: 50, // OSRS: 50 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 49, // OSRS-accurate: ~29.4 seconds
        };
      case "ore_mithril":
        // OSRS Wiki: Mithril rocks respawn in ~200 ticks (120 seconds)
        return {
          levelRequired: 55,
          xpPerLog: 80, // OSRS: 80 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 200, // OSRS-accurate: ~2 minutes
        };
      case "ore_adamantite":
        // OSRS Wiki: Adamantite rocks respawn in ~400 ticks (240 seconds)
        return {
          levelRequired: 70,
          xpPerLog: 95, // OSRS: 95 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 400, // OSRS-accurate: ~4 minutes
        };
      case "ore_runite":
        // OSRS Wiki: Runite rocks respawn in ~1200 ticks (720 seconds)
        return {
          levelRequired: 85,
          xpPerLog: 125, // OSRS: 125 XP per ore
          baseCycleTicks: 4, // OSRS standard
          depleteChance: 0.125, // ~1/8 chance per ore
          respawnTicks: 1200, // OSRS-accurate: ~12 minutes
        };
      default:
        return defaults;
    }
  }

  /**
   * Compute gathering cycle in ticks (OSRS-accurate)
   * Higher skill level = fewer ticks between attempts
   * Better tools = fewer ticks (via multiplier)
   */
  private computeCycleTicks(
    skillLevel: number,
    tuned: { levelRequired: number; baseCycleTicks: number },
    toolMultiplier: number = 1.0,
  ): number {
    const levelDelta = Math.max(0, skillLevel - tuned.levelRequired);
    // Up to ~30% faster at high level delta
    const levelFactor = Math.min(0.3, levelDelta * 0.005);
    const baseTicks = Math.ceil(tuned.baseCycleTicks * (1 - levelFactor));
    // Apply tool multiplier (better axes = fewer ticks)
    const finalTicks = Math.floor(baseTicks * toolMultiplier);
    // Minimum 2 ticks (1.2s) to prevent instant gathering
    return Math.max(2, finalTicks);
  }

  /**
   * Convert ticks to milliseconds for client progress bar
   */
  private ticksToMs(ticks: number): number {
    return ticks * TICK_DURATION_MS;
  }

  private computeSuccessRate(
    skillLevel: number,
    tuned: { levelRequired: number },
  ): number {
    // Base 35% at requirement, +1% per level above, clamp [0.25, 0.85]
    const delta = skillLevel - tuned.levelRequired;
    const base = 0.35 + Math.max(0, delta) * 0.01;
    return Math.max(0.25, Math.min(0.85, base));
  }

  private getBestAxeTier(
    playerId: string,
  ): { id: string; levelRequired: number; cycleMultiplier: number } | null {
    // Known axe tiers: bronze, iron, steel, mithril, adamant, rune, dragon
    const tiers: Array<{
      id: string;
      levelRequired: number;
      cycleMultiplier: number;
      match: (id: string) => boolean;
    }> = [
      {
        id: "dragon_hatchet",
        levelRequired: 61,
        cycleMultiplier: 0.7,
        match: (id) =>
          id.includes("dragon") &&
          (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "rune_hatchet",
        levelRequired: 41,
        cycleMultiplier: 0.78,
        match: (id) =>
          id.includes("rune") && (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "adamant_hatchet",
        levelRequired: 31,
        cycleMultiplier: 0.84,
        match: (id) =>
          id.includes("adamant") &&
          (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "mithril_hatchet",
        levelRequired: 21,
        cycleMultiplier: 0.88,
        match: (id) =>
          id.includes("mithril") &&
          (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "steel_hatchet",
        levelRequired: 6,
        cycleMultiplier: 0.92,
        match: (id) =>
          id.includes("steel") &&
          (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "iron_hatchet",
        levelRequired: 1,
        cycleMultiplier: 0.96,
        match: (id) =>
          id.includes("iron") && (id.includes("hatchet") || id.includes("axe")),
      },
      {
        id: "bronze_hatchet",
        levelRequired: 1,
        cycleMultiplier: 1.0,
        match: (id) =>
          id.includes("bronze") &&
          (id.includes("hatchet") || id.includes("axe")),
      },
    ];

    const inventorySystem = this.world.getSystem?.("inventory") as {
      getInventory?: (playerId: string) => {
        items?: Array<{ itemId?: string }>;
        capacity?: number;
      };
    } | null;
    const inv = inventorySystem?.getInventory
      ? inventorySystem.getInventory(playerId)
      : undefined;
    const items = (inv?.items as Array<{ itemId?: string }> | undefined) || [];
    let best: {
      id: string;
      levelRequired: number;
      cycleMultiplier: number;
    } | null = null;
    for (const t of tiers) {
      const found = items.some(
        (it) =>
          typeof it?.itemId === "string" && t.match(it.itemId!.toLowerCase()),
      );
      if (found) {
        best = {
          id: t.id,
          levelRequired: t.levelRequired,
          cycleMultiplier: t.cycleMultiplier,
        };
        break;
      }
    }
    return best;
  }

  private getBestPickaxeTier(
    playerId: string,
  ): { id: string; levelRequired: number; cycleMultiplier: number } | null {
    // Known pickaxe tiers: bronze, iron, steel, mithril, adamant, rune, dragon
    const tiers: Array<{
      id: string;
      levelRequired: number;
      cycleMultiplier: number;
      match: (id: string) => boolean;
    }> = [
      {
        id: "dragon_pickaxe",
        levelRequired: 61,
        cycleMultiplier: 0.7,
        match: (id) =>
          id.includes("dragon") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "rune_pickaxe",
        levelRequired: 41,
        cycleMultiplier: 0.78,
        match: (id) =>
          id.includes("rune") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "adamant_pickaxe",
        levelRequired: 31,
        cycleMultiplier: 0.84,
        match: (id) =>
          id.includes("adamant") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "mithril_pickaxe",
        levelRequired: 21,
        cycleMultiplier: 0.88,
        match: (id) =>
          id.includes("mithril") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "steel_pickaxe",
        levelRequired: 6,
        cycleMultiplier: 0.92,
        match: (id) =>
          id.includes("steel") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "iron_pickaxe",
        levelRequired: 1,
        cycleMultiplier: 0.96,
        match: (id) =>
          id.includes("iron") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
      {
        id: "bronze_pickaxe",
        levelRequired: 1,
        cycleMultiplier: 1.0,
        match: (id) =>
          id.includes("bronze") &&
          (id.includes("pickaxe") || id.includes("pick")),
      },
    ];

    const inventorySystem = this.world.getSystem?.("inventory") as {
      getInventory?: (playerId: string) => {
        items?: Array<{ itemId?: string }>;
        capacity?: number;
      };
    } | null;
    const inv = inventorySystem?.getInventory
      ? inventorySystem.getInventory(playerId)
      : undefined;
    const items = (inv?.items as Array<{ itemId?: string }> | undefined) || [];
    let best: {
      id: string;
      levelRequired: number;
      cycleMultiplier: number;
    } | null = null;
    for (const t of tiers) {
      const found = items.some(
        (it) =>
          typeof it?.itemId === "string" && t.match(it.itemId!.toLowerCase()),
      );
      if (found) {
        best = {
          id: t.id,
          levelRequired: t.levelRequired,
          cycleMultiplier: t.cycleMultiplier,
        };
        break;
      }
    }
    return best;
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
   * Get resource by ID
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(createResourceID(resourceId));
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all active gathering sessions
    this.activeGathering.clear();

    // Clear respawn timers map (timers are auto-cleaned by SystemBase)
    this.respawnTimers.clear();

    // Clear all resource data
    this.resources.clear();

    // Call parent cleanup (automatically clears all tracked timers, intervals, and listeners)
    super.destroy();
  }
}
