/**
 * Usage Component for entities
 * Tracks usage limits and regeneration for interactable entities
 */

import { Component } from './Component';
import type { UsageComponentData } from '../types/components'
import type { Entity } from '../entities/Entity';

// Type moved to shared types/components.ts

export class UsageComponent extends Component {
  constructor(entity: Entity, data?: UsageComponentData) {
    // Initialize default values
    const defaultData: UsageComponentData = {
      usesRemaining: -1, // -1 = infinite uses
      maxUses: -1,
      isExhausted: false,
      resetTime: null,
      lastResetTime: Date.now(),
      regenerateRate: 0
    };
    
    // Merge provided data with defaults
    const componentData = { ...defaultData, ...data };
    
    super('usage', entity, componentData as Record<string, unknown>);
  }

  update(_deltaTime: number): void {
    // Usage regeneration logic is handled by systems if needed
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      ...this.data
    };
  }
}