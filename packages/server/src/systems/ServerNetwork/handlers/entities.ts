/**
 * Entity Handlers
 *
 * Handles entity modification and event broadcasting
 */

import type { ServerSocket } from "../../types";
import type { World } from "@hyperscape/shared";

export function handleEntityModified(
  socket: ServerSocket,
  data: unknown,
  world: World,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
): void {
  // Accept either { id, changes: {...} } or a flat payload { id, ...changes }
  const incoming = data as {
    id: string;
    changes?: Record<string, unknown>;
  } & Record<string, unknown>;
  const id = incoming.id;
  const changes =
    incoming.changes ??
    Object.fromEntries(Object.entries(incoming).filter(([k]) => k !== "id"));

  // Apply to local entity if present
  const entity = world.entities.get(id);
  if (entity && changes) {
    // Reject client position/rotation authority for players
    if (entity.type === "player") {
      const filtered: Record<string, unknown> = { ...changes };
      delete (filtered as { p?: unknown }).p;
      delete (filtered as { q?: unknown }).q;
      // Allow cosmetic/state updates like name, avatar, effect, roles
      entity.modify(filtered);
    } else {
      entity.modify(changes);
    }
  }

  // Broadcast normalized shape
  sendFn("entityModified", { id, changes }, socket.id);
}

export function handleEntityEvent(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  // Accept both { id, version, name, data } and { id, event, payload }
  const incoming = data as {
    id?: string;
    version?: number;
    name?: string;
    data?: unknown;
    event?: string;
    payload?: unknown;
  };
  const name = (incoming.name || incoming.event) as string | undefined;
  const payload = (
    Object.prototype.hasOwnProperty.call(incoming, "data")
      ? incoming.data
      : incoming.payload
  ) as unknown;
  if (!name) return;
  // Attach playerId if not provided - assume payload is an object
  const enriched = (() => {
    const payloadObj = payload as Record<string, unknown>;
    if (payloadObj && !payloadObj.playerId && socket.player?.id) {
      return { ...payloadObj, playerId: socket.player.id };
    }
    return payload;
  })();
  // Emit on server world so server-side systems handle it (e.g., ResourceSystem)
  try {
    world.emit(name, enriched);
  } catch (err) {
    console.error("[Entities] Failed to re-emit entityEvent", name, err);
  }
}

export function handleEntityRemoved(
  _socket: ServerSocket,
  _data: unknown,
): void {
  // Handle entity removal - currently a no-op placeholder
}

export function handleSettings(_socket: ServerSocket, _data: unknown): void {
  // Handle settings change - currently a no-op placeholder
}
