/**
 * Data Manager - Centralized Content Database
 *
 * Provides a single point of access to all externalized data including:
 * - Items and equipment
 * - NPCs (categorized as: mob, boss, neutral, quest)
 * - World areas and spawn points
 * - Treasure locations
 * - Banks and stores
 * - Starting items and equipment requirements
 *
 * This system validates data on load and provides type-safe access methods.
 *
 * NPC Categories:
 * - mob: Combat NPCs (goblins, bandits, guards)
 * - boss: Powerful special combat encounters
 * - neutral: Non-combat NPCs (shopkeepers, bank clerks)
 * - quest: Quest-related NPCs (quest givers, quest objectives)
 */

import { BANKS, GENERAL_STORES } from "./banks-stores";
import { ITEMS } from "./items";
import { ALL_NPCS } from "./npcs";
import { generateAllNotedItems } from "./NoteGenerator";
import {
  ALL_WORLD_AREAS,
  STARTER_TOWNS,
  getMobSpawnsInArea,
  getNPCsInArea,
} from "./world-areas";
import { BIOMES } from "./world-structure";

// Define constants from JSON data
const STARTING_ITEMS: Array<{ id: string }> = []; // Stub - data removed
const TREASURE_LOCATIONS: TreasureLocation[] = []; // Stub - data removed
const getAllTreasureLocations = () => TREASURE_LOCATIONS;
const getTreasureLocationsByDifficulty = (_difficulty: number) =>
  TREASURE_LOCATIONS;

import type {
  Item,
  NPCData,
  NPCDataInput,
  NPCCategory,
  TreasureLocation,
  BankEntityData,
  StoreData,
  BiomeData,
  ZoneData,
} from "../types/core/core";
import type { DataValidationResult } from "../types/core/validation-types";
import type { MobSpawnPoint, NPCLocation, WorldArea } from "./world-areas";
import { WeaponType, EquipmentSlotName, AttackType } from "../types/core/core";

/**
 * External Resource Data - loaded from resources.json manifest
 */
export interface ExternalResourceData {
  id: string;
  name: string;
  type: string;
  examine?: string;
  modelPath: string | null;
  depletedModelPath: string | null;
  scale: number;
  depletedScale: number;
  harvestSkill: string;
  toolRequired: string | null;
  levelRequired: number;
  baseCycleTicks: number;
  depleteChance: number;
  respawnTicks: number;
  harvestYield: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    chance: number;
    xpAmount: number;
    stackable: boolean;
  }>;
}

/**
 * Centralized Data Manager
 */
export class DataManager {
  private static instance: DataManager;
  private isInitialized = false;
  private validationResult: DataValidationResult | null = null;
  private worldAssetsDir: string | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * Load manifests from CDN (both client and server)
   */
  private async loadManifestsFromCDN(): Promise<void> {
    // Load directly from CDN (localhost:8080 in dev, R2/S3 in prod)
    // Server uses process.env, client will use hardcoded default
    let cdnUrl = "http://localhost:8080";
    if (
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      process.env.PUBLIC_CDN_URL
    ) {
      cdnUrl = process.env.PUBLIC_CDN_URL;
    }
    const baseUrl = `${cdnUrl}/manifests`;

    // In test/CI environments, CDN might not be available - make loading non-fatal
    const isTestEnv =
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      process.env.NODE_ENV === "test";

    try {
      // Load items
      const itemsRes = await fetch(`${baseUrl}/items.json`);
      const list = (await itemsRes.json()) as Array<Item>;
      for (const it of list) {
        const normalized = this.normalizeItem(it);
        (ITEMS as Map<string, Item>).set(normalized.id, normalized);
      }

      // Generate noted variants for all eligible items
      // This auto-creates "{itemId}_noted" variants for tradeable, non-stackable items
      const itemsWithNotes = generateAllNotedItems(ITEMS);
      // Clear and repopulate ITEMS map with noted variants included
      (ITEMS as Map<string, Item>).clear();
      for (const [id, item] of itemsWithNotes) {
        (ITEMS as Map<string, Item>).set(id, item);
      }

      // Load NPCs (unified standardized structure with categories: mob, boss, neutral, quest)
      // JSON uses NPCDataInput (optional fields), normalizeNPC() fills in defaults to produce NPCData
      const npcsRes = await fetch(`${baseUrl}/npcs.json`);
      const npcList = (await npcsRes.json()) as Array<NPCDataInput>;

      // Store all NPCs in unified collection
      for (const npc of npcList) {
        const normalized = this.normalizeNPC(npc);
        (ALL_NPCS as Map<string, NPCData>).set(normalized.id, normalized);
      }

      // Load resources
      const resourcesRes = await fetch(`${baseUrl}/resources.json`);
      const resourceList =
        (await resourcesRes.json()) as Array<ExternalResourceData>;

      if (
        !(
          globalThis as {
            EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
          }
        ).EXTERNAL_RESOURCES
      ) {
        (
          globalThis as {
            EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
          }
        ).EXTERNAL_RESOURCES = new Map();
      }
      for (const resource of resourceList) {
        (
          globalThis as unknown as {
            EXTERNAL_RESOURCES: Map<string, ExternalResourceData>;
          }
        ).EXTERNAL_RESOURCES.set(resource.id, resource);
      }

      // Load world areas
      const worldAreasRes = await fetch(`${baseUrl}/world-areas.json`);
      const worldAreasData = (await worldAreasRes.json()) as {
        starterTowns: Record<string, WorldArea>;
        level1Areas: Record<string, WorldArea>;
        level2Areas: Record<string, WorldArea>;
        level3Areas: Record<string, WorldArea>;
      };

      // Merge all areas into ALL_WORLD_AREAS
      Object.assign(
        ALL_WORLD_AREAS,
        worldAreasData.starterTowns,
        worldAreasData.level1Areas,
        worldAreasData.level2Areas,
        worldAreasData.level3Areas,
      );
      Object.assign(STARTER_TOWNS, worldAreasData.starterTowns);

      // Load biomes
      const biomesRes = await fetch(`${baseUrl}/biomes.json`);
      const biomeList = (await biomesRes.json()) as Array<BiomeData>;
      for (const biome of biomeList) {
        BIOMES[biome.id] = biome;
      }

      // zones.json removed - use world-areas.json instead
      // WORLD_ZONES remains empty, ZoneDetectionSystem uses ALL_WORLD_AREAS as primary

      // banks.json removed - BankingSystem uses hardcoded STARTER_TOWN_BANKS
      // BANKS object exists but is unused

      // Load stores
      const storesRes = await fetch(`${baseUrl}/stores.json`);
      const storeList = (await storesRes.json()) as Array<StoreData>;
      for (const store of storeList) {
        GENERAL_STORES[store.id] = store;
      }
    } catch (error) {
      // In test/CI environments, CDN might not be available - this is non-fatal
      if (isTestEnv) {
        console.warn(
          "[DataManager] ⚠️  CDN not available in test environment - skipping manifest loading",
        );
        console.warn(
          "[DataManager] This is expected in CI/test - game data will use defaults",
        );
      } else {
        // In production/development, CDN should be available - log error and re-throw
        console.error(
          "[DataManager] ❌ Failed to load manifests from CDN:",
          error,
        );
        throw error;
      }
    }
  }

  /**
   * Load external assets from CDN (works for both client and server)
   */
  private async loadExternalAssetsFromWorld(): Promise<void> {
    // Both client and server now load from CDN
    await this.loadManifestsFromCDN();
  }

  private normalizeItem(item: Item): Item {
    // Ensure required fields have sane defaults and enums
    const safeWeaponType = item.weaponType ?? WeaponType.NONE;
    const equipSlot = item.equipSlot ?? null;
    const attackType = item.attackType ?? null;

    // Validate: weapons with equipSlot "weapon" should have equippedModelPath
    if (equipSlot === "weapon" && !item.equippedModelPath) {
      console.warn(
        `[DataManager] Weapon "${item.id}" missing equippedModelPath - will use convention fallback`,
      );
    }

    // Apply defaults only for missing fields (use ?? to preserve falsy values like 0)
    const normalized: Item = {
      ...item,
      type: item.type,
      weaponType: safeWeaponType,
      equipSlot: equipSlot as EquipmentSlotName | null,
      attackType: attackType as AttackType | null,
      // Inventory properties with defaults
      quantity: item.quantity ?? 1,
      stackable: item.stackable ?? false,
      maxStackSize: item.maxStackSize ?? 1,
      value: item.value ?? 0,
      weight: item.weight ?? 0.1,
      // Equipment properties with defaults
      equipable: item.equipable ?? !!equipSlot,
      // Item properties with defaults
      description: item.description || item.name || "Item",
      examine: item.examine || item.description || item.name || "Item",
      // Optional properties
      healAmount: item.healAmount,
      attackSpeed: item.attackSpeed,
      // Default attackRange: 1 for melee, 7 for ranged, undefined for non-weapons
      attackRange:
        item.attackRange ??
        (attackType === AttackType.RANGED
          ? 7
          : attackType === AttackType.MELEE
            ? 1
            : undefined),
      equippedModelPath: item.equippedModelPath,
      bonuses: item.bonuses,
      requirements: item.requirements,
    };
    return normalized;
  }

  private normalizeNPC(npc: NPCDataInput): NPCData {
    // Ensure required fields have sane defaults
    const defaults: Partial<NPCData> = {
      faction: npc.faction || "unknown",
      stats: {
        level: npc.stats?.level ?? 1,
        health: npc.stats?.health ?? 10, // OSRS: hitpoints = max HP directly
        attack: npc.stats?.attack ?? 1,
        strength: npc.stats?.strength ?? 1,
        defense: npc.stats?.defense ?? 1,
        ranged: npc.stats?.ranged ?? 1,
        magic: npc.stats?.magic ?? 1,
      },
      combat: {
        attackable: npc.combat?.attackable ?? true,
        aggressive: npc.combat?.aggressive ?? false,
        retaliates: npc.combat?.retaliates ?? true,
        aggroRange: npc.combat?.aggroRange ?? 0,
        combatRange: npc.combat?.combatRange ?? 1.5,
        attackSpeedTicks: npc.combat?.attackSpeedTicks ?? 4,
        respawnTime: (npc.combat?.respawnTicks ?? 25) * 600, // Convert ticks to ms
        xpReward: npc.combat?.xpReward ?? 0,
        poisonous: npc.combat?.poisonous ?? false,
        immuneToPoison: npc.combat?.immuneToPoison ?? false,
      },
      movement: {
        type: npc.movement?.type ?? "stationary",
        speed: npc.movement?.speed ?? 1,
        wanderRadius: npc.movement?.wanderRadius ?? 0,
        roaming: npc.movement?.roaming ?? false,
      },
      drops: {
        defaultDrop: npc.drops?.defaultDrop ?? {
          enabled: false,
          itemId: "",
          quantity: 0,
        },
        always: npc.drops?.always ?? [],
        common: npc.drops?.common ?? [],
        uncommon: npc.drops?.uncommon ?? [],
        rare: npc.drops?.rare ?? [],
        veryRare: npc.drops?.veryRare ?? [],
        rareDropTable: npc.drops?.rareDropTable ?? false,
        rareDropTableChance: npc.drops?.rareDropTableChance,
      },
      services: {
        enabled: npc.services?.enabled ?? false,
        types: npc.services?.types ?? [],
        shopInventory: npc.services?.shopInventory,
        questIds: npc.services?.questIds,
      },
      behavior: {
        enabled: npc.behavior?.enabled ?? false,
        config: npc.behavior?.config,
      },
      appearance: {
        modelPath: npc.appearance?.modelPath ?? "",
        iconPath: npc.appearance?.iconPath,
        scale: npc.appearance?.scale ?? 1.0,
        tint: npc.appearance?.tint,
      },
      position: npc.position || { x: 0, y: 0, z: 0 },
    };
    return {
      ...npc,
      ...defaults,
    } as NPCData;
  }

  /**
   * Initialize the data manager and validate all data
   */
  public async initialize(): Promise<DataValidationResult> {
    if (this.isInitialized) {
      return this.validationResult!;
    }

    // Load externally generated assets (Forge) before validation
    await this.loadExternalAssetsFromWorld();

    this.validationResult = await this.validateAllData();
    this.isInitialized = true;

    if (this.validationResult.isValid) {
    } else {
      throw new Error(
        `[DataManager] ❌ Data validation failed: ${this.validationResult.errors.join(", ")}`,
      );
    }

    return this.validationResult;
  }

  /**
   * Validate all externalized data
   */
  private async validateAllData(): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate items (warning only - manifests might be loading)
    const itemCount = ITEMS.size;
    if (itemCount === 0) {
      warnings.push("No items loaded from manifests yet");
    }

    // Validate NPCs (warning only - manifests might be loading)
    const npcCount = ALL_NPCS.size;
    if (npcCount === 0) {
      warnings.push("No NPCs loaded from manifests yet");
    }

    // Validate world areas
    const areaCount = Object.keys(ALL_WORLD_AREAS).length;
    if (areaCount === 0) {
      errors.push("No world areas found in ALL_WORLD_AREAS");
    }

    // Validate treasure locations
    const treasureCount = Object.keys(TREASURE_LOCATIONS).length;
    if (treasureCount === 0) {
      warnings.push("No treasure locations found in TREASURE_LOCATIONS");
    }

    // Validate cross-references (only if we have data)
    if (itemCount > 0 && npcCount > 0) {
      this.validateCrossReferences(errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      itemCount,
      npcCount,
      areaCount,
      treasureCount,
    };
  }

  /**
   * Validate cross-references between data sets
   */
  private validateCrossReferences(errors: string[], _warnings: string[]): void {
    // Check that mob spawn points reference valid mobs
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (area.mobSpawns) {
        for (const mobSpawn of area.mobSpawns) {
          if (!ALL_NPCS.has(mobSpawn.mobId)) {
            errors.push(
              `Area ${areaId} references unknown NPC: ${mobSpawn.mobId}`,
            );
          }
        }
      }
    }

    // Check that starter items reference valid items
    for (const startingItem of STARTING_ITEMS) {
      if (!ITEMS.has(startingItem.id)) {
        errors.push(
          `Starting item references unknown item: ${startingItem.id}`,
        );
      }
    }
  }

  /**
   * Get validation result
   */
  public getValidationResult(): DataValidationResult | null {
    return this.validationResult;
  }

  // =============================================================================
  // ITEM DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all items
   */
  public getAllItems(): Map<string, Item> {
    return ITEMS;
  }

  /**
   * Get item by ID
   */
  public getItem(itemId: string): Item | null {
    return ITEMS.get(itemId) || null;
  }

  /**
   * Get items by type
   */
  public getItemsByType(itemType: string): Item[] {
    return Array.from(ITEMS.values()).filter((item) => item.type === itemType);
  }

  // =============================================================================
  // NPC DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all NPCs
   */
  public getAllNPCs(): Map<string, NPCData> {
    return ALL_NPCS;
  }

  /**
   * Get NPC by ID
   */
  public getNPC(npcId: string): NPCData | null {
    return ALL_NPCS.get(npcId) || null;
  }

  /**
   * Get NPCs by category
   */
  public getNPCsByCategory(category: NPCCategory): NPCData[] {
    return Array.from(ALL_NPCS.values()).filter(
      (npc) => npc.category === category,
    );
  }

  // =============================================================================
  // WORLD AREA DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all world areas
   */
  public getAllWorldAreas(): Record<string, WorldArea> {
    return ALL_WORLD_AREAS;
  }

  /**
   * Get starter towns
   */
  public getStarterTowns(): Record<string, WorldArea> {
    return STARTER_TOWNS;
  }

  /**
   * Get world area by ID
   */
  public getWorldArea(areaId: string): WorldArea | null {
    return ALL_WORLD_AREAS[areaId] || null;
  }

  /**
   * Get mob spawns in area
   */
  public getMobSpawnsInArea(areaId: string): MobSpawnPoint[] {
    return getMobSpawnsInArea(areaId);
  }

  /**
   * Get NPCs in area
   */
  public getNPCsInArea(areaId: string): NPCLocation[] {
    return getNPCsInArea(areaId);
  }

  // =============================================================================
  // TREASURE DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all treasure locations
   */
  public getAllTreasureLocations(): TreasureLocation[] {
    return getAllTreasureLocations();
  }

  /**
   * Get treasure locations by difficulty
   */
  public getTreasureLocationsByDifficulty(
    difficulty: 1 | 2 | 3,
  ): TreasureLocation[] {
    return getTreasureLocationsByDifficulty(difficulty);
  }

  /**
   * Get treasure location by ID
   */
  public getTreasureLocation(locationId: string): TreasureLocation | null {
    return (
      TREASURE_LOCATIONS.find(
        (loc) => (loc as TreasureLocation & { id?: string }).id === locationId,
      ) || null
    );
  }

  // =============================================================================
  // STORE AND BANK DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all general stores
   */
  public getGeneralStores() {
    return GENERAL_STORES;
  }

  /**
   * Get all banks
   */
  public getBanks() {
    return BANKS;
  }

  // =============================================================================
  // STARTING DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get starting items
   */
  public getStartingItems() {
    return STARTING_ITEMS;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if data manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get data summary for debugging
   */
  public getDataSummary() {
    if (!this.isInitialized) {
      return "DataManager not initialized";
    }

    return {
      items: ITEMS.size,
      npcs: ALL_NPCS.size,
      worldAreas: Object.keys(ALL_WORLD_AREAS).length,
      treasureLocations: TREASURE_LOCATIONS.length,
      stores: Object.keys(GENERAL_STORES).length,
      banks: Object.keys(BANKS).length,
      startingItems: STARTING_ITEMS.length,
      isValid: this.validationResult?.isValid || false,
    };
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();
