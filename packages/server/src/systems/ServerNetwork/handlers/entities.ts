/**
 * Entity Handlers
 *
 * Handles entity modification and event broadcasting
 */

import type { ServerSocket } from "../../../shared/types";
import type { World } from "@hyperforge/shared";
import { hasRole } from "@hyperforge/shared";
import type { SettingsData } from "@hyperforge/shared";
import { sendErrorToast } from "./common";

type SettingsValue =
  | string
  | number
  | boolean
  | null
  | { url: string }
  | undefined;

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
  // ALWAYS override playerId with socket.player.id to prevent spoofing
  // Previously only added if missing, allowing clients to spoof other player IDs
  const enriched = (() => {
    const payloadObj = payload as Record<string, unknown>;
    if (payloadObj && socket.player?.id) {
      return { ...payloadObj, playerId: socket.player.id };
    }
    return payload;
  })();
  // Emit on server world so server-side systems handle it (e.g., ResourceSystem)
  try {
    world.emit(name, enriched);
  } catch (err) {
    console.error("[Entities] Failed to re-emit entityEvent", name, err);
    sendErrorToast(socket, "Action failed. Please try again.");
  }
}

export function handleEntityRemoved(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const player = socket.player;
  if (!player?.data) {
    return;
  }

  const rolesRaw = player.data.roles as string[] | string | undefined;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === "string"
      ? rolesRaw.split(",")
      : [];

  if (!hasRole(roles, "admin", "moderator", "builder")) {
    // Silently ignore - clients may send entityRemoved during normal cleanup
    // but only privileged users can actually remove server entities
    return;
  }

  const payload =
    typeof data === "string" ? { id: data } : (data as { id?: string });
  if (!payload.id) {
    sendErrorToast(socket, "Missing entity id.");
    return;
  }

  const removed = world.entities?.remove?.(payload.id);
  if (!removed) {
    sendErrorToast(socket, "Entity not found or already removed.");
  }
}

export function handleSettings(
  socket: ServerSocket,
  data: unknown,
  world: World,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
): void {
  const player = socket.player;
  if (!player?.data) {
    return;
  }

  const rolesRaw = player.data.roles as string[] | string | undefined;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === "string"
      ? rolesRaw.split(",")
      : [];

  if (!hasRole(roles, "admin")) {
    sendErrorToast(socket, "Only admins can modify world settings.");
    return;
  }

  const payload = data as Partial<{ key: string; value: SettingsValue }>;
  if (!payload.key) {
    sendErrorToast(socket, "Missing settings key.");
    return;
  }

  const settings = world.settings as {
    updateSetting?: (key: keyof SettingsData, value: SettingsValue) => boolean;
    serialize?: () => SettingsData;
  };

  if (!settings?.updateSetting || !settings.serialize) {
    sendErrorToast(socket, "Settings system not available.");
    return;
  }

  const key = payload.key as keyof SettingsData;
  const updated = settings.updateSetting(key, payload.value);
  if (!updated) {
    sendErrorToast(socket, "Invalid settings value.");
    return;
  }

  const serialized = settings.serialize();
  sendFn("settingsModified", { key, value: serialized[key] }, socket.id);
}
