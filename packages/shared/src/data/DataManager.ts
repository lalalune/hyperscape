/**
 * Data Manager - Centralized Content Database
 * 
 * Provides a single point of access to all externalized data including:
 * - Items and equipment
 * - Mobs and creatures
 * - World areas and spawn points
 * - Treasure locations
 * - Banks and stores
 * - Starting items and equipment requirements
 * 
 * This system validates data on load and provides type-safe access methods.
 */

import { BANKS, GENERAL_STORES } from './banks-stores';
import equipmentRequirementsData from './equipment-requirements.json';
import { ITEMS } from './items';
import { ALL_MOBS, getMobById, getMobsByDifficulty } from './mobs';
import { ALL_WORLD_AREAS, STARTER_TOWNS, getMobSpawnsInArea, getNPCsInArea } from './world-areas';
import { BIOMES, WORLD_ZONES } from './world-structure';

// Define constants from JSON data
const equipmentRequirements = equipmentRequirementsData;
const STARTING_ITEMS: Array<{ id: string }> = []; // Stub - data removed
const TREASURE_LOCATIONS: TreasureLocation[] = []; // Stub - data removed
const getAllTreasureLocations = () => TREASURE_LOCATIONS;
const getTreasureLocationsByDifficulty = (_difficulty: number) => TREASURE_LOCATIONS;

import type { Item, MobData, TreasureLocation, BankEntityData, StoreData, BiomeData, ZoneData } from '../types/core';
import type { DataValidationResult } from '../types/validation-types'
import type { MobSpawnPoint, NPCLocation, WorldArea } from './world-areas';
import { WeaponType, EquipmentSlotName, AttackType } from '../types/core';

/**
 * Data validation results
 */
// DataValidationResult moved to shared types

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
   * Load manifests from server via fetch (client-side)
   */
  private async loadManifestsFromServer(): Promise<void> {
    // Load directly from CDN (localhost:8080 in dev, R2/S3 in prod)
    // Try window.env (runtime from server) first, then fall back to localhost:8080
    const cdnUrl = (typeof window !== 'undefined' && (window as { env?: Record<string, string> }).env?.PUBLIC_CDN_URL) 
      || 'http://localhost:8080';
    const baseUrl = `${cdnUrl}/manifests`;
    
    // Load items
    const itemsRes = await fetch(`${baseUrl}/items.json`);
    const list = await itemsRes.json() as Array<Item>;
    for (const it of list) {
      const normalized = this.normalizeItem(it);
      (ITEMS as Map<string, Item>).set(normalized.id, normalized);
    }
    console.log(`[DataManager] Loaded ${list.length} items from server manifests`);
    
    // Load mobs
    const mobsRes = await fetch(`${baseUrl}/mobs.json`);
    const mobList = await mobsRes.json() as Array<MobData>;
    for (const mob of mobList) {
      (ALL_MOBS as Record<string, MobData>)[mob.id] = mob;
    }
    console.log(`[DataManager] Loaded ${mobList.length} mobs from server manifests`);
    
    // Load NPCs
    const npcsRes = await fetch(`${baseUrl}/npcs.json`);
    const npcList = await npcsRes.json() as Array<{
      id: string;
      name: string;
      description: string;
      type: string;
      modelPath: string;
      services: string[];
    }>;
    
    if (!(globalThis as { EXTERNAL_NPCS?: Map<string, unknown> }).EXTERNAL_NPCS) {
      (globalThis as { EXTERNAL_NPCS?: Map<string, unknown> }).EXTERNAL_NPCS = new Map();
    }
    for (const npc of npcList) {
      (globalThis as unknown as { EXTERNAL_NPCS: Map<string, unknown> }).EXTERNAL_NPCS.set(npc.id, npc);
    }
    console.log(`[DataManager] Loaded ${npcList.length} NPCs from server manifests`);
    
    // Load resources
    const resourcesRes = await fetch(`${baseUrl}/resources.json`);
    const resourceList = await resourcesRes.json() as Array<{
      id: string;
      name: string;
      type: string;
      modelPath: string | null;
      harvestSkill: string;
      requiredLevel: number;
      harvestTime: number;
      respawnTime: number;
      harvestYield: Array<{ itemId: string; quantity: number; chance: number }>;
    }>;
    
    if (!(globalThis as { EXTERNAL_RESOURCES?: Map<string, unknown> }).EXTERNAL_RESOURCES) {
      (globalThis as { EXTERNAL_RESOURCES?: Map<string, unknown> }).EXTERNAL_RESOURCES = new Map();
    }
    for (const resource of resourceList) {
      (globalThis as unknown as { EXTERNAL_RESOURCES: Map<string, unknown> }).EXTERNAL_RESOURCES.set(resource.id, resource);
    }
    console.log(`[DataManager] Loaded ${resourceList.length} resources from server manifests`);
    
    // Load world areas
    const worldAreasRes = await fetch(`${baseUrl}/world-areas.json`);
    const worldAreasData = await worldAreasRes.json() as {
      starterTowns: Record<string, WorldArea>;
      level1Areas: Record<string, WorldArea>;
      level2Areas: Record<string, WorldArea>;
      level3Areas: Record<string, WorldArea>;
    };
    
    // Merge all areas into ALL_WORLD_AREAS
    Object.assign(ALL_WORLD_AREAS, worldAreasData.starterTowns, worldAreasData.level1Areas, worldAreasData.level2Areas, worldAreasData.level3Areas);
    Object.assign(STARTER_TOWNS, worldAreasData.starterTowns);
    console.log(`[DataManager] Loaded ${Object.keys(ALL_WORLD_AREAS).length} world areas from server manifests (${Object.keys(STARTER_TOWNS).length} starter towns)`);
    
    // Load biomes
    const biomesRes = await fetch(`${baseUrl}/biomes.json`);
    const biomeList = await biomesRes.json() as Array<BiomeData>;
    for (const biome of biomeList) {
      BIOMES[biome.id] = biome;
    }
    console.log(`[DataManager] Loaded ${biomeList.length} biomes from server manifests`);
    
    // Load zones
    const zonesRes = await fetch(`${baseUrl}/zones.json`);
    const zoneList = await zonesRes.json() as Array<ZoneData>;
    WORLD_ZONES.push(...zoneList);
    console.log(`[DataManager] Loaded ${zoneList.length} zones from server manifests`);
    
    // Load banks
    const banksRes = await fetch(`${baseUrl}/banks.json`);
    const bankList = await banksRes.json() as Array<BankEntityData>;
    for (const bank of bankList) {
      BANKS[bank.id] = bank;
    }
    console.log(`[DataManager] Loaded ${bankList.length} banks from server manifests`);
    
    // Load stores
    const storesRes = await fetch(`${baseUrl}/stores.json`);
    const storeList = await storesRes.json() as Array<StoreData>;
    for (const store of storeList) {
      GENERAL_STORES[store.id] = store;
    }
    console.log(`[DataManager] Loaded ${storeList.length} stores from server manifests`);
  }

  /**
   * Load external assets written by 3D Asset Forge (manifests under world/assets)
   */
  private async loadExternalAssetsFromWorld(): Promise<void> {
    // Check if we're in a browser environment
    // Server has 'process' global, browser has 'window'
    const isServer = typeof process !== 'undefined' && process.versions && process.versions.node;
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isBrowser && !isServer) {
      // Client-side: Load manifests via fetch from server
      await this.loadManifestsFromServer();
      return;
    }
    
    // Server-side: Load manifests from filesystem
    // Resolve from process.cwd() (packages/hyperscape during dev-final)
    const baseDir = process.cwd();
    // Use computed strings to prevent bundlers from trying to resolve these Node.js modules
    // They will only be loaded at runtime on the server, never in the browser
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, no-undef
    const path = require('pat' + 'h');
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, no-undef
    const fs = require('f' + 's');
    const assetsDir = path.join(baseDir, 'world', 'assets');
    if (!fs.existsSync(assetsDir)) return;
    this.worldAssetsDir = assetsDir;
    const manifestsDir = path.join(assetsDir, 'manifests');
    if (!fs.existsSync(manifestsDir)) return;

      // Load items
      const itemsPath = path.join(manifestsDir, 'items.json')
      if (fs.existsSync(itemsPath)) {
        const raw = fs.readFileSync(itemsPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<Item>
        for (const it of list) {
          if (!it || !it.id) continue
          // Ensure required defaults
          const normalized = this.normalizeItem(it)
          ;(ITEMS as Map<string, Item>).set(normalized.id, normalized)
        }
        console.log(`[DataManager] Loaded ${list.length} external items from manifests`)
      }

      // Load mobs
      const mobsPath = path.join(manifestsDir, 'mobs.json')
      if (fs.existsSync(mobsPath)) {
        const raw = fs.readFileSync(mobsPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<MobData>
        for (const mob of list) {
          if (!mob || !mob.id) continue
          ;(ALL_MOBS as Record<string, MobData>)[mob.id] = mob
        }
        console.log(`[DataManager] Loaded ${list.length} external mobs from manifests`)
      }

      // Load NPCs
      const npcsPath = path.join(manifestsDir, 'npcs.json')
      if (fs.existsSync(npcsPath)) {
        const raw = fs.readFileSync(npcsPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<{
          id: string;
          name: string;
          description: string;
          type: string;
          modelPath: string;
          animations?: { idle?: string; talk?: string };
          services: string[];
        }>
        
        // NPCs can be added to world areas dynamically
        // For now, just log that they're available
        console.log(`[DataManager] Loaded ${list.length} external NPCs from manifests`)
        
        // Store NPCs for later use by NPC spawning systems
        this.worldAssetsDir
        for (const npc of list) {
          if (!npc || !npc.id) continue
          // Store in a global NPCs map for systems to access
          if (!(globalThis as { EXTERNAL_NPCS?: Map<string, unknown> }).EXTERNAL_NPCS) {
            (globalThis as { EXTERNAL_NPCS?: Map<string, unknown> }).EXTERNAL_NPCS = new Map()
          }
          (globalThis as unknown as { EXTERNAL_NPCS: Map<string, unknown> }).EXTERNAL_NPCS.set(npc.id, npc)
        }
      }

      // Load resources
      const resourcesPath = path.join(manifestsDir, 'resources.json')
      if (fs.existsSync(resourcesPath)) {
        const raw = fs.readFileSync(resourcesPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<{
          id: string;
          name: string;
          type: string;
          resourceType: string;
          modelPath: string | null;
          harvestSkill: string;
          requiredLevel: number;
          harvestTime: number;
          respawnTime: number;
          harvestYield: Array<{ itemId: string; quantity: number; chance: number }>;
        }>
        
        console.log(`[DataManager] Loaded ${list.length} external resources from manifests`)
        
        // Store resources for terrain system and resource system to access
        if (!(globalThis as { EXTERNAL_RESOURCES?: Map<string, unknown> }).EXTERNAL_RESOURCES) {
          (globalThis as { EXTERNAL_RESOURCES?: Map<string, unknown> }).EXTERNAL_RESOURCES = new Map()
        }
        for (const resource of list) {
          if (!resource || !resource.id) continue
          (globalThis as unknown as { EXTERNAL_RESOURCES: Map<string, unknown> }).EXTERNAL_RESOURCES.set(resource.id, resource)
        }
      }

      // Load world areas
      const worldAreasPath = path.join(manifestsDir, 'world-areas.json')
      if (fs.existsSync(worldAreasPath)) {
        const raw = fs.readFileSync(worldAreasPath, 'utf-8') as string
        const worldAreasData = JSON.parse(raw) as {
          starterTowns: Record<string, WorldArea>;
          level1Areas: Record<string, WorldArea>;
          level2Areas: Record<string, WorldArea>;
          level3Areas: Record<string, WorldArea>;
        }
        
        // Merge all areas into ALL_WORLD_AREAS
        Object.assign(ALL_WORLD_AREAS, worldAreasData.starterTowns, worldAreasData.level1Areas, worldAreasData.level2Areas, worldAreasData.level3Areas);
        Object.assign(STARTER_TOWNS, worldAreasData.starterTowns);
        console.log(`[DataManager] Loaded ${Object.keys(ALL_WORLD_AREAS).length} world areas from manifests (${Object.keys(STARTER_TOWNS).length} starter towns)`)
      }

      // Load biomes
      const biomesPath = path.join(manifestsDir, 'biomes.json')
      if (fs.existsSync(biomesPath)) {
        const raw = fs.readFileSync(biomesPath, 'utf-8') as string
        const biomeList = JSON.parse(raw) as Array<BiomeData>
        for (const biome of biomeList) {
          if (!biome || !biome.id) continue
          BIOMES[biome.id] = biome
        }
        console.log(`[DataManager] Loaded ${biomeList.length} biomes from manifests`)
      }

      // Load zones
      const zonesPath = path.join(manifestsDir, 'zones.json')
      if (fs.existsSync(zonesPath)) {
        const raw = fs.readFileSync(zonesPath, 'utf-8') as string
        const zoneList = JSON.parse(raw) as Array<ZoneData>
        WORLD_ZONES.push(...zoneList);
        console.log(`[DataManager] Loaded ${zoneList.length} zones from manifests`)
      }

      // Load banks
      const banksPath = path.join(manifestsDir, 'banks.json')
      if (fs.existsSync(banksPath)) {
        const raw = fs.readFileSync(banksPath, 'utf-8') as string
        const bankList = JSON.parse(raw) as Array<BankEntityData>
        for (const bank of bankList) {
          if (!bank || !bank.id) continue
          BANKS[bank.id] = bank
        }
        console.log(`[DataManager] Loaded ${bankList.length} banks from manifests`)
      }

      // Load stores
      const storesPath = path.join(manifestsDir, 'stores.json')
      if (fs.existsSync(storesPath)) {
        const raw = fs.readFileSync(storesPath, 'utf-8') as string
        const storeList = JSON.parse(raw) as Array<StoreData>
        for (const store of storeList) {
          if (!store || !store.id) continue
          GENERAL_STORES[store.id] = store
        }
        console.log(`[DataManager] Loaded ${storeList.length} stores from manifests`)
      }

      // Load buildings
      const buildingsPath = path.join(manifestsDir, 'buildings.json')
      if (fs.existsSync(buildingsPath)) {
        const raw = fs.readFileSync(buildingsPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<{
          id: string;
          name: string;
          type: string;
          modelPath: string;
          iconPath?: string;
          description: string;
        }>
        
        console.log(`[DataManager] Loaded ${list.length} external buildings from manifests`)
        
        // Store buildings for world building systems
        if (!(globalThis as { EXTERNAL_BUILDINGS?: Map<string, unknown> }).EXTERNAL_BUILDINGS) {
          (globalThis as { EXTERNAL_BUILDINGS?: Map<string, unknown> }).EXTERNAL_BUILDINGS = new Map()
        }
        for (const building of list) {
          if (!building || !building.id) continue
          (globalThis as unknown as { EXTERNAL_BUILDINGS: Map<string, unknown> }).EXTERNAL_BUILDINGS.set(building.id, building)
        }
      }

      // Load avatars
      const avatarsPath = path.join(manifestsDir, 'avatars.json')
      if (fs.existsSync(avatarsPath)) {
        const raw = fs.readFileSync(avatarsPath, 'utf-8') as string
        const list = JSON.parse(raw) as Array<{
          id: string;
          name: string;
          description: string;
          type: string;
          isRigged: boolean;
          characterHeight: number;
          modelPath: string;
          animations?: { idle?: string; walk?: string; run?: string };
        }>
        
        console.log(`[DataManager] Loaded ${list.length} external avatars from manifests`)
        
        // Store avatars for player system
        if (!(globalThis as { EXTERNAL_AVATARS?: Map<string, unknown> }).EXTERNAL_AVATARS) {
          (globalThis as { EXTERNAL_AVATARS?: Map<string, unknown> }).EXTERNAL_AVATARS = new Map()
        }
        for (const avatar of list) {
          if (!avatar || !avatar.id) continue
          (globalThis as unknown as { EXTERNAL_AVATARS: Map<string, unknown> }).EXTERNAL_AVATARS.set(avatar.id, avatar);
        }
      }
  }

  private normalizeItem(item: Item): Item {
    // Ensure required fields have sane defaults and enums
    const safeWeaponType = item.weaponType ?? WeaponType.NONE
    const equipSlot = item.equipSlot ?? null
    const attackType = item.attackType ?? null
    const defaults = {
      quantity: 1,
      stackable: false,
      maxStackSize: 1,
      value: 0,
      weight: 0.1,
      equipable: !!equipSlot,
      description: item.description || item.name || 'Item',
      examine: item.examine || item.description || item.name || 'Item',
      healAmount: item.healAmount ?? 0,
      stats: item.stats || { attack: 0, defense: 0, strength: 0 },
      bonuses: item.bonuses || { attack: 0, defense: 0, strength: 0, ranged: 0 },
      requirements: item.requirements || { level: 1, skills: {} },
    }
    return {
      ...item,
      type: item.type,
      weaponType: safeWeaponType,
      equipSlot: equipSlot as EquipmentSlotName | null,
      attackType: attackType as AttackType | null,
      ...defaults,
    }
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
      console.log(`[DataManager] 📊 Data Summary: ${this.validationResult.itemCount} items, ${this.validationResult.mobCount} mobs, ${this.validationResult.areaCount} areas, ${this.validationResult.treasureCount} treasure locations`);
    } else {
      throw new Error(`[DataManager] ❌ Data validation failed: ${this.validationResult.errors.join(', ')}`);
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
      warnings.push('No items loaded from manifests yet');
    }

    // Validate mobs (warning only - manifests might be loading)
    const mobCount = Object.keys(ALL_MOBS).length;
    if (mobCount === 0) {
      warnings.push('No mobs loaded from manifests yet');
    }

    // Validate world areas
    const areaCount = Object.keys(ALL_WORLD_AREAS).length;
    if (areaCount === 0) {
      errors.push('No world areas found in ALL_WORLD_AREAS');
    }

    // Validate treasure locations
    const treasureCount = Object.keys(TREASURE_LOCATIONS).length;
    if (treasureCount === 0) {
      warnings.push('No treasure locations found in TREASURE_LOCATIONS');
    }

    // Validate cross-references (only if we have data)
    if (itemCount > 0 && mobCount > 0) {
      this.validateCrossReferences(errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      itemCount,
      mobCount,
      areaCount,
      treasureCount
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
          if (!ALL_MOBS[mobSpawn.mobId]) {
            errors.push(`Area ${areaId} references unknown mob: ${mobSpawn.mobId}`);
          }
        }
      }
    }

    // Check that starter items reference valid items
    for (const startingItem of STARTING_ITEMS) {
      if (!ITEMS.has(startingItem.id)) {
        errors.push(`Starting item references unknown item: ${startingItem.id}`);
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
    return Array.from(ITEMS.values()).filter(item => item.type === itemType);
  }

  // =============================================================================
  // MOB DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all mobs
   */
  public getAllMobs(): Record<string, MobData> {
    return ALL_MOBS;
  }

  /**
   * Get mob by ID
   */
  public getMob(mobId: string): MobData | null {
    return getMobById(mobId);
  }

  /**
   * Get mobs by difficulty level
   */
  public getMobsByDifficulty(difficulty: 1 | 2 | 3): MobData[] {
    return getMobsByDifficulty(difficulty);
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
  public getTreasureLocationsByDifficulty(difficulty: 1 | 2 | 3): TreasureLocation[] {
    return getTreasureLocationsByDifficulty(difficulty);
  }

  /**
   * Get treasure location by ID
   */
  public getTreasureLocation(locationId: string): TreasureLocation | null {
    return TREASURE_LOCATIONS.find(loc => (loc as TreasureLocation & { id?: string }).id === locationId) || null;
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
  // EQUIPMENT AND STARTING DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get equipment requirements
   */
  public getEquipmentRequirements() {
    return equipmentRequirements;
  }

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
      return 'DataManager not initialized';
    }

    return {
      items: ITEMS.size,
      mobs: Object.keys(ALL_MOBS).length,
      worldAreas: Object.keys(ALL_WORLD_AREAS).length,
      treasureLocations: TREASURE_LOCATIONS.length,
      stores: Object.keys(GENERAL_STORES).length,
      banks: Object.keys(BANKS).length,
      startingItems: STARTING_ITEMS.length,
      isValid: this.validationResult?.isValid || false
    };
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();