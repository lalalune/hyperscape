/**
 * Chat Handler
 *
 * Handles chat message broadcasting with support for:
 * - Global chat (all players)
 * - Local chat (proximity-based)
 * - Whisper (direct messages)
 * - Agent identification
 */

import type { ServerSocket, ChatMessage } from "../../../shared/types";
import type { World } from "@hyperscape/shared";

/** Local chat range in world units */
const LOCAL_CHAT_RANGE = 50;

/**
 * Calculate distance between two positions
 */
function getDistance(
  pos1: { x: number; y: number; z: number } | undefined,
  pos2: { x: number; y: number; z: number } | undefined,
): number {
  if (!pos1 || !pos2) return Infinity;
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get player position from socket
 */
function getPlayerPosition(socket: ServerSocket): { x: number; y: number; z: number } | undefined {
  const player = socket.player;
  if (!player) return undefined;
  
  const pos = player.position;
  if (Array.isArray(pos) && pos.length >= 3) {
    return { x: pos[0], y: pos[1], z: pos[2] };
  }
  if (pos && typeof pos === "object" && "x" in pos) {
    return pos as { x: number; y: number; z: number };
  }
  return undefined;
}

export function handleChatAdded(
  socket: ServerSocket,
  data: unknown,
  world: World,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
  sockets?: Map<string, ServerSocket>,
): void {
  const msg = data as ChatMessage;
  const chatType = msg.chatType || "global";
  
  // Add sender position if not present
  if (!msg.senderPosition) {
    msg.senderPosition = getPlayerPosition(socket);
  }
  
  // Check if sender is an agent
  const player = socket.player;
  if (player && (player as { isAgent?: boolean }).isAgent) {
    msg.isFromAgent = true;
  }
  
  // Add message to chat system
  if (world.chat.add) {
    world.chat.add(msg, false);
  }
  
  switch (chatType) {
    case "whisper":
      // Direct message to specific player
      handleWhisperMessage(socket, msg, sockets);
      break;
      
    case "local":
      // Proximity-based chat
      handleLocalMessage(socket, msg, sockets);
      break;
      
    case "party":
      // Party chat (future implementation)
      // For now, treat as global
      sendFn("chatAdded", msg, socket.id);
      break;
      
    case "system":
      // System messages broadcast to all
      sendFn("chatAdded", msg);
      break;
      
    case "global":
    default:
      // Broadcast to all except sender
      sendFn("chatAdded", msg, socket.id);
      break;
  }
}

/**
 * Handle whisper/direct messages
 */
function handleWhisperMessage(
  socket: ServerSocket,
  msg: ChatMessage,
  sockets?: Map<string, ServerSocket>,
): void {
  if (!msg.targetId || !sockets) {
    // Send error back to sender
    socket.send("chatAdded", {
      ...msg,
      body: "[Error] Whisper requires a target player",
      text: "[Error] Whisper requires a target player",
      chatType: "system",
    });
    return;
  }
  
  // Find target socket by player ID
  let targetSocket: ServerSocket | undefined;
  for (const [, s] of sockets) {
    if (s.player?.id === msg.targetId) {
      targetSocket = s;
      break;
    }
  }
  
  if (!targetSocket) {
    socket.send("chatAdded", {
      ...msg,
      body: "[Error] Player not found",
      text: "[Error] Player not found",
      chatType: "system",
    });
    return;
  }
  
  // Send to target
  targetSocket.send("chatAdded", msg);
  
  // Echo back to sender with confirmation
  socket.send("chatAdded", {
    ...msg,
    body: `[Whisper to ${msg.targetId}] ${msg.body}`,
    text: `[Whisper to ${msg.targetId}] ${msg.text}`,
  });
}

/**
 * Handle local/proximity-based chat
 */
function handleLocalMessage(
  socket: ServerSocket,
  msg: ChatMessage,
  sockets?: Map<string, ServerSocket>,
): void {
  if (!sockets) return;
  
  const senderPos = msg.senderPosition || getPlayerPosition(socket);
  if (!senderPos) {
    // Can't determine position, fall back to global
    for (const [socketId, s] of sockets) {
      if (socketId !== socket.id) {
        s.send("chatAdded", msg);
      }
    }
    return;
  }
  
  // Send to players within range
  for (const [socketId, s] of sockets) {
    if (socketId === socket.id) continue;
    
    const receiverPos = getPlayerPosition(s);
    const distance = getDistance(senderPos, receiverPos);
    
    if (distance <= LOCAL_CHAT_RANGE) {
      s.send("chatAdded", msg);
    }
  }
}
