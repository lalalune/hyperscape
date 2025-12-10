import { ALL_NPCS, getNPCById } from "../../../data/npcs";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import type { NPCData, MobSpawnStats } from "../../../types/core/core";
import { EventType } from "../../../types/events";
import type { World } from "../../../types/index";
import type { EntitySpawnedEvent } from "../../../types/systems/system-interfaces";
import { SystemBase } from "../infrastructure/SystemBase";
import { TerrainSystem } from "..";

// Types are now imported from shared type files

/**
 * Mob NPC Spawner System
 *
 * Uses EntityManager to spawn mob entities instead of MobApp objects.
 * Creates and manages all combat NPC instances (mobs, bosses, quest enemies)
 * across the world based on GDD specifications.
 */
export class MobNPCSpawnerSystem extends SystemBase {
  private spawnedMobs = new Map<string, string>(); // mobId -> entityId
  private mobIdCounter = 0;
  private terrainSystem!: TerrainSystem;
  private lastSpawnTime = 0;
  private readonly SPAWN_COOLDOWN = 5000; // 5 seconds between spawns

  constructor(world: World) {
    super(world, {
      name: "mob-npc-spawner",
      dependencies: {
        required: ["entity-manager", "terrain"], // Depends on EntityManager and terrain for placement
        optional: ["mob-npc"], // Better with mob NPC system
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Get terrain system reference
    this.terrainSystem = this.world.getSystem<TerrainSystem>("terrain")!;

    // Set up event subscriptions for mob lifecycle (do not consume MOB_NPC_SPAWN_REQUEST to avoid re-emission loops)
    this.subscribe<{ mobId: string }>(EventType.MOB_NPC_DESPAWN, (data) => {
      this.despawnMob(data.mobId);
    });
    this.subscribe(EventType.MOB_NPC_RESPAWN_ALL, (_event) =>
      this.respawnAllMobs(),
    );

    // Subscribe to terrain generation to spawn mobs for new tiles
    this.subscribe(EventType.TERRAIN_TILE_GENERATED, (data) =>
      this.onTileGenerated(
        data as { tileX: number; tileZ: number; biome: string },
      ),
    );

    // Listen for entity spawned events to track our mobs
    this.subscribe<EntitySpawnedEvent>(EventType.ENTITY_SPAWNED, (data) => {
      // Only handle mob entities
      if (data.entityType === "mob") {
        this.handleEntitySpawned(data);
      }
    });
  }

  async start(): Promise<void> {
    // Spawn NPCs immediately at world start (they're static, not reactive to terrain)
    // NPCs like bank clerks, shopkeepers should be available from the start
    if (this.world.isServer) {
      await this.spawnAllNPCsFromManifest();
    }
    // Mobs are spawned reactively as terrain tiles generate via world-areas.json
  }

  /**
   * Spawn all NPCs defined in world-areas.json immediately
   * Unlike mobs, NPCs are static and should be available at world start
   */
  private async spawnAllNPCsFromManifest(): Promise<void> {
    // Wait for EntityManager to be ready
    let entityManager = this.world.getSystem("entity-manager") as {
      spawnEntity?: (config: unknown) => Promise<unknown>;
    } | null;
    let attempts = 0;

    while ((!entityManager || !entityManager.spawnEntity) && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      entityManager = this.world.getSystem("entity-manager") as {
        spawnEntity?: (config: unknown) => Promise<unknown>;
      } | null;
      attempts++;
    }

    if (!entityManager?.spawnEntity) {
      console.error(
        "[MobNPCSpawnerSystem] ❌ EntityManager not available for NPC spawning",
      );
      return;
    }

    // Get terrain height function
    const terrainSystem = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number | null;
    } | null;

    for (const area of Object.values(ALL_WORLD_AREAS)) {
      if (!area.npcs || area.npcs.length === 0) continue;

      for (const npc of area.npcs) {
        // Get ground height at NPC position
        const groundY =
          terrainSystem?.getHeightAt?.(npc.position.x, npc.position.z) ?? 43;
        const spawnY = groundY + 1.0;

        // ALL NPC data comes from npcs.json manifest - world-areas only provides position/type
        const npcManifestData = getNPCById(npc.id);
        if (!npcManifestData) {
          console.warn(
            `[MobNPCSpawnerSystem] ⚠️ NPC ${npc.id} not found in npcs.json manifest!`,
          );
          continue; // Skip NPCs not in manifest
        }

        const modelPath =
          npcManifestData.appearance?.modelPath ||
          "asset://models/human/human_rigged.glb";
        const npcServices = npcManifestData.services?.types || [];
        const npcDescription = npcManifestData.description || npc.id;
        const npcName = npcManifestData.name || npc.id;

        const npcConfig = {
          id: `npc_${npc.id}_${Date.now()}`,
          type: "npc" as const,
          name: npcName, // From npcs.json
          position: { x: npc.position.x, y: spawnY, z: npc.position.z },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 100, y: 100, z: 100 }, // Scale up rigged models
          visible: true,
          interactable: true,
          interactionType: "talk",
          interactionDistance: 3,
          description: npcDescription, // From npcs.json
          model: modelPath, // From npcs.json
          properties: {},
          npcType: npc.type, // From world-areas (bank, store, etc.)
          npcId: npc.id, // Manifest ID for dialogue lookup
          dialogueLines: [],
          services: npcServices, // From npcs.json
          inventory: [],
          skillsOffered: [],
          questsAvailable: [],
        };

        try {
          await entityManager.spawnEntity(npcConfig);
        } catch (err) {
          console.error(
            `[MobNPCSpawnerSystem] ❌ Failed to spawn NPC ${npc.id}:`,
            err,
          );
        }
      }
    }
  }

  /**
   * Spawn a default test mob for initial world content
   */
  private async spawnDefaultMob(): Promise<void> {
    // Wait for EntityManager to be ready
    let entityManager = this.world.getSystem("entity-manager") as {
      spawnEntity?: (config: unknown) => Promise<unknown>;
    } | null;
    let attempts = 0;

    while ((!entityManager || !entityManager.spawnEntity) && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      entityManager = this.world.getSystem("entity-manager") as {
        spawnEntity?: (config: unknown) => Promise<unknown>;
      } | null;
      attempts++;
    }

    if (!entityManager?.spawnEntity) {
      console.error(
        "[MobNPCSpawnerSystem] ❌ EntityManager never became available after 10 seconds!",
      );
      return;
    }

    // Use reasonable Y position (server will adjust to terrain)
    const y = 40;
    const spawnPosition = { x: 2, y: y, z: 2 };

    // Get goblin data from manifest - fail fast if not found
    const goblinData = getNPCById("goblin");

    if (!goblinData) {
      throw new Error(
        `[MobNPCSpawnerSystem] NPC manifest not found for 'goblin'. ` +
          `Ensure npcs.json is loaded and contains this NPC type.`,
      );
    }

    if (!goblinData.appearance?.modelPath) {
      throw new Error(
        `[MobNPCSpawnerSystem] NPC 'goblin' has no modelPath defined in manifest.`,
      );
    }

    // Build mob config from manifest data
    const mobConfig = {
      id: "default_goblin_1",
      type: "mob" as const,
      name: goblinData.name,
      position: spawnPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: {
        x: goblinData.appearance.scale ?? 1,
        y: goblinData.appearance.scale ?? 1,
        z: goblinData.appearance.scale ?? 1,
      },
      visible: true,
      interactable: true,
      interactionType: "attack",
      interactionDistance: 10,
      description: goblinData.description,
      model: goblinData.appearance.modelPath,
      properties: {},
      // MobEntity specific - from manifest
      mobType: goblinData.id,
      level: goblinData.stats.level,
      currentHealth: goblinData.stats.health,
      maxHealth: goblinData.stats.health,
      attack: goblinData.stats.attack,
      attackPower: goblinData.stats.strength,
      defense: goblinData.stats.defense,
      attackSpeedTicks: goblinData.combat.attackSpeedTicks,
      moveSpeed: goblinData.movement.speed,
      xpReward: goblinData.combat.xpReward,
      lootTable: goblinData.drops.common.map((drop) => ({
        itemId: drop.itemId,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
        chance: drop.chance,
      })),
      spawnPoint: spawnPosition,
      aggressive: goblinData.combat.aggressive,
      retaliates: goblinData.combat.retaliates,
      attackable: goblinData.combat.attackable ?? true,
      movementType: goblinData.movement.type,
      aggroRange: goblinData.combat.aggroRange,
      combatRange: goblinData.combat.combatRange,
      wanderRadius: goblinData.movement.wanderRadius,
      aiState: "idle",
      targetPlayerId: null,
      lastAttackTime: 0,
      deathTime: null,
      respawnTime: goblinData.combat.respawnTime,
    };

    try {
      await entityManager.spawnEntity(mobConfig);
    } catch (err) {
      console.error(
        "[MobNPCSpawnerSystem] ❌ Error spawning default goblin:",
        err,
      );
    }
  }

  private async spawnMobFromData(
    mobData: NPCData,
    position: { x: number; y: number; z: number },
  ): Promise<void> {
    // Use spawn point position as key to prevent duplicates (same spot = same mob)
    const spawnKey = `${mobData.id}_${Math.round(position.x)}_${Math.round(position.z)}`;

    // Check if we already spawned at this location
    if (this.spawnedMobs.has(spawnKey)) {
      return;
    }

    // Generate unique mob ID for the entity
    const mobId = `gdd_${mobData.id}_${this.mobIdCounter++}`;

    // Track this spawn point BEFORE spawning to prevent race conditions
    this.spawnedMobs.set(spawnKey, mobId);

    // Get EntityManager to spawn directly (like original spawnDefaultMob)
    const entityManager = this.world.getSystem("entity-manager") as {
      spawnEntity?: (config: unknown) => Promise<unknown>;
    } | null;

    if (!entityManager?.spawnEntity) {
      console.error("[MobNPCSpawnerSystem] EntityManager not available");
      return;
    }

    // Build COMPLETE config from manifest data (matching original hardcoded format)
    const mobConfig = {
      id: mobId,
      type: "mob" as const,
      name: mobData.name, // Use manifest name directly (e.g., "Goblin")
      position: position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: {
        x: mobData.appearance.scale ?? 1,
        y: mobData.appearance.scale ?? 1,
        z: mobData.appearance.scale ?? 1,
      },
      visible: true,
      interactable: true,
      interactionType: "attack",
      interactionDistance: 10,
      description: mobData.description,
      model: mobData.appearance.modelPath,
      properties: {},
      // MobEntity specific - from manifest
      mobType: mobData.id,
      level: mobData.stats.level,
      currentHealth: mobData.stats.health,
      maxHealth: mobData.stats.health,
      attack: mobData.stats.attack,
      attackPower: mobData.stats.strength,
      defense: mobData.stats.defense,
      attackSpeedTicks: mobData.combat.attackSpeedTicks,
      moveSpeed: mobData.movement.speed,
      xpReward: mobData.combat.xpReward,
      lootTable: mobData.drops.common.map((drop) => ({
        itemId: drop.itemId,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
        chance: drop.chance,
      })),
      spawnPoint: position,
      aggressive: mobData.combat.aggressive,
      retaliates: mobData.combat.retaliates,
      attackable: mobData.combat.attackable ?? true,
      movementType: mobData.movement.type,
      aggroRange: mobData.combat.aggroRange,
      combatRange: mobData.combat.combatRange,
      wanderRadius: mobData.movement.wanderRadius,
      aiState: "idle",
      targetPlayerId: null,
      lastAttackTime: 0,
      deathTime: null,
      respawnTime: mobData.combat.respawnTime,
    };

    try {
      await entityManager.spawnEntity(mobConfig);
    } catch (err) {
      console.error(`[MobNPCSpawnerSystem] Error spawning ${mobData.id}:`, err);
    }
  }

  private handleEntitySpawned(data: EntitySpawnedEvent): void {
    // Track mobs spawned by the EntityManager
    if (data.entityType === "mob" && data.entityData?.mobType) {
      // Find matching request based on mob type and position
      for (const [mobId] of this.spawnedMobs) {
        if (
          !this.spawnedMobs.get(mobId) &&
          mobId.includes(data.entityData.mobType as string)
        ) {
          this.spawnedMobs.set(mobId, data.entityId!);
          break;
        }
      }
    }
  }

  // Note: This system intentionally does not handle MOB_NPC_SPAWN_REQUEST events to prevent
  // recursive re-emission loops. It only produces spawn requests via spawnMobFromData.

  private despawnMob(mobId: string): void {
    const entityId = this.spawnedMobs.get(mobId);
    if (entityId) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
      this.spawnedMobs.delete(mobId);
    }
  }

  private respawnAllMobs(): void {
    // Kill all existing mobs
    for (const [_mobId, entityId] of this.spawnedMobs) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
    }
    this.spawnedMobs.clear();

    // Mobs will respawn naturally as terrain tiles remain loaded
    // TerrainSystem will re-emit TERRAIN_TILE_GENERATED which will trigger mob spawning
  }

  // Public API
  getSpawnedMobs(): Map<string, string> {
    return this.spawnedMobs;
  }

  getMobCount(): number {
    return this.spawnedMobs.size;
  }

  getMobsByType(mobType: string): string[] {
    const mobEntityIds: string[] = [];
    for (const [id, entityId] of this.spawnedMobs) {
      if (id.includes(mobType)) {
        mobEntityIds.push(entityId);
      }
    }
    return mobEntityIds;
  }

  getMobStats(): MobSpawnStats {
    const stats = {
      totalMobs: this.spawnedMobs.size,
      level1Mobs: 0,
      level2Mobs: 0,
      level3Mobs: 0,
      byType: {} as Record<string, number>,
      spawnedMobs: this.spawnedMobs.size,
    };

    for (const [mobId] of this.spawnedMobs) {
      for (const mobType of ALL_NPCS.keys()) {
        if (mobId.includes(mobType)) {
          stats.byType[mobType] = (stats.byType[mobType] || 0) + 1;
        }
      }
    }

    return stats;
  }

  /**
   * Handle terrain tile generation - spawn mobs for new tiles
   */
  private onTileGenerated(tileData: {
    tileX: number;
    tileZ: number;
    biome: string;
  }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    const tileBounds = {
      minX: tileData.tileX * TILE_SIZE,
      maxX: (tileData.tileX + 1) * TILE_SIZE,
      minZ: tileData.tileZ * TILE_SIZE,
      maxZ: (tileData.tileZ + 1) * TILE_SIZE,
    };

    // Find which world areas overlap with this new tile
    const overlappingAreas: Array<
      (typeof ALL_WORLD_AREAS)[keyof typeof ALL_WORLD_AREAS]
    > = [];
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      const areaBounds = area.bounds;
      // Simple bounding box overlap check
      if (
        tileBounds.minX < areaBounds.maxX &&
        tileBounds.maxX > areaBounds.minX &&
        tileBounds.minZ < areaBounds.maxZ &&
        tileBounds.maxZ > areaBounds.minZ
      ) {
        overlappingAreas.push(area);
      }
    }

    if (overlappingAreas.length > 0) {
      this.generateContentForTile(tileData, overlappingAreas);
    }
  }

  /**
   * Generate mobs for overlapping world areas
   */
  private generateContentForTile(
    tileData: { tileX: number; tileZ: number },
    areas: Array<(typeof ALL_WORLD_AREAS)[keyof typeof ALL_WORLD_AREAS]>,
  ): void {
    for (const area of areas) {
      // Spawn mobs from world-areas.ts data if they fall within this tile
      this.generateMobSpawnsForArea(area, tileData);
    }
  }

  /**
   * Spawn mobs from a world area when its tile generates
   */
  private generateMobSpawnsForArea(
    area: (typeof ALL_WORLD_AREAS)[keyof typeof ALL_WORLD_AREAS],
    tileData: { tileX: number; tileZ: number },
  ): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();

    for (const spawnPoint of area.mobSpawns) {
      const spawnTileX = Math.floor(spawnPoint.position.x / TILE_SIZE);
      const spawnTileZ = Math.floor(spawnPoint.position.z / TILE_SIZE);

      if (spawnTileX === tileData.tileX && spawnTileZ === tileData.tileZ) {
        const mobData = ALL_NPCS.get(spawnPoint.mobId);
        if (!mobData) continue;

        // Spawn maxCount mobs (default to 1 if not specified)
        const maxCount = spawnPoint.maxCount ?? 1;
        // Use spawnRadius for spreading, or 2 units if multiple mobs but no radius
        const effectiveRadius =
          spawnPoint.spawnRadius > 0
            ? spawnPoint.spawnRadius
            : maxCount > 1
              ? 2
              : 0;

        for (let i = 0; i < maxCount; i++) {
          // Calculate position: spread mobs evenly in circle when multiple
          let mobX = spawnPoint.position.x;
          let mobZ = spawnPoint.position.z;

          if (maxCount > 1) {
            // Deterministic positions: evenly spaced in a circle
            const angle = (i / maxCount) * Math.PI * 2;
            mobX += Math.cos(angle) * effectiveRadius;
            mobZ += Math.sin(angle) * effectiveRadius;
          }

          // Ground mob spawn to terrain height
          let mobY = spawnPoint.position.y;
          const th = this.terrainSystem.getHeightAt(mobX, mobZ);
          if (Number.isFinite(th)) mobY = (th as number) + 0.1;

          this.spawnMobFromData(mobData, { x: mobX, y: mobY, z: mobZ });
        }
      }
    }
  }

  // Required System lifecycle methods
  update(_dt: number): void {
    // Update mob behaviors, check for respawns, etc.
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all spawn tracking
    this.spawnedMobs.clear();

    // Reset counter
    this.mobIdCounter = 0;

    // Call parent cleanup
    super.destroy();
  }
}
