/**
 * Tick System
 *
 * Implements RuneScape-style server tick system.
 * All game logic runs on 600ms ticks, ensuring:
 * - Consistent timing for all players
 * - Predictable movement (1-2 tiles per tick)
 * - Fair combat calculations
 * - Synchronized world state
 *
 * The tick system processes events in a specific order:
 * 1. Player inputs (queued since last tick)
 * 2. Movement (advance entities along paths)
 * 3. Combat (attack calculations)
 * 4. Other game logic (resources, NPCs)
 * 5. State broadcast to clients
 */

import { TICK_DURATION_MS } from "@hyperscape/shared";

/**
 * Tick callback priority levels
 * Lower numbers run first
 */
export enum TickPriority {
  INPUT = 0, // Process player inputs first
  MOVEMENT = 1, // Then movement
  COMBAT = 2, // Then combat
  AI = 3, // Then NPC AI
  RESOURCES = 4, // Then resource respawns
  BROADCAST = 10, // Broadcast state last
}

/**
 * Registered tick listener
 */
interface TickListener {
  callback: (tickNumber: number, deltaMs: number) => void;
  priority: TickPriority;
}

/**
 * Server tick system for RuneScape-style game loop
 */
export class TickSystem {
  private tickNumber = 0;
  private lastTickTime = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: TickListener[] = [];
  private isRunning = false;

  /**
   * Start the tick loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn("[TickSystem] Already running");
      return;
    }

    this.isRunning = true;
    this.lastTickTime = Date.now();

    console.log(
      `[TickSystem] Starting tick loop (${TICK_DURATION_MS}ms per tick)`,
    );

    // Use setInterval for consistent tick timing
    // Note: setInterval can drift slightly, but for 600ms ticks this is acceptable
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, TICK_DURATION_MS);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isRunning = false;
    console.log("[TickSystem] Stopped");
  }

  /**
   * Process a single tick
   */
  private processTick(): void {
    const now = Date.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;
    this.tickNumber++;

    // Sort listeners by priority (stable sort preserves registration order within same priority)
    const sortedListeners = [...this.listeners].sort(
      (a, b) => a.priority - b.priority,
    );

    // Call all listeners in priority order
    for (const listener of sortedListeners) {
      try {
        listener.callback(this.tickNumber, deltaMs);
      } catch (error) {
        console.error(
          `[TickSystem] Error in tick listener (priority ${listener.priority}):`,
          error,
        );
      }
    }
  }

  /**
   * Register a tick listener with priority
   * @param callback Function to call each tick
   * @param priority When to run relative to other listeners
   * @returns Unsubscribe function
   */
  onTick(
    callback: (tickNumber: number, deltaMs: number) => void,
    priority: TickPriority = TickPriority.MOVEMENT,
  ): () => void {
    const listener: TickListener = { callback, priority };
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current tick number
   */
  getCurrentTick(): number {
    return this.tickNumber;
  }

  /**
   * Get time until next tick (in ms)
   */
  getTimeUntilNextTick(): number {
    if (!this.isRunning) return TICK_DURATION_MS;
    const elapsed = Date.now() - this.lastTickTime;
    return Math.max(0, TICK_DURATION_MS - elapsed);
  }

  /**
   * Check if tick system is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get number of registered listeners
   */
  getListenerCount(): number {
    return this.listeners.length;
  }
}
