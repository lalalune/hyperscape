/**
 * IdentifierUtils.ts - Branded ID Type Utilities
 * 
 * Provides validation and creation functions for branded ID types.
 * These utilities work with the branded types defined in types/identifiers.ts.
 * 
 * **Branded Types:**
 * Branded types add compile-time type safety while remaining strings at runtime.
 * This prevents accidentally passing the wrong type of ID to a function.
 * 
 * Example:
 * ```ts
 * const playerId = createPlayerID('player_123');  // PlayerID brand
 * const mobId = createMobID('mob_456');           // MobID brand
 * 
 * function healPlayer(id: PlayerID) { ... }
 * healPlayer(playerId);  // ✅ Works
 * healPlayer(mobId);     // ❌ Compile error - can't use MobID as PlayerID
 * ```
 * 
 * **Functions Provided:**
 * - isValid*ID(): Type guards for runtime validation
 * - create*ID(): Create branded ID with validation
 * - to*ID(): Safe conversion from unknown to branded type (returns null if invalid)
 * 
 * **Referenced by:** All systems that work with typed IDs (PlayerSystem, MobNPCSystem, etc.)
 */

import { BankID, EntityID, ItemID, MobID, NPCID, PlayerID, ResourceID, SessionID, SlotNumber, StoreID } from "../types/identifiers"

// ============================================================================
// VALIDATION FUNCTIONS (Type Guards)
// ============================================================================

/** Validate a PlayerID at runtime */
export function isValidPlayerID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidItemID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidMobID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidEntityID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidStoreID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidBankID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidResourceID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidNPCID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidSessionID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function isValidSlotNumber(slot: unknown): slot is number {
  return typeof slot === 'number' && slot >= 0 && Number.isInteger(slot)
}

// Creation functions
export function createPlayerID(id: string): PlayerID {
  if (!isValidPlayerID(id)) {
    throw new Error(`Invalid player ID: ${id}`)
  }
  return id as PlayerID
}

export function createItemID(id: string): ItemID {
  if (!isValidItemID(id)) {
    throw new Error(`Invalid item ID: ${id}`)
  }
  return id as ItemID
}

export function createMobID(id: string): MobID {
  if (!isValidMobID(id)) {
    throw new Error(`Invalid mob ID: ${id}`)
  }
  return id as MobID
}

export function createEntityID(id: string): EntityID {
  if (!isValidEntityID(id)) {
    throw new Error(`Invalid entity ID: ${id}`)
  }
  return id as EntityID
}

export function createStoreID(id: string): StoreID {
  if (!isValidStoreID(id)) {
    throw new Error(`Invalid store ID: ${id}`)
  }
  return id as StoreID
}

export function createBankID(id: string): BankID {
  if (!isValidBankID(id)) {
    throw new Error(`Invalid bank ID: ${id}`)
  }
  return id as BankID
}

export function createResourceID(id: string): ResourceID {
  if (!isValidResourceID(id)) {
    throw new Error(`Invalid resource ID: ${id}`)
  }
  return id as ResourceID
}

export function createNPCID(id: string): NPCID {
  if (!isValidNPCID(id)) {
    throw new Error(`Invalid NPC ID: ${id}`)
  }
  return id as NPCID
}

export function createSessionID(id: string): SessionID {
  if (!isValidSessionID(id)) {
    throw new Error(`Invalid session ID: ${id}`)
  }
  return id as SessionID
}

export function createSlotNumber(slot: number): SlotNumber {
  if (!isValidSlotNumber(slot)) {
    throw new Error(`Invalid slot number: ${slot}`)
  }
  return slot as SlotNumber
}

// Safe conversion functions (return null on invalid input)
export function toPlayerID(id: unknown): PlayerID | null {
  return isValidPlayerID(id) ? (id as PlayerID) : null
}

export function toItemID(id: unknown): ItemID | null {
  return isValidItemID(id) ? (id as ItemID) : null
}

export function toMobID(id: unknown): MobID | null {
  return isValidMobID(id) ? (id as MobID) : null
}

export function toEntityID(id: unknown): EntityID | null {
  return isValidEntityID(id) ? (id as EntityID) : null
}

export function toStoreID(id: unknown): StoreID | null {
  return isValidStoreID(id) ? (id as StoreID) : null
}

export function toBankID(id: unknown): BankID | null {
  return isValidBankID(id) ? (id as BankID) : null
}

export function toResourceID(id: unknown): ResourceID | null {
  return isValidResourceID(id) ? (id as ResourceID) : null
}

export function toNPCID(id: unknown): NPCID | null {
  return isValidNPCID(id) ? (id as NPCID) : null
}

export function toSessionID(id: unknown): SessionID | null {
  return isValidSessionID(id) ? (id as SessionID) : null
}

export function toSlotNumber(slot: unknown): SlotNumber | null {
  return isValidSlotNumber(slot) ? (slot as SlotNumber) : null
}

export function isValidID(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0
}

export function assertValidID(id: unknown, type: string = 'ID'): asserts id is string {
  if (!isValidID(id)) {
    throw new Error(`Invalid ${type}: expected non-empty string, got ${typeof id}`)
  }
}

export function assertValidSlotNumber(slot: unknown): asserts slot is number {
  if (!isValidSlotNumber(slot)) {
    throw new Error(`Invalid slot number: expected non-negative integer, got ${typeof slot}`)
  }
}