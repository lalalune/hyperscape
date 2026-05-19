/**
 * Trading manifest schema.
 *
 * Authored policy blob governing direct player-to-player trade (the
 * classic "two-window confirm" trade dialog, not auction or mail).
 * Covers the safe-trade confirmation window, item/currency restrictions,
 * commission/tax, rate limits, cross-faction and level-gap rules, and
 * anti-RMT flags.
 *
 * Scope: authored policy. Runtime `TradeSystem` owns the trade-session
 * state machine, item escrow, confirm/cancel protocol, logging for
 * moderation, and the trade UI — all separate follow-ups.
 *
 * Scope-isolated from `mail.ts` (asynchronous delivery with attachments),
 * `economy-tuning.ts` (auction house + vendor economics), and
 * `commerce.ts` (NPC shops). Trading is only the synchronous player-to-
 * player channel.
 */

import { z } from "zod";

/**
 * Confirmation model — how the two-window confirm flow resolves.
 * `bothConfirm` = classic Diablo 2 / WoW "both press accept, then both
 * press confirm"; `singleConfirm` = single-click with a countdown; `none`
 * = instant (no anti-phishing gate — discouraged, but supported for
 * admin/debug servers).
 */
export const TradeConfirmModeSchema = z.enum([
  "bothConfirm",
  "singleConfirm",
  "none",
]);
export type TradeConfirmMode = z.infer<typeof TradeConfirmModeSchema>;

/**
 * Session rules — the interactive trade-window behavior.
 */
export const TradeSessionRulesSchema = z
  .object({
    confirmMode: TradeConfirmModeSchema.default("bothConfirm"),
    /**
     * Countdown seconds shown on the confirm dialog (0 = no countdown,
     * both must press simultaneously).
     */
    confirmCountdownSec: z.number().int().min(0).max(60).default(5),
    /**
     * Session expires if both parties don't confirm within this many
     * seconds from trade open. 0 = no timeout (not recommended).
     */
    sessionTimeoutSec: z.number().int().min(0).max(600).default(120),
    /**
     * A trade *invite* (pre-session) expires this many seconds after
     * being sent if the recipient hasn't accepted. 0 = invites never
     * auto-expire (not recommended — leaks UI state).
     */
    requestTimeoutSec: z.number().int().min(0).max(300).default(30),
    /**
     * Inactivity guard for an open trade session: if neither party
     * modifies their offer or toggles confirm within this many seconds,
     * the session auto-cancels. Reset on every user action. 0 = no
     * inactivity guard (session only ends via `sessionTimeoutSec`).
     *
     * Note: when both timers are > 0 the session ends at whichever
     * fires first (`min(sessionTimeoutSec, timeSinceLastActionSec)`).
     * Configuring `inactivityTimeoutSec > sessionTimeoutSec` is allowed
     * but means the inactivity guard never fires.
     */
    inactivityTimeoutSec: z.number().int().min(0).max(600).default(300),
    /**
     * Max item slots each side can offer in one session. Default 28
     * matches RS-classic / tile-based MMORPG inventory size (one full inventory per
     * side).
     */
    maxItemSlotsPerSide: z.number().int().min(1).max(28).default(28),
    /** Max distance (world units) between trading players. */
    maxDistanceMeters: z.number().min(0.5).max(50).default(5),
    /** If true, moving beyond `maxDistanceMeters` auto-cancels the trade. */
    autoCancelOnDistance: z.boolean().default(true),
    /** If true, any item change on either side resets both confirms. */
    resetConfirmOnChange: z.boolean().default(true),
  })
  .strict();
export type TradeSessionRules = z.infer<typeof TradeSessionRulesSchema>;

/**
 * Item restrictions — what items may cross the trade boundary.
 */
export const TradeItemRestrictionsSchema = z
  .object({
    /** If true, soulbound items are blocked (standard MMO rule). */
    blockSoulbound: z.boolean().default(true),
    /**
     * If true, BoA (bound-on-account) items may trade between the same
     * account's characters only. Has no effect if `blockSoulbound=true`
     * (soulbound check fires first).
     */
    allowBoaBetweenSameAccount: z.boolean().default(true),
    /** If true, quest items are blocked (standard; questlines require personal items). */
    blockQuestItems: z.boolean().default(true),
    /**
     * If true, items under this gear-score threshold are blocked.
     * 0 = no threshold.
     */
    minGearScore: z.number().int().min(0).max(10_000).default(0),
    /**
     * If true, only items above a rarity threshold can trade. Empty =
     * any rarity. Matches `titles.ts` rarity enum values.
     */
    minRarity: z
      .enum(["", "common", "uncommon", "rare", "epic", "legendary", "mythic"])
      .default(""),
    /** Blocklist of specific item ids that may never trade (ManifestRef, shape-only). */
    blockedItemIds: z
      .array(
        z
          .string()
          .regex(
            /^[a-z][a-zA-Z0-9_-]*$/,
            "blocked item id must be lowerCamelCase ASCII identifier",
          ),
      )
      .default([]),
  })
  .strict()
  .refine(
    ({ blockedItemIds }) =>
      new Set(blockedItemIds).size === blockedItemIds.length,
    { message: "blockedItemIds must not contain duplicates" },
  );
export type TradeItemRestrictions = z.infer<typeof TradeItemRestrictionsSchema>;

/**
 * Currency rules — how currency flows in trade.
 */
export const TradeCurrencyRulesSchema = z
  .object({
    /** If true, the primary currency (gold) may accompany item offers. */
    allowPrimaryCurrency: z.boolean().default(true),
    /** Maximum currency amount per side per trade. */
    maxCurrencyPerSide: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .default(10_000_000),
    /**
     * Commission on the currency side (0..1). 0 = no commission, 0.05 =
     * 5% of the currency side is taxed by the system (anti-RMT drag).
     */
    commission: z.number().min(0).max(1).default(0),
    /** Currency id (resolves against `economy-tuning.ts`). */
    currencyId: z
      .string()
      .regex(
        /^[a-z][a-zA-Z0-9_-]*$/,
        "currency id must be lowerCamelCase ASCII identifier",
      )
      .default("gold"),
    /**
     * If true, only the *premium* currency (real-money-bought) is
     * blocked from trade. Usually true — premium-currency trade is the
     * primary RMT attack vector.
     */
    blockPremiumCurrency: z.boolean().default(true),
  })
  .strict();
export type TradeCurrencyRules = z.infer<typeof TradeCurrencyRulesSchema>;

/**
 * Eligibility rules — who can trade with whom.
 */
export const TradeEligibilityRulesSchema = z
  .object({
    /** If true, cross-faction trade is allowed. Many MMOs block this. */
    allowCrossFaction: z.boolean().default(false),
    /** If true, only players who have been mutual-added as friends may trade. */
    requireFriendship: z.boolean().default(false),
    /** Minimum account age (days) to participate (anti-bot). 0 = no requirement. */
    minAccountAgeDays: z.number().int().min(0).max(365).default(0),
    /** Minimum character level on both sides. */
    minCharacterLevel: z.number().int().min(1).max(100).default(1),
    /**
     * Max level gap between the two parties. 0 = no gap cap (standard).
     * Setting > 0 prevents high-level-gifting exploits at the cost of
     * convenience.
     */
    maxLevelGap: z.number().int().min(0).max(100).default(0),
    /** If true, players on each other's ignore list cannot trade. */
    blockIgnoredPlayers: z.boolean().default(true),
  })
  .strict();
export type TradeEligibilityRules = z.infer<typeof TradeEligibilityRulesSchema>;

/**
 * Rate-limit rules — per-player caps.
 */
export const TradeRateLimitRulesSchema = z
  .object({
    /** Max trade completions per player per hour. */
    maxTradesPerHour: z.number().int().min(1).max(1000).default(30),
    /** Max trade completions per player per day. */
    maxTradesPerDay: z.number().int().min(1).max(10_000).default(200),
    /** Minimum seconds between consecutive trade completions (cooldown). */
    minIntervalBetweenTradesSec: z.number().int().min(0).max(3600).default(3),
    /** Max trade *requests* (invites) sent per player per hour. */
    maxRequestsPerHour: z.number().int().min(1).max(1000).default(60),
    /**
     * Minimum seconds before the *same* sender→target invite pair may be
     * re-issued. Anti-spam: stops griefers from hammering an invite
     * prompt at a single target.
     */
    perTargetRequestCooldownSec: z.number().int().min(0).max(600).default(3),
    /**
     * Max trade-window operations (add/remove/confirm/unconfirm) per
     * player per second. Back-pressure against scripted rapid-fire
     * toggles that try to race the confirm reset.
     */
    maxOperationsPerSecond: z.number().int().min(1).max(100).default(10),
  })
  .strict()
  .refine(
    ({ maxTradesPerHour, maxTradesPerDay }) =>
      maxTradesPerDay >= maxTradesPerHour,
    {
      message:
        "maxTradesPerDay must be >= maxTradesPerHour (day is a superset of hour)",
    },
  );
export type TradeRateLimitRules = z.infer<typeof TradeRateLimitRulesSchema>;

/**
 * Anti-RMT rules — heuristics flagged for moderation review.
 */
export const TradeAntiRmtRulesSchema = z
  .object({
    /**
     * Threshold for "low-value trade" — a trade where one side's value
     * is under this fraction of the other. 0 = no threshold; 0.1 = flag
     * trades where one side offers <10% of the value.
     */
    asymmetryFlagThreshold: z.number().min(0).max(1).default(0),
    /** If true, trades from newly created accounts (< minAccountAgeDays) are auto-logged. */
    logNewAccountTrades: z.boolean().default(true),
    /** If true, large currency-side trades (>50% of currency cap) are auto-logged. */
    logLargeCurrencyTrades: z.boolean().default(true),
    /**
     * If true, currency-only trades (no items on one side) are auto-
     * logged — classic RMT signature.
     */
    logCurrencyOnlyTrades: z.boolean().default(true),
    /** If > 0, players with this many flags in 24h are auto-suspended from trading. */
    autoSuspendFlagThreshold: z.number().int().min(0).max(1000).default(0),
  })
  .strict();
export type TradeAntiRmtRules = z.infer<typeof TradeAntiRmtRulesSchema>;

/**
 * Trading is a single policy blob per game, not a registry of entries.
 */
export const TradingManifestSchema = z
  .object({
    enabled: z.boolean().default(true),
    session: TradeSessionRulesSchema.default(() =>
      TradeSessionRulesSchema.parse({}),
    ),
    items: TradeItemRestrictionsSchema.default(() =>
      TradeItemRestrictionsSchema.parse({}),
    ),
    currency: TradeCurrencyRulesSchema.default(() =>
      TradeCurrencyRulesSchema.parse({}),
    ),
    eligibility: TradeEligibilityRulesSchema.default(() =>
      TradeEligibilityRulesSchema.parse({}),
    ),
    rateLimit: TradeRateLimitRulesSchema.default(() =>
      TradeRateLimitRulesSchema.parse({}),
    ),
    antiRmt: TradeAntiRmtRulesSchema.default(() =>
      TradeAntiRmtRulesSchema.parse({}),
    ),
  })
  .strict()
  .refine(
    ({ currency, items }) =>
      currency.allowPrimaryCurrency || items.blockedItemIds.length >= 0,
    // No-op refinement kept as a hook for future cross-block invariants.
    { message: "trading invariants check" },
  )
  .refine(
    ({ session }) =>
      session.confirmMode !== "none" || session.sessionTimeoutSec > 0,
    {
      message:
        "confirmMode='none' with sessionTimeoutSec=0 is unsafe — one party could freeze the session indefinitely",
    },
  );
export type TradingManifest = z.infer<typeof TradingManifestSchema>;
