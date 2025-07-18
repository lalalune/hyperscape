"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
class ShopSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.shops = new Map();
        this.playerShops = new Map(); // For per-player stock
        this.activeSessions = new Map();
        // Configuration
        this.RESTOCK_INTERVAL = 60000; // 1 minute
        this.DEFAULT_BUY_MODIFIER = 1.0;
        this.DEFAULT_SELL_MODIFIER = 0.4; // 40% of item value
        this.GENERAL_STORE_ID = 'general_store';
        this.registerDefaultShops();
    }
    /**
     * Register default shops
     */
    registerDefaultShops() {
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
        });
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
        });
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
        });
    }
    /**
     * Register a shop
     */
    registerShop(shop) {
        this.shops.set(shop.id, shop);
    }
    /**
     * Open shop for player
     */
    openShop(playerId, shopId) {
        const player = this.world.entities.get(playerId);
        if (!player) {
            return false;
        }
        const shop = this.shops.get(shopId);
        if (!shop) {
            return false;
        }
        // Check if shop NPC exists and is nearby
        const shopNPC = this.findShopNPC(shop.npcId);
        if (shopNPC) {
            const distance = this.getDistance(player, shopNPC);
            if (distance > 5) {
                this.sendMessage(playerId, 'You are too far away from the shop.');
                return false;
            }
        }
        // Create session
        const session = {
            playerId,
            shopId,
            startTime: Date.now(),
        };
        this.activeSessions.set(playerId, session);
        // Update stock
        this.updateShopStock(shop);
        // Get current stock (per-player or global)
        const stock = this.getShopStock(shop, playerId);
        // Emit event
        this.world.events.emit('shop:opened', {
            playerId,
            shopId,
            shopName: shop.name,
            stock,
            buyModifier: shop.buyModifier,
            sellModifier: shop.sellModifier,
        });
        return true;
    }
    /**
     * Close shop
     */
    closeShop(playerId) {
        const session = this.activeSessions.get(playerId);
        if (!session) {
            return;
        }
        this.activeSessions.delete(playerId);
        this.world.events.emit('shop:closed', {
            playerId,
            shopId: session.shopId,
        });
    }
    /**
     * Buy item from shop
     */
    buyItem(playerId, shopId, itemIndex, quantity = 1) {
        const session = this.activeSessions.get(playerId);
        if (!session || session.shopId !== shopId) {
            return false;
        }
        const shop = this.shops.get(shopId);
        if (!shop) {
            return false;
        }
        const player = this.world.entities.get(playerId);
        if (!player) {
            return false;
        }
        // Get current stock
        const stock = this.getShopStock(shop, playerId);
        if (itemIndex < 0 || itemIndex >= stock.length) {
            return false;
        }
        const shopItem = stock[itemIndex];
        if (!shopItem || shopItem.stock < quantity) {
            this.sendMessage(playerId, "The shop doesn't have that many in stock.");
            return false;
        }
        // Calculate price
        const itemDef = this.getItemDefinition(shopItem.itemId);
        if (!itemDef) {
            return false;
        }
        const basePrice = shopItem.customPrice || itemDef.value;
        const totalPrice = Math.floor(basePrice * shop.buyModifier * quantity);
        // Check if player has enough money
        const inventory = player.getComponent('inventory');
        if (!inventory) {
            return false;
        }
        const playerGold = this.getPlayerCurrency(inventory, shop.currency);
        if (playerGold < totalPrice) {
            this.sendMessage(playerId, "You don't have enough coins.");
            return false;
        }
        // Check inventory space
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        const hasSpace = inventorySystem.hasSpace(playerId, shopItem.itemId, quantity);
        if (!hasSpace) {
            this.sendMessage(playerId, "You don't have enough inventory space.");
            return false;
        }
        // Remove currency
        if (!this.removeCurrency(playerId, shop.currency, totalPrice)) {
            return false;
        }
        // Add item
        inventorySystem.addItem(playerId, shopItem.itemId, quantity);
        // Update stock
        shopItem.stock -= quantity;
        // Emit event
        this.world.events.emit('shop:bought', {
            playerId,
            shopId,
            itemId: shopItem.itemId,
            quantity,
            price: totalPrice,
        });
        this.sendMessage(playerId, `You buy ${quantity} ${itemDef.name} for ${totalPrice} coins.`);
        return true;
    }
    /**
     * Sell item to shop
     */
    sellItem(playerId, shopId, inventorySlot, quantity = 1) {
        const session = this.activeSessions.get(playerId);
        if (!session || session.shopId !== shopId) {
            return false;
        }
        const shop = this.shops.get(shopId);
        if (!shop) {
            return false;
        }
        const player = this.world.entities.get(playerId);
        if (!player) {
            return false;
        }
        const inventory = player.getComponent('inventory');
        if (!inventory) {
            return false;
        }
        const item = inventory.items[inventorySlot];
        if (!item || item.quantity < quantity) {
            return false;
        }
        // Get item definition
        const itemDef = this.getItemDefinition(item.itemId);
        if (!itemDef) {
            return false;
        }
        // Check if item can be sold
        if (!itemDef.tradeable) {
            this.sendMessage(playerId, "You can't sell this item.");
            return false;
        }
        // Calculate price
        const basePrice = itemDef.value;
        const totalPrice = Math.floor(basePrice * shop.sellModifier * quantity);
        // Check if shop accepts this item
        const shopStock = this.getShopStock(shop, playerId);
        const existingItem = shopStock.find(si => si.itemId === item.itemId);
        // General stores accept everything, specialist shops only their items
        if (shop.id !== this.GENERAL_STORE_ID && !existingItem) {
            this.sendMessage(playerId, "This shop doesn't buy that type of item.");
            return false;
        }
        // Remove item from inventory
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        if (!inventorySystem.removeItem(playerId, inventorySlot, quantity)) {
            return false;
        }
        // Add currency
        this.addCurrency(playerId, shop.currency, totalPrice);
        // Update shop stock if it's a general store
        if (shop.id === this.GENERAL_STORE_ID && !existingItem) {
            shopStock.push({
                itemId: item.itemId,
                stock: quantity,
                maxStock: quantity,
                restockRate: -1, // Sold items don't restock
                lastRestock: Date.now(),
            });
        }
        else if (existingItem) {
            existingItem.stock = Math.min(existingItem.stock + quantity, existingItem.maxStock * 2);
        }
        // Emit event
        this.world.events.emit('shop:sold', {
            playerId,
            shopId,
            itemId: item.itemId,
            quantity,
            price: totalPrice,
        });
        this.sendMessage(playerId, `You sell ${quantity} ${itemDef.name} for ${totalPrice} coins.`);
        return true;
    }
    /**
     * Get value of item at shop
     */
    getItemValue(shopId, itemId, buying) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            return 0;
        }
        const itemDef = this.getItemDefinition(itemId);
        if (!itemDef) {
            return 0;
        }
        const basePrice = itemDef.value;
        const modifier = buying ? shop.buyModifier : shop.sellModifier;
        return Math.floor(basePrice * modifier);
    }
    /**
     * Update shop stock (restock items)
     */
    updateShopStock(shop) {
        const now = Date.now();
        const timeDiff = now - shop.lastUpdate;
        if (timeDiff < this.RESTOCK_INTERVAL) {
            return;
        }
        const restockTicks = Math.floor(timeDiff / this.RESTOCK_INTERVAL);
        shop.lastUpdate = now;
        for (const item of shop.items) {
            if (item.restockRate > 0 && item.stock < item.maxStock) {
                const restockAmount = Math.floor(item.restockRate * restockTicks);
                item.stock = Math.min(item.stock + restockAmount, item.maxStock);
                item.lastRestock = now;
            }
        }
    }
    /**
     * Update all shops
     */
    update(_delta) {
        const now = Date.now();
        // Update shop stocks periodically
        for (const shop of this.shops.values()) {
            if (now - shop.lastUpdate >= this.RESTOCK_INTERVAL) {
                this.updateShopStock(shop);
            }
        }
    }
    /**
     * Get shop stock (handles per-player stock)
     */
    getShopStock(shop, playerId) {
        if (!shop.specialStock) {
            return shop.items;
        }
        // Get or create per-player stock
        let playerShopMap = this.playerShops.get(playerId);
        if (!playerShopMap) {
            playerShopMap = new Map();
            this.playerShops.set(playerId, playerShopMap);
        }
        let playerStock = playerShopMap.get(shop.id);
        if (!playerStock) {
            // Clone the default stock for this player
            playerStock = shop.items.map(item => ({ ...item }));
            playerShopMap.set(shop.id, playerStock);
        }
        return playerStock;
    }
    /**
     * Helper methods
     */
    findShopNPC(npcId) {
        // Search for NPC by ID
        const allEntities = this.world.entities.getAll();
        for (const entity of allEntities) {
            const npcComponent = entity.getComponent('npc');
            if (npcComponent && npcComponent.npcId.toString() === npcId) {
                return entity;
            }
        }
        return null;
    }
    getDistance(entity1, entity2) {
        const pos1 = entity1.position;
        const pos2 = entity2.position;
        const dx = pos1.x - pos2.x;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    getItemDefinition(itemId) {
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return null;
        }
        return inventorySystem.itemRegistry?.getItem(itemId);
    }
    getPlayerCurrency(inventory, currency) {
        if (currency !== 'gp') {
            return 0;
        } // Only support GP for now
        let total = 0;
        for (const item of inventory.items) {
            if (item && item.itemId === 995) {
                // Coins
                total += item.quantity;
            }
        }
        return total;
    }
    removeCurrency(playerId, currency, amount) {
        if (currency !== 'gp') {
            return false;
        } // Only support GP for now
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        return inventorySystem.removeItem(playerId, 995, amount);
    }
    addCurrency(playerId, currency, amount) {
        if (currency !== 'gp') {
            return false;
        } // Only support GP for now
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        return inventorySystem.addItem(playerId, 995, amount);
    }
    sendMessage(playerId, message) {
        this.world.events.emit('chat:system', {
            targetId: playerId,
            message,
        });
    }
    /**
     * Get shop by ID
     */
    getShop(shopId) {
        return this.shops.get(shopId);
    }
    /**
     * Get all shops
     */
    getAllShops() {
        return Array.from(this.shops.values());
    }
    /**
     * Check if player has shop open
     */
    hasShopOpen(playerId) {
        return this.activeSessions.has(playerId);
    }
    /**
     * Get player's open shop
     */
    getOpenShop(playerId) {
        const session = this.activeSessions.get(playerId);
        return session ? session.shopId : null;
    }
}
exports.ShopSystem = ShopSystem;
//# sourceMappingURL=ShopSystem.js.map