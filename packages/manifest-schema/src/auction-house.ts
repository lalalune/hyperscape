/**
 * Auction-house manifest schema.
 *
 * Authored policy blob governing the server-wide auction house — the
 * "post an item, set a buyout, earn gold while offline" pattern
 * (WoW AH / EVE market / tile-based MMORPG Grand Exchange). Covers listing rules
 * (fees, duration, stack sizing), bidding behavior (min increment,
 * sniping guards), search/discovery, cancellation rules, and
 * anti-market-manipulation heuristics.
 *
 * Scope: authored policy. Runtime `AuctionHouseSystem` owns active
 * listing storage, bid ledger, expire-timer + settlement pipeline,
 * search index, outbid/won/expired notifications (via `mail.ts`),
 * and the AH UI — all separate follow-ups.
 *
 * Scope-isolated from `economy-tuning.ts` (currency registry +
 * simple vendor/AH fee), `trading.ts` (synchronous P2P), and
 * `mail.ts` (delivery channel only — AH uses mail to deliver won
 * items and gold proceeds).
 */

import { z } from "zod";

/** Shape-only reference to another manifest id. */
const ManifestRef = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9_-]*$/,
    "manifest reference must be lowerCamelCase ASCII identifier",
  );

/**
 * Listing model — how a listing behaves.
 * `bidOnly` = pure auction (highest bid at expiry wins);
 * `buyoutOnly` = flat-price instant buy (no bidding, common in
 * modern MMOs where auctions have been deprecated);
 * `bidAndBuyout` = hybrid, bid accumulates but a buyout snipes it.
 */
export const AuctionListingModelSchema = z.enum([
  "bidOnly",
  "buyoutOnly",
  "bidAndBuyout",
]);
export type AuctionListingModel = z.infer<typeof AuctionListingModelSchema>;

/**
 * Expiry policy when a listing reaches its duration with no buyer.
 * `returnToSeller` = item is mailed back to the seller (fees kept);
 * `relistAtReserve` = system relists at the original reserve price;
 * `destroy` = harsh — item is destroyed (used only for time-limited
 * event items that shouldn't clog inventories).
 */
export const AuctionExpiryPolicySchema = z.enum([
  "returnToSeller",
  "relistAtReserve",
  "destroy",
]);
export type AuctionExpiryPolicy = z.infer<typeof AuctionExpiryPolicySchema>;

/**
 * Listing rules — how sellers create + pay for listings.
 */
export const AuctionListingRulesSchema = z
  .object({
    model: AuctionListingModelSchema.default("bidAndBuyout"),
    /**
     * Available durations (hours). Authors pick the bucket of choices
     * (classic WoW AH had 12/24/48; modern MMOs may offer 1/6/24/72).
     * Empty rejected by refinement.
     */
    durationsHours: z
      .array(z.number().int().min(1).max(336))
      .default([12, 24, 48]),
    /**
     * Deposit fraction charged up front (0..1). Non-refundable on expiry
     * so listing isn't free. 0 = no deposit (bad idea — enables flood).
     */
    depositFraction: z.number().min(0).max(0.5).default(0.05),
    /** Minimum deposit (flat currency floor on top of fraction). */
    depositMinimumCurrency: z.number().int().min(0).max(1_000_000).default(100),
    /** Maximum simultaneous listings per character. */
    maxListingsPerCharacter: z.number().int().min(1).max(1000).default(50),
    /** Maximum simultaneous listings per account (across chars). */
    maxListingsPerAccount: z.number().int().min(1).max(10_000).default(200),
    /**
     * Minimum reserve price a seller can set. Prevents spam-list abuse
     * (listing 1-copper items to flood search). 0 = no minimum.
     */
    minReservePriceCurrency: z.number().int().min(0).max(1_000_000).default(1),
    /**
     * Max listing price cap. 0 = no cap. Cap prevents absurd trillion-
     * gold listings that obscure the search UI.
     */
    maxListingPriceCurrency: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000_000)
      .default(0),
    /**
     * If true, stacks are allowed (listing can be multiple units of
     * stackable items). If false, every listing is singular.
     */
    allowStacks: z.boolean().default(true),
    /** Maximum stack size per listing. */
    maxStackSize: z.number().int().min(1).max(10_000).default(1000),
    expiryPolicy: AuctionExpiryPolicySchema.default("returnToSeller"),
  })
  .strict()
  .refine(({ durationsHours }) => durationsHours.length > 0, {
    message: "durationsHours must contain at least one duration",
  })
  .refine(
    ({ durationsHours }) =>
      new Set(durationsHours).size === durationsHours.length,
    { message: "durationsHours must not contain duplicates" },
  )
  .refine(
    ({ durationsHours }) =>
      durationsHours.every((d, i) => i === 0 || d > durationsHours[i - 1]),
    {
      message:
        "durationsHours must be strictly increasing (authored in order for UI display)",
    },
  )
  .refine(
    ({ maxListingsPerAccount, maxListingsPerCharacter }) =>
      maxListingsPerAccount >= maxListingsPerCharacter,
    {
      message:
        "maxListingsPerAccount must be >= maxListingsPerCharacter (account is a superset)",
    },
  );
export type AuctionListingRules = z.infer<typeof AuctionListingRulesSchema>;

/**
 * Bidding rules — only relevant for listing models with bids.
 */
export const AuctionBiddingRulesSchema = z
  .object({
    /**
     * Minimum bid increment (fraction of current bid). 0.05 = 5% higher
     * than the current high bid.
     */
    minIncrementFraction: z.number().min(0).max(1).default(0.05),
    /** Floor on the minimum-increment calculation (currency units). */
    minIncrementCurrencyFloor: z.number().int().min(0).max(100_000).default(10),
    /**
     * If > 0, a bid placed within this many seconds of expiry extends
     * the timer (anti-sniping). 0 = classic "snipe wins" behavior.
     */
    antiSnipeWindowSec: z.number().int().min(0).max(3600).default(300),
    /** Seconds added to the expiry when a snipe bid triggers anti-snipe extension. */
    antiSnipeExtensionSec: z.number().int().min(0).max(3600).default(300),
    /**
     * If true, the bidder is refunded their full bid when outbid. Nearly
     * always true — refund-via-mail is the standard pattern.
     */
    refundOutbidImmediately: z.boolean().default(true),
    /**
     * If true, the seller can see the current high bidder's name. If
     * false, anonymized ("Bidder #42"). Anonymity reduces collusion.
     */
    showBidderIdentityToSeller: z.boolean().default(false),
  })
  .strict()
  .refine(
    ({ antiSnipeWindowSec, antiSnipeExtensionSec }) =>
      antiSnipeWindowSec === 0 || antiSnipeExtensionSec > 0,
    {
      message:
        "antiSnipeWindowSec > 0 requires antiSnipeExtensionSec > 0 (a window with 0 extension is a no-op)",
    },
  );
export type AuctionBiddingRules = z.infer<typeof AuctionBiddingRulesSchema>;

/**
 * Cancellation rules — when a seller can pull a listing.
 */
export const AuctionCancellationRulesSchema = z
  .object({
    /**
     * If true, sellers can cancel a listing at any time (deposit kept).
     * If false, cancellation is blocked once bids arrive (prevents
     * shill-bid-cancel cycles).
     */
    allowCancellation: z.boolean().default(true),
    /**
     * If true, cancelling forfeits the deposit. If false, cancellation
     * is free (encourages price experimentation).
     */
    forfeitDepositOnCancel: z.boolean().default(true),
    /**
     * If true, cancellation is blocked within this many minutes of
     * expiry (prevents last-minute "oh someone's winning, cancel!").
     * 0 = no block.
     */
    cancelBlockedWithinMinutesOfExpiry: z
      .number()
      .int()
      .min(0)
      .max(240)
      .default(30),
    /** If true, refund outstanding bidders on cancellation. Usually true. */
    refundOutstandingBids: z.boolean().default(true),
  })
  .strict();
export type AuctionCancellationRules = z.infer<
  typeof AuctionCancellationRulesSchema
>;

/**
 * Fee rules — the cut the system takes on completed sales.
 */
export const AuctionFeeRulesSchema = z
  .object({
    /**
     * Commission on completed sale (0..1). 0.05 = 5% of the sale price
     * deducted before the seller receives the gold. Separate from
     * `depositFraction` (which is paid up-front).
     */
    commissionFraction: z.number().min(0).max(1).default(0.05),
    /** Currency id the AH settles in (ManifestRef). */
    currencyId: ManifestRef.default("gold"),
    /**
     * If true, premium (real-money) currency may also be listed —
     * unusual, but supported for games where premium currency is
     * tradeable by design (EVE PLEX).
     */
    allowPremiumCurrency: z.boolean().default(false),
    /**
     * If true, the daily AH revenue cap applies. Intended for server
     * economy stability — a new account can't launder unlimited gold
     * through the AH on day one.
     */
    enforceDailyRevenueCap: z.boolean().default(false),
    /** Daily AH revenue cap per character when enforced (in currencyId units). */
    dailyRevenueCapCurrency: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .default(1_000_000),
  })
  .strict();
export type AuctionFeeRules = z.infer<typeof AuctionFeeRulesSchema>;

/**
 * Search/discovery rules — how browsers find listings.
 */
export const AuctionSearchRulesSchema = z
  .object({
    /** Max results returned in one query (pagination floor). */
    pageSize: z.number().int().min(5).max(500).default(50),
    /**
     * Minimum search query length (characters). Prevents cross-realm
     * "list every item" scrapes.
     */
    minQueryLength: z.number().int().min(0).max(10).default(2),
    /**
     * Max search queries per character per minute. 0 = unlimited
     * (not recommended in large markets).
     */
    maxQueriesPerMinute: z.number().int().min(0).max(10_000).default(30),
    /**
     * If true, the listing owner's name is shown in search results.
     * If false, the seller is anonymized (market anti-collusion).
     */
    showSellerIdentity: z.boolean().default(true),
    /** If true, the AH exposes a read-only HTTP API for market tools. */
    allowPublicReadApi: z.boolean().default(false),
  })
  .strict();
export type AuctionSearchRules = z.infer<typeof AuctionSearchRulesSchema>;

/**
 * Anti-manipulation heuristics — flag-only, for moderation review.
 * Same philosophy as `trading.antiRmt` — detection is heuristic,
 * the schema captures what to log.
 */
export const AuctionAntiManipulationRulesSchema = z
  .object({
    /**
     * If > 0, listings > this fraction above current market median are
     * flagged as potential "price-fix posts". 0 = disabled.
     */
    flagOverpricedFraction: z.number().min(0).max(10).default(0),
    /**
     * If > 0, rapid listing + cancellation cycles on the same item
     * within this many seconds are flagged as "ladder manipulation".
     * 0 = disabled.
     */
    flagRapidListCancelSec: z.number().int().min(0).max(3600).default(300),
    /**
     * If true, self-bidding (listing from one character, bidding
     * from an alt on the same account) is auto-flagged.
     */
    flagSelfBidding: z.boolean().default(true),
    /**
     * Same-account self-bid policy: `log` flags silently, `block`
     * refuses the bid. Games that can't easily prove same-account on
     * separate clients use `log`; games with strong auth use `block`.
     */
    selfBidPolicy: z.enum(["log", "block"]).default("log"),
  })
  .strict();
export type AuctionAntiManipulationRules = z.infer<
  typeof AuctionAntiManipulationRulesSchema
>;

/**
 * Auction house is a single policy blob per game, not a registry.
 */
export const AuctionHouseManifestSchema = z
  .object({
    enabled: z.boolean().default(true),
    listing: AuctionListingRulesSchema.default(() =>
      AuctionListingRulesSchema.parse({}),
    ),
    bidding: AuctionBiddingRulesSchema.default(() =>
      AuctionBiddingRulesSchema.parse({}),
    ),
    cancellation: AuctionCancellationRulesSchema.default(() =>
      AuctionCancellationRulesSchema.parse({}),
    ),
    fees: AuctionFeeRulesSchema.default(() => AuctionFeeRulesSchema.parse({})),
    search: AuctionSearchRulesSchema.default(() =>
      AuctionSearchRulesSchema.parse({}),
    ),
    antiManipulation: AuctionAntiManipulationRulesSchema.default(() =>
      AuctionAntiManipulationRulesSchema.parse({}),
    ),
  })
  .strict()
  .refine(
    ({ listing, bidding }) =>
      listing.model === "buyoutOnly" || bidding.minIncrementFraction > 0,
    {
      message:
        "listing model with bids (bidOnly|bidAndBuyout) requires bidding.minIncrementFraction > 0 (else bid war cannot progress)",
    },
  );
export type AuctionHouseManifest = z.infer<typeof AuctionHouseManifestSchema>;
