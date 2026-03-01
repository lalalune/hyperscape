import type { PxRigidBody, PxShape } from "../types/systems/physics";
import type { Entity } from "../entities/Entity";
import THREE from "../extras/three/three";
import { Component } from "./Component";

// Use THREE types directly since they are the actual instances
type Vector3 = THREE.Vector3;

/**
 * Collider Component
 *
 * Manages physics collision detection for entities.
 * Integrates with the physics system for collision events.
 */
export class ColliderComponent extends Component {
  private physicsHandle?: PxRigidBody | PxShape;
  private eventHandlers: Array<{
    event: string;
    handler: (...args: unknown[]) => void;
  }> = [];

  constructor(
    entity: Entity,
    data: {
      type?: "box" | "sphere" | "capsule" | "mesh";
      size?: Vector3 | { x?: number; y?: number; z?: number };
      radius?: number;
      height?: number;
      isTrigger?: boolean;
      material?: {
        friction?: number;
        restitution?: number;
        density?: number;
      };
      layers?: string[];
      [key: string]: unknown;
    } = {},
  ) {
    const sizeInput = data.size || { x: 1, y: 1, z: 1 };
    // Convert to Vector3 - both types have x, y, z properties
    const sizeVector = new THREE.Vector3(
      sizeInput.x !== undefined ? sizeInput.x : 1,
      sizeInput.y !== undefined ? sizeInput.y : 1,
      sizeInput.z !== undefined ? sizeInput.z : 1,
    );
    super("collider", entity, {
      type: "box",
      size: sizeVector,
      radius: 0.5,
      height: 1,
      isTrigger: false,
      material: {
        friction: 0.5,
        restitution: 0.3,
        density: 1.0,
      },
      layers: ["default"],
      ...data,
    });
  }

  get colliderType(): "box" | "sphere" | "capsule" | "mesh" {
    return this.get<"box" | "sphere" | "capsule" | "mesh">("type") || "box";
  }

  set colliderType(value: "box" | "sphere" | "capsule" | "mesh") {
    this.set("type", value);
    this.updatePhysicsShape();
  }

  get size(): Vector3 {
    return this.get<Vector3>("size")!;
  }

  set size(value: Vector3 | { x: number; y: number; z: number }) {
    const currentSize = this.get<Vector3>("size");
    // Both types have x, y, z properties - use them directly
    if (currentSize) {
      currentSize.set(value.x, value.y, value.z);
    } else {
      this.set("size", new THREE.Vector3(value.x, value.y, value.z));
    }
    this.updatePhysicsShape();
  }

  get radius(): number {
    return this.get<number>("radius") || 0.5;
  }

  set radius(value: number) {
    this.set("radius", Math.max(0, value));
    this.updatePhysicsShape();
  }

  get height(): number {
    return this.get<number>("height") || 1;
  }

  set height(value: number) {
    this.set("height", Math.max(0, value));
    this.updatePhysicsShape();
  }

  get isTrigger(): boolean {
    return this.get<boolean>("isTrigger") || false;
  }

  set isTrigger(value: boolean) {
    this.set("isTrigger", value);
    this.updatePhysicsProperties();
  }

  get material(): { friction: number; restitution: number; density: number } {
    return (
      this.get<{ friction: number; restitution: number; density: number }>(
        "material",
      ) || {
        friction: 0.5,
        restitution: 0.3,
        density: 1.0,
      }
    );
  }

  set material(value: {
    friction?: number;
    restitution?: number;
    density?: number;
  }) {
    const current = this.material;
    this.set("material", {
      ...current,
      ...value,
    });
    this.updatePhysicsProperties();
  }

  get layers(): string[] {
    return this.get<string[]>("layers") || ["default"];
  }

  set layers(value: string[]) {
    this.set("layers", value);
    this.updatePhysicsProperties();
  }

  // Get physics handle (for advanced use)
  getPhysicsHandle(): PxRigidBody | PxShape | undefined {
    return this.physicsHandle;
  }

  /**
   * Check if collider is currently colliding with another entity.
   *
   * Note: Direct collision queries are not supported. Use collision events:
   * - onCollisionEnter/Exit for physical collisions
   * - onTriggerEnter/Exit for trigger volumes
   * - Or use world.physics.overlap() for one-shot queries
   */
  isCollidingWith(_otherEntity: Entity): boolean {
    // Collision queries must be done through Physics system's overlap methods
    // or tracked via collision events - this component doesn't maintain state
    return false;
  }

  /**
   * Get all entities currently colliding with this one.
   *
   * Note: Use collision events to track active collisions, or use
   * world.physics.overlapSphere/Box/Capsule for one-shot queries.
   */
  getCollidingEntities(): Entity[] {
    // Collision tracking must be done through Physics system events
    // This component doesn't maintain active collision state
    return [];
  }

  // Set collision event callbacks
  onCollisionEnter(callback: (other: Entity) => void): void {
    const event = `collision:enter:${this.entity.id}`;
    const handler = (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    };
    this.entity.world.on(event, handler);
    this.eventHandlers.push({ event, handler });
  }

  onCollisionExit(callback: (other: Entity) => void): void {
    const event = `collision:exit:${this.entity.id}`;
    const handler = (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    };
    this.entity.world.on(event, handler);
    this.eventHandlers.push({ event, handler });
  }

  onTriggerEnter(callback: (other: Entity) => void): void {
    const event = `trigger:enter:${this.entity.id}`;
    const handler = (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    };
    this.entity.world.on(event, handler);
    this.eventHandlers.push({ event, handler });
  }

  onTriggerExit(callback: (other: Entity) => void): void {
    const event = `trigger:exit:${this.entity.id}`;
    const handler = (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    };
    this.entity.world.on(event, handler);
    this.eventHandlers.push({ event, handler });
  }

  /**
   * Update physics shape when collider properties change.
   *
   * Note: This component stores collider configuration but physics shapes
   * must be created through the Physics system directly. Use:
   * - world.physics.addStaticActor() for static colliders
   * - world.physics.addBody() for dynamic/kinematic bodies
   * - Collider/RigidBody nodes in the scene graph
   */
  private updatePhysicsShape(): void {
    // Shape creation is handled by Physics system when entities are spawned
    // This component holds configuration data for that process
  }

  /**
   * Update physics properties (material, trigger flag, layers).
   *
   * Note: Runtime property changes require Physics system API calls.
   * This component holds the desired configuration.
   */
  private updatePhysicsProperties(): void {
    // Property updates are handled by Physics system
    // This component stores the desired state
  }

  init(): void {
    // Configuration is stored - actual physics shape is created by
    // the Physics system when the entity is added to the world
  }

  destroy(): void {
    // Clean up collision event handlers
    for (const { event, handler } of this.eventHandlers) {
      this.entity.world.off(event, handler);
    }
    this.eventHandlers = [];

    // Physics handles are cleaned up by the Physics system
    // when the entity is removed from the world
    this.physicsHandle = undefined;
  }
}
