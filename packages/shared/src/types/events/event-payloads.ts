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
