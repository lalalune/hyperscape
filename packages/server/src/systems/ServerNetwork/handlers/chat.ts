/**
 * Chat Handler
 *
 * Handles chat message broadcasting to all connected clients
 */

import type { ServerSocket, ChatMessage } from "../../types";
import type { World } from "@hyperscape/shared";

export function handleChatAdded(
  socket: ServerSocket,
  data: unknown,
  world: World,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
): void {
  const msg = data as ChatMessage;
  // Add message to chat if method exists
  if (world.chat.add) {
    world.chat.add(msg, false);
  }
  sendFn("chatAdded", msg, socket.id);
}
