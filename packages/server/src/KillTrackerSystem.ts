/**
 * KillTrackerSystem - Tracks and persists player NPC kills
 *
 * This server-only system listens for MOB_DIED events and records kill statistics
 * in the database for achievements, quests, and player analytics.
 *
 * Architecture:
 * - Subscribes to MOB_DIED events from MobEntity
 * - Calls DatabaseSystem to increment kill counts
 * - Fire-and-forget persistence (tracked by DatabaseSystem)
 *
 * Usage:
 * The system is automatically registered during server startup and requires
 * no manual interaction. Kill statistics are persisted automatically.
 */

import { SystemBase } from '@hyperscape/shared';
import type { World } from '@hyperscape/shared';
import { EventType } from '@hyperscape/shared';
import type { DatabaseSystem } from './DatabaseSystem';

export class KillTrackerSystem extends SystemBase {
  private databaseSystem!: DatabaseSystem;

  constructor(world: World) {
    super(world, {
      name: 'kill-tracker',
      dependencies: {
        required: ['database'], // Depends on DatabaseSystem for persistence
        optional: [],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Get DatabaseSystem reference
    this.databaseSystem = this.world.getSystem<DatabaseSystem>('database')!;

    if (!this.databaseSystem) {
      throw new Error('[KillTrackerSystem] DatabaseSystem not found');
    }

    // Subscribe to MOB_DIED events
    this.subscribe<{ mobId: string; mobType: string; killedBy: string; level?: number; position?: { x: number; y: number; z: number } }>(
      EventType.MOB_DIED,
      (data) => this.handleMobDied(data)
    );
  }

  start(): void {
    // Nothing to do on start - event subscriptions are already active
  }

  /**
   * Handle mob death event
   *
   * Records the kill in the database for the player who killed the mob.
   * Uses fire-and-forget persistence via DatabaseSystem.incrementNPCKill().
   */
  private handleMobDied(data: { mobId: string; mobType: string; killedBy: string }): void {
    const { mobType, killedBy } = data;

    // Validate data
    if (!mobType || !killedBy) {
      console.warn('[KillTrackerSystem] MOB_DIED event missing mobType or killedBy:', data);
      return;
    }

    // Persist kill count (fire-and-forget - DatabaseSystem tracks the operation)
    this.databaseSystem.incrementNPCKill(killedBy, mobType);
  }

  // No update needed - this is a purely event-driven system
  update(_dt: number): void {
    // No-op
  }

  destroy(): void {
    // Parent cleanup handles unsubscribing from events
    super.destroy();
  }
}
