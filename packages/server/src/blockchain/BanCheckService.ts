/**
 * Ban Check Service for Hyperscape
 * Checks if players are banned before allowing game access
 */

import { ethers } from "ethers";

// BanCache interface - dynamically loaded if available
interface BanCache {
  initialize(): Promise<void>;
  startListening(): void;
  isAllowed(agentId: number): boolean;
  getStatus(agentId: number): {
    networkBanned: boolean;
    appBanned: boolean;
    labels: string[];
    banReason?: string;
  };
  getLabels(agentId: number): string[];
  hasLabelType(agentId: number, label: string): boolean;
}

interface BanCacheConfig {
  banManagerAddress: string;
  labelManagerAddress: string;
  rpcUrl: string;
  appId: string;
}

const BAN_MANAGER_ADDRESS = process.env.BAN_MANAGER_ADDRESS || "";
const LABEL_MANAGER_ADDRESS = process.env.LABEL_MANAGER_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";

const HYPERSCAPE_APP_ID = ethers.keccak256(ethers.toUtf8Bytes("hyperscape"));

/**
 * Singleton ban cache for Hyperscape
 */
class HyperscapeBanCheckService {
  private cache: BanCache | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to dynamically import NetworkBanCache if it exists
      const banCacheModule = await import(
        /* @vite-ignore */
        "../../../../../../scripts/shared/NetworkBanCache"
      ).catch(() => null);

      if (!banCacheModule?.NetworkBanCache) {
        console.warn("[BanCheck] NetworkBanCache module not available, ban checking disabled");
        this.initialized = true;
        return;
      }

      const config: BanCacheConfig = {
        banManagerAddress: BAN_MANAGER_ADDRESS,
        labelManagerAddress: LABEL_MANAGER_ADDRESS,
        rpcUrl: RPC_URL,
        appId: HYPERSCAPE_APP_ID,
      };

      this.cache = new banCacheModule.NetworkBanCache(config);
      await this.cache.initialize();
      this.cache.startListening();

      this.initialized = true;
      console.log("[BanCheck] Hyperscape ban checking initialized");
    } catch (error) {
      console.error("[BanCheck] Failed to initialize ban checking:", error);
      // Continue without ban checking (degraded mode)
    }
  }

  /**
   * Check if player is banned from Hyperscape
   */
  async isPlayerBanned(agentId: number): Promise<boolean> {
    if (!this.cache) {
      console.warn("[BanCheck] Ban cache not initialized, allowing access");
      return false; // Fail open (allow access if ban system down)
    }

    try {
      return !this.cache.isAllowed(agentId);
    } catch (error) {
      console.error("[BanCheck] Error checking ban status:", error);
      return false; // Fail open
    }
  }

  /**
   * Get full ban status for player
   */
  async getBanStatus(agentId: number) {
    if (!this.cache) {
      return {
        networkBanned: false,
        appBanned: false,
        labels: [],
        banReason: undefined,
      };
    }

    return this.cache.getStatus(agentId);
  }

  /**
   * Get labels for player (for display)
   */
  async getPlayerLabels(agentId: number): Promise<string[]> {
    if (!this.cache) return [];
    return this.cache.getLabels(agentId);
  }

  /**
   * Check if player has specific label
   */
  async hasLabel(agentId: number, label: string): Promise<boolean> {
    if (!this.cache) return false;
    return this.cache.hasLabelType(agentId, label);
  }
}

// Export singleton
export const banCheckService = new HyperscapeBanCheckService();

/**
 * Check if player agentId is banned and should be denied access
 * Returns { allowed: boolean, reason?: string }
 */
export async function checkPlayerBan(
  agentId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const isBanned = await banCheckService.isPlayerBanned(agentId);

  if (!isBanned) {
    return { allowed: true };
  }

  // Get ban reason
  const status = await banCheckService.getBanStatus(agentId);

  if (status.networkBanned) {
    return {
      allowed: false,
      reason: status.banReason || "You have been banned from the Jeju network.",
    };
  }

  if (status.appBanned) {
    return {
      allowed: false,
      reason: status.banReason || "You have been banned from Hyperscape.",
    };
  }

  return { allowed: true };
}

/**
 * Initialize ban checking when server starts
 */
export async function initializeBanChecking(): Promise<void> {
  if (!BAN_MANAGER_ADDRESS || !LABEL_MANAGER_ADDRESS) {
    console.warn(
      "[BanCheck] Moderation contracts not configured, ban checking disabled",
    );
    return;
  }

  await banCheckService.initialize();
}
