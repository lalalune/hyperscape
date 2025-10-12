/**
 * MobEntity - Represents mobs/enemies in the world
 * Replaces mob-based Apps with server-authoritative entities
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
import { Entity } from './Entity';



export class MobEntity extends Entity {
  protected config: MobEntityConfig;
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;

  constructor(world: World, config: MobEntityConfig) {
    super(world, config);
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

  protected async createMesh(): Promise<void> {
    console.log(`[MobEntity] createMesh() called for ${this.config.mobType}`, {
      hasModelPath: !!this.config.model,
      modelPath: this.config.model,
      hasLoader: !!this.world.loader,
      isServer: this.world.isServer,
      isClient: this.world.isClient
    });
    
    // SKIP MODEL LOADING - Prevents 404 errors, uses clean fallbacks
    // Directory /world-assets/forge/ doesn't exist yet
    // Models will be generated later - for now, use capsules
    
    if (this.world.isServer) {
      return; // Don't create fallback mesh on server
    }
    
    console.log(`[MobEntity] No model path for ${this.config.mobType}, creating fallback capsule`);
    
    // Fallback: Create colored capsule - use simple hash-based color from mob name
    // This is data-driven and works for any mob type without hardcoding
    const mobName = String(this.config.mobType).toLowerCase();
    const colorHash = mobName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (colorHash % 360) / 360; // Convert to 0-1 range for HSL
    const color = new THREE.Color().setHSL(hue, 0.6, 0.4); // Consistent saturation and lightness
    
    // Standard humanoid capsule size (data-driven from level could be added later)
    const geometry = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
    const material = new THREE.MeshLambertMaterial({ color: color.getHex() });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Mob_${this.config.mobType}_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;

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

    // Add health bar
    this.createHealthBar();
  }

  protected createHealthBar(): void {
    if (!this.mesh) return;

    // Health bar background
    const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.8 });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, 1.5, 0);
    healthBarBg.name = 'healthBarBg';

    // Health bar foreground
    const fgGeometry = new THREE.PlaneGeometry(1, 0.1);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.9 });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, 1.5, 0.001);
    healthBarFg.name = 'healthBarFg';

    this.mesh.add(healthBarBg);
    this.mesh.add(healthBarFg);

    this.updateHealthBar();
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
      this.world.emit('mob:examine', {
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

    // Update health bar
    this.updateHealthBar();
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);

    // Update health bar
    this.updateHealthBar();
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
      this.world.emit('mob:aggro', {
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
      attackerId: this.id,
      targetId: target.id,
      damage: this.config.attackPower,
      attackerType: 'mob',
      targetType: 'player'
    });
  }

  takeDamage(damage: number, attackerId: string): void {
    if (this.config.aiState === MobAIState.DEAD) return;

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
      this.die(attackerId);
    } else {
      // Become aggressive towards attacker
      if (!this.config.targetPlayerId) {
        this.config.targetPlayerId = attackerId;
        this.config.aiState = MobAIState.CHASE;
      }
    }

    this.markNetworkDirty();
  }

  private die(killerId: string): void {
    this.config.aiState = MobAIState.DEAD;
    this.config.deathTime = this.world.getTime();
    this.config.targetPlayerId = null;

    // Emit death event
    this.world.emit(EventType.MOB_DIED, {
      mobId: this.id,
      killerId,
      xpReward: this.config.xpReward,
      position: this.getPosition()
    });

    // Drop loot
    this.dropLoot(killerId);

    // Hide mesh or change to corpse
    if (this.mesh) {
      this.mesh.visible = false;
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

  private respawn(): void {
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

    this.world.emit('mob:respawn', {
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

  protected updateHealthBar(): void {
    if (!this.mesh) return;

    const healthBarFg = this.mesh.getObjectByName('healthBarFg');
    if (healthBarFg) {
      // Strong type assumption - healthBarFg is a Mesh
      const mesh = healthBarFg as THREE.Mesh;
      const healthPercent = this.config.currentHealth / this.config.maxHealth;
      mesh.scale.x = healthPercent;
      
      // Change color based on health
      // Strong type assumption - material is MeshBasicMaterial
      const material = mesh.material as THREE.MeshBasicMaterial;
      if (healthPercent > 0.6) {
        material.color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        material.color.setHex(0xffff00); // Yellow
      } else {
        material.color.setHex(0xff0000); // Red
      }
    }

    // Hide health bar if at full health
    const healthBarBg = this.mesh.getObjectByName('healthBarBg');
    const showHealthBar = this.config.currentHealth < this.config.maxHealth;
    if (healthBarBg) healthBarBg.visible = showHealthBar;
    if (healthBarFg) healthBarFg.visible = showHealthBar;
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
    // This would integrate with the player system to find nearby players
    // For now, return null - this should be implemented when integrating with player system
    return null;
  }

  private getPlayer(_playerId: string): { id: string; position: Position3D } | null {
    // This would integrate with the player system to get a specific player
    // For now, return null - this should be implemented when integrating with player system
    return null;
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