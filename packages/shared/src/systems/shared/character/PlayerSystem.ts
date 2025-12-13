/**
 * PlayerSystem.ts - Player Management and Lifecycle System
 *
 * Central system for managing all player-related functionality including:
 * - Player spawning and initialization
 * - Health, stamina, and death/respawn
 * - Combat level calculation
 * - Attack style management
 * - Player state persistence to database
 * - Starter equipment provisioning
 *
 * **Player Lifecycle:**
 * 1. PLAYER_ENTER event → Load/create player data
 * 2. PLAYER_SPAWN_REQUEST → Position player in world
 * 3. Provide starter equipment
 * 4. Auto-save player data periodically (30s)
 * 5. PLAYER_LEAVE → Save final state to database
 *
 * **Attack Styles:**
 * Manages RuneScape-style attack modes:
 * - attack: +3 Attack XP per damage
 * - strength: +3 Strength XP per damage
 * - defense: +3 Defense XP per damage
 * - controlled: +1 to each combat stat XP
 * - ranged: Ranged combat style
 *
 * **Combat Level:**
 * Calculated from combat skills using RuneScape formula:
 * Base = 0.25 * (Defense + Constitution + floor(Ranged/2))
 * Melee = 0.325 * (Attack + Strength)
 * Ranged = 0.325 * (Ranged * 1.5)
 * Combat Level = Base + max(Melee, Ranged)
 *
 * **Referenced by:** All gameplay systems, database, network
 */

import { getItem } from "../../../data/items";
import type { PlayerLocal } from "../../../entities/player/PlayerLocal";
import type { PlayerEntity } from "../../../entities/player/PlayerEntity";
import { Position3D } from "../../../types";
import {
  AttackStyle,
  AttackType,
  Player,
  PlayerAttackStyleState,
  PlayerMigration,
  PlayerSpawnData,
  Skills,
} from "../../../types/core/core";
import type {
  HealthUpdateEvent,
  PlayerDeathEvent,
  PlayerEnterEvent,
  PlayerLeaveEvent,
  PlayerLevelUpEvent,
} from "../../../types/events";
import { EventType } from "../../../types/events";
import type { World } from "../../../types/index";
import { Logger } from "../../../utils/Logger";
import { EntityManager } from "..";
import { SystemBase } from "..";
import type { TerrainSystem } from "..";
import { PlayerIdMapper } from "../../../utils/PlayerIdMapper";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import * as THREE from "three";

/**
 * PlayerSystem - Central Player Management
 *
 * Handles all player-related operations: spawning, stats, health, attack styles, and persistence.
 */
export class PlayerSystem extends SystemBase {
  declare world: World;

  private players = new Map<string, Player>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private entityManager?: EntityManager;
  private databaseSystem?: DatabaseSystem;
  private playerLocalRefs = new Map<string, PlayerLocal>(); // Store PlayerLocal references for integration
  private readonly RESPAWN_TIME = 30000; // 30 seconds per GDD
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds auto-save
  private saveInterval?: NodeJS.Timeout;
  private _tempVec3 = new THREE.Vector3();

  // Player spawn tracking (merged from PlayerSpawnSystem)
  private spawnedPlayers = new Map<string, PlayerSpawnData>();
  private _tempVec3_1 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  private _tempVec3_3 = new THREE.Vector3();
  /** Starter equipment for new players */
  private readonly STARTER_EQUIPMENT: Array<{
    itemId: string;
    slot: string;
    autoEquip: boolean;
  }> = [{ itemId: "bronze_sword", slot: "weapon", autoEquip: true }];

  // Attack style tracking (merged from AttackStyleSystem)
  private playerAttackStyles = new Map<string, PlayerAttackStyleState>();
  private styleChangeTimers = new Map<string, NodeJS.Timeout>();
  private readonly STYLE_CHANGE_COOLDOWN = 0; // No cooldown - instant style switching like RuneScape
  private skillSaveTimers = new Map<string, NodeJS.Timeout>();

  // Attack styles per GDD - Train one skill exclusively
  private readonly ATTACK_STYLES: Record<string, AttackStyle> = {
    accurate: {
      id: "accurate",
      name: "Accurate",
      description: "Train Attack only. (Hitpoints always trained separately)",
      xpDistribution: {
        attack: 100, // 100% Attack XP
        strength: 0,
        defense: 0,
        constitution: 0, // Constitution always trained separately at 1.33 XP per damage
      },
      damageModifier: 1.0, // Normal damage
      accuracyModifier: 1.15, // +15% accuracy
      icon: "🎯",
    },

    aggressive: {
      id: "aggressive",
      name: "Aggressive",
      description: "Train Strength only. (Hitpoints always trained separately)",
      xpDistribution: {
        attack: 0,
        strength: 100, // 100% Strength XP
        defense: 0,
        constitution: 0, // Constitution always trained separately at 1.33 XP per damage
      },
      damageModifier: 1.15, // +15% damage
      accuracyModifier: 1.0, // Normal accuracy
      icon: "⚔️",
    },

    defensive: {
      id: "defensive",
      name: "Defensive",
      description: "Train Defense only. (Hitpoints always trained separately)",
      xpDistribution: {
        attack: 0,
        strength: 0,
        defense: 100, // 100% Defense XP
        constitution: 0, // Constitution always trained separately at 1.33 XP per damage
      },
      damageModifier: 0.85, // -15% damage dealt
      accuracyModifier: 1.0, // Normal accuracy
      icon: "🛡️",
    },

    controlled: {
      id: "controlled",
      name: "Controlled",
      description:
        "Train Attack, Strength, and Defense equally. (Hitpoints always trained separately)",
      xpDistribution: {
        attack: 33, // 33% of combat XP to Attack
        strength: 33, // 33% of combat XP to Strength
        defense: 34, // 34% of combat XP to Defense
        constitution: 0, // Constitution always trained separately at 1.33 XP per damage
      },
      damageModifier: 1.0, // Normal damage
      accuracyModifier: 1.0, // Normal accuracy
      icon: "⚖️",
    },
  };

  constructor(world: World) {
    super(world, {
      name: "player",
      dependencies: {
        optional: ["entity-manager", "database", "ui"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Subscribe to player events using strongly typed event system
    this.subscribe(EventType.PLAYER_JOINED, (data) => {
      this.onPlayerEnter(data as PlayerEnterEvent);
    });
    this.subscribe(EventType.PLAYER_SPAWN_REQUEST, (data) =>
      this.onPlayerSpawnRequest(
        data as { playerId: string; position: Position3D },
      ),
    );
    this.subscribe(EventType.PLAYER_LEFT, (data) => {
      this.onPlayerLeave(data as PlayerLeaveEvent);
    });
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      this.onPlayerRegister(data as { playerId: string });
    });
    this.subscribe(EventType.COMBAT_LEVEL_CHANGED, (data) => {
      const combatData = data as {
        entityId: string;
        oldLevel: number;
        newLevel: number;
      };
      this.onCombatLevelChanged(combatData);
    });
    this.subscribe(EventType.PLAYER_DAMAGE, (data) => {
      const damageData = data as {
        playerId: string;
        damage: number;
        source?: string;
      };
      this.damagePlayer(
        damageData.playerId,
        damageData.damage,
        damageData.source,
      );
    });
    this.subscribe(EventType.PLAYER_DAMAGE_TAKEN, (data) => {
      this.takeDamage(data as { playerId: string; damage: number });
    });
    this.subscribe<PlayerDeathEvent>(EventType.PLAYER_DIED, (data) => {
      this.handleDeath(data);
    });
    // Subscribe to PLAYER_RESPAWNED from DeathSystem to update our player data
    this.subscribe(EventType.PLAYER_RESPAWNED, (data) => {
      this.handlePlayerRespawn(
        data as {
          playerId: string;
          spawnPosition: { x: number; y: number; z: number };
          townName?: string;
        },
      );
    });
    this.subscribe<PlayerLevelUpEvent>(EventType.PLAYER_LEVEL_UP, (data) => {
      this.updateCombatLevel(data);
    });

    // Handle consumable item usage
    this.subscribe(EventType.ITEM_USED, (data) => {
      this.handleItemUsed(
        data as {
          playerId: string;
          itemId: string;
          slot: number;
          itemData: { id: string; name: string; type: string };
        },
      );
    });

    // Handle spawn completion (merged from PlayerSpawnSystem)
    this.subscribe(EventType.PLAYER_SPAWN_COMPLETE, (data) =>
      this.handleSpawnComplete(data as { playerId: string }),
    );

    // Attack style events (merged from AttackStyleSystem)
    this.subscribe(EventType.ATTACK_STYLE_CHANGED, (data) =>
      this.handleStyleChange(data as { playerId: string; newStyle: string }),
    );
    this.subscribe(EventType.COMBAT_XP_CALCULATE, (data) =>
      this.handleXPCalculation(
        data as {
          playerId: string;
          baseXP: number;
          skill: string;
          callback: (xpAmount: number) => void;
        },
      ),
    );
    this.subscribe(EventType.COMBAT_DAMAGE_CALCULATE, (data) =>
      this.handleDamageCalculation(
        data as {
          playerId: string;
          baseDamage: number;
          callback: (damage: number) => void;
        },
      ),
    );
    this.subscribe(EventType.COMBAT_ACCURACY_CALCULATE, (data) =>
      this.handleAccuracyCalculation(
        data as {
          playerId: string;
          baseAccuracy: number;
          callback: (accuracy: number) => void;
        },
      ),
    );
    this.subscribe(EventType.UI_ATTACK_STYLE_GET, (data) =>
      this.handleGetStyleInfo(
        data as {
          playerId: string;
          callback?: (info: Record<string, unknown> | null) => void;
        },
      ),
    );

    // Listen to skills updates to trigger player UI updates
    this.subscribe<{ playerId: string; skills: Skills }>(
      EventType.SKILLS_UPDATED,
      (data) => {
        this.handleSkillsUpdate(data);
      },
    );

    // Get system references using the type-safe getSystem method
    this.entityManager = this.world.getSystem<EntityManager>("entity-manager");
    // Get database system if available (server only)
    this.databaseSystem = this.world.getSystem<DatabaseSystem>("database");

    // Start auto-save
    this.startAutoSave();
  }

  private async onPlayerSpawnRequest(data: {
    playerId: string;
    position: Position3D;
  }): Promise<void> {
    const player = this.players.get(data.playerId);
    if (!player) {
      Logger.error(
        "PlayerSystem",
        new Error(`Player ${data.playerId} not found for spawn request.`),
      );
      return;
    }

    // Wait for terrain physics
    const terrainSystem = this.world.getSystem<TerrainSystem>("terrain");
    const finalPosition = this._tempVec3.set(
      data.position.x,
      data.position.y,
      data.position.z,
    );

    if (!terrainSystem) {
      console.error("[PlayerSystem] CRITICAL: TerrainSystem not found!");
      throw new Error("TerrainSystem not available during player spawn");
    }

    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      if (terrainSystem.isPhysicsReadyAt(data.position.x, data.position.z)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }
    if (attempts >= maxAttempts) {
      this.logger.error(
        `Timed out waiting for terrain physics for player ${data.playerId}.`,
      );
    }

    const height = terrainSystem.getHeightAt(data.position.x, data.position.z);

    // Strong type assumption - getHeightAt always returns number
    if (isFinite(height)) {
      finalPosition.y = height + 2.0;
    } else {
      console.error(
        `[PlayerSystem] Invalid terrain height: ${height} - using safe default Y=50`,
      );
      finalPosition.y = 50;
    }

    const terrainHeight = terrainSystem.getHeightAt(
      finalPosition.x,
      finalPosition.z,
    );
    // Strong type assumption - terrainHeight is number
    const groundedY = Number.isFinite(terrainHeight)
      ? terrainHeight + 2.0
      : finalPosition.y;
    player.position = { x: finalPosition.x, y: groundedY, z: finalPosition.z };

    // Update entity node position
    const entity = this.world.entities.get(data.playerId);
    if (entity) {
      entity.node.position.set(finalPosition.x, groundedY, finalPosition.z);

      if (entity.data && Array.isArray(entity.data.position)) {
        entity.data.position[0] = finalPosition.x;
        entity.data.position[1] = groundedY;
        entity.data.position[2] = finalPosition.z;
      }
    } else {
      console.error(
        `[PlayerSystem] CRITICAL: Entity ${data.playerId} not found in entities system!`,
      );
    }

    // Create spawn data tracking (merged from PlayerSpawnSystem)
    if (!this.spawnedPlayers.has(data.playerId)) {
      const spawnData: PlayerSpawnData = {
        playerId: data.playerId,
        position: new THREE.Vector3(
          finalPosition.x,
          groundedY,
          finalPosition.z,
        ),
        hasStarterEquipment: false,
        aggroTriggered: false,
        spawnTime: Date.now(),
      };
      this.spawnedPlayers.set(data.playerId, spawnData);
    }

    // Teleport the player to the final, grounded position
    this.emitTypedEvent(EventType.PLAYER_TELEPORT_REQUEST, {
      playerId: data.playerId,
      position: player.position,
    });

    // Emit spawn complete event
    this.emitTypedEvent(EventType.PLAYER_SPAWN_COMPLETE, {
      playerId: data.playerId,
    });
  }

  private async onPlayerRegister(data: { playerId: string }): Promise<void> {
    if (!data?.playerId) {
      console.error(
        "[PlayerSystem] ERROR: playerId is undefined in registration data!",
        data,
      );
      return;
    }

    // Note: Skills are already loaded by ServerNetwork and passed to entity spawn
    // No need to load again - just initialize attack style
    // Load saved attack style from database if available
    let savedAttackStyle: string | undefined;
    if (this.databaseSystem) {
      const databaseId = PlayerIdMapper.getDatabaseId(data.playerId);
      const dbData = await this.databaseSystem.getPlayerAsync(databaseId);
      savedAttackStyle = (dbData as { attackStyle?: string })?.attackStyle;
    }
    this.initializePlayerAttackStyle(data.playerId, savedAttackStyle);

    // CRITICAL: Send health data to client NOW (after client is connected and ready)
    // This matches the inventory initialization pattern - send data in PLAYER_REGISTERED
    const player = this.players.get(data.playerId);
    if (player) {
      // Emit PLAYER_UPDATED so EventBridge forwards to client
      this.emitTypedEvent(EventType.PLAYER_UPDATED, {
        playerId: data.playerId,
        playerData: {
          id: player.id,
          name: player.name,
          level: player.combat.combatLevel,
          health: player.health.current,
          maxHealth: player.health.max,
          alive: player.alive,
        },
      });
    }
  }

  private onCombatLevelChanged(data: {
    entityId: string;
    oldLevel: number;
    newLevel: number;
  }): void {
    // Only save on server
    if (!this.world.isServer || !this.databaseSystem) return;

    const player = this.players.get(data.entityId);
    if (!player) return;

    // Update combat level in player data (SkillsSystem already updated StatsComponent)
    player.combat.combatLevel = data.newLevel;

    // Save to database immediately
    const databaseId = PlayerIdMapper.getDatabaseId(data.entityId);
    this.databaseSystem.savePlayer(databaseId, {
      combatLevel: data.newLevel,
    });
  }

  async onPlayerEnter(data: PlayerEnterEvent): Promise<void> {
    // Check if player already exists in our system
    if (this.players.has(data.playerId)) {
      return;
    }

    // Check if entity already exists (character-select mode spawns entity before PLAYER_JOINED)
    const existingEntity = this.world.entities.get(data.playerId);
    if (existingEntity && existingEntity.position) {
      // Create spawn data tracking
      const spawnData: PlayerSpawnData = {
        playerId: data.playerId,
        position: new THREE.Vector3(
          existingEntity.position.x,
          existingEntity.position.y,
          existingEntity.position.z,
        ),
        hasStarterEquipment: false,
        aggroTriggered: false,
        spawnTime: Date.now(),
      };
      this.spawnedPlayers.set(data.playerId, spawnData);
    }

    // Determine which ID to use for database lookups
    // Use userId (persistent account ID) if available, otherwise use playerId (session ID)
    const databaseId = data.userId || data.playerId;

    // Load player data from database
    let playerData: Player | undefined;
    if (this.databaseSystem) {
      const dbData = await this.databaseSystem.getPlayerAsync(databaseId);
      if (dbData) {
        playerData = PlayerMigration.fromPlayerRow(dbData, data.playerId);
      }
    }

    // Create new player if not found in database
    if (!playerData) {
      const playerLocal = this.playerLocalRefs.get(data.playerId);
      // CRITICAL: Use the playerLocal.name from the entity spawn, which comes from the character DB record
      // Never auto-generate names - they must come from the character creation system
      const playerName = playerLocal?.name || "Adventurer";

      playerData = PlayerMigration.createNewPlayer(
        data.playerId,
        data.playerId,
        playerName,
      );

      // Ground initial spawn to terrain height on server
      const terrain = this.world.getSystem<TerrainSystem>("terrain");
      if (terrain) {
        const px = playerData.position.x;
        const pz = playerData.position.z;
        const h = terrain.getHeightAt(px, pz);
        if (Number.isFinite(h)) {
          playerData.position.y = h + 0.1;
        }
      }

      // Save new player to database using persistent userId
      // NOTE: Don't save name here - it was already set by createCharacter()
      if (this.databaseSystem) {
        await this.databaseSystem.savePlayerAsync(databaseId, {
          // Explicitly omit name to avoid overwriting the character's name
          combatLevel: playerData.combat.combatLevel,
          attackLevel: playerData.skills.attack.level,
          strengthLevel: playerData.skills.strength.level,
          defenseLevel: playerData.skills.defense.level,
          constitutionLevel: playerData.skills.constitution.level,
          rangedLevel: playerData.skills.ranged.level,
          health: playerData.health.current,
          maxHealth: playerData.health.max,
          positionX: playerData.position.x,
          positionY: playerData.position.y,
          positionZ: playerData.position.z,
        });
      }
    }

    // Register userId mapping for database persistence (critical!)
    if (data.userId) {
      PlayerIdMapper.register(data.playerId, data.userId);
      (playerData as Player & { userId?: string }).userId = data.userId;
    }

    // Ensure health equals constitution level (per user requirement)
    const constitutionLevel =
      Number.isFinite(playerData.skills.constitution.level) &&
      playerData.skills.constitution.level > 0
        ? playerData.skills.constitution.level
        : 10;

    // Always set maxHealth to constitution level
    playerData.health.max = constitutionLevel;

    // Validate and fix health values
    if (
      !Number.isFinite(playerData.health.current) ||
      playerData.health.current <= 0 // FIX: Changed < to <= (0 health means dead!)
    ) {
      // Player is dead or has invalid health - restore to full
      playerData.health.current = playerData.health.max;
      playerData.alive = true; // Ensure player is alive
    } else {
      // Clamp current health to maxHealth
      playerData.health.current = Math.min(
        playerData.health.current,
        playerData.health.max,
      );
    }

    // Add to our system using entity ID for runtime lookups
    this.players.set(data.playerId, playerData);

    // Emit player ready event
    this.emitTypedEvent(EventType.PLAYER_UPDATED, {
      playerId: data.playerId,
      playerData: {
        id: playerData.id,
        name: playerData.name,
        level: playerData.combat.combatLevel,
        health: playerData.health.current,
        maxHealth: playerData.health.max,
        alive: playerData.alive,
      },
    });

    // Update UI
    this.emitPlayerUpdate(data.playerId);

    // If entity doesn't exist yet, wait for spawn request to create spawn data
    // This happens during initial join before character select
  }

  async onPlayerLeave(data: PlayerLeaveEvent): Promise<void> {
    // Save player data before removal
    if (this.databaseSystem && this.players.has(data.playerId)) {
      await this.savePlayerToDatabase(data.playerId);
    }

    // Clean up
    this.players.delete(data.playerId);
    this.playerLocalRefs.delete(data.playerId);

    // Clean up spawn data (merged from PlayerSpawnSystem)
    this.spawnedPlayers.delete(data.playerId);
    this.cleanupPlayerMobs(data.playerId);

    // Clean up attack style (merged from AttackStyleSystem)
    const styleTimer = this.styleChangeTimers.get(data.playerId);
    if (styleTimer) {
      clearTimeout(styleTimer);
      this.styleChangeTimers.delete(data.playerId);
    }
    this.playerAttackStyles.delete(data.playerId);

    // Unregister userId mapping
    PlayerIdMapper.unregister(data.playerId);

    // Clear any respawn timers
    const timer = this.respawnTimers.get(data.playerId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(data.playerId);
    }
  }

  async updateHealth(data: HealthUpdateEvent): Promise<void> {
    const player = this.players.get(data.entityId);
    if (!player) {
      return;
    }

    // Validate health values to prevent NaN
    const validMaxHealth =
      Number.isFinite(data.maxHealth) && data.maxHealth > 0
        ? data.maxHealth
        : player.health.max;
    const validCurrentHealth = Number.isFinite(data.currentHealth)
      ? data.currentHealth
      : player.health.current;

    // Additional safety checks to prevent NaN values - validate before assignment
    if (!Number.isFinite(validMaxHealth) || validMaxHealth <= 0) {
      Logger.systemError(
        "PlayerSystem",
        `Invalid maxHealth value: ${validMaxHealth}, using default 100`,
        new Error(`Invalid maxHealth: ${validMaxHealth}`),
      );
      player.health.max = 100;
    } else {
      player.health.max = validMaxHealth;
    }

    if (!Number.isFinite(validCurrentHealth)) {
      Logger.systemError(
        "PlayerSystem",
        `Invalid currentHealth value: ${validCurrentHealth}, using maxHealth`,
        new Error(`Invalid currentHealth: ${validCurrentHealth}`),
      );
      player.health.current = player.health.max;
    } else {
      // Floor to ensure health is always an integer (RuneScape-style)
      player.health.current = Math.floor(
        Math.max(0, Math.min(validCurrentHealth, player.health.max)),
      );
    }

    // Check for death
    if (player.health.current <= 0 && player.alive) {
      this.handleDeath({
        playerId: data.entityId,
        deathLocation: player.position,
        cause: "health_depletion",
      });
    }

    this.emitPlayerUpdate(data.entityId);
  }

  private handleDeath(data: PlayerDeathEvent): void {
    const player = this.players.get(data.playerId);
    if (!player) {
      return; // Player not found, ignore
    }

    // Prevent infinite recursion: if player is already dead, don't process again
    if (!player.alive) {
      return; // Already dead, ignore duplicate death events
    }

    // Mark player as dead in PlayerSystem data
    player.alive = false;
    player.death.deathLocation = { ...player.position };
    player.death.respawnTime = Date.now() + this.RESPAWN_TIME;

    // Emit ENTITY_DEATH for DeathSystem to handle (headstones, loot, respawn)
    // DeathSystem will handle the full death flow including respawn
    this.emitTypedEvent(EventType.ENTITY_DEATH, {
      entityId: data.playerId,
      killedBy: data.cause || "unknown",
      entityType: "player" as const,
    });

    this.emitPlayerUpdate(data.playerId);
  }

  /**
   * Apply damage to a player and update health
   */
  private takeDamage(data: { playerId: string; damage: number }): void {
    const player = this.players.get(data.playerId);
    if (!player) {
      return;
    }

    // Apply damage - floor to ensure health is always an integer (RuneScape-style)
    const newHealth = Math.floor(
      Math.max(0, player.health.current - data.damage),
    );
    player.health.current = newHealth;

    // Update player entity if it exists
    const playerEntity = this.world.entities.get(
      data.playerId,
    ) as PlayerEntity | null;
    if (playerEntity && "setHealth" in playerEntity) {
      playerEntity.setHealth(newHealth);

      // Set lastDamageTick for health regen cooldown (17 ticks = 10.2s after damage)
      (playerEntity as unknown as { lastDamageTick: number }).lastDamageTick =
        this.world.currentTick;
    }

    // Check for death
    if (newHealth <= 0) {
      this.handleDeath({
        playerId: data.playerId,
        deathLocation: player.position,
        cause: "combat",
      });
    }

    // Emit health update
    this.emitTypedEvent(EventType.ENTITY_HEALTH_CHANGED, {
      entityId: data.playerId,
      health: newHealth,
      maxHealth: player.health.max,
    });

    this.emitPlayerUpdate(data.playerId);
  }

  /**
   * Handle player respawn (called by DeathSystem via PLAYER_RESPAWNED event)
   * DeathSystem handles the full respawn logic, we just update PlayerSystem data
   */
  private handlePlayerRespawn(data: {
    playerId: string;
    spawnPosition: { x: number; y: number; z: number };
    townName?: string;
  }): void {
    const player = this.players.get(data.playerId);
    if (!player) {
      return;
    }

    // Reset player state to alive
    player.alive = true;
    player.health.current = player.health.max;
    player.position = data.spawnPosition;
    player.death.respawnTime = 0;
    player.death.deathLocation = null;

    // Update PlayerEntity health if it exists
    const playerEntity = this.world.getPlayer?.(
      data.playerId,
    ) as PlayerEntity | null;
    if (playerEntity) {
      playerEntity.setHealth(player.health.max);
    }

    // Update PlayerLocal position if available
    const playerLocal = this.playerLocalRefs.get(data.playerId);
    if (playerLocal) {
      playerLocal.position.set(
        data.spawnPosition.x,
        data.spawnPosition.y,
        data.spawnPosition.z,
      );
    }

    this.emitPlayerUpdate(data.playerId);
  }

  private updateCombatLevel(data: PlayerLevelUpEvent): void {
    const player = this.players.get(data.playerId)!;

    // Recalculate combat level based on current stats
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);
    this.emitPlayerUpdate(data.playerId);
  }

  private emitPlayerUpdate(playerId: string): void {
    const player = this.players.get(playerId)!;

    const playerData = {
      id: player.id,
      playerId: playerId,
      name: player.name,
      level: player.combat.combatLevel,
      combatLevel: player.combat.combatLevel, // Add explicit combatLevel field
      health: {
        current: player.health.current,
        max: player.health.max,
      },
      alive: player.alive,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
      skills: player.skills,
      stamina: player.stamina?.current || 100,
      maxStamina: player.stamina?.max || 100,
      coins: player.coins || 0,
      combatStyle: player.combat.combatStyle || "attack",
    };

    // Emit PLAYER_UPDATED for systems
    this.emitTypedEvent(EventType.PLAYER_UPDATED, {
      playerId,
      component: "player",
      data: playerData,
    });

    // Emit STATS_UPDATE for systems that depend on it
    this.emitTypedEvent(EventType.STATS_UPDATE, playerData);

    // Emit UI_UPDATE for client UI
    this.emitTypedEvent(EventType.UI_UPDATE, {
      component: "player",
      data: playerData,
    });
  }

  // Public API methods
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  isPlayerAlive(playerId: string): boolean {
    const player = this.players.get(playerId);
    return !!player?.alive;
  }

  getPlayerHealth(
    playerId: string,
  ): { current: number; max: number } | undefined {
    const player = this.players.get(playerId);
    return player
      ? { current: player.health.current, max: player.health.max }
      : undefined;
  }

  healPlayer(playerId: string, amount: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;

    const oldHealth = player.health.current;
    // Floor to ensure health is always an integer (RuneScape-style)
    player.health.current = Math.floor(
      Math.min(player.health.max, player.health.current + amount),
    );

    if (player.health.current !== oldHealth) {
      this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
        playerId,
        health: player.health.current,
        maxHealth: player.health.max,
      });
      this.emitPlayerUpdate(playerId);
      return true;
    }

    return false;
  }

  private handleItemUsed(data: {
    playerId: string;
    itemId: string;
    slot: number;
    itemData: { id: string; name: string; type: string };
  }): void {
    // Check if this is a consumable item
    if (data.itemData.type !== "consumable" && data.itemData.type !== "food") {
      return;
    }

    // Get the full item data to check for healing properties
    const itemData = getItem(data.itemId);
    if (!itemData || !itemData.healAmount || itemData.healAmount <= 0) {
      return;
    }

    // Apply healing
    const healed = this.healPlayer(data.playerId, itemData.healAmount);

    if (healed) {
      // Emit healing event with source for tests
      this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
        playerId: data.playerId,
        amount: itemData.healAmount,
        source: "food",
      });

      // Show message to player
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `You eat the ${itemData.name} and heal ${itemData.healAmount} HP.`,
        type: "success" as const,
      });
    }
  }

  async updatePlayerPosition(
    playerId: string,
    position: Position3D,
  ): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) {
      // In test scenarios, players might not be registered through normal flow
      // Only warn if this seems like a real player ID (not a test ID)
      if (!playerId.startsWith("test-")) {
        // Real player not found - already logged above
      }
      return;
    }

    player.position = { ...position };

    // Emit position update event for reactive systems
    this.emitTypedEvent(EventType.PLAYER_POSITION_UPDATED, {
      playerId,
      position,
    });

    // Position updates are frequent, don't save immediately
  }

  async updatePlayerStats(
    playerId: string,
    stats: Partial<Player["skills"]>,
  ): Promise<void> {
    const player = this.players.get(playerId)!;

    // Update stats
    Object.assign(player.skills, stats);

    // Recalculate combat level
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);

    // Save to database
    if (this.databaseSystem) {
      this.databaseSystem.savePlayer(playerId, {
        attackLevel: player.skills.attack.level,
        strengthLevel: player.skills.strength.level,
        defenseLevel: player.skills.defense.level,
        constitutionLevel: player.skills.constitution.level,
        rangedLevel: player.skills.ranged.level,
        combatLevel: player.combat.combatLevel,
      });
    }

    this.emitPlayerUpdate(playerId);
  }

  async updatePlayerEquipment(
    playerId: string,
    equipment: Partial<Player["equipment"]>,
  ): Promise<void> {
    const player = this.players.get(playerId)!;

    // Update equipment
    Object.assign(player.equipment, equipment);

    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_UPDATED, {
      playerId,
      equipment: {
        helmet: player.equipment.helmet ? player.equipment.helmet.id : null,
        body: player.equipment.body ? player.equipment.body.id : null,
        legs: player.equipment.legs ? player.equipment.legs.id : null,
        weapon: player.equipment.weapon ? player.equipment.weapon.id : null,
        shield: player.equipment.shield ? player.equipment.shield.id : null,
      },
    });

    this.emitPlayerUpdate(playerId);
  }

  getPlayerStats(playerId: string): Skills | undefined {
    const player = this.players.get(playerId);
    return player?.skills;
  }

  getPlayerEquipment(playerId: string): Player["equipment"] | undefined {
    const player = this.players.get(playerId);
    return player?.equipment;
  }

  hasWeaponEquipped(playerId: string): boolean {
    const equipment = this.getPlayerEquipment(playerId);
    return !!equipment?.weapon;
  }

  canPlayerUseRanged(_playerId: string): boolean {
    // MVP: Melee-only combat - ranged weapons not supported
    return false;
  }

  damagePlayer(playerId: string, amount: number, _source?: string): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;

    // Validate amount to prevent NaN
    const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    if (validAmount <= 0) return false;

    // Validate current health before applying damage
    const currentHealth =
      Number.isFinite(player.health.current) && player.health.current > 0
        ? player.health.current
        : player.health.max;

    // Floor to ensure health is always an integer (RuneScape-style)
    player.health.current = Math.floor(
      Math.max(0, currentHealth - validAmount),
    );

    // Sync damage to PlayerEntity if it exists
    const playerEntity = this.world.getPlayer?.(
      playerId,
    ) as PlayerEntity | null;
    if (playerEntity) {
      // Update Entity's health using setHealth method (which updates health bar)
      playerEntity.setHealth(player.health.current);

      // Update health component
      const healthComponent = playerEntity.getComponent("health");
      if (healthComponent && healthComponent.data) {
        (
          healthComponent.data as { current?: number; isDead?: boolean }
        ).current = player.health.current;
        (healthComponent.data as { isDead?: boolean }).isDead =
          player.health.current <= 0;
      }

      // Update stats component health
      const statsComponent = playerEntity.getComponent("stats");
      if (statsComponent && statsComponent.data && statsComponent.data.health) {
        const healthData = statsComponent.data.health as {
          current: number;
          max: number;
        };
        healthData.current = player.health.current;
      }

      // COMBAT_DAMAGE_DEALT is emitted by CombatSystem - no need to emit here
      // to avoid duplicate damage splats

      // Set lastDamageTick for health regen cooldown (17 ticks = 10.2s after damage)
      (playerEntity as unknown as { lastDamageTick: number }).lastDamageTick =
        this.world.currentTick;
    }

    this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
      playerId,
      health: player.health.current,
      maxHealth: player.health.max,
    });

    if (player.health.current <= 0) {
      this.handleDeath({
        playerId,
        deathLocation: player.position,
        cause: _source || "damage",
      });
    }

    this.emitPlayerUpdate(playerId);
    return true;
  }

  destroy(): void {
    // Clear all timers
    this.respawnTimers.forEach((timer) => clearTimeout(timer));
    this.respawnTimers.clear();

    // Clear auto-save
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Clean up all spawned player mobs (merged from PlayerSpawnSystem)
    for (const playerId of this.spawnedPlayers.keys()) {
      this.cleanupPlayerMobs(playerId);
    }
    this.spawnedPlayers.clear();

    // Clear attack style timers (merged from AttackStyleSystem)
    for (const timer of this.styleChangeTimers.values()) {
      clearTimeout(timer);
    }
    this.playerAttackStyles.clear();
    this.styleChangeTimers.clear();

    // Clear references
    this.players.clear();
    this.playerLocalRefs.clear();
  }

  // === SPAWN SYSTEM METHODS (merged from PlayerSpawnSystem) ===

  /**
   * Handle spawn completion - equip starter gear and trigger combat
   */
  private async handleSpawnComplete(event: {
    playerId: string;
  }): Promise<void> {
    // Send welcome message
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: event.playerId,
      message: "Welcome to the world! You are equipped and ready for battle.",
      type: "info",
    });

    // Wait for avatar to load
    await new Promise<void>((resolve) => {
      const onLoad = (e: { playerId: string; success: boolean }) => {
        if (e.playerId === event.playerId && e.success) {
          this.world.off(EventType.AVATAR_LOAD_COMPLETE, onLoad);
          resolve();
        }
      };
      this.world.on(EventType.AVATAR_LOAD_COMPLETE, onLoad);
      setTimeout(resolve, 5000); // Timeout after 5s
    });

    // Equip each starter item
    for (const item of this.STARTER_EQUIPMENT) {
      if (!this.spawnedPlayers.has(event.playerId)) {
        this.logger.warn(
          `Player ${event.playerId} disconnected during equipment process`,
        );
        return;
      }

      this.emitTypedEvent(EventType.EQUIPMENT_EQUIP, {
        playerId: event.playerId,
        itemId: item.itemId,
        slot: item.slot,
      });

      await this.delay(50);
    }

    const finalSpawnData = this.spawnedPlayers.get(event.playerId);
    if (finalSpawnData) {
      finalSpawnData.hasStarterEquipment = true;
    }

    // Trigger aggro after equipment
    if (this.spawnedPlayers.has(event.playerId)) {
      this.triggerGoblinAggro(event.playerId);
    }

    this.emitTypedEvent(EventType.PLAYER_SPAWNED, {
      playerId: event.playerId,
      equipment: this.STARTER_EQUIPMENT,
      position: this.spawnedPlayers.get(event.playerId)?.position,
    });
  }

  /**
   * Trigger goblin aggro near player spawn
   */
  private triggerGoblinAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData || spawnData.aggroTriggered) return;

    const player = this.world.getPlayer(playerId);
    if (!player) {
      this.logger.warn(`Player ${playerId} not found when triggering aggro`);
      return;
    }

    const playerPos = player.node.position;

    const goblinSpawnPositions = [
      this._tempVec3_1.set(playerPos.x + 3, playerPos.y, playerPos.z + 2),
      this._tempVec3_2.set(playerPos.x - 2, playerPos.y, playerPos.z + 4),
      this._tempVec3_3.set(playerPos.x + 1, playerPos.y, playerPos.z - 3),
    ];

    goblinSpawnPositions.forEach((position, index) => {
      setTimeout(() => {
        this.spawnAggroGoblin(playerId, position, index);
      }, index * 500);
    });

    spawnData.aggroTriggered = true;
  }

  /**
   * Spawn an aggressive goblin
   */
  private spawnAggroGoblin(
    playerId: string,
    position: { x: number; y: number; z: number },
    index: number,
  ): void {
    const goblinId = `starter_goblin_${playerId}_${index}`;

    this.emitTypedEvent(EventType.MOB_NPC_SPAWN_REQUEST, {
      mobType: "goblin",
      position: position,
      level: 1,
      mobId: goblinId,
    });

    this.emitTypedEvent(EventType.UI_MESSAGE, {
      mobId: goblinId,
      targetId: playerId,
      aggroAmount: 100,
      reason: "starter_spawn",
    });
  }

  /**
   * Clean up mobs spawned for a specific player
   */
  private cleanupPlayerMobs(playerId: string): void {
    for (let i = 0; i < 3; i++) {
      const goblinId = `starter_goblin_${playerId}_${i}`;
      this.emitTypedEvent(EventType.MOB_NPC_DESPAWN, { mobId: goblinId });
    }
  }

  /**
   * Check if player has completed spawn process
   */
  public hasPlayerCompletedSpawn(playerId: string): boolean {
    const spawnData = this.spawnedPlayers.get(playerId);
    return !!(spawnData?.hasStarterEquipment && spawnData?.aggroTriggered);
  }

  /**
   * Get spawn data for player
   */
  public getPlayerSpawnData(playerId: string): PlayerSpawnData | undefined {
    return this.spawnedPlayers.get(playerId);
  }

  /**
   * Manually trigger goblin aggro (for testing)
   */
  public forceTriggerAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData) return;

    spawnData.aggroTriggered = false;
    this.triggerGoblinAggro(playerId);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private startAutoSave(): void {
    this.saveInterval = this.createInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL)!;
  }

  update(_dt: number): void {
    // Sync player positions from entities each frame (server only)
    if (!this.world.network?.isServer) return;

    for (const [playerId, player] of this.players) {
      const entity = this.world.entities.get(playerId);
      if (entity && entity.position) {
        // Update player object position from entity
        player.position.x = entity.position.x;
        player.position.y = entity.position.y;
        player.position.z = entity.position.z;
      }
    }
  }

  private async performAutoSave(): Promise<void> {
    if (!this.databaseSystem) return;

    // Save all players
    for (const playerId of this.players.keys()) {
      await this.savePlayerToDatabase(playerId);
    }
  }

  private async savePlayerToDatabase(playerId: string): Promise<void> {
    const player = this.players.get(playerId);
    if (!player || !this.databaseSystem) return;

    // Use userId for database persistence if available
    const databaseId = PlayerIdMapper.getDatabaseId(playerId);

    // Database save happens here

    // NEVER save invalid Y positions to database
    let safeY = player.position.y;
    if (safeY < -5 || safeY > 200 || !Number.isFinite(safeY)) {
      console.error(
        `[PlayerSystem] WARNING: Refusing to save invalid Y position to DB: ${safeY}, saving Y=10 instead`,
      );
      safeY = 10; // Safe default
    }

    // NEVER save invalid health values to database
    let safeHealth = player.health.current;
    let safeMaxHealth = player.health.max;
    if (!Number.isFinite(safeMaxHealth) || safeMaxHealth <= 0) {
      console.error(
        `[PlayerSystem] WARNING: Invalid maxHealth detected: ${safeMaxHealth}, using 100 instead. Player health object:`,
        player.health,
      );
      safeMaxHealth = 100;
    }
    if (!Number.isFinite(safeHealth) || safeHealth < 0) {
      console.error(
        `[PlayerSystem] WARNING: Invalid health detected: ${safeHealth}, using maxHealth instead. Player health object:`,
        player.health,
      );
      safeHealth = safeMaxHealth;
    }
    safeHealth = Math.min(safeHealth, safeMaxHealth); // Ensure current <= max

    // Get player's current attack style (if set)
    const playerAttackState = this.playerAttackStyles.get(playerId);
    const attackStyle = playerAttackState?.selectedStyle || "accurate";

    this.databaseSystem.savePlayer(databaseId, {
      name: player.name,
      combatLevel: player.combat.combatLevel,
      attackLevel: player.skills.attack.level,
      strengthLevel: player.skills.strength.level,
      defenseLevel: player.skills.defense.level,
      constitutionLevel: player.skills.constitution.level,
      rangedLevel: player.skills.ranged.level,
      health: safeHealth,
      maxHealth: safeMaxHealth,
      positionX: player.position.x,
      positionY: safeY,
      positionZ: player.position.z,
      attackStyle: attackStyle, // Save player's preferred attack style
    });
  }

  private calculateCombatLevel(skills: Skills): number {
    // OSRS Combat Level Formula:
    // base = 0.25 × (Defence + Hitpoints + floor(Prayer / 2))
    // melee = 0.325 × (Attack + Strength)
    // ranged = 0.325 × floor(Ranged × 1.5)
    // magic = 0.325 × floor(Magic × 1.5)
    // combat = base + max(melee, ranged, magic)

    // Since we don't have Prayer or Magic yet, simplified formula:
    const base = 0.25 * (skills.defense.level + skills.constitution.level);

    const melee = 0.325 * (skills.attack.level + skills.strength.level);
    const ranged = 0.325 * Math.floor(skills.ranged.level * 1.5);

    const combatLevel = base + Math.max(melee, ranged);

    return Math.floor(combatLevel);
  }

  // === ATTACK STYLE METHODS (merged from AttackStyleSystem) ===

  /**
   * Initialize attack style for a new player
   * @param playerId - The player's ID
   * @param savedStyle - The saved attack style from database (if any)
   */
  private initializePlayerAttackStyle(
    playerId: string,
    savedStyle?: string,
  ): void {
    // Use saved style from database, or default to "accurate"
    const initialStyle =
      savedStyle && this.ATTACK_STYLES[savedStyle] ? savedStyle : "accurate";

    const playerState: PlayerAttackStyleState = {
      playerId,
      selectedStyle: initialStyle,
      lastStyleChange: 0, // Start at 0 so player can change style immediately
      combatStyleHistory: [],
    };

    this.playerAttackStyles.set(playerId, playerState);

    // Notify UI of initial attack style
    this.emitTypedEvent(EventType.UI_ATTACK_STYLE_CHANGED, {
      playerId,
      currentStyle: this.ATTACK_STYLES[initialStyle],
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: true,
    });
  }

  /**
   * Handle attack style change request
   */
  private handleStyleChange(data: {
    playerId: string;
    newStyle: string;
  }): void {
    const { playerId, newStyle } = data;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      return;
    }

    // Validate new style
    const style = this.ATTACK_STYLES[newStyle];
    if (!style) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `Invalid attack style: ${newStyle}`,
        type: "error",
      });
      return;
    }

    // Check cooldown
    const now = Date.now();
    const timeSinceLastChange = now - playerState.lastStyleChange;

    if (timeSinceLastChange < this.STYLE_CHANGE_COOLDOWN) {
      const remainingCooldown = Math.ceil(
        (this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange)) /
          1000,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You must wait ${remainingCooldown} seconds before changing attack style.`,
        type: "warning",
      });
      return;
    }

    // Update player's attack style
    const oldStyle = playerState.selectedStyle;
    playerState.selectedStyle = newStyle;
    playerState.lastStyleChange = now;

    // Record style change in history
    playerState.combatStyleHistory.push({
      style: newStyle,
      timestamp: now,
      combatSession: `session_${now}`,
    });

    // Keep only last 50 style changes
    if (playerState.combatStyleHistory.length > 50) {
      playerState.combatStyleHistory =
        playerState.combatStyleHistory.slice(-50);
    }

    // Set temporary cooldown
    const cooldownTimer = setTimeout(() => {
      this.styleChangeTimers.delete(playerId);

      // Notify UI that cooldown is over
      this.emitTypedEvent(EventType.UI_ATTACK_STYLE_UPDATE, {
        playerId,
        currentStyle: this.ATTACK_STYLES[playerState.selectedStyle],
        availableStyles: Object.values(this.ATTACK_STYLES),
        canChange: true,
      });
    }, this.STYLE_CHANGE_COOLDOWN);

    this.styleChangeTimers.set(playerId, cooldownTimer);

    // Notify UI immediately
    this.emitTypedEvent(EventType.UI_ATTACK_STYLE_CHANGED, {
      playerId,
      currentStyle: style,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: false,
      cooldownRemaining: this.STYLE_CHANGE_COOLDOWN,
    });

    // Notify chat
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `Attack style changed from ${this.ATTACK_STYLES[oldStyle].name} to ${style.name}. ${style.description}`,
      type: "info",
    });

    // Persist attack style to database immediately (server-side only)
    if (this.world.isServer && this.databaseSystem) {
      const databaseId = PlayerIdMapper.getDatabaseId(playerId);
      this.databaseSystem.savePlayer(databaseId, {
        attackStyle: newStyle,
      });
    }
  }

  /**
   * Handle XP calculation based on attack style
   */
  private handleXPCalculation(data: {
    playerId: string;
    baseXP: number;
    skill: string;
    callback: (xpAmount: number) => void;
  }): void {
    const { playerId, baseXP, skill } = data;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      // No attack style state, return base XP
      data.callback(baseXP);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseXP);
      return;
    }

    // Calculate XP based on attack style distribution
    let xpMultiplier = 0;

    switch (skill.toLowerCase()) {
      case "attack":
        xpMultiplier = attackStyle.xpDistribution.attack / 100;
        break;
      case "strength":
        xpMultiplier = attackStyle.xpDistribution.strength / 100;
        break;
      case "defense":
        xpMultiplier = attackStyle.xpDistribution.defense / 100;
        break;
      case "constitution":
        xpMultiplier = attackStyle.xpDistribution.constitution / 100;
        break;
      default:
        xpMultiplier = 1; // Non-combat skills unaffected
    }

    const finalXP = Math.floor(baseXP * xpMultiplier);
    data.callback(finalXP);
  }

  /**
   * Handle damage calculation based on attack style
   */
  private handleDamageCalculation(data: {
    playerId: string;
    baseDamage: number;
    callback: (damage: number) => void;
  }): void {
    const { playerId, baseDamage } = data;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      data.callback(baseDamage);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseDamage);
      return;
    }

    // Apply damage modifier from attack style
    const finalDamage = Math.floor(baseDamage * attackStyle.damageModifier);
    data.callback(finalDamage);
  }

  /**
   * Handle accuracy calculation based on attack style
   */
  private handleAccuracyCalculation(data: {
    playerId: string;
    baseAccuracy: number;
    callback: (accuracy: number) => void;
  }): void {
    const { playerId, baseAccuracy } = data;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      data.callback(baseAccuracy);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseAccuracy);
      return;
    }

    // Apply accuracy modifier from attack style
    const finalAccuracy = Math.min(
      1.0,
      baseAccuracy * attackStyle.accuracyModifier,
    );
    data.callback(finalAccuracy);
  }

  /**
   * Handle request for style info
   */
  private handleGetStyleInfo(data: {
    playerId: string;
    callback?: (info: Record<string, unknown> | null) => void;
  }): void {
    const { playerId, callback } = data;

    if (!callback) {
      this.emitStyleUpdateEvent(playerId);
      return;
    }

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      callback(null);
      return;
    }

    const currentStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    const canChange = !this.styleChangeTimers.has(playerId);

    let cooldownRemaining = 0;
    if (!canChange) {
      const now = Date.now();
      cooldownRemaining = Math.max(
        0,
        this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange),
      );
    }

    const styleInfo = {
      style: playerState.selectedStyle, // Return the string ID that UI expects
      cooldown: cooldownRemaining, // Use 'cooldown' not 'cooldownRemaining'
      currentStyle,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange,
      styleHistory: playerState.combatStyleHistory.slice(-10),
    };

    callback(styleInfo);
  }

  private emitStyleUpdateEvent(playerId: string): void {
    const playerState = this.playerAttackStyles.get(playerId);
    if (playerState) {
      const currentStyle = this.ATTACK_STYLES[playerState.selectedStyle];
      const canChange = !this.styleChangeTimers.has(playerId);

      this.emitTypedEvent(EventType.UI_ATTACK_STYLE_UPDATE, {
        playerId,
        currentStyle,
        availableStyles: Object.values(this.ATTACK_STYLES),
        canChange,
        styleHistory: playerState.combatStyleHistory.slice(-10),
      });
    }
  }

  // Public API methods for attack styles
  getPlayerAttackStyle(playerId: string): AttackStyle | null {
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return null;

    return this.ATTACK_STYLES[playerState.selectedStyle] || null;
  }

  getAllAttackStyles(): AttackStyle[] {
    return Object.values(this.ATTACK_STYLES);
  }

  canPlayerChangeStyle(playerId: string): boolean {
    return !this.styleChangeTimers.has(playerId);
  }

  getRemainingStyleCooldown(playerId: string): number {
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState || this.canPlayerChangeStyle(playerId)) return 0;

    const now = Date.now();
    return Math.max(
      0,
      this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange),
    );
  }

  forceChangeAttackStyle(playerId: string, styleId: string): boolean {
    const style = this.ATTACK_STYLES[styleId];
    if (!style) return false;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return false;

    // Clear any existing cooldown
    const timer = this.styleChangeTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.styleChangeTimers.delete(playerId);
    }

    // Force change style
    this.handleStyleChange({ playerId, newStyle: styleId });
    return true;
  }

  getPlayerStyleHistory(
    playerId: string,
  ): Array<{ style: string; timestamp: number; combatSession: string }> {
    const playerState = this.playerAttackStyles.get(playerId);
    return playerState?.combatStyleHistory || [];
  }

  getAttackStyleSystemInfo(): Record<string, unknown> {
    const activeStyles: { [key: string]: number } = {};
    let totalPlayers = 0;

    for (const playerState of this.playerAttackStyles.values()) {
      totalPlayers++;
      const style = playerState.selectedStyle;
      activeStyles[style] = (activeStyles[style] || 0) + 1;
    }

    return {
      totalPlayers,
      activeStyles,
      availableStyles: Object.keys(this.ATTACK_STYLES),
      activeCooldowns: this.styleChangeTimers.size,
      systemLoaded: true,
    };
  }

  private handleSkillsUpdate(data: { playerId: string; skills: Skills }): void {
    const player = this.players.get(data.playerId);
    if (!player) {
      console.warn(
        "[PlayerSystem] Player not found in handleSkillsUpdate:",
        data.playerId,
      );
      return;
    }

    // Update player skills
    player.skills = data.skills;

    // Recalculate combat level
    player.combat.combatLevel = this.calculateCombatLevel(data.skills);

    // Update stats component with new skill data for SkillsSystem and combat calculations
    const playerEntity = this.world.entities.get(data.playerId);
    if (playerEntity) {
      const statsComponent = playerEntity.getComponent("stats");
      if (statsComponent) {
        // Update skill data (full SkillData objects with level + xp) in stats component
        statsComponent.data.attack = data.skills.attack;
        statsComponent.data.strength = data.skills.strength;
        statsComponent.data.defense = data.skills.defense;
        statsComponent.data.constitution = data.skills.constitution;
        statsComponent.data.ranged = data.skills.ranged;
        statsComponent.data.woodcutting = data.skills.woodcutting;
        statsComponent.data.fishing = data.skills.fishing;
        statsComponent.data.firemaking = data.skills.firemaking;
        statsComponent.data.cooking = data.skills.cooking;
      }
    }

    // Trigger UI update to reflect skill changes
    this.emitPlayerUpdate(data.playerId);

    // Persist skill XP/levels to database (debounced)
    this.scheduleSaveSkills(data.playerId);
  }

  private scheduleSaveSkills(playerId: string): void {
    // Save immediately for first update, then debounce subsequent updates
    const existing = this.skillSaveTimers.get(playerId);
    if (!existing) {
      // First skill update - save immediately
      this.saveSkillsToDatabase(playerId);
    }

    // Also schedule debounced save for continuous updates
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.skillSaveTimers.delete(playerId);
      this.saveSkillsToDatabase(playerId);
    }, 500);
    this.skillSaveTimers.set(playerId, timer);
  }

  private saveSkillsToDatabase(playerId: string): void {
    if (!this.databaseSystem) return;
    const player = this.players.get(playerId);
    if (!player) return;

    const s = player.skills;
    // Map runtime skills -> DB columns
    const update: Record<string, number> = {
      combatLevel: player.combat.combatLevel,
      attackLevel: s.attack.level,
      strengthLevel: s.strength.level,
      defenseLevel: s.defense.level,
      constitutionLevel: s.constitution.level,
      rangedLevel: s.ranged.level,
      woodcuttingLevel: s.woodcutting.level,
      fishingLevel: s.fishing.level,
      firemakingLevel: s.firemaking.level,
      cookingLevel: s.cooking.level,
      // XP
      attackXp: Math.floor(s.attack.xp),
      strengthXp: Math.floor(s.strength.xp),
      defenseXp: Math.floor(s.defense.xp),
      constitutionXp: Math.floor(s.constitution.xp),
      rangedXp: Math.floor(s.ranged.xp),
      woodcuttingXp: Math.floor(s.woodcutting.xp),
      fishingXp: Math.floor(s.fishing.xp),
      firemakingXp: Math.floor(s.firemaking.xp),
      cookingXp: Math.floor(s.cooking.xp),
    };
    try {
      this.databaseSystem.savePlayer(playerId, update);
    } catch (err) {
      console.error("[PlayerSystem] Failed to save skills to DB:", err);
    }
  }
}
