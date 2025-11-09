/**
 * Interaction Component for entities
 * Stores interaction-related data for entities that can be interacted with
 */

import { Component } from "./Component";
import type { InteractionComponentData } from "../types/components";
import type { Entity } from "../entities/Entity";

// Type moved to shared types/components.ts

export class InteractionComponent extends Component {
  constructor(entity: Entity, data?: InteractionComponentData) {
    // Initialize default values
    const defaultData: InteractionComponentData = {
      type: "",
      interactable: true,
      distance: 2.0,
      prompt: "Interact",
      description: "",
      cooldown: 0,
      lastInteractionTime: 0,
      usesRemaining: -1, // -1 = infinite uses
      maxUses: -1,
      requiredItem: null,
      consumesItem: false,
      effect: null,
    };

    // Merge provided data with defaults
    const componentData = { ...defaultData, ...data };

    super("interaction", entity, componentData as Record<string, unknown>);
  }

  update(_deltaTime: number): void {
    // Interaction logic is handled by InteractionSystem
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      ...this.data,
    };
  }
}
