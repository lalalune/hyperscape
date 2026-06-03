/**
 * Duel Confirmation Handlers
 *
 * Handles the final confirmation screen before duel combat begins:
 * - handleDuelAcceptFinal: Accept final confirmation and start duel
 *
 * When both players accept, an arena is reserved and countdown begins.
 */

import type { World } from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import {
  sendDuelError,
  sendToSocket,
  getSocketByPlayerId,
  rateLimiter,
  withDuelAuth,
  assertDuelState,
  DUEL_PACKETS,
} from "./helpers";

// ============================================================================
// Accept Final Handler
// ============================================================================

/**
 * Handle final confirmation acceptance
 *
 * When both players accept:
 * 1. Reserve an arena from the pool
 * 2. Transition to COUNTDOWN state
 * 3. Notify both players to begin teleportation/countdown
 */
export function handleDuelAcceptFinal(
  socket: ServerSocket,
  data: { duelId: string },
  world: World,
): void {
  const auth = withDuelAuth(socket, world);
  if (!auth) return;
  const { playerId, duelSystem } = auth;

  // Rate limit accept operations to prevent spam
  if (!rateLimiter.tryOperation(playerId)) {
    sendDuelError(socket, "Please wait before accepting", "RATE_LIMITED");
    return;
  }

  const { duelId } = data;

  // Validate duel is in CONFIRMING state before accepting
  if (!assertDuelState(socket, duelSystem, duelId, playerId, ["CONFIRMING"])) {
    return;
  }

  const result = duelSystem.acceptFinal(duelId, playerId);

  if (!result.success) {
    sendDuelError(
      socket,
      result.error ?? "Unknown error",
      result.errorCode || "UNKNOWN",
    );
    return;
  }

  // Get session to send updates to both players
  const session = duelSystem.getDuelSession(duelId);
  if (!session) return;

  // Check if we moved to countdown (both accepted)
  const startedCountdown = session.state === "COUNTDOWN";

  if (startedCountdown) {
    // Both players confirmed - send countdown start to both
    const countdownPayload = {
      duelId,
      state: "COUNTDOWN",
      arenaId: session.arenaId,
      challengerId: session.challengerId,
      targetId: session.targetId,
    };

    sendToSocket(socket, DUEL_PACKETS.STATE_CHANGED, countdownPayload);

    const opponentId =
      playerId === session.challengerId
        ? session.targetId
        : session.challengerId;
    const opponentSocket = getSocketByPlayerId(world, opponentId);
    if (opponentSocket) {
      sendToSocket(
        opponentSocket,
        DUEL_PACKETS.STATE_CHANGED,
        countdownPayload,
      );
    }
  } else {
    // Just one player accepted - send acceptance update
    const updatePayload = {
      duelId,
      challengerAccepted: session.challengerAccepted,
      targetAccepted: session.targetAccepted,
    };

    sendToSocket(socket, DUEL_PACKETS.ACCEPTANCE_UPDATED, updatePayload);

    const opponentId =
      playerId === session.challengerId
        ? session.targetId
        : session.challengerId;
    const opponentSocket = getSocketByPlayerId(world, opponentId);
    if (opponentSocket) {
      sendToSocket(
        opponentSocket,
        DUEL_PACKETS.ACCEPTANCE_UPDATED,
        updatePayload,
      );
    }
  }
}
