/**
 * RPG Integration Tests for AI Creation System
 * Tests integration with Hyperfy RPG systems for items, NPCs, mobs, and buildings
 */

import { MeshyAIService, MeshyConfig } from '../MeshyAIService'
import { HandPlacementDetector, GeometryData } from '../HandPlacementDetector'
import { WeaponOrientationSystem } from '../WeaponOrientationSystem'

// Mock RPG entity and item systems
interface RPGItem {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'decoration'
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  stats: {
    damage?: number
    defense?: number
    durability: number
    value: number
  }
  requirements: {
    level?: number
    strength?: number
    dexterity?: number
  }
  model: {
    url: string
    scale: { x: number; y: number; z: number }
    attachmentPoints: Array<{
      name: string
      position: { x: number; y: number; z: number }
      rotation: { x: number; y: number; z: number; w: number }
    }>
  }
  metadata: {
    createdBy: 'ai' | 'designer' | 'player'
    meshyTaskId?: string
    analysisConfidence?: number
  }
}

interface RPGCharacter {
  id: string
  name: string
  type: 'npc' | 'mob' | 'player'
  level: number
  stats: {
    health: number
    mana: number
    strength: number
    dexterity: number
    intelligence: number
  }
  model: {
    url: string
    animations: string[]
    scale: { x: number; y: number; z: number }
  }
  ai?: {
    behavior: 'passive' | 'aggressive' | 'neutral'
    dialogue?: string[]
    quests?: string[]
  }
  metadata: {
    createdBy: 'ai' | 'designer'
    meshyTaskId?: string
  }
}

interface RPGBuilding {
  id: string
  name: string
  type: 'house' | 'shop' | 'castle' | 'tower' | 'dungeon'
  size: { width: number; height: number; depth: number }
  model: {
    url: string
    scale: { x: number; y: number; z: number }
  }
  functionality: {
    enterable: boolean
    shopkeeper?: string
    questGiver?: string
    storage?: boolean
  }
  metadata: {
    createdBy: 'ai' | 'designer'
    meshyTaskId?: string
  }
}

// Mock RPG Integration Services
class MockRPGItemService {
  private items: Map<string, RPGItem> = new Map()

  async createItem(item: RPGItem): Promise<string> {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    item.id = id
    this.items.set(id, item)
    return id
  }

  async getItem(id: string): Promise<RPGItem | null> {
    return this.items.get(id) || null
  }

  async getAllItems(): Promise<RPGItem[]> {
    return Array.from(this.items.values())
  }

  async updateItem(id: string, updates: Partial<RPGItem>): Promise<boolean> {
    const item = this.items.get(id)
    if (!item) {
      return false
    }

    Object.assign(item, updates)
    this.items.set(id, item)
    return true
  }
}

class MockRPGCharacterService {
  private characters: Map<string, RPGCharacter> = new Map()

  async createCharacter(character: RPGCharacter): Promise<string> {
    const id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    character.id = id
    this.characters.set(id, character)
    return id
  }

  async getCharacter(id: string): Promise<RPGCharacter | null> {
    return this.characters.get(id) || null
  }

  async spawnCharacter(id: string, position: { x: number; y: number; z: number }): Promise<boolean> {
    const character = this.characters.get(id)
    return !!character
  }
}

class MockRPGBuildingService {
  private buildings: Map<string, RPGBuilding> = new Map()

  async createBuilding(building: RPGBuilding): Promise<string> {
    const id = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    building.id = id
    this.buildings.set(id, building)
    return id
  }

  async placeBuilding(id: string, position: { x: number; y: number; z: number }): Promise<boolean> {
    const building = this.buildings.get(id)
    return !!building
  }
}

// AI-Powered RPG Content Creator
class AIRPGContentCreator {
  constructor(
    private meshyService: MeshyAIService,
    private handDetector: HandPlacementDetector,
    private weaponSystem: WeaponOrientationSystem,
    private itemService: MockRPGItemService,
    private characterService: MockRPGCharacterService,
    private buildingService: MockRPGBuildingService
  ) {}

  async createAIWeapon(
    description: string,
    weaponType: 'sword' | 'axe' | 'bow' | 'staff' | 'shield' | 'dagger' | 'mace' | 'spear',
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common'
  ): Promise<string> {
    console.log(`🔮 Creating AI weapon: ${description} (${rarity} ${weaponType})`)

    // Step 1: Generate 3D model
    const creation = await this.meshyService.createItem(description, 'weapon', weaponType)

    // Step 2: Simulate weapon analysis (using mock geometry for testing)
    const mockGeometry: GeometryData = {
      vertices: new Float32Array([-0.02, -0.8, -0.01, 0.02, -0.8, 0.01, -0.02, 0.8, -0.01, 0.02, 0.8, 0.01]),
      faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
    }

    const analysis = await this.handDetector.analyzeWeapon(mockGeometry, weaponType, description)
    const config = await this.weaponSystem.generateWeaponConfiguration(analysis, description)

    // Step 3: Create RPG item
    const rarityMultipliers = {
      common: 1,
      uncommon: 1.5,
      rare: 2,
      epic: 3,
      legendary: 5,
    }

    const multiplier = rarityMultipliers[rarity]

    const rpgItem: RPGItem = {
      id: '',
      name: this.generateItemName(description, rarity),
      type: 'weapon',
      rarity,
      stats: {
        damage: Math.round(config.metadata.damage * multiplier),
        durability: Math.round(config.metadata.durability * multiplier),
        value: Math.round(config.metadata.value * multiplier),
      },
      requirements: config.metadata.requirements,
      model: {
        url: `https://assets.rpg.com/weapons/${creation.taskId}.glb`,
        scale: creation.metadata.scale || { x: 1, y: 1, z: 1 },
        attachmentPoints: config.attachmentPoints.map(ap => ({
          name: ap.name,
          position: ap.position,
          rotation: ap.rotation,
        })),
      },
      metadata: {
        createdBy: 'ai',
        meshyTaskId: creation.taskId,
        analysisConfidence: analysis.confidence,
      },
    }

    const itemId = await this.itemService.createItem(rpgItem)
    console.log(`✅ AI weapon created: ${rpgItem.name} (ID: ${itemId})`)

    return itemId
  }

  async createAINPC(description: string, type: 'npc' | 'mob' = 'npc', level: number = 1): Promise<string> {
    console.log(`🤖 Creating AI ${type}: ${description} (level ${level})`)

    // Generate character model
    const creation = await this.meshyService.createCharacter(description)

    // Calculate stats based on level and description
    const baseStats = this.calculateCharacterStats(description, type, level)

    const rpgCharacter: RPGCharacter = {
      id: '',
      name: this.generateCharacterName(description, type),
      type,
      level,
      stats: baseStats,
      model: {
        url: `https://assets.rpg.com/characters/${creation.modelTaskId}.glb`,
        animations: this.generateCharacterAnimations(type),
        scale: { x: 1, y: 1, z: 1 },
      },
      ai:
        type === 'npc'
          ? {
              behavior: 'neutral',
              dialogue: this.generateDialogue(description),
              quests: [],
            }
          : {
              behavior: 'aggressive',
            },
      metadata: {
        createdBy: 'ai',
        meshyTaskId: creation.modelTaskId,
      },
    }

    const characterId = await this.characterService.createCharacter(rpgCharacter)
    console.log(`✅ AI ${type} created: ${rpgCharacter.name} (ID: ${characterId})`)

    return characterId
  }

  async createAIBuilding(
    description: string,
    type: 'house' | 'shop' | 'castle' | 'tower' | 'dungeon' = 'house'
  ): Promise<string> {
    console.log(`🏗️ Creating AI building: ${description} (${type})`)

    // Generate building model
    const creation = await this.meshyService.createBuilding(description)

    const rpgBuilding: RPGBuilding = {
      id: '',
      name: this.generateBuildingName(description, type),
      type,
      size: this.calculateBuildingSize(type),
      model: {
        url: `https://assets.rpg.com/buildings/${creation.taskId}.glb`,
        scale: creation.metadata.scale || { x: 1, y: 1, z: 1 },
      },
      functionality: this.calculateBuildingFunctionality(type),
      metadata: {
        createdBy: 'ai',
        meshyTaskId: creation.taskId,
      },
    }

    const buildingId = await this.buildingService.createBuilding(rpgBuilding)
    console.log(`✅ AI building created: ${rpgBuilding.name} (ID: ${buildingId})`)

    return buildingId
  }

  // Helper methods
  private generateItemName(description: string, rarity: string): string {
    const words = description.split(' ')
    const mainWord = words[words.length - 1] || 'item'
    const rarityPrefixes = {
      common: '',
      uncommon: 'Fine ',
      rare: 'Superior ',
      epic: 'Masterwork ',
      legendary: 'Legendary ',
    }
    return `${rarityPrefixes[rarity]}${mainWord.charAt(0).toUpperCase() + mainWord.slice(1)}`
  }

  private generateCharacterName(description: string, type: string): string {
    const words = description.split(' ')
    const mainWord = words.find(w => w.includes('knight') || w.includes('wizard') || w.includes('warrior')) || words[0]
    return type === 'npc'
      ? `${mainWord.charAt(0).toUpperCase() + mainWord.slice(1)} the Helpful`
      : `Hostile ${mainWord.charAt(0).toUpperCase() + mainWord.slice(1)}`
  }

  private generateBuildingName(description: string, type: string): string {
    const words = description.split(' ')
    const adjective = words.find(w => w.includes('stone') || w.includes('wooden') || w.includes('grand')) || 'Old'
    return `${adjective.charAt(0).toUpperCase() + adjective.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)}`
  }

  private calculateCharacterStats(description: string, type: string, level: number) {
    const baseMod = type === 'mob' ? 0.8 : 1.0
    const levelMod = level * 10

    return {
      health: Math.round((100 + levelMod) * baseMod),
      mana: Math.round((50 + levelMod * 0.5) * baseMod),
      strength: Math.round((10 + level) * baseMod),
      dexterity: Math.round((10 + level) * baseMod),
      intelligence: Math.round((10 + level) * baseMod),
    }
  }

  private calculateBuildingSize(type: string) {
    const sizes = {
      house: { width: 10, height: 8, depth: 10 },
      shop: { width: 8, height: 6, depth: 12 },
      castle: { width: 50, height: 30, depth: 50 },
      tower: { width: 8, height: 25, depth: 8 },
      dungeon: { width: 30, height: 5, depth: 30 },
    }
    return sizes[type]
  }

  private calculateBuildingFunctionality(type: string) {
    const functionality = {
      house: { enterable: true, storage: true },
      shop: { enterable: true, shopkeeper: 'merchant', storage: true },
      castle: { enterable: true, questGiver: 'lord', storage: true },
      tower: { enterable: true, questGiver: 'wizard' },
      dungeon: { enterable: true, storage: false },
    }
    return functionality[type]
  }

  private generateCharacterAnimations(type: string): string[] {
    const baseAnimations = ['idle', 'walk', 'run']
    const typeAnimations = {
      npc: [...baseAnimations, 'talk', 'wave', 'think'],
      mob: [...baseAnimations, 'attack', 'hurt', 'death', 'roar'],
    }
    return typeAnimations[type]
  }

  private generateDialogue(description: string): string[] {
    return ['Greetings, traveler!', 'How may I assist you today?', 'Safe travels on your journey.']
  }
}

describe('RPG Integration Tests', () => {
  let meshyService: MeshyAIService
  let aiCreator: AIRPGContentCreator
  let itemService: MockRPGItemService
  let characterService: MockRPGCharacterService
  let buildingService: MockRPGBuildingService

  beforeEach(() => {
    // Mock fetch for Meshy API calls
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          result: `task_${Date.now()}`,
          status: 'SUCCEEDED',
          model_urls: { glb: 'https://example.com/model.glb' },
        }),
      }) as any

    // Initialize services
    meshyService = new MeshyAIService({ apiKey: 'test-key' })
    itemService = new MockRPGItemService()
    characterService = new MockRPGCharacterService()
    buildingService = new MockRPGBuildingService()

    aiCreator = new AIRPGContentCreator(
      meshyService,
      new HandPlacementDetector(),
      new WeaponOrientationSystem(),
      itemService,
      characterService,
      buildingService
    )
  })

  describe('AI Weapon Creation and Integration', () => {
    it('should create complete weapon with RPG integration', async () => {
      console.log('🧪 Testing AI weapon creation and RPG integration...')

      const itemId = await aiCreator.createAIWeapon('enchanted mithril longsword with glowing runes', 'sword', 'epic')

      const item = await itemService.getItem(itemId)
      expect(item).toBeDefined()
      expect(item!.name).toContain('Masterwork') // Epic rarity prefix
      expect(item!.rarity).toBe('epic')
      expect(item!.type).toBe('weapon')

      // Should have enhanced stats due to epic rarity
      expect(item!.stats.damage).toBeGreaterThan(30) // Base * 3 multiplier
      expect(item!.stats.durability).toBeGreaterThan(250)

      // Should have attachment points from weapon analysis
      expect(item!.model.attachmentPoints.length).toBeGreaterThan(0)

      // Should have AI metadata
      expect(item!.metadata.createdBy).toBe('ai')
      expect(item!.metadata.meshyTaskId).toBeDefined()
      expect(item!.metadata.analysisConfidence).toBeGreaterThan(0)

      console.log(`✅ Created weapon: ${item!.name}`)
      console.log(`   Damage: ${item!.stats.damage}, Durability: ${item!.stats.durability}`)
      console.log(`   Attachment points: ${item!.model.attachmentPoints.length}`)
    })

    it('should create different weapon types with appropriate stats', async () => {
      const weaponRequests = [
        { desc: 'iron battle axe', type: 'axe' as const, rarity: 'common' as const },
        { desc: 'elvish longbow', type: 'bow' as const, rarity: 'rare' as const },
        { desc: 'wizard staff of flames', type: 'staff' as const, rarity: 'legendary' as const },
      ]

      const createdWeapons = []

      for (const request of weaponRequests) {
        const itemId = await aiCreator.createAIWeapon(request.desc, request.type, request.rarity)
        const item = await itemService.getItem(itemId)
        createdWeapons.push(item!)
      }

      // Verify different weapon types have appropriate characteristics
      const axe = createdWeapons[0]
      const bow = createdWeapons[1]
      const staff = createdWeapons[2]

      // Legendary staff should have highest damage multiplier
      expect(staff.stats.damage).toBeGreaterThan(bow.stats.damage)
      expect(staff.stats.damage).toBeGreaterThan(axe.stats.damage)

      // Rare bow should have higher stats than common axe
      expect(bow.stats.damage).toBeGreaterThan(axe.stats.damage)

      console.log('✅ Multiple weapon types created successfully:')
      createdWeapons.forEach(weapon => {
        console.log(`   ${weapon.name}: ${weapon.stats.damage} damage (${weapon.rarity})`)
      })
    })
  })

  describe('AI Character Creation and Integration', () => {
    it('should create NPCs with appropriate AI behavior', async () => {
      console.log('🧪 Testing AI NPC creation...')

      const npcId = await aiCreator.createAINPC('wise old wizard with long beard and staff', 'npc', 15)

      const npc = await characterService.getCharacter(npcId)
      expect(npc).toBeDefined()
      expect(npc!.type).toBe('npc')
      expect(npc!.level).toBe(15)

      // Should have appropriate stats for level 15
      expect(npc!.stats.health).toBeGreaterThan(200)
      expect(npc!.stats.intelligence).toBeGreaterThan(20)

      // Should have NPC-specific behavior
      expect(npc!.ai!.behavior).toBe('neutral')
      expect(npc!.ai!.dialogue).toBeDefined()
      expect(npc!.ai!.dialogue!.length).toBeGreaterThan(0)

      // Should have appropriate animations
      expect(npc!.model.animations).toContain('talk')
      expect(npc!.model.animations).toContain('wave')

      console.log(`✅ Created NPC: ${npc!.name} (Level ${npc!.level})`)
      console.log(`   Health: ${npc!.stats.health}, Intelligence: ${npc!.stats.intelligence}`)
    })

    it('should create hostile mobs with combat behavior', async () => {
      console.log('🧪 Testing AI mob creation...')

      const mobId = await aiCreator.createAINPC('fierce orc warrior with battle scars', 'mob', 8)

      const mob = await characterService.getCharacter(mobId)
      expect(mob).toBeDefined()
      expect(mob!.type).toBe('mob')
      expect(mob!.level).toBe(8)

      // Should have mob-specific behavior
      expect(mob!.ai!.behavior).toBe('aggressive')
      expect(mob!.ai!.dialogue).toBeUndefined() // Mobs don't talk

      // Should have combat animations
      expect(mob!.model.animations).toContain('attack')
      expect(mob!.model.animations).toContain('hurt')
      expect(mob!.model.animations).toContain('death')

      console.log(`✅ Created mob: ${mob!.name} (Level ${mob!.level})`)
    })

    it('should spawn characters in game world', async () => {
      const npcId = await aiCreator.createAINPC('friendly merchant', 'npc', 5)

      const spawnSuccess = await characterService.spawnCharacter(npcId, { x: 100, y: 0, z: 100 })
      expect(spawnSuccess).toBe(true)

      console.log('✅ Character spawned successfully in world')
    })
  })

  describe('AI Building Creation and Integration', () => {
    it('should create buildings with appropriate functionality', async () => {
      console.log('🧪 Testing AI building creation...')

      const buildingId = await aiCreator.createAIBuilding('stone blacksmith shop with forge and anvil', 'shop')

      const building = await buildingService.placeBuilding(buildingId, { x: 200, y: 0, z: 200 })
      expect(building).toBe(true)

      console.log('✅ Building placed successfully in world')
    })

    it('should create different building types with unique characteristics', async () => {
      const buildingTypes = ['house', 'shop', 'castle', 'tower', 'dungeon'] as const
      const createdBuildings = []

      for (const type of buildingTypes) {
        const buildingId = await aiCreator.createAIBuilding(`magnificent ${type} of ancient design`, type)
        createdBuildings.push(buildingId)
      }

      expect(createdBuildings).toHaveLength(5)
      console.log(`✅ Created ${createdBuildings.length} different building types`)
    })
  })

  describe('Complete RPG World Generation', () => {
    it('should create a complete game area with items, NPCs, and buildings', async () => {
      console.log('🧪 Testing complete RPG world generation...')

      // Create a starter village
      const results = {
        buildings: [] as string[],
        npcs: [] as string[],
        items: [] as string[],
      }

      // Create buildings
      results.buildings.push(await aiCreator.createAIBuilding('cozy wooden tavern', 'house'))
      results.buildings.push(await aiCreator.createAIBuilding('weapon shop with forge', 'shop'))
      results.buildings.push(await aiCreator.createAIBuilding('wizard tower with library', 'tower'))

      // Create NPCs
      results.npcs.push(await aiCreator.createAINPC('friendly tavern keeper', 'npc', 10))
      results.npcs.push(await aiCreator.createAINPC('skilled blacksmith', 'npc', 15))
      results.npcs.push(await aiCreator.createAINPC('wise wizard scholar', 'npc', 20))

      // Create some hostile mobs
      results.npcs.push(await aiCreator.createAINPC('wild forest wolf', 'mob', 5))
      results.npcs.push(await aiCreator.createAINPC('bandit raider', 'mob', 12))

      // Create items for the shops
      results.items.push(await aiCreator.createAIWeapon('apprentice iron sword', 'sword', 'common'))
      results.items.push(await aiCreator.createAIWeapon('masterwork steel axe', 'axe', 'rare'))
      results.items.push(await aiCreator.createAIWeapon('enchanted mage staff', 'staff', 'epic'))

      // Verify everything was created
      expect(results.buildings).toHaveLength(3)
      expect(results.npcs).toHaveLength(5)
      expect(results.items).toHaveLength(3)

      // Verify we can retrieve all created content
      const allItems = await itemService.getAllItems()
      expect(allItems.length).toBeGreaterThanOrEqual(3)

      console.log('✅ Complete RPG world generation successful:')
      console.log(`   Buildings: ${results.buildings.length}`)
      console.log(`   NPCs/Mobs: ${results.npcs.length}`)
      console.log(`   Items: ${results.items.length}`)
      console.log(`   Total entities: ${results.buildings.length + results.npcs.length + results.items.length}`)
    })

    it('should handle batch creation for large worlds', async () => {
      console.log('🧪 Testing batch world generation...')

      const startTime = Date.now()

      // Create multiple items in parallel
      const weaponPromises = [
        aiCreator.createAIWeapon('iron dagger', 'dagger', 'common'),
        aiCreator.createAIWeapon('steel mace', 'mace', 'uncommon'),
        aiCreator.createAIWeapon('elvish bow', 'bow', 'rare'),
        aiCreator.createAIWeapon('legendary spear', 'spear', 'legendary'),
      ]

      const npcPromises = [
        aiCreator.createAINPC('guard captain', 'npc', 18),
        aiCreator.createAINPC('court wizard', 'npc', 25),
        aiCreator.createAINPC('orc chieftain', 'mob', 20),
      ]

      const buildingPromises = [
        aiCreator.createAIBuilding('grand castle', 'castle'),
        aiCreator.createAIBuilding('dark dungeon', 'dungeon'),
      ]

      // Wait for all creations to complete
      const [weapons, npcs, buildings] = await Promise.all([
        Promise.all(weaponPromises),
        Promise.all(npcPromises),
        Promise.all(buildingPromises),
      ])

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(weapons).toHaveLength(4)
      expect(npcs).toHaveLength(3)
      expect(buildings).toHaveLength(2)

      console.log(`✅ Batch generation completed in ${duration}ms:`)
      console.log(`   Weapons: ${weapons.length}`)
      console.log(`   Characters: ${npcs.length}`)
      console.log(`   Buildings: ${buildings.length}`)
    })
  })

  describe('AI Content Quality and Consistency', () => {
    it('should maintain consistent quality across multiple generations', async () => {
      console.log('🧪 Testing AI content quality consistency...')

      // Create multiple similar items
      const swordIds = await Promise.all([
        aiCreator.createAIWeapon('iron sword', 'sword', 'common'),
        aiCreator.createAIWeapon('iron blade', 'sword', 'common'),
        aiCreator.createAIWeapon('iron longsword', 'sword', 'common'),
      ])

      const swords = await Promise.all(swordIds.map(id => itemService.getItem(id)))

      // All swords should have similar stats (within reasonable range)
      const damages = swords.map(s => s!.stats.damage)
      const avgDamage = damages.reduce((a, b) => a + b, 0) / damages.length

      damages.forEach(damage => {
        expect(damage).toBeGreaterThan(avgDamage * 0.8)
        expect(damage).toBeLessThan(avgDamage * 1.2)
      })

      // All should have proper attachment points
      swords.forEach(sword => {
        expect(sword!.model.attachmentPoints.length).toBeGreaterThan(0)
        expect(sword!.metadata.analysisConfidence).toBeGreaterThan(0)
      })

      console.log('✅ Quality consistency verified across multiple generations')
    })

    it('should handle edge cases and unusual requests', async () => {
      console.log('🧪 Testing edge case handling...')

      // Test unusual weapon description
      const weirdWeaponId = await aiCreator.createAIWeapon(
        'crystalline singing sword from the moon',
        'sword',
        'legendary'
      )

      const weirdWeapon = await itemService.getItem(weirdWeaponId)
      expect(weirdWeapon).toBeDefined()
      expect(weirdWeapon!.rarity).toBe('legendary')

      // Test unusual character
      const weirdNPCId = await aiCreator.createAINPC('time-traveling robot knight from the future', 'npc', 30)

      const weirdNPC = await characterService.getCharacter(weirdNPCId)
      expect(weirdNPC).toBeDefined()
      expect(weirdNPC!.level).toBe(30)

      console.log('✅ Edge cases handled successfully')
    })
  })
})

export { AIRPGContentCreator, MockRPGItemService, MockRPGCharacterService, MockRPGBuildingService }
export type { RPGItem, RPGCharacter, RPGBuilding }
