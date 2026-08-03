/**
 * Social System Types
 *
 * Type definitions for the friend/social system including:
 * - Friends list and status tracking
 * - Friend requests
 * - Ignore list
 * - Private messaging
 *
 * Follows classic fantasy MMORPG-style social mechanics with bidirectional friendships.
 *
 * @see packages/server/src/database/repositories/FriendRepository for server implementation
 * @see packages/client/src/game/panels/FriendsPanel for UI implementation
 */

import type { PlayerID } from "../core/identifiers";

// ============================================================================
// Friend Status Types
// ============================================================================

/**
 * Friend online status
 *
 * - online: Currently logged in and active
 * - away: Logged in but idle
 * - busy: Logged in but busy (in combat, trading, etc.)
 * - offline: Not currently logged in
 */
export type FriendStatus = "online" | "away" | "busy" | "offline";

// ============================================================================
// Friend Types
// ============================================================================

/**
 * Friend data sent to client
 *
 * Contains all information needed to display a friend in the friends list.
 * Online friends include location and level; offline friends show last seen.
 */
export type Friend = {
  /** Friend's player/character ID */
  id: PlayerID;
  /** Friend's display name */
  name: string;
  /** Current online status */
  status: FriendStatus;
  /** Current zone/area name (if online) */
  location?: string;
  /** Combat level (if online) */
  level?: number;
  /** Timestamp from characters.lastLogin (if offline) */
  lastSeen?: number;
};

/**
 * Friend status update payload (sent when friend comes online/offline/changes location)
 */
export type FriendStatusUpdateData = {
  /** Friend's player ID */
  friendId: PlayerID;
  /** New status */
  status: FriendStatus;
  /** Current location (if online) */
  location?: string;
  /** Combat level (if online) */
  level?: number;
  /** Last seen timestamp (if offline) */
  lastSeen?: number;
};

// ============================================================================
// Friend Request Types
// ============================================================================

/**
 * Pending friend request
 *
 * Represents a friend request that has been sent but not yet accepted/declined.
 * Requests automatically expire after REQUEST_TIMEOUT_MS (7 days).
 */
export type FriendRequest = {
  /** Unique request UUID */
  id: string;
  /** ID of player who sent the request */
  fromId: PlayerID;
  /** Display name of sender */
  fromName: string;
  /** ID of player receiving the request */
  toId: PlayerID;
  /** Display name of recipient */
  toName: string;
  /** Timestamp when request was sent (Unix ms) */
  timestamp: number;
};

// ============================================================================
// Ignore List Types
// ============================================================================

/**
 * Ignored player entry
 *
 * Players on the ignore list cannot:
 * - Send private messages to the ignoring player
 * - Send friend requests to the ignoring player
 * - Their public chat may also be hidden (optional feature)
 */
export type IgnoredPlayer = {
  /** Ignored player's ID */
  id: PlayerID;
  /** Ignored player's display name */
  name: string;
  /** Timestamp when added to ignore list (Unix ms) */
  addedAt: number;
};

// ============================================================================
// Private Message Types
// ============================================================================

/**
 * Private message between players
 *
 * Private messages can only be sent between friends (optional setting).
 * Messages are not persisted - only delivered if recipient is online.
 */
export type PrivateMessage = {
  /** Sender's player ID */
  fromId: PlayerID;
  /** Sender's display name */
  fromName: string;
  /** Recipient's player ID */
  toId: PlayerID;
  /** Recipient's display name */
  toName: string;
  /** Message content (max PRIVATE_MESSAGE_MAX_LENGTH characters) */
  content: string;
  /** Timestamp when sent (Unix ms) */
  timestamp: number;
};

/**
 * Reasons why a private message failed to deliver
 */
export type PrivateChatFailReason =
  | "offline" // Recipient is not online
  | "ignored" // Recipient has sender on ignore list
  | "not_friends" // Players are not friends (if friends-only mode)
  | "player_not_found" // No player with that name exists
  | "rate_limited"; // Sender is sending too many messages

// ============================================================================
// Sync Payload Types
// ============================================================================

/**
 * Full friends list sync payload
 *
 * Sent to client on connect and when major changes occur.
 * Contains complete state of friends, pending requests, and ignore list.
 */
export type FriendsListSyncData = {
  /** All friends with current status */
  friends: Friend[];
  /** Pending incoming friend requests */
  requests: FriendRequest[];
  /** Players on ignore list */
  ignoreList: IgnoredPlayer[];
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Social operation error codes
 */
export type SocialErrorCode =
  | "friend_limit_reached" // Already at MAX_FRIENDS
  | "ignore_limit_reached" // Already at MAX_IGNORE
  | "already_friends" // Target is already a friend
  | "already_ignored" // Target is already ignored
  | "already_requested" // Friend request already pending
  | "request_not_found" // Friend request doesn't exist
  | "cannot_add_self" // Can't add yourself as friend
  | "player_not_found" // Target player doesn't exist
  | "rate_limited"; // Too many operations

/**
 * Social operation error payload
 */
export type SocialError = {
  /** Error code for programmatic handling */
  code: SocialErrorCode;
  /** Human-readable error message */
  message: string;
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Social system constants
 */
export const SOCIAL_CONSTANTS = {
  /** Maximum number of friends per player */
  MAX_FRIENDS: 99,
  /** Maximum number of ignored players per player */
  MAX_IGNORE: 99,
  /** Friend request expiration time (7 days in ms) */
  REQUEST_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,
  /** Maximum length of a private message */
  PRIVATE_MESSAGE_MAX_LENGTH: 200,
  /** Rate limit: max friend operations per minute */
  MAX_OPERATIONS_PER_MINUTE: 30,
} as const;
