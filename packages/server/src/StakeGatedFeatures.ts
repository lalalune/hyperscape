/**
 * Stake-Gated Feature Access Control
 * Restricts features based on reputation stake tier
 * 
 * IMPLEMENTATION STATUS: Structure defined, enforcement TODO
 * WORKAROUND: All features open during development
 */

import { RegistryClient } from './blockchain/registryClient';

export enum Feature {
  TRADING = 'trading',
  PVP = 'pvp',
  GUILD_CREATE = 'guild_create',
  GUILD_LEADERSHIP = 'guild_leadership',
  MARKETPLACE_SELL = 'marketplace_sell',
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
  [Feature.TRADING]: StakeTier.SMALL,         // 0.001 ETH
  [Feature.PVP]: StakeTier.MEDIUM,            // 0.01 ETH
  [Feature.GUILD_CREATE]: StakeTier.HIGH,     // 0.1 ETH
  [Feature.GUILD_LEADERSHIP]: StakeTier.HIGH, // 0.1 ETH
  [Feature.MARKETPLACE_SELL]: StakeTier.SMALL, // 0.001 ETH
};

/**
 * Check if player has access to feature
 * 
 * TODO: Full implementation requires:
 * 1. Query player's stake tier from IdentityRegistry
 * 2. Cache tier per player
 * 3. Check on feature access
 * 4. Show upgrade message if insufficient
 * 
 * Estimated: 4 hours for full implementation
 */
export async function canAccessFeature(
  registryClient: RegistryClient,
  agentId: number,
  feature: Feature
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // TODO: Query actual stake tier
    // const tier = await registryClient.getPlayerTier(agentId);
    const tier = StakeTier.HIGH; // TEMP: Allow all during development
    
    const required = FEATURE_REQUIREMENTS[feature];
    
    if (tier < required) {
      return {
        allowed: false,
        reason: `This feature requires ${StakeTier[required]} tier stake. Upgrade your reputation at gateway.jeju.network`,
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking feature access:', error);
    return { allowed: true }; // Fail open
  }
}

/**
 * Middleware to check feature access
 */
export function requireStakeTier(feature: Feature) {
  return async (agentId: number, registryClient: RegistryClient) => {
    const { allowed, reason } = await canAccessFeature(registryClient, agentId, feature);
    
    if (!allowed) {
      throw new Error(reason || 'Insufficient stake tier');
    }
  };
}

