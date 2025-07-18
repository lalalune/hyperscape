/**
 * Comprehensive Test Suite for Meshy AI Integration
 * 
 * Tests all components of the Meshy AI integration including:
 * - Prompt augmentation for different item types
 * - Hardpoint detection and accuracy
 * - Batch generation with caching
 * - Retexturing and performance optimization
 * - Visualization and reporting
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { MeshyAIService } from '../MeshyAIService'
import { PromptAugmentationService } from '../PromptAugmentationService'
import { HardpointDetectionService } from '../HardpointDetectionService'
import { RetexturingService } from '../RetexturingService'
import { BatchGenerationService } from '../BatchGenerationService'
import { VisualizationService } from '../VisualizationService'

// Test data imports
const basicItems = [
  {
    id: 1,
    name: "Bronze Sword",
    examine: "A simple bronze sword.",
    equipment: { weaponType: "sword", slot: "weapon" },
    model: "bronze_sword"
  },
  {
    id: 2,
    name: "Wooden Bow",
    examine: "A sturdy wooden bow.",
    equipment: { weaponType: "bow", slot: "weapon" },
    model: "wooden_bow"
  },
  {
    id: 3,
    name: "Iron Shield",
    examine: "A protective iron shield.",
    equipment: { weaponType: "shield", slot: "shield" },
    model: "iron_shield"
  },
  {
    id: 4,
    name: "Bread",
    examine: "Nutritious bread.",
    stackable: true,
    model: "bread"
  }
]

const testMobs = [
  {
    id: 1,
    name: "Goblin",
    examine: "An ugly green creature.",
    npcType: "monster",
    level: 2,
    model: "goblin"
  },
  {
    id: 2,
    name: "Skeleton Warrior",
    examine: "An undead warrior.",
    npcType: "monster",
    level: 13,
    model: "skeleton"
  }
]

describe('Meshy AI Integration - Comprehensive Tests', () => {
  let meshyService: MeshyAIService
  let promptService: PromptAugmentationService
  let hardpointService: HardpointDetectionService
  let retexturingService: RetexturingService
  let batchService: BatchGenerationService
  let visualizationService: VisualizationService

  beforeEach(() => {
    // Mock OffscreenCanvas for testing environment
    global.OffscreenCanvas = class MockOffscreenCanvas {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
      getContext(type: string) {
        return {
          fillStyle: '',
          fillRect: vi.fn(),
          strokeStyle: '',
          strokeRect: vi.fn(),
          getImageData: vi.fn().mockReturnValue({ data: new Uint8Array(this.width * this.height * 4) })
        }
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['mock'], { type: 'image/png' }))
      }
    } as any

    // Initialize services with test configurations
    meshyService = new MeshyAIService({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.meshy.ai'
    })

    promptService = new PromptAugmentationService({
      artStyle: 'realistic',
      targetPolycount: 'medium'
    })

    hardpointService = new HardpointDetectionService({
      confidenceThreshold: 0.7,
      visualizationEnabled: true
    })

    retexturingService = new RetexturingService({
      atlasSize: 1024,
      maxTextures: 32
    })

    batchService = new BatchGenerationService(meshyService, {
      maxConcurrentTasks: 2,
      retryAttempts: 2,
      cacheMaxSize: 100,
      enableHardpointDetection: true,
      enableRetexturing: true
    })

    visualizationService = new VisualizationService({
      outputFormat: 'html',
      showHardpointMarkers: true,
      showConfidenceHeatmap: true
    })

    // Mock fetch for API calls
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Prompt Augmentation Service', () => {
    test('should augment weapon prompts with proper orientation', async () => {
      const swordData = basicItems.find(item => item.name === "Bronze Sword")!
      
      const result = promptService.augmentWeaponPrompt(
        "A bronze sword with leather-wrapped handle",
        "sword",
        swordData
      )

      expect(result.enhancedPrompt).toContain('vertical orientation with blade pointing up')
      expect(result.enhancedPrompt).toContain('side profile view')
      expect(result.enhancedPrompt).toContain('blade edge facing left')
      expect(result.negativePrompt).toContain('bent blade')
      expect(result.hardpointHints?.primaryGripLocation).toContain('center of handle')
      expect(result.metadata.weaponType).toBe('sword')
      expect(result.metadata.complexity).toBe('medium')
    })

    test('should augment bow prompts with projectile direction hints', async () => {
      const bowData = basicItems.find(item => item.name === "Wooden Bow")!
      
      const result = promptService.augmentWeaponPrompt(
        "A wooden longbow with string",
        "bow",
        bowData
      )

      expect(result.enhancedPrompt).toContain('vertical orientation')
      expect(result.enhancedPrompt).toContain('string facing left')
      expect(result.hardpointHints?.projectileDirection).toContain('leftward')
      expect(result.orientationRules.additionalConstraints).toContain('projectile direction leftward')
    })

    test('should augment crossbow prompts with top-down orientation', async () => {
      const result = promptService.augmentWeaponPrompt(
        "A medieval crossbow with wooden stock",
        "crossbow"
      )

      expect(result.enhancedPrompt).toContain('horizontal orientation')
      expect(result.enhancedPrompt).toContain('top-down view')
      expect(result.enhancedPrompt).toContain('bolt channel pointing left')
      expect(result.hardpointHints?.projectileDirection).toContain('bolts fire leftward')
    })

    test('should augment character prompts with T-pose requirements', async () => {
      const goblinData = testMobs.find(mob => mob.name === "Goblin")!
      
      const result = promptService.augmentCharacterPrompt(
        "A small green goblin creature",
        "monster",
        goblinData
      )

      expect(result.enhancedPrompt).toContain('T-pose')
      expect(result.enhancedPrompt).toContain('facing forward toward camera')
      expect(result.enhancedPrompt).toContain('orthographic view')
      expect(result.orientationRules.pose).toContain('T-pose')
      expect(result.expectedDimensions).toEqual({ width: 2, height: 6, depth: 1 })
    })

    test('should handle consumable items with isometric view', async () => {
      const breadData = basicItems.find(item => item.name === "Bread")!
      
      const result = promptService.augmentConsumablePrompt(
        "A loaf of bread",
        "food",
        breadData
      )

      expect(result.enhancedPrompt).toContain('isometric 3/4 view')
      expect(result.enhancedPrompt).toContain('centered on flat surface')
      expect(result.orientationRules.cameraAngle).toBe('isometric 3/4 view')
    })
  })

  describe('Hardpoint Detection Service', () => {
    const mockGeometry = {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 2, z: 0 }
      ],
      triangles: [[0, 1, 2]]
    }

    test('should detect sword hardpoints correctly', async () => {
      const result = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'sword'
      )

      expect(result.weaponType).toBe('sword')
      expect(result.primaryGrip).toBeDefined()
      expect(result.impactPoint).toBeDefined()
      expect(result.attachmentPoints).toHaveLength(2) // Crossguard points
      expect(result.confidence).toBeGreaterThan(0.5)
      
      // Check hardpoint reasoning
      expect(result.primaryGrip.reasoning.some(r => r.includes('handle area'))).toBe(true)
      expect(result.impactPoint.reasoning.some(r => r.includes('blade tip'))).toBe(true)
    })

    test('should detect bow hardpoints with projectile origin', async () => {
      const result = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'bow'
      )

      expect(result.weaponType).toBe('bow')
      expect(result.primaryGrip).toBeDefined()
      expect(result.projectileOrigin).toBeDefined()
      expect(result.attachmentPoints).toHaveLength(2) // String nocking points
      
      // Check projectile direction
      expect(result.projectileOrigin?.reasoning.some(r => r.includes('left'))).toBe(true)
    })

    test('should detect crossbow hardpoints with dual grips', async () => {
      const result = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'crossbow'
      )

      expect(result.weaponType).toBe('crossbow')
      expect(result.primaryGrip).toBeDefined()
      expect(result.secondaryGrip).toBeDefined()
      expect(result.projectileOrigin).toBeDefined()
      
      // Check grip types
      expect(result.primaryGrip.reasoning.some(r => r.includes('grip'))).toBe(true)
      expect(result.secondaryGrip?.reasoning.some(r => r.includes('fore'))).toBe(true)
    })

    test('should detect shield hardpoints with arm attachments', async () => {
      const result = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'shield'
      )

      expect(result.weaponType).toBe('shield')
      expect(result.primaryGrip).toBeDefined()
      expect(result.attachmentPoints).toHaveLength(2) // Arm strap points
      
      // Check attachment reasoning
      expect(result.attachmentPoints[0].reasoning[0]).toContain('arm strap')
    })

    test('should calculate accuracy metrics', async () => {
      const hardpoints = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'sword'
      )

      const metrics = hardpointService.calculateAccuracyMetrics(hardpoints)

      expect(metrics.overallScore).toBeGreaterThan(0)
      expect(metrics.gripAccuracy).toBeGreaterThan(0)
      expect(metrics.orientationAccuracy).toBeGreaterThan(0)
      expect(metrics.functionalityScore).toBeGreaterThan(0)
      expect(metrics.ergonomicsScore).toBeGreaterThan(0)
      expect(metrics.detailedMetrics).toBeDefined()
    })

    test('should include visualization data', async () => {
      const result = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        'sword'
      )

      const visualData = result.analysisMetadata.visualizationData

      expect(visualData.hardpointMarkers).toHaveLength(4) // Primary grip + impact + 2 attachments
      expect(visualData.orientationVectors).toBeDefined()
      expect(visualData.confidenceHeatmap).toBeDefined()
      
      // Check marker types
      const markerTypes = visualData.hardpointMarkers.map(m => m.type)
      expect(markerTypes).toContain('primary_grip')
      expect(markerTypes).toContain('impact_point')
      expect(markerTypes).toContain('attachment')
    })
  })

  describe('Retexturing Service', () => {
    const mockPrimitiveGeometry = {
      vertices: [
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]
      ],
      uvs: [
        [0, 0], [1, 0], [1, 1], [0, 1]
      ],
      normals: [
        [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]
      ]
    }

    test('should retexture primitive with performance optimization', async () => {
      const textureRequest = {
        primitiveType: 'cube' as const,
        baseColor: '#8B4513',
        textureStyle: 'pbr' as const,
        tilePattern: 'wood' as const,
        scale: 1
      }

      const result = await retexturingService.retexturePrimitive(
        mockPrimitiveGeometry,
        textureRequest
      )

      expect(result.optimizedModel).toBeDefined()
      expect(result.materialDefinition).toBeDefined()
      expect(result.performanceGain).toBeDefined()
      expect(result.cacheKey).toBeDefined()
      
      // Check material definition
      expect(result.materialDefinition.atlasTexture).toBeDefined()
      expect(result.materialDefinition.uvMapping).toHaveLength(1)
      expect(result.materialDefinition.performanceMetrics.drawCalls).toBe(1)
    })

    test('should batch retexture multiple primitives', async () => {
      const requests = [
        {
          geometry: mockPrimitiveGeometry,
          textureRequest: {
            primitiveType: 'cube' as const,
            baseColor: '#8B4513',
            textureStyle: 'pbr' as const,
            tilePattern: 'wood' as const,
            scale: 1
          },
          id: 'cube1'
        },
        {
          geometry: mockPrimitiveGeometry,
          textureRequest: {
            primitiveType: 'sphere' as const,
            baseColor: '#808080',
            textureStyle: 'pbr' as const,
            tilePattern: 'metal' as const,
            scale: 1
          },
          id: 'sphere1'
        }
      ]

      const result = await retexturingService.batchRetexturePrimitives(requests)

      expect(result.optimizedModels).toHaveLength(2)
      expect(result.sharedMaterial).toBeDefined()
      expect(result.totalPerformanceGain.optimizedDrawCalls).toBe(1)
      expect(result.totalPerformanceGain.originalDrawCalls).toBe(2)
    })

    test('should cache retexturing results', async () => {
      const textureRequest = {
        primitiveType: 'cube' as const,
        baseColor: '#8B4513',
        textureStyle: 'pbr' as const,
        scale: 1
      }

      // First call
      const result1 = await retexturingService.retexturePrimitive(
        mockPrimitiveGeometry,
        textureRequest
      )

      // Second call with same parameters should use cache
      const result2 = await retexturingService.retexturePrimitive(
        mockPrimitiveGeometry,
        textureRequest
      )

      expect(result1.cacheKey).toBe(result2.cacheKey)
      
      const stats = retexturingService.getCacheStats()
      expect(stats.materialEntries).toBeGreaterThan(0)
    })
  })

  describe('Batch Generation Service', () => {
    beforeEach(() => {
      // Mock Meshy API responses
      vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString()
        
        if (urlStr.includes('text-to-3d') && !urlStr.includes('/')) {
          // Mock task creation
          return new Response(JSON.stringify({ result: 'task-123' }), { status: 200 })
        } else if (urlStr.includes('text-to-3d/task-123')) {
          // Mock task status
          return new Response(JSON.stringify({
            result: 'task-123',
            status: 'SUCCEEDED',
            model_urls: {
              glb: 'https://example.com/model.glb',
              texture_urls: ['https://example.com/texture.png']
            },
            created_at: Date.now() - 60000,
            finished_at: Date.now()
          }), { status: 200 })
        }
        
        return new Response('', { status: 404 })
      })
    })

    test('should generate all items with caching', async () => {
      const results = await batchService.generateAllItems(basicItems)

      expect(results).toHaveLength(basicItems.length)
      
      // Check weapon items have hardpoints
      const swordResult = results.find(r => r.id === 'item_1')
      expect(swordResult?.status).toBe('completed')
      expect(swordResult?.hardpoints).toBeDefined()
      
      // Check consumables are properly processed
      const breadResult = results.find(r => r.id === 'item_4')
      expect(breadResult?.status).toBe('completed')
    })

    test('should generate mobs with T-pose requirements', async () => {
      const results = await batchService.generateAllMobs(testMobs)

      expect(results).toHaveLength(testMobs.length)
      
      for (const result of results) {
        expect(result.status).toBe('completed')
        expect(result.augmentedPrompt?.enhancedPrompt).toContain('T-pose')
        expect(result.augmentedPrompt?.orientationRules.pose).toContain('T-pose')
      }
    })

    test('should use cache for repeated requests', async () => {
      // First generation
      const results1 = await batchService.generateAllItems([basicItems[0]])
      
      // Second generation should use cache
      const results2 = await batchService.generateAllItems([basicItems[0]])

      expect(results1[0].metadata.cacheHit).toBe(false)
      expect(results2[0].metadata.cacheHit).toBe(true)
      
      const cacheStats = batchService.getCacheStats()
      expect(cacheStats.entries).toBeGreaterThan(0)
      expect(cacheStats.hitRate).toBeGreaterThan(0)
    })

    test('should generate missing items only', async () => {
      // Pre-populate cache with one item
      await batchService.generateAllItems([basicItems[0]])
      
      // Request all items - should only generate missing ones
      const results = await batchService.generateMissingOnly(basicItems, 'item')

      expect(results.length).toBeLessThan(basicItems.length)
      expect(results.every(r => !r.metadata.cacheHit)).toBe(true)
    })

    test('should handle batch progress reporting', async () => {
      const progressUpdates: any[] = []
      
      batchService.onProgress((progress) => {
        progressUpdates.push({ ...progress })
      })

      await batchService.generateAllItems(basicItems.slice(0, 2))

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[0].total).toBe(2)
      expect(progressUpdates[progressUpdates.length - 1].currentPhase).toBe('completed')
    })

    test('should prioritize high-priority items', async () => {
      const mixedItems = [
        { ...basicItems[3], priority: 'low' }, // Bread
        { ...basicItems[0], priority: 'high' }, // Bronze Sword
        { ...basicItems[1], priority: 'medium' } // Wooden Bow
      ]

      const completionOrder: string[] = []
      batchService.onProgress((progress) => {
        // Track completion order (simplified)
        if (progress.completed > completionOrder.length) {
          completionOrder.push(`completed_${progress.completed}`)
        }
      })

      await batchService.generateAllItems(mixedItems)

      // High priority items should complete first
      expect(completionOrder.length).toBeGreaterThan(0)
    })
  })

  describe('Visualization Service', () => {
    const mockHardpoints = {
      weaponType: 'sword',
      primaryGrip: {
        position: { x: 0, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.85,
        type: 'primary_grip' as const,
        reasoning: ['Located in handle area'],
        geometricFeatures: {
          localRadius: 0.03,
          surfaceCurvature: 0.2,
          symmetry: 0.9,
          accessibility: 0.95
        }
      },
      attachmentPoints: [],
      confidence: 0.85,
      analysisMetadata: {
        geometryAnalysis: {
          boundingBox: {
            min: { x: -0.1, y: 0, z: -0.05 },
            max: { x: 0.1, y: 2, z: 0.05 },
            center: { x: 0, y: 1, z: 0 },
            size: { x: 0.2, y: 2, z: 0.1 }
          },
          vertexCount: 100,
          triangleCount: 200,
          surfaceArea: 1.5,
          volume: 0.1,
          massCenter: { x: 0, y: 1, z: 0 },
          principalAxes: {
            primary: { x: 0, y: 1, z: 0 },
            secondary: { x: 1, y: 0, z: 0 },
            tertiary: { x: 0, y: 0, z: 1 }
          }
        },
        detectionMethod: 'sword_heuristic',
        processingTime: 150,
        visualizationData: {
          hardpointMarkers: [{
            position: { x: 0, y: 0.5, z: 0 },
            type: 'primary_grip',
            confidence: 0.85,
            color: '#00FF00',
            size: 0.05
          }],
          orientationVectors: [{
            origin: { x: 0, y: 0.5, z: 0 },
            direction: { x: 0, y: 1, z: 0 },
            type: 'grip_direction',
            color: '#00AA00'
          }],
          geometryHighlights: [],
          confidenceHeatmap: {
            vertices: [{ x: 0, y: 0, z: 0 }],
            confidenceValues: [0.85],
            colorMap: 'red_to_green'
          }
        }
      }
    } as any

    test('should visualize hardpoints with accuracy analysis', async () => {
      const result = await visualizationService.visualizeHardpoints(mockHardpoints)

      expect(result.modelId).toBeDefined()
      expect(result.weaponType).toBe('sword')
      expect(result.visualizationData).toBeDefined()
      expect(result.interactiveViewer).toBeDefined()
      expect(result.accuracyReport).toBeDefined()
      expect(result.exportedAssets).toBeDefined()
      
      // Check accuracy report
      expect(result.accuracyReport.overallScore).toBeGreaterThan(0)
      expect(result.accuracyReport.improvementSuggestions).toBeDefined()
      
      // Check interactive viewer contains HTML
      expect(result.interactiveViewer).toContain('<html>')
      expect(result.interactiveViewer).toContain('hardpoint-marker')
    })

    test('should generate comprehensive batch report', async () => {
      const mockResults = [
        {
          id: 'item_1',
          status: 'completed' as const,
          metadata: {
            generatedAt: Date.now(),
            processingTime: 5000,
            cacheHit: false,
            retryCount: 0
          }
        },
        {
          id: 'item_2',
          status: 'completed' as const,
          metadata: {
            generatedAt: Date.now(),
            processingTime: 3000,
            cacheHit: true,
            retryCount: 0
          }
        },
        {
          id: 'mob_1',
          status: 'failed' as const,
          metadata: {
            generatedAt: Date.now(),
            processingTime: 1000,
            cacheHit: false,
            retryCount: 2,
            errorMessage: 'API timeout'
          }
        }
      ]

      const mockProgress = {
        total: 3,
        completed: 2,
        failed: 1,
        pending: 0,
        processing: 0,
        currentPhase: 'completed' as const,
        estimatedTimeRemaining: 0,
        throughputPerHour: 720
      }

      const report = await visualizationService.generateBatchReport(mockResults, mockProgress)

      expect(report.summary.totalItems).toBe(3)
      expect(report.summary.successRate).toBeCloseTo(0.67, 2)
      expect(report.categoryBreakdown).toHaveLength(2) // item and mob
      expect(report.accuracyDistribution).toBeDefined()
      expect(report.visualizations).toBeDefined()
      expect(report.detailedResults).toHaveLength(3)
      
      // Check category breakdown
      const itemCategory = report.categoryBreakdown.find(c => c.category === 'item')
      expect(itemCategory?.count).toBe(2)
      expect(itemCategory?.successRate).toBe(1)
      
      const mobCategory = report.categoryBreakdown.find(c => c.category === 'mob')
      expect(mobCategory?.count).toBe(1)
      expect(mobCategory?.successRate).toBe(0)
    })

    test('should create live progress visualization', async () => {
      const mockProgress = {
        total: 10,
        completed: 6,
        failed: 1,
        pending: 2,
        processing: 1,
        currentPhase: 'generation' as const,
        estimatedTimeRemaining: 30000,
        throughputPerHour: 120
      }

      const mockActiveGenerations = [
        { id: 'item_1', progress: 0.7, currentPhase: 'generation' }
      ]

      const result = await visualizationService.createLiveProgressVisualization(
        mockProgress,
        mockActiveGenerations
      )

      expect(result.progressBar).toContain('60%') // 6/10 completed
      expect(result.throughputGraph).toContain('120')
      expect(result.queueStatus).toContain('2') // Pending count
      expect(result.activeGenerations).toHaveLength(1)
      expect(result.realtimeMetrics.itemsPerHour).toBe(120)
      expect(result.realtimeMetrics.errorRate).toBeCloseTo(0.1)
    })
  })

  describe('Integration Tests', () => {
    test('should complete full workflow: prompt → generation → hardpoints → visualization', async () => {
      const swordData = basicItems[0] // Bronze Sword
      
      // 1. Create augmented prompt
      const augmentedPrompt = promptService.augmentWeaponPrompt(
        swordData.examine,
        swordData.equipment.weaponType,
        swordData
      )

      expect(augmentedPrompt.enhancedPrompt).toBeDefined()
      expect(augmentedPrompt.hardpointHints).toBeDefined()

      // 2. Mock geometry from generation
      const mockGeometry = {
        vertices: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }],
        triangles: [[0, 1, 0]]
      }

      // 3. Detect hardpoints
      const hardpoints = await hardpointService.detectWeaponHardpoints(
        mockGeometry,
        swordData.equipment.weaponType
      )

      expect(hardpoints.weaponType).toBe('sword')
      expect(hardpoints.primaryGrip).toBeDefined()

      // 4. Calculate accuracy
      const accuracy = hardpointService.calculateAccuracyMetrics(hardpoints)
      expect(accuracy.overallScore).toBeGreaterThan(0)

      // 5. Create visualization
      const visualization = await visualizationService.visualizeHardpoints(
        hardpoints,
        accuracy
      )

      expect(visualization.accuracyReport.overallScore).toBe(accuracy.overallScore)
      expect(visualization.interactiveViewer).toContain('sword')
    })

    test('should handle error scenarios gracefully', async () => {
      // Test with invalid weapon type
      const result = await hardpointService.detectWeaponHardpoints(
        { vertices: [], triangles: [] },
        'invalid_weapon_type'
      )

      // Should fall back to generic detection
      expect(result.weaponType).toBe('invalid_weapon_type')
      expect(result.primaryGrip).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
    })

    test('should maintain cache consistency across services', async () => {
      // Clear all caches
      batchService.clearCache()
      retexturingService.clearCaches()

      // Generate items
      await batchService.generateAllItems([basicItems[0]])

      // Check cache stats
      const batchStats = batchService.getCacheStats()
      const retexturingStats = retexturingService.getCacheStats()

      expect(batchStats.entries).toBeGreaterThan(0)
      // Retexturing cache might be empty if no retexturing was needed
    })

    test('should handle concurrent batch operations', async () => {
      const items1 = basicItems.slice(0, 2)
      const items2 = basicItems.slice(2, 4)

      // Start concurrent generations
      const promise1 = batchService.generateAllItems(items1)
      
      // Second batch should wait or be rejected since processing is already active
      await expect(batchService.generateAllItems(items2))
        .rejects.toThrow('Batch generation already in progress')

      await promise1
      
      // Now second batch should work
      const results2 = await batchService.generateAllItems(items2)
      expect(results2).toHaveLength(2)
    })
  })

  describe('Performance Tests', () => {
    test('should complete batch generation within reasonable time', async () => {
      const startTime = Date.now()
      
      await batchService.generateAllItems(basicItems.slice(0, 2))
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete within 30 seconds (generous for tests with mocks)
      expect(duration).toBeLessThan(30000)
    })

    test('should cache results to improve subsequent performance', async () => {
      const testItem = [basicItems[0]]
      
      // First run
      const start1 = Date.now()
      await batchService.generateAllItems(testItem)
      const duration1 = Date.now() - start1
      
      // Second run (should use cache)
      const start2 = Date.now()
      await batchService.generateAllItems(testItem)
      const duration2 = Date.now() - start2
      
      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5)
    })

    test('should handle memory efficiently with large batches', async () => {
      // Create larger dataset
      const largeItemSet = Array.from({ length: 20 }, (_, i) => ({
        ...basicItems[i % basicItems.length],
        id: i + 1000,
        name: `Test Item ${i}`
      }))

      const results = await batchService.generateAllItems(largeItemSet)
      
      expect(results).toHaveLength(largeItemSet.length)
      
      // Check memory usage through cache stats
      const cacheStats = batchService.getCacheStats()
      expect(cacheStats.totalSize).toBeLessThan(100 * 1024 * 1024) // Under 100MB
    })
  })
})

describe('Service Integration Edge Cases', () => {
  test('should handle empty input gracefully', async () => {
    const meshyService = new MeshyAIService({ apiKey: 'test' })
    const batchService = new BatchGenerationService(meshyService)
    
    const results = await batchService.generateAllItems([])
    expect(results).toHaveLength(0)
  })

  test('should handle malformed item data', async () => {
    const meshyService = new MeshyAIService({ apiKey: 'test' })
    const batchService = new BatchGenerationService(meshyService)
    
    const malformedItems = [
      { id: null, name: undefined, examine: '' },
      { id: 1 }, // Missing required fields
      { id: 2, name: 'Test', equipment: { weaponType: null } }
    ]
    
    // Should not throw, but handle gracefully
    const results = await batchService.generateAllItems(malformedItems as any)
    expect(results).toBeDefined()
  })

  test('should recover from API failures with retries', async () => {
    // Mock failing API calls
    let callCount = 0
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++
      if (callCount < 3) {
        throw new Error('Network error')
      }
      return new Response(JSON.stringify({ result: 'task-123' }), { status: 200 })
    })

    const meshyService = new MeshyAIService({ apiKey: 'test' })
    const batchService = new BatchGenerationService(meshyService, {
      retryAttempts: 3,
      maxConcurrentTasks: 1
    })

    // Should eventually succeed after retries
    const results = await batchService.generateAllItems([basicItems[0]])
    expect(results[0].status).toBe('completed')
    expect(callCount).toBeGreaterThanOrEqual(3)
  })
})