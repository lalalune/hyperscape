/**
 * Entity Mock Factories
 *
 * Creates strongly-typed entity mocks for testing entity management.
 */

import type { TestPosition } from "../validation";
import { expectValidPosition } from "../validation";

/**
 * Base entity interface matching production Entity
 */
export interface MockEntity {
  id: string;
  type: string;
  position: TestPosition;
  properties: Map<string, unknown>;
  getProperty<T>(key: string): T | undefined;
  setProperty(key: string, value: unknown): void;
}

/**
 * Mob entity with combat properties
 */
export interface MockMobEntity extends MockEntity {
  type: "mob";
  name: string;
  health: { current: number; max: number };
  level: number;
  isAggressive: boolean;
  isDead: boolean;
  respawnTime: number;
}

/**
 * Resource entity for gathering
 */
export interface MockResourceEntity extends MockEntity {
  type: "resource";
  resourceType: "tree" | "rock" | "fishing_spot";
  depleted: boolean;
  respawnTicks: number;
}

/**
 * Ground item entity
 */
export interface MockGroundItemEntity extends MockEntity {
  type: "ground_item";
  itemId: string;
  quantity: number;
  droppedBy?: string;
  despawnTick: number;
  lootProtectionExpires?: number;
}

/**
 * NPC entity
 */
export interface MockNPCEntity extends MockEntity {
  type: "npc";
  name: string;
  dialogue?: string;
  shopId?: string;
  bankAccess?: boolean;
}

// =============================================================================
// MOCK FACTORIES
// =============================================================================

let entityIdCounter = 0;

/**
 * Generate a unique entity ID
 */
function generateEntityId(prefix: string = "entity"): string {
  return `${prefix}-${++entityIdCounter}-${Date.now()}`;
}

/**
 * Create a base mock entity
 */
export function createMockEntity(
  type: string,
  position: Partial<TestPosition> = {},
  id?: string,
): MockEntity {
  const pos: TestPosition = {
    x: position.x ?? 0,
    y: position.y ?? 0,
    z: position.z ?? 0,
  };
  expectValidPosition(pos);

  const properties = new Map<string, unknown>();

  return {
    id: id ?? generateEntityId(type),
    type,
    position: pos,
    properties,
    getProperty<T>(key: string): T | undefined {
      return properties.get(key) as T | undefined;
    },
    setProperty(key: string, value: unknown): void {
      properties.set(key, value);
    },
  };
}

/**
 * Create a mock mob entity
 */
export function createMockMob(
  options: {
    id?: string;
    name?: string;
    position?: Partial<TestPosition>;
    health?: { current?: number; max?: number };
    level?: number;
    isAggressive?: boolean;
  } = {},
): MockMobEntity {
  const base = createMockEntity("mob", options.position, options.id);

  return {
    ...base,
    type: "mob",
    name: options.name ?? "Test Mob",
    health: {
      current: options.health?.current ?? 100,
      max: options.health?.max ?? 100,
    },
    level: options.level ?? 1,
    isAggressive: options.isAggressive ?? false,
    isDead: false,
    respawnTime: 30000,
  };
}

/**
 * Create a mock resource entity
 */
export function createMockResource(
  resourceType: "tree" | "rock" | "fishing_spot",
  position: Partial<TestPosition> = {},
  id?: string,
): MockResourceEntity {
  const base = createMockEntity("resource", position, id);

  return {
    ...base,
    type: "resource",
    resourceType,
    depleted: false,
    respawnTicks: 100, // ~1 minute
  };
}

/**
 * Create a mock ground item entity
 */
export function createMockGroundItem(
  itemId: string,
  quantity: number,
  position: Partial<TestPosition> = {},
  options: {
    id?: string;
    droppedBy?: string;
    despawnTick?: number;
    lootProtectionExpires?: number;
  } = {},
): MockGroundItemEntity {
  const base = createMockEntity("ground_item", position, options.id);

  return {
    ...base,
    type: "ground_item",
    itemId,
    quantity,
    droppedBy: options.droppedBy,
    despawnTick: options.despawnTick ?? Date.now() + 120000, // 2 minutes
    lootProtectionExpires: options.lootProtectionExpires,
  };
}

/**
 * Create a mock NPC entity
 */
export function createMockNPC(
  name: string,
  position: Partial<TestPosition> = {},
  options: {
    id?: string;
    dialogue?: string;
    shopId?: string;
    bankAccess?: boolean;
  } = {},
): MockNPCEntity {
  const base = createMockEntity("npc", position, options.id);

  return {
    ...base,
    type: "npc",
    name,
    dialogue: options.dialogue,
    shopId: options.shopId,
    bankAccess: options.bankAccess,
  };
}

// =============================================================================
// MOCK ENTITY MANAGER
// =============================================================================

/**
 * Mock Entity Manager for testing entity operations
 */
export class MockEntityManager {
  private entities = new Map<string, MockEntity>();

  /**
   * Add an entity
   */
  addEntity(entity: MockEntity): this {
    this.entities.set(entity.id, entity);
    return this;
  }

  /**
   * Get an entity by ID
   */
  getEntity(id: string): MockEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Remove an entity
   */
  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  /**
   * Get all entities
   */
  getAllEntities(): MockEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): MockEntity[] {
    return this.getAllEntities().filter((e) => e.type === type);
  }

  /**
   * Get entities within range of a position
   */
  getEntitiesInRange(position: TestPosition, range: number): MockEntity[] {
    return this.getAllEntities().filter((e) => {
      const dx = e.position.x - position.x;
      const dy = e.position.y - position.y;
      const dz = e.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance <= range;
    });
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Get entity count
   */
  getCount(): number {
    return this.entities.size;
  }
}

/**
 * Reset entity ID counter (for test isolation)
 */
export function resetEntityIdCounter(): void {
  entityIdCounter = 0;
}
