/**
 * CharacterSystem - Manages unified character entities (NPCs + Mobs)
 *
 * Handles character lifecycle including:
 * - Character spawning and despawning
 * - Respawn mechanics
 * - Character-terrain integration
 * - Loot and XP drops on death
 * - Character registration and tracking
 *
 * Integrates with:
 * - CharacterEntity (unified NPC + Mob entity)
 * - BehaviorSystem (character AI behaviors)
 * - DialogueSystem (character dialogues)
 * - CombatSystem (character combat)
 * - TerrainSystem (spawn point validation)
 *
 * @public
 */

import { SystemBase } from './SystemBase';
import type { World } from '../World';
import { EventType } from '../types/events';
import { EntityType } from '../types/entities';
import type { CharacterEntityConfig } from '../types/entities';
import type { Position3D } from '../types/core';
import { CharacterEntity } from '../entities/CharacterEntity';

// ============================================================================
// Spawn Point Configuration
// ============================================================================

interface CharacterSpawnPoint {
  id: string;
  characterId: string; // ID from characters.json manifest
  position: Position3D;
  radius: number; // Spawn radius (for wandering)
  maxCount: number; // Max characters to spawn at this point
  respawnTime: number; // Respawn delay in milliseconds
  active: boolean; // Is this spawn point active?
  currentCount: number; // Current number of spawned characters
  lastSpawnTime: number; // Timestamp of last spawn
  spawnedCharacterIds: string[]; // Entity IDs of spawned characters
}

interface RespawnTask {
  spawnPointId: string;
  characterId: string;
  scheduledTime: number; // Timestamp when respawn should occur
}

// ============================================================================
// CharacterSystem Implementation
// ============================================================================

export class CharacterSystem extends SystemBase {
  public readonly name = 'CharacterSystem';

  // Spawn points registered from world config
  private spawnPoints: Map<string, CharacterSpawnPoint> = new Map();

  // Character manifests (loaded from characters.json)
  private characterConfigs: Map<string, CharacterEntityConfig> = new Map();

  // Active characters (entity ID -> CharacterEntity)
  private characters: Map<string, CharacterEntity> = new Map();

  // Respawn queue
  private respawnTasks: RespawnTask[] = [];

  // Update interval for respawns (check every 5 seconds)
  private readonly updateInterval: number = 5000; // ms

  constructor(world: World) {
    super(world);
  }

  public init(): void {
    super.init();

    // Listen for character events
    this.listenToEvent(EventType.CHARACTER_SPAWN_REQUEST, this.onCharacterSpawnRequest.bind(this));
    this.listenToEvent(EventType.CHARACTER_DESPAWNED, this.onCharacterDespawned.bind(this));
    this.listenToEvent(EventType.CHARACTER_DIED, this.onCharacterDied.bind(this));

    // Listen for spawn point registration
    this.listenToEvent(EventType.CHARACTER_SPAWN_POINTS_REGISTERED, this.onSpawnPointsRegistered.bind(this));

    // Server-only: Respawn loop
    if (this.world.isServer) {
      this.world.intervals.push(
        setInterval(() => this.processRespawnQueue(), this.updateInterval)
      );
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private onCharacterSpawnRequest(data: {
    characterId: string;
    position: Position3D;
    spawnPointId?: string;
  }): void {
    if (!this.world.isServer) return;

    const { characterId, position, spawnPointId } = data;

    // Get character config
    const config = this.characterConfigs.get(characterId);
    if (!config) {
      console.warn(`[CharacterSystem] Character config not found: ${characterId}`);
      return;
    }

    // Spawn the character
    this.spawnCharacter(config, position, spawnPointId);
  }

  private onCharacterDespawned(data: { characterId: string; spawnPointId?: string }): void {
    if (!this.world.isServer) return;

    const { characterId, spawnPointId } = data;

    // Remove from tracking
    this.characters.delete(characterId);

    // Update spawn point count
    if (spawnPointId) {
      const spawnPoint = this.spawnPoints.get(spawnPointId);
      if (spawnPoint) {
        spawnPoint.currentCount = Math.max(0, spawnPoint.currentCount - 1);
        spawnPoint.spawnedCharacterIds = spawnPoint.spawnedCharacterIds.filter(
          id => id !== characterId
        );
      }
    }
  }

  private onCharacterDied(data: {
    characterId: string;
    killerId?: string;
    killerType?: string;
    position: Position3D;
  }): void {
    if (!this.world.isServer) return;

    const { characterId, killerId, killerType, position } = data;

    const character = this.characters.get(characterId);
    if (!character) return;

    // Drop loot
    if (character.config.lootTable && character.config.lootTable.length > 0) {
      this.dropLoot(character, position);
    }

    // Award XP to killer (if player)
    if (killerType === 'player' && killerId && character.config.xpReward) {
      this.emitTypedEvent(EventType.PLAYER_XP_GAINED, {
        playerId: killerId,
        xp: character.config.xpReward
      });
    }

    // Schedule respawn (if character has respawn enabled)
    const spawnPointId = (character as { spawnPointId?: string }).spawnPointId;
    if (spawnPointId) {
      const spawnPoint = this.spawnPoints.get(spawnPointId);
      if (spawnPoint && spawnPoint.respawnTime > 0) {
        this.scheduleRespawn(spawnPointId, character.characterId, spawnPoint.respawnTime);
      }
    }

    // Despawn the character entity
    this.emitTypedEvent(EventType.CHARACTER_DESPAWNED, {
      characterId: characterId,
      spawnPointId: spawnPointId
    });

    // Remove character from world
    character.destroy();
  }

  private onSpawnPointsRegistered(data: { spawnPoints: CharacterSpawnPoint[] }): void {
    if (!this.world.isServer) return;

    const { spawnPoints } = data;

    for (const spawnPoint of spawnPoints) {
      this.registerSpawnPoint(spawnPoint);
    }

    console.log(`[CharacterSystem] Registered ${spawnPoints.length} spawn points`);
  }

  // ============================================================================
  // Character Spawning
  // ============================================================================

  private spawnCharacter(
    config: CharacterEntityConfig,
    position: Position3D,
    spawnPointId?: string
  ): CharacterEntity | null {
    // Validate position (check terrain)
    if (!this.isValidSpawnPosition(position)) {
      console.warn(`[CharacterSystem] Invalid spawn position:`, position);
      return null;
    }

    // Create character entity
    const characterConfig: CharacterEntityConfig = {
      ...config,
      type: EntityType.CHARACTER,
      position: position
    };

    const character = new CharacterEntity(this.world, characterConfig);

    // Store spawn point ID on character for respawning
    if (spawnPointId) {
      (character as { spawnPointId?: string }).spawnPointId = spawnPointId;
    }

    // Initialize character
    character.init().then(() => {
      // Track character
      this.characters.set(character.id, character);

      // Update spawn point
      if (spawnPointId) {
        const spawnPoint = this.spawnPoints.get(spawnPointId);
        if (spawnPoint) {
          spawnPoint.currentCount++;
          spawnPoint.spawnedCharacterIds.push(character.id);
          spawnPoint.lastSpawnTime = Date.now();
        }
      }

      // Emit character spawned event
      this.emitTypedEvent(EventType.CHARACTER_SPAWNED, {
        characterId: character.id,
        characterType: character.characterType,
        position: character.getPosition(),
        config: characterConfig
      });

      console.log(
        `[CharacterSystem] Spawned character: ${character.name} (${character.characterType}) at`,
        position
      );
    });

    return character;
  }

  private isValidSpawnPosition(position: Position3D): boolean {
    // Basic validation - position should be within world bounds
    // TODO: Add terrain collision checking

    // Check if position is valid (not NaN, not Infinity)
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }

    // Check if position is above ground (y > 0 for most cases)
    if (position.y < -100) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Spawn Point Management
  // ============================================================================

  public registerSpawnPoint(spawnPoint: CharacterSpawnPoint): void {
    if (!this.world.isServer) return;

    // Initialize spawn point state
    spawnPoint.currentCount = 0;
    spawnPoint.spawnedCharacterIds = [];
    spawnPoint.lastSpawnTime = 0;

    this.spawnPoints.set(spawnPoint.id, spawnPoint);

    // Spawn initial characters
    if (spawnPoint.active && spawnPoint.maxCount > 0) {
      this.spawnAtSpawnPoint(spawnPoint);
    }
  }

  private spawnAtSpawnPoint(spawnPoint: CharacterSpawnPoint): void {
    const config = this.characterConfigs.get(spawnPoint.characterId);
    if (!config) {
      console.warn(
        `[CharacterSystem] Character config not found: ${spawnPoint.characterId}`
      );
      return;
    }

    // Spawn up to maxCount characters
    const toSpawn = spawnPoint.maxCount - spawnPoint.currentCount;
    for (let i = 0; i < toSpawn; i++) {
      // Randomize position within spawn radius
      const spawnPosition = this.randomizeSpawnPosition(spawnPoint.position, spawnPoint.radius);

      this.spawnCharacter(config, spawnPosition, spawnPoint.id);
    }
  }

  private randomizeSpawnPosition(center: Position3D, radius: number): Position3D {
    // Random position within radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;

    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y,
      z: center.z + Math.sin(angle) * distance
    };
  }

  // ============================================================================
  // Respawn Management
  // ============================================================================

  private scheduleRespawn(
    spawnPointId: string,
    characterId: string,
    respawnTime: number
  ): void {
    const scheduledTime = Date.now() + respawnTime;

    this.respawnTasks.push({
      spawnPointId,
      characterId,
      scheduledTime
    });

    console.log(
      `[CharacterSystem] Scheduled respawn for ${characterId} at spawn point ${spawnPointId} in ${respawnTime}ms`
    );
  }

  private processRespawnQueue(): void {
    if (!this.world.isServer) return;

    const now = Date.now();
    const tasksToProcess: RespawnTask[] = [];

    // Find tasks that are ready to execute
    this.respawnTasks = this.respawnTasks.filter(task => {
      if (task.scheduledTime <= now) {
        tasksToProcess.push(task);
        return false; // Remove from queue
      }
      return true; // Keep in queue
    });

    // Execute respawn tasks
    for (const task of tasksToProcess) {
      this.executeRespawn(task);
    }
  }

  private executeRespawn(task: RespawnTask): void {
    const spawnPoint = this.spawnPoints.get(task.spawnPointId);
    if (!spawnPoint) {
      console.warn(`[CharacterSystem] Spawn point not found: ${task.spawnPointId}`);
      return;
    }

    // Check if spawn point is still active
    if (!spawnPoint.active) {
      return;
    }

    // Check if spawn point is at max capacity
    if (spawnPoint.currentCount >= spawnPoint.maxCount) {
      console.log(
        `[CharacterSystem] Spawn point ${task.spawnPointId} at max capacity, skipping respawn`
      );
      return;
    }

    // Spawn the character
    this.spawnAtSpawnPoint(spawnPoint);

    console.log(
      `[CharacterSystem] Respawned character ${task.characterId} at spawn point ${task.spawnPointId}`
    );
  }

  // ============================================================================
  // Loot System
  // ============================================================================

  private dropLoot(character: CharacterEntity, position: Position3D): void {
    const lootTable = character.config.lootTable;
    if (!lootTable || lootTable.length === 0) return;

    // Roll for each loot entry
    for (const lootEntry of lootTable) {
      const roll = Math.random();

      if (roll <= lootEntry.chance) {
        // Determine quantity
        const quantity =
          lootEntry.minQuantity === lootEntry.maxQuantity
            ? lootEntry.minQuantity
            : Math.floor(
                Math.random() * (lootEntry.maxQuantity - lootEntry.minQuantity + 1) +
                  lootEntry.minQuantity
              );

        // Spawn loot item
        this.emitTypedEvent(EventType.ITEM_SPAWN_LOOT, {
          itemId: lootEntry.itemId,
          quantity,
          position: {
            x: position.x + (Math.random() - 0.5) * 2, // Spread loot slightly
            y: position.y + 0.5,
            z: position.z + (Math.random() - 0.5) * 2
          }
        });
      }
    }
  }

  // ============================================================================
  // Character Configuration Management
  // ============================================================================

  /**
   * Load character configurations from manifest
   * Called by world initialization
   */
  public loadCharacterConfigs(configs: CharacterEntityConfig[]): void {
    for (const config of configs) {
      this.characterConfigs.set(config.characterId, config);
    }

    console.log(`[CharacterSystem] Loaded ${configs.length} character configurations`);
  }

  /**
   * Get character configuration by ID
   */
  public getCharacterConfig(characterId: string): CharacterEntityConfig | undefined {
    return this.characterConfigs.get(characterId);
  }

  /**
   * Get all registered spawn points
   */
  public getSpawnPoints(): CharacterSpawnPoint[] {
    return Array.from(this.spawnPoints.values());
  }

  /**
   * Get active characters
   */
  public getCharacters(): CharacterEntity[] {
    return Array.from(this.characters.values());
  }

  /**
   * Get character by entity ID
   */
  public getCharacter(entityId: string): CharacterEntity | undefined {
    return this.characters.get(entityId);
  }

  /**
   * Activate/deactivate a spawn point
   */
  public setSpawnPointActive(spawnPointId: string, active: boolean): void {
    if (!this.world.isServer) return;

    const spawnPoint = this.spawnPoints.get(spawnPointId);
    if (!spawnPoint) {
      console.warn(`[CharacterSystem] Spawn point not found: ${spawnPointId}`);
      return;
    }

    spawnPoint.active = active;

    if (active) {
      // Spawn characters immediately
      this.spawnAtSpawnPoint(spawnPoint);
    } else {
      // Despawn all characters from this spawn point
      for (const characterId of spawnPoint.spawnedCharacterIds) {
        const character = this.characters.get(characterId);
        if (character) {
          character.destroy();
        }
      }
      spawnPoint.currentCount = 0;
      spawnPoint.spawnedCharacterIds = [];
    }
  }

  /**
   * Force respawn all characters at all spawn points
   */
  public respawnAll(): void {
    if (!this.world.isServer) return;

    // Despawn all existing characters
    for (const character of this.characters.values()) {
      character.destroy();
    }
    this.characters.clear();

    // Reset spawn point counts
    for (const spawnPoint of this.spawnPoints.values()) {
      spawnPoint.currentCount = 0;
      spawnPoint.spawnedCharacterIds = [];
    }

    // Spawn at all active spawn points
    for (const spawnPoint of this.spawnPoints.values()) {
      if (spawnPoint.active) {
        this.spawnAtSpawnPoint(spawnPoint);
      }
    }

    console.log('[CharacterSystem] Respawned all characters');
  }

  // ============================================================================
  // System Lifecycle
  // ============================================================================

  public destroy(): void {
    // Despawn all characters
    for (const character of this.characters.values()) {
      character.destroy();
    }

    this.characters.clear();
    this.spawnPoints.clear();
    this.characterConfigs.clear();
    this.respawnTasks = [];

    super.destroy();
  }
}
