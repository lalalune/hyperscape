/**
 * AuditLogger - Structured audit logging for economic transactions
 *
 * Provides a centralized audit trail for all financial and high-value
 * operations in the game. Logs are structured for easy parsing by
 * log aggregation systems (CloudWatch, Datadog, Splunk, etc.)
 *
 * Usage:
 * - Duel stake transfers
 * - Trade completions
 * - Bank operations
 * - Shop transactions
 *
 * SRP: Only handles audit logging, no business logic
 */

import type { StakedItem } from "@hyperforge/shared";

// ============================================================================
// Types
// ============================================================================

export type AuditEntityType = "DUEL" | "TRADE" | "BANK" | "SHOP" | "INVENTORY";

export type AuditAction =
  // Duel actions
  | "DUEL_STAKE_ADD"
  | "DUEL_STAKE_REMOVE"
  | "DUEL_COMPLETE"
  | "DUEL_CANCELLED"
  // Trade actions
  | "TRADE_COMPLETE"
  | "TRADE_CANCELLED"
  // Bank actions
  | "BANK_DEPOSIT"
  | "BANK_WITHDRAW"
  // Shop actions
  | "SHOP_BUY"
  | "SHOP_SELL";

export interface AuditLogEntry {
  timestamp: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  playerId: string;
  data: Record<string, unknown>;
}

// ============================================================================
// AuditLogger Class
// ============================================================================

export class AuditLogger {
  private static instance: AuditLogger;

  /**
   * Get singleton instance
   */
  static getInstance(): AuditLogger {
    if (!this.instance) {
      this.instance = new AuditLogger();
    }
    return this.instance;
  }

  /**
   * Core logging method - writes structured JSON to console
   * In production, this should be picked up by log aggregation
   */
  log(entry: Omit<AuditLogEntry, "timestamp">): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Structured log for log aggregation (CloudWatch, Datadog, etc.)
    // Using [AUDIT] prefix for easy filtering
    console.log("[AUDIT]", JSON.stringify(fullEntry));
  }

  // ==========================================================================
  // Duel-specific logging methods
  // ==========================================================================

  /**
   * Log when a player adds an item to their duel stakes
   */
  logDuelStakeAdd(duelId: string, playerId: string, item: StakedItem): void {
    this.log({
      action: "DUEL_STAKE_ADD",
      entityType: "DUEL",
      entityId: duelId,
      playerId,
      data: {
        itemId: item.itemId,
        quantity: item.quantity,
        value: item.value,
        inventorySlot: item.inventorySlot,
      },
    });
  }

  /**
   * Log when a player removes an item from their duel stakes
   */
  logDuelStakeRemove(duelId: string, playerId: string, item: StakedItem): void {
    this.log({
      action: "DUEL_STAKE_REMOVE",
      entityType: "DUEL",
      entityId: duelId,
      playerId,
      data: {
        itemId: item.itemId,
        quantity: item.quantity,
        value: item.value,
        inventorySlot: item.inventorySlot,
      },
    });
  }

  /**
   * Log when a duel completes with stake transfer
   */
  logDuelComplete(
    duelId: string,
    winnerId: string,
    loserId: string,
    winnerReceives: StakedItem[],
    loserStakes: StakedItem[],
    totalValue: number,
    reason: "death" | "forfeit",
  ): void {
    this.log({
      action: "DUEL_COMPLETE",
      entityType: "DUEL",
      entityId: duelId,
      playerId: winnerId,
      data: {
        loserId,
        reason,
        itemsTransferred: winnerReceives.map((s) => ({
          itemId: s.itemId,
          quantity: s.quantity,
          value: s.value,
        })),
        loserOriginalStakes: loserStakes.map((s) => ({
          itemId: s.itemId,
          quantity: s.quantity,
          value: s.value,
        })),
        totalValue,
        itemCount: winnerReceives.length,
      },
    });
  }

  /**
   * Log when a duel is cancelled (returns stakes to players)
   */
  logDuelCancelled(
    duelId: string,
    cancelledBy: string | undefined,
    reason: string,
    challengerId: string,
    targetId: string,
    challengerStakes: StakedItem[],
    targetStakes: StakedItem[],
  ): void {
    this.log({
      action: "DUEL_CANCELLED",
      entityType: "DUEL",
      entityId: duelId,
      playerId: cancelledBy || challengerId,
      data: {
        reason,
        challengerId,
        targetId,
        challengerStakesReturned: challengerStakes.map((s) => ({
          itemId: s.itemId,
          quantity: s.quantity,
          value: s.value,
        })),
        targetStakesReturned: targetStakes.map((s) => ({
          itemId: s.itemId,
          quantity: s.quantity,
          value: s.value,
        })),
        challengerTotalValue: challengerStakes.reduce(
          (sum, s) => sum + s.value,
          0,
        ),
        targetTotalValue: targetStakes.reduce((sum, s) => sum + s.value, 0),
      },
    });
  }

  // ==========================================================================
  // Trade-specific logging methods (for future use)
  // ==========================================================================

  /**
   * Log when a trade completes
   */
  logTradeComplete(
    tradeId: string,
    player1Id: string,
    player2Id: string,
    player1Gives: Array<{ itemId: string; quantity: number; value: number }>,
    player2Gives: Array<{ itemId: string; quantity: number; value: number }>,
  ): void {
    this.log({
      action: "TRADE_COMPLETE",
      entityType: "TRADE",
      entityId: tradeId,
      playerId: player1Id,
      data: {
        player2Id,
        player1Gives,
        player2Gives,
        player1TotalValue: player1Gives.reduce((sum, i) => sum + i.value, 0),
        player2TotalValue: player2Gives.reduce((sum, i) => sum + i.value, 0),
      },
    });
  }
}
