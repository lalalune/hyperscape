import { System } from '../../core/systems/System';

export interface RPGStoreItem {
  id: number;
  name: string;
  price: number;
  stockQuantity: number; // -1 for unlimited
  category: 'tools' | 'ammunition' | 'consumables';
  description: string;
}

export interface RPGStore {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  items: RPGStoreItem[];
  npcName: string;
}

/**
 * RPG Store System  
 * Manages general stores per GDD specifications:
 * - One general store per starter town
 * - Sells basic tools: Hatchet (Bronze), Fishing Rod, Tinderbox
 * - Sells ammunition: Arrows
 * - Uses coins as currency
 * - Click shopkeeper to open store interface
 */
export class RPGStoreSystem extends System {
  private stores = new Map<string, RPGStore>();
  private readonly STORES_DATA: RPGStore[] = [
    {
      id: 'store_town_0',
      name: 'Central General Store',
      position: { x: 5, y: 2, z: 0 },
      npcName: 'Shopkeeper Alice',
      items: [
        {
          id: 100, // Bronze Hatchet
          name: 'Bronze Hatchet',
          price: 1,
          stockQuantity: -1, // Unlimited
          category: 'tools',
          description: 'A basic hatchet for chopping trees.'
        },
        {
          id: 101, // Fishing Rod
          name: 'Fishing Rod', 
          price: 5,
          stockQuantity: -1,
          category: 'tools',
          description: 'A simple fishing rod for catching fish.'
        },
        {
          id: 102, // Tinderbox
          name: 'Tinderbox',
          price: 2,
          stockQuantity: -1,
          category: 'tools', 
          description: 'Essential for making fires from logs.'
        },
        {
          id: 103, // Arrows
          name: 'Arrows',
          price: 1,
          stockQuantity: -1,
          category: 'ammunition',
          description: 'Basic arrows for ranged combat. Required for bows.'
        }
      ]
    },
    {
      id: 'store_town_1',
      name: 'Eastern General Store',
      position: { x: 105, y: 2, z: 0 },
      npcName: 'Shopkeeper Bob',
      items: [
        { id: 100, name: 'Bronze Hatchet', price: 1, stockQuantity: -1, category: 'tools', description: 'A basic hatchet for chopping trees.' },
        { id: 101, name: 'Fishing Rod', price: 5, stockQuantity: -1, category: 'tools', description: 'A simple fishing rod for catching fish.' },
        { id: 102, name: 'Tinderbox', price: 2, stockQuantity: -1, category: 'tools', description: 'Essential for making fires from logs.' },
        { id: 103, name: 'Arrows', price: 1, stockQuantity: -1, category: 'ammunition', description: 'Basic arrows for ranged combat. Required for bows.' }
      ]
    },
    {
      id: 'store_town_2', 
      name: 'Western General Store',
      position: { x: -105, y: 2, z: 0 },
      npcName: 'Shopkeeper Charlie',
      items: [
        { id: 100, name: 'Bronze Hatchet', price: 1, stockQuantity: -1, category: 'tools', description: 'A basic hatchet for chopping trees.' },
        { id: 101, name: 'Fishing Rod', price: 5, stockQuantity: -1, category: 'tools', description: 'A simple fishing rod for catching fish.' },
        { id: 102, name: 'Tinderbox', price: 2, stockQuantity: -1, category: 'tools', description: 'Essential for making fires from logs.' },
        { id: 103, name: 'Arrows', price: 1, stockQuantity: -1, category: 'ammunition', description: 'Basic arrows for ranged combat. Required for bows.' }
      ]
    },
    {
      id: 'store_town_3',
      name: 'Northern General Store', 
      position: { x: 0, y: 2, z: 110 },
      npcName: 'Shopkeeper Diana',
      items: [
        { id: 100, name: 'Bronze Hatchet', price: 1, stockQuantity: -1, category: 'tools', description: 'A basic hatchet for chopping trees.' },
        { id: 101, name: 'Fishing Rod', price: 5, stockQuantity: -1, category: 'tools', description: 'A simple fishing rod for catching fish.' },
        { id: 102, name: 'Tinderbox', price: 2, stockQuantity: -1, category: 'tools', description: 'Essential for making fires from logs.' },
        { id: 103, name: 'Arrows', price: 1, stockQuantity: -1, category: 'ammunition', description: 'Basic arrows for ranged combat. Required for bows.' }
      ]
    },
    {
      id: 'store_town_4',
      name: 'Southern General Store',
      position: { x: 0, y: 2, z: -105 },
      npcName: 'Shopkeeper Eve',
      items: [
        { id: 100, name: 'Bronze Hatchet', price: 1, stockQuantity: -1, category: 'tools', description: 'A basic hatchet for chopping trees.' },
        { id: 101, name: 'Fishing Rod', price: 5, stockQuantity: -1, category: 'tools', description: 'A simple fishing rod for catching fish.' },
        { id: 102, name: 'Tinderbox', price: 2, stockQuantity: -1, category: 'tools', description: 'Essential for making fires from logs.' },
        { id: 103, name: 'Arrows', price: 1, stockQuantity: -1, category: 'ammunition', description: 'Basic arrows for ranged combat. Required for bows.' }
      ]
    }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGStoreSystem] Initializing store system...');
    
    // Initialize all stores
    for (const storeData of this.STORES_DATA) {
      this.stores.set(storeData.id, { ...storeData });
    }
    
    // Listen for store events
    this.world.on?.('rpg:store:open', this.openStore.bind(this));
    this.world.on?.('rpg:store:close', this.closeStore.bind(this));
    this.world.on?.('rpg:store:buy', this.buyItem.bind(this));
    this.world.on?.('rpg:store:sell', this.sellItem.bind(this)); // For future expansion
    
    console.log(`[RPGStoreSystem] Store system initialized with ${this.STORES_DATA.length} general stores`);
  }

  start(): void {
    console.log('[RPGStoreSystem] Store system started');
  }

  private openStore(data: { playerId: string; storeId: string; playerPosition: { x: number; y: number; z: number } }): void {
    const store = this.stores.get(data.storeId);
    if (!store) {
      console.log(`[RPGStoreSystem] Store ${data.storeId} not found`);
      return;
    }

    // Check if player is near the store (within 3 meters per GDD interaction distance)
    const distance = this.calculateDistance(data.playerPosition, store.position);
    if (distance > 3) {
      console.log(`[RPGStoreSystem] Player ${data.playerId} too far from store: ${distance}m`);
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: 'You need to be closer to the shopkeeper to trade.',
        type: 'error'
      });
      return;
    }

    console.log(`[RPGStoreSystem] Player ${data.playerId} opened store ${data.storeId}`);
    
    // Send store interface data to player
    this.world.emit?.('rpg:store:interface:open', {
      playerId: data.playerId,
      storeId: data.storeId,
      storeName: store.name,
      npcName: store.npcName,  
      items: store.items,
      categories: ['tools', 'ammunition', 'consumables']
    });

    // Get player's current coins for purchase validation
    this.world.emit?.('rpg:inventory:get_coins', {
      playerId: data.playerId,
      callback: (coins: number) => {
        this.world.emit?.('rpg:store:player_coins', {
          playerId: data.playerId,
          coins: coins
        });
      }
    });
  }

  private closeStore(data: { playerId: string; storeId: string }): void {
    console.log(`[RPGStoreSystem] Player ${data.playerId} closed store ${data.storeId}`);
    
    this.world.emit?.('rpg:store:interface:close', {
      playerId: data.playerId,
      storeId: data.storeId
    });
  }

  private buyItem(data: { playerId: string; storeId: string; itemId: number; quantity: number }): void {
    const store = this.stores.get(data.storeId);
    if (!store) return;

    const item = store.items.find(item => item.id === data.itemId);
    if (!item) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: 'Item not available in this store.',
        type: 'error'
      });
      return;
    }

    // Check stock (if not unlimited)
    if (item.stockQuantity !== -1 && item.stockQuantity < data.quantity) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: 'Not enough stock available.',
        type: 'error'
      });
      return;
    }

    const totalCost = item.price * data.quantity;

    // Check if player has enough coins
    this.world.emit?.('rpg:inventory:get_coins', {
      playerId: data.playerId,
      callback: (playerCoins: number) => {
        if (playerCoins < totalCost) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: `You need ${totalCost} coins but only have ${playerCoins}.`,
            type: 'error'
          });
          return;
        }

        // Check if player has inventory space
        this.world.emit?.('rpg:inventory:can_add', {
          playerId: data.playerId,
          item: {
            id: item.id,
            name: item.name,
            quantity: data.quantity,
            stackable: item.category === 'ammunition' // Arrows are stackable
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

            // Process the purchase
            // Remove coins from player
            this.world.emit?.('rpg:inventory:remove_coins', {
              playerId: data.playerId,
              amount: totalCost
            });

            // Add item to player inventory
            this.world.emit?.('rpg:inventory:add', {
              playerId: data.playerId,
              item: {
                id: item.id,
                name: item.name,
                quantity: data.quantity,
                stackable: item.category === 'ammunition'
              }
            });

            // Update store stock (if not unlimited)
            if (item.stockQuantity !== -1) {
              item.stockQuantity -= data.quantity;
            }

            console.log(`[RPGStoreSystem] Player ${data.playerId} bought ${data.quantity}x ${item.name} for ${totalCost} coins from store ${data.storeId}`);
            
            // Send success message
            this.world.emit?.('rpg:ui:message', {
              playerId: data.playerId,
              message: `Purchased ${data.quantity}x ${item.name} for ${totalCost} coins.`,
              type: 'success'
            });

            // Update store interface to reflect new stock and player coins
            this.world.emit?.('rpg:store:interface:update', {
              playerId: data.playerId,
              storeId: data.storeId,
              items: store.items
            });

            // Update player coins display
            this.world.emit?.('rpg:inventory:get_coins', {
              playerId: data.playerId,
              callback: (newCoins: number) => {
                this.world.emit?.('rpg:store:player_coins', {
                  playerId: data.playerId,
                  coins: newCoins
                });
              }
            });
          }
        });
      }
    });
  }

  private sellItem(data: { playerId: string; storeId: string; itemId: number; quantity: number }): void {
    // Selling back to stores - implementation for future expansion
    // For MVP, stores only sell items per GDD (no buy-back)
    this.world.emit?.('rpg:ui:message', {  
      playerId: data.playerId,
      message: 'This store does not buy items back.',
      type: 'info'
    });
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Public API for apps
  getStore(storeId: string): RPGStore | undefined {
    return this.stores.get(storeId);
  }

  getAllStores(): RPGStore[] {
    return Array.from(this.stores.values());
  }

  getStoreLocations(): Array<{ id: string; name: string; position: { x: number; y: number; z: number }; npcName: string }> {
    return this.STORES_DATA.map(store => ({
      id: store.id,
      name: store.name,
      position: store.position,
      npcName: store.npcName
    }));
  }

  getItemPrice(storeId: string, itemId: number): number | null {
    const store = this.stores.get(storeId);
    if (!store) return null;
    
    const item = store.items.find(item => item.id === itemId);
    return item ? item.price : null;
  }

  getItemStock(storeId: string, itemId: number): number | null {
    const store = this.stores.get(storeId);
    if (!store) return null;
    
    const item = store.items.find(item => item.id === itemId);
    return item ? item.stockQuantity : null;
  }

  isItemAvailable(storeId: string, itemId: number, quantity: number = 1): boolean {
    const store = this.stores.get(storeId);
    if (!store) return false;
    
    const item = store.items.find(item => item.id === itemId);
    if (!item) return false;
    
    return item.stockQuantity === -1 || item.stockQuantity >= quantity;
  }

  // Get available tools for resource gathering per GDD
  getToolsForSkill(skill: string): RPGStoreItem[] {
    const allItems: RPGStoreItem[] = [];
    for (const store of this.stores.values()) {
      allItems.push(...store.items.filter(item => item.category === 'tools'));
    }
    
    // Remove duplicates
    const uniqueItems = allItems.filter((item, index, self) => 
      index === self.findIndex(i => i.id === item.id)
    );
    
    // Filter by skill if needed
    switch (skill) {
      case 'woodcutting':
        return uniqueItems.filter(item => item.name.includes('Hatchet'));
      case 'fishing':
        return uniqueItems.filter(item => item.name.includes('Fishing Rod'));
      case 'firemaking':
        return uniqueItems.filter(item => item.name.includes('Tinderbox'));
      default:
        return uniqueItems;
    }
  }

  destroy(): void {
    this.stores.clear();
    console.log('[RPGStoreSystem] System destroyed');
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