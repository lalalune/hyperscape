import { SystemBase } from "../infrastructure/SystemBase";
import { TerrainSystem } from "../world/TerrainSystem";
import { uuid } from "../../../utils";
import type { World } from "../../../types";
import { EventType } from "../../../types/events";
import { Resource, ResourceDrop } from "../../../types/core/core";
import { PlayerID, ResourceID } from "../../../types/core/identifiers";
import { calculateDistance } from "../../../utils/game/EntityUtils";
import {
  createPlayerID,
  createResourceID,
} from "../../../utils/IdentifierUtils";
import type { TerrainResourceSpawnPoint } from "../../../types/world/terrain";
import { TICK_DURATION_MS } from "../movement/TileSystem";
import { getExternalResource } from "../../../utils/ExternalAssetUtils";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";

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
  // Track manifest-spawned resources (from world-areas.json) - these should NOT be deleted on tile unload
  private manifestResourceIds = new Set<ResourceID>();
  // Terrain system reference for height lookups
  private terrainSystem: TerrainSystem | null = null;

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

    // Load explicit resource placements from world-areas.json (server only)
    // This must be in start() not init() because network broadcast isn't ready during init()
    if (this.world.isServer) {
      // NOTE: Gathering is processed via processGatheringTick() called by TickSystem
      // This interval is kept for backward compatibility but does nothing
      const _interval = this.createInterval(() => {
        // Gathering is handled by TickSystem.processGatheringTick()
      }, 500);
      this.initializeWorldAreaResources();
    }
    // Client doesn't run gathering update loop
  }

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

    for (const [_areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (!area.resources || area.resources.length === 0) continue;

      const spawnPoints: TerrainResourceSpawnPoint[] = [];

      for (const r of area.resources) {
        // Look up resource in manifest to get authoritative type
        const resourceData = getExternalResource(r.resourceId);
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
            groundedY = terrainHeight + 0.1; // Slight offset above ground
          }
        }

        spawnPoints.push({
          position: { x: r.position.x, y: groundedY, z: r.position.z },
          type: mappedType as TerrainResourceSpawnPoint["type"],
          subType: subType as TerrainResourceSpawnPoint["subType"],
        });
      }

      if (spawnPoints.length > 0) {
        // Pass isManifest: true to protect these resources from tile unload deletion
        this.registerTerrainResources({ spawnPoints, isManifest: true });
      }
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

    let _spawned = 0;
    let _failed = 0;

    for (const spawnPoint of spawnPoints) {
      const resource = this.createResourceFromSpawnPoint(spawnPoint);
      if (!resource) {
        _failed++;
        continue;
      }

      // Store in map for tracking
      const rid = createResourceID(resource.id);
      this.resources.set(rid, resource);

      // Mark manifest resources so they're not deleted on tile unload
      if (isManifest) {
        this.manifestResourceIds.add(rid);
      }

      // Track variant/subtype for tuning (e.g., 'tree_oak')
      if (resource.type === "tree") {
        // Build full key: if subType is "normal", key is "tree_normal"
        const variant = spawnPoint.subType
          ? `tree_${spawnPoint.subType}`
          : "tree_normal";
        this.resourceVariants.set(rid, variant);
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

      const resourceConfig = {
        id: resource.id,
        type: "resource" as const,
        name: resource.name,
        position: {
          x: resource.position.x,
          y: resource.position.y,
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
        resourceType: resource.type,
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
        // Manifest-driven model config
        depletedModelPath: this.getDepletedModelPathForResource(
          resource.type,
          spawnPoint.subType,
        ),
        modelScale: this.getScaleForResource(resource.type, spawnPoint.subType),
        depletedModelScale: this.getDepletedScaleForResource(
          resource.type,
          spawnPoint.subType,
        ),
      };

      try {
        const spawnedEntity = (await entityManager.spawnEntity(
          resourceConfig,
        )) as { id?: string } | null;
        if (spawnedEntity) {
          _spawned++;
        } else {
          _failed++;
        }
      } catch (err) {
        _failed++;
        console.error(
          `[ResourceSystem] Failed to spawn resource entity ${resource.id}:`,
          err,
        );
      }
    }
    // Resource spawning completed
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
      // Fallback for resources not in manifest
      switch (type) {
        case "tree":
          return "asset://models/basic-tree/basic-tree.glb";
        case "fishing_spot":
          return ""; // Fishing spots don't need models
        default:
          return ""; // Use placeholder for other resources
      }
    }

    // Return modelPath (can be null for fishing spots, etc.)
    return manifestData.modelPath || "";
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
    // e.g., "tree_normal", "tree_oak", "fishing_spot_normal"
    const variantKey =
      resourceType === "tree"
        ? spawnPoint.subType
          ? `tree_${spawnPoint.subType}`
          : "tree_normal"
        : `${resourceType}_normal`;

    // Get manifest data - fail fast if not found
    const manifestData = getExternalResource(variantKey);
    if (!manifestData) {
      throw new Error(
        `[ResourceSystem] Resource manifest not found for '${variantKey}'. ` +
          `Ensure resources.json is loaded and contains this resource type.`,
      );
    }

    // All values come from manifest - no hardcoding
    const resource: Resource = {
      id: `${type}_${position.x.toFixed(0)}_${position.z.toFixed(0)}`,
      type: resourceType,
      name: manifestData.name,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      skillRequired: manifestData.harvestSkill,
      levelRequired: manifestData.levelRequired,
      toolRequired: manifestData.toolRequired || "",
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

        // Clean up respawn timer (now managed by SystemBase auto-cleanup)
        this.respawnTimers.delete(resourceId);
      }
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

    // If player is already gathering, replace session with the latest request
    if (this.activeGathering.has(playerId)) {
      this.activeGathering.delete(playerId);
    }

    // Start RS-like timed gathering session
    const actionName =
      resource.skillRequired === "woodcutting"
        ? "chopping"
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
      this.resourceVariants.get(sessionResourceId) || "tree_normal";
    const tuned = this.getVariantTuning(variant);
    const axe = this.getBestAxeTier(data.playerId);
    const toolMultiplier = axe ? axe.cycleMultiplier : 1.0;
    const cycleTickInterval = this.computeCycleTicks(
      skillLevel,
      tuned,
      toolMultiplier,
    );

    // Schedule first attempt on next tick
    this.activeGathering.set(playerId, {
      playerId,
      resourceId: sessionResourceId,
      startTick: currentTick,
      nextAttemptTick: currentTick + 1, // First attempt next tick
      cycleTickInterval,
      attempts: 0,
      successes: 0,
    });

    // Set gathering emote for the player
    if (resource.skillRequired === "woodcutting") {
      this.setGatheringEmote(data.playerId, "chopping");
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
      this.activeGathering.delete(playerId);

      // Reset emote back to idle when gathering stops
      this.resetGatheringEmote(data.playerId);

      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: data.playerId,
        resourceId: session.resourceId,
      });
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
        // Resource depleted, end session
        completedSessions.push(playerId);
        continue;
      }

      // Only process when it's time for the next attempt (tick-based)
      if (tickNumber < session.nextAttemptTick) continue;

      // Proximity check before attempt
      const p = this.world.getPlayer?.(playerId as unknown as string);
      const playerPos =
        p && (p as { position?: { x: number; y: number; z: number } }).position
          ? (p as { position: { x: number; y: number; z: number } }).position
          : null;
      if (!playerPos || calculateDistance(playerPos, resource.position) > 4.0) {
        this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
          playerId: playerId as unknown as string,
          resourceId: session.resourceId,
        });
        completedSessions.push(playerId);
        continue;
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
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: playerId as unknown as string,
            message: "Your inventory is too full to hold any more logs.",
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

      // Get variant tuning for this resource
      const variant =
        this.resourceVariants.get(session.resourceId) || "tree_normal";
      const tuned = this.getVariantTuning(variant);

      // Schedule next attempt (tick-based)
      session.nextAttemptTick = tickNumber + session.cycleTickInterval;
      session.attempts++;

      // Attempt success roll
      const cachedSkills = this.playerSkills.get(playerId);
      const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;
      const successRate = this.computeSuccessRate(skillLevel, tuned);
      const isSuccessful = Math.random() < successRate;

      if (isSuccessful) {
        session.successes++;

        // Add one log to inventory
        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId: playerId as unknown as string,
          item: {
            id: `inv_${playerId}_${Date.now()}_logs`,
            itemId: "logs",
            quantity: 1,
            slot: -1,
            metadata: null,
          },
        });

        // Award XP per log immediately
        const xpPerLog = tuned.xpPerLog;
        this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
          playerId: playerId as unknown as string,
          skill: resource.skillRequired,
          amount: xpPerLog,
        });

        // Feedback
        this.sendChat(
          playerId as unknown as string,
          `You receive 1x ${"Logs"}.`,
        );
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId as unknown as string,
          message: `You get some logs. (+${xpPerLog} ${resource.skillRequired} XP)`,
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
          this.sendChat(
            playerId as unknown as string,
            "The tree is chopped down.",
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
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: playerId as unknown as string,
          message: `You fail to chop the tree.`,
          type: "info",
        });
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
    this.manifestResourceIds.clear();

    // Call parent cleanup (automatically clears all tracked timers, intervals, and listeners)
    super.destroy();
  }
}
