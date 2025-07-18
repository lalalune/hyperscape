import { World } from "../types/hyperfy"
/**
 * RPG Event definitions
 * These events are emitted by the RPG systems and can be listened to via the public API
 */

import { Vector3 } from '../types'

/**
 * Player Events
 */
export interface PlayerConnectedEvent {
  playerId: string
  username: string
  position: Vector3
  timestamp: number
}

export interface PlayerDisconnectedEvent {
  playerId: string
  timestamp: number
}

export interface PlayerMovedEvent {
  playerId: string
  from: Vector3
  to: Vector3
  timestamp: number
}

export interface PlayerLevelUpEvent {
  playerId: string
  skill: string
  oldLevel: number
  newLevel: number
  totalLevel: number
  timestamp: number
}

export interface PlayerDeathEvent {
  playerId: string
  killerId?: string
  position: Vector3
  itemsLost: Array<{ itemId: number; quantity: number }>
  timestamp: number
}

export interface PlayerRespawnEvent {
  playerId: string
  position: Vector3
  timestamp: number
}

/**
 * Combat Events
 */
export interface CombatStartedEvent {
  attackerId: string
  targetId: string
  timestamp: number
}

export interface CombatEndedEvent {
  entityId: string
  reason: 'death' | 'escape' | 'timeout'
  timestamp: number
}

export interface DamageDealtEvent {
  attackerId: string
  targetId: string
  damage: number
  attackType: 'melee' | 'ranged' | 'magic'
  timestamp: number
}

/**
 * Item Events
 */
export interface ItemPickedUpEvent {
  playerId: string
  itemId: number
  quantity: number
  position: Vector3
  timestamp: number
}

export interface ItemDroppedEvent {
  playerId: string
  itemId: number
  quantity: number
  position: Vector3
  timestamp: number
}

export interface ItemEquippedEvent {
  playerId: string
  itemId: number
  slot: string
  timestamp: number
}

export interface ItemUnequippedEvent {
  playerId: string
  itemId: number
  slot: string
  timestamp: number
}

/**
 * Banking Events
 */
export interface BankOpenedEvent {
  playerId: string
  bankId: string
  timestamp: number
}

export interface BankClosedEvent {
  playerId: string
  timestamp: number
}

export interface BankDepositEvent {
  playerId: string
  itemId: number
  quantity: number
  timestamp: number
}

export interface BankWithdrawEvent {
  playerId: string
  itemId: number
  quantity: number
  timestamp: number
}

/**
 * Trading Events
 */
export interface TradeRequestEvent {
  fromPlayerId: string
  toPlayerId: string
  timestamp: number
}

export interface TradeStartedEvent {
  player1Id: string
  player2Id: string
  timestamp: number
}

export interface TradeCompletedEvent {
  player1Id: string
  player2Id: string
  player1Items: Array<{ itemId: number; quantity: number }>
  player2Items: Array<{ itemId: number; quantity: number }>
  timestamp: number
}

export interface TradeCancelledEvent {
  playerId: string
  otherPlayerId: string
  reason: string
  timestamp: number
}

/**
 * NPC Events
 */
export interface NPCSpawnedEvent {
  npcId: string
  npcType: string
  position: Vector3
  timestamp: number
}

export interface NPCDeathEvent {
  npcId: string
  killerId?: string
  drops: Array<{ itemId: number; quantity: number }>
  timestamp: number
}

export interface NPCRespawnedEvent {
  npcId: string
  position: Vector3
  timestamp: number
}

/**
 * World Events
 */
export interface WorldSaveEvent {
  timestamp: number
  entityCount: number
  playerCount: number
}

export interface RandomEventTriggeredEvent {
  eventType: string
  affectedPlayers: string[]
  position?: Vector3
  timestamp: number
}

/**
 * All RPG Events
 */
export interface RPGEvents {
  // Player
  'player:connected': PlayerConnectedEvent
  'player:disconnected': PlayerDisconnectedEvent
  'player:moved': PlayerMovedEvent
  'player:levelup': PlayerLevelUpEvent
  'player:death': PlayerDeathEvent
  'player:respawn': PlayerRespawnEvent
  
  // Combat
  'combat:started': CombatStartedEvent
  'combat:ended': CombatEndedEvent
  'combat:damage': DamageDealtEvent
  
  // Items
  'item:pickup': ItemPickedUpEvent
  'item:drop': ItemDroppedEvent
  'item:equip': ItemEquippedEvent
  'item:unequip': ItemUnequippedEvent
  
  // Banking
  'bank:opened': BankOpenedEvent
  'bank:closed': BankClosedEvent
  'bank:deposit': BankDepositEvent
  'bank:withdraw': BankWithdrawEvent
  
  // Trading
  'trade:request': TradeRequestEvent
  'trade:started': TradeStartedEvent
  'trade:completed': TradeCompletedEvent
  'trade:cancelled': TradeCancelledEvent
  
  // NPCs
  'npc:spawned': NPCSpawnedEvent
  'npc:death': NPCDeathEvent
  'npc:respawned': NPCRespawnedEvent
  
  // World
  'world:save': WorldSaveEvent
  'world:event': RandomEventTriggeredEvent
} 