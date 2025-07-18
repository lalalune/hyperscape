import { TestContext } from '@hyperscape/test-framework'

/**
 * Helper functions specific to RPG testing
 */
export class RPGTestHelpers {
  /**
   * Wait for combat to end
   */
  static async waitForCombatEnd(context: TestContext, entityId: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const entity = context.helpers.getEntity(entityId)
      const combat = entity?.components?.get('combat')
      
      if (!combat || !combat.inCombat) {
        return
      }
      
      await context.wait(500)
    }
    
    throw new Error(`Combat did not end within ${timeout}ms`)
  }
  
  /**
   * Get player stats
   */
  static getPlayerStats(context: TestContext, playerId: string): any {
    const player = context.helpers.getEntity(playerId)
    return player?.components?.get('stats')
  }
  
  /**
   * Check if position is in safe zone
   */
  static isInSafeZone(context: TestContext, position: { x: number, y: number, z: number }): boolean {
    return context.helpers.invokeAPI('isInSafeZone', position)
  }
  
  /**
   * Give player full equipment set
   */
  static equipFullSet(context: TestContext, playerId: string, tier: 'bronze' | 'iron' | 'steel' = 'bronze'): void {
    const items = {
      bronze: {
        helmet: 1139,
        body: 1117,
        legs: 1075,
        boots: 4119,
        gloves: 1059,
        weapon: 1291, // Bronze scimitar
        shield: 1173
      },
      iron: {
        helmet: 1137,
        body: 1115,
        legs: 1067,
        boots: 4121,
        gloves: 1061,
        weapon: 1293, // Iron scimitar
        shield: 1175
      },
      steel: {
        helmet: 1141,
        body: 1119,
        legs: 1069,
        boots: 4123,
        gloves: 1063,
        weapon: 1295, // Steel scimitar
        shield: 1177
      }
    }
    
    const set = items[tier]
    Object.values(set).forEach(itemId => {
      context.helpers.invokeAPI('giveItem', playerId, itemId, 1)
    })
  }
} 