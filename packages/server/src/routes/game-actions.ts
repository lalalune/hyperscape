/**
 * Game Action API Routes
 *
 * REST API endpoints for gasless game transactions.
 * All transactions are sponsored by the game server - users never pay gas.
 *
 * Endpoints:
 * - POST /api/game/action - Execute a single game action
 * - POST /api/game/batch - Execute multiple actions atomically
 * - GET /api/game/status - Check gasless system status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import {
  getGameTransactionService,
  initializeGameTransactionServiceFromEnv,
  type GameTransaction,
} from "../blockchain/GameTransactionService";

// ============ Types ============

type GameAction =
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

function encodeGameAction(
  action: GameAction,
  params: Record<string, unknown>
): { target: Address; callData: Hex } {
  const goldAddress = process.env.GOLD_ADDRESS as Address | undefined;
  const itemsAddress = process.env.ITEMS_ADDRESS as Address | undefined;
  const worldAddress = process.env.WORLD_ADDRESS as Address | undefined;

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

// ============ Types ============

interface GameActionRequest {
  player: Address;
  action: GameAction;
  params: Record<string, unknown>;
}

interface BatchActionRequest {
  actions: GameActionRequest[];
}

// ============ Initialization ============

let initialized = false;

function ensureInitialized(): void {
  if (!initialized) {
    initializeGameTransactionServiceFromEnv();
    initialized = true;
    console.log("[GameActions] Initialized GameTransactionService");
  }
}

// ============ Route Registration ============

export async function gameActionRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize service on first request
  fastify.addHook("onRequest", async () => {
    ensureInitialized();
  });

  /**
   * Execute a single game action (gasless)
   */
  fastify.post<{ Body: GameActionRequest }>(
    "/api/game/action",
    async (request: FastifyRequest<{ Body: GameActionRequest }>, reply: FastifyReply) => {
      const { player, action, params } = request.body;

      if (!player || !action) {
        return reply.status(400).send({
          error: "player and action are required",
        });
      }

      console.log(`[GameActions] Executing ${action} for ${player}`);

      // Encode the action
      let encoded: { target: Address; callData: Hex };
      try {
        encoded = encodeGameAction(action, params);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.status(400).send({
          error: `Failed to encode action: ${message}`,
        });
      }

      // Execute via GameTransactionService
      const service = getGameTransactionService();
      const tx: GameTransaction = {
        player,
        target: encoded.target,
        callData: encoded.callData,
      };

      const result = await service.executeTransaction(tx);

      if (!result.success) {
        console.error(`[GameActions] Transaction failed:`, result.error);
        return reply.status(500).send({
          error: result.error || "Transaction failed",
        });
      }

      console.log(`[GameActions] Transaction successful: ${result.hash}`);

      return reply.send({
        success: true,
        hash: result.hash,
        gasUsed: result.gasUsed?.toString(),
      });
    }
  );

  /**
   * Execute multiple game actions atomically (gasless)
   */
  fastify.post<{ Body: BatchActionRequest }>(
    "/api/game/batch",
    async (request: FastifyRequest<{ Body: BatchActionRequest }>, reply: FastifyReply) => {
      const { actions } = request.body;

      if (!actions || !Array.isArray(actions) || actions.length === 0) {
        return reply.status(400).send({
          error: "actions array is required",
        });
      }

      // Validate all actions are for the same player
      const player = actions[0].player;
      if (!actions.every((a) => a.player === player)) {
        return reply.status(400).send({
          error: "All actions must be for the same player",
        });
      }

      console.log(`[GameActions] Executing batch of ${actions.length} actions for ${player}`);

      // Encode all actions
      const txs: GameTransaction[] = [];
      for (const action of actions) {
        try {
          const encoded = encodeGameAction(action.action, action.params);
          txs.push({
            player,
            target: encoded.target,
            callData: encoded.callData,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return reply.status(400).send({
            error: `Failed to encode action ${action.action}: ${message}`,
          });
        }
      }

      // Execute batch via GameTransactionService
      const service = getGameTransactionService();
      const result = await service.executeBatch(txs);

      if (!result.success) {
        console.error(`[GameActions] Batch transaction failed:`, result.error);
        return reply.status(500).send({
          error: result.error || "Batch transaction failed",
        });
      }

      console.log(`[GameActions] Batch transaction successful: ${result.hash}`);

      return reply.send({
        success: true,
        hash: result.hash,
        gasUsed: result.gasUsed?.toString(),
        actionsExecuted: actions.length,
      });
    }
  );

  /**
   * Get gasless system status
   */
  fastify.get(
    "/api/game/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const service = getGameTransactionService();
      const status = await service.getStatus();

      const paymasterFunded = status.paymasterBalance > 0n;
      const gaslessEnabled = paymasterFunded || !status.bundlerAvailable;

      return reply.send({
        gaslessEnabled,
        bundlerAvailable: status.bundlerAvailable,
        paymasterBalance: status.paymasterBalance.toString(),
        paymasterFunded,
        gameAuthority: status.gameAuthority,
        network: process.env.JEJU_NETWORK || "jeju",
        chainId: process.env.CHAIN_ID || "420691",
      });
    }
  );

  /**
   * Health check for game actions API
   */
  fastify.get(
    "/api/game/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: "ok",
        initialized,
        timestamp: Date.now(),
      });
    }
  );
}

export default gameActionRoutes;
