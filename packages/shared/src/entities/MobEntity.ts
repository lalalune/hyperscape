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
import type { MeshUserData, MobEntityData, Position3D } from '../types';
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
   * Load idle animation for rigged mob models
   */
  private async loadIdleAnimation(): Promise<void> {
    if (!this.mesh || !this.world.loader) return;
    
    // Get model directory from config.model path
    // e.g., "asset://models/goblin/goblin_rigged.glb" -> "asset://models/goblin"
    const modelPath = this.config.model;
    if (!modelPath) return;
    
    const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
    // Try walking animation as default idle (goblin has walking.glb, not idle.glb)
    const idleAnimPath = `${modelDir}/animations/walking.glb`;
    
    console.log(`[MobEntity] Loading idle animation: ${idleAnimPath}`);
    
    try {
      // Load animation glb
      const anim = await this.world.loader.load('emote', idleAnimPath);
      
      // Find the SkinnedMesh to apply animation to
      let skinnedMesh: THREE.SkinnedMesh | null = null;
      this.mesh.traverse((child) => {
        if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });
      
      if (!skinnedMesh) {
        console.warn(`[MobEntity] No SkinnedMesh found in model for animation`);
        return;
      }
      
      // Create AnimationMixer and play idle
      const mixer = new THREE.AnimationMixer(skinnedMesh);
      if (anim && 'toClip' in anim) {
        const clip = anim.toClip();
        if (clip) {
          const action = mixer.clipAction(clip);
          action.play();
          console.log(`[MobEntity] ✅ Idle animation playing`);
          
          // Update mixer each frame (store on entity for cleanup)
          (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
        }
      }
    } catch (err) {
      console.warn(`[MobEntity] Idle animation not found at ${idleAnimPath}, continuing without animation`);
    }
  }

  protected async createMesh(): Promise<void> {
    console.log(`[MobEntity] createMesh() called for ${this.config.mobType}`, {
      hasModelPath: !!this.config.model,
      modelPath: this.config.model,
      hasLoader: !!this.world.loader,
      isServer: this.world.isServer,
      isClient: this.world.isClient
    });
    
    if (this.world.isServer) {
      return;
    }
    
    // Try to load 3D model if available (same approach as ItemEntity/ResourceEntity)
    if (this.config.model && this.world.loader) {
      try {
        console.log(`[MobEntity] Loading model for ${this.config.mobType}:`, this.config.model);
        const { scene } = await modelCache.loadModel(this.config.model, this.world);
        
        this.mesh = scene;
        this.mesh.name = `Mob_${this.config.mobType}_${this.id}`;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.scale.set(1, 1, 1); // Standard scale for mobs
        
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
        
        this.node.add(this.mesh);
        console.log(`[MobEntity] ✅ Model loaded for ${this.config.mobType}`);
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

  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    if (this.config.aiState !== MobAIState.DEAD) {
      this.updateAI(deltaTime);
    }
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    
    // Update animation mixer if exists
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      mixer.update(deltaTime);
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
      this.config.aiState = MobAIState.CHASE;
      this.world.emit(EventType.MOB_AGGRO, {
        mobId: this.id,
        targetId: nearbyPlayer.id
      });
      return;
    }

    // Start patrolling if no player found
    if (Math.random() < 0.1) { // 10% chance to start patrolling each update
      this.config.aiState = MobAIState.PATROL;
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
      this.config.aiState = MobAIState.IDLE;
      return;
    }

    const targetPlayer = this.getPlayer(this.config.targetPlayerId);
    if (!targetPlayer) {
      this.config.targetPlayerId = null;
              this.config.aiState = MobAIState.FLEE;
      return;
    }

    const targetPos = targetPlayer.position;
    if (!targetPos) {
              this.config.aiState = MobAIState.FLEE;
      return;
    }

    const distance = this.getDistanceTo(targetPos);

    // Too far from spawn - return home
    const spawnDistance = this.getDistanceTo(this.config.spawnPoint);
    if (spawnDistance > this.config.aggroRange * 2) {
              this.config.aiState = MobAIState.FLEE;
      this.config.targetPlayerId = null;
      return;
    }

    // Player too far - give up chase
    if (distance > this.config.aggroRange * 1.5) {
              this.config.aiState = MobAIState.FLEE;
      this.config.targetPlayerId = null;
      return;
    }

    // Close enough to attack
    if (distance <= this.config.combatRange) {
      this.config.aiState = MobAIState.ATTACK;
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

      this.setPosition(newPos.x, newPos.y, newPos.z);
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
}