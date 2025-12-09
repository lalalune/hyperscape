/**
 * Event data types for Hyperscape game events
 * These types define the structure of data sent with each event type
 */

/**
 * Combat event data types
 */
export interface CombatStartedData {
  targetName: string;
  targetId: string;
}

export interface CombatEndedData {
  outcome: "victory" | "defeat";
}

export interface CombatKillData {
  targetName: string;
  xpGained: number;
}

export interface CombatAttackData {
  attackerId: string;
  targetId: string;
  damage: number;
}

/**
 * Entity event data types
 */
export interface EntityUpdatedData {
  id?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  currentHealth?: number;
  maxHealth?: number;
  deathTime?: number | null;
  mobType?: string;
  type?: string;
}

export interface EntityJoinedData {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
}

export interface EntityLeftData {
  id: string;
  name: string;
  type?: string;
}

/**
 * Resource event data types
 */
export interface ResourceGatheredData {
  resourceId: string;
  resourceType: string;
  skillUsed: string;
  xpGained: number;
  itemsReceived: Array<{ itemId: string; quantity: number }>;
}

export interface ResourceDepletedData {
  resourceId: string;
  resourceType: string;
  respawnTime?: number;
}

export interface ResourceRespawnedData {
  resourceId: string;
  resourceType: string;
  position: [number, number, number];
}

/**
 * Skills event data types
 */
export interface SkillsLevelUpData {
  skill: string;
  newLevel: number;
  previousLevel: number;
}

export interface SkillsXpGainedData {
  skill: string;
  amount: number;
  newTotal: number;
}

export interface SkillsUpdatedData {
  skills: Record<string, { level: number; xp: number }>;
}

/**
 * Inventory event data types
 */
export interface InventoryUpdatedData {
  playerId: string;
  items: Array<{
    slot: number;
    itemId?: string;
    quantity: number;
    itemName?: string;
  }>;
}

export interface ItemPickedUpData {
  playerId: string;
  itemId: string;
  quantity: number;
  slot: number;
}

export interface ItemDroppedData {
  playerId: string;
  itemId: string;
  quantity: number;
  position: [number, number, number];
}

/**
 * Player event data types
 */
export interface PlayerJoinedData {
  playerId: string;
  playerName: string;
  position: [number, number, number];
}

export interface PlayerLeftData {
  playerId: string;
  playerName: string;
}

export interface PlayerSpawnedData {
  playerId: string;
  playerName: string;
  position: [number, number, number];
}

export interface PlayerDiedData {
  playerId: string;
  playerName: string;
  respawnTime: number;
}

export interface PlayerEquipmentChangedData {
  playerId: string;
  slot: string;
  itemId: string | null;
  previousItemId?: string | null;
}

/**
 * Chat event data types
 */
export interface ChatMessageData {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

/**
 * Type guard functions for event data
 */
export function isCombatStartedData(data: unknown): data is CombatStartedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "targetName" in data &&
    "targetId" in data &&
    typeof (data as CombatStartedData).targetName === "string" &&
    typeof (data as CombatStartedData).targetId === "string"
  );
}

export function isCombatEndedData(data: unknown): data is CombatEndedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "outcome" in data &&
    ((data as CombatEndedData).outcome === "victory" ||
      (data as CombatEndedData).outcome === "defeat")
  );
}

export function isCombatKillData(data: unknown): data is CombatKillData {
  return (
    typeof data === "object" &&
    data !== null &&
    "targetName" in data &&
    "xpGained" in data &&
    typeof (data as CombatKillData).targetName === "string" &&
    typeof (data as CombatKillData).xpGained === "number"
  );
}

export function isEntityUpdatedData(data: unknown): data is EntityUpdatedData {
  return typeof data === "object" && data !== null;
}

export function isSkillsLevelUpData(data: unknown): data is SkillsLevelUpData {
  return (
    typeof data === "object" &&
    data !== null &&
    "skill" in data &&
    "newLevel" in data &&
    typeof (data as SkillsLevelUpData).skill === "string" &&
    typeof (data as SkillsLevelUpData).newLevel === "number"
  );
}

export function isSkillsXpGainedData(
  data: unknown,
): data is SkillsXpGainedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "skill" in data &&
    "amount" in data &&
    typeof (data as SkillsXpGainedData).skill === "string" &&
    typeof (data as SkillsXpGainedData).amount === "number"
  );
}

export function isInventoryUpdatedData(
  data: unknown,
): data is InventoryUpdatedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "playerId" in data &&
    "items" in data &&
    typeof (data as InventoryUpdatedData).playerId === "string" &&
    Array.isArray((data as InventoryUpdatedData).items)
  );
}

export function isResourceGatheredData(
  data: unknown,
): data is ResourceGatheredData {
  return (
    typeof data === "object" &&
    data !== null &&
    "resourceId" in data &&
    "skillUsed" in data &&
    typeof (data as ResourceGatheredData).resourceId === "string" &&
    typeof (data as ResourceGatheredData).skillUsed === "string"
  );
}
