/**
 * MobEntity - Enemy/Monster Entity
 *
 * Represents hostile creatures (mobs) in the game world. Handles combat AI,
 * patrolling, aggression, and loot drops.
 *
 * **Extends**: CombatantEntity (inherits health, combat, and damage)
 *
 * **Key Features**:
 *
 * **AI Behavior**:
 * - Idle state: Stands still or patrols spawn area
 * - Patrol state: Walks between patrol points
 * - Aggro state: Detected player within aggro radius
 * - Combat state: Actively attacking target
 * - Fleeing state: Low health retreat (future)
 * - Dead state: Corpse state before despawn
 *
 * **Combat System**:
 * - Attack power and speed
 * - Defense rating
 * - Attack range (melee or ranged)
 * - Aggro radius (detection range)
 * - Combat level for XP calculations
 * - Attack styles (melee, ranged, magic)
 *
 * **Patrol System**:
 * - Generates random patrol points around spawn
 * - Walks between points when not in combat
 * - Returns to spawn area if pulled too far
 * - Configurable patrol radius
 *
 * **Aggression**:
 * - Aggro radius determines detection range
 * - Remembers last attacker
 * - Chases target within leash distance
 * - Resets when target dies or escapes
 *
 * **Loot System**:
 * - Drops items on death based on loot table
 * - Quantity randomization
 * - Rare drop chances
 * - Corpse despawn timer
 *
 * **Respawning**:
 * - Respawn timer after death
 * - Resets to spawn position
 * - Full health restoration
 * - State reset (clears aggro, target)
 *
 * **Visual Representation**:
 * - 3D model (GLB) or procedural mesh
 * - Health bar when damaged
 * - Nametag with mob name and level
 * - Death animation
 * - Attack animations
 *
 * **Network Sync**:
 * - Position broadcast to clients
 * - State changes (idle, combat, dead)
 * - Health updates
 * - Target information
 *
 * **Database**: Mob instances are NOT persisted (respawn from spawn points)
 *
 * **Runs on**: Server (authoritative), Client (visual only)
 * **Referenced by**: MobNPCSystem, MobNPCSpawnerSystem, CombatSystem, AggroSystem
 *
 * @public
 */

import THREE from "../../extras/three/three";
import type {
  EntityData,
  MeshUserData,
  MobEntityData,
  Position3D,
} from "../../types";
import { AttackType } from "../../types/core/core";
import type {
  EntityInteractionData,
  MobEntityConfig,
} from "../../types/entities";
import { MobAIState } from "../../types/entities";
import { EventType } from "../../types/events";
import type { World } from "../../core/World";
import { CombatantEntity, type CombatantConfig } from "../CombatantEntity";
import { modelCache } from "../../utils/rendering/ModelCache";
import type { EntityManager } from "../../systems/shared";
import type {
  VRMAvatarInstance,
  LoadedAvatar,
  AvatarHooks,
} from "../../types/rendering/nodes";
import { Emotes } from "../../data/playerEmotes";
import { DeathStateManager } from "../managers/DeathStateManager";
import { CombatStateManager } from "../managers/CombatStateManager";
import {
  AIStateMachine,
  type AIStateContext,
} from "../managers/AIStateMachine";
import { RespawnManager } from "../managers/RespawnManager";
import { UIRenderer } from "../../utils/rendering/UIRenderer";
import { GAME_CONSTANTS } from "../../constants";
import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { AggroManager } from "../managers/AggroManager";
import { worldToTile } from "../../systems/shared/movement/TileSystem";
import { attackSpeedSecondsToTicks } from "../../utils/game/CombatCalculations";

// Polyfill ProgressEvent for Node.js server environment
if (typeof ProgressEvent === "undefined") {
  (globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
    class extends Event {
      lengthComputable = false;
      loaded = 0;
      total = 0;
      constructor(
        type: string,
        init?: { lengthComputable?: boolean; loaded?: number; total?: number },
      ) {
        super(type);
        if (init) {
          this.lengthComputable = init.lengthComputable || false;
          this.loaded = init.loaded || 0;
          this.total = init.total || 0;
        }
      }
    };
}

export class MobEntity extends CombatantEntity {
  protected config: MobEntityConfig;

  // ===== COMPONENTS (Clean Separation of Concerns) =====
  private deathManager: DeathStateManager;
  private combatManager: CombatStateManager;
  private aiStateMachine: AIStateMachine;
  private respawnManager: RespawnManager;
  private aggroManager: AggroManager;

  // ===== RENDERING =====
  private _avatarInstance: VRMAvatarInstance | null = null;
  private _currentEmote: string | null = null;
  private _serverEmote: string | null = null; // Server-forced one-shot emote (e.g., combat)
  private _manualEmoteOverrideUntil: number = 0; // Timestamp until which manual emote override is active
  private _tempMatrix = new THREE.Matrix4();
  private _tempScale = new THREE.Vector3(1, 1, 1);
  private _terrainWarningLogged = false;
  private _hasValidTerrainHeight = false;

  // ===== PATROL SYSTEM (Can be componentized later) =====
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;

  // ===== MOVEMENT (Can be componentized later) =====
  private _wanderTarget: { x: number; z: number } | null = null;
  private _lastPosition: THREE.Vector3 | null = null;
  private _stuckTimer = 0;
  private readonly WANDER_MIN_DISTANCE = 1; // Minimum wander distance
  private readonly WANDER_MAX_DISTANCE = 5; // Maximum wander distance
  private readonly STUCK_TIMEOUT = 3000; // Give up after 3 seconds stuck
  // Tile movement throttling - prevent emitting duplicate move requests
  // Uses tick-based throttling (aligned with 600ms server ticks) instead of time-based
  private _lastRequestedTargetTile: { x: number; z: number } | null = null;
  private _lastMoveRequestTick: number = -1;

  // ===== SPAWN TRACKING =====
  // Track the mob's CURRENT spawn location (changes on respawn)
  // This is different from respawnManager.getSpawnAreaCenter() which is fixed
  private _currentSpawnPoint: Position3D;

  // ===== DEBUG TRACKING =====
  private _justRespawned = false; // Track if we just respawned (for one-time logging)

  // ===== TICK-ALIGNED AI =====
  // AI runs once per server tick (600ms), not every frame (~16ms)
  // This prevents excessive movement requests and aligns with OSRS tick system
  private _lastAITick: number = -1;

  // ===== HEALTH BAR VISIBILITY (RuneScape pattern: show only when damaged) =====
  private _healthBarVisibleUntil: number = 0; // Timestamp when health bar should hide
  private _lastKnownHealth: number = 0; // Track previous health to detect damage

  async init(): Promise<void> {
    await super.init();

    // Register for update loop (both client and server)
    // Client: VRM animations via clientUpdate()
    // Server: AI behavior via serverUpdate()
    this.world.setHot(this, true);

    // Hide health bar initially (RuneScape pattern: only show after damaged)
    // Health bar is created by Entity.initializeVisuals() called from super.init()
    if (this.healthSprite) {
      this.healthSprite.visible = false;
    }
    this._lastKnownHealth = this.config.currentHealth;

    // TODO: Server-side validation disabled due to ProgressEvent polyfill issues
    // Validation happens on client side instead (see clientUpdate)
  }

  constructor(world: World, config: MobEntityConfig) {
    // Convert MobEntityConfig to CombatantConfig format with proper type assertion
    const combatConfig = {
      ...config,
      rotation: config.rotation || { x: 0, y: 0, z: 0, w: 1 },
      combat: {
        attack: Math.floor(config.attackPower / 10),
        defense: Math.floor(config.defense / 10),
        attackSpeed: 1.0 / config.attackSpeed,
        criticalChance: 0.05,
        combatLevel: config.level,
        respawnTime: config.respawnTime,
        aggroRadius: config.aggroRange,
        attackRange: config.combatRange,
      },
    } as unknown as CombatantConfig;

    super(world, combatConfig);
    this.config = config;

    // Ensure respawnTime is at least 15 seconds (RuneScape-style)
    if (!this.config.respawnTime || this.config.respawnTime < 15000) {
      console.warn(
        `[MobEntity] respawnTime was ${this.config.respawnTime}, setting to 15000ms (15 seconds)`,
      );
      this.config.respawnTime = 15000; // 15 seconds minimum
    }

    // ===== INITIALIZE COMPONENTS =====

    // Death State Manager
    this.deathManager = new DeathStateManager({
      respawnTime: this.config.respawnTime,
      deathAnimationDuration: 4500, // 4.5 seconds
      spawnPoint: this.config.spawnPoint,
    });

    // Wire up death manager callbacks (handles visibility during death animation only)
    this.deathManager.onMeshVisibilityChange((visible) => {
      if (this.mesh) {
        this.mesh.visible = visible;
      }
    });

    // NOTE: Respawn callback is now handled by RespawnManager, not DeathStateManager

    // Combat State Manager (TICK-BASED)
    // Convert attackSpeed from seconds (mob config) to ticks
    this.combatManager = new CombatStateManager({
      attackPower: this.config.attackPower,
      attackSpeedTicks: attackSpeedSecondsToTicks(this.config.attackSpeed),
      attackRange: this.config.combatRange,
    });

    // Wire up combat manager callbacks
    this.combatManager.onAttack((targetId) => {
      this.performAttackAction(targetId);
    });

    // AI State Machine
    this.aiStateMachine = new AIStateMachine();

    // Aggro Manager - handles targeting and aggro detection
    this.aggroManager = new AggroManager({
      aggroRange: this.config.aggroRange,
      combatRange: this.config.combatRange,
    });

    // Respawn Manager - handles spawn area and respawn locations
    this.respawnManager = new RespawnManager({
      spawnAreaCenter: this.config.spawnPoint, // Use spawnPoint as center of spawn area
      spawnAreaRadius: this.config.wanderRadius || this.config.aggroRange, // Spawn anywhere within wander/aggro range
      respawnTimeMin: this.config.respawnTime,
      respawnTimeMax: this.config.respawnTime + 5000, // Add 5s randomness
    });

    // Wire up respawn manager callback
    this.respawnManager.onRespawn((spawnPoint) => {
      this.handleRespawn(spawnPoint);
    });

    // Listen for player deaths - disengage if we were targeting them
    this.world.on(EventType.PLAYER_SET_DEAD, (data: unknown) => {
      const deathData = data as { playerId: string; isDead: boolean };
      if (
        deathData.isDead &&
        this.config.targetPlayerId === deathData.playerId
      ) {
        this.clearTargetAndExitCombat();
      }
    });

    // CRITICAL: Use RespawnManager for INITIAL spawn too (not just respawn)
    // This ensures the mob spawns at a random location within the spawn area
    // instead of always at the same fixed point
    const initialSpawnPoint = this.respawnManager.generateSpawnPoint();

    // Track current spawn location for AI (patrol, leashing, return)
    this._currentSpawnPoint = { ...initialSpawnPoint };

    this.setPosition(
      initialSpawnPoint.x,
      initialSpawnPoint.y,
      initialSpawnPoint.z,
    );
    this.node.position.set(
      initialSpawnPoint.x,
      initialSpawnPoint.y,
      initialSpawnPoint.z,
    );

    this.generatePatrolPoints();

    // Set entity properties for systems to access
    this.setProperty("mobType", config.mobType);
    this.setProperty("level", config.level);
    this.setProperty("health", {
      current: config.currentHealth,
      max: config.maxHealth,
    });

    // Add stats component for skills system compatibility
    this.addComponent("stats", {
      // Combat stats - mobs have simplified skills
      attack: {
        level: Math.max(1, Math.floor(config.attackPower / 10)),
        xp: 0,
      },
      strength: {
        level: Math.max(1, Math.floor(config.attackPower / 10)),
        xp: 0,
      },
      defense: { level: Math.max(1, Math.floor(config.defense / 10)), xp: 0 },
      constitution: { level: Math.max(10, config.level), xp: 0 },
      ranged: { level: 1, xp: 0 }, // Most mobs don't use ranged
      // Non-combat skills not applicable to mobs
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      firemaking: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 },
      // Additional stats
      combatLevel: config.level,
      totalLevel: config.level * 5, // Approximate
      health: config.currentHealth,
      maxHealth: config.maxHealth,
      level: config.level,
      // HP stats for combat level calculation
      hitpoints: {
        level: Math.max(10, config.level),
        current: config.currentHealth,
        max: config.maxHealth,
      },
      prayer: { level: 1, points: 0 }, // Mobs don't use prayer
      magic: { level: 1, xp: 0 }, // Basic mobs don't use magic
    });
  }

  /**
   * Setup animations from GLB data (inline animations)
   */
  private async setupAnimations(
    animations: THREE.AnimationClip[],
  ): Promise<void> {
    if (!this.mesh || animations.length === 0) {
      console.warn(
        `[MobEntity] Cannot setup animations - no mesh or no animations`,
      );
      return;
    }

    // Find the SkinnedMesh to apply animation to
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!skinnedMesh) {
      console.warn(`[MobEntity] No SkinnedMesh found in model for animations`);
      return;
    }

    // Create AnimationMixer on SkinnedMesh (required for DetachedBindMode)
    const mixer = new THREE.AnimationMixer(skinnedMesh);

    // Store all animation clips for state-based switching
    const animationClips: {
      idle?: THREE.AnimationClip;
      walk?: THREE.AnimationClip;
    } = {};

    // Categorize animations by name
    for (const clip of animations) {
      const nameLower = clip.name.toLowerCase();
      if (nameLower.includes("idle") || nameLower.includes("standing")) {
        animationClips.idle = clip;
      } else if (nameLower.includes("walk") || nameLower.includes("move")) {
        animationClips.walk = clip;
      }
    }

    // Default to first animation if no categorized animations found
    if (!animationClips.idle && !animationClips.walk) {
      animationClips.idle = animations[0];
    }

    // Play idle animation by default (or walk if idle doesn't exist)
    const initialClip =
      animationClips.idle || animationClips.walk || animations[0];
    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity); // Loop animation indefinitely
    action.play();

    // Store mixer and clips on entity
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
    (this as { animationClips?: typeof animationClips }).animationClips =
      animationClips;
    (this as { currentAction?: THREE.AnimationAction }).currentAction = action;
  }

  /**
   * Load VRM model and create avatar instance
   */
  private async loadVRMModel(): Promise<void> {
    if (!this.world.loader) {
      console.error(
        `[MobEntity] ❌ No loader available for ${this.config.mobType}`,
      );
      return;
    }

    if (!this.config.model) {
      console.error(`[MobEntity] ❌ No model path for ${this.config.mobType}`);
      return;
    }

    if (!this.world.stage?.scene) {
      console.error(
        `[MobEntity] ❌ No world.stage.scene available for ${this.config.mobType}`,
      );
      return;
    }

    // Create VRM hooks with scene reference (CRITICAL for visibility!)
    const vrmHooks = {
      scene: this.world.stage.scene,
      octree: this.world.stage?.octree,
      camera: this.world.camera,
      loader: this.world.loader,
    };

    // Load the VRM avatar using the same loader as players
    const src = (await this.world.loader.load(
      "avatar",
      this.config.model,
    )) as LoadedAvatar;

    // Convert to nodes
    const nodeMap = src.toNodes(vrmHooks);
    const avatarNode = nodeMap.get("avatar") || nodeMap.get("root");

    if (!avatarNode) {
      console.error(`[MobEntity] ❌ No avatar node found in nodeMap`);
      return;
    }

    // Get the factory from the avatar node
    const avatarNodeWithFactory = avatarNode as {
      factory?: {
        create: (matrix: THREE.Matrix4, hooks?: unknown) => VRMAvatarInstance;
      };
    };

    if (!avatarNodeWithFactory?.factory) {
      console.error(
        `[MobEntity] ❌ No factory found on avatar node for ${this.config.mobType}`,
      );
      return;
    }

    // Update our node's transform
    this.node.updateMatrix();
    this.node.updateMatrixWorld(true);

    // Create the VRM instance using the factory
    this._avatarInstance = avatarNodeWithFactory.factory.create(
      this.node.matrixWorld,
      vrmHooks,
    );

    // Set initial emote to idle
    this._currentEmote = Emotes.IDLE;
    this._avatarInstance.setEmote(this._currentEmote);

    // NOTE: Don't register VRM instance as hot - the MobEntity itself is registered
    // The entity's clientUpdate() will call avatarInstance.update()

    // Get the scene from the VRM instance
    const instanceWithRaw = this._avatarInstance as {
      raw?: { scene?: THREE.Object3D };
    };
    if (instanceWithRaw?.raw?.scene) {
      this.mesh = instanceWithRaw.raw.scene;
      this.mesh.name = `Mob_VRM_${this.config.mobType}_${this.id}`;

      // Set up userData for interaction detection
      const userData: MeshUserData = {
        type: "mob",
        entityId: this.id,
        name: this.config.name,
        interactable: true,
        mobData: {
          id: this.id,
          name: this.config.name,
          type: this.config.mobType,
          level: this.config.level,
          health: this.config.currentHealth,
          maxHealth: this.config.maxHealth,
        },
      };
      this.mesh.userData = { ...userData };

      // VRM instances manage their own positioning via move() - do NOT parent to node
      // The factory already added the scene to world.stage.scene
      // We'll use avatarInstance.move() to position it each frame
    } else {
      console.error(
        `[MobEntity] ❌ No scene in VRM instance for ${this.config.mobType}`,
      );
    }
  }

  /**
   * Load external animation files (walking.glb, running.glb, etc.)
   * These are custom animations made specifically for the mob models
   */
  private async loadIdleAnimation(): Promise<void> {
    if (!this.mesh || !this.world.loader) {
      return;
    }

    const modelPath = this.config.model;
    if (!modelPath) return;

    const modelDir = modelPath.substring(0, modelPath.lastIndexOf("/"));

    // EXPECT: Model has SkinnedMesh
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!skinnedMesh) {
      throw new Error(
        `[MobEntity] No SkinnedMesh in model: ${this.config.mobType} (${modelPath})`,
      );
    }

    // Create AnimationMixer on SkinnedMesh (required for DetachedBindMode)
    const mixer = new THREE.AnimationMixer(skinnedMesh);
    const animationClips: {
      idle?: THREE.AnimationClip;
      walk?: THREE.AnimationClip;
      run?: THREE.AnimationClip;
    } = {};

    // Load animation files (load as raw GLB, not emote, to avoid bone remapping)
    const animFiles = [
      { name: "walk", path: `${modelDir}/animations/walking.glb` },
      { name: "run", path: `${modelDir}/animations/running.glb` },
    ];

    for (const { name, path } of animFiles) {
      try {
        // Load as model (not emote) to get raw animations without VRM retargeting
        const result = await modelCache.loadModel(path, this.world);
        if (result.animations && result.animations.length > 0) {
          const clip = result.animations[0];
          animationClips[name as "walk" | "run"] = clip;
          if (name === "walk") animationClips.idle = clip; // Use walk as idle
        }
      } catch (err) {
        // Animation file not found - skip
      }
    }

    // EXPECT: At least one clip loaded
    const initialClip = animationClips.idle || animationClips.walk;
    if (!initialClip) {
      throw new Error(
        `[MobEntity] NO CLIPS: ${this.config.mobType}\n` +
          `  Dir: ${modelDir}/animations/\n` +
          `  Result: idle=${!!animationClips.idle}, walk=${!!animationClips.walk}, run=${!!animationClips.run}`,
      );
    }

    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    // Store mixer and clips
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
    (this as { animationClips?: typeof animationClips }).animationClips =
      animationClips;
    (this as { currentAction?: THREE.AnimationAction }).currentAction = action;

    // EXPECT: Action running after play()
    if (!action.isRunning()) {
      throw new Error(`[MobEntity] ACTION NOT RUNNING: ${this.config.mobType}`);
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    // Try to load 3D model if available
    if (this.config.model && this.world.loader) {
      try {
        // Check if this is a VRM file
        if (this.config.model.endsWith(".vrm")) {
          await this.loadVRMModel();
          return;
        }

        // Otherwise load as GLB (existing code path)
        const { scene, animations } = await modelCache.loadModel(
          this.config.model,
          this.world,
        );

        this.mesh = scene;
        this.mesh.name = `Mob_${this.config.mobType}_${this.id}`;

        // CRITICAL: Scale the root mesh transform, then bind skeleton
        const modelScale = 100; // cm to meters
        this.mesh.scale.set(modelScale, modelScale, modelScale);
        this.mesh.updateMatrix();
        this.mesh.updateMatrixWorld(true);

        // NOW bind the skeleton at the scaled size
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Ensure mesh matrix is updated
            child.updateMatrix();
            child.updateMatrixWorld(true);

            // Bind skeleton with DetachedBindMode (like VRM)
            child.bindMode = THREE.DetachedBindMode;
            child.bindMatrix.copy(child.matrixWorld);
            child.bindMatrixInverse.copy(child.bindMatrix).invert();
          }
        });

        // Set up userData for interaction detection
        const userData: MeshUserData = {
          type: "mob",
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          mobData: {
            id: this.id,
            name: this.config.name,
            type: this.config.mobType,
            level: this.config.level,
            health: this.config.currentHealth,
            maxHealth: this.config.maxHealth,
          },
        };
        this.mesh.userData = { ...userData };

        // Add as child of node (standard approach with correct scale)
        // Position is relative to node, so keep it at origin
        this.mesh.position.set(0, 0, 0);
        this.mesh.quaternion.identity();
        this.node.add(this.mesh);

        // Always try to load external animations (most mobs use separate files)
        await this.loadIdleAnimation();

        // Also try inline animations if they exist
        if (animations.length > 0) {
          const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
          if (!mixer) {
            await this.setupAnimations(animations);
          }
        }

        return;
      } catch (error) {
        console.warn(
          `[MobEntity] Failed to load model for ${this.config.mobType}, using placeholder:`,
          error,
        );
        // Fall through to placeholder
      }
    }
    const mobName = String(this.config.mobType).toLowerCase();
    const colorHash = mobName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (colorHash % 360) / 360;
    const color = new THREE.Color().setHSL(hue, 0.6, 0.4);

    const geometry = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
    const material = new THREE.MeshLambertMaterial({ color: color.getHex() });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `Mob_${this.config.mobType}_${this.id}`;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Set up userData with proper typing for mob
    const userData: MeshUserData = {
      type: "mob",
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      mobData: {
        id: this.id,
        name: this.config.name,
        type: this.config.mobType,
        level: this.config.level,
        health: this.config.currentHealth,
        maxHealth: this.config.maxHealth,
      },
    };
    if (this.mesh) {
      // Spread userData to match THREE.js userData type
      this.mesh.userData = { ...userData };
    }

    // Add mesh to node so it appears in the scene
    if (this.mesh) {
      this.node.add(this.mesh);
    }

    // Health bar is created by Entity base class
  }

  protected async onInteract(data: EntityInteractionData): Promise<void> {
    // Handle attack interaction
    if (data.interactionType === "attack") {
      this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
        attackerId: data.playerId,
        targetId: this.id,
        attackerType: "player",
        targetType: "mob",
        attackType: AttackType.MELEE,
        position: this.getPosition(),
      });
    } else {
      // Default interaction - show mob info or examine
      this.world.emit(EventType.MOB_NPC_EXAMINE, {
        playerId: data.playerId,
        mobId: this.id,
        mobData: this.getMobData(),
      });
    }
  }

  /**
   * Create AI State Context for the state machine
   * This provides all the methods the AI states need to interact with the mob
   */
  private createAIContext(): AIStateContext {
    return {
      // Position & Movement
      getPosition: () => this.getPosition(),
      moveTowards: (target, _deltaTime) => {
        // Emit tile movement request instead of continuous movement
        // Server's MobTileMovementManager will handle the actual movement on ticks
        // The deltaTime parameter is ignored - movement is now tick-based

        // Convert positions to tiles for comparison
        const currentPos = this.getPosition();
        const currentTile = worldToTile(currentPos.x, currentPos.z);
        const targetTile = worldToTile(target.x, target.z);

        // CRITICAL: Skip if already at target tile (defense-in-depth)
        // This prevents spam when AI states call moveTowards to same tile
        // The AI states should also check this, but this is a safety net
        if (currentTile.x === targetTile.x && currentTile.z === targetTile.z) {
          return; // Already at destination tile - nothing to do
        }

        // TICK-BASED THROTTLING: Only emit one move request per tick per target
        // This aligns with the 600ms server tick system instead of arbitrary time cooldowns
        const currentTick = this.world.currentTick;
        const targetTileChanged =
          !this._lastRequestedTargetTile ||
          this._lastRequestedTargetTile.x !== targetTile.x ||
          this._lastRequestedTargetTile.z !== targetTile.z;

        if (!targetTileChanged && currentTick === this._lastMoveRequestTick) {
          return; // Same tick, same target - already requested this movement
        }

        // Update tracking
        this._lastRequestedTargetTile = { x: targetTile.x, z: targetTile.z };
        this._lastMoveRequestTick = currentTick;

        // Note: Debug logging removed for production. Enable if needed:
        // console.log(`[MobEntity] moveTowards: ${this.id} from tile (${currentTile.x}, ${currentTile.z}) to tile (${targetTile.x}, ${targetTile.z}), emitting MOB_NPC_MOVE_REQUEST`);

        this.world.emit(EventType.MOB_NPC_MOVE_REQUEST, {
          mobId: this.id,
          targetPos: target,
          // If chasing a player, include targetEntityId for dynamic repathing
          targetEntityId: this.config.targetPlayerId || undefined,
          tilesPerTick: 2, // Default mob walk speed (same as player walk)
        });
      },
      teleportTo: (position) => {
        this.setPosition(position.x, position.y, position.z);
        this.config.aiState = MobAIState.IDLE;
        this.config.currentHealth = this.config.maxHealth;
        this.setHealth(this.config.maxHealth);
        this.setProperty("health", {
          current: this.config.maxHealth,
          max: this.config.maxHealth,
        });
        this.combatManager.exitCombat();
        this.markNetworkDirty();
      },

      // Targeting
      findNearbyPlayer: () => this.findNearbyPlayer(),
      getPlayer: (playerId) => this.getPlayer(playerId),
      getCurrentTarget: () => this.config.targetPlayerId,
      setTarget: (playerId) => {
        this.config.targetPlayerId = playerId;
        if (playerId) {
          this.aggroManager.setTarget(playerId);
        } else {
          this.aggroManager.clearTarget();
        }
      },

      // Combat (TICK-BASED, OSRS-accurate)
      canAttack: (currentTick) => this.combatManager.canAttack(currentTick),
      performAttack: (targetId, currentTick) => {
        this.combatManager.performAttack(targetId, currentTick);
      },
      isInCombat: () => this.combatManager.isInCombat(),
      exitCombat: () => this.combatManager.exitCombat(),

      // Spawn & Leashing (use CURRENT spawn location, not area center)
      // CRITICAL: Return mob's current spawn point (changes on respawn)
      // NOT the spawn area center (which is fixed)
      getSpawnPoint: () => this._currentSpawnPoint,
      getDistanceFromSpawn: () => this.getDistance2D(this._currentSpawnPoint),
      getWanderRadius: () => this.respawnManager.getSpawnAreaRadius(),
      getCombatRange: () => this.config.combatRange,

      // Wander
      getWanderTarget: () =>
        this._wanderTarget
          ? { ...this._wanderTarget, y: this.getPosition().y }
          : null,
      setWanderTarget: (target) => {
        this._wanderTarget = target ? { x: target.x, z: target.z } : null;
      },
      generateWanderTarget: () => this.generateWanderTarget(),

      // Timing
      getCurrentTick: () => this.world.currentTick, // Server tick number for combat timing
      getTime: () => Date.now(), // Date.now() for non-combat timing (idle duration, etc.)

      // State management
      markNetworkDirty: () => this.markNetworkDirty(),
      emitEvent: (eventType, data) => {
        this.world.emit(eventType as EventType, data);
      },
    };
  }

  /**
   * Generate a random wander target within wander radius
   * Uses CURRENT spawn point (changes on respawn), not fixed config.spawnPoint
   */
  private generateWanderTarget(): Position3D {
    const currentPos = this.getPosition();
    const angle = Math.random() * Math.PI * 2;
    const distance =
      this.WANDER_MIN_DISTANCE +
      Math.random() * (this.WANDER_MAX_DISTANCE - this.WANDER_MIN_DISTANCE);

    let targetX = currentPos.x + Math.cos(angle) * distance;
    let targetZ = currentPos.z + Math.sin(angle) * distance;

    // Ensure target is within wander radius from CURRENT spawn point
    const distFromSpawn = Math.sqrt(
      Math.pow(targetX - this._currentSpawnPoint.x, 2) +
        Math.pow(targetZ - this._currentSpawnPoint.z, 2),
    );

    if (distFromSpawn > this.config.wanderRadius) {
      // Clamp to wander radius boundary
      const toTargetX = targetX - this._currentSpawnPoint.x;
      const toTargetZ = targetZ - this._currentSpawnPoint.z;
      const scale = this.config.wanderRadius / distFromSpawn;
      targetX = this._currentSpawnPoint.x + toTargetX * scale;
      targetZ = this._currentSpawnPoint.z + toTargetZ * scale;
    }

    return { x: targetX, y: currentPos.y, z: targetZ };
  }

  /**
   * Handle respawn callback from RespawnManager (SERVER-SIDE)
   * Handles game logic: health reset, state changes, position teleport
   * Visual restoration happens on client side in handleClientRespawn()
   *
   * @param spawnPoint - Random spawn point generated by RespawnManager
   */
  private handleRespawn(spawnPoint: Position3D): void {
    // Reset health and state
    this.config.currentHealth = this.config.maxHealth;
    this.setHealth(this.config.maxHealth);
    this.setProperty("health", {
      current: this.config.maxHealth,
      max: this.config.maxHealth,
    });

    // Reset AI state - set to IDLE first, then force AI state machine to IDLE
    this.config.aiState = MobAIState.IDLE;
    this.config.targetPlayerId = null;
    this.config.deathTime = null;

    // Clear aggro target
    this.aggroManager.clearTarget();

    // CRITICAL: Reset DeathStateManager BEFORE network sync
    // Without this, getNetworkData() thinks mob is still dead and strips position from network packet!
    this.deathManager.reset();

    // CRITICAL: Force AI state machine to IDLE state after respawn
    this.aiStateMachine.forceState(MobAIState.IDLE, this.createAIContext());

    // Clear combat state
    this.combatManager.exitCombat();

    // Clear any combat state in CombatSystem
    const combatSystem = this.world.getSystem("combat") as any;
    if (combatSystem && typeof combatSystem.forceEndCombat === "function") {
      combatSystem.forceEndCombat(this.id);
    }

    // CRITICAL: Update current spawn point to NEW random location
    // This ensures AI (patrol, leashing, return) uses the new spawn location
    this._currentSpawnPoint = { ...spawnPoint };

    // Regenerate patrol points around NEW spawn location
    this.patrolPoints = [];
    this.generatePatrolPoints();

    // Teleport to NEW random spawn point (generated by RespawnManager)
    this.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z);

    // CRITICAL: Force update node position (setPosition might only update this.position)
    this.node.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    this.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);

    // Update userData
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.mobData) {
        userData.mobData.health = this.config.currentHealth;
      }
    }

    // Emit respawn event
    this.world.emit(EventType.MOB_NPC_RESPAWNED, {
      mobId: this.id,
      position: this.getPosition(),
    });

    // Set flag to log next network sync (one-time only)
    this._justRespawned = true;

    this.markNetworkDirty();
  }

  // NOTE: Client-side respawn restoration is now handled inline in modify()
  // AFTER super.modify() updates the position from server
  // This ensures the VRM is moved to the correct spawn location, not the death location

  /**
   * Perform attack action (called by CombatStateManager)
   */
  private performAttackAction(targetId: string): void {
    this.world.emit(EventType.COMBAT_MOB_NPC_ATTACK, {
      mobId: this.id,
      targetId: targetId,
      damage: this.config.attackPower,
      attackerType: "mob",
      targetType: "player",
    });
  }

  /**
   * SERVER-SIDE UPDATE
   * Handles AI logic, pathfinding, combat, and state management
   * Changes are synced to clients via getNetworkData() and markNetworkDirty()
   */
  private serverUpdateCalls = 0;

  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);
    this.serverUpdateCalls++;

    // ===== COMPONENT-BASED UPDATE LOGIC =====

    // Handle death state (position locking during death animation)
    if (this.deathManager.isCurrentlyDead()) {
      // Use Date.now() for consistent millisecond timing (world.getTime() has inconsistent units)
      const currentTime = Date.now();

      // Lock position to death location (prevent any movement)
      const lockedPos = this.deathManager.getLockedPosition();
      if (lockedPos) {
        // Forcefully lock position every frame (defense in depth)
        if (
          this.position.x !== lockedPos.x ||
          this.position.y !== lockedPos.y ||
          this.position.z !== lockedPos.z
        ) {
          console.warn(
            `[MobEntity] ⚠️ Server position moved while dead! Restoring lock.`,
          );
          this.position.copy(lockedPos);
          this.node.position.copy(lockedPos);
        }
      }

      // Update death manager (handles death animation timing only, not respawn)
      this.deathManager.update(deltaTime, currentTime);

      // Update respawn manager (TICK-BASED - handles respawn timer and location)
      // Uses server tick for OSRS-accurate timing instead of Date.now()
      if (this.respawnManager.isRespawnTimerActive()) {
        this.respawnManager.update(this.world.currentTick);
      }

      return; // Don't run AI when dead
    }

    // Validate target is still alive before running AI (RuneScape-style: instant disengage on target death)
    if (this.config.targetPlayerId) {
      const targetPlayer = this.world.getPlayer(this.config.targetPlayerId);

      // Target is dead or gone - immediately disengage
      if (!targetPlayer || targetPlayer.health.current <= 0) {
        this.clearTargetAndExitCombat();
      }
    }

    // ===== TICK-ALIGNED AI UPDATE =====
    // Only run AI once per server tick (600ms), not every frame (~16ms)
    // This aligns with OSRS tick system and prevents excessive movement requests
    //
    // world.currentTick is set by ServerNetwork's TickSystem at the start of each tick
    // On client, currentTick is always 0, so AI won't run (client mobs are visual only)
    const currentTick = this.world.currentTick;
    if (currentTick === this._lastAITick) {
      // Same tick as last AI update - skip AI processing
      // This saves ~59 out of 60 AI updates per second
      return;
    }
    this._lastAITick = currentTick;

    // Update AI state machine (now runs once per tick instead of every frame)
    this.aiStateMachine.update(this.createAIContext(), deltaTime);

    // Sync config.aiState with AI state machine current state
    this.config.aiState = this.aiStateMachine.getCurrentState();
  }

  /**
   * Map AI state to emote URL for VRM animations
   */
  private getEmoteForAIState(aiState: MobAIState): string {
    switch (aiState) {
      case MobAIState.WANDER:
      case MobAIState.CHASE:
        return Emotes.WALK;
      case MobAIState.ATTACK:
        // Return IDLE for attack state - CombatSystem handles one-shot attack animations
        // This prevents AI from continuously looping the combat animation
        return Emotes.IDLE;
      case MobAIState.RETURN:
        return Emotes.WALK; // Walk back to spawn
      case MobAIState.DEAD:
        return Emotes.DEATH; // Death animation
      case MobAIState.IDLE:
      default:
        return Emotes.IDLE;
    }
  }

  /**
   * Switch animation based on AI state
   */
  private updateAnimation(): void {
    // VRM path: Use emote-based animation
    if (this._avatarInstance) {
      const targetEmote = this.getEmoteForAIState(this.config.aiState);
      if (this._currentEmote !== targetEmote) {
        this._currentEmote = targetEmote;
        this._avatarInstance.setEmote(targetEmote);
      }
      return;
    }

    // GLB path: Use mixer-based animation
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    const clips = (
      this as {
        animationClips?: {
          idle?: THREE.AnimationClip;
          walk?: THREE.AnimationClip;
        };
      }
    ).animationClips;
    const currentAction = (this as { currentAction?: THREE.AnimationAction })
      .currentAction;

    if (!mixer || !clips) {
      return;
    }

    // Determine which animation should be playing based on AI state
    let targetClip: THREE.AnimationClip | undefined;

    if (
      this.config.aiState === MobAIState.WANDER ||
      this.config.aiState === MobAIState.CHASE ||
      this.config.aiState === MobAIState.RETURN
    ) {
      // Moving states - play walk animation
      targetClip = clips.walk || clips.idle;
    } else {
      // Idle, attack, or dead - play idle animation
      targetClip = clips.idle || clips.walk;
    }

    // Switch animation if needed
    if (targetClip && currentAction?.getClip() !== targetClip) {
      currentAction?.fadeOut(0.2);
      const newAction = mixer.clipAction(targetClip);
      newAction.reset();
      newAction.setLoop(THREE.LoopRepeat, Infinity); // Loop animation indefinitely
      newAction.fadeIn(0.2).play();
      (this as { currentAction?: THREE.AnimationAction }).currentAction =
        newAction;
    }
  }

  /**
   * CLIENT-SIDE UPDATE
   * Handles visual updates: animations, interpolation, and rendering
   * Position and AI state are synced from server via modify()
   */
  private clientUpdateCalls = 0;
  private initialBonePosition: THREE.Vector3 | null = null;

  // Track when death animation started on client (in Date.now() milliseconds)
  private clientDeathStartTime: number | null = null;

  /**
   * Override health bar rendering to show 0 during death animation
   * This is the production-ready solution - handle death in UI layer, not network layer
   */
  protected override updateHealthBar(): void {
    if (!this.healthSprite) {
      return;
    }

    // CRITICAL: Show 0 health during death animation regardless of actual health value
    // This prevents health bar from showing server respawn health during client-side death animation
    const displayHealth = this.deathManager.isCurrentlyDead() ? 0 : this.health;

    const healthCanvas = UIRenderer.createHealthBar(
      displayHealth,
      this.maxHealth,
      {
        width: GAME_CONSTANTS.UI.HEALTH_BAR_WIDTH,
        height: GAME_CONSTANTS.UI.HEALTH_BAR_HEIGHT,
      },
    );

    UIRenderer.updateSpriteTexture(this.healthSprite, healthCanvas);
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    this.clientUpdateCalls++;

    // Hide health bar after combat timeout (RuneScape pattern: 4.8 seconds)
    if (this.healthSprite && this._healthBarVisibleUntil > 0) {
      if (Date.now() >= this._healthBarVisibleUntil) {
        this.healthSprite.visible = false;
        this._healthBarVisibleUntil = 0;
      }
    }

    // Handle dead state on client (hide mesh and stop VRM animation after death animation)
    if (this.config.aiState === MobAIState.DEAD) {
      // Start tracking client-side death time when we first see DEAD state
      if (!this.clientDeathStartTime) {
        this.clientDeathStartTime = Date.now();
      }

      const currentTime = Date.now();
      const timeSinceDeath = currentTime - this.clientDeathStartTime;

      // Hide mesh and VRM after death animation finishes (4.5 seconds = 4500ms)
      if (timeSinceDeath >= 4500) {
        // Hide the mesh
        if (this.mesh && this.mesh.visible) {
          this.mesh.visible = false;
        }
        // Hide the node (contains VRM scene)
        if (this.node && this.node.visible) {
          this.node.visible = false;
        }
        // CRITICAL: Stop the VRM animation mixer by clearing the emote
        // This prevents the death animation from looping
        if (this._avatarInstance && this._currentEmote === Emotes.DEATH) {
          this._currentEmote = ""; // Clear emote to stop mixer
          this._avatarInstance.setEmote(""); // Stop animation playback
          this._manualEmoteOverrideUntil = 0; // Clear override
        }
        // Skip all further updates while dead and invisible
        return;
      }
    } else {
      // Not dead anymore - this is handled in modify() when state changes
      // No need for duplicate logic here
    }

    // VRM path: Use avatar instance update (handles everything)
    if (this._avatarInstance) {
      // CRITICAL: Don't switch emotes while in DEAD state
      // The death animation was already set via server emote, just let it play
      // After 4.5s the node will be hidden above
      if (this.config.aiState !== MobAIState.DEAD) {
        // Skip AI-based emote updates if manual override is active (for one-shot attack animations)
        const now = Date.now();
        if (now >= this._manualEmoteOverrideUntil) {
          // Switch animation based on AI state (walk when patrolling/chasing, idle otherwise)
          const targetEmote = this.getEmoteForAIState(this.config.aiState);
          if (this._currentEmote !== targetEmote) {
            this._currentEmote = targetEmote;
            this._avatarInstance.setEmote(targetEmote);
          }
        }
      }

      // COMBAT ROTATION: Rotate to face target when in ATTACK state (RuneScape-style)
      // BUT: Only apply combat rotation when NOT moving via tile movement
      // TileInterpolator handles rotation when entity is walking/running
      const isTileMoving = this.data.tileMovementActive === true;
      if (
        !isTileMoving &&
        this.config.aiState === MobAIState.ATTACK &&
        this.config.targetPlayerId
      ) {
        const targetPlayer = this.world.getPlayer?.(this.config.targetPlayerId);
        if (targetPlayer && targetPlayer.position) {
          const dx = targetPlayer.position.x - this.position.x;
          const dz = targetPlayer.position.z - this.position.z;
          let angle = Math.atan2(dx, dz);

          // VRM 1.0+ models have 180° base rotation, so we need to compensate
          // Otherwise entities face AWAY from each other instead of towards
          angle += Math.PI;

          // Apply rotation to node quaternion
          const tempQuat = new THREE.Quaternion();
          tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          this.node.quaternion.copy(tempQuat);
        }
      }

      // If mob is dead, lock position to prevent death animation from sliding
      const lockedPos = this.deathManager.getLockedPosition();
      if (lockedPos) {
        this.node.position.copy(lockedPos);
        this.position.copy(lockedPos);
      } else {
        // CRITICAL: Snap to terrain EVERY frame (server doesn't have terrain system)
        // Keep trying until terrain tile is generated, then snap every frame
        // This also counteracts VRM animation root motion that would push character into ground
        const terrain = this.world.getSystem("terrain");
        if (terrain && "getHeightAt" in terrain) {
          try {
            // CRITICAL: Must call method on terrain object to preserve 'this' context
            const terrainHeight = (
              terrain as { getHeightAt: (x: number, z: number) => number }
            ).getHeightAt(this.node.position.x, this.node.position.z);
            if (Number.isFinite(terrainHeight)) {
              this._hasValidTerrainHeight = true;
              this.node.position.y = terrainHeight + 0.1;
              this.position.y = terrainHeight + 0.1;
            }
          } catch (err) {
            // Terrain tile not generated yet - keep current Y and retry next frame
            if (this.clientUpdateCalls === 10 && !this._hasValidTerrainHeight) {
              console.warn(
                `[MobEntity] Waiting for terrain tile to generate at (${this.node.position.x.toFixed(1)}, ${this.node.position.z.toFixed(1)})`,
              );
            }
          }
        }
      }

      // Update node transform matrices
      // NOTE: ClientNetwork updates XZ from server, we calculate Y from client terrain
      this.node.updateMatrix();
      this.node.updateMatrixWorld(true);

      // SPECIAL HANDLING FOR DEATH: Lock position, let animation play
      const deathLockedPos = this.deathManager.getLockedPosition();
      if (deathLockedPos) {
        // Lock the node position to death position (prevents teleporting)
        this.node.position.copy(deathLockedPos);
        this.position.copy(deathLockedPos);
        this.node.updateMatrix();
        this.node.updateMatrixWorld(true);

        // DON'T call move() - it causes sliding due to internal interpolation
        // VRM scene was positioned once in modify() when entering death state
        // Just update the animation, VRM scene stays locked
        this._avatarInstance.update(deltaTime);
      } else {
        // NORMAL PATH: Use move() to sync VRM - it preserves the VRM's internal scale
        // move() applies vrm.scene.scale to maintain height normalization
        this._avatarInstance.move(this.node.matrixWorld);

        // Update VRM animations (mixer + humanoid + skeleton)
        this._avatarInstance.update(deltaTime);
      }

      // Post-animation position locking for non-death states
      if (this.config.aiState !== MobAIState.DEAD) {
        // CRITICAL: Re-snap to terrain AFTER animation update to counteract root motion
        // Animation root motion can push character down/back, so we fix position after it applies
        const terrain = this.world.getSystem("terrain");
        if (terrain && "getHeightAt" in terrain) {
          try {
            const terrainHeight = (
              terrain as { getHeightAt: (x: number, z: number) => number }
            ).getHeightAt(this.node.position.x, this.node.position.z);
            if (Number.isFinite(terrainHeight)) {
              this.node.position.y = terrainHeight + 0.1;
              this.position.y = terrainHeight + 0.1;

              // CRITICAL: Update matrices and call move() again to apply corrected Y position to VRM
              this.node.updateMatrix();
              this.node.updateMatrixWorld(true);
              this._avatarInstance.move(this.node.matrixWorld);
            }
          } catch (err) {
            // Terrain tile not generated yet
          }
        }
      }

      // VRM handles all animation internally
      return;
    }

    // GLB path: Existing animation code for non-VRM mobs
    // Update animations based on AI state
    this.updateAnimation();

    // Update animation mixer
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;

    // EXPECT: Mixer should exist after animations loaded
    if (this.clientUpdateCalls === 10 && !mixer) {
      throw new Error(
        `[MobEntity] NO MIXER on update #10: ${this.config.mobType}`,
      );
    }

    if (mixer) {
      mixer.update(deltaTime);

      // Update skeleton bones
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            const skeleton = child.skeleton;

            // Update bone matrices
            skeleton.bones.forEach((bone) => bone.updateMatrixWorld());
            skeleton.update();

            // VALIDATION: Check if bones are actually transforming
            if (this.clientUpdateCalls === 1) {
              const hipsBone = skeleton.bones.find((b) =>
                b.name.toLowerCase().includes("hips"),
              );
              if (hipsBone) {
                this.initialBonePosition = hipsBone.position.clone();
              }
            } else if (this.clientUpdateCalls === 60) {
              const hipsBone = skeleton.bones.find((b) =>
                b.name.toLowerCase().includes("hips"),
              );
              if (hipsBone && this.initialBonePosition) {
                const distance = hipsBone.position.distanceTo(
                  this.initialBonePosition,
                );
                if (distance < 0.001) {
                  throw new Error(
                    `[MobEntity] BONES NOT MOVING: ${this.config.mobType}\n` +
                      `  Start: [${this.initialBonePosition.toArray().map((v) => v.toFixed(4))}]\n` +
                      `  Now: [${hipsBone.position.toArray().map((v) => v.toFixed(4))}]\n` +
                      `  Distance: ${distance.toFixed(6)} (need > 0.001)\n` +
                      `  Mixer time: ${mixer.time.toFixed(2)}s\n` +
                      `  Animation runs but doesn't affect bones!`,
                  );
                }
              }
            }
          }
        });
      }
    }
  }

  /**
   * Calculate 2D horizontal distance (XZ plane only, ignoring Y)
   * Used for spawn/wander radius checks to avoid Y-axis terrain height issues
   */
  private getDistance2D(point: Position3D): number {
    const pos = this.getPosition();
    const dx = pos.x - point.x;
    const dz = pos.z - point.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  takeDamage(damage: number, attackerId?: string): boolean {
    // ===== COMPONENT-BASED DAMAGE HANDLING =====

    // Already dead - ignore damage
    if (this.deathManager.isCurrentlyDead()) {
      return false;
    }

    // Enter combat (prevents safety teleport while fighting)
    this.combatManager.enterCombat(attackerId);

    // Apply damage
    this.config.currentHealth = Math.max(0, this.config.currentHealth - damage);

    // Sync all health fields (single source of truth)
    this.setHealth(this.config.currentHealth);
    this.setProperty("health", {
      current: this.config.currentHealth,
      max: this.config.maxHealth,
    });

    // Update health bar visual (setHealth already does this, but ensure it's called)
    this.updateHealthBar();

    // Update userData for mesh
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.mobData) {
        userData.mobData.health = this.config.currentHealth;
      }
    }

    // COMBAT_DAMAGE_DEALT is emitted by CombatSystem - no need to emit here
    // to avoid duplicate damage splats

    // Check if mob died
    if (this.config.currentHealth <= 0) {
      this.die();
      return true; // Mob died
    } else {
      // Become aggressive towards attacker (use AggroManager for target management)
      if (attackerId && !this.config.targetPlayerId) {
        this.config.targetPlayerId = attackerId;
        this.aggroManager.setTargetIfNone(attackerId);
        this.aiStateMachine.forceState(
          MobAIState.CHASE,
          this.createAIContext(),
        );
      }
    }

    this.markNetworkDirty();
    return false; // Mob survived
  }

  die(): void {
    // ===== COMPONENT-BASED DEATH HANDLING =====

    // Use Date.now() for consistent millisecond timing (world.getTime() has inconsistent units)
    const currentTime = Date.now();
    const deathPosition = this.getPosition();

    // Delegate death logic to DeathStateManager (position locking, death animation timing)
    this.deathManager.die(deathPosition, currentTime);

    // Start respawn timer with RespawnManager (TICK-BASED - generates NEW random spawn point - NOT death location!)
    // Uses server tick for OSRS-accurate timing
    this.respawnManager.startRespawnTimer(
      this.world.currentTick,
      deathPosition,
    );

    // Update config state for network sync
    this.config.aiState = MobAIState.DEAD;
    this.config.deathTime = currentTime;
    this.config.targetPlayerId = null;
    this.config.currentHealth = 0;

    // Clear aggro target
    this.aggroManager.clearTarget();

    // Update base health property for isDead() check
    this.setHealth(0);

    // CRITICAL FIX FOR ISSUE #269: Don't end combat immediately when mob dies
    // Let combat timeout naturally after 4.8 seconds (8 ticks) to keep health bars visible
    // This matches RuneScape behavior where combat state persists briefly after death
    // CombatSystem.handleEntityDied() already removes the dead mob's combat state
    // The attacker's combat will timeout naturally via the 4.8 second timer
    //
    // NOTE: Issue #275 fix (not resetting target's emote) is still preserved because
    // we're not calling endCombat() at all - the emote will finish naturally

    // Play death animation via server emote broadcast
    this.setServerEmote(Emotes.DEATH);

    // Mark for network update to sync death state to clients
    this.markNetworkDirty();

    // Emit death event with last attacker
    const lastAttackerId = this.combatManager.getLastAttackerId();
    if (lastAttackerId) {
      this.world.emit(EventType.NPC_DIED, {
        mobId: this.id,
        mobType: this.config.mobType,
        level: this.config.level,
        killedBy: lastAttackerId,
        position: this.getPosition(),
      });

      // Emit COMBAT_KILL event for SkillsSystem to grant combat XP
      // Get the player's actual attack style from PlayerSystem
      const playerSystem = this.world.getSystem("player") as {
        getPlayerAttackStyle?: (playerId: string) => { id: string } | null;
      } | null;
      const attackStyleData =
        playerSystem?.getPlayerAttackStyle?.(lastAttackerId);
      const attackStyle = attackStyleData?.id || "aggressive"; // Default to aggressive if not found

      this.world.emit(EventType.COMBAT_KILL, {
        attackerId: lastAttackerId,
        targetId: this.id,
        damageDealt: this.config.maxHealth,
        attackStyle: attackStyle,
      });

      this.dropLoot(lastAttackerId);
    } else {
      console.warn(`[MobEntity] ${this.id} died but no lastAttackerId found`);
    }
  }

  private dropLoot(killerId: string): void {
    if (!this.config.lootTable.length) return;

    for (const lootItem of this.config.lootTable) {
      if (Math.random() < lootItem.chance) {
        const quantity =
          Math.floor(
            Math.random() * (lootItem.maxQuantity - lootItem.minQuantity + 1),
          ) + lootItem.minQuantity;

        this.world.emit(EventType.ITEM_SPAWN, {
          itemId: lootItem.itemId,
          quantity,
          position: this.getPosition(),
          droppedBy: killerId,
        });
      }
    }
  }

  private generatePatrolPoints(): void {
    // Use CURRENT spawn point (changes on respawn), not fixed config.spawnPoint
    const spawnPos = this._currentSpawnPoint;
    const patrolRadius = 5; // 5 meter patrol radius

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = spawnPos.x + Math.cos(angle) * patrolRadius;
      const z = spawnPos.z + Math.sin(angle) * patrolRadius;
      this.patrolPoints.push({ x, z });
    }
  }

  private moveTowardsTarget(targetPos: Position3D, deltaTime: number): void {
    const currentPos = this.getPosition();
    const direction = {
      x: targetPos.x - currentPos.x,
      y: 0,
      z: targetPos.z - currentPos.z,
    };

    const length = Math.sqrt(
      direction.x * direction.x + direction.z * direction.z,
    );
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;

      const moveDistance = this.config.moveSpeed * deltaTime;
      let newPos = {
        x: currentPos.x + direction.x * moveDistance,
        y: currentPos.y,
        z: currentPos.z + direction.z * moveDistance,
      };

      // Snap to terrain height (only if terrain system is ready)
      const terrain = this.world.getSystem("terrain");
      if (terrain && "getHeightAt" in terrain) {
        try {
          // CRITICAL: Must call method on terrain object to preserve 'this' context
          const terrainHeight = (
            terrain as { getHeightAt: (x: number, z: number) => number }
          ).getHeightAt(newPos.x, newPos.z);
          if (Number.isFinite(terrainHeight)) {
            newPos.y = terrainHeight + 0.1;
          } else if (!this._terrainWarningLogged) {
            console.warn(
              `[MobEntity] Server terrain height not finite at (${newPos.x.toFixed(1)}, ${newPos.z.toFixed(1)})`,
            );
            this._terrainWarningLogged = true;
          }
        } catch (err) {
          if (!this._terrainWarningLogged) {
            console.warn(`[MobEntity] Server terrain getHeightAt failed:`, err);
            this._terrainWarningLogged = true;
          }
        }
      } else if (!this._terrainWarningLogged) {
        console.warn(`[MobEntity] Server has no terrain system`);
        this._terrainWarningLogged = true;
      }

      // Calculate rotation to face movement direction
      // VRM 1.0+ models are rotated 180° by the factory (see createVRMFactory.ts:264)
      // so we need to add PI to compensate and face the correct direction
      const angle = Math.atan2(direction.x, direction.z) + Math.PI;
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);

      // Smoothly rotate towards target direction
      this.node.quaternion.slerp(targetQuaternion, 0.1);

      // Stuck detection: Only check when actively moving (RuneScape-style: give up if stuck)
      // This prevents false positives during IDLE and ATTACK states
      const isMovingState =
        this.config.aiState === MobAIState.WANDER ||
        this.config.aiState === MobAIState.CHASE ||
        this.config.aiState === MobAIState.RETURN;

      if (isMovingState) {
        if (this._lastPosition) {
          const moved = this.position.distanceTo(this._lastPosition);
          if (moved < 0.01) {
            // Barely moved - increment stuck timer
            this._stuckTimer += deltaTime;
            if (this._stuckTimer > this.STUCK_TIMEOUT) {
              // Stuck for too long - give up and return home (production safety)
              console.warn(
                `[MobEntity] ${this.config.mobType} stuck for ${(this.STUCK_TIMEOUT / 1000).toFixed(1)}s at (${currentPos.x.toFixed(1)}, ${currentPos.z.toFixed(1)}), returning to spawn`,
              );
              this.config.aiState = MobAIState.RETURN;
              this.config.targetPlayerId = null;
              this.aggroManager.clearTarget();
              this._wanderTarget = null;
              this._stuckTimer = 0;
              this._lastPosition = null;
              this.markNetworkDirty();
              return;
            }
          } else {
            // Moving normally - reset stuck timer
            this._stuckTimer = 0;
          }
        }
        this._lastPosition = this.position.clone();
      }

      // Update position (will be synced to clients via network)
      this.setPosition(newPos.x, newPos.y, newPos.z);
      this.markNetworkDirty();
    }
  }

  /**
   * Find nearby player within aggro range (RuneScape-style)
   * Delegates to AggroManager component
   */
  private findNearbyPlayer(): { id: string; position: Position3D } | null {
    const currentPos = this.getPosition();
    const players = this.world.getPlayers();
    return this.aggroManager.findNearbyPlayer(currentPos, players);
  }

  /**
   * Get player by ID (delegates to AggroManager)
   */
  private getPlayer(
    playerId: string,
  ): { id: string; position: Position3D } | null {
    return this.aggroManager.getPlayer(playerId, (id) =>
      this.world.getPlayer(id),
    );
  }

  /**
   * Clear current target and exit combat (called when target dies or becomes invalid)
   * RuneScape-style: Mob immediately disengages and returns to spawn area
   */
  private clearTargetAndExitCombat(): void {
    // Clear target
    this.config.targetPlayerId = null;
    this.aggroManager.clearTarget();

    // Exit combat state
    this.combatManager.exitCombat();

    // Force AI to WANDER (return to spawn behavior)
    const context = this.createAIContext();
    this.aiStateMachine.forceState(MobAIState.WANDER, context);
  }

  /**
   * Called by CombatSystem when this mob's current target dies
   * Resets combat state so mob can immediately attack new targets (e.g., respawned player)
   * @param targetId - ID of the target that died (for validation)
   */
  onTargetDied(targetId: string): void {
    // Only reset if this was actually our target
    if (this.config.targetPlayerId === targetId) {
      console.log(
        `[MobEntity] ${this.id} target ${targetId} died, resetting combat state`,
      );
      this.clearTargetAndExitCombat();
    }
  }

  // Map internal AI states to interface expected states (RuneScape-style)
  private mapAIStateToInterface(
    internalState: string,
  ): "idle" | "wander" | "chase" | "attack" | "return" | "dead" {
    // Direct mapping - internal states match interface states
    return (
      (internalState as
        | "idle"
        | "wander"
        | "chase"
        | "attack"
        | "return"
        | "dead") || "idle"
    );
  }

  // Get mob data for systems
  getMobData(): MobEntityData {
    return {
      id: this.id,
      name: this.config.name,
      type: this.config.mobType,
      level: this.config.level,
      health: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      attackPower: this.config.attackPower,
      defense: this.config.defense,
      xpReward: this.config.xpReward,
      aiState: this.mapAIStateToInterface(this.config.aiState),
      targetPlayerId: this.config.targetPlayerId || null,
      spawnPoint: this.config.spawnPoint,
      position: this.getPosition(),
    };
  }

  // Override serialize to include model path for client
  override serialize(): EntityData {
    const baseData = super.serialize();
    return {
      ...baseData,
      model: this.config.model, // CRITICAL: Include model path for client VRM loading
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId,
    };
  }

  // Network data override
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();

    // ===== COMPONENT-BASED NETWORK SYNC =====

    // Handle death state separately
    if (this.deathManager.isCurrentlyDead()) {
      // Remove ALL position data from baseData
      delete baseData.x;
      delete baseData.y;
      delete baseData.z;
      delete baseData.p;
      delete baseData.position;

      const networkData: Record<string, unknown> = {
        ...baseData,
        model: this.config.model,
        mobType: this.config.mobType,
        level: this.config.level,
        currentHealth: this.config.currentHealth,
        maxHealth: this.config.maxHealth,
        aiState: this.config.aiState,
        targetPlayerId: this.config.targetPlayerId,
        deathTime: this.deathManager.getDeathTime(),
      };

      // Send death emote once
      if (this._serverEmote) {
        networkData.e = this._serverEmote;
        this._serverEmote = null;
      }

      // ALWAYS send death position when dead (handles packet loss, late-joining clients)
      // Previously only sent once, but clients would miss it and use wrong position
      const deathPos = this.deathManager.getDeathPosition();
      if (deathPos) {
        networkData.p = [deathPos.x, deathPos.y, deathPos.z];
        this.deathManager.markDeathStateSent();
      }

      return networkData;
    }

    // Normal path for living mobs
    const networkData: Record<string, unknown> = {
      ...baseData,
      model: this.config.model,
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId,
    };

    // CRITICAL: Force position to be included if not present
    // Parent class may omit position to save bandwidth, but we always need it for mobs
    if (!networkData.p || !Array.isArray(networkData.p)) {
      const pos = this.getPosition();
      networkData.p = [pos.x, pos.y, pos.z];
    }

    // Only broadcast server-forced emotes
    if (this._serverEmote) {
      networkData.e = this._serverEmote;
      this._serverEmote = null;
    }

    // Clear respawn flag after first network sync
    if (this._justRespawned) {
      this._justRespawned = false;
    }

    return networkData;
  }

  /**
   * Set a one-shot emote from server (e.g., combat animation)
   * This will be broadcast once, then cleared automatically
   */
  setServerEmote(emote: string): void {
    this._serverEmote = emote;
    this.markNetworkDirty();
  }

  /**
   * Override modify to handle network updates from server
   */
  override modify(data: Partial<EntityData>): void {
    // ===== COMPONENT-BASED CLIENT-SIDE NETWORK UPDATES =====

    // Handle AI state changes
    if ("aiState" in data) {
      const newState = data.aiState as MobAIState;

      // If entering DEAD state on client, lock position to CURRENT VISUAL position
      if (
        newState === MobAIState.DEAD &&
        !this.deathManager.isCurrentlyDead()
      ) {
        // CRITICAL: Clear the death timer so clientUpdate() can set a fresh timestamp
        // Without this, stale timestamps from previous deaths cause immediate reset
        this.clientDeathStartTime = null;

        // CRITICAL: Use current VISUAL position (this.position), NOT server position (data.p)
        // TileInterpolator may be mid-interpolation, showing the mob at a different location
        // than the server's authoritative position. The mob should die WHERE THE PLAYER SEES IT,
        // not teleport to the server position. This matches RS3's smooth movement philosophy.
        const visualDeathPos = new THREE.Vector3(
          this.position.x,
          this.position.y,
          this.position.z,
        );
        this.deathManager.applyDeathPositionFromServer(visualDeathPos);

        // Clear TileInterpolator control flag so it stops updating this entity
        this.data.tileInterpolatorControlled = false;

        // Position VRM scene at current visual position for death animation
        if (this._avatarInstance) {
          this.node.updateMatrix();
          this.node.updateMatrixWorld(true);
          this._avatarInstance.move(this.node.matrixWorld);
        }
      }

      // CRITICAL: ALWAYS check if death manager should be reset (not just on state change!)
      // Server might send multiple updates with same state (aiState=idle, idle, idle...)
      // We need to reset death manager on ANY update where server says NOT DEAD
      // BUT: Don't reset until death animation is complete (4.5 seconds)
      const deathManagerDead = this.deathManager.isCurrentlyDead();

      if (newState !== MobAIState.DEAD && deathManagerDead) {
        // Check if death animation has finished (4.5 seconds)
        const deathAnimationDuration = 4500;

        // CRITICAL: If clientDeathStartTime is null, death just happened but
        // clientUpdate() hasn't run yet to set the timestamp. DON'T reset in this case!
        if (this.clientDeathStartTime) {
          const timeSinceDeath = Date.now() - this.clientDeathStartTime;

          if (timeSinceDeath >= deathAnimationDuration) {
            // Death animation is complete, safe to reset
            this.clientDeathStartTime = null;
            this.deathManager.reset();

            // CRITICAL: Snap position immediately to server's new spawn point
            // This prevents interpolation from starting at death location
            if ("p" in data && Array.isArray(data.p) && data.p.length === 3) {
              const spawnPos = data.p as [number, number, number];
              this.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
              this.node.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
              console.log(
                `[MobEntity] [CLIENT] 🔄 Snapped ${this.id} to respawn position (${spawnPos[0].toFixed(2)}, ${spawnPos[1].toFixed(2)}, ${spawnPos[2].toFixed(2)})`,
              );
            }

            // Mark that we need to restore visibility AFTER position update
            (this as any)._pendingRespawnRestore = true;
          }
        }
      }

      this.config.aiState = newState;
    }

    // Update health from server
    if ("currentHealth" in data) {
      const newHealth = data.currentHealth as number;

      // Show health bar when damaged (RuneScape pattern)
      // Only show if health decreased (took damage), not on heal/respawn
      if (newHealth < this._lastKnownHealth && this.healthSprite) {
        this.healthSprite.visible = true;
        this._healthBarVisibleUntil =
          Date.now() + COMBAT_CONSTANTS.COMBAT_TIMEOUT_MS;
      }
      this._lastKnownHealth = newHealth;

      this.config.currentHealth = newHealth;
      this.setHealth(newHealth);
    }

    // Update max health from server
    if ("maxHealth" in data) {
      const newMaxHealth = data.maxHealth as number;
      this.config.maxHealth = newMaxHealth;
      this.maxHealth = newMaxHealth;
      // Update entity data for consistency
      (this.data as { maxHealth?: number }).maxHealth = newMaxHealth;
      // Refresh health bar to show updated max health
      this.updateHealthBar();
    }

    // Update target from server
    if ("targetPlayerId" in data) {
      this.config.targetPlayerId = data.targetPlayerId as string | null;
    }

    // Update death time from server
    if ("deathTime" in data) {
      this.config.deathTime = data.deathTime as number | null;
      this.deathManager.setDeathTime(data.deathTime as number | null);
    }

    // Handle emote from server (like PlayerRemote does)
    if ("e" in data && data.e !== undefined && this._avatarInstance) {
      const serverEmote = data.e as string;

      // Map symbolic emote names to asset URLs (same as PlayerRemote)
      let emoteUrl: string;
      if (serverEmote.startsWith("asset://")) {
        emoteUrl = serverEmote;
      } else {
        const emoteMap: Record<string, string> = {
          idle: Emotes.IDLE,
          walk: Emotes.WALK,
          run: Emotes.RUN,
          combat: Emotes.COMBAT,
          death: Emotes.DEATH,
        };
        emoteUrl = emoteMap[serverEmote] || Emotes.IDLE;
      }

      if (this._currentEmote !== emoteUrl) {
        this._currentEmote = emoteUrl;
        this._avatarInstance.setEmote(emoteUrl);

        // Set override durations for one-shot animations
        if (emoteUrl.includes("combat") || emoteUrl.includes("punching")) {
          this._manualEmoteOverrideUntil = Date.now() + 700; // 700ms for combat animation
        } else if (emoteUrl.includes("death")) {
          this._manualEmoteOverrideUntil = Date.now() + 4500; // 4500ms for full death animation (4.5 seconds)
        } else if (emoteUrl.includes("idle")) {
          this._manualEmoteOverrideUntil = 0; // Clear override when reset to idle
        }
      }
    }

    // ===== POSITION HANDLING =====
    // The base Entity.modify() does NOT handle position - we must do it here
    // Handle position for living mobs (non-death, non-respawn cases)
    // Death/respawn position is handled above in the aiState logic
    if (!this.deathManager.shouldLockPosition()) {
      // Check if TileInterpolator is controlling position - if so, skip position updates
      // TileInterpolator handles position smoothly for tile-based movement
      // This prevents entityModified packets from overriding smooth interpolation
      const tileControlled = this.data.tileInterpolatorControlled === true;
      if (!tileControlled) {
        // Not dead and not tile-controlled - apply position updates from server
        if ("p" in data && Array.isArray(data.p) && data.p.length === 3) {
          const pos = data.p as [number, number, number];
          this.position.set(pos[0], pos[1], pos[2]);
          this.node.position.set(pos[0], pos[1], pos[2]);
        }
      }
    } else {
      // Dead - enforce locked position (defense in depth)
      const lockedPos = this.deathManager.getLockedPosition();
      if (lockedPos) {
        this.node.position.copy(lockedPos);
        this.position.copy(lockedPos);
      }
    }

    // Call parent modify for standard properties (non-transform data like entity data)
    // Strip position from data since we handled it above
    const dataWithoutPosition = { ...data };
    delete dataWithoutPosition.p;
    delete dataWithoutPosition.x;
    delete dataWithoutPosition.y;
    delete dataWithoutPosition.z;
    delete dataWithoutPosition.position;
    super.modify(dataWithoutPosition);

    // CRITICAL: Restore visibility AFTER position has been updated from server
    // This ensures VRM is moved to the correct spawn location, not death location
    if ((this as any)._pendingRespawnRestore) {
      (this as any)._pendingRespawnRestore = false;

      // CRITICAL: Update client's _currentSpawnPoint to match new position from server
      // This ensures client and server are in sync (defense in depth)
      this._currentSpawnPoint = {
        x: this.node.position.x,
        y: this.node.position.y,
        z: this.node.position.z,
      };

      // Restore node visibility
      if (this.node && !this.node.visible) {
        this.node.visible = true;
      }

      // Restore mesh visibility
      if (this.mesh && !this.mesh.visible) {
        this.mesh.visible = true;
      }

      // Update health bar now that mesh is visible again
      // This ensures the health bar shows the correct health after respawn
      this.setHealth(this.config.currentHealth);

      // Reset VRM animation and move to UPDATED position (from server)
      if (this._avatarInstance) {
        this._currentEmote = Emotes.IDLE;
        this._avatarInstance.setEmote(Emotes.IDLE);
        this._manualEmoteOverrideUntil = 0;

        // Position has been updated above in the position handling section
        // So this.node.position is the NEW spawn point from server, not death location
        this.node.updateMatrix();
        this.node.updateMatrixWorld(true);
        this._avatarInstance.move(this.node.matrixWorld);
      }
    }
  }

  /**
   * Override destroy to clean up animations
   */
  override destroy(): void {
    // Unregister entity from hot updates
    this.world.setHot(this, false);

    // Clean up VRM instance
    if (this._avatarInstance) {
      this._avatarInstance.destroy();
      this._avatarInstance = null;
    }

    // Clean up animation mixer (for GLB models)
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      mixer.stopAllAction();
      (this as { mixer?: THREE.AnimationMixer }).mixer = undefined;
    }

    // Parent will handle mesh removal (mesh is child of node)
    super.destroy();
  }
}
