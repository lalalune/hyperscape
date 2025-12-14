/**
 * Event Payload Interfaces
 *
 * Type definitions for event payloads sent with each event type.
 */

import { Entity } from "../../entities/Entity";
import { PlayerLocal } from "../../entities/player/PlayerLocal";
import { Skills, InventoryItem, Position3D } from "../core/core";
import type { Resource } from "../core/core";
import type { Item } from "../core/core";
import type { EntitySpawnedEvent } from "../systems/system-interfaces";
import { EventType } from "./event-types";

// ============================================================================
// EVENT PAYLOAD INTERFACES
// ============================================================================

// Core Event Payloads
export interface PlayerJoinedPayload {
  playerId: string;
  player: PlayerLocal;
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
}

export interface InventoryItemAddedPayload {
  playerId: string;
  item: InventoryItem;
}

export interface NPCDiedPayload {
  mobId: string;
  killerId: string;
  loot: InventoryItem[];
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
  type: "info" | "warning" | "error";
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
  hitType: string;
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

  // XR Events
  [EventType.XR_SESSION]: XRSession | null;

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
      position: { x: number; y: number; z: number };
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
  [EventType.BANK_OPEN_REQUEST]: { playerId: string; npcId: string };
  [EventType.STORE_OPEN_REQUEST]: {
    playerId: string;
    npcId: string;
    inventory: unknown[];
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
  [EventType.TERRAIN_TILE_UNLOADED]: { tileId: string };
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
  };
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
