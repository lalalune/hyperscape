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
  Player,
  PlayerAttackStyleState,
  PlayerMigration,
  PlayerSpawnData,
  Skills,
} from "../../../types/core/core";
import { WeaponType } from "../../../types/game/item-types";
import { DeathState } from "../../../types/entities";
import type { PlayerEntityLike } from "../combat/DeathTypes";
import {
  isStyleValidForWeapon,
  getAvailableStyles,
  getDefaultStyleForWeapon,
} from "../../../constants/WeaponStyleConfig";
// CombatStyle type available from: "../../../utils/game/CombatCalculations"
import type { CombatStyleExtended } from "../../../types/game/combat-types";
import type {
  HealthUpdateEvent,
  PlayerEnterEvent,
  PlayerLeaveEvent,
  PlayerLevelUpEvent,
} from "../../../types/events";
import type { StatsComponent } from "../../../components/StatsComponent";
import {
  calculateCombatLevel,
  normalizeCombatSkills,
} from "../../../utils/game/CombatLevelCalculator";
import { EventType } from "../../../types/events";
import type { World } from "../../../types/index";
import { Logger } from "../../../utils/Logger";
import { EntityManager } from "..";
import { SystemBase } from "../infrastructure/SystemBase";
import type { TerrainSystem } from "..";
import { PlayerIdMapper } from "../../../utils/PlayerIdMapper";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import * as THREE from "three";
import { EatDelayManager } from "./EatDelayManager";
import { BuryDelayManager } from "./BuryDelayManager";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { Skill } from "./SkillsSystem";
import type { CombatSystem } from "../combat/CombatSystem";

/**
 * PlayerSystem - Central Player Management
 *
 * Handles all player-related operations: spawning, stats, health, attack styles, and persistence.
 */
export class PlayerSystem extends SystemBase {
  declare world: World;

  private players = new Map<string, Player>();
  private entityManager?: EntityManager;
  private databaseSystem?: DatabaseSystem;
  private playerLocalRefs = new Map<string, PlayerLocal>(); // Store PlayerLocal references for integration
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds auto-save
  private saveInterval?: NodeJS.Timeout;
  private _tempVec3 = new THREE.Vector3();

  // Eat delay tracking (OSRS-accurate 3-tick cooldown)
  private eatDelayManager = new EatDelayManager();

  // Bury delay tracking (OSRS-accurate 2-tick cooldown)
  private buryDelayManager = new BuryDelayManager();

  // Player spawn tracking (merged from PlayerSpawnSystem)
  private spawnedPlayers = new Map<string, PlayerSpawnData>();
  private _tempVec3_1 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  private _tempVec3_3 = new THREE.Vector3();

  // OPTIMIZATION: Pre-allocated payload object for emitPlayerUpdate
  // Reused to avoid allocation per update (called very frequently)
  private _playerUpdatePayload = {
    id: "",
    playerId: "",
    name: "",
    level: 0,
    combatLevel: 0,
    health: { current: 0, max: 0 },
    alive: true,
    position: { x: 0, y: 0, z: 0 },
    skills: null as unknown,
    stamina: 100,
    maxStamina: 100,
    coins: 0,
    combatStyle: "attack" as string,
  };
  private _playerUpdatedEvent = {
    playerId: "",
    component: "player" as const,
    data: null as unknown,
  };
  private _uiUpdateEvent = {
    component: "player" as const,
    data: null as unknown,
  };

  /** Starter equipment for new players */
  private readonly STARTER_EQUIPMENT: Array<{
    itemId: string;
    slot: string;
    autoEquip: boolean;
  }> = [{ itemId: "bronze_shortsword", slot: "weapon", autoEquip: true }];

  // Attack style tracking (merged from AttackStyleSystem)
  private playerAttackStyles = new Map<string, PlayerAttackStyleState>();
  private skillSaveTimers = new Map<string, NodeJS.Timeout>();

  // Auto-retaliate tracking (OSRS-style combat preference)
  /** Player auto-retaliate settings (Map lookup = O(1), no allocations) */
  private playerAutoRetaliate = new Map<string, boolean>();
  private pendingSkillUpdates = new Map<string, Skills>();
  /** Rate limiting for toggle spam prevention (OWASP) */
  private autoRetaliateLastToggle = new Map<string, number>();
  private readonly AUTO_RETALIATE_COOLDOWN_MS = 500; // Max 2 toggles/second

  // Attack styles - OSRS-accurate stat bonuses applied via CombatCalculations.getStyleBonus()
  // @see https://oldschool.runescape.wiki/w/Combat_Options
  private readonly ATTACK_STYLES: Record<string, AttackStyle> = {
    accurate: {
      id: "accurate",
      name: "Accurate",
      description: "Train Attack. +3 invisible Attack levels.",
      xpDistribution: {
        attack: 100,
        strength: 0,
        defense: 0,
        constitution: 0,
      },
      icon: "🎯",
    },

    aggressive: {
      id: "aggressive",
      name: "Aggressive",
      description: "Train Strength. +3 invisible Strength levels.",
      xpDistribution: {
        attack: 0,
        strength: 100,
        defense: 0,
        constitution: 0,
      },
      icon: "⚔️",
    },

    defensive: {
      id: "defensive",
      name: "Defensive",
      description: "Train Defense. +3 invisible Defense levels.",
      xpDistribution: {
        attack: 0,
        strength: 0,
        defense: 100,
        constitution: 0,
      },
      icon: "🛡️",
    },

    controlled: {
      id: "controlled",
      name: "Controlled",
      description: "Train all combat skills. +1 to Attack, Strength, Defense.",
      xpDistribution: {
        attack: 33,
        strength: 33,
        defense: 34,
        constitution: 0,
      },
      icon: "⚖️",
    },

    // Ranged combat styles (OSRS-accurate)
    rapid: {
      id: "rapid",
      name: "Rapid",
      description: "Faster attacks. Train Ranged.",
      xpDistribution: {
        attack: 0,
        strength: 0,
        defense: 0,
        constitution: 0,
      },
      icon: "⚡",
    },

    longrange: {
      id: "longrange",
      name: "Longrange",
      description: "Increased range. Train Ranged and Defense.",
      xpDistribution: {
        attack: 0,
        strength: 0,
        defense: 50,
        constitution: 0,
      },
      icon: "🔭",
    },

    // Magic combat styles (OSRS-accurate)
    autocast: {
      id: "autocast",
      name: "Autocast",
      description: "Automatically cast selected spell. Train Magic.",
      xpDistribution: {
        attack: 0,
        strength: 0,
        defense: 0,
        constitution: 0,
      },
      icon: "✨",
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
      this.onPlayerRegister(data as { playerId: string }).catch((err) => {
        console.error(
          `[PlayerSystem] CRITICAL: onPlayerRegister failed for ${(data as { playerId: string })?.playerId}`,
          err,
        );
      });
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
    // Note: COMBAT_XP_CALCULATE, COMBAT_DAMAGE_CALCULATE, COMBAT_ACCURACY_CALCULATE
    // events removed - actual combat bonuses applied via CombatCalculations.getStyleBonus()
    this.subscribe(EventType.UI_ATTACK_STYLE_GET, (data) =>
      this.handleGetStyleInfo(
        data as {
          playerId: string;
          callback?: (info: Record<string, unknown> | null) => void;
        },
      ),
    );
    // CLIENT-SIDE: Sync internal state when receiving authoritative style from server
    // This fixes the bug where client initializes with "accurate" but server has saved style
    this.subscribe(EventType.UI_ATTACK_STYLE_CHANGED, (data) =>
      this.handleStyleSyncFromServer(
        data as {
          playerId: string;
          currentStyle: { id: string };
        },
      ),
    );

    // OSRS-accurate: auto-switch style when weapon changes and current style is invalid
    // Only subscribe on server — style changes are server-authoritative
    if (this.world.isServer) {
      this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data) => {
        const eqData = data as {
          playerId: string;
          slot: string;
          itemId: string | null;
        };
        if (eqData.slot === "weapon") {
          this.handleWeaponChange(eqData.playerId);
        }
      });
    }

    // Auto-retaliate events
    this.subscribe(EventType.UI_AUTO_RETALIATE_GET, (data) =>
      this.handleGetAutoRetaliate(
        data as { playerId: string; callback?: (enabled: boolean) => void },
      ),
    );
    this.subscribe(EventType.UI_AUTO_RETALIATE_UPDATE, (data) =>
      this.handleAutoRetaliateToggle(
        data as { playerId: string; enabled: boolean },
      ),
    );

    // Autocast spell selection (F2P magic combat)
    this.subscribe(EventType.PLAYER_SET_AUTOCAST, (data) =>
      this.handleSetAutocast(
        data as { playerId: string; spellId: string | null },
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

    if (isFinite(height)) {
      finalPosition.y = height;
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
    const groundedY = Number.isFinite(terrainHeight)
      ? terrainHeight
      : finalPosition.y;

    finalPosition.y = groundedY;
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
      this.logger.error("playerId is undefined in registration data");
      return;
    }

    // Load saved combat preferences from database if available
    let savedAttackStyle: string | undefined;
    let savedAutoRetaliate = true; // Default ON (OSRS behavior)
    if (this.databaseSystem) {
      try {
        const databaseId = PlayerIdMapper.getDatabaseId(data.playerId);
        const dbData = await this.databaseSystem.getPlayerAsync(databaseId);
        savedAttackStyle = (dbData as { attackStyle?: string })?.attackStyle;
        savedAutoRetaliate =
          ((dbData as { autoRetaliate?: number })?.autoRetaliate ?? 1) === 1;
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to load combat preferences for ${data.playerId}, using defaults`,
          err instanceof Error ? { error: err.message } : undefined,
        );
      }
    }
    // Only initialize if no state exists yet. If the player already has state
    // (from auto-init + an active style/toggle change before registration),
    // their in-session choice takes precedence over the DB-saved value.
    // The updated value will be persisted on the next periodic save.
    if (!this.playerAttackStyles.has(data.playerId)) {
      this.initializePlayerAttackStyle(data.playerId, savedAttackStyle);
    }
    if (!this.playerAutoRetaliate.has(data.playerId)) {
      this.initializePlayerAutoRetaliate(data.playerId, savedAutoRetaliate);
    }

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
    // Only process on server
    if (!this.world.isServer) return;

    const player = this.players.get(data.entityId);
    if (!player) return;

    // Update combat level in player data (SkillsSystem already updated StatsComponent)
    player.combat.combatLevel = data.newLevel;

    // Sync to entity and broadcast to all clients
    this.syncCombatLevelToEntity(data.entityId, data.newLevel);

    // Save to database immediately (only if database system available)
    if (this.databaseSystem) {
      const databaseId = PlayerIdMapper.getDatabaseId(data.entityId);
      this.databaseSystem.savePlayer(databaseId, {
        combatLevel: data.newLevel,
      });
    }
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
          playerData.position.y = h;
        }
      }

      // Save new player to database using persistent userId
      // NOTE: Don't save name here - it was already set by createCharacter()
      if (this.databaseSystem) {
        this.databaseSystem.savePlayer(databaseId, {
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

    const pendingSkills = this.pendingSkillUpdates.get(data.playerId);
    if (pendingSkills) {
      this.pendingSkillUpdates.delete(data.playerId);
      this.handleSkillsUpdate({
        playerId: data.playerId,
        skills: pendingSkills,
      });
    }

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

    // CRITICAL: Sync combat level to entity data for remote clients
    // The entity was created with combatLevel=3 (default), but we now have the correct level
    // from database. Sync it to entity.data so serialize() sends correct level to new clients,
    // and broadcast via entityModified so existing clients see the correct combat level.
    this.syncCombatLevelToEntity(data.playerId, playerData.combat.combatLevel);

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
    this.pendingSkillUpdates.delete(data.playerId);

    // Clean up spawn data (merged from PlayerSpawnSystem)
    this.spawnedPlayers.delete(data.playerId);
    this.cleanupPlayerMobs(data.playerId);

    // Clean up attack style (merged from AttackStyleSystem)
    this.playerAttackStyles.delete(data.playerId);

    // Clean up auto-retaliate
    this.playerAutoRetaliate.delete(data.playerId);
    this.autoRetaliateLastToggle.delete(data.playerId);

    // Clean up eat cooldown (memory hygiene)
    this.eatDelayManager.clearPlayer(data.playerId);

    // Unregister userId mapping
    PlayerIdMapper.unregister(data.playerId);

    // Note: respawn timers are owned by PlayerDeathSystem
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
        cause: "health_depletion",
      });
    }

    this.emitPlayerUpdate(data.entityId);
  }

  private handleDeath(data: { playerId: string; cause?: string }): void {
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

    // Clear eat cooldown on death (memory hygiene)
    this.eatDelayManager.clearPlayer(data.playerId);

    // DEATH FLOW: PlayerSystem sets entity state + emits PLAYER_SET_DEAD (immediate client feedback).
    // Then ENTITY_DEATH fires → PlayerDeathSystem handles items, transaction, gravestone, respawnTick.
    // See PlayerDeathSystem.postDeathCleanup for the respawn/death-screen half of the flow.
    //
    // Set entity death state IMMEDIATELY so client sees death animation
    // even if PlayerDeathSystem's async processing fails
    const deathEntity = this.world.entities?.get?.(data.playerId);
    if (deathEntity) {
      const typedEntity = deathEntity as PlayerEntityLike;
      if (typedEntity.emote !== undefined) {
        typedEntity.emote = "death";
      }
      if (typedEntity.data) {
        typedEntity.data.e = "death";
        typedEntity.data.deathState = DeathState.DYING;
        typedEntity.data.deathPosition = [
          player.position.x,
          player.position.y,
          player.position.z,
        ];
      }
      if (typedEntity.markNetworkDirty) {
        typedEntity.markNetworkDirty();
      }
    }

    // Emit PLAYER_SET_DEAD immediately so client blocks input.
    // Wrapped in try-catch: if a subscriber throws, ENTITY_DEATH must still fire
    // so PlayerDeathSystem processes the death (items, gravestone, respawn).
    try {
      this.emitTypedEvent(EventType.PLAYER_SET_DEAD, {
        playerId: data.playerId,
        isDead: true,
        deathPosition: player.position,
      });
    } catch (err) {
      console.error(
        `[PlayerSystem] PLAYER_SET_DEAD subscriber threw — continuing to ENTITY_DEATH`,
        err,
      );
    }

    // Emit ENTITY_DEATH for DeathSystem to handle (headstones, loot, respawn)
    // DeathSystem will handle the full death flow including respawn
    // Include deathPosition so PlayerDeathSystem can use the exact death location
    // without falling back to potentially stale position caches
    this.emitTypedEvent(EventType.ENTITY_DEATH, {
      entityId: data.playerId,
      killedBy: data.cause || "unknown",
      entityType: "player" as const,
      deathPosition: { ...player.position },
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
        this.world.currentTick ?? 0;
    }

    // Check for death
    if (newHealth <= 0) {
      this.handleDeath({
        playerId: data.playerId,
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

    // SECURITY: Only respawn players who are actually dead.
    // Without this check, any system emitting PLAYER_RESPAWNED would
    // unconditionally heal a player to full health mid-combat.
    if (player.alive && player.health.current > 0) {
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
    const player = this.players.get(data.playerId);
    if (!player) return;

    // Recalculate combat level based on current stats
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);
    this.emitPlayerUpdate(data.playerId);
  }

  private emitPlayerUpdate(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // OPTIMIZATION: Reuse pre-allocated payload object instead of creating new one
    const playerData = this._playerUpdatePayload;
    playerData.id = player.id;
    playerData.playerId = playerId;
    playerData.name = player.name;
    playerData.level = player.combat.combatLevel;
    playerData.combatLevel = player.combat.combatLevel;
    playerData.health.current = player.health.current;
    playerData.health.max = player.health.max;
    playerData.alive = player.alive;
    playerData.position.x = player.position.x;
    playerData.position.y = player.position.y;
    playerData.position.z = player.position.z;
    playerData.skills = player.skills;
    playerData.stamina = player.stamina?.current || 100;
    playerData.maxStamina = player.stamina?.max || 100;
    playerData.coins = player.coins || 0;
    playerData.combatStyle = player.combat.combatStyle || "attack";

    // OPTIMIZATION: Reuse pre-allocated event objects
    // Emit PLAYER_UPDATED for systems
    this._playerUpdatedEvent.playerId = playerId;
    this._playerUpdatedEvent.data = playerData;
    this.emitTypedEvent(EventType.PLAYER_UPDATED, this._playerUpdatedEvent);

    // Emit STATS_UPDATE for systems that depend on it
    this.emitTypedEvent(EventType.STATS_UPDATE, playerData);

    // Emit UI_UPDATE for client UI
    this._uiUpdateEvent.data = playerData;
    this.emitTypedEvent(EventType.UI_UPDATE, this._uiUpdateEvent);
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

  /**
   * Handle food consumption with OSRS-accurate timing
   *
   * Implements:
   * - 3-tick (1.8s) eat delay between foods
   * - Attack delay when eating during combat
   * - OWASP input validation
   * - OSRS-style chat message format
   */
  private handleItemUsed(data: {
    playerId: string;
    itemId: string;
    slot: number;
    itemData: { id: string; name: string; type: string };
  }): void {
    // SERVER-SIDE ONLY: Food consumption is validated and processed on server
    if (!this.world.isServer) {
      return;
    }

    // === SECURITY: Input Validation (OWASP) ===
    if (!data.playerId || typeof data.playerId !== "string") {
      Logger.systemError("PlayerSystem", "Invalid playerId in handleItemUsed");
      return;
    }

    // Get the full item data first
    const itemData = getItem(data.itemId);
    if (!itemData) {
      return;
    }

    // === BONE BURYING (Prayer XP) ===
    // Check for bones before consumables - bones have prayerXp property
    if (itemData.prayerXp && itemData.prayerXp > 0) {
      this.handleBoneBury(data.playerId, data.slot, itemData);
      return;
    }

    // Only process consumables for food eating
    if (data.itemData.type !== "consumable" && data.itemData.type !== "food") {
      return;
    }

    // Check for healing properties
    if (!itemData.healAmount || itemData.healAmount <= 0) {
      return;
    }

    // === MAX HEALTH CHECK ===
    // Similar to prayer points check - notify player if already at max health
    const player = this.players.get(data.playerId);
    if (player) {
      console.log("[PlayerSystem] handleItemUsed health check:", {
        playerId: data.playerId,
        current: player.health.current,
        max: player.health.max,
        isAtMax: player.health.current >= player.health.max,
      });
    }
    if (player && player.health.current >= player.health.max) {
      console.log("[PlayerSystem] Player at max health, sending UI_MESSAGE");
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "You're already at full health.",
        type: "warning" as const,
      });
      return;
    }

    // === SECURITY: Bounds checking (OWASP) ===
    const healAmount = Math.min(
      Math.max(0, Math.floor(itemData.healAmount)),
      COMBAT_CONSTANTS.MAX_HEAL_AMOUNT,
    );

    // === RATE LIMITING: Eat delay check (Anti-Cheat) ===
    const currentTick = this.world.currentTick ?? 0;
    if (!this.eatDelayManager.canEat(data.playerId, currentTick)) {
      // Already eating - send rejection message
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "You are already eating.",
        type: "warning" as const,
      });
      return;
    }

    // Record this eat action
    this.eatDelayManager.recordEat(data.playerId, currentTick);

    // === CONSUME THE FOOD ===
    // Remove the item from inventory AFTER all checks pass
    // This ensures food isn't lost if eating is rejected (e.g., eat delay)
    this.emitTypedEvent(EventType.INVENTORY_REMOVE_ITEM, {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: 1,
      slot: data.slot,
    });

    // Apply healing (may return false if already at full health)
    // NOTE: healPlayer() emits PLAYER_HEALTH_UPDATED only if health changed
    this.healPlayer(data.playerId, healAmount);

    // OSRS Behavior: Message and attack delay ALWAYS apply when eating,
    // even at full health. Food is consumed regardless.
    // @see https://oldschool.runescape.wiki/w/Food

    // OSRS-style message (lowercase item name, no heal amount shown)
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: `You eat the ${itemData.name.toLowerCase()}.`,
      type: "success" as const,
    });

    // === COMBAT INTEGRATION: Apply attack delay if in combat ===
    this.applyEatAttackDelay(data.playerId, currentTick);
  }

  /**
   * Apply attack delay when eating during combat (OSRS-accurate)
   *
   * OSRS Rule: Foods only add to EXISTING attack delay.
   * If weapon is ready to attack, eating does NOT add delay.
   */
  private applyEatAttackDelay(playerId: string, currentTick: number): void {
    const combatSystem = this.world.getSystem("combat") as CombatSystem | null;
    if (!combatSystem) return;

    // Check if player is on attack cooldown
    const isOnCooldown = combatSystem.isPlayerOnAttackCooldown?.(
      playerId,
      currentTick,
    );

    if (isOnCooldown) {
      // Add eat delay to attack cooldown
      combatSystem.addAttackDelay?.(
        playerId,
        COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
      );
    }
    // If not on cooldown, do nothing (OSRS-accurate behavior)
  }

  /**
   * Handle bone burying for prayer XP (OSRS-accurate)
   *
   * OSRS Mechanics:
   * - 2-tick (1.2s) delay between burials
   * - XP granted immediately upon bury
   * - Some bones require minimum prayer level
   * - Message: "You bury the bones."
   *
   * @see https://oldschool.runescape.wiki/w/Bones
   */
  private handleBoneBury(
    playerId: string,
    slot: number,
    itemData: {
      id: string;
      name: string;
      prayerXp?: number;
      buryLevelRequired?: number;
    },
  ): void {
    const currentTick = this.world.currentTick ?? 0;

    // Check bury delay (2-tick cooldown)
    if (!this.buryDelayManager.canBury(playerId, currentTick)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already burying bones.",
        type: "warning" as const,
      });
      return;
    }

    // Check prayer level requirement (if any)
    if (itemData.buryLevelRequired && itemData.buryLevelRequired > 1) {
      const prayerLevel = this.getPrayerLevel(playerId);
      if (prayerLevel < itemData.buryLevelRequired) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId,
          message: `You need level ${itemData.buryLevelRequired} Prayer to bury these bones.`,
          type: "warning" as const,
        });
        return;
      }
    }

    // Record bury action (starts cooldown)
    this.buryDelayManager.recordBury(playerId, currentTick);

    // Remove bones from inventory
    this.emitTypedEvent(EventType.INVENTORY_REMOVE_ITEM, {
      playerId,
      itemId: itemData.id,
      quantity: 1,
      slot,
    });

    // Grant prayer XP
    const prayerXp = itemData.prayerXp ?? 0;
    if (prayerXp > 0) {
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
        playerId,
        skill: Skill.PRAYER,
        amount: prayerXp,
      });
    }

    // OSRS-style message
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: "You bury the bones.",
      type: "success" as const,
    });
  }

  /**
   * Get player's current prayer level
   */
  private getPrayerLevel(playerId: string): number {
    const entity = this.entityManager?.getEntity(playerId);
    if (!entity) return 1;

    const stats = (
      entity as unknown as {
        getComponent?: (name: string) => Record<string, unknown> | undefined;
      }
    ).getComponent?.("stats");
    if (!stats?.prayer) return 1;

    const prayerData = stats.prayer as { level?: number };
    return prayerData.level ?? 1;
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
    const player = this.players.get(playerId);
    if (!player) return;

    // Update stats
    for (const [skillName, skillValue] of Object.entries(stats)) {
      if (!skillValue) continue;
      const key = skillName as keyof Player["skills"];
      if (!player.skills[key]) continue;
      player.skills[key] = {
        ...player.skills[key],
        ...skillValue,
      };
    }

    // Recalculate combat level
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);

    // Sync to entity and broadcast to all clients
    this.syncCombatLevelToEntity(playerId, player.combat.combatLevel);

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
    const player = this.players.get(playerId);
    if (!player) return;

    // Update equipment
    player.equipment = {
      ...player.equipment,
      ...equipment,
    };

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
    if (!player || !player.alive) {
      return false;
    }

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

      // Update stats component health (both public property AND data dict)
      // StatsComponent has TWO health objects: this.health (public) and this.data.health
      // Both must stay in sync — handleLevelUp reads this.health, serialization reads this.data.health
      const statsComponent = playerEntity.getComponent(
        "stats",
      ) as StatsComponent | null;
      if (statsComponent) {
        statsComponent.health.current = player.health.current;
        statsComponent.health.max = player.health.max;
        if (statsComponent.data?.health) {
          (
            statsComponent.data.health as { current: number; max: number }
          ).current = player.health.current;
          (statsComponent.data.health as { current: number; max: number }).max =
            player.health.max;
        }
      }

      // COMBAT_DAMAGE_DEALT is emitted by CombatSystem - no need to emit here
      // to avoid duplicate damage splats

      // Set lastDamageTick for health regen cooldown (17 ticks = 10.2s after damage)
      (playerEntity as unknown as { lastDamageTick: number }).lastDamageTick =
        this.world.currentTick ?? 0;
    }

    this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
      playerId,
      health: player.health.current,
      maxHealth: player.health.max,
    });

    if (player.health.current <= 0) {
      this.handleDeath({
        playerId,
        cause: _source || "damage",
      });
    }

    this.emitPlayerUpdate(playerId);
    return true;
  }

  destroy(): void {
    // Clear auto-save
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Clean up all spawned player mobs (merged from PlayerSpawnSystem)
    for (const playerId of this.spawnedPlayers.keys()) {
      this.cleanupPlayerMobs(playerId);
    }
    this.spawnedPlayers.clear();

    // Clear attack style state (merged from AttackStyleSystem)
    this.playerAttackStyles.clear();

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
    // Guard: don't re-equip starter gear if already equipped (prevents overwriting player's chosen equipment)
    const spawnData = this.spawnedPlayers.get(event.playerId);
    if (!spawnData || spawnData.hasStarterEquipment) {
      return;
    }

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
    return calculateCombatLevel(
      normalizeCombatSkills({
        attack: skills.attack.level,
        strength: skills.strength.level,
        defense: skills.defense.level,
        hitpoints: skills.constitution.level,
        ranged: skills.ranged.level,
        magic: skills.magic?.level,
        prayer: skills.prayer?.level,
      }),
    );
  }

  /**
   * Sync combat level to entity data and broadcast to all clients
   * Call this after recalculating combat level to ensure remote players see updates
   */
  private syncCombatLevelToEntity(playerId: string, combatLevel: number): void {
    if (!this.world.isServer) return;

    const entity = this.world.entities.get(playerId);
    if (entity) {
      // Update entity data so serialize() includes correct combat level
      (entity.data as { combatLevel?: number }).combatLevel = combatLevel;

      // Broadcast to all clients via entityModified
      if (this.world.network?.send) {
        this.world.network.send("entityModified", {
          id: playerId,
          combatLevel: combatLevel,
        });
      }
    }
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
    // Idempotency is the caller's responsibility:
    // - Auto-init call sites guard with `if (!playerState)` before calling
    // - onPlayerRegister guards with `if (!this.playerAttackStyles.has(playerId))`
    // This method itself has no guard so that it can be called unconditionally
    // by any future caller that intentionally needs to reset state.

    // Use saved style from database, or default to "accurate"
    const initialStyle =
      savedStyle && this.ATTACK_STYLES[savedStyle] ? savedStyle : "accurate";

    const playerState: PlayerAttackStyleState = {
      playerId,
      selectedStyle: initialStyle,
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

    let playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      // Auto-initialize if player exists but wasn't registered yet (event ordering).
      // Use weapon-appropriate default so the player doesn't get an "invalid style"
      // error if "accurate" isn't valid for their equipped weapon.
      if (this.isKnownPlayer(playerId)) {
        const weaponType = this.getPlayerWeaponType(playerId);
        const defaultStyle = getDefaultStyleForWeapon(weaponType);
        this.logger.debug(
          `Auto-initializing attack style for ${playerId} (event ordering race), default: ${defaultStyle}`,
        );
        this.initializePlayerAttackStyle(playerId, defaultStyle);
        playerState = this.playerAttackStyles.get(playerId);
      }
      if (!playerState) {
        this.logger.warn(
          `Attack style change rejected: no state for player ${playerId}`,
        );
        return;
      }
    }

    // Validate new style exists
    const style = this.ATTACK_STYLES[newStyle];
    if (!style) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `Invalid attack style: ${newStyle}`,
        type: "error",
      });
      return;
    }

    // Validate style is allowed for equipped weapon (OSRS-accurate)
    const weaponType = this.getPlayerWeaponType(playerId);

    if (!isStyleValidForWeapon(weaponType, newStyle as CombatStyleExtended)) {
      const availableStyles = getAvailableStyles(weaponType);
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `${style.name} style is not available for this weapon. Available: ${availableStyles.join(", ")}`,
        type: "warning",
      });
      return;
    }

    // Update player's attack style
    const oldStyle = playerState.selectedStyle;
    playerState.selectedStyle = newStyle;

    // Notify UI
    this.emitTypedEvent(EventType.UI_ATTACK_STYLE_CHANGED, {
      playerId,
      currentStyle: style,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: true,
      cooldownRemaining: 0,
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
   * OSRS-accurate: When weapon changes, validate current style is still available.
   * If not, auto-switch to the first valid style for the new weapon type.
   * Example: switching from staff (autocast) to sword → auto-select "accurate"
   */
  private handleWeaponChange(playerId: string): void {
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return;

    const weaponType = this.getPlayerWeaponType(playerId);
    const currentStyle = playerState.selectedStyle as CombatStyleExtended;

    if (!isStyleValidForWeapon(weaponType, currentStyle)) {
      const newStyle = getDefaultStyleForWeapon(weaponType);
      this.handleStyleChange({ playerId, newStyle });
    }
  }

  /**
   * CLIENT-SIDE: Sync internal state when receiving authoritative style from server.
   *
   * This fixes a bug where the client initializes playerAttackStyles with "accurate"
   * (because there's no database on client), but the server has the correct saved style.
   * When the server sends the correct style via attackStyleChanged packet, we need to
   * update the client's internal Map so that getAttackStyleInfo() returns the correct value.
   */
  private handleStyleSyncFromServer(data: {
    playerId: string;
    currentStyle: { id: string };
  }): void {
    // Only sync on client - server is authoritative and doesn't need this
    if (this.world.isServer) return;

    const { playerId, currentStyle } = data;
    if (!currentStyle?.id) return;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      // Player not yet initialized, create state with server's value
      this.playerAttackStyles.set(playerId, {
        playerId,
        selectedStyle: currentStyle.id,
      });
      return;
    }

    // Update existing state with server's authoritative value
    if (playerState.selectedStyle !== currentStyle.id) {
      playerState.selectedStyle = currentStyle.id;
    }
  }

  /** Check if an ID corresponds to a known player (registered or entity with type "player"). */
  private isKnownPlayer(playerId: string): boolean {
    if (this.players.has(playerId)) return true;
    const entity = this.world.entities?.get(playerId);
    return !!entity && (entity as { type?: string }).type === "player";
  }

  private static readonly VALID_WEAPON_TYPES = new Set<string>(
    Object.values(WeaponType),
  );

  /** Validated weapon type lookup — returns WeaponType.NONE for unknown types */
  private getPlayerWeaponType(playerId: string): WeaponType {
    const equipmentSystem = this.world.getSystem("equipment") as {
      getPlayerEquipment?: (id: string) => {
        weapon?: { item?: { weaponType?: string } };
      } | null;
    } | null;

    if (!equipmentSystem?.getPlayerEquipment) return WeaponType.NONE;

    const equipment = equipmentSystem.getPlayerEquipment(playerId);
    const raw = equipment?.weapon?.item?.weaponType?.toLowerCase();
    if (!raw || !PlayerSystem.VALID_WEAPON_TYPES.has(raw)) {
      return WeaponType.NONE;
    }
    return raw as WeaponType;
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

    const styleInfo = {
      style: playerState.selectedStyle,
      currentStyle,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: true,
    };

    callback(styleInfo);
  }

  private emitStyleUpdateEvent(playerId: string): void {
    const playerState = this.playerAttackStyles.get(playerId);
    if (playerState) {
      const currentStyle = this.ATTACK_STYLES[playerState.selectedStyle];

      this.emitTypedEvent(EventType.UI_ATTACK_STYLE_UPDATE, {
        playerId,
        currentStyle,
        availableStyles: Object.values(this.ATTACK_STYLES),
        canChange: true,
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

  forceChangeAttackStyle(playerId: string, styleId: string): boolean {
    const style = this.ATTACK_STYLES[styleId];
    if (!style) return false;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return false;

    this.handleStyleChange({ playerId, newStyle: styleId });
    return true;
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
    };
  }

  // ============================================================================
  // AUTO-RETALIATE METHODS
  // ============================================================================

  /**
   * Initialize auto-retaliate for a new player
   */
  private initializePlayerAutoRetaliate(
    playerId: string,
    enabled: boolean,
  ): void {
    // No idempotency guard — onPlayerRegister carries DB-loaded values that must
    // overwrite any auto-initialized defaults. Auto-init call sites already guard
    // with `if (!this.playerAutoRetaliate.has(playerId))` before setting.
    this.playerAutoRetaliate.set(playerId, enabled);

    // Notify UI of initial state
    this.emitTypedEvent(EventType.UI_AUTO_RETALIATE_CHANGED, {
      playerId,
      enabled,
    });
  }

  /**
   * Handle toggle request with validation and rate limiting
   *
   * Security: Server validates before applying (server authority)
   * OWASP: Input validation + rate limiting
   */
  private handleAutoRetaliateToggle(data: {
    playerId: string;
    enabled: boolean;
  }): void {
    const { playerId, enabled } = data;

    // === INPUT VALIDATION (OWASP) ===
    // 1. Validate playerId exists in our system — auto-initialize if missing
    // (onPlayerRegister may not have fired yet due to event ordering)
    if (!this.playerAutoRetaliate.has(playerId)) {
      // Only auto-initialize for player entities (not mobs or other entity types)
      if (this.isKnownPlayer(playerId)) {
        this.logger.debug(
          `Auto-initializing auto-retaliate for ${playerId} (event ordering race)`,
        );
        this.playerAutoRetaliate.set(playerId, true); // default ON
      } else {
        this.logger.warn(
          `Auto-retaliate toggle rejected: unknown player ${playerId}`,
        );
        return;
      }
    }

    // 2. Validate enabled is actually a boolean (prevent type coercion attacks)
    if (typeof enabled !== "boolean") {
      this.logger.warn(
        `Auto-retaliate toggle rejected: invalid enabled type for ${playerId}`,
      );
      return;
    }

    // === RATE LIMITING (Anti-Spam) ===
    const now = Date.now();
    const lastToggle = this.autoRetaliateLastToggle.get(playerId) ?? 0;
    if (now - lastToggle < this.AUTO_RETALIATE_COOLDOWN_MS) {
      // Silent ignore - don't spam logs for rate limited requests
      return;
    }
    this.autoRetaliateLastToggle.set(playerId, now);

    // === APPLY CHANGE (Server Authority) ===
    const oldValue = this.playerAutoRetaliate.get(playerId);
    if (oldValue === enabled) {
      // No change needed - avoid unnecessary DB writes
      return;
    }

    this.playerAutoRetaliate.set(playerId, enabled);

    // Persist to database (server-side only)
    if (this.world.isServer && this.databaseSystem) {
      const databaseId = PlayerIdMapper.getDatabaseId(playerId);
      this.databaseSystem.savePlayer(databaseId, {
        autoRetaliate: enabled ? 1 : 0,
      });
    }

    // Notify UI (broadcasts to client)
    this.emitTypedEvent(EventType.UI_AUTO_RETALIATE_CHANGED, {
      playerId,
      enabled,
    });

    // Chat message feedback
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `Auto retaliate: ${enabled ? "ON" : "OFF"}`,
      type: "info",
    });
  }

  /**
   * Handle autocast spell selection
   * Sets the player's selected spell for magic combat
   */
  private handleSetAutocast(data: {
    playerId: string;
    spellId: string | null;
  }): void {
    const { playerId, spellId } = data;

    // Validate player exists in PlayerSystem's internal map
    const player = this.players.get(playerId);
    if (!player) {
      this.logger.warn(`Set autocast rejected: unknown player ${playerId}`);
      return;
    }

    // Update player entity data on PlayerSystem's internal player
    if (player.data) {
      (player.data as { selectedSpell?: string | null }).selectedSpell =
        spellId;
    }

    // ALSO update on Entities.players (used by CombatSystem via world.getPlayer())
    const entitiesPlayer = this.world.getPlayer?.(playerId);
    if (entitiesPlayer?.data) {
      (entitiesPlayer.data as { selectedSpell?: string | null }).selectedSpell =
        spellId;
    }

    // Persist to database (server-side only)
    if (this.world.isServer && this.databaseSystem) {
      const databaseId = PlayerIdMapper.getDatabaseId(playerId);
      this.databaseSystem.savePlayer(databaseId, {
        selectedSpell: spellId ?? undefined,
      });
    }

    // Notify client of autocast change
    this.emitTypedEvent(EventType.COMBAT_AUTOCAST_SET, {
      playerId,
      spellId,
    });

    // Chat message feedback
    if (spellId) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `Autocast set to ${spellId.replace(/_/g, " ")}`,
        type: "info",
      });
    } else {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Autocast disabled",
        type: "info",
      });
    }
  }

  /**
   * Handle get request for auto-retaliate state
   */
  private handleGetAutoRetaliate(data: {
    playerId: string;
    callback?: (enabled: boolean) => void;
  }): void {
    // First try server-side Map (populated during enterWorld on server)
    let enabled = this.playerAutoRetaliate.get(data.playerId);

    // Client-side fallback: read from PlayerLocal.combat.autoRetaliate
    // The client's Map is not populated, but PlayerLocal has the correct value from entity data
    if (enabled === undefined && !this.world.isServer) {
      const localPlayer = this.world.entities?.player;
      if (localPlayer && localPlayer.id === data.playerId) {
        // Access combat.autoRetaliate from PlayerLocal
        const combat = (localPlayer as { combat?: { autoRetaliate?: boolean } })
          .combat;
        enabled = combat?.autoRetaliate ?? true;
      }
    }

    // Final fallback: default to true (OSRS behavior)
    enabled = enabled ?? true;

    if (data.callback) {
      data.callback(enabled);
    } else {
      this.emitTypedEvent(EventType.UI_AUTO_RETALIATE_CHANGED, {
        playerId: data.playerId,
        enabled,
      });
    }
  }

  /**
   * Public API for CombatSystem to check auto-retaliate
   *
   * Performance: O(1) Map lookup, no allocations
   * Called in combat hot path - must be fast
   */
  getPlayerAutoRetaliate(playerId: string): boolean {
    return this.playerAutoRetaliate.get(playerId) ?? true;
  }

  private handleSkillsUpdate(data: { playerId: string; skills: Skills }): void {
    const player = this.players.get(data.playerId);
    if (!player) {
      this.pendingSkillUpdates.set(data.playerId, data.skills);
      return;
    }

    // Update player skills
    player.skills = data.skills;

    // Sync health.max from constitution (same formula as initial registration at line 693)
    // Without this, emitPlayerUpdate() broadcasts stale health.max after constitution XP gain
    const constitutionLevel =
      Number.isFinite(data.skills.constitution?.level) &&
      data.skills.constitution.level > 0
        ? data.skills.constitution.level
        : 10;
    const healthMaxChanged = constitutionLevel !== player.health.max;
    if (healthMaxChanged) {
      player.health.max = constitutionLevel;
      if (player.health.current > player.health.max) {
        player.health.current = player.health.max;
      }
    }

    // Recalculate combat level
    player.combat.combatLevel = this.calculateCombatLevel(data.skills);

    // Sync to entity and broadcast to all clients
    this.syncCombatLevelToEntity(data.playerId, player.combat.combatLevel);

    // Update stats component with new skill data for SkillsSystem and combat calculations
    const playerEntity = this.world.entities.get(data.playerId);
    if (playerEntity) {
      const statsComponent = playerEntity.getComponent(
        "stats",
      ) as StatsComponent | null;
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

        // Sync health to statsComponent so handleLevelUp reads correct values
        // (defense-in-depth: handleLevelUp reads stats.health, not player.health)
        statsComponent.health.current = player.health.current;
        statsComponent.health.max = player.health.max;
      }

      // Push updated health.max to entity data for network serialization
      if (healthMaxChanged) {
        playerEntity.data.health = player.health.current;
        (playerEntity.data as { maxHealth?: number }).maxHealth =
          player.health.max;
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
