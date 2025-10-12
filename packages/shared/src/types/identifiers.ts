/**
 * Branded type identifiers for compile-time type safety
 * 
 * These types use the "brand" pattern to create distinct types at compile time
 * that are still strings at runtime. This prevents accidentally passing the
 * wrong type of ID to a function.
 */

// Branded types for IDs
export type PlayerID = string & { readonly __brand: 'PlayerID' }
export type ItemID = string & { readonly __brand: 'ItemID' }
export type MobID = string & { readonly __brand: 'MobID' }
export type EntityID = string & { readonly __brand: 'EntityID' }
export type StoreID = string & { readonly __brand: 'StoreID' }
export type BankID = string & { readonly __brand: 'BankID' }
export type ResourceID = string & { readonly __brand: 'ResourceID' }
export type NPCID = string & { readonly __brand: 'NPCID' }
export type SessionID = string & { readonly __brand: 'SessionID' }
export type QuestID = string & { readonly __brand: 'QuestID' }
export type SkillID = string & { readonly __brand: 'SkillID' }
export type ZoneID = string & { readonly __brand: 'ZoneID' }
export type ChunkID = string & { readonly __brand: 'ChunkID' }
export type SlotNumber = number & { readonly __brand: 'SlotNumber' }

// Validation functions
export function isValidPlayerID(id: unknown): id is PlayerID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidMobID(id: unknown): id is MobID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidEntityID(id: unknown): id is EntityID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidItemID(id: unknown): id is ItemID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidStoreID(id: unknown): id is StoreID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidBankID(id: unknown): id is BankID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidResourceID(id: unknown): id is ResourceID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidNPCID(id: unknown): id is NPCID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidSessionID(id: unknown): id is SessionID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidSlotNumber(slot: unknown): slot is SlotNumber {
  return typeof slot === 'number' && slot >= 0 && Number.isInteger(slot);
}

export function isValidQuestID(id: unknown): id is QuestID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidSkillID(id: unknown): id is SkillID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidZoneID(id: unknown): id is ZoneID {
  return typeof id === 'string' && id.length > 0;
}

export function isValidChunkID(id: unknown): id is ChunkID {
  return typeof id === 'string' && id.length > 0;
}

// Creation functions with validation
export function createPlayerID(id: string): PlayerID {
  if (!isValidPlayerID(id)) {
    throw new Error(`Invalid player ID: ${id}`);
  }
  return id as PlayerID;
}

export function createMobID(id: string): MobID {
  if (!isValidMobID(id)) {
    throw new Error(`Invalid mob ID: ${id}`);
  }
  return id as MobID;
}

export function createEntityID(id: string): EntityID {
  if (!isValidEntityID(id)) {
    throw new Error(`Invalid entity ID: ${id}`);
  }
  return id as EntityID;
}

export function createItemID(id: string): ItemID {
  if (!isValidItemID(id)) {
    throw new Error(`Invalid item ID: ${id}`);
  }
  return id as ItemID;
}

export function createStoreID(id: string): StoreID {
  if (!isValidStoreID(id)) {
    throw new Error(`Invalid store ID: ${id}`);
  }
  return id as StoreID;
}

export function createBankID(id: string): BankID {
  if (!isValidBankID(id)) {
    throw new Error(`Invalid bank ID: ${id}`);
  }
  return id as BankID;
}

export function createResourceID(id: string): ResourceID {
  if (!isValidResourceID(id)) {
    throw new Error(`Invalid resource ID: ${id}`);
  }
  return id as ResourceID;
}

export function createNPCID(id: string): NPCID {
  if (!isValidNPCID(id)) {
    throw new Error(`Invalid NPC ID: ${id}`);
  }
  return id as NPCID;
}

export function createSessionID(id: string): SessionID {
  if (!isValidSessionID(id)) {
    throw new Error(`Invalid session ID: ${id}`);
  }
  return id as SessionID;
}

export function createSlotNumber(slot: number): SlotNumber {
  if (!isValidSlotNumber(slot)) {
    throw new Error(`Invalid slot number: ${slot}`);
  }
  return slot as SlotNumber;
}

export function createQuestID(id: string): QuestID {
  if (!isValidQuestID(id)) {
    throw new Error(`Invalid quest ID: ${id}`);
  }
  return id as QuestID;
}

export function createSkillID(id: string): SkillID {
  if (!isValidSkillID(id)) {
    throw new Error(`Invalid skill ID: ${id}`);
  }
  return id as SkillID;
}

export function createZoneID(id: string): ZoneID {
  if (!isValidZoneID(id)) {
    throw new Error(`Invalid zone ID: ${id}`);
  }
  return id as ZoneID;
}

export function createChunkID(id: string): ChunkID {
  if (!isValidChunkID(id)) {
    throw new Error(`Invalid chunk ID: ${id}`);
  }
  return id as ChunkID;
}