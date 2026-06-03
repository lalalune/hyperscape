/**
 * Trade Acceptance Handlers
 *
 * Handles trade acceptance and cancellation:
 * - handleTradeAccept: Player accepts current trade state
 * - handleTradeCancelAccept: Player cancels their acceptance
 * - handleTradeCancel: Player cancels/closes trade
 */

import type { World } from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import type { DatabaseConnection } from "./types";
import {
  getTradingSystem,
  getPlayerName,
  getSocketByPlayerId,
  sendTradeError,
  sendTradeUpdate,
  sendTradeConfirmScreen,
  sendToSocket,
  getPlayerId,
} from "./helpers";
import { executeTradeSwap } from "./swap";

// ============================================================================
// Accept Handler
// ============================================================================

/**
 * Handle trade accept
 */
export async function handleTradeAccept(
  socket: ServerSocket,
  data: { tradeId: string },
  world: World,
  db: DatabaseConnection,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  // Set acceptance
  const result = tradingSystem.setAcceptance(data.tradeId, playerId, true);
  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  // Send update to both players
  sendTradeUpdate(world, tradingSystem, data.tradeId);

  // Two-screen confirmation flow (OSRS-style):
  // 1. On offer screen: both accept → move to confirmation screen
  // 2. On confirmation screen: both accept → complete trade
  if (result.moveToConfirming) {
    // Move to confirmation screen
    const moveResult = tradingSystem.moveToConfirmation(data.tradeId);
    if (!moveResult.success) {
      sendTradeError(
        socket,
        moveResult.error!,
        moveResult.errorCode || "UNKNOWN",
      );
      return;
    }

    // Send confirmation screen packet to both players
    sendTradeConfirmScreen(world, tradingSystem, data.tradeId);
  } else if (result.bothAccepted) {
    // Both accepted on confirmation screen - complete the trade
    try {
      await executeTradeSwap(tradingSystem, data.tradeId, world, db);
    } catch (error) {
      console.error("[Trade] Swap failed:", error);
      tradingSystem.cancelTrade(data.tradeId, "server_error");
      sendTradeError(socket, "Trade failed", "SERVER_ERROR");
    }
  }
}

// ============================================================================
// Cancel Accept Handler
// ============================================================================

/**
 * Handle trade accept cancellation
 */
export function handleTradeCancelAccept(
  socket: ServerSocket,
  data: { tradeId: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  const result = tradingSystem.setAcceptance(data.tradeId, playerId, false);
  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  sendTradeUpdate(world, tradingSystem, data.tradeId);
}

// ============================================================================
// Cancel Trade Handler
// ============================================================================

/**
 * Handle trade cancellation
 */
export function handleTradeCancel(
  socket: ServerSocket,
  data: { tradeId: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    sendTradeError(socket, "Not authenticated", "NOT_AUTHENTICATED");
    return;
  }

  const tradingSystem = getTradingSystem(world);
  if (!tradingSystem) {
    sendTradeError(socket, "Trading system unavailable", "SYSTEM_ERROR");
    return;
  }

  const session = tradingSystem.getTradeSession(data.tradeId);
  if (!session) {
    return; // Already cancelled
  }

  // Cancel the trade (with audit trail of who cancelled)
  tradingSystem.cancelTrade(data.tradeId, "cancelled", playerId);

  // Send cancellation to both players
  const partnerPlayerId =
    session.initiator.playerId === playerId
      ? session.recipient.playerId
      : session.initiator.playerId;

  const partnerSocket = getSocketByPlayerId(world, partnerPlayerId);
  if (partnerSocket) {
    sendToSocket(partnerSocket, "tradeCancelled", {
      tradeId: data.tradeId,
      reason: "cancelled",
      message: `${getPlayerName(world, playerId)} cancelled the trade`,
    });
  }

  // Also notify the cancelling player
  sendToSocket(socket, "tradeCancelled", {
    tradeId: data.tradeId,
    reason: "cancelled",
    message: "Trade cancelled",
  });
}
