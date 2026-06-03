/**
 * Player Interaction Handler
 *
 * Handles player-to-player interaction requests from clients.
 * Currently supports: Follow, Name change
 *
 * Security measures:
 * - Input validation (type, format)
 * - Rate limiting (prevents spam)
 * - Server-side player existence verification
 *
 * @see https://runescape.wiki/w/Follow
 */

import type { ServerSocket } from "../../../shared/types";
import type { World } from "@hyperforge/shared";
import type { FollowManager } from "../FollowManager";
import { validateRequestTimestamp } from "../services/InputValidation";
import { getFollowRateLimiter } from "../services/SlidingWindowRateLimiter";
import { CharacterRepository } from "../../../database/repositories/CharacterRepository";
import { getDatabase } from "./common/helpers";

/**
 * Send feedback to client
 */
function sendPlayerError(socket: ServerSocket, reason: string): void {
  if (socket.send) {
    socket.send("showToast", {
      message: reason,
      type: "error",
    });
  }
}

/**
 * Handle follow player request from client
 *
 * OSRS behavior:
 * - Player walks behind the target
 * - Re-paths when target moves
 * - Cancelled by clicking elsewhere, trading, equipping items
 */
export function handleFollowPlayer(
  socket: ServerSocket,
  data: unknown,
  world: World,
  followManager: FollowManager,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return;
  }

  const followerId = playerEntity.id;

  // Rate limiting
  const rateLimiter = getFollowRateLimiter();
  if (!rateLimiter.check(followerId)) {
    return;
  }

  // Validate request structure
  if (!data || typeof data !== "object") {
    console.warn(`[Player] Invalid follow request format from ${followerId}`);
    return;
  }

  const payload = data as Record<string, unknown>;

  // Validate timestamp to prevent replay attacks
  if (payload.timestamp !== undefined) {
    const timestampValidation = validateRequestTimestamp(payload.timestamp);
    if (!timestampValidation.valid) {
      console.warn(
        `[Player] Replay attack blocked from ${followerId}: ${timestampValidation.reason}`,
      );
      return;
    }
  }

  // Extract target player ID
  const targetPlayerId = payload.targetPlayerId;
  if (typeof targetPlayerId !== "string" || targetPlayerId.length === 0) {
    console.warn(`[Player] Invalid target player ID from ${followerId}`);
    return;
  }

  // Prevent self-follow
  if (targetPlayerId === followerId) {
    sendPlayerError(socket, "You can't follow yourself.");
    return;
  }

  // Verify target player exists
  // Use world.entities.get() for consistency with FollowManager and other systems
  const targetPlayer = world.entities.get(targetPlayerId);
  if (!targetPlayer) {
    console.warn(
      `[Player] Follow request for non-existent player ${targetPlayerId} from ${followerId}`,
    );
    sendPlayerError(socket, "Player not found.");
    return;
  }

  // Start following
  followManager.startFollowing(followerId, targetPlayerId);

  console.log(`[Player] ${followerId} now following ${targetPlayerId}`);
}

// =============================================================================
// NAME CHANGE HANDLER
// =============================================================================

/** Name validation constraints */
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 20;
const NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;

/**
 * Validate and sanitize a player name
 */
function validatePlayerName(name: unknown): {
  valid: boolean;
  sanitized: string;
  reason?: string;
} {
  if (typeof name !== "string") {
    return { valid: false, sanitized: "", reason: "Name must be a string" };
  }

  // Trim whitespace
  const trimmed = name.trim();

  // Check length
  if (trimmed.length < NAME_MIN_LENGTH) {
    return { valid: false, sanitized: "", reason: "Name is too short" };
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return { valid: false, sanitized: "", reason: "Name is too long" };
  }

  // Check characters
  if (!NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      sanitized: "",
      reason: "Name contains invalid characters",
    };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Handle player name change request
 *
 * Updates the player's display name in the database and broadcasts to clients.
 * Validates name format and length.
 */
export function handleChangePlayerName(
  socket: ServerSocket,
  data: unknown,
  world: World,
  broadcastToAll: (packet: string, data: unknown) => void,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    console.warn("[Player] handleChangePlayerName: no player entity");
    return;
  }

  const playerId = playerEntity.id;

  // Validate payload
  if (!data || typeof data !== "object") {
    sendPlayerError(socket, "Invalid name change request");
    return;
  }

  const payload = data as { name?: unknown };
  const validation = validatePlayerName(payload.name);

  if (!validation.valid) {
    sendPlayerError(socket, validation.reason || "Invalid name");
    return;
  }

  const newName = validation.sanitized;
  const oldName = playerEntity.name || "Unknown";

  // Get database connection
  const db = getDatabase(world);
  if (!db) {
    sendPlayerError(socket, "Server error: database unavailable");
    return;
  }

  // Update database asynchronously
  const repo = new CharacterRepository(db.drizzle, db.pool);
  repo
    .updateCharacterName(playerId, newName)
    .then((updated) => {
      if (updated) {
        // Update local entity
        playerEntity.name = newName;

        // Confirm to the player
        if (socket.send) {
          socket.send("playerNameChanged", { name: newName });
          socket.send("showToast", {
            message: `Name changed to ${newName}`,
            type: "success",
          });
        }

        // Broadcast to all players so they see the new name
        broadcastToAll("playerNameBroadcast", {
          playerId,
          oldName,
          newName,
        });

        console.log(
          `[Player] ${playerId} changed name from "${oldName}" to "${newName}"`,
        );
      } else {
        sendPlayerError(socket, "Failed to update name");
      }
    })
    .catch((err) => {
      console.error("[Player] Failed to update name:", err);
      sendPlayerError(socket, "Server error: failed to update name");
    });
}
