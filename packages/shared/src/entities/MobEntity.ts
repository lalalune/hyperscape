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
 * **Referenced by**: MobSystem, MobSpawnerSystem, CombatSystem, AggroSystem
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



export class MobEntity extends CombatantEntity {
  protected config: MobEntityConfig;
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;
  private lastAttackerId: string | null = null;

  async init(): Promise<void> {
    await super.init();
    
    // CRITICAL: Register for update loop (both client and server)
    this.world.setHot(this, true);
    console.log(`[MobEntity] ✅ Registered ${this.config.mobType} for update loop (hot entity)`);
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
        attackRange: config.combatRange
      }
    } as unknown as CombatantConfig;
    
    super(world, combatConfig);
    this.config = config;
    this.generatePatrolPoints();
    
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
    console.log(`[MobEntity] 🎬 setupAnimations() called for ${this.config.mobType}`, {
      hasMesh: !!this.mesh,
      animationCount: animations.length,
      animationNames: animations.map(a => a.name)
    });
    
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
    
    console.log(`[MobEntity] 🔍 SkinnedMesh search result:`, {
      found: !!skinnedMesh,
      meshChildCount: this.mesh.children.length
    });
    
    if (!skinnedMesh) {
      console.warn(`[MobEntity] No SkinnedMesh found in model for animations`);
      return;
    }
    
    // Create AnimationMixer
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
    action.play();
    
    console.log(`[MobEntity] ✅ Animations ready:`, {
      total: animations.length,
      hasIdle: !!animationClips.idle,
      hasWalk: !!animationClips.walk,
      playing: initialClip.name,
      duration: initialClip.duration,
      actionEnabled: action.enabled,
      actionWeight: action.weight
    });
    
    // Store mixer and clips on entity
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
    (this as { animationClips?: typeof animationClips }).animationClips = animationClips;
    (this as { currentAction?: THREE.AnimationAction }).currentAction = action;
  }

  /**
   * Load external animation files (walking.glb, attacking.glb, etc.)
   */
  private async loadIdleAnimation(): Promise<void> {
    if (!this.mesh || !this.world.loader) return;
    
    const modelPath = this.config.model;
    if (!modelPath) return;
    
    const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
    
    // Try to load walking animation
    const walkAnimPath = `${modelDir}/animations/walking.glb`;
    
    // Find the SkinnedMesh
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });
    
    if (!skinnedMesh) {
      console.warn(`[MobEntity] No SkinnedMesh found for external animations`);
      return;
    }
    
    // Create AnimationMixer
    const mixer = new THREE.AnimationMixer(skinnedMesh);
    const animationClips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip } = {};
    
    try {
      const anim = await this.world.loader.load('emote', walkAnimPath);
      if (anim && 'toClip' in anim) {
        const clip = anim.toClip();
        if (clip) {
          animationClips.walk = clip;
          console.log(`[MobEntity] ✅ Loaded walking animation`);
        }
      }
    } catch (err) {
      console.warn(`[MobEntity] Walking animation not found, mob will be static`);
    }
    
    // Use walk animation as idle if that's all we have
    const initialClip = animationClips.walk;
    if (initialClip) {
      const action = mixer.clipAction(initialClip);
      action.play();
      
      // Store mixer and clips
      (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
      (this as { animationClips?: typeof animationClips }).animationClips = animationClips;
      (this as { currentAction?: THREE.AnimationAction }).currentAction = action;
      
      console.log(`[MobEntity] ✅ External animations ready`);
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }
    
    // Try to load 3D model if available
    if (this.config.model && this.world.loader) {
      try {
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
            
            console.log(`[MobEntity] ✅ Bound skeleton at scale ${modelScale}x`);
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
        console.log(`[MobEntity] ✅ Added mesh as child of node`);
        
        console.log(`[MobEntity] ✅ Model loaded for ${this.config.mobType}`, {
          animations: animations.length,
          animationNames: animations.map(a => a.name),
          scale: this.mesh.scale.x,
          meshType: this.mesh.type
        });
        
        // Load animations if available (do this after mesh is added to scene)
        console.log(`[MobEntity] 🎬 About to setup animations for ${this.config.mobType}`, {
          hasAnimations: animations.length > 0,
          count: animations.length
        });
        
        if (animations.length > 0) {
          await this.setupAnimations(animations);
          console.log(`[MobEntity] 🎬 setupAnimations() completed for ${this.config.mobType}`);
        } else {
          console.log(`[MobEntity] 🎬 No inline animations, trying external for ${this.config.mobType}`);
          // Try to load external animations
          await this.loadIdleAnimation();
          console.log(`[MobEntity] 🎬 loadIdleAnimation() completed for ${this.config.mobType}`);
        }
        
        return;
      } catch (error) {
        console.warn(`[MobEntity] Failed to load model for ${this.config.mobType}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }
    
    console.log(`[MobEntity] Creating placeholder capsule for ${this.config.mobType}`);
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
      this.world.emit(EventType.MOB_EXAMINE, {
        playerId: data.playerId,
        mobId: this.id,
        mobData: this.getMobData()
      });
    }
  }

  private serverDebugFrames = 0;
  private serverUpdateCount = 0;
  
  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);
    
    this.serverUpdateCount++;

    if (this.config.aiState !== MobAIState.DEAD) {
      this.updateAI(deltaTime);
    }
    
    // Log every update for first 5 frames, then every 2 seconds
    const shouldLog = this.serverUpdateCount <= 5 || (this.serverUpdateCount % 60 === 0);
    if (shouldLog) {
      console.log(`[MobEntity][SERVER] #${this.serverUpdateCount} ${this.config.mobType}:`, {
        aiState: this.config.aiState,
        position: {
          x: this.position.x.toFixed(2),
          y: this.position.y.toFixed(2),
          z: this.position.z.toFixed(2)
        },
        targetPlayerId: this.config.targetPlayerId,
        deltaTime: deltaTime.toFixed(3)
      });
    }
  }

  
  private animationUpdateCallCount = 0;
  
  /**
   * Switch animation based on AI state
   */
  private updateAnimation(): void {
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    const clips = (this as { animationClips?: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip } }).animationClips;
    const currentAction = (this as { currentAction?: THREE.AnimationAction }).currentAction;
    
    if (!mixer || !clips) {
      return;
    }
    
    // Determine which animation should be playing based on AI state
    let targetClip: THREE.AnimationClip | undefined;
    
    if (this.config.aiState === MobAIState.PATROL || 
        this.config.aiState === MobAIState.CHASE) {
      // Moving states - play walk animation
      targetClip = clips.walk || clips.idle;
    } else {
      // Idle, attack, flee, or dead - play idle animation
      targetClip = clips.idle || clips.walk;
    }
    
    // Switch animation if needed
    if (targetClip && currentAction?.getClip() !== targetClip) {
      console.log(`[MobEntity][CLIENT] Switching animation for ${this.config.mobType}:`, {
        from: currentAction?.getClip()?.name || 'none',
        to: targetClip.name,
        aiState: this.config.aiState
      });
      currentAction?.fadeOut(0.2);
      const newAction = mixer.clipAction(targetClip);
      newAction.reset().fadeIn(0.2).play();
      (this as { currentAction?: THREE.AnimationAction }).currentAction = newAction;
    }
  }

  private clientDebugFrames = 0;
  private clientUpdateCallCount = 0;
  
  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    
    this.clientUpdateCallCount++;
    
    // Mesh is child of node, so it follows automatically
    // No manual position sync needed
    
    // Update animations based on AI state
    this.updateAnimation();
    
    // Update animation mixer if exists
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      // Debug logging for first 10 updates (like VRM does)
      if (this.clientUpdateCallCount <= 10) {
        console.log(`[MobEntity] Update #${this.clientUpdateCallCount} for ${this.config.mobType}:`, {
          deltaTime: deltaTime.toFixed(4),
          mixerTime: mixer.time.toFixed(4),
          hasMixer: true
        });
      }
      
      // Update the mixer (advances animation time)
      mixer.update(deltaTime);
      
      if (this.clientUpdateCallCount <= 10) {
        console.log(`[MobEntity] Mixer updated, new time: ${mixer.time.toFixed(4)}`);
      }
      
      // CRITICAL: Update skeleton bones (exactly like VRM at line 317!)
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // VRM does: skeleton.bones.forEach(bone => bone.updateMatrixWorld())
            child.skeleton.bones.forEach(bone => bone.updateMatrixWorld());
          }
        });
      }
    }
    
    // Periodic status logging for debugging (every ~5 seconds)
    this.clientDebugFrames++;
    if (this.clientDebugFrames === 300) {
      console.log(`[MobEntity][CLIENT] ${this.config.mobType}:`, {
        aiState: this.config.aiState,
        animating: !!mixer
      });
      this.clientDebugFrames = 0;
    }
    
    // Health bar updates handled by Entity base class
  }

  private updateAI(deltaTime: number): void {
    const now = this.world.getTime();

    switch (this.config.aiState) {
      case MobAIState.IDLE:
        this.handleIdleState();
        break;
      case MobAIState.PATROL:
        this.handlePatrolState(deltaTime);
        break;
      case MobAIState.CHASE:
        this.handleChaseState(deltaTime);
        break;
      case MobAIState.ATTACK:
        this.handleAttackState(now);
        break;
      case MobAIState.FLEE:
        this.handleFleeState(deltaTime);
        break;
    }
  }

  private handleIdleState(): void {
    // Look for nearby players
    const nearbyPlayer = this.findNearbyPlayer();
    if (nearbyPlayer) {
      this.config.targetPlayerId = nearbyPlayer.id;
      console.log(`[MobEntity][AI] ${this.config.mobType} detected player ${nearbyPlayer.id}, entering CHASE state`);
      this.config.aiState = MobAIState.CHASE;
      this.world.emit(EventType.MOB_AGGRO, {
        mobId: this.id,
        targetId: nearbyPlayer.id
      });
      this.markNetworkDirty();
      return;
    }

    // Start patrolling if no player found
    if (Math.random() < 0.01) { // 1% chance to start patrolling each update (lower for less spam)
      console.log(`[MobEntity][AI] ${this.config.mobType} starting patrol`);
      this.config.aiState = MobAIState.PATROL;
      this.markNetworkDirty();
    }
  }

  private handlePatrolState(deltaTime: number): void {
    // Check for players while patrolling
    const nearbyPlayer = this.findNearbyPlayer();
    if (nearbyPlayer) {
      this.config.targetPlayerId = nearbyPlayer.id;
      this.config.aiState = MobAIState.CHASE;
      return;
    }

    // Move towards current patrol point
    if (this.patrolPoints.length > 0) {
      const targetPoint = this.patrolPoints[this.currentPatrolIndex];
      const currentPos = this.getPosition();
      const targetPos = { x: targetPoint.x, y: currentPos.y, z: targetPoint.z };

      const distance = this.getDistanceTo(targetPos);
      if (distance < 1) {
        // Reached patrol point, move to next
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      } else {
        // Move towards patrol point
        this.moveTowardsTarget(targetPos, deltaTime);
      }
    }

    // Random chance to stop patrolling
    if (Math.random() < 0.05) { // 5% chance to stop
      this.config.aiState = MobAIState.IDLE;
    }
  }

  private handleChaseState(deltaTime: number): void {
    if (!this.config.targetPlayerId) {
      console.log(`[MobEntity][AI] ${this.config.mobType} CHASE state but no target, going IDLE`);
      this.config.aiState = MobAIState.IDLE;
      this.markNetworkDirty();
      return;
    }

    const targetPlayer = this.getPlayer(this.config.targetPlayerId);
    if (!targetPlayer) {
      console.log(`[MobEntity][AI] ${this.config.mobType} target player not found, going FLEE`);
      this.config.targetPlayerId = null;
      this.config.aiState = MobAIState.FLEE;
      this.markNetworkDirty();
      return;
    }

    const targetPos = targetPlayer.position;
    if (!targetPos) {
      console.log(`[MobEntity][AI] ${this.config.mobType} target has no position, going FLEE`);
      this.config.aiState = MobAIState.FLEE;
      this.markNetworkDirty();
      return;
    }

    const distance = this.getDistanceTo(targetPos);
    const spawnDistance = this.getDistanceTo(this.config.spawnPoint);

    // Mob is actively chasing

    // Too far from spawn - return home (allow 5x aggro range leash distance)
    if (spawnDistance > this.config.aggroRange * 5.0) {
      console.log(`[MobEntity][AI] ${this.config.mobType} too far from spawn (${spawnDistance.toFixed(2)}m), going FLEE`);
      this.config.aiState = MobAIState.FLEE;
      this.config.targetPlayerId = null;
      this.markNetworkDirty();
      return;
    }

    // Player too far - give up chase (allow them to chase 3x aggro range for persistence)
    if (distance > this.config.aggroRange * 3.0) {
      console.log(`[MobEntity][AI] ${this.config.mobType} player too far (${distance.toFixed(2)}m), giving up chase`);
      this.config.aiState = MobAIState.FLEE;
      this.config.targetPlayerId = null;
      this.markNetworkDirty();
      return;
    }

    // Close enough to attack
    if (distance <= this.config.combatRange) {
      console.log(`[MobEntity][AI] ${this.config.mobType} in attack range, entering ATTACK state`);
      this.config.aiState = MobAIState.ATTACK;
      this.markNetworkDirty();
      return;
    }

    // Move towards player
    this.moveTowardsTarget(targetPos, deltaTime);
  }

  private handleAttackState(currentTime: number): void {
    if (!this.config.targetPlayerId) {
      this.config.aiState = MobAIState.IDLE;
      return;
    }

    const targetPlayer = this.getPlayer(this.config.targetPlayerId);
    if (!targetPlayer) {
      this.config.targetPlayerId = null;
      this.config.aiState = MobAIState.IDLE;
      return;
    }

    const targetPos = targetPlayer.position;
    if (!targetPos) {
      this.config.aiState = MobAIState.CHASE;
      return;
    }

    const distance = this.getDistanceTo(targetPos);

    // Player moved out of range
    if (distance > this.config.combatRange) {
      this.config.aiState = MobAIState.CHASE;
      return;
    }

    // Check attack cooldown
    const timeSinceLastAttack = currentTime - this.config.lastAttackTime;
    if (timeSinceLastAttack >= this.config.attackSpeed) {
      this.performAttack(targetPlayer);
      this.config.lastAttackTime = currentTime;
    }
  }

  private handleFleeState(deltaTime: number): void {
    const spawnDistance = this.getDistanceTo(this.config.spawnPoint);
    
    if (spawnDistance < 1) {
      // Reached spawn point
      this.config.aiState = MobAIState.IDLE;
      this.config.currentHealth = this.config.maxHealth; // Heal when returning home
      return;
    }

    // Move towards spawn point
    this.moveTowardsTarget(this.config.spawnPoint, deltaTime);
  }

  private handleDeadState(_deltaTime: number): void {
    if (!this.config.deathTime) return;

    const timeSinceDeath = this.world.getTime() - this.config.deathTime;
    if (timeSinceDeath >= this.config.respawnTime) {
      this.respawn();
    }
  }

  private performAttack(target: { id: string }): void {
    // Emit attack event
    this.world.emit(EventType.COMBAT_MOB_ATTACK, {
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
      this.die();
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

    // Emit death event with last attacker
    if (this.lastAttackerId) {
      this.world.emit(EventType.MOB_DIED, {
        mobId: this.id,
        killerId: this.lastAttackerId,
        xpReward: this.config.xpReward,
        position: this.getPosition()
      });
      this.dropLoot(this.lastAttackerId);
    }

    // Hide mesh or change to corpse
    if (this.mesh) {
      this.mesh.visible = false;
      console.log(`[MobEntity] Hiding mesh for dead mob ${this.id}`);
    }

    this.markNetworkDirty();
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
      console.log(`[MobEntity] Showing mesh for respawned mob ${this.id}`);
    }

    // Update userData
    if (this.mesh?.userData) {
      const userData = this.mesh.userData as MeshUserData;
      if (userData.mobData) {
        userData.mobData.health = this.config.currentHealth;
      }
    }

    this.world.emit(EventType.MOB_RESPAWNED, {
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
      const newPos = {
        x: currentPos.x + direction.x * moveDistance,
        y: currentPos.y,
        z: currentPos.z + direction.z * moveDistance
      };

      // Calculate rotation to face movement direction
      const angle = Math.atan2(direction.x, direction.z);
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      
      // Smoothly rotate towards target direction
      this.node.quaternion.slerp(targetQuaternion, 0.1);

      // Movement happening - position will be synced via network

      this.setPosition(newPos.x, newPos.y, newPos.z);
      this.markNetworkDirty();
    }
  }

  private findNearbyPlayer(): { id: string; position: Position3D } | null {
    const players = this.world.getPlayers();
    
    for (const player of players) {
      const playerPos = player.node?.position;
      if (!playerPos) continue;
      
      const distance = this.getDistanceTo({
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z
      });
      
      if (distance <= this.config.aggroRange) {
        console.log(`[MobEntity][AI] ${this.config.mobType} FOUND nearby player:`, {
          playerId: player.id,
          distance: distance.toFixed(2),
          aggroRange: this.config.aggroRange
        });
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

  // Map internal AI states to interface expected states
  private mapAIStateToInterface(internalState: string): 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead' {
    switch (internalState) {
      case 'patrolling':
        return 'patrol';
      case 'chasing':
        return 'chase';
      case 'attacking':
        return 'attack';
      case 'returning':
        return 'flee';
      case 'idle':
      case 'dead':
        return internalState as 'idle' | 'dead';
      default:
        return 'idle';
    }
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

  // Network data override
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId
    };
  }
  
  private lastReceivedAIState: string | null = null;
  
  /**
   * Override modify to handle network updates from server
   */
  override modify(data: Partial<EntityData>): void {
    let changed = false;
    
    // Update AI state from server
    if ('aiState' in data) {
      const newState = data.aiState as MobAIState;
      if (newState !== this.lastReceivedAIState) {
        console.log(`[MobEntity][NETWORK] Received AI state change for ${this.config.mobType}:`, {
          from: this.config.aiState,
          to: newState
        });
        this.lastReceivedAIState = newState;
        changed = true;
      }
      this.config.aiState = newState;
    }
    
    // Update health from server
    if ('currentHealth' in data) {
      this.config.currentHealth = data.currentHealth as number;
      changed = true;
    }
    
    // Update max health from server
    if ('maxHealth' in data) {
      this.config.maxHealth = data.maxHealth as number;
      changed = true;
    }
    
    // Update target from server
    if ('targetPlayerId' in data) {
      this.config.targetPlayerId = data.targetPlayerId as string | null;
      changed = true;
    }
    
    // Log position updates
    if ('p' in data || 'position' in data) {
      const pos = (data.p || data.position) as number[] | { x: number; y: number; z: number };
      if (Array.isArray(pos)) {
        console.log(`[MobEntity][NETWORK] Position update for ${this.config.mobType}:`, {
          x: pos[0].toFixed(2),
          y: pos[1].toFixed(2),
          z: pos[2].toFixed(2)
        });
      }
    }
    
    // Call parent modify for standard properties (position, rotation, etc.)
    super.modify(data);
  }
  
  /**
   * Override destroy to clean up animations
   */
  override destroy(): void {
    // Clean up animation mixer
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      mixer.stopAllAction();
      (this as { mixer?: THREE.AnimationMixer }).mixer = undefined;
    }
    
    // Parent will handle mesh removal (mesh is child of node)
    super.destroy();
  }
}