/**
 * Duel Rules Handlers
 *
 * Handles duel rules negotiation:
 * - handleDuelToggleRule: Toggle a rule on/off
 * - handleDuelToggleEquipment: Toggle equipment slot restriction
 * - handleDuelAcceptRules: Accept current rules configuration
 */

import type { World, DuelRules, DuelEquipmentSlot } from "@hyperforge/shared";
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
// Toggle Rule Handler
// ============================================================================

/**
 * Handle toggling a duel rule
 */
export function handleDuelToggleRule(
  socket: ServerSocket,
  data: { duelId: string; rule: keyof DuelRules },
  world: World,
): void {
  const auth = withDuelAuth(socket, world);
  if (!auth) return;
  const { playerId, duelSystem } = auth;

  if (!rateLimiter.tryOperation(playerId)) {
    sendDuelError(socket, "Please wait before toggling rules", "RATE_LIMITED");
    return;
  }

  const { duelId, rule } = data;

  // Validate duel is in RULES state before processing
  if (!assertDuelState(socket, duelSystem, duelId, playerId, ["RULES"])) {
    return;
  }

  // Validate rule is a valid DuelRules key
  const validRules: Array<keyof DuelRules> = [
    "noRanged",
    "noMelee",
    "noMagic",
    "noSpecialAttack",
    "noPrayer",
    "noPotions",
    "noFood",
    "noForfeit",
    "noMovement",
    "funWeapons",
  ];

  if (!validRules.includes(rule)) {
    sendDuelError(socket, "Invalid rule", "INVALID_RULE");
    return;
  }

  const result = duelSystem.toggleRule(duelId, playerId, rule);

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

  // Notify both players of the rule change
  const updatePayload = {
    duelId,
    rules: session.rules,
    challengerAccepted: session.challengerAccepted,
    targetAccepted: session.targetAccepted,
    modifiedBy: playerId,
  };

  sendToSocket(socket, DUEL_PACKETS.RULES_UPDATED, updatePayload);

  const opponentId =
    playerId === session.challengerId ? session.targetId : session.challengerId;
  const opponentSocket = getSocketByPlayerId(world, opponentId);
  if (opponentSocket) {
    sendToSocket(opponentSocket, DUEL_PACKETS.RULES_UPDATED, updatePayload);
  }
}

// ============================================================================
// Toggle Equipment Handler
// ============================================================================

/**
 * Handle toggling equipment slot restriction
 */
export function handleDuelToggleEquipment(
  socket: ServerSocket,
  data: { duelId: string; slot: DuelEquipmentSlot },
  world: World,
): void {
  const auth = withDuelAuth(socket, world);
  if (!auth) return;
  const { playerId, duelSystem } = auth;

  if (!rateLimiter.tryOperation(playerId)) {
    sendDuelError(
      socket,
      "Please wait before toggling equipment",
      "RATE_LIMITED",
    );
    return;
  }

  const { duelId, slot } = data;

  // Validate duel is in RULES state before processing
  if (!assertDuelState(socket, duelSystem, duelId, playerId, ["RULES"])) {
    return;
  }

  // Validate slot is a valid equipment slot
  const validSlots: DuelEquipmentSlot[] = [
    "head",
    "cape",
    "amulet",
    "weapon",
    "body",
    "shield",
    "legs",
    "gloves",
    "boots",
    "ring",
  ];

  if (!validSlots.includes(slot)) {
    sendDuelError(socket, "Invalid equipment slot", "INVALID_SLOT");
    return;
  }

  const result = duelSystem.toggleEquipmentRestriction(duelId, playerId, slot);

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

  // Notify both players of the equipment change
  const updatePayload = {
    duelId,
    equipmentRestrictions: session.equipmentRestrictions,
    challengerAccepted: session.challengerAccepted,
    targetAccepted: session.targetAccepted,
    modifiedBy: playerId,
  };

  sendToSocket(socket, DUEL_PACKETS.EQUIPMENT_UPDATED, updatePayload);

  const opponentId =
    playerId === session.challengerId ? session.targetId : session.challengerId;
  const opponentSocket = getSocketByPlayerId(world, opponentId);
  if (opponentSocket) {
    sendToSocket(opponentSocket, DUEL_PACKETS.EQUIPMENT_UPDATED, updatePayload);
  }
}

// ============================================================================
// Accept Rules Handler
// ============================================================================

/**
 * Handle accepting current rules configuration
 */
export function handleDuelAcceptRules(
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

  // Validate duel is in RULES state before accepting
  if (!assertDuelState(socket, duelSystem, duelId, playerId, ["RULES"])) {
    return;
  }

  const result = duelSystem.acceptRules(duelId, playerId);

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

  // Check if both players accepted and we moved to STAKES
  const movedToStakes = session.state === "STAKES";

  // Notify both players
  const updatePayload = {
    duelId,
    challengerAccepted: session.challengerAccepted,
    targetAccepted: session.targetAccepted,
    state: session.state,
    movedToStakes,
  };

  sendToSocket(socket, DUEL_PACKETS.ACCEPTANCE_UPDATED, updatePayload);

  const opponentId =
    playerId === session.challengerId ? session.targetId : session.challengerId;
  const opponentSocket = getSocketByPlayerId(world, opponentId);
  if (opponentSocket) {
    sendToSocket(
      opponentSocket,
      DUEL_PACKETS.ACCEPTANCE_UPDATED,
      updatePayload,
    );
  }

  // If moved to stakes screen, send state change notification
  if (movedToStakes) {
    const statePayload = {
      duelId,
      state: "STAKES",
      rules: session.rules,
      equipmentRestrictions: session.equipmentRestrictions,
    };

    sendToSocket(socket, DUEL_PACKETS.STATE_CHANGED, statePayload);
    if (opponentSocket) {
      sendToSocket(opponentSocket, DUEL_PACKETS.STATE_CHANGED, statePayload);
    }
  }
}

// ============================================================================
// Cancel Duel Handler
// ============================================================================

/**
 * Handle canceling a duel session
 */
export function handleDuelCancel(
  socket: ServerSocket,
  data: { duelId: string },
  world: World,
): void {
  const auth = withDuelAuth(socket, world);
  if (!auth) return;
  const { playerId, duelSystem } = auth;

  const { duelId } = data;

  // Validate duel exists, player is participant, and duel is in a cancellable state.
  // FIGHTING duels use forfeit, not cancel. FINISHED duels are already resolving.
  const session = assertDuelState(socket, duelSystem, duelId, playerId, [
    "RULES",
    "STAKES",
    "CONFIRMING",
    "COUNTDOWN",
  ]);
  if (!session) {
    return;
  }

  const opponentId =
    playerId === session.challengerId ? session.targetId : session.challengerId;

  const result = duelSystem.cancelDuel(duelId, "player_cancelled", playerId);

  if (!result.success) {
    sendDuelError(
      socket,
      result.error ?? "Unknown error",
      result.errorCode || "UNKNOWN",
    );
    return;
  }

  // Notify both players
  const cancelPayload = {
    duelId,
    reason: "player_cancelled",
    cancelledBy: playerId,
  };

  sendToSocket(socket, DUEL_PACKETS.CANCELLED, cancelPayload);

  const opponentSocket = getSocketByPlayerId(world, opponentId);
  if (opponentSocket) {
    sendToSocket(opponentSocket, DUEL_PACKETS.CANCELLED, cancelPayload);
  }
}
