import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import { ItemStack } from '../types/index';
export interface TradeOffer {
    playerId: string;
    items: (ItemStack | null)[];
    goldAmount: number;
    accepted: boolean;
}
export interface TradeSession {
    id: string;
    player1Id: string;
    player2Id: string;
    offer1: TradeOffer;
    offer2: TradeOffer;
    status: 'pending' | 'first_screen' | 'second_screen' | 'completed' | 'cancelled';
    createdAt: number;
    lastUpdate: number;
}
export declare class TradingSystem extends System {
    private tradeSessions;
    private playerTrades;
    private readonly TRADE_TIMEOUT;
    private readonly TRADE_SLOTS;
    private readonly MIN_TRADE_DISTANCE;
    constructor(world: World);
    /**
     * Initialize trade request
     */
    requestTrade(requesterId: string, targetId: string): boolean;
    /**
     * Accept trade request
     */
    acceptTradeRequest(accepterId: string, requesterId: string): boolean;
    /**
     * Add item to trade offer
     */
    offerItem(playerId: string, inventorySlot: number, quantity?: number): boolean;
    /**
     * Remove item from trade offer
     */
    removeOfferItem(playerId: string, tradeSlot: number): boolean;
    /**
     * Accept current trade screen
     */
    acceptTrade(playerId: string): boolean;
    /**
     * Cancel trade
     */
    cancelTrade(playerId: string): boolean;
    /**
     * Complete the trade
     */
    private completeTrade;
    /**
     * Verify player has space for incoming items
     */
    private verifyTradeSpace;
    /**
     * Verify player has the items they're offering
     */
    private verifyTradeItems;
    /**
     * Exchange items between players
     */
    private exchangeItems;
    /**
     * Update loop - clean up expired trades
     */
    update(_delta: number): void;
    /**
     * Helper methods
     */
    private getDistance;
    private getItemDefinition;
    private sendTradeMessage;
    private notifyTradeUpdate;
    /**
     * Get active trade session for player
     */
    getTradeSession(playerId: string): TradeSession | null;
    /**
     * Check if player is in trade
     */
    isTrading(playerId: string): boolean;
}
//# sourceMappingURL=TradingSystem.d.ts.map