import type {
  InventorySlotItem,
  InventoryUpdatedEvent,
} from "@hyperscape/shared";
import type { PlayerStats, Item } from "./index";

// Re-export InventoryUpdatedEvent from shared
export type { InventoryUpdatedEvent };

// Define local event types that aren't exported from shared
export interface SkillsUpdatedEvent {
  playerId: string;
  skills: Record<string, { level: number; xp: number }>;
}

export interface UIUpdateEvent {
  component: string;
  data: Record<string, unknown>;
}

export interface CorpseClickEvent {
  corpseId: string;
  playerId: string;
  position: { x: number; y: number; z: number };
}

export type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

export interface UIUpdatePlayerData extends PlayerStats {}

export interface UIUpdateEquipmentData {
  equipment: {
    weapon?: { item: Item | null };
    shield?: { item: Item | null };
    helmet?: { item: Item | null };
    body?: { item: Item | null };
    legs?: { item: Item | null };
    arrows?: { item: Item | null };
  };
}

export interface UIUpdateBankData {
  items?: Array<{ itemId: string; quantity: number; slot: number }>;
  maxSlots?: number;
  bankId?: string;
  isOpen?: boolean;
}

export interface UIUpdateStoreData {
  storeId: string;
  storeName: string;
  buybackRate: number;
  npcEntityId?: string;
  items: Array<{
    id: string;
    itemId: string;
    name: string;
    price: number;
    stockQuantity: number;
    description?: string;
    category?: string;
  }>;
  isOpen?: boolean;
}

export interface UIUpdateDialogueData {
  npcId: string;
  npcName: string;
  text: string;
  responses: Array<{
    text: string;
    nextNodeId: string;
    effect?: string;
  }>;
  npcEntityId?: string;
}

export type UIUpdateComponentData =
  | { component: "player"; data: UIUpdatePlayerData }
  | { component: "equipment"; data: UIUpdateEquipmentData }
  | { component: "bank"; data: UIUpdateBankData }
  | { component: "store"; data: UIUpdateStoreData }
  | { component: "dialogue"; data: UIUpdateDialogueData }
  | { component: "dialogueEnd" };

export interface InventoryUpdatedPayload {
  items: InventorySlotViewItem[];
  playerId: string;
  coins: number;
}

export interface CorpseClickPayload {
  corpseId: string;
  playerId: string;
  position: { x: number; y: number; z: number };
  lootItems?: Array<{ itemId: string; quantity: number }>;
}

export interface EquipmentCache {
  weapon?: { item: Item | null };
  shield?: { item: Item | null };
  helmet?: { item: Item | null };
  body?: { item: Item | null };
  legs?: { item: Item | null };
  arrows?: { item: Item | null };
}

export interface EntitySpawnedPayload {
  entityId?: string;
  entityData?: { characterId?: string };
}
