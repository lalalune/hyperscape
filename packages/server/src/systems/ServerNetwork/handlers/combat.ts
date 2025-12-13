/**
 * Combat Handler
 *
 * Handles combat-related actions from clients.
 * Uses shared security infrastructure:
 * - SlidingWindowRateLimiter for rate limiting
 * - InputValidation for entity ID validation
 * - Timestamp validation for replay attack prevention
 *
 * Security measures:
 * - Input validation (type, format, length)
 * - Rate limiting (3 requests/sec)
 * - Timestamp validation (prevents replay attacks)
 * - Server-side mob existence verification
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World, INPUT_LIMITS } from "@hyperscape/shared";
import {
  isValidNpcId,
  validateRequestTimestamp,
} from "../services/InputValidation";
import { getCombatRateLimiter } from "../services/SlidingWindowRateLimiter";

/**
 * Valid attack styles (whitelist)
 */
const VALID_ATTACK_STYLES = new Set([
  "accurate",
  "aggressive",
  "defensive",
  "controlled",
]);

/**
 * Send error feedback to client
 */
function sendCombatError(socket: ServerSocket, reason: string): void {
  if (socket.send) {
    socket.send("showToast", {
      message: reason,
      type: "error",
    });
  }
}

/**
 * Handle attack mob request from client
 * Validates input before forwarding to CombatSystem
 */
export function handleAttackMob(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return;
  }

  const playerId = playerEntity.id;

  // Rate limiting using shared infrastructure
  const rateLimiter = getCombatRateLimiter();
  if (!rateLimiter.check(playerId)) {
    // Silently drop rate-limited requests (no error spam to client)
    return;
  }

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(`[Combat] Invalid attack request format from ${playerId}`);
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate timestamp to prevent replay attacks
  if (payload.timestamp !== undefined) {
    const timestampValidation = validateRequestTimestamp(payload.timestamp);
    if (!timestampValidation.valid) {
      console.warn(
        `[Combat] Replay attack blocked from ${playerId}: ${timestampValidation.reason}`,
      );
      return;
    }
  }

  // Extract and validate target ID (support both mobId and targetId)
  const targetId = payload.mobId ?? payload.targetId;
  if (!isValidNpcId(targetId)) {
    console.warn(`[Combat] Invalid target ID format from ${playerId}`);
    return;
  }

  // Verify mob exists in world before forwarding
  const mobSystem = world.getSystem("mobNPC") as {
    getMob?: (id: string) => unknown;
  } | null;

  if (mobSystem?.getMob) {
    const mob = mobSystem.getMob(targetId);
    if (!mob) {
      console.warn(
        `[Combat] Attack request for non-existent mob ${targetId} from ${playerId}`,
      );
      sendCombatError(socket, "Target not found");
      return;
    }
  }

  // Forward validated request to CombatSystem
  world.emit(EventType.COMBAT_ATTACK_REQUEST, {
    playerId,
    targetId,
    attackerType: "player",
    targetType: "mob",
    attackType: "melee", // MVP: melee-only
  });
}

/**
 * Handle attack style change request from client
 * Validates input before forwarding to PlayerSystem
 */
export function handleChangeAttackStyle(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return;
  }

  const playerId = playerEntity.id;

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(
      `[Combat] Invalid attack style request format from ${playerId}`,
    );
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate newStyle field
  if (typeof payload.newStyle !== "string") {
    console.warn(`[Combat] Missing attack style from ${playerId}`);
    return;
  }

  // Whitelist validation
  if (!VALID_ATTACK_STYLES.has(payload.newStyle)) {
    console.warn(
      `[Combat] Invalid attack style "${payload.newStyle}" from ${playerId}`,
    );
    return;
  }

  // Forward validated request to PlayerSystem
  world.emit(EventType.ATTACK_STYLE_CHANGED, {
    playerId,
    newStyle: payload.newStyle,
  });
}
