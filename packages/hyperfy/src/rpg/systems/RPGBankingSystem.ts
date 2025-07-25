import { System } from '../../core/systems/System';

export interface RPGBankItem {
  id: number;
  name: string;
  quantity: number;
  stackable: boolean;
}

export interface RPGBankData {
  items: RPGBankItem[];
  maxSlots: number; // Unlimited per GDD, but we'll use a high number
}

/**
 * RPG Banking System
 * Manages player bank storage per GDD specifications:
 * - One bank per starter town
 * - Unlimited storage slots per bank
 * - Banks are independent (no shared storage)
 * - Click bank to open interface
 * - Drag items to store/retrieve
 */
export class RPGBankingSystem extends System {
  private playerBanks = new Map<string, Map<string, RPGBankData>>(); // playerId -> bankId -> bankData
  private readonly MAX_BANK_SLOTS = 1000; // Effectively unlimited
  private readonly STARTER_TOWN_BANKS = [
    { id: 'bank_town_0', name: 'Central Bank', position: { x: 0, y: 2, z: 5 } },
    { id: 'bank_town_1', name: 'Eastern Bank', position: { x: 100, y: 2, z: 5 } },
    { id: 'bank_town_2', name: 'Western Bank', position: { x: -100, y: 2, z: 5 } },
    { id: 'bank_town_3', name: 'Northern Bank', position: { x: 0, y: 2, z: 105 } },
    { id: 'bank_town_4', name: 'Southern Bank', position: { x: 0, y: 2, z: -95 } }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGBankingSystem] Initializing banking system...');
    
    // Listen for banking events
    this.world.on?.('rpg:player:register', this.initializePlayerBanks.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerBanks.bind(this));
    this.world.on?.('rpg:bank:open', this.openBank.bind(this));
    this.world.on?.('rpg:bank:close', this.closeBank.bind(this));
    this.world.on?.('rpg:bank:deposit', this.depositItem.bind(this));
    this.world.on?.('rpg:bank:withdraw', this.withdrawItem.bind(this));
    this.world.on?.('rpg:bank:deposit_all', this.depositAllItems.bind(this));
    
    console.log('[RPGBankingSystem] Banking system initialized with independent bank storage');
  }

  start(): void {
    console.log('[RPGBankingSystem] Banking system started');
  }

  private initializePlayerBanks(playerData: { id: string }): void {
    const playerId = playerData.id;
    const playerBanks = new Map<string, RPGBankData>();
    
    // Initialize empty banks for each starter town per GDD
    for (const bankInfo of this.STARTER_TOWN_BANKS) {
      const bankData: RPGBankData = {
        items: [],
        maxSlots: this.MAX_BANK_SLOTS
      };
      playerBanks.set(bankInfo.id, bankData);
    }
    
    this.playerBanks.set(playerId, playerBanks);
    console.log(`[RPGBankingSystem] Initialized ${this.STARTER_TOWN_BANKS.length} banks for player: ${playerId}`);
  }

  private cleanupPlayerBanks(playerId: string): void {
    this.playerBanks.delete(playerId);
    console.log(`[RPGBankingSystem] Cleaned up banks for player: ${playerId}`);
  }

  private openBank(data: { playerId: string; bankId: string; position: { x: number; y: number; z: number } }): void {
    const playerBanks = this.playerBanks.get(data.playerId);
    if (!playerBanks) {
      console.log(`[RPGBankingSystem] No banks found for player: ${data.playerId}`);
      return;
    }

    const bank = playerBanks.get(data.bankId);
    if (!bank) {
      console.log(`[RPGBankingSystem] Bank ${data.bankId} not found for player: ${data.playerId}`);
      return;
    }

    // Check if player is near the bank (within 3 meters)
    const bankInfo = this.STARTER_TOWN_BANKS.find(b => b.id === data.bankId);
    if (bankInfo) {
      const distance = this.calculateDistance(data.position, bankInfo.position);
      if (distance > 3) {
        console.log(`[RPGBankingSystem] Player ${data.playerId} too far from bank: ${distance}m`);
        this.world.emit?.('rpg:ui:message', {
          playerId: data.playerId,
          message: 'You need to be closer to the bank to use it.',
          type: 'error'
        });
        return;
      }
    }

    console.log(`[RPGBankingSystem] Player ${data.playerId} opened bank ${data.bankId}`);
    
    // Send bank interface data to player
    this.world.emit?.('rpg:bank:interface:open', {
      playerId: data.playerId,
      bankId: data.bankId,
      bankName: bankInfo?.name || 'Bank',
      items: bank.items,
      maxSlots: bank.maxSlots,
      usedSlots: bank.items.length
    });

    // Also send player inventory for transfer interface
    this.world.emit?.('rpg:inventory:request', { playerId: data.playerId });
  }

  private closeBank(data: { playerId: string; bankId: string }): void {
    console.log(`[RPGBankingSystem] Player ${data.playerId} closed bank ${data.bankId}`);
    
    this.world.emit?.('rpg:bank:interface:close', {
      playerId: data.playerId,
      bankId: data.bankId
    });
  }

  private depositItem(data: { playerId: string; bankId: string; itemId: number; quantity: number }): void {
    const playerBanks = this.playerBanks.get(data.playerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(data.bankId);
    if (!bank) return;

    // Check if player has the item in inventory
    this.world.emit?.('rpg:inventory:check', {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: data.quantity,
      callback: (hasItem: boolean, item?: any) => {
        if (!hasItem) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: 'You don\'t have that item to deposit.',
            type: 'error'
          });
          return;
        }

        // Check if item can stack in bank
        if (item.stackable) {
          const existingItem = bank.items.find(bankItem => bankItem.id === data.itemId);
          if (existingItem) {
            existingItem.quantity += data.quantity;
          } else {
            // Add new item to bank
            if (bank.items.length >= bank.maxSlots) {
              this.world.emit?.('rpg:ui:message', {
                playerId: data.playerId,
                message: 'Bank is full.',
                type: 'error'
              });
              return;
            }
            bank.items.push({
              id: item.id,
              name: item.name,
              quantity: data.quantity,
              stackable: item.stackable
            });
          }
        } else {
          // Non-stackable item - add individual slots
          for (let i = 0; i < data.quantity; i++) {
            if (bank.items.length >= bank.maxSlots) {
              this.world.emit?.('rpg:ui:message', {
                playerId: data.playerId,
                message: 'Bank is full.',
                type: 'error'
              });
              break;
            }
            bank.items.push({
              id: item.id,
              name: item.name,
              quantity: 1,
              stackable: item.stackable
            });
          }
        }

        // Remove item from player inventory
        this.world.emit?.('rpg:inventory:remove', {
          playerId: data.playerId,
          itemId: data.itemId,
          quantity: data.quantity
        });

        console.log(`[RPGBankingSystem] Player ${data.playerId} deposited ${data.quantity}x ${item.name} to bank ${data.bankId}`);
        
        // Update bank interface
        this.updateBankInterface(data.playerId, data.bankId);
      }
    });
  }

  private withdrawItem(data: { playerId: string; bankId: string; itemId: number; quantity: number }): void {
    const playerBanks = this.playerBanks.get(data.playerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(data.bankId);
    if (!bank) return;

    // Find item in bank
    const bankItemIndex = bank.items.findIndex(item => item.id === data.itemId);
    if (bankItemIndex === -1) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: 'Item not found in bank.',
        type: 'error'
      });
      return;
    }

    const bankItem = bank.items[bankItemIndex];
    if (bankItem.quantity < data.quantity) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: 'Not enough of that item in bank.',
        type: 'error'
      });
      return;
    }

    // Check if player inventory has space
    this.world.emit?.('rpg:inventory:can_add', {
      playerId: data.playerId,
      item: {
        id: bankItem.id,
        name: bankItem.name,
        quantity: data.quantity,
        stackable: bankItem.stackable
      },
      callback: (canAdd: boolean) => {
        if (!canAdd) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: 'Not enough inventory space.',
            type: 'error'
          });
          return;
        }

        // Remove from bank
        bankItem.quantity -= data.quantity;
        if (bankItem.quantity <= 0) {
          bank.items.splice(bankItemIndex, 1);
        }

        // Add to player inventory
        this.world.emit?.('rpg:inventory:add', {
          playerId: data.playerId,
          item: {
            id: bankItem.id,
            name: bankItem.name,
            quantity: data.quantity,
            stackable: bankItem.stackable
          }
        });

        console.log(`[RPGBankingSystem] Player ${data.playerId} withdrew ${data.quantity}x ${bankItem.name} from bank ${data.bankId}`);
        
        // Update bank interface
        this.updateBankInterface(data.playerId, data.bankId);
      }
    });
  }

  private depositAllItems(data: { playerId: string; bankId: string }): void {
    // Get player's inventory and deposit everything except equipped items
    this.world.emit?.('rpg:inventory:get_all', {
      playerId: data.playerId,
      callback: (items: any[]) => {
        let deposited = 0;
        for (const item of items) {
          this.depositItem({
            playerId: data.playerId,
            bankId: data.bankId,
            itemId: item.id,
            quantity: item.quantity
          });
          deposited++;
        }
        
        if (deposited > 0) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: `Deposited ${deposited} items to bank.`,
            type: 'success'
          });
        }
      }
    });
  }

  private updateBankInterface(playerId: string, bankId: string): void {
    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(bankId);
    if (!bank) return;

    const bankInfo = this.STARTER_TOWN_BANKS.find(b => b.id === bankId);
    
    this.world.emit?.('rpg:bank:interface:update', {
      playerId,
      bankId,
      bankName: bankInfo?.name || 'Bank',
      items: bank.items,
      maxSlots: bank.maxSlots,
      usedSlots: bank.items.length
    });
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Public API for apps
  getBankData(playerId: string, bankId: string): RPGBankData | undefined {
    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) return undefined;
    return playerBanks.get(bankId);
  }

  getAllPlayerBanks(playerId: string): Map<string, RPGBankData> | undefined {
    return this.playerBanks.get(playerId);
  }

  getBankLocations(): Array<{ id: string; name: string; position: { x: number; y: number; z: number } }> {
    return [...this.STARTER_TOWN_BANKS];
  }

  getItemCount(playerId: string, bankId: string, itemId: number): number {
    const bank = this.getBankData(playerId, bankId);
    if (!bank) return 0;
    
    const item = bank.items.find(item => item.id === itemId);
    return item ? item.quantity : 0;
  }

  getTotalItemCount(playerId: string, itemId: number): number {
    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) return 0;

    let total = 0;
    for (const bank of playerBanks.values()) {
      const item = bank.items.find(item => item.id === itemId);
      if (item) {
        total += item.quantity;
      }
    }
    return total;
  }

  destroy(): void {
    this.playerBanks.clear();
    console.log('[RPGBankingSystem] System destroyed');
  }

  // Required System lifecycle methods
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