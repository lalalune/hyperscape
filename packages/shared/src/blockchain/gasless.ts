/**
 * Gasless Transaction Utilities
 *
 * High-level utilities for executing gasless game transactions.
 * Provides a unified API that works both client-side (via server relay)
 * and server-side (via direct bundler submission).
 *
 * Usage:
 * - Client: Call game actions via WebSocket or HTTP → Server handles gas
 * - Server: Use GameTransactionService or smart accounts directly
 *
 * All gameplay actions should be gasless by default.
 */

import {
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { getOptionalAddress, type JejuNetwork } from "./chain";

// ============ Types ============

export interface GaslessConfig {
  /** Server URL for relaying transactions */
  serverUrl?: string;
  /** Network to use */
  network?: JejuNetwork;
  /** Authorization token (for client-side) */
  authToken?: string;
}

export interface GaslessResult {
  success: boolean;
  hash?: Hash;
  error?: string;
}

export type GameAction =
  | "claimGold"
  | "mintItem"
  | "burnGold"
  | "burnItem"
  | "addItem"
  | "removeItem"
  | "equipItem"
  | "unequipItem"
  | "attackMob"
  | "chopTree"
  | "fish"
  | "register";

export interface GameActionParams {
  /** Player's address */
  player: Address;
  /** Action to execute */
  action: GameAction;
  /** Action-specific parameters */
  params: Record<string, unknown>;
}

// ============ Contract ABIs (Minimal) ============

const GOLD_ABI = parseAbi([
  "function claimGold(uint256 amount, uint256 nonce, bytes signature) external",
  "function burn(uint256 amount) external",
]);

const ITEMS_ABI = parseAbi([
  "function mintItem(uint256 itemId, uint256 amount, bytes32 instanceId, bytes signature) external",
  "function burn(address account, uint256 id, uint256 amount) external",
]);

const WORLD_ABI = parseAbi([
  "function hyperscape__register(string name) external",
  "function hyperscape__addItem(address player, uint16 itemId, uint32 quantity) external",
  "function hyperscape__removeItem(address player, uint8 slot, uint32 quantity) external",
  "function hyperscape__equipItem(uint8 inventorySlot) external",
  "function hyperscape__unequipItem(uint8 equipSlot) external",
  "function hyperscape__attackMob(address mobId) external",
  "function hyperscape__chopTree(address resourceId) external",
  "function hyperscape__fish(address resourceId) external",
]);

// ============ Client-Side Gasless API ============

/**
 * Execute a gasless game action via the server
 * 
 * This is the primary API for client-side code. The server handles all
 * gas sponsorship and transaction submission.
 */
export async function executeGaslessAction(
  action: GameActionParams,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  const serverUrl = config.serverUrl || "http://localhost:5555";

  const response = await fetch(`${serverUrl}/api/game/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: JSON.stringify(action),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    return { success: false, error: error.message || error.error };
  }

  const result = await response.json();
  return { success: true, hash: result.hash };
}

/**
 * Batch multiple game actions into a single gasless transaction
 */
export async function executeGaslessBatch(
  actions: GameActionParams[],
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  const serverUrl = config.serverUrl || "http://localhost:5555";

  const response = await fetch(`${serverUrl}/api/game/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: JSON.stringify({ actions }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    return { success: false, error: error.message || error.error };
  }

  const result = await response.json();
  return { success: true, hash: result.hash };
}

// ============ Server-Side Helpers ============

/**
 * Encode call data for a game action
 */
export function encodeGameAction(
  action: GameAction,
  params: Record<string, unknown>
): { target: Address; callData: Hex } {
  const goldAddress = getOptionalAddress("GOLD_ADDRESS");
  const itemsAddress = getOptionalAddress("ITEMS_ADDRESS");
  const worldAddress = getOptionalAddress("WORLD_ADDRESS");

  switch (action) {
    case "claimGold":
      if (!goldAddress) throw new Error("GOLD_ADDRESS not configured");
      return {
        target: goldAddress,
        callData: encodeFunctionData({
          abi: GOLD_ABI,
          functionName: "claimGold",
          args: [
            BigInt(params.amount as string),
            BigInt(params.nonce as string),
            params.signature as Hex,
          ],
        }),
      };

    case "burnGold":
      if (!goldAddress) throw new Error("GOLD_ADDRESS not configured");
      return {
        target: goldAddress,
        callData: encodeFunctionData({
          abi: GOLD_ABI,
          functionName: "burn",
          args: [BigInt(params.amount as string)],
        }),
      };

    case "mintItem":
      if (!itemsAddress) throw new Error("ITEMS_ADDRESS not configured");
      return {
        target: itemsAddress,
        callData: encodeFunctionData({
          abi: ITEMS_ABI,
          functionName: "mintItem",
          args: [
            BigInt(params.itemId as string),
            BigInt(params.amount as string),
            params.instanceId as Hex,
            params.signature as Hex,
          ],
        }),
      };

    case "burnItem":
      if (!itemsAddress) throw new Error("ITEMS_ADDRESS not configured");
      return {
        target: itemsAddress,
        callData: encodeFunctionData({
          abi: ITEMS_ABI,
          functionName: "burn",
          args: [
            params.account as Address,
            BigInt(params.itemId as string),
            BigInt(params.amount as string),
          ],
        }),
      };

    case "register":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__register",
          args: [params.name as string],
        }),
      };

    case "addItem":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__addItem",
          args: [
            params.player as Address,
            params.itemId as number,
            params.quantity as number,
          ],
        }),
      };

    case "removeItem":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__removeItem",
          args: [
            params.player as Address,
            params.slot as number,
            params.quantity as number,
          ],
        }),
      };

    case "equipItem":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__equipItem",
          args: [params.inventorySlot as number],
        }),
      };

    case "unequipItem":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__unequipItem",
          args: [params.equipSlot as number],
        }),
      };

    case "attackMob":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__attackMob",
          args: [params.mobId as Address],
        }),
      };

    case "chopTree":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__chopTree",
          args: [params.resourceId as Address],
        }),
      };

    case "fish":
      if (!worldAddress) throw new Error("WORLD_ADDRESS not configured");
      return {
        target: worldAddress,
        callData: encodeFunctionData({
          abi: WORLD_ABI,
          functionName: "hyperscape__fish",
          args: [params.resourceId as Address],
        }),
      };

    default:
      throw new Error(`Unknown game action: ${action}`);
  }
}

// ============ Action-Specific Helpers ============

/**
 * Claim gold earned in-game (gasless)
 */
export async function claimGoldGasless(
  player: Address,
  amount: bigint,
  nonce: bigint,
  signature: Hex,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "claimGold",
      params: {
        amount: amount.toString(),
        nonce: nonce.toString(),
        signature,
      },
    },
    config
  );
}

/**
 * Mint an item as NFT (gasless)
 */
export async function mintItemGasless(
  player: Address,
  itemId: bigint,
  amount: bigint,
  instanceId: Hex,
  signature: Hex,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "mintItem",
      params: {
        itemId: itemId.toString(),
        amount: amount.toString(),
        instanceId,
        signature,
      },
    },
    config
  );
}

/**
 * Burn gold for in-game purchase (gasless)
 */
export async function burnGoldGasless(
  player: Address,
  amount: bigint,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "burnGold",
      params: { amount: amount.toString() },
    },
    config
  );
}

/**
 * Add item to player inventory (server-side only)
 */
export async function addItemGasless(
  player: Address,
  itemId: number,
  quantity: number,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "addItem",
      params: { player, itemId, quantity },
    },
    config
  );
}

/**
 * Equip item from inventory (gasless)
 */
export async function equipItemGasless(
  player: Address,
  inventorySlot: number,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "equipItem",
      params: { inventorySlot },
    },
    config
  );
}

/**
 * Register a new player (gasless)
 */
export async function registerPlayerGasless(
  player: Address,
  name: string,
  config: GaslessConfig = {}
): Promise<GaslessResult> {
  return executeGaslessAction(
    {
      player,
      action: "register",
      params: { name },
    },
    config
  );
}

// ============ Gas Estimation ============

/**
 * Estimate gas for a game action (for display purposes)
 * Since actions are gasless, this returns the sponsored cost
 */
export async function estimateActionCost(
  _action: GameAction,
  _config: GaslessConfig = {}
): Promise<{ gasless: boolean; sponsoredCost: string }> {
  // All game actions are gasless
  return {
    gasless: true,
    sponsoredCost: "0 ETH (sponsored by Hyperscape)",
  };
}

// ============ Status Check ============

/**
 * Check if gasless transactions are available
 */
export async function isGaslessAvailable(
  config: GaslessConfig = {}
): Promise<boolean> {
  const serverUrl = config.serverUrl || "http://localhost:5555";

  const response = await fetch(`${serverUrl}/api/game/status`).catch(() => null);

  if (!response || !response.ok) {
    return false;
  }

  const status = await response.json();
  return status.gaslessEnabled === true;
}
