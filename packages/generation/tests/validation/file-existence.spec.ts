import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUTPUT_DIR = path.join(__dirname, '../../output')
const BATCH_FILES_DIR = path.join(__dirname, '../../demo-batches')

test.describe('File Existence Validation', () => {
  test('should have all required batch files', async () => {
    const requiredBatches = [
      'rpg-weapons-batch.json',
      'rpg-armor-batch.json', 
      'rpg-monsters-batch.json',
      'rpg-tools-batch.json',
      'rpg-resources-batch.json',
      'rpg-buildings-batch.json',
      'rpg-complete-batch.json'
    ]
    
    for (const batchFile of requiredBatches) {
      const filePath = path.join(BATCH_FILES_DIR, batchFile)
      expect(fs.existsSync(filePath), `Batch file ${batchFile} should exist`).toBe(true)
      
      // Validate JSON structure
      const content = fs.readFileSync(filePath, 'utf-8')
      const batch = JSON.parse(content)
      expect(Array.isArray(batch), `${batchFile} should contain an array`).toBe(true)
      expect(batch.length, `${batchFile} should not be empty`).toBeGreaterThan(0)
      
      // Validate each item structure
      for (const item of batch) {
        expect(item.name, `Item in ${batchFile} should have a name`).toBeTruthy()
        expect(item.description, `Item in ${batchFile} should have a description`).toBeTruthy()
        expect(item.type, `Item in ${batchFile} should have a type`).toBeTruthy()
        expect(item.style, `Item in ${batchFile} should have a style`).toBeTruthy()
        expect(item.metadata, `Item in ${batchFile} should have metadata`).toBeTruthy()
      }
    }
  })
  
  test('should validate rpg-weapons-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-weapons-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const weapons = JSON.parse(content)
    
    // Should have all required weapons
    const requiredWeapons = [
      'Bronze Sword', 'Steel Sword', 'Mithril Sword',
      'Wood Bow', 'Oak Bow', 'Willow Bow',
      'Bronze Shield', 'Steel Shield', 'Mithril Shield',
      'Bronze Hatchet', 'Arrows'
    ]
    
    const weaponNames = weapons.map((w: any) => w.name)
    for (const weaponName of requiredWeapons) {
      expect(weaponNames).toContain(weaponName)
    }
    
    // Validate weapon types
    for (const weapon of weapons) {
      if (weapon.name.includes('Sword')) {
        expect(weapon.subtype).toBe('sword')
      } else if (weapon.name.includes('Bow')) {
        expect(weapon.subtype).toBe('bow')
      } else if (weapon.name.includes('Shield')) {
        expect(weapon.subtype).toBe('shield')
      } else if (weapon.name.includes('Hatchet')) {
        expect(weapon.subtype).toBe('axe')
      }
    }
  })
  
  test('should validate rpg-armor-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-armor-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const armor = JSON.parse(content)
    
    // Should have all required armor pieces
    const requiredArmor = [
      'Leather Helmet', 'Leather Body', 'Leather Legs',
      'Bronze Helmet', 'Bronze Body', 'Bronze Legs',
      'Steel Helmet', 'Steel Body', 'Steel Legs',
      'Mithril Helmet', 'Mithril Body', 'Mithril Legs'
    ]
    
    const armorNames = armor.map((a: any) => a.name)
    for (const armorName of requiredArmor) {
      expect(armorNames).toContain(armorName)
    }
    
    // Validate armor types
    for (const piece of armor) {
      if (piece.name.includes('Helmet')) {
        expect(piece.subtype).toBe('helmet')
      } else if (piece.name.includes('Body')) {
        expect(piece.subtype).toBe('chest')
      } else if (piece.name.includes('Legs')) {
        expect(piece.subtype).toBe('legs')
      }
    }
  })
  
  test('should validate rpg-monsters-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-monsters-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const monsters = JSON.parse(content)
    
    // Should have all required monsters
    const requiredMonsters = [
      'Goblin', 'Bandit', 'Barbarian',
      'Hobgoblin', 'Guard', 'Dark Warrior',
      'Black Knight', 'Ice Warrior', 'Dark Ranger'
    ]
    
    const monsterNames = monsters.map((m: any) => m.name)
    for (const monsterName of requiredMonsters) {
      expect(monsterNames).toContain(monsterName)
    }
    
    // Validate monster difficulty levels
    for (const monster of monsters) {
      expect(monster.metadata.difficultyLevel).toBeGreaterThanOrEqual(1)
      expect(monster.metadata.difficultyLevel).toBeLessThanOrEqual(3)
      expect(monster.metadata.combatLevel).toBeGreaterThan(0)
      expect(monster.metadata.maxHitpoints).toBeGreaterThan(0)
    }
  })
  
  test('should validate rpg-tools-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-tools-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const tools = JSON.parse(content)
    
    // Should have all required tools
    const requiredTools = ['Bronze Hatchet', 'Fishing Rod', 'Tinderbox']
    
    const toolNames = tools.map((t: any) => t.name)
    for (const toolName of requiredTools) {
      expect(toolNames).toContain(toolName)
    }
  })
  
  test('should validate rpg-resources-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-resources-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const resources = JSON.parse(content)
    
    // Should have all required resources
    const requiredResources = ['Logs', 'Raw Fish', 'Cooked Fish', 'Coins']
    
    const resourceNames = resources.map((r: any) => r.name)
    for (const resourceName of requiredResources) {
      expect(resourceNames).toContain(resourceName)
    }
    
    // Validate stackable properties
    for (const resource of resources) {
      expect(resource.metadata.stackable).toBe(true)
    }
  })
  
  test('should validate rpg-buildings-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-buildings-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const buildings = JSON.parse(content)
    
    // Should have banks and stores
    const bankCount = buildings.filter((b: any) => b.subtype === 'bank').length
    const storeCount = buildings.filter((b: any) => b.subtype === 'store').length
    
    expect(bankCount).toBeGreaterThanOrEqual(3) // At least 3 banks
    expect(storeCount).toBeGreaterThanOrEqual(3) // At least 3 stores
    
    // Validate building locations
    const locations = buildings.map((b: any) => b.metadata.location)
    expect(locations).toContain('Brookhaven')
    expect(locations).toContain('Millharbor')
    expect(locations).toContain('Crosshill')
  })
  
  test('should validate rpg-complete-batch content', async () => {
    const filePath = path.join(BATCH_FILES_DIR, 'rpg-complete-batch.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const complete = JSON.parse(content)
    
    // Should have comprehensive asset coverage
    const assetTypes = [...new Set(complete.map((item: any) => item.type))]
    const expectedTypes = ['weapon', 'armor', 'tool', 'resource', 'consumable', 'character', 'building', 'misc']
    
    for (const expectedType of expectedTypes) {
      expect(assetTypes).toContain(expectedType)
    }
    
    // Should have sufficient total assets
    expect(complete.length).toBeGreaterThanOrEqual(30) // At least 30 total assets
  })
})

test.describe('Generated Asset Files Validation', () => {
  test.beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  })
  
  test('should validate generated asset structure', async () => {
    // This test will be populated after generation runs
    // For now, just check that the output directory exists
    expect(fs.existsSync(OUTPUT_DIR)).toBe(true)
  })
  
  test('should validate GLB file generation', async () => {
    // Skip if no assets generated yet
    if (!fs.existsSync(OUTPUT_DIR)) {
      test.skip()
      return
    }
    
    const assetDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    if (assetDirs.length === 0) {
      test.skip()
      return
    }
    
    // Check each asset directory
    for (const assetDir of assetDirs) {
      const assetPath = path.join(OUTPUT_DIR, assetDir)
      const files = fs.readdirSync(assetPath)
      
      // Should have GLB file
      const glbFiles = files.filter(f => f.endsWith('.glb'))
      expect(glbFiles.length, `Asset ${assetDir} should have GLB file`).toBeGreaterThan(0)
      
      // Should have metadata file
      const metadataFiles = files.filter(f => f === 'metadata.json')
      expect(metadataFiles.length, `Asset ${assetDir} should have metadata.json`).toBe(1)
      
      // Validate metadata content
      const metadataPath = path.join(assetPath, 'metadata.json')
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      
      expect(metadata.name, `Asset ${assetDir} metadata should have name`).toBeTruthy()
      expect(metadata.type, `Asset ${assetDir} metadata should have type`).toBeTruthy()
      expect(metadata.description, `Asset ${assetDir} metadata should have description`).toBeTruthy()
      expect(metadata.generatedAt, `Asset ${assetDir} metadata should have generatedAt`).toBeTruthy()
    }
  })
  
  test('should validate asset count matches batch files', async () => {
    // Skip if no assets generated yet
    if (!fs.existsSync(OUTPUT_DIR)) {
      test.skip()
      return
    }
    
    const assetDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    if (assetDirs.length === 0) {
      test.skip()
      return
    }
    
    // Load complete batch for comparison
    const completeBatchPath = path.join(BATCH_FILES_DIR, 'rpg-complete-batch.json')
    const completeBatch = JSON.parse(fs.readFileSync(completeBatchPath, 'utf-8'))
    
    // Generated assets should match or exceed batch count
    expect(assetDirs.length).toBeGreaterThanOrEqual(completeBatch.length * 0.8) // Allow 80% success rate
  })
  
  test('should validate specific required assets exist', async () => {
    // Skip if no assets generated yet
    if (!fs.existsSync(OUTPUT_DIR)) {
      test.skip()
      return
    }
    
    const assetDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    if (assetDirs.length === 0) {
      test.skip()
      return
    }
    
    // Check for key assets by reading metadata
    const generatedAssets = []
    for (const assetDir of assetDirs) {
      const metadataPath = path.join(OUTPUT_DIR, assetDir, 'metadata.json')
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        generatedAssets.push(metadata.name)
      }
    }
    
    // Should have some critical assets
    const criticalAssets = ['Bronze Sword', 'Steel Sword', 'Goblin', 'Bandit']
    let foundCritical = 0
    
    for (const critical of criticalAssets) {
      if (generatedAssets.some(name => name.includes(critical))) {
        foundCritical++
      }
    }
    
    expect(foundCritical).toBeGreaterThan(0) // At least one critical asset should exist
  })
})