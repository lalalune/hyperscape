/**
 * A2A Agent Card for Hyperscape RPG
 * Exposes game skills via A2A protocol for agent discovery
 */

export interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  preferredTransport: string;
  provider: {
    organization: string;
    url: string;
  };
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export function generateAgentCard(serverUrl: string): A2AAgentCard {
  return {
    protocolVersion: "0.3.0",
    name: "Hyperscape RPG Game Master",
    description:
      "AI-generated RuneScape-inspired MMORPG with combat, skills, resource gathering, and multiplayer. Built on Hyperscape 3D engine with blockchain integration.",
    url: `${serverUrl}/a2a`,
    preferredTransport: "JSONRPC",
    provider: {
      organization: "Hyperscape Network",
      url: serverUrl,
    },
    version: "0.13.0",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [
      {
        id: "join-game",
        name: "Join Game World",
        description:
          "Join the Hyperscape RPG world as a player. Creates a character and spawns in a random starter town.",
        tags: ["game", "join", "character"],
        examples: [
          "Join the RPG world",
          "Start playing Hyperscape",
          "Create my character",
          "Enter the game",
        ],
      },
      {
        id: "get-status",
        name: "Get Player Status",
        description:
          "Get comprehensive player state: health, position, skills, inventory, equipment, combat status, and nearby entities.",
        tags: ["status", "query", "info"],
        examples: [
          "What is my status?",
          "Show my character stats",
          "Get my current state",
          "Check my health and inventory",
        ],
      },
      {
        id: "move-to",
        name: "Move To Position",
        description:
          "Move character to a specific 3D position (x, y, z). Player will walk/run to the destination.",
        tags: ["movement", "navigation"],
        examples: [
          "Move to position 100, 50, 200",
          "Walk to coordinates 50, 0, -30",
          "Go to x:10 y:5 z:20",
        ],
      },
      {
        id: "attack",
        name: "Attack Target",
        description:
          "Attack a mob or player. Starts auto-combat. Requires weapon equipped. For ranged attacks, arrows required.",
        tags: ["combat", "attack", "pve"],
        examples: [
          "Attack the goblin",
          "Fight mob-123",
          "Start combat with dark warrior",
        ],
      },
      {
        id: "stop-attack",
        name: "Stop Combat",
        description: "Stop current auto-combat session.",
        tags: ["combat", "disengage"],
        examples: ["Stop attacking", "End combat", "Disengage"],
      },
      {
        id: "gather-resource",
        name: "Gather Resource",
        description:
          "Gather from a resource node (chop tree, fish). Requires appropriate tool equipped (hatchet for trees, fishing rod for fish).",
        tags: ["skills", "gathering", "woodcutting", "fishing"],
        examples: [
          "Chop the tree",
          "Fish at the lake",
          "Gather from resource-456",
        ],
      },
      {
        id: "use-item",
        name: "Use Inventory Item",
        description:
          "Use an item from inventory (eat food, light fire, cook fish). Different items have different effects.",
        tags: ["inventory", "items", "consume"],
        examples: [
          "Eat cooked fish",
          "Use tinderbox on logs",
          "Consume health potion",
        ],
      },
      {
        id: "equip-item",
        name: "Equip Item",
        description:
          "Equip a weapon, armor, or tool from inventory. Requires meeting level requirements.",
        tags: ["equipment", "gear"],
        examples: [
          "Equip bronze sword",
          "Wear steel armor",
          "Equip fishing rod",
        ],
      },
      {
        id: "unequip-item",
        name: "Unequip Item",
        description: "Remove equipped item and return it to inventory.",
        tags: ["equipment", "unequip"],
        examples: ["Unequip sword", "Remove helmet", "Take off armor"],
      },
      {
        id: "pickup-item",
        name: "Pick Up Ground Item",
        description:
          "Pick up an item from the ground. Requires inventory space.",
        tags: ["items", "loot", "inventory"],
        examples: [
          "Pick up the coins",
          "Loot the bronze sword",
          "Grab item-789",
        ],
      },
      {
        id: "drop-item",
        name: "Drop Item",
        description: "Drop an item from inventory onto the ground.",
        tags: ["inventory", "items"],
        examples: ["Drop 10 logs", "Drop bronze dagger", "Throw away raw fish"],
      },
      {
        id: "open-bank",
        name: "Open Bank",
        description:
          "Open bank interface to access stored items. Must be near a bank in a starter town.",
        tags: ["banking", "storage"],
        examples: [
          "Open the bank",
          "Access bank storage",
          "Open bank in Brookhaven",
        ],
      },
      {
        id: "deposit-item",
        name: "Deposit to Bank",
        description:
          "Deposit item from inventory into bank. Unlimited bank storage.",
        tags: ["banking", "storage"],
        examples: [
          "Deposit 100 logs to bank",
          "Bank my mithril armor",
          "Store these items",
        ],
      },
      {
        id: "withdraw-item",
        name: "Withdraw from Bank",
        description:
          "Withdraw item from bank to inventory. Requires inventory space.",
        tags: ["banking", "storage"],
        examples: [
          "Withdraw steel sword",
          "Get 50 arrows from bank",
          "Take out fishing rod",
        ],
      },
      {
        id: "buy-item",
        name: "Buy from Store",
        description:
          "Purchase item from general store. Requires coins. Stores sell tools (hatchet, fishing rod, tinderbox) and arrows.",
        tags: ["shop", "economy", "buy"],
        examples: [
          "Buy bronze hatchet",
          "Purchase 100 arrows",
          "Buy tinderbox",
        ],
      },
      {
        id: "sell-item",
        name: "Sell to Store",
        description: "Sell item from inventory to general store for coins.",
        tags: ["shop", "economy", "sell"],
        examples: ["Sell 50 logs", "Sell bronze sword", "Trade cooked fish"],
      },
      {
        id: "get-skills",
        name: "Get Skill Levels",
        description:
          "Get all skill levels and XP: Attack, Strength, Defense, Constitution, Range, Woodcutting, Fishing, Firemaking, Cooking.",
        tags: ["skills", "stats", "query"],
        examples: [
          "Show my skills",
          "What are my skill levels?",
          "Check my stats",
        ],
      },
      {
        id: "get-inventory",
        name: "Get Inventory",
        description: "Get current inventory contents (28 slots max).",
        tags: ["inventory", "items", "query"],
        examples: [
          "Show my inventory",
          "What items do I have?",
          "Check my backpack",
        ],
      },
      {
        id: "get-nearby-entities",
        name: "Get Nearby Entities",
        description:
          "Get all nearby mobs, players, resources, and items within range. Use for situational awareness.",
        tags: ["perception", "query", "environment"],
        examples: [
          "What's around me?",
          "Show nearby enemies",
          "List nearby resources",
        ],
      },
      {
        id: "change-attack-style",
        name: "Change Attack Style",
        description:
          "Switch combat style (accurate, aggressive, defensive, controlled). Affects XP distribution.",
        tags: ["combat", "style", "settings"],
        examples: [
          "Switch to aggressive style",
          "Use defensive combat",
          "Change to controlled",
        ],
      },
      // New skills for complete agent gameplay
      {
        id: "look-around",
        name: "Look Around",
        description:
          "Get a rich semantic description of your surroundings including location, nearby threats, resources, and opportunities.",
        tags: ["perception", "awareness", "exploration"],
        examples: [
          "Look around",
          "What do I see?",
          "Describe my surroundings",
          "What's happening around me?",
        ],
      },
      {
        id: "interact-npc",
        name: "Interact with NPC",
        description:
          "Talk to an NPC for quests, trading, or information. NPCs include bankers, shopkeepers, and quest givers.",
        tags: ["npc", "interaction", "quest", "dialogue"],
        examples: [
          "Talk to the banker",
          "Speak with the shopkeeper",
          "Interact with the guard",
        ],
      },
      {
        id: "loot-corpse",
        name: "Loot Corpse",
        description:
          "Loot items and coins from a defeated mob's corpse. Must be near the corpse.",
        tags: ["loot", "items", "combat"],
        examples: [
          "Loot the corpse",
          "Pick up the drops",
          "Collect loot from the goblin",
        ],
      },
      {
        id: "eat-food",
        name: "Eat Food",
        description:
          "Consume food from inventory to restore health. Cooked fish and other food items heal HP.",
        tags: ["healing", "food", "survival"],
        examples: ["Eat food", "Consume cooked fish", "Heal myself"],
      },
      {
        id: "emote",
        name: "Perform Emote",
        description:
          "Perform an animation/emote for social interaction: wave, dance, bow, cheer, cry, laugh, sit.",
        tags: ["social", "emote", "animation"],
        examples: ["Wave at everyone", "Do a dance", "Bow respectfully"],
      },
      {
        id: "respawn",
        name: "Respawn",
        description:
          "Respawn at the nearest safe town after dying. Only available when dead.",
        tags: ["death", "respawn", "revival"],
        examples: ["Respawn", "Come back to life", "Return to town"],
      },
      {
        id: "set-goal",
        name: "Set Goal",
        description:
          "Set your current gameplay goal for focused decision making: combat_training, woodcutting, fishing, exploration.",
        tags: ["goal", "planning", "strategy"],
        examples: [
          "Set goal to train combat",
          "Focus on woodcutting",
          "Goal: explore the world",
        ],
      },
      {
        id: "get-world-context",
        name: "Get World Context",
        description:
          "Get a comprehensive narrative of your current situation including location, threats, opportunities, and suggested actions.",
        tags: ["context", "awareness", "planning"],
        examples: [
          "What should I do?",
          "Give me context",
          "Describe my situation",
        ],
      },
      {
        id: "move-direction",
        name: "Move Direction",
        description:
          "Move in a cardinal direction (north, south, east, west, northeast, etc.) for a specified distance.",
        tags: ["movement", "navigation", "direction"],
        examples: ["Go north", "Move east for 10 tiles", "Walk southwest"],
      },
      {
        id: "examine",
        name: "Examine Entity",
        description:
          "Examine a specific entity (mob, player, item, resource) to get detailed information about it.",
        tags: ["examine", "inspect", "query"],
        examples: [
          "Examine the goblin",
          "Inspect the tree",
          "Look at the sword",
        ],
      },
      {
        id: "mine-rock",
        name: "Mine Rock",
        description:
          "Mine ore from a rock. Requires a pickaxe equipped. Yields ores based on Mining level.",
        tags: ["skills", "gathering", "mining"],
        examples: [
          "Mine the rock",
          "Mine some copper ore",
          "Gather ore from the iron rock",
        ],
      },
      {
        id: "examine-inventory-item",
        name: "Examine Inventory Item",
        description:
          "Get detailed information about an item in your inventory.",
        tags: ["inventory", "examine", "query"],
        examples: [
          "Examine the sword in my inventory",
          "What is this item?",
          "Inspect my bronze axe",
        ],
      },
      // Chat and social skills
      {
        id: "send-chat",
        name: "Send Chat Message",
        description:
          "Send a global chat message visible to all players in the world.",
        tags: ["social", "chat", "communication"],
        examples: [
          "Say hello to everyone",
          "Send a message: Looking for group",
          "Chat: Anyone want to trade?",
        ],
      },
      {
        id: "send-local-chat",
        name: "Send Local Chat",
        description:
          "Send a message visible only to nearby players within chat range.",
        tags: ["social", "chat", "communication"],
        examples: [
          "Say hello to nearby players",
          "Local chat: Need help with this goblin",
          "Speak locally: Is anyone around?",
        ],
      },
      {
        id: "send-whisper",
        name: "Send Whisper",
        description: "Send a private message to a specific player.",
        tags: ["social", "chat", "whisper", "private"],
        examples: [
          "Whisper to Bob: Want to trade?",
          "Private message Alice: Meet at the bank",
          "Send whisper: Are you there?",
        ],
      },
      // Dialogue skills
      {
        id: "dialogue-respond",
        name: "Dialogue Response",
        description:
          "Select a dialogue option when talking to an NPC. Use the response index (0-based).",
        tags: ["npc", "dialogue", "interaction"],
        examples: [
          "Select option 1",
          "Choose the first dialogue option",
          "Respond with option 0",
        ],
      },
      {
        id: "close-dialogue",
        name: "Close Dialogue",
        description: "End the current dialogue with an NPC.",
        tags: ["npc", "dialogue", "interaction"],
        examples: [
          "Close the dialogue",
          "End conversation",
          "Stop talking to NPC",
        ],
      },
      // Trading skills
      {
        id: "trade-request",
        name: "Request Trade",
        description:
          "Request to trade with another player. Must be near the target player.",
        tags: ["trading", "economy", "multiplayer"],
        examples: [
          "Trade with Bob",
          "Request trade with player-123",
          "Start trading with that player",
        ],
      },
      {
        id: "trade-respond",
        name: "Respond to Trade",
        description:
          "Accept or decline an incoming trade request from another player.",
        tags: ["trading", "economy", "multiplayer"],
        examples: [
          "Accept the trade",
          "Decline trade request",
          "Say yes to trading",
        ],
      },
      {
        id: "trade-offer",
        name: "Set Trade Offer",
        description:
          "Add items or coins to your trade offer. Both players must confirm for trade to complete.",
        tags: ["trading", "economy", "multiplayer"],
        examples: [
          "Offer 5 logs",
          "Add 100 coins to trade",
          "Put bronze sword in trade",
        ],
      },
      {
        id: "trade-confirm",
        name: "Confirm Trade",
        description:
          "Confirm your trade offer. Both players must confirm for the trade to complete.",
        tags: ["trading", "economy", "multiplayer"],
        examples: ["Confirm the trade", "Accept the offer", "Finalize trade"],
      },
      {
        id: "trade-cancel",
        name: "Cancel Trade",
        description: "Cancel the current trade session.",
        tags: ["trading", "economy", "multiplayer"],
        examples: ["Cancel trade", "Abort trading", "Stop the trade"],
      },
    ],
  };
}
