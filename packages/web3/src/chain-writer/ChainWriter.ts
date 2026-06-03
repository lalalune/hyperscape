import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
  type Hex,
  type Address,
  encodeFunctionData,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type ChainConfig,
  resolveChainConfig,
  getChainName,
} from "../config/chains.js";
import { BatchWriter } from "../tx/BatchWriter.js";

/**
 * ChainWriter is the core service that bridges the game server to the blockchain.
 *
 * Architecture:
 * - The game server runs exactly as before (PostgreSQL, real-time WebSocket)
 * - ChainWriter listens for game events and writes to chain OPTIMISTICALLY
 * - The game does NOT wait for chain confirmation -- it continues immediately
 * - Chain writes are batched for gas efficiency via BatchWriter
 *
 * For P2P transactions (trades, duels), the flow is different:
 * - Players sign transactions directly via their Privy embedded wallets
 * - The server coordinates the flow but the chain is authoritative
 *
 * Lifecycle:
 * 1. Server starts, creates ChainWriter instance
 * 2. ChainWriter connects to chain, verifies World contract
 * 3. Game events trigger queueXxx() methods
 * 4. BatchWriter accumulates and flushes calls every ~2 seconds
 * 5. On server shutdown, ChainWriter flushes remaining writes
 */
export class ChainWriter {
  private chainConfig: ChainConfig;
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account>;
  private batchWriter: BatchWriter;
  private operatorAccount: Account;
  private worldAddress: Address;
  private isInitialized = false;

  constructor() {
    this.chainConfig = resolveChainConfig();
    this.worldAddress = this.chainConfig.worldAddress;

    // Create the operator account from private key
    const operatorKey =
      process.env.OPERATOR_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
    if (!operatorKey) {
      throw new Error(
        "[ChainWriter] OPERATOR_PRIVATE_KEY or PRIVATE_KEY environment variable required",
      );
    }
    this.operatorAccount = privateKeyToAccount(operatorKey as `0x${string}`);

    // Build transport with failover support
    // RPC_URLS can be comma-separated list of endpoints for redundancy
    const transport = this.buildTransportWithFailover();

    // Create viem clients with failover transport
    this.publicClient = createPublicClient({
      chain: this.chainConfig.chain,
      transport,
    });

    this.walletClient = createWalletClient({
      account: this.operatorAccount,
      chain: this.chainConfig.chain,
      transport,
    });

    this.batchWriter = new BatchWriter(this.walletClient, this.publicClient, {
      worldAddress: this.worldAddress,
      maxBatchSize: 15,
      maxBatchDelayMs: 2000,
      maxRetries: 3,
    });
  }

  /**
   * Build a transport with automatic failover across multiple RPC endpoints.
   * Uses RPC_URLS env var (comma-separated) or falls back to single rpcUrl from chain config.
   */
  private buildTransportWithFailover(): Transport {
    const rpcUrlsEnv = process.env.RPC_URLS;
    const primaryUrl = this.chainConfig.rpcUrl;

    // Parse comma-separated RPC URLs, filter empty strings
    const additionalUrls = rpcUrlsEnv
      ? rpcUrlsEnv
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean)
      : [];

    // Combine primary URL with additional URLs (primary first)
    const allUrls = [
      primaryUrl,
      ...additionalUrls.filter((url) => url !== primaryUrl),
    ];

    if (allUrls.length === 1) {
      // Single endpoint - no need for failover wrapper
      return http(allUrls[0]);
    }

    // Multiple endpoints - use viem's fallback transport
    // Automatically retries failed requests on next transport
    console.log(
      `[ChainWriter] Using ${allUrls.length} RPC endpoints with failover`,
    );

    return fallback(
      allUrls.map((url) =>
        http(url, {
          timeout: 10_000, // 10 second timeout per request
          retryCount: 1, // 1 retry per transport before failing over
        }),
      ),
      {
        rank: true, // Track which endpoints respond fastest
        retryCount: 3, // Total retries across all transports
      },
    );
  }

  /**
   * Initialize the chain writer. Verifies the World contract is accessible.
   */
  async initialize(): Promise<void> {
    const chainName = getChainName(this.chainConfig);
    console.log(`[ChainWriter] Initializing on ${chainName}`);
    console.log(`[ChainWriter] World address: ${this.worldAddress}`);
    console.log(`[ChainWriter] Operator: ${this.operatorAccount.address}`);

    // Verify the World contract exists
    const code = await this.publicClient.getCode({
      address: this.worldAddress,
    });
    if (!code || code === "0x") {
      throw new Error(
        `[ChainWriter] No contract found at World address ${this.worldAddress} on ${chainName}. ` +
          `Run 'mud deploy' first.`,
      );
    }

    // Check operator balance
    const balance = await this.publicClient.getBalance({
      address: this.operatorAccount.address,
    });
    console.log(`[ChainWriter] Operator balance: ${balance} wei`);

    if (balance === 0n && this.chainConfig.chain.id !== 31337) {
      console.warn(
        "[ChainWriter] WARNING: Operator has zero balance. Transactions will fail.",
      );
    }

    this.isInitialized = true;
    console.log(`[ChainWriter] Ready on ${chainName}`);
  }

  // =========================================================================
  // Player Registration
  // =========================================================================

  /**
   * Register a player on-chain after character creation.
   */
  queuePlayerRegistration(
    walletAddress: Address,
    characterUuid: string,
    playerName: string,
  ): void {
    const characterId = keccak256(stringToHex(characterUuid));

    const callData = encodeFunctionData({
      abi: PLAYER_REGISTRY_ABI,
      functionName: "hyperia__registerPlayer",
      args: [walletAddress, characterId, playerName],
    });

    this.batchWriter.queueCall(callData, `registerPlayer(${playerName})`);
  }

  // =========================================================================
  // Skills & Stats
  // =========================================================================

  /**
   * Queue a combat skills update after XP changes.
   */
  queueCombatSkillsUpdate(
    characterUuid: string,
    skills: {
      attackLevel: number;
      attackXp: number;
      strengthLevel: number;
      strengthXp: number;
      defenseLevel: number;
      defenseXp: number;
      constitutionLevel: number;
      constitutionXp: number;
      rangedLevel: number;
      rangedXp: number;
      magicLevel: number;
      magicXp: number;
      prayerLevel: number;
      prayerXp: number;
    },
  ): void {
    const characterId = keccak256(stringToHex(characterUuid));
    const levels = [
      skills.attackLevel,
      skills.strengthLevel,
      skills.defenseLevel,
      skills.constitutionLevel,
      skills.rangedLevel,
      skills.magicLevel,
      skills.prayerLevel,
    ] as const;
    const xps = [
      skills.attackXp,
      skills.strengthXp,
      skills.defenseXp,
      skills.constitutionXp,
      skills.rangedXp,
      skills.magicXp,
      skills.prayerXp,
    ] as const;

    const callData = encodeFunctionData({
      abi: SKILL_SYSTEM_ABI,
      functionName: "hyperia__updateCombatSkills",
      args: [characterId, levels, xps],
    });

    this.batchWriter.queueCall(
      callData,
      `updateCombatSkills(${characterUuid.slice(0, 8)})`,
    );
  }

  /**
   * Queue a gathering skills update.
   */
  queueGatheringSkillsUpdate(
    characterUuid: string,
    skills: {
      woodcuttingLevel: number;
      woodcuttingXp: number;
      miningLevel: number;
      miningXp: number;
      fishingLevel: number;
      fishingXp: number;
      firemakingLevel: number;
      firemakingXp: number;
      cookingLevel: number;
      cookingXp: number;
      smithingLevel: number;
      smithingXp: number;
      agilityLevel: number;
      agilityXp: number;
      craftingLevel: number;
      craftingXp: number;
      fletchingLevel: number;
      fletchingXp: number;
      runecraftingLevel: number;
      runecraftingXp: number;
    },
  ): void {
    const characterId = keccak256(stringToHex(characterUuid));
    const levels = [
      skills.woodcuttingLevel,
      skills.miningLevel,
      skills.fishingLevel,
      skills.firemakingLevel,
      skills.cookingLevel,
      skills.smithingLevel,
      skills.agilityLevel,
      skills.craftingLevel,
      skills.fletchingLevel,
      skills.runecraftingLevel,
    ] as const;
    const xps = [
      skills.woodcuttingXp,
      skills.miningXp,
      skills.fishingXp,
      skills.firemakingXp,
      skills.cookingXp,
      skills.smithingXp,
      skills.agilityXp,
      skills.craftingXp,
      skills.fletchingXp,
      skills.runecraftingXp,
    ] as const;

    const callData = encodeFunctionData({
      abi: SKILL_SYSTEM_ABI,
      functionName: "hyperia__updateGatheringSkills",
      args: [characterId, levels, xps],
    });

    this.batchWriter.queueCall(
      callData,
      `updateGatheringSkills(${characterUuid.slice(0, 8)})`,
    );
  }

  // =========================================================================
  // Inventory
  // =========================================================================

  /**
   * Queue inventory slot updates (delta only - changed slots).
   */
  queueInventoryUpdate(
    characterUuid: string,
    changedSlots: Array<{
      slotIndex: number;
      itemId: number;
      quantity: number;
    }>,
  ): void {
    if (changedSlots.length === 0) return;

    const characterId = keccak256(stringToHex(characterUuid));
    const slotIndices = changedSlots.map((s) => s.slotIndex);
    const itemIds = changedSlots.map((s) => s.itemId);
    const quantities = changedSlots.map((s) => s.quantity);

    const callData = encodeFunctionData({
      abi: INVENTORY_SYSTEM_ABI,
      functionName: "hyperia__setInventorySlotBatch",
      args: [characterId, slotIndices, itemIds, quantities],
    });

    this.batchWriter.queueCall(
      callData,
      `inventoryUpdate(${characterUuid.slice(0, 8)}, ${changedSlots.length} slots)`,
    );
  }

  /**
   * Queue gold balance update.
   */
  queueGoldUpdate(characterUuid: string, amount: number): void {
    const characterId = keccak256(stringToHex(characterUuid));

    const callData = encodeFunctionData({
      abi: INVENTORY_SYSTEM_ABI,
      functionName: "hyperia__setGold",
      args: [characterId, BigInt(amount)],
    });

    this.batchWriter.queueCall(
      callData,
      `setGold(${characterUuid.slice(0, 8)}, ${amount})`,
    );
  }

  // =========================================================================
  // Equipment
  // =========================================================================

  /**
   * Queue equipment slot updates.
   */
  queueEquipmentUpdate(
    characterUuid: string,
    changedSlots: Array<{ slotType: number; itemId: number; quantity: number }>,
  ): void {
    if (changedSlots.length === 0) return;

    const characterId = keccak256(stringToHex(characterUuid));
    const slotTypes = changedSlots.map((s) => s.slotType);
    const itemIds = changedSlots.map((s) => s.itemId);
    const quantities = changedSlots.map((s) => s.quantity);

    const callData = encodeFunctionData({
      abi: EQUIPMENT_SYSTEM_ABI,
      functionName: "hyperia__setEquipmentSlotBatch",
      args: [characterId, slotTypes, itemIds, quantities],
    });

    this.batchWriter.queueCall(
      callData,
      `equipmentUpdate(${characterUuid.slice(0, 8)}, ${changedSlots.length} slots)`,
    );
  }

  // =========================================================================
  // Stats
  // =========================================================================

  /**
   * Queue a mob kill record.
   */
  queueMobKill(
    characterUuid: string,
    npcStringId: string,
    isBoss: boolean,
  ): void {
    const characterId = keccak256(stringToHex(characterUuid));
    const npcId = keccak256(stringToHex(npcStringId));

    const callData = encodeFunctionData({
      abi: STATS_SYSTEM_ABI,
      functionName: "hyperia__recordMobKill",
      args: [characterId, npcId, isBoss],
    });

    this.batchWriter.queueCall(callData, `mobKill(${npcStringId})`);
  }

  /**
   * Queue a death record.
   */
  queueDeath(characterUuid: string): void {
    const characterId = keccak256(stringToHex(characterUuid));

    const callData = encodeFunctionData({
      abi: STATS_SYSTEM_ABI,
      functionName: "hyperia__recordDeath",
      args: [characterId],
    });

    this.batchWriter.queueCall(callData, `death(${characterUuid.slice(0, 8)})`);
  }

  // =========================================================================
  // Duels
  // =========================================================================

  /**
   * Queue a duel result to be recorded on-chain.
   * Updates DuelRecord table and PlayerStats (duelsWon/duelsLost).
   */
  queueDuelRecord(
    duelId: string,
    challengerAddress: Address,
    opponentAddress: Address,
    winnerAddress: Address,
    challengerCharacterUuid: string,
    opponentCharacterUuid: string,
    challengerStakeValue: number,
    opponentStakeValue: number,
    forfeit: boolean,
  ): void {
    const duelIdBytes = keccak256(stringToHex(duelId));
    const challengerCharId = keccak256(stringToHex(challengerCharacterUuid));
    const opponentCharId = keccak256(stringToHex(opponentCharacterUuid));

    const callData = encodeFunctionData({
      abi: DUEL_SYSTEM_ABI,
      functionName: "hyperia__recordDuel",
      args: [
        duelIdBytes,
        challengerAddress,
        opponentAddress,
        winnerAddress,
        challengerCharId,
        opponentCharId,
        BigInt(challengerStakeValue),
        BigInt(opponentStakeValue),
        forfeit,
      ],
    });

    this.batchWriter.queueCall(callData, `recordDuel(${duelId.slice(0, 8)})`);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Get batch writer statistics.
   */
  getStats(): ReturnType<BatchWriter["getStats"]> {
    return this.batchWriter.getStats();
  }

  /**
   * Force flush all pending writes.
   */
  async flush(): Promise<void> {
    await this.batchWriter.flush();
  }

  /**
   * Graceful shutdown - flush remaining writes.
   */
  async shutdown(): Promise<void> {
    console.log("[ChainWriter] Shutting down...");
    await this.batchWriter.shutdown();
    console.log("[ChainWriter] Shutdown complete.");
  }
}

// =========================================================================
// ABI fragments for system calls
// =========================================================================

const PLAYER_REGISTRY_ABI = [
  {
    name: "hyperia__registerPlayer",
    type: "function",
    inputs: [
      { name: "playerAddress", type: "address" },
      { name: "characterId", type: "bytes32" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
] as const;

const SKILL_SYSTEM_ABI = [
  {
    name: "hyperia__updateCombatSkills",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "levels", type: "uint16[7]" },
      { name: "xps", type: "uint32[7]" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__updateGatheringSkills",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "levels", type: "uint16[10]" },
      { name: "xps", type: "uint32[10]" },
    ],
    outputs: [],
  },
] as const;

const INVENTORY_SYSTEM_ABI = [
  {
    name: "hyperia__setInventorySlotBatch",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "slotIndices", type: "uint8[]" },
      { name: "itemIds", type: "uint32[]" },
      { name: "quantities", type: "uint32[]" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__setGold",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

const EQUIPMENT_SYSTEM_ABI = [
  {
    name: "hyperia__setEquipmentSlotBatch",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "slotTypes", type: "uint8[]" },
      { name: "itemIds", type: "uint32[]" },
      { name: "quantities", type: "uint32[]" },
    ],
    outputs: [],
  },
] as const;

const STATS_SYSTEM_ABI = [
  {
    name: "hyperia__recordMobKill",
    type: "function",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "npcId", type: "bytes32" },
      { name: "isBoss", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__recordDeath",
    type: "function",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [],
  },
] as const;

const DUEL_SYSTEM_ABI = [
  {
    name: "hyperia__recordDuel",
    type: "function",
    inputs: [
      { name: "duelId", type: "bytes32" },
      { name: "challengerAddress", type: "address" },
      { name: "opponentAddress", type: "address" },
      { name: "winnerAddress", type: "address" },
      { name: "challengerCharId", type: "bytes32" },
      { name: "opponentCharId", type: "bytes32" },
      { name: "challengerStakeValue", type: "uint64" },
      { name: "opponentStakeValue", type: "uint64" },
      { name: "forfeit", type: "bool" },
    ],
    outputs: [],
  },
] as const;
