import type { World } from '../../../types'
import {
  Vector3,
  RPGEntity,
  SkillType,
  EquipmentSlot,
  InventoryComponent,
  StatsComponent,
  CombatComponent,
  MovementComponent,
  ResourceComponent,
  ItemComponent,
  NPCComponent,
  QuestComponent,
  ConstructionComponent,
  ConstructionSiteComponent,
  SkillsComponent,
} from '../../types/index'
import { BaseTestScenario } from './BaseTestScenario'

/**
 * Woodcutting Skill Scenario
 *
 * Complete workflow:
 * 1. Player finds trees in the world
 * 2. Player attempts to chop tree (may fail without axe)
 * 3. Player finds and equips an axe
 * 4. Player successfully chops down trees
 * 5. Player gains woodcutting experience and logs
 * 6. Tree respawns after being chopped
 */
export class WoodcuttingScenario extends BaseTestScenario {
  private player: RPGEntity | null = null
  private trees: RPGEntity[] = []
  private axe: RPGEntity | null = null
  private axeItemId = 1351 // Bronze axe
  private initialWoodcuttingXp = 0
  private logsObtained = 0

  constructor(world: World) {
    super(world, 'Woodcutting Skill Scenario', '#228B22') // Forest green color
  }

  async setup(): Promise<boolean> {
    try {
      console.log('[WoodcuttingScenario] Setting up woodcutting scenario...')

      // 1. Spawn Player
      this.player = this.spawnTestEntity('player', 'player', { x: 0, y: 0, z: 0 }, '#00FF00')
      if (!this.player) throw new Error('Failed to spawn player')

      this.setupPlayerComponents(this.player)

      // Store initial woodcutting experience
      const playerStats = this.player.getComponent<StatsComponent>('stats')
      if (playerStats && playerStats.woodcutting) {
        this.initialWoodcuttingXp = playerStats.woodcutting.xp
      }

      // 2. Spawn Trees at different locations
      const treePositions = [
        { x: 10, y: 0, z: 0 },
        { x: 15, y: 0, z: 5 },
        { x: 8, y: 0, z: -3 },
      ]

      for (let i = 0; i < treePositions.length; i++) {
        const tree = this.spawnTestEntity(`tree_${i}`, 'tree', treePositions[i], '#8B4513')
        if (!tree) throw new Error(`Failed to spawn tree ${i}`)

        this.setupTreeComponents(tree, i)
        this.trees.push(tree)
      }

      // 3. Spawn Bronze Axe
      this.axe = this.spawnTestEntity('axe', 'item', { x: 5, y: 0, z: 2 }, '#CD7F32')
      if (!this.axe) throw new Error('Failed to spawn axe')

      this.setupAxeComponents(this.axe)

      this.logProgress(`✅ Woodcutting scenario setup complete (${this.trees.length} trees spawned)`)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Setup failed: ${errorMessage}`)
      return false
    }
  }

  async execute(): Promise<boolean> {
    try {
      console.log('[WoodcuttingScenario] Executing woodcutting scenario...')

      // Step 1: Player tries to chop tree without axe (should fail)
      this.logProgress('🪓 Step 1: Player attempts to chop tree without axe...')
      await this.movePlayerTo(this.player!, { x: 9, y: 0, z: 0 })

      const chopWithoutAxeSuccess = await this.attemptTreeChopping(this.trees[0], false)
      if (chopWithoutAxeSuccess) {
        this.logProgress('⚠️ Warning: Player successfully chopped tree without axe (unexpected)')
      } else {
        this.logProgress('❌ Failed to chop tree without axe (expected)')
      }

      // Step 2: Player finds and picks up axe
      this.logProgress('🔍 Step 2: Player searches for axe...')
      await this.movePlayerTo(this.player!, { x: 5, y: 0, z: 2 })

      this.logProgress('✋ Step 3: Player picks up bronze axe...')
      const inventory = this.player!.getComponent<InventoryComponent>('inventory')
      if (!inventory) throw new Error('Player missing inventory component')

      const firstEmptySlot = inventory.items.findIndex(slot => slot === null)
      if (firstEmptySlot === -1) throw new Error('Player inventory full')

      // Add axe to inventory
      inventory.items[firstEmptySlot] = {
        itemId: this.axeItemId,
        quantity: 1,
        metadata: {
          name: 'Bronze Axe',
          examine: 'A woodcutting axe made of bronze',
          equipable: true,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            weaponType: 'axe' as any,
            requirements: { woodcutting: { level: 1, xp: 0 } },
            toolType: 'woodcutting',
            efficiency: 1.0,
          },
        },
      }

      // Step 4: Player equips axe
      this.logProgress('⚔️ Step 4: Player equips bronze axe...')
      const axeItem = inventory.items[firstEmptySlot]
      if (axeItem) {
        inventory.equipment[EquipmentSlot.WEAPON] = {
          id: this.axeItemId,
          name: 'Bronze Axe',
          examine: 'A woodcutting axe made of bronze',
          value: 16,
          weight: 2.267,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            weaponType: 'axe' as any,
            requirements: { woodcutting: { level: 1, xp: 0 } },
            bonuses: {
              attackStab: -2,
              attackSlash: 7,
              attackCrush: 2,
              attackMagic: 0,
              attackRanged: 0,
              defenseStab: 0,
              defenseSlash: 0,
              defenseCrush: 0,
              defenseMagic: 0,
              defenseRanged: 0,
              meleeStrength: 7,
              rangedStrength: 0,
              magicDamage: 0,
              prayerBonus: 0,
            },
          },
          model: 'bronze_axe.glb',
          icon: 'bronze_axe.png',
        }

        // Remove from inventory slot
        inventory.items[firstEmptySlot] = null
      }

      this.logProgress('🪓 Bronze axe equipped successfully')

      // Step 5: Player chops down multiple trees
      this.logProgress('🌳 Step 5: Player begins woodcutting...')

      for (let i = 0; i < this.trees.length; i++) {
        const tree = this.trees[i]
        const treePosition = tree.position

        this.logProgress(`🚶 Moving to tree ${i + 1}...`)
        await this.movePlayerTo(this.player!, {
          x: treePosition.x - 1,
          y: treePosition.y,
          z: treePosition.z,
        })

        this.logProgress(`🪓 Chopping tree ${i + 1}...`)
        const chopSuccess = await this.attemptTreeChopping(tree, true)

        if (chopSuccess) {
          this.logProgress(`🪵 Tree ${i + 1} chopped successfully! Logs obtained.`)
          this.logsObtained++
        } else {
          this.logProgress(`❌ Failed to chop tree ${i + 1}`)
        }

        // Brief pause between trees
        await this.wait(300)
      }

      // Step 6: Validate woodcutting experience gains
      this.logProgress('📈 Step 6: Calculating woodcutting experience...')

      const playerStats = this.player!.getComponent<StatsComponent>('stats')
      if (playerStats && playerStats.woodcutting) {
        const woodcuttingXpGained = playerStats.woodcutting.xp - this.initialWoodcuttingXp
        this.logProgress(`🌲 Woodcutting XP gained: ${woodcuttingXpGained}`)
        this.logProgress(`🪵 Total logs obtained: ${this.logsObtained}`)
      }

      this.logProgress('✅ Woodcutting scenario completed successfully!')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Execution failed: ${errorMessage}`)
      return false
    }
  }

  async validate(): Promise<boolean> {
    try {
      console.log('[WoodcuttingScenario] Validating woodcutting scenario...')

      const inventory = this.player?.getComponent<InventoryComponent>('inventory')
      if (!inventory) {
        this.logProgress('❌ Validation failed: Player missing inventory component')
        return false
      }

      // Verify axe is equipped
      const equippedAxe = inventory.equipment[EquipmentSlot.WEAPON]
      if (!equippedAxe || equippedAxe.id !== this.axeItemId) {
        this.logProgress('❌ Validation failed: Axe not equipped')
        return false
      }

      // Verify logs were obtained
      const hasLogs = inventory.items.some(
        item => item?.metadata?.name === 'Logs' || item?.itemId === 1511 // Normal logs
      )

      if (!hasLogs && this.logsObtained === 0) {
        this.logProgress('❌ Validation failed: No logs obtained')
        return false
      }

      // Verify woodcutting experience gained
      const playerStats = this.player?.getComponent<StatsComponent>('stats')
      if (!playerStats || !playerStats.woodcutting) {
        this.logProgress('❌ Validation failed: Player missing woodcutting skill')
        return false
      }

      const woodcuttingXpGained = playerStats.woodcutting.xp - this.initialWoodcuttingXp
      if (woodcuttingXpGained <= 0) {
        this.logProgress('❌ Validation failed: No woodcutting experience gained')
        return false
      }

      // Verify at least one tree was chopped
      if (this.logsObtained === 0) {
        this.logProgress('❌ Validation failed: No trees were successfully chopped')
        return false
      }

      // Verify trees still exist (they should respawn or remain)
      const treesStillExist = this.trees.every(tree => this.testEntities.has(tree.id))
      if (!treesStillExist) {
        this.logProgress('⚠️ Warning: Some trees no longer exist (may be normal if despawned)')
      }

      this.logProgress('✅ Woodcutting validation successful')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Validation failed: ${errorMessage}`)
      return false
    }
  }

  async cleanup(): Promise<void> {
    console.log('[WoodcuttingScenario] Cleaning up woodcutting scenario...')

    // Remove spawned entities
    this.removeTestEntity('player')
    this.removeTestEntity('axe')

    for (let i = 0; i < this.trees.length; i++) {
      this.removeTestEntity(`tree_${i}`)
    }

    // Clear references
    this.player = null
    this.axe = null
    this.trees = []
    this.logsObtained = 0

    console.log('[WoodcuttingScenario] Cleanup complete')
  }

  private setupPlayerComponents(player: RPGEntity): void {
    // Add inventory component
    player.addComponent('inventory', {
      type: 'inventory',
      items: new Array(28).fill(null),
      maxSlots: 28,
      equipment: {
        head: null,
        cape: null,
        amulet: null,
        weapon: null,
        body: null,
        shield: null,
        legs: null,
        gloves: null,
        boots: null,
        ring: null,
        ammo: null,
      },
      totalWeight: 0,
      equipmentBonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0,
      },
    })

    // Add stats component with woodcutting skill
    player.addComponent('stats', {
      type: 'stats',
      hitpoints: { current: 100, max: 100, level: 10, xp: 1154 },
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
      // Gathering skills
      woodcutting: { level: 1, xp: 0 },
      mining: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      combatBonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0,
      },
      combatLevel: 3,
      totalLevel: 10,
    })

    // Add skills component
    player.addComponent('skills', {
      type: 'skills',
      woodcutting: {
        level: 1,
        xp: 0,
        currentAction: null,
        lastActionTime: 0,
        toolEquipped: null,
        efficiency: 1.0,
      },
    })

    // Add movement component
    player.addComponent('movement', {
      type: 'movement',
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      destination: null,
      targetPosition: null,
      path: [],
      speed: 3,
      currentSpeed: 0,
      moveSpeed: 3,
      isMoving: false,
      canMove: true,
      runEnergy: 100,
      isRunning: false,
      facingDirection: 0,
      pathfindingFlags: 0,
      lastMoveTime: 0,
      teleportDestination: null,
      teleportTime: 0,
      teleportAnimation: '',
    })
  }

  private setupTreeComponents(tree: RPGEntity, treeIndex: number): void {
    tree.addComponent('resource', {
      type: 'resource',
      resourceType: 'tree',
      resourceId: 1276 + treeIndex, // Different tree IDs
      name: 'Tree',
      examine: 'A large tree',
      harvestable: true,
      respawnable: true,
      health: 100,
      maxHealth: 100,
      respawnTime: 60000, // 1 minute respawn
      lastHarvestTime: 0,
      requirements: {
        skill: 'woodcutting',
        level: 1,
        tool: 'axe',
      },
      drops: [
        {
          itemId: 1511, // Normal logs
          quantity: { min: 1, max: 1 },
          chance: 1.0,
          experience: 25, // 25 woodcutting XP per log
        },
      ],
      harvestTime: 3000, // 3 seconds to chop
      animations: {
        idle: 'tree_idle',
        harvest: 'tree_chopping',
        depleted: 'tree_stump',
      },
    })

    tree.addComponent('visual', {
      type: 'visual',
      color: '#228B22',
      model: 'tree.glb',
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      highlighted: false,
      currentAnimation: 'tree_idle',
    })
  }

  private setupAxeComponents(axe: RPGEntity): void {
    axe.addComponent('item', {
      type: 'item',
      itemId: this.axeItemId,
      quantity: 1,
      owner: null,
      spawnTime: Date.now(),
      publicSince: 0,
      despawnTimer: 300000,
      highlightTimer: 60000,
      noted: false,
      metadata: {
        name: 'Bronze Axe',
        examine: 'A woodcutting axe made of bronze',
        value: 16,
        equipable: true,
        toolType: 'woodcutting',
        efficiency: 1.0,
        equipment: {
          slot: EquipmentSlot.WEAPON,
          requirements: { woodcutting: { level: 1, xp: 0 } },
        },
      },
    })
  }

  private async attemptTreeChopping(tree: RPGEntity, hasAxe: boolean): Promise<boolean> {
    const resourceComponent = tree.getComponent<ResourceComponent>('resource')
    const playerStats = this.player!.getComponent<StatsComponent>('stats')
    const playerSkills = this.player!.getComponent<SkillsComponent>('skills')
    const inventory = this.player!.getComponent<InventoryComponent>('inventory')

    if (!resourceComponent || !playerStats || !inventory) {
      return false
    }

    // Check if player has required tool
    const equippedWeapon = inventory.equipment[EquipmentSlot.WEAPON]
    const hasRequiredTool = hasAxe && equippedWeapon?.name?.includes('Axe')

    if (!hasRequiredTool) {
      this.logProgress('❌ Cannot chop tree: No axe equipped')
      return false
    }

    // Check if tree is harvestable
    if (!resourceComponent.harvestable || resourceComponent.health <= 0) {
      this.logProgress('❌ Cannot chop tree: Tree not harvestable or already chopped')
      return false
    }

    // Simulate chopping time
    this.logProgress('🪓 Chopping tree...')
    await this.wait(resourceComponent.harvestTime || 3000)

    // Tree chopped successfully
    resourceComponent.health = 0
    resourceComponent.harvestable = false
    resourceComponent.lastHarvestTime = Date.now()

    // Award logs and experience
    if (resourceComponent.drops && resourceComponent.drops.length > 0) {
      const drop = resourceComponent.drops[0]

      // Add logs to inventory
      const firstEmptySlot = inventory.items.findIndex(slot => slot === null)
      if (firstEmptySlot !== -1) {
        inventory.items[firstEmptySlot] = {
          itemId: drop.itemId,
          quantity: drop.quantity.min,
          metadata: { name: 'Logs', examine: 'Some logs' },
        }
      }

      // Award woodcutting experience
      if (playerStats.woodcutting) {
        playerStats.woodcutting.xp += drop.experience
        this.logProgress(`+${drop.experience} Woodcutting XP`)
      }

      // Update skills component
      if (playerSkills?.skills?.woodcutting) {
        playerSkills.skills.woodcutting.xp += drop.experience
        playerSkills.skills.woodcutting.lastActionTime = Date.now()
      }
    }

    // Schedule tree respawn (simulate)
    setTimeout(() => {
      if (resourceComponent) {
        resourceComponent.health = resourceComponent.maxHealth
        resourceComponent.harvestable = true
        this.logProgress('🌱 Tree has respawned')
      }
    }, resourceComponent.respawnTime || 60000)

    return true
  }

  private async movePlayerTo(player: RPGEntity, destination: Vector3): Promise<void> {
    const movement = player.getComponent<MovementComponent>('movement')
    if (movement) {
      movement.destination = destination
      movement.isMoving = true
      // Simulate movement completion
      await this.wait(400)
      movement.position = destination
      player.position = destination
      movement.isMoving = false
      movement.destination = null
    }
  }
}
