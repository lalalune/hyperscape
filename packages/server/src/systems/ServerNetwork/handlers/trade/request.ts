/**
 * Trade Request Handlers
 *
 * Handles trade request initiation and response:
 * - handleTradeRequest: Player A requests trade with Player B
 * - handleTradeRequestRespond: Player B accepts/declines trade request
 */

import { type World, isValidPlayerID, uuid } from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import { sendSuccessToast, hasActiveInterfaceSession } from "../common";
import {
  rateLimiter,
  getTradingSystem,
  getPendingTradeManager,
  getPlayerName,
  getPlayerCombatLevel,
  arePlayersInTradeRange,
  getSocketByPlayerId,
  sendTradeError,
  sendToSocket,
  getPlayerId,
  calculateFreeSlots,
} from "./helpers";

// ============================================================================
// Trade Request Handler
// ============================================================================

/**
 * Handle trade request from Player A to Player B
 *
 * OSRS-style behavior: If not in range, player walks up to target first
 */
export function handleTradeRequest(
  socket: ServerSocket,
  data: { targetPlayerId: string },
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

  // Rate limit check
  if (!rateLimiter.tryOperation(playerId)) {
    sendTradeError(
      socket,
      "Please wait before requesting again",
      "RATE_LIMITED",
    );
    return;
  }

  // Validate target player exists and is online
  const targetPlayerId = data.targetPlayerId;
  if (!isValidPlayerID(targetPlayerId)) {
    sendTradeError(socket, "Invalid player", "INVALID_PLAYER");
    return;
  }

  if (!tradingSystem.isPlayerOnline(targetPlayerId)) {
    sendTradeError(socket, "Player is not online", "PLAYER_OFFLINE");
    return;
  }

  // Interface blocking check - can't trade while using bank/store/dialogue
  if (hasActiveInterfaceSession(world, playerId)) {
    sendTradeError(
      socket,
      "You can't trade while using another interface",
      "INTERFACE_OPEN",
    );
    return;
  }

  if (hasActiveInterfaceSession(world, targetPlayerId)) {
    sendTradeError(socket, "That player is busy", "PLAYER_BUSY");
    return;
  }

  // Duel blocking check - can't trade while in a duel
  const duelSystem = world.getSystem("duel") as
    | { isPlayerInDuel?: (id: string) => boolean }
    | undefined;
  if (duelSystem?.isPlayerInDuel?.(playerId)) {
    sendTradeError(socket, "You can't trade while in a duel", "IN_DUEL");
    return;
  }
  if (duelSystem?.isPlayerInDuel?.(targetPlayerId)) {
    sendTradeError(socket, "That player is in a duel", "TARGET_IN_DUEL");
    return;
  }

  // Function to actually send the trade request (called when in range)
  const sendTradeRequestToTarget = (): void => {
    // Re-validate target is still online and available
    if (!tradingSystem.isPlayerOnline(targetPlayerId)) {
      sendTradeError(socket, "Player is not online", "PLAYER_OFFLINE");
      return;
    }

    if (hasActiveInterfaceSession(world, targetPlayerId)) {
      sendTradeError(socket, "That player is busy", "PLAYER_BUSY");
      return;
    }

    // Re-check duel status (could have changed while walking)
    if (duelSystem?.isPlayerInDuel?.(playerId)) {
      sendTradeError(socket, "You can't trade while in a duel", "IN_DUEL");
      return;
    }
    if (duelSystem?.isPlayerInDuel?.(targetPlayerId)) {
      sendTradeError(socket, "That player is in a duel", "TARGET_IN_DUEL");
      return;
    }

    // Get initiator info
    const initiatorName = getPlayerName(world, playerId);
    const initiatorLevel = getPlayerCombatLevel(world, playerId);

    // Create trade request
    const result = tradingSystem.createTradeRequest(
      playerId,
      initiatorName,
      socket.id,
      targetPlayerId,
    );

    if (!result.success) {
      sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
      return;
    }

    // Send notification to target player as OSRS-style pink chat message
    const targetSocket = getSocketByPlayerId(world, targetPlayerId);
    if (targetSocket) {
      // Send trade request as a clickable chat message (OSRS-style)
      const chatMessage = {
        id: uuid(),
        from: "",
        fromId: playerId,
        body: `${initiatorName} wishes to trade with you.`,
        text: `${initiatorName} wishes to trade with you.`,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        type: "trade_request" as const,
        tradeId: result.tradeId,
      };
      sendToSocket(targetSocket, "chatAdded", chatMessage);

      // Also send the structured trade request data for UI purposes
      sendToSocket(targetSocket, "tradeIncoming", {
        tradeId: result.tradeId,
        fromPlayerId: playerId,
        fromPlayerName: initiatorName,
        fromPlayerLevel: initiatorLevel,
      });
    } else {
      // Target socket not found - cancel the trade
      tradingSystem.cancelTrade(result.tradeId!, "disconnected");
      sendTradeError(socket, "Player is not available", "PLAYER_OFFLINE");
      return;
    }

    // Send confirmation to initiator
    sendSuccessToast(
      socket,
      `Trade request sent to ${getPlayerName(world, targetPlayerId)}`,
    );
  };

  // Check if players are already in range
  if (arePlayersInTradeRange(world, playerId, targetPlayerId)) {
    sendTradeRequestToTarget();
    return;
  }

  // Not in range - use PendingTradeManager to walk up to target first
  const pendingTradeManager = getPendingTradeManager(world);
  if (!pendingTradeManager) {
    sendTradeError(
      socket,
      "You need to be closer to trade with that player",
      "TOO_FAR",
    );
    return;
  }

  // Queue pending trade - player will walk up to target, then send request
  pendingTradeManager.queuePendingTrade(
    playerId,
    targetPlayerId,
    sendTradeRequestToTarget,
  );
}

// ============================================================================
// Trade Request Response Handler
// ============================================================================

/**
 * Handle trade request response (accept/decline)
 */
export function handleTradeRequestRespond(
  socket: ServerSocket,
  data: { tradeId: string; accept: boolean },
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
    sendTradeError(socket, "Trade request expired", "INVALID_TRADE");
    return;
  }

  // Get recipient info
  const recipientName = getPlayerName(world, playerId);

  // Process the response
  const result = tradingSystem.respondToTradeRequest(
    data.tradeId,
    playerId,
    recipientName,
    socket.id,
    data.accept,
  );

  if (!result.success) {
    sendTradeError(socket, result.error!, result.errorCode || "UNKNOWN");
    return;
  }

  if (!data.accept) {
    // Declined - notify initiator
    const initiatorSocket = getSocketByPlayerId(
      world,
      session.initiator.playerId,
    );
    if (initiatorSocket) {
      sendToSocket(initiatorSocket, "tradeCancelled", {
        tradeId: data.tradeId,
        reason: "declined",
        message: `${recipientName} declined your trade request`,
      });
    }
    return;
  }

  // Trade accepted - send tradeStarted to both
  const initiatorSocket = getSocketByPlayerId(
    world,
    session.initiator.playerId,
  );
  const recipientSocket = socket;

  const initiatorLevel = getPlayerCombatLevel(
    world,
    session.initiator.playerId,
  );
  const recipientLevel = getPlayerCombatLevel(world, playerId);

  // Calculate initial free slots for each player (OSRS-style indicator)
  const initiatorFreeSlots = calculateFreeSlots(
    world,
    session.initiator.playerId,
    [],
  );
  const recipientFreeSlots = calculateFreeSlots(world, playerId, []);

  // Send to initiator (partner = recipient)
  if (initiatorSocket) {
    sendToSocket(initiatorSocket, "tradeStarted", {
      tradeId: data.tradeId,
      partnerId: playerId,
      partnerName: recipientName,
      partnerLevel: recipientLevel,
      partnerFreeSlots: recipientFreeSlots,
    });
  }

  // Send to recipient (partner = initiator)
  sendToSocket(recipientSocket, "tradeStarted", {
    tradeId: data.tradeId,
    partnerId: session.initiator.playerId,
    partnerName: session.initiator.playerName,
    partnerLevel: initiatorLevel,
    partnerFreeSlots: initiatorFreeSlots,
  });
}
