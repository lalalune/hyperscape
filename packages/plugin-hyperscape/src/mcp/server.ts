/**
 * MCP Server for Hyperscape RPG
 * 
 * Implements Model Context Protocol to expose Hyperscape game capabilities
 * to any MCP-compatible AI agent (Claude, GPT, etc).
 */

import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { Entity, Equipment } from "../types.js";
import {
  determineArea,
  calculateDistance,
  getDirection,
  directionToOffset,
  calculateCombatLevel,
  categorizeEntities,
  getPlayerStatus,
  generateSceneDescription
} from "../shared/game-helpers.js";

// ============================================
// MCP Protocol Types
// ============================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, MCPProperty>;
    required?: string[];
  };
}

interface MCPProperty {
  type: string;
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
}

export interface MCPToolResult {
  success: boolean;
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
}

export interface MCPResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

// ============================================
// Tool Definitions
// ============================================

const MOVEMENT_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_move_to",
    description: "Move to a specific position (x, y, z coordinates)",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate" },
        y: { type: "number", description: "Y coordinate (height)" },
        z: { type: "number", description: "Z coordinate" },
        run: { type: "boolean", description: "Run instead of walk" }
      },
      required: ["x", "z"]
    }
  },
  {
    name: "hyperscape_move_direction",
    description: "Move in a cardinal direction",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"], description: "Direction" },
        distance: { type: "number", description: "Distance in tiles" }
      },
      required: ["direction"]
    }
  }
];

const COMBAT_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_attack",
    description: "Attack a mob or player",
    inputSchema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "Entity ID" },
        targetName: { type: "string", description: "Or target name" },
        style: { type: "string", enum: ["accurate", "aggressive", "defensive", "controlled"], description: "Combat style" }
      }
    }
  },
  {
    name: "hyperscape_stop_combat",
    description: "Stop attacking",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_change_attack_style",
    description: "Change combat style",
    inputSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["attack", "strength", "defense", "ranged"], description: "Style" }
      },
      required: ["style"]
    }
  }
];

const GATHERING_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_gather",
    description: "Gather from resource (tree, fish)",
    inputSchema: {
      type: "object",
      properties: {
        resourceId: { type: "string", description: "Resource ID" },
        resourceType: { type: "string", enum: ["tree", "fish"], description: "Type" }
      }
    }
  },
  {
    name: "hyperscape_chop_tree",
    description: "Chop a tree",
    inputSchema: {
      type: "object",
      properties: { treeId: { type: "string", description: "Tree ID" } }
    }
  },
  {
    name: "hyperscape_fish",
    description: "Fish at a spot",
    inputSchema: {
      type: "object",
      properties: { spotId: { type: "string", description: "Spot ID" } }
    }
  }
];

const ITEM_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_equip_item",
    description: "Equip item from inventory",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        slot: { type: "string", enum: ["weapon", "shield", "helmet", "body", "legs", "boots", "gloves", "cape", "amulet", "ring", "arrows"], description: "Slot" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_unequip_item",
    description: "Unequip an item from an equipment slot",
    inputSchema: {
      type: "object",
      properties: {
        slot: { type: "string", enum: ["weapon", "shield", "helmet", "body", "legs", "boots", "gloves", "cape", "amulet", "ring", "arrows"], description: "Equipment slot to unequip" }
      },
      required: ["slot"]
    }
  },
  {
    name: "hyperscape_use_item",
    description: "Use an item",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        targetItemId: { type: "string", description: "Target item" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_drop_item",
    description: "Drop an item",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        quantity: { type: "number", description: "Amount", minimum: 1 }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_pickup_item",
    description: "Pick up ground item",
    inputSchema: {
      type: "object",
      properties: { itemId: { type: "string", description: "Item ID" } },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_loot_corpse",
    description: "Loot a corpse",
    inputSchema: {
      type: "object",
      properties: { corpseId: { type: "string", description: "Corpse ID" } },
      required: ["corpseId"]
    }
  }
];

const BANKING_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_open_bank",
    description: "Open bank",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_deposit",
    description: "Deposit item to bank",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        quantity: { type: "number", description: "Amount", minimum: 1 }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_withdraw",
    description: "Withdraw item from bank",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        quantity: { type: "number", description: "Amount", minimum: 1 }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_deposit_all",
    description: "Deposit all items from inventory to bank",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_deposit_coins",
    description: "Deposit coins/gold to bank",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount of coins", minimum: 1 }
      },
      required: ["amount"]
    }
  },
  {
    name: "hyperscape_withdraw_coins",
    description: "Withdraw coins/gold from bank",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount of coins", minimum: 1 }
      },
      required: ["amount"]
    }
  }
];

const SOCIAL_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_chat",
    description: "Send chat message",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Message" } },
      required: ["message"]
    }
  },
  {
    name: "hyperscape_local_chat",
    description: "Send local chat message (nearby players only)",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Message" } },
      required: ["message"]
    }
  },
  {
    name: "hyperscape_whisper",
    description: "Send private message to a player",
    inputSchema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "Target player ID or name" },
        message: { type: "string", description: "Message" }
      },
      required: ["targetId", "message"]
    }
  },
  {
    name: "hyperscape_emote",
    description: "Perform emote",
    inputSchema: {
      type: "object",
      properties: {
        emote: { type: "string", enum: ["wave", "dance", "bow", "cheer", "cry", "laugh", "sit"], description: "Emote" }
      },
      required: ["emote"]
    }
  },
  {
    name: "hyperscape_interact_npc",
    description: "Interact with NPC",
    inputSchema: {
      type: "object",
      properties: {
        npcId: { type: "string", description: "NPC ID" },
        npcName: { type: "string", description: "Or NPC name" }
      }
    }
  },
  {
    name: "hyperscape_dialogue_respond",
    description: "Select a dialogue response option",
    inputSchema: {
      type: "object",
      properties: {
        responseIndex: { type: "number", description: "Response option index (0-based)", minimum: 0 }
      },
      required: ["responseIndex"]
    }
  }
];

const STORE_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_store_buy",
    description: "Buy an item from a store/shop NPC",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID to buy" },
        quantity: { type: "number", description: "Quantity to buy", minimum: 1 }
      },
      required: ["itemId"]
    }
  },
  {
    name: "hyperscape_store_sell",
    description: "Sell an item to a store/shop NPC",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID to sell" },
        quantity: { type: "number", description: "Quantity to sell", minimum: 1 }
      },
      required: ["itemId"]
    }
  }
];

const QUERY_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_get_status",
    description: "Get player status (health, position, combat state)",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_get_inventory",
    description: "Get player inventory contents",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_get_nearby",
    description: "Get nearby entities (mobs, resources, items, players)",
    inputSchema: {
      type: "object",
      properties: { range: { type: "number", description: "Search range", minimum: 5, maximum: 100 } }
    }
  },
  {
    name: "hyperscape_get_skills",
    description: "Get player skill levels",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_get_equipment",
    description: "Get equipped items",
    inputSchema: { type: "object", properties: {} }
  }
];

const WORLD_TOOLS: MCPTool[] = [
  {
    name: "hyperscape_look_around",
    description: "Get description of surroundings",
    inputSchema: {
      type: "object",
      properties: { range: { type: "number", description: "Range", minimum: 5, maximum: 100 } }
    }
  },
  {
    name: "hyperscape_examine",
    description: "Examine an entity",
    inputSchema: {
      type: "object",
      properties: { entityId: { type: "string", description: "Entity ID" } },
      required: ["entityId"]
    }
  },
  {
    name: "hyperscape_respawn",
    description: "Respawn after death",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hyperscape_set_goal",
    description: "Set gameplay goal",
    inputSchema: {
      type: "object",
      properties: {
        goalType: { type: "string", enum: ["combat_training", "woodcutting", "fishing", "exploration"], description: "Goal type" },
        target: { type: "string", description: "Target" }
      },
      required: ["goalType"]
    }
  }
];

const ALL_TOOLS = [
  ...MOVEMENT_TOOLS,
  ...COMBAT_TOOLS,
  ...GATHERING_TOOLS,
  ...ITEM_TOOLS,
  ...BANKING_TOOLS,
  ...STORE_TOOLS,
  ...SOCIAL_TOOLS,
  ...QUERY_TOOLS,
  ...WORLD_TOOLS
];

// ============================================
// MCP Server Implementation
// ============================================

export class HyperscapeMCPServer {
  private service: HyperscapeService;
  private sessionId: string;

  constructor(service: HyperscapeService, sessionId?: string) {
    this.service = service;
    this.sessionId = sessionId ?? `mcp-${Date.now()}`;
  }

  listTools(): MCPTool[] {
    return ALL_TOOLS;
  }

  listResources(): MCPResource[] {
    const playerId = this.service.getPlayerEntity()?.id ?? "unknown";
    return [
      { uri: `hyperscape://player/${playerId}/status`, name: "Player Status", description: "Health, stamina, position, combat", mimeType: "application/json" },
      { uri: `hyperscape://player/${playerId}/inventory`, name: "Inventory", description: "28-slot inventory", mimeType: "application/json" },
      { uri: `hyperscape://player/${playerId}/equipment`, name: "Equipment", description: "Equipped items", mimeType: "application/json" },
      { uri: `hyperscape://player/${playerId}/skills`, name: "Skills", description: "Skill levels and XP", mimeType: "application/json" },
      { uri: `hyperscape://world/nearby`, name: "Nearby Entities", description: "Mobs, resources, items, players", mimeType: "application/json" },
      { uri: `hyperscape://world/scene`, name: "World Scene", description: "Semantic surroundings", mimeType: "text/plain" },
      { uri: `hyperscape://player/${playerId}/goal`, name: "Current Goal", description: "Gameplay goal", mimeType: "application/json" }
    ];
  }

  listPrompts(): MCPPrompt[] {
    return [
      { name: "gameplay_decision", description: "Get gameplay decision prompt", arguments: [{ name: "situation", description: "Current situation", required: false }] },
      { name: "combat_strategy", description: "Get combat strategy", arguments: [{ name: "enemy", description: "Enemy type", required: false }] },
      { name: "exploration_guide", description: "Get exploration guidance", arguments: [{ name: "destination", description: "Destination", required: false }] }
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.service.isConnected()) {
      return this.error("Not connected to game server");
    }

    const player = this.service.getPlayerEntity();
    if (!player && name !== "hyperscape_respawn") {
      return this.error("Player not in game world");
    }

    // Route to appropriate handler
    const handlers: Record<string, () => Promise<MCPToolResult>> = {
      // Movement
      hyperscape_move_to: () => this.handleMoveTo(args),
      hyperscape_move_direction: () => this.handleMoveDirection(args),
      // Combat
      hyperscape_attack: () => this.handleAttack(args),
      hyperscape_stop_combat: () => this.handleStopCombat(),
      hyperscape_change_attack_style: () => this.handleChangeStyle(args),
      // Gathering
      hyperscape_gather: () => this.handleGather(args, "tree"),
      hyperscape_chop_tree: () => this.handleGather(args, "tree"),
      hyperscape_fish: () => this.handleGather(args, "fish"),
      // Items
      hyperscape_equip_item: () => this.handleEquip(args),
      hyperscape_unequip_item: () => this.handleUnequip(args),
      hyperscape_use_item: () => this.handleUseItem(args),
      hyperscape_drop_item: () => this.handleDropItem(args),
      hyperscape_pickup_item: () => this.handlePickupItem(args),
      hyperscape_loot_corpse: () => this.handleLootCorpse(args),
      // Banking
      hyperscape_open_bank: () => this.handleOpenBank(),
      hyperscape_deposit: () => this.handleBankDeposit(args),
      hyperscape_withdraw: () => this.handleBankWithdraw(args),
      hyperscape_deposit_all: () => this.handleBankDepositAll(),
      hyperscape_deposit_coins: () => this.handleBankDepositCoins(args),
      hyperscape_withdraw_coins: () => this.handleBankWithdrawCoins(args),
      // Store
      hyperscape_store_buy: () => this.handleStoreBuy(args),
      hyperscape_store_sell: () => this.handleStoreSell(args),
      // Social
      hyperscape_chat: () => this.handleChat(args),
      hyperscape_local_chat: () => this.handleLocalChat(args),
      hyperscape_whisper: () => this.handleWhisper(args),
      hyperscape_emote: () => this.handleEmote(args),
      hyperscape_interact_npc: () => this.handleInteractNpc(args),
      hyperscape_dialogue_respond: () => this.handleDialogueRespond(args),
      // World
      hyperscape_look_around: () => this.handleLookAround(),
      hyperscape_examine: () => this.handleExamine(args),
      hyperscape_respawn: () => this.handleRespawn(),
      hyperscape_set_goal: () => this.handleSetGoal(args),
      // Queries
      hyperscape_get_status: () => this.handleGetStatus(),
      hyperscape_get_inventory: () => this.handleGetInventory(),
      hyperscape_get_nearby: () => this.handleGetNearby(args),
      hyperscape_get_skills: () => this.handleGetSkills(),
      hyperscape_get_equipment: () => this.handleGetEquipment()
    };

    const handler = handlers[name];
    if (!handler) {
      return this.error(`Unknown tool: ${name}`);
    }

    return handler();
  }

  async readResource(uri: string): Promise<{ contents: MCPResourceContent[] }> {
    const player = this.service.getPlayerEntity();
    const parts = uri.replace("hyperscape://", "").split("/");

    if (parts[0] === "player") {
      const category = parts[2];
      switch (category) {
        case "status":
          return { contents: [this.json(uri, player ? getPlayerStatus(player) : { status: "not_in_game" })] };
        case "inventory":
          return { contents: [this.json(uri, player?.items ?? [])] };
        case "equipment":
          return { contents: [this.json(uri, player?.equipment ?? {})] };
        case "skills":
          return { contents: [this.json(uri, this.getSkillsSummary())] };
        case "goal":
          return { contents: [this.json(uri, this.service.getBehaviorManager()?.getGoal() ?? null)] };
      }
    }

    if (parts[0] === "world") {
      switch (parts[1]) {
        case "nearby":
          return { contents: [this.json(uri, this.getNearbyData())] };
        case "scene":
          return { contents: [this.text(uri, this.getSceneDescription())] };
      }
    }

    return { contents: [this.text(uri, "Resource not found")] };
  }

  // ============================================
  // Tool Handlers
  // ============================================

  private async handleMoveTo(args: Record<string, unknown>): Promise<MCPToolResult> {
    const x = Number(args.x ?? 0);
    const y = Number(args.y ?? 0);
    const z = Number(args.z ?? 0);
    const runMode = Boolean(args.run);

    await this.service.executeMove({ target: [x, y, z], runMode });
    return this.success(`Moving to [${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}]${runMode ? " (running)" : ""}`);
  }

  private async handleMoveDirection(args: Record<string, unknown>): Promise<MCPToolResult> {
    const direction = String(args.direction ?? "north");
    const tiles = Number(args.distance ?? 10);
    const distance = tiles * 5; // 1 tile = ~5 units

    const player = this.service.getPlayerEntity();
    if (!player?.position) {
      return this.error("Cannot determine position");
    }

    const { dx, dz } = directionToOffset(direction, distance);
    const [px, py, pz] = player.position;

    await this.service.executeMove({ target: [px + dx, py, pz + dz] });
    return this.success(`Moving ${direction} for ${tiles} tiles`);
  }

  private async handleAttack(args: Record<string, unknown>): Promise<MCPToolResult> {
    let entityId = String(args.targetId ?? "");
    const targetName = String(args.targetName ?? "");

    // Find by name if no ID
    if (!entityId && targetName) {
      const target = this.service.getNearbyEntities().find(e =>
        e.name?.toLowerCase().includes(targetName.toLowerCase())
      );
      if (target) entityId = target.id;
    }

    // Find closest mob if still no target
    if (!entityId) {
      const mobs = this.service.getNearbyEntities().filter(e => "mobType" in e);
      if (mobs.length > 0) entityId = mobs[0].id;
    }

    if (!entityId) {
      return this.error("No valid target found");
    }

    await this.service.executeAttack({ targetEntityId: entityId });
    return this.success(`Attacking ${entityId}`);
  }

  private async handleStopCombat(): Promise<MCPToolResult> {
    // Combat stops automatically when player moves away or target dies
    // Moving to current position is a workaround to interrupt attack animation
    const player = this.service.getPlayerEntity();
    if (player?.position) {
      await this.service.executeMove({ target: player.position });
      return this.success("Combat interrupted (moved to disengage)");
    }
    return this.error("Cannot stop combat - player position unknown");
  }

  private async handleChangeStyle(args: Record<string, unknown>): Promise<MCPToolResult> {
    const style = String(args.style ?? "attack") as "attack" | "strength" | "defense" | "ranged";
    await this.service.executeChangeAttackStyle({ style });
    return this.success(`Attack style set to ${style}`);
  }

  private async handleGather(args: Record<string, unknown>, type: string): Promise<MCPToolResult> {
    let entityId = String(args.resourceId ?? args.treeId ?? args.spotId ?? "");

    if (!entityId) {
      const resources = this.service.getNearbyEntities().filter(e => {
        const ea = e as unknown as Record<string, unknown>;
        return ea.resourceType === type || (e.name && e.name.toLowerCase().includes(type));
      });
      if (resources.length > 0) entityId = resources[0].id;
    }

    if (!entityId) {
      return this.error(`No ${type} found nearby`);
    }

    await this.service.executeGatherResource({
      resourceEntityId: entityId,
      skill: type === "tree" ? "woodcutting" : "fishing"
    });
    return this.success(`Gathering ${type}`);
  }

  private async handleEquip(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    const slot = String(args.slot ?? "weapon");

    await this.service.executeEquipItem({ itemId, equipSlot: slot as keyof Equipment });
    return this.success(`Equipped ${itemId}`);
  }

  private async handleUnequip(args: Record<string, unknown>): Promise<MCPToolResult> {
    const slot = String(args.slot ?? "weapon");
    const player = this.service.getPlayerEntity();
    const equipped = player?.equipment?.[slot as keyof Equipment];
    
    if (!equipped) {
      return this.error(`Nothing equipped in ${slot} slot`);
    }
    
    await this.service.executeUnequipItem(slot);
    return this.success(`Unequipped ${equipped} from ${slot}`);
  }

  private async handleUseItem(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    await this.service.executeUseItem({ itemId });
    return this.success(`Used ${itemId}`);
  }

  private async handleDropItem(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    if (!itemId) {
      return this.error("Item ID required");
    }
    // Check if item exists in inventory
    const player = this.service.getPlayerEntity();
    const item = player?.items?.find(i => i.id === itemId || i.name?.toLowerCase().includes(itemId.toLowerCase()));
    if (!item) {
      return this.error(`Item '${itemId}' not found in inventory`);
    }
    await this.service.executeDropItem({ itemId: item.id });
    return this.success(`Dropped ${item.name}`);
  }

  private async handlePickupItem(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    if (!itemId) {
      return this.error("Item ID required");
    }
    // Check if item exists nearby
    const entity = this.service.getNearbyEntities().find(e => 
      e.id === itemId || e.name?.toLowerCase().includes(itemId.toLowerCase())
    );
    if (!entity) {
      return this.error(`Item '${itemId}' not found nearby`);
    }
    await this.service.executePickupItem({ entityId: entity.id });
    return this.success(`Picked up ${entity.name}`);
  }

  private async handleLootCorpse(args: Record<string, unknown>): Promise<MCPToolResult> {
    const corpseId = String(args.corpseId ?? "");
    if (!corpseId) {
      return this.error("Corpse ID required");
    }
    // Find corpse nearby
    const corpse = this.service.getNearbyEntities().find(e =>
      e.id === corpseId || (e.name?.toLowerCase().includes("corpse") && e.id.includes(corpseId))
    );
    if (!corpse) {
      return this.error(`Corpse '${corpseId}' not found nearby`);
    }
    await this.service.executeLootCorpse({ corpseId: corpse.id });
    return this.success(`Looting ${corpse.name}`);
  }

  private async handleOpenBank(): Promise<MCPToolResult> {
    // Player must be near a bank booth/banker NPC
    const banker = this.service.getNearbyEntities().find(e =>
      e.name?.toLowerCase().includes("bank")
    );
    if (!banker) {
      return this.error("No bank nearby - move closer to a bank first");
    }
    // Bank opens when you interact with it - just confirm player is nearby
    return this.success("Bank is accessible - use deposit/withdraw commands");
  }

  private async handleBankDeposit(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    const amount = Number(args.quantity ?? 1);
    if (!itemId) {
      return this.error("Item ID required");
    }
    await this.service.executeBankDeposit(itemId, amount);
    return this.success(`Deposited ${amount}x ${itemId}`);
  }

  private async handleBankWithdraw(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    const amount = Number(args.quantity ?? 1);
    if (!itemId) {
      return this.error("Item ID required");
    }
    await this.service.executeBankWithdraw(itemId, amount);
    return this.success(`Withdrew ${amount}x ${itemId}`);
  }

  private async handleBankDepositAll(): Promise<MCPToolResult> {
    const player = this.service.getPlayerEntity();
    const itemCount = player?.items?.length ?? 0;
    if (itemCount === 0) {
      return this.error("No items to deposit");
    }
    await this.service.executeBankDepositAll();
    return this.success(`Deposited all ${itemCount} items`);
  }

  private async handleBankDepositCoins(args: Record<string, unknown>): Promise<MCPToolResult> {
    const amount = Number(args.amount ?? 0);
    if (amount <= 0) {
      return this.error("Amount must be positive");
    }
    const player = this.service.getPlayerEntity();
    const coins = player?.coins ?? 0;
    if (coins < amount) {
      return this.error(`Only ${coins} coins available`);
    }
    await this.service.executeBankDepositCoins(amount);
    return this.success(`Deposited ${amount} coins`);
  }

  private async handleBankWithdrawCoins(args: Record<string, unknown>): Promise<MCPToolResult> {
    const amount = Number(args.amount ?? 0);
    if (amount <= 0) {
      return this.error("Amount must be positive");
    }
    await this.service.executeBankWithdrawCoins(amount);
    return this.success(`Withdrew ${amount} coins`);
  }

  private async handleStoreBuy(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    const quantity = Number(args.quantity ?? 1);
    if (!itemId) {
      return this.error("Item ID required");
    }
    // Check for store NPCs nearby
    const storeNpc = this.service.getNearbyEntities().find(e => {
      const name = e.name?.toLowerCase() ?? "";
      return name.includes("shop") || name.includes("store") || name.includes("merchant");
    });
    if (!storeNpc) {
      return this.error("No store nearby - move closer to a shop");
    }
    await this.service.executeStoreBuy(itemId, quantity);
    return this.success(`Buying ${quantity}x ${itemId}`);
  }

  private async handleStoreSell(args: Record<string, unknown>): Promise<MCPToolResult> {
    const itemId = String(args.itemId ?? "");
    const quantity = Number(args.quantity ?? 1);
    if (!itemId) {
      return this.error("Item ID required");
    }
    // Check item exists in inventory
    const player = this.service.getPlayerEntity();
    const item = player?.items?.find(i => i.id === itemId || i.name?.toLowerCase().includes(itemId.toLowerCase()));
    if (!item) {
      return this.error(`Item '${itemId}' not found in inventory`);
    }
    await this.service.executeStoreSell(item.id, quantity);
    return this.success(`Selling ${quantity}x ${item.name}`);
  }

  private async handleLocalChat(args: Record<string, unknown>): Promise<MCPToolResult> {
    const message = String(args.message ?? "");
    await this.service.executeChatMessage({ message, chatType: "local" });
    return this.success(`Local: "${message}"`);
  }

  private async handleWhisper(args: Record<string, unknown>): Promise<MCPToolResult> {
    const targetId = String(args.targetId ?? "");
    const message = String(args.message ?? "");
    if (!targetId || !message) {
      return this.error("Target and message required");
    }
    await this.service.executeChatMessage({ message, chatType: "whisper", targetId });
    return this.success(`Whispered to ${targetId}: "${message}"`);
  }

  private async handleDialogueRespond(args: Record<string, unknown>): Promise<MCPToolResult> {
    const responseIndex = Number(args.responseIndex ?? 0);
    await this.service.executeDialogueResponse(responseIndex);
    return this.success(`Selected dialogue option ${responseIndex + 1}`);
  }

  private async handleEmote(args: Record<string, unknown>): Promise<MCPToolResult> {
    const emote = String(args.emote ?? "wave");
    await this.service.executeEmote({ emote });
    return this.success(`Performed ${emote} emote`);
  }

  private async handleInteractNpc(args: Record<string, unknown>): Promise<MCPToolResult> {
    let npcId = String(args.npcId ?? "");
    const npcName = String(args.npcName ?? "");
    
    if (!npcId && npcName) {
      const npc = this.service.getNearbyEntities().find(e =>
        e.name?.toLowerCase().includes(npcName.toLowerCase())
      );
      if (npc) npcId = npc.id;
    }
    
    if (!npcId) {
      return this.error("NPC not found nearby");
    }
    await this.service.executeInteractNpc({ npcId });
    return this.success(`Interacting with NPC`);
  }

  private async handleRespawn(): Promise<MCPToolResult> {
    const player = this.service.getPlayerEntity();
    if (player?.alive !== false) {
      return this.error("Cannot respawn - player is not dead");
    }
    await this.service.executeRespawn();
    return this.success("Respawning at nearest town");
  }

  private async handleChat(args: Record<string, unknown>): Promise<MCPToolResult> {
    const message = String(args.message ?? "");
    await this.service.executeChatMessage({ message });
    return this.success(`Sent: "${message}"`);
  }

  private async handleLookAround(): Promise<MCPToolResult> {
    return this.success(this.getSceneDescription());
  }

  private async handleExamine(args: Record<string, unknown>): Promise<MCPToolResult> {
    const entityId = String(args.entityId ?? "");
    const entity = this.service.getNearbyEntities().find(e => e.id === entityId);

    if (!entity) {
      return this.error("Entity not found");
    }

    return this.success(this.describeEntity(entity));
  }

  private async handleSetGoal(args: Record<string, unknown>): Promise<MCPToolResult> {
    const goalType = String(args.goalType ?? "exploration");
    const target = String(args.target ?? "");

    const behaviorManager = this.service.getBehaviorManager();
    if (!behaviorManager) {
      return this.error("Behavior manager not available");
    }

    behaviorManager.setGoal({
      type: goalType as "combat_training" | "woodcutting" | "exploration" | "idle",
      description: `${goalType}: ${target || "general"}`,
      target: 10,
      progress: 0,
      startedAt: Date.now()
    });

    return this.success(`Goal set: ${goalType}${target ? ` - ${target}` : ""}`);
  }

  private async handleGetStatus(): Promise<MCPToolResult> {
    const player = this.service.getPlayerEntity();
    if (!player) {
      return this.error("Not in game");
    }

    const status = getPlayerStatus(player);
    const [x, , z] = status.position;
    const lines = [
      `Health: ${status.health.current}/${status.health.max}`,
      `Position: [${x.toFixed(0)}, ${z.toFixed(0)}]`,
      `Alive: ${status.alive ? "Yes" : "No"}`,
      `In Combat: ${status.inCombat ? "Yes" : "No"}`
    ];

    return this.success(lines.join("\n"));
  }

  private async handleGetInventory(): Promise<MCPToolResult> {
    const player = this.service.getPlayerEntity();
    if (!player) {
      return this.error("Not in game");
    }

    const items = player.items ?? [];
    if (items.length === 0) {
      return this.success("Inventory is empty");
    }

    const lines = items.map(item => {
      const qty = (item as { quantity?: number }).quantity ?? 1;
      return `• ${item.name}${qty > 1 ? ` x${qty}` : ""}`;
    });

    return this.success(`Inventory (${items.length}/28):\n${lines.join("\n")}`);
  }

  private async handleGetNearby(args: Record<string, unknown>): Promise<MCPToolResult> {
    const range = Number(args.range ?? 30);
    const data = this.getNearbyData();

    const lines: string[] = [];
    
    if (data.mobs.length > 0) {
      lines.push(`Mobs (${data.mobs.length}):`);
      data.mobs.slice(0, 10).forEach(m => {
        const mob = m as { name?: string; distance?: number; direction?: string };
        lines.push(`  • ${mob.name} - ${mob.distance}m ${mob.direction ?? ""}`);
      });
    }

    if (data.resources.length > 0) {
      lines.push(`Resources (${data.resources.length}):`);
      data.resources.slice(0, 10).forEach(r => {
        const res = r as { name?: string; distance?: number };
        lines.push(`  • ${res.name} - ${res.distance}m`);
      });
    }

    if (data.items.length > 0) {
      lines.push(`Ground Items (${data.items.length}):`);
      data.items.slice(0, 10).forEach(i => {
        const item = i as { name?: string; distance?: number };
        lines.push(`  • ${item.name} - ${item.distance}m`);
      });
    }

    if (data.players.length > 0) {
      lines.push(`Players (${data.players.length}):`);
      data.players.slice(0, 10).forEach(p => {
        const player = p as { name?: string; distance?: number };
        lines.push(`  • ${player.name} - ${player.distance}m`);
      });
    }

    if (lines.length === 0) {
      return this.success(`Nothing found within ${range}m`);
    }

    return this.success(lines.join("\n"));
  }

  private async handleGetSkills(): Promise<MCPToolResult> {
    const skillsData = this.getSkillsSummary();
    const skills = skillsData.skills as Record<string, { level: number; xp: number }> | undefined;

    if (!skills || Object.keys(skills).length === 0) {
      return this.success("No skills data available");
    }

    const lines = [
      `Combat Level: ${skillsData.combatLevel}`,
      `Total Level: ${skillsData.totalLevel}`,
      "",
      "Skills:"
    ];

    for (const [name, data] of Object.entries(skills)) {
      lines.push(`  ${name}: ${data.level} (${data.xp} XP)`);
    }

    return this.success(lines.join("\n"));
  }

  private async handleGetEquipment(): Promise<MCPToolResult> {
    const player = this.service.getPlayerEntity();
    if (!player) {
      return this.error("Not in game");
    }

    const equipment = player.equipment;
    if (!equipment) {
      return this.success("No equipment data");
    }

    const lines = ["Equipment:"];
    for (const [slot, item] of Object.entries(equipment)) {
      if (item) {
        const itemData = item as { name?: string };
        lines.push(`  ${slot}: ${itemData.name ?? "Unknown"}`);
      }
    }

    if (lines.length === 1) {
      return this.success("Nothing equipped");
    }

    return this.success(lines.join("\n"));
  }

  // ============================================
  // Helpers
  // ============================================

  private success(text: string): MCPToolResult {
    return { success: true, content: [{ type: "text", text }] };
  }

  private error(text: string): MCPToolResult {
    return { success: false, content: [{ type: "text", text }] };
  }

  private json(uri: string, data: unknown): MCPResourceContent {
    return { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) };
  }

  private text(uri: string, content: string): MCPResourceContent {
    return { uri, mimeType: "text/plain", text: content };
  }

  private getSkillsSummary(): Record<string, unknown> {
    const player = this.service.getPlayerEntity();
    if (!player?.skills) return {};

    const skillData: Record<string, { level: number; xp: number }> = {};
    let totalLevel = 0;

    for (const [name, skill] of Object.entries(player.skills)) {
      if (skill && typeof skill === "object" && "level" in skill) {
        skillData[name] = { level: skill.level, xp: skill.xp };
        totalLevel += skill.level;
      }
    }

    return {
      skills: skillData,
      totalLevel,
      combatLevel: calculateCombatLevel(player.skills)
    };
  }

  private getNearbyData(): Record<string, unknown[]> {
    const player = this.service.getPlayerEntity();
    const playerPos = player?.position ?? [0, 0, 0];
    const categorized = categorizeEntities(
      this.service.getNearbyEntities(),
      playerPos,
      player?.id
    );

    return {
      mobs: categorized.mobs.map(m => ({
        id: m.id, name: m.name, distance: Math.round(m.distance), direction: m.direction
      })),
      resources: categorized.resources.map(r => ({
        id: r.id, name: r.name, distance: Math.round(r.distance), direction: r.direction
      })),
      items: categorized.items.map(i => ({
        id: i.id, name: i.name?.replace("item:", ""), distance: Math.round(i.distance)
      })),
      players: categorized.players.map(p => ({
        id: p.id, name: p.name, distance: Math.round(p.distance)
      }))
    };
  }

  private getSceneDescription(): string {
    const player = this.service.getPlayerEntity();
    if (!player) return "Not in game world.";

    return generateSceneDescription(player, this.service.getNearbyEntities());
  }

  private describeEntity(entity: Entity): string {
    const lines = [`=== ${entity.name} ===`, `ID: ${entity.id}`];
    const ea = entity as unknown as Record<string, unknown>;

    if ("mobType" in entity) {
      lines.push(`Type: ${ea.mobType}`);
      lines.push(`Alive: ${ea.alive !== false ? "Yes" : "No"}`);
      if (ea.level) lines.push(`Level: ${ea.level}`);
    }

    if ("resourceType" in entity) {
      lines.push(`Resource: ${ea.resourceType}`);
    }

    if (entity.position) {
      lines.push(`Position: [${entity.position.map(n => n.toFixed(1)).join(", ")}]`);
    }

    return lines.join("\n");
  }
}
