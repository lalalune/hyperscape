"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
class TradingSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.tradeSessions = new Map();
        this.playerTrades = new Map(); // playerId -> sessionId
        // Configuration
        this.TRADE_TIMEOUT = 300000; // 5 minutes
        this.TRADE_SLOTS = 28; // Same as inventory
        this.MIN_TRADE_DISTANCE = 10; // tiles
    }
    /**
     * Initialize trade request
     */
    requestTrade(requesterId, targetId) {
        // Check if players exist
        const requester = this.world.entities.get(requesterId);
        const target = this.world.entities.get(targetId);
        if (!requester || !target) {
            this.sendTradeMessage(requesterId, 'Player not found.');
            return false;
        }
        // Check if already in trade
        if (this.playerTrades.has(requesterId)) {
            this.sendTradeMessage(requesterId, 'You are already in a trade.');
            return false;
        }
        if (this.playerTrades.has(targetId)) {
            this.sendTradeMessage(requesterId, 'That player is busy.');
            return false;
        }
        // Check distance
        const distance = this.getDistance(requester, target);
        if (distance > this.MIN_TRADE_DISTANCE) {
            this.sendTradeMessage(requesterId, 'You are too far away to trade.');
            return false;
        }
        // Check if target is ironman
        const targetType = target.accountType;
        if (targetType === 'ironman' || targetType === 'hardcore_ironman') {
            this.sendTradeMessage(requesterId, 'That player is an Iron Man and cannot trade.');
            return false;
        }
        // Send trade request
        this.world.events.emit('trade:request', {
            requesterId,
            targetId,
            timestamp: Date.now(),
        });
        this.sendTradeMessage(targetId, `${requester.displayName || 'Player'} wishes to trade with you.`);
        return true;
    }
    /**
     * Accept trade request
     */
    acceptTradeRequest(accepterId, requesterId) {
        // Verify both players are free to trade
        if (this.playerTrades.has(accepterId) || this.playerTrades.has(requesterId)) {
            return false;
        }
        // Create trade session
        const sessionId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
            id: sessionId,
            player1Id: requesterId,
            player2Id: accepterId,
            offer1: {
                playerId: requesterId,
                items: new Array(this.TRADE_SLOTS).fill(null),
                goldAmount: 0,
                accepted: false,
            },
            offer2: {
                playerId: accepterId,
                items: new Array(this.TRADE_SLOTS).fill(null),
                goldAmount: 0,
                accepted: false,
            },
            status: 'first_screen',
            createdAt: Date.now(),
            lastUpdate: Date.now(),
        };
        this.tradeSessions.set(sessionId, session);
        this.playerTrades.set(requesterId, sessionId);
        this.playerTrades.set(accepterId, sessionId);
        // Notify players
        this.world.events.emit('trade:started', {
            sessionId,
            player1Id: requesterId,
            player2Id: accepterId,
        });
        return true;
    }
    /**
     * Add item to trade offer
     */
    offerItem(playerId, inventorySlot, quantity) {
        const sessionId = this.playerTrades.get(playerId);
        if (!sessionId) {
            return false;
        }
        const session = this.tradeSessions.get(sessionId);
        if (!session || session.status !== 'first_screen') {
            return false;
        }
        // Get player's inventory
        const player = this.world.entities.get(playerId);
        const inventory = player?.getComponent('inventory');
        if (!inventory) {
            return false;
        }
        const item = inventory.items[inventorySlot];
        if (!item) {
            return false;
        }
        // Get offer
        const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
        // Find empty slot in trade
        const emptySlot = offer.items.findIndex(item => item === null);
        if (emptySlot === -1) {
            this.sendTradeMessage(playerId, 'Your trade offer is full.');
            return false;
        }
        // Calculate quantity
        const offerQuantity = Math.min(quantity || item.quantity, item.quantity);
        // Check if item is tradeable
        const itemDef = this.getItemDefinition(item.itemId);
        if (!itemDef || !itemDef.tradeable) {
            this.sendTradeMessage(playerId, 'This item cannot be traded.');
            return false;
        }
        // Add to offer
        offer.items[emptySlot] = {
            itemId: item.itemId,
            quantity: offerQuantity,
        };
        // Reset acceptances
        session.offer1.accepted = false;
        session.offer2.accepted = false;
        session.lastUpdate = Date.now();
        // Notify both players
        this.notifyTradeUpdate(session);
        return true;
    }
    /**
     * Remove item from trade offer
     */
    removeOfferItem(playerId, tradeSlot) {
        const sessionId = this.playerTrades.get(playerId);
        if (!sessionId) {
            return false;
        }
        const session = this.tradeSessions.get(sessionId);
        if (!session || session.status !== 'first_screen') {
            return false;
        }
        const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
        if (!offer.items[tradeSlot]) {
            return false;
        }
        // Remove item
        offer.items[tradeSlot] = null;
        // Reset acceptances
        session.offer1.accepted = false;
        session.offer2.accepted = false;
        session.lastUpdate = Date.now();
        // Notify both players
        this.notifyTradeUpdate(session);
        return true;
    }
    /**
     * Accept current trade screen
     */
    acceptTrade(playerId) {
        const sessionId = this.playerTrades.get(playerId);
        if (!sessionId) {
            return false;
        }
        const session = this.tradeSessions.get(sessionId);
        if (!session) {
            return false;
        }
        if (session.status === 'first_screen') {
            // Accept first screen
            const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
            offer.accepted = true;
            // Check if both accepted
            if (session.offer1.accepted && session.offer2.accepted) {
                // Move to second screen
                session.status = 'second_screen';
                session.offer1.accepted = false;
                session.offer2.accepted = false;
                session.lastUpdate = Date.now();
                this.world.events.emit('trade:second_screen', {
                    sessionId: session.id,
                });
            }
        }
        else if (session.status === 'second_screen') {
            // Accept second screen
            const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
            offer.accepted = true;
            // Check if both accepted
            if (session.offer1.accepted && session.offer2.accepted) {
                // Complete trade
                return this.completeTrade(session);
            }
        }
        this.notifyTradeUpdate(session);
        return true;
    }
    /**
     * Cancel trade
     */
    cancelTrade(playerId) {
        const sessionId = this.playerTrades.get(playerId);
        if (!sessionId) {
            return false;
        }
        const session = this.tradeSessions.get(sessionId);
        if (!session) {
            return false;
        }
        // Clean up
        this.playerTrades.delete(session.player1Id);
        this.playerTrades.delete(session.player2Id);
        this.tradeSessions.delete(sessionId);
        // Notify players
        this.world.events.emit('trade:cancelled', {
            sessionId: session.id,
            cancelledBy: playerId,
        });
        this.sendTradeMessage(session.player1Id, 'Trade cancelled.');
        this.sendTradeMessage(session.player2Id, 'Trade cancelled.');
        return true;
    }
    /**
     * Complete the trade
     */
    completeTrade(session) {
        const player1 = this.world.entities.get(session.player1Id);
        const player2 = this.world.entities.get(session.player2Id);
        if (!player1 || !player2) {
            this.cancelTrade(session.player1Id);
            return false;
        }
        // Verify both players have space
        if (!this.verifyTradeSpace(player1, session.offer2) || !this.verifyTradeSpace(player2, session.offer1)) {
            this.sendTradeMessage(session.player1Id, 'Not enough inventory space.');
            this.sendTradeMessage(session.player2Id, 'Not enough inventory space.');
            return false;
        }
        // Verify both players have the items
        if (!this.verifyTradeItems(player1, session.offer1) || !this.verifyTradeItems(player2, session.offer2)) {
            this.sendTradeMessage(session.player1Id, 'Trade items no longer available.');
            this.sendTradeMessage(session.player2Id, 'Trade items no longer available.');
            this.cancelTrade(session.player1Id);
            return false;
        }
        // Exchange items
        this.exchangeItems(player1, player2, session.offer1, session.offer2);
        // Clean up
        this.playerTrades.delete(session.player1Id);
        this.playerTrades.delete(session.player2Id);
        this.tradeSessions.delete(session.id);
        // Notify completion
        this.world.events.emit('trade:completed', {
            sessionId: session.id,
            player1Id: session.player1Id,
            player2Id: session.player2Id,
        });
        this.sendTradeMessage(session.player1Id, 'Trade successful.');
        this.sendTradeMessage(session.player2Id, 'Trade successful.');
        return true;
    }
    /**
     * Verify player has space for incoming items
     */
    verifyTradeSpace(player, incomingOffer) {
        const inventory = player.getComponent('inventory');
        if (!inventory) {
            return false;
        }
        // Count empty slots
        const emptySlots = inventory.items.filter(item => item === null).length;
        // Count incoming non-stackable items
        let requiredSlots = 0;
        for (const item of incomingOffer.items) {
            if (!item) {
                continue;
            }
            const itemDef = this.getItemDefinition(item.itemId);
            if (!itemDef) {
                continue;
            }
            if (!itemDef.stackable) {
                requiredSlots++;
            }
            else {
                // Check if we already have this stackable
                const existing = inventory.items.find(i => i?.itemId === item.itemId);
                if (!existing) {
                    requiredSlots++;
                }
            }
        }
        return emptySlots >= requiredSlots;
    }
    /**
     * Verify player has the items they're offering
     */
    verifyTradeItems(player, offer) {
        const inventory = player.getComponent('inventory');
        if (!inventory) {
            return false;
        }
        // Check each offered item
        for (const offeredItem of offer.items) {
            if (!offeredItem) {
                continue;
            }
            let found = 0;
            for (const invItem of inventory.items) {
                if (invItem?.itemId === offeredItem.itemId) {
                    found += invItem.quantity;
                }
            }
            if (found < offeredItem.quantity) {
                return false;
            }
        }
        return true;
    }
    /**
     * Exchange items between players
     */
    exchangeItems(player1, player2, offer1, offer2) {
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return;
        }
        // Remove items from player1 and give to player2
        for (const item of offer1.items) {
            if (!item) {
                continue;
            }
            inventorySystem.removeItem(player1.id, item.itemId, item.quantity);
            inventorySystem.addItem(player2.id, item.itemId, item.quantity);
        }
        // Remove items from player2 and give to player1
        for (const item of offer2.items) {
            if (!item) {
                continue;
            }
            inventorySystem.removeItem(player2.id, item.itemId, item.quantity);
            inventorySystem.addItem(player1.id, item.itemId, item.quantity);
        }
    }
    /**
     * Update loop - clean up expired trades
     */
    update(_delta) {
        const now = Date.now();
        for (const [_sessionId, session] of this.tradeSessions) {
            if (now - session.lastUpdate > this.TRADE_TIMEOUT) {
                this.cancelTrade(session.player1Id);
            }
        }
    }
    /**
     * Helper methods
     */
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
    sendTradeMessage(playerId, message) {
        this.world.events.emit('chat:system', {
            playerId,
            message,
            type: 'trade',
        });
    }
    notifyTradeUpdate(session) {
        this.world.events.emit('trade:updated', {
            sessionId: session.id,
            status: session.status,
            offer1: session.offer1,
            offer2: session.offer2,
        });
    }
    /**
     * Get active trade session for player
     */
    getTradeSession(playerId) {
        const sessionId = this.playerTrades.get(playerId);
        if (!sessionId) {
            return null;
        }
        return this.tradeSessions.get(sessionId) || null;
    }
    /**
     * Check if player is in trade
     */
    isTrading(playerId) {
        return this.playerTrades.has(playerId);
    }
}
exports.TradingSystem = TradingSystem;
//# sourceMappingURL=TradingSystem.js.map