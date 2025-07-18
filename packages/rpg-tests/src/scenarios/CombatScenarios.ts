import { TestScenario, TestContext, TestValidation, ValidationHelpers } from '@hyperscape/test-framework'

/**
 * Basic Combat Test
 * Tests basic melee combat between player and NPC
 */
class BasicCombatScenario implements TestScenario {
  id = 'combat_basic'
  name = 'Basic Combat Test'
  description = 'Tests basic melee combat mechanics between player and NPC'
  category = 'combat'
  tags = ['combat', 'melee', 'basic']
  timeout = 30000
  
  private playerId = 'test_player_combat'
  private npcId = 'test_goblin'
  
  async setup(context: TestContext): Promise<void> {
    context.log('Setting up basic combat test...')
    
    // Spawn player with combat stats
    await context.helpers.invokeAPI('spawnPlayer', this.playerId, {
      position: { x: 100, y: 1, z: 100 },
      stats: {
        hitpoints: { current: 50, max: 50 },
        attack: { level: 10, xp: 0 },
        strength: { level: 10, xp: 0 },
        defence: { level: 5, xp: 0 }
      }
    })
    
    // Spawn NPC near player
    this.npcId = await context.helpers.invokeAPI('spawnNPC', 'goblin', {
      position: { x: 103, y: 1, z: 100 },
      behavior: 'aggressive'
    })
    
    context.data.set('playerId', this.playerId)
    context.data.set('npcId', this.npcId)
    
    context.log('Combat test setup complete')
  }
  
  async execute(context: TestContext): Promise<void> {
    context.log('Starting combat between player and NPC...')
    
    // Start combat
    const combatStarted = context.helpers.invokeAPI('startCombat', this.playerId, this.npcId)
    if (!combatStarted) {
      throw new Error('Failed to start combat')
    }
    
    // Wait for combat to progress
    context.log('Combat started, waiting for damage events...')
    
    // Listen for damage events
    const damagePromise = context.helpers.listenForEvent('combat:damage', 10000)
    
    // Wait for first damage
    const damageEvent = await damagePromise
    context.data.set('firstDamage', damageEvent)
    
    context.log(`First damage dealt: ${damageEvent.damage} by ${damageEvent.attackerId}`)
    
    // Let combat continue for a bit
    await context.wait(5000)
    
    // Stop combat
    context.helpers.invokeAPI('stopCombat', this.playerId)
    context.log('Combat stopped')
  }
  
  async validate(context: TestContext): Promise<TestValidation> {
    context.log('Validating combat results...')
    
    const player = context.helpers.getEntity(this.playerId)
    const npc = context.helpers.getEntity(this.npcId)
    const firstDamage = context.data.get('firstDamage')
    
    const checks = [
      // Check player exists and has combat component
      ValidationHelpers.assertTrue(
        player && player.components?.has('combat'),
        'Player should exist with combat component'
      ),
      
      // Check NPC exists and has combat component  
      ValidationHelpers.assertTrue(
        npc && npc.components?.has('combat'),
        'NPC should exist with combat component'
      ),
      
      // Check damage was dealt
      ValidationHelpers.assertTrue(
        firstDamage && firstDamage.damage > 0,
        'Damage should have been dealt'
      ),
      
      // Check hitpoints were reduced
      ValidationHelpers.assertTrue(
        player.components?.get('stats')?.hitpoints.current < 50 ||
        npc.components?.get('stats')?.currentHitpoints < npc.components?.get('stats')?.maxHitpoints,
        'At least one combatant should have taken damage'
      )
    ]
    
    const metrics = context.helpers.captureMetrics()
    return ValidationHelpers.createValidation(checks, [], metrics)
  }
  
  async cleanup(context: TestContext): Promise<void> {
    context.log('Cleaning up combat test...')
    
    // Remove test entities
    const world = context.world
    world.entities.destroy(this.playerId)
    world.entities.destroy(this.npcId)
    
    context.log('Combat test cleanup complete')
  }
}

/**
 * Death and Respawn Test
 * Tests player death and respawn mechanics
 */
class DeathRespawnScenario implements TestScenario {
  id = 'combat_death_respawn'
  name = 'Death and Respawn Test'
  description = 'Tests player death and respawn mechanics'
  category = 'combat'
  tags = ['combat', 'death', 'respawn']
  timeout = 45000
  
  private playerId = 'test_player_death'
  private strongNpcId = 'test_dragon'
  
  async setup(context: TestContext): Promise<void> {
    context.log('Setting up death/respawn test...')
    
    // Spawn weak player
    await context.helpers.invokeAPI('spawnPlayer', this.playerId, {
      position: { x: 200, y: 1, z: 200 },
      stats: {
        hitpoints: { current: 10, max: 10 }, // Very low HP
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defence: { level: 1, xp: 0 }
      }
    })
    
    // Spawn strong NPC
    this.strongNpcId = await context.helpers.invokeAPI('spawnNPC', 'dragon', {
      position: { x: 203, y: 1, z: 200 },
      behavior: 'aggressive'
    })
    
    context.log('Death/respawn test setup complete')
  }
  
  async execute(context: TestContext): Promise<void> {
    context.log('Starting combat with strong NPC...')
    
    // Record initial position
    const player = context.helpers.getEntity(this.playerId)
    context.data.set('deathPosition', { ...player.position })
    
    // Start combat
    context.helpers.invokeAPI('startCombat', this.strongNpcId, this.playerId)
    
    // Wait for death event
    context.log('Waiting for player death...')
    const deathEvent = await context.helpers.listenForEvent('player:death', 15000)
    context.data.set('deathEvent', deathEvent)
    
    context.log('Player died, waiting for respawn...')
    
    // Wait for respawn event
    const respawnEvent = await context.helpers.listenForEvent('player:respawn', 10000)
    context.data.set('respawnEvent', respawnEvent)
    
    context.log('Player respawned')
  }
  
  async validate(context: TestContext): Promise<TestValidation> {
    context.log('Validating death/respawn...')
    
    const player = context.helpers.getEntity(this.playerId)
    const deathEvent = context.data.get('deathEvent')
    const respawnEvent = context.data.get('respawnEvent')
    const deathPosition = context.data.get('deathPosition')
    
    const checks = [
      // Check death event occurred
      ValidationHelpers.assertTrue(
        deathEvent && deathEvent.playerId === this.playerId,
        'Death event should have occurred for player'
      ),
      
      // Check respawn event occurred
      ValidationHelpers.assertTrue(
        respawnEvent && respawnEvent.playerId === this.playerId,
        'Respawn event should have occurred for player'
      ),
      
      // Check player is alive after respawn
      ValidationHelpers.assertTrue(
        player && player.components?.get('stats')?.hitpoints.current > 0,
        'Player should be alive after respawn'
      ),
      
      // Check player moved to respawn location
      ValidationHelpers.assertTrue(
        player.position.x !== deathPosition.x || player.position.z !== deathPosition.z,
        'Player should have moved to respawn location'
      ),
      
      // Check hitpoints restored
      ValidationHelpers.assertEqual(
        player.components?.get('stats')?.hitpoints.current,
        player.components?.get('stats')?.hitpoints.max,
        'Player hitpoints should be fully restored'
      )
    ]
    
    const metrics = context.helpers.captureMetrics()
    return ValidationHelpers.createValidation(checks, [], metrics)
  }
  
  async cleanup(context: TestContext): Promise<void> {
    context.log('Cleaning up death/respawn test...')
    
    const world = context.world
    world.entities.destroy(this.playerId)
    world.entities.destroy(this.strongNpcId)
    
    context.log('Death/respawn test cleanup complete')
  }
}

/**
 * Get all combat test scenarios
 */
export function getAllCombatScenarios(): TestScenario[] {
  return [
    new BasicCombatScenario(),
    new DeathRespawnScenario()
  ]
} 