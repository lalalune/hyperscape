/**
 * Resource Handler
 *
 * Handles resource gathering events from clients
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World } from "@hyperscape/shared";

export function handleResourceGather(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn(
      "[Resources] handleResourceGather: no player entity for socket",
    );
    return;
  }

  const payload = data as {
    resourceId?: string;
    playerPosition?: { x: number; y: number; z: number };
  };
  if (!payload.resourceId) {
    console.warn("[Resources] handleResourceGather: no resourceId in payload");
    return;
  }

  const playerPosition = payload.playerPosition || {
    x: playerEntity.position.x,
    y: playerEntity.position.y,
    z: playerEntity.position.z,
  };

  // Forward to ResourceSystem - emit RESOURCE_GATHER which ResourceSystem subscribes to
  world.emit(EventType.RESOURCE_GATHER, {
    playerId: playerEntity.id,
    resourceId: payload.resourceId,
    playerPosition: playerPosition,
  });
}
