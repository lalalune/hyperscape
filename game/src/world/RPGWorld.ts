import type { World } from '../../types'
import { Vector3 } from '../types'

/**
 * Initialize an RPG world with default content
 */
export async function initializeRPGWorld(world: World): Promise<void> {
  console.log('[RPGWorld] Initializing RPG world content...')

  // Wait for all systems to be ready
  await new Promise(resolve => setTimeout(resolve, 100))

  // Get RPG systems
  const npcSystem = world.systems.find(s => s.constructor.name === 'NPCSystem')
  const spawningSystem = world.systems.find(s => s.constructor.name === 'SpawningSystem')
  const questSystem = world.systems.find(s => s.constructor.name === 'QuestSystem')
  const shopSystem = world.systems.find(s => s.constructor.name === 'ShopSystem')

  if (!npcSystem || !spawningSystem) {
    console.error('[RPGWorld] Required systems not found')
    return
  }

  // Define spawn areas
  const tutorialIsland: Vector3 = { x: 3094, y: 0, z: 3107 }
  const lumbridge: Vector3 = { x: 3222, y: 0, z: 3218 }
  const varrock: Vector3 = { x: 3213, y: 0, z: 3428 }
  const falador: Vector3 = { x: 2965, y: 0, z: 3380 }
  const edgeville: Vector3 = { x: 3087, y: 0, z: 3496 }

  // Register NPCs
  console.log('[RPGWorld] Registering NPCs...')

  // Tutorial NPCs
  ;(npcSystem as any).registerNPCDefinition({
    id: 3308,
    name: 'Tutorial Guide',
    examine: 'He looks helpful.',
    npcType: 'quest_giver',
    behavior: 'friendly',
    level: 1,
    dialogue: {
      text: "Welcome to the world of RuneScape! I'm here to help you get started.",
      options: [
        { text: 'What should I do first?', nextId: 1 },
        { text: 'How do I fight?', nextId: 2 },
        { text: 'Goodbye.', action: 'close' },
      ],
    },
  })

  // Combat NPCs
  ;(npcSystem as any).registerNPCDefinition({
    id: 1,
    name: 'Man',
    examine: 'One of the many citizens of RuneScape.',
    npcType: 'monster',
    behavior: 'passive',
    level: 2,
    combatLevel: 2,
    maxHitpoints: 7,
    combat: {
      attackBonus: 0,
      strengthBonus: 0,
      defenseBonus: 0,
      maxHit: 1,
      attackSpeed: 4000,
    },
    lootTable: 'man_drops',
    respawnTime: 30000,
  })
  ;(npcSystem as any).registerNPCDefinition({
    id: 2,
    name: 'Goblin',
    examine: 'An ugly green creature.',
    npcType: 'monster',
    behavior: 'aggressive',
    level: 2,
    combatLevel: 2,
    maxHitpoints: 5,
    aggressionLevel: 5,
    aggressionRange: 3,
    combat: {
      attackBonus: 0,
      strengthBonus: 0,
      defenseBonus: 0,
      maxHit: 1,
      attackSpeed: 4000,
    },
    lootTable: 'goblin_drops',
    respawnTime: 30000,
  })
  ;(npcSystem as any).registerNPCDefinition({
    id: 41,
    name: 'Chicken',
    examine: 'Yep, definitely a chicken.',
    npcType: 'animal',
    behavior: 'passive',
    level: 1,
    combatLevel: 1,
    maxHitpoints: 3,
    combat: {
      attackBonus: 0,
      strengthBonus: 0,
      defenseBonus: 0,
      maxHit: 0,
      attackSpeed: 4000,
    },
    lootTable: 'chicken_drops',
    respawnTime: 30000,
  })
  ;(npcSystem as any).registerNPCDefinition({
    id: 81,
    name: 'Cow',
    examine: 'Eats grass and goes moo.',
    npcType: 'animal',
    behavior: 'passive',
    level: 2,
    combatLevel: 2,
    maxHitpoints: 8,
    combat: {
      attackBonus: 0,
      strengthBonus: 0,
      defenseBonus: 0,
      maxHit: 1,
      attackSpeed: 4000,
    },
    lootTable: 'cow_drops',
    respawnTime: 30000,
  })
  ;(npcSystem as any).registerNPCDefinition({
    id: 50,
    name: 'Giant rat',
    examine: 'A giant rat.',
    npcType: 'monster',
    behavior: 'aggressive',
    level: 3,
    combatLevel: 3,
    maxHitpoints: 5,
    aggressionLevel: 3,
    aggressionRange: 2,
    combat: {
      attackBonus: 2,
      strengthBonus: 1,
      defenseBonus: 1,
      maxHit: 1,
      attackSpeed: 4000,
    },
    lootTable: 'rat_drops',
    respawnTime: 30000,
  })

  // Shop NPCs
  ;(npcSystem as any).registerNPCDefinition({
    id: 520,
    name: 'Shopkeeper',
    examine: 'I can buy and sell things from him.',
    npcType: 'shopkeeper',
    behavior: 'shop',
    level: 1,
    shop: 'general_store',
  })
  ;(npcSystem as any).registerNPCDefinition({
    id: 553,
    name: 'Aubury',
    examine: 'He sells runes.',
    npcType: 'shopkeeper',
    behavior: 'shop',
    level: 1,
    shop: 'rune_shop',
  })

  // Quest NPCs
  ;(npcSystem as any).registerNPCDefinition({
    id: 278,
    name: 'Cook',
    examine: 'The castle cook.',
    npcType: 'quest_giver',
    behavior: 'quest',
    level: 1,
    questGiver: {
      quests: ['cooks_assistant'],
    },
  })

  // Banker NPCs
  ;(npcSystem as any).registerNPCDefinition({
    id: 395,
    name: 'Banker',
    examine: 'He can look after my money.',
    npcType: 'banker',
    behavior: 'banker',
    level: 1,
  })

  // Create spawn areas
  console.log('[RPGWorld] Creating spawn areas...')

  // Tutorial Island spawns
  ;(spawningSystem as any).createSpawnArea({
    id: 'tutorial_rats',
    npcIds: [50], // Giant rats
    maxCount: 3,
    respawnTime: 30000,
    center: { x: tutorialIsland.x + 10, y: 0, z: tutorialIsland.z },
    radius: 5,
  })

  // Lumbridge spawns
  ;(spawningSystem as any).createSpawnArea({
    id: 'lumbridge_men',
    npcIds: [1], // Men
    maxCount: 5,
    respawnTime: 30000,
    center: lumbridge,
    radius: 10,
  })
  ;(spawningSystem as any).createSpawnArea({
    id: 'lumbridge_goblins',
    npcIds: [2], // Goblins
    maxCount: 8,
    respawnTime: 30000,
    center: { x: lumbridge.x - 30, y: 0, z: lumbridge.z + 20 },
    radius: 15,
  })
  ;(spawningSystem as any).createSpawnArea({
    id: 'lumbridge_chickens',
    npcIds: [41], // Chickens
    maxCount: 6,
    respawnTime: 30000,
    center: { x: lumbridge.x + 20, y: 0, z: lumbridge.z - 10 },
    radius: 8,
  })
  ;(spawningSystem as any).createSpawnArea({
    id: 'lumbridge_cows',
    npcIds: [81], // Cows
    maxCount: 8,
    respawnTime: 30000,
    center: { x: lumbridge.x + 40, y: 0, z: lumbridge.z + 30 },
    radius: 20,
  })

  // Spawn static NPCs (shopkeepers, bankers, etc.)
  console.log('[RPGWorld] Spawning static NPCs...')

  // Lumbridge NPCs
  ;(npcSystem as any).spawnNPC(520, { x: lumbridge.x - 5, y: 0, z: lumbridge.z + 5 }) // General store
  ;(npcSystem as any).spawnNPC(395, { x: lumbridge.x + 10, y: 0, z: lumbridge.z }) // Banker
  ;(npcSystem as any).spawnNPC(278, { x: lumbridge.x, y: 0, z: lumbridge.z + 20 }) // Cook
  ;(npcSystem as any).spawnNPC(3308, { x: tutorialIsland.x, y: 0, z: tutorialIsland.z }) // Tutorial Guide

  // Varrock NPCs
  ;(npcSystem as any).spawnNPC(520, { x: varrock.x, y: 0, z: varrock.z }) // General store
  ;(npcSystem as any).spawnNPC(553, { x: varrock.x - 20, y: 0, z: varrock.z }) // Aubury (rune shop)
  ;(npcSystem as any).spawnNPC(395, { x: varrock.x + 15, y: 0, z: varrock.z + 10 }) // Banker

  // Register bank booths
  const bankingSystem = world.systems.find(s => s.constructor.name === 'BankingSystem')
  if (bankingSystem) {
    ;(bankingSystem as any).registerBankBooth('bank_lumbridge')
    ;(bankingSystem as any).registerBankBooth('bank_varrock_west')
    ;(bankingSystem as any).registerBankBooth('bank_varrock_east')
    ;(bankingSystem as any).registerBankBooth('bank_falador_west')
    ;(bankingSystem as any).registerBankBooth('bank_falador_east')
    ;(bankingSystem as any).registerBankBooth('bank_edgeville')
  }

  // Create starter quest
  if (questSystem) {
    ;(questSystem as any).registerQuest({
      id: 'tutorial_quest',
      name: 'Learning the Ropes',
      description: 'Learn the basics of combat and skills.',
      startNPC: 3308,
      requirements: {},
      objectives: [
        {
          id: 'talk_to_guide',
          type: 'talk',
          description: 'Talk to the Tutorial Guide',
          targetId: '3308',
          targetCount: 1,
        },
        {
          id: 'kill_rat',
          type: 'kill',
          description: 'Kill a giant rat',
          targetId: '50',
          targetCount: 1,
        },
        {
          id: 'open_bank',
          type: 'use',
          description: 'Open the bank',
          targetId: 'bank',
          targetCount: 1,
        },
      ],
      rewards: {
        experience: { attack: 100, defense: 100, strength: 100 },
        items: [
          { itemId: 995, quantity: 25 }, // 25 coins
          { itemId: 1277, quantity: 1 }, // Bronze sword
          { itemId: 1171, quantity: 1 }, // Wooden shield
        ],
      },
    })
    ;(questSystem as any).registerQuest({
      id: 'cooks_assistant',
      name: "Cook's Assistant",
      description: 'Help the Lumbridge Castle cook with his cake.',
      startNPC: 278,
      requirements: {},
      objectives: [
        {
          id: 'get_egg',
          type: 'collect',
          description: 'Collect an egg',
          targetId: '1944',
          targetCount: 1,
        },
        {
          id: 'get_milk',
          type: 'collect',
          description: 'Collect a bucket of milk',
          targetId: '1927',
          targetCount: 1,
        },
        {
          id: 'get_flour',
          type: 'collect',
          description: 'Collect a pot of flour',
          targetId: '1933',
          targetCount: 1,
        },
      ],
      rewards: {
        experience: { cooking: 300 },
        items: [
          { itemId: 995, quantity: 100 }, // 100 coins
          { itemId: 1891, quantity: 1 }, // Cake
        ],
        questPoints: 1,
      },
    })
  }

  // Set world settings
  const settingsSystem = world.systems.find(s => s.constructor.name === 'Settings')
  if (settingsSystem && 'set' in settingsSystem) {
    ;(settingsSystem as any).set('name', 'RuneScape RPG World')
    ;(settingsSystem as any).set('description', 'A RuneScape-inspired RPG world in Hyperfy')
    ;(settingsSystem as any).set('spawn', lumbridge)
  }

  console.log('[RPGWorld] RPG world initialization complete!')
}

/**
 * Create an example RPG world definition
 */
export const RPGWorldDefinition = {
  name: 'RuneScape RPG',
  description: 'A full RuneScape-style RPG experience',
  spawn: { x: 3222, y: 0, z: 3218 }, // Lumbridge

  // Environment settings
  environment: {
    skybox: 'day',
    fog: {
      color: '#c0c0c0',
      near: 100,
      far: 500,
    },
    lighting: {
      ambient: 0.4,
      directional: 0.6,
    },
  },

  // Game rules
  rules: {
    pvp: false,
    maxPlayers: 100,
    itemDropOnDeath: true,
    skillCap: 99,
    combatLevelCap: 126,
  },

  // Starting items for new players
  starterKit: [
    { itemId: 1277, quantity: 1 }, // Bronze sword
    { itemId: 1171, quantity: 1 }, // Wooden shield
    { itemId: 841, quantity: 1 }, // Shortbow
    { itemId: 882, quantity: 50 }, // Bronze arrows
    { itemId: 556, quantity: 30 }, // Air runes
    { itemId: 558, quantity: 30 }, // Mind runes
    { itemId: 995, quantity: 25 }, // 25 coins
  ],
}
