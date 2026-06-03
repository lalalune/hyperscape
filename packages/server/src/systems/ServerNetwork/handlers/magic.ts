/**
 * Magic Handler
 *
 * Handles magic-related actions from clients.
 * Uses shared security infrastructure for validation.
 *
 * Security measures:
 * - Input validation (spell ID format)
 * - Timestamp validation (prevents replay attacks)
 * - Server-side spell existence verification via SpellService
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World, spellService } from "@hyperforge/shared";
import { validateRequestTimestamp } from "../services/InputValidation";

/**
 * Validate spell ID format
 * Valid format: lowercase letters and underscores only, max 50 chars
 */
function isValidSpellId(spellId: unknown): spellId is string {
  if (typeof spellId !== "string") return false;
  if (spellId.length === 0 || spellId.length > 50) return false;
  return /^[a-z_]+$/.test(spellId);
}

/**
 * Handle set autocast request from client
 * Validates input before forwarding to PlayerSystem
 *
 * @param socket - Client socket with player entity
 * @param data - Autocast request payload { spellId: string | null }
 * @param world - Game world instance
 */
export function handleSetAutocast(
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
  if (typeof data !== "object" || data === null) {
    console.warn(`[Magic] Invalid autocast request format from ${playerId}`);
    return;
  }

  const payload = data as Record<string, unknown>;
  const { spellId, timestamp } = payload;

  // Validate timestamp to prevent replay attacks
  if (timestamp !== undefined) {
    const timestampValidation = validateRequestTimestamp(timestamp);
    if (!timestampValidation.valid) {
      console.warn(
        `[Magic] Replay attack blocked from ${playerId}: ${timestampValidation.reason}`,
      );
      return;
    }
  }

  // spellId can be null (to disable autocast) or a valid spell ID
  if (spellId !== null) {
    if (!isValidSpellId(spellId)) {
      console.warn(
        `[Magic] Invalid spell ID format "${spellId}" from ${playerId}`,
      );
      return;
    }

    // Verify spell exists
    if (!spellService.isValidSpell(spellId)) {
      console.warn(`[Magic] Unknown spell "${spellId}" from ${playerId}`);
      if (socket.send) {
        socket.send("showToast", {
          message: "Unknown spell",
          type: "error",
        });
      }
      return;
    }
  }

  // Forward validated request to PlayerSystem
  world.emit(EventType.PLAYER_SET_AUTOCAST, {
    playerId,
    spellId: spellId as string | null,
  });
}
