/**
 * World Mock Factories
 *
 * Creates strongly-typed mock worlds for integration testing.
 */

import { MockEntityManager } from "./entity";
import type { MockPlayer } from "./player";
import { createMockPlayer } from "./player";

/**
 * Mock system interface
 */
export interface MockSystem {
  name: string;
  init?(): Promise<void>;
  start?(): void;
  update?(deltaTime: number): void;
  destroy?(): void;
}

/**
 * Mock event handler
 */
export type MockEventHandler = (data: unknown) => void;

/**
 * Mock World for testing
 *
 * Provides a lightweight test world that mimics production World behavior
 * without requiring full initialization.
 */
export class MockWorld {
  readonly isServer: boolean;
  readonly isClient: boolean;

  private systems = new Map<string, unknown>();
  private eventHandlers = new Map<string, Set<MockEventHandler>>();
  private players = new Map<string, MockPlayer>();
  private entityManager = new MockEntityManager();

  currentTick: number = 0;

  constructor(options: { isServer?: boolean; isClient?: boolean } = {}) {
    this.isServer = options.isServer ?? true;
    this.isClient = options.isClient ?? false;
  }

  // ==========================================================================
  // SYSTEM MANAGEMENT
  // ==========================================================================

  /**
   * Register a system
   */
  registerSystem(name: string, system: unknown): this {
    this.systems.set(name, system);
    return this;
  }

  /**
   * Get a system by name
   */
  getSystem<T>(name: string): T | null {
    return (this.systems.get(name) as T) ?? null;
  }

  /**
   * Check if system exists
   */
  hasSystem(name: string): boolean {
    return this.systems.has(name);
  }

  // ==========================================================================
  // EVENT SYSTEM
  // ==========================================================================

  /**
   * Subscribe to an event
   */
  on(eventName: string, handler: MockEventHandler): () => void {
    let handlers = this.eventHandlers.get(eventName);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(eventName, handlers);
    }
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  emit(eventName: string, data: unknown): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  /**
   * Remove all handlers for an event
   */
  off(eventName: string): void {
    this.eventHandlers.delete(eventName);
  }

  // ==========================================================================
  // PLAYER MANAGEMENT
  // ==========================================================================

  /**
   * Add a player
   */
  addPlayer(player: MockPlayer): this {
    this.players.set(player.id, player);
    this.emit("player:registered", { playerId: player.id });
    return this;
  }

  /**
   * Get a player by ID
   */
  getPlayer(playerId: string): MockPlayer | undefined {
    return this.players.get(playerId);
  }

  /**
   * Remove a player
   */
  removePlayer(playerId: string): boolean {
    const removed = this.players.delete(playerId);
    if (removed) {
      this.emit("player:cleanup", { playerId });
    }
    return removed;
  }

  /**
   * Get all players
   */
  getAllPlayers(): MockPlayer[] {
    return Array.from(this.players.values());
  }

  // ==========================================================================
  // ENTITY MANAGEMENT
  // ==========================================================================

  /**
   * Get entity manager
   */
  getEntityManager(): MockEntityManager {
    return this.entityManager;
  }

  // ==========================================================================
  // TICK MANAGEMENT
  // ==========================================================================

  /**
   * Advance world by N ticks
   */
  advanceTicks(ticks: number): this {
    for (let i = 0; i < ticks; i++) {
      this.currentTick++;
      this.emit("tick", { tick: this.currentTick });
    }
    return this;
  }

  /**
   * Set current tick
   */
  setTick(tick: number): this {
    this.currentTick = tick;
    return this;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Reset world state
   */
  reset(): void {
    this.systems.clear();
    this.eventHandlers.clear();
    this.players.clear();
    this.entityManager.clear();
    this.currentTick = 0;
  }

  /**
   * Destroy world
   */
  destroy(): void {
    this.reset();
  }
}

/**
 * Create a mock world with common systems pre-registered
 */
export function createMockWorld(
  options: {
    isServer?: boolean;
    isClient?: boolean;
    withPlayer?: boolean;
  } = {},
): MockWorld {
  const world = new MockWorld({
    isServer: options.isServer ?? true,
    isClient: options.isClient ?? false,
  });

  // Register entity manager as a system
  world.registerSystem("entity-manager", world.getEntityManager());

  // Add default player if requested
  if (options.withPlayer) {
    const player = createMockPlayer();
    world.addPlayer(player);
  }

  return world;
}

/**
 * Create a mock world for client-side testing
 */
export function createClientWorld(withPlayer: boolean = true): MockWorld {
  return createMockWorld({
    isServer: false,
    isClient: true,
    withPlayer,
  });
}

/**
 * Create a mock world for server-side testing
 */
export function createServerWorld(withPlayer: boolean = true): MockWorld {
  return createMockWorld({
    isServer: true,
    isClient: false,
    withPlayer,
  });
}
