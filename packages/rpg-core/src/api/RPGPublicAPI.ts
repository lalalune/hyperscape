import { World } from '@hyperfy/sdk'
import { RPGWorldManager } from '../world/RPGWorldManager'
import { Vector3 } from '../types'

/**
 * Public API for interacting with the RPG plugin
 * This provides a clean interface for external code to interact with RPG systems
 */
export class RPGPublicAPI {
  private world: World
  private systems: Map<string, any>
  private worldManager: RPGWorldManager
  
  constructor(world: World, systems: Map<string, any>, worldManager: RPGWorldManager) {
    this.world = world
    this.systems = systems
    this.worldManager = worldManager
  }
  
  /**
   * Player Management
   */
  
  async spawnPlayer(playerId: string, options?: {
    position?: Vector3
    username?: string
    stats?: any
  }): Promise<string> {
    const spawningSystem = this.systems.get('spawning')
    if (!spawningSystem) throw new Error('Spawning system not initialized')
    
    return await spawningSystem.spawnPlayer(playerId, options)
  }
  
  getPlayer(playerId: string): any {
    return this.world.entities.items.get(playerId)
  }
  
  movePlayer(playerId: string, destination: Vector3): boolean {
    const movementSystem = this.systems.get('movement')
    if (!movementSystem) return false
    
    return movementSystem.moveEntity(playerId, destination)
  }
  
  /**
   * NPC Management
   */
  
  spawnNPC(npcType: string, options?: {
    position?: Vector3
    behavior?: string
    spawnerId?: string
  }): Promise<string> {
    const npcSystem = this.systems.get('npc')
    if (!npcSystem) throw new Error('NPC system not initialized')
    
    return npcSystem.spawnNPC(npcType, options)
  }
  
  getNPC(npcId: string): any {
    return this.world.entities.items.get(npcId)
  }
  
  /**
   * Combat
   */
  
  startCombat(attackerId: string, targetId: string): boolean {
    const combatSystem = this.systems.get('combat')
    if (!combatSystem) return false
    
    return combatSystem.startCombat(attackerId, targetId)
  }
  
  stopCombat(entityId: string): boolean {
    const combatSystem = this.systems.get('combat')
    if (!combatSystem) return false
    
    return combatSystem.stopCombat(entityId)
  }
  
  /**
   * Inventory & Items
   */
  
  giveItem(playerId: string, itemId: number, quantity: number = 1): boolean {
    const inventorySystem = this.systems.get('inventory')
    if (!inventorySystem) return false
    
    return inventorySystem.addItem(playerId, itemId, quantity)
  }
  
  removeItem(playerId: string, itemId: number, quantity: number = 1): boolean {
    const inventorySystem = this.systems.get('inventory')
    if (!inventorySystem) return false
    
    return inventorySystem.removeItem(playerId, itemId, quantity)
  }
  
  getInventory(playerId: string): any[] {
    const inventorySystem = this.systems.get('inventory')
    if (!inventorySystem) return []
    
    return inventorySystem.getInventory(playerId)
  }
  
  dropItem(position: Vector3, itemId: number, quantity: number = 1, owner?: string): string | null {
    const lootSystem = this.systems.get('loot')
    if (!lootSystem) return null
    
    return lootSystem.dropItem(position, itemId, quantity, owner)
  }
  
  /**
   * Banking
   */
  
  openBank(playerId: string): boolean {
    const bankingSystem = this.systems.get('banking')
    if (!bankingSystem) return false
    
    return bankingSystem.openBank(playerId)
  }
  
  depositItem(playerId: string, itemId: number, quantity: number = 1): boolean {
    const bankingSystem = this.systems.get('banking')
    if (!bankingSystem) return false
    
    return bankingSystem.depositItem(playerId, itemId, quantity)
  }
  
  withdrawItem(playerId: string, itemId: number, quantity: number = 1): boolean {
    const bankingSystem = this.systems.get('banking')
    if (!bankingSystem) return false
    
    return bankingSystem.withdrawItem(playerId, itemId, quantity)
  }
  
  /**
   * Skills
   */
  
  getSkillLevel(playerId: string, skillName: string): number {
    const statsSystem = this.systems.get('stats')
    if (!statsSystem) return 1
    
    return statsSystem.getSkillLevel(playerId, skillName)
  }
  
  addSkillXP(playerId: string, skillName: string, xp: number): boolean {
    const statsSystem = this.systems.get('stats')
    if (!statsSystem) return false
    
    return statsSystem.addExperience(playerId, skillName, xp)
  }
  
  /**
   * UI & Interaction
   */
  
  showInterface(playerId: string, interfaceId: string): boolean {
    const uiSystem = this.systems.get('ui')
    if (!uiSystem) return false
    
    uiSystem.showInterface(playerId, interfaceId)
    return true
  }
  
  hideInterface(playerId: string, interfaceId: string): boolean {
    const uiSystem = this.systems.get('ui')
    if (!uiSystem) return false
    
    uiSystem.hideInterface(playerId, interfaceId)
    return true
  }
  
  sendMessage(playerId: string, message: string, type: 'game' | 'chat' = 'game'): void {
    const uiSystem = this.systems.get('ui')
    if (!uiSystem) return
    
    uiSystem.addChatMessage({
      type,
      text: message,
      timestamp: Date.now()
    })
  }
  
  /**
   * World & Environment
   */
  
  getWorldTime(): number {
    return this.worldManager.getWorldTime()
  }
  
  isInSafeZone(position: Vector3): boolean {
    return this.worldManager.isInSafeZone(position)
  }
  
  getRegionAt(position: Vector3): string | null {
    return this.worldManager.getRegionAt(position)
  }
  
  /**
   * Testing & Debug
   */
  
  getEntityCount(): number {
    return this.world.entities.items.size
  }
  
  getAllEntities(): Map<string, any> {
    return this.world.entities.items
  }
  
  getSystem(systemName: string): any {
    return this.systems.get(systemName)
  }
  
  /**
   * Events
   */
  
  on(event: string, handler: Function): void {
    this.world.events.on(event, handler)
  }
  
  off(event: string, handler: Function): void {
    this.world.events.off(event, handler)
  }
  
  emit(event: string, data: any): void {
    this.world.events.emit(event, data)
  }
} 