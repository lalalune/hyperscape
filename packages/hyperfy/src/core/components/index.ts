/**
 * Core ECS Components
 * 
 * These are the fundamental components used in the pure ECS architecture.
 * Components are pure data containers - logic belongs in Systems.
 */

export { Component, type IComponent } from './Component';
export { TransformComponent } from './TransformComponent';
export { MeshComponent } from './MeshComponent';
export { HealthComponent } from './HealthComponent';
export { ColliderComponent } from './ColliderComponent';

// Component type registry for dynamic creation
import { Component } from './Component';
import { TransformComponent } from './TransformComponent';
import { MeshComponent } from './MeshComponent';
import { HealthComponent } from './HealthComponent';
import { ColliderComponent } from './ColliderComponent';
import type { Entity } from '../entities/Entity';

export interface ComponentConstructor {
  new (entity: Entity, data?: any): Component;
}

export const ComponentRegistry: Record<string, ComponentConstructor> = {
  transform: TransformComponent as ComponentConstructor,
  mesh: MeshComponent as ComponentConstructor,
  health: HealthComponent as ComponentConstructor,
  collider: ColliderComponent as ComponentConstructor,
};

// Helper function to create components dynamically
export function createComponent(type: string, entity: Entity, data?: any): Component | null {
  const ComponentClass = ComponentRegistry[type];
  if (!ComponentClass) {
    console.warn(`Unknown component type: ${type}`);
    return null;
  }
  
  return new ComponentClass(entity, data);
}

// Helper function to register new component types
export function registerComponent(type: string, componentClass: ComponentConstructor): void {
  ComponentRegistry[type] = componentClass;
  console.log(`[ECS] Registered component type: ${type}`);
}