/**
 * MUD Client Setup for Hyperscape Hybrid Integration
 *
 * Connects the Hyperscape game engine to MUD smart contracts on Jeju L3.
 * Used for critical state operations (inventory, equipment, skills) while
 * keeping performance operations off-chain (movement, combat ticks).
 *
 * Architecture:
 * - Writes: Game actions → Blockchain transactions
 * - Reads: MUD Indexer GraphQL → Game UI
 * - Hybrid: Critical state on-chain, performance state off-chain
 *
 * Integration with Jeju Contracts:
 * - ERC-8004: Player identity via IdentityRegistry
 * - BanManager: Access control checks
 * - Gold.sol: Token economy
 * - Items.sol: NFT items
 * - GameIntegration.sol: Central hub
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain, getOptionalAddress, isBlockchainConfigured, type JejuNetwork } from "./chain";

/**
 * Create chain configuration dynamically based on detected chain info
 * Now uses the unified chain module for consistency
 */
function createChainConfig(
  chainId: number,
  chainName: string,
  rpcUrl: string,
): Chain {
  // Try to use the standard chain config first
  const network = detectNetworkFromChainId(chainId);
  if (network) {
    return getChain(network);
  }
  
  // Fallback for unknown chains
  return {
    id: chainId,
    name: chainName,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    testnet: true,
  };
}

/**
 * Detect network from chain ID
 */
function detectNetworkFromChainId(chainId: number): JejuNetwork | null {
  const mapping: Record<number, JejuNetwork> = {
    420691: "jeju",
    420690: "jeju-testnet",
    420692: "jeju-mainnet",
    31337: "anvil",
  };
  return mapping[chainId] || null;
}

/**
 * MUD Client instance type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MudClient = any; // Simplified due to deep viem type recursion

/**
 * Transaction receipt with typed logs
 */
export type TxReceipt = {
  transactionHash: string;
  blockNumber: bigint;
  status: "success" | "reverted";
  gasUsed: bigint;
  logs: readonly {
    address: Address;
    topics: readonly string[];
    data: string;
  }[];
};

/**
 * Set up MUD client for blockchain integration
 *
 * @param config - Optional configuration overrides
 * @returns MUD client with typed contract methods
 */
export async function setupMudClient(config?: {
  rpcUrl?: string;
  worldAddress?: Address;
  privateKey?: Address;
  chain?: Chain;
}) {
  // Smart RPC detection: prefer Jeju, fall back to Anvil
  const rpcUrl =
    config?.rpcUrl ||
    process.env.JEJU_RPC_URL ||
    process.env.RPC_URL ||
    process.env.ANVIL_RPC_URL ||
    "http://localhost:9545";

  // Detect chain ID from CHAIN_ID env var or infer from RPC URL
  const envChainId = process.env.CHAIN_ID
    ? parseInt(process.env.CHAIN_ID)
    : null;
  const inferredChainId = rpcUrl.includes(":8545") ? 31337 : 1337; // 8545=Anvil(31337), 9545=Jeju(1337)
  const chainId = envChainId || inferredChainId;
  const chainName = chainId === 31337 ? "Anvil" : "Jeju Localnet";

  let chain = config?.chain || createChainConfig(chainId, chainName, rpcUrl);

  if (!chain) {
    // Final fallback
    chain = createChainConfig(
      31337,
      "Anvil",
      rpcUrl || "http://localhost:8545",
    );
  }

  const worldAddress = (config?.worldAddress ||
    process.env.WORLD_ADDRESS) as Address;
  const privateKey = (config?.privateKey ||
    process.env.PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Address;

  if (!worldAddress) {
    throw new Error(
      "WORLD_ADDRESS environment variable not set. " +
        "Deploy contracts first: cd vendor/hyperscape/contracts-mud/mmo && npm run deploy:local",
    );
  }

  // Create clients (avoid type inference issues by using explicit parameters)
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  // Use IWorld ABI for all contract interactions
  // MUD combines all system ABIs into the World contract interface
  // We only need the specific functions we call, so define them inline
  const IWorldAbi = [
    // PlayerSystem
    {
      name: "hyperscape__register",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "name", type: "string" }],
      outputs: [],
    },
    {
      name: "hyperscape__isAlive",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "player", type: "address" }],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      name: "hyperscape__getPosition",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "player", type: "address" }],
      outputs: [
        { name: "x", type: "int32" },
        { name: "y", type: "int32" },
        { name: "z", type: "int32" },
      ],
    },
    // InventorySystem
    {
      name: "hyperscape__addItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "itemId", type: "uint16" },
        { name: "quantity", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "hyperscape__removeItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "slot", type: "uint8" },
        { name: "quantity", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "hyperscape__hasItem",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "player", type: "address" },
        { name: "itemId", type: "uint16" },
      ],
      outputs: [
        { name: "found", type: "bool" },
        { name: "quantity", type: "uint32" },
      ],
    },
    {
      name: "hyperscape__moveItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "fromSlot", type: "uint8" },
        { name: "toSlot", type: "uint8" },
      ],
      outputs: [],
    },
    {
      name: "hyperscape__getFreeSlots",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "player", type: "address" }],
      outputs: [{ name: "freeSlots", type: "uint8" }],
    },
    // EquipmentSystem
    {
      name: "hyperscape__equipItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "inventorySlot", type: "uint8" }],
      outputs: [],
    },
    {
      name: "hyperscape__unequipItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "equipSlot", type: "uint8" }],
      outputs: [],
    },
  ] as const;

  // Helper to get IWorld ABI
  function getSystemAbi(_name: string): readonly unknown[] {
    return IWorldAbi;
  }

  // Helper to send transaction and wait
  async function sendTransaction(
    functionName: string,
    args: readonly unknown[],
    abi: readonly unknown[],
  ): Promise<TxReceipt> {
    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi,
      functionName,
      args,
      chain,
      account,
    } as Parameters<typeof walletClient.writeContract>[0]);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: (log as { topics?: readonly string[] }).topics || [],
        data: log.data,
      })),
    };
  }

  // Helper to read from contract
  async function readContract(
    functionName: string,
    args: readonly unknown[],
    abi: readonly unknown[],
  ): Promise<unknown> {
    return publicClient.readContract({
      address: worldAddress,
      abi,
      functionName,
      args,
    } as Parameters<typeof publicClient.readContract>[0]);
  }

  return {
    publicClient,
    walletClient,
    worldAddress,
    account,
    chain,

    /**
     * PlayerSystem - Player registration and core stats
     */
    PlayerSystem: {
      /**
       * Register a new player on-chain
       * Triggers: Once per character creation
       * On-chain: ✅ Critical state (player identity)
       */
      register: async (name: string) => {
        const abi = getSystemAbi("PlayerSystem");
        return sendTransaction("hyperscape__register", [name], abi);
      },

      /**
       * Get player position from blockchain
       * Note: In hybrid mode, position is read from server (off-chain)
       * This is here for verification/debugging only
       */
      getPosition: async (playerAddress: Address) => {
        const abi = getSystemAbi("PlayerSystem");
        return readContract(
          "hyperscape__getPosition",
          [playerAddress],
          abi,
        ) as Promise<{
          x: number;
          y: number;
          z: number;
        }>;
      },

      /**
       * Check if player is alive
       * Hybrid: Health is on-chain, but checked locally for performance
       */
      isAlive: async (playerAddress: Address) => {
        const abi = getSystemAbi("PlayerSystem");
        return readContract(
          "hyperscape__isAlive",
          [playerAddress],
          abi,
        ) as Promise<boolean>;
      },
    },

    /**
     * InventorySystem - Item ownership (CRITICAL STATE - ON-CHAIN)
     */
    InventorySystem: {
      /**
       * Add item to player inventory
       * Triggers: When player picks up items, receives loot, buys from shop
       * On-chain: ✅ Critical state (item ownership)
       * Hybrid optimization: Batch multiple adds into one transaction
       */
      addItem: async (
        playerAddress: Address,
        itemId: number,
        quantity: number,
      ) => {
        const abi = getSystemAbi("InventorySystem");
        return sendTransaction(
          "hyperscape__addItem",
          [playerAddress, itemId, quantity],
          abi,
        );
      },

      /**
       * Remove item from inventory
       * Triggers: When player drops, uses, or sells items
       * On-chain: ✅ Critical state
       */
      removeItem: async (
        playerAddress: Address,
        slot: number,
        quantity: number,
      ) => {
        const abi = getSystemAbi("InventorySystem");
        return sendTransaction(
          "hyperscape__removeItem",
          [playerAddress, slot, quantity],
          abi,
        );
      },

      /**
       * Move item between inventory slots
       * Triggers: When player organizes inventory
       * On-chain: ✅ Critical state
       */
      moveItem: async (
        playerAddress: Address,
        fromSlot: number,
        toSlot: number,
      ) => {
        const abi = getSystemAbi("InventorySystem");
        return sendTransaction(
          "hyperscape__moveItem",
          [playerAddress, fromSlot, toSlot],
          abi,
        );
      },

      /**
       * Check if player has item (read-only)
       * Hybrid: Read from MUD indexer for performance
       */
      hasItem: async (playerAddress: Address, itemId: number) => {
        const abi = getSystemAbi("InventorySystem");
        return readContract(
          "hyperscape__hasItem",
          [playerAddress, itemId],
          abi,
        ) as Promise<{ found: boolean; quantity: number }>;
      },

      /**
       * Get free inventory slots (read-only)
       */
      getFreeSlots: async (playerAddress: Address) => {
        const abi = getSystemAbi("InventorySystem");
        return readContract(
          "hyperscape__getFreeSlots",
          [playerAddress],
          abi,
        ) as Promise<number>;
      },
    },

    /**
     * EquipmentSystem - Equipped items (CRITICAL STATE - ON-CHAIN)
     */
    EquipmentSystem: {
      /**
       * Equip item from inventory
       * Triggers: When player equips weapon, armor, etc.
       * On-chain: ✅ Critical state (equipped items affect stats)
       */
      equipItem: async (inventorySlot: number) => {
        const abi = getSystemAbi("EquipmentSystem");
        return sendTransaction("hyperscape__equipItem", [inventorySlot], abi);
      },

      /**
       * Unequip item to inventory
       * Triggers: When player unequips items
       * On-chain: ✅ Critical state
       */
      unequipItem: async (equipSlot: number) => {
        const abi = getSystemAbi("EquipmentSystem");
        return sendTransaction("hyperscape__unequipItem", [equipSlot], abi);
      },
    },

    /**
     * CombatSystem - Combat resolution (HYBRID)
     * Hybrid: Hits calculated off-chain, kills/loot on-chain
     */
    CombatSystem: {
      /**
       * Attack mob (kills and loot on-chain)
       * Triggers: When mob dies (not every hit)
       * On-chain: ✅ Critical state (loot drops, XP gains)
       * Hybrid: Individual hits calculated off-chain for performance
       */
      attackMob: async (mobId: Address) => {
        const abi = getSystemAbi("CombatSystem");
        return sendTransaction("hyperscape__attackMob", [mobId], abi);
      },
    },

    /**
     * ResourceSystem - Resource gathering (ON-CHAIN)
     */
    ResourceSystem: {
      /**
       * Chop tree for logs
       * Triggers: Successful woodcutting action
       * On-chain: ✅ Critical state (resource ownership)
       */
      chopTree: async (resourceId: Address) => {
        const abi = getSystemAbi("ResourceSystem");
        return sendTransaction("hyperscape__chopTree", [resourceId], abi);
      },

      /**
       * Fish at fishing spot
       * Triggers: Successful fishing action
       * On-chain: ✅ Critical state
       */
      fish: async (resourceId: Address) => {
        const abi = getSystemAbi("ResourceSystem");
        return sendTransaction("hyperscape__fish", [resourceId], abi);
      },
    },

    /**
     * SkillSystem - Skills and XP (CRITICAL STATE - ON-CHAIN)
     * Note: XP is granted via events from other systems
     */
    SkillSystem: {
      // Skills are updated automatically via combat/gathering events
      // No direct calls needed - read-only from MUD indexer
    },

    /**
     * Helper: Wait for transaction with timeout
     */
    waitForTransaction: async (
      hash: string,
      timeout = 30000,
    ): Promise<TxReceipt> => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as Address,
        timeout,
      });

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        gasUsed: receipt.gasUsed,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          topics: (log as { topics?: readonly string[] }).topics || [],
          data: log.data,
        })),
      };
    },

    /**
     * Helper: Get current block number
     */
    getBlockNumber: async (): Promise<bigint> => {
      return publicClient.getBlockNumber();
    },

    /**
     * Helper: Check if contracts are deployed
     */
    isDeployed: async (): Promise<boolean> => {
      const code = await publicClient.getCode({ address: worldAddress });
      return code !== undefined && code !== "0x";
    },
  };
}

/**
 * Inventory operation for batching
 */
export type InventoryOperation = {
  type: "add" | "remove" | "move";
  playerAddress: Address;
  itemId?: number;
  slot?: number;
  fromSlot?: number;
  toSlot?: number;
  quantity?: number;
};

/**
 * Batch multiple inventory operations into single multicall transaction
 * Reduces gas costs and improves UX by combining multiple operations atomically
 *
 * @param mudClient - MUD client instance
 * @param operations - Array of inventory operations
 * @returns Single transaction receipt for all operations
 */
export async function batchInventoryOperations(
  mudClient: MudClient,
  operations: InventoryOperation[],
): Promise<TxReceipt> {
  if (operations.length === 0) {
    throw new Error("No operations to batch");
  }

  // Single operation - no need for multicall
  if (operations.length === 1) {
    return executeSingleOperation(mudClient, operations[0]);
  }

  // Build multicall data for each operation
  const { encodeFunctionData } = await import("viem");

  const IWorldAbi = [
    {
      name: "hyperscape__addItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "itemId", type: "uint16" },
        { name: "quantity", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "hyperscape__removeItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "slot", type: "uint8" },
        { name: "quantity", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "hyperscape__moveItem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "player", type: "address" },
        { name: "fromSlot", type: "uint8" },
        { name: "toSlot", type: "uint8" },
      ],
      outputs: [],
    },
  ] as const;

  const calls: `0x${string}`[] = [];

  for (const op of operations) {
    if (op.type === "add" && op.itemId !== undefined && op.quantity !== undefined) {
      calls.push(
        encodeFunctionData({
          abi: IWorldAbi,
          functionName: "hyperscape__addItem",
          args: [op.playerAddress, op.itemId, op.quantity],
        }),
      );
    } else if (op.type === "remove" && op.slot !== undefined && op.quantity !== undefined) {
      calls.push(
        encodeFunctionData({
          abi: IWorldAbi,
          functionName: "hyperscape__removeItem",
          args: [op.playerAddress, op.slot, op.quantity],
        }),
      );
    } else if (op.type === "move" && op.fromSlot !== undefined && op.toSlot !== undefined) {
      calls.push(
        encodeFunctionData({
          abi: IWorldAbi,
          functionName: "hyperscape__moveItem",
          args: [op.playerAddress, op.fromSlot, op.toSlot],
        }),
      );
    } else {
      throw new Error(`Invalid operation parameters for type: ${op.type}`);
    }
  }

  // Execute via multicall on World contract
  const multicallAbi = [
    {
      name: "batchCall",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "data", type: "bytes[]" }],
      outputs: [{ name: "results", type: "bytes[]" }],
    },
  ] as const;

  const hash = await mudClient.walletClient.writeContract({
    address: mudClient.worldAddress,
    abi: multicallAbi,
    functionName: "batchCall",
    args: [calls],
    chain: mudClient.chain,
    account: mudClient.account,
  });

  const receipt = await mudClient.publicClient.waitForTransactionReceipt({ hash });

  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    logs: receipt.logs.map((log: { address: Address; topics?: readonly string[]; data: string }) => ({
      address: log.address,
      topics: log.topics || [],
      data: log.data,
    })),
  };
}

/**
 * Execute a single inventory operation
 */
async function executeSingleOperation(
  mudClient: MudClient,
  op: InventoryOperation,
): Promise<TxReceipt> {
  if (op.type === "add" && op.itemId !== undefined && op.quantity !== undefined) {
    return mudClient.InventorySystem.addItem(op.playerAddress, op.itemId, op.quantity);
  }
  if (op.type === "remove" && op.slot !== undefined && op.quantity !== undefined) {
    return mudClient.InventorySystem.removeItem(op.playerAddress, op.slot, op.quantity);
  }
  if (op.type === "move" && op.fromSlot !== undefined && op.toSlot !== undefined) {
    return mudClient.InventorySystem.moveItem(op.playerAddress, op.fromSlot, op.toSlot);
  }
  throw new Error(`Invalid operation parameters for type: ${op.type}`);
}

/**
 * Check if MUD client is configured and ready
 *
 * Only requires WORLD_ADDRESS - RPC URL is auto-detected:
 * 1. Prefers Jeju network (chain ID 420691 localnet, 901 testnet, 902 mainnet)
 * 2. Falls back to Anvil (chain ID 31337)
 * 3. Throws helpful error if neither available
 */
export function isMudClientAvailable(): boolean {
  return !!process.env.WORLD_ADDRESS;
}

/**
 * Get MUD client or throw helpful error
 */
export async function getMudClientOrThrow(
  errorContext?: string,
): Promise<MudClient> {
  if (!isMudClientAvailable()) {
    const context = errorContext ? ` (${errorContext})` : "";
    throw new Error(
      `MUD client not configured${context}. Set WORLD_ADDRESS environment variable. ` +
        `RPC will auto-detect (Jeju preferred, Anvil fallback).`,
    );
  }

  return setupMudClient();
}

// ============ Game System Integration ============

/**
 * Event types for game system integration
 */
export type MudEventType = 
  | "player_registered"
  | "item_added"
  | "item_removed"
  | "item_equipped"
  | "item_unequipped"
  | "mob_killed"
  | "resource_gathered"
  | "gold_claimed"
  | "item_minted";

export interface MudGameEvent {
  type: MudEventType;
  playerAddress: Address;
  txHash: string;
  blockNumber: bigint;
  data: Record<string, unknown>;
}

type MudEventHandler = (event: MudGameEvent) => void | Promise<void>;

const eventHandlers = new Map<MudEventType, Set<MudEventHandler>>();

/**
 * Subscribe to MUD game events
 * Allows game systems to react to on-chain state changes
 */
export function onMudEvent(eventType: MudEventType, handler: MudEventHandler): () => void {
  if (!eventHandlers.has(eventType)) {
    eventHandlers.set(eventType, new Set());
  }
  eventHandlers.get(eventType)!.add(handler);
  
  // Return unsubscribe function
  return () => {
    eventHandlers.get(eventType)?.delete(handler);
  };
}

/**
 * Emit a MUD game event (internal use)
 */
export async function emitMudEvent(event: MudGameEvent): Promise<void> {
  const handlers = eventHandlers.get(event.type);
  if (!handlers) return;
  
  for (const handler of handlers) {
    await handler(event);
  }
}

/**
 * Check if full blockchain integration is available
 * (MUD + ERC-8004 + BanManager + Economy contracts)
 */
export function isFullIntegrationAvailable(): boolean {
  return isMudClientAvailable() && isBlockchainConfigured();
}

/**
 * Get integration status for diagnostics
 */
export function getIntegrationStatus(): {
  mud: boolean;
  erc8004: boolean;
  banManager: boolean;
  economy: boolean;
  full: boolean;
} {
  return {
    mud: isMudClientAvailable(),
    erc8004: !!getOptionalAddress("IDENTITY_REGISTRY_ADDRESS"),
    banManager: !!getOptionalAddress("BAN_MANAGER_ADDRESS"),
    economy: !!getOptionalAddress("GOLD_ADDRESS") && !!getOptionalAddress("ITEMS_ADDRESS"),
    full: isFullIntegrationAvailable(),
  };
}
