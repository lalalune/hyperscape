/**
 * RPG NPC System
 * Handles NPC interactions, banking, and store transactions
 */

import { System } from '../../core/systems/System';
import { NPCLocation } from '../data/world-areas';
import { SHOP_ITEMS, getItem } from '../data/items';

export interface BankTransaction {
  type: 'deposit' | 'withdraw';
  itemId: string;
  quantity: number;
  playerId: string;
  timestamp: number;
}

export interface StoreTransaction {
  type: 'buy' | 'sell';
  itemId: string;
  quantity: number;
  totalPrice: number;
  playerId: string;
  timestamp: number;
}

export interface PlayerBankStorage {
  playerId: string;
  items: Map<string, number>; // itemId -> quantity
  lastAccessed: number;
}

export class RPGNPCSystem extends System {
  private bankStorage: Map<string, PlayerBankStorage> = new Map();
  private storeInventory: Map<string, number> = new Map();
  private transactionHistory: Array<BankTransaction | StoreTransaction> = [];
  
  // Store prices (multipliers of base item value)
  private readonly BUY_PRICE_MULTIPLIER = 1.2; // 20% markup
  private readonly SELL_PRICE_MULTIPLIER = 0.6; // 40% loss when selling
  
  constructor(world: any) {
    super(world);
    this.initializeStoreInventory();
    
    // Listen for NPC interaction events
    this.world.on?.('rpg:npc:interact', this.handleNPCInteraction.bind(this));
    this.world.on?.('rpg:bank:deposit', this.handleBankDeposit.bind(this));
    this.world.on?.('rpg:bank:withdraw', this.handleBankWithdraw.bind(this));
    this.world.on?.('rpg:store:buy', this.handleStoreBuy.bind(this));
    this.world.on?.('rpg:store:sell', this.handleStoreSell.bind(this));
    
    console.log('[RPGNPCSystem] Initialized NPC interaction system');
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
  private async handleNPCInteraction(data: { playerId: string, npcId: string, npc: NPCLocation }): Promise<void> {
    const { playerId, npcId, npc } = data;
    
    console.log(`[RPGNPCSystem] Player ${playerId} interacting with NPC ${npcId}`);
    
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
    
    this.world.emit?.('rpg:ui:bank_open', {
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
    
    this.world.emit?.('rpg:ui:store_open', {
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
    this.world.emit?.('rpg:ui:trainer_open', {
      playerId,
      npcName: npc.name,
      services: npc.services,
      availableSkills: ['attack', 'strength', 'defense', 'ranged'] // TODO: Implement skill training
    });
  }

  /**
   * Send quest interface to player
   */
  private sendQuestInterface(playerId: string, npc: NPCLocation): void {
    this.world.emit?.('rpg:ui:quest_open', {
      playerId,
      npcName: npc.name,
      availableQuests: [], // TODO: Implement quest system
      completedQuests: []
    });
  }

  /**
   * Send generic dialog to player
   */
  private sendGenericDialog(playerId: string, npc: NPCLocation): void {
    this.world.emit?.('rpg:ui:dialog_open', {
      playerId,
      npcName: npc.name,
      message: npc.description || `Hello there! I'm ${npc.name}.`,
      options: ['Goodbye']
    });
  }

  /**
   * Handle bank deposit
   */
  private async handleBankDeposit(data: { playerId: string, itemId: string, quantity: number }): Promise<void> {
    const { playerId, itemId, quantity } = data;
    
    if (quantity <= 0) {
      this.sendError(playerId, 'Invalid quantity for deposit');
      return;
    }
    
    // TODO: Check if player has the item in inventory
    // For now, assume they have it
    
    const bankData = this.getPlayerBankStorage(playerId);
    const currentAmount = bankData.items.get(itemId) || 0;
    bankData.items.set(itemId, currentAmount + quantity);
    bankData.lastAccessed = Date.now();
    
    // Record transaction
    const transaction: BankTransaction = {
      type: 'deposit',
      itemId,
      quantity,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.world.emit?.('rpg:bank:deposit_success', {
      playerId,
      itemId,
      quantity,
      newBankQuantity: bankData.items.get(itemId)
    });
    
    console.log(`[RPGNPCSystem] Player ${playerId} deposited ${quantity}x ${itemId}`);
  }

  /**
   * Handle bank withdrawal
   */
  private async handleBankWithdraw(data: { playerId: string, itemId: string, quantity: number }): Promise<void> {
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
    
    // TODO: Check if player has inventory space
    // For now, assume they have space
    
    bankData.items.set(itemId, currentAmount - quantity);
    if (bankData.items.get(itemId) === 0) {
      bankData.items.delete(itemId);
    }
    bankData.lastAccessed = Date.now();
    
    // Record transaction
    const transaction: BankTransaction = {
      type: 'withdraw',
      itemId,
      quantity,
      playerId,
      timestamp: Date.now()
    };
    this.transactionHistory.push(transaction);
    
    // Emit success event
    this.world.emit?.('rpg:bank:withdraw_success', {
      playerId,
      itemId,
      quantity,
      newBankQuantity: bankData.items.get(itemId) || 0
    });
    
    console.log(`[RPGNPCSystem] Player ${playerId} withdrew ${quantity}x ${itemId}`);
  }

  /**
   * Handle store purchase
   */
  private async handleStoreBuy(data: { playerId: string, itemId: string, quantity: number }): Promise<void> {
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
    
    // TODO: Check if player has enough coins
    // For now, assume they have enough
    
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
    this.world.emit?.('rpg:store:buy_success', {
      playerId,
      itemId,
      quantity,
      totalPrice,
      newStoreQuantity: this.storeInventory.get(itemId)
    });
    
    console.log(`[RPGNPCSystem] Player ${playerId} bought ${quantity}x ${itemId} for ${totalPrice} coins`);
  }

  /**
   * Handle store sale
   */
  private async handleStoreSell(data: { playerId: string, itemId: string, quantity: number }): Promise<void> {
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
    
    // TODO: Check if player has the item in inventory
    // For now, assume they have it
    
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
    this.world.emit?.('rpg:store:sell_success', {
      playerId,
      itemId,
      quantity,
      totalPrice,
      newStoreQuantity: this.storeInventory.get(itemId)
    });
    
    console.log(`[RPGNPCSystem] Player ${playerId} sold ${quantity}x ${itemId} for ${totalPrice} coins`);
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
    this.world.emit?.('rpg:error', {
      playerId,
      message
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
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      bankAccounts: this.bankStorage.size,
      totalTransactions: this.transactionHistory.length,
      storeItems: this.storeInventory.size,
      recentTransactions: this.transactionHistory.slice(-10)
    };
  }

  // Required System lifecycle methods
  async init(): Promise<void> {
    console.log('[RPGNPCSystem] NPC system initialized');
  }

  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}