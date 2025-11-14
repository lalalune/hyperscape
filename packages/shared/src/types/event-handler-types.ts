/**
 * event-handler-types.ts - Strong Event Handler Type Definitions
 *
 * Type-safe event data structures for all system events.
 * Eliminates `unknown` from event handlers.
 */

import type THREE from "three";
import type { Skills, Position3D, Item } from "./core";
import type { Entity } from "../entities/Entity";
import type { Player } from "./core";

/**
 * Player Events
 */
export interface PlayerRegisteredEvent {
  playerId: string;
  player?: Player;
}

export interface PlayerJoinedEvent {
  playerId: string;
  player: Player;
}

export interface PlayerLeftEvent {
  playerId: string;
  reason?: string;
}

export interface PlayerUnregisteredEvent {
  playerId: string;
}

export interface PlayerTeleportRequestEvent {
  playerId: string;
  position: { x: number; y: number; z: number };
  rotationY?: number;
}

export interface PlayerHealthUpdatedEvent {
  playerId: string;
  health: number;
  maxHealth: number;
}

export interface PlayerAvatarReadyEvent {
  playerId: string;
  avatar: unknown; // Avatar type needs proper definition
  camHeight: number;
}

export interface PlayerEquipmentChangedEvent {
  playerId: string;
  slot: string;
  itemId: string | null;
}

export interface PlayerStatsEquipmentUpdatedEvent {
  playerId: string;
  equipmentStats: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    constitution: number;
  };
}

/**
 * Inventory Events
 */
export interface InventoryUpdatedEvent {
  playerId: string;
  items: Array<{
    slot: number;
    itemId: string;
    quantity: number;
  }>;
  coins: number;
  maxSlots: number;
}

export interface InventoryInitializedEvent {
  playerId: string;
  inventory: {
    items: unknown[];
    coins: number;
    maxSlots: number;
  };
}

export interface InventoryRequestEvent {
  playerId: string;
}

export interface InventoryCoinsUpdatedEvent {
  playerId: string;
  newAmount: number;
}

export interface InventoryItemAddedEvent {
  playerId: string;
  item: {
    id: string;
    itemId: string;
    quantity: number;
    slot: number;
    metadata: Record<string, unknown> | null;
  };
}

export interface InventoryItemRemovedEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}

export interface InventoryUpdateCoinsEvent {
  playerId: string;
  coins: number;
  isClaimed?: boolean;
}

export interface InventoryCheckEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  callback: (hasItem: boolean, itemInfo?: Item) => void;
}

export interface InventoryHasItemEvent {
  playerId: string;
  itemId: string;
  callback: (hasItem: boolean) => void;
}

export interface InventoryConsumeItemEvent {
  playerId: string;
  itemId: string | number;
  slot: number;
}

export interface InventoryItemRightClickEvent {
  playerId: string;
  itemId: string;
  slot: number;
}

export interface InventoryRemoveItemEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

/**
 * Combat Events
 */
export interface CombatAttackRequestEvent {
  playerId?: string;
  attackerId?: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType?: "melee" | "ranged" | "magic";
  position?: { x: number; y: number; z: number };
}

export interface CombatMobAttackEvent {
  mobId: string;
  targetId: string;
  damage: number;
  attackerType: "mob";
  targetType: "player";
}

export interface CombatDamageDealtEvent {
  targetId: string;
  damage: number;
  position: { x: number; y: number; z: number };
}

export interface CombatKillEvent {
  attackerId: string;
  targetId: string;
  damageDealt: number;
  attackStyle: string;
}

/**
 * Resource Events
 */
export interface ResourceGatherEvent {
  playerId: string;
  resourceId: string;
  playerPosition: { x: number; y: number; z: number };
}

export interface ResourceDepletedEvent {
  resourceId: string;
  position?: { x: number; y: number; z: number };
  depleted?: boolean;
}

export interface ResourceRespawnedEvent {
  resourceId: string;
  position?: { x: number; y: number; z: number };
  depleted?: boolean;
}

export interface ResourceSpawnedEvent {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
}

export interface ResourceSpawnPointsRegisteredEvent {
  spawnPoints: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
  }>;
}

export interface ResourceGatheringCompletedEvent {
  playerId: string;
  resourceId: string;
  successful: boolean;
  skill: string;
}

export interface TerrainResourcesRegisteredEvent {
  spawnPoints: Array<{
    id: string;
    type: string;
    subType?: string;
    position: { x: number; y: number; z: number };
    respawnTime: number;
    depleted: boolean;
  }>;
}

/**
 * Skills Events
 */
export interface SkillsUpdatedEvent {
  playerId: string;
  skills: Record<string, { level: number; xp: number }>;
}

export interface SkillActionEvent {
  entityId: string;
  skill: keyof Skills;
  xp: number;
}

/**
 * Item Events
 */
export interface ItemSpawnEvent {
  itemId: string;
  quantity: number;
  position: { x: number; y: number; z: number };
  droppedBy?: string;
}

export interface ItemPickupEvent {
  playerId: string;
  entityId: string;
  itemId?: string;
}

export interface ItemDropEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}

export interface ItemSpawnedEvent {
  itemId: string;
  itemType: string;
  position: { x: number; y: number; z: number };
  spawnType: string;
  location: string;
  config: Record<string, unknown>;
}

/**
 * NPC Events
 */
export interface NPCDiedEvent {
  mobId: string;
  mobType: string;
  level: number;
  killedBy: string;
  position: { x: number; y: number; z: number };
}

export interface MobNPCRespawnedEvent {
  mobId: string;
  position: { x: number; y: number; z: number };
}

export interface MobNPCExamineEvent {
  playerId: string;
  mobId: string;
  mobData: {
    id: string;
    name: string;
    type: string;
    level: number;
    health: number;
    maxHealth: number;
  };
}

export interface NPCSpawnRequestEvent {
  npcId: string;
  name: string;
  type: string;
  position: Position3D;
  services?: string[];
  modelPath?: string;
}

export interface NPCDialogueEvent {
  playerId: string;
  npcId: string;
}

/**
 * Bank Events
 */
export interface BankOpenEvent {
  playerId: string;
  bankId: string;
  playerPosition?: { x: number; y: number; z: number };
  position?: { x: number; y: number; z: number };
  npcName?: string;
  bankItems?: Record<string, number>;
  services?: string[];
}

export interface BankCloseEvent {
  playerId: string;
  bankId: string;
}

export interface BankDepositEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  bankId?: string;
}

export interface BankWithdrawEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  bankId?: string;
}

export interface BankDepositSuccessEvent {
  playerId: string;
  itemId?: string;
  quantity?: number;
  bankId: string;
  itemsDeposited?: number;
  newBankQuantity?: number;
}

export interface BankWithdrawSuccessEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  newBankQuantity: number;
}

/**
 * Store Events
 */
export interface StoreOpenEvent {
  playerId: string;
  storeId: string;
  position?: { x: number; y: number; z: number };
  npcName?: string;
  storeItems?: Record<
    string,
    { quantity: number; buyPrice: number; sellPrice: number }
  >;
  services?: string[];
}

export interface StoreBuyEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  totalPrice?: number;
  newStoreQuantity?: number;
}

export interface StoreSellEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  totalPrice?: number;
  newStoreQuantity?: number;
}

/**
 * UI Events
 */
export interface UIUpdateEvent {
  component: string;
  data: Record<string, unknown>;
  playerId?: string;
}

export interface UIMessageEvent {
  playerId: string;
  message: string;
  type: "info" | "warning" | "error" | "success" | "examine";
}

export interface UIToastEvent {
  message: string;
  type: "info" | "warning" | "error" | "success";
}

export interface UIOpenPaneEvent {
  pane: string;
  playerId?: string;
}

export interface UIKickEvent {
  playerId: string;
  reason: string;
}

/**
 * Entity Events
 */
export interface EntityModifiedEvent {
  id: string;
  changes: Record<string, unknown>;
}

export interface EntityDeathEvent {
  entityId: string;
  killedBy?: string;
  entityType: "player" | "mob" | "npc";
}

export interface EntityRemovedEvent {
  id: string;
}

export interface EntitySpawnedEvent {
  entityId: string;
  entityType: string;
  position: { x: number; y: number; z: number };
}

/**
 * Camera Events
 */
export interface CameraSetTargetEvent {
  target:
    | Entity
    | {
        position: THREE.Vector3;
        node?: { position: THREE.Vector3; quaternion?: THREE.Quaternion };
      };
}

export interface CameraFollowPlayerEvent {
  playerId: string;
  entity: { id: string; mesh: object | null };
  camHeight: number;
}

export interface CameraTapEvent {
  x: number;
  y: number;
}

/**
 * Graphics Events
 */
export interface GraphicsResizeEvent {
  width: number;
  height: number;
  aspect: number;
}

/**
 * Assets Events
 */
export interface AssetsLoadingProgressEvent {
  progress: number;
  total: number;
}

/**
 * Trade Events
 */
export interface TradeRequestReceivedEvent {
  tradeId: string;
  fromPlayerId: string;
  fromPlayerName: string;
}

export interface TradeStartedEvent {
  tradeId: string;
  initiatorId: string;
  initiatorName: string;
  recipientId: string;
  recipientName: string;
}

export interface TradeUpdatedEvent {
  tradeId: string;
  initiatorOffer: {
    items: Array<{ itemId: string; quantity: number; slot: number }>;
    coins: number;
  };
  recipientOffer: {
    items: Array<{ itemId: string; quantity: number; slot: number }>;
    coins: number;
  };
  initiatorConfirmed: boolean;
  recipientConfirmed: boolean;
}

export interface TradeCompletedEvent {
  tradeId: string;
  message: string;
}

export interface TradeCancelledEvent {
  tradeId: string;
  reason: string;
  byPlayerId?: string;
}

export interface TradeErrorEvent {
  message: string;
}

/**
 * Corpse Events
 */
export interface CorpseClickEvent {
  corpseId: string;
  playerId: string;
  position: { x: number; y: number; z: number };
}

/**
 * Equipment Events
 */
export interface EquipmentEquipEvent {
  playerId: string;
  itemId: string;
  slot: string;
}

export interface EquipmentUnequipEvent {
  playerId: string;
  slot: string;
}

export interface EquipmentTryEquipEvent {
  playerId: string;
  itemId: string;
}

export interface EquipmentForceEquipEvent {
  playerId: string;
  itemId: string;
  slot: string;
}

export interface EquipmentConsumeArrowEvent {
  playerId: string;
}

/**
 * Terrain Events
 */
export interface TerrainTileGeneratedEvent {
  tileX: number;
  tileZ: number;
  biome: string;
}

export interface TerrainTileUnloadedEvent {
  tileId: string;
}

/**
 * Character Events
 */
export interface CharacterListEvent {
  characters: Array<{
    id: string;
    name: string;
    level?: number;
    lastLocation?: { x: number; y: number; z: number };
  }>;
}

export interface CharacterCreatedEvent {
  id: string;
  name: string;
}

export interface CharacterSelectedEvent {
  characterId: string | null;
}

/**
 * Network Events
 */
export interface NetworkDisconnectedEvent {
  code: number;
  reason: string;
}

/**
 * XR Events
 */
export interface XRSessionEvent {
  session: XRSession | null;
}

/**
 * Settings Events
 */
export interface SettingsChangeEvent {
  [key: string]: {
    prev: unknown;
    value: unknown;
  };
}

/**
 * Avatar Events
 */
export interface AvatarLoadCompleteEvent {
  playerId: string;
  success: boolean;
}

/**
 * Generic event type mapping
 */
export interface EventDataMap {
  PLAYER_REGISTERED: PlayerRegisteredEvent;
  PLAYER_JOINED: PlayerJoinedEvent;
  PLAYER_LEFT: PlayerLeftEvent;
  PLAYER_UNREGISTERED: PlayerUnregisteredEvent;
  PLAYER_TELEPORT_REQUEST: PlayerTeleportRequestEvent;
  PLAYER_HEALTH_UPDATED: PlayerHealthUpdatedEvent;
  PLAYER_AVATAR_READY: PlayerAvatarReadyEvent;
  PLAYER_EQUIPMENT_CHANGED: PlayerEquipmentChangedEvent;
  PLAYER_STATS_EQUIPMENT_UPDATED: PlayerStatsEquipmentUpdatedEvent;

  INVENTORY_UPDATED: InventoryUpdatedEvent;
  INVENTORY_INITIALIZED: InventoryInitializedEvent;
  INVENTORY_REQUEST: InventoryRequestEvent;
  INVENTORY_COINS_UPDATED: InventoryCoinsUpdatedEvent;
  INVENTORY_UPDATE_COINS: InventoryUpdateCoinsEvent;
  INVENTORY_ITEM_ADDED: InventoryItemAddedEvent;
  INVENTORY_ITEM_REMOVED: InventoryItemRemovedEvent;
  INVENTORY_CHECK: InventoryCheckEvent;
  INVENTORY_HAS_ITEM: InventoryHasItemEvent;
  INVENTORY_CONSUME_ITEM: InventoryConsumeItemEvent;
  INVENTORY_ITEM_RIGHT_CLICK: InventoryItemRightClickEvent;
  INVENTORY_REMOVE_ITEM: InventoryRemoveItemEvent;

  COMBAT_ATTACK_REQUEST: CombatAttackRequestEvent;
  COMBAT_MOB_NPC_ATTACK: CombatMobAttackEvent;
  COMBAT_DAMAGE_DEALT: CombatDamageDealtEvent;
  COMBAT_KILL: CombatKillEvent;

  RESOURCE_GATHER: ResourceGatherEvent;
  RESOURCE_DEPLETED: ResourceDepletedEvent;
  RESOURCE_RESPAWNED: ResourceRespawnedEvent;
  RESOURCE_SPAWNED: ResourceSpawnedEvent;
  RESOURCE_SPAWN_POINTS_REGISTERED: ResourceSpawnPointsRegisteredEvent;
  RESOURCE_GATHERING_COMPLETED: ResourceGatheringCompletedEvent;
  TERRAIN_RESOURCES_REGISTERED: TerrainResourcesRegisteredEvent;

  SKILLS_UPDATED: SkillsUpdatedEvent;
  SKILL_ACTION: SkillActionEvent;

  ITEM_SPAWN: ItemSpawnEvent;
  ITEM_PICKUP: ItemPickupEvent;
  ITEM_DROP: ItemDropEvent;
  ITEM_SPAWNED: ItemSpawnedEvent;

  NPC_DIED: NPCDiedEvent;
  MOB_NPC_RESPAWNED: MobNPCRespawnedEvent;
  MOB_NPC_EXAMINE: MobNPCExamineEvent;
  NPC_SPAWN_REQUEST: NPCSpawnRequestEvent;
  NPC_DIALOGUE: NPCDialogueEvent;

  BANK_OPEN: BankOpenEvent;
  BANK_CLOSE: BankCloseEvent;
  BANK_DEPOSIT: BankDepositEvent;
  BANK_WITHDRAW: BankWithdrawEvent;
  BANK_DEPOSIT_SUCCESS: BankDepositSuccessEvent;
  BANK_WITHDRAW_SUCCESS: BankWithdrawSuccessEvent;

  STORE_OPEN: StoreOpenEvent;
  STORE_BUY: StoreBuyEvent;
  STORE_SELL: StoreSellEvent;

  UI_UPDATE: UIUpdateEvent;
  UI_MESSAGE: UIMessageEvent;
  UI_TOAST: UIToastEvent;
  UI_OPEN_PANE: UIOpenPaneEvent;
  UI_KICK: UIKickEvent;

  ENTITY_MODIFIED: EntityModifiedEvent;
  ENTITY_DEATH: EntityDeathEvent;

  CAMERA_SET_TARGET: CameraSetTargetEvent;
  CAMERA_FOLLOW_PLAYER: CameraFollowPlayerEvent;
  CAMERA_TAP: CameraTapEvent;

  GRAPHICS_RESIZE: GraphicsResizeEvent;
  ASSETS_LOADING_PROGRESS: AssetsLoadingProgressEvent;

  TRADE_REQUEST_RECEIVED: TradeRequestReceivedEvent;
  TRADE_STARTED: TradeStartedEvent;
  TRADE_UPDATED: TradeUpdatedEvent;
  TRADE_COMPLETED: TradeCompletedEvent;
  TRADE_CANCELLED: TradeCancelledEvent;
  TRADE_ERROR: TradeErrorEvent;

  CORPSE_CLICK: CorpseClickEvent;

  EQUIPMENT_EQUIP: EquipmentEquipEvent;
  EQUIPMENT_UNEQUIP: EquipmentUnequipEvent;
  EQUIPMENT_TRY_EQUIP: EquipmentTryEquipEvent;
  EQUIPMENT_FORCE_EQUIP: EquipmentForceEquipEvent;
  EQUIPMENT_CONSUME_ARROW: EquipmentConsumeArrowEvent;

  TERRAIN_TILE_GENERATED: TerrainTileGeneratedEvent;
  TERRAIN_TILE_UNLOADED: TerrainTileUnloadedEvent;

  CHARACTER_LIST: CharacterListEvent;
  CHARACTER_CREATED: CharacterCreatedEvent;
  CHARACTER_SELECTED: CharacterSelectedEvent;

  NETWORK_DISCONNECTED: NetworkDisconnectedEvent;
  XR_SESSION: XRSessionEvent;
  AVATAR_LOAD_COMPLETE: AvatarLoadCompleteEvent;

  READY: Record<string, never>;
  PLAYER_DESTROY: { playerId: string };
}

/**
 * Type-safe event emitter function
 */
export type TypedEventEmitter = <K extends keyof EventDataMap>(
  event: K,
  data: EventDataMap[K],
) => void;

/**
 * Type-safe event listener function
 */
export type TypedEventListener<K extends keyof EventDataMap> = (
  data: EventDataMap[K],
) => void;
