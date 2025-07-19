import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'
import { GDDAsset } from '../types'
import chalk from 'chalk'

export interface AssetIntegrationConfig {
  // Source directories
  generatedAssetsDir: string
  gddBatchFile: string
  
  // Target directories
  hyperfyAssetsDir: string
  hyperfyCollectionsDir: string
  rpgItemsFile: string
  
  // Integration options
  enableTestMode: boolean
  createCubeProxies: boolean
  preserveExistingAssets: boolean
}

export interface AssetMapping {
  assetId: string
  assetName: string
  name: string
  description: string
  gameId: string
  type: string
  subtype: string
  tier: string
  glbPath: string
  targetPath: string
  hypPath: string
  cubeProxyPath?: string
}

export interface IntegrationResult {
  assetsProcessed: number
  assetsSkipped: number
  assetsError: number
  hypFilesCreated: number
  itemsUpdated: number
  cubeProxiesCreated: number
  success: boolean
  errors: string[]
}

export class AssetIntegrator {
  private config: AssetIntegrationConfig
  private assetMappings: AssetMapping[] = []
  private gddAssets: GDDAsset[] = []
  
  constructor(config: AssetIntegrationConfig) {
    this.config = config
    this.loadGDDAssets()
    this.createAssetMappings()
  }
  
  private loadGDDAssets(): void {
    if (!existsSync(this.config.gddBatchFile)) {
      throw new Error(`GDD batch file not found: ${this.config.gddBatchFile}`)
    }
    
    this.gddAssets = JSON.parse(readFileSync(this.config.gddBatchFile, 'utf8'))
    console.log(chalk.cyan(`📦 Loaded ${this.gddAssets.length} asset definitions`))
  }
  
  async integrate(): Promise<IntegrationResult> {
    console.log(chalk.blue('\n🔧 Asset Integration Pipeline'))
    console.log(chalk.blue('=================================='))
    
    const result: IntegrationResult = {
      assetsProcessed: 0,
      assetsSkipped: 0,
      assetsError: 0,
      hypFilesCreated: 0,
      itemsUpdated: 0,
      cubeProxiesCreated: 0,
      success: false,
      errors: []
    }
    
    try {
      // Step 1: Analyze generated assets
      console.log(chalk.yellow('\n📋 Step 1: Analyzing generated assets...'))
      this.analyzeGeneratedAssets()
      
      // Step 2: Create asset mappings
      console.log(chalk.yellow('\n🗺️  Step 2: Creating asset mappings...'))
      this.createAssetMappings()
      
      // Step 3: Copy assets to target directories
      console.log(chalk.yellow('\n📁 Step 3: Copying assets to target directories...'))
      await this.copyAssetsToTargets()
      
      // Step 4: Create .hyp files
      console.log(chalk.yellow('\n🎯 Step 4: Creating .hyp files...'))
      await this.createHypFiles()
      
      // Step 5: Update RPG item database
      console.log(chalk.yellow('\n🎮 Step 5: Updating RPG item database...'))
      await this.updateRPGItemDatabase()
      
      // Step 6: Create test mode proxies
      if (this.config.createCubeProxies) {
        console.log(chalk.yellow('\n🧪 Step 6: Creating test mode cube proxies...'))
        await this.createCubeProxies()
      }
      
      // Step 7: Generate asset manifest
      console.log(chalk.yellow('\n📜 Step 7: Generating asset manifest...'))
      await this.generateAssetManifest()
      
      result.success = true
      result.assetsProcessed = this.assetMappings.length
      
    } catch (error) {
      console.error(chalk.red('❌ Integration failed:'), error)
      result.errors.push(error instanceof Error ? error.message : String(error))
      result.success = false
    }
    
    // Final summary
    this.printIntegrationSummary(result)
    
    return result
  }
  
  private analyzeGeneratedAssets(): void {
    if (!existsSync(this.config.generatedAssetsDir)) {
      throw new Error(`Generated assets directory not found: ${this.config.generatedAssetsDir}`)
    }
    
    const assetDirs = readdirSync(this.config.generatedAssetsDir)
      .filter(dir => statSync(join(this.config.generatedAssetsDir, dir)).isDirectory())
    
    console.log(chalk.cyan(`📊 Found ${assetDirs.length} generated asset directories`))
    
    // Check for GLB files
    let glbCount = 0
    let metadataCount = 0
    
    for (const dir of assetDirs) {
      const dirPath = join(this.config.generatedAssetsDir, dir)
      const files = readdirSync(dirPath)
      
      const hasGlb = files.some(f => f.endsWith('.glb'))
      const hasMetadata = files.some(f => f === 'metadata.json')
      
      if (hasGlb) glbCount++
      if (hasMetadata) metadataCount++
    }
    
    console.log(chalk.cyan(`🎯 Assets with GLB files: ${glbCount}`))
    console.log(chalk.cyan(`📋 Assets with metadata: ${metadataCount}`))
  }
  
  private createAssetMappings(): void {
    this.assetMappings = []
    
    for (const gddAsset of this.gddAssets) {
      const gameId = gddAsset.metadata?.gameId
      const tier = gddAsset.metadata?.tier || 'basic'
      
      if (!gameId) {
        console.warn(chalk.yellow(`⚠️  Skipping asset without gameId: ${gddAsset.name}`))
        continue
      }
      
      // Find corresponding generated asset directory
      const assetId = this.getAssetIdFromGDD(gddAsset)
      const assetDir = join(this.config.generatedAssetsDir, assetId)
      
      if (!existsSync(assetDir)) {
        console.warn(chalk.yellow(`⚠️  Generated asset directory not found: ${assetId}`))
        continue
      }
      
      // Find GLB file
      const glbFiles = readdirSync(assetDir).filter(f => f.endsWith('.glb'))
      
      if (glbFiles.length === 0) {
        console.warn(chalk.yellow(`⚠️  No GLB file found in: ${assetId}`))
        continue
      }
      
      const glbPath = join(assetDir, glbFiles[0])
      const targetPath = join(this.config.hyperfyAssetsDir, 'models', this.getAssetCategory(gddAsset), `${gameId}.glb`)
      const hypPath = join(this.config.hyperfyCollectionsDir, `${gameId}.hyp`)
      
      const mapping: AssetMapping = {
        assetId,
        assetName: gddAsset.name,
        name: gddAsset.name,
        description: gddAsset.description || `${gddAsset.name} - ${gddAsset.type}`,
        gameId,
        type: gddAsset.type,
        subtype: gddAsset.subtype || gddAsset.type,
        tier,
        glbPath,
        targetPath,
        hypPath,
        cubeProxyPath: this.config.createCubeProxies ? join(this.config.hyperfyCollectionsDir, `${gameId}_cube.hyp`) : undefined
      }
      
      this.assetMappings.push(mapping)
    }
    
    console.log(chalk.green(`✅ Created ${this.assetMappings.length} asset mappings`))
  }
  
  private getAssetIdFromGDD(asset: GDDAsset): string {
    const baseType = asset.subtype || asset.type
    const tier = asset.metadata?.tier || 'basic'
    const normalizedTier = tier.replace(/_/g, '-')
    return `${baseType}-${normalizedTier}`.toLowerCase().replace(/\\s+/g, '-')
  }
  
  private getAssetCategory(asset: GDDAsset): string {
    switch (asset.type) {
      case 'weapon': return 'weapons'
      case 'armor': return 'armor'
      case 'tool': return 'tools'
      case 'consumable': return asset.subtype === 'ammunition' ? 'ammunition' : 'consumables'
      case 'resource': return 'resources'
      case 'building': return 'buildings'
      default: return 'misc'
    }
  }
  
  private getAssetCategoryFromMapping(mapping: AssetMapping): string {
    switch (mapping.type) {
      case 'weapon': return 'weapons'
      case 'armor': return 'armor'
      case 'tool': return 'tools'
      case 'consumable': return mapping.subtype === 'ammunition' ? 'ammunition' : 'consumables'
      case 'resource': return 'resources'
      case 'building': return 'buildings'
      default: return 'misc'
    }
  }
  
  private async copyAssetsToTargets(): Promise<void> {
    let copied = 0
    let skipped = 0
    
    for (const mapping of this.assetMappings) {
      try {
        // Ensure target directory exists
        const targetDir = dirname(mapping.targetPath)
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true })
        }
        
        // Copy GLB file
        if (this.config.preserveExistingAssets && existsSync(mapping.targetPath)) {
          console.log(chalk.gray(`⏩ Skipping existing asset: ${mapping.gameId}`))
          skipped++
          continue
        }
        
        copyFileSync(mapping.glbPath, mapping.targetPath)
        console.log(chalk.green(`📄 Copied: ${mapping.gameId} -> ${basename(mapping.targetPath)}`))
        copied++
        
      } catch (error) {
        console.error(chalk.red(`❌ Failed to copy ${mapping.gameId}:`, error instanceof Error ? error.message : String(error)))
      }
    }
    
    console.log(chalk.cyan(`📊 Assets copied: ${copied}, skipped: ${skipped}`))
  }
  
  private async createHypFiles(): Promise<void> {
    let created = 0
    
    // First, copy the JavaScript template to the collections directory
    await this.copyJavaScriptTemplate()
    
    for (const mapping of this.assetMappings) {
      try {
        const hypContent = this.generateHypContent(mapping)
        
        if (this.config.preserveExistingAssets && existsSync(mapping.hypPath)) {
          console.log(chalk.gray(`⏩ Skipping existing .hyp file: ${mapping.gameId}`))
          continue
        }
        
        writeFileSync(mapping.hypPath, JSON.stringify(hypContent, null, 2))
        console.log(chalk.green(`🎯 Created .hyp file: ${mapping.gameId}.hyp`))
        created++
        
        // Also create the corresponding JavaScript file
        await this.createJavaScriptFile(mapping)
        
      } catch (error) {
        console.error(chalk.red(`❌ Failed to create .hyp file for ${mapping.gameId}:`, error instanceof Error ? error.message : String(error)))
      }
    }
    
    console.log(chalk.cyan(`📊 .hyp files created: ${created}`))
  }
  
  private generateHypContent(mapping: AssetMapping): any {
    const relativeModelPath = `/assets/models/${this.getAssetCategoryFromMapping(mapping)}/${mapping.gameId}.glb`
    
    return {
      name: mapping.assetName,
      description: `${mapping.assetName} - ${mapping.type}`,
      model: relativeModelPath,
      script: `${mapping.gameId}.js`,
      version: 1,
      disabled: false,
      properties: {
        gameId: mapping.gameId,
        itemType: mapping.type,
        itemTier: mapping.tier,
        testMode: this.config.enableTestMode,
        interactable: true,
        respawnTime: 30
      },
      metadata: {
        assetId: mapping.assetId,
        generatedAt: new Date().toISOString(),
        integrationVersion: '1.0.0'
      }
    }
  }
  
  private async copyJavaScriptTemplate(): Promise<void> {
    const templatePath = join(__dirname, '../templates/RPGItemApp.js')
    const targetPath = join(this.config.hyperfyCollectionsDir, 'RPGItemApp.js')
    
    if (!existsSync(templatePath)) {
      console.warn(chalk.yellow(`⚠️  JavaScript template not found: ${templatePath}`))
      return
    }
    
    try {
      copyFileSync(templatePath, targetPath)
      console.log(chalk.green(`📄 Copied JavaScript template to collections`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to copy JavaScript template:`, error instanceof Error ? error.message : String(error)))
    }
  }
  
  private async createJavaScriptFile(mapping: AssetMapping): Promise<void> {
    const jsContent = this.generateJavaScriptContent(mapping)
    const jsPath = join(this.config.hyperfyCollectionsDir, `${mapping.gameId}.js`)
    
    if (this.config.preserveExistingAssets && existsSync(jsPath)) {
      console.log(chalk.gray(`⏩ Skipping existing .js file: ${mapping.gameId}`))
      return
    }
    
    try {
      writeFileSync(jsPath, jsContent)
      console.log(chalk.green(`📄 Created .js file: ${mapping.gameId}.js`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create .js file for ${mapping.gameId}:`, error instanceof Error ? error.message : String(error)))
    }
  }
  
  private generateJavaScriptContent(mapping: AssetMapping): string {
    return `// ${mapping.assetName} - RPG Item App
// Auto-generated by Asset Integration Pipeline
// Generated: ${new Date().toISOString()}

// Import the base RPG Item App
const RPGItemApp = require('./RPGItemApp.js')

// Configure this specific item
app.configure([
  {
    type: 'string',
    key: 'gameId',
    label: 'Game ID',
    initial: '${mapping.gameId}',
    readonly: true
  },
  {
    type: 'string',
    key: 'itemType',
    label: 'Item Type',
    initial: '${mapping.type}',
    readonly: true
  },
  {
    type: 'string',
    key: 'itemTier',
    label: 'Item Tier',
    initial: '${mapping.tier}',
    readonly: true
  },
  {
    type: 'boolean',
    key: 'testMode',
    label: 'Test Mode',
    initial: ${this.config.enableTestMode},
    description: 'Enable test mode with cube proxy'
  },
  {
    type: 'boolean',
    key: 'interactable',
    label: 'Interactable',
    initial: true,
    description: 'Can players interact with this item?'
  },
  {
    type: 'number',
    key: 'respawnTime',
    label: 'Respawn Time (seconds)',
    initial: 30,
    min: 1,
    max: 300,
    description: 'Time before item respawns after being taken'
  }
])

// Initialize the app with specific properties
const itemApp = Object.create(RPGItemApp)
itemApp.itemConfig = {
  gameId: '${mapping.gameId}',
  name: '${mapping.assetName}',
  type: '${mapping.type}',
  subtype: '${mapping.subtype}',
  tier: '${mapping.tier}',
  category: '${this.getAssetCategoryFromMapping(mapping)}'
}

// Custom initialization for this item type
itemApp.customInit = function() {
  console.log('[${mapping.gameId}] Custom initialization for ${mapping.assetName}')
  
  // Add any item-specific behavior here
  switch (this.itemConfig.type) {
    case 'weapon':
      this.setupWeaponBehavior()
      break
    case 'armor':
      this.setupArmorBehavior()
      break
    case 'tool':
      this.setupToolBehavior()
      break
    case 'consumable':
      this.setupConsumableBehavior()
      break
    case 'resource':
      this.setupResourceBehavior()
      break
    case 'building':
      this.setupBuildingBehavior()
      break
    default:
      this.setupDefaultBehavior()
  }
}

// Type-specific behaviors
itemApp.setupWeaponBehavior = function() {
  console.log('[${mapping.gameId}] Setting up weapon behavior')
  // Weapon-specific setup
}

itemApp.setupArmorBehavior = function() {
  console.log('[${mapping.gameId}] Setting up armor behavior')
  // Armor-specific setup
}

itemApp.setupToolBehavior = function() {
  console.log('[${mapping.gameId}] Setting up tool behavior')
  // Tool-specific setup
}

itemApp.setupConsumableBehavior = function() {
  console.log('[${mapping.gameId}] Setting up consumable behavior')
  // Consumable-specific setup
}

itemApp.setupResourceBehavior = function() {
  console.log('[${mapping.gameId}] Setting up resource behavior')
  // Resource-specific setup
}

itemApp.setupBuildingBehavior = function() {
  console.log('[${mapping.gameId}] Setting up building behavior')
  // Building-specific setup
}

itemApp.setupDefaultBehavior = function() {
  console.log('[${mapping.gameId}] Setting up default behavior')
  // Default behavior
}

// Initialize the item
itemApp.init()
itemApp.customInit()

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = itemApp
}
`
  }
  
  private async updateRPGItemDatabase(): Promise<void> {
    if (!existsSync(this.config.rpgItemsFile)) {
      console.warn(chalk.yellow(`⚠️  RPG items file not found: ${this.config.rpgItemsFile}`))
      return
    }
    
    console.log(chalk.cyan('📝 Updating RPG item database model paths...'))
    
    let itemsContent = readFileSync(this.config.rpgItemsFile, 'utf8')
    let updatedCount = 0
    
    for (const mapping of this.assetMappings) {
      const oldPath = `/models/${this.getAssetCategoryFromMapping(mapping)}/${mapping.gameId}.glb`
      const newPath = `/assets/models/${this.getAssetCategoryFromMapping(mapping)}/${mapping.gameId}.glb`
      
      if (itemsContent.includes(oldPath)) {
        itemsContent = itemsContent.replace(oldPath, newPath)
        updatedCount++
        console.log(chalk.green(`✅ Updated path for: ${mapping.gameId}`))
      }
    }
    
    writeFileSync(this.config.rpgItemsFile, itemsContent)
    console.log(chalk.cyan(`📊 Updated ${updatedCount} model paths in RPG database`))
  }
  
  private async createCubeProxies(): Promise<void> {
    if (!this.config.createCubeProxies) return
    
    let created = 0
    
    // Color mapping for different asset types
    const colorMap: Record<string, string> = {
      'weapon': '#FF6B6B',    // Red
      'armor': '#4ECDC4',     // Teal
      'tool': '#45B7D1',      // Blue
      'consumable': '#96CEB4', // Green
      'resource': '#FFEAA7',  // Yellow
      'building': '#DDA0DD'   // Plum
    }
    
    for (const mapping of this.assetMappings) {
      if (!mapping.cubeProxyPath) continue
      
      try {
        const cubeHypContent = {
          name: `${mapping.assetName} (Test Cube)`,
          description: `Test cube proxy for ${mapping.assetName}`,
          script: 'TestCube.js',
          version: 1,
          disabled: false,
          properties: {
            gameId: mapping.gameId,
            originalAsset: mapping.gameId,
            testMode: true,
            color: colorMap[mapping.type] || '#CCCCCC',
            label: mapping.assetName
          },
          metadata: {
            isTestProxy: true,
            originalAssetId: mapping.assetId,
            generatedAt: new Date().toISOString()
          }
        }
        
        writeFileSync(mapping.cubeProxyPath, JSON.stringify(cubeHypContent, null, 2))
        console.log(chalk.green(`🧪 Created test cube proxy: ${mapping.gameId}_cube.hyp`))
        created++
        
      } catch (error) {
        console.error(chalk.red(`❌ Failed to create cube proxy for ${mapping.gameId}:`, error instanceof Error ? error.message : String(error)))
      }
    }
    
    console.log(chalk.cyan(`📊 Test cube proxies created: ${created}`))
  }
  
  private async generateAssetManifest(): Promise<void> {
    const manifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalAssets: this.assetMappings.length,
      assetsByType: this.getAssetCountsByType(),
      assetsByTier: this.getAssetCountsByTier(),
      assetMappings: this.assetMappings.map(m => ({
        gameId: m.gameId,
        name: m.assetName,
        type: m.type,
        subtype: m.subtype,
        tier: m.tier,
        modelPath: `/assets/models/${this.getAssetCategoryFromMapping(m)}/${m.gameId}.glb`,
        hypPath: `${m.gameId}.hyp`,
        testCubePath: this.config.createCubeProxies ? `${m.gameId}_cube.hyp` : null
      })),
      testMode: {
        enabled: this.config.enableTestMode,
        cubeProxies: this.config.createCubeProxies
      }
    }
    
    const manifestPath = join(this.config.hyperfyAssetsDir, 'asset-manifest.json')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    
    console.log(chalk.green(`📜 Generated asset manifest: ${manifestPath}`))
  }
  
  private getAssetCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {}
    
    for (const mapping of this.assetMappings) {
      counts[mapping.type] = (counts[mapping.type] || 0) + 1
    }
    
    return counts
  }
  
  private getAssetCountsByTier(): Record<string, number> {
    const counts: Record<string, number> = {}
    
    for (const mapping of this.assetMappings) {
      counts[mapping.tier] = (counts[mapping.tier] || 0) + 1
    }
    
    return counts
  }
  
  private printIntegrationSummary(result: IntegrationResult): void {
    console.log(chalk.blue('\n📊 Integration Summary'))
    console.log(chalk.blue('======================='))
    
    if (result.success) {
      console.log(chalk.green(`✅ Integration completed successfully!`))
    } else {
      console.log(chalk.red(`❌ Integration failed with ${result.errors.length} errors`))
      result.errors.forEach(error => console.log(chalk.red(`   - ${error}`)))
    }
    
    console.log(chalk.cyan(`📦 Assets processed: ${result.assetsProcessed}`))
    console.log(chalk.cyan(`🎯 .hyp files created: ${result.hypFilesCreated}`))
    console.log(chalk.cyan(`🎮 Items updated: ${result.itemsUpdated}`))
    
    if (this.config.createCubeProxies) {
      console.log(chalk.cyan(`🧪 Test cube proxies created: ${result.cubeProxiesCreated}`))
    }
    
    console.log(chalk.blue('\n🚀 Assets are ready for use in Hyperfy!'))
  }
  
  // Public utility methods
  public getAssetMappings(): AssetMapping[] {
    return this.assetMappings
  }
  
  public getAssetByGameId(gameId: string): AssetMapping | undefined {
    return this.assetMappings.find(m => m.gameId === gameId)
  }
  
  public getAssetsByType(type: string): AssetMapping[] {
    return this.assetMappings.filter(m => m.type === type)
  }
  
  public getAssetsByTier(tier: string): AssetMapping[] {
    return this.assetMappings.filter(m => m.tier === tier)
  }
}

// Factory function for easy configuration
export function createAssetIntegrator(overrides: Partial<AssetIntegrationConfig> = {}): AssetIntegrator {
  const baseDir = process.cwd()
  
  const defaultConfig: AssetIntegrationConfig = {
    // Source directories
    generatedAssetsDir: join(baseDir, 'gdd-assets'),
    gddBatchFile: join(baseDir, 'gdd-complete-batch.json'),
    
    // Target directories
    hyperfyAssetsDir: join(baseDir, '../hyperfy/rpg-world/assets'),
    hyperfyCollectionsDir: join(baseDir, '../hyperfy/rpg-world/collections/default'),
    rpgItemsFile: join(baseDir, '../rpg/src/data/items.ts'),
    
    // Integration options
    enableTestMode: false,
    createCubeProxies: true,
    preserveExistingAssets: false
  }
  
  const config = { ...defaultConfig, ...overrides }
  
  return new AssetIntegrator(config)
}