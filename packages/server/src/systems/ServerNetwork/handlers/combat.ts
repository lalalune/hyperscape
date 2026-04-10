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
import {
  EventType,
  World,
  AttackType,
  isPositionInsideCombatArena,
} from "@hyperscape/shared";
import {
  isValidNpcId,
  validateRequestTimestamp,
} from "../services/InputValidation";
import { getCombatRateLimiter } from "../services/SlidingWindowRateLimiter";

/**
 * Valid attack styles (whitelist)
 * Includes melee, ranged, and magic styles (OSRS-accurate)
 */
const VALID_ATTACK_STYLES = new Set([
  // Melee styles
  "accurate",
  "aggressive",
  "defensive",
  "controlled",
  // Ranged styles
  "rapid",
  "longrange",
  // Magic styles
  "autocast",
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
 * Handle attack player request from client (PvP)
 * Validates input and checks zone before forwarding to CombatSystem
 */
export function handleAttackPlayer(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Combat] handleAttackPlayer: no player entity on socket");
    return;
  }

  const attackerId = playerEntity.id;

  // Rate limiting using shared infrastructure
  const rateLimiter = getCombatRateLimiter();
  if (!rateLimiter.check(attackerId)) {
    return; // Silently drop — rate limiting is expected during fast clicking
  }

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(
      `[Combat] Invalid attack player request format from ${attackerId}`,
    );
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate timestamp to prevent replay attacks (required)
  if (
    payload.timestamp === undefined ||
    typeof payload.timestamp !== "number"
  ) {
    console.warn(
      `[Combat] Missing or invalid timestamp from ${attackerId} - potential replay attack`,
    );
    return;
  }
  const timestampValidation = validateRequestTimestamp(payload.timestamp);
  if (!timestampValidation.valid) {
    console.warn(
      `[Combat] Replay attack blocked from ${attackerId}: ${timestampValidation.reason}`,
    );
    return;
  }

  // Extract target player ID
  const targetPlayerId = payload.targetPlayerId;
  if (typeof targetPlayerId !== "string" || targetPlayerId.length === 0) {
    console.warn(`[Combat] Invalid target player ID from ${attackerId}`);
    return;
  }

  // Prevent self-attack
  if (targetPlayerId === attackerId) {
    sendCombatError(socket, "You can't attack yourself.");
    return;
  }

  // Verify target player exists
  const targetPlayer = world.entities?.players?.get(targetPlayerId);
  if (!targetPlayer) {
    console.warn(
      `[Combat] Attack request for non-existent player ${targetPlayerId} from ${attackerId}`,
    );
    sendCombatError(socket, "Target not found");
    return;
  }

  // Check if this is a duel combat (bypasses PvP zone checks)
  const duelSystem = world.getSystem("duel") as {
    isPlayerInActiveDuel?: (playerId: string) => boolean;
    getPlayerDuel?: (playerId: string) =>
      | {
          challengerId: string;
          targetId: string;
          state: string;
        }
      | undefined;
  } | null;

  let isDuelCombat = false;
  if (duelSystem?.isPlayerInActiveDuel && duelSystem?.getPlayerDuel) {
    const attackerInDuel = duelSystem.isPlayerInActiveDuel(attackerId);
    const targetInDuel = duelSystem.isPlayerInActiveDuel(targetPlayerId);

    if (attackerInDuel && targetInDuel) {
      // Both in active duels - verify they're opponents
      const attackerDuel = duelSystem.getPlayerDuel(attackerId);
      if (attackerDuel) {
        // Block combat during COUNTDOWN — fight hasn't started yet
        if (attackerDuel.state === "COUNTDOWN") {
          sendCombatError(socket, "The duel hasn't started yet!");
          return;
        }

        const isOpponent =
          (attackerDuel.challengerId === attackerId &&
            attackerDuel.targetId === targetPlayerId) ||
          (attackerDuel.targetId === attackerId &&
            attackerDuel.challengerId === targetPlayerId);

        if (isOpponent) {
          isDuelCombat = true;
          // Duel attack-type rules (melee/ranged/magic/special) are enforced
          // authoritatively in CombatSystem.handleAttack() after weapon type resolution
        } else {
          sendCombatError(socket, "You can only attack your duel opponent.");
          return;
        }
      }
    } else if (attackerInDuel) {
      sendCombatError(socket, "You can only attack your duel opponent.");
      return;
    } else if (targetInDuel) {
      // Non-duelist attacking a duelist — block this
      sendCombatError(socket, "That player is in a duel.");
      return;
    }
  }

  // Block combat inside duel arena combat zones without an active duel
  // This prevents exploits where players end up in the arena without a duel session
  if (!isDuelCombat) {
    const attackerPos = playerEntity.position;
    const targetPos = targetPlayer.position;

    const attackerInArena =
      attackerPos && isPositionInsideCombatArena(attackerPos.x, attackerPos.z);
    const targetInArena =
      targetPos && isPositionInsideCombatArena(targetPos.x, targetPos.z);

    if (attackerInArena || targetInArena) {
      sendCombatError(socket, "Combat in the arena requires an active duel.");
      return;
    }
  }

  // Skip PvP zone checks for duel combat
  if (!isDuelCombat) {
    // Check if attacker is in PvP zone
    const zoneSystem = world.getSystem("zone-detection") as {
      isPvPEnabled?: (pos: { x: number; z: number }) => boolean;
    } | null;

    if (zoneSystem?.isPvPEnabled) {
      const attackerPos = playerEntity.position;
      if (
        !attackerPos ||
        !zoneSystem.isPvPEnabled({ x: attackerPos.x, z: attackerPos.z })
      ) {
        sendCombatError(socket, "You can only attack players in PvP zones.");
        return;
      }

      // Also check if target is in PvP zone
      const targetPos = targetPlayer.position;
      if (
        !targetPos ||
        !zoneSystem.isPvPEnabled({ x: targetPos.x, z: targetPos.z })
      ) {
        sendCombatError(socket, "That player is not in a PvP zone.");
        return;
      }
    }
  }

  // Forward validated request to CombatSystem
  world.emit(EventType.COMBAT_ATTACK_REQUEST, {
    attackerId,
    targetId: targetPlayerId,
    attackerType: "player",
    targetType: "player",
    attackType: AttackType.MELEE,
  });

  console.log(
    `[Combat] Player ${attackerId} attacking player ${targetPlayerId} (${isDuelCombat ? "Duel" : "PvP"})`,
  );
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
    console.warn("[Combat] handleAttackMob: no player entity on socket");
    return;
  }

  const playerId = playerEntity.id;

  // Rate limiting using shared infrastructure
  const rateLimiter = getCombatRateLimiter();
  if (!rateLimiter.check(playerId)) {
    return; // Silently drop — rate limiting is expected during fast clicking
  }

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(`[Combat] Invalid attack request format from ${playerId}`);
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate timestamp to prevent replay attacks (required)
  if (
    payload.timestamp === undefined ||
    typeof payload.timestamp !== "number"
  ) {
    console.warn(
      `[Combat] Missing or invalid timestamp from ${playerId} - potential replay attack`,
    );
    return;
  }
  const timestampValidation = validateRequestTimestamp(payload.timestamp);
  if (!timestampValidation.valid) {
    console.warn(
      `[Combat] Replay attack blocked from ${playerId}: ${timestampValidation.reason}`,
    );
    return;
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
    attackerId: playerId,
    targetId,
    attackerType: "player",
    targetType: "mob",
    attackType: AttackType.MELEE,
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

/**
 * Handle auto-retaliate toggle request from client
 * Validates input before forwarding to PlayerSystem
 * PlayerSystem handles rate limiting (500ms cooldown)
 */
export function handleSetAutoRetaliate(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return;
  }

  // Server authority: use socket.player.id, ignore client-provided playerId
  const playerId = playerEntity.id;

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(
      `[Combat] Invalid auto-retaliate request format from ${playerId}`,
    );
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate enabled field is a boolean
  if (typeof payload.enabled !== "boolean") {
    console.warn(
      `[Combat] Invalid auto-retaliate enabled value from ${playerId}: ${typeof payload.enabled}`,
    );
    return;
  }

  // Forward validated request to PlayerSystem (which handles rate limiting)
  world.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
    playerId,
    enabled: payload.enabled,
  });
}

/**
 * Handle special attack toggle request from client
 *
 * OSRS: Player clicks the spec bar to toggle special attack ON/OFF.
 * Server validates energy and rate-limits in PlayerSystem.
 */
export function handleToggleSpecialAttack(
  socket: ServerSocket,
  _data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) return;

  // Server authority: use socket.player.id
  world.emit(EventType.UI_SPECIAL_ATTACK_TOGGLE, {
    playerId: playerEntity.id,
  });
}
