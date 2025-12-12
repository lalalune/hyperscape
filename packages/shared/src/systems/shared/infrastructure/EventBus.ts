/**
 * Event Bus System
 *
 * Type-safe event bus for inter-system communication.
 * Provides subscription management, event history, and request-response patterns.
 *
 * Features:
 * - Type-safe event emission and subscription
 * - Automatic subscription cleanup
 * - Event history for debugging
 * - Request-response pattern with timeout
 * - Active subscription tracking
 */

import EventEmitter from "eventemitter3";
import { AnyEvent, EventPayloads, EventType } from "../../../types/events";
import type {
  SystemEvent,
  EventHandler,
  EventSubscription,
} from "../../../types/events";

/**
 * Type-safe event bus for world-wide event communication
 */
export class EventBus extends EventEmitter {
  private subscriptionCounter = 0;
  private activeSubscriptions = new Map<string, EventSubscription>();
  private eventHistory: SystemEvent<AnyEvent>[] = [];
  private historyWriteIndex = 0;
  private historySize = 0;
  private readonly maxHistorySize = 1000;

  /**
   * Emit a typed event
   */
  emitEvent<T extends AnyEvent>(
    type: EventType | string,
    data: T,
    source: string = "unknown",
  ): void {
    const event: SystemEvent<T> = {
      type: type as EventType,
      data,
      source,
      timestamp: Date.now(),
      id: `${source}-${type}-${++this.subscriptionCounter}`,
    };

    // Ring buffer for O(1) history insertion
    this.eventHistory[this.historyWriteIndex] = event;
    this.historyWriteIndex = (this.historyWriteIndex + 1) % this.maxHistorySize;
    if (this.historySize < this.maxHistorySize) this.historySize++;

    this.emit(type, event);
  }

  /**
   * Subscribe to typed events with automatic cleanup
   */
  subscribe<K extends keyof EventPayloads>(
    type: K,
    handler: EventHandler<EventPayloads[K]>,
    once?: boolean,
  ): EventSubscription;
  subscribe<T extends AnyEvent>(
    type: string,
    handler: EventHandler<T>,
    once?: boolean,
  ): EventSubscription;
  subscribe(
    type: string | keyof EventPayloads,
    handler: EventHandler<AnyEvent | EventPayloads[keyof EventPayloads]>,
    once: boolean = false,
  ): EventSubscription {
    const subscriptionId = `sub-${++this.subscriptionCounter}`;
    let active = true;

    const wrappedHandler = (
      event: SystemEvent<AnyEvent | EventPayloads[keyof EventPayloads]>,
    ) => {
      if (!active) return;
      handler(event);
      if (once) subscription.unsubscribe();
    };

    // Register the handler
    if (once) {
      this.once(type, wrappedHandler);
    } else {
      this.on(type, wrappedHandler);
    }

    const subscription: EventSubscription = {
      unsubscribe: () => {
        if (!active) return;
        active = false;
        this.off(type, wrappedHandler);
        this.activeSubscriptions.delete(subscriptionId);
      },
      get active() {
        return active;
      },
    };

    this.activeSubscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * Subscribe to an event only once
   */
  subscribeOnce<K extends keyof EventPayloads>(
    type: K,
    handler: EventHandler<EventPayloads[K]>,
  ): EventSubscription;
  subscribeOnce<T extends AnyEvent>(
    type: string,
    handler: EventHandler<T>,
  ): EventSubscription;
  subscribeOnce(
    type: string | keyof EventPayloads,
    handler: EventHandler<AnyEvent | EventPayloads[keyof EventPayloads]>,
  ): EventSubscription {
    return this.subscribe(
      type as string,
      handler as EventHandler<AnyEvent>,
      true,
    );
  }

  /**
   * Request-response pattern with timeout
   */
  async request<
    TRequest extends AnyEvent = AnyEvent,
    TResponse extends AnyEvent = AnyEvent,
  >(
    requestType: string,
    data: TRequest,
    source: string,
    timeout: number = 5000,
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const responseType = `${requestType}:response`;
      const requestId = `req-${++this.subscriptionCounter}`;

      const timeoutHandle = setTimeout(() => {
        subscription.unsubscribe();
        reject(
          new Error(`Request ${requestType} timed out after ${timeout}ms`),
        );
      }, timeout);

      const subscription = this.subscribeOnce<TResponse>(
        responseType,
        (event) => {
          clearTimeout(timeoutHandle);
          resolve(event.data);
        },
      );

      // Emit the request with response info
      this.emitEvent(
        requestType as EventType,
        {
          ...data,
          _requestId: requestId,
          _responseType: responseType,
        } as TRequest,
        source,
      );
    });
  }

  /**
   * Respond to a request
   */
  respond<T extends AnyEvent>(
    originalEvent: SystemEvent<{ _responseType?: string; _requestId?: string }>,
    responseData: T,
    source: string,
  ): void {
    if (!originalEvent.data._responseType || !originalEvent.data._requestId)
      return;
    this.emitEvent(originalEvent.data._responseType, responseData, source);
  }

  /**
   * Get event history for debugging
   */
  getEventHistory(filterByType?: string): SystemEvent[] {
    const result: SystemEvent[] = [];
    const startIndex =
      this.historySize < this.maxHistorySize ? 0 : this.historyWriteIndex;
    for (let i = 0; i < this.historySize; i++) {
      const event = this.eventHistory[(startIndex + i) % this.maxHistorySize];
      if (!filterByType || event.type === filterByType) result.push(event);
    }
    return result;
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    for (const subscription of this.activeSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.activeSubscriptions.clear();
    this.eventHistory.length = 0;
    this.historyWriteIndex = 0;
    this.historySize = 0;
    this.removeAllListeners();
  }
}

export type { SystemEvent, EventHandler, EventSubscription };
