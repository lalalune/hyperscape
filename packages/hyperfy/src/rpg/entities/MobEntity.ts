/**
 * MobEntity - Represents mobs/enemies in the RPG world
 * Replaces mob-based RPGApps with server-authoritative entities
 */

import * as THREE from '../../core/extras/three';
import { RPGEntity, RPGEntityConfig, EntityInteractionData, EntityWorld } from './RPGEntity';

export interface MobEntityConfig extends RPGEntityConfig {
  type: 'mob';
  mobType: 'goblin' | 'bandit' | 'barbarian' | 'hobgoblin' | 'guard' | 'dark_warrior' | 'black_knight' | 'ice_warrior' | 'dark_ranger';
  level: number;
  maxHealth: number;
  currentHealth: number;
  attackPower: number;
  defense: number;
  attackSpeed: number;
  moveSpeed: number;
  aggroRange: number;
  combatRange: number;
  respawnTime: number;
  xpReward: number;
  lootTable: Array<{ itemId: string; chance: number; minQuantity: number; maxQuantity: number }>;
  spawnPoint: { x: number; y: number; z: number };
  aiState: 'idle' | 'patrolling' | 'chasing' | 'attacking' | 'returning' | 'dead';
  targetPlayerId?: string;
  lastAttackTime: number;
  deathTime?: number;
}

export class MobEntity extends RPGEntity {
  protected config: MobEntityConfig;
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;

  constructor(world: EntityWorld, config: MobEntityConfig) {
    super(world, {
      ...config,
      interactable: true,
      interactionType: 'attack',
      interactionDistance: config.combatRange || 2.0
    });
    
    this.config = config;
    
    // Generate patrol points around spawn
    this.generatePatrolPoints();
  }

  /**
   * Create visual representation based on mob type
   */
  protected async createMesh(): Promise<void> {
    // Different geometries for different mob types
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    switch (this.config.mobType) {
      case 'goblin':
        geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest green
        break;
      case 'bandit':
      case 'barbarian':
        geometry = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Saddle brown
        break;
      case 'hobgoblin':
        geometry = new THREE.CapsuleGeometry(0.45, 1.8, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x556B2F }); // Dark olive green
        break;
      case 'guard':
        geometry = new THREE.CapsuleGeometry(0.4, 1.7, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x4682B4 }); // Steel blue
        break;
      case 'dark_warrior':
        geometry = new THREE.CapsuleGeometry(0.45, 1.8, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x2F4F4F }); // Dark slate gray
        break;
      case 'black_knight':
        geometry = new THREE.CapsuleGeometry(0.5, 1.9, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black
        break;
      case 'ice_warrior':
        geometry = new THREE.CapsuleGeometry(0.5, 1.9, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x00CED1 }); // Dark turquoise
        break;
      case 'dark_ranger':
        geometry = new THREE.CapsuleGeometry(0.4, 1.7, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x800080 }); // Purple
        break;
      default:
        geometry = new THREE.CapsuleGeometry(0.4, 1.5, 4, 8);
        material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `mob_${this.config.mobType}_${this.id}`;
    
    // Add health bar (simple box above mob)
    const healthBarGeometry = new THREE.PlaneGeometry(1, 0.1);
    const healthBarMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
    healthBar.position.set(0, 2, 0);
    healthBar.lookAt(0, 2, 1); // Face camera
    this.mesh.add(healthBar);
    
    // Store health bar reference
    this.nodes.set('healthBar', healthBar);

    // Add mob metadata
    (this.mesh as any).userData = {
      ...((this.mesh as any).userData || {}),
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState
    };

    console.log(`[MobEntity] Created mesh for ${this.config.mobType} level ${this.config.level}`);
  }

  /**
   * Handle attack interaction
   */
  protected async onInteract(data: EntityInteractionData): Promise<void> {
    if (data.interactionType !== 'attack') return;
    if (this.config.aiState === 'dead') return;

    console.log(`[MobEntity] Player ${data.playerId} attacking ${this.config.mobType}`);

    // Set target and enter combat
    this.config.targetPlayerId = data.playerId;
    this.config.aiState = 'attacking';
    this.markNetworkDirty();

    // Send attack event to combat system
    this.world.emit('combat:mob_attacked', {
      mobId: this.id,
      playerId: data.playerId,
      mobType: this.config.mobType,
      mobLevel: this.config.level,
      mobHealth: this.config.currentHealth,
      mobMaxHealth: this.config.maxHealth,
      mobPosition: this.getPosition()
    });
  }

  /**
   * Server-side AI update logic
   */
  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    if (this.config.aiState === 'dead') {
      this.handleDeadState(deltaTime);
      return;
    }

    // Update AI behavior
    this.updateAI(deltaTime);
    this.updateHealthBar();
  }

  /**
   * Update AI behavior based on current state
   */
  private updateAI(deltaTime: number): void {
    const currentTime = this.world.getTime();
    
    switch (this.config.aiState) {
      case 'idle':
        this.handleIdleState();
        break;
      case 'patrolling':
        this.handlePatrollingState(deltaTime);
        break;
      case 'chasing':
        this.handleChasingState(deltaTime);
        break;
      case 'attacking':
        this.handleAttackingState(currentTime);
        break;
      case 'returning':
        this.handleReturningState(deltaTime);
        break;
    }
  }

  /**
   * Handle idle state - look for players in aggro range
   */
  private handleIdleState(): void {
    const players = this.world.getPlayers();
    const position = this.getPosition();

    for (const player of players) {
      const distance = this.getDistanceTo(player.position);
      if (distance <= this.config.aggroRange) {
        console.log(`[MobEntity] ${this.config.mobType} aggroed on player ${player.id}`);
        this.config.targetPlayerId = player.id;
        this.config.aiState = 'chasing';
        this.markNetworkDirty();
        return;
      }
    }

    // Start patrolling if no players nearby
    if (Math.random() < 0.01) { // 1% chance per frame to start patrolling
      this.config.aiState = 'patrolling';
      this.markNetworkDirty();
    }
  }

  /**
   * Handle patrolling state
   */
  private handlePatrollingState(deltaTime: number): void {
    if (this.patrolPoints.length === 0) {
      this.config.aiState = 'idle';
      this.markNetworkDirty();
      return;
    }

    const targetPoint = this.patrolPoints[this.currentPatrolIndex];
    const position = this.getPosition();
    
    // Move towards patrol point
    const dx = targetPoint.x - position.x;
    const dz = targetPoint.z - position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 1.0) {
      // Reached patrol point, move to next
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    } else {
      // Move towards target
      const moveSpeed = this.config.moveSpeed * 0.5; // Slower when patrolling
      const moveX = (dx / distance) * moveSpeed * deltaTime;
      const moveZ = (dz / distance) * moveSpeed * deltaTime;
      
      this.setPosition(position.x + moveX, position.y, position.z + moveZ);
    }

    // Check for nearby players
    this.handleIdleState();
  }

  /**
   * Handle chasing state
   */
  private handleChasingState(deltaTime: number): void {
    if (!this.config.targetPlayerId) {
      this.config.aiState = 'returning';
      this.markNetworkDirty();
      return;
    }

    const target = this.world.getPlayer(this.config.targetPlayerId);
    if (!target) {
      this.config.targetPlayerId = undefined;
      this.config.aiState = 'returning';
      this.markNetworkDirty();
      return;
    }

    const position = this.getPosition();
    const distance = this.getDistanceTo(target.position);

    // Check if target is too far (give up chase)
    if (distance > this.config.aggroRange * 2) {
      console.log(`[MobEntity] ${this.config.mobType} lost target, returning`);
      this.config.targetPlayerId = undefined;
      this.config.aiState = 'returning';
      this.markNetworkDirty();
      return;
    }

    // Check if in attack range
    if (distance <= this.config.combatRange) {
      this.config.aiState = 'attacking';
      this.markNetworkDirty();
      return;
    }

    // Move towards target
    const dx = target.position.x - position.x;
    const dz = target.position.z - position.z;
    const moveX = (dx / distance) * this.config.moveSpeed * deltaTime;
    const moveZ = (dz / distance) * this.config.moveSpeed * deltaTime;
    
    this.setPosition(position.x + moveX, position.y, position.z + moveZ);
  }

  /**
   * Handle attacking state
   */
  private handleAttackingState(currentTime: number): void {
    if (!this.config.targetPlayerId) {
      this.config.aiState = 'idle';
      this.markNetworkDirty();
      return;
    }

    const target = this.world.getPlayer(this.config.targetPlayerId);
    if (!target) {
      this.config.targetPlayerId = undefined;
      this.config.aiState = 'returning';
      this.markNetworkDirty();
      return;
    }

    const distance = this.getDistanceTo(target.position);

    // If target moved out of combat range, chase
    if (distance > this.config.combatRange) {
      this.config.aiState = 'chasing';
      this.markNetworkDirty();
      return;
    }

    // Check if can attack (attack speed cooldown)
    const timeSinceLastAttack = currentTime - this.config.lastAttackTime;
    if (timeSinceLastAttack >= (1.0 / this.config.attackSpeed)) {
      this.performAttack(target);
      this.config.lastAttackTime = currentTime;
      this.markNetworkDirty();
    }
  }

  /**
   * Handle returning to spawn state
   */
  private handleReturningState(deltaTime: number): void {
    const position = this.getPosition();
    const spawnDistance = this.getDistanceTo(this.config.spawnPoint);

    if (spawnDistance < 1.0) {
      // Reached spawn point
      this.config.aiState = 'idle';
      this.markNetworkDirty();
      return;
    }

    // Move towards spawn
    const dx = this.config.spawnPoint.x - position.x;
    const dz = this.config.spawnPoint.z - position.z;
    const moveX = (dx / spawnDistance) * this.config.moveSpeed * deltaTime;
    const moveZ = (dz / spawnDistance) * this.config.moveSpeed * deltaTime;
    
    this.setPosition(position.x + moveX, position.y, position.z + moveZ);
  }

  /**
   * Handle dead state and respawning
   */
  private handleDeadState(deltaTime: number): void {
    if (!this.config.deathTime) return;

    const timeSinceDeath = this.world.getTime() - this.config.deathTime;
    if (timeSinceDeath >= this.config.respawnTime) {
      this.respawn();
    }
  }

  /**
   * Perform attack on target
   */
  private performAttack(target: any): void {
    console.log(`[MobEntity] ${this.config.mobType} attacking player ${target.id}`);

    // Send attack to combat system
    this.world.emit('combat:mob_attack', {
      mobId: this.id,
      playerId: target.id,
      damage: this.config.attackPower,
      mobType: this.config.mobType,
      mobLevel: this.config.level
    });
  }

  /**
   * Take damage from player
   */
  takeDamage(damage: number, attackerId: string): void {
    if (!this.world.isServer || this.config.aiState === 'dead') return;

    // Apply defense
    const actualDamage = Math.max(1, damage - this.config.defense);
    this.config.currentHealth = Math.max(0, this.config.currentHealth - actualDamage);

    console.log(`[MobEntity] ${this.config.mobType} took ${actualDamage} damage, health: ${this.config.currentHealth}/${this.config.maxHealth}`);

    // Set attacker as target if not already engaged
    if (this.config.aiState === 'idle' || this.config.aiState === 'patrolling') {
      this.config.targetPlayerId = attackerId;
      this.config.aiState = 'chasing';
    }

    // Check if dead
    if (this.config.currentHealth <= 0) {
      this.die(attackerId);
    }

    this.markNetworkDirty();
  }

  /**
   * Handle mob death
   */
  private die(killerId: string): void {
    console.log(`[MobEntity] ${this.config.mobType} killed by player ${killerId}`);

    this.config.aiState = 'dead';
    this.config.deathTime = this.world.getTime();
    this.config.targetPlayerId = undefined;

    // Hide mesh
    this.setVisible(false);

    // Award XP to killer
    this.world.emit('xp:award', {
      playerId: killerId,
      amount: this.config.xpReward,
      source: 'combat',
      mobType: this.config.mobType,
      mobLevel: this.config.level
    });

    // Drop loot
    this.dropLoot(killerId);

    this.markNetworkDirty();
  }

  /**
   * Drop loot based on loot table
   */
  private dropLoot(killerId: string): void {
    const position = this.getPosition();

    for (const lootEntry of this.config.lootTable) {
      if (Math.random() <= lootEntry.chance) {
        const quantity = Math.floor(
          Math.random() * (lootEntry.maxQuantity - lootEntry.minQuantity + 1) + lootEntry.minQuantity
        );

        // Spawn loot item
        this.world.emit('item:spawn', {
          itemId: lootEntry.itemId,
          quantity,
          position: {
            x: position.x + (Math.random() - 0.5) * 2,
            y: position.y + 0.5,
            z: position.z + (Math.random() - 0.5) * 2
          },
          source: 'mob_drop',
          mobType: this.config.mobType,
          killerId
        });
      }
    }
  }

  /**
   * Respawn the mob
   */
  private respawn(): void {
    console.log(`[MobEntity] ${this.config.mobType} respawning`);

    // Reset to spawn point
    this.setPosition(this.config.spawnPoint.x, this.config.spawnPoint.y, this.config.spawnPoint.z);

    // Reset stats
    this.config.currentHealth = this.config.maxHealth;
    this.config.aiState = 'idle';
    this.config.targetPlayerId = undefined;
    this.config.deathTime = undefined;
    this.config.lastAttackTime = 0;

    // Show mesh
    this.setVisible(true);

    this.markNetworkDirty();
  }

  /**
   * Generate patrol points around spawn
   */
  private generatePatrolPoints(): void {
    const spawn = this.config.spawnPoint;
    const patrolRadius = 10;

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = spawn.x + Math.cos(angle) * patrolRadius;
      const z = spawn.z + Math.sin(angle) * patrolRadius;
      this.patrolPoints.push({ x, z });
    }
  }

  /**
   * Update health bar visual
   */
  private updateHealthBar(): void {
    const healthBar = this.nodes.get('healthBar');
    if (!healthBar || !(healthBar instanceof THREE.Mesh)) return;

    const healthPercent = Math.max(0, Math.min(1, this.config.currentHealth / this.config.maxHealth));
    
    // Update color based on health
    const material = (healthBar as THREE.Mesh).material;
    if (material && material instanceof THREE.MeshBasicMaterial) {
      if (healthPercent > 0.6) {
        material.color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        material.color.setHex(0xffff00); // Yellow
      } else {
        material.color.setHex(0xff0000); // Red
      }
    }

    // Update scale - clamp to prevent negative scales
    healthBar.scale.x = Math.max(0.01, healthPercent);
    
    // Hide health bar if mob is dead
    healthBar.visible = this.config.currentHealth > 0;
  }

  /**
   * Get mob data for UI/systems
   */
  getMobData(): any {
    return {
      id: this.id,
      name: this.name,
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      attackPower: this.config.attackPower,
      defense: this.config.defense,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId,
      position: this.getPosition(),
      spawnPoint: this.config.spawnPoint
    };
  }

  /**
   * Get network data including mob-specific properties
   */
  getNetworkData(): any {
    return {
      ...super.getNetworkData(),
      mobType: this.config.mobType,
      level: this.config.level,
      currentHealth: this.config.currentHealth,
      maxHealth: this.config.maxHealth,
      aiState: this.config.aiState,
      targetPlayerId: this.config.targetPlayerId
    };
  }
}