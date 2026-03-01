/**
 * ActivityLoggerSystem - Tracks player activity for admin panel auditing
 * Batches events and flushes to database periodically for efficiency.
 */

import { SystemBase } from "@hyperscape/shared";
import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";
import { inArray } from "drizzle-orm";
import type { DatabaseSystem } from "../DatabaseSystem/index.js";
import type { ActivityLogEntry } from "../../shared/types/index.js";
import * as schema from "../../database/schema.js";

interface ActivityLoggerConfig {
  batchSize: number;
  flushIntervalMs: number;
  debug: boolean;
}

const DEFAULT_CONFIG: ActivityLoggerConfig = {
  batchSize: 50,
  flushIntervalMs: 1000,
  debug: false,
};

type Position = { x: number; y: number; z: number };

export class ActivityLoggerSystem extends SystemBase {
  private databaseSystem!: DatabaseSystem;
  private activityConfig: ActivityLoggerConfig;
  private pendingEntries: ActivityLogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private readonly knownCharacterIds = new Set<string>();
  private readonly skippedCharacterIds = new Set<string>();

  private static readonly ID_CACHE_LIMIT = 5000;
  /** Maximum pending entries before dropping oldest (prevents memory buildup) */
  private static readonly MAX_PENDING_ENTRIES = 1000;

  constructor(world: World, config?: Partial<ActivityLoggerConfig>) {
    super(world, {
      name: "activity-logger",
      dependencies: { required: ["database"], optional: [] },
      autoCleanup: true,
    });
    this.activityConfig = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    this.databaseSystem = this.world.getSystem<DatabaseSystem>("database")!;
    if (!this.databaseSystem) {
      throw new Error("[ActivityLoggerSystem] DatabaseSystem not found");
    }
    this.subscribeToEvents();
  }

  start(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      this.activityConfig.flushIntervalMs,
    );
    if (this.activityConfig.debug) {
      console.log(
        `[ActivityLoggerSystem] Started: batch=${this.activityConfig.batchSize}, interval=${this.activityConfig.flushIntervalMs}ms`,
      );
    }
  }

  /** Helper to create and queue an activity entry */
  private log(
    playerId: string,
    eventType: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
    position?: Position,
  ): void {
    if (!playerId) return;

    // Enforce max queue size to prevent memory buildup
    if (
      this.pendingEntries.length >= ActivityLoggerSystem.MAX_PENDING_ENTRIES
    ) {
      // Drop oldest 25% of entries when at capacity
      const dropCount = Math.floor(
        ActivityLoggerSystem.MAX_PENDING_ENTRIES * 0.25,
      );
      this.pendingEntries.splice(0, dropCount);
      if (this.activityConfig.debug) {
        console.warn(
          `[ActivityLoggerSystem] Queue at capacity, dropped ${dropCount} oldest entries`,
        );
      }
    }

    this.pendingEntries.push({
      playerId,
      eventType,
      action,
      entityType,
      entityId,
      details: details ?? {},
      position,
      timestamp: Date.now(),
    });

    if (this.activityConfig.debug) {
      console.log(`[ActivityLoggerSystem] Queued ${eventType}: ${action}`);
    }

    if (this.pendingEntries.length >= this.activityConfig.batchSize) {
      // Fire-and-forget but don't block the event handler
      // The flush is async and handles its own errors
      void this.flush();
    }
  }

  private rememberCharacterId(cache: Set<string>, characterId: string): void {
    if (!characterId) return;
    if (
      !cache.has(characterId) &&
      cache.size >= ActivityLoggerSystem.ID_CACHE_LIMIT
    ) {
      const oldest = cache.values().next().value as string | undefined;
      if (oldest) {
        cache.delete(oldest);
      }
    }
    cache.add(characterId);
  }

  private async filterPersistableEntries(
    entries: ActivityLogEntry[],
  ): Promise<ActivityLogEntry[]> {
    if (entries.length === 0) return entries;

    const db = this.databaseSystem.getDb();
    if (!db) return entries;

    const unknownIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.playerId)
          .filter(
            (playerId) =>
              playerId &&
              !this.knownCharacterIds.has(playerId) &&
              !this.skippedCharacterIds.has(playerId),
          ),
      ),
    );

    if (unknownIds.length > 0) {
      const rows = await db
        .select({ id: schema.characters.id })
        .from(schema.characters)
        .where(inArray(schema.characters.id, unknownIds));

      const foundIds = new Set(rows.map((row) => row.id));
      for (const playerId of unknownIds) {
        if (foundIds.has(playerId)) {
          this.rememberCharacterId(this.knownCharacterIds, playerId);
        } else {
          this.rememberCharacterId(this.skippedCharacterIds, playerId);
        }
      }
    }

    const persistable = entries.filter((entry) =>
      this.knownCharacterIds.has(entry.playerId),
    );

    if (this.activityConfig.debug && persistable.length !== entries.length) {
      console.log(
        `[ActivityLoggerSystem] Skipped ${entries.length - persistable.length} entries for non-persistent player IDs`,
      );
    }

    return persistable;
  }

  private subscribeToEvents(): void {
    // Items
    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity: number;
      position?: Position;
    }>(EventType.ITEM_PICKUP, (d) =>
      this.log(
        d.playerId,
        "ITEM_PICKUP",
        "picked_up",
        "item",
        d.itemId,
        { quantity: d.quantity },
        d.position,
      ),
    );

    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity: number;
      position?: Position;
    }>(EventType.ITEM_DROPPED, (d) =>
      this.log(
        d.playerId,
        "ITEM_DROP",
        "dropped",
        "item",
        d.itemId,
        { quantity: d.quantity },
        d.position,
      ),
    );

    // Combat
    this.subscribe<{
      mobId: string;
      mobType: string;
      killedBy: string;
      level?: number;
      position?: Position;
    }>(EventType.NPC_DIED, (d) => {
      if (d.killedBy)
        this.log(
          d.killedBy,
          "NPC_KILLED",
          "killed",
          "npc",
          d.mobType,
          { mobId: d.mobId, level: d.level },
          d.position,
        );
    });

    this.subscribe<{
      playerId: string;
      killedBy?: string;
      position?: Position;
    }>(EventType.PLAYER_DIED, (d) =>
      this.log(
        d.playerId,
        "PLAYER_DEATH",
        "died",
        "player",
        d.playerId,
        { killedBy: d.killedBy },
        d.position,
      ),
    );

    // Equipment
    this.subscribe<{ playerId: string; itemId: string; slot: string }>(
      EventType.EQUIPMENT_EQUIPPED,
      (d) =>
        this.log(d.playerId, "EQUIPMENT_EQUIP", "equipped", "item", d.itemId, {
          slot: d.slot,
        }),
    );

    this.subscribe<{ playerId: string; itemId: string; slot: string }>(
      EventType.EQUIPMENT_UNEQUIPPED,
      (d) =>
        this.log(
          d.playerId,
          "EQUIPMENT_UNEQUIP",
          "unequipped",
          "item",
          d.itemId,
          { slot: d.slot },
        ),
    );

    // Bank
    this.subscribe<{ playerId: string; itemId: string; quantity: number }>(
      EventType.BANK_DEPOSIT_SUCCESS,
      (d) =>
        this.log(d.playerId, "BANK_DEPOSIT", "deposited", "item", d.itemId, {
          quantity: d.quantity,
        }),
    );

    this.subscribe<{ playerId: string; itemId: string; quantity: number }>(
      EventType.BANK_WITHDRAW_SUCCESS,
      (d) =>
        this.log(d.playerId, "BANK_WITHDRAW", "withdrew", "item", d.itemId, {
          quantity: d.quantity,
        }),
    );

    // Store
    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity: number;
      type: "buy" | "sell";
      cost: number;
    }>(EventType.STORE_TRANSACTION, (d) =>
      this.log(
        d.playerId,
        d.type === "buy" ? "STORE_BUY" : "STORE_SELL",
        d.type === "buy" ? "bought" : "sold",
        "item",
        d.itemId,
        { quantity: d.quantity, cost: d.cost },
      ),
    );

    // Inventory
    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity: number;
      source?: string;
    }>(EventType.INVENTORY_ITEM_ADDED, (d) =>
      this.log(
        d.playerId,
        "INVENTORY_ITEM_ADDED",
        "acquired",
        "item",
        d.itemId,
        { quantity: d.quantity, source: d.source },
      ),
    );

    this.subscribe<{
      playerId: string;
      itemId: string;
      quantity: number;
      reason?: string;
    }>(EventType.INVENTORY_ITEM_REMOVED, (d) =>
      this.log(d.playerId, "INVENTORY_ITEM_REMOVED", "lost", "item", d.itemId, {
        quantity: d.quantity,
        reason: d.reason,
      }),
    );

    // Skills
    this.subscribe<{
      playerId: string;
      skill: string;
      xp: number;
      level?: number;
    }>(EventType.SKILLS_XP_GAINED, (d) =>
      this.log(d.playerId, "XP_GAINED", "gained_xp", "skill", d.skill, {
        xp: d.xp,
        level: d.level,
      }),
    );

    this.subscribe<{ playerId: string; skill: string; level: number }>(
      EventType.SKILLS_LEVEL_UP,
      (d) =>
        this.log(d.playerId, "LEVEL_UP", "leveled_up", "skill", d.skill, {
          level: d.level,
        }),
    );

    // Sessions
    this.subscribe<{ playerId: string; sessionId: string }>(
      EventType.PLAYER_SESSION_STARTED,
      (d) =>
        this.log(
          d.playerId,
          "SESSION_START",
          "logged_in",
          "session",
          d.sessionId,
        ),
    );

    this.subscribe<{ playerId: string; sessionId: string; reason?: string }>(
      EventType.PLAYER_SESSION_ENDED,
      (d) =>
        this.log(
          d.playerId,
          "SESSION_END",
          "logged_out",
          "session",
          d.sessionId,
          { reason: d.reason },
        ),
    );

    // Trading - Critical for audit trail
    this.subscribe<{
      tradeId: string;
      initiatorId: string;
      recipientId: string;
    }>(EventType.TRADE_STARTED, (d) => {
      // Log for both participants
      this.log(
        d.initiatorId,
        "TRADE_STARTED",
        "started_trade",
        "trade",
        d.tradeId,
        { partnerId: d.recipientId },
      );
      this.log(
        d.recipientId,
        "TRADE_STARTED",
        "joined_trade",
        "trade",
        d.tradeId,
        { partnerId: d.initiatorId },
      );
    });

    this.subscribe<{
      tradeId: string;
      initiatorId: string;
      recipientId: string;
      initiatorItems: Array<{ itemId: string; quantity: number }>;
      recipientItems: Array<{ itemId: string; quantity: number }>;
    }>(EventType.TRADE_COMPLETED, (d) => {
      // Log what each player gave and received - critical for RWT detection
      this.log(
        d.initiatorId,
        "TRADE_COMPLETED",
        "completed_trade",
        "trade",
        d.tradeId,
        {
          partnerId: d.recipientId,
          itemsGiven: d.initiatorItems,
          itemsReceived: d.recipientItems,
        },
      );
      this.log(
        d.recipientId,
        "TRADE_COMPLETED",
        "completed_trade",
        "trade",
        d.tradeId,
        {
          partnerId: d.initiatorId,
          itemsGiven: d.recipientItems,
          itemsReceived: d.initiatorItems,
        },
      );
    });

    this.subscribe<{
      tradeId: string;
      initiatorId: string;
      recipientId: string;
      reason: string;
      cancelledBy?: string;
    }>(EventType.TRADE_CANCELLED, (d) => {
      // Log cancellation for both players
      this.log(
        d.initiatorId,
        "TRADE_CANCELLED",
        "trade_cancelled",
        "trade",
        d.tradeId,
        {
          partnerId: d.recipientId,
          reason: d.reason,
          cancelledBy: d.cancelledBy,
        },
      );
      this.log(
        d.recipientId,
        "TRADE_CANCELLED",
        "trade_cancelled",
        "trade",
        d.tradeId,
        {
          partnerId: d.initiatorId,
          reason: d.reason,
          cancelledBy: d.cancelledBy,
        },
      );
    });
  }

  private async flush(): Promise<void> {
    if (this.pendingEntries.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const entriesToFlush = this.pendingEntries;
    this.pendingEntries = [];
    let entriesToPersist = entriesToFlush;

    try {
      entriesToPersist = await this.filterPersistableEntries(entriesToFlush);
      if (entriesToPersist.length === 0) {
        return;
      }

      const count =
        await this.databaseSystem.insertActivitiesBatchAsync(entriesToPersist);
      if (this.activityConfig.debug && count > 0) {
        console.log(`[ActivityLoggerSystem] Flushed ${count} entries`);
      }
    } catch (error) {
      console.error("[ActivityLoggerSystem] Failed to flush:", error);
      // Re-queue on failure (capped at 2x batch size)
      const maxRequeue = this.activityConfig.batchSize * 2;
      this.pendingEntries = [...entriesToPersist, ...this.pendingEntries].slice(
        0,
        maxRequeue,
      );
    } finally {
      this.isFlushing = false;
    }
  }

  async forceFlush(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  update(_dt: number): void {}

  async destroy(): Promise<void> {
    await this.forceFlush();
    super.destroy();
  }
}
