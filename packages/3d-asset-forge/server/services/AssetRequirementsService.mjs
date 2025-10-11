/**
 * Asset Requirements Service
 * Validates which assets exist vs. which are required
 * Provides utilities to check coverage and generate missing assets
 */

import fs from 'fs/promises'
import path from 'path'

export class AssetRequirementsService {
  constructor(assetsDir, hyperspaceAssetsDir) {
    this.assetsDir = assetsDir // 3D Asset Forge assets
    this.hyperspaceAssetsDir = hyperspaceAssetsDir || path.join(assetsDir, '../../hyperscape/world/assets')
    this.manifestsDir = path.join(this.hyperspaceAssetsDir, 'manifests')
    this.forgeDir = path.join(this.hyperspaceAssetsDir, 'forge')
  }

  /**
   * Load asset requirements from manifest
   */
  async loadRequirements() {
    const requirementsPath = path.join(this.manifestsDir, 'asset-requirements.json')
    
    try {
      const raw = await fs.readFile(requirementsPath, 'utf-8')
      return JSON.parse(raw)
    } catch (error) {
      console.error('[AssetRequirements] Failed to load requirements:', error.message)
      return null
    }
  }

  /**
   * Get all required assets across all categories
   */
  async getAllRequiredAssets() {
    const requirements = await this.loadRequirements()
    if (!requirements) return []
    
    const allAssets = []
    
    for (const category of Object.keys(requirements)) {
      if (category === 'version' || category === 'generatedAt' || category === 'description' || category === 'summary') {
        continue
      }
      
      const categoryAssets = requirements[category]
      if (Array.isArray(categoryAssets)) {
        allAssets.push(...categoryAssets.map(asset => ({
          ...asset,
          category
        })))
      }
    }
    
    return allAssets
  }

  /**
   * Check if an asset exists in the forge directory
   * Handles both underscore and hyphen ID formats
   */
  async assetExists(assetId) {
    // Try both formats: bronze_sword and bronze-sword
    const idVariants = [
      assetId,
      assetId.replace(/_/g, '-'),  // bronze_sword → bronze-sword
      assetId.replace(/-/g, '_')   // bronze-sword → bronze_sword
    ]
    
    for (const variant of idVariants) {
      const assetPath = path.join(this.forgeDir, variant)
      
      try {
        const stats = await fs.stat(assetPath)
        if (!stats.isDirectory()) continue
        
        // Check if it has a model file
        const files = await fs.readdir(assetPath)
        const hasModel = files.some(f => f.endsWith('.glb') && !f.includes('_raw'))
        
        if (hasModel) return true
      } catch (error) {
        continue
      }
    }
    
    return false
  }

  /**
   * Validate asset coverage - check which required assets exist
   */
  async validateCoverage() {
    const required = await this.getAllRequiredAssets()
    const coverage = {
      total: required.length,
      exists: 0,
      missing: 0,
      byPriority: {
        critical: { total: 0, exists: 0, missing: 0 },
        high: { total: 0, exists: 0, missing: 0 },
        medium: { total: 0, exists: 0, missing: 0 },
        low: { total: 0, exists: 0, missing: 0 }
      },
      byCategory: {},
      missingAssets: [],
      existingAssets: []
    }
    
    for (const asset of required) {
      const exists = await this.assetExists(asset.id)
      const priority = asset.priority || 'medium'
      const category = asset.category || 'unknown'
      
      // Initialize category if needed
      if (!coverage.byCategory[category]) {
        coverage.byCategory[category] = { total: 0, exists: 0, missing: 0 }
      }
      
      // Update totals
      coverage.byCategory[category].total++
      coverage.byPriority[priority].total++
      
      if (exists) {
        coverage.exists++
        coverage.byCategory[category].exists++
        coverage.byPriority[priority].exists++
        coverage.existingAssets.push(asset)
      } else {
        coverage.missing++
        coverage.byCategory[category].missing++
        coverage.byPriority[priority].missing++
        coverage.missingAssets.push(asset)
      }
    }
    
    // Calculate percentages
    coverage.coveragePercent = ((coverage.exists / coverage.total) * 100).toFixed(1)
    
    for (const priority of Object.keys(coverage.byPriority)) {
      const stats = coverage.byPriority[priority]
      stats.coveragePercent = stats.total > 0 
        ? ((stats.exists / stats.total) * 100).toFixed(1)
        : '0.0'
    }
    
    for (const category of Object.keys(coverage.byCategory)) {
      const stats = coverage.byCategory[category]
      stats.coveragePercent = stats.total > 0 
        ? ((stats.exists / stats.total) * 100).toFixed(1)
        : '0.0'
    }
    
    return coverage
  }

  /**
   * Get generation queue sorted by priority
   */
  async getGenerationQueue() {
    const coverage = await this.validateCoverage()
    
    // Sort missing assets by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    
    coverage.missingAssets.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] ?? 999
      const bPriority = priorityOrder[b.priority] ?? 999
      return aPriority - bPriority
    })
    
    return coverage.missingAssets
  }

  /**
   * Generate a batch generation config for missing assets
   */
  async createBatchGenerationConfig(limit = 10, priority = 'critical') {
    const queue = await this.getGenerationQueue()
    
    // Filter by priority if specified
    const filteredQueue = priority 
      ? queue.filter(asset => asset.priority === priority)
      : queue
    
    const batch = filteredQueue.slice(0, limit)
    
    return batch.map(asset => ({
      name: asset.name,
      type: asset.type,
      subtype: asset.subtype,
      description: asset.description,
      generationType: asset.type === 'character' ? 'avatar' : 'item',
      metadata: {
        tier: asset.tier,
        level: asset.level,
        difficulty: asset.difficulty,
        requiredFor: asset.requiredFor,
        animationsNeeded: asset.animationsNeeded,
        heightMeters: asset.heightMeters
      },
      // Generation settings
      style: 'runescape',
      enableRetexturing: false, // Base model only
      enableSprites: false,
      enableRigging: asset.type === 'character' && asset.animationsNeeded?.length > 0
    }))
  }

  /**
   * Export coverage report as JSON
   */
  async exportCoverageReport(outputPath) {
    const coverage = await this.validateCoverage()
    const reportPath = outputPath || path.join(this.manifestsDir, 'coverage-report.json')
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: coverage.total,
        exists: coverage.exists,
        missing: coverage.missing,
        coveragePercent: coverage.coveragePercent
      },
      byPriority: coverage.byPriority,
      byCategory: coverage.byCategory,
      missingAssets: coverage.missingAssets.map(asset => ({
        id: asset.id,
        name: asset.name,
        category: asset.category,
        priority: asset.priority,
        requiredFor: asset.requiredFor
      })),
      existingAssets: coverage.existingAssets.map(asset => ({
        id: asset.id,
        name: asset.name,
        category: asset.category
      }))
    }
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    console.log(`[AssetRequirements] Coverage report exported to ${reportPath}`)
    
    return report
  }

  /**
   * Print coverage summary to console
   */
  async printCoverageSummary() {
    const coverage = await this.validateCoverage()
    
    console.log('\n' + '='.repeat(60))
    console.log('ASSET COVERAGE REPORT')
    console.log('='.repeat(60))
    console.log(`Total Assets: ${coverage.total}`)
    console.log(`Existing: ${coverage.exists} (${coverage.coveragePercent}%)`)
    console.log(`Missing: ${coverage.missing}`)
    console.log('')
    
    console.log('BY PRIORITY:')
    for (const [priority, stats] of Object.entries(coverage.byPriority)) {
      if (stats.total === 0) continue
      console.log(`  ${priority.toUpperCase()}: ${stats.exists}/${stats.total} (${stats.coveragePercent}%)`)
    }
    console.log('')
    
    console.log('BY CATEGORY:')
    for (const [category, stats] of Object.entries(coverage.byCategory)) {
      console.log(`  ${category}: ${stats.exists}/${stats.total} (${stats.coveragePercent}%)`)
    }
    console.log('')
    
    if (coverage.missing > 0) {
      console.log('CRITICAL MISSING ASSETS:')
      const criticalMissing = coverage.missingAssets.filter(a => a.priority === 'critical')
      for (const asset of criticalMissing) {
        console.log(`  - ${asset.id} (${asset.name})`)
      }
      
      console.log('')
      console.log('HIGH PRIORITY MISSING ASSETS:')
      const highMissing = coverage.missingAssets.filter(a => a.priority === 'high')
      for (const asset of highMissing.slice(0, 10)) {
        console.log(`  - ${asset.id} (${asset.name})`)
      }
      if (highMissing.length > 10) {
        console.log(`  ... and ${highMissing.length - 10} more`)
      }
    }
    
    console.log('='.repeat(60) + '\n')
    
    return coverage
  }
}

