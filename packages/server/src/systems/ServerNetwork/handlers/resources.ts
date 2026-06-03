/**
 * Resource Handler
 *
 * Handles legacy resource gathering events from clients.
 * Note: Most resource interaction is now handled by PendingGatherManager.
 *
 * SECURITY: Always uses server-authoritative player position.
 * Client-provided position is ignored to prevent position spoofing exploits.
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World } from "@hyperforge/shared";

/**
 * Handle direct resource gather request.
 * This is the legacy handler used after server has pathed player to resource.
 * Most gathering flow now goes through PendingGatherManager instead.
 */
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
    // Note: playerPosition from client is intentionally ignored for security
  };
  if (!payload.resourceId) {
    console.warn("[Resources] handleResourceGather: no resourceId in payload");
    return;
  }

  // SECURITY: Always use server-authoritative position, never trust client
  const playerPosition = {
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
