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
      const banCacheModule = await (async () => {
        try {
          // Dynamic import with path that may not exist at build time
          const mod = await import(
            /* @vite-ignore */
            // @ts-ignore - Optional external module path
            "../../../../../../scripts/shared/NetworkBanCache"
          );
          return mod;
        } catch {
          return null;
        }
      })();

      if (!banCacheModule?.NetworkBanCache) {
        console.warn(
          "[BanCheck] NetworkBanCache module not available, ban checking disabled",
        );
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
      await this.cache!.initialize();
      this.cache!.startListening();

      this.initialized = true;
      console.log("[BanCheck] Hyperscape ban checking initialized");
    } catch (error) {
      console.error("[BanCheck] Failed to initialize ban checking:", error);
      // Continue without ban checking (degraded mode)
    }
  }

  /**
   * Check if player is banned from Hyperscape
   * 
   * SECURITY: This method fails CLOSED (denies access) if ban system is unavailable.
   * This prevents banned players from accessing the game if the ban system is down.
   * 
   * @param agentId - Player agent ID to check
   * @returns true if player is banned, false if allowed
   * @throws Error if ban system is unavailable (forces fail-closed behavior)
   */
  async isPlayerBanned(agentId: number): Promise<boolean> {
    if (!this.cache) {
      // SECURITY: Fail CLOSED - deny access if ban system unavailable
      // This prevents banned players from bypassing bans if system is down
      const error = new Error(
        `[BanCheck] Ban cache not initialized - cannot verify ban status for agent ${agentId}. Access denied for security.`,
      );
      console.error(error.message);
      throw error;
    }

    try {
      return !this.cache.isAllowed(agentId);
    } catch (error) {
      // SECURITY: Fail CLOSED - if we can't check ban status, deny access
      // This prevents banned players from accessing if ban check fails
      console.error(
        `[BanCheck] Error checking ban status for agent ${agentId}:`,
        error,
      );
      throw new Error(
        `[BanCheck] Failed to check ban status for agent ${agentId}. Access denied for security.`,
      );
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
 * 
 * SECURITY: If ban system is unavailable, access is DENIED (fail-closed).
 * This prevents banned players from bypassing bans if the system is down.
 */
export async function checkPlayerBan(
  agentId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
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
  } catch (error) {
    // SECURITY: Fail CLOSED - if ban system unavailable, deny access
    // This is a security-critical decision: better to deny legitimate players
    // than allow banned players to bypass the system
    console.error(
      `[BanCheck] Critical: Cannot verify ban status for agent ${agentId}. Access denied.`,
      error,
    );
    return {
      allowed: false,
      reason:
        "Ban verification system is unavailable. Access denied for security. Please contact support.",
    };
  }
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
