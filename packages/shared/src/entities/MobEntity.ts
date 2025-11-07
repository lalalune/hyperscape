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

import THREE from '../extras/three';
import type { EntityData, MeshUserData, MobEntityData, Position3D } from '../types';
import { AttackType } from '../types/core';
import type {
  EntityInteractionData,
  MobEntityConfig
} from '../types/entities';
import {
  MobAIState
} from '../types/entities';
import { EventType } from '../types/events';
import type { World } from '../World';
import { CombatantEntity, type CombatantConfig } from './CombatantEntity';
import { modelCache } from '../utils/ModelCache';
import type { EntityManager } from '../systems/EntityManager';
import type { VRMAvatarInstance, LoadedAvatar, AvatarHooks } from '../types/nodes';
import { Emotes } from '../extras/playerEmotes';

// Polyfill ProgressEvent for Node.js server environment
if (typeof ProgressEvent === 'undefined') {
  (globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent = class extends Event {
    lengthComputable = false;
    loaded = 0;
    total = 0;
    constructor(type: string, init?: { lengthComputable?: boolean; loaded?: number; total?: number }) {
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
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;
  private lastAttackerId: string | null = null;
  private _avatarInstance: VRMAvatarInstance | null = null;
  private _currentEmote: string | null = null;
  private _manualEmoteOverrideUntil: number = 0; // Timestamp until which manual emote override is active
  private _tempMatrix = new THREE.Matrix4();
  private _tempScale = new THREE.Vector3(1, 1, 1);
  private _terrainWarningLogged = false;
  private _hasValidTerrainHeight = false;

  // RuneScape-style AI timing and behavior
  private _idleStartTime = 0;
  private _idleDuration = 0;
  private _wanderTarget: { x: number; z: number } | null = null;
  private _lastPosition: THREE.Vector3 | null = null;
  private _stuckTimer = 0;

  // RuneScape behavior constants
  private readonly IDLE_MIN_DURATION = 3000;    // 3 seconds minimum idle
  private readonly IDLE_MAX_DURATION = 8000;    // 8 seconds maximum idle
  private readonly WANDER_MIN_DISTANCE = 1;     // Minimum wander distance
  private readonly WANDER_MAX_DISTANCE = 5;     // Maximum wander distance
  private readonly STUCK_TIMEOUT = 3000;        // Give up after 3 seconds stuck
  private readonly RETURN_TELEPORT_DISTANCE = 50; // Teleport if somehow this far from spawn

  async init(): Promise<void> {
    await super.init();

    // Register for update loop (both client and server)
    // Client: VRM animations via clientUpdate()
    // Server: AI behavior via serverUpdate()
    this.world.setHot(this, true);
    console.log(`[MobEntity] ✅ Registered entity as hot for updates (isClient: ${this.world.isClient})`);

    // TODO: Server-side validation disabled due to ProgressEvent polyfill issues
    // Validation happens on client side instead (see clientUpdate)
  }
  

  constructor(world: World, config: MobEntityConfig) {
    console.log(`[MobEntity] 🔨 Constructor called for ${config.mobType} with model: ${config.model}`);

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
        attackRange: config.combatRange
      }
    } as unknown as CombatantConfig;

    super(world, combatConfig);
    this.config = config;
    this.generatePatrolPoints();
    
    // Set entity properties for systems to access
    this.setProperty('mobType', config.mobType);
    this.setProperty('level', config.level);
    this.setProperty('health', { current: config.currentHealth, max: config.maxHealth });
    
    // Add stats component for skills system compatibility
    this.addComponent('stats', {
      // Combat stats - mobs have simplified skills
      attack: { level: Math.max(1, Math.floor(config.attackPower / 10)), xp: 0 },
      strength: { level: Math.max(1, Math.floor(config.attackPower / 10)), xp: 0 },
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
        max: config.maxHealth 
      },
      prayer: { level: 1, points: 0 }, // Mobs don't use prayer
      magic: { level: 1, xp: 0 } // Basic mobs don't use magic
    });
  }


  /**
   * Setup animations from GLB data (inline animations)
   */
  private async setupAnimations(animations: THREE.AnimationClip[]): Promise<void> {
    if (!this.mesh || animations.length === 0) {
      console.warn(`[MobEntity] Cannot setup animations - no mesh or no animations`);
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
    const animationClips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip } = {};
    
    // Categorize animations by name
    for (const clip of animations) {
      const nameLower = clip.name.toLowerCase();
      if (nameLower.includes('idle') || nameLower.includes('standing')) {
        animationClips.idle = clip;
      } else if (nameLower.includes('walk') || nameLower.includes('move')) {
        animationClips.walk = clip;
      }
    }
    
    // Default to first animation if no categorized animations found
    if (!animationClips.idle && !animationClips.walk) {
      animationClips.idle = animations[0];
    }
    
    // Play idle animation by default (or walk if idle doesn't exist)
    const initialClip = animationClips.idle || animationClips.walk || animations[0];
    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity); // Loop animation indefinitely
    action.play();
    
    // Store mixer and clips on entity
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
    (this as { animationClips?: typeof animationClips }).animationClips = animationClips;
    (this as { currentAction?: THREE.AnimationAction }).currentAction = action;
  }

  /**
   * Load VRM model and create avatar instance
   */
  private async loadVRMModel(): Promise<void> {
    console.log(`[MobEntity] 🔄 Loading VRM for ${this.config.mobType}: ${this.config.model}`);

    if (!this.world.loader) {
      console.error(`[MobEntity] ❌ No loader available for ${this.config.mobType}`);
      return;
    }

    if (!this.config.model) {
      console.error(`[MobEntity] ❌ No model path for ${this.config.mobType}`);
      return;
    }

    if (!this.world.stage?.scene) {
      console.error(`[MobEntity] ❌ No world.stage.scene available for ${this.config.mobType}`);
      return;
    }

    // Create VRM hooks with scene reference (CRITICAL for visibility!)
    const vrmHooks = {
      scene: this.world.stage.scene,
      octree: this.world.stage?.octree,
      camera: this.world.camera,
      loader: this.world.loader
    };

    console.log(`[MobEntity] 🔄 Loading avatar from loader...`);

    // Load the VRM avatar using the same loader as players
    const src = await this.world.loader.load('avatar', this.config.model) as LoadedAvatar;

    console.log(`[MobEntity] ✅ Avatar loaded, converting to nodes...`);

    // Convert to nodes
    const nodeMap = src.toNodes(vrmHooks);
    const avatarNode = nodeMap.get('avatar') || nodeMap.get('root');

    console.log(`[MobEntity] Avatar node keys:`, Array.from(nodeMap.keys()));

    if (!avatarNode) {
      console.error(`[MobEntity] ❌ No avatar node found in nodeMap`);
      return;
    }

    // Get the factory from the avatar node
    const avatarNodeWithFactory = avatarNode as { factory?: { create: (matrix: THREE.Matrix4, hooks?: unknown) => VRMAvatarInstance } };

    if (!avatarNodeWithFactory?.factory) {
      console.error(`[MobEntity] ❌ No factory found on avatar node for ${this.config.mobType}`);
      return;
    }

    console.log(`[MobEntity] 🔄 Creating VRM instance from factory...`);

    // Update our node's transform
    this.node.updateMatrix();
    this.node.updateMatrixWorld(true);

    // Create the VRM instance using the factory
    this._avatarInstance = avatarNodeWithFactory.factory.create(this.node.matrixWorld, vrmHooks);

    console.log(`[MobEntity] ✅ VRM instance created`);

    // Set initial emote to idle
    this._currentEmote = Emotes.IDLE;
    this._avatarInstance.setEmote(this._currentEmote);

    // NOTE: Don't register VRM instance as hot - the MobEntity itself is registered
    // The entity's clientUpdate() will call avatarInstance.update()

    // Get the scene from the VRM instance
    const instanceWithRaw = this._avatarInstance as { raw?: { scene?: THREE.Object3D } };
    if (instanceWithRaw?.raw?.scene) {
      this.mesh = instanceWithRaw.raw.scene;
      this.mesh.name = `Mob_VRM_${this.config.mobType}_${this.id}`;

      // Set up userData for interaction detection
      const userData: MeshUserData = {
        type: 'mob',
        entityId: this.id,
        name: this.config.name,
        interactable: true,
        mobData: {
          id: this.id,
          name: this.config.name,
          type: this.config.mobType,
          level: this.config.level,
          health: this.config.currentHealth,
          maxHealth: this.config.maxHealth
        }
      };
      this.mesh.userData = { ...userData };

      // VRM instances manage their own positioning via move() - do NOT parent to node
      // The factory already added the scene to world.stage.scene
      // We'll use avatarInstance.move() to position it each frame

      console.log(`[MobEntity] ✅ Loaded VRM for ${this.config.mobType} at position:`, this.node.position.toArray());
      console.log(`[MobEntity] VRM scene parent:`, this.mesh.parent?.name || 'no parent');
      console.log(`[MobEntity] VRM scene visible:`, this.mesh.visible);
    } else {
      console.error(`[MobEntity] ❌ No scene in VRM instance for ${this.config.mobType}`);
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
    
    const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
    
    // EXPECT: Model has SkinnedMesh
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });
    
    if (!skinnedMesh) {
      throw new Error(`[MobEntity] No SkinnedMesh in model: ${this.config.mobType} (${modelPath})`);
    }
    
    // Create AnimationMixer on SkinnedMesh (required for DetachedBindMode)
    const mixer = new THREE.AnimationMixer(skinnedMesh);
    const animationClips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; run?: THREE.AnimationClip } = {};
    
    // Load animation files (load as raw GLB, not emote, to avoid bone remapping)
    const animFiles = [
      { name: 'walk', path: `${modelDir}/animations/walking.glb` },
      { name: 'run', path: `${modelDir}/animations/running.glb` }
    ];
    
    for (const { name, path } of animFiles) {
      try {
        // Load as model (not emote) to get raw animations without VRM retargeting
        const result = await modelCache.loadModel(path, this.world);
        if (result.animations && result.animations.length > 0) {
          const clip = result.animations[0];
          animationClips[name as 'walk' | 'run'] = clip;
          if (name === 'walk') animationClips.idle = clip; // Use walk as idle
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
        `  Result: idle=${!!animationClips.idle}, walk=${!!animationClips.walk}, run=${!!animationClips.run}`
      );
    }
    
    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    
    // Store mixer and clips
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
    (this as { animationClips?: typeof animationClips }).animationClips = animationClips;
    (this as { currentAction?: THREE.AnimationAction }).currentAction = action;
    
    // EXPECT: Action running after play()
    if (!action.isRunning()) {
      throw new Error(`[MobEntity] ACTION NOT RUNNING: ${this.config.mobType}`);
    }
  }

  protected async createMesh(): Promise<void> {
    console.log(`[MobEntity] 🎨 createMesh() called for ${this.config.mobType}, isServer: ${this.world.isServer}, model: ${this.config.model}`);

    if (this.world.isServer) {
      console.log(`[MobEntity] ⏭️ Skipping createMesh (server-side)`);
      return;
    }

    // Try to load 3D model if available
    if (this.config.model && this.world.loader) {
      console.log(`[MobEntity] 📦 Model and loader available, model type: ${this.config.model.endsWith('.vrm') ? 'VRM' : 'GLB'}`);
      try {
        // Check if this is a VRM file
        if (this.config.model.endsWith('.vrm')) {
          console.log(`[MobEntity] 🔄 Calling loadVRMModel()...`);
          await this.loadVRMModel();
          return;
        }

        // Otherwise load as GLB (existing code path)
        const { scene, animations } = await modelCache.loadModel(this.config.model, this.world);

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
          type: 'mob',
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          mobData: {
            id: this.id,
            name: this.config.name,
            type: this.config.mobType,
            level: this.config.level,
            health: this.config.currentHealth,
            maxHealth: this.config.maxHealth
          }
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
        console.warn(`[MobEntity] Failed to load model for ${this.config.mobType}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }
    const mobName = String(this.config.mobType).toLowerCase();
    const colorHash = mobName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      type: 'mob',
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      mobData: {
        id: this.id,
        name: this.config.name,
        type: this.config.mobType,
        level: this.config.level,
        health: this.config.currentHealth,
        maxHealth: this.config.maxHealth
      }
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
    if (data.interactionType === 'attack') {
      this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
        attackerId: data.playerId,
        targetId: this.id,
        attackerType: 'player',
        targetType: 'mob',
        attackType: AttackType.MELEE,
        position: this.getPosition()
      });
    } else {
      // Default interaction - show mob info or examine
      this.world.emit(EventType.MOB_NPC_EXAMINE, {
        playerId: data.playerId,
        mobId: this.id,
        mobData: this.getMobData()
      });
    }
  }

  /**
   * SERVER-SIDE UPDATE
   * Handles AI logic, pathfinding, combat, and state management
   * Changes are synced to clients via getNetworkData() and markNetworkDirty()
   */
  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    if (this.config.aiState !== MobAIState.DEAD) {
      this.updateAI(deltaTime);
    }
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
        return Emotes.IDLE; // Dead state doesn't need animation
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
    const clips = (this as { animationClips?: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip } }).animationClips;
    const currentAction = (this as { currentAction?: THREE.AnimationAction }).currentAction;

    if (!mixer || !clips) {
      return;
    }

    // Determine which animation should be playing based on AI state
    let targetClip: THREE.AnimationClip | undefined;

    if (this.config.aiState === MobAIState.WANDER ||
        this.config.aiState === MobAIState.CHASE ||
        this.config.aiState === MobAIState.RETURN) {
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
      (this as { currentAction?: THREE.AnimationAction }).currentAction = newAction;
    }
  }

  /**
   * CLIENT-SIDE UPDATE
   * Handles visual updates: animations, interpolation, and rendering
   * Position and AI state are synced from server via modify()
   */
  private clientUpdateCalls = 0;
  private initialBonePosition: THREE.Vector3 | null = null;
  
  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    this.clientUpdateCalls++;

    // VRM path: Use avatar instance update (handles everything)
    if (this._avatarInstance) {
      // Skip AI-based emote updates if manual override is active (for one-shot attack animations)
      const now = Date.now();
      if (now >= this._manualEmoteOverrideUntil) {
        // Switch animation based on AI state (walk when patrolling/chasing, idle otherwise)
        const targetEmote = this.getEmoteForAIState(this.config.aiState);
        if (this._currentEmote !== targetEmote) {
          console.log(`[MobEntity] Switching emote from ${this._currentEmote} to ${targetEmote} (AI state: ${this.config.aiState})`);
          this._currentEmote = targetEmote;
          this._avatarInstance.setEmote(targetEmote);
        }
      }

      // CRITICAL: Snap to terrain EVERY frame (server doesn't have terrain system)
      // Keep trying until terrain tile is generated, then snap every frame
      // EXCEPT during ATTACK state to preserve animation root motion
      const terrain = this.world.getSystem('terrain');
      if (terrain && 'getHeightAt' in terrain && this.config.aiState !== MobAIState.ATTACK) {
        try {
          // CRITICAL: Must call method on terrain object to preserve 'this' context
          const terrainHeight = (terrain as { getHeightAt: (x: number, z: number) => number }).getHeightAt(this.node.position.x, this.node.position.z);
          if (Number.isFinite(terrainHeight)) {
            if (!this._hasValidTerrainHeight) {
              console.log(`[MobEntity] First valid terrain height: ${terrainHeight.toFixed(2)} at position (${this.node.position.x.toFixed(1)}, ${this.node.position.z.toFixed(1)})`);
              this._hasValidTerrainHeight = true;
            }
            this.node.position.y = terrainHeight + 0.1;
            this.position.y = terrainHeight + 0.1;
          }
        } catch (err) {
          // Terrain tile not generated yet - keep current Y and retry next frame
          if (this.clientUpdateCalls === 10 && !this._hasValidTerrainHeight) {
            console.warn(`[MobEntity] Waiting for terrain tile to generate at (${this.node.position.x.toFixed(1)}, ${this.node.position.z.toFixed(1)})`);
          }
        }
      }

      // Update node transform matrices
      // NOTE: ClientNetwork updates XZ from server, we calculate Y from client terrain
      this.node.updateMatrix();
      this.node.updateMatrixWorld(true);

      // CRITICAL: Use move() to sync VRM - it preserves the VRM's internal scale
      // move() applies vrm.scene.scale to maintain height normalization
      this._avatarInstance.move(this.node.matrixWorld);

      // Update VRM animations (mixer + humanoid + skeleton)
      this._avatarInstance.update(deltaTime);

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
      throw new Error(`[MobEntity] NO MIXER on update #10: ${this.config.mobType}`);
    }

    if (mixer) {
      mixer.update(deltaTime);

      // Update skeleton bones
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            const skeleton = child.skeleton;

            // Update bone matrices
            skeleton.bones.forEach(bone => bone.updateMatrixWorld());
            skeleton.update();

            // VALIDATION: Check if bones are actually transforming
            if (this.clientUpdateCalls === 1) {
              const hipsBone = skeleton.bones.find(b => b.name.toLowerCase().includes('hips'));
              if (hipsBone) {
                this.initialBonePosition = hipsBone.position.clone();
              }
            } else if (this.clientUpdateCalls === 60) {
              const hipsBone = skeleton.bones.find(b => b.name.toLowerCase().includes('hips'));
              if (hipsBone && this.initialBonePosition) {
                const distance = hipsBone.position.distanceTo(this.initialBonePosition);
                if (distance < 0.001) {
                  throw new Error(
                    `[MobEntity] BONES NOT MOVING: ${this.config.mobType}\n` +
                    `  Start: [${this.initialBonePosition.toArray().map(v => v.toFixed(4))}]\n` +
                    `  Now: [${hipsBone.position.toArray().map(v => v.toFixed(4))}]\n` +
                    `  Distance: ${distance.toFixed(6)} (need > 0.001)\n` +
                    `  Mixer time: ${mixer.time.toFixed(2)}s\n` +
                    `  Animation runs but doesn't affect bones!`
                  );
                }
                console.log(`[MobEntity] ✅ Animations working: ${this.config.mobType}`);
              }
            }
          }
        });
      }
    }
  }

  private _lastLoggedState: MobAIState | null = null;
  private _stateLogCounter = 0;

  private updateAI(deltaTime: number): void {
    const now = this.world.getTime();

    // Log state changes
    if (this.config.aiState !== this._lastLoggedState) {
      console.log(`[MobEntity] ${this.config.mobType} state: ${this._lastLoggedState} → ${this.config.aiState}`);
      this._lastLoggedState = this.config.aiState;
      this._stateLogCounter = 0;
    }

    // Log periodically in same state to detect stuck loops
    this._stateLogCounter++;
    if (this._stateLogCounter % 60 === 0) { // Every ~1 second at 60fps
      const pos = this.getPosition();
      console.log(`[MobEntity] ${this.config.mobType} still in ${this.config.aiState} state (pos: ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
    }

    switch (this.config.aiState) {
      case MobAIState.IDLE:
        this.handleIdleState();
        break;
      case MobAIState.WANDER:
        this.handleWanderState(deltaTime);
        break;
      case MobAIState.CHASE:
        this.handleChaseState(deltaTime);
        break;
      case MobAIState.ATTACK:
        this.handleAttackState(now);
        break;
      case MobAIState.RETURN:
        this.handleReturnState(deltaTime);
        break;
      case MobAIState.DEAD:
        this.handleDeadState(deltaTime);
        break;
    }
  }

  private handleIdleState(): void {
    const now = this.world.getTime();

    // Initialize idle duration if just entered this state
    if (this._idleStartTime === 0) {
      this._idleStartTime = now;
      this._idleDuration = this.IDLE_MIN_DURATION +
        Math.random() * (this.IDLE_MAX_DURATION - this.IDLE_MIN_DURATION);
      console.log(`[MobEntity] ${this.config.mobType} entered IDLE, will idle for ${(this._idleDuration/1000).toFixed(1)}s`);
    }

    // Check for nearby players every tick (RuneScape-style: instant aggro detection)
    const nearbyPlayer = this.findNearbyPlayer();
    if (nearbyPlayer) {
      console.log(`[MobEntity] ${this.config.mobType} detected player, switching to CHASE`);
      this.config.targetPlayerId = nearbyPlayer.id;
      this.config.aiState = MobAIState.CHASE;
      this.world.emit(EventType.MOB_NPC_AGGRO, {
        mobId: this.id,
        targetId: nearbyPlayer.id
      });
      this._idleStartTime = 0; // Reset for next idle
      this.markNetworkDirty();
      return;
    }

    // After idle duration expires, start wandering (RuneScape-style natural timing)
    if (now - this._idleStartTime > this._idleDuration) {
      console.log(`[MobEntity] ${this.config.mobType} idle expired, switching to WANDER`);
      this.config.aiState = MobAIState.WANDER;
      this._wanderTarget = null; // Will pick new target in handleWanderState
      this._idleStartTime = 0; // Reset for next idle
      this.markNetworkDirty();
    }
  }

  private handleWanderState(deltaTime: number): void {
    // Check for nearby players every tick while wandering (RuneScape-style: instant aggro)
    const nearbyPlayer = this.findNearbyPlayer();
    if (nearbyPlayer) {
      this.config.targetPlayerId = nearbyPlayer.id;
      this.config.aiState = MobAIState.CHASE;
      this._wanderTarget = null;
      this.markNetworkDirty();
      return;
    }

    // Pick a random wander target if we don't have one (RuneScape-style: short random walks)
    if (!this._wanderTarget) {
      // Pick a random direction and distance from current position (not spawn)
      const currentPos = this.getPosition();
      const angle = Math.random() * Math.PI * 2;
      const distance = this.WANDER_MIN_DISTANCE +
        Math.random() * (this.WANDER_MAX_DISTANCE - this.WANDER_MIN_DISTANCE);

      let targetX = currentPos.x + Math.cos(angle) * distance;
      let targetZ = currentPos.z + Math.sin(angle) * distance;

      // Ensure target is within wander radius from spawn point
      const distFromSpawn = Math.sqrt(
        Math.pow(targetX - this.config.spawnPoint.x, 2) +
        Math.pow(targetZ - this.config.spawnPoint.z, 2)
      );

      if (distFromSpawn > this.config.wanderRadius) {
        // Clamp to wander radius boundary
        const toTargetX = targetX - this.config.spawnPoint.x;
        const toTargetZ = targetZ - this.config.spawnPoint.z;
        const scale = this.config.wanderRadius / distFromSpawn;
        targetX = this.config.spawnPoint.x + toTargetX * scale;
        targetZ = this.config.spawnPoint.z + toTargetZ * scale;
      }

      this._wanderTarget = { x: targetX, z: targetZ };
    }

    // Move towards wander target
    const currentPos = this.getPosition();
    const distanceToTarget = Math.sqrt(
      Math.pow(this._wanderTarget.x - currentPos.x, 2) +
      Math.pow(this._wanderTarget.z - currentPos.z, 2)
    );

    if (distanceToTarget < 0.5) {
      // Reached wander target - return to idle (RuneScape-style: idle between wanders)
      this._wanderTarget = null;
      this.config.aiState = MobAIState.IDLE;
      this.markNetworkDirty();
      return;
    }

    // Move towards wander target
    this.moveTowardsTarget({ x: this._wanderTarget.x, y: currentPos.y, z: this._wanderTarget.z }, deltaTime);
  }

  private handleChaseState(deltaTime: number): void {
    // FIRST: Check wander radius boundary (RuneScape-style: immediate leashing)
    // Use 2D distance to avoid Y terrain height causing incorrect leashing
    const spawnDistance = this.getDistance2D(this.config.spawnPoint);
    if (spawnDistance > this.config.wanderRadius) {
      this.config.aiState = MobAIState.RETURN;
      this.config.targetPlayerId = null;
      this._wanderTarget = null; // Clean up state
      this.markNetworkDirty();
      return;
    }

    // Validate target player still exists
    if (!this.config.targetPlayerId) {
      this.config.aiState = MobAIState.IDLE;
      this.markNetworkDirty();
      return;
    }

    const targetPlayer = this.getPlayer(this.config.targetPlayerId);
    if (!targetPlayer || !targetPlayer.position) {
      this.config.targetPlayerId = null;
      this.config.aiState = MobAIState.RETURN;
      this._wanderTarget = null;
      this.markNetworkDirty();
      return;
    }

    const targetPos = targetPlayer.position;
    const distance3D = this.getDistanceTo(targetPos);
    const distance2D = this.getDistance2D(targetPos);

    // Switch to attack if in melee range (RuneScape-style)
    // Use 2D distance to avoid Y height differences preventing combat
    if (distance2D <= this.config.combatRange) {
      console.log(`[MobEntity] ${this.config.mobType} entering ATTACK (2D: ${distance2D.toFixed(2)}, 3D: ${distance3D.toFixed(2)})`);
      this.config.aiState = MobAIState.ATTACK;
      this.markNetworkDirty();
      return;
    }

    // Chase the player (within wander radius boundary)
    this.moveTowardsTarget(targetPos, deltaTime);
  }

  private handleAttackState(currentTime: number): void {
    // FIRST: Check wander radius boundary even while attacking (RuneScape-style: strict boundary)
    // Use 2D distance to avoid Y terrain height causing incorrect leashing
    const spawnDistance = this.getDistance2D(this.config.spawnPoint);
    if (spawnDistance > this.config.wanderRadius) {
      this.config.aiState = MobAIState.RETURN;
      this.config.targetPlayerId = null;
      this._wanderTarget = null;
      this.markNetworkDirty();
      return;
    }

    // Validate target
    if (!this.config.targetPlayerId) {
      this.config.aiState = MobAIState.IDLE;
      this.markNetworkDirty();
      return;
    }

    const targetPlayer = this.getPlayer(this.config.targetPlayerId);
    if (!targetPlayer || !targetPlayer.position) {
      this.config.targetPlayerId = null;
      this.config.aiState = MobAIState.IDLE;
      this.markNetworkDirty();
      return;
    }

    const targetPos = targetPlayer.position;
    const distance2D = this.getDistance2D(targetPos);

    // Player moved out of melee range - chase them (RuneScape-style)
    // Use 2D distance to avoid Y height differences
    if (distance2D > this.config.combatRange) {
      this.config.aiState = MobAIState.CHASE;
      this.markNetworkDirty();
      return;
    }

    // Attack on cooldown (RuneScape-style: regular attack intervals)
    // Allow first attack immediately if lastAttackTime is 0 or very old
    const timeSinceLastAttack = currentTime - this.config.lastAttackTime;
    const canAttack = this.config.lastAttackTime === 0 || timeSinceLastAttack >= this.config.attackSpeed;

    // Only log when we can attack (reduce spam)
    if (canAttack) {
      console.log(`[MobEntity] ⚔️⚔️⚔️ ${this.config.mobType} PERFORMING ATTACK on ${targetPlayer.id} ⚔️⚔️⚔️`);
      this.performAttack(targetPlayer);
      this.config.lastAttackTime = currentTime;
    }
    // Don't log every frame when on cooldown - too spammy
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

  private handleReturnState(deltaTime: number): void {
    // Use 2D distance (XZ only) for spawn checks to avoid Y terrain height issues
    const spawnDistance = this.getDistance2D(this.config.spawnPoint);

    // Safety: If somehow extremely far from spawn, teleport back (production safety)
    if (spawnDistance > this.RETURN_TELEPORT_DISTANCE) {
      console.warn(`[MobEntity] Mob ${this.id} too far from spawn (${spawnDistance.toFixed(1)}), teleporting`);
      this.setPosition(this.config.spawnPoint.x, this.config.spawnPoint.y, this.config.spawnPoint.z);
      this.config.aiState = MobAIState.IDLE;
      this.config.currentHealth = this.config.maxHealth;
      this._stuckTimer = 0;
      this._lastPosition = null;
      this._idleStartTime = 0; // Force fresh idle state
      this._wanderTarget = null;
      this.markNetworkDirty();
      return;
    }

    // Reached spawn point - return to idle and heal (RuneScape-style: full heal on return)
    if (spawnDistance < 0.5) {
      console.log(`[MobEntity] ${this.config.mobType} reached spawn, switching to IDLE (2D distance: ${spawnDistance.toFixed(3)})`);
      this.config.aiState = MobAIState.IDLE;
      this.config.currentHealth = this.config.maxHealth;
      this._stuckTimer = 0;
      this._lastPosition = null;
      this._idleStartTime = 0; // Force fresh idle state
      this._wanderTarget = null; // Clear any old wander target
      this.markNetworkDirty();
      return;
    }

    // Walk back to spawn point (RuneScape-style: walk speed return)
    console.log(`[MobEntity] ${this.config.mobType} returning to spawn (2D distance: ${spawnDistance.toFixed(2)})`);
    this.moveTowardsTarget(this.config.spawnPoint, deltaTime);
  }

  private handleDeadState(_deltaTime: number): void {
    if (!this.config.deathTime) return;

    const timeSinceDeath = this.world.getTime() - this.config.deathTime;
    if (timeSinceDeath >= this.config.respawnTime) {
      this.respawn();
    }
  }

  private performAttack(target: { id: string; position: Position3D }): void {
    const distance = this.getDistance2D(target.position);
    console.log(`[MobEntity] ${this.config.mobType} emitting COMBAT_MOB_NPC_ATTACK (mobId: ${this.id}, targetId: ${target.id}, distance: ${distance.toFixed(2)})`);

    // Emit attack event
    this.world.emit(EventType.COMBAT_MOB_NPC_ATTACK, {
      mobId: this.id,
      targetId: target.id,
      damage: this.config.attackPower,
      attackerType: 'mob',
      targetType: 'player'
    });
  }

  takeDamage(damage: number, attackerId?: string): boolean {
    if (this.config.aiState === MobAIState.DEAD) return false;

    // Track attacker for death event
    if (attackerId) {
      this.lastAttackerId = attackerId;
    }

    this.config.currentHealth = Math.max(0, this.config.currentHealth - damage);
    
    // Update userData
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.mobData) {
        userData.mobData.health = this.config.currentHealth;
      }
    }

    // Show damage numbers
    this.world.emit(EventType.COMBAT_DAMAGE_DEALT, {
      targetId: this.id,
      damage,
      position: this.getPosition()
    });

        if (this.config.currentHealth <= 0) {
          // Don't call die() directly - let EntityManager handle death via MOB_ATTACKED event
          // This prevents race conditions and double XP grants
          return true; // Mob died
        } else {
      // Become aggressive towards attacker
      if (attackerId && !this.config.targetPlayerId) {
        this.config.targetPlayerId = attackerId;
        this.config.aiState = MobAIState.CHASE;
      }
    }

    this.markNetworkDirty();
    return false; // Mob survived
  }

  die(): void {
    this.config.aiState = MobAIState.DEAD;
    this.config.deathTime = this.world.getTime();
    this.config.targetPlayerId = null;
    this.config.currentHealth = 0; // Ensure health is 0
    
    // Update base health property for isDead() check
    this.setHealth(0);

    // Immediately end combat to prevent further attacks
    const combatSystem = this.world.getSystem('combat') as any;
    if (combatSystem && typeof combatSystem.forceEndCombat === 'function') {
      combatSystem.forceEndCombat(this.id);
    }

    // Mark for network update to sync death state to clients
    this.markNetworkDirty();

    // Emit death event with last attacker
    if (this.lastAttackerId) {
      this.world.emit(EventType.NPC_DIED, {
        mobId: this.id,
        mobType: this.config.mobType,
        level: this.config.level,
        killedBy: this.lastAttackerId,
        position: this.getPosition()
      });

      // Emit COMBAT_KILL event for SkillsSystem to grant combat XP
      this.world.emit(EventType.COMBAT_KILL, {
        attackerId: this.lastAttackerId,
        targetId: this.id,
        damageDealt: this.config.maxHealth, // Total damage dealt (mob's max health)
        attackStyle: 'aggressive' // Use valid attack style for XP calculation
      });

      this.dropLoot(this.lastAttackerId);
    } else {
      console.warn(`[MobEntity] ${this.id} died but no lastAttackerId found`);
    }

    // Hide mesh or change to corpse
    if (this.mesh) {
      this.mesh.visible = false;
    }

    // Schedule entity destruction after a brief delay to allow network sync
    setTimeout(() => {
      const entityManager = this.world.getSystem('entity-manager') as EntityManager;
      if (entityManager && typeof entityManager.destroyEntity === 'function') {
        entityManager.destroyEntity(this.id);
      }
    }, 100); // 100ms delay to ensure network update is sent
  }

  private dropLoot(killerId: string): void {
    if (!this.config.lootTable.length) return;

    for (const lootItem of this.config.lootTable) {
      if (Math.random() < lootItem.chance) {
        const quantity = Math.floor(
          Math.random() * (lootItem.maxQuantity - lootItem.minQuantity + 1)
        ) + lootItem.minQuantity;

        this.world.emit(EventType.ITEM_SPAWN, {
          itemId: lootItem.itemId,
          quantity,
          position: this.getPosition(),
          droppedBy: killerId
        });
      }
    }
  }

  public respawn(): void {
    // Reset health and state
    this.config.currentHealth = this.config.maxHealth;
    this.config.aiState = MobAIState.IDLE;
    this.config.targetPlayerId = null;
    this.config.deathTime = null;

    // Reset position to spawn point
    this.setPosition(this.config.spawnPoint.x, this.config.spawnPoint.y, this.config.spawnPoint.z);

    // Show mesh
    if (this.mesh) {
      this.mesh.visible = true;
    }

    // Update userData
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.mobData) {
        userData.mobData.health = this.config.currentHealth;
      }
    }

    this.world.emit(EventType.MOB_NPC_RESPAWNED, {
      mobId: this.id,
      position: this.getPosition()
    });

    this.markNetworkDirty();
  }

  private generatePatrolPoints(): void {
    const spawnPos = this.config.spawnPoint;
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
      z: targetPos.z - currentPos.z
    };

    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;

      const moveDistance = this.config.moveSpeed * deltaTime;
      let newPos = {
        x: currentPos.x + direction.x * moveDistance,
        y: currentPos.y,
        z: currentPos.z + direction.z * moveDistance
      };

      // Snap to terrain height (only if terrain system is ready)
      const terrain = this.world.getSystem('terrain');
      if (terrain && 'getHeightAt' in terrain) {
        try {
          // CRITICAL: Must call method on terrain object to preserve 'this' context
          const terrainHeight = (terrain as { getHeightAt: (x: number, z: number) => number }).getHeightAt(newPos.x, newPos.z);
          if (Number.isFinite(terrainHeight)) {
            newPos.y = terrainHeight + 0.1;
          } else if (!this._terrainWarningLogged) {
            console.warn(`[MobEntity] Server terrain height not finite at (${newPos.x.toFixed(1)}, ${newPos.z.toFixed(1)})`);
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
      const isMovingState = this.config.aiState === MobAIState.WANDER ||
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
              console.warn(`[MobEntity] ${this.config.mobType} stuck for ${(this.STUCK_TIMEOUT/1000).toFixed(1)}s at (${currentPos.x.toFixed(1)}, ${currentPos.z.toFixed(1)}), returning to spawn`);
              this.config.aiState = MobAIState.RETURN;
              this.config.targetPlayerId = null;
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
   * Returns first player found within range for simplicity
   */
  private findNearbyPlayer(): { id: string; position: Position3D } | null {
    const players = this.world.getPlayers();

    // Early exit if no players
    if (players.length === 0) return null;

    const currentPos = this.getPosition();

    for (const player of players) {
      const playerPos = player.node?.position;
      if (!playerPos) continue;

      // Quick distance check (RuneScape-style: first player in range)
      const dx = playerPos.x - currentPos.x;
      const dz = playerPos.z - currentPos.z;
      const distSquared = dx * dx + dz * dz;
      const aggroRangeSquared = this.config.aggroRange * this.config.aggroRange;

      if (distSquared <= aggroRangeSquared) {
        return {
          id: player.id,
          position: {
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z
          }
        };
      }
    }
    return null;
  }

  private getPlayer(playerId: string): { id: string; position: Position3D } | null {
    const player = this.world.getPlayer(playerId);
    if (!player || !player.node?.position) return null;
    
    return {
      id: player.id,
      position: {
        x: player.node.position.x,
        y: player.node.position.y,
        z: player.node.position.z
      }
    };
  }

  // Map internal AI states to interface expected states (RuneScape-style)
  private mapAIStateToInterface(internalState: string): 'idle' | 'wander' | 'chase' | 'attack' | 'return' | 'dead' {
    // Direct mapping - internal states match interface states
    return (internalState as 'idle' | 'wander' | 'chase' | 'attack' | 'return' | 'dead') || 'idle';
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
      position: this.getPosition()
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
    const networkData: Record<string, unknown> = {
      ...baseData,
      model: this.config.model, // CRITICAL: Include model path
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId
    };

    // Include emote if using VRM
    if (this._avatarInstance && this._currentEmote) {
      networkData.e = this._currentEmote;
    }

    return networkData;
  }
  
  /**
   * Override modify to handle network updates from server
   */
  override modify(data: Partial<EntityData>): void {
    // Update AI state from server
    if ('aiState' in data) {
      const newState = data.aiState as MobAIState;
      if (this.config.aiState !== newState) {
        console.log(`[MobEntity] AI state changed: ${this.config.aiState} → ${newState}`);
      }
      this.config.aiState = newState;
    }

    // Update health from server
    if ('currentHealth' in data) {
      this.config.currentHealth = data.currentHealth as number;
    }

    // Update max health from server
    if ('maxHealth' in data) {
      this.config.maxHealth = data.maxHealth as number;
    }

    // Update target from server
    if ('targetPlayerId' in data) {
      this.config.targetPlayerId = data.targetPlayerId as string | null;
    }

    // Handle emote from server (like PlayerRemote does)
    if ('e' in data && data.e !== undefined && this._avatarInstance) {
      const emoteUrl = data.e as string;
      if (this._currentEmote !== emoteUrl) {
        this._currentEmote = emoteUrl;
        this._avatarInstance.setEmote(emoteUrl);

        // If receiving combat emote, set override to prevent AI from changing it for 700ms (one-shot animation)
        // If receiving idle emote after combat, clear the override immediately
        if (emoteUrl.includes('combat') || emoteUrl.includes('punching')) {
          this._manualEmoteOverrideUntil = Date.now() + 700; // 700ms for animation to play
          console.log(`[MobEntity] Manual combat emote set, override until ${this._manualEmoteOverrideUntil}`);
        } else if (emoteUrl.includes('idle')) {
          this._manualEmoteOverrideUntil = 0; // Clear override when reset to idle
          console.log(`[MobEntity] Manual idle emote set, clearing override`);
        }
      }
    }

    // Call parent modify for standard properties (position, rotation, etc.)
    super.modify(data);
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
