
/**
 * NPC System
 * Handles NPC interactions, banking, and store transactions
 */

import type { Entity, World } from '../types/index';
import { getEntitiesSystem, getSystem } from '../utils/SystemUtils';
import { SHOP_ITEMS, getItem } from '../data/items';
import type { NPCLocation } from '../data/world-areas';
import { ALL_WORLD_AREAS, STARTER_TOWNS } from '../data/world-areas';
import { BankTransaction, PlayerBankStorage, Position3D, StoreTransaction, Town } from '../types/core';
import { NPCSystemInfo as SystemInfo } from '../types/system-interfaces';
import { SystemBase } from './SystemBase';
import { InventorySystem } from './InventorySystem';
import { EventType } from '../types/events';
import { TerrainSystem } from './TerrainSystem';
import { groundToTerrain } from '../utils/EntityUtils';

export class NPCSystem extends SystemBase {
  private bankStorage: Map<string, PlayerBankStorage> = new Map();
  private storeInventory: Map<string, number> = new Map();
  private transactionHistory: Array<BankTransaction | StoreTransaction> = [];
  private towns = new Map<string, Town>();
  private terrainSystem!: TerrainSystem;

  // Store prices (multipliers of base item value)
  private readonly BUY_PRICE_MULTIPLIER = 1.2; // 20% markup
  private readonly SELL_PRICE_MULTIPLIER = 0.6; // 40% loss when selling

  constructor(world: World) {
    super(world, {
      name: 'npc',
      dependencies: {
        required: ['terrain'], // Need terrain for NPC placement
        optional: ['inventory', 'banking', 'ui', 'quest']
      },
      autoCleanup: true
    });
    this.initializeStoreInventory();
  }

  async init(): Promise<void> {
    // Get terrain system reference
    this.terrainSystem = this.world.getSystem<TerrainSystem>('terrain')!;
    
    // Subscribe to NPC interaction events using type-safe event system
    this.subscribe(EventType.NPC_INTERACTION, (data: { playerId: string; npcId: string; npc: NPCLocation }) => this.handleNPCInteraction(data));
    this.subscribe(EventType.BANK_DEPOSIT, (data) => this.handleBankDeposit(data as unknown as { playerId: string; itemId: string; quantity: number }));
    this.subscribe(EventType.BANK_WITHDRAW, (data) => this.handleBankWithdraw(data as unknown as { playerId: string; itemId: string; quantity: number }));
    this.subscribe(EventType.STORE_BUY, (data) => this.handleStoreBuy(data as unknown as { playerId: string; itemId: string; quantity: number }));
    this.subscribe(EventType.STORE_SELL, (data) => this.handleStoreSell(data as unknown as { playerId: string; itemId: string; quantity: number }));
    
    // Subscribe to terrain generation to spawn NPCs and towns
    this.subscribe(EventType.TERRAIN_TILE_GENERATED, (data) => this.onTileGenerated(data as { tileX: number; tileZ: number; biome: string }));
    
    // Generate towns immediately as they are static placements
    this.generateTowns();
  }

  /**
   * Initialize store inventory with shop items
   */
  private initializeStoreInventory(): void {
    for (const itemId of SHOP_ITEMS) {
      // Stores have unlimited stock of basic items
      this.storeInventory.set(itemId, 999999);
    }
  }

  /**
   * Handle general NPC interaction
   */
  private handleNPCInteraction(data: { playerId: string, npcId: string, npc: NPCLocation }): void {
    const { playerId, npcId: _npcId, npc } = data;
    
    
    // Send interaction response based on NPC type
    switch (npc.type) {
      case 'bank':
        this.sendBankInterface(playerId, npc);
        break;
      case 'general_store':
        this.sendStoreInterface(playerId, npc);
        break;
      case 'skill_trainer':
        this.sendTrainerInterface(playerId, npc);
        break;
      case 'quest_giver':
        this.sendQuestInterface(playerId, npc);
        break;
      default:
        this.sendGenericDialog(playerId, npc);
    }
  }

  /**
   * Send bank interface to player
   */
  private sendBankInterface(playerId: string, npc: NPCLocation): void {
    const bankData = this.getPlayerBankStorage(playerId);
    
    // Convert Map to object for transmission
    const bankItems: { [key: string]: number } = {};
    for (const [itemId, quantity] of bankData.items) {
      bankItems[itemId] = quantity;
    }
    
    this.emitTypedEvent(EventType.BANK_OPEN, {
      playerId,
      npcName: npc.name,
      bankItems: bankItems,
      services: npc.services
    });
  }

  /**
   * Send store interface to player
   */
  private sendStoreInterface(playerId: string, npc: NPCLocation): void {
    const storeItems: { [key: string]: { quantity: number, buyPrice: number, sellPrice: number } } = {};
    
    for (const [itemId, quantity] of this.storeInventory) {
      const item = getItem(itemId);
      if (item) {
        storeItems[itemId] = {
          quantity: quantity,
          buyPrice: Math.ceil(item.value * this.BUY_PRICE_MULTIPLIER),
          sellPrice: Math.floor(item.value * this.SELL_PRICE_MULTIPLIER)
        };
      }
    }
    
    this.emitTypedEvent(EventType.STORE_OPEN, {
      playerId,
      npcName: npc.name,
      storeItems: storeItems,
      services: npc.services
    });
  }

  /**
   * Send trainer interface to player
   */
  private sendTrainerInterface(playerId: string, npc: NPCLocation): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `${npc.name} can help you train your combat skills.`,
      type: 'info' as const
    });
  }

  /**
   * Send quest interface to player
   */
  private sendQuestInterface(playerId: string, npc: NPCLocation): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `${npc.name} has no quests available at this time.`,
      type: 'info' as const
    });
  }

  /**
   * Send generic dialog to player
   */
  private sendGenericDialog(playerId: string, npc: NPCLocation): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: npc.description || `Hello there! I'm ${npc.name}.`,
      type: 'info' as const
    });
  }

  /**
   * Handle bank deposit
   */
  private handleBankDeposit(data: { playerId: string; itemId: string; quantity: number }): void {
    const { playerId, itemId, quantity } = data;
    
    if (quantity <= 0) {
      this.sendError(playerId, 'Invalid quantity for deposit');
      return;
    }
    
    // Remove item from player inventory (handled by inventory system)
    this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
      playerId,
      itemId,
      quantity
    });
    
    const bankData = this.getPlayerBankStorage(playerId);
    const currentAmount = bankData.items.get(itemId) || 0;
    bankData.items.set(itemId, currentAmount + quantity);
    bankData.lastAccessed = Date.now();
    
    // Record transaction
    const transaction: BankTransaction = {
      type: 'bank_deposit',
      itemId,
      quantity,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.emitTypedEvent(EventType.BANK_DEPOSIT_SUCCESS, {
      playerId,
      itemId,
      quantity,
      newBankQuantity: bankData.items.get(itemId)
    });
    
  }

  /**
   * Handle bank withdrawal
   */
  private handleBankWithdraw(data: { playerId: string, itemId: string, quantity: number }): void {
    const { playerId, itemId, quantity } = data;
    
    if (quantity <= 0) {
      this.sendError(playerId, 'Invalid quantity for withdrawal');
      return;
    }
    
    const bankData = this.getPlayerBankStorage(playerId);
    const currentAmount = bankData.items.get(itemId) || 0;
    
    if (currentAmount < quantity) {
      this.sendError(playerId, 'Not enough items in bank');
      return;
    }
    
    // Check if player has inventory space
    const inventorySystem = getSystem<InventorySystem>(this.world, 'inventory');
    if (inventorySystem?.isFull(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, { 
        playerId, 
        message: `You don't have enough inventory space.`,
        type: 'error'
      });
      return;
    }

    
    bankData.items.set(itemId, currentAmount - quantity);
    if (bankData.items.get(itemId) === 0) {
      bankData.items.delete(itemId);
    }
    bankData.lastAccessed = Date.now();
    
    // Record transaction
    const transaction: BankTransaction = {
      type: 'bank_withdraw',
      itemId,
      quantity,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.emitTypedEvent(EventType.BANK_WITHDRAW_SUCCESS, {
      playerId,
      itemId,
      quantity,
      newBankQuantity: bankData.items.get(itemId) || 0
    });
    
  }

  /**
   * Handle store purchase
   */
  private handleStoreBuy(data: { playerId: string, itemId: string, quantity: number }): void {
    const { playerId, itemId, quantity } = data;
    
    if (quantity <= 0) {
      this.sendError(playerId, 'Invalid quantity for purchase');
      return;
    }
    
    const item = getItem(itemId);
    if (!item) {
      this.sendError(playerId, 'Item not found');
      return;
    }
    
    const storeQuantity = this.storeInventory.get(itemId) || 0;
    if (storeQuantity < quantity) {
      this.sendError(playerId, 'Not enough items in store');
      return;
    }
    
    const totalPrice = Math.ceil(item.value * this.BUY_PRICE_MULTIPLIER) * quantity;
    
    // Check if player has enough coins - delegate to inventory system
    const inventorySystem = getSystem<InventorySystem>(this.world, 'inventory');
    const playerCoins = inventorySystem?.getCoins(playerId) || 0;
    if (playerCoins < totalPrice) {
      this.emitTypedEvent(EventType.UI_MESSAGE, { 
        playerId, 
        message: `You need ${totalPrice} coins but only have ${playerCoins}.`,
        type: 'error'
      });
      return;
    }

    
    // Update store inventory
    this.storeInventory.set(itemId, storeQuantity - quantity);
    
    // Record transaction
    const transaction: StoreTransaction = {
      type: 'buy',
      itemId,
      quantity,
      totalPrice,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.emitTypedEvent(EventType.STORE_BUY, {
      playerId,
      itemId,
      quantity,
      totalPrice,
      newStoreQuantity: this.storeInventory.get(itemId)
    });
    
  }

  /**
   * Handle store sale
   */
  private handleStoreSell(data: { playerId: string, itemId: string, quantity: number }): void {
    const { playerId, itemId, quantity } = data;
    
    if (quantity <= 0) {
      this.sendError(playerId, 'Invalid quantity for sale');
      return;
    }
    
    const item = getItem(itemId);
    if (!item) {
      this.sendError(playerId, 'Item not found');
      return;
    }
    
    // Check if player has the item in inventory
    const inventorySystem = getSystem<InventorySystem>(this.world, 'inventory');
    if (!inventorySystem?.hasItem(playerId, itemId, quantity)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, { 
        playerId, 
        message: `You don't have ${quantity} ${itemId} to sell.`,
        type: 'error'
      });
      return;
    }
    
    const totalPrice = Math.floor(item.value * this.SELL_PRICE_MULTIPLIER) * quantity;
    
    // Update store inventory (store buys back items)
    const currentStoreQuantity = this.storeInventory.get(itemId) || 0;
    this.storeInventory.set(itemId, currentStoreQuantity + quantity);
    
    // Record transaction
    const transaction: StoreTransaction = {
      type: 'sell',
      itemId,
      quantity,
      totalPrice,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.emitTypedEvent(EventType.STORE_SELL, {
      playerId,
      itemId,
      quantity,
      totalPrice,
      newStoreQuantity: this.storeInventory.get(itemId)
    });
    
  }

  /**
   * Get or create player bank storage
   */
  private getPlayerBankStorage(playerId: string): PlayerBankStorage {
    let bankData = this.bankStorage.get(playerId);
    
    if (!bankData) {
      bankData = {
        playerId,
        items: new Map(),
        lastAccessed: Date.now()
      };
      this.bankStorage.set(playerId, bankData);
    }
    
    return bankData;
  }

  /**
   * Send error message to player
   */
  private sendError(playerId: string, message: string): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message,
      type: 'error' as const
    });
  }

  /**
   * Get player bank contents
   */
  public getPlayerBankContents(playerId: string): { [key: string]: number } {
    const bankData = this.getPlayerBankStorage(playerId);
    const result: { [key: string]: number } = {};
    
    for (const [itemId, quantity] of bankData.items) {
      result[itemId] = quantity;
    }
    
    return result;
  }

  /**
   * Get store inventory
   */
  public getStoreInventory(): { [key: string]: number } {
    const result: { [key: string]: number } = {};
    
    for (const [itemId, quantity] of this.storeInventory) {
      result[itemId] = quantity;
    }
    
    return result;
  }

  /**
   * Get transaction history
   */
  public getTransactionHistory(playerId?: string): Array<BankTransaction | StoreTransaction> {
    if (playerId) {
      return this.transactionHistory.filter(t => t.playerId === playerId);
    }
    return [...this.transactionHistory];
  }

  /**
   * Spawn an NPC entity
   * Returns the spawned NPC entity or undefined if spawn failed
   */
  public spawnNPC(data: { 
    npcId: string;
    name: string;
    type: string;
    position: Position3D;
    services?: string[];
    modelPath?: string;
  }): Entity | undefined {
    // Get the entities system to spawn the actual entity
    const entitiesSystem = getEntitiesSystem(this.world);
    if (!entitiesSystem) return undefined;

    // Create the NPC entity with proper components
    const entity = (entitiesSystem as { spawn?: (config: unknown) => unknown }).spawn?.({
      id: `npc_${data.npcId}_${Date.now()}`,
      name: data.name,
      position: data.position,
      type: 'npc',
      data: {
        npcType: data.type,
        services: data.services || [],
        modelPath: data.modelPath || 'asset://models/npcs/default.glb'
      }
    });

    return entity as Entity | undefined;
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): SystemInfo {
    return {
      bankAccounts: this.bankStorage.size,
      totalTransactions: this.transactionHistory.length,
      storeItems: this.storeInventory.size,
      recentTransactions: this.transactionHistory.slice(-10).map(transaction => ({
        timestamp: transaction.timestamp,
        type: transaction.type,
        playerId: transaction.playerId,
        itemId: transaction.itemId,
        quantity: transaction.quantity,
        amount: 'totalPrice' in transaction ? transaction.totalPrice : 0
      }))
    };
  }

  /**
   * Handle terrain tile generation - spawn NPCs and towns for new tiles
   */
  private onTileGenerated(tileData: { tileX: number; tileZ: number; biome: string }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    const tileBounds = {
      minX: tileData.tileX * TILE_SIZE,
      maxX: (tileData.tileX + 1) * TILE_SIZE,
      minZ: tileData.tileZ * TILE_SIZE,
      maxZ: (tileData.tileZ + 1) * TILE_SIZE,
    };

    // Find which world areas overlap with this new tile
    const overlappingAreas: Array<typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS]> = [];
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      const areaBounds = area.bounds;
      // Simple bounding box overlap check
      if (tileBounds.minX < areaBounds.maxX && tileBounds.maxX > areaBounds.minX &&
          tileBounds.minZ < areaBounds.maxZ && tileBounds.maxZ > areaBounds.minZ) {
        overlappingAreas.push(area);
      }
    }

    if (overlappingAreas.length > 0) {
      this.generateContentForTile(tileData, overlappingAreas);
    }
  }

  /**
   * Generate NPCs for overlapping world areas
   */
  private generateContentForTile(tileData: { tileX: number; tileZ: number }, areas: Array<typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS]>): void {
    for (const area of areas) {
      // Spawn NPCs from world-areas.ts data if they fall within this tile
      this.generateNPCsForArea(area, tileData);
    }
  }

  /**
   * Spawn NPCs from a world area when its tile generates
   */
  private generateNPCsForArea(area: typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS], tileData: { tileX: number; tileZ: number }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    for (const npc of area.npcs) {
      const npcTileX = Math.floor(npc.position.x / TILE_SIZE);
      const npcTileZ = Math.floor(npc.position.z / TILE_SIZE);

      if (npcTileX === tileData.tileX && npcTileZ === tileData.tileZ) {
        // Ground NPC to terrain
        const groundedPosition = groundToTerrain(this.world, npc.position, 0.1, Infinity);
        
        this.emitTypedEvent(EventType.NPC_SPAWN_REQUEST, {
          npcId: npc.id,
          name: npc.name,
          type: npc.type,
          position: groundedPosition,
          services: npc.services,
          modelPath: npc.modelPath,
        });
      }
    }
  }

  /**
   * Get starter town configurations from world areas
   */
  private getStarterTownConfigs(): Town[] {
    return Object.values(STARTER_TOWNS).map(area => ({
      id: area.id,
      name: area.name,
      position: { 
        x: (area.bounds.minX + area.bounds.maxX) / 2, 
        y: 0, // Y will be grounded to terrain
        z: (area.bounds.minZ + area.bounds.maxZ) / 2 
      },
      safeZoneRadius: Math.max(
        (area.bounds.maxX - area.bounds.minX) / 2,
        (area.bounds.maxZ - area.bounds.minZ) / 2
      ),
      hasBank: area.npcs.some(npc => npc.type === 'bank'),
      hasStore: area.npcs.some(npc => npc.type.includes('store')),
      isRespawnPoint: area.safeZone || false
    }));
  }

  /**
   * Generate all starter towns
   */
  private generateTowns(): void {
    const townConfigs = this.getStarterTownConfigs();
    for (const townConfig of townConfigs) {
      this.generateTown(townConfig);
    }
  }

  /**
   * Generate a single town with safe zone
   */
  private generateTown(config: Town): void {
    this.towns.set(config.id, config);
    
    // Create a safe zone
    this.emitTypedEvent(EventType.ENTITY_SPAWNED, {
      entityType: 'safezone',
      entityId: `safezone_${config.id}`,
      position: config.position,
      radius: config.safeZoneRadius,
    });
    
    // Emit bank/store events for systems that need to know
    if (config.hasBank) {
      this.emitTypedEvent(EventType.BANK_OPEN, {
        bankId: `bank_${config.id}`,
        position: { x: config.position.x - 8, y: config.position.y, z: config.position.z },
        townId: config.id
      });
    }
  }

  /**
   * Get all towns
   */
  public getTowns(): Town[] {
    return [...this.towns.values()];
  }

  /**
   * Get nearest town to a position
   */
  public getNearestTown(position: { x: number; z: number }): Town | null {
    let nearestTown: Town | null = null;
    let minDistance = Infinity;
    
    for (const town of this.towns.values()) {
      const distance = this.calculateDistance2D(position, town.position);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
    
    return nearestTown;
  }

  /**
   * Check if position is in a safe zone
   */
  public isInSafeZone(position: { x: number; z: number }): boolean {
    for (const town of this.towns.values()) {
      const distance = this.calculateDistance2D(position, town.position);
      
      if (distance <= town.safeZoneRadius) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate 2D distance between positions
   */
  private calculateDistance2D(pos1: { x: number; z: number }, pos2: { x: number; z: number }): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  destroy(): void {
    // Clear NPC transaction data
    this.bankStorage.clear();
    this.storeInventory.clear();
    this.transactionHistory.length = 0;
    this.towns.clear();
    
    // Call parent cleanup (handles event listeners automatically)
    super.destroy();
  }
}