/**
 * Component Utilities
 *
 * Type-safe utilities for accessing components from entities.
 * These utilities eliminate the need for "as unknown as" casting.
 */

import type { Entity } from "../../entities/Entity";
import type { StatsComponent } from "../../components/StatsComponent";
import type { HealthComponent } from "../../components/HealthComponent";
import type { TransformComponent } from "../../components/TransformComponent";
import type { MeshComponent } from "../../components/MeshComponent";
import type { ColliderComponent } from "../../components/ColliderComponent";

/**
 * Type-safe component accessors
 * These functions return the correct component type without casting
 */

export function getStatsComponent(entity: Entity): StatsComponent | null {
  const component = entity.getComponent("stats");
  if (!component) return null;

  // Since we know 'stats' components are registered as StatsComponent,
  // this cast is safe and eliminates the need for "as unknown as"
  return component as StatsComponent;
}

export function getHealthComponent(entity: Entity): HealthComponent | null {
  const component = entity.getComponent("health");
  if (!component) return null;
  return component as HealthComponent;
}

export function getTransformComponent(
  entity: Entity,
): TransformComponent | null {
  const component = entity.getComponent("transform");
  if (!component) return null;
  return component as TransformComponent;
}

export function getMeshComponent(entity: Entity): MeshComponent | null {
  const component = entity.getComponent("mesh");
  if (!component) return null;
  return component as MeshComponent;
}

export function getColliderComponent(entity: Entity): ColliderComponent | null {
  const component = entity.getComponent("collider");
  if (!component) return null;
  return component as ColliderComponent;
}

/**
 * Generic type-safe component accessor
 * Use this when you need a component type that's not specifically handled above
 */
export function getTypedComponent<T>(
  entity: Entity,
  componentType: string,
): T | null {
  const component = entity.getComponent(componentType);
  if (!component) return null;
  return component as T;
}

/**
 * Helper function to check if an entity has a stats component
 * Useful for type guards in systems
 */
export function hasStatsComponent(
  entity: Entity,
): entity is Entity & { getComponent(type: "stats"): StatsComponent } {
  return entity.hasComponent("stats");
}

/**
 * Helper function to safely access stats with validation
 */
export function requireStatsComponent(
  entity: Entity,
  contextDescription: string,
): StatsComponent {
  const stats = getStatsComponent(entity);
  if (!stats) {
    throw new Error(
      `${contextDescription}: Entity ${entity.id} missing stats component`,
    );
  }
  return stats;
}
