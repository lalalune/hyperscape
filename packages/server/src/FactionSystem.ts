/**
 * FactionSystem - Tracks and persists player faction reputation
 *
 * This server-only system listens for FACTION_REPUTATION_CHANGED events and records
 * reputation changes in the database for quests, dialogue, and faction rewards.
 *
 * Architecture:
 * - Subscribes to FACTION_REPUTATION_CHANGED events from QuestSystem
 * - Calls DatabaseSystem to update faction reputation
 * - Fire-and-forget persistence (tracked by DatabaseSystem)
 *
 * Usage:
 * The system is automatically registered during server startup and requires
 * no manual interaction. Faction reputation changes are persisted automatically.
 */

import { SystemBase } from '@hyperscape/shared';
import type { World } from '@hyperscape/shared';
import { EventType } from '@hyperscape/shared';
import type { DatabaseSystem } from './DatabaseSystem';

export class FactionSystem extends SystemBase {
  private databaseSystem!: DatabaseSystem;

  constructor(world: World) {
    super(world, {
      name: 'faction',
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
      throw new Error('[FactionSystem] DatabaseSystem not found');
    }

    // Subscribe to FACTION_REPUTATION_CHANGED events
    this.subscribe<{ playerId: string; faction: string; amount: number }>(
      EventType.FACTION_REPUTATION_CHANGED,
      (data) => this.handleReputationChanged(data)
    );

    // Subscribe to PLAYER_REGISTERED to initialize faction reputation
    this.subscribe<{ playerId: string }>(
      EventType.PLAYER_REGISTERED,
      (data) => this.handlePlayerRegistered(data)
    );

    this.logger.info('FactionSystem initialized');
  }

  start(): void {
    // Nothing to do on start - event subscriptions are already active
  }

  /**
   * Handle player registration event
   *
   * Initializes faction reputation for new players.
   */
  private async handlePlayerRegistered(data: { playerId: string }): Promise<void> {
    const { playerId } = data;

    if (!playerId) {
      this.logger.warn('[FactionSystem] PLAYER_REGISTERED event missing playerId:', data);
      return;
    }

    // Initialize faction reputation (fire-and-forget)
    await this.databaseSystem.initializeFactionReputation(playerId);
    this.logger.info(`[FactionSystem] Initialized faction reputation for player: ${playerId}`);
  }

  /**
   * Handle faction reputation change event
   *
   * Updates the player's faction reputation in the database.
   * Uses fire-and-forget persistence via DatabaseSystem.updateFactionReputation().
   */
  private handleReputationChanged(data: { playerId: string; faction: string; amount: number }): void {
    const { playerId, faction, amount } = data;

    // Validate data
    if (!playerId || !faction || typeof amount !== 'number') {
      this.logger.warn('[FactionSystem] FACTION_REPUTATION_CHANGED event missing required fields:', data);
      return;
    }

    // Persist reputation change (fire-and-forget - DatabaseSystem tracks the operation)
    this.databaseSystem.updateFactionReputation(playerId, faction, amount);

    this.logger.info(`[FactionSystem] Updated ${faction} reputation for player ${playerId}: ${amount >= 0 ? '+' : ''}${amount}`);
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
