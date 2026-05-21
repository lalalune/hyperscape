/**
 * Node Library — Declarative registry of all available scripting node types.
 *
 * Each NodeTypeDefinition declares its ports, fields, category, and visual
 * properties. The editor reads from this registry to build the palette,
 * create new nodes, and validate connections.
 *
 * Coverage: 31 triggers, 20 conditions, 33 actions, 8 flow, 22 math, 3 variable, 6 data = 123 total nodes
 * matching all TriggerEvaluator, ActionExecutor, ConditionEvaluator, and ScriptGraphInterpreter handlers.
 */

import type { FieldSchema } from "../gameModules/GameModule";
import type { PortDefinition } from "./types";

// ============== NODE TYPE DEFINITION ==============

/** Declares a node type available in the scripting palette. */
export interface NodeTypeDefinition {
  /** Unique type key (e.g. "trigger/onPlayerEnterZone") */
  type: string;
  /** Human-readable display label */
  label: string;
  /** Category for palette grouping and header color */
  category:
    | "trigger"
    | "condition"
    | "action"
    | "flow"
    | "math"
    | "variable"
    | "data";
  /** Hex color for the node header bar */
  color: string;
  /** Lucide icon name */
  icon: string;
  /** Short description for tooltips */
  description: string;
  /** Input ports (left side) */
  inputs: PortDefinition[];
  /** Output ports (right side) */
  outputs: PortDefinition[];
  /** Configurable fields shown in the node body / inspector */
  fields: FieldSchema[];
}

// ============== CATEGORY COLORS ==============

const CATEGORY_COLORS = {
  trigger: "#28D47A", // emerald / green
  condition: "#FF7A00", // amber / yellow
  action: "#2D8CFF", // blue
  flow: "#6D3AFF", // purple
  math: "#ec4899", // pink
  variable: "#14b8a6", // teal
  data: "#FF7A00", // orange
} as const;

// ============== HELPERS ==============

function flowIn(id = "flow_in"): PortDefinition {
  return { id, label: "In", type: "flow" };
}

function flowOut(id = "flow_out", label = "Out"): PortDefinition {
  return { id, label, type: "flow" };
}

function dataIn(
  id: string,
  label: string,
  dataType: PortDefinition["dataType"],
): PortDefinition {
  return { id, label, type: "data", dataType };
}

function dataOut(
  id: string,
  label: string,
  dataType: PortDefinition["dataType"],
): PortDefinition {
  return { id, label, type: "data", dataType };
}

// ============== TRIGGER NODES ==============

const TRIGGER_NODES: NodeTypeDefinition[] = [
  // ---- Zone triggers ----
  {
    type: "trigger/onPlayerEnterZone",
    label: "On Player Enter Zone",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "MapPin",
    description: "Fires when a player enters the specified zone",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("zone", "Zone", "string"),
    ],
    fields: [
      {
        key: "zoneId",
        label: "Zone",
        type: "string",
        section: "Config",
        required: true,
        description: "Zone identifier to watch",
      },
    ],
  },
  {
    type: "trigger/onPlayerLeaveZone",
    label: "On Player Leave Zone",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "MapPinOff",
    description: "Fires when a player leaves the specified zone",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("zone", "Zone", "string"),
    ],
    fields: [
      {
        key: "zoneId",
        label: "Zone",
        type: "string",
        section: "Config",
        required: true,
        description: "Zone identifier to watch",
      },
    ],
  },

  // ---- Combat triggers ----
  {
    type: "trigger/onMobKilled",
    label: "On Mob Killed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Skull",
    description: "Fires when a mob of the specified type is killed",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("killer", "Killer", "entity"),
      dataOut("mob", "Mob", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        description: "Mob type filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onCombatStarted",
    label: "On Combat Started",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Swords",
    description: "Fires when combat begins between two entities",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("attacker", "Attacker", "entity"),
      dataOut("target", "Target", "entity"),
    ],
    fields: [],
  },
  {
    type: "trigger/onCombatEnded",
    label: "On Combat Ended",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ShieldOff",
    description: "Fires when an entity leaves combat",
    inputs: [],
    outputs: [flowOut(), dataOut("entity", "Entity", "entity")],
    fields: [],
  },
  {
    type: "trigger/onPlayerDamaged",
    label: "On Player Damaged",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "HeartCrack",
    description: "Fires when a player takes damage",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("attacker", "Attacker", "entity"),
      dataOut("damage", "Damage", "number"),
    ],
    fields: [
      {
        key: "minDamage",
        label: "Min Damage",
        type: "number",
        section: "Config",
        description: "Only fire if damage >= this",
        config: { min: 0, step: 1 },
      },
    ],
  },
  {
    type: "trigger/onPlayerDied",
    label: "On Player Died",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Skull",
    description: "Fires when a player dies",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("killer", "Killer", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onPlayerRespawned",
    label: "On Player Respawned",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "RotateCcw",
    description: "Fires when a player respawns after death",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },
  {
    type: "trigger/onMobAggro",
    label: "On Mob Aggro",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "AlertTriangle",
    description: "Fires when a mob begins targeting a player",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("mob", "Mob", "entity"),
      dataOut("player", "Player", "entity"),
    ],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        description: "Mob type filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onMobDamaged",
    label: "On Mob Damaged",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Crosshair",
    description: "Fires when a mob takes damage",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("mob", "Mob", "entity"),
      dataOut("attacker", "Attacker", "entity"),
      dataOut("damage", "Damage", "number"),
    ],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        description: "Mob type filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onDuelCompleted",
    label: "On Duel Completed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Trophy",
    description: "Fires when a duel between two players finishes",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("winner", "Winner", "entity"),
      dataOut("loser", "Loser", "entity"),
    ],
    fields: [],
  },

  // ---- Item triggers ----
  {
    type: "trigger/onItemCollected",
    label: "On Item Collected",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Package",
    description: "Fires when a player picks up the specified item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
        description: "Item identifier to watch for",
      },
    ],
  },
  {
    type: "trigger/onItemDropped",
    label: "On Item Dropped",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "PackageMinus",
    description: "Fires when a player drops an item on the ground",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onItemEquipped",
    label: "On Item Equipped",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Shield",
    description: "Fires when a player equips gear into a slot",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
      dataOut("slot", "Slot", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onItemUsed",
    label: "On Item Used",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Hand",
    description: "Fires when a player uses a consumable item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },

  // ---- Quest triggers ----
  {
    type: "trigger/onQuestStarted",
    label: "On Quest Started",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "BookOpen",
    description: "Fires when a player begins a quest",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("questId", "Quest ID", "string"),
    ],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        description: "Quest filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onQuestProgressed",
    label: "On Quest Progressed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ListChecks",
    description: "Fires when a player advances a quest stage",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("questId", "Quest ID", "string"),
      dataOut("stage", "Stage", "string"),
    ],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        description: "Quest filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onQuestComplete",
    label: "On Quest Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ScrollText",
    description: "Fires when a player completes a quest",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("questId", "Quest ID", "string"),
    ],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
        description: "Quest identifier",
      },
    ],
  },

  // ---- Skill / level triggers ----
  {
    type: "trigger/onPlayerLevelUp",
    label: "On Player Level Up",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "TrendingUp",
    description: "Fires when a player gains a level in any skill",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("skill", "Skill", "string"),
      dataOut("level", "Level", "number"),
    ],
    fields: [
      {
        key: "skillId",
        label: "Skill Filter",
        type: "string",
        section: "Config",
        description: "Skill ID filter (empty = all)",
      },
    ],
  },

  // ---- NPC / interaction triggers ----
  {
    type: "trigger/onNPCInteraction",
    label: "On NPC Interaction",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "UserCheck",
    description: "Fires when a player interacts with an NPC",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("npc", "NPC", "entity"),
    ],
    fields: [
      {
        key: "npcId",
        label: "NPC ID",
        type: "string",
        section: "Config",
        description: "NPC filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onDialogueEnded",
    label: "On Dialogue Ended",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "MessageSquareX",
    description: "Fires when a dialogue conversation closes",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("npcId", "NPC ID", "string"),
    ],
    fields: [],
  },

  // ---- Resource / crafting triggers ----
  {
    type: "trigger/onResourceGathered",
    label: "On Resource Gathered",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Pickaxe",
    description:
      "Fires when a player gathers a resource (tree, ore, fish, etc.)",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("resourceType", "Resource", "string"),
      dataOut("position", "Position", "position"),
    ],
    fields: [
      {
        key: "resourceType",
        label: "Resource Type",
        type: "string",
        section: "Config",
        description: "Filter (empty = all)",
      },
    ],
  },
  {
    type: "trigger/onResourceDepleted",
    label: "On Resource Depleted",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "TreeDeciduous",
    description: "Fires when a resource node is fully harvested",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("position", "Position", "position"),
      dataOut("resourceType", "Resource", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onCraftingComplete",
    label: "On Crafting Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Hammer",
    description: "Fires when a player finishes crafting/processing an item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
      dataOut("skill", "Skill", "string"),
    ],
    fields: [],
  },

  // ---- Entity lifecycle triggers ----
  {
    type: "trigger/onEntityDeath",
    label: "On Entity Death",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Skull",
    description: "Fires when an entity (mob, NPC) dies",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("killer", "Killer", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        description: "Filter by mob type (empty = any)",
      },
    ],
  },
  {
    type: "trigger/onInteract",
    label: "On Interact",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "MousePointerClick",
    description: "Fires when a player interacts with this entity",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("entity", "Entity", "entity"),
    ],
    fields: [],
  },

  // ---- Economy triggers ----
  {
    type: "trigger/onStoreTransaction",
    label: "On Store Transaction",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ShoppingCart",
    description: "Fires when a player buys or sells at a store",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
      dataOut("action", "Action", "string"),
      dataOut("price", "Price", "number"),
    ],
    fields: [],
  },
  {
    type: "trigger/onTradeCompleted",
    label: "On Trade Completed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ArrowLeftRight",
    description: "Fires when a trade between two players completes",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("playerA", "Player A", "entity"),
      dataOut("playerB", "Player B", "entity"),
    ],
    fields: [],
  },
  {
    type: "trigger/onBankOpened",
    label: "On Bank Opened",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Landmark",
    description: "Fires when a player opens their bank",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },

  // ---- Entity lifecycle triggers ----
  {
    type: "trigger/onPlayerSpawned",
    label: "On Player Spawned",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "UserPlus",
    description: "Fires when a player spawns into the world",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },
  {
    type: "trigger/onEntitySpawned",
    label: "On Entity Spawned",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Sparkles",
    description: "Fires when any entity is spawned",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("entityType", "Type", "string"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onReady",
    label: "On Ready",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Play",
    description:
      "Fires once when this graph is attached to its entity (UE5 BeginPlay equivalent)",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },

  // ---- Prayer triggers ----
  {
    type: "trigger/onPrayerToggled",
    label: "On Prayer Toggled",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Church",
    description: "Fires when a player activates or deactivates a prayer",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("prayerId", "Prayer", "string"),
      dataOut("active", "Active", "boolean"),
    ],
    fields: [],
  },

  // ---- Timer ----
  {
    type: "trigger/onTimer",
    label: "On Timer",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Timer",
    description: "Fires after a specified delay or at a repeating interval",
    inputs: [],
    outputs: [flowOut()],
    fields: [
      {
        key: "delay",
        label: "Delay (s)",
        type: "number",
        section: "Config",
        required: true,
        default: 5,
        config: { min: 0.1, step: 0.1, unit: "s" },
      },
      {
        key: "repeat",
        label: "Repeat",
        type: "boolean",
        section: "Config",
        default: false,
      },
    ],
  },

  // ---- Movement triggers ----
  {
    type: "trigger/onMovementStarted",
    label: "On Movement Started",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Play",
    description: "Fires when the owning entity begins moving",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onMovementCompleted",
    label: "On Movement Completed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Flag",
    description: "Fires when the owning entity reaches its destination",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onTeleportCompleted",
    label: "On Teleport Completed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Sparkles",
    description: "Fires when a player finishes a teleport",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("position", "Position", "position"),
    ],
    fields: [],
  },
  {
    type: "trigger/onRunToggle",
    label: "On Run Toggle",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Footprints",
    description: "Fires when a player toggles run mode",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },
  {
    type: "trigger/onStaminaDepleted",
    label: "On Stamina Depleted",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "BatteryLow",
    description: "Fires when the owning entity's stamina reaches zero",
    inputs: [],
    outputs: [flowOut(), dataOut("entity", "Entity", "entity")],
    fields: [],
  },

  // ---- Health / damage triggers ----
  {
    type: "trigger/onPlayerHealthChanged",
    label: "On Player Health Changed",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Activity",
    description: "Fires whenever a player's health changes",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("health", "Health", "number"),
      dataOut("maxHealth", "Max Health", "number"),
    ],
    fields: [],
  },
  {
    type: "trigger/onEntityDamaged",
    label: "On Entity Damaged",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Swords",
    description: "Fires when the owning entity takes damage (any source)",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("entity", "Entity", "entity"),
      dataOut("damage", "Damage", "number"),
      dataOut("source", "Source", "entity"),
    ],
    fields: [],
  },

  // ---- Dialogue triggers ----
  {
    type: "trigger/onDialogueResponse",
    label: "On Dialogue Response",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "MessageCircleReply",
    description: "Fires when a player selects a dialogue option",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("npc", "NPC", "entity"),
      dataOut("responseId", "Response ID", "string"),
    ],
    fields: [
      {
        key: "npcId",
        label: "NPC ID",
        type: "string",
        section: "Config",
        description: "NPC filter (empty = any NPC)",
      },
      {
        key: "responseId",
        label: "Response ID",
        type: "string",
        section: "Config",
        description:
          "Filter by specific response ID (empty = fires on any response)",
      },
    ],
  },

  // ---- Player lifecycle triggers ----
  {
    type: "trigger/onPlayerJoined",
    label: "On Player Joined",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "UserPlus",
    description: "Fires when any player joins the world",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },
  {
    type: "trigger/onPlayerLeft",
    label: "On Player Left",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "UserMinus",
    description: "Fires when any player leaves the world",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },

  // ---- Aggro triggers ----
  {
    type: "trigger/onAggroTriggered",
    label: "On Aggro Triggered",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "AlertTriangle",
    description: "Fires when a mob acquires a player as a target",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("mob", "Mob", "entity"),
      dataOut("player", "Player", "entity"),
    ],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        description: "Mob type filter (empty = all)",
      },
    ],
  },

  // ---- Item / loot triggers ----
  {
    type: "trigger/onItemPickup",
    label: "On Item Pickup",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Package",
    description: "Fires when a player picks up a world item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onCorpseLoot",
    label: "On Corpse Loot",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Skull",
    description: "Fires when a player opens a corpse to loot it",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("corpseId", "Corpse ID", "string"),
    ],
    fields: [],
  },

  // ---- Banking triggers ----
  {
    type: "trigger/onBankDeposit",
    label: "On Bank Deposit",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ArrowDownToLine",
    description:
      "Fires when a player successfully deposits an item into the bank",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onBankWithdraw",
    label: "On Bank Withdraw",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ArrowUpFromLine",
    description:
      "Fires when a player successfully withdraws an item from the bank",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },

  // ---- Crafting skill triggers ----
  {
    type: "trigger/onCookingComplete",
    label: "On Cooking Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "ChefHat",
    description: "Fires when a player finishes cooking an item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onSmithingComplete",
    label: "On Smithing Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Hammer",
    description: "Fires when a player finishes smithing an item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onSmeltingComplete",
    label: "On Smelting Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Flame",
    description: "Fires when a player finishes smelting a bar",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onFletchingComplete",
    label: "On Fletching Complete",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Feather",
    description: "Fires when a player finishes fletching an item",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("player", "Player", "entity"),
      dataOut("itemId", "Item ID", "string"),
    ],
    fields: [],
  },
  {
    type: "trigger/onFiremakingSuccess",
    label: "On Firemaking Success",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Flame",
    description: "Fires when a player successfully lights a fire",
    inputs: [],
    outputs: [flowOut(), dataOut("player", "Player", "entity")],
    fields: [],
  },
  {
    type: "trigger/onCustomEvent",
    label: "On Custom Event",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "Radio",
    description:
      "Fires when a matching named custom event is emitted (e.g. by action/emitCustomEvent). Filters by event name.",
    inputs: [],
    outputs: [
      flowOut(),
      dataOut("eventName", "Event Name", "string"),
      dataOut("payload", "Payload", "string"),
    ],
    fields: [
      {
        key: "eventName",
        label: "Event Name",
        type: "string",
        section: "Config",
        required: true,
        description: "Only fires when the emitted event matches this name",
      },
    ],
  },
  {
    type: "trigger/onFunctionCall",
    label: "Function Entry",
    category: "trigger",
    color: CATEGORY_COLORS.trigger,
    icon: "LogIn",
    description:
      "Entry point for a function/sub-graph. Invoked by flow/callGraph — arguments passed by the caller are available via variable/get.",
    inputs: [],
    outputs: [flowOut()],
    fields: [],
  },
];

// ============== CONDITION NODES ==============

const CONDITION_NODES: NodeTypeDefinition[] = [
  // ---- Inventory conditions ----
  {
    type: "condition/hasItem",
    label: "Has Item",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Package",
    description: "Checks if the player has the specified item in inventory",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "quantity",
        label: "Min Quantity",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, step: 1 },
      },
    ],
  },
  {
    type: "condition/hasEquipped",
    label: "Has Equipped",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Shield",
    description: "Checks if the player has a specific item equipped",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "slot",
        label: "Slot",
        type: "string",
        section: "Config",
        description: "Equipment slot (empty = any)",
      },
    ],
  },
  {
    type: "condition/hasCoins",
    label: "Has Coins",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Coins",
    description: "Checks if the player has enough coins",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "amount",
        label: "Min Amount",
        type: "number",
        section: "Config",
        required: true,
        default: 1,
        config: { min: 0, step: 1 },
      },
    ],
  },

  // ---- Quest conditions ----
  {
    type: "condition/questState",
    label: "Quest State",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "ScrollText",
    description: "Checks the current state of a quest for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "state",
        label: "State",
        type: "select",
        section: "Config",
        required: true,
        config: {
          options: [
            { value: "not_started", label: "Not Started" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
          ],
        },
      },
    ],
  },

  // ---- Skill conditions ----
  {
    type: "condition/skillLevel",
    label: "Skill Level",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "TrendingUp",
    description: "Checks if a player's skill meets a minimum level",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "skillId",
        label: "Skill",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "minLevel",
        label: "Min Level",
        type: "number",
        section: "Config",
        required: true,
        default: 1,
        config: { min: 1, max: 99, step: 1 },
      },
    ],
  },

  // ---- Combat conditions ----
  {
    type: "condition/isInCombat",
    label: "Is In Combat",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Swords",
    description: "Checks if an entity is currently fighting",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "condition/isAlive",
    label: "Is Alive",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "HeartPulse",
    description: "Checks if an entity has HP > 0",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "condition/healthCheck",
    label: "Health Check",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Heart",
    description: "Checks entity health against a percentage threshold",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "threshold",
        label: "Threshold %",
        type: "slider",
        section: "Config",
        default: 50,
        config: { min: 0, max: 100, step: 5 },
      },
      {
        key: "comparison",
        label: "Comparison",
        type: "select",
        section: "Config",
        default: "below",
        config: {
          options: [
            { value: "below", label: "Below" },
            { value: "above", label: "Above" },
          ],
        },
      },
    ],
  },

  // ---- Zone / position conditions ----
  {
    type: "condition/isInZone",
    label: "Is In Zone",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "MapPin",
    description: "Checks if an entity is inside a specific zone",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "zoneId",
        label: "Zone ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Prayer conditions ----
  {
    type: "condition/isPrayerActive",
    label: "Is Prayer Active",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Church",
    description:
      "Checks if a specific prayer is currently active for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "prayerId",
        label: "Prayer ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Logic / comparison conditions ----
  {
    type: "condition/compareNumber",
    label: "Compare Number",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Scale",
    description: "Compares two numeric values",
    inputs: [flowIn(), dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        section: "Config",
        required: true,
        config: {
          options: [
            { value: "eq", label: "= Equal" },
            { value: "neq", label: "!= Not Equal" },
            { value: "gt", label: "> Greater Than" },
            { value: "gte", label: ">= Greater or Equal" },
            { value: "lt", label: "< Less Than" },
            { value: "lte", label: "<= Less or Equal" },
          ],
        },
      },
    ],
  },
  {
    type: "condition/compareString",
    label: "Compare String",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Type",
    description: "Compares two string values",
    inputs: [
      flowIn(),
      dataIn("left", "Left", "string"),
      dataIn("right", "Right", "string"),
    ],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        section: "Config",
        default: "equals",
        config: {
          options: [
            { value: "equals", label: "Equals" },
            { value: "contains", label: "Contains" },
            { value: "startsWith", label: "Starts With" },
            { value: "endsWith", label: "Ends With" },
          ],
        },
      },
    ],
  },
  {
    type: "condition/entityType",
    label: "Entity Type",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Tag",
    description:
      "Checks if an entity is a specific type (player, mob, NPC, etc.)",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "type",
        label: "Type",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "condition/and",
    label: "AND",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "GitMerge",
    description: "Passes flow only if both inputs received flow",
    inputs: [flowIn("a_in"), flowIn("b_in")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "condition/or",
    label: "OR",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "GitBranch",
    description: "Passes flow if either input received flow",
    inputs: [flowIn("a_in"), flowIn("b_in")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "condition/not",
    label: "NOT",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Ban",
    description: "Inverts a boolean value",
    inputs: [flowIn(), dataIn("value", "Value", "boolean")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "condition/random",
    label: "Random Chance",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Dice5",
    description: "Passes with a configurable random probability",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "chance",
        label: "Chance %",
        type: "slider",
        section: "Config",
        default: 50,
        config: { min: 0, max: 100, step: 1 },
      },
    ],
  },

  // ---- Entity conditions ----
  {
    type: "condition/entityExists",
    label: "Entity Exists",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Search",
    description:
      "Checks if an entity with the given ID currently exists in the world",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "entityId",
        label: "Entity ID",
        type: "string",
        section: "Config",
        description: "Defaults to trigger's entity if empty",
      },
    ],
  },
  {
    type: "condition/isMobAlive",
    label: "Is Mob Alive",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Heart",
    description: "Checks if the given mob entity is still alive",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "entityId",
        label: "Entity ID",
        type: "string",
        section: "Config",
        description: "Defaults to trigger's mob if empty",
      },
    ],
  },
  {
    type: "condition/isPlayerInRange",
    label: "Is Player In Range",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Target",
    description:
      "Checks if the acting player is within a radius of a given position",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "x",
        label: "X",
        type: "number",
        section: "Position",
        default: 0,
        config: { step: 0.1 },
      },
      {
        key: "y",
        label: "Y",
        type: "number",
        section: "Position",
        default: 0,
        config: { step: 0.1 },
      },
      {
        key: "z",
        label: "Z",
        type: "number",
        section: "Position",
        default: 0,
        config: { step: 0.1 },
      },
      {
        key: "range",
        label: "Range",
        type: "number",
        section: "Config",
        default: 10,
        config: { min: 0, step: 1 },
      },
    ],
  },
  {
    type: "condition/entityCount",
    label: "Entity Count",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Hash",
    description: "Compares a stored entity count variable against a value",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "variableName",
        label: "Count Variable",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        section: "Config",
        default: "==",
        config: {
          options: [
            { value: "==", label: "equals" },
            { value: "!=", label: "not equals" },
            { value: "<", label: "less than" },
            { value: "<=", label: "less or equal" },
            { value: ">", label: "greater than" },
            { value: ">=", label: "greater or equal" },
          ],
        },
      },
      {
        key: "value",
        label: "Value",
        type: "number",
        section: "Config",
        default: 0,
        config: { step: 1 },
      },
    ],
  },

  // ---- Buff / quest conditions ----
  {
    type: "condition/hasActiveBuff",
    label: "Has Active Buff",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Zap",
    description:
      "Checks if a buff is currently active (via buff_<id>_active variable)",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "buffId",
        label: "Buff ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "condition/hasQuestCompleted",
    label: "Has Quest Completed",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "CheckCircle",
    description: "Checks if a quest has been completed",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- World / variable conditions ----
  {
    type: "condition/timeOfDay",
    label: "Time Of Day",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Clock",
    description: "Checks if the current wall-clock hour is within a window",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "minHour",
        label: "Min Hour",
        type: "number",
        section: "Config",
        default: 0,
        config: { min: 0, max: 23, step: 1 },
      },
      {
        key: "maxHour",
        label: "Max Hour",
        type: "number",
        section: "Config",
        default: 23,
        config: { min: 0, max: 23, step: 1 },
      },
    ],
  },
  {
    type: "condition/variableExists",
    label: "Variable Exists",
    category: "condition",
    color: CATEGORY_COLORS.condition,
    icon: "Variable",
    description: "Checks if a script variable has been defined",
    inputs: [flowIn()],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
];

// ============== ACTION NODES ==============

const ACTION_NODES: NodeTypeDefinition[] = [
  // ---- Combat actions ----
  {
    type: "action/spawnMob",
    label: "Spawn Mob",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Bug",
    description: "Spawns a mob at the specified position",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut(), dataOut("mob", "Spawned Mob", "entity")],
    fields: [
      {
        key: "mobType",
        label: "Mob Type",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "count",
        label: "Count",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, max: 50, step: 1 },
      },
      {
        key: "level",
        label: "Level",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, max: 999, step: 1 },
      },
    ],
  },
  {
    type: "action/despawnEntity",
    label: "Despawn Entity",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Trash2",
    description: "Removes an entity from the world",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [],
  },
  {
    type: "action/startCombat",
    label: "Start Combat",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Swords",
    description: "Forces an entity to attack another",
    inputs: [
      flowIn(),
      dataIn("attacker", "Attacker", "entity"),
      dataIn("target", "Target", "entity"),
    ],
    outputs: [flowOut()],
    fields: [],
  },
  {
    type: "action/stopCombat",
    label: "Stop Combat",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "ShieldOff",
    description: "Forces an entity out of combat",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [],
  },
  {
    type: "action/dealDamage",
    label: "Deal Damage",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Flame",
    description: "Deals direct damage to an entity",
    inputs: [flowIn(), dataIn("target", "Target", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "damage",
        label: "Damage",
        type: "number",
        section: "Config",
        required: true,
        config: { min: 0, step: 1 },
      },
      {
        key: "damageType",
        label: "Type",
        type: "select",
        section: "Config",
        default: "melee",
        config: {
          options: [
            { value: "melee", label: "Melee" },
            { value: "ranged", label: "Ranged" },
            { value: "magic", label: "Magic" },
            { value: "true", label: "True" },
          ],
        },
      },
    ],
  },
  {
    type: "action/healEntity",
    label: "Heal Entity",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "HeartPulse",
    description: "Restores HP to an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "amount",
        label: "Amount",
        type: "number",
        section: "Config",
        config: { min: 0, step: 1 },
      },
      {
        key: "percentage",
        label: "% of Max HP",
        type: "slider",
        section: "Config",
        config: { min: 0, max: 100, step: 5 },
      },
    ],
  },

  // ---- Player actions ----
  {
    type: "action/teleportPlayer",
    label: "Teleport Player",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Zap",
    description: "Teleports a player to the specified position",
    inputs: [
      flowIn(),
      dataIn("player", "Player", "entity"),
      dataIn("target", "Target", "position"),
    ],
    outputs: [flowOut()],
    fields: [
      {
        key: "x",
        label: "X",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
      {
        key: "y",
        label: "Y",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
      {
        key: "z",
        label: "Z",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
    ],
  },

  // ---- Item / inventory actions ----
  {
    type: "action/giveItem",
    label: "Give Item",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Gift",
    description: "Gives an item to the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, step: 1 },
      },
    ],
  },
  {
    type: "action/removeItem",
    label: "Remove Item",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "PackageMinus",
    description: "Removes items from the player's inventory",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, step: 1 },
      },
    ],
  },
  {
    type: "action/equipItem",
    label: "Equip Item",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Shield",
    description: "Forces a player to equip an item",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/spawnItem",
    label: "Spawn Item",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "PackagePlus",
    description: "Spawns an item on the ground at a position",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut()],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, step: 1 },
      },
      {
        key: "despawnTime",
        label: "Despawn (s)",
        type: "number",
        section: "Config",
        default: 0,
        config: { min: 0, step: 1, unit: "s" },
        description: "0 = never",
      },
    ],
  },

  // ---- Skills / XP / economy actions ----
  {
    type: "action/giveXP",
    label: "Give XP",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "TrendingUp",
    description: "Awards experience points in a skill",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "skillId",
        label: "Skill",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "amount",
        label: "Amount",
        type: "number",
        section: "Config",
        required: true,
        config: { min: 1, step: 1 },
      },
    ],
  },
  {
    type: "action/giveCoins",
    label: "Give Coins",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Coins",
    description: "Adds or removes coins from a player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "amount",
        label: "Amount",
        type: "number",
        section: "Config",
        required: true,
        config: { step: 1 },
      },
      {
        key: "mode",
        label: "Mode",
        type: "select",
        section: "Config",
        default: "add",
        config: {
          options: [
            { value: "add", label: "Add" },
            { value: "remove", label: "Remove" },
            { value: "set", label: "Set" },
          ],
        },
      },
    ],
  },

  // ---- NPC / entity actions ----
  {
    type: "action/spawnNPC",
    label: "Spawn NPC",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "UserPlus",
    description: "Spawns an NPC at a position",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut()],
    fields: [
      {
        key: "npcId",
        label: "NPC ID",
        type: "string",
        section: "Config",
        required: true,
      },
      { key: "name", label: "Name", type: "string", section: "Config" },
    ],
  },
  {
    type: "action/moveEntity",
    label: "Move Entity",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Move",
    description: "Moves an entity to a target position",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "x",
        label: "X",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
      {
        key: "y",
        label: "Y",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
      {
        key: "z",
        label: "Z",
        type: "number",
        section: "Position",
        config: { step: 1 },
      },
      {
        key: "speed",
        label: "Speed",
        type: "slider",
        section: "Config",
        default: 1,
        config: { min: 0.1, max: 5, step: 0.1 },
      },
    ],
  },
  {
    type: "action/setEntityProperty",
    label: "Set Entity Property",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Wrench",
    description: "Sets a custom property on an entity",
    inputs: [
      flowIn(),
      dataIn("entity", "Entity", "entity"),
      dataIn("value", "Value", "string"),
    ],
    outputs: [flowOut()],
    fields: [
      {
        key: "property",
        label: "Property",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Dialogue / quest actions ----
  {
    type: "action/showDialogue",
    label: "Show Dialogue",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "MessageSquare",
    description: "Shows a dialogue message to the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "npcName",
        label: "NPC Name",
        type: "string",
        section: "Dialogue",
      },
      {
        key: "message",
        label: "Message",
        type: "string",
        section: "Dialogue",
        required: true,
      },
    ],
  },
  {
    type: "action/startDialogueTree",
    label: "Start Dialogue Tree",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "MessagesSquare",
    description: "Opens a full dialogue tree with an NPC",
    inputs: [
      flowIn(),
      dataIn("player", "Player", "entity"),
      dataIn("npc", "NPC", "entity"),
    ],
    outputs: [flowOut()],
    fields: [
      {
        key: "dialogueId",
        label: "Dialogue ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/startQuest",
    label: "Start Quest",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "BookOpen",
    description: "Starts a quest for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/progressQuest",
    label: "Progress Quest",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "ListChecks",
    description: "Advances a quest to the next stage",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "stageId",
        label: "Stage ID",
        type: "string",
        section: "Config",
        description: "Specific stage (empty = next)",
      },
    ],
  },
  {
    type: "action/completeQuest",
    label: "Complete Quest",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "CheckCircle",
    description: "Force-completes a quest for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "questId",
        label: "Quest ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Shop / bank actions ----
  {
    type: "action/openShop",
    label: "Open Shop",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "ShoppingCart",
    description: "Opens a store interface for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "storeId",
        label: "Store ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/openBank",
    label: "Open Bank",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Landmark",
    description: "Opens the bank interface for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [],
  },

  // ---- Prayer actions ----
  {
    type: "action/activatePrayer",
    label: "Activate Prayer",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Church",
    description: "Activates a prayer for the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "prayerId",
        label: "Prayer ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/deactivatePrayer",
    label: "Deactivate Prayer",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "CircleOff",
    description: "Deactivates a prayer (or all prayers)",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "prayerId",
        label: "Prayer ID",
        type: "string",
        section: "Config",
        description: "Empty = deactivate all",
      },
    ],
  },

  // ---- Audio / VFX actions ----
  {
    type: "action/playSound",
    label: "Play Sound",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Volume2",
    description: "Plays a sound effect at a position",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut()],
    fields: [
      {
        key: "soundId",
        label: "Sound ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "volume",
        label: "Volume",
        type: "slider",
        section: "Config",
        default: 1,
        config: { min: 0, max: 1, step: 0.05 },
      },
      {
        key: "radius",
        label: "Radius",
        type: "number",
        section: "Config",
        default: 20,
        config: { min: 1, max: 200, step: 1, unit: "m" },
      },
    ],
  },
  {
    type: "action/playMusic",
    label: "Play Music",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Music",
    description: "Starts playing a music track",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "trackId",
        label: "Track ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "fadeIn",
        label: "Fade In (s)",
        type: "number",
        section: "Config",
        default: 0,
        config: { min: 0, step: 0.5, unit: "s" },
      },
    ],
  },
  {
    type: "action/stopMusic",
    label: "Stop Music",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "VolumeX",
    description: "Stops the currently playing music",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "fadeOut",
        label: "Fade Out (s)",
        type: "number",
        section: "Config",
        default: 0,
        config: { min: 0, step: 0.5, unit: "s" },
      },
    ],
  },
  {
    type: "action/spawnParticle",
    label: "Spawn Particle",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Sparkles",
    description: "Spawns a visual particle effect",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut()],
    fields: [
      {
        key: "effect",
        label: "Effect",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "duration",
        label: "Duration (ms)",
        type: "number",
        section: "Config",
        default: 1000,
        config: { min: 100, step: 100, unit: "ms" },
      },
    ],
  },

  // ---- UI / chat actions ----
  {
    type: "action/showNotification",
    label: "Show Notification",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Bell",
    description: "Shows a notification to the player",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "message",
        label: "Message",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "type",
        label: "Type",
        type: "select",
        section: "Config",
        default: "info",
        config: {
          options: [
            { value: "info", label: "Info" },
            { value: "success", label: "Success" },
            { value: "warning", label: "Warning" },
            { value: "error", label: "Error" },
          ],
        },
      },
    ],
  },
  {
    type: "action/sendChat",
    label: "Send Chat",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "MessageCircle",
    description: "Sends a chat message to all players",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "message",
        label: "Message",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "sender",
        label: "Sender",
        type: "string",
        section: "Config",
        default: "System",
      },
      {
        key: "color",
        label: "Color",
        type: "color",
        section: "Config",
        default: "#F5F5F5",
      },
    ],
  },

  // ---- Variable actions ----
  {
    type: "action/setVariable",
    label: "Set Variable",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Variable",
    description: "Sets a graph variable to a value",
    inputs: [flowIn(), dataIn("value", "Value", "string")],
    outputs: [flowOut()],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },
  {
    type: "action/incrementVariable",
    label: "Increment Variable",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Plus",
    description: "Adds a value to a numeric variable",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "amount",
        label: "Amount",
        type: "number",
        section: "Config",
        default: 1,
        config: { step: 1 },
      },
    ],
  },

  // ---- Buff actions ----
  {
    type: "action/applyBuff",
    label: "Apply Buff",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Zap",
    description: "Applies a timed buff to an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "buffId",
        label: "Buff ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "duration",
        label: "Duration (ms)",
        type: "number",
        section: "Config",
        default: 10000,
        config: { min: 0, step: 100, unit: "ms" },
      },
    ],
  },
  {
    type: "action/removeBuff",
    label: "Remove Buff",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "ZapOff",
    description: "Removes an active buff from an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "buffId",
        label: "Buff ID",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Entity configuration actions ----
  {
    type: "action/setAggroRange",
    label: "Set Aggro Range",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Target",
    description: "Sets the aggro range for a mob entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "range",
        label: "Range",
        type: "number",
        section: "Config",
        default: 10,
        config: { min: 0, step: 1 },
      },
    ],
  },
  {
    type: "action/setRespawnTime",
    label: "Set Respawn Time",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "RotateCcw",
    description: "Sets the respawn time (in game ticks) for an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "ticks",
        label: "Ticks",
        type: "number",
        section: "Config",
        default: 100,
        config: { min: 1, step: 1, unit: "ticks" },
      },
    ],
  },
  {
    type: "action/setDialogueOverride",
    label: "Set Dialogue Override",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "MessageSquareText",
    description: "Overrides an NPC's current dialogue",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "dialogueId",
        label: "Dialogue ID",
        type: "string",
        section: "Config",
      },
      { key: "text", label: "Text", type: "string", section: "Config" },
    ],
  },

  // ---- Movement actions ----
  {
    type: "action/playAnimation",
    label: "Play Animation",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Film",
    description: "Plays an animation on an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "animationName",
        label: "Animation",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "loop",
        label: "Loop",
        type: "boolean",
        section: "Config",
        default: false,
      },
    ],
  },
  {
    type: "action/setMovementSpeed",
    label: "Set Movement Speed",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Gauge",
    description: "Sets the movement speed multiplier for an entity",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "speed",
        label: "Speed",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 0, step: 0.1 },
      },
    ],
  },
  {
    type: "action/lockMovement",
    label: "Lock Movement",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Lock",
    description: "Prevents an entity from moving",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [],
  },
  {
    type: "action/unlockMovement",
    label: "Unlock Movement",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Unlock",
    description: "Allows a locked entity to move again",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [],
  },

  // ---- Item actions (player-targeted) ----
  {
    type: "action/dropItem",
    label: "Drop Item",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "PackageMinus",
    description: "Forces a player to drop an item onto the ground",
    inputs: [flowIn(), dataIn("player", "Player", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "itemId",
        label: "Item ID",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 1, step: 1 },
      },
    ],
  },

  // ---- Area-of-effect actions ----
  {
    type: "action/despawnAllInRadius",
    label: "Despawn All In Radius",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "CircleX",
    description: "Removes all entities within a radius of a position",
    inputs: [flowIn(), dataIn("position", "Position", "position")],
    outputs: [flowOut()],
    fields: [
      {
        key: "radius",
        label: "Radius",
        type: "number",
        section: "Config",
        default: 10,
        config: { min: 0, step: 1 },
      },
      {
        key: "entityType",
        label: "Entity Type",
        type: "string",
        section: "Config",
        description: "Optional filter (empty = all)",
      },
    ],
  },

  // ---- Data / query actions ----
  {
    type: "action/getEntityProperty",
    label: "Get Entity Property",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Search",
    description: "Reads a property from an entity into a variable",
    inputs: [flowIn(), dataIn("entity", "Entity", "entity")],
    outputs: [flowOut()],
    fields: [
      {
        key: "property",
        label: "Property",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
        required: true,
      },
    ],
  },

  // ---- Utility / debug actions ----
  {
    type: "action/log",
    label: "Log",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Terminal",
    description: "Logs a message to the console (debug only)",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "message",
        label: "Message",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "value",
        label: "Value",
        type: "string",
        section: "Config",
        description: "Optional second value to log",
      },
    ],
  },
  {
    type: "action/debugDraw",
    label: "Debug Draw",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Crosshair",
    description:
      "Emits a `scripting:debug_draw` world event so the editor/dev overlay can render a debug shape (sphere, line, box) at a position. No-op in production.",
    inputs: [
      flowIn(),
      dataIn("position", "Position", "vector3"),
      dataIn("color", "Color", "string"),
      dataIn("duration", "Duration (s)", "number"),
    ],
    outputs: [flowOut()],
    fields: [
      {
        key: "shape",
        label: "Shape",
        type: "select",
        section: "Config",
        config: {
          options: [
            { value: "sphere", label: "Sphere" },
            { value: "line", label: "Line" },
            { value: "box", label: "Box" },
          ],
        },
        default: "sphere",
      },
      {
        key: "radius",
        label: "Radius / Size",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 0.05, step: 0.1 },
      },
      {
        key: "color",
        label: "Color (hex)",
        type: "color",
        section: "Config",
        default: "#ff00ff",
      },
      {
        key: "duration",
        label: "Duration (s)",
        type: "number",
        section: "Config",
        default: 1,
        config: { min: 0.05, step: 0.1 },
      },
    ],
  },
  {
    type: "action/breakpoint",
    label: "Breakpoint",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Pause",
    description:
      "Emits a `scripting:breakpoint` world event with graphId/nodeId/context snapshot so the editor debugger can pause execution. Dev-only — in prod execution continues through.",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "label",
        label: "Label",
        type: "string",
        section: "Config",
        description: "Optional label shown in the debugger panel",
      },
    ],
  },
  {
    type: "action/emitCustomEvent",
    label: "Emit Custom Event",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Megaphone",
    description:
      "Emits a custom event by name that other graphs can subscribe to",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "eventName",
        label: "Event Name",
        type: "string",
        section: "Config",
        required: true,
      },
      {
        key: "payload",
        label: "Payload (JSON)",
        type: "string",
        section: "Config",
        description: "Optional JSON object of extra event data",
      },
    ],
  },

  // ---- Flow control actions ----
  {
    type: "action/wait",
    label: "Wait",
    category: "action",
    color: CATEGORY_COLORS.action,
    icon: "Hourglass",
    description: "No-op visual spacer (use flow/delay for actual timing)",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [],
  },
];

// ============== FLOW NODES ==============

const FLOW_NODES: NodeTypeDefinition[] = [
  {
    type: "flow/branch",
    label: "Branch",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "GitBranch",
    description: "Routes execution based on a boolean condition",
    inputs: [flowIn(), dataIn("condition", "Condition", "boolean")],
    outputs: [flowOut("true_out", "True"), flowOut("false_out", "False")],
    fields: [],
  },
  {
    type: "flow/sequence",
    label: "Sequence",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "ListOrdered",
    description: "Executes outputs in order, one after another",
    inputs: [flowIn()],
    outputs: [
      flowOut("out_0", "Then 0"),
      flowOut("out_1", "Then 1"),
      flowOut("out_2", "Then 2"),
    ],
    fields: [],
  },
  {
    type: "flow/delay",
    label: "Delay",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "Clock",
    description: "Delays execution by the specified duration",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "duration",
        label: "Duration (s)",
        type: "number",
        section: "Config",
        required: true,
        default: 1,
        config: { min: 0.1, step: 0.1, unit: "s" },
      },
    ],
  },
  {
    type: "flow/gate",
    label: "Gate",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "DoorOpen",
    description: "Blocks or allows execution based on a toggle state",
    inputs: [
      flowIn(),
      flowIn("open"),
      flowIn("close"),
      dataIn("startOpen", "Start Open", "boolean"),
    ],
    outputs: [flowOut()],
    fields: [
      {
        key: "startOpen",
        label: "Start Open",
        type: "boolean",
        section: "Config",
        default: true,
      },
    ],
  },
  {
    type: "flow/doN",
    label: "Do N",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "Hash",
    description: "Executes the output only the first N times",
    inputs: [flowIn(), flowIn("reset")],
    outputs: [flowOut()],
    fields: [
      {
        key: "count",
        label: "N",
        type: "number",
        section: "Config",
        required: true,
        default: 1,
        config: { min: 1, step: 1 },
      },
    ],
  },
  {
    type: "flow/flipFlop",
    label: "Flip Flop",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "ToggleLeft",
    description: "Alternates between two outputs each trigger",
    inputs: [flowIn()],
    outputs: [flowOut("a_out", "A"), flowOut("b_out", "B")],
    fields: [],
  },
  {
    type: "flow/forEach",
    label: "For Each",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "Repeat",
    description: "Iterates over a collection, executing body for each element",
    inputs: [flowIn()],
    outputs: [
      flowOut("body", "Body"),
      flowOut("done", "Done"),
      dataOut("element", "Element", "string"),
      dataOut("index", "Index", "number"),
    ],
    fields: [],
  },
  {
    type: "flow/forLoop",
    label: "For Loop",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "Repeat2",
    description:
      "Iterates from Start (inclusive) toward End (exclusive) by Step. Writes index to the named variable each iteration. Capped at 10,000 iterations.",
    inputs: [
      flowIn(),
      dataIn("start", "Start", "number"),
      dataIn("end", "End", "number"),
      dataIn("step", "Step", "number"),
    ],
    outputs: [flowOut("body", "Body"), flowOut("completed", "Completed")],
    fields: [
      { key: "start", label: "Start", type: "number", section: "Config" },
      { key: "end", label: "End", type: "number", section: "Config" },
      { key: "step", label: "Step", type: "number", section: "Config" },
      {
        key: "indexVariable",
        label: "Index Variable",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "flow/whileLoop",
    label: "While Loop",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "RotateCw",
    description:
      "Re-evaluates the Condition input each iteration; executes Body while truthy. Capped at 10,000 iterations.",
    inputs: [flowIn(), dataIn("condition", "Condition", "boolean")],
    outputs: [flowOut("body", "Body"), flowOut("completed", "Completed")],
    fields: [
      {
        key: "condition",
        label: "Condition (static)",
        type: "boolean",
        section: "Config",
      },
    ],
  },
  {
    type: "flow/multiGate",
    label: "Multi Gate",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "LayoutList",
    description: "Routes to outputs in round-robin order",
    inputs: [flowIn(), flowIn("reset")],
    outputs: [
      flowOut("out_0", "Out 0"),
      flowOut("out_1", "Out 1"),
      flowOut("out_2", "Out 2"),
      flowOut("out_3", "Out 3"),
    ],
    fields: [],
  },
  {
    type: "flow/callGraph",
    label: "Call Graph",
    category: "flow",
    color: CATEGORY_COLORS.flow,
    icon: "FunctionSquare",
    description:
      "Invoke a function/sub-graph by id. Arguments seed caller variables; listed Return Variables are copied back after the sub-graph completes. Max call depth: 32.",
    inputs: [flowIn()],
    outputs: [flowOut("completed", "Completed")],
    fields: [
      {
        key: "graphId",
        label: "Graph Id",
        type: "string",
        section: "Config",
        required: true,
        description: "Id of the function/sub-graph to invoke",
      },
      {
        key: "arguments",
        label: "Arguments (JSON)",
        type: "json",
        section: "Config",
        description:
          "Key/value map seeded into the sub-graph's variable scope. Connected data inputs override matching keys.",
      },
      {
        key: "returnVariables",
        label: "Return Variables",
        type: "tags",
        section: "Config",
        description:
          "Variable names copied from the sub-graph back into the caller's scope after completion.",
      },
    ],
  },
];

// ============== MATH NODES ==============

const MATH_NODES: NodeTypeDefinition[] = [
  {
    type: "math/add",
    label: "Add",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Plus",
    description: "Add two numbers (A + B)",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/subtract",
    label: "Subtract",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Minus",
    description: "Subtract two numbers (A - B)",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/multiply",
    label: "Multiply",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "X",
    description: "Multiply two numbers (A × B)",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/divide",
    label: "Divide",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Divide",
    description: "Divide two numbers (A ÷ B), returns 0 on division by zero",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/clamp",
    label: "Clamp",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Minimize2",
    description: "Clamp a value between min and max",
    inputs: [
      dataIn("value", "Value", "number"),
      dataIn("min", "Min", "number"),
      dataIn("max", "Max", "number"),
    ],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "value", label: "Value", type: "number", section: "Config" },
      { key: "min", label: "Min", type: "number", section: "Config" },
      { key: "max", label: "Max", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/lerp",
    label: "Lerp",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "GitBranch",
    description: "Linear interpolation between A and B by Alpha (0–1)",
    inputs: [
      dataIn("a", "A", "number"),
      dataIn("b", "B", "number"),
      dataIn("alpha", "Alpha", "number"),
    ],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
      { key: "alpha", label: "Alpha", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/randomRange",
    label: "Random Range",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Dices",
    description: "Random number between A and B",
    inputs: [dataIn("a", "Min", "number"), dataIn("b", "Max", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "Min", type: "number", section: "Config" },
      { key: "b", label: "Max", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/abs",
    label: "Absolute Value",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ArrowUpDown",
    description: "Get the absolute value of A",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/floor",
    label: "Floor",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ArrowDown",
    description: "Round down to nearest integer",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/ceil",
    label: "Ceil",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ArrowUp",
    description: "Round up to nearest integer",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/round",
    label: "Round",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "RotateCcw",
    description: "Round to nearest integer",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/min",
    label: "Min",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ChevronDown",
    description: "Returns the smaller of A and B",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/max",
    label: "Max",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ChevronUp",
    description: "Returns the larger of A and B",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/power",
    label: "Power",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Superscript",
    description: "Raise A to the power of B",
    inputs: [dataIn("a", "Base", "number"), dataIn("b", "Exponent", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "Base", type: "number", section: "Config" },
      { key: "b", label: "Exponent", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/sqrt",
    label: "Square Root",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Radical",
    description: "Square root of A (clamped to 0+)",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/modulo",
    label: "Modulo",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Percent",
    description: "Remainder of A ÷ B",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/negate",
    label: "Negate",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "MinusCircle",
    description: "Negate A (flip sign)",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/distance3D",
    label: "Distance 3D",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Ruler",
    description: "Euclidean distance between two 3D points",
    inputs: [
      dataIn("x1", "X1", "number"),
      dataIn("y1", "Y1", "number"),
      dataIn("z1", "Z1", "number"),
      dataIn("x2", "X2", "number"),
      dataIn("y2", "Y2", "number"),
      dataIn("z2", "Z2", "number"),
    ],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "x1", label: "X1", type: "number", section: "Config" },
      { key: "y1", label: "Y1", type: "number", section: "Config" },
      { key: "z1", label: "Z1", type: "number", section: "Config" },
      { key: "x2", label: "X2", type: "number", section: "Config" },
      { key: "y2", label: "Y2", type: "number", section: "Config" },
      { key: "z2", label: "Z2", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/compare",
    label: "Compare",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Scale",
    description: "Compare A and B with an operator",
    inputs: [dataIn("a", "A", "number"), dataIn("b", "B", "number")],
    outputs: [dataOut("result", "Result", "boolean")],
    fields: [
      { key: "a", label: "A", type: "number", section: "Config" },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        section: "Config",
        config: {
          options: [
            { value: "==", label: "==" },
            { value: "!=", label: "!=" },
            { value: "<", label: "<" },
            { value: ">", label: ">" },
            { value: "<=", label: "<=" },
            { value: ">=", label: ">=" },
          ],
        },
      },
      { key: "b", label: "B", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/booleanLogic",
    label: "Boolean Logic",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ToggleLeft",
    description: "AND, OR, NOT, XOR logic operations",
    inputs: [dataIn("a", "A", "boolean"), dataIn("b", "B", "boolean")],
    outputs: [dataOut("result", "Result", "boolean")],
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        section: "Config",
        config: {
          options: [
            { value: "and", label: "AND" },
            { value: "or", label: "OR" },
            { value: "not", label: "NOT" },
            { value: "xor", label: "XOR" },
          ],
        },
      },
    ],
  },
  {
    type: "math/toString",
    label: "To String",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Type",
    description: "Convert a number to string",
    inputs: [dataIn("a", "Value", "number")],
    outputs: [dataOut("result", "Result", "string")],
    fields: [{ key: "a", label: "Value", type: "number", section: "Config" }],
  },
  {
    type: "math/toNumber",
    label: "To Number",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Hash",
    description: "Convert a value to number",
    inputs: [dataIn("input", "Value", "string")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [
      { key: "input", label: "Value", type: "string", section: "Config" },
    ],
  },

  // ---------------- Phase 3.1 — Vector math ----------------

  {
    type: "math/vectorAdd",
    label: "Vector Add",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Plus",
    description: "Component-wise a + b → vec3.",
    inputs: [dataIn("a", "A", "vector3"), dataIn("b", "B", "vector3")],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [],
  },
  {
    type: "math/vectorSubtract",
    label: "Vector Subtract",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Minus",
    description: "Component-wise a − b → vec3.",
    inputs: [dataIn("a", "A", "vector3"), dataIn("b", "B", "vector3")],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [],
  },
  {
    type: "math/vectorScale",
    label: "Vector Scale",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "X",
    description: "Multiply a vector by a scalar.",
    inputs: [dataIn("a", "A", "vector3"), dataIn("scalar", "Scalar", "number")],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [
      { key: "scalar", label: "Scalar", type: "number", section: "Config" },
    ],
  },
  {
    type: "math/vectorNormalize",
    label: "Vector Normalize",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Compass",
    description: "Return a / |a|. Zero vector returns zero vector.",
    inputs: [dataIn("a", "A", "vector3")],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [],
  },
  {
    type: "math/vectorDot",
    label: "Vector Dot",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Dot",
    description: "Dot product: a · b → number.",
    inputs: [dataIn("a", "A", "vector3"), dataIn("b", "B", "vector3")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [],
  },
  {
    type: "math/vectorCross",
    label: "Vector Cross",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "X",
    description: "Cross product: a × b → vec3.",
    inputs: [dataIn("a", "A", "vector3"), dataIn("b", "B", "vector3")],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [],
  },
  {
    type: "math/vectorLength",
    label: "Vector Length",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "Ruler",
    description: "Magnitude of a vector: |a|.",
    inputs: [dataIn("a", "A", "vector3")],
    outputs: [dataOut("result", "Result", "number")],
    fields: [],
  },
  {
    type: "math/vectorLerp",
    label: "Vector Lerp",
    category: "math",
    color: CATEGORY_COLORS.math,
    icon: "ArrowRight",
    description: "Linear interpolation: a + (b - a) * clamp(alpha, 0, 1).",
    inputs: [
      dataIn("a", "A", "vector3"),
      dataIn("b", "B", "vector3"),
      dataIn("alpha", "Alpha", "number"),
    ],
    outputs: [dataOut("result", "Result", "vector3")],
    fields: [
      { key: "alpha", label: "Alpha (0-1)", type: "number", section: "Config" },
    ],
  },
];

// ============== VARIABLE NODES ==============

const VARIABLE_NODES: NodeTypeDefinition[] = [
  {
    type: "variable/get",
    label: "Get Variable",
    category: "variable",
    color: CATEGORY_COLORS.variable,
    icon: "Eye",
    description: "Read a variable value (pure node, evaluated on pull)",
    inputs: [],
    outputs: [dataOut("value", "Value", "any")],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "variable/set",
    label: "Set Variable",
    category: "variable",
    color: CATEGORY_COLORS.variable,
    icon: "Edit3",
    description: "Set a variable to a value",
    inputs: [flowIn(), dataIn("value", "Value", "any")],
    outputs: [flowOut()],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
      },
      {
        key: "value",
        label: "Default Value",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "variable/increment",
    label: "Increment Variable",
    category: "variable",
    color: CATEGORY_COLORS.variable,
    icon: "PlusCircle",
    description: "Increment a numeric variable by an amount",
    inputs: [flowIn()],
    outputs: [flowOut()],
    fields: [
      {
        key: "variableName",
        label: "Variable",
        type: "string",
        section: "Config",
      },
      { key: "amount", label: "Amount", type: "number", section: "Config" },
    ],
  },
];

// ============== DATA NODES ==============

const DATA_NODES: NodeTypeDefinition[] = [
  {
    type: "data/getEntityProperty",
    label: "Get Entity Property",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Database",
    description:
      "Read a property from an entity (supports dot notation like health.current)",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [dataOut("value", "Value", "any")],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Config",
      },
      {
        key: "property",
        label: "Property Path",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "data/getTime",
    label: "Get Time",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Clock",
    description: "Get the current world time in milliseconds",
    inputs: [],
    outputs: [dataOut("value", "Time (ms)", "number")],
    fields: [],
  },
  {
    type: "data/getTriggerData",
    label: "Get Trigger Data",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "FileInput",
    description: "Read a field from the trigger event data",
    inputs: [],
    outputs: [dataOut("value", "Value", "any")],
    fields: [
      { key: "field", label: "Field Name", type: "string", section: "Config" },
    ],
  },
  {
    type: "data/makeVector3",
    label: "Make Vector3",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Move3D",
    description: "Compose a 3D vector from X, Y, Z components",
    inputs: [
      dataIn("x", "X", "number"),
      dataIn("y", "Y", "number"),
      dataIn("z", "Z", "number"),
    ],
    outputs: [dataOut("vector", "Vector", "vector3")],
    fields: [
      { key: "x", label: "X", type: "number", section: "Config" },
      { key: "y", label: "Y", type: "number", section: "Config" },
      { key: "z", label: "Z", type: "number", section: "Config" },
    ],
  },
  {
    type: "data/breakVector3",
    label: "Break Vector3",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Ungroup",
    description: "Decompose a 3D vector into X, Y, Z components",
    inputs: [dataIn("vector", "Vector", "vector3")],
    outputs: [
      dataOut("x", "X", "number"),
      dataOut("y", "Y", "number"),
      dataOut("z", "Z", "number"),
    ],
    fields: [],
  },
  {
    type: "data/constant",
    label: "Constant",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Lock",
    description: "A constant value (number, string, or boolean)",
    inputs: [],
    outputs: [dataOut("value", "Value", "any")],
    fields: [
      { key: "value", label: "Value", type: "string", section: "Config" },
    ],
  },

  // ---------------- Phase 2.1 — Spatial queries ----------------

  {
    type: "data/findEntitiesInRadius",
    label: "Find Entities In Radius",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Radar",
    description:
      "Return the list of entity IDs within `radius` of the origin (XZ-plane). Origin defaults to self when unset.",
    inputs: [
      dataIn("origin", "Origin", "any"),
      dataIn("radius", "Radius", "number"),
      dataIn("type", "Type Filter", "string"),
    ],
    outputs: [
      dataOut("entities", "Entities", "any"),
      dataOut("count", "Count", "number"),
    ],
    fields: [
      { key: "radius", label: "Radius", type: "number", section: "Config" },
      {
        key: "type",
        label: "Type Filter (blank = any)",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "data/findClosestEntity",
    label: "Find Closest Entity",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Crosshair",
    description:
      "Find the closest entity within `radius` of the origin (excluding self). Origin defaults to self.",
    inputs: [
      dataIn("origin", "Origin", "any"),
      dataIn("radius", "Radius", "number"),
      dataIn("type", "Type Filter", "string"),
    ],
    outputs: [
      dataOut("entityId", "Entity ID", "string"),
      dataOut("distance", "Distance", "number"),
    ],
    fields: [
      { key: "radius", label: "Radius", type: "number", section: "Config" },
      {
        key: "type",
        label: "Type Filter (blank = any)",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "data/isLineOfSight",
    label: "Is Line Of Sight",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Eye",
    description:
      "True when there are no physics occluders on the segment between `from` and `to` entities. Defaults `from` to self.",
    inputs: [
      dataIn("from", "From Entity", "string"),
      dataIn("to", "To Entity", "string"),
    ],
    outputs: [dataOut("hasLOS", "Has LOS", "boolean")],
    fields: [
      {
        key: "from",
        label: "From Entity ID (blank = self)",
        type: "string",
        section: "Config",
      },
      { key: "to", label: "To Entity ID", type: "string", section: "Config" },
    ],
  },
  {
    type: "data/lineTrace",
    label: "Line Trace",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Move",
    description:
      "Cast a ray from origin along direction for `maxDistance`. Returns the first hit entity (or null) and hit data.",
    inputs: [
      dataIn("origin", "Origin", "any"),
      dataIn("direction", "Direction", "vector3"),
      dataIn("maxDistance", "Max Distance", "number"),
    ],
    outputs: [
      dataOut("entityId", "Entity ID", "string"),
      dataOut("distance", "Distance", "number"),
      dataOut("point", "Hit Point", "vector3"),
    ],
    fields: [
      {
        key: "maxDistance",
        label: "Max Distance",
        type: "number",
        section: "Config",
      },
      { key: "dirX", label: "Dir X", type: "number", section: "Config" },
      { key: "dirY", label: "Dir Y", type: "number", section: "Config" },
      { key: "dirZ", label: "Dir Z", type: "number", section: "Config" },
    ],
  },
  {
    type: "data/sphereCast",
    label: "Sphere Cast",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Circle",
    description:
      "Return the list of entity IDs within 3D `radius` of the origin. Stricter than Find Entities In Radius (uses 3D distance, not XZ).",
    inputs: [
      dataIn("origin", "Origin", "any"),
      dataIn("radius", "Radius", "number"),
      dataIn("type", "Type Filter", "string"),
    ],
    outputs: [
      dataOut("entities", "Entities", "any"),
      dataOut("count", "Count", "number"),
    ],
    fields: [
      { key: "radius", label: "Radius", type: "number", section: "Config" },
      {
        key: "type",
        label: "Type Filter (blank = any)",
        type: "string",
        section: "Config",
      },
    ],
  },

  // ---------------- Phase 2.3 — Typed ECS component accessors ----------------

  {
    type: "data/getEntityPosition",
    label: "Get Entity Position",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "MapPin",
    description:
      "Return the world position (`{x, y, z}`) of the given entity. Defaults to the owning entity when no id is supplied.",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [
      dataOut("position", "Position", "vector3"),
      dataOut("x", "X", "number"),
      dataOut("y", "Y", "number"),
      dataOut("z", "Z", "number"),
    ],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/getEntityRotation",
    label: "Get Entity Rotation",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Compass",
    description:
      "Return the rotation of the given entity. Accepts Euler (`x/y/z`) or quaternion (`x/y/z/w`) storage.",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [
      dataOut("rotation", "Rotation", "vector3"),
      dataOut("x", "X", "number"),
      dataOut("y", "Y", "number"),
      dataOut("z", "Z", "number"),
      dataOut("w", "W", "number"),
    ],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/getPlayerHealth",
    label: "Get Player Health",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Heart",
    description:
      "Return the current/max/percent health of a player entity. Defaults to the owning entity when no id is supplied.",
    inputs: [dataIn("playerId", "Player ID", "string")],
    outputs: [
      dataOut("current", "Current", "number"),
      dataOut("max", "Max", "number"),
      dataOut("percent", "Percent (0-1)", "number"),
    ],
    fields: [
      {
        key: "playerId",
        label: "Player ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/getPlayerStats",
    label: "Get Player Stats",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "TrendingUp",
    description:
      "Return a player's combat level and per-skill level/xp. Set the `skill` field (e.g. `attack`) and read `level` or `xp`.",
    inputs: [
      dataIn("playerId", "Player ID", "string"),
      dataIn("skill", "Skill", "string"),
    ],
    outputs: [
      dataOut("level", "Combat Level", "number"),
      dataOut("xp", "Skill XP", "number"),
    ],
    fields: [
      {
        key: "playerId",
        label: "Player ID (blank = self)",
        type: "string",
        section: "Target",
      },
      {
        key: "skill",
        label: "Skill (attack, strength, defence, ...)",
        type: "string",
        section: "Config",
      },
    ],
  },
  {
    type: "data/getPlayerInventory",
    label: "Get Player Inventory",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Backpack",
    description:
      "Return the player's inventory item-id array plus count and whether there is space.",
    inputs: [dataIn("playerId", "Player ID", "string")],
    outputs: [
      dataOut("items", "Items (ids)", "any"),
      dataOut("count", "Count", "number"),
      dataOut("hasSpace", "Has Space", "boolean"),
    ],
    fields: [
      {
        key: "playerId",
        label: "Player ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },

  // ---------------- Phase 3.2 — Array / collection ops ----------------

  {
    type: "data/arrayLength",
    label: "Array Length",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Hash",
    description: "Return the number of elements in an array.",
    inputs: [dataIn("array", "Array", "any")],
    outputs: [dataOut("result", "Length", "number")],
    fields: [],
  },
  {
    type: "data/arrayContains",
    label: "Array Contains",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Search",
    description: "Return true if the array contains the given value.",
    inputs: [dataIn("array", "Array", "any"), dataIn("value", "Value", "any")],
    outputs: [dataOut("result", "Contains", "boolean")],
    fields: [],
  },
  {
    type: "data/arrayAdd",
    label: "Array Add",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Plus",
    description: "Return a new array with the value appended.",
    inputs: [dataIn("array", "Array", "any"), dataIn("value", "Value", "any")],
    outputs: [dataOut("result", "Result", "any")],
    fields: [],
  },
  {
    type: "data/arrayRemove",
    label: "Array Remove",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Minus",
    description:
      "Return a new array with the first occurrence of value removed.",
    inputs: [dataIn("array", "Array", "any"), dataIn("value", "Value", "any")],
    outputs: [dataOut("result", "Result", "any")],
    fields: [],
  },
  {
    type: "data/arrayGetAt",
    label: "Array Get At",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Hash",
    description: "Return the element at `index`, or null if out of bounds.",
    inputs: [
      dataIn("array", "Array", "any"),
      dataIn("index", "Index", "number"),
    ],
    outputs: [dataOut("result", "Result", "any")],
    fields: [
      { key: "index", label: "Index", type: "number", section: "Config" },
    ],
  },
  {
    type: "data/arraySlice",
    label: "Array Slice",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Scissors",
    description: "Return arr.slice(start, end).",
    inputs: [
      dataIn("array", "Array", "any"),
      dataIn("start", "Start", "number"),
      dataIn("end", "End", "number"),
    ],
    outputs: [dataOut("result", "Result", "any")],
    fields: [
      { key: "start", label: "Start", type: "number", section: "Config" },
      { key: "end", label: "End", type: "number", section: "Config" },
    ],
  },

  // ---------------- Phase 3.5 — Typed casts ----------------

  {
    type: "data/castToPlayer",
    label: "Cast To Player",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "User",
    description:
      "Return the entity id if the entity is of type 'player', else null.",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [
      dataOut("result", "Player ID", "string"),
      dataOut("isValid", "Is Valid", "boolean"),
    ],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/castToNPC",
    label: "Cast To NPC",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Users",
    description:
      "Return the entity id if the entity is of type 'npc', else null.",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [
      dataOut("result", "NPC ID", "string"),
      dataOut("isValid", "Is Valid", "boolean"),
    ],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/castToMob",
    label: "Cast To Mob",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Skull",
    description:
      "Return the entity id if the entity is of type 'mob', else null.",
    inputs: [dataIn("entityId", "Entity ID", "string")],
    outputs: [
      dataOut("result", "Mob ID", "string"),
      dataOut("isValid", "Is Valid", "boolean"),
    ],
    fields: [
      {
        key: "entityId",
        label: "Entity ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
  {
    type: "data/toBoolean",
    label: "To Boolean",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "ToggleLeft",
    description: "Coerce any value to boolean. 'false' and '' are falsy.",
    inputs: [dataIn("input", "Value", "any")],
    outputs: [dataOut("result", "Result", "boolean")],
    fields: [],
  },

  {
    type: "data/getPlayerEquipment",
    label: "Get Player Equipment",
    category: "data",
    color: CATEGORY_COLORS.data,
    icon: "Shield",
    description:
      "Return the currently equipped item id per slot (weapon, shield, helmet, body, legs, gloves, boots, ring, amulet).",
    inputs: [dataIn("playerId", "Player ID", "string")],
    outputs: [
      dataOut("weapon", "Weapon", "string"),
      dataOut("shield", "Shield", "string"),
      dataOut("helmet", "Helmet", "string"),
      dataOut("body", "Body", "string"),
      dataOut("legs", "Legs", "string"),
      dataOut("gloves", "Gloves", "string"),
      dataOut("boots", "Boots", "string"),
      dataOut("ring", "Ring", "string"),
      dataOut("amulet", "Amulet", "string"),
    ],
    fields: [
      {
        key: "playerId",
        label: "Player ID (blank = self)",
        type: "string",
        section: "Target",
      },
    ],
  },
];

// ============== FULL LIBRARY ==============

const ALL_NODES = [
  ...TRIGGER_NODES,
  ...CONDITION_NODES,
  ...ACTION_NODES,
  ...FLOW_NODES,
  ...MATH_NODES,
  ...VARIABLE_NODES,
  ...DATA_NODES,
];

/** Complete node type registry keyed by type string. */
export const NODE_LIBRARY: Record<string, NodeTypeDefinition> = {};
for (const node of ALL_NODES) {
  NODE_LIBRARY[node.type] = node;
}

// ============== LOOKUP HELPERS ==============

/** Get a node type definition by its type key. */
export function getNodeType(type: string): NodeTypeDefinition | undefined {
  return NODE_LIBRARY[type];
}

/** Get all node type definitions in a category. */
export function getNodesByCategory(category: string): NodeTypeDefinition[] {
  return ALL_NODES.filter((n) => n.category === category);
}

/** Get all unique category names. */
export function getAllCategories(): string[] {
  const categories = new Set(ALL_NODES.map((n) => n.category));
  return Array.from(categories);
}

/** Get the color assigned to a category. */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? "#7A7A82";
}
