import { System } from '@hyperfy/sdk'
import type { World } from '../types'
import { RPGEntity, ItemStack, InventoryComponent } from '../types/index'

export interface TradeOffer {
  playerId: string
  items: (ItemStack | null)[]
  goldAmount: number
  accepted: boolean
}

export interface TradeSession {
  id: string
  player1Id: string
  player2Id: string
  offer1: TradeOffer
  offer2: TradeOffer
  status: 'pending' | 'first_screen' | 'second_screen' | 'completed' | 'cancelled'
  createdAt: number
  lastUpdate: number
}

export class TradingSystem extends System {
  private tradeSessions: Map<string, TradeSession> = new Map()
  private playerTrades: Map<string, string> = new Map() // playerId -> sessionId

  // Configuration
  private readonly TRADE_TIMEOUT = 300000 // 5 minutes
  private readonly TRADE_SLOTS = 28 // Same as inventory
  private readonly MIN_TRADE_DISTANCE = 10 // tiles

  constructor(world: World) {
    super(world)
  }

  /**
   * Initialize trade request
   */
  public requestTrade(requesterId: string, targetId: string): boolean {
    // Check if players exist
    const requester = this.world.entities.get(requesterId)
    const target = this.world.entities.get(targetId)

    if (!requester || !target) {
      this.sendTradeMessage(requesterId, 'Player not found.')
      return false
    }

    // Check if already in trade
    if (this.playerTrades.has(requesterId)) {
      this.sendTradeMessage(requesterId, 'You are already in a trade.')
      return false
    }

    if (this.playerTrades.has(targetId)) {
      this.sendTradeMessage(requesterId, 'That player is busy.')
      return false
    }

    // Check distance
    const distance = this.getDistance(requester as any, target as any)
    if (distance > this.MIN_TRADE_DISTANCE) {
      this.sendTradeMessage(requesterId, 'You are too far away to trade.')
      return false
    }

    // Check if target is ironman
    const targetType = (target as any).accountType
    if (targetType === 'ironman' || targetType === 'hardcore_ironman') {
      this.sendTradeMessage(requesterId, 'That player is an Iron Man and cannot trade.')
      return false
    }

    // Send trade request
    this.world.events.emit('trade:request', {
      requesterId,
      targetId,
      timestamp: Date.now(),
    })

    this.sendTradeMessage(targetId, `${(requester as any).displayName || 'Player'} wishes to trade with you.`)

    return true
  }

  /**
   * Accept trade request
   */
  public acceptTradeRequest(accepterId: string, requesterId: string): boolean {
    // Verify both players are free to trade
    if (this.playerTrades.has(accepterId) || this.playerTrades.has(requesterId)) {
      return false
    }

    // Create trade session
    const sessionId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: TradeSession = {
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
    }

    this.tradeSessions.set(sessionId, session)
    this.playerTrades.set(requesterId, sessionId)
    this.playerTrades.set(accepterId, sessionId)

    // Notify players
    this.world.events.emit('trade:started', {
      sessionId,
      player1Id: requesterId,
      player2Id: accepterId,
    })

    return true
  }

  /**
   * Add item to trade offer
   */
  public offerItem(playerId: string, inventorySlot: number, quantity?: number): boolean {
    const sessionId = this.playerTrades.get(playerId)
    if (!sessionId) {
      return false
    }

    const session = this.tradeSessions.get(sessionId)
    if (!session || session.status !== 'first_screen') {
      return false
    }

    // Get player's inventory
    const player = this.world.entities.get(playerId)
    const inventory = player?.getComponent('inventory')
    if (!inventory) {
      return false
    }

    const item = (inventory as any).items[inventorySlot]
    if (!item) {
      return false
    }

    // Get offer
    const offer = session.player1Id === playerId ? session.offer1 : session.offer2

    // Find empty slot in trade
    const emptySlot = offer.items.findIndex(item => item === null)
    if (emptySlot === -1) {
      this.sendTradeMessage(playerId, 'Your trade offer is full.')
      return false
    }

    // Calculate quantity
    const offerQuantity = Math.min(quantity || item.quantity, item.quantity)

    // Check if item is tradeable
    const itemDef = this.getItemDefinition(item.itemId)
    if (!itemDef || !itemDef.tradeable) {
      this.sendTradeMessage(playerId, 'This item cannot be traded.')
      return false
    }

    // Add to offer
    offer.items[emptySlot] = {
      itemId: item.itemId,
      quantity: offerQuantity,
    }

    // Reset acceptances
    session.offer1.accepted = false
    session.offer2.accepted = false
    session.lastUpdate = Date.now()

    // Notify both players
    this.notifyTradeUpdate(session)

    return true
  }

  /**
   * Remove item from trade offer
   */
  public removeOfferItem(playerId: string, tradeSlot: number): boolean {
    const sessionId = this.playerTrades.get(playerId)
    if (!sessionId) {
      return false
    }

    const session = this.tradeSessions.get(sessionId)
    if (!session || session.status !== 'first_screen') {
      return false
    }

    const offer = session.player1Id === playerId ? session.offer1 : session.offer2

    if (!offer.items[tradeSlot]) {
      return false
    }

    // Remove item
    offer.items[tradeSlot] = null

    // Reset acceptances
    session.offer1.accepted = false
    session.offer2.accepted = false
    session.lastUpdate = Date.now()

    // Notify both players
    this.notifyTradeUpdate(session)

    return true
  }

  /**
   * Accept current trade screen
   */
  public acceptTrade(playerId: string): boolean {
    const sessionId = this.playerTrades.get(playerId)
    if (!sessionId) {
      return false
    }

    const session = this.tradeSessions.get(sessionId)
    if (!session) {
      return false
    }

    if (session.status === 'first_screen') {
      // Accept first screen
      const offer = session.player1Id === playerId ? session.offer1 : session.offer2
      offer.accepted = true

      // Check if both accepted
      if (session.offer1.accepted && session.offer2.accepted) {
        // Move to second screen
        session.status = 'second_screen'
        session.offer1.accepted = false
        session.offer2.accepted = false
        session.lastUpdate = Date.now()

        this.world.events.emit('trade:second_screen', {
          sessionId: session.id,
        })
      }
    } else if (session.status === 'second_screen') {
      // Accept second screen
      const offer = session.player1Id === playerId ? session.offer1 : session.offer2
      offer.accepted = true

      // Check if both accepted
      if (session.offer1.accepted && session.offer2.accepted) {
        // Complete trade
        return this.completeTrade(session)
      }
    }

    this.notifyTradeUpdate(session)
    return true
  }

  /**
   * Cancel trade
   */
  public cancelTrade(playerId: string): boolean {
    const sessionId = this.playerTrades.get(playerId)
    if (!sessionId) {
      return false
    }

    const session = this.tradeSessions.get(sessionId)
    if (!session) {
      return false
    }

    // Clean up
    this.playerTrades.delete(session.player1Id)
    this.playerTrades.delete(session.player2Id)
    this.tradeSessions.delete(sessionId)

    // Notify players
    this.world.events.emit('trade:cancelled', {
      sessionId: session.id,
      cancelledBy: playerId,
    })

    this.sendTradeMessage(session.player1Id, 'Trade cancelled.')
    this.sendTradeMessage(session.player2Id, 'Trade cancelled.')

    return true
  }

  /**
   * Complete the trade
   */
  private completeTrade(session: TradeSession): boolean {
    const player1 = this.world.entities.get(session.player1Id)
    const player2 = this.world.entities.get(session.player2Id)

    if (!player1 || !player2) {
      this.cancelTrade(session.player1Id)
      return false
    }

    // Verify both players have space
    if (!this.verifyTradeSpace(player1 as any, session.offer2 as any) || !this.verifyTradeSpace(player2 as any, session.offer1 as any)) {
      this.sendTradeMessage(session.player1Id, 'Not enough inventory space.')
      this.sendTradeMessage(session.player2Id, 'Not enough inventory space.')
      return false
    }

    // Verify both players have the items
    if (!this.verifyTradeItems(player1 as any, session.offer1 as any) || !this.verifyTradeItems(player2 as any, session.offer2 as any)) {
      this.sendTradeMessage(session.player1Id, 'Trade items no longer available.')
      this.sendTradeMessage(session.player2Id, 'Trade items no longer available.')
      this.cancelTrade(session.player1Id)
      return false
    }

    // Exchange items
    this.exchangeItems(player1 as any, player2 as any, session.offer1, session.offer2)

    // Clean up
    this.playerTrades.delete(session.player1Id)
    this.playerTrades.delete(session.player2Id)
    this.tradeSessions.delete(session.id)

    // Notify completion
    this.world.events.emit('trade:completed', {
      sessionId: session.id,
      player1Id: session.player1Id,
      player2Id: session.player2Id,
    })

    this.sendTradeMessage(session.player1Id, 'Trade successful.')
    this.sendTradeMessage(session.player2Id, 'Trade successful.')

    return true
  }

  /**
   * Verify player has space for incoming items
   */
  private verifyTradeSpace(player: RPGEntity, incomingOffer: TradeOffer): boolean {
    const inventory = player.getComponent('inventory') as any
    if (!inventory) {
      return false
    }

    // Count empty slots
    const emptySlots = inventory.items.filter(item => item === null).length

    // Count incoming non-stackable items
    let requiredSlots = 0
    for (const item of incomingOffer.items) {
      if (!item) {
        continue
      }

      const itemDef = this.getItemDefinition(item.itemId)
      if (!itemDef) {
        continue
      }

      if (!itemDef.stackable) {
        requiredSlots++
      } else {
        // Check if we already have this stackable
        const existing = inventory.items.find(i => i?.itemId === item.itemId)
        if (!existing) {
          requiredSlots++
        }
      }
    }

    return emptySlots >= requiredSlots
  }

  /**
   * Verify player has the items they're offering
   */
  private verifyTradeItems(player: RPGEntity, offer: TradeOffer): boolean {
    const inventory = player.getComponent('inventory') as any
    if (!inventory) {
      return false
    }

    // Check each offered item
    for (const offeredItem of offer.items) {
      if (!offeredItem) {
        continue
      }

      let found = 0
      for (const invItem of inventory.items) {
        if (invItem?.itemId === offeredItem.itemId) {
          found += invItem.quantity
        }
      }

      if (found < offeredItem.quantity) {
        return false
      }
    }

    return true
  }

  /**
   * Exchange items between players
   */
  private exchangeItems(player1: RPGEntity, player2: RPGEntity, offer1: TradeOffer, offer2: TradeOffer): void {
    const inventorySystem = this.world.getSystem<any>('inventory')
    if (!inventorySystem) {
      return
    }

    // Remove items from player1 and give to player2
    for (const item of offer1.items) {
      if (!item) {
        continue
      }
      inventorySystem.removeItem(player1.id, item.itemId, item.quantity)
      inventorySystem.addItem(player2.id, item.itemId, item.quantity)
    }

    // Remove items from player2 and give to player1
    for (const item of offer2.items) {
      if (!item) {
        continue
      }
      inventorySystem.removeItem(player2.id, item.itemId, item.quantity)
      inventorySystem.addItem(player1.id, item.itemId, item.quantity)
    }
  }

  /**
   * Update loop - clean up expired trades
   */
  public update(_delta: number): void {
    const now = Date.now()

    for (const [_sessionId, session] of this.tradeSessions) {
      if (now - session.lastUpdate > this.TRADE_TIMEOUT) {
        this.cancelTrade(session.player1Id)
      }
    }
  }

  /**
   * Helper methods
   */
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

  private sendTradeMessage(playerId: string, message: string): void {
    this.world.events.emit('chat:system', {
      playerId,
      message,
      type: 'trade',
    })
  }

  private notifyTradeUpdate(session: TradeSession): void {
    this.world.events.emit('trade:updated', {
      sessionId: session.id,
      status: session.status,
      offer1: session.offer1,
      offer2: session.offer2,
    })
  }

  /**
   * Get active trade session for player
   */
  public getTradeSession(playerId: string): TradeSession | null {
    const sessionId = this.playerTrades.get(playerId)
    if (!sessionId) {
      return null
    }

    return this.tradeSessions.get(sessionId) || null
  }

  /**
   * Check if player is in trade
   */
  public isTrading(playerId: string): boolean {
    return this.playerTrades.has(playerId)
  }
}
