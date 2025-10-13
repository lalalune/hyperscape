/**
 * Event type definitions for Hyperscape plugin
 */

import type { Position } from "./core-types";

// Base event data interface
export interface BaseEventData {
  timestamp?: number;
  source?: string;
}

// Player event data
export interface PlayerEventData extends BaseEventData {
  playerId: string;
  position?: Position;
  rotation?: { x: number; y: number; z: number; w: number };
}

// Entity event data
export interface EntityEventData extends BaseEventData {
  entityId: string;
  entityType?: string;
  data?: Record<string, unknown>;
}

// Chat event data
export interface ChatEventData extends BaseEventData {
  message: string;
  from: string;
  fromId?: string;
}

// Interaction event data
export interface InteractionEventData extends BaseEventData {
  targetId: string;
  targetType: string;
  interactionType: string;
  position?: Position;
}

// Combat event data
export interface CombatEventData extends BaseEventData {
  attackerId: string;
  targetId: string;
  damage?: number;
  damageType?: string;
  hit?: boolean;
}

// Movement event data
export interface MovementEventData extends BaseEventData {
  entityId: string;
  from: Position;
  to: Position;
  velocity?: Position;
}

// State change event data
export interface StateChangeEventData extends BaseEventData {
  entityId: string;
  oldState: string;
  newState: string;
  metadata?: Record<string, unknown>;
}

// Inventory event data
export interface InventoryEventData extends BaseEventData {
  playerId: string;
  action: "add" | "remove" | "update" | "equip" | "unequip";
  itemId?: string;
  quantity?: number;
  slot?: number;
}

// World event data
export interface WorldEventData extends BaseEventData {
  worldId: string;
  action: "load" | "unload" | "save" | "reset";
  metadata?: Record<string, unknown>;
}

// Network event data
export interface NetworkEventData extends BaseEventData {
  type: string;
  payload?: Record<string, unknown>;
}

// Event data union type
export type EventData =
  | PlayerEventData
  | EntityEventData
  | ChatEventData
  | InteractionEventData
  | CombatEventData
  | MovementEventData
  | StateChangeEventData
  | InventoryEventData
  | WorldEventData
  | NetworkEventData
  | BaseEventData;

// Event handler type
export type EventHandler<T extends EventData = EventData> = (
  data: T,
) => void | Promise<void>;

// Event map for type-safe event handling
export interface EventMap {
  "player:join": PlayerEventData;
  "player:leave": PlayerEventData;
  "player:move": MovementEventData;
  "entity:spawn": EntityEventData;
  "entity:despawn": EntityEventData;
  "entity:update": EntityEventData;
  "chat:message": ChatEventData;
  "interaction:start": InteractionEventData;
  "interaction:end": InteractionEventData;
  "combat:attack": CombatEventData;
  "combat:damage": CombatEventData;
  "combat:death": CombatEventData;
  "state:change": StateChangeEventData;
  "inventory:change": InventoryEventData;
  "world:event": WorldEventData;
  "network:message": NetworkEventData;
  [key: string]: EventData; // Allow custom events
}
