/**
 * Visual Component for entities
 * Stores visual-related data for entities including mesh and UI elements
 */

import { Component } from "./Component";
import type { Entity } from "../entities/Entity";
import type THREE from "../extras/three";
import type { VisualComponentData } from "../types/components";

// Type moved to shared types/components.ts

export class VisualComponent extends Component {
  public mesh: THREE.Object3D | null = null;
  public nameSprite: THREE.Object3D | null = null;
  public healthSprite: THREE.Object3D | null = null;
  public isVisible: boolean = true;

  constructor(entity: Entity, data?: VisualComponentData) {
    super("visual", entity, data as Record<string, unknown>);

    if (data) {
      if (data.mesh !== undefined) this.mesh = data.mesh;
      if (data.nameSprite !== undefined) this.nameSprite = data.nameSprite;
      if (data.healthSprite !== undefined)
        this.healthSprite = data.healthSprite;
      if (data.isVisible !== undefined) this.isVisible = data.isVisible;
    }
  }

  update(_deltaTime: number): void {
    // Visual updates are handled by rendering systems
  }

  serialize(): Record<string, unknown> {
    // Don't serialize THREE.js objects, they'll be recreated on load
    return {
      type: this.type,
      mesh: null,
      nameSprite: null,
      healthSprite: null,
      isVisible: this.isVisible,
    };
  }
}
