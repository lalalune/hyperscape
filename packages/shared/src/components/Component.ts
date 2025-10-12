import type { Entity } from '../entities/Entity';

/**
 * Base Component class for the ECS architecture
 * 
 * Components are pure data containers that store information about entities.
 * They should not contain logic - that belongs in Systems.
 */
export abstract class Component {
  public readonly type: string;
  public readonly entity: Entity;
  public data: Record<string, unknown>;
  
  constructor(type: string, entity: Entity, data: Record<string, unknown> = {}) {
    this.type = type;
    this.entity = entity;
    this.data = { ...data };
  }
  
  // Optional lifecycle methods
  init?(): void;
  update?(delta: number): void;
  fixedUpdate?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
  destroy?(): void;
  
  // Data access helpers - strong type assumption based on caller context
  get<T>(key: string): T | undefined {
    const value = this.data[key];
    return value !== undefined ? value as T : undefined;
  }
  
  set<T>(key: string, value: T): void {
    this.data[key] = value;
  }
  
  has(key: string): boolean {
    return key in this.data;
  }
  
  // Serialize component data
  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      data: { ...this.data }
    };
  }
}

// Component interface for backwards compatibility
export interface IComponent {
  type: string;
  entity: Entity;
  data: Record<string, unknown>;
  init?(): void;
  update?(delta: number): void;
  fixedUpdate?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
  destroy?(): void;
}