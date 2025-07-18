import type { World } from '../../../types'
import {
  Vector3,
  RPGEntity,
  NPCType,
  NPCBehavior,
  NPCState,
  SkillType,
  AttackType,
  WeaponType,
  EquipmentSlot,
  InventoryComponent,
  StatsComponent,
  CombatComponent,
  MovementComponent,
} from '../../types/index'
import { BaseTestScenario } from './BaseTestScenario'

/**
 * Weapon Pickup and Combat Scenario
 *
 * Complete workflow:
 * 1. Player finds and picks up a weapon
 * 2. Player equips the weapon
 * 3. Player fights a mob using the weapon
 * 4. Player gains experience from combat
 * 5. Player validates weapon bonuses and experience gains
 */
export class WeaponCombatScenario extends BaseTestScenario {
  private player: RPGEntity | null = null
  private weapon: RPGEntity | null = null
  private targetMob: RPGEntity | null = null
  private weaponItemId = 1205 // Bronze dagger
  private initialAttackXp = 0
  private initialStrengthXp = 0

  constructor(world: World) {
    super(world, 'Weapon Combat Scenario', '#FFA500') // Orange color
  }

  async setup(): Promise<boolean> {
    try {
      console.log('[WeaponCombatScenario] Setting up weapon combat scenario...')

      // 1. Spawn Player
      this.player = this.spawnTestEntity('player', 'player', { x: 0, y: 0, z: 0 }, '#00FF00')
      if (!this.player) throw new Error('Failed to spawn player')

      this.setupPlayerComponents(this.player)

      // Store initial experience for validation
      const playerStats = this.player.getComponent<StatsComponent>('stats')
      if (playerStats) {
        this.initialAttackXp = playerStats.attack.xp
        this.initialStrengthXp = playerStats.strength.xp
      }

      // 2. Spawn Weapon (Bronze Dagger)
      this.weapon = this.spawnTestEntity('weapon', 'item', { x: 5, y: 0, z: 0 }, '#C0C0C0')
      if (!this.weapon) throw new Error('Failed to spawn weapon')

      this.weapon.addComponent('item', {
        type: 'item',
        itemId: this.weaponItemId,
        quantity: 1,
        owner: null,
        spawnTime: Date.now(),
        publicSince: 0,
        despawnTimer: 300000,
        highlightTimer: 60000,
        noted: false,
        metadata: {
          name: 'Bronze Dagger',
          examine: 'A sharp bronze dagger',
          value: 5,
          equipable: true,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            weaponType: WeaponType.DAGGER,
            attackSpeed: 4,
            twoHanded: false,
            requirements: { attack: { level: 1, xp: 0 } },
            bonuses: {
              attackStab: 6,
              attackSlash: -2,
              attackCrush: -2,
              attackMagic: 0,
              attackRanged: 0,
              defenseStab: 0,
              defenseSlash: 0,
              defenseCrush: 0,
              defenseMagic: 0,
              defenseRanged: 0,
              meleeStrength: 4,
              rangedStrength: 0,
              magicDamage: 0,
              prayerBonus: 0,
            },
          },
        },
      })

      // 3. Spawn Target Mob (Rat - weak enemy)
      this.targetMob = this.spawnTestEntity('target_mob', 'npc', { x: 15, y: 0, z: 0 }, '#8B4513')
      if (!this.targetMob) throw new Error('Failed to spawn target mob')

      this.setupTargetMobComponents(this.targetMob)

      this.logProgress('✅ Weapon combat scenario setup complete')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Setup failed: ${errorMessage}`)
      return false
    }
  }

  async execute(): Promise<boolean> {
    try {
      console.log('[WeaponCombatScenario] Executing weapon combat scenario...')

      // Step 1: Player moves to weapon location
      this.logProgress('🚶 Step 1: Player approaches weapon...')
      await this.movePlayerTo(this.player!, { x: 5, y: 0, z: 1 })

      // Step 2: Player picks up weapon
      this.logProgress('✋ Step 2: Player picks up bronze dagger...')
      const inventory = this.player!.getComponent<InventoryComponent>('inventory')
      if (!inventory) throw new Error('Player missing inventory component')

      const firstEmptySlot = inventory.items.findIndex(slot => slot === null)
      if (firstEmptySlot === -1) throw new Error('Player inventory full')

      // Add weapon to inventory
      inventory.items[firstEmptySlot] = {
        itemId: this.weaponItemId,
        quantity: 1,
        metadata: {
          name: 'Bronze Dagger',
          examine: 'A sharp bronze dagger',
          equipable: true,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            weaponType: WeaponType.DAGGER,
            attackSpeed: 4,
            twoHanded: false,
            bonuses: {
              attackStab: 6,
              attackSlash: -2,
              attackCrush: -2,
              attackMagic: 0,
              attackRanged: 0,
              defenseStab: 0,
              defenseSlash: 0,
              defenseCrush: 0,
              defenseMagic: 0,
              defenseRanged: 0,
              meleeStrength: 4,
              rangedStrength: 0,
              magicDamage: 0,
              prayerBonus: 0,
            },
          },
        },
      }

      this.logProgress('📦 Bronze dagger added to inventory')

      // Step 3: Player equips weapon
      this.logProgress('⚔️ Step 3: Player equips bronze dagger...')

      // Move weapon from inventory to equipment slot
      const weaponItem = inventory.items[firstEmptySlot]
      if (weaponItem) {
        inventory.equipment[EquipmentSlot.WEAPON] = {
          id: this.weaponItemId,
          name: 'Bronze Dagger',
          examine: 'A sharp bronze dagger',
          value: 5,
          weight: 0.1,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            weaponType: WeaponType.DAGGER,
            attackSpeed: 4,
            twoHanded: false,
            requirements: { attack: { level: 1, xp: 0 } },
            bonuses: {
              attackStab: 6,
              attackSlash: -2,
              attackCrush: -2,
              attackMagic: 0,
              attackRanged: 0,
              defenseStab: 0,
              defenseSlash: 0,
              defenseCrush: 0,
              defenseMagic: 0,
              defenseRanged: 0,
              meleeStrength: 4,
              rangedStrength: 0,
              magicDamage: 0,
              prayerBonus: 0,
            },
          },
          model: 'bronze_dagger.glb',
          icon: 'bronze_dagger.png',
        }

        // Update equipment bonuses
        inventory.equipmentBonuses.attackStab += 6
        inventory.equipmentBonuses.attackSlash -= 2
        inventory.equipmentBonuses.attackCrush -= 2
        inventory.equipmentBonuses.meleeStrength += 4

        // Remove from inventory slot
        inventory.items[firstEmptySlot] = null
      }

      this.logProgress('🗡️ Bronze dagger equipped successfully')

      // Step 4: Player moves to target mob
      this.logProgress('🏃 Step 4: Player approaches target mob...')
      await this.movePlayerTo(this.player!, { x: 14, y: 0, z: 0 })

      // Step 5: Combat with target mob
      this.logProgress('⚔️ Step 5: Player engages in combat with weapon...')

      const combatSuccess = await this.performWeaponCombat()
      if (!combatSuccess) {
        throw new Error('Combat with weapon failed')
      }

      // Step 6: Validate experience gains
      this.logProgress('📈 Step 6: Calculating experience gains...')

      const playerStats = this.player!.getComponent<StatsComponent>('stats')
      if (playerStats) {
        const attackXpGained = playerStats.attack.xp - this.initialAttackXp
        const strengthXpGained = playerStats.strength.xp - this.initialStrengthXp

        this.logProgress(`💪 Attack XP gained: ${attackXpGained}`)
        this.logProgress(`💪 Strength XP gained: ${strengthXpGained}`)
      }

      this.logProgress('✅ Weapon combat scenario completed successfully!')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Execution failed: ${errorMessage}`)
      return false
    }
  }

  async validate(): Promise<boolean> {
    try {
      console.log('[WeaponCombatScenario] Validating weapon combat scenario...')

      const inventory = this.player?.getComponent<InventoryComponent>('inventory')
      if (!inventory) {
        this.logProgress('❌ Validation failed: Player missing inventory component')
        return false
      }

      // Verify weapon is equipped
      const equippedWeapon = inventory.equipment[EquipmentSlot.WEAPON]
      if (!equippedWeapon || equippedWeapon.id !== this.weaponItemId) {
        this.logProgress('❌ Validation failed: Weapon not equipped')
        return false
      }

      // Verify equipment bonuses applied
      if (inventory.equipmentBonuses.attackStab < 6 || inventory.equipmentBonuses.meleeStrength < 4) {
        this.logProgress('❌ Validation failed: Equipment bonuses not applied')
        return false
      }

      // Verify target mob is dead
      const mobStats = this.targetMob?.getComponent<StatsComponent>('stats')
      if (!mobStats || mobStats.hitpoints.current > 0) {
        this.logProgress('❌ Validation failed: Target mob not killed')
        return false
      }

      // Verify experience gained
      const playerStats = this.player?.getComponent<StatsComponent>('stats')
      if (!playerStats) {
        this.logProgress('❌ Validation failed: Player missing stats component')
        return false
      }

      const attackXpGained = playerStats.attack.xp - this.initialAttackXp
      const strengthXpGained = playerStats.strength.xp - this.initialStrengthXp

      if (attackXpGained <= 0) {
        this.logProgress('❌ Validation failed: No attack experience gained')
        return false
      }

      if (strengthXpGained <= 0) {
        this.logProgress('❌ Validation failed: No strength experience gained')
        return false
      }

      // Verify weapon is no longer on ground
      const weaponStillExists = this.testEntities.has('weapon')
      if (weaponStillExists) {
        this.logProgress('❌ Validation failed: Weapon still exists on ground')
        return false
      }

      this.logProgress('✅ Weapon combat validation successful')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ Validation failed: ${errorMessage}`)
      return false
    }
  }

  async cleanup(): Promise<void> {
    console.log('[WeaponCombatScenario] Cleaning up weapon combat scenario...')

    // Remove spawned entities
    this.removeTestEntity('player')
    this.removeTestEntity('weapon')
    this.removeTestEntity('target_mob')

    // Clear references
    this.player = null
    this.weapon = null
    this.targetMob = null

    console.log('[WeaponCombatScenario] Cleanup complete')
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

    // Add stats component (low level player)
    player.addComponent('stats', {
      type: 'stats',
      hitpoints: { current: 100, max: 100, level: 10, xp: 1154 },
      attack: { level: 5, xp: 388 },
      strength: { level: 5, xp: 388 },
      defense: { level: 5, xp: 388 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
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
      combatLevel: 7,
      totalLevel: 28,
    })

    // Add combat component
    player.addComponent('combat', {
      type: 'combat',
      inCombat: false,
      target: null,
      lastAttackTime: 0,
      attackSpeed: 4000,
      combatStyle: 'accurate' as any,
      autoRetaliate: true,
      hitSplatQueue: [],
      animationQueue: [],
      specialAttackEnergy: 100,
      specialAttackActive: false,
      protectionPrayers: { melee: false, ranged: false, magic: false },
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

  private setupTargetMobComponents(mob: RPGEntity): void {
    mob.addComponent('npc', {
      type: 'npc',
      npcId: 3001,
      name: 'Giant Rat',
      examine: 'A large, aggressive rat',
      npcType: NPCType.MONSTER,
      behavior: NPCBehavior.AGGRESSIVE,
      faction: 'hostile',
      state: NPCState.IDLE,
      level: 3,
      combatLevel: 3,
      maxHitpoints: 8,
      currentHitpoints: 8,
      attackStyle: AttackType.MELEE,
      aggressionLevel: 3,
      aggressionRange: 2,
      attackBonus: 2,
      strengthBonus: 1,
      defenseBonus: 1,
      maxHit: 2,
      attackSpeed: 4000,
      respawnTime: 30000,
      wanderRadius: 1,
      spawnPoint: { x: 15, y: 0, z: 0 },
      lootTable: 'rat_drops',
      dialogue: undefined,
      shop: undefined,
      questGiver: false,
      shopkeeper: false,
      shopType: undefined,
      currentTarget: null,
      lastInteraction: 0,
    })

    mob.addComponent('stats', {
      type: 'stats',
      hitpoints: { current: 8, max: 8, level: 3, xp: 0 },
      attack: { level: 2, xp: 0 },
      strength: { level: 2, xp: 0 },
      defense: { level: 2, xp: 0 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
      combatBonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 1,
        defenseSlash: 1,
        defenseCrush: 1,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0,
      },
      combatLevel: 3,
      totalLevel: 12,
    })

    mob.addComponent('combat', {
      type: 'combat',
      inCombat: false,
      target: null,
      lastAttackTime: 0,
      attackSpeed: 4000,
      combatStyle: 'accurate' as any,
      autoRetaliate: true,
      hitSplatQueue: [],
      animationQueue: [],
      specialAttackEnergy: 0,
      specialAttackActive: false,
      protectionPrayers: { melee: false, ranged: false, magic: false },
    })
  }

  private async performWeaponCombat(): Promise<boolean> {
    const playerCombat = this.player!.getComponent('combat') as any
    const playerStats = this.player!.getComponent<StatsComponent>('stats')
    const mobCombat = this.targetMob!.getComponent('combat') as any
    const mobStats = this.targetMob!.getComponent<StatsComponent>('stats')

    if (!playerCombat || !playerStats || !mobCombat || !mobStats) {
      return false
    }

    // Start combat
    playerCombat.inCombat = true
    playerCombat.target = this.targetMob!.id
    mobCombat.inCombat = true
    mobCombat.target = this.player!.id

    // Simulate combat with weapon bonuses
    let combatRounds = 0
    const inventory = this.player!.getComponent<InventoryComponent>('inventory')
    const weaponBonus = inventory?.equipmentBonuses.meleeStrength || 0

    while (mobStats.hitpoints.current > 0 && combatRounds < 15) {
      // Calculate damage with weapon bonus
      const baseDamage = Math.floor(Math.random() * 3) + 1 // 1-3 base damage
      const weaponDamage = Math.floor(weaponBonus / 2) // Weapon adds bonus damage
      const totalDamage = baseDamage + weaponDamage

      mobStats.hitpoints.current = Math.max(0, mobStats.hitpoints.current - totalDamage)
      combatRounds++

      this.logProgress(
        `💥 Combat round ${combatRounds}: ${totalDamage} damage (${baseDamage} + ${weaponDamage} weapon)`
      )

      // Award experience for each hit (realistic combat experience)
      const hitExperience = totalDamage * 4 // 4 XP per damage point
      playerStats.attack.xp += hitExperience
      playerStats.strength.xp += hitExperience

      await this.wait(100)
    }

    // End combat
    playerCombat.inCombat = false
    playerCombat.target = null

    return mobStats.hitpoints.current <= 0
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
