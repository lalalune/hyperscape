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
 *
 * Uses self-correcting setTimeout instead of setInterval to prevent drift.
 * setInterval can accumulate timing errors over time, especially under load.
 * This implementation tracks the ideal next tick time and adjusts delays
 * to maintain accurate long-term tick timing.
 */
export class TickSystem {
  private tickNumber = 0;
  private lastTickTime = 0;
  private nextTickTime = 0; // Ideal time for next tick (drift correction)
  private tickTimeout: ReturnType<typeof setTimeout> | null = null;
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
    const now = Date.now();
    this.lastTickTime = now;
    this.nextTickTime = now + TICK_DURATION_MS;

    console.log(
      `[TickSystem] Starting tick loop (${TICK_DURATION_MS}ms per tick, drift-corrected)`,
    );

    // Schedule first tick
    this.scheduleNextTick();
  }

  /**
   * Schedule the next tick with drift correction
   *
   * Instead of fixed intervals, we calculate delay based on when the tick
   * SHOULD fire vs current time. This compensates for:
   * - setTimeout/setInterval inaccuracy
   * - Long-running tick handlers
   * - System load causing delays
   */
  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    // Calculate delay to hit the ideal next tick time
    // If we're behind, this will be small (or even negative → immediate)
    // If we're somehow ahead, this ensures we don't fire too early
    const delay = Math.max(1, this.nextTickTime - now);

    this.tickTimeout = setTimeout(() => {
      this.processTick();
      this.scheduleNextTick();
    }, delay);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout);
      this.tickTimeout = null;
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

    // Advance ideal next tick time (maintains long-term accuracy)
    // Even if this tick was late, the next tick target stays on schedule
    this.nextTickTime += TICK_DURATION_MS;

    // If we've fallen very far behind (>2 ticks), reset to prevent catch-up storm
    if (now > this.nextTickTime + TICK_DURATION_MS) {
      console.warn(
        `[TickSystem] Tick ${this.tickNumber} was ${now - this.nextTickTime + TICK_DURATION_MS}ms late, resetting schedule`,
      );
      this.nextTickTime = now + TICK_DURATION_MS;
    }

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
