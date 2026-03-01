/**
 * Event Payload Interfaces
 *
 * Type definitions for event payloads sent with each event type.
 */

import { Entity } from "../../entities/Entity";
import { PlayerLocal } from "../../entities/player/PlayerLocal";
import { Skills, InventoryItem, Position3D } from "../core/core";
import type { Item } from "../core/core";
import type { EntitySpawnedEvent } from "../systems/system-interfaces";
import { EventType } from "./event-types";
import { AttackType } from "../game/item-types";
import type {
  PrayerStateSyncPayload,
  PrayerPointsChangedPayload,
} from "../game/prayer-types";
import type { TradeCancelledPayload } from "../game/trade-types";

// ============================================================================
// EVENT PAYLOAD INTERFACES
// ============================================================================

/** Equipment sync data for login - subset of database row for event payloads */
export interface EquipmentSyncData {
  slotType: string;
  itemId: string | null;
  quantity: number;
}

export interface InventorySyncData {
  slotIndex: number;
  itemId: string;
  quantity: number;
}

// Core Event Payloads
export interface PlayerJoinedPayload {
  playerId: string;
  userId?: string;
  player: PlayerLocal;
  /** Equipment data loaded from database during login (optional for backwards compatibility) */
  equipment?: EquipmentSyncData[];
  /** Inventory data loaded from database during login (optional for backwards compatibility) */
  inventory?: InventorySyncData[];
  /** Whether this player is a load test bot */
  isLoadTestBot?: boolean;
  /** Whether this player is an embedded AI agent */
  isEmbeddedAgent?: boolean;
  /** Whether this player is an AI agent (embedded or model) */
  isAgent?: boolean;
  /** Whether this is a reconnection (existing entity, new socket) */
  isReconnect?: boolean;
}

export interface PlayerEnterPayload {
  playerId: string;
}

export interface PlayerLeavePayload {
  playerId: string;
}

export interface EntityCreatedPayload {
  entityId: string;
  entity: Entity;
}

export interface PlayerLevelUpPayload {
  playerId: string;
  skill: keyof Skills;
  newLevel: number;
}

export interface PlayerXPGainedPayload {
  playerId: string;
  skill: keyof Skills;
  amount: number;
}

export interface CombatStartedPayload {
  attackerId: string;
  targetId: string;
}

export interface CombatFollowTargetPayload {
  playerId: string;
  targetId: string;
  targetPosition: { x: number; y: number; z: number };
  /** Attack range in tiles (1=melee, 2=halberd, 10=ranged/magic) */
  attackRange?: number;
  /** Attack type for proper pathfinding (melee vs ranged/magic) */
  attackType?: AttackType;
}

/**
 * OSRS-accurate: Player clicked to move (not on target), cancel their attacking combat
 */
export interface CombatPlayerDisengagePayload {
  playerId: string;
}

/**
 * OSRS-accurate: Player clicked elsewhere, cancel their pending attack
 * (e.g., player was walking to mob to attack, but clicked ground instead)
 */
export interface PendingAttackCancelPayload {
  playerId: string;
}

export interface InventoryItemAddedPayload {
  playerId: string;
  item: InventoryItem;
}

export interface NPCDiedPayload {
  mobId: string;
  mobType: string;
  level: number;
  killedBy: string;
  position: { x: number; y: number; z: number };
  loot?: InventoryItem[];
  /** Timestamp when the kill occurred (Unix ms) - for anti-spoof validation */
  timestamp?: number;
  /** HMAC signature for kill validation - prevents spoofed kill events */
  killToken?: string;
}

// Item System Event Payloads
export interface ItemDropPayload {
  item: Item;
  position: Position3D;
  playerId: string;
}

export interface ItemPickupPayload {
  playerId: string;
  itemId: string;
  groundItemId: string;
}

export interface ItemPickupRequestPayload {
  playerId: string;
  itemId: string;
  position: Position3D;
}

export interface ItemDroppedPayload {
  itemId: string;
  item: Item;
  position: Position3D;
  droppedBy: string;
  playerId: string;
}

export interface ItemSpawnedPayload {
  itemId: string;
  position: Position3D;
}

export interface InventoryAddPayload {
  playerId: string;
  item: {
    id: string;
    name: string;
    type: string;
    quantity: number;
    stackable: boolean;
  };
}

export interface UIMessagePayload {
  playerId: string;
  message: string;
  type?: "info" | "warning" | "error" | "damage" | "system" | "success";
}

// Additional Event Payloads
export interface BankDepositEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface BankWithdrawEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

export interface BankDepositSuccessEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  bankId: string;
}

export interface StoreTransactionEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
  totalCost: number;
  transactionType: "buy" | "sell";
}

export interface StoreOpenEvent {
  playerId: string;
  storeId: string;
  playerPosition: Position3D;
}

export interface StoreCloseEvent {
  playerId: string;
  storeId: string;
}

export interface StoreBuyEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
}

export interface StoreSellEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
}

export interface InventoryUpdateEvent {
  playerId: string;
  itemId: string;
  previousQuantity: number;
  newQuantity: number;
  action: "add" | "remove" | "update";
}

export interface InventoryAddEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface InventoryCanAddEvent {
  playerId: string;
  item: {
    id: string;
    name: string;
    quantity: number;
    stackable: boolean;
  };
  callback: (canAdd: boolean) => void;
}

export interface InventoryCheckEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  callback: (hasItem: boolean, inventorySlot: InventoryItemInfo | null) => void;
}

export interface InventoryGetCoinsEvent {
  playerId: string;
  callback: (coins: number) => void;
}

export interface InventoryHasEquippedEvent {
  playerId: string;
  slot: string;
  itemType: string;
  callback: (hasEquipped: boolean) => void;
}

export interface InventoryRemoveCoinsEvent {
  playerId: string;
  amount: number;
}

export interface InventoryRemoveEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface InventoryItemInfo {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
  slot: string | null;
}

export interface PlayerInitEvent {
  playerId: string;
  position: Position3D;
  isNewPlayer: boolean;
}

export interface PlayerEnterEvent {
  playerId: string;
  userId?: string;
}

export interface PlayerLeaveEvent {
  playerId: string;
  userId?: string;
}

export interface PlayerLevelUpEvent {
  playerId: string;
  previousLevel: number;
  newLevel: number;
  skill: string;
}

export interface PlayerXPGainEvent {
  playerId: string;
  skill: string;
  xpGained: number;
  currentXP: number;
  currentLevel: number;
}

/**
 * Payload for SKILLS_LEVEL_UP event
 * Emitted by server (SkillsSystem) and client (useXPOrbState) when a skill levels up.
 * Note: Server emits this event internally but does NOT send it over WebSocket.
 * Client emits locally when detecting level-up from XP drop data.
 */
export interface SkillsLevelUpEvent {
  entityId?: string; // Server includes this
  skill: string;
  oldLevel: number;
  newLevel: number;
  totalLevel?: number; // Server includes this
  timestamp?: number; // Client adds this
}

// ============================================================================
// AUTO-RETALIATE EVENT PAYLOADS
// ============================================================================

/**
 * Request to get player's auto-retaliate setting
 */
export interface AutoRetaliateGetEvent {
  /** Player requesting their setting */
  playerId: string;
  /** Optional callback for synchronous response */
  callback?: (enabled: boolean) => void;
}

/**
 * Request to update player's auto-retaliate setting
 * Server validates before applying (server authority)
 */
export interface AutoRetaliateUpdateEvent {
  /** Player making the request */
  playerId: string;
  /** Desired auto-retaliate state */
  enabled: boolean;
}

/**
 * Notification that auto-retaliate setting changed
 * Sent from server to client after validation
 */
export interface AutoRetaliateChangedEvent {
  /** Player whose setting changed */
  playerId: string;
  /** New auto-retaliate state */
  enabled: boolean;
}

export interface HealthUpdateEvent {
  entityId: string;
  previousHealth: number;
  currentHealth: number;
  maxHealth: number;
}

export interface PlayerDeathEvent {
  playerId: string;
  deathLocation: Position3D;
  cause: string;
}

export interface PlayerRespawnRequestEvent {
  playerId: string;
  requestTime: number;
}

export interface PlayerRegisterEvent {
  id: string;
  playerId: string;
  entity: import("../../entities/player/PlayerLocal").PlayerLocal;
}

export interface UIMessageEvent {
  playerId: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  duration: number;
}

export interface AvatarReadyEvent {
  playerId: string;
  avatar: unknown;
  camHeight: number;
}

export interface PlayerPositionUpdateEvent {
  playerId: string;
  position: { x: number; y: number; z: number };
}

export interface CombatSessionEvent {
  sessionId: string;
  attackerId: string;
  targetId: string;
}

export interface CombatHitEvent {
  sessionId: string;
  attackerId: string;
  targetId: string;
  damage: number;
  hitType: "melee" | "ranged" | "magic" | "miss";
}

// ============================================================================
// COMBAT EVENT PAYLOADS
// ============================================================================

export interface CombatAttackRequestPayload {
  attackerId: string;
  targetId: string;
  attackerType?: string;
  targetType?: string;
  attackType?: AttackType;
  position?: Position3D;
}

export interface CombatDamageDealtPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  attackType?: AttackType;
  targetType?: "player" | "mob";
  position?: Position3D;
  isCritical?: boolean;
}

export interface CombatKillPayload {
  attackerId: string;
  targetId: string;
  damageDealt?: number;
  attackStyle?: string;
}

export interface CombatProjectileLaunchedPayload {
  attackerId: string;
  targetId: string;
  projectileType: string;
  sourcePosition: Position3D;
  targetPosition: Position3D;
  spellId?: string;
  arrowId?: string;
  delayMs?: number;
  /** How long (ms) the projectile visual should fly before reaching the target.
   *  Derived from the server-side hit-delay so the visual impact
   *  coincides with the damage splat. */
  travelDurationMs?: number;
}

export interface CombatProjectileHitPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  projectileType: string;
}

export interface CombatSpellCastPayload {
  casterId: string;
  targetId: string;
  spellId: string;
}

export interface CombatRuneConsumedPayload {
  playerId: string;
  runeId: string;
  quantity: number;
}

export interface CombatAmmoConsumedPayload {
  playerId: string;
  ammoId: string;
  quantity: number;
}

export interface PlayerDamageTakenPayload {
  playerId: string;
  damage: number;
  sourceId: string;
  attackType?: AttackType;
}

export interface EntityDamageTakenPayload {
  entityId: string;
  damage: number;
  sourceId?: string;
  damageSource?: string;
  entityType?: "player" | "mob";
  damageType?: string;
  attackType?: AttackType;
  remainingHealth?: number;
}

export interface AttackStyleChangedPayload {
  playerId: string;
  newStyle: string;
  previousStyle?: string;
}

export interface AggroPlayerEnteredPayload {
  playerId: string;
  mobId: string;
}

export interface AggroPlayerLeftPayload {
  playerId: string;
  mobId: string;
}

export interface AggroMobAggroedPayload {
  mobId: string;
  targetId: string;
}

export interface ItemSpawnedEvent {
  itemId: string;
  position: { x: number; y: number; z: number };
}

export interface EventData<T = Record<string, unknown>> {
  type: EventType;
  data: T;
  timestamp: number;
  source: string | null;
}

// ============================================================================
// EVENT SYSTEM INTERFACES
// ============================================================================

/**
 * Shared event system types
 */
export interface SystemEvent<T = AnyEvent> {
  readonly type: EventType;
  readonly data: T;
  readonly source: string;
  readonly timestamp: number;
  readonly id: string;
}

export interface EventHandler<T = AnyEvent> {
  (event: SystemEvent<T>): void | Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
  readonly active: boolean;
}

// ============================================================================
// PROCESSING EVENT PAYLOADS (Firemaking & Cooking)
// ============================================================================

/**
 * Player emote change payload
 */
export interface PlayerSetEmotePayload {
  playerId: string;
  emote: string | null;
}

/**
 * Fire lighting started payload (model appears during 3s lighting animation)
 */
export interface FireLightingStartedPayload {
  playerId: string;
  position: Position3D;
}

/**
 * Fire created payload
 */
export interface FireCreatedPayload {
  fireId: string;
  playerId: string;
  position: Position3D;
}

/**
 * Fire extinguished payload
 */
export interface FireExtinguishedPayload {
  fireId: string;
}

/**
 * Cooking completed payload
 */
export interface CookingCompletedPayload {
  playerId: string;
  rawItemId: string;
  resultItemId: string;
  wasBurnt: boolean;
  xpGained: number;
}

/**
 * Firemaking request payload (item-on-item: tinderbox on logs)
 */
export interface ProcessingFiremakingRequestPayload {
  playerId: string;
  logsId: string;
  logsSlot: number;
  tinderboxSlot: number;
}

/**
 * Cooking request payload (use raw food on fire/range)
 * Supports both fires (temporary) and ranges (permanent)
 */
export interface ProcessingCookingRequestPayload {
  playerId: string;
  fishSlot: number;
  /** Fire entity ID (for campfire cooking) */
  fireId?: string;
  /** Range entity ID (for permanent cooking stations) */
  rangeId?: string;
  /** Source type - defaults to "fire" for backwards compatibility */
  sourceType?: "fire" | "range";
}

/**
 * Firemaking move request (player should move after lighting fire)
 */
export interface FiremakingMoveRequestPayload {
  playerId: string;
  position: Position3D;
}

// =========================================================================
// SMELTING EVENT PAYLOADS
// =========================================================================

/**
 * Player clicked on a furnace
 */
export interface SmeltingInteractPayload {
  playerId: string;
  furnaceId: string;
  position: Position3D;
}

/**
 * Request to smelt a specific bar type
 */
export interface ProcessingSmeltingRequestPayload {
  playerId: string;
  barItemId: string;
  furnaceId: string;
  quantity: number;
}

/**
 * Smelting process started
 */
export interface SmeltingStartPayload {
  playerId: string;
  barItemId: string;
  furnaceId: string;
}

/**
 * Smelting succeeded - bar created
 */
export interface SmeltingSuccessPayload {
  playerId: string;
  barItemId: string;
  xpGained: number;
}

/**
 * Smelting failed (iron ore 50% failure)
 */
export interface SmeltingFailurePayload {
  playerId: string;
  barItemId: string;
}

/**
 * Smelting batch completed (all requested bars done or out of materials)
 */
export interface SmeltingCompletePayload {
  playerId: string;
  barItemId: string;
  totalSmelted: number;
  totalFailed: number;
  totalXp: number;
}

// =========================================================================
// SMITHING EVENT PAYLOADS
// =========================================================================

/**
 * Player clicked on an anvil
 */
export interface SmithingInteractPayload {
  playerId: string;
  anvilId: string;
  position: Position3D;
}

/**
 * Request to smith a specific item
 */
export interface ProcessingSmithingRequestPayload {
  playerId: string;
  recipeId: string;
  anvilId: string;
  quantity: number;
}

/**
 * Smithing process started
 */
export interface SmithingStartPayload {
  playerId: string;
  recipeId: string;
  anvilId: string;
}

/**
 * Smithing batch completed
 */
export interface SmithingCompletePayload {
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalSmithed: number;
  totalXp: number;
}

// =========================================================================
// CRAFTING EVENT PAYLOADS
// =========================================================================

/**
 * Player initiated crafting (used needle, chisel, or gold bar on furnace)
 */
export interface CraftingInteractPayload {
  playerId: string;
  /** How the crafting was initiated */
  triggerType: "needle" | "chisel" | "furnace";
  /** Optional station entity ID for furnace crafting */
  stationId?: string;
  /** Specific input material for recipe filtering (e.g., "leather", "uncut_sapphire") */
  inputItemId?: string;
}

/**
 * Crafting interface opened - show available recipes to player
 */
export interface CraftingInterfaceOpenPayload {
  playerId: string;
  availableRecipes: Array<{
    output: string;
    name: string;
    category: string;
    inputs: Array<{ item: string; amount: number }>;
    tools: string[];
    level: number;
    xp: number;
    meetsLevel: boolean;
    hasInputs: boolean;
  }>;
  station: string;
}

/**
 * Request to craft a specific item
 */
export interface ProcessingCraftingRequestPayload {
  playerId: string;
  recipeId: string;
  quantity: number;
}

/**
 * Crafting process started
 */
export interface CraftingStartPayload {
  playerId: string;
  recipeId: string;
}

/**
 * Crafting batch completed
 */
export interface CraftingCompletePayload {
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}

// =========================================================================
// FLETCHING EVENT PAYLOADS
// =========================================================================

/**
 * Player initiated fletching (used knife on logs, or item-on-item like bowstring + unstrung bow)
 */
export interface FletchingInteractPayload {
  playerId: string;
  /** How the fletching was initiated */
  triggerType: "knife" | "item_on_item";
  /** Primary input item (e.g., "oak_logs", "bowstring") */
  inputItemId: string;
  /** Secondary input for item-on-item (e.g., "shortbow_u", "headless_arrow") */
  secondaryItemId?: string;
}

/**
 * Fletching interface opened - show available recipes to player
 */
export interface FletchingInterfaceOpenPayload {
  playerId: string;
  availableRecipes: Array<{
    recipeId: string;
    output: string;
    name: string;
    category: string;
    outputQuantity: number;
    inputs: Array<{ item: string; amount: number }>;
    tools: string[];
    level: number;
    xp: number;
    meetsLevel: boolean;
    hasInputs: boolean;
  }>;
}

/**
 * Request to fletch a specific recipe
 */
export interface ProcessingFletchingRequestPayload {
  playerId: string;
  recipeId: string;
  quantity: number;
}

/**
 * Fletching process started
 */
export interface FletchingStartPayload {
  playerId: string;
  recipeId: string;
}

/**
 * Fletching batch completed
 */
export interface FletchingCompletePayload {
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}

// =========================================================================
// RUNECRAFTING EVENT PAYLOADS
// =========================================================================

/**
 * Player clicked on a runecrafting altar
 */
export interface RunecraftingInteractPayload {
  playerId: string;
  altarId: string;
  runeType: string;
}

/**
 * Runecrafting completed - runes crafted
 */
export interface RunecraftingCompletePayload {
  playerId: string;
  runeType: string;
  runeItemId: string;
  essenceConsumed: number;
  runesProduced: number;
  multiplier: number;
  xpAwarded: number;
}

// =========================================================================
// TANNING EVENT PAYLOADS
// =========================================================================

/**
 * Player interacted with tanner NPC
 */
export interface TanningInteractPayload {
  playerId: string;
  npcId: string;
}

/**
 * Tanning interface opened - show available hides to tan
 */
export interface TanningInterfaceOpenPayload {
  playerId: string;
  availableRecipes: Array<{
    input: string;
    output: string;
    cost: number;
    name: string;
    hasHide: boolean;
    hideCount: number;
  }>;
}

/**
 * Request to tan hides
 */
export interface TanningRequestPayload {
  playerId: string;
  inputItemId: string;
  quantity: number;
}

/**
 * Tanning completed
 */
export interface TanningCompletePayload {
  playerId: string;
  inputItemId: string;
  outputItemId: string;
  totalTanned: number;
  totalCost: number;
}

// =========================================================================
// TYPE-SAFE EVENT MAPPING
// =========================================================================

/**
 * Complete mapping of all events to their payload types
 * This ensures type safety when emitting and listening to events
 */
export interface EventMap {
  // Core Events
  [EventType.READY]: void;
  [EventType.ERROR]: { error: Error; message: string };
  [EventType.TICK]: { deltaTime: number };
  [EventType.PLAYER_JOINED]: PlayerJoinedPayload;
  [EventType.PLAYER_LEFT]: PlayerLeavePayload;
  [EventType.PLAYER_CLEANUP]: { playerId: string };

  [EventType.ENTITY_CREATED]: EntityCreatedPayload;
  [EventType.ENTITY_DEATH]: {
    entityId: string;
    sourceId?: string;
    lastDamageTime?: number;
    killedBy?: string;
    entityType?: "player" | "mob";
    /** Position at time of death - prevents stale position from cache */
    deathPosition?: { x: number; y: number; z: number };
  };
  [EventType.ENTITY_REVIVED]: { entityId: string; newHealth?: number };
  [EventType.ENTITY_UPDATED]: {
    entityId: string;
    changes: Record<string, string | number | boolean>;
  };
  [EventType.ASSET_LOADED]: { assetId: string; assetType: string };
  [EventType.ASSETS_LOADING_PROGRESS]: {
    progress: number;
    total: number;
    stage?: string;
    current?: number;
  };
  [EventType.UI_TOGGLE]: { visible: boolean };
  [EventType.UI_OPEN_PANE]: { pane: string };
  [EventType.UI_CLOSE_PANE]: { pane: string };
  [EventType.UI_MENU]: { action: "open" | "close" | "toggle" | "navigate" };
  [EventType.UI_AVATAR]: {
    avatarData: {
      vrm: string;
      scale: number;
      position: { x: number; y: number; z: number };
    };
  };
  [EventType.UI_KICK]: { playerId: string; reason: string };
  [EventType.UI_TOAST]: {
    /** Player to receive the toast (server-side routing). Client ignores this. */
    playerId?: string;
    message: string;
    type: "info" | "success" | "warning" | "error" | string;
    /** Screen coordinates for positioned toasts (RS3-style). If omitted, toast displays centered. */
    position?: { x: number; y: number };
  };
  [EventType.UI_SIDEBAR_CHAT_TOGGLE]: void;
  [EventType.UI_ACTIONS_UPDATE]: Array<{
    id: string;
    name: string;
    enabled: boolean;
    hotkey: string | null;
  }>;
  [EventType.UI_COMBAT_TARGET_CHANGED]: {
    targetId: string | null;
    targetName?: string;
    targetHealth?: { current: number; max: number };
  };
  [EventType.UI_COMBAT_TARGET_HEALTH]: {
    targetId: string;
    health: { current: number; max: number };
  };

  // Camera Events
  [EventType.CAMERA_SET_MODE]: {
    mode: "first_person" | "third_person" | "top_down";
  };
  [EventType.CAMERA_SET_TARGET]: {
    target: { position: { x: number; y: number; z: number } };
  };
  [EventType.CAMERA_CLICK_WORLD]: {
    screenPosition: { x: number; y: number };
    normalizedPosition: { x: number; y: number };
    target: { position?: Position3D };
  };
  [EventType.CAMERA_FOLLOW_PLAYER]: {
    playerId: string;
    entity: { id: string; mesh: object | null };
    camHeight: number;
  };

  // Inventory Events
  [EventType.INVENTORY_ITEM_REMOVED]: {
    playerId: string;
    itemId: string | number;
    quantity: number;
    slot?: number;
  };
  [EventType.ITEM_DROP]: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  };
  [EventType.INVENTORY_USE]: { playerId: string; itemId: string; slot: number };
  [EventType.ITEM_PICKUP]: {
    playerId: string;
    itemId?: string;
    entityId: string;
    position?: Position3D;
  };
  [EventType.INVENTORY_UPDATE_COINS]: { playerId: string; coins: number };
  [EventType.INVENTORY_MOVE]: {
    playerId: string;
    fromSlot?: number;
    toSlot?: number;
    sourceSlot?: number;
    targetSlot?: number;
  };
  [EventType.INVENTORY_DROP_ALL]: {
    playerId: string;
    position: { x: number; y: number; z: number };
  };
  [EventType.INVENTORY_CAN_ADD]: InventoryCanAddEvent;
  [EventType.INVENTORY_REMOVE_COINS]: InventoryRemoveCoinsEvent;
  [EventType.INVENTORY_ITEM_ADDED]: InventoryItemAddedPayload;
  [EventType.INVENTORY_CHECK]: InventoryCheckEvent;

  // Player Health & Position Events
  [EventType.PLAYER_HEALTH_UPDATED]: {
    playerId: string;
    health: number;
    maxHealth: number;
  };
  [EventType.PLAYER_TELEPORT_REQUEST]: {
    playerId: string;
    position: { x: number; y: number; z: number };
    rotationY?: number;
  };

  // Camera Events (continued)
  [EventType.CAMERA_TAP]: { x: number; y: number };

  // Avatar Events
  [EventType.AVATAR_LOAD_COMPLETE]: { playerId: string; success: boolean };

  // Input Events
  inputAck: { sequence: number; corrections?: unknown };

  // All other events
  [EventType.ENTITY_SPAWNED]: EntitySpawnedEvent;
  [EventType.RESOURCE_SPAWNED]: {
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
  };
  [EventType.RESOURCE_DEPLETED]: {
    resourceId: string;
    position?: { x: number; y: number; z: number };
  };
  [EventType.RESOURCE_RESPAWNED]: {
    resourceId: string;
    position?: { x: number; y: number; z: number };
  };
  [EventType.RESOURCE_SPAWN_POINTS_REGISTERED]: {
    spawnPoints: Array<{
      id: string;
      type: string;
      /** Specific variant (e.g., "oak" for tree_oak, "copper" for ore_copper) */
      subType?: string;
      position: { x: number; y: number; z: number };
      /** Scale multiplier for visual variation */
      scale?: number;
      /** Y-axis rotation in radians for visual variation */
      rotation?: number;
    }>;
  };
  [EventType.RESOURCE_MESH_CREATED]: {
    mesh: unknown;
    instanceId: number | null;
    resourceId: string;
    resourceType: string;
    worldPosition: { x: number; y: number; z: number };
  };
  [EventType.RESOURCE_HARVEST_REQUEST]: {
    playerId: string;
    entityId: string;
    resourceType: string;
    resourceId: string;
    harvestSkill: string;
    requiredLevel: number;
    harvestTime: number;
    harvestYield: Array<{ itemId: string; quantity: number; chance: number }>;
  };
  [EventType.ENTITY_HEALTH_CHANGED]: {
    entityId: string;
    health: number;
    maxHealth: number;
    isDead: boolean;
  };
  [EventType.ENTITY_DAMAGED]: {
    entityId: string;
    damage: number;
    sourceId?: string;
    remainingHealth: number;
    isDead: boolean;
  };
  [EventType.ENTITY_HEALED]: {
    entityId: string;
    healAmount: number;
    newHealth: number;
  };
  [EventType.ENTITY_LEVEL_CHANGED]: { entityId: string; newLevel: number };
  [EventType.ENTITY_INTERACTED]: {
    entityId: string;
    playerId: string;
    position: { x: number; y: number; z: number };
  };
  [EventType.MOB_NPC_EXAMINE]: {
    playerId: string;
    mobId: string;
    mobData: unknown;
  };
  [EventType.MOB_NPC_AGGRO]: { mobId: string; targetId: string };
  [EventType.MOB_NPC_RESPAWNED]: { mobId: string; position: Position3D };
  [EventType.NPC_TRAINER_OPEN]: {
    playerId: string;
    npcId: string;
    skillsOffered: string[];
  };
  [EventType.NPC_QUEST_OPEN]: {
    playerId: string;
    npcId: string;
    questsAvailable: string[];
  };
  [EventType.BANK_OPEN_REQUEST]: {
    playerId: string;
    npcId: string;
    npcEntityId?: string;
  };
  [EventType.STORE_OPEN_REQUEST]: {
    playerId: string;
    npcId: string;
    storeId?: string;
    npcEntityId?: string;
    inventory?: unknown[];
  };
  [EventType.CORPSE_EMPTY]: { corpseId: string; playerId: string };
  [EventType.CHARACTER_LIST]: {
    characters: Array<{
      id: string;
      name: string;
      level?: number;
      lastLocation?: { x: number; y: number; z: number };
    }>;
  };
  [EventType.CHARACTER_CREATED]: { id: string; name: string };
  [EventType.CHARACTER_SELECTED]: { characterId: string | null };
  [EventType.ENTITY_MODIFIED]: { id: string; changes: Record<string, unknown> };
  [EventType.SERVER_CORRECTION]: { sequence: number; corrections: unknown };
  [EventType.TERRAIN_TILE_UNLOADED]: {
    tileId: string;
    tileX: number;
    tileZ: number;
  };
  [EventType.TERRAIN_TILE_GENERATED]: {
    tileId: string;
    position: { x: number; z: number };
    tileX: number;
    tileZ: number;
    biome: string;
    resources: Array<{
      id: string;
      type: string;
      position: { x: number; y: number; z: number };
    }>;
  };
  [EventType.TERRAIN_TILE_REGENERATED]: {
    tileId: string;
    tileX: number;
    tileZ: number;
    biome: string;
    reason: "flat_zone" | "road" | "other";
  };
  [EventType.TERRAIN_GENERATE_INITIAL]: {
    centerX: number;
    centerZ: number;
    radius: number;
  };
  [EventType.ENTITY_INTERACT_REQUEST]: {
    playerId: string;
    entityId: string;
    interactionType: string;
    playerPosition?: Position3D;
  };
  [EventType.AGGRO_FORCE_TRIGGER]: { playerId: string };
  [EventType.DIALOGUE_START]: {
    playerId: string;
    npcId: string;
    npcName: string;
    nodeId: string;
    text: string;
    responses: Array<{ text: string; nextNodeId: string; effect?: string }>;
    npcEntityId?: string;
  };
  [EventType.DIALOGUE_NODE_CHANGE]: {
    playerId: string;
    npcId: string;
    nodeId: string;
    text: string;
    responses: Array<{ text: string; nextNodeId: string; effect?: string }>;
  };
  [EventType.DIALOGUE_RESPONSE]: {
    playerId: string;
    npcId: string;
    responseIndex: number;
    // SECURITY: nextNodeId and effect are computed server-side from dialogue state
    // based on responseIndex. Client cannot specify these values to prevent
    // dialogue skipping or effect injection exploits.
  };
  [EventType.DIALOGUE_END]: {
    playerId: string;
    npcId: string;
    npcEntityId?: string;
  };

  // Skills Events
  [EventType.SKILLS_LEVEL_UP]: SkillsLevelUpEvent;

  // Combat Events
  [EventType.COMBAT_STARTED]: CombatStartedPayload;
  [EventType.COMBAT_ENDED]: { attackerId: string; targetId: string };
  [EventType.COMBAT_ATTACK_REQUEST]: CombatAttackRequestPayload;
  [EventType.COMBAT_DAMAGE_DEALT]: CombatDamageDealtPayload;
  [EventType.COMBAT_KILL]: CombatKillPayload;
  [EventType.COMBAT_PROJECTILE_LAUNCHED]: CombatProjectileLaunchedPayload;
  [EventType.COMBAT_PROJECTILE_HIT]: CombatProjectileHitPayload;
  [EventType.COMBAT_SPELL_CAST]: CombatSpellCastPayload;
  [EventType.COMBAT_RUNE_CONSUMED]: CombatRuneConsumedPayload;
  [EventType.COMBAT_AMMO_CONSUMED]: CombatAmmoConsumedPayload;
  [EventType.COMBAT_FOLLOW_TARGET]: CombatFollowTargetPayload;
  [EventType.COMBAT_PLAYER_DISENGAGE]: CombatPlayerDisengagePayload;
  [EventType.PENDING_ATTACK_CANCEL]: PendingAttackCancelPayload;
  [EventType.PLAYER_DAMAGE]: PlayerDamageTakenPayload;
  [EventType.PLAYER_DAMAGE_TAKEN]: PlayerDamageTakenPayload;
  [EventType.ENTITY_DAMAGE_TAKEN]: EntityDamageTakenPayload;
  [EventType.ATTACK_STYLE_CHANGED]: AttackStyleChangedPayload;
  [EventType.AGGRO_PLAYER_ENTERED]: AggroPlayerEnteredPayload;
  [EventType.AGGRO_PLAYER_LEFT]: AggroPlayerLeftPayload;
  [EventType.AGGRO_MOB_NPC_AGGROED]: AggroMobAggroedPayload;

  // Auto-Retaliate Events
  [EventType.UI_AUTO_RETALIATE_GET]: AutoRetaliateGetEvent;
  [EventType.UI_AUTO_RETALIATE_UPDATE]: AutoRetaliateUpdateEvent;
  [EventType.UI_AUTO_RETALIATE_CHANGED]: AutoRetaliateChangedEvent;

  // Processing Events (Firemaking & Cooking)
  [EventType.PLAYER_SET_EMOTE]: PlayerSetEmotePayload;
  [EventType.FIRE_LIGHTING_STARTED]: FireLightingStartedPayload;
  [EventType.FIRE_CREATED]: FireCreatedPayload;
  [EventType.FIRE_EXTINGUISHED]: FireExtinguishedPayload;
  [EventType.COOKING_COMPLETED]: CookingCompletedPayload;
  [EventType.PROCESSING_FIREMAKING_REQUEST]: ProcessingFiremakingRequestPayload;
  [EventType.PROCESSING_COOKING_REQUEST]: ProcessingCookingRequestPayload;
  [EventType.FIREMAKING_MOVE_REQUEST]: FiremakingMoveRequestPayload;

  // Smelting Events (furnace: ore → bars)
  [EventType.SMELTING_INTERACT]: SmeltingInteractPayload;
  [EventType.SMELTING_REQUEST]: ProcessingSmeltingRequestPayload;
  [EventType.SMELTING_START]: SmeltingStartPayload;
  [EventType.SMELTING_SUCCESS]: SmeltingSuccessPayload;
  [EventType.SMELTING_FAILURE]: SmeltingFailurePayload;
  [EventType.SMELTING_COMPLETE]: SmeltingCompletePayload;
  [EventType.PROCESSING_SMELTING_REQUEST]: ProcessingSmeltingRequestPayload;

  // Smithing Events (anvil: bars → items)
  [EventType.SMITHING_INTERACT]: SmithingInteractPayload;
  [EventType.SMITHING_REQUEST]: ProcessingSmithingRequestPayload;
  [EventType.SMITHING_START]: SmithingStartPayload;
  [EventType.SMITHING_COMPLETE]: SmithingCompletePayload;
  [EventType.PROCESSING_SMITHING_REQUEST]: ProcessingSmithingRequestPayload;

  // Crafting Events (leather, jewelry, gem cutting)
  [EventType.CRAFTING_INTERACT]: CraftingInteractPayload;
  [EventType.CRAFTING_INTERFACE_OPEN]: CraftingInterfaceOpenPayload;
  [EventType.CRAFTING_START]: CraftingStartPayload;
  [EventType.CRAFTING_COMPLETE]: CraftingCompletePayload;
  [EventType.PROCESSING_CRAFTING_REQUEST]: ProcessingCraftingRequestPayload;

  // Fletching Events (knife + logs, stringing, arrow tipping)
  [EventType.FLETCHING_INTERACT]: FletchingInteractPayload;
  [EventType.FLETCHING_INTERFACE_OPEN]: FletchingInterfaceOpenPayload;
  [EventType.FLETCHING_START]: FletchingStartPayload;
  [EventType.FLETCHING_COMPLETE]: FletchingCompletePayload;
  [EventType.PROCESSING_FLETCHING_REQUEST]: ProcessingFletchingRequestPayload;

  // Runecrafting Events (instant altar conversion)
  [EventType.RUNECRAFTING_INTERACT]: RunecraftingInteractPayload;
  [EventType.RUNECRAFTING_COMPLETE]: RunecraftingCompletePayload;

  // Tanning Events (NPC tanner: hides → leather)
  [EventType.TANNING_INTERACT]: TanningInteractPayload;
  [EventType.TANNING_INTERFACE_OPEN]: TanningInterfaceOpenPayload;
  [EventType.TANNING_REQUEST]: TanningRequestPayload;
  [EventType.TANNING_COMPLETE]: TanningCompletePayload;

  // Quest Events
  [EventType.QUEST_START_CONFIRM]: QuestStartConfirmPayload;
  [EventType.QUEST_START_ACCEPTED]: QuestStartAcceptedPayload;
  [EventType.QUEST_START_DECLINED]: QuestStartDeclinedPayload;
  [EventType.QUEST_STARTED]: QuestStartedPayload;
  [EventType.QUEST_PROGRESSED]: QuestProgressedPayload;
  [EventType.QUEST_COMPLETED]: QuestCompletedPayload;
  [EventType.QUEST_ABANDONED]: QuestAbandonedPayload;

  // XP Lamp Events
  [EventType.XP_LAMP_USE_REQUEST]: XpLampUseRequestPayload;
  [EventType.XP_LAMP_SKILL_SELECTED]: XpLampSkillSelectedPayload;
  [EventType.XP_LAMP_APPLIED]: XpLampAppliedPayload;

  // Gathering Events
  [EventType.GATHERING_TOOL_SHOW]: GatheringToolShowPayload;
  [EventType.GATHERING_TOOL_HIDE]: GatheringToolHidePayload;

  // Inventory Events
  [EventType.INVENTORY_UPDATED]: InventoryUpdatedPayload;
  [EventType.INVENTORY_INITIALIZED]: InventoryInitializedPayload;
  [EventType.INVENTORY_COINS_UPDATED]: InventoryCoinsUpdatedPayload;
  [EventType.INVENTORY_REQUEST]: InventoryRequestPayload;

  // Skills Events
  [EventType.SKILLS_UPDATED]: SkillsUpdatedPayload;
  [EventType.XP_DROP_BROADCAST]: XpDropBroadcastPayload;

  // Prayer Events
  [EventType.PRAYER_STATE_SYNC]: {
    playerId: string;
    level?: number;
    xp?: number;
    points: number;
    maxPoints: number;
    active: readonly string[] | string[];
  };
  [EventType.PRAYER_TOGGLED]: PrayerToggledPayload;
  [EventType.PRAYER_POINTS_CHANGED]: PrayerPointsChangedPayload & {
    reason?: string;
  };

  // UI Events (event-bridge)
  [EventType.UI_MESSAGE]: UIMessagePayload;
  [EventType.UI_UPDATE]: UIUpdatePayload;
  [EventType.UI_DEATH_SCREEN]: UIDeathScreenPayload;
  [EventType.UI_DEATH_SCREEN_CLOSE]: UIDeathScreenClosePayload;
  [EventType.UI_ATTACK_STYLE_CHANGED]: UIAttackStyleChangedPayload;
  [EventType.UI_ATTACK_STYLE_UPDATE]: UIAttackStyleUpdatePayload;

  // Player Events (event-bridge)
  [EventType.PLAYER_SET_DEAD]: PlayerSetDeadPayload;
  [EventType.PLAYER_RESPAWNED]: PlayerRespawnedPayload;
  [EventType.PLAYER_WEIGHT_CHANGED]: PlayerWeightChangedPayload;
  [EventType.PLAYER_UPDATED]: PlayerUpdatedPayload;

  // Combat Events (event-bridge extras)
  [EventType.COMBAT_FACE_TARGET]: CombatFaceTargetPayload;
  [EventType.COMBAT_CLEAR_FACE_TARGET]: CombatClearFaceTargetPayload;

  // Fire Events (extra)
  [EventType.FIRE_LIGHTING_CANCELLED]: FireLightingCancelledPayload;

  // Smelting/Smithing Events
  [EventType.SMELTING_INTERFACE_OPEN]: SmeltingInterfaceOpenPayload;
  [EventType.SMITHING_INTERFACE_OPEN]: SmithingInterfaceOpenPayload;

  // Trade Events
  [EventType.TRADE_CANCELLED]: {
    tradeId: string;
    reason: string;
    message?: string;
    initiatorId?: string;
    recipientId?: string;
    initiatorSocketId?: string;
    recipientSocketId?: string;
    cancelledBy?: string;
  };

  // Duel System — Challenges
  [EventType.DUEL_CHALLENGE_DECLINED]: DuelChallengeDeclinedPayload;
  [EventType.DUEL_CHALLENGE_EXPIRED]: DuelChallengeExpiredPayload;
  [EventType.DUEL_CHALLENGE_CANCELLED]: DuelChallengeCancelledPayload;

  // Duel System — Session Lifecycle
  [EventType.DUEL_SESSION_CREATED]: DuelSessionCreatedPayload;
  [EventType.DUEL_STATE_CHANGED]: DuelStateChangedPayload;
  [EventType.DUEL_CANCELLED]: DuelCancelledPayload;
  [EventType.DUEL_COMPLETED]: DuelCompletedPayload;

  // Duel System — Rules & Equipment
  [EventType.DUEL_RULES_UPDATED]: DuelRulesUpdatedPayload;
  [EventType.DUEL_EQUIPMENT_UPDATED]: DuelEquipmentUpdatedPayload;
  [EventType.DUEL_EQUIPMENT_RESTRICT]: DuelEquipmentRestrictPayload;

  // Duel System — Stakes
  [EventType.DUEL_STAKES_UPDATED]: DuelStakesUpdatedPayload;
  [EventType.DUEL_STAKES_TRANSFER]: DuelStakesTransferPayload;
  [EventType.DUEL_STAKES_SETTLE]: DuelStakesSettlePayload;

  // Duel System — Acceptance & Countdown
  [EventType.DUEL_ACCEPTANCE_UPDATED]: DuelAcceptanceUpdatedPayload;
  [EventType.DUEL_COUNTDOWN_START]: DuelCountdownStartPayload;
  [EventType.DUEL_COUNTDOWN_TICK]: DuelCountdownTickPayload;
  [EventType.DUEL_FIGHT_START]: DuelFightStartPayload;
  [EventType.DUEL_ARENA_RELEASED]: DuelArenaReleasedPayload;

  // Duel System — Connectivity
  [EventType.DUEL_PLAYER_DISCONNECTED]: DuelPlayerDisconnectedPayload;
  [EventType.DUEL_PLAYER_RECONNECTED]: DuelPlayerReconnectedPayload;

  // NPC/Mob Events (ServerNetwork)
  [EventType.NPC_DIED]: NPCDiedPayload;
}

/**
 * Type-safe event emitter interface
 */
export interface TypedEventEmitter {
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
  on<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void,
  ): void;
  off<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void,
  ): void;
  once<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void,
  ): void;
}

// =========================================================================
// QUEST EVENT PAYLOADS
// =========================================================================

/**
 * Quest started payload
 */
export interface QuestStartedPayload {
  playerId: string;
  questId: string;
  questName: string;
}

/**
 * Quest progressed payload
 */
export interface QuestProgressedPayload {
  playerId: string;
  questId: string;
  stage: string;
  progress: Record<string, number>;
  description: string;
}

/**
 * Quest completed payload
 */
export interface QuestCompletedPayload {
  playerId: string;
  questId: string;
  questName: string;
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}

/**
 * Quest abandoned payload
 */
export interface QuestAbandonedPayload {
  playerId: string;
  questId: string;
  questName: string;
}

/**
 * Quest start confirm payload - show quest accept screen
 */
export interface QuestStartConfirmPayload {
  playerId: string;
  questId: string;
  questName: string;
  description: string;
  difficulty: string;
  requirements: {
    quests: string[];
    skills: Record<string, number>;
    items: string[];
  };
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}

/**
 * Quest start accepted payload - player confirmed quest start
 */
export interface QuestStartAcceptedPayload {
  playerId: string;
  questId: string;
}

/**
 * Quest start declined payload - player declined quest
 */
export interface QuestStartDeclinedPayload {
  playerId: string;
  questId: string;
}

// =========================================================================
// XP LAMP EVENT PAYLOADS
// =========================================================================

/**
 * XP lamp use request payload - player wants to use an XP lamp
 */
export interface XpLampUseRequestPayload {
  playerId: string;
  itemId: string;
  slot: number;
  xpAmount: number;
}

/**
 * XP lamp skill selected payload - player selected a skill for XP
 */
export interface XpLampSkillSelectedPayload {
  playerId: string;
  itemId: string;
  slot: number;
  skillId: string;
  xpAmount: number;
}

/**
 * XP lamp applied payload - server confirms XP was applied
 */
export interface XpLampAppliedPayload {
  playerId: string;
  skillId: string;
  xpAmount: number;
}

// =========================================================================
// ACTION BAR EVENT PAYLOADS
// =========================================================================

/** Action bar slot content - can be an item, skill, spell, prayer, or combat style */
export interface ActionBarSlotContent {
  type: "item" | "skill" | "spell" | "prayer" | "combatstyle" | "empty";
  id: string;
  itemId?: string;
  skillId?: string;
  spellId?: string;
  prayerId?: string;
  combatStyleId?: string;
  quantity?: number;
  icon?: string;
  label?: string;
}

/** Payload for action bar slot update events */
export interface ActionBarSlotUpdatePayload {
  barId: number;
  slotIndex: number;
  slot: ActionBarSlotContent;
}

/** Payload for action bar slot swap events */
export interface ActionBarSlotSwapPayload {
  barId: number;
  fromIndex: number;
  toIndex: number;
}

// =========================================================================
// GATHERING EVENT PAYLOADS
// =========================================================================

export interface GatheringToolShowPayload {
  playerId: string;
  itemId: string;
  slot: string;
}

export interface GatheringToolHidePayload {
  playerId: string;
  slot: string;
}

// =========================================================================
// INVENTORY EVENT PAYLOADS (event-bridge)
// =========================================================================

export interface InventoryUpdatedPayload {
  playerId: string;
  items: unknown[];
  coins?: number;
}

export interface InventoryInitializedPayload {
  playerId: string;
  inventory: { items: unknown[]; coins: number; maxSlots: number };
}

export interface InventoryCoinsUpdatedPayload {
  playerId: string;
  coins?: number;
  newAmount?: number;
}

export interface InventoryRequestPayload {
  playerId: string;
}

// =========================================================================
// SKILLS EVENT PAYLOADS (event-bridge)
// =========================================================================

export interface SkillsUpdatedPayload {
  playerId?: string;
  skills?: unknown;
}

export interface XpDropBroadcastPayload {
  playerId: string;
  skill: string;
  amount: number;
  newXp: number;
  newLevel: number;
  position: { x: number; y: number; z: number };
}

// =========================================================================
// PRAYER EVENT PAYLOADS (event-bridge)
// =========================================================================
// Note: PrayerStateSyncPayload and PrayerPointsChangedPayload are defined
// in ../game/prayer-types.ts and re-exported from there.

export interface PrayerToggledPayload {
  playerId?: string;
  prayerId?: string;
  active?: boolean;
  points?: number;
}

// =========================================================================
// UI EVENT PAYLOADS (event-bridge)
// =========================================================================
// Note: UIMessagePayload is defined earlier in this file (line ~164) and
// widened here via the EventMap entry.

export interface UIUpdatePayload {
  playerId?: string;
  component?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface UIDeathScreenPayload {
  playerId?: string;
  message?: string;
  killedBy?: string;
  respawnTime?: number;
  deathLocation?: { x: number; y: number; z: number };
  cause?: string;
}

export interface UIDeathScreenClosePayload {
  playerId: string;
}

export interface UIAttackStyleChangedPayload {
  playerId: string;
  currentStyle: unknown;
  availableStyles: unknown;
  canChange: boolean;
  cooldownRemaining?: number;
}

export interface UIAttackStyleUpdatePayload {
  playerId: string;
  currentStyle: unknown;
  availableStyles: unknown;
  canChange: boolean;
}

// =========================================================================
// PLAYER EVENT PAYLOADS (event-bridge)
// =========================================================================

export interface PlayerSetDeadPayload {
  playerId: string;
  isDead: boolean;
  deathPosition?: { x: number; y: number; z: number } | number[];
}

export interface PlayerRespawnedPayload {
  playerId: string;
  spawnPosition: { x: number; y: number; z: number } | number[];
  townName?: string;
  deathLocation?: number[];
}

export interface PlayerWeightChangedPayload {
  playerId: string;
  weight: number;
}

export interface PlayerUpdatedPayload {
  playerId: string;
  component?: string;
  data?: Record<string, unknown>;
}

// =========================================================================
// COMBAT EVENT PAYLOADS (event-bridge extras)
// =========================================================================

export interface CombatFaceTargetPayload {
  playerId: string;
  targetId: string;
}

export interface CombatClearFaceTargetPayload {
  playerId: string;
}

// =========================================================================
// FIRE EVENT PAYLOADS (event-bridge extras)
// =========================================================================

export interface FireLightingCancelledPayload {
  playerId: string;
}

// =========================================================================
// SMELTING/SMITHING EVENT PAYLOADS (event-bridge)
// =========================================================================

export interface SmeltingInterfaceOpenPayload {
  playerId: string;
  furnaceId: string;
  availableBars: Array<{
    barItemId: string;
    levelRequired: number;
    primaryOre: string;
    secondaryOre: string | null;
    coalRequired: number;
  }>;
}

export interface SmithingInterfaceOpenPayload {
  playerId: string;
  anvilId: string;
  availableRecipes: Array<{
    itemId: string;
    name: string;
    barType: string;
    barsRequired: number;
    levelRequired: number;
    xp: number;
    category: string;
  }>;
}

// =========================================================================
// TRADE EVENT PAYLOADS (event-bridge)
// =========================================================================
// Note: TradeCancelledPayload is defined in ../game/trade-types.ts.
// The server event-bridge adds extra fields (initiatorId, recipientId) via
// a server-specific inline type.

// =========================================================================
// DUEL EVENT PAYLOADS
// =========================================================================

import type {
  DuelRules,
  DuelState,
  EquipmentRestrictions,
  StakedItem,
  ArenaBounds,
} from "../game/duel-types";

export interface DuelChallengeDeclinedPayload {
  challengeId: string;
  challengerId: string;
  targetId: string;
}

export interface DuelChallengeExpiredPayload {
  challengeId: string;
  challengerId: string;
  targetId: string;
}

export interface DuelChallengeCancelledPayload {
  challengeId: string;
  challengerId?: string;
  targetId?: string;
  reason: string;
}

export interface DuelSessionCreatedPayload {
  duelId: string;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
}

export interface DuelStateChangedPayload {
  duelId: string;
  state: DuelState;
}

export interface DuelCancelledPayload {
  duelId: string;
  challengerId: string;
  targetId: string;
  reason: string;
  cancelledBy?: string;
}

export interface DuelCompletedPayload {
  duelId: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  reason: "death" | "forfeit";
  forfeit: boolean;
  winnerReceives: StakedItem[];
  winnerReceivesValue: number;
  challengerStakes: StakedItem[];
  targetStakes: StakedItem[];
  summary: {
    duration: number;
    rules: DuelRules;
    challengerStakeValue: number;
    targetStakeValue: number;
  };
}

export interface DuelRulesUpdatedPayload {
  duelId: string;
  rules: DuelRules;
  modifiedBy: string;
}

export interface DuelEquipmentUpdatedPayload {
  duelId: string;
  equipmentRestrictions: EquipmentRestrictions;
  modifiedBy: string;
}

export interface DuelEquipmentRestrictPayload {
  duelId: string;
  challengerId: string;
  targetId: string;
  disabledSlots: string[];
}

export interface DuelStakesUpdatedPayload {
  duelId: string;
  challengerStakes: StakedItem[];
  targetStakes: StakedItem[];
  modifiedBy: string;
}

export interface DuelStakesTransferPayload {
  winnerId: string;
  loserId: string;
  duelId: string;
  winnerReceives: StakedItem[];
  winnerKeeps: StakedItem[];
  loserLoses: StakedItem[];
  totalWinnings: number;
  winnerOwnStakeValue: number;
}

export interface DuelStakesSettlePayload {
  playerId: string;
  ownStakes: StakedItem[];
  wonStakes: StakedItem[];
  fromPlayerId: string;
  duelId: string;
  reason: string;
}

export interface DuelAcceptanceUpdatedPayload {
  duelId: string;
  challengerAccepted: boolean;
  targetAccepted: boolean;
}

export interface DuelCountdownStartPayload {
  duelId: string;
  arenaId: number;
  challengerId: string;
  targetId: string;
}

export interface DuelCountdownTickPayload {
  duelId: string;
  count: number;
  challengerId: string;
  targetId: string;
}

export interface DuelFightStartPayload {
  duelId: string;
  challengerId: string;
  targetId: string;
  arenaId: number;
  bounds?: ArenaBounds;
}

export interface DuelArenaReleasedPayload {
  arenaId: number;
}

export interface DuelPlayerDisconnectedPayload {
  duelId: string;
  playerId: string;
  challengerId: string;
  targetId: string;
  timeoutMs: number;
}

export interface DuelPlayerReconnectedPayload {
  duelId: string;
  playerId: string;
  challengerId: string;
  targetId: string;
}

// Generic event base type
export type AnyEvent = Record<string, unknown>;

/**
 * Event payloads type map
 */
export type EventPayloads = {
  [EventType.PLAYER_JOINED]: PlayerJoinedPayload;
  [EventType.ENTITY_CREATED]: EntityCreatedPayload;
  [EventType.PLAYER_LEVEL_UP]: PlayerLevelUpPayload;
  [EventType.PLAYER_XP_GAINED]: PlayerXPGainedPayload;
  [EventType.COMBAT_STARTED]: CombatStartedPayload;
  [EventType.COMBAT_FOLLOW_TARGET]: CombatFollowTargetPayload;
  [EventType.COMBAT_PLAYER_DISENGAGE]: CombatPlayerDisengagePayload;
  [EventType.PENDING_ATTACK_CANCEL]: PendingAttackCancelPayload;
  [EventType.INVENTORY_ITEM_ADDED]: InventoryItemAddedPayload;
  [EventType.NPC_DIED]: NPCDiedPayload;
};

/**
 * Helper type to extract event payload type
 */
export type EventPayload<K extends keyof EventMap> = EventMap[K];

/**
 * Helper type to ensure event name is valid
 */
export type ValidEventName = keyof EventMap;

/**
 * Helper function to create a typed event payload
 */
export function createEventPayload<K extends keyof EventMap>(
  event: K,
  data: EventMap[K],
): { event: K; data: EventMap[K] } {
  return { event, data };
}
