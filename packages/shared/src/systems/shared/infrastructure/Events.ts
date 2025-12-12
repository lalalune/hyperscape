import { System } from "./System";
import type { World } from "../../../types/index";
import { EventBus, type EventSubscription } from "..";

type EventCallback<T = Record<string, unknown>> = (
  data?: T,
  extra?: Record<string, unknown>,
) => void;

export interface IEventsInterface extends System {
  emit<T extends string | symbol>(
    event: T,
    ...args: Record<string, unknown>[]
  ): boolean;
  on<T extends string | symbol>(
    event: T,
    fn: (...args: Record<string, unknown>[]) => void,
    context?: Record<string, unknown>,
  ): this;
  off<T extends string | symbol>(
    event: T,
    fn?: (...args: Record<string, unknown>[]) => void,
    context?: Record<string, unknown>,
    once?: boolean,
  ): this;

  // Plugin-specific array-like methods
  push?: (callback: (data: Record<string, unknown>) => void) => void;
  indexOf?: (callback: (data: Record<string, unknown>) => void) => number;
  splice?: (index: number, count: number) => void;
  clear?: () => void;
  get?: (eventName: string) => ((data: Record<string, unknown>) => void)[];
  has?: (eventName: string) => boolean;
  set?: (
    eventName: string,
    callback: (data: Record<string, unknown>) => void,
  ) => void;
  delete?: (eventName: string) => void;
}

/**
 * Events System
 *
 * - Runs on both the server and client.
 * - Used to notify apps of world events like player enter/leave
 *
 */
export class Events extends System implements IEventsInterface {
  private bus: EventBus;
  private eventListeners: Map<
    string | symbol,
    Set<EventCallback<Record<string, unknown>>>
  > = new Map();
  private busListenerMap: Map<
    string | symbol,
    Map<EventCallback<Record<string, unknown>>, EventSubscription>
  > = new Map();

  constructor(world: World) {
    super(world);
    this.bus = new EventBus();
  }

  emit<T extends string | symbol>(
    event: T,
    ...args: Record<string, unknown>[]
  ): boolean {
    // Extract data and extra from args for backward compatibility
    const [data, extra] = args;
    const callbacks = this.eventListeners.get(event);
    if (!callbacks) return false;

    for (const callback of callbacks) {
      callback(data, extra);
    }
    // Bridge world.emit -> EventBus for string events
    if (typeof event === "string") {
      this.bus.emitEvent(event, data || {}, "world");
    }
    return true;
  }

  on<T extends string | symbol>(
    event: T,
    fn: (...args: Record<string, unknown>[]) => void,
    _context?: Record<string, unknown>,
  ): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    // Wrap the function to handle the context if provided
    const handler = _context ? fn.bind(_context) : fn;
    this.eventListeners
      .get(event)!
      .add(handler as EventCallback<Record<string, unknown>>);
    // Bridge EventBus -> world.on for string events
    if (typeof event === "string") {
      let mapForEvent = this.busListenerMap.get(event);
      if (!mapForEvent) {
        mapForEvent = new Map();
        this.busListenerMap.set(event, mapForEvent);
      }
      const sub = this.bus.subscribe(event, (evt) => {
        handler(evt.data);
      });
      mapForEvent.set(handler as EventCallback<Record<string, unknown>>, sub);
    }
    return this;
  }

  off<T extends string | symbol>(
    event: T,
    fn?: (...args: Record<string, unknown>[]) => void,
    _context?: Record<string, unknown>,
    _once?: boolean,
  ): this {
    if (!fn) {
      // Remove all listeners for this event
      this.eventListeners.delete(event);
      if (typeof event === "string") {
        // Unsubscribe all bridged subscriptions for this event
        const mapForEvent = this.busListenerMap.get(event);
        if (mapForEvent) {
          for (const sub of mapForEvent.values()) {
            sub.unsubscribe();
          }
          this.busListenerMap.delete(event);
        }
      }
      return this;
    }

    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      // If context was provided, we need to find the bound version
      // For simplicity, just remove the function as-is
      callbacks.delete(fn);
      if (callbacks.size === 0) {
        this.eventListeners.delete(event);
      }
    }
    if (typeof event === "string") {
      const mapForEvent = this.busListenerMap.get(event);
      if (mapForEvent) {
        const sub = mapForEvent.get(fn);
        if (sub) {
          sub.unsubscribe();
          mapForEvent.delete(fn);
        }
        if (mapForEvent.size === 0) {
          this.busListenerMap.delete(event);
        }
      }
    }
    return this;
  }

  // Plugin-specific array-like methods for compatibility
  push(_callback: (data: Record<string, unknown>) => void): void {
    // This is a no-op for the Map-based implementation
    console.warn("Events.push() called on Map-based Events system");
  }

  indexOf(_callback: (data: Record<string, unknown>) => void): number {
    console.warn("Events.indexOf() called on Map-based Events system");
    return -1;
  }

  splice(_index: number, _count: number): void {
    console.warn("Events.splice() called on Map-based Events system");
  }

  clear(): void {
    this.eventListeners.clear();
  }

  get(eventName: string): ((data: Record<string, unknown>) => void)[] {
    return Array.from(this.eventListeners.get(eventName) || []);
  }

  has(eventName: string): boolean {
    return this.eventListeners.has(eventName);
  }

  set(
    eventName: string,
    callback: (data: Record<string, unknown>) => void,
  ): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners
      .get(eventName)!
      .add(callback as EventCallback<Record<string, unknown>>);
  }

  delete(eventName: string): void {
    this.eventListeners.delete(eventName);
  }

  override destroy(): void {
    this.eventListeners.clear();
  }
}
