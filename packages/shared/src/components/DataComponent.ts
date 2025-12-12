/**
 * Generic data component for entities
 * Used for components that are primarily data containers without complex behavior
 */

import { Component } from "./Component";
import type { Entity } from "../entities/Entity";

export class DataComponent extends Component {
  constructor(entity: Entity, data?: Record<string, unknown>) {
    super("data", entity, {
      ...data,
    });
  }

  // No special initialization needed for data components
  init(): void {
    // Data components are passive containers
  }

  // No special cleanup needed
  destroy(): void {
    // Data components don't manage resources
  }
}
