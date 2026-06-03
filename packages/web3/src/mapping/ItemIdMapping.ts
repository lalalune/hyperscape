import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * Bidirectional mapping between string item IDs (e.g. "bronze_sword")
 * and numeric IDs (uint32) used on-chain.
 *
 * The mapping is deterministic: items are sorted alphabetically across
 * all manifest files and assigned sequential IDs starting from 1.
 * Noted variants get ID = baseId + 10000.
 *
 * This same mapping is seeded on-chain via ItemRegistrySystem and
 * used by ChainWriter to translate IDs before chain writes.
 */

const NOTED_ITEM_OFFSET = 10000;
const NOTE_SUFFIX = "_noted";

export interface ItemIdMap {
  /** String ID → Numeric ID */
  stringToNumeric: Map<string, number>;
  /** Numeric ID → String ID */
  numericToString: Map<number, string>;
  /** Total base items (excluding noted variants) */
  baseItemCount: number;
  /** Total items including noted variants */
  totalItemCount: number;
}

/**
 * Required item category files that must be present in the items directory.
 * Matches REQUIRED_ITEM_CATEGORIES in DataManager.ts.
 */
const REQUIRED_ITEM_CATEGORY_FILES = [
  "weapons.json",
  "food.json",
  "resources.json",
  "tools.json",
  "misc.json",
] as const;

const OPTIONAL_ITEM_CATEGORY_FILES = [
  "armor.json",
  "ammunition.json",
  "runes.json",
] as const;

const ITEM_CATEGORY_FILES = [
  ...REQUIRED_ITEM_CATEGORY_FILES,
  ...OPTIONAL_ITEM_CATEGORY_FILES,
];

/**
 * Item structure from the JSON manifests (minimal fields needed for mapping).
 */
interface ManifestItem {
  id: string;
  name: string;
  type: string;
  stackable?: boolean;
  tradeable?: boolean;
  value?: number;
  equipSlot?: string | null;
  healAmount?: number;
  bonuses?: Record<string, number>;
  requirements?: {
    level?: number;
    skills?: Record<string, number>;
  };
}

/**
 * Build the item ID mapping from the game's manifest files.
 *
 * @param manifestsDir Path to the manifests directory
 *   (e.g. packages/server/world/assets/manifests)
 * @returns The bidirectional mapping
 */
export async function buildItemIdMap(manifestsDir: string): Promise<ItemIdMap> {
  const itemsDir = join(manifestsDir, "items");
  const allItems: ManifestItem[] = [];

  // Load required item category files.
  for (const filename of REQUIRED_ITEM_CATEGORY_FILES) {
    const filepath = join(itemsDir, filename);
    const content = await readFile(filepath, "utf-8");
    const items = JSON.parse(content) as ManifestItem[];
    allItems.push(...items);
  }

  // Optional categories are loaded when available.
  for (const filename of OPTIONAL_ITEM_CATEGORY_FILES) {
    const filepath = join(itemsDir, filename);
    try {
      const content = await readFile(filepath, "utf-8");
      const items = JSON.parse(content) as ManifestItem[];
      allItems.push(...items);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ItemIdMapping] Optional category missing (${filename}), continuing: ${message}`,
      );
    }
  }

  // Sort alphabetically by ID for deterministic assignment
  allItems.sort((a, b) => a.id.localeCompare(b.id));

  // Filter out items that start with "_comment" (some manifests use this)
  const validItems = allItems.filter(
    (item) => item.id && !item.id.startsWith("_") && item.id.length > 0,
  );

  const stringToNumeric = new Map<string, number>();
  const numericToString = new Map<number, string>();

  // Assign sequential IDs starting from 1
  let nextId = 1;
  for (const item of validItems) {
    stringToNumeric.set(item.id, nextId);
    numericToString.set(nextId, item.id);
    nextId++;
  }

  const baseItemCount = validItems.length;

  // Generate noted item mappings
  // A noted item is created for items that are tradeable and not stackable
  for (const item of validItems) {
    const shouldNote =
      item.tradeable !== false && !item.stackable && item.type !== "currency";

    if (shouldNote) {
      const notedId = `${item.id}${NOTE_SUFFIX}`;
      const baseNumericId = stringToNumeric.get(item.id);
      if (baseNumericId !== undefined) {
        const notedNumericId = baseNumericId + NOTED_ITEM_OFFSET;
        stringToNumeric.set(notedId, notedNumericId);
        numericToString.set(notedNumericId, notedId);
      }
    }
  }

  return {
    stringToNumeric,
    numericToString,
    baseItemCount,
    totalItemCount: stringToNumeric.size,
  };
}

/**
 * Load all items from manifests with their full data.
 * Used by the seeding script to populate on-chain item definitions.
 */
export async function loadAllManifestItems(
  manifestsDir: string,
): Promise<ManifestItem[]> {
  const itemsDir = join(manifestsDir, "items");
  const allItems: ManifestItem[] = [];

  for (const filename of REQUIRED_ITEM_CATEGORY_FILES) {
    const filepath = join(itemsDir, filename);
    const content = await readFile(filepath, "utf-8");
    const items = JSON.parse(content) as ManifestItem[];
    allItems.push(
      ...items.filter((item) => item.id && !item.id.startsWith("_")),
    );
  }

  for (const filename of OPTIONAL_ITEM_CATEGORY_FILES) {
    const filepath = join(itemsDir, filename);
    try {
      const content = await readFile(filepath, "utf-8");
      const items = JSON.parse(content) as ManifestItem[];
      allItems.push(
        ...items.filter((item) => item.id && !item.id.startsWith("_")),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ItemIdMapping] Optional category missing (${filename}), continuing: ${message}`,
      );
    }
  }

  return allItems;
}

/**
 * Get the manifests directory path relative to the project root.
 */
export function getManifestsDir(): string {
  // This works when run from either the web3 package or the project root
  const projectRoot =
    process.env.HYPERIA_ROOT ?? join(import.meta.dirname, "../../../..");
  return join(projectRoot, "packages/server/world/assets/manifests");
}

/**
 * Map an ItemType string to the ItemCategory enum index used in Solidity.
 * Must match the order in mud.config.ts enums.ItemCategory.
 */
export function itemTypeToCategory(type: string): number {
  const categories: Record<string, number> = {
    weapon: 0,
    armor: 1,
    food: 2,
    resource: 3,
    tool: 4,
    misc: 5,
    currency: 6,
    consumable: 7,
    ammunition: 8,
  };
  return categories[type.toLowerCase()] ?? 5; // Default to misc
}

/**
 * Map an equipSlot string to the uint8 used in Solidity.
 * 0 means not equippable. 1-11 correspond to the EquipSlot enum + 1.
 */
export function equipSlotToUint8(slot: string | null | undefined): number {
  if (!slot) return 0;
  const slots: Record<string, number> = {
    weapon: 1,
    shield: 2,
    helmet: 3,
    body: 4,
    legs: 5,
    boots: 6,
    gloves: 7,
    cape: 8,
    amulet: 9,
    ring: 10,
    arrows: 11,
    "2h": 1, // 2-handed weapons use weapon slot
  };
  return slots[slot.toLowerCase()] ?? 0;
}
