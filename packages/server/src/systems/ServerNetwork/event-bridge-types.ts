/**
 * Event Bridge Payload Types
 *
 * Type definitions for event payloads used by EventBridge.
 * These types ensure type safety when handling world events.
 */

import type { EventMap } from "@hyperscape/shared";

// Inventory event payloads
export interface InventoryInitializedPayload {
  playerId: string;
  inventory: {
    items: Array<{
      itemId: string;
      quantity: number;
      slotIndex?: number;
    }>;
    coins: number;
    maxSlots: number;
  };
}

export interface InventoryCoinsUpdatedPayload {
  playerId: string;
  coins: number;
}

export interface InventoryRequestPayload {
  playerId: string;
}

// Skill event payloads
export interface SkillsUpdatedPayload {
  playerId?: string;
  skills?: Record<string, { level: number; xp: number }>;
}

// UI event payloads
export interface UIMessagePayload {
  playerId: string;
  message: string;
  type: "info" | "warning" | "error" | "damage" | "system";
}

export interface UIUpdatePayload {
  component?: string;
  data?: {
    playerId?: string;
  };
}

export interface UIDeathScreenPayload {
  playerId: string;
  message: string;
  killedBy: string;
  respawnTime: number;
}

export interface UIDeathScreenClosePayload {
  playerId: string;
}

export interface PlayerSetDeadPayload {
  playerId: string;
  isDead: boolean;
}

export interface PlayerRespawnedPayload {
  playerId: string;
  spawnPosition: { x: number; y: number; z: number };
}

export interface UIAttackStyleChangedPayload {
  playerId: string;
  currentStyle: string;
  availableStyles: string[];
  canChange: boolean;
  cooldownRemaining?: number;
}

export interface UIAttackStyleUpdatePayload {
  playerId: string;
  currentStyle: string;
  availableStyles: string[];
  canChange: boolean;
}

// Combat event payloads
export interface CombatDamageDealtPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  targetType: "player" | "mob";
  position: { x: number; y: number; z: number };
}

// Player event payloads
export interface PlayerUpdatedPayload {
  playerId: string;
  component?: string;
  data?: {
    id: string;
    name: string;
    level: number;
    health: { current: number; max: number };
    alive: boolean;
  };
}

// Dialogue event payloads
export interface DialogueStartPayload {
  playerId: string;
  npcId: string;
  npcName: string;
  nodeId: string;
  text: string;
  responses: Array<{
    text: string;
    nextNodeId: string;
    effect?: string;
  }>;
  npcEntityId?: string;
}

export interface DialogueNodeChangePayload {
  playerId: string;
  npcId: string;
  nodeId: string;
  text: string;
  responses: Array<{
    text: string;
    nextNodeId: string;
    effect?: string;
  }>;
}

export interface DialogueEndPayload {
  playerId: string;
  npcId: string;
}

// Banking event payloads
export interface BankOpenRequestPayload {
  playerId: string;
  npcId: string;
  npcEntityId?: string;
}

// Store event payloads
export interface StoreOpenRequestPayload {
  playerId: string;
  npcId: string;
  storeId?: string;
  npcEntityId?: string;
}

// Use EventMap types where available
export type ResourceDepletedPayload =
  EventMap[typeof import("@hyperscape/shared").EventType.RESOURCE_DEPLETED];
export type ResourceRespawnedPayload =
  EventMap[typeof import("@hyperscape/shared").EventType.RESOURCE_RESPAWNED];
export type ResourceSpawnedPayload =
  EventMap[typeof import("@hyperscape/shared").EventType.RESOURCE_SPAWNED];
export type ResourceSpawnPointsPayload =
  EventMap[typeof import("@hyperscape/shared").EventType.RESOURCE_SPAWN_POINTS_REGISTERED];
