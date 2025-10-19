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
 */

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Chain, type Address } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { RpcDetector } from '../../../../../../shared/rpcDetector';

/**
 * Create chain configuration dynamically based on detected chain info
 */
function createChainConfig(chainId: number, chainName: string, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainName,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    },
    testnet: true
  };
}

/**
 * MUD Client instance type
 */
export type MudClient = Awaited<ReturnType<typeof setupMudClient>>;

/**
 * Transaction receipt with typed logs
 */
export type TxReceipt = {
  transactionHash: string;
  blockNumber: bigint;
  status: 'success' | 'reverted';
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
  let rpcUrl = config?.rpcUrl || process.env.ANVIL_RPC_URL;
  let chain = config?.chain;
  
  if (!rpcUrl) {
    try {
      const chainInfo = await RpcDetector.getChainInfo();
      rpcUrl = chainInfo.rpcUrl;
      // Create chain config dynamically with the ACTUAL detected chain ID
      chain = createChainConfig(chainInfo.chainId, chainInfo.name, chainInfo.rpcUrl);
      console.log(`[MUD Client] Using ${chainInfo.name} (Chain ID: ${chainInfo.chainId})`);
    } catch (error) {
      console.warn(`[MUD Client] RPC detection failed, using default Anvil`);
      rpcUrl = 'http://localhost:8545';
      // Fallback to default Anvil config
      chain = createChainConfig(31337, 'Anvil', 'http://localhost:8545');
    }
  }
  
  if (!chain) {
    // Final fallback if somehow chain is still not set
    chain = createChainConfig(31337, 'Anvil', rpcUrl || 'http://localhost:8545');
  }
  
  const worldAddress = (config?.worldAddress || process.env.WORLD_ADDRESS) as Address;
  const privateKey = (config?.privateKey || process.env.PRIVATE_KEY || 
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Address;
  
  if (!worldAddress) {
    throw new Error(
      'WORLD_ADDRESS environment variable not set. ' +
      'Deploy contracts first: cd contracts/src/hyperscape && npm run deploy:local'
    );
  }
  
  // Create clients
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  }) as PublicClient;
  
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl)
  }) as WalletClient;
  
  // Load system ABIs from deployed contracts
  const systemsJson = await import(
    '../../../../../../contracts/src/hyperscape/.mud/local/systems.json'
  );
  
  const systems = systemsJson.default || systemsJson;
  
  // Helper to find system ABI
  function getSystemAbi(name: string) {
    const system = systems.systems.find((s: { name: string }) => s.name === name);
    if (!system) {
      throw new Error(`System ${name} not found in deployed contracts`);
    }
    return system.worldAbi;
  }
  
  // Helper to send transaction and wait
  async function sendTransaction(
    functionName: string,
    args: readonly unknown[],
    abi: readonly unknown[]
  ): Promise<TxReceipt> {
    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: abi as never,
      functionName,
      args: args as never,
      chain,
      account
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      logs: receipt.logs
    };
  }
  
  // Helper to read from contract
  async function readContract(
    functionName: string,
    args: readonly unknown[],
    abi: readonly unknown[]
  ): Promise<unknown> {
    return publicClient.readContract({
      address: worldAddress,
      abi: abi as never,
      functionName,
      args: args as never
    });
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
        const abi = getSystemAbi('PlayerSystem');
        return sendTransaction('hyperscape__register', [name], abi);
      },
      
      /**
       * Get player position from blockchain
       * Note: In hybrid mode, position is read from server (off-chain)
       * This is here for verification/debugging only
       */
      getPosition: async (playerAddress: Address) => {
        const abi = getSystemAbi('PlayerSystem');
        return readContract('hyperscape__getPosition', [playerAddress], abi) as Promise<{
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
        const abi = getSystemAbi('PlayerSystem');
        return readContract('hyperscape__isAlive', [playerAddress], abi) as Promise<boolean>;
      }
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
      addItem: async (playerAddress: Address, itemId: number, quantity: number) => {
        const abi = getSystemAbi('InventorySystem');
        return sendTransaction(
          'hyperscape__addItem',
          [playerAddress, itemId, quantity],
          abi
        );
      },
      
      /**
       * Remove item from inventory
       * Triggers: When player drops, uses, or sells items
       * On-chain: ✅ Critical state
       */
      removeItem: async (playerAddress: Address, slot: number, quantity: number) => {
        const abi = getSystemAbi('InventorySystem');
        return sendTransaction(
          'hyperscape__removeItem',
          [playerAddress, slot, quantity],
          abi
        );
      },
      
      /**
       * Move item between inventory slots
       * Triggers: When player organizes inventory
       * On-chain: ✅ Critical state
       */
      moveItem: async (playerAddress: Address, fromSlot: number, toSlot: number) => {
        const abi = getSystemAbi('InventorySystem');
        return sendTransaction(
          'hyperscape__moveItem',
          [playerAddress, fromSlot, toSlot],
          abi
        );
      },
      
      /**
       * Check if player has item (read-only)
       * Hybrid: Read from MUD indexer for performance
       */
      hasItem: async (playerAddress: Address, itemId: number) => {
        const abi = getSystemAbi('InventorySystem');
        return readContract(
          'hyperscape__hasItem',
          [playerAddress, itemId],
          abi
        ) as Promise<{ found: boolean; quantity: number }>;
      },
      
      /**
       * Get free inventory slots (read-only)
       */
      getFreeSlots: async (playerAddress: Address) => {
        const abi = getSystemAbi('InventorySystem');
        return readContract(
          'hyperscape__getFreeSlots',
          [playerAddress],
          abi
        ) as Promise<number>;
      }
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
        const abi = getSystemAbi('EquipmentSystem');
        return sendTransaction(
          'hyperscape__equipItem',
          [inventorySlot],
          abi
        );
      },
      
      /**
       * Unequip item to inventory
       * Triggers: When player unequips items
       * On-chain: ✅ Critical state
       */
      unequipItem: async (equipSlot: number) => {
        const abi = getSystemAbi('EquipmentSystem');
        return sendTransaction(
          'hyperscape__unequipItem',
          [equipSlot],
          abi
        );
      }
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
        const abi = getSystemAbi('CombatSystem');
        return sendTransaction(
          'hyperscape__attackMob',
          [mobId],
          abi
        );
      }
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
        const abi = getSystemAbi('ResourceSystem');
        return sendTransaction(
          'hyperscape__chopTree',
          [resourceId],
          abi
        );
      },
      
      /**
       * Fish at fishing spot
       * Triggers: Successful fishing action
       * On-chain: ✅ Critical state
       */
      fish: async (resourceId: Address) => {
        const abi = getSystemAbi('ResourceSystem');
        return sendTransaction(
          'hyperscape__fish',
          [resourceId],
          abi
        );
      }
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
    waitForTransaction: async (hash: string, timeout = 30000): Promise<TxReceipt> => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as Address,
        timeout
      });
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        gasUsed: receipt.gasUsed,
        logs: receipt.logs
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
      return code !== undefined && code !== '0x';
    }
  };
}

/**
 * Batch multiple inventory operations into single transaction
 * Reduces gas costs and improves UX
 * 
 * @param operations - Array of inventory operations
 * @returns Single transaction receipt
 */
export async function batchInventoryOperations(
  mudClient: MudClient,
  operations: Array<{
    type: 'add' | 'remove' | 'move';
    playerAddress: Address;
    itemId?: number;
    slot?: number;
    fromSlot?: number;
    toSlot?: number;
    quantity?: number;
  }>
): Promise<TxReceipt> {
  // TODO: Implement batched multicall
  // For now, execute sequentially
  const receipts: TxReceipt[] = [];
  
  for (const op of operations) {
    let receipt: TxReceipt;
    
    if (op.type === 'add' && op.itemId !== undefined && op.quantity !== undefined) {
      receipt = await mudClient.InventorySystem.addItem(
        op.playerAddress,
        op.itemId,
        op.quantity
      );
    } else if (op.type === 'remove' && op.slot !== undefined && op.quantity !== undefined) {
      receipt = await mudClient.InventorySystem.removeItem(
        op.playerAddress,
        op.slot,
        op.quantity
      );
    } else if (op.type === 'move' && op.fromSlot !== undefined && op.toSlot !== undefined) {
      receipt = await mudClient.InventorySystem.moveItem(
        op.playerAddress,
        op.fromSlot,
        op.toSlot
      );
    } else {
      throw new Error('Invalid operation parameters');
    }
    
    receipts.push(receipt);
  }
  
  // Return last receipt (TODO: return combined receipt)
  return receipts[receipts.length - 1];
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
export async function getMudClientOrThrow(errorContext?: string): Promise<MudClient> {
  if (!isMudClientAvailable()) {
    const context = errorContext ? ` (${errorContext})` : '';
    throw new Error(
      `MUD client not configured${context}. Set WORLD_ADDRESS environment variable. ` +
      `RPC will auto-detect (Jeju preferred, Anvil fallback).`
    );
  }
  
  return setupMudClient();
}

