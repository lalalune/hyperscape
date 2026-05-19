/**
 * Friends / social manifest schema.
 *
 * Authored policy blob governing the per-player social graph: friends
 * list, ignore list, recent-players list, online-status visibility, and
 * cross-realm / cross-faction friendship rules. This is the "buddy list
 * rules" config — not the chat system (see `chat-channels.ts`) and not
 * the group-forming system (see `party-guild.ts`).
 *
 * Scope: authored policy. Runtime `SocialSystem` owns the persisted
 * per-player friend/ignore/recent rosters, friend-request state machine
 * (invite → pending → accepted/declined/expired), online-status
 * broadcast, and the friends-list UI — all separate follow-ups.
 *
 * Scope-isolated from `chat-channels.ts` (the wire for whisper), from
 * `party-guild.ts` (group membership), and from `trading.ts` (which
 * references this block only via `eligibility.requireFriendship`).
 */

import { z } from "zod";

/**
 * Default online-status visibility for new characters.
 * `online` = show everyone; `friendsOnly` = only friends see "online";
 * `guildOnly` = only guildmates; `invisible` = show offline to everyone
 * (friends can still message, seen as "unknown" in lists).
 */
export const OnlineVisibilityModeSchema = z.enum([
  "online",
  "friendsOnly",
  "guildOnly",
  "invisible",
]);
export type OnlineVisibilityMode = z.infer<typeof OnlineVisibilityModeSchema>;

/**
 * Scope of friends/ignore persistence.
 * `perCharacter` = each character has its own list; `perAccount` = one
 * shared list across every character on the account (modern MMO
 * standard); `perRealm` = shared within one realm/server only.
 */
export const SocialListScopeSchema = z.enum([
  "perCharacter",
  "perAccount",
  "perRealm",
]);
export type SocialListScope = z.infer<typeof SocialListScopeSchema>;

/**
 * Friends list rules.
 */
export const FriendsListRulesSchema = z
  .object({
    /**
     * Max simultaneous friends per player. Default 99 matches the
     * RS-classic / tile-based MMORPG limit (single-byte friend list count).
     */
    maxFriends: z.number().int().min(1).max(1000).default(99),
    /** Persistence scope for the friends list. */
    scope: SocialListScopeSchema.default("perAccount"),
    /**
     * If true, friend requests auto-accept when both parties are in the
     * same guild (reduces request-spam inside a guild).
     */
    autoAcceptFromSameGuild: z.boolean().default(false),
    /** If true, friends can be made across faction lines. */
    allowCrossFaction: z.boolean().default(true),
    /** If true, friends can be made across realm/server lines. */
    allowCrossRealm: z.boolean().default(true),
    /**
     * Hours before a pending friend request expires and is cleared
     * from the recipient's inbox. 0 = never expires.
     */
    friendRequestExpireHours: z.number().int().min(0).max(720).default(72),
    /**
     * Max length of the per-friend note field (visible to the owner
     * only — "my tank", "raid leader", etc.).
     */
    maxNoteLength: z.number().int().min(0).max(500).default(120),
    /**
     * If true, offline messages (short notes left for friends who are
     * offline) are supported and queued until they log in.
     */
    allowOfflineMessages: z.boolean().default(true),
    /** Max offline messages queued per (sender,recipient) pair. */
    maxOfflineMessagesPerSender: z.number().int().min(0).max(50).default(5),
  })
  .strict();
export type FriendsListRules = z.infer<typeof FriendsListRulesSchema>;

/**
 * Ignore list rules.
 */
export const IgnoreListRulesSchema = z
  .object({
    /**
     * Max simultaneous ignored players per player. Default 99 matches
     * the RS-classic / tile-based MMORPG limit (symmetric with friends list).
     */
    maxIgnored: z.number().int().min(1).max(1000).default(99),
    /** Persistence scope for the ignore list. */
    scope: SocialListScopeSchema.default("perAccount"),
    /**
     * Days before an ignore entry auto-expires. 0 = permanent (the
     * MMO standard, since re-ignoring the same griefer is a friction
     * the system should not impose).
     */
    expireAfterDays: z.number().int().min(0).max(3650).default(0),
    /**
     * If true, ignored players cannot send whispers, mails, party
     * invites, guild invites, or trade requests. This is the standard
     * "full ignore" — set false to make ignore a chat-only filter.
     */
    blocksAllInteractions: z.boolean().default(true),
    /**
     * If true, when player A ignores player B, B is told "your message
     * was not delivered" (transparent ignore). If false, B sees the
     * message as delivered but A never receives it (silent ignore).
     * Silent ignore is the MMO standard — transparent invites retaliation.
     */
    transparentToBlocked: z.boolean().default(false),
  })
  .strict();
export type IgnoreListRules = z.infer<typeof IgnoreListRulesSchema>;

/**
 * Recent-players list rules — the "who did I just group with?" list that
 * enables quick re-friend / re-invite / report actions.
 */
export const RecentPlayersRulesSchema = z
  .object({
    /** If true, a recent-players list is maintained. */
    enabled: z.boolean().default(true),
    /** Max entries retained. */
    maxEntries: z.number().int().min(1).max(200).default(50),
    /**
     * Retention window (hours). 0 = never auto-prune (bounded only
     * by `maxEntries`).
     */
    retentionHours: z.number().int().min(0).max(720).default(72),
    /**
     * If true, players encountered via party/raid are recorded.
     */
    recordPartyMembers: z.boolean().default(true),
    /** If true, dungeon/raid finder group-mates are recorded. */
    recordFinderGroups: z.boolean().default(true),
    /** If true, players encountered in open-world PvP are recorded. */
    recordPvpEncounters: z.boolean().default(false),
  })
  .strict();
export type RecentPlayersRules = z.infer<typeof RecentPlayersRulesSchema>;

/**
 * Online-status visibility rules.
 */
export const OnlineStatusRulesSchema = z
  .object({
    /** Default mode for brand-new characters. */
    defaultVisibility: OnlineVisibilityModeSchema.default("online"),
    /** If true, players can choose any of the 4 modes in settings. */
    allowPlayerOverride: z.boolean().default(true),
    /**
     * If true, an "online → offline" edge broadcasts to friends (they
     * see "X has gone offline"). If false, the transition is silent.
     */
    broadcastOfflineEdge: z.boolean().default(true),
    /**
     * If true, an "offline → online" edge broadcasts to friends.
     */
    broadcastOnlineEdge: z.boolean().default(true),
    /**
     * If true, online-status events also broadcast to the player's
     * guild (not just friends).
     */
    broadcastToGuild: z.boolean().default(true),
    /**
     * If true, friends see the player's current zone/area name (like
     * WoW). If false, only presence is shown.
     */
    showZoneToFriends: z.boolean().default(true),
    /** If true, friends see a "last seen" timestamp when offline. */
    showLastSeenToFriends: z.boolean().default(true),
  })
  .strict();
export type OnlineStatusRules = z.infer<typeof OnlineStatusRulesSchema>;

/**
 * Friends/social is a single policy blob per game, not a registry.
 */
export const FriendsSocialManifestSchema = z
  .object({
    enabled: z.boolean().default(true),
    /**
     * Max length (characters) of a private message (whisper / direct
     * message) between players. Applied server-side to reject over-
     * length messages and client-side to truncate at the compose box.
     */
    privateMessageMaxLength: z.number().int().min(1).max(2000).default(200),
    friends: FriendsListRulesSchema.default(() =>
      FriendsListRulesSchema.parse({}),
    ),
    ignore: IgnoreListRulesSchema.default(() =>
      IgnoreListRulesSchema.parse({}),
    ),
    recent: RecentPlayersRulesSchema.default(() =>
      RecentPlayersRulesSchema.parse({}),
    ),
    onlineStatus: OnlineStatusRulesSchema.default(() =>
      OnlineStatusRulesSchema.parse({}),
    ),
  })
  .strict()
  .refine(({ friends, ignore }) => friends.scope === ignore.scope, {
    message:
      "friends.scope and ignore.scope must match (mixing perAccount friends with perCharacter ignores is confusing to players and hard to audit)",
  })
  .refine(
    ({ onlineStatus }) =>
      onlineStatus.allowPlayerOverride ||
      onlineStatus.defaultVisibility !== "invisible",
    {
      message:
        "defaultVisibility='invisible' requires allowPlayerOverride=true (otherwise nobody can ever appear online)",
    },
  );
export type FriendsSocialManifest = z.infer<typeof FriendsSocialManifestSchema>;
