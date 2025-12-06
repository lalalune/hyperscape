/**
 * Dialogue Packet Handlers
 *
 * Handles dialogue-related network packets:
 * - dialogueResponse: Player selects a dialogue option
 * - dialogueClose: Player closes dialogue
 *
 * SECURITY MEASURES:
 * - Server determines nextNodeId and effect (never trust client)
 * - Input validation on npcId and responseIndex
 * - Session tracking via InteractionSessionManager (distance validation)
 *
 * Unlike store/bank handlers, dialogue does NOT require:
 * - Database transactions (no persistent state changes)
 * - Heavy rate limiting (OSRS allows fast dialogue clicking)
 *
 * The DialogueSystem (shared package) handles the actual dialogue state
 * machine. This handler is just the network entry point with validation.
 */

import { type World, EventType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { isValidNpcId, isValidResponseIndex } from "../services";
import { getPlayerId, sendErrorToast } from "./common";

/**
 * Handle dialogue response
 *
 * CRITICAL SECURITY: Server determines nextNodeId and effect from its own
 * dialogue state. The client only sends responseIndex.
 *
 * This prevents:
 * - Dialogue skipping (jumping to any node)
 * - Effect injection (triggering arbitrary effects)
 * - Response manipulation (selecting invalid options)
 */
export function handleDialogueResponse(
  socket: ServerSocket,
  data: { npcId: string; responseIndex: number },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    return;
  }

  // Input validation - prevent DoS from large strings
  if (!isValidNpcId(data.npcId)) {
    sendErrorToast(socket, "Invalid dialogue");
    return;
  }

  // Input validation - prevent array out-of-bounds
  if (!isValidResponseIndex(data.responseIndex)) {
    sendErrorToast(socket, "Invalid response");
    return;
  }

  // Emit event for DialogueSystem to handle
  // NOTE: We only pass responseIndex, NOT nextNodeId or effect
  // DialogueSystem will look up the correct values from its state
  world.emit(EventType.DIALOGUE_RESPONSE, {
    playerId,
    npcId: data.npcId,
    responseIndex: data.responseIndex,
  });
}

/**
 * Handle dialogue close
 *
 * Called when player explicitly closes dialogue UI.
 * InteractionSessionManager handles distance-based auto-close.
 */
export function handleDialogueClose(
  socket: ServerSocket,
  data: { npcId: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    return;
  }

  // Basic validation - silent fail for close
  if (!isValidNpcId(data.npcId)) {
    return;
  }

  world.emit(EventType.DIALOGUE_END, {
    playerId,
    npcId: data.npcId,
  });
}
