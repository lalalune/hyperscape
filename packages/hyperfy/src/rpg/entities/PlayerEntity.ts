/**
 * PlayerEntity - Pure ECS Entity for RPG Player characters
 * Managed by RPGPlayerSystem, no App framework dependencies
 */

import * as THREE from '../../core/extras/three';
import { Entity } from '../../core/entities/Entity';
import type { World, Vector3, EntityData } from '../../types';

export interface PlayerEntityData extends EntityData {
  playerId: string;
  playerName: string;
  level?: number;
  health?: number;
  maxHealth?: number;
  stamina?: number;
  maxStamina?: number;
  combatStyle?: 'attack' | 'strength' | 'defense' | 'ranged';
  equipment?: any;
  inventory?: any;
  skills?: any;
}

export class PlayerEntity extends Entity {
  public readonly playerId: string;
  public readonly playerName: string;
  
  // Core player properties
  private level: number;
  private health: number;
  private maxHealth: number;
  private stamina: number;
  private maxStamina: number;
  private combatStyle: string;
  private isRunning: boolean = false;
  
  // UI elements
  private nameTagUI: THREE.Object3D | null = null;
  private healthBarUI: THREE.Object3D | null = null;
  private staminaBarUI: THREE.Object3D | null = null;
  private mesh: THREE.Mesh | null = null;

  constructor(world: World, data: PlayerEntityData) {
    super(world, data);
    
    // Initialize player-specific data
    this.playerId = data.playerId;
    this.playerName = data.playerName;
    this.level = data.level || 1;
    this.maxHealth = data.maxHealth || 100;
    this.health = data.health || this.maxHealth;
    this.maxStamina = data.maxStamina || 100;
    this.stamina = data.stamina || this.maxStamina;
    this.combatStyle = data.combatStyle || 'attack';
    
    // Add ECS components for player functionality
    this.addComponent('health', {
      current: this.health,
      max: this.maxHealth,
      regenerationRate: 1.0 // HP per second regen out of combat
    });
    
    this.addComponent('stamina', {
      current: this.stamina,
      max: this.maxStamina,
      drainRate: 20.0, // Stamina per second when running
      regenRate: 15.0  // Stamina per second when walking/idle
    });
    
    this.addComponent('combat', {
      isInCombat: false,
      combatStyle: this.combatStyle,
      lastAttackTime: 0,
      target: null,
      attackRange: 1.5,
      attackCooldown: 2000 // ms between attacks
    });
    
    this.addComponent('movement', {
      isMoving: false,
      isRunning: this.isRunning,
      speed: 3.0, // walking speed
      runSpeed: 6.0,
      destination: null,
      path: []
    });
    
    this.addComponent('inventory', {
      items: data.inventory || [],
      capacity: 28, // RuneScape-style 28 slots
      coins: 0
    });
    
    this.addComponent('equipment', {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null // Required for bow usage per GDD
    });
    
    this.addComponent('skills', {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      constitution: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      firemaking: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 }
    });
    
    // Initialize visual representation
    this.createPlayerMesh();
    
    console.log(`[PlayerEntity] Created entity for player ${this.playerName} (${this.playerId})`);
  }

  /**
   * Create the player's visual representation using Three.js
   */
  private async createPlayerMesh(): Promise<void> {
    // Create player capsule geometry (represents the player body)
    const geometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4169e1, // Royal blue for player
      emissive: 0x1a3470,
      emissiveIntensity: 0.2
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.y = 0.8; // Position at feet level
    this.mesh.userData.entity = this;
    this.mesh.userData.entityType = 'player';
    this.mesh.userData.playerId = this.playerId;

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

    // Create player UI elements
    this.createPlayerUI();
  }

  /**
   * Create player UI elements (name tag, health bar, stamina bar)
   */
  private createPlayerUI(): void {
    if (!this.mesh) return;

    const uiContainer = new THREE.Group();
    uiContainer.position.y = 2.5;

    // Name tag
    this.createNameTag(uiContainer);
    
    // Health bar
    this.createHealthBar(uiContainer);
    
    // Stamina bar  
    this.createStaminaBar(uiContainer);

    this.mesh.add(uiContainer);
  }

  /**
   * Create floating name tag above player
   */
  private createNameTag(container: THREE.Group): void {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw name text
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(this.playerName, canvas.width / 2, canvas.height / 2 + 8);
    
    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const nameSprite = new THREE.Sprite(material);
    nameSprite.scale.set(2, 0.5, 1);
    nameSprite.position.y = 0.5;
    
    this.nameTagUI = nameSprite;
    container.add(nameSprite);
  }

  /**
   * Create health bar UI
   */
  private createHealthBar(container: THREE.Group): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 200;
    canvas.height = 20;
    
    this.updateHealthBarCanvas(canvas, context);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const healthSprite = new THREE.Sprite(material);
    healthSprite.scale.set(1.5, 0.15, 1);
    healthSprite.position.y = 0.2;
    
    this.healthBarUI = healthSprite;
    container.add(healthSprite);
  }

  /**
   * Create stamina bar UI  
   */
  private createStaminaBar(container: THREE.Group): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 200;
    canvas.height = 15;
    
    this.updateStaminaBarCanvas(canvas, context);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const staminaSprite = new THREE.Sprite(material);
    staminaSprite.scale.set(1.5, 0.1, 1);
    staminaSprite.position.y = 0.0;
    
    this.staminaBarUI = staminaSprite;
    container.add(staminaSprite);
  }

  /**
   * Update health bar visual representation
   */
  private updateHealthBarCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    const healthPercent = this.health / this.maxHealth;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Health bar
    const barWidth = (canvas.width - 4) * healthPercent;
    const healthColor = healthPercent > 0.6 ? '#4ade80' : healthPercent > 0.3 ? '#fbbf24' : '#ef4444';
    context.fillStyle = healthColor;
    context.fillRect(2, 2, barWidth, canvas.height - 4);
    
    // Border
    context.strokeStyle = 'white';
    context.lineWidth = 1;
    context.strokeRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Update stamina bar visual representation
   */
  private updateStaminaBarCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    const staminaPercent = this.stamina / this.maxStamina;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Stamina bar
    const barWidth = (canvas.width - 4) * staminaPercent;
    context.fillStyle = '#3b82f6'; // Blue for stamina
    context.fillRect(2, 2, barWidth, canvas.height - 4);
    
    // Border
    context.strokeStyle = 'white';
    context.lineWidth = 1;
    context.strokeRect(0, 0, canvas.width, canvas.height);
  }

  // Player-specific methods that can be called by Systems

  /**
   * Set player health and update UI
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
      const canvas = (this.healthBarUI.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      this.updateHealthBarCanvas(canvas, context);
      (this.healthBarUI.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    }
    
    // Emit health change event
    this.emit('health-changed', { 
      playerId: this.playerId, 
      health: this.health, 
      maxHealth: this.maxHealth 
    });
  }

  /**
   * Set player stamina and update UI
   */
  public setStamina(stamina: number): void {
    this.stamina = Math.max(0, Math.min(this.maxStamina, stamina));
    
    // Update stamina component
    const staminaComponent = this.getComponent('stamina');
    if (staminaComponent) {
      staminaComponent.data.current = this.stamina;
    }
    
    // Update UI if present
    if (this.staminaBarUI && this.staminaBarUI instanceof THREE.Sprite) {
      const canvas = (this.staminaBarUI.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      this.updateStaminaBarCanvas(canvas, context);
      (this.staminaBarUI.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    }
    
    // Emit stamina change event
    this.emit('stamina-changed', { 
      playerId: this.playerId, 
      stamina: this.stamina, 
      maxStamina: this.maxStamina 
    });
  }

  /**
   * Set running state
   */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    
    // Update movement component
    const movementComponent = this.getComponent('movement');
    if (movementComponent) {
      movementComponent.data.isRunning = running;
    }
  }

  /**
   * Get current player stats for external systems
   */
  public getStats() {
    return {
      playerId: this.playerId,
      playerName: this.playerName,
      level: this.level,
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      combatStyle: this.combatStyle,
      isRunning: this.isRunning,
      position: this.position
    };
  }

  /**
   * Handle player death
   */
  public die(): void {
    console.log(`[PlayerEntity] Player ${this.playerName} has died`);
    
    // Update health to 0
    this.setHealth(0);
    
    // Update combat state
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.isInCombat = false;
      combatComponent.data.target = null;
    }
    
    // Emit death event for other systems to handle
    this.emit('player-died', {
      playerId: this.playerId,
      position: this.position,
      inventory: this.getComponent('inventory')?.data
    });
  }

  /**
   * Respawn player at specified location
   */
  public respawn(position: Vector3, health?: number): void {
    console.log(`[PlayerEntity] Respawning player ${this.playerName} at`, position);
    
    // Set position
    this.position = position;
    
    // Restore health
    this.setHealth(health || this.maxHealth);
    
    // Restore stamina
    this.setStamina(this.maxStamina);
    
    // Emit respawn event
    this.emit('player-respawned', {
      playerId: this.playerId,
      position: this.position
    });
  }

  /**
   * Clean up when entity is destroyed
   */
  public destroy(): void {
    console.log(`[PlayerEntity] Destroying player entity ${this.playerName}`);
    
    // Clean up UI elements
    if (this.nameTagUI) {
      this.nameTagUI.removeFromParent();
      this.nameTagUI = null;
    }
    if (this.healthBarUI) {
      this.healthBarUI.removeFromParent();
      this.healthBarUI = null;
    }
    if (this.staminaBarUI) {
      this.staminaBarUI.removeFromParent();
      this.staminaBarUI = null;
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