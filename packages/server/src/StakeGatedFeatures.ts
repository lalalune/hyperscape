/**
 * Stake-Gated Feature Access Control
 * Restricts features based on reputation stake tier.
 *
 * Queries IdentityRegistry for player stake tier and caches results.
 * Features are gated based on minimum tier requirements.
 */

import { RegistryClient } from "./blockchain/registryClient";

export enum Feature {
  TRADING = "trading",
  PVP = "pvp",
  GUILD_CREATE = "guild_create",
  GUILD_LEADERSHIP = "guild_leadership",
  MARKETPLACE_SELL = "marketplace_sell",
}

export enum StakeTier {
  NONE = 0,
  SMALL = 1,
  MEDIUM = 2,
  HIGH = 3,
}

/**
 * Feature requirements by tier
 */
const FEATURE_REQUIREMENTS: Record<Feature, StakeTier> = {
  [Feature.TRADING]: StakeTier.SMALL, // 0.001 ETH
  [Feature.PVP]: StakeTier.MEDIUM, // 0.01 ETH
  [Feature.GUILD_CREATE]: StakeTier.HIGH, // 0.1 ETH
  [Feature.GUILD_LEADERSHIP]: StakeTier.HIGH, // 0.1 ETH
  [Feature.MARKETPLACE_SELL]: StakeTier.SMALL, // 0.001 ETH
};

// Cache for player tiers to avoid repeated queries
const tierCache = new Map<number, { tier: StakeTier; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if player has access to feature
 *
 * Queries player's stake tier from IdentityRegistry and caches the result.
 * Features are gated based on stake tier requirements.
 */
export async function canAccessFeature(
  registryClient: RegistryClient,
  agentId: number,
  feature: Feature,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check cache first
    const cached = tierCache.get(agentId);
    const now = Date.now();
    let tier: StakeTier;

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      tier = cached.tier;
    } else {
      // Query actual stake tier from IdentityRegistry
      const tierValue = await registryClient.getPlayerTier(agentId);
      tier = tierValue as StakeTier;
      // Cache the result
      tierCache.set(agentId, { tier, cachedAt: now });
    }

    const required = FEATURE_REQUIREMENTS[feature];

    if (tier < required) {
      return {
        allowed: false,
        reason: `This feature requires ${StakeTier[required]} tier stake (you have ${StakeTier[tier]}). Upgrade your reputation at gateway.jeju.network`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error(
      `[StakeGatedFeatures] Error checking feature access for agent ${agentId}:`,
      error,
    );
    // Fail closed for security - deny access if we can't verify tier
    return {
      allowed: false,
      reason:
        "Unable to verify stake tier. Please try again or contact support.",
    };
  }
}

/**
 * Middleware to check feature access
 */
export function requireStakeTier(feature: Feature) {
  return async (agentId: number, registryClient: RegistryClient) => {
    const { allowed, reason } = await canAccessFeature(
      registryClient,
      agentId,
      feature,
    );

    if (!allowed) {
      throw new Error(reason || "Insufficient stake tier");
    }
  };
}
