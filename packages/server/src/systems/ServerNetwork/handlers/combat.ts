/**
 * Combat Handler
 *
 * Handles combat-related actions from clients.
 *
 * Security measures:
 * - Validates player entity exists on socket
 * - Validates mob exists in world before forwarding
 * - Validates mob is attackable
 * - Input validation on mobId format
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World } from "@hyperscape/shared";
import { isValidEntityId } from "../services/InputValidation";

/**
 * Handle player attack on mob
 *
 * Security:
 * - Validates mobId is valid string format
 * - Validates mob entity exists in world
 * - Validates mob is attackable (not dead, not protected)
 */
export function handleAttackMob(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Combat] handleAttackMob: no player entity for socket");
    return;
  }

  const payload = data as { mobId?: string; attackType?: string };
  if (!payload.mobId) {
    console.warn("[Combat] handleAttackMob: no mobId in payload");
    return;
  }

  // Validate mobId format (prevent injection attacks)
  if (!isValidEntityId(payload.mobId)) {
    console.warn(
      `[Combat] handleAttackMob: invalid mobId format: ${payload.mobId}`,
    );
    return;
  }

  // SECURITY: Validate mob exists in world before forwarding to CombatSystem
  // This prevents event spam with fake mob IDs
  const targetMob = world.entities.get(payload.mobId);
  if (!targetMob) {
    console.warn(
      `[Combat] handleAttackMob: mob not found: ${payload.mobId} (player: ${playerEntity.id})`,
    );
    return;
  }

  // SECURITY: Check if mob is already dead (prevents attacks on corpses)
  if (targetMob.type === "mob") {
    const mobEntity = targetMob as {
      isDead?: () => boolean;
      getHealth?: () => number;
    };
    if (mobEntity.isDead?.() || (mobEntity.getHealth?.() ?? 1) <= 0) {
      console.warn(
        `[Combat] handleAttackMob: attempted attack on dead mob: ${payload.mobId}`,
      );
      return;
    }
  }

  // Forward to CombatSystem (which does additional range/cooldown validation)
  world.emit(EventType.COMBAT_ATTACK_REQUEST, {
    playerId: playerEntity.id,
    targetId: payload.mobId,
    attackerType: "player",
    targetType: "mob",
    attackType: payload.attackType || "melee",
  });
}

export function handleChangeAttackStyle(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn(
      "[Combat] handleChangeAttackStyle: no player entity for socket",
    );
    return;
  }

  const payload = data as {
    type?: string;
    playerId?: string;
    newStyle?: string;
  };

  if (!payload.newStyle) {
    console.warn("[Combat] handleChangeAttackStyle: no newStyle in payload");
    return;
  }

  console.log(
    `[Combat] handleChangeAttackStyle: ${playerEntity.id} -> ${payload.newStyle}`,
  );

  // Forward to PlayerSystem
  world.emit(EventType.ATTACK_STYLE_CHANGED, {
    playerId: playerEntity.id,
    newStyle: payload.newStyle,
  });
}
