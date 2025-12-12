/**
 * A2A JSON-RPC Server for Hyperscape RPG
 * Enables external AI agents to discover and play the game via A2A protocol
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import type { World } from "@hyperscape/shared";
import { generateAgentCard } from "./agentCard.js";

const uuidv4 = randomUUID;

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: Array<{ kind: string; text?: string; data?: Record<string, unknown> }>;
  messageId: string;
  kind: "message";
}

const A2A_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SIGNATURE_FAILED: -32001,
};

// Validation helpers - fail-fast pattern
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return value;
}

function optionalString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && !isNaN(value) ? value : fallback;
}

function firstDefined<T>(...values: (T | undefined | null)[]): T {
  for (const val of values) {
    if (val !== undefined && val !== null) {
      return val;
    }
  }
  throw new Error("No defined value found");
}

export class A2AServer {
  private world: World;
  private serverUrl: string;
  private seenMessageIds: Set<string> = new Set();

  constructor(world: World, serverUrl: string) {
    this.world = world;
    this.serverUrl = serverUrl;
  }

  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    // Agent Card discovery endpoint
    fastify.get(
      "/.well-known/agent-card.json",
      async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(generateAgentCard(this.serverUrl));
      },
    );

    // A2A JSON-RPC endpoint
    fastify.post("/a2a", async (req: FastifyRequest, reply: FastifyReply) => {
      await this.handleRequest(req, reply);
    });
  }

  async handleRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const request = req.body as JSONRPCRequest;

    // Validate JSON-RPC
    if (!request.jsonrpc || request.jsonrpc !== "2.0") {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_REQUEST,
          "Invalid JSON-RPC version",
        ),
      );
    }

    if (!request.method) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_REQUEST,
          "Missing method",
        ),
      );
    }

    // Route to handler
    if (
      request.method === "message/send" ||
      request.method === "message/stream"
    ) {
      await this.handleMessageSend(
        request,
        reply,
        request.method === "message/stream",
      );
    } else {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.METHOD_NOT_FOUND,
          `Unknown method: ${request.method}`,
        ),
      );
    }
  }

  private async handleMessageSend(
    request: JSONRPCRequest,
    reply: FastifyReply,
    streaming: boolean,
  ): Promise<void> {
    const params = request.params as { message?: A2AMessage };

    if (!params || !params.message) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_PARAMS,
          "Missing message",
        ),
      );
    }

    const message = params.message;

    // Extract data part
    const dataPart = message.parts.find((p) => p.kind === "data");
    if (!dataPart || !dataPart.data) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_PARAMS,
          "Missing data part",
        ),
      );
    }

    const data = dataPart.data;

    // Extract required fields
    let skillId: string, agentId: string;
    try {
      skillId = requireString(data.skillId, "skillId");
      agentId = requireString(data.agentId, "agentId");
    } catch (error) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_PARAMS,
          (error as Error).message,
        ),
      );
    }

    // Prevent replay attacks
    if (this.seenMessageIds.has(message.messageId)) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INVALID_REQUEST,
          "Duplicate message ID",
        ),
      );
    }
    this.seenMessageIds.add(message.messageId);

    // Execute skill
    const result = await this.executeSkill(skillId, agentId, data);

    if (!result.success) {
      return reply.send(
        this.createError(
          request.id ?? null,
          A2A_ERROR_CODES.INTERNAL_ERROR,
          result.message,
        ),
      );
    }

    // Return response
    const responseMessage: A2AMessage = {
      role: "agent",
      parts: [
        { kind: "text", text: result.message },
        ...(result.data ? [{ kind: "data", data: result.data }] : []),
      ],
      messageId: uuidv4(),
      kind: "message",
    };

    if (streaming) {
      reply.header("Content-Type", "text/event-stream");
      reply.header("Cache-Control", "no-cache");
      reply.header("Connection", "keep-alive");
      reply.raw.flushHeaders();
      reply.raw.write(
        `data: ${JSON.stringify(this.createSuccess(request.id ?? null, responseMessage))}\n\n`,
      );
    } else {
      return reply.send(
        this.createSuccess(request.id ?? null, responseMessage),
      );
    }
  }

  private async executeSkill(
    skillId: string,
    agentId: string,
    data: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  }> {
    const rpg = this.world.rpg;

    if (!rpg) {
      return { success: false, message: "RPG system not initialized" };
    }

    switch (skillId) {
      case "join-game": {
        const playerName = optionalString(
          data.playerName,
          `Agent_${agentId.slice(0, 8)}`,
        );

        // Create a character for this agent if they don't have one
        // This would normally go through the WebSocket connection flow
        // For A2A, we'll create a simplified registration

        return {
          success: true,
          message: `Agent ${playerName} ready to join. Connect via WebSocket to spawn in-world.`,
          data: {
            agentId,
            playerName,
            instructions: "Use WebSocket connection for full gameplay",
          },
        };
      }

      case "get-status": {
        const player = rpg
          .getAllPlayers?.()
          ?.find((p: { id: string }) => p.id === agentId);

        if (!player) {
          return {
            success: false,
            message: "Player not in world. Connect via WebSocket first.",
          };
        }

        const health = rpg.getPlayerHealth?.(agentId) ?? { current: 0, max: 0 };
        const inventory = rpg.getInventory?.(agentId) ?? [];
        const equipment = rpg.getEquipment?.(agentId) ?? {};
        const skills = rpg.getSkills?.(agentId) ?? {};
        const inCombat = rpg.isInCombat?.(agentId) ?? false;

        return {
          success: true,
          message: "Status retrieved",
          data: {
            playerId: agentId,
            health,
            inventory,
            equipment,
            skills,
            inCombat,
            alive: rpg.isPlayerAlive?.(agentId) ?? true,
          },
        };
      }

      case "move-to": {
        const x = firstDefined(
          data.x as number | undefined,
          data.targetX as number | undefined,
        );
        const y = firstDefined(
          data.y as number | undefined,
          data.targetY as number | undefined,
        );
        const z = firstDefined(
          data.z as number | undefined,
          data.targetZ as number | undefined,
        );

        if (x === undefined || y === undefined || z === undefined) {
          return { success: false, message: "Missing x, y, or z coordinates" };
        }

        rpg.movePlayer?.(agentId, { x, y, z });

        return {
          success: true,
          message: `Moving to position (${x}, ${y}, ${z})`,
        };
      }

      case "attack": {
        const targetId = requireString(data.targetId, "targetId");
        const attackStyle = optionalString(data.attackStyle, "accurate");

        rpg.actionMethods?.startAttack(agentId, targetId, attackStyle);

        return {
          success: true,
          message: `Attacking ${targetId} with ${attackStyle} style`,
        };
      }

      case "stop-attack": {
        rpg.actionMethods?.stopAttack(agentId);

        return {
          success: true,
          message: "Stopped attacking",
        };
      }

      case "gather-resource": {
        const resourceId = requireString(data.resourceId, "resourceId");

        // Execute gather action through action registry
        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "start_gathering",
          context,
          { resourceId },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Gathering failed",
        };
      }

      case "use-item": {
        const itemId = requireString(data.itemId, "itemId");
        const slot = requireNumber(data.slot, "slot");

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "use_item",
          context,
          { itemId, slot },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Item use failed",
        };
      }

      case "equip-item": {
        const itemId = requireString(data.itemId, "itemId");
        const slot = optionalString(data.slot);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "equip_item",
          context,
          { itemId, slot },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Equip failed",
        };
      }

      case "unequip-item": {
        const slot = requireString(data.slot, "slot");

        rpg.actionMethods?.unequipItem(agentId, slot);

        return {
          success: true,
          message: `Unequipped item from ${slot} slot`,
        };
      }

      case "pickup-item": {
        const itemId = requireString(data.itemId, "itemId");

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "pickup_item",
          context,
          { itemId },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Pickup failed",
        };
      }

      case "drop-item": {
        const itemId = requireString(data.itemId, "itemId");
        const quantity = optionalNumber(data.quantity, 1);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "drop_item",
          context,
          { itemId, quantity },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Drop failed",
        };
      }

      case "open-bank": {
        const bankId = requireString(data.bankId, "bankId");

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "open_bank",
          context,
          { bankId },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Bank open failed",
        };
      }

      case "deposit-item": {
        const bankId = requireString(data.bankId, "bankId");
        const itemId = requireString(data.itemId, "itemId");
        const quantity = optionalNumber(data.quantity, 1);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "deposit_item",
          context,
          { bankId, itemId, quantity },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Deposit failed",
        };
      }

      case "withdraw-item": {
        const bankId = requireString(data.bankId, "bankId");
        const itemId = requireString(data.itemId, "itemId");
        const quantity = optionalNumber(data.quantity, 1);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "withdraw_item",
          context,
          { bankId, itemId, quantity },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Withdrawal failed",
        };
      }

      case "buy-item": {
        const storeId = requireString(data.storeId, "storeId");
        const itemId = requireString(data.itemId, "itemId");
        const quantity = optionalNumber(data.quantity, 1);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "buy_item",
          context,
          { storeId, itemId, quantity },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Purchase failed",
          data: result as Record<string, unknown>,
        };
      }

      case "sell-item": {
        const storeId = requireString(data.storeId, "storeId");
        const itemId = requireString(data.itemId, "itemId");
        const quantity = optionalNumber(data.quantity, 1);

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "sell_item",
          context,
          { storeId, itemId, quantity },
        );

        return {
          success: result?.success ?? false,
          message: (result?.message as string) ?? "Sale failed",
          data: result as Record<string, unknown>,
        };
      }

      case "get-skills": {
        const skills = rpg.getSkills?.(agentId) ?? {};
        const combatLevel = rpg.getCombatLevel?.(agentId) ?? 1;

        return {
          success: true,
          message: `Combat Level ${combatLevel}`,
          data: { skills, combatLevel },
        };
      }

      case "get-inventory": {
        const inventory = rpg.getInventory?.(agentId) ?? [];
        const equipment = rpg.getEquipment?.(agentId) ?? {};
        const arrowCount = rpg.getArrowCount?.(agentId) ?? 0;

        return {
          success: true,
          message: `Inventory: ${inventory.length}/28 slots`,
          data: { inventory, equipment, arrowCount },
        };
      }

      case "get-nearby-entities": {
        const range = optionalNumber(data.range, 20);

        // Get player position
        const player = rpg
          .getAllPlayers?.()
          ?.find((p: { id: string }) => p.id === agentId);
        if (!player) {
          return { success: false, message: "Player not found" };
        }

        const position = player.position || player.node?.position;
        if (!position) {
          return { success: false, message: "Player position unknown" };
        }

        // Get nearby entities
        const mobs = rpg.getMobsInArea?.(position, range) ?? [];
        const resources = rpg.getResourcesInArea?.(position, range) ?? [];
        const items = rpg.getItemsInRange?.(position, range) ?? [];

        return {
          success: true,
          message: `Found ${mobs.length} mobs, ${resources.length} resources, ${items.length} items nearby`,
          data: {
            mobs,
            resources,
            items,
            position,
          },
        };
      }

      case "change-attack-style": {
        const styleId = requireString(data.styleId, "styleId");

        rpg.forceChangeAttackStyle?.(agentId, styleId);

        return {
          success: true,
          message: `Changed attack style to ${styleId}`,
        };
      }

      case "look-around":
      case "get-world-context": {
        const range = optionalNumber(data.range, 30);

        const player = rpg
          .getAllPlayers?.()
          ?.find((p: { id: string }) => p.id === agentId);
        if (!player) {
          return { success: false, message: "Player not found" };
        }

        const position = player.position || player.node?.position;
        const health = rpg.getPlayerHealth?.(agentId) ?? {
          current: 100,
          max: 100,
        };
        const inCombat = rpg.isInCombat?.(agentId) ?? false;

        // Get nearby entities
        const mobs = rpg.getMobsInArea?.(position, range) ?? [];
        const resources = rpg.getResourcesInArea?.(position, range) ?? [];
        const items = rpg.getItemsInRange?.(position, range) ?? [];

        // Build semantic description
        const lines: string[] = [];
        lines.push("=== WORLD CONTEXT ===");
        lines.push(
          `Position: [${position?.x?.toFixed(0) ?? 0}, ${position?.z?.toFixed(0) ?? 0}]`,
        );
        lines.push(
          `Health: ${Math.round((health.current / health.max) * 100)}%`,
        );
        lines.push(`In Combat: ${inCombat ? "Yes" : "No"}`);
        lines.push("");

        if (mobs.length > 0) {
          lines.push(`Creatures (${mobs.length}):`);
          mobs
            .slice(0, 5)
            .forEach((mob: { name?: string; mobType?: string }) => {
              lines.push(`  • ${mob.name || mob.mobType || "Unknown"}`);
            });
        }

        if (resources.length > 0) {
          lines.push(`Resources (${resources.length}):`);
          resources
            .slice(0, 5)
            .forEach((res: { name?: string; resourceType?: string }) => {
              lines.push(`  • ${res.name || res.resourceType || "Resource"}`);
            });
        }

        if (items.length > 0) {
          lines.push(`Ground Items (${items.length}):`);
          items.slice(0, 5).forEach((item: { name?: string }) => {
            lines.push(`  • ${item.name || "Item"}`);
          });
        }

        return {
          success: true,
          message: lines.join("\n"),
          data: { position, health, inCombat, mobs, resources, items },
        };
      }

      case "interact-npc": {
        const npcId = optionalString(data.npcId);
        const npcName = optionalString(data.npcName);

        // Find NPC by ID or name
        const target = npcId || npcName;
        if (!target) {
          return { success: false, message: "Specify npcId or npcName" };
        }

        // NPC interaction would be handled by dialogue system
        return {
          success: true,
          message: `Interacting with NPC: ${target}`,
          data: { npcId, npcName },
        };
      }

      case "loot-corpse": {
        const corpseId = optionalString(data.corpseId);

        // Loot from nearest corpse or specified one
        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "loot_corpse",
          context,
          { corpseId },
        );

        return {
          success: result?.success ?? true,
          message: (result?.message as string) ?? "Looting corpse",
        };
      }

      case "eat-food": {
        // Find food in inventory and use it
        const inventory = rpg.getInventory?.(agentId) ?? [];
        const food = inventory.find(
          (item: { name?: string }) =>
            /fish|food|bread|meat/i.test(item.name || "") &&
            !/raw/i.test(item.name || ""),
        );

        if (!food) {
          return { success: false, message: "No edible food in inventory" };
        }

        const context = { world: this.world, playerId: agentId };
        const result = await this.world.actionRegistry?.execute(
          "use_item",
          context,
          { itemId: food.id },
        );

        return {
          success: result?.success ?? true,
          message: (result?.message as string) ?? `Eating ${food.name}`,
          data: { food },
        };
      }

      case "emote": {
        const emoteName = optionalString(data.emote, "wave");

        rpg.playEmote?.(agentId, emoteName);

        return {
          success: true,
          message: `Performing ${emoteName} emote`,
        };
      }

      case "respawn": {
        const isAlive = rpg.isPlayerAlive?.(agentId) ?? true;

        if (isAlive) {
          return { success: false, message: "Player is not dead" };
        }

        rpg.respawnPlayer?.(agentId);

        return {
          success: true,
          message: "Respawning at nearest town",
        };
      }

      case "set-goal": {
        const goalType = optionalString(data.goalType, "exploration");
        const target = optionalString(data.target);

        // Goals are managed by the plugin's AutonomousBehaviorManager
        // This just acknowledges the intent
        return {
          success: true,
          message: `Goal set: ${goalType} - ${target || "general"}`,
          data: { goalType, target },
        };
      }

      case "move-direction": {
        const direction = optionalString(data.direction, "north");
        const distance = optionalNumber(data.distance, 10) * 5; // tiles to units

        const player = rpg
          .getAllPlayers?.()
          ?.find((p: { id: string }) => p.id === agentId);
        if (!player) {
          return { success: false, message: "Player not found" };
        }

        const position = player.position || player.node?.position;
        if (!position) {
          return { success: false, message: "Player position unknown" };
        }

        // Calculate target position
        let dx = 0,
          dz = 0;
        if (direction.includes("north")) dz -= distance;
        if (direction.includes("south")) dz += distance;
        if (direction.includes("east")) dx += distance;
        if (direction.includes("west")) dx -= distance;

        const targetX = (position.x ?? 0) + dx;
        const targetZ = (position.z ?? 0) + dz;

        rpg.movePlayer?.(agentId, {
          x: targetX,
          y: position.y ?? 0,
          z: targetZ,
        });

        return {
          success: true,
          message: `Moving ${direction} for ${distance / 5} tiles`,
        };
      }

      case "examine": {
        const entityId = optionalString(data.entityId);

        if (!entityId) {
          return { success: false, message: "Specify entityId to examine" };
        }

        // Get entity info
        const mobs = rpg.getAllMobs?.() ?? [];
        const mob = mobs.find((m: { id: string }) => m.id === entityId);

        if (mob) {
          return {
            success: true,
            message: `Examining: ${mob.name || mob.mobType || "Unknown mob"}`,
            data: {
              id: mob.id,
              name: mob.name,
              type: mob.mobType,
              level: mob.level,
              alive: mob.alive !== false,
            },
          };
        }

        return {
          success: false,
          message: `Entity ${entityId} not found`,
        };
      }

      default:
        return { success: false, message: `Unknown skill: ${skillId}` };
    }
  }

  private createSuccess(
    id: string | number | null,
    result: unknown,
  ): JSONRPCResponse {
    return { jsonrpc: "2.0", id, result };
  }

  private createError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message, data },
    };
  }
}
