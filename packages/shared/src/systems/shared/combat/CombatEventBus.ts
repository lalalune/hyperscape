/**
 * CombatEventBus - Typed event system for combat events
 *
 * Provides type-safe event emission and subscription for combat events,
 * with optional tracing support for debugging.
 *
 * Benefits:
 * - Type-safe event handling (no string-based event names)
 * - Easier debugging with event tracing
 * - Decoupled from World event system
 * - Immutable event data
 *
 * Usage:
 *   const bus = new CombatEventBus();
 *
 *   // Subscribe to events
 *   const unsub = bus.onDamageDealt((event) => {
 *     console.log(`${event.attackerId} dealt ${event.damage} to ${event.targetId}`);
 *   });
 *
 *   // Emit events
 *   bus.emitDamageDealt({
 *     attackerId: "player1",
 *     targetId: "mob1",
 *     damage: 15,
 *     targetType: "mob",
 *     tick: 100,
 *   });
 *
 *   // Unsubscribe when done
 *   unsub();
 */

/**
 * Position in 3D space
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Base combat event with common fields
 */
export interface BaseCombatEvent {
  /** Game tick when the event occurred */
  tick: number;
  /** Timestamp when the event was emitted */
  timestamp: number;
}

/**
 * Combat started event - when two entities enter combat
 */
export interface CombatStartedEvent extends BaseCombatEvent {
  type: "combat_started";
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
}

/**
 * Attack started event - when an attack begins (before damage)
 */
export interface AttackStartedEvent extends BaseCombatEvent {
  type: "attack_started";
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType: "melee" | "ranged";
}

/**
 * Damage dealt event - when damage is applied to a target
 */
export interface DamageDealtEvent extends BaseCombatEvent {
  type: "damage_dealt";
  attackerId: string;
  targetId: string;
  damage: number;
  targetType: "player" | "mob";
  position?: Position3D;
  /** Whether this was a critical hit (for future use) */
  critical?: boolean;
}

/**
 * Combat ended event - when combat ends between two entities
 */
export interface CombatEndedEvent extends BaseCombatEvent {
  type: "combat_ended";
  entityId: string;
  entityType: "player" | "mob";
  targetId: string;
  targetType: "player" | "mob";
  reason: "timeout" | "target_died" | "fled" | "disconnect" | "forced";
}

/**
 * Entity died event - when an entity dies in combat
 */
export interface EntityDiedEvent extends BaseCombatEvent {
  type: "entity_died";
  entityId: string;
  entityType: "player" | "mob";
  killerId: string;
  killerType: "player" | "mob";
  position?: Position3D;
}

/**
 * Retaliation event - when an entity retaliates after being attacked
 */
export interface RetaliationEvent extends BaseCombatEvent {
  type: "retaliation";
  entityId: string;
  entityType: "player" | "mob";
  targetId: string;
  targetType: "player" | "mob";
  delayTicks: number;
}

/**
 * Union of all combat event types
 */
export type CombatEvent =
  | CombatStartedEvent
  | AttackStartedEvent
  | DamageDealtEvent
  | CombatEndedEvent
  | EntityDiedEvent
  | RetaliationEvent;

/**
 * Event type names for type-safe event handling
 */
export type CombatEventType = CombatEvent["type"];

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;

/**
 * Event handler function type
 */
type EventHandler<T extends CombatEvent> = (event: T) => void;

/**
 * Configuration options for CombatEventBus
 */
export interface CombatEventBusConfig {
  /** Maximum number of events to keep in history (for tracing) */
  maxHistorySize?: number;
  /** Whether to start with tracing enabled */
  tracingEnabled?: boolean;
}

const DEFAULT_CONFIG: Required<CombatEventBusConfig> = {
  maxHistorySize: 1000,
  tracingEnabled: false,
};

/**
 * Type-safe event bus for combat events
 */
export class CombatEventBus {
  private handlers = new Map<CombatEventType, Set<EventHandler<CombatEvent>>>();
  private history: CombatEvent[] = [];
  private tracingEnabled: boolean;
  private config: Required<CombatEventBusConfig>;

  constructor(config?: CombatEventBusConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tracingEnabled = this.config.tracingEnabled;
  }

  // ================== Event Emission ==================

  /**
   * Emit a combat started event
   */
  emitCombatStarted(
    data: Omit<CombatStartedEvent, "type" | "timestamp">,
  ): void {
    this.emit({
      ...data,
      type: "combat_started",
      timestamp: Date.now(),
    } as CombatStartedEvent);
  }

  /**
   * Emit an attack started event
   */
  emitAttackStarted(
    data: Omit<AttackStartedEvent, "type" | "timestamp">,
  ): void {
    this.emit({
      ...data,
      type: "attack_started",
      timestamp: Date.now(),
    } as AttackStartedEvent);
  }

  /**
   * Emit a damage dealt event
   */
  emitDamageDealt(data: Omit<DamageDealtEvent, "type" | "timestamp">): void {
    this.emit({
      ...data,
      type: "damage_dealt",
      timestamp: Date.now(),
    } as DamageDealtEvent);
  }

  /**
   * Emit a combat ended event
   */
  emitCombatEnded(data: Omit<CombatEndedEvent, "type" | "timestamp">): void {
    this.emit({
      ...data,
      type: "combat_ended",
      timestamp: Date.now(),
    } as CombatEndedEvent);
  }

  /**
   * Emit an entity died event
   */
  emitEntityDied(data: Omit<EntityDiedEvent, "type" | "timestamp">): void {
    this.emit({
      ...data,
      type: "entity_died",
      timestamp: Date.now(),
    } as EntityDiedEvent);
  }

  /**
   * Emit a retaliation event
   */
  emitRetaliation(data: Omit<RetaliationEvent, "type" | "timestamp">): void {
    this.emit({
      ...data,
      type: "retaliation",
      timestamp: Date.now(),
    } as RetaliationEvent);
  }

  /**
   * Generic emit method for any combat event
   */
  private emit<T extends CombatEvent>(event: T): void {
    // Record to history if tracing is enabled
    if (this.tracingEnabled) {
      this.history.push(event);
      if (this.history.length > this.config.maxHistorySize) {
        this.history.shift();
      }
    }

    // Notify handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(
            `[CombatEventBus] Handler error for ${event.type}:`,
            error,
          );
        }
      }
    }
  }

  // ================== Event Subscription ==================

  /**
   * Subscribe to combat started events
   */
  onCombatStarted(handler: EventHandler<CombatStartedEvent>): Unsubscribe {
    return this.subscribe("combat_started", handler);
  }

  /**
   * Subscribe to attack started events
   */
  onAttackStarted(handler: EventHandler<AttackStartedEvent>): Unsubscribe {
    return this.subscribe("attack_started", handler);
  }

  /**
   * Subscribe to damage dealt events
   */
  onDamageDealt(handler: EventHandler<DamageDealtEvent>): Unsubscribe {
    return this.subscribe("damage_dealt", handler);
  }

  /**
   * Subscribe to combat ended events
   */
  onCombatEnded(handler: EventHandler<CombatEndedEvent>): Unsubscribe {
    return this.subscribe("combat_ended", handler);
  }

  /**
   * Subscribe to entity died events
   */
  onEntityDied(handler: EventHandler<EntityDiedEvent>): Unsubscribe {
    return this.subscribe("entity_died", handler);
  }

  /**
   * Subscribe to retaliation events
   */
  onRetaliation(handler: EventHandler<RetaliationEvent>): Unsubscribe {
    return this.subscribe("retaliation", handler);
  }

  /**
   * Subscribe to all events (useful for logging/debugging)
   */
  onAny(handler: EventHandler<CombatEvent>): Unsubscribe {
    const eventTypes: CombatEventType[] = [
      "combat_started",
      "attack_started",
      "damage_dealt",
      "combat_ended",
      "entity_died",
      "retaliation",
    ];

    const unsubscribes = eventTypes.map((type) =>
      this.subscribe(type, handler),
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }

  /**
   * Generic subscribe method
   */
  private subscribe<T extends CombatEvent>(
    type: T["type"],
    handler: EventHandler<T>,
  ): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const typeHandlers = this.handlers.get(type)!;
    typeHandlers.add(handler as EventHandler<CombatEvent>);

    return () => {
      typeHandlers.delete(handler as EventHandler<CombatEvent>);
    };
  }

  // ================== Tracing / Debugging ==================

  /**
   * Enable event tracing (records events to history)
   */
  enableTracing(): void {
    this.tracingEnabled = true;
  }

  /**
   * Disable event tracing and optionally clear history
   */
  disableTracing(clearHistory = false): void {
    this.tracingEnabled = false;
    if (clearHistory) {
      this.clearHistory();
    }
  }

  /**
   * Check if tracing is enabled
   */
  isTracingEnabled(): boolean {
    return this.tracingEnabled;
  }

  /**
   * Get recorded event history
   */
  getEventHistory(): readonly CombatEvent[] {
    return this.history;
  }

  /**
   * Get events of a specific type from history
   */
  getEventsByType<T extends CombatEvent>(type: T["type"]): readonly T[] {
    return this.history.filter((e) => e.type === type) as T[];
  }

  /**
   * Get events for a specific entity from history
   */
  getEventsForEntity(entityId: string): readonly CombatEvent[] {
    return this.history.filter((e) => {
      if ("attackerId" in e && e.attackerId === entityId) return true;
      if ("targetId" in e && e.targetId === entityId) return true;
      if ("entityId" in e && e.entityId === entityId) return true;
      if ("killerId" in e && e.killerId === entityId) return true;
      return false;
    });
  }

  /**
   * Get events within a tick range
   */
  getEventsInTickRange(
    startTick: number,
    endTick: number,
  ): readonly CombatEvent[] {
    return this.history.filter((e) => e.tick >= startTick && e.tick <= endTick);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  // ================== Lifecycle ==================

  /**
   * Get current statistics
   */
  getStats(): {
    handlerCount: number;
    historySize: number;
    tracingEnabled: boolean;
  } {
    let handlerCount = 0;
    for (const handlers of this.handlers.values()) {
      handlerCount += handlers.size;
    }

    return {
      handlerCount,
      historySize: this.history.length,
      tracingEnabled: this.tracingEnabled,
    };
  }

  /**
   * Remove all handlers and clear history
   */
  destroy(): void {
    this.handlers.clear();
    this.history = [];
    this.tracingEnabled = false;
  }
}

/**
 * Singleton instance for global access (optional usage)
 */
let globalEventBus: CombatEventBus | null = null;

/**
 * Get or create the global combat event bus
 */
export function getCombatEventBus(): CombatEventBus {
  if (!globalEventBus) {
    globalEventBus = new CombatEventBus();
  }
  return globalEventBus;
}

/**
 * Reset the global event bus (for testing)
 */
export function resetCombatEventBus(): void {
  if (globalEventBus) {
    globalEventBus.destroy();
    globalEventBus = null;
  }
}
