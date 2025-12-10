/**
 * Game Economy Integration for Hyperscape
 * 
 * Connects game systems to on-chain Gold.sol and Items.sol contracts:
 * - Gold: ERC-20 in-game currency with signature-based minting
 * - Items: ERC-1155 game items with provenance tracking
 * 
 * This module handles the bridge between off-chain game state and on-chain assets.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  encodePacked,
  type Address,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { getChain, getOptionalAddress, type JejuNetwork } from "./chain";

// ============ Contract ABIs ============

const GOLD_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function claimGold(uint256 amount, uint256 nonce, bytes signature) external",
  "function burn(uint256 amount) external",
  "function burnFrom(address from, uint256 amount) external",
  "function getNonce(address player) view returns (uint256)",
  "function verifyClaim(address player, uint256 amount, uint256 nonce, bytes signature) view returns (bool)",
  "function gameAgentId() view returns (uint256)",
  "function gameSigner() view returns (address)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event GoldClaimed(address indexed player, uint256 amount, uint256 nonce)",
  "event GoldBurned(address indexed player, uint256 amount)",
]);

const ITEMS_ABI = parseAbi([
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function mintItem(uint256 itemId, uint256 amount, bytes32 instanceId, bytes signature) external",
  "function burn(address account, uint256 id, uint256 amount) external",
  "function getItemMetadata(uint256 itemId) view returns ((uint256 itemId, string name, bool stackable, int16 attack, int16 defense, int16 strength, uint8 rarity))",
  "function getMintedMetadata(address owner, uint256 itemId) view returns ((address originalMinter, uint256 mintedAt, bytes32 instanceId))",
  "function getInstanceMinter(bytes32 instanceId) view returns (address)",
  "function checkInstance(bytes32 instanceId) view returns (bool minted, address originalMinter)",
  "function verifyMint(address player, uint256 itemId, uint256 amount, bytes32 instanceId, bytes signature) view returns (bool)",
  "function gameAgentId() view returns (uint256)",
  "function gameSigner() view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "event ItemMinted(address indexed minter, uint256 indexed itemId, uint256 amount, bytes32 instanceId, bool stackable, uint8 rarity)",
  "event ItemBurned(address indexed player, uint256 indexed itemId, uint256 amount)",
]);

// ============ Types ============

export interface ItemMetadata {
  itemId: bigint;
  name: string;
  stackable: boolean;
  attack: number;
  defense: number;
  strength: number;
  rarity: number;
}

export interface MintedItemInfo {
  originalMinter: Address;
  mintedAt: bigint;
  instanceId: `0x${string}`;
}

export interface GoldClaimParams {
  playerAddress: Address;
  amount: bigint;
  nonce: bigint;
  signature: `0x${string}`;
}

export interface ItemMintParams {
  playerAddress: Address;
  itemId: bigint;
  amount: bigint;
  instanceId: `0x${string}`;
  signature: `0x${string}`;
}

export interface GameSignerConfig {
  privateKey: `0x${string}`;
}

// ============ Client Management ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publicClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let walletClient: any = null;
let signerAccount: PrivateKeyAccount | null = null;

function getClient(network?: JejuNetwork) {
  if (!publicClient) {
    const chain = getChain(network);
    publicClient = createPublicClient({
      chain,
      transport: http(),
    });
  }
  return publicClient;
}

function getWalletClient(privateKey: `0x${string}`, network?: JejuNetwork) {
  const chain = getChain(network);
  signerAccount = privateKeyToAccount(privateKey);
  walletClient = createWalletClient({
    account: signerAccount,
    chain,
    transport: http(),
  });
  return walletClient;
}

function getGoldAddress(): Address {
  const address = getOptionalAddress("GOLD_ADDRESS");
  if (!address) {
    throw new Error("GOLD_ADDRESS not configured. Set the environment variable to enable Gold integration.");
  }
  return address;
}

function getItemsAddress(): Address {
  const address = getOptionalAddress("ITEMS_ADDRESS");
  if (!address) {
    throw new Error("ITEMS_ADDRESS not configured. Set the environment variable to enable Items integration.");
  }
  return address;
}

// ============ Gold Functions ============

/**
 * Get player's gold balance
 */
export async function getGoldBalance(playerAddress: Address): Promise<bigint> {
  const client = getClient();
  const goldAddress = getGoldAddress();

  const balance = await client.readContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "balanceOf",
    args: [playerAddress],
  });

  return balance as bigint;
}

/**
 * Get player's next claim nonce
 */
export async function getGoldClaimNonce(playerAddress: Address): Promise<bigint> {
  const client = getClient();
  const goldAddress = getGoldAddress();

  const nonce = await client.readContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "getNonce",
    args: [playerAddress],
  });

  return nonce as bigint;
}

/**
 * Verify a gold claim signature (off-chain check before submission)
 */
export async function verifyGoldClaim(
  playerAddress: Address,
  amount: bigint,
  nonce: bigint,
  signature: `0x${string}`
): Promise<boolean> {
  const client = getClient();
  const goldAddress = getGoldAddress();

  const valid = await client.readContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "verifyClaim",
    args: [playerAddress, amount, nonce, signature],
  });

  return valid as boolean;
}

/**
 * Sign a gold claim for a player (game server function)
 */
export async function signGoldClaim(
  playerAddress: Address,
  amount: bigint,
  nonce: bigint,
  signerPrivateKey: `0x${string}`
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(signerPrivateKey);
  
  const { keccak256, encodePacked, toBytes } = await import("viem");
  
  const messageHash = keccak256(
    encodePacked(
      ["address", "uint256", "uint256"],
      [playerAddress, amount, nonce]
    )
  );

  const signature = await account.signMessage({
    message: { raw: toBytes(messageHash) },
  });

  return signature;
}

/**
 * Claim gold on-chain (player calls this)
 */
export async function claimGold(
  params: GoldClaimParams,
  playerPrivateKey: `0x${string}`,
  network?: JejuNetwork
): Promise<`0x${string}`> {
  const wallet = getWalletClient(playerPrivateKey, network);
  const goldAddress = getGoldAddress();
  const chain = getChain(network);

  const hash = await wallet.writeContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "claimGold",
    args: [params.amount, params.nonce, params.signature],
    chain,
    account: signerAccount!,
  });

  return hash;
}

/**
 * Burn gold (for in-game purchases)
 */
export async function burnGold(
  amount: bigint,
  playerPrivateKey: `0x${string}`,
  network?: JejuNetwork
): Promise<`0x${string}`> {
  const wallet = getWalletClient(playerPrivateKey, network);
  const goldAddress = getGoldAddress();
  const chain = getChain(network);

  const hash = await wallet.writeContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "burn",
    args: [amount],
    chain,
    account: signerAccount!,
  });

  return hash;
}

// ============ Items Functions ============

/**
 * Get player's item balance
 */
export async function getItemBalance(playerAddress: Address, itemId: bigint): Promise<bigint> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const balance = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "balanceOf",
    args: [playerAddress, itemId],
  });

  return balance as bigint;
}

/**
 * Get multiple item balances at once
 */
export async function getItemBalances(
  playerAddress: Address,
  itemIds: bigint[]
): Promise<bigint[]> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const accounts = itemIds.map(() => playerAddress);

  const balances = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "balanceOfBatch",
    args: [accounts, itemIds],
  });

  return balances as bigint[];
}

/**
 * Get item type metadata
 */
export async function getItemMetadata(itemId: bigint): Promise<ItemMetadata> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const result = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "getItemMetadata",
    args: [itemId],
  });

  const [id, name, stackable, attack, defense, strength, rarity] = result as [
    bigint, string, boolean, number, number, number, number
  ];

  return { itemId: id, name, stackable, attack, defense, strength, rarity };
}

/**
 * Get minted item provenance info
 */
export async function getMintedItemInfo(
  ownerAddress: Address,
  itemId: bigint
): Promise<MintedItemInfo> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const result = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "getMintedMetadata",
    args: [ownerAddress, itemId],
  });

  const [originalMinter, mintedAt, instanceId] = result as [Address, bigint, `0x${string}`];

  return { originalMinter, mintedAt, instanceId };
}

/**
 * Check if an item instance has been minted
 */
export async function checkItemInstance(
  instanceId: `0x${string}`
): Promise<{ minted: boolean; originalMinter: Address }> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const result = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "checkInstance",
    args: [instanceId],
  });

  const [minted, originalMinter] = result as [boolean, Address];

  return { minted, originalMinter };
}

/**
 * Verify an item mint signature (off-chain check)
 */
export async function verifyItemMint(
  playerAddress: Address,
  itemId: bigint,
  amount: bigint,
  instanceId: `0x${string}`,
  signature: `0x${string}`
): Promise<boolean> {
  const client = getClient();
  const itemsAddress = getItemsAddress();

  const valid = await client.readContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "verifyMint",
    args: [playerAddress, itemId, amount, instanceId, signature],
  });

  return valid as boolean;
}

/**
 * Sign an item mint for a player (game server function)
 */
export async function signItemMint(
  playerAddress: Address,
  itemId: bigint,
  amount: bigint,
  instanceId: `0x${string}`,
  signerPrivateKey: `0x${string}`
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(signerPrivateKey);
  
  const { keccak256, encodePacked, toBytes } = await import("viem");

  const messageHash = keccak256(
    encodePacked(
      ["address", "uint256", "uint256", "bytes32"],
      [playerAddress, itemId, amount, instanceId]
    )
  );

  const signature = await account.signMessage({
    message: { raw: toBytes(messageHash) },
  });

  return signature;
}

/**
 * Mint an item on-chain (player calls this)
 */
export async function mintItem(
  params: ItemMintParams,
  playerPrivateKey: `0x${string}`,
  network?: JejuNetwork
): Promise<`0x${string}`> {
  const wallet = getWalletClient(playerPrivateKey, network);
  const itemsAddress = getItemsAddress();
  const chain = getChain(network);

  const hash = await wallet.writeContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "mintItem",
    args: [params.itemId, params.amount, params.instanceId, params.signature],
    chain,
    account: signerAccount!,
  });

  return hash;
}

/**
 * Burn an item (convert back to in-game item)
 */
export async function burnItem(
  itemId: bigint,
  amount: bigint,
  playerPrivateKey: `0x${string}`,
  network?: JejuNetwork
): Promise<`0x${string}`> {
  const wallet = getWalletClient(playerPrivateKey, network);
  const itemsAddress = getItemsAddress();
  const chain = getChain(network);
  const account = privateKeyToAccount(playerPrivateKey);

  const hash = await wallet.writeContract({
    address: itemsAddress,
    abi: ITEMS_ABI,
    functionName: "burn",
    args: [account.address, itemId, amount],
    chain,
    account: signerAccount!,
  });

  return hash;
}

// ============ Game Integration Helpers ============

/**
 * Generate a unique instance ID for a non-stackable item
 */
export function generateInstanceId(
  playerAddress: Address,
  itemId: bigint,
  timestamp: bigint
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["address", "uint256", "uint256", "uint256"],
      [playerAddress, itemId, timestamp, BigInt(Math.floor(Math.random() * 1000000))]
    )
  );
}

/**
 * Get game signer address from Gold contract
 */
export async function getGameSigner(): Promise<Address> {
  const client = getClient();
  const goldAddress = getGoldAddress();

  const signer = await client.readContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "gameSigner",
  });

  return signer as Address;
}

/**
 * Get game agent ID from contract
 */
export async function getGameAgentId(): Promise<bigint> {
  const client = getClient();
  const goldAddress = getGoldAddress();

  const agentId = await client.readContract({
    address: goldAddress,
    abi: GOLD_ABI,
    functionName: "gameAgentId",
  });

  return agentId as bigint;
}

// ============ Batch Operations ============

/**
 * Get player's complete on-chain inventory state
 */
export async function getPlayerOnChainState(
  playerAddress: Address,
  itemIds: bigint[]
): Promise<{
  goldBalance: bigint;
  itemBalances: Map<bigint, bigint>;
  claimNonce: bigint;
}> {
  const [goldBalance, claimNonce, balances] = await Promise.all([
    getGoldBalance(playerAddress),
    getGoldClaimNonce(playerAddress),
    getItemBalances(playerAddress, itemIds),
  ]);

  const itemBalances = new Map<bigint, bigint>();
  itemIds.forEach((id, index) => {
    itemBalances.set(id, balances[index]);
  });

  return { goldBalance, itemBalances, claimNonce };
}

// ============ Event Watching ============

/**
 * Watch for ItemBurned events on Items.sol
 * Used to credit items back to MUD inventory when NFTs are burned
 */
export async function watchItemBurns(
  onBurn: (player: Address, itemId: bigint, amount: bigint, txHash: `0x${string}`) => void | Promise<void>,
  network?: JejuNetwork
): Promise<() => void> {
  const client = getClient(network);
  const itemsAddress = getItemsAddress();

  const unwatch = client.watchContractEvent({
    address: itemsAddress,
    abi: ITEMS_ABI,
    eventName: "ItemBurned" as never, // Type workaround
    onLogs: async (logs: Array<{ args: { player: Address; itemId: bigint; amount: bigint }; transactionHash: `0x${string}` }>) => {
      for (const log of logs) {
        await onBurn(log.args.player, log.args.itemId, log.args.amount, log.transactionHash);
      }
    },
  });

  return unwatch;
}

/**
 * Watch for GoldClaimed events on Gold.sol
 * Used to track successful gold withdrawals
 */
export async function watchGoldClaims(
  onClaim: (player: Address, amount: bigint, nonce: bigint, txHash: `0x${string}`) => void | Promise<void>,
  network?: JejuNetwork
): Promise<() => void> {
  const client = getClient(network);
  const goldAddress = getGoldAddress();

  const unwatch = client.watchContractEvent({
    address: goldAddress,
    abi: GOLD_ABI,
    eventName: "GoldClaimed" as never, // Type workaround
    onLogs: async (logs: Array<{ args: { player: Address; amount: bigint; nonce: bigint }; transactionHash: `0x${string}` }>) => {
      for (const log of logs) {
        await onClaim(log.args.player, log.args.amount, log.args.nonce, log.transactionHash);
      }
    },
  });

  return unwatch;
}

/**
 * Watch for ItemMinted events on Items.sol
 * Used to verify successful mints and remove from MUD inventory
 */
export async function watchItemMints(
  onMint: (
    minter: Address,
    itemId: bigint,
    amount: bigint,
    instanceId: `0x${string}`,
    stackable: boolean,
    rarity: number,
    txHash: `0x${string}`
  ) => void | Promise<void>,
  network?: JejuNetwork
): Promise<() => void> {
  const client = getClient(network);
  const itemsAddress = getItemsAddress();

  const unwatch = client.watchContractEvent({
    address: itemsAddress,
    abi: ITEMS_ABI,
    eventName: "ItemMinted" as never, // Type workaround
    onLogs: async (logs: Array<{
      args: {
        minter: Address;
        itemId: bigint;
        amount: bigint;
        instanceId: `0x${string}`;
        stackable: boolean;
        rarity: number;
      };
      transactionHash: `0x${string}`;
    }>) => {
      for (const log of logs) {
        await onMint(
          log.args.minter,
          log.args.itemId,
          log.args.amount,
          log.args.instanceId,
          log.args.stackable,
          log.args.rarity,
          log.transactionHash
        );
      }
    },
  });

  return unwatch;
}
