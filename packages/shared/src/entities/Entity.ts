/**
 * Entity.ts - Base Entity Class
 *
 * The base class for all game objects in the world. Provides fundamental functionality
 * for 3D objects with networking, physics, components, and lifecycle management.
 *
 * Key Features:
 * - **3D Representation**: Three.js Object3D with mesh, position, rotation, scale
 * - **Component System**: Modular components for combat, stats, interaction, etc.
 * - **Physics**: Optional PhysX rigid body integration
 * - **Networking**: State synchronization across clients
 * - **Lifecycle**: spawn(), update(), fixedUpdate(), destroy()
 * - **Events**: Local and world event system for inter-entity communication
 * - **Serialization**: Network serialization for state sync
 *
 * Component Architecture:
 * Entities use a component-based design for modular functionality:
 * - CombatComponent: Health, attack, defense
 * - StatsComponent: Skills, levels, XP
 * - InteractionComponent: Player interaction handlers
 * - DataComponent: Custom data storage
 * - UsageComponent: Item usage logic
 * - VisualComponent: 3D model, materials, animations
 *
 * Inheritance Hierarchy:
 * ```
 * Entity (base class)
 * ├── InteractableEntity (can be interacted with)
 * │   ├── ResourceEntity (trees, rocks, fishing spots)
 * │   ├── ItemEntity (ground items)
 * │   └── NPCEntity (dialogue, shops)
 * ├── CombatantEntity (can fight)
 * │   ├── PlayerEntity (base player)
 * │   │   ├── PlayerLocal (client-side local player)
 * │   │   └── PlayerRemote (client-side remote players)
 * │   └── MobEntity (enemies)
 * └── HeadstoneEntity (player death markers)
 * ```
 *
 * Lifecycle:
 * 1. Constructor: Creates entity with initial data/config
 * 2. spawn(): Called when entity is added to world (override in subclasses)
 * 3. update(delta): Called every frame for visual updates
 * 4. fixedUpdate(delta): Called at fixed timestep (30 FPS) for physics
 * 5. destroy(): Cleanup when entity is removed
 *
 * Network Synchronization:
 * - Server creates entities and broadcasts to clients via entityAdded packet
 * - State changes trigger entityModified packet
 * - networkDirty flag indicates entity needs sync
 * - serialize() creates network-safe data representation
 *
 * Physics Integration:
 * - Optional PhysX rigid body for collision and forces
 * - Automatic sync between Three.js node and physics body
 * - Collision layers for selective interaction
 *
 * Usage:
 * ```typescript
 * // Create a generic entity
 * const entity = new Entity(world, {
 *   id: 'tree1',
 *   type: 'entity',
 *   name: 'Oak Tree',
 *   position: { x: 10, y: 0, z: 5 }
 * });
 * await entity.spawn();
 *
 * // Add component
 * entity.addComponent('data', { customValue: 42 });
 *
 * // Get component
 * const data = entity.getComponent('data');
 * ```
 *
 * Runs on: Both client and server
 * Used by: Entities system, all entity subclasses
 * References: Entities.ts, Component system, Physics system
 */

import type { Entity as IEntity, Quaternion, Vector3 } from "../types";
import type { EntityData } from "../types/index";
import { Component, createComponent } from "../components";
import THREE from "../extras/three/three";
import { getPhysX } from "../physics/PhysXManager";
import { type PhysXRigidDynamic } from "../systems/shared";
import { getWorldNetwork } from "../utils/SystemUtils";
import type { World } from "../core/World";
import { EventType } from "../types/events";
import { GAME_CONSTANTS } from "../constants/GameConstants";
import type { MeshUserData } from "../types/core/core";
import type { Position3D } from "../types/index";
import type { EntityInteractionData, EntityConfig } from "../types/entities";
import { EntityType } from "../types/entities";
import { toPosition3D } from "../types/core/utilities";
import { UIRenderer } from "../utils/rendering/UIRenderer";
import { modelCache } from "../utils/rendering/ModelCache";

// Re-export types for external use
export type { EntityConfig };

// Type alias for event callbacks (exported for API extractor)
export type EventCallback = (data: unknown) => void;

/**
 * Entity - Base class for all game objects in the 3D world.
 *
 * Provides core functionality for 3D representation, networking, physics,
 * and component-based architecture. All game objects inherit from Entity.
 */
export class Entity implements IEntity {
  world: World;
  data: EntityData;
  id: string;
  name: string;
  type: string;
  node: THREE.Object3D<THREE.Object3DEventMap>;
  components: Map<string, Component>;
  velocity: Vector3;
  isPlayer: boolean;
  active: boolean = true;

  // Plugin-specific extensions
  base?:
    | {
        position: Vector3;
        visible?: boolean;
        children?: unknown[];
        parent?: unknown | null;
        quaternion?: Quaternion;
      }
    | THREE.Object3D;
  destroyed: boolean = false;

  // Physics body reference
  private rigidBody?: PhysXRigidDynamic;

  // Additional properties for plugin compatibility
  metadata?: Record<string, unknown>;

  protected config: EntityConfig;
  public mesh: THREE.Mesh | THREE.Group | THREE.Object3D | null = null;
  public nodes: Map<string, THREE.Object3D> = new Map(); // Child nodes by ID
  public worldNodes: Set<THREE.Object3D> = new Set(); // Nodes added to world
  public listeners: Record<string, Set<EventCallback>> = {}; // Event listeners
  public worldListeners: Map<(data: unknown) => void, string> = new Map(); // World event listeners
  protected lastUpdate = 0;

  protected health: number = 0;
  protected maxHealth: number = 100;
  protected level: number = 1;

  // UI elements
  protected nameSprite: THREE.Sprite | null = null;
  protected healthSprite: THREE.Sprite | null = null;

  // Network state
  public networkDirty = false; // Needs network sync
  public networkVersion = 0; // Version for conflict resolution

  // Interpolation state
  protected networkPos?: Position3D;
  protected networkQuat?: THREE.Quaternion;
  protected networkSca?: Position3D;

  constructor(
    world: World,
    dataOrConfig: EntityData | EntityConfig,
    local?: boolean,
  ) {
    this.world = world;

    // Handle both EntityData and EntityConfig formats
    let entityData: EntityData;
    let config: EntityConfig | undefined;

    // Strong type assumption - check array to distinguish EntityData from EntityConfig
    if (Array.isArray((dataOrConfig as EntityData).position)) {
      // It's EntityData format
      entityData = dataOrConfig as EntityData;
    } else {
      // It's EntityConfig format
      config = dataOrConfig as EntityConfig;

      // Strong type assumption - EntityConfig.position always has valid x, y, z coordinates
      // If NaN values appear, that's a bug in the calling code that should be fixed at the source
      const validX = config.position.x || 0;
      const validY = config.position.y || 0;
      const validZ = config.position.z || 0;

      // Convert EntityConfig to EntityData format
      entityData = {
        id: config.id,
        name: config.name,
        type: config.type,
        position: [validX, validY, validZ],
        quaternion: config.rotation
          ? [config.rotation.x, config.rotation.y, config.rotation.z, 1]
          : undefined,
        scale: config.scale
          ? [config.scale.x, config.scale.y, config.scale.z]
          : undefined,
      };
    }

    this.data = entityData;
    this.id = entityData.id;
    this.name = entityData.name || "entity";
    this.type = entityData.type || "generic";
    this.isPlayer = entityData.type === "player";

    // Initialize config
    if (config) {
      this.config = { ...config };
    } else {
      // Create default config from EntityData
      this.config = {
        id: entityData.id,
        name: entityData.name || "entity",
        type: this.mapStringToEntityType(entityData.type),
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        interactable: false,
        interactionType: null,
        interactionDistance: 5,
        description: "",
        model: null,
        properties: {
          movementComponent: null,
          combatComponent: null,
          healthComponent: null,
          visualComponent: null,
          health: { current: this.health, max: this.maxHealth },
          level: 1,
        },
      };
    }

    // Initialize components map
    this.components = new Map();

    // Create Three.js node
    this.node = new THREE.Object3D() as THREE.Object3D<THREE.Object3DEventMap>;
    this.node.name = this.name;
    this.node.userData.entity = this;

    // Set up userData with proper typing
    const userData: MeshUserData = {
      type: this.mapEntityTypeToString(this.config.type),
      entityId: this.id,
      name: this.config.name,
      interactable: this.config.interactable,
      mobData: null, // Most entities are not mobs, override in MobEntity
      ...this.node.userData, // Preserve any existing userData
    };
    this.node.userData = userData;

    // Set default transform values and apply initial transform from EntityData when present
    this.node.position.set(0, 0, 0);
    this.node.quaternion.set(0, 0, 0, 1);
    this.node.scale.set(1, 1, 1); // Always assume scale of 1,1,1
    if (
      Array.isArray(entityData.position) &&
      entityData.position.length === 3
    ) {
      const [px, py, pz] = entityData.position as [number, number, number];

      // Player position logging removed to prevent memory leak

      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
        this.node.position.set(px, py, pz);

        // Don't throw on low Y values - the server sends the correct position but terrain might not be ready yet
        // The position will be corrected by server updates
        if (entityData.type === "player" && Math.abs(py) < 0.5) {
          console.warn(
            `[Entity] Player ${entityData.id} spawning at low Y=${py}. Will be corrected by server.`,
          );
        }
      } else {
        if (entityData.type === "player") {
          throw new Error(
            `[Entity] Player ${entityData.id} has invalid position values: [${px}, ${py}, ${pz}]`,
          );
        }
      }
    } else if (entityData.type === "player") {
      console.error("[Entity] Player entityData:", entityData);
      throw new Error(
        `[Entity] Player ${entityData.id} has no valid position in entityData`,
      );
    }
    if (
      Array.isArray(entityData.quaternion) &&
      entityData.quaternion.length === 4
    ) {
      const [qx, qy, qz, qw] = entityData.quaternion as [
        number,
        number,
        number,
        number,
      ];
      if (
        Number.isFinite(qx) &&
        Number.isFinite(qy) &&
        Number.isFinite(qz) &&
        Number.isFinite(qw)
      ) {
        this.node.quaternion.set(qx, qy, qz, qw);
      }
    }

    this.velocity = new THREE.Vector3(0, 0, 0);

    // Check health from multiple sources (in priority order):
    // 1. config.properties.health (if EntityConfig was passed)
    // 2. entityData.health and entityData.maxHealth (if EntityData was passed)
    // 3. Default to 100/100
    const healthData = config?.properties?.health as
      | { current: number; max: number }
      | undefined;
    if (healthData) {
      this.health = healthData.current;
      this.maxHealth = healthData.max;
    } else {
      // Check if EntityData has health property (e.g., from server spawn)
      const entityDataWithHealth = entityData as unknown as {
        health?: number;
        maxHealth?: number;
      };
      if (entityDataWithHealth.health !== undefined) {
        const entityHealth = entityDataWithHealth.health;
        const entityMaxHealth = entityDataWithHealth.maxHealth;
        this.health =
          Number.isFinite(entityHealth) && entityHealth > 0
            ? entityHealth
            : GAME_CONSTANTS.PLAYER.DEFAULT_HEALTH;
        this.maxHealth =
          Number.isFinite(entityMaxHealth) &&
          entityMaxHealth !== undefined &&
          entityMaxHealth > 0
            ? entityMaxHealth
            : this.health;
      } else {
        this.health = GAME_CONSTANTS.PLAYER.DEFAULT_HEALTH;
        this.maxHealth = GAME_CONSTANTS.PLAYER.DEFAULT_MAX_HEALTH;
      }
    }
    this.level = (config?.properties?.level as number) || 1;

    // Initialize health in entity data for network sync
    this.data.health = this.health;
    (this.data as { maxHealth?: number }).maxHealth = this.maxHealth;

    // Add to world scene
    if (this.world.stage.scene) {
      this.world.stage.scene.add(this.node);
    }

    // Automatically add transform component for ECS architecture
    this.addComponent("transform", {
      position: this.position,
      rotation: this.rotation,
      scale: this.scale,
    });

    // Initialize common components
    this.initializeRPGComponents();

    // Network sync for local entities
    const network = getWorldNetwork(this.world);
    if (local && network) {
      network.send("entityAdded", this.serialize());
    }
  }

  // Transform getters - return THREE.Vector3 instances
  get position(): Vector3 {
    return this.node.position;
  }

  set position(value: Vector3) {
    this.node.position.set(value.x, value.y, value.z);
    this.syncPhysicsTransform();
  }

  get rotation(): Quaternion {
    // Return reference instead of cloning - callers should clone if needed
    return this.node.quaternion;
  }

  set rotation(value: Quaternion) {
    this.node.quaternion.set(value.x, value.y, value.z, value.w);
    this.syncPhysicsTransform();
  }

  get scale(): Vector3 {
    // Strong type assumption - node.scale is always Vector3
    return this.node.scale;
  }

  set scale(value: Vector3) {
    this.node.scale.set(value.x, value.y, value.z);
  }

  // Component management
  addComponent<T extends Component = Component>(
    type: string,
    data?: Record<string, unknown>,
  ): T {
    // Check if component already exists
    if (this.components.has(type)) {
      console.warn(`Entity ${this.id} already has component ${type}`);
      // Strong type assumption - component is guaranteed to exist and be of correct type
      return this.components.get(type)! as T;
    }

    // Create component using the registry
    const component = createComponent(type, this, data);
    if (!component) {
      throw new Error(`Failed to create component of type: ${type}`);
    }

    // Store component
    this.components.set(type, component);

    // Initialize component if it has an init method
    if (component.init) {
      component.init();
    }

    // Handle special component types (legacy compatibility)
    this.handleSpecialComponent(type, component);

    // Emit event
    this.world.emit(EventType.ENTITY_COMPONENT_ADDED, {
      entityId: this.id,
      componentType: type,
      component,
    });

    // Strong type assumption - component creation succeeded
    return component as T;
  }

  removeComponent(type: string): void {
    const component = this.components.get(type);
    if (!component) return;

    // Destroy component if it has destroy method
    if (component.destroy) {
      component.destroy();
    }

    // Handle special component cleanup
    this.handleSpecialComponentRemoval(type, component);

    // Remove from map
    this.components.delete(type);

    // Emit event
    this.world.emit(EventType.ENTITY_COMPONENT_REMOVED, {
      entityId: this.id,
      componentType: type,
    });
  }

  getComponent<T extends Component = Component>(type: string): T | null {
    const component = this.components.get(type);
    return component ? (component as T) : null;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  removeAllComponents(): void {
    // Remove all components
    for (const type of Array.from(this.components.keys())) {
      this.removeComponent(type);
    }
  }

  // Physics methods
  applyForce(force: Vector3): void {
    if (!this.rigidBody) return;
    const PhysX = getPhysX();
    const physicsForce = new PhysX!.PxVec3(force.x, force.y, force.z);
    this.rigidBody.addForce(physicsForce);
  }

  applyImpulse(impulse: Vector3): void {
    if (!this.rigidBody) return;

    const PhysX = getPhysX();

    // Assume rigidBody has getMass, getLinearVelocity, and setLinearVelocity methods
    const mass = this.rigidBody.getMass();
    const currentVel = this.rigidBody.getLinearVelocity();
    const deltaV = new PhysX!.PxVec3(
      impulse.x / mass,
      impulse.y / mass,
      impulse.z / mass,
    );
    // Add deltaV to currentVel
    const newVel = new PhysX!.PxVec3(
      currentVel.x + deltaV.x,
      currentVel.y + deltaV.y,
      currentVel.z + deltaV.z,
    );
    this.rigidBody.setLinearVelocity(newVel, true);
  }

  // Set velocity updates the THREE.Vector3 instance and syncs with physics if enabled
  setVelocity(vel: Vector3): void {
    this.velocity.copy(vel);

    // Apply to physics body if available
    if (this.rigidBody) {
      this.world.physics.setLinearVelocity(this.rigidBody, this.velocity);
    }
  }

  // Get velocity returns the THREE.Vector3 instance
  getVelocity(): Vector3 {
    return this.velocity;
  }

  // Late update methods - for components
  lateUpdate(delta: number): void {
    // Update components with lateUpdate
    for (const component of this.components.values()) {
      if (component.lateUpdate) {
        component.lateUpdate(delta);
      }
    }
  }

  postLateUpdate(delta: number): void {
    // Update components with postLateUpdate
    for (const component of this.components.values()) {
      if (component.postLateUpdate) {
        component.postLateUpdate(delta);
      }
    }
  }

  // Serialization
  serialize(): EntityData {
    const serialized: EntityData = {
      id: this.id,
      name: this.name,
      type: this.type,
      // CRITICAL: Use current position from node, not stale data
      position: [
        this.node.position.x,
        this.node.position.y,
        this.node.position.z,
      ],
      quaternion: [
        this.node.quaternion.x,
        this.node.quaternion.y,
        this.node.quaternion.z,
        this.node.quaternion.w,
      ],
      // Add data properties dynamically
    };

    // Copy data properties - assume all enumerable properties should be serialized
    for (const key in this.data) {
      // Skip position and quaternion as we've already set them from node
      if (key === "position" || key === "quaternion") continue;

      // Strong assumption - if key exists in data, it should be serialized
      const value = this.data[key as keyof EntityData];
      if (value !== undefined) {
        Object.defineProperty(serialized, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    return serialized;
  }

  // Modification from network/data
  modify(data: Partial<EntityData>): void {
    // Update data - transform properties no longer part of EntityData
    Object.assign(this.data, data);

    // Transform is now handled directly by Entity, not through data
    // Use setPosition(), setRotation() methods instead for transform updates
  }

  // Network event handling
  onEvent(
    version: number,
    name: string,
    data: unknown,
    networkId: string,
  ): void {
    // Handle entity-specific network events
    this.world.emit(`entity:${this.id}:network:${name}`, {
      version,
      data,
      networkId,
    });
  }

  // Helper methods
  syncPhysicsTransform(): void {
    if (!this.rigidBody || !this.world.physics?.world) return;

    // Sync Three.js transform to physics body
    const pos = this.position;
    const rot = this.rotation;

    const PhysX = getPhysX();
    if (!PhysX) return;

    const transform = new PhysX.PxTransform(
      new PhysX.PxVec3(pos.x, pos.y, pos.z),
      new PhysX.PxQuat(rot.x, rot.y, rot.z, rot.w),
    );

    this.rigidBody.setGlobalPose(transform);

    // PhysX manages object lifecycle - no manual deletion needed
  }

  handleSpecialComponent(type: string, component: Component): void {
    switch (type) {
      case "rigidbody":
        this.createPhysicsBody(component);
        break;
      case "collider":
        this.updateCollider(component);
        break;
      case "mesh":
        this.updateMesh(component);
        break;
    }
  }

  private handleSpecialComponentRemoval(
    type: string,
    component: Component,
  ): void {
    switch (type) {
      case "rigidbody":
        this.removePhysicsBody();
        break;
      case "mesh":
        this.removeMesh(component);
        break;
    }
  }

  private createPhysicsBody(_component: Component): void {
    // Create physics rigid body based on component data
    // Implementation depends on physics engine integration
  }

  private removePhysicsBody(): void {
    if (this.rigidBody) {
      // Remove from physics world
      this.rigidBody = undefined;
    }
  }

  private updateCollider(_component: Component): void {
    // Update physics collider shape
    // Implementation depends on physics engine
  }

  private updateMesh(component: Component): void {
    // Add/update Three.js mesh from component data
    const meshData = component.data;
    if (meshData.geometry && meshData.material) {
      // Create or update mesh
    }
  }

  private removeMesh(_component: Component): void {
    // Remove mesh from node
    // Implementation depends on mesh management
  }

  private isDefaultRotation(): boolean {
    return (
      this.rotation.x === 0 &&
      this.rotation.y === 0 &&
      this.rotation.z === 0 &&
      this.rotation.w === 1
    );
  }

  private isDefaultScale(): boolean {
    return this.scale.x === 1 && this.scale.y === 1 && this.scale.z === 1;
  }

  /**
   * Convert EntityType enum to string for MeshUserData
   */
  private mapEntityTypeToString(
    type: EntityType,
  ): "player" | "mob" | "item" | "npc" | "resource" | "static" {
    switch (type) {
      case EntityType.PLAYER:
        return "player";
      case EntityType.MOB:
        return "mob";
      case EntityType.ITEM:
        return "item";
      case EntityType.NPC:
        return "npc";
      case EntityType.RESOURCE:
        return "resource";
      case EntityType.STATIC:
      default:
        return "static";
    }
  }

  private mapStringToEntityType(type?: string): EntityType {
    if (!type) return EntityType.STATIC;

    switch (type.toLowerCase()) {
      case "player":
        return EntityType.PLAYER;
      case "mob":
        return EntityType.MOB;
      case "item":
        return EntityType.ITEM;
      case "npc":
        return EntityType.NPC;
      case "resource":
        return EntityType.RESOURCE;
      case "static":
      default:
        return EntityType.STATIC;
    }
  }
  /**
   * Initialize common components - merged from BaseEntity
   */
  protected initializeRPGComponents(): void {
    this.addHealthComponent();
    this.addCombatComponent();
    this.addVisualComponent();
  }

  /**
   * Add health component with standard properties
   */
  protected addHealthComponent(): void {
    this.addComponent("health", {
      current: this.health,
      max: this.maxHealth,
      regenerationRate: GAME_CONSTANTS.PLAYER.HEALTH_REGEN_RATE,
      isDead: false,
    });
  }

  /**
   * Add combat component with standard properties
   */
  protected addCombatComponent(): void {
    this.addComponent("combat", {
      isInCombat: false,
      target: null,
      lastAttackTime: 0,
      attackCooldown: GAME_CONSTANTS.COMBAT.ATTACK_COOLDOWN_MS,
      damage: GAME_CONSTANTS.COMBAT.MIN_DAMAGE,
      range: GAME_CONSTANTS.COMBAT.MELEE_RANGE,
    });
  }

  /**
   * Add visual component with mesh and UI sprites
   */
  protected addVisualComponent(): void {
    this.addComponent("visual", {
      mesh: null,
      nameSprite: null,
      healthSprite: null,
      isVisible: true,
    });
  }

  /**
   * Initialize visual elements (mesh, name tag, health bar) - from BaseEntity
   */
  protected initializeVisuals(): void {
    // Create main mesh - implemented by subclasses
    // Note: createMesh is async in Entity, so this will be called from init()

    // Create name tag if entity has a name
    if (this.name) {
      this.createNameTag();
    }

    // Only create health bars for combat entities (players and mobs)
    // Items, NPCs, and other entities should not have health bars
    const isCombatEntity = this.type === "player" || this.type === "mob";
    if (this.maxHealth > 0 && isCombatEntity) {
      this.createHealthBar();
    }

    // Update visual component
    const visualComponent = this.getComponent("visual");
    if (visualComponent && visualComponent.data) {
      visualComponent.data.mesh = this.mesh;
      visualComponent.data.nameSprite = this.nameSprite;
      visualComponent.data.healthSprite = this.healthSprite;
    }
  }

  /**
   * Create name tag sprite using UIRenderer - from BaseEntity
   */
  protected createNameTag(): void {
    if (!this.name) return;

    const nameCanvas = UIRenderer.createNameTag(this.name, {
      width: GAME_CONSTANTS.UI.NAME_TAG_WIDTH,
      height: GAME_CONSTANTS.UI.NAME_TAG_HEIGHT,
    });

    this.nameSprite = UIRenderer.createSpriteFromCanvas(
      nameCanvas,
      GAME_CONSTANTS.UI.SPRITE_SCALE,
    );
    if (this.nameSprite) {
      this.nameSprite.position.set(0, 2.15, 0); // Position above the entity
      // Add to entity node so it follows the entity
      if (this.node) {
        this.node.add(this.nameSprite);
      }
    }
  }

  /**
   * Create health bar sprite using UIRenderer - from BaseEntity
   */
  protected createHealthBar(): void {
    const healthCanvas = UIRenderer.createHealthBar(
      this.health,
      this.maxHealth,
      {
        width: GAME_CONSTANTS.UI.HEALTH_BAR_WIDTH,
        height: GAME_CONSTANTS.UI.HEALTH_BAR_HEIGHT,
      },
    );

    this.healthSprite = UIRenderer.createSpriteFromCanvas(
      healthCanvas,
      GAME_CONSTANTS.UI.HEALTH_SPRITE_SCALE,
    );
    if (this.healthSprite) {
      this.healthSprite.position.set(0, 2.0, 0); // Position above the entity, below name tag
      // Add to entity node so it follows the entity
      if (this.node) {
        this.node.add(this.healthSprite);
      }
    }
  }

  /**
   * Update health bar sprite - from BaseEntity
   */
  protected updateHealthBar(): void {
    if (!this.healthSprite) {
      return;
    }

    const healthCanvas = UIRenderer.createHealthBar(
      this.health,
      this.maxHealth,
      {
        width: GAME_CONSTANTS.UI.HEALTH_BAR_WIDTH,
        height: GAME_CONSTANTS.UI.HEALTH_BAR_HEIGHT,
      },
    );

    UIRenderer.updateSpriteTexture(this.healthSprite, healthCanvas);
  }

  /**
   * Update health and refresh health bar - from BaseEntity
   */
  public setHealth(newHealth: number): void {
    this.health = Math.max(0, Math.min(this.maxHealth, newHealth));

    // Update health in entity data for network sync
    this.data.health = this.health;
    (this.data as { maxHealth?: number }).maxHealth = this.maxHealth;

    // Update health component
    const healthComponent = this.getComponent("health");
    if (healthComponent && healthComponent.data) {
      healthComponent.data.current = this.health;
      healthComponent.data.isDead = this.health <= 0;
    }

    // Update health bar visual
    this.updateHealthBar();

    // Mark entity as dirty for network sync
    this.markNetworkDirty();

    // Emit health change event
    this.world.emit(EventType.ENTITY_HEALTH_CHANGED, {
      entityId: this.id,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.health <= 0,
    });
  }

  /**
   * Damage this entity - from BaseEntity
   */
  public damage(amount: number, source?: string): boolean {
    if (this.health <= 0) return false;

    const newHealth = this.health - amount;
    this.setHealth(newHealth);

    // Emit damage event
    this.world.emit(EventType.ENTITY_DAMAGED, {
      entityId: this.id,
      damage: amount,
      sourceId: source,
      remainingHealth: this.health,
      isDead: this.health <= 0,
    });

    return true;
  }

  /**
   * Heal this entity - from BaseEntity
   */
  public heal(amount: number): boolean {
    if (this.health >= this.maxHealth) return false;

    const newHealth = this.health + amount;
    this.setHealth(newHealth);

    // Emit heal event
    this.world.emit(EventType.ENTITY_HEALED, {
      entityId: this.id,
      healAmount: amount,
      newHealth: this.health,
    });

    return true;
  }

  /**
   * Check if entity is alive - from BaseEntity
   */
  public isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * Check if entity is dead - from BaseEntity
   */
  public isDead(): boolean {
    return this.health <= 0;
  }

  /**
   * Get entity's current health - from BaseEntity
   */
  public getHealth(): number {
    return this.health;
  }

  /**
   * Get entity's maximum health - from BaseEntity
   */
  public getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * Get entity's level - from BaseEntity
   */
  public getLevel(): number {
    return this.level;
  }

  /**
   * Set entity level - from BaseEntity
   */
  public setLevel(newLevel: number): void {
    this.level = Math.max(1, newLevel);

    // Emit level change event
    this.world.emit(EventType.ENTITY_LEVEL_CHANGED, {
      entityId: this.id,
      newLevel: this.level,
    });
  }

  // Position getter/setter compatibility methods for Position3D
  public getPosition(): Position3D {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
  }

  public setPosition(
    posOrX: Position3D | number,
    y?: number,
    z?: number,
  ): void {
    // Strong type assumption - if y and z are provided, posOrX is a number
    if (y !== undefined && z !== undefined) {
      const x = posOrX as number;
      this.position.set(x, y, z);
      this.config.position = { x, y, z };
    } else {
      // Strong type assumption - posOrX is Position3D
      const pos = posOrX as Position3D;
      this.position.set(pos.x, pos.y, pos.z);
      this.config.position = { x: pos.x, y: pos.y, z: pos.z };
    }
    // Position is already set via this.position, no sync needed
    this.markNetworkDirty();
  }

  getDistanceTo(point: Position3D): number {
    const pos = this.getPosition();
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    const dz = pos.z - point.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  isPlayerInRange(playerPosition: Position3D): boolean {
    const distance = this.getDistanceTo(playerPosition);
    return distance <= (this.config.interactionDistance || 5);
  }

  /**
   * Check if we're running in a client environment with full browser APIs
   * This is more robust than just checking world.isClient as it verifies actual Canvas API availability
   */
  protected isClientEnvironment(): boolean {
    // First check the world and network flags - if explicitly server, return false
    if (this.world.network && this.world.network.isServer === true) {
      return false;
    }

    // Check if explicitly client
    if (
      this.world.isClient === true ||
      (this.world.network && this.world.network.isClient === true)
    ) {
      return true;
    }

    // Strong type assumption - if we reach here and have document, we're in a browser
    // The presence of document is determined at compile/bundle time
    return false;
  }

  async init(): Promise<void> {
    // Create the visual representation (mesh)
    // Note: createMesh() in subclasses may call loadModel() internally
    await this.createMesh();

    // Initialize UI elements (name tag, health bar) - only on client
    // Check if we're in a real browser environment with full Canvas API support
    const isClientEnvironment = this.isClientEnvironment();

    if (isClientEnvironment) {
      this.initializeVisuals();
    }

    // Set up interaction system
    this.setupInteraction();

    // Call custom initialization
    await this.onInit();

    // FINAL VALIDATION (only on client where we have meshes)
    if (!this.world.isServer) {
      this.validateEntityState();
    }
  }

  /**
   * Validate entity is in valid state
   */
  private validateEntityState(): void {
    // Check node is in scene
    if (!this.node.parent) {
      console.error(
        `[Entity] ⚠️  WARNING: Entity ${this.name} node has no parent (not in scene)`,
      );
      // Don't throw - might be intentional
    }

    const shouldHaveMesh = this.type === "player" || this.type === "mob";
    if (!this.mesh && shouldHaveMesh) {
      console.warn(
        `[Entity] ⚠️  Entity ${this.name} (${this.type}) has no mesh - may be server-side`,
      );
    }

    // Check mesh is added to node (skip for VRM entities which manage their own positioning)
    const isVRM = this.config?.model?.endsWith(".vrm");
    if (this.mesh && !this.node.children.includes(this.mesh) && !isVRM) {
      console.error(
        `[Entity] ⚠️  WARNING: Entity ${this.name} mesh is not a child of node`,
      );
    }

    // Check position is reasonable
    const pos = this.node.position;
    if (
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y) ||
      !Number.isFinite(pos.z)
    ) {
      console.error(
        `[Entity] ❌ CRITICAL: Entity ${this.name} has invalid position: ${pos.toArray()}`,
      );
      throw new Error(`Entity ${this.name} has NaN/Infinity position`);
    }

    if (pos.y < -200) {
      console.error(
        `[Entity] ❌ CRITICAL: Entity ${this.name} is below the world: Y=${pos.y.toFixed(2)}`,
      );
      throw new Error(
        `Entity ${this.name} spawned below world (Y=${pos.y.toFixed(2)})`,
      );
    }

    if (pos.y > 2000) {
      console.error(
        `[Entity] ❌ CRITICAL: Entity ${this.name} is way above the world: Y=${pos.y.toFixed(2)}`,
      );
      throw new Error(
        `Entity ${this.name} spawned way above world (Y=${pos.y.toFixed(2)})`,
      );
    }
  }

  protected async loadModel(): Promise<void> {
    if (!this.config.model) {
      return;
    }

    // Skip model loading on server side - models are only needed for client rendering
    if (this.world.isServer) {
      return;
    }

    // Use ModelCache to load with caching
    // ModelCache uses its own GLTFLoader to ensure pure THREE.Object3D (not Hyperscape Nodes)
    const { scene } = await modelCache.loadModel(this.config.model, this.world);

    // Clear existing mesh first
    if (this.mesh) {
      this.node.remove(this.mesh);
    }

    // Use the cloned scene
    this.mesh = scene;
    this.mesh.name = `${this.name}_Model`;

    // Set up userData
    const userData: MeshUserData = {
      type: this.mapEntityTypeToString(this.config.type),
      entityId: this.id,
      name: this.config.name,
      interactable: this.config.interactable,
      mobData: null,
    };
    this.mesh.userData = userData;

    // Collect all child nodes
    this.collectNodes(this.mesh);

    // Add to node (which is already in the scene)
    this.node.add(this.mesh);

    // VALIDATE: Ensure mesh was actually added
    if (this.node.children.length === 0) {
      throw new Error(
        `Mesh was not added to node! Node has ${this.node.children.length} children`,
      );
    }

    // VALIDATE: Check position is reasonable
    const pos = this.node.position;
    if (pos.y < -100 || pos.y > 1000) {
      console.warn(
        `[Entity] Entity ${this.name} has extreme Y position: ${pos.y.toFixed(2)}`,
      );
    }

    // Check if entity is in the scene
    let inScene = false;
    let currentParent = this.node.parent;
    let depth = 0;
    while (currentParent && depth < 10) {
      if (currentParent === this.world.stage.scene) {
        inScene = true;
        break;
      }
      currentParent = currentParent.parent;
      depth++;
    }

    if (!inScene) {
      throw new Error(
        `Entity node is not in scene graph! Parent chain depth: ${depth}`,
      );
    }

    // Calculate bounding box to verify model size
    const bbox = new THREE.Box3().setFromObject(this.mesh);
    const size = bbox.getSize(new THREE.Vector3());

    // CRITICAL: Throw error if model is invisible
    if (!this.mesh.visible) {
      throw new Error(`Loaded model is not visible! Mesh.visible = false`);
    }

    // CRITICAL: Throw error if model is tiny
    if (size.x < 0.01 && size.y < 0.01 && size.z < 0.01) {
      throw new Error(
        `Loaded model is too small to see! Size: ${size.x}x${size.y}x${size.z}m`,
      );
    }
  }

  /**
   * Validate that a scene has actual geometry (not just empty groups)
   */
  private validateSceneHasGeometry(scene: THREE.Object3D): boolean {
    let hasMesh = false;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        hasMesh = true;
      }
    });
    return hasMesh;
  }

  protected collectNodes(node: THREE.Object3D): void {
    if (node.name) {
      this.nodes.set(node.name, node);
    }

    node.children.forEach((child) => {
      this.collectNodes(child as THREE.Object3D);
    });
  }

  // Default mesh creation - override in subclasses
  protected async createMesh(): Promise<void> {
    // DISABLED: Default cube mesh causes visual clutter
    // Subclasses (MobEntity, PlayerEntity, etc.) should override this with proper meshes
    // If they don't, the entity will simply have no visible mesh (which is fine for server-side entities)
    // DO NOT CREATE DEFAULT CUBE MESH
    // this.mesh remains null, which is valid for:
    // - Server-side entities
    // - Entities waiting for proper models to load
    // - Abstract entities that don't need visuals
    // Subclasses like MobEntity, PlayerEntity, ItemEntity override this method
    // and create appropriate meshes (capsules, models, etc.)
  }

  // Default interaction handler - override in subclasses
  protected async onInteract(data: EntityInteractionData): Promise<void> {
    // Default implementation logs interaction

    // Emit interaction event
    this.world.emit(EventType.ENTITY_INTERACTED, {
      entityId: this.id,
      playerId: data.playerId,
      position: data.playerPosition,
    });
  }

  // Custom initialization hook
  protected async onInit(): Promise<void> {
    // Override in subclasses if needed
  }

  private setupInteraction(): void {
    // Set up interaction target with proper typing
    const target = this.mesh || this.node;
    const userData: MeshUserData = {
      type: this.mapEntityTypeToString(this.config.type),
      entityId: this.id,
      name: this.config.name,
      interactable: this.config.interactable,
      mobData: null,
      interactionDistance: this.config.interactionDistance,
      interactionType: this.config.interactionType || undefined,
    };
    target.userData = userData;

    // Listen for interaction events and track handler for cleanup
    const onInteractHandler = async (data: unknown) => {
      const typed = data as EntityInteractionData;
      if (typed && typed.entityId === this.id) {
        await this.onInteract(typed);
      }
    };
    this.world.on(EventType.ENTITY_INTERACT, onInteractHandler);
    // Track listener with exact function reference and event name
    this.worldListeners.set(onInteractHandler, EventType.ENTITY_INTERACT);
  }

  update(delta: number): void {
    // Update components
    for (const component of this.components.values()) {
      if (component.update) {
        component.update(delta);
      }
    }

    const now = this.world.getTime();
    if (now - this.lastUpdate < 0.016) return; // Limit to ~60fps (16ms in seconds)
    this.lastUpdate = now;

    // Update based on client/server
    if (this.world.isServer) {
      this.serverUpdate(delta);
    } else {
      this.clientUpdate(delta);
    }
  }

  // Server-side update logic
  protected serverUpdate(_deltaTime: number): void {
    // Override in subclasses for server-specific logic
  }

  // Client-side update logic
  protected clientUpdate(_deltaTime: number): void {
    // Override in subclasses for client-specific logic
  }

  // Fixed timestep update (for physics, etc.)
  fixedUpdate(delta: number): void {
    // Update components with fixedUpdate
    for (const component of this.components.values()) {
      if (component.fixedUpdate) {
        component.fixedUpdate(delta);
      }
    }

    if (this.world.isServer) {
      this.serverFixedUpdate(delta);
    }
  }

  // Server fixed update
  protected serverFixedUpdate(_deltaTime: number): void {
    // Override in subclasses
  }

  // Mark this entity as needing network sync
  markNetworkDirty(): void {
    this.networkDirty = true;
    this.networkVersion++;

    // CRITICAL: Directly add to EntityManager's dirty set
    // Players are managed by PlayerSystem, not EntityManager's update loop
    // So we must explicitly notify EntityManager when players are dirty
    if (this.world.isServer) {
      const entityManager = this.world.getSystem("entity-manager") as any;
      if (entityManager?.networkDirtyEntities) {
        entityManager.networkDirtyEntities.add(this.id);
        // Disabled - too spammy
        // console.log(`[Entity.markNetworkDirty] Added ${this.type} ${this.id} to dirty set`);
      }
    }
  }

  // Get data for network synchronization
  getNetworkData(): Record<string, unknown> {
    const position = toPosition3D(this.node.position);
    const rotation = this.node.quaternion;
    const scale = {
      x: this.node.scale.x,
      y: this.node.scale.y,
      z: this.node.scale.z,
    };

    // Include all data fields (e.g., emote 'e') for network sync
    // Filter out position/quaternion/scale since EntityManager handles those separately as p/q
    const dataFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.data)) {
      // Skip position/quaternion/scale arrays - EntityManager sends them as p/q
      if (
        key !== "position" &&
        key !== "quaternion" &&
        key !== "scale" &&
        key !== "id" &&
        key !== "type" &&
        key !== "name"
      ) {
        dataFields[key] = value;
      }
    }

    return {
      id: this.id,
      type: this.type,
      name: this.name,
      position,
      rotation,
      scale,
      visible: this.node.visible,
      networkVersion: this.networkVersion,
      properties: this.config.properties || {},
      ...dataFields, // Include emote ('e'), inCombat, combatTarget, health, and other data fields
    };
  }

  // Apply network data (client-side)
  applyNetworkData(data: Record<string, unknown>): void {
    this.networkVersion = data.networkVersion as number;
    this.node.visible = data.visible as boolean;
    this.config.properties = {
      ...this.config.properties,
      ...(data.properties as Record<string, unknown>),
    };
  }

  // Handle interaction request
  async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Call the interaction handler directly - assume data is valid
    await this.onInteract(data);
  }

  // Property management
  getProperty<T>(key: string, defaultValue?: T): T {
    return (this.config.properties?.[key] ?? defaultValue) as T;
  }

  setProperty(key: string, value: unknown): void {
    this.config.properties[key] = value;
    this.markNetworkDirty();
  }

  // Event system with typed versions
  on<T = unknown>(event: string, callback: (data: T) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback as EventCallback);
  }

  off<T = unknown>(event: string, callback: (data: T) => void): void {
    this.listeners[event].delete(callback as EventCallback);
  }

  emit<T = unknown>(event: string, data?: T): void {
    // Call local listeners first
    this.listeners[event]?.forEach((callback) => callback(data));

    // Also emit to world events
    this.world.emit(`entity:${this.id}:${event}`, data);
  }

  // Visibility
  setVisible(visible: boolean): void {
    this.node.visible = visible;
    this.config.visible = visible;
    this.markNetworkDirty();
  }

  // Cleanup
  destroy(local?: boolean): void {
    // Re-entrancy guard: prevent recursive destroy calls
    if (this.destroyed) return;
    this.destroyed = true;

    // Clean up UI elements first - from BaseEntity
    if (this.nameSprite) {
      // Remove from node (not scene since we added it to node)
      if (this.node) {
        this.node.remove(this.nameSprite);
      }
      // Strong type assumption - sprite material is SpriteMaterial
      const spriteMaterial = this.nameSprite.material as THREE.SpriteMaterial;
      if (spriteMaterial.map) {
        spriteMaterial.map.dispose();
      }
      spriteMaterial.dispose();
      this.nameSprite = null;
    }

    if (this.healthSprite) {
      // Remove from node (not scene since we added it to node)
      if (this.node) {
        this.node.remove(this.healthSprite);
      }
      // Strong type assumption - sprite material is SpriteMaterial
      const spriteMaterial = this.healthSprite.material as THREE.SpriteMaterial;
      if (spriteMaterial.map) {
        spriteMaterial.map.dispose();
      }
      spriteMaterial.dispose();
      this.healthSprite = null;
    }

    // Destroy all components
    for (const type of Array.from(this.components.keys())) {
      this.removeComponent(type);
    }

    // Remove from scene
    if (this.node.parent) {
      // @ts-ignore - THREE.js type compatibility issue
      this.node.parent.remove(this.node);
    }

    // Clean up physics
    if (this.rigidBody && this.world.physics?.world) {
      // Remove rigid body from physics world
      // Implementation depends on physics engine
    }

    // Network sync
    const network = getWorldNetwork(this.world);
    if (local && network) {
      network.send("entityRemoved", this.id);
    }

    // Note: Do not emit ENTITY_DEATH here to avoid recursive destruction loops.
    // Destruction is requested via the EventBus and coordinated by EntityManager.

    // Clear event listeners
    this.clearEventListeners();

    // Remove from world
    this.worldNodes.forEach((node) => {
      if (node.parent) {
        // @ts-ignore - THREE.js type compatibility issue
        node.parent.remove(node);
      }
    });
    this.worldNodes.clear();

    // Dispose of THREE.js resources
    if (this.mesh) {
      this.disposeMesh(this.mesh);
    }

    // Clear references
    this.nodes.clear();
    this.mesh = null;
  }

  private clearEventListeners(): void {
    // Clear local event listeners
    Object.keys(this.listeners).forEach((event) => {
      this.listeners[event].clear();
    });

    // Clear world event listeners
    this.worldListeners.forEach((eventName, callback) => {
      this.world.off(eventName, callback);
    });
    this.worldListeners.clear();
  }

  private disposeMesh(object: THREE.Mesh | THREE.Group | THREE.Object3D): void {
    object.traverse((child) => {
      // Strong type assumption - mesh children have geometry and material
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        // Strong type assumption - material is either array or single
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  // Debug information
  getInfo(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: this.getPosition(),
      visible: this.node.visible,
      isInitialized: true, // Entity is always initialized after constructor
      isDestroyed: this.destroyed,
      networkDirty: this.networkDirty,
      networkVersion: this.networkVersion,
      nodeCount: this.nodes.size,
      properties: this.config.properties,
    };
  }
}
