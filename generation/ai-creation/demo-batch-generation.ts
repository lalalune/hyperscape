#!/usr/bin/env bun

/**
 * Demonstration Script: Complete Meshy AI Batch Generation
 * 
 * This script demonstrates the full pipeline:
 * 1. Load all JSON item/mob data
 * 2. Generate missing 3D models with Meshy AI
 * 3. Detect hardpoints for weapons
 * 4. Apply retexturing optimizations
 * 5. Generate comprehensive reports and visualizations
 * 
 * Usage:
 *   bun run demo-batch-generation.ts --items --mobs --cache-only
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { MeshyAIService } from './MeshyAIService'
import { PromptAugmentationService } from './PromptAugmentationService'
import { HardpointDetectionService } from './HardpointDetectionService'
import { RetexturingService } from './RetexturingService'
import { BatchGenerationService } from './BatchGenerationService'
import { VisualizationService } from './VisualizationService'

// Configuration
const CONFIG = {
  MESHY_API_KEY: process.env.MESHY_API_KEY || '',
  OUTPUT_DIR: './generation-output',
  ITEM_FILES: [
    '../config/items/basic_items.json',
    '../config/items/bones.json',
    '../config/items/food_items.json'
  ],
  MOB_FILES: [
    '../config/npcs/monsters.json',
    '../config/npcs/guards.json',
    '../config/npcs/quest_givers.json'
  ],
  BATCH_SIZE: 5,
  ENABLE_VISUALIZATIONS: true,
  CACHE_ONLY: process.argv.includes('--cache-only'),
  GENERATE_ITEMS: process.argv.includes('--items') || !process.argv.includes('--mobs'),
  GENERATE_MOBS: process.argv.includes('--mobs') || !process.argv.includes('--items')
}

class DemoBatchGeneration {
  private meshyService: MeshyAIService
  private promptService: PromptAugmentationService
  private hardpointService: HardpointDetectionService
  private retexturingService: RetexturingService
  private batchService: BatchGenerationService
  private visualizationService: VisualizationService
  
  constructor() {
    if (!CONFIG.MESHY_API_KEY) {
      console.warn('⚠️  MESHY_API_KEY not set - using demo mode')
    }

    // Initialize services
    this.meshyService = new MeshyAIService({
      apiKey: CONFIG.MESHY_API_KEY || 'demo-key'
    })

    this.promptService = new PromptAugmentationService({
      artStyle: 'realistic',
      targetPolycount: 'medium',
      includeOrientation: true,
      includeMaterials: true
    })

    this.hardpointService = new HardpointDetectionService({
      confidenceThreshold: 0.7,
      visualizationEnabled: true
    })

    this.retexturingService = new RetexturingService({
      atlasSize: 2048,
      maxTextures: 64,
      compression: 0.8
    })

    this.batchService = new BatchGenerationService(this.meshyService, {
      maxConcurrentTasks: CONFIG.BATCH_SIZE,
      retryAttempts: 3,
      cacheMaxSize: 500, // 500 MB
      enableHardpointDetection: true,
      enableRetexturing: true,
      enableProgressiveGeneration: true
    })

    this.visualizationService = new VisualizationService({
      outputFormat: 'html',
      showConfidenceHeatmap: true,
      showHardpointMarkers: true,
      showOrientationVectors: true,
      exportResolution: 1024
    })

    this.setupEventHandlers()
    this.ensureOutputDirectory()
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Meshy AI Batch Generation Demo')
    console.log(`📁 Output directory: ${CONFIG.OUTPUT_DIR}`)
    console.log(`🎯 Configuration:`)
    console.log(`   - Generate Items: ${CONFIG.GENERATE_ITEMS}`)
    console.log(`   - Generate Mobs: ${CONFIG.GENERATE_MOBS}`)
    console.log(`   - Cache Only: ${CONFIG.CACHE_ONLY}`)
    console.log(`   - Batch Size: ${CONFIG.BATCH_SIZE}`)
    console.log(`   - Visualizations: ${CONFIG.ENABLE_VISUALIZATIONS}`)
    console.log('')

    try {
      const results = {
        items: [] as any[],
        mobs: [] as any[],
        summary: {
          totalGenerated: 0,
          totalCached: 0,
          totalFailed: 0,
          processingTime: 0,
          hardpointsDetected: 0,
          retexturingOptimizations: 0
        }
      }

      // Generate items
      if (CONFIG.GENERATE_ITEMS) {
        console.log('📦 Processing Items...')
        const itemsData = this.loadItemsData()
        console.log(`   Found ${itemsData.length} items to process`)
        
        const itemResults = CONFIG.CACHE_ONLY 
          ? await this.batchService.generateMissingOnly(itemsData, 'item')
          : await this.batchService.generateAllItems(itemsData)
        
        results.items = itemResults
        this.updateSummary(results.summary, itemResults)
        
        if (CONFIG.ENABLE_VISUALIZATIONS) {
          await this.generateItemVisualizations(itemResults)
        }
      }

      // Generate mobs
      if (CONFIG.GENERATE_MOBS) {
        console.log('👹 Processing Mobs...')
        const mobsData = this.loadMobsData()
        console.log(`   Found ${mobsData.length} mobs to process`)
        
        const mobResults = CONFIG.CACHE_ONLY 
          ? await this.batchService.generateMissingOnly(mobsData, 'mob')
          : await this.batchService.generateAllMobs(mobsData)
        
        results.mobs = mobResults
        this.updateSummary(results.summary, mobResults)
        
        if (CONFIG.ENABLE_VISUALIZATIONS) {
          await this.generateMobVisualizations(mobResults)
        }
      }

      // Generate comprehensive report
      if (CONFIG.ENABLE_VISUALIZATIONS) {
        await this.generateFinalReport(results)
      }

      // Display final summary
      this.displayFinalSummary(results.summary)

    } catch (error) {
      console.error('❌ Demo failed:', error)
      process.exit(1)
    }
  }

  private loadItemsData(): any[] {
    const allItems: any[] = []
    
    for (const file of CONFIG.ITEM_FILES) {
      const filepath = join(__dirname, file)
      if (existsSync(filepath)) {
        try {
          const data = JSON.parse(readFileSync(filepath, 'utf-8'))
          allItems.push(...(Array.isArray(data) ? data : [data]))
          console.log(`   ✅ Loaded ${filepath}`)
        } catch (error) {
          console.warn(`   ⚠️  Failed to load ${filepath}:`, error)
        }
      } else {
        console.warn(`   ⚠️  File not found: ${filepath}`)
      }
    }
    
    return allItems
  }

  private loadMobsData(): any[] {
    const allMobs: any[] = []
    
    for (const file of CONFIG.MOB_FILES) {
      const filepath = join(__dirname, file)
      if (existsSync(filepath)) {
        try {
          const data = JSON.parse(readFileSync(filepath, 'utf-8'))
          allMobs.push(...(Array.isArray(data) ? data : [data]))
          console.log(`   ✅ Loaded ${filepath}`)
        } catch (error) {
          console.warn(`   ⚠️  Failed to load ${filepath}:`, error)
        }
      } else {
        console.warn(`   ⚠️  File not found: ${filepath}`)
      }
    }
    
    return allMobs
  }

  private updateSummary(summary: any, results: any[]): void {
    for (const result of results) {
      if (result.status === 'completed') {
        if (result.metadata.cacheHit) {
          summary.totalCached++
        } else {
          summary.totalGenerated++
        }
        
        if (result.hardpoints) {
          summary.hardpointsDetected++
        }
        
        if (result.retexturingResult) {
          summary.retexturingOptimizations++
        }
        
        summary.processingTime += result.metadata.processingTime
      } else if (result.status === 'failed') {
        summary.totalFailed++
      }
    }
  }

  private async generateItemVisualizations(results: any[]): Promise<void> {
    console.log('🎨 Generating item visualizations...')
    
    for (const result of results) {
      if (result.status === 'completed' && result.hardpoints) {
        try {
          const visualization = await this.visualizationService.visualizeHardpoints(
            result.hardpoints
          )
          
          const outputPath = join(CONFIG.OUTPUT_DIR, 'items', `${result.id}_visualization.html`)
          writeFileSync(outputPath, visualization.interactiveViewer || '')
          
          console.log(`   ✅ Generated visualization for ${result.id}`)
        } catch (error) {
          console.warn(`   ⚠️  Failed to visualize ${result.id}:`, error)
        }
      }
    }
  }

  private async generateMobVisualizations(results: any[]): Promise<void> {
    console.log('🎨 Generating mob visualizations...')
    
    for (const result of results) {
      if (result.status === 'completed') {
        try {
          // Create a simple mob report
          const reportHtml = this.createMobReport(result)
          const outputPath = join(CONFIG.OUTPUT_DIR, 'mobs', `${result.id}_report.html`)
          writeFileSync(outputPath, reportHtml)
          
          console.log(`   ✅ Generated report for ${result.id}`)
        } catch (error) {
          console.warn(`   ⚠️  Failed to generate report for ${result.id}:`, error)
        }
      }
    }
  }

  private async generateFinalReport(results: any): Promise<void> {
    console.log('📊 Generating final report...')
    
    const allResults = [...results.items, ...results.mobs]
    const mockProgress = {
      total: allResults.length,
      completed: allResults.filter(r => r.status === 'completed').length,
      failed: allResults.filter(r => r.status === 'failed').length,
      pending: 0,
      processing: 0,
      currentPhase: 'completed' as const,
      estimatedTimeRemaining: 0,
      throughputPerHour: 0
    }

    const report = await this.visualizationService.generateBatchReport(
      allResults,
      mockProgress
    )

    const reportHtml = this.createFinalReportHtml(report, results.summary)
    const outputPath = join(CONFIG.OUTPUT_DIR, 'final_report.html')
    writeFileSync(outputPath, reportHtml)
    
    // Also save raw data
    const dataPath = join(CONFIG.OUTPUT_DIR, 'generation_results.json')
    writeFileSync(dataPath, JSON.stringify(results, null, 2))
    
    console.log(`   ✅ Final report saved to ${outputPath}`)
    console.log(`   ✅ Raw data saved to ${dataPath}`)
  }

  private createMobReport(result: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Mob Generation Report - ${result.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #dee2e6; border-radius: 8px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .info { background: #d1ecf1; border-color: #bee5eb; }
        .prompt-box { background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mob Generation Report</h1>
        <h2>${result.id}</h2>
        <p><strong>Status:</strong> ${result.status}</p>
        <p><strong>Generated:</strong> ${new Date(result.metadata.generatedAt).toLocaleString()}</p>
        <p><strong>Processing Time:</strong> ${result.metadata.processingTime}ms</p>
        <p><strong>Cache Hit:</strong> ${result.metadata.cacheHit ? 'Yes' : 'No'}</p>
    </div>

    ${result.augmentedPrompt ? `
    <div class="section info">
        <h3>Generated Prompt</h3>
        <div class="prompt-box">${result.augmentedPrompt.enhancedPrompt}</div>
        <h4>Negative Prompt</h4>
        <div class="prompt-box">${result.augmentedPrompt.negativePrompt}</div>
        <h4>Orientation Rules</h4>
        <ul>
            <li><strong>Pose:</strong> ${result.augmentedPrompt.orientationRules.pose || 'N/A'}</li>
            <li><strong>Camera Angle:</strong> ${result.augmentedPrompt.orientationRules.cameraAngle || 'N/A'}</li>
            <li><strong>Facing:</strong> ${result.augmentedPrompt.orientationRules.facing || 'N/A'}</li>
        </ul>
    </div>
    ` : ''}

    ${result.modelUrls ? `
    <div class="section success">
        <h3>Generated Model</h3>
        <p><strong>Meshy Task ID:</strong> ${result.meshyTaskId}</p>
        ${result.modelUrls.glb ? `<p><strong>GLB Model:</strong> <a href="${result.modelUrls.glb}" target="_blank">Download</a></p>` : ''}
        ${result.modelUrls.texture_urls ? `<p><strong>Textures:</strong> ${result.modelUrls.texture_urls.length} files</p>` : ''}
    </div>
    ` : ''}

    <div class="section">
        <h3>Metadata</h3>
        <ul>
            <li><strong>Item Type:</strong> ${result.augmentedPrompt?.metadata.itemType || 'Unknown'}</li>
            <li><strong>Category:</strong> ${result.augmentedPrompt?.metadata.category || 'Unknown'}</li>
            <li><strong>Complexity:</strong> ${result.augmentedPrompt?.metadata.complexity || 'Unknown'}</li>
            <li><strong>Art Style:</strong> ${result.augmentedPrompt?.artStyle || 'Unknown'}</li>
        </ul>
    </div>
</body>
</html>`
  }

  private createFinalReportHtml(report: any, summary: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Meshy AI Batch Generation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; text-align: center; }
        .metric-value { font-size: 2.5em; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 0.9em; color: #6c757d; margin-top: 5px; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
        .section h2 { color: #495057; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .category-card { background: #e9ecef; padding: 15px; border-radius: 8px; }
        .success-rate { color: #28a745; font-weight: bold; }
        .accuracy-distribution { display: flex; gap: 10px; }
        .accuracy-bar { flex: 1; text-align: center; padding: 10px; border-radius: 4px; color: white; }
        .excellent { background: #28a745; }
        .good { background: #17a2b8; }
        .fair { background: #ffc107; color: black; }
        .poor { background: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎨 Meshy AI Batch Generation Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="metrics">
        <div class="metric-card">
            <div class="metric-value">${summary.totalGenerated}</div>
            <div class="metric-label">Newly Generated</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${summary.totalCached}</div>
            <div class="metric-label">From Cache</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${summary.totalFailed}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${summary.hardpointsDetected}</div>
            <div class="metric-label">Hardpoints Detected</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${Math.round(summary.processingTime / 1000)}s</div>
            <div class="metric-label">Total Processing Time</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${(report.summary.successRate * 100).toFixed(1)}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Category Breakdown</h2>
        <div class="category-grid">
            ${report.categoryBreakdown.map((cat: any) => `
                <div class="category-card">
                    <h4>${cat.category.toUpperCase()}</h4>
                    <p><strong>Count:</strong> ${cat.count}</p>
                    <p><strong>Success Rate:</strong> <span class="success-rate">${(cat.successRate * 100).toFixed(1)}%</span></p>
                    <p><strong>Avg Processing:</strong> ${Math.round(cat.averageProcessingTime)}ms</p>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>🎯 Accuracy Distribution</h2>
        <div class="accuracy-distribution">
            <div class="accuracy-bar excellent">
                <div>Excellent</div>
                <div>${report.accuracyDistribution.excellent}</div>
            </div>
            <div class="accuracy-bar good">
                <div>Good</div>
                <div>${report.accuracyDistribution.good}</div>
            </div>
            <div class="accuracy-bar fair">
                <div>Fair</div>
                <div>${report.accuracyDistribution.fair}</div>
            </div>
            <div class="accuracy-bar poor">
                <div>Poor</div>
                <div>${report.accuracyDistribution.poor}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📋 Detailed Results</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; border: 1px solid #dee2e6;">ID</th>
                    <th style="padding: 10px; border: 1px solid #dee2e6;">Name</th>
                    <th style="padding: 10px; border: 1px solid #dee2e6;">Category</th>
                    <th style="padding: 10px; border: 1px solid #dee2e6;">Processing Time</th>
                    <th style="padding: 10px; border: 1px solid #dee2e6;">Issues</th>
                </tr>
            </thead>
            <tbody>
                ${report.detailedResults.map((result: any) => `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${result.id}</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${result.name}</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${result.category}</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${result.processingTime}ms</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${result.issues.length > 0 ? result.issues.join(', ') : '✅ None'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>🔧 Service Performance</h2>
        <ul>
            <li><strong>Cache Hit Rate:</strong> ${(report.summary.cacheHitRate * 100).toFixed(1)}%</li>
            <li><strong>Average Processing Time:</strong> ${Math.round(summary.processingTime / (summary.totalGenerated + summary.totalCached))}ms per item</li>
            <li><strong>Hardpoint Detection Rate:</strong> ${((summary.hardpointsDetected / (summary.totalGenerated + summary.totalCached)) * 100).toFixed(1)}%</li>
            <li><strong>Retexturing Optimizations:</strong> ${summary.retexturingOptimizations}</li>
        </ul>
    </div>

    <div class="section">
        <h2>📁 Generated Files</h2>
        <p>Check the following directories for generated content:</p>
        <ul>
            <li><code>./generation-output/items/</code> - Item visualizations and reports</li>
            <li><code>./generation-output/mobs/</code> - Mob generation reports</li>
            <li><code>./generation-output/generation_results.json</code> - Raw generation data</li>
        </ul>
    </div>
</body>
</html>`
  }

  private setupEventHandlers(): void {
    // Progress reporting
    this.batchService.onProgress((progress) => {
      const percentage = progress.total > 0 ? (progress.completed / progress.total * 100).toFixed(1) : '0.0'
      process.stdout.write(`\r   📊 Progress: ${percentage}% (${progress.completed}/${progress.total}) - Phase: ${progress.currentPhase}`)
      
      if (progress.currentPhase === 'completed') {
        console.log('') // New line after completion
      }
    })

    // Completion handler
    this.batchService.onCompletion((results) => {
      const successful = results.filter(r => r.status === 'completed').length
      console.log(`   ✅ Batch completed: ${successful}/${results.length} successful`)
    })
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(CONFIG.OUTPUT_DIR)) {
      mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })
    }
    
    const subDirs = ['items', 'mobs', 'visualizations']
    for (const dir of subDirs) {
      const path = join(CONFIG.OUTPUT_DIR, dir)
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true })
      }
    }
  }

  private displayFinalSummary(summary: any): void {
    console.log('')
    console.log('🎉 Generation Complete!')
    console.log('=' .repeat(50))
    console.log(`📊 Summary:`)
    console.log(`   • Total Generated: ${summary.totalGenerated}`)
    console.log(`   • From Cache: ${summary.totalCached}`)
    console.log(`   • Failed: ${summary.totalFailed}`)
    console.log(`   • Hardpoints Detected: ${summary.hardpointsDetected}`)
    console.log(`   • Retexturing Optimizations: ${summary.retexturingOptimizations}`)
    console.log(`   • Total Processing Time: ${Math.round(summary.processingTime / 1000)}s`)
    console.log('')
    console.log(`📁 Output saved to: ${CONFIG.OUTPUT_DIR}`)
    console.log(`🌐 Open final_report.html in your browser for detailed results`)
    
    // Cache statistics
    const cacheStats = this.batchService.getCacheStats()
    if (cacheStats.entries > 0) {
      console.log('')
      console.log(`💾 Cache Statistics:`)
      console.log(`   • Entries: ${cacheStats.entries}`)
      console.log(`   • Size: ${Math.round(cacheStats.totalSize / 1024 / 1024)}MB`)
      console.log(`   • Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)
    }
  }
}

// Main execution
async function main() {
  const demo = new DemoBatchGeneration()
  await demo.run()
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error)
}

export { DemoBatchGeneration }