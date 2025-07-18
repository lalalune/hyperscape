import { System } from '@hyperfy/sdk';
import type { World } from '../types';
export interface ShopItem {
    itemId: number;
    stock: number;
    maxStock: number;
    restockRate: number;
    lastRestock: number;
    customPrice?: number;
}
export interface Shop {
    id: string;
    name: string;
    npcId: string;
    items: ShopItem[];
    currency: 'gp' | 'tokkul' | 'custom';
    buyModifier: number;
    sellModifier: number;
    specialStock: boolean;
    lastUpdate: number;
}
export interface PlayerShopSession {
    playerId: string;
    shopId: string;
    startTime: number;
}
export declare class ShopSystem extends System {
    private shops;
    private playerShops;
    private activeSessions;
    private readonly RESTOCK_INTERVAL;
    private readonly DEFAULT_BUY_MODIFIER;
    private readonly DEFAULT_SELL_MODIFIER;
    private readonly GENERAL_STORE_ID;
    constructor(world: World);
    /**
     * Register default shops
     */
    private registerDefaultShops;
    /**
     * Register a shop
     */
    registerShop(shop: Shop): void;
    /**
     * Open shop for player
     */
    openShop(playerId: string, shopId: string): boolean;
    /**
     * Close shop
     */
    closeShop(playerId: string): void;
    /**
     * Buy item from shop
     */
    buyItem(playerId: string, shopId: string, itemIndex: number, quantity?: number): boolean;
    /**
     * Sell item to shop
     */
    sellItem(playerId: string, shopId: string, inventorySlot: number, quantity?: number): boolean;
    /**
     * Get value of item at shop
     */
    getItemValue(shopId: string, itemId: number, buying: boolean): number;
    /**
     * Update shop stock (restock items)
     */
    private updateShopStock;
    /**
     * Update all shops
     */
    update(_delta: number): void;
    /**
     * Get shop stock (handles per-player stock)
     */
    private getShopStock;
    /**
     * Helper methods
     */
    private findShopNPC;
    private getDistance;
    private getItemDefinition;
    private getPlayerCurrency;
    private removeCurrency;
    private addCurrency;
    private sendMessage;
    /**
     * Get shop by ID
     */
    getShop(shopId: string): Shop | undefined;
    /**
     * Get all shops
     */
    getAllShops(): Shop[];
    /**
     * Check if player has shop open
     */
    hasShopOpen(playerId: string): boolean;
    /**
     * Get player's open shop
     */
    getOpenShop(playerId: string): string | null;
}
//# sourceMappingURL=ShopSystem.d.ts.map