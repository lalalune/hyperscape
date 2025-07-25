/**
 * GoblinEntity - Pure ECS Entity for RPG Goblin mobs
 * Managed by RPGMobSystem, no App framework dependencies
 */

import * as THREE from '../../core/extras/three';
import { Entity } from '../../core/entities/Entity';
import type { World, Vector3, EntityData } from '../../types';

export interface GoblinEntityData extends EntityData {
  level?: number;
  health?: number;
  maxHealth?: number;
  damage?: number;
  lootTable?: string[];
  aggroRadius?: number;
  respawnTime?: number;
  spawnPosition?: Vector3;
}

export class GoblinEntity extends Entity {
  // Goblin-specific properties
  private level: number;
  private health: number;
  private maxHealth: number;
  private damage: number;
  private lootTable: string[];
  private aggroRadius: number;
  private respawnTime: number;
  private spawnPosition: Vector3;
  
  // State tracking
  private isDead: boolean = false;
  private deathTime: number = 0;
  private targetPlayerId: string | null = null;
  private lastAttackTime: number = 0;
  
  // UI elements
  private nameTagUI: THREE.Object3D | null = null;
  private healthBarUI: THREE.Object3D | null = null;
  private mesh: THREE.Mesh | null = null;

  constructor(world: World, data: GoblinEntityData) {
    super(world, data);
    
    // Initialize goblin properties from GDD requirements
    this.level = data.level || 1;
    this.maxHealth = data.maxHealth || 50;
    this.health = data.health || this.maxHealth;
    this.damage = data.damage || 5;
    this.lootTable = data.lootTable || ['coins', 'bronze_sword'];
    this.aggroRadius = data.aggroRadius || 10;
    this.respawnTime = data.respawnTime || 30; // 30 seconds per GDD
    this.spawnPosition = data.spawnPosition || this.position;
    
    // Add ECS components for goblin functionality
    this.addComponent('health', {
      current: this.health,
      max: this.maxHealth,
      regenerationRate: 0 // Mobs don't regenerate health per GDD
    });
    
    this.addComponent('combat', {
      isInCombat: false,
      target: null,
      damage: this.damage,
      attackRange: 1.5,
      attackCooldown: 2000, // 2 seconds between attacks
      lastAttackTime: 0,
      aggroRadius: this.aggroRadius,
      isAggressive: true // Goblins are aggressive per GDD
    });
    
    this.addComponent('ai', {
      type: 'aggressive_mob',
      state: 'idle', // idle, pursuing, attacking, returning
      targetId: null,
      lastTargetPosition: null,
      chaseDistance: this.aggroRadius * 1.5, // Chase slightly farther than aggro
      returnDistance: this.aggroRadius * 2, // Return to spawn if too far
      patrolRadius: 5 // Small patrol around spawn point
    });
    
    this.addComponent('loot', {
      drops: this.lootTable,
      dropChance: 1.0, // 100% chance to drop something per GDD
      coinDropMin: 1,
      coinDropMax: 5,
      rareDropChance: 0.1 // 10% chance for equipment drops
    });
    
    this.addComponent('respawn', {
      isDead: this.isDead,
      deathTime: this.deathTime,
      respawnTime: this.respawnTime,
      spawnPosition: this.spawnPosition,
      hasRespawned: false
    });
    
    this.addComponent('movement', {
      isMoving: false,
      speed: 2.0, // Goblins move slower than players
      destination: null,
      path: [],
      maxSpeed: 2.0
    });
    
    // Initialize visual representation
    this.createGoblinMesh();
    
    console.log(`[GoblinEntity] Created level ${this.level} goblin with ${this.health}/${this.maxHealth} HP`);
  }

  /**
   * Create the goblin's visual representation using Three.js
   */
  private async createGoblinMesh(): Promise<void> {
    // Create goblin box geometry (simple representation)
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4a7c59, // Dark green for goblin per GDD color scheme
      emissive: 0x1a3c29,
      emissiveIntensity: 0.2
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.y = 0.8; // Position at ground level
    this.mesh.userData.entity = this;
    this.mesh.userData.entityType = 'goblin';
    this.mesh.userData.mobType = 'goblin';
    this.mesh.userData.level = this.level;

    // Add mesh to the entity's node
    this.node.add(this.mesh);

    // Add mesh component to ECS
    this.addComponent('mesh', {
      mesh: this.mesh,
      geometry: geometry,
      material: material,
      castShadow: true,
      receiveShadow: true
    });

    // Create mob UI elements
    this.createGoblinUI();
  }

  /**
   * Create goblin UI elements (name tag, health bar)
   */
  private createGoblinUI(): void {
    if (!this.mesh) return;

    const uiContainer = new THREE.Group();
    uiContainer.position.y = 2.2;

    // Name tag showing "Goblin (Lvl X)"
    this.createNameTag(uiContainer);
    
    // Health bar (only show when damaged)
    this.createHealthBar(uiContainer);

    this.mesh.add(uiContainer);
  }

  /**
   * Create floating name tag above goblin
   */
  private createNameTag(container: THREE.Group): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 48;
    
    // Draw name text with level
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ff6b6b'; // Red text for hostile mob
    context.font = '20px Arial';
    context.textAlign = 'center';
    context.fillText(`Goblin (Lvl ${this.level})`, canvas.width / 2, canvas.height / 2 + 6);
    
    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const nameSprite = new THREE.Sprite(material);
    nameSprite.scale.set(1.8, 0.4, 1);
    nameSprite.position.y = 0.4;
    
    this.nameTagUI = nameSprite;
    container.add(nameSprite);
  }

  /**
   * Create health bar UI (only visible when damaged or in combat)
   */
  private createHealthBar(container: THREE.Group): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 160;
    canvas.height = 16;
    
    this.updateHealthBarCanvas(canvas, context);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const healthSprite = new THREE.Sprite(material);
    healthSprite.scale.set(1.2, 0.12, 1);
    healthSprite.position.y = 0.1;
    
    // Initially hide health bar (only show when damaged)
    healthSprite.visible = this.health < this.maxHealth;
    
    this.healthBarUI = healthSprite;
    container.add(healthSprite);
  }

  /**
   * Update health bar visual representation
   */
  private updateHealthBarCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    const healthPercent = this.health / this.maxHealth;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Health bar
    const barWidth = (canvas.width - 4) * healthPercent;
    const healthColor = healthPercent > 0.6 ? '#4ade80' : healthPercent > 0.3 ? '#fbbf24' : '#ef4444';
    context.fillStyle = healthColor;
    context.fillRect(2, 2, barWidth, canvas.height - 4);
    
    // Border
    context.strokeStyle = '#ff6b6b'; // Red border for hostile mob
    context.lineWidth = 1;
    context.strokeRect(0, 0, canvas.width, canvas.height);
  }

  // Goblin-specific methods that can be called by Systems

  /**
   * Set goblin health and update UI
   */
  public setHealth(health: number): void {
    this.health = Math.max(0, Math.min(this.maxHealth, health));
    
    // Update health component
    const healthComponent = this.getComponent('health');
    if (healthComponent) {
      healthComponent.data.current = this.health;
    }
    
    // Update UI if present
    if (this.healthBarUI && this.healthBarUI instanceof THREE.Sprite) {
      // Show health bar when damaged
      this.healthBarUI.visible = this.health < this.maxHealth;
      
      const canvas = (this.healthBarUI.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      this.updateHealthBarCanvas(canvas, context);
      (this.healthBarUI.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    }
    
    // Check for death
    if (this.health <= 0 && !this.isDead) {
      this.die();
    }
    
    // Emit health change event
    this.emit('health-changed', { 
      entityId: this.id, 
      health: this.health, 
      maxHealth: this.maxHealth 
    });
  }

  /**
   * Handle goblin death per GDD requirements
   */
  public die(): void {
    if (this.isDead) return;
    
    console.log(`[GoblinEntity] Goblin ${this.id} has died`);
    
    this.isDead = true;
    this.deathTime = Date.now();
    
    // Update respawn component
    const respawnComponent = this.getComponent('respawn');
    if (respawnComponent) {
      respawnComponent.data.isDead = true;
      respawnComponent.data.deathTime = this.deathTime;
    }
    
    // Update AI state
    const aiComponent = this.getComponent('ai');
    if (aiComponent) {
      aiComponent.data.state = 'dead';
      aiComponent.data.targetId = null;
    }
    
    // Update combat state
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.isInCombat = false;
      combatComponent.data.target = null;
    }
    
    // Hide mesh (corpse will be handled by RPGDeathSystem)
    if (this.mesh) {
      this.mesh.visible = false;
    }
    
    // Emit death event for loot drop and other systems
    this.emit('mob-died', {
      entityId: this.id,
      mobType: 'goblin',
      level: this.level,
      position: this.position,
      lootTable: this.lootTable,
      killerId: this.targetPlayerId // Who killed this goblin
    });
  }

  /**
   * Respawn the goblin at its spawn position
   */
  public respawn(): void {
    if (!this.isDead) return;
    
    console.log(`[GoblinEntity] Respawning goblin ${this.id}`);
    
    // Reset states
    this.isDead = false;
    this.deathTime = 0;
    this.targetPlayerId = null;
    this.lastAttackTime = 0;
    
    // Reset health
    this.setHealth(this.maxHealth);
    
    // Reset position to spawn point
    this.position = { ...this.spawnPosition };
    
    // Update components
    const respawnComponent = this.getComponent('respawn');
    if (respawnComponent) {
      respawnComponent.data.isDead = false;
      respawnComponent.data.deathTime = 0;
      respawnComponent.data.hasRespawned = true;
    }
    
    const aiComponent = this.getComponent('ai');
    if (aiComponent) {
      aiComponent.data.state = 'idle';
      aiComponent.data.targetId = null;
    }
    
    // Show mesh again
    if (this.mesh) {
      this.mesh.visible = true;
    }
    
    // Emit respawn event
    this.emit('mob-respawned', {
      entityId: this.id,
      mobType: 'goblin',
      position: this.position
    });
  }

  /**
   * Set aggro target (player to attack)
   */
  public setTarget(playerId: string | null): void {
    this.targetPlayerId = playerId;
    
    // Update AI component
    const aiComponent = this.getComponent('ai');
    if (aiComponent) {
      aiComponent.data.targetId = playerId;
      aiComponent.data.state = playerId ? 'pursuing' : 'idle';
    }
    
    // Update combat component
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.target = playerId;
      combatComponent.data.isInCombat = !!playerId;
    }
  }

  /**
   * Check if goblin can attack (cooldown check)
   */
  public canAttack(): boolean {
    const now = Date.now();
    const combatComponent = this.getComponent('combat');
    const cooldown = combatComponent?.data.attackCooldown || 2000;
    
    return (now - this.lastAttackTime) >= cooldown;
  }

  /**
   * Perform attack (called by combat system)
   */
  public attack(targetId: string): number {
    if (!this.canAttack() || this.isDead) return 0;
    
    this.lastAttackTime = Date.now();
    
    // Update combat component
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.lastAttackTime = this.lastAttackTime;
    }
    
    // Emit attack event
    this.emit('mob-attack', {
      attackerId: this.id,
      targetId: targetId,
      damage: this.damage,
      mobType: 'goblin'
    });
    
    console.log(`[GoblinEntity] Goblin ${this.id} attacks player ${targetId} for ${this.damage} damage`);
    
    return this.damage;
  }

  /**
   * Get current goblin stats for external systems
   */
  public getStats() {
    return {
      entityId: this.id,
      mobType: 'goblin',
      level: this.level,
      health: this.health,
      maxHealth: this.maxHealth,
      damage: this.damage,
      isDead: this.isDead,
      targetPlayerId: this.targetPlayerId,
      position: this.position,
      spawnPosition: this.spawnPosition,
      aggroRadius: this.aggroRadius
    };
  }

  /**
   * Clean up when entity is destroyed
   */
  public destroy(): void {
    console.log(`[GoblinEntity] Destroying goblin entity ${this.id}`);
    
    // Clean up UI elements
    if (this.nameTagUI) {
      this.nameTagUI.removeFromParent();
      this.nameTagUI = null;
    }
    if (this.healthBarUI) {
      this.healthBarUI.removeFromParent();
      this.healthBarUI = null;
    }
    
    // Clean up mesh
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh = null;
    }
    
    // Call parent destroy
    super.destroy();
  }
}