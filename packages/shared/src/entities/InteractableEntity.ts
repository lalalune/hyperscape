/**
 * InteractableEntity - Base class for entities that can be interacted with
 * 
 * Extends Entity to provide interaction-specific functionality including:
 * - Standardized interaction handling
 * - Interaction prompts and descriptions
 * - Range checking for interactions
 * - Usage tracking and cooldowns
 * - Interaction effects and animations
 * 
 * Used by: ItemEntity, ResourceEntity, HeadstoneEntity, NPCEntity (non-combat)
 */

import { Entity } from './Entity';
import type { World } from '../World';
import type { EntityConfig, EntityInteractionData } from '../types/entities';
import type { Position3D } from '../types/core';

export interface InteractableConfig extends EntityConfig {
  interaction?: {
    prompt?: string;
    description?: string;
    range?: number;
    cooldown?: number;
    usesRemaining?: number;
    maxUses?: number;
    requiresItem?: string;
    consumesItem?: boolean;
    effect?: string;
  };
}

export abstract class InteractableEntity extends Entity {
  // Interaction properties
  protected interactionPrompt: string = 'Interact';
  protected interactionDescription: string = '';
  protected interactionRange: number = 2.0;
  protected interactionCooldown: number = 0;
  protected lastInteractionTime: number = 0;
  
  // Usage tracking
  protected usesRemaining: number = -1; // -1 = infinite uses
  protected maxUses: number = -1;
  protected requiredItem: string | null = null;
  protected consumesItem: boolean = false;
  protected interactionEffect: string | null = null;

  constructor(world: World, config: InteractableConfig) {
    super(world, config);
    
    // Initialize interaction properties from config
    if (config.interaction) {
      this.interactionPrompt = config.interaction.prompt || this.interactionPrompt;
      this.interactionDescription = config.interaction.description || this.interactionDescription;
      this.interactionRange = config.interaction.range || this.interactionRange;
      this.interactionCooldown = config.interaction.cooldown || this.interactionCooldown;
      this.usesRemaining = config.interaction.usesRemaining ?? this.usesRemaining;
      this.maxUses = config.interaction.maxUses ?? this.maxUses;
      this.requiredItem = config.interaction.requiresItem || null;
      this.consumesItem = config.interaction.consumesItem || false;
      this.interactionEffect = config.interaction.effect || null;
    }
    
    this.initializeInteraction();
  }

  protected initializeInteraction(): void {
    // Override interaction component with enhanced data
    this.addComponent('interaction', {
      type: this.type,
      interactable: true,
      distance: this.interactionRange,
      prompt: this.interactionPrompt,
      description: this.interactionDescription,
      cooldown: this.interactionCooldown,
      lastInteractionTime: 0,
      usesRemaining: this.usesRemaining,
      maxUses: this.maxUses,
      requiredItem: this.requiredItem,
      consumesItem: this.consumesItem,
      effect: this.interactionEffect
    });
    
    // Add usage tracking component if there are limited uses
    if (this.maxUses > 0) {
      this.addComponent('usage', {
        usesRemaining: this.usesRemaining,
        maxUses: this.maxUses,
        isExhausted: this.usesRemaining <= 0,
        resetTime: null // Can be set for items that regenerate uses
      });
    }
  }

  // === Interaction Methods ===

  /**
   * Check if a player can interact with this entity
   */
  public canInteract(playerId: string, playerPosition: Position3D): boolean {
    // Check if entity is destroyed
    if (this.destroyed) {
      return false;
    }
    
    // Check usage limits
    if (this.maxUses > 0 && this.usesRemaining <= 0) {
      return false;
    }
    
    // Check cooldown
    const now = Date.now();
    if (this.interactionCooldown > 0 && 
        (now - this.lastInteractionTime) < this.interactionCooldown) {
      return false;
    }
    
    // Check distance
    const entityPos = this.getPosition();
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - entityPos.x, 2) +
      Math.pow(playerPosition.z - entityPos.z, 2)
    );
    
    if (distance > this.interactionRange) {
      return false;
    }
    
    // Additional checks can be overridden by subclasses
    return this.canInteractCustom(playerId, playerPosition);
  }

  /**
   * Custom interaction validation - can be overridden by subclasses
   */
  protected canInteractCustom(_playerId: string, _playerPosition: Position3D): boolean {
    return true;
  }

  /**
   * Handle interaction with this entity
   */
  protected async onInteract(data: EntityInteractionData): Promise<void> {
    const playerPos = data.playerPosition || data.position;
    
    // Validate interaction
    if (!this.canInteract(data.playerId, playerPos)) {
      this.handleInteractionDenied(data);
      return;
    }
    
    // Update interaction tracking
    this.lastInteractionTime = Date.now();
    
    // Consume use if limited
    if (this.maxUses > 0) {
      this.usesRemaining--;
      
      // Update usage component
      const usageComponent = this.getComponent('usage');
      if (usageComponent) {
        usageComponent.data.usesRemaining = this.usesRemaining;
        usageComponent.data.isExhausted = this.usesRemaining <= 0;
      }
    }
    
    // Update interaction component
    const interactionComponent = this.getComponent('interaction');
    if (interactionComponent) {
      interactionComponent.data.lastInteractionTime = this.lastInteractionTime;
      interactionComponent.data.usesRemaining = this.usesRemaining;
    }
    
    // Emit interaction event
    this.emit('interaction', {
      entityId: this.id,
      playerId: data.playerId,
      interactionType: data.interactionType,
      position: this.getPosition(),
      usesRemaining: this.usesRemaining
    });
    
    // Trigger interaction effect if specified
    if (this.interactionEffect) {
      this.triggerEffect(this.interactionEffect, data);
    }
    
    // Call custom interaction logic
    await this.handleInteraction(data);
    
    // Handle exhaustion if no uses remaining
    if (this.maxUses > 0 && this.usesRemaining <= 0) {
      await this.handleExhaustion(data);
    }
  }

  /**
   * Handle when interaction is denied
   */
  protected handleInteractionDenied(data: EntityInteractionData): void {
    let reason = 'Cannot interact';
    
    if (this.maxUses > 0 && this.usesRemaining <= 0) {
      reason = 'No uses remaining';
    } else if (this.interactionCooldown > 0 && 
               (Date.now() - this.lastInteractionTime) < this.interactionCooldown) {
      reason = 'On cooldown';
    } else {
      reason = 'Too far away';
    }
    
    this.emit('interaction-denied', {
      entityId: this.id,
      playerId: data.playerId,
      reason,
      position: this.getPosition()
    });
  }

  /**
   * Trigger a visual or audio effect
   */
  protected triggerEffect(effectName: string, data: EntityInteractionData): void {
    this.emit('effect', {
      entityId: this.id,
      playerId: data.playerId,
      effect: effectName,
      position: this.getPosition()
    });
  }

  /**
   * Handle when entity is exhausted (no uses remaining)
   */
  protected async handleExhaustion(data: EntityInteractionData): Promise<void> {
    this.emit('exhausted', {
      entityId: this.id,
      playerId: data.playerId,
      position: this.getPosition()
    });
    
    // Default behavior: make entity non-interactable
    const interactionComponent = this.getComponent('interaction');
    if (interactionComponent) {
      interactionComponent.data.interactable = false;
    }
  }

  /**
   * Reset uses to maximum (for respawning resources, etc.)
   */
  public resetUses(): void {
    if (this.maxUses > 0) {
      this.usesRemaining = this.maxUses;
      
      const usageComponent = this.getComponent('usage');
      if (usageComponent) {
        usageComponent.data.usesRemaining = this.usesRemaining;
        usageComponent.data.isExhausted = false;
      }
      
      const interactionComponent = this.getComponent('interaction');
      if (interactionComponent) {
        interactionComponent.data.usesRemaining = this.usesRemaining;
        interactionComponent.data.interactable = true;
      }
      
      this.emit('uses-reset', {
        entityId: this.id,
        usesRemaining: this.usesRemaining
      });
    }
  }

  /**
   * Get interaction information for UI display
   */
  public getInteractionInfo(): {
    prompt: string;
    description: string;
    range: number;
    usesRemaining: number;
    maxUses: number;
    canInteract: boolean;
  } {
    return {
      prompt: this.interactionPrompt,
      description: this.interactionDescription,
      range: this.interactionRange,
      usesRemaining: this.usesRemaining,
      maxUses: this.maxUses,
      canInteract: this.usesRemaining !== 0 && !this.destroyed
    };
  }

  // === Abstract Methods ===

  /**
   * Custom interaction handling - must be implemented by subclasses
   */
  public abstract handleInteraction(data: EntityInteractionData): Promise<void>;

  /**
   * Create the entity's visual representation - from Entity
   */
  protected abstract createMesh(): Promise<void>;

  // === Getters ===

  public getInteractionPrompt(): string { return this.interactionPrompt; }
  public getInteractionDescription(): string { return this.interactionDescription; }
  public getInteractionRange(): number { return this.interactionRange; }
  public getUsesRemaining(): number { return this.usesRemaining; }
  public getMaxUses(): number { return this.maxUses; }
  public getRequiredItem(): string | null { return this.requiredItem; }
  public getConsumesItem(): boolean { return this.consumesItem; }
}