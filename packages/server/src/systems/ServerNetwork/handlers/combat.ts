/**
 * Combat Handler
 *
 * Handles combat-related actions from clients
 */

import type { ServerSocket } from "../../types";
import { EventType, World } from "@hyperscape/shared";

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

  // Forward to CombatSystem
  world.emit(EventType.COMBAT_ATTACK_REQUEST, {
    playerId: playerEntity.id,
    targetId: payload.mobId,
    attackerType: "player",
    targetType: "mob",
    attackType: payload.attackType || "melee",
  });
}
