import { System } from '../../core/systems/System'
import type { World } from '../../types'
import {
  RPGEntity,
  // ItemStack,
  InventoryComponent,
  NPCComponent,
} from '../types/index'

export interface ShopItem {
  itemId: number
  stock: number
  maxStock: number
  restockRate: number // Items per minute
  lastRestock: number
  customPrice?: number // Override default item value
}

export interface Shop {
  id: string
  name: string
  npcId: string
  items: ShopItem[]
  currency: 'gp' | 'tokkul' | 'custom' // Gold pieces, TzHaar currency, etc.
  buyModifier: number // Multiplier for buying from shop (default 1.0)
  sellModifier: number // Multiplier for selling to shop (default 0.4)
  specialStock: boolean // Whether stock is per-player
  lastUpdate: number
}

export interface PlayerShopSession {
  playerId: string
  shopId: string
  startTime: number
}

export class ShopSystem extends System {
  private shops: Map<string, Shop> = new Map()
  private playerShops: Map<string, Map<string, ShopItem[]>> = new Map() // For per-player stock
  private activeSessions: Map<string, PlayerShopSession> = new Map()

  // Configuration
  private readonly RESTOCK_INTERVAL = 60000 // 1 minute
  private readonly DEFAULT_BUY_MODIFIER = 1.0
  private readonly DEFAULT_SELL_MODIFIER = 0.4 // 40% of item value
  private readonly GENERAL_STORE_ID = 'general_store'

  constructor(world: World) {
    super(world)
    this.registerDefaultShops()
  }

  /**
   * Register default shops
   */
  private registerDefaultShops(): void {
    // General Store
    this.registerShop({
      id: this.GENERAL_STORE_ID,
      name: 'General Store',
      npcId: 'shopkeeper_general',
      items: [
        { itemId: 1931, stock: 30, maxStock: 30, restockRate: 1, lastRestock: Date.now() }, // Pot
        { itemId: 1925, stock: 30, maxStock: 30, restockRate: 1, lastRestock: Date.now() }, // Bucket
        { itemId: 590, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Tinderbox
        { itemId: 36, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Candle
        { itemId: 1351, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() }, // Bronze axe
        { itemId: 1265, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() }, // Bronze pickaxe
        { itemId: 946, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Knife
        { itemId: 1785, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Gloves
        { itemId: 1129, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Leather body
        { itemId: 1095, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }, // Leather chaps
      ],
      currency: 'gp',
      buyModifier: this.DEFAULT_BUY_MODIFIER,
      sellModifier: this.DEFAULT_SELL_MODIFIER,
      specialStock: false,
      lastUpdate: Date.now(),
    })

    // Sword Shop
    this.registerShop({
      id: 'sword_shop',
      name: 'Varrock Swords',
      npcId: 'shopkeeper_sword',
      items: [
        { itemId: 1277, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() }, // Bronze sword
        { itemId: 1279, stock: 4, maxStock: 4, restockRate: 0.15, lastRestock: Date.now() }, // Iron sword
        { itemId: 1281, stock: 3, maxStock: 3, restockRate: 0.1, lastRestock: Date.now() }, // Steel sword
        { itemId: 1285, stock: 2, maxStock: 2, restockRate: 0.05, lastRestock: Date.now() }, // Mithril sword
        { itemId: 1287, stock: 1, maxStock: 1, restockRate: 0.02, lastRestock: Date.now() }, // Adamant sword
      ],
      currency: 'gp',
      buyModifier: 1.3, // Specialist shops charge more
      sellModifier: 0.5,
      specialStock: false,
      lastUpdate: Date.now(),
    })

    // Rune Shop
    this.registerShop({
      id: 'rune_shop',
      name: "Aubury's Rune Shop",
      npcId: 'shopkeeper_rune',
      items: [
        { itemId: 556, stock: 1000, maxStock: 1000, restockRate: 10, lastRestock: Date.now() }, // Air rune
        { itemId: 555, stock: 1000, maxStock: 1000, restockRate: 10, lastRestock: Date.now() }, // Water rune
        { itemId: 557, stock: 1000, maxStock: 1000, restockRate: 10, lastRestock: Date.now() }, // Earth rune
        { itemId: 554, stock: 1000, maxStock: 1000, restockRate: 10, lastRestock: Date.now() }, // Fire rune
        { itemId: 558, stock: 500, maxStock: 500, restockRate: 5, lastRestock: Date.now() }, // Mind rune
        { itemId: 562, stock: 250, maxStock: 250, restockRate: 2, lastRestock: Date.now() }, // Chaos rune
      ],
      currency: 'gp',
      buyModifier: 1.0,
      sellModifier: 0.4,
      specialStock: false,
      lastUpdate: Date.now(),
    })
  }

  /**
   * Register a shop
   */
  public registerShop(shop: Shop): void {
    this.shops.set(shop.id, shop)
  }

  /**
   * Open shop for player
   */
  public openShop(playerId: string, shopId: string): boolean {
    const player = this.world.entities.get(playerId)
    if (!player) {
      return false
    }

    const shop = this.shops.get(shopId)
    if (!shop) {
      return false
    }

    // Check if shop NPC exists and is nearby
    const shopNPC = this.findShopNPC(shop.npcId)
    if (shopNPC) {
      const distance = this.getDistance(player as any, shopNPC as any)
      if (distance > 5) {
        this.sendMessage(playerId, 'You are too far away from the shop.')
        return false
      }
    }

    // Create session
    const session: PlayerShopSession = {
      playerId,
      shopId,
      startTime: Date.now(),
    }
    this.activeSessions.set(playerId, session)

    // Update stock
    this.updateShopStock(shop)

    // Get current stock (per-player or global)
    const stock = this.getShopStock(shop, playerId)

    // Emit event
    this.world.events.emit('shop:opened', {
      playerId,
      shopId,
      shopName: shop.name,
      stock,
      buyModifier: shop.buyModifier,
      sellModifier: shop.sellModifier,
    })

    return true
  }

  /**
   * Close shop
   */
  public closeShop(playerId: string): void {
    const session = this.activeSessions.get(playerId)
    if (!session) {
      return
    }

    this.activeSessions.delete(playerId)

    this.world.events.emit('shop:closed', {
      playerId,
      shopId: session.shopId,
    })
  }

  /**
   * Buy item from shop
   */
  public buyItem(playerId: string, shopId: string, itemIndex: number, quantity: number = 1): boolean {
    const session = this.activeSessions.get(playerId)
    if (!session || session.shopId !== shopId) {
      return false
    }

    const shop = this.shops.get(shopId)
    if (!shop) {
      return false
    }

    const player = this.world.entities.get(playerId)
    if (!player) {
      return false
    }

    // Get current stock
    const stock = this.getShopStock(shop, playerId)
    if (itemIndex < 0 || itemIndex >= stock.length) {
      return false
    }

    const shopItem = stock[itemIndex]
    if (!shopItem || shopItem.stock < quantity) {
      this.sendMessage(playerId, "The shop doesn't have that many in stock.")
      return false
    }

    // Calculate price
    const itemDef = this.getItemDefinition(shopItem.itemId)
    if (!itemDef) {
      return false
    }

    const basePrice = shopItem.customPrice || itemDef.value
    const totalPrice = Math.floor(basePrice * shop.buyModifier * quantity)

    // Check if player has enough money
    const inventory = player.getComponent('inventory') as any
    if (!inventory) {
      return false
    }

    const playerGold = this.getPlayerCurrency(inventory, shop.currency)
    if (playerGold < totalPrice) {
      this.sendMessage(playerId, "You don't have enough coins.")
      return false
    }

    // Check inventory space
    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return false
    }

    const hasSpace = inventorySystem.hasSpace(playerId, shopItem.itemId, quantity)
    if (!hasSpace) {
      this.sendMessage(playerId, "You don't have enough inventory space.")
      return false
    }

    // Remove currency
    if (!this.removeCurrency(playerId, shop.currency, totalPrice)) {
      return false
    }

    // Add item
    inventorySystem.addItem(playerId, shopItem.itemId, quantity)

    // Update stock
    shopItem.stock -= quantity

    // Emit event
    this.world.events.emit('shop:bought', {
      playerId,
      shopId,
      itemId: shopItem.itemId,
      quantity,
      price: totalPrice,
    })

    this.sendMessage(playerId, `You buy ${quantity} ${itemDef.name} for ${totalPrice} coins.`)

    return true
  }

  /**
   * Sell item to shop
   */
  public sellItem(playerId: string, shopId: string, inventorySlot: number, quantity: number = 1): boolean {
    const session = this.activeSessions.get(playerId)
    if (!session || session.shopId !== shopId) {
      return false
    }

    const shop = this.shops.get(shopId)
    if (!shop) {
      return false
    }

    const player = this.world.entities.get(playerId)
    if (!player) {
      return false
    }

    const inventory = player.getComponent('inventory') as any
    if (!inventory) {
      return false
    }

    const item = inventory.items[inventorySlot]
    if (!item || item.quantity < quantity) {
      return false
    }

    // Get item definition
    const itemDef = this.getItemDefinition(item.itemId)
    if (!itemDef) {
      return false
    }

    // Check if item can be sold
    if (!itemDef.tradeable) {
      this.sendMessage(playerId, "You can't sell this item.")
      return false
    }

    // Calculate price
    const basePrice = itemDef.value
    const totalPrice = Math.floor(basePrice * shop.sellModifier * quantity)

    // Check if shop accepts this item
    const shopStock = this.getShopStock(shop, playerId)
    const existingItem = shopStock.find(si => si.itemId === item.itemId)

    // General stores accept everything, specialist shops only their items
    if (shop.id !== this.GENERAL_STORE_ID && !existingItem) {
      this.sendMessage(playerId, "This shop doesn't buy that type of item.")
      return false
    }

    // Remove item from inventory
    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return false
    }

    if (!inventorySystem.removeItem(playerId, inventorySlot, quantity)) {
      return false
    }

    // Add currency
    this.addCurrency(playerId, shop.currency, totalPrice)

    // Update shop stock if it's a general store
    if (shop.id === this.GENERAL_STORE_ID && !existingItem) {
      shopStock.push({
        itemId: item.itemId,
        stock: quantity,
        maxStock: quantity,
        restockRate: -1, // Sold items don't restock
        lastRestock: Date.now(),
      })
    } else if (existingItem) {
      existingItem.stock = Math.min(existingItem.stock + quantity, existingItem.maxStock * 2)
    }

    // Emit event
    this.world.events.emit('shop:sold', {
      playerId,
      shopId,
      itemId: item.itemId,
      quantity,
      price: totalPrice,
    })

    this.sendMessage(playerId, `You sell ${quantity} ${itemDef.name} for ${totalPrice} coins.`)

    return true
  }

  /**
   * Get value of item at shop
   */
  public getItemValue(shopId: string, itemId: number, buying: boolean): number {
    const shop = this.shops.get(shopId)
    if (!shop) {
      return 0
    }

    const itemDef = this.getItemDefinition(itemId)
    if (!itemDef) {
      return 0
    }

    const basePrice = itemDef.value
    const modifier = buying ? shop.buyModifier : shop.sellModifier

    return Math.floor(basePrice * modifier)
  }

  /**
   * Update shop stock (restock items)
   */
  private updateShopStock(shop: Shop): void {
    const now = Date.now()
    const timeDiff = now - shop.lastUpdate

    if (timeDiff < this.RESTOCK_INTERVAL) {
      return
    }

    const restockTicks = Math.floor(timeDiff / this.RESTOCK_INTERVAL)
    shop.lastUpdate = now

    for (const item of shop.items) {
      if (item.restockRate > 0 && item.stock < item.maxStock) {
        const restockAmount = Math.floor(item.restockRate * restockTicks)
        item.stock = Math.min(item.stock + restockAmount, item.maxStock)
        item.lastRestock = now
      }
    }
  }

  /**
   * Update all shops
   */
  public update(_delta: number): void {
    const now = Date.now()

    // Update shop stocks periodically
    for (const shop of this.shops.values()) {
      if (now - shop.lastUpdate >= this.RESTOCK_INTERVAL) {
        this.updateShopStock(shop)
      }
    }
  }

  /**
   * Get shop stock (handles per-player stock)
   */
  private getShopStock(shop: Shop, playerId: string): ShopItem[] {
    if (!shop.specialStock) {
      return shop.items
    }

    // Get or create per-player stock
    let playerShopMap = this.playerShops.get(playerId)
    if (!playerShopMap) {
      playerShopMap = new Map()
      this.playerShops.set(playerId, playerShopMap)
    }

    let playerStock = playerShopMap.get(shop.id)
    if (!playerStock) {
      // Clone the default stock for this player
      playerStock = shop.items.map(item => ({ ...item }))
      playerShopMap.set(shop.id, playerStock)
    }

    return playerStock
  }

  /**
   * Helper methods
   */
  private findShopNPC(npcId: string): RPGEntity | null {
    // Search for NPC by ID
    const allEntities = this.world.entities.getAll()
    for (const entity of allEntities) {
      const npcComponent = entity.getComponent('npc') as any
      if (npcComponent && npcComponent.npcId.toString() === npcId) {
        return entity as RPGEntity
      }
    }
    return null
  }

  private getDistance(entity1: RPGEntity, entity2: RPGEntity): number {
    const pos1 = entity1.position
    const pos2 = entity2.position

    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z

    return Math.sqrt(dx * dx + dz * dz)
  }

  private getItemDefinition(itemId: number): any {
    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return null
    }

    return inventorySystem.itemRegistry?.getItem(itemId)
  }

  private getPlayerCurrency(inventory: InventoryComponent, currency: string): number {
    if (currency !== 'gp') {
      return 0
    } // Only support GP for now

    let total = 0
    for (const item of inventory.items) {
      if (item && item.itemId === 995) {
        // Coins
        total += item.quantity
      }
    }
    return total
  }

  private removeCurrency(playerId: string, currency: string, amount: number): boolean {
    if (currency !== 'gp') {
      return false
    } // Only support GP for now

    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return false
    }

    return inventorySystem.removeItem(playerId, 995, amount)
  }

  private addCurrency(playerId: string, currency: string, amount: number): boolean {
    if (currency !== 'gp') {
      return false
    } // Only support GP for now

    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return false
    }

    return inventorySystem.addItem(playerId, 995, amount)
  }

  private sendMessage(playerId: string, message: string): void {
    this.world.events.emit('chat:system', {
      targetId: playerId,
      message,
    })
  }

  /**
   * Get shop by ID
   */
  public getShop(shopId: string): Shop | undefined {
    return this.shops.get(shopId)
  }

  /**
   * Get all shops
   */
  public getAllShops(): Shop[] {
    return Array.from(this.shops.values())
  }

  /**
   * Check if player has shop open
   */
  public hasShopOpen(playerId: string): boolean {
    return this.activeSessions.has(playerId)
  }

  /**
   * Get player's open shop
   */
  public getOpenShop(playerId: string): string | null {
    const session = this.activeSessions.get(playerId)
    return session ? session.shopId : null
  }
}
