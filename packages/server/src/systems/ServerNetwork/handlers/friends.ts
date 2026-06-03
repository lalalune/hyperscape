/**
 * Friend System Packet Handlers
 *
 * Handles all social/friend system network packets:
 * - friendRequest: Send friend request by player name
 * - friendAccept: Accept incoming friend request
 * - friendDecline: Decline incoming friend request
 * - friendRemove: Remove a friend
 * - ignoreAdd: Add player to ignore list
 * - ignoreRemove: Remove player from ignore list
 * - privateMessage: Send private message to a player
 *
 * SECURITY MEASURES:
 * - All operations are server-authoritative
 * - Rate limiting via SlidingWindowRateLimiter
 * - Input validation (names, IDs)
 * - Friend/ignore limits enforced
 * - Ignore list checked for private messages
 *
 * @see packages/server/src/database/repositories/FriendRepository for database operations
 * @see packages/shared/src/types/game/social-types.ts for type definitions
 */

import {
  type World,
  type Friend,
  type FriendRequest,
  type IgnoredPlayer,
  type FriendsListSyncData,
  type FriendStatusUpdateData,
  type PrivateMessage,
  type PrivateChatFailReason,
  type SocialErrorCode,
  SOCIAL_CONSTANTS,
  isValidPlayerID,
  SystemLogger,
} from "@hyperforge/shared";
import type { ServerSocket } from "../../../shared/types";
import { FriendRepository } from "../../../database/repositories/FriendRepository";
import { RateLimitService } from "../services";
import {
  getPlayerId,
  sendSuccessToast,
  sendErrorToast,
  getDatabase,
} from "./common";

// Logger for social system operations
const logger = new SystemLogger("Social");

// Rate limiter for social operations
const rateLimiter = new RateLimitService();

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate player name input
 * @returns Sanitized name or null if invalid
 */
function validatePlayerName(name: unknown): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 20) return null;
  return trimmed;
}

/**
 * Validate message content
 * @returns Sanitized content or null if invalid
 */
function validateMessageContent(content: unknown): string | null {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  // Truncate to max length and sanitize basic HTML entities
  return sanitizeString(
    trimmed.slice(0, SOCIAL_CONSTANTS.PRIVATE_MESSAGE_MAX_LENGTH),
  );
}

/**
 * Sanitize string for basic HTML entities to prevent XSS
 */
function sanitizeString(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ============================================================================
// Type Guards for Entity Access
// ============================================================================

interface PlayerEntity {
  id: string;
  name?: string;
  playerName?: string;
  combatLevel?: number;
  zone?: string;
  area?: string;
  location?: string;
  data?: {
    name?: string;
    combatLevel?: number;
    zone?: string;
  };
}

/**
 * Type guard for player entity
 */
function isPlayerEntity(entity: unknown): entity is PlayerEntity {
  if (!entity || typeof entity !== "object") return false;
  const obj = entity as Record<string, unknown>;
  return typeof obj.id === "string" || typeof obj.name === "string";
}

/**
 * Get player entity from world with type safety
 */
function getPlayerEntity(world: World, playerId: string): PlayerEntity | null {
  const player = world.entities?.players?.get(playerId);
  if (!player || !isPlayerEntity(player)) return null;
  return player;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Cached repository instance per world */
const repositoryCache = new WeakMap<World, FriendRepository>();

/**
 * Get FriendRepository from database with proper caching
 * Uses WeakMap for memory-safe caching tied to World lifecycle
 *
 * @returns FriendRepository or null if database is not initialized
 */
function getFriendRepository(world: World): FriendRepository | null {
  let repo = repositoryCache.get(world);
  if (repo) return repo;

  const db = getDatabase(world);
  if (!db) {
    logger.debug("Database not initialized, cannot create FriendRepository");
    return null;
  }

  const dbInstance = (db as { drizzle: FriendRepository["db"] }).drizzle;
  const poolInstance = (db as { pool: FriendRepository["pool"] }).pool;

  if (!dbInstance || !poolInstance) {
    logger.debug(
      "Database connection incomplete, cannot create FriendRepository",
    );
    return null;
  }

  repo = new FriendRepository(dbInstance, poolInstance);
  repositoryCache.set(world, repo);

  logger.debug("Created FriendRepository instance");
  return repo;
}

/**
 * Get player name from world entities using type guard
 */
function getPlayerName(world: World, playerId: string): string {
  const entity = getPlayerEntity(world, playerId);
  if (!entity) return "Unknown";
  return entity.name || entity.data?.name || entity.playerName || "Unknown";
}

/**
 * Get player combat level from world entities using type guard
 */
function getPlayerCombatLevel(world: World, playerId: string): number {
  const entity = getPlayerEntity(world, playerId);
  if (!entity) return 3;
  return entity.combatLevel || entity.data?.combatLevel || 3;
}

/**
 * Get player's current location/zone name using type guard
 */
function getPlayerLocation(world: World, playerId: string): string {
  const entity = getPlayerEntity(world, playerId);
  if (!entity) return "Unknown";
  return (
    entity.zone ||
    entity.area ||
    entity.location ||
    entity.data?.zone ||
    "Unknown"
  );
}

/**
 * Find socket for a player by character ID
 */
function getSocketByPlayerId(
  world: World,
  playerId: string,
): ServerSocket | undefined {
  const serverNetwork = world.getSystem("network") as {
    broadcastManager?: {
      getPlayerSocket: (id: string) => ServerSocket | undefined;
    };
    sockets?: Map<string, ServerSocket>;
  };

  if (serverNetwork?.broadcastManager?.getPlayerSocket) {
    return serverNetwork.broadcastManager.getPlayerSocket(playerId);
  }

  // Fallback: search sockets map
  if (serverNetwork?.sockets) {
    for (const socket of serverNetwork.sockets.values()) {
      if (socket.player && (socket.player as { id?: string }).id === playerId) {
        return socket;
      }
    }
  }

  return undefined;
}

/**
 * Send social error to socket
 */
function sendSocialError(
  socket: ServerSocket,
  code: SocialErrorCode,
  message: string,
): void {
  socket.send("socialError", { code, message });
}

/**
 * Build enriched friend data with online status
 */
function buildFriendData(
  world: World,
  friendId: string,
  friendName: string,
  lastLogin: number,
): Friend {
  const onlineSocket = getSocketByPlayerId(world, friendId);

  if (onlineSocket && onlineSocket.player) {
    return {
      id: friendId as Friend["id"],
      name: friendName,
      status: "online",
      location: getPlayerLocation(world, friendId),
      level: getPlayerCombatLevel(world, friendId),
    };
  }

  return {
    id: friendId as Friend["id"],
    name: friendName,
    status: "offline",
    lastSeen: lastLogin || undefined,
  };
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Handle friend request - send friend request by player name
 */
export async function handleFriendRequest(
  socket: ServerSocket,
  data: { targetName: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit check
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    logger.debug("Rate limited friend request", { playerId });
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before sending another request.",
    );
    return;
  }

  // Validate input using utility
  const targetName = validatePlayerName(data.targetName);
  if (!targetName) {
    sendErrorToast(socket, "Please enter a valid player name.");
    return;
  }

  logger.debug("Processing friend request", { playerId, targetName });

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  // Find target player by name
  let target: { id: string; name: string } | null;
  try {
    target = await repo.findPlayerByNameAsync(targetName);
  } catch (err) {
    logger.error("Failed to find player by name", err as Error, {
      playerId,
      targetName,
    });
    sendErrorToast(socket, "An error occurred. Please try again.");
    return;
  }

  if (!target) {
    sendErrorToast(socket, `Player "${targetName}" not found.`);
    return;
  }

  // Can't add yourself
  if (target.id === playerId) {
    sendSocialError(
      socket,
      "cannot_add_self",
      "You cannot add yourself as a friend.",
    );
    return;
  }

  // Check if already friends
  const alreadyFriends = await repo.areFriendsAsync(playerId, target.id);
  if (alreadyFriends) {
    sendSocialError(
      socket,
      "already_friends",
      `You are already friends with ${target.name}.`,
    );
    return;
  }

  // Check friend limit
  const friendCount = await repo.getFriendCountAsync(playerId);
  if (friendCount >= SOCIAL_CONSTANTS.MAX_FRIENDS) {
    sendSocialError(
      socket,
      "friend_limit_reached",
      "Your friends list is full.",
    );
    return;
  }

  // Check if request already exists (either direction)
  const hasOutgoingRequest = await repo.hasRequestAsync(playerId, target.id);
  if (hasOutgoingRequest) {
    sendSocialError(
      socket,
      "already_requested",
      `You have already sent a request to ${target.name}.`,
    );
    return;
  }

  // Check if there's an incoming request from them (auto-accept)
  const hasIncomingRequest = await repo.hasRequestAsync(target.id, playerId);
  if (hasIncomingRequest) {
    // They already sent us a request - just add as friends
    await repo.addFriendAsync(playerId, target.id);

    // Get full request to delete it
    const requests = await repo.getPendingRequestsAsync(playerId);
    const incomingRequest = requests.find((r) => r.fromPlayerId === target.id);
    if (incomingRequest) {
      await repo.declineRequestAsync(incomingRequest.id, playerId);
    }

    sendSuccessToast(socket, `You are now friends with ${target.name}!`);

    // Notify both players with updated friends list
    await sendFriendsListSync(socket, world, playerId);

    const targetSocket = getSocketByPlayerId(world, target.id);
    if (targetSocket) {
      await sendFriendsListSync(targetSocket, world, target.id);
    }

    return;
  }

  // Check if target has us ignored
  const isIgnored = await repo.isIgnoredByAsync(playerId, target.id);
  if (isIgnored) {
    // Don't reveal they're ignored, just silently fail
    sendSuccessToast(socket, `Friend request sent to ${target.name}.`);
    return;
  }

  // Create the request
  const requestId = await repo.createRequestAsync(playerId, target.id);

  sendSuccessToast(socket, `Friend request sent to ${target.name}.`);

  // Notify target if online
  const targetSocket = getSocketByPlayerId(world, target.id);
  if (targetSocket) {
    const senderName = getPlayerName(world, playerId);
    const request: FriendRequest = {
      id: requestId,
      fromId: playerId as FriendRequest["fromId"],
      fromName: senderName,
      toId: target.id as FriendRequest["toId"],
      toName: target.name,
      timestamp: Date.now(),
    };
    targetSocket.send("friendRequestIncoming", request);
  }
}

/**
 * Handle friend accept - accept incoming friend request
 */
export async function handleFriendAccept(
  socket: ServerSocket,
  data: { requestId: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before doing that again.",
    );
    return;
  }

  const { requestId } = data;
  if (!requestId || typeof requestId !== "string") {
    sendErrorToast(socket, "Invalid request.");
    return;
  }

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  // Get the request first to know who sent it
  const request = await repo.getRequestAsync(requestId);
  if (!request) {
    sendErrorToast(socket, "Friend request not found or expired.");
    return;
  }

  // Check friend limit before accepting
  const friendCount = await repo.getFriendCountAsync(playerId);
  if (friendCount >= SOCIAL_CONSTANTS.MAX_FRIENDS) {
    sendSocialError(
      socket,
      "friend_limit_reached",
      "Your friends list is full.",
    );
    return;
  }

  // Accept the request
  const success = await repo.acceptRequestAsync(requestId, playerId);
  if (!success) {
    sendErrorToast(socket, "Failed to accept friend request.");
    return;
  }

  sendSuccessToast(
    socket,
    `You are now friends with ${request.fromPlayerName}!`,
  );

  // Sync both players' friend lists
  await sendFriendsListSync(socket, world, playerId);

  const senderSocket = getSocketByPlayerId(world, request.fromPlayerId);
  if (senderSocket) {
    sendSuccessToast(
      senderSocket,
      `${getPlayerName(world, playerId)} accepted your friend request!`,
    );
    await sendFriendsListSync(senderSocket, world, request.fromPlayerId);
  }
}

/**
 * Handle friend decline - decline incoming friend request
 */
export async function handleFriendDecline(
  socket: ServerSocket,
  data: { requestId: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before doing that again.",
    );
    return;
  }

  const { requestId } = data;
  if (!requestId || typeof requestId !== "string") {
    sendErrorToast(socket, "Invalid request.");
    return;
  }

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  const success = await repo.declineRequestAsync(requestId, playerId);
  if (!success) {
    sendErrorToast(socket, "Friend request not found.");
    return;
  }

  sendSuccessToast(socket, "Friend request declined.");

  // Refresh the requester's friend list
  await sendFriendsListSync(socket, world, playerId);
}

/**
 * Handle friend remove - remove a friend
 */
export async function handleFriendRemove(
  socket: ServerSocket,
  data: { friendId: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before doing that again.",
    );
    return;
  }

  const { friendId } = data;
  if (!friendId || !isValidPlayerID(friendId)) {
    sendErrorToast(socket, "Invalid friend.");
    return;
  }

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  // Remove the friendship (bidirectional)
  await repo.removeFriendAsync(playerId, friendId);

  sendSuccessToast(socket, "Friend removed.");

  // Sync friend list
  await sendFriendsListSync(socket, world, playerId);

  // Also sync the removed friend's list if they're online
  const friendSocket = getSocketByPlayerId(world, friendId);
  if (friendSocket) {
    await sendFriendsListSync(friendSocket, world, friendId);
  }
}

/**
 * Handle ignore add - add player to ignore list
 */
export async function handleIgnoreAdd(
  socket: ServerSocket,
  data: { targetName: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before doing that again.",
    );
    return;
  }

  const { targetName } = data;
  if (
    !targetName ||
    typeof targetName !== "string" ||
    targetName.trim().length === 0
  ) {
    sendErrorToast(socket, "Please enter a valid player name.");
    return;
  }

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  // Find target player by name
  const target = await repo.findPlayerByNameAsync(targetName.trim());
  if (!target) {
    sendErrorToast(socket, `Player "${targetName}" not found.`);
    return;
  }

  // Can't ignore yourself
  if (target.id === playerId) {
    sendErrorToast(socket, "You cannot ignore yourself.");
    return;
  }

  // Check ignore limit
  const ignoreCount = await repo.getIgnoreCountAsync(playerId);
  if (ignoreCount >= SOCIAL_CONSTANTS.MAX_IGNORE) {
    sendSocialError(
      socket,
      "ignore_limit_reached",
      "Your ignore list is full.",
    );
    return;
  }

  // Add to ignore (also removes friendship if exists)
  await repo.addToIgnoreAsync(playerId, target.id);

  sendSuccessToast(
    socket,
    `${target.name} has been added to your ignore list.`,
  );

  // Sync both lists (friends and ignore)
  await sendFriendsListSync(socket, world, playerId);
}

/**
 * Handle ignore remove - remove player from ignore list
 */
export async function handleIgnoreRemove(
  socket: ServerSocket,
  data: { ignoredId: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit
  if (!rateLimiter.tryOperation(`friend:${playerId}`)) {
    sendSocialError(
      socket,
      "rate_limited",
      "Please wait before doing that again.",
    );
    return;
  }

  const { ignoredId } = data;
  if (!ignoredId || !isValidPlayerID(ignoredId)) {
    sendErrorToast(socket, "Invalid player.");
    return;
  }

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  await repo.removeFromIgnoreAsync(playerId, ignoredId);

  sendSuccessToast(socket, "Player removed from ignore list.");

  // Sync lists
  await sendFriendsListSync(socket, world, playerId);
}

/**
 * Handle private message - send private message to a player
 */
export async function handlePrivateMessage(
  socket: ServerSocket,
  data: { targetName: string; content: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Rate limit (stricter for messages)
  if (!rateLimiter.tryOperation(`pm:${playerId}`)) {
    logger.debug("Rate limited private message", { playerId });
    socket.send("privateMessageFailed", {
      reason: "rate_limited" as PrivateChatFailReason,
      targetName: data.targetName,
    });
    return;
  }

  // Validate input using utilities
  const targetName = validatePlayerName(data.targetName);
  if (!targetName) {
    sendErrorToast(socket, "Please enter a valid player name.");
    return;
  }

  const sanitizedContent = validateMessageContent(data.content);
  if (!sanitizedContent) {
    sendErrorToast(socket, "Please enter a message.");
    return;
  }

  logger.debug("Processing private message", { playerId, targetName });

  const repo = getFriendRepository(world);
  if (!repo) {
    sendErrorToast(
      socket,
      "Social system is not available. Please try again later.",
    );
    return;
  }

  // Find target by name
  let target: { id: string; name: string } | null;
  try {
    target = await repo.findPlayerByNameAsync(targetName);
  } catch (err) {
    logger.error("Failed to find message recipient", err as Error, {
      playerId,
      targetName,
    });
    sendErrorToast(socket, "An error occurred. Please try again.");
    return;
  }

  if (!target) {
    socket.send("privateMessageFailed", {
      reason: "player_not_found" as PrivateChatFailReason,
      targetName,
    });
    return;
  }

  // Check if target has us ignored
  const isIgnored = await repo.isIgnoredByAsync(playerId, target.id);
  if (isIgnored) {
    socket.send("privateMessageFailed", {
      reason: "ignored" as PrivateChatFailReason,
      targetName: target.name,
    });
    return;
  }

  // Check if target is online
  const targetSocket = getSocketByPlayerId(world, target.id);
  if (!targetSocket) {
    socket.send("privateMessageFailed", {
      reason: "offline" as PrivateChatFailReason,
      targetName: target.name,
    });
    return;
  }

  // Build message
  const senderName = getPlayerName(world, playerId);
  const message: PrivateMessage = {
    fromId: playerId as PrivateMessage["fromId"],
    fromName: sanitizeString(senderName),
    toId: target.id as PrivateMessage["toId"],
    toName: sanitizeString(target.name),
    content: sanitizedContent,
    timestamp: Date.now(),
  };

  logger.debug("Sending private message", { from: playerId, to: target.id });

  // Send to recipient
  targetSocket.send("privateMessageReceived", message);

  // Echo back to sender for chat display
  socket.send("privateMessageReceived", message);
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Send full friends list sync to a player
 */
export async function sendFriendsListSync(
  socket: ServerSocket,
  world: World,
  playerId: string,
): Promise<void> {
  const repo = getFriendRepository(world);
  if (!repo) {
    logger.debug("Database not ready, skipping friends list sync", {
      playerId,
    });
    return;
  }

  // Load all data in parallel
  let friendRows: Awaited<ReturnType<typeof repo.getFriendsAsync>>;
  let requestRows: Awaited<ReturnType<typeof repo.getPendingRequestsAsync>>;
  let ignoreRows: Awaited<ReturnType<typeof repo.getIgnoreListAsync>>;
  try {
    [friendRows, requestRows, ignoreRows] = await Promise.all([
      repo.getFriendsAsync(playerId),
      repo.getPendingRequestsAsync(playerId),
      repo.getIgnoreListAsync(playerId),
    ]);
  } catch (err) {
    logger.error(
      "Failed to load friends list data",
      err instanceof Error ? err : new Error(String(err)),
      { playerId },
    );
    sendErrorToast(socket, "Failed to load friends list.");
    return;
  }

  // Build enriched friend list with online status
  const friends: Friend[] = friendRows.map((f) =>
    buildFriendData(world, f.friendId, f.friendName, f.lastLogin),
  );

  // Map requests
  const requests: FriendRequest[] = requestRows.map((r) => ({
    id: r.id,
    fromId: r.fromPlayerId as FriendRequest["fromId"],
    fromName: r.fromPlayerName,
    toId: r.toPlayerId as FriendRequest["toId"],
    toName: r.toPlayerName,
    timestamp: r.createdAt,
  }));

  // Map ignore list
  const ignoreList: IgnoredPlayer[] = ignoreRows.map((i) => ({
    id: i.ignoredPlayerId as IgnoredPlayer["id"],
    name: i.ignoredPlayerName,
    addedAt: i.createdAt,
  }));

  const syncData: FriendsListSyncData = {
    friends,
    requests,
    ignoreList,
  };

  socket.send("friendsListSync", syncData);
}

/**
 * Notify friends of player status change (online/offline)
 */
export async function notifyFriendsOfStatusChange(
  playerId: string,
  status: "online" | "offline",
  world: World,
): Promise<void> {
  const repo = getFriendRepository(world);
  if (!repo) {
    logger.debug("Database not ready, skipping friend status notification", {
      playerId,
      status,
    });
    return;
  }

  // Get all friend IDs
  const friendIds = await repo.getFriendIdsAsync(playerId);
  if (friendIds.length === 0) return;

  const playerLevel = getPlayerCombatLevel(world, playerId);
  const playerLocation = getPlayerLocation(world, playerId);

  // Build status update
  const update: FriendStatusUpdateData = {
    friendId: playerId as FriendStatusUpdateData["friendId"],
    status,
    ...(status === "online"
      ? { location: playerLocation, level: playerLevel }
      : { lastSeen: Date.now() }),
  };

  // Send to all online friends
  for (const friendId of friendIds) {
    const friendSocket = getSocketByPlayerId(world, friendId);
    if (friendSocket) {
      friendSocket.send("friendStatusUpdate", update);
    }
  }
}

/**
 * Get friend IDs for a player (for external use)
 */
export async function getFriendIds(
  world: World,
  playerId: string,
): Promise<string[]> {
  const repo = getFriendRepository(world);
  if (!repo) {
    return [];
  }
  return repo.getFriendIdsAsync(playerId);
}
