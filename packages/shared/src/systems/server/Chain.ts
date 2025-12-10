/**
 * Chain.ts - Unified on-chain integration for Hyperscape
 *
 * Single system that handles all blockchain interactions:
 * - Player bans (ERC-8004 BanManager)
 * - Gold token bridge (Gold.sol)
 * - Item NFT bridge (Items.sol)
 * - Oracle event publishing (HyperscapeOracle)
 * - NFT burn → item drop listening
 * - x402 payment verification
 */

import type { Address } from "viem";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import type { World } from "../../types";
import { EventType } from "../../types/events";
import {
  checkPlayerAccess,
  isBlockchainConfigured,
  getGoldBalance,
  signGoldClaim,
  signItemMint,
  getGoldClaimNonce,
  generateInstanceId,
  watchItemBurns,
  watchGoldClaims,
  getOptionalAddress,
  type JejuNetwork,
  type AccessCheckResult,
} from "../../blockchain";

export interface ChainConfig {
  serverPrivateKey?: `0x${string}`;
  network?: JejuNetwork;
  enforceBans?: boolean;
  enableGoldBridge?: boolean;
  enableItemBridge?: boolean;
  enableOracle?: boolean;
  oracleAddress?: Address;
  /** If true, fail-fast when blockchain is required but not configured */
  strictMode?: boolean;
  /** Oracle retry configuration */
  oracleRetry?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}

interface Player {
  id: string;
  coins?: number;
  walletAddress?: string;
  position?: { x: number; y: number; z: number };
}

interface OracleClient {
  publishSkillLevelUp(player: Address, skill: string, level: number, xp: number): Promise<void>;
  publishPlayerDeath(player: Address, killer: Address, location: string): Promise<void>;
  publishPlayerKill(killer: Address, victim: Address, method: string): Promise<void>;
}

interface QueuedOracleEvent {
  id: string;
  type: "skill" | "death" | "kill";
  data: unknown[];
  retries: number;
  nextRetryAt: number;
  createdAt: number;
}

/**
 * Chain - unified blockchain system with production-grade reliability
 */
export class Chain extends SystemBase {
  private config: ChainConfig;
  private isConfigured = false;
  private oracle: OracleClient | null = null;
  private unwatchBurns: (() => void) | null = null;
  private unwatchClaims: (() => void) | null = null;

  // Oracle event queue with retry
  private oracleQueue: QueuedOracleEvent[] = [];
  private oracleProcessing = false;
  private oracleQueueInterval: ReturnType<typeof setInterval> | null = null;
  private eventCounter = 0;

  // Retry config defaults
  private readonly DEFAULT_MAX_RETRIES = 5;
  private readonly DEFAULT_BASE_DELAY_MS = 1000;
  private readonly DEFAULT_MAX_DELAY_MS = 30000;

  constructor(world: World, config: ChainConfig = {}) {
    super(world, {
      name: "blockchain",
      dependencies: {
        optional: ["player", "inventory", "banking"],
      },
      autoCleanup: true,
    });

    this.config = {
      enforceBans: true,
      enableGoldBridge: true,
      enableItemBridge: true,
      enableOracle: false,
      strictMode: false,
      oracleRetry: {
        maxRetries: this.DEFAULT_MAX_RETRIES,
        baseDelayMs: this.DEFAULT_BASE_DELAY_MS,
        maxDelayMs: this.DEFAULT_MAX_DELAY_MS,
      },
      ...config,
    };
  }

  async init(): Promise<void> {
    this.isConfigured = isBlockchainConfigured();

    // Strict mode: fail if blockchain is required but not configured
    if (this.config.strictMode && !this.isConfigured) {
      throw new Error(
        "Chain: strictMode enabled but blockchain not configured. " +
        "Set RPC_URL and contract addresses, or disable strictMode."
      );
    }

    // Always subscribe to game events so users get feedback even when offline
    this.subscribeToGameEvents();

    if (!this.isConfigured) {
      this.logger.info("Chain offline - game running without blockchain");
      return;
    }

    const goldAddr = getOptionalAddress("GOLD_ADDRESS");
    const itemsAddr = getOptionalAddress("ITEMS_ADDRESS");
    this.logger.info("Chain initialized", {
      network: this.config.network || "localnet",
      gold: goldAddr ? "✓" : "✗",
      items: itemsAddr ? "✓" : "✗",
      bans: this.config.enforceBans,
      strictMode: this.config.strictMode,
    });

    // On-chain event watchers with proper error propagation in strict mode
    try {
      await this.startEventWatchers();
    } catch (e) {
      if (this.config.strictMode) {
        throw new Error(`Chain: Event watchers failed in strictMode: ${e}`);
      }
      this.logger.warn("Event watchers failed to start", { error: String(e) });
    }

    // Oracle for prediction markets (optional)
    if (this.config.enableOracle && this.config.oracleAddress) {
      try {
        await this.initOracle();
        // Start the oracle queue processor
        this.startOracleQueueProcessor();
      } catch (e) {
        if (this.config.strictMode) {
          throw new Error(`Chain: Oracle init failed in strictMode: ${e}`);
        }
        this.logger.warn("Oracle failed to initialize", { error: String(e) });
      }
    }
  }

  private subscribeToGameEvents(): void {
    this.subscribe(EventType.PLAYER_JOINED, (data) => {
      this.onPlayerJoin(data as { playerId: string; walletAddress?: string });
    });

    this.subscribe(EventType.GOLD_WITHDRAW_REQUEST, (data) => {
      this.onGoldWithdraw(
        data as { playerId: string; amount: number; walletAddress: string }
      );
    });

    this.subscribe(EventType.GOLD_DEPOSIT_CONFIRMED, (data) => {
      this.onGoldDeposit(
        data as { playerId: string; amount: bigint; txHash: string }
      );
    });

    this.subscribe(EventType.ITEM_MINT_REQUEST, (data) => {
      this.onItemMint(
        data as {
          playerId: string;
          itemId: string;
          quantity: number;
          walletAddress: string;
        }
      );
    });

    // Oracle events (skill/death/kill)
    if (this.config.enableOracle) {
      this.subscribeToOracleEvents();
    }
  }

  private subscribeToOracleEvents(): void {
    this.subscribe(EventType.SKILL_LEVEL_UP, (data) => {
      const event = data as {
        player?: Player;
        skill?: string;
        newLevel?: number;
        totalXp?: number;
      };
      if (event.player?.walletAddress && event.skill && event.newLevel) {
        this.publishSkillUp(
          event.player.walletAddress as Address,
          event.skill,
          event.newLevel,
          event.totalXp || 0
        );
      }
    });

    this.subscribe(EventType.ENTITY_DEATH, (data) => {
      const event = data as {
        entityType?: string;
        playerAddress?: string;
        killerAddress?: string;
        location?: string;
      };
      if (event.entityType === "player" && event.playerAddress) {
        this.publishDeath(
          event.playerAddress as Address,
          (event.killerAddress as Address) || "0x0000000000000000000000000000000000000000",
          event.location || "unknown"
        );
      }
    });

    this.subscribe(EventType.PLAYER_KILL, (data) => {
      const event = data as {
        killer?: string;
        victim?: string;
        method?: string;
      };
      if (event.killer?.startsWith("0x") && event.victim?.startsWith("0x")) {
        this.publishKill(
          event.killer as Address,
          event.victim as Address,
          event.method || "combat"
        );
      }
    });
  }

  private async startEventWatchers(): Promise<void> {
    const errors: Error[] = [];

    // Watch for NFT burns → spawn items in world
    if (this.config.enableItemBridge) {
      try {
        this.unwatchBurns = await watchItemBurns(
          (player, itemId, amount, txHash) => {
            this.logger.info("NFT burned, spawning item", {
              player,
              itemId: itemId.toString(),
              amount: amount.toString(),
              tx: txHash.slice(0, 10),
            });

            this.emitTypedEvent(EventType.ITEM_SPAWN_REQUEST, {
              itemId: itemId.toString(),
              quantity: Number(amount),
              source: "nft_burn",
              txHash,
            });
          },
          this.config.network
        );
        this.logger.info("Item burn watcher started");
      } catch (e) {
        const err = new Error(`Item burn watcher failed: ${e}`);
        errors.push(err);
        this.logger.warn("Failed to watch item burns", { error: String(e) });
      }
    }

    // Watch for gold claims → verify withdrawals completed
    if (this.config.enableGoldBridge) {
      try {
        this.unwatchClaims = await watchGoldClaims(
          (player, amount, nonce, txHash) => {
            this.logger.info("Gold claimed on-chain", {
              player,
              amount: amount.toString(),
              nonce: nonce.toString(),
              tx: txHash.slice(0, 10),
            });
          },
          this.config.network
        );
        this.logger.info("Gold claim watcher started");
      } catch (e) {
        const err = new Error(`Gold claim watcher failed: ${e}`);
        errors.push(err);
        this.logger.warn("Failed to watch gold claims", { error: String(e) });
      }
    }

    // In strict mode, throw if any watcher failed
    if (this.config.strictMode && errors.length > 0) {
      throw new Error(`Event watchers failed: ${errors.map(e => e.message).join("; ")}`);
    }
  }

  private async initOracle(): Promise<void> {
    if (!this.config.oracleAddress || !this.config.serverPrivateKey) {
      this.logger.warn("Oracle disabled - missing address or private key");
      return;
    }

    // Lazy import to avoid circular deps
    const { createPublicClient, createWalletClient, http, parseAbi } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");
    const { getChain } = await import("../../blockchain/chain");

    const chain = getChain(this.config.network);
    const account = privateKeyToAccount(this.config.serverPrivateKey);

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const oracleAbi = parseAbi([
      "function publishSkillLevelUp(address player, string skillName, uint8 newLevel, uint256 totalXp) external",
      "function publishPlayerDeath(address player, address killer, string location) external",
      "function publishPlayerKill(address killer, address victim, string method) external",
    ]);

    this.oracle = {
      publishSkillLevelUp: async (player, skill, level, xp) => {
        const hash = await walletClient.writeContract({
          address: this.config.oracleAddress!,
          abi: oracleAbi,
          functionName: "publishSkillLevelUp",
          args: [player, skill, level, BigInt(xp)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
      publishPlayerDeath: async (player, killer, location) => {
        const hash = await walletClient.writeContract({
          address: this.config.oracleAddress!,
          abi: oracleAbi,
          functionName: "publishPlayerDeath",
          args: [player, killer, location],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
      publishPlayerKill: async (killer, victim, method) => {
        const hash = await walletClient.writeContract({
          address: this.config.oracleAddress!,
          abi: oracleAbi,
          functionName: "publishPlayerKill",
          args: [killer, victim, method],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
    };

    this.logger.info("Oracle initialized", { address: this.config.oracleAddress });
  }

  // ============ Ban Checking ============

  private async onPlayerJoin(data: {
    playerId: string;
    walletAddress?: string;
  }): Promise<void> {
    if (!this.isConfigured || !data.walletAddress) return;

    const result = await this.checkBan(data.walletAddress as Address);

    if (!result.allowed) {
      this.logger.warn("Banned player", {
        playerId: data.playerId,
        reason: result.reason,
      });

      if (this.config.enforceBans) {
        this.emitTypedEvent(EventType.PLAYER_KICK, {
          playerId: data.playerId,
          reason: result.reason || "Banned",
        });
      }
    }
  }

  async checkBan(wallet: Address): Promise<AccessCheckResult> {
    if (!this.isConfigured) return { allowed: true };
    return checkPlayerAccess(wallet);
  }

  // ============ Gold Bridge ============

  private async onGoldWithdraw(data: {
    playerId: string;
    amount: number;
    walletAddress: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      this.notify(data.playerId, "Blockchain offline - withdrawals unavailable", "error");
      return;
    }

    if (!this.config.enableGoldBridge) {
      this.notify(data.playerId, "Gold withdrawals disabled", "error");
      return;
    }

    if (!this.config.serverPrivateKey) {
      this.logger.error("No server key for withdrawal");
      return;
    }

    const player = this.world.getPlayer?.(data.playerId) as Player | undefined;
    if (!player || (player.coins || 0) < data.amount) {
      this.notify(data.playerId, "Insufficient gold", "error");
      return;
    }

    // Deduct in-game gold
    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId: data.playerId,
      newAmount: (player.coins || 0) - data.amount,
      reason: "withdrawal",
    });

    // Sign claim for player to submit
    const wallet = data.walletAddress as Address;
    const amount = BigInt(data.amount);
    const nonce = await getGoldClaimNonce(wallet);
    const signature = await signGoldClaim(wallet, amount, nonce, this.config.serverPrivateKey);

    this.emitTypedEvent(EventType.GOLD_WITHDRAW_SUCCESS, {
      playerId: data.playerId,
      amount: data.amount,
      signature,
      nonce: nonce.toString(),
    });

    this.notify(data.playerId, "Withdrawal ready - confirm in wallet", "info");
  }

  private onGoldDeposit(data: {
    playerId: string;
    amount: bigint;
    txHash: string;
  }): void {
    const player = this.world.getPlayer?.(data.playerId) as Player | undefined;
    if (!player) {
      this.logger.warn("Player not found for deposit", { txHash: data.txHash });
      return;
    }

    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId: data.playerId,
      newAmount: (player.coins || 0) + Number(data.amount),
      reason: "deposit",
    });

    this.notify(data.playerId, `+${data.amount} GOLD deposited`, "success");
  }

  async getOnChainGold(wallet: Address): Promise<bigint> {
    if (!this.isConfigured) return 0n;
    return getGoldBalance(wallet);
  }

  // ============ Item Bridge ============

  private async onItemMint(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    walletAddress: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      this.notify(data.playerId, "Blockchain offline - minting unavailable", "error");
      return;
    }

    if (!this.config.enableItemBridge) {
      this.notify(data.playerId, "Item minting disabled", "error");
      return;
    }

    if (!this.config.serverPrivateKey) {
      this.logger.error("No server key for minting");
      return;
    }

    // Verify player has item (via callback)
    this.emitTypedEvent(EventType.INVENTORY_CHECK, {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: data.quantity,
      callback: async (hasItem: boolean) => {
        if (!hasItem) {
          this.notify(data.playerId, "Item not found", "error");
          return;
        }

        // Remove from inventory
        this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
          playerId: data.playerId,
          itemId: data.itemId,
          quantity: data.quantity,
        });

        // Sign mint
        const wallet = data.walletAddress as Address;
        const itemId = BigInt(this.hashString(data.itemId));
        const amount = BigInt(data.quantity);
        const instanceId = generateInstanceId(wallet, itemId, BigInt(Date.now()));

        const signature = await signItemMint(
          wallet,
          itemId,
          amount,
          instanceId,
          this.config.serverPrivateKey!
        );

        this.emitTypedEvent(EventType.ITEM_MINT_SUCCESS, {
          playerId: data.playerId,
          itemId: data.itemId,
          quantity: data.quantity,
          tokenId: itemId.toString(),
          instanceId,
          signature,
        });

        this.notify(data.playerId, "Mint ready - confirm in wallet", "info");
      },
    });
  }

  // ============ Oracle Publishing with Queue ============

  private queueOracleEvent(type: "skill" | "death" | "kill", data: unknown[]): void {
    if (!this.oracle) return;

    const event: QueuedOracleEvent = {
      id: `${type}-${++this.eventCounter}-${Date.now()}`,
      type,
      data,
      retries: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };

    this.oracleQueue.push(event);
    this.logger.debug("Oracle event queued", { id: event.id, type, queueSize: this.oracleQueue.length });
  }

  private startOracleQueueProcessor(): void {
    // Process queue every second
    this.oracleQueueInterval = setInterval(() => {
      this.processOracleQueue();
    }, 1000);
  }

  private async processOracleQueue(): Promise<void> {
    if (this.oracleProcessing || this.oracleQueue.length === 0 || !this.oracle) return;

    this.oracleProcessing = true;
    const now = Date.now();

    // Find events ready to process
    const readyEvents = this.oracleQueue.filter(e => e.nextRetryAt <= now);

    for (const event of readyEvents) {
      try {
        await this.executeOracleEvent(event);
        // Success - remove from queue
        this.oracleQueue = this.oracleQueue.filter(e => e.id !== event.id);
        this.logger.debug("Oracle event published", { id: event.id, type: event.type });
      } catch (e) {
        event.retries++;
        const maxRetries = this.config.oracleRetry?.maxRetries ?? this.DEFAULT_MAX_RETRIES;

        if (event.retries >= maxRetries) {
          // Max retries exceeded - drop event and log
          this.oracleQueue = this.oracleQueue.filter(ev => ev.id !== event.id);
          this.logger.error("Oracle event failed permanently", {
            id: event.id,
            type: event.type,
            retries: event.retries,
            error: String(e),
          });
        } else {
          // Calculate exponential backoff with jitter
          const baseDelay = this.config.oracleRetry?.baseDelayMs ?? this.DEFAULT_BASE_DELAY_MS;
          const maxDelay = this.config.oracleRetry?.maxDelayMs ?? this.DEFAULT_MAX_DELAY_MS;
          const delay = Math.min(baseDelay * Math.pow(2, event.retries) + Math.random() * 500, maxDelay);
          event.nextRetryAt = now + delay;
          this.logger.warn("Oracle event retry scheduled", {
            id: event.id,
            type: event.type,
            retryIn: delay,
            attempt: event.retries,
          });
        }
      }
    }

    this.oracleProcessing = false;
  }

  private async executeOracleEvent(event: QueuedOracleEvent): Promise<void> {
    if (!this.oracle) throw new Error("Oracle not initialized");

    switch (event.type) {
      case "skill": {
        const [player, skill, level, xp] = event.data as [Address, string, number, number];
        await this.oracle.publishSkillLevelUp(player, skill, level, xp);
        break;
      }
      case "death": {
        const [player, killer, location] = event.data as [Address, Address, string];
        await this.oracle.publishPlayerDeath(player, killer, location);
        break;
      }
      case "kill": {
        const [killer, victim, method] = event.data as [Address, Address, string];
        await this.oracle.publishPlayerKill(killer, victim, method);
        break;
      }
    }
  }

  private publishSkillUp(player: Address, skill: string, level: number, xp: number): void {
    this.queueOracleEvent("skill", [player, skill, level, xp]);
  }

  private publishDeath(player: Address, killer: Address, location: string): void {
    this.queueOracleEvent("death", [player, killer, location]);
  }

  private publishKill(killer: Address, victim: Address, method: string): void {
    this.queueOracleEvent("kill", [killer, victim, method]);
  }

  /**
   * Get oracle queue status for monitoring
   */
  getOracleQueueStatus(): { pending: number; oldestEventAge: number | null } {
    if (this.oracleQueue.length === 0) {
      return { pending: 0, oldestEventAge: null };
    }
    const oldest = Math.min(...this.oracleQueue.map(e => e.createdAt));
    return {
      pending: this.oracleQueue.length,
      oldestEventAge: Date.now() - oldest,
    };
  }

  // ============ Utils ============

  private notify(playerId: string, message: string, type: "info" | "error" | "success"): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, { playerId, message, type });
  }

  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  getStatus(): {
    configured: boolean;
    network: JejuNetwork | undefined;
    features: { bans: boolean; goldBridge: boolean; itemBridge: boolean; oracle: boolean };
  } {
    return {
      configured: this.isConfigured,
      network: this.config.network,
      features: {
        bans: this.config.enforceBans ?? false,
        goldBridge: this.config.enableGoldBridge ?? false,
        itemBridge: this.config.enableItemBridge ?? false,
        oracle: !!this.oracle,
      },
    };
  }

  destroy(): void {
    this.unwatchBurns?.();
    this.unwatchClaims?.();
    if (this.oracleQueueInterval) {
      clearInterval(this.oracleQueueInterval);
      this.oracleQueueInterval = null;
    }
    // Log any pending oracle events that won't be processed
    if (this.oracleQueue.length > 0) {
      this.logger.warn("Chain destroyed with pending oracle events", {
        pending: this.oracleQueue.length,
      });
    }
  }
}

// Backwards compat
export { Chain as BlockchainIntegration };
export type { ChainConfig as BlockchainConfig };
