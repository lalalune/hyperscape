#!/usr/bin/env node

/**
 * Comprehensive AI Creation System Demo
 * Demonstrates all item generation capabilities
 */

const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const chalk = require('chalk')

// All item types we can generate
const itemCategories = {
  weapons: [
    { name: "Iron Sword", description: "A basic iron sword with leather-wrapped grip", type: "weapon", subtype: "sword" },
    { name: "Fire Staff", description: "A magical staff with a glowing fire crystal", type: "weapon", subtype: "staff" },
    { name: "Elven Bow", description: "An elegant longbow made from ancient wood", type: "weapon", subtype: "bow" },
    { name: "War Hammer", description: "A massive two-handed hammer with steel head", type: "weapon", subtype: "hammer" },
    { name: "Assassin's Dagger", description: "A curved dagger with poison grooves", type: "weapon", subtype: "dagger" }
  ],
  armor: [
    { name: "Iron Helmet", description: "A sturdy iron helmet with face guard", type: "armor", subtype: "head" },
    { name: "Leather Chestplate", description: "Reinforced leather armor with metal studs", type: "armor", subtype: "chest" },
    { name: "Mage Robes", description: "Flowing purple robes with magical runes", type: "armor", subtype: "chest" },
    { name: "Steel Gauntlets", description: "Heavy steel gloves with articulated fingers", type: "armor", subtype: "hands" },
    { name: "Dragon Scale Boots", description: "Boots crafted from red dragon scales", type: "armor", subtype: "feet" }
  ],
  buildings: [
    { name: "Village Bank", description: "A stone bank building with vault and teller counters", type: "building", subtype: "bank" },
    { name: "General Store", description: "A wooden shop with display windows and merchant counter", type: "building", subtype: "store" },
    { name: "Wizard Tower", description: "A tall spiral tower with magical observatory at top", type: "building", subtype: "tower" },
    { name: "Blacksmith Forge", description: "Stone forge building with chimney and anvil area", type: "building", subtype: "workshop" },
    { name: "Town Inn", description: "A cozy inn with sleeping quarters and tavern", type: "building", subtype: "inn" }
  ],
  consumables: [
    { name: "Health Potion", description: "A red glowing potion in a crystal vial", type: "consumable", subtype: "potion" },
    { name: "Bread Loaf", description: "Fresh baked bread with golden crust", type: "consumable", subtype: "food" },
    { name: "Mana Crystal", description: "A blue crystal that restores magical energy", type: "consumable", subtype: "potion" },
    { name: "Cooked Fish", description: "Grilled fish on a wooden plate", type: "consumable", subtype: "food" },
    { name: "Stamina Elixir", description: "Green energizing drink in a flask", type: "consumable", subtype: "potion" }
  ],
  resources: [
    { name: "Iron Ore", description: "Raw iron ore chunk with metallic veins", type: "resource", subtype: "ore" },
    { name: "Oak Log", description: "A freshly cut oak tree log", type: "resource", subtype: "wood" },
    { name: "Gold Bar", description: "A refined gold ingot with stamp", type: "resource", subtype: "bar" },
    { name: "Magic Gem", description: "A pulsating purple gemstone", type: "resource", subtype: "gem" },
    { name: "Coal Chunk", description: "Black coal for smelting and fuel", type: "resource", subtype: "ore" }
  ],
  tools: [
    { name: "Iron Pickaxe", description: "Mining pickaxe with wooden handle", type: "tool", subtype: "pickaxe" },
    { name: "Fishing Rod", description: "Wooden fishing rod with line and hook", type: "tool", subtype: "fishing" },
    { name: "Woodcutter Axe", description: "Sharp axe for chopping trees", type: "tool", subtype: "axe" },
    { name: "Crafting Hammer", description: "Small hammer for crafting work", type: "tool", subtype: "hammer" },
    { name: "Herbalist Sickle", description: "Curved blade for harvesting herbs", type: "tool", subtype: "sickle" }
  ],
  characters: [
    { name: "Human Warrior", description: "A muscular human warrior in battle stance", type: "character", style: "realistic" },
    { name: "Elf Mage", description: "An elegant elf wizard with glowing staff", type: "character", style: "realistic" },
    { name: "Dwarf Miner", description: "A stout dwarf with mining gear and beard", type: "character", style: "realistic" },
    { name: "Goblin Merchant", description: "A sneaky goblin trader with backpack", type: "character", style: "cartoon" },
    { name: "Dragon Boss", description: "A massive red dragon with spread wings", type: "character", style: "realistic" }
  ]
}

// Create batch file for each category
async function createBatchFiles() {
  console.log(chalk.blue('\n📝 Creating batch files for each category...\n'))
  
  const batchDir = path.join(__dirname, 'demo-batches')
  await fs.mkdir(batchDir, { recursive: true })
  
  for (const [category, items] of Object.entries(itemCategories)) {
    const batchFile = path.join(batchDir, `${category}-batch.json`)
    await fs.writeFile(batchFile, JSON.stringify(items, null, 2))
    console.log(chalk.green(`✅ Created ${category}-batch.json (${items.length} items)`))
  }
  
  // Create master batch with all items
  const allItems = Object.values(itemCategories).flat()
  const masterBatch = path.join(batchDir, 'all-items-batch.json')
  await fs.writeFile(masterBatch, JSON.stringify(allItems, null, 2))
  console.log(chalk.green(`✅ Created all-items-batch.json (${allItems.length} total items)`))
  
  return batchDir
}

// Run a CLI command and capture output
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: __dirname,
      shell: true
    })
    
    let output = ''
    let error = ''
    
    proc.stdout.on('data', (data) => {
      output += data.toString()
      process.stdout.write(data)
    })
    
    proc.stderr.on('data', (data) => {
      error += data.toString()
      process.stderr.write(data)
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ output, error })
      } else {
        reject({ code, output, error })
      }
    })
  })
}

// Demo individual generation
async function demoIndividualGeneration() {
  console.log(chalk.bold.blue('\n🎯 Demo: Individual Item Generation\n'))
  
  const examples = [
    { desc: "A legendary flaming sword with dragon bone handle", type: "weapon", name: "Dragonfire Blade" },
    { desc: "A massive stone castle with multiple towers and drawbridge", type: "building", name: "Fortress Keep" },
    { desc: "An ancient wizard with long white beard and crystal staff", type: "character", name: "Archmage Eldrin" }
  ]
  
  for (const example of examples) {
    console.log(chalk.yellow(`\n📦 Generating: ${example.name}`))
    console.log(chalk.gray(`Description: ${example.desc}`))
    console.log(chalk.gray(`Type: ${example.type}`))
    
    try {
      await runCommand('node', [
        'dist/cli/index.js',
        'generate',
        example.desc,
        '--type', example.type,
        '--name', example.name
      ])
    } catch (err) {
      console.log(chalk.red(`⚠️  Generation would require API keys`))
    }
  }
}

// Demo batch generation
async function demoBatchGeneration(batchDir) {
  console.log(chalk.bold.blue('\n📚 Demo: Batch Generation\n'))
  
  const batches = [
    { file: 'weapons-batch.json', parallel: 3 },
    { file: 'buildings-batch.json', parallel: 2 },
    { file: 'all-items-batch.json', parallel: 5 }
  ]
  
  for (const batch of batches) {
    console.log(chalk.yellow(`\n🔄 Processing batch: ${batch.file}`))
    console.log(chalk.gray(`Parallel limit: ${batch.parallel}`))
    
    try {
      await runCommand('node', [
        'dist/cli/index.js',
        'batch',
        path.join(batchDir, batch.file),
        '--parallel', batch.parallel
      ])
    } catch (err) {
      console.log(chalk.red(`⚠️  Batch generation would require API keys`))
    }
  }
}

// Show what the generated files would look like
async function showExpectedOutputs() {
  console.log(chalk.bold.blue('\n📁 Expected Output Structure\n'))
  
  const outputStructure = `
output/
├── weapons/
│   ├── iron-sword/
│   │   ├── image.png          (1024x1024 generated image)
│   │   ├── model.glb          (5,000 poly 3D model)
│   │   ├── textures/          (PBR texture maps)
│   │   └── metadata.json      (hardpoints, stats, etc)
│   └── fire-staff/
│       └── ...
├── armor/
│   ├── iron-helmet/
│   │   ├── model.glb          (8,000 poly 3D model)
│   │   └── metadata.json      (slot: head, defense: 10)
│   └── ...
├── buildings/
│   ├── village-bank/
│   │   ├── model.glb          (30,000 poly 3D model)
│   │   └── metadata.json      (entry points, NPC positions)
│   └── ...
├── characters/
│   ├── human-warrior/
│   │   ├── model.glb          (15,000 poly rigged model)
│   │   └── metadata.json      (skeleton: humanoid)
│   └── ...
└── batch-summary-{timestamp}.json
`
  
  console.log(chalk.gray(outputStructure))
  
  // Show example metadata
  console.log(chalk.bold.yellow('\n📄 Example Metadata Files:\n'))
  
  const weaponMeta = {
    id: "weapon-123",
    name: "Iron Sword",
    type: "weapon",
    subtype: "sword",
    polycount: 4856,
    hardpoints: {
      grip: { position: [0, -0.5, 0], rotation: [0, 0, 0] },
      pommel: { position: [0, -0.7, 0] },
      blade_tip: { position: [0, 0.8, 0] }
    },
    materials: ["metal", "leather"],
    generated: new Date().toISOString()
  }
  
  console.log(chalk.cyan('🗡️  Weapon Metadata:'))
  console.log(JSON.stringify(weaponMeta, null, 2))
  
  const buildingMeta = {
    id: "building-456", 
    name: "Village Bank",
    type: "building",
    subtype: "bank",
    polycount: 28543,
    analysis: {
      entry_points: [
        { position: [0, 0, -5], type: "main_door" }
      ],
      functional_areas: {
        vault: { position: [0, 0, 10], size: [5, 3, 5] },
        teller_area: { position: [0, 0, 0], size: [10, 3, 5] }
      },
      npc_positions: [
        { position: [-3, 0, 0], role: "banker" },
        { position: [3, 0, 0], role: "banker" }
      ]
    },
    generated: new Date().toISOString()
  }
  
  console.log(chalk.cyan('\n🏛️  Building Metadata:'))
  console.log(JSON.stringify(buildingMeta, null, 2))
}

// Create a config file for testing
async function setupTestConfig() {
  console.log(chalk.blue('\n⚙️  Setting up test configuration...\n'))
  
  const config = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "sk-test-key-add-your-real-key-here",
      model: "dall-e-3"
    },
    meshy: {
      apiKey: process.env.MESHY_API_KEY || "meshy-test-key-add-your-real-key-here",
      baseUrl: "https://api.meshy.ai"
    },
    cache: {
      enabled: true,
      ttl: 3600,
      maxSize: 500
    },
    output: {
      directory: "./demo-output",
      format: "glb"
    }
  }
  
  const configPath = path.join(__dirname, 'ai-creation.config.json')
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
  
  console.log(chalk.green('✅ Created ai-creation.config.json'))
  console.log(chalk.yellow('⚠️  Add your API keys to the config file or set environment variables:'))
  console.log(chalk.gray('   export OPENAI_API_KEY="your-key-here"'))
  console.log(chalk.gray('   export MESHY_API_KEY="your-key-here"'))
  
  return configPath
}

// Main demo
async function main() {
  console.log(chalk.bold.magenta(`
╔══════════════════════════════════════════════════════════╗
║         AI Creation System - Full Demo                   ║
║                                                          ║
║  This demo shows all generation capabilities:            ║
║  • Weapons (swords, bows, staffs, etc)                  ║
║  • Armor (helmets, chest, gloves, boots)               ║
║  • Buildings (banks, stores, towers)                    ║
║  • Consumables (potions, food)                         ║
║  • Resources (ores, wood, gems)                        ║
║  • Tools (pickaxes, fishing rods, axes)                ║
║  • Characters (NPCs, monsters, bosses)                  ║
╚══════════════════════════════════════════════════════════╝
  `))
  
  try {
    // Setup
    await setupTestConfig()
    const batchDir = await createBatchFiles()
    
    // Show stats
    const totalItems = Object.values(itemCategories).flat().length
    console.log(chalk.bold.green(`\n📊 Total items to generate: ${totalItems}`))
    console.log(chalk.gray(`   • ${itemCategories.weapons.length} weapons`))
    console.log(chalk.gray(`   • ${itemCategories.armor.length} armor pieces`))
    console.log(chalk.gray(`   • ${itemCategories.buildings.length} buildings`))
    console.log(chalk.gray(`   • ${itemCategories.consumables.length} consumables`))
    console.log(chalk.gray(`   • ${itemCategories.resources.length} resources`))
    console.log(chalk.gray(`   • ${itemCategories.tools.length} tools`))
    console.log(chalk.gray(`   • ${itemCategories.characters.length} characters`))
    
    // Run demos
    await demoIndividualGeneration()
    await demoBatchGeneration(batchDir)
    await showExpectedOutputs()
    
    // Final instructions
    console.log(chalk.bold.green('\n✨ Demo Complete!\n'))
    console.log(chalk.yellow('To actually generate items:'))
    console.log(chalk.white('1. Add your API keys to ai-creation.config.json'))
    console.log(chalk.white('2. Run: node dist/cli/index.js batch demo-batches/all-items-batch.json'))
    console.log(chalk.white('3. Or generate individual items with the generate command'))
    console.log(chalk.white('4. View results in the demo-output/ directory'))
    
    console.log(chalk.blue('\n🌐 To start the interactive viewer:'))
    console.log(chalk.white('   node dist/cli/index.js viewer --port 3000'))
    
  } catch (error) {
    console.error(chalk.red('\n❌ Demo error:'), error)
  }
}

// Run the demo
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { itemCategories, createBatchFiles } 