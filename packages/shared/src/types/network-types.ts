/**
 * network-types.ts - Strong Network Type Definitions
 *
 * Centralized type definitions for all network communication.
 * Eliminates `unknown` and `any` from network handlers.
 */

import type { EntityData } from "./base-types";

/**
 * Base network packet structure
 */
export interface NetworkPacket<T = Record<string, unknown>> {
  method: string;
  data: T;
  timestamp?: number;
}

/**
 * Entity modification packet
 */
export interface EntityModificationPacket {
  id: string;
  changes?: {
    p?: [number, number, number]; // Position
    q?: [number, number, number, number]; // Quaternion
    v?: [number, number, number]; // Velocity
    e?: string; // Emote
    name?: string;
    health?: number;
    avatar?: string;
    sessionAvatar?: string;
    roles?: string[];
    aiState?: string;
    currentHealth?: number;
    maxHealth?: number;
    targetPlayerId?: string | null;
    deathTime?: number | null;
    inCombat?: boolean;
    combatTarget?: string | null;
    [key: string]: unknown;
  };
}

/**
 * Entity event packet
 */
export interface EntityEventPacket {
  id: string;
  version: number;
  name: string;
  data?: Record<string, unknown>;
  event?: string;
  payload?: Record<string, unknown>;
}

/**
 * Chat packet
 */
export interface ChatPacket {
  id: string;
  from: string | null;
  fromId: string | null;
  body: string;
  text?: string;
  createdAt: string;
  timestamp?: number;
}

/**
 * Move request packet
 */
export interface MoveRequestPacket {
  target: [number, number, number] | null;
  runMode?: boolean;
  cancel?: boolean;
}

/**
 * Attack request packet
 */
export interface AttackRequestPacket {
  mobId: string;
  attackType: "melee" | "ranged" | "magic";
}

/**
 * Resource gather packet
 */
export interface ResourceGatherPacket {
  resourceId: string;
  playerPosition?: { x: number; y: number; z: number };
}

/**
 * Item pickup packet
 */
export interface ItemPickupPacket {
  itemId: string;
  entityId?: string;
}

/**
 * Item drop packet
 */
export interface ItemDropPacket {
  itemId: string;
  slot?: number;
  quantity?: number;
}

/**
 * Inventory update packet
 */
export interface InventoryUpdatePacket {
  playerId: string;
  items: Array<{
    slot: number;
    itemId: string;
    quantity: number;
    item?: {
      id: string;
      name: string;
      type: string;
      stackable: boolean;
      weight: number;
    };
  }>;
  coins: number;
  maxSlots: number;
}

/**
 * Skills update packet
 */
export interface SkillsUpdatePacket {
  playerId: string;
  skills: Record<string, { level: number; xp: number }>;
}

/**
 * Resource snapshot packet
 */
export interface ResourceSnapshotPacket {
  resources: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    isAvailable: boolean;
    respawnAt?: number;
  }>;
}

/**
 * Resource state packet
 */
export interface ResourceStatePacket {
  resourceId: string;
  position?: { x: number; y: number; z: number };
  depleted?: boolean;
}

/**
 * Character list packet
 */
export interface CharacterListPacket {
  characters: Array<{
    id: string;
    name: string;
    level?: number;
    lastLocation?: { x: number; y: number; z: number };
  }>;
}

/**
 * Character create packet
 */
export interface CharacterCreatePacket {
  name?: string;
}

/**
 * Character created response packet
 */
export interface CharacterCreatedPacket {
  id: string;
  name: string;
}

/**
 * Character selected packet
 */
export interface CharacterSelectedPacket {
  characterId: string | null;
}

/**
 * Enter world packet
 */
export interface EnterWorldPacket {
  characterId?: string;
}

/**
 * Player state packet
 */
export interface PlayerStatePacket {
  playerId: string;
  skills?: Record<string, { level: number; xp: number }>;
  [key: string]: unknown;
}

/**
 * Show toast packet
 */
export interface ShowToastPacket {
  playerId?: string;
  message: string;
  type: string;
}

/**
 * Trading system packets
 */
export interface TradeRequestPacket {
  targetPlayerId: string;
}

export interface TradeResponsePacket {
  tradeId: string;
  accepted: boolean;
  fromPlayerId: string;
}

export interface TradeOfferPacket {
  tradeId: string;
  items?: Array<{ itemId: string; quantity: number; slot: number }>;
  coins?: number;
}

export interface TradeConfirmPacket {
  tradeId: string;
}

export interface TradeCancelPacket {
  tradeId: string;
}

export interface TradeRequestReceivedPacket {
  tradeId: string;
  fromPlayerId: string;
  fromPlayerName: string;
}

export interface TradeStartedPacket {
  tradeId: string;
  initiatorId: string;
  initiatorName: string;
  recipientId: string;
  recipientName: string;
}

export interface TradeUpdatedPacket {
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

export interface TradeCompletedPacket {
  tradeId: string;
  message: string;
}

export interface TradeCancelledPacket {
  tradeId: string;
  reason: string;
  byPlayerId?: string;
}

export interface TradeErrorPacket {
  message: string;
}

/**
 * Snapshot packet (initial world state)
 */
export interface SnapshotPacket {
  id: string;
  serverTime: number;
  assetsUrl: string;
  apiUrl?: string;
  maxUploadSize?: string | number;
  settings: Record<string, unknown>;
  chat: unknown[];
  entities: EntityData[];
  livekit?: unknown;
  authToken: string;
  account?: {
    accountId: string;
    name: string;
    providers: {
      privyUserId: string | null;
    };
  };
  characters?: Array<{
    id: string;
    name: string;
    level?: number;
    lastLocation?: { x: number; y: number; z: number };
  }>;
}

/**
 * Network handler function type with proper packet types
 */
export type TypedNetworkHandler<T = Record<string, unknown>> = (
  socket: unknown,
  data: T,
) => void | Promise<void>;

/**
 * UI update event data
 */
export interface UIUpdatePacket {
  component: string;
  data: Record<string, unknown>;
  playerId?: string;
}

/**
 * Kick packet
 */
export interface KickPacket {
  code?: string;
  reason?: string;
}
