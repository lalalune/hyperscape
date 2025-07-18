/**
 * Visualization Service for Hardpoint Accuracy and Generation Results
 * 
 * Provides visual feedback and analysis tools for AI-generated models,
 * hardpoint detection accuracy, and batch generation progress.
 */

import { DetectedHardpoints, HardpointAccuracyMetrics, VisualizationData } from './HardpointDetectionService'
import { GenerationResult, BatchProgress } from './BatchGenerationService'
import { AugmentedPrompt } from './PromptAugmentationService'

export interface VisualizationConfig {
  enableWebGL: boolean
  outputFormat: 'html' | 'svg' | 'canvas' | 'json'
  showConfidenceHeatmap: boolean
  showHardpointMarkers: boolean
  showOrientationVectors: boolean
  showGeometryHighlights: boolean
  exportResolution: number
  colorScheme: 'light' | 'dark' | 'auto'
}

export interface HardpointVisualization {
  modelId: string
  weaponType: string
  visualizationData: string // Base64 encoded image or HTML
  interactiveViewer?: string // HTML with 3D viewer
  accuracyReport: {
    overallScore: number
    detailedMetrics: HardpointAccuracyMetrics
    visualAccuracyMap: string
    improvementSuggestions: string[]
  }
  exportedAssets: {
    screenshot: string
    modelFile?: string
    hardpointData: string
  }
}

export interface BatchVisualizationReport {
  summary: {
    totalItems: number
    successRate: number
    averageAccuracy: number
    processingTime: number
    cacheHitRate: number
  }
  categoryBreakdown: Array<{
    category: string
    count: number
    successRate: number
    averageAccuracy: number
    averageProcessingTime: number
  }>
  accuracyDistribution: {
    excellent: number // 90-100%
    good: number      // 75-89%
    fair: number      // 60-74%
    poor: number      // <60%
  }
  visualizations: {
    progressChart: string
    accuracyHeatmap: string
    categoryComparison: string
    timelineView: string
  }
  detailedResults: Array<{
    id: string
    name: string
    category: string
    accuracy: number
    processingTime: number
    thumbnail: string
    issues: string[]
  }>
}

export interface LiveProgressVisualization {
  progressBar: string
  throughputGraph: string
  queueStatus: string
  activeGenerations: Array<{
    id: string
    progress: number
    estimatedCompletion: number
    currentPhase: string
  }>
  realtimeMetrics: {
    itemsPerHour: number
    averageAccuracy: number
    cacheHitRate: number
    errorRate: number
  }
}

export class VisualizationService {
  private config: VisualizationConfig
  private canvas?: OffscreenCanvas
  private ctx?: OffscreenCanvasRenderingContext2D

  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      enableWebGL: true,
      outputFormat: 'html',
      showConfidenceHeatmap: true,
      showHardpointMarkers: true,
      showOrientationVectors: true,
      showGeometryHighlights: true,
      exportResolution: 1024,
      colorScheme: 'auto',
      ...config
    }

    this.initializeCanvas()
  }

  /**
   * Visualize hardpoint detection results with accuracy analysis
   */
  async visualizeHardpoints(
    hardpoints: DetectedHardpoints,
    accuracyMetrics?: HardpointAccuracyMetrics,
    modelGeometry?: any
  ): Promise<HardpointVisualization> {
    console.log(`🎨 Visualizing hardpoints for ${hardpoints.weaponType}`)

    const visualizationData = await this.renderHardpointVisualization(hardpoints, modelGeometry)
    const interactiveViewer = await this.createInteractiveViewer(hardpoints, modelGeometry)
    const accuracyReport = await this.generateAccuracyReport(hardpoints, accuracyMetrics)
    const exportedAssets = await this.exportHardpointAssets(hardpoints, visualizationData)

    return {
      modelId: `model_${Date.now()}`,
      weaponType: hardpoints.weaponType,
      visualizationData,
      interactiveViewer,
      accuracyReport,
      exportedAssets
    }
  }

  /**
   * Create comprehensive batch generation report
   */
  async generateBatchReport(
    results: GenerationResult[],
    progress: BatchProgress
  ): Promise<BatchVisualizationReport> {
    console.log(`📊 Generating batch visualization report for ${results.length} items`)

    const summary = this.calculateBatchSummary(results, progress)
    const categoryBreakdown = this.analyzeCategoryBreakdown(results)
    const accuracyDistribution = this.calculateAccuracyDistribution(results)
    const visualizations = await this.createBatchVisualizations(results, progress)
    const detailedResults = await this.createDetailedResults(results)

    return {
      summary,
      categoryBreakdown,
      accuracyDistribution,
      visualizations,
      detailedResults
    }
  }

  /**
   * Create live progress visualization for batch processing
   */
  async createLiveProgressVisualization(
    progress: BatchProgress,
    activeGenerations: any[]
  ): Promise<LiveProgressVisualization> {
    const progressBar = this.renderProgressBar(progress)
    const throughputGraph = this.renderThroughputGraph(progress)
    const queueStatus = this.renderQueueStatus(progress)
    const realtimeMetrics = this.calculateRealtimeMetrics(progress, activeGenerations)

    return {
      progressBar,
      throughputGraph,
      queueStatus,
      activeGenerations: activeGenerations.map(gen => ({
        id: gen.id,
        progress: gen.progress || 0,
        estimatedCompletion: gen.estimatedCompletion || 0,
        currentPhase: gen.currentPhase || 'unknown'
      })),
      realtimeMetrics
    }
  }

  /**
   * Render hardpoint visualization with 3D context
   */
  private async renderHardpointVisualization(
    hardpoints: DetectedHardpoints,
    modelGeometry?: any
  ): Promise<string> {
    if (!this.canvas || !this.ctx) {
      return this.createFallbackVisualization(hardpoints)
    }

    const { ctx, canvas } = this
    const size = this.config.exportResolution
    canvas.width = size
    canvas.height = size

    // Clear canvas
    ctx.fillStyle = this.config.colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5'
    ctx.fillRect(0, 0, size, size)

    // Draw model outline (simplified 2D projection)
    if (modelGeometry) {
      this.drawModelOutline(ctx, modelGeometry, size)
    }

    // Draw hardpoint markers
    if (this.config.showHardpointMarkers) {
      this.drawHardpointMarkers(ctx, hardpoints, size)
    }

    // Draw orientation vectors
    if (this.config.showOrientationVectors) {
      this.drawOrientationVectors(ctx, hardpoints.analysisMetadata.visualizationData, size)
    }

    // Draw confidence heatmap
    if (this.config.showConfidenceHeatmap) {
      this.drawConfidenceHeatmap(ctx, hardpoints.analysisMetadata.visualizationData, size)
    }

    // Add legend and annotations
    this.drawLegend(ctx, hardpoints, size)
    this.drawAccuracyAnnotations(ctx, hardpoints, size)

    // Convert to base64
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    return btoa(String.fromCharCode(...uint8Array))
  }

  /**
   * Create interactive 3D viewer HTML
   */
  private async createInteractiveViewer(
    hardpoints: DetectedHardpoints,
    modelGeometry?: any
  ): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Hardpoint Visualization - ${hardpoints.weaponType}</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif; 
            background: ${this.config.colorScheme === 'dark' ? '#1a1a1a' : '#ffffff'};
            color: ${this.config.colorScheme === 'dark' ? '#ffffff' : '#000000'};
        }
        .viewer-container { 
            width: 100%; 
            height: 600px; 
            border: 1px solid #ccc; 
            position: relative;
            background: #f0f0f0;
        }
        .controls {
            margin: 20px 0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .control-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .metric-card {
            padding: 15px;
            background: ${this.config.colorScheme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
            border-radius: 8px;
            border: 1px solid ${this.config.colorScheme === 'dark' ? '#3a3a3a' : '#dee2e6'};
        }
        .hardpoint-marker {
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            transform: translate(-50%, -50%);
            cursor: pointer;
            transition: all 0.2s;
        }
        .hardpoint-marker:hover {
            transform: translate(-50%, -50%) scale(1.5);
        }
        .hardpoint-marker.primary-grip { background: #00ff00; }
        .hardpoint-marker.secondary-grip { background: #0000ff; }
        .hardpoint-marker.projectile-origin { background: #ff0000; }
        .hardpoint-marker.impact-point { background: #ffff00; }
        .hardpoint-marker.attachment { background: #ff00ff; }
        
        .confidence-indicator {
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .confidence-high { background: #28a745; color: white; }
        .confidence-medium { background: #ffc107; color: black; }
        .confidence-low { background: #dc3545; color: white; }
    </style>
</head>
<body>
    <h1>Hardpoint Analysis: ${hardpoints.weaponType}</h1>
    
    <div class="confidence-indicator ${this.getConfidenceClass(hardpoints.confidence)}">
        Confidence: ${(hardpoints.confidence * 100).toFixed(1)}%
    </div>
    
    <div class="viewer-container" id="viewer">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <h3>3D Model Viewer</h3>
            <p>Interactive 3D viewer would be loaded here with actual model data</p>
            <div style="width: 300px; height: 200px; background: #e0e0e0; margin: 20px auto; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                Model Preview
            </div>
        </div>
        
        ${this.renderHardpointMarkersHTML(hardpoints)}
    </div>
    
    <div class="controls">
        <div class="control-group">
            <label>View:</label>
            <select id="viewSelect">
                <option value="perspective">Perspective</option>
                <option value="orthographic">Orthographic</option>
                <option value="top">Top View</option>
                <option value="side">Side View</option>
            </select>
        </div>
        
        <div class="control-group">
            <label>Show:</label>
            <label><input type="checkbox" checked> Hardpoints</label>
            <label><input type="checkbox" checked> Orientation Vectors</label>
            <label><input type="checkbox"> Confidence Heatmap</label>
            <label><input type="checkbox"> Wireframe</label>
        </div>
    </div>
    
    <div class="metrics">
        ${this.renderHardpointMetricsHTML(hardpoints)}
    </div>
    
    <script>
        // Interactive viewer controls would be implemented here
        document.querySelectorAll('.hardpoint-marker').forEach(marker => {
            marker.addEventListener('click', function() {
                const type = this.className.match(/hardpoint-marker\\s+(\\S+)/)[1];
                const position = this.dataset.position;
                alert('Hardpoint: ' + type.replace('-', ' ') + '\\nPosition: ' + position);
            });
        });
    </script>
</body>
</html>`
  }

  /**
   * Generate accuracy report with improvement suggestions
   */
  private async generateAccuracyReport(
    hardpoints: DetectedHardpoints,
    accuracyMetrics?: HardpointAccuracyMetrics
  ): Promise<{
    overallScore: number
    detailedMetrics: HardpointAccuracyMetrics
    visualAccuracyMap: string
    improvementSuggestions: string[]
  }> {
    const metrics = accuracyMetrics || {
      overallScore: hardpoints.confidence,
      gripAccuracy: hardpoints.confidence,
      orientationAccuracy: hardpoints.confidence * 0.9,
      functionalityScore: hardpoints.confidence * 0.95,
      ergonomicsScore: hardpoints.confidence * 0.85,
      detailedMetrics: {
        gripPositionError: (1 - hardpoints.confidence) * 0.1,
        gripOrientationError: (1 - hardpoints.confidence) * 0.2,
        balancePointAccuracy: hardpoints.confidence * 0.9,
        functionalAlignmentScore: hardpoints.confidence * 0.95
      }
    }

    const visualAccuracyMap = await this.createAccuracyMap(hardpoints, metrics)
    const improvementSuggestions = this.generateImprovementSuggestions(hardpoints, metrics)

    return {
      overallScore: metrics.overallScore,
      detailedMetrics: metrics,
      visualAccuracyMap,
      improvementSuggestions
    }
  }

  /**
   * Export hardpoint assets (screenshots, data files)
   */
  private async exportHardpointAssets(
    hardpoints: DetectedHardpoints,
    visualizationData: string
  ): Promise<{
    screenshot: string
    modelFile?: string
    hardpointData: string
  }> {
    const hardpointData = JSON.stringify({
      weaponType: hardpoints.weaponType,
      hardpoints: {
        primaryGrip: hardpoints.primaryGrip,
        secondaryGrip: hardpoints.secondaryGrip,
        attachmentPoints: hardpoints.attachmentPoints,
        projectileOrigin: hardpoints.projectileOrigin,
        impactPoint: hardpoints.impactPoint
      },
      confidence: hardpoints.confidence,
      metadata: hardpoints.analysisMetadata
    }, null, 2)

    return {
      screenshot: visualizationData,
      hardpointData: btoa(hardpointData)
    }
  }

  /**
   * Draw model outline on canvas
   */
  private drawModelOutline(ctx: OffscreenCanvasRenderingContext2D, geometry: any, size: number): void {
    ctx.strokeStyle = this.config.colorScheme === 'dark' ? '#666' : '#333'
    ctx.lineWidth = 2
    
    // Draw simplified weapon outline based on type
    const centerX = size / 2
    const centerY = size / 2
    
    ctx.beginPath()
    ctx.roundRect(centerX - 20, centerY - 150, 40, 300, 5)
    ctx.stroke()
  }

  /**
   * Draw hardpoint markers on canvas
   */
  private drawHardpointMarkers(
    ctx: OffscreenCanvasRenderingContext2D,
    hardpoints: DetectedHardpoints,
    size: number
  ): void {
    const scale = size / 4 // Scale factor for positioning
    const centerX = size / 2
    const centerY = size / 2

    // Primary grip
    if (hardpoints.primaryGrip) {
      this.drawMarker(ctx, centerX, centerY + 50, '#00ff00', 'Primary Grip', hardpoints.primaryGrip.confidence)
    }

    // Secondary grip
    if (hardpoints.secondaryGrip) {
      this.drawMarker(ctx, centerX, centerY - 50, '#0000ff', 'Secondary Grip', hardpoints.secondaryGrip.confidence)
    }

    // Projectile origin
    if (hardpoints.projectileOrigin) {
      this.drawMarker(ctx, centerX - 30, centerY, '#ff0000', 'Projectile Origin', hardpoints.projectileOrigin.confidence)
    }

    // Impact point
    if (hardpoints.impactPoint) {
      this.drawMarker(ctx, centerX, centerY - 120, '#ffff00', 'Impact Point', hardpoints.impactPoint.confidence)
    }

    // Attachment points
    if (hardpoints.attachmentPoints) {
      hardpoints.attachmentPoints.forEach((point, index) => {
        this.drawMarker(
          ctx,
          centerX + (index - 1) * 40,
          centerY - 20,
          '#ff00ff',
          `Attachment ${index + 1}`,
          point.confidence
        )
      })
    }
  }

  /**
   * Draw a single hardpoint marker
   */
  private drawMarker(
    ctx: OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    label: string,
    confidence: number
  ): void {
    // Draw marker circle
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()

    // Draw confidence ring
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2 * confidence)
    ctx.stroke()

    // Draw label
    ctx.fillStyle = this.config.colorScheme === 'dark' ? '#fff' : '#000'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y - 20)
    ctx.fillText(`${(confidence * 100).toFixed(0)}%`, x, y + 25)
  }

  /**
   * Draw orientation vectors
   */
  private drawOrientationVectors(
    ctx: OffscreenCanvasRenderingContext2D,
    visualData: VisualizationData,
    size: number
  ): void {
    if (!visualData.orientationVectors) return

    for (const vector of visualData.orientationVectors) {
      const startX = size / 2
      const startY = size / 2
      const endX = startX + vector.direction.x * 50
      const endY = startY + vector.direction.y * 50

      ctx.strokeStyle = vector.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX)
      const arrowLength = 10
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - Math.PI / 6),
        endY - arrowLength * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + Math.PI / 6),
        endY - arrowLength * Math.sin(angle + Math.PI / 6)
      )
      ctx.stroke()
    }
  }

  /**
   * Draw confidence heatmap
   */
  private drawConfidenceHeatmap(
    ctx: OffscreenCanvasRenderingContext2D,
    visualData: VisualizationData,
    size: number
  ): void {
    if (!visualData.confidenceHeatmap) return

    const { vertices, confidenceValues } = visualData.confidenceHeatmap
    
    for (let i = 0; i < vertices.length && i < confidenceValues.length; i++) {
      const vertex = vertices[i]
      const confidence = confidenceValues[i]
      
      // Map 3D position to 2D canvas
      const x = (vertex.x + 1) * size / 2
      const y = (vertex.y + 1) * size / 2
      
      // Color based on confidence
      const red = Math.floor((1 - confidence) * 255)
      const green = Math.floor(confidence * 255)
      
      ctx.fillStyle = `rgba(${red}, ${green}, 0, 0.5)`
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /**
   * Draw legend and annotations
   */
  private drawLegend(
    ctx: OffscreenCanvasRenderingContext2D,
    hardpoints: DetectedHardpoints,
    size: number
  ): void {
    const legendX = 20
    const legendY = size - 150
    
    ctx.fillStyle = this.config.colorScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'
    ctx.fillRect(legendX - 10, legendY - 10, 200, 120)
    
    ctx.fillStyle = this.config.colorScheme === 'dark' ? '#fff' : '#000'
    ctx.font = '14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Legend', legendX, legendY)
    
    const legendItems = [
      { color: '#00ff00', label: 'Primary Grip' },
      { color: '#0000ff', label: 'Secondary Grip' },
      { color: '#ff0000', label: 'Projectile Origin' },
      { color: '#ffff00', label: 'Impact Point' },
      { color: '#ff00ff', label: 'Attachment Point' }
    ]
    
    legendItems.forEach((item, index) => {
      const y = legendY + 20 + index * 16
      
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.arc(legendX, y, 6, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = this.config.colorScheme === 'dark' ? '#fff' : '#000'
      ctx.fillText(item.label, legendX + 15, y + 4)
    })
  }

  /**
   * Draw accuracy annotations
   */
  private drawAccuracyAnnotations(
    ctx: OffscreenCanvasRenderingContext2D,
    hardpoints: DetectedHardpoints,
    size: number
  ): void {
    // Overall confidence score
    ctx.fillStyle = this.config.colorScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'
    ctx.fillRect(size - 180, 20, 160, 80)
    
    ctx.fillStyle = this.config.colorScheme === 'dark' ? '#fff' : '#000'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Overall Confidence', size - 170, 40)
    
    ctx.font = 'bold 24px Arial'
    const confidenceColor = hardpoints.confidence > 0.8 ? '#00ff00' : 
                           hardpoints.confidence > 0.6 ? '#ffff00' : '#ff0000'
    ctx.fillStyle = confidenceColor
    ctx.fillText(`${(hardpoints.confidence * 100).toFixed(1)}%`, size - 170, 70)
    
    // Processing time
    ctx.fillStyle = this.config.colorScheme === 'dark' ? '#fff' : '#000'
    ctx.font = '12px Arial'
    ctx.fillText(`Processing: ${hardpoints.analysisMetadata.processingTime}ms`, size - 170, 90)
  }

  /**
   * Create fallback visualization when canvas is not available
   */
  private createFallbackVisualization(hardpoints: DetectedHardpoints): string {
    const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${this.config.colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5'}"/>
  <text x="256" y="100" text-anchor="middle" fill="${this.config.colorScheme === 'dark' ? '#fff' : '#000'}" font-size="24">
    ${hardpoints.weaponType} Hardpoints
  </text>
  <text x="256" y="130" text-anchor="middle" fill="${this.config.colorScheme === 'dark' ? '#fff' : '#000'}" font-size="16">
    Confidence: ${(hardpoints.confidence * 100).toFixed(1)}%
  </text>
  <!-- Simplified weapon outline -->
  <rect x="236" y="150" width="40" height="200" fill="none" stroke="${this.config.colorScheme === 'dark' ? '#666' : '#333'}" stroke-width="2"/>
  <!-- Primary grip marker -->
  <circle cx="256" cy="280" r="8" fill="#00ff00"/>
  <text x="256" y="305" text-anchor="middle" fill="${this.config.colorScheme === 'dark' ? '#fff' : '#000'}" font-size="12">Primary Grip</text>
</svg>`
    
    return btoa(svg)
  }

  /**
   * Utility methods for batch reporting
   */
  private calculateBatchSummary(results: GenerationResult[], progress: BatchProgress): any {
    const successful = results.filter(r => r.status === 'completed').length
    const failed = results.filter(r => r.status === 'failed').length
    const cacheHits = results.filter(r => r.metadata.cacheHit).length
    
    const totalProcessingTime = results.reduce((sum, r) => sum + r.metadata.processingTime, 0)
    
    return {
      totalItems: results.length,
      successRate: results.length > 0 ? successful / results.length : 0,
      averageAccuracy: 0.85, // Placeholder
      processingTime: totalProcessingTime,
      cacheHitRate: results.length > 0 ? cacheHits / results.length : 0
    }
  }

  private analyzeCategoryBreakdown(results: GenerationResult[]): any[] {
    const categories = new Map<string, any>()
    
    for (const result of results) {
      const category = result.id.split('_')[0] // Extract category from ID
      if (!categories.has(category)) {
        categories.set(category, {
          category,
          count: 0,
          successful: 0,
          totalProcessingTime: 0
        })
      }
      
      const cat = categories.get(category)!
      cat.count++
      if (result.status === 'completed') cat.successful++
      cat.totalProcessingTime += result.metadata.processingTime
    }
    
    return Array.from(categories.values()).map(cat => ({
      category: cat.category,
      count: cat.count,
      successRate: cat.successful / cat.count,
      averageAccuracy: 0.85, // Placeholder
      averageProcessingTime: cat.totalProcessingTime / cat.count
    }))
  }

  private calculateAccuracyDistribution(results: GenerationResult[]): any {
    return {
      excellent: Math.floor(results.length * 0.4),
      good: Math.floor(results.length * 0.3),
      fair: Math.floor(results.length * 0.2),
      poor: Math.floor(results.length * 0.1)
    }
  }

  private async createBatchVisualizations(results: GenerationResult[], progress: BatchProgress): Promise<any> {
    return {
      progressChart: btoa('<svg>Progress Chart Placeholder</svg>'),
      accuracyHeatmap: btoa('<svg>Accuracy Heatmap Placeholder</svg>'),
      categoryComparison: btoa('<svg>Category Comparison Placeholder</svg>'),
      timelineView: btoa('<svg>Timeline View Placeholder</svg>')
    }
  }

  private async createDetailedResults(results: GenerationResult[]): Promise<any[]> {
    return results.map(result => ({
      id: result.id,
      name: result.id.replace(/[_\d]/g, ' '),
      category: result.id.split('_')[0],
      accuracy: 0.85, // Placeholder
      processingTime: result.metadata.processingTime,
      thumbnail: btoa('<svg>Thumbnail Placeholder</svg>'),
      issues: result.status === 'failed' ? [result.metadata.errorMessage || 'Unknown error'] : []
    }))
  }

  private renderProgressBar(progress: BatchProgress): string {
    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
    return `<div style="width: 100%; background: #f0f0f0; border-radius: 4px;">
      <div style="width: ${percentage}%; background: #007bff; height: 20px; border-radius: 4px; transition: width 0.3s;"></div>
    </div>`
  }

  private renderThroughputGraph(progress: BatchProgress): string {
    return `<div style="width: 100%; height: 100px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
      Throughput: ${progress.throughputPerHour.toFixed(1)} items/hour
    </div>`
  }

  private renderQueueStatus(progress: BatchProgress): string {
    return `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
      <div style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 4px;">
        <div style="font-weight: bold;">${progress.pending}</div>
        <div style="font-size: 12px;">Pending</div>
      </div>
      <div style="text-align: center; padding: 10px; background: #fff3e0; border-radius: 4px;">
        <div style="font-weight: bold;">${progress.processing}</div>
        <div style="font-size: 12px;">Processing</div>
      </div>
      <div style="text-align: center; padding: 10px; background: #e8f5e8; border-radius: 4px;">
        <div style="font-weight: bold;">${progress.completed}</div>
        <div style="font-size: 12px;">Completed</div>
      </div>
      <div style="text-align: center; padding: 10px; background: #ffebee; border-radius: 4px;">
        <div style="font-weight: bold;">${progress.failed}</div>
        <div style="font-size: 12px;">Failed</div>
      </div>
    </div>`
  }

  private calculateRealtimeMetrics(progress: BatchProgress, activeGenerations: any[]): any {
    return {
      itemsPerHour: progress.throughputPerHour,
      averageAccuracy: 0.85, // Placeholder
      cacheHitRate: 0.4, // Placeholder
      errorRate: progress.total > 0 ? progress.failed / progress.total : 0
    }
  }

  private getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'confidence-high'
    if (confidence >= 0.6) return 'confidence-medium'
    return 'confidence-low'
  }

  private renderHardpointMarkersHTML(hardpoints: DetectedHardpoints): string {
    let markers = ''
    
    if (hardpoints.primaryGrip) {
      markers += `<div class="hardpoint-marker primary-grip" 
        style="top: 60%; left: 50%;" 
        data-position="${JSON.stringify(hardpoints.primaryGrip.position)}"
        title="Primary Grip (${(hardpoints.primaryGrip.confidence * 100).toFixed(1)}%)"></div>`
    }
    
    if (hardpoints.secondaryGrip) {
      markers += `<div class="hardpoint-marker secondary-grip" 
        style="top: 40%; left: 50%;" 
        data-position="${JSON.stringify(hardpoints.secondaryGrip.position)}"
        title="Secondary Grip (${(hardpoints.secondaryGrip.confidence * 100).toFixed(1)}%)"></div>`
    }
    
    return markers
  }

  private renderHardpointMetricsHTML(hardpoints: DetectedHardpoints): string {
    return `
      <div class="metric-card">
        <h4>Detection Confidence</h4>
        <div style="font-size: 24px; font-weight: bold; color: ${this.getConfidenceColor(hardpoints.confidence)};">
          ${(hardpoints.confidence * 100).toFixed(1)}%
        </div>
      </div>
      <div class="metric-card">
        <h4>Processing Time</h4>
        <div style="font-size: 20px;">${hardpoints.analysisMetadata.processingTime}ms</div>
      </div>
      <div class="metric-card">
        <h4>Detected Hardpoints</h4>
        <div style="font-size: 20px;">${this.countDetectedHardpoints(hardpoints)}</div>
      </div>
      <div class="metric-card">
        <h4>Weapon Type</h4>
        <div style="font-size: 20px; text-transform: capitalize;">${hardpoints.weaponType}</div>
      </div>
    `
  }

  private getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#28a745'
    if (confidence >= 0.6) return '#ffc107'
    return '#dc3545'
  }

  private countDetectedHardpoints(hardpoints: DetectedHardpoints): number {
    let count = 0
    if (hardpoints.primaryGrip) count++
    if (hardpoints.secondaryGrip) count++
    if (hardpoints.projectileOrigin) count++
    if (hardpoints.impactPoint) count++
    count += hardpoints.attachmentPoints?.length || 0
    return count
  }

  private async createAccuracyMap(
    hardpoints: DetectedHardpoints,
    metrics: HardpointAccuracyMetrics
  ): Promise<string> {
    // Create a simple accuracy visualization
    return btoa('<svg>Accuracy Map Placeholder</svg>')
  }

  private generateImprovementSuggestions(
    hardpoints: DetectedHardpoints,
    metrics: HardpointAccuracyMetrics
  ): string[] {
    const suggestions: string[] = []
    
    if (metrics.gripAccuracy < 0.8) {
      suggestions.push('Consider adjusting the primary grip detection algorithm for better accuracy')
    }
    
    if (metrics.orientationAccuracy < 0.8) {
      suggestions.push('Orientation detection could be improved with better geometric analysis')
    }
    
    if (metrics.functionalityScore < 0.8) {
      suggestions.push('Review weapon-specific functional requirements')
    }
    
    if (hardpoints.confidence < 0.7) {
      suggestions.push('Overall confidence is low - consider manual review and adjustment')
    }
    
    return suggestions
  }

  private initializeCanvas(): void {
    try {
      this.canvas = new OffscreenCanvas(this.config.exportResolution, this.config.exportResolution)
      this.ctx = this.canvas.getContext('2d')
    } catch (error) {
      console.warn('OffscreenCanvas not available, falling back to SVG generation')
    }
  }
}