/**
 * Integration tests for AI Creation System
 * Tests the complete workflow from text/image to 3D models with weapon placement
 */

import { MeshyAIService, MeshyConfig } from '../MeshyAIService'
import { HandPlacementDetector, GeometryData } from '../HandPlacementDetector'
import { WeaponOrientationSystem } from '../WeaponOrientationSystem'

describe('AI Creation System Integration', () => {
  let meshyService: MeshyAIService
  let handDetector: HandPlacementDetector
  let weaponSystem: WeaponOrientationSystem

  const mockConfig: MeshyConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.meshy.ai',
    timeout: 30000,
  }

  beforeEach(() => {
    meshyService = new MeshyAIService(mockConfig)
    handDetector = new HandPlacementDetector()
    weaponSystem = new WeaponOrientationSystem()
  })

  describe('Complete Weapon Creation Pipeline', () => {
    const mockSwordGeometry: GeometryData = {
      vertices: new Float32Array([
        // Sword blade vertices (long Y axis)
        -0.02,
        -0.8,
        -0.01, // Bottom left
        0.02,
        -0.8,
        0.01, // Bottom right
        -0.02,
        0.8,
        -0.01, // Top left
        0.02,
        0.8,
        0.01, // Top right
        // Hilt vertices
        -0.05,
        -0.2,
        -0.02, // Hilt left
        0.05,
        -0.2,
        0.02, // Hilt right
        -0.05,
        -0.1,
        -0.02, // Hilt top left
        0.05,
        -0.1,
        0.02, // Hilt top right
      ]),
      faces: new Uint32Array([
        0,
        1,
        2,
        1,
        3,
        2, // Blade
        4,
        5,
        6,
        5,
        7,
        6, // Hilt
      ]),
    }

    const mockTaskResponse = {
      result: 'task-123',
      id: 'task-123',
      status: 'SUCCEEDED' as const,
      model_urls: {
        glb: 'https://example.com/sword.glb',
        obj: 'https://example.com/sword.obj',
      },
      created_at: Date.now(),
      finished_at: Date.now() + 30000,
    }

    beforeEach(() => {
      // Mock global fetch for testing
      global.fetch = async () =>
        ({
          ok: true,
          json: async () => mockTaskResponse,
        }) as any
    })

    it('should create weapon from text with complete analysis and configuration', async () => {
      console.log('🧪 Testing complete weapon creation pipeline...')

      // Step 1: Create 3D model from text
      const weaponResult = await meshyService.createItem('iron longsword with leather-wrapped hilt', 'weapon', 'sword')

      expect(weaponResult.taskId).toBe('task-123')
      expect(weaponResult.metadata.itemType).toBe('weapon')
      expect(weaponResult.metadata.weaponType).toBe('sword')

      console.log('✅ Step 1: 3D model creation completed')

      // Step 2: Analyze weapon for hand placement
      const weaponAnalysis = await handDetector.analyzeWeapon(
        mockSwordGeometry,
        'sword',
        'iron longsword with leather-wrapped hilt'
      )

      expect(weaponAnalysis.weaponType).toBe('sword')
      expect(weaponAnalysis.grips).toHaveLength(1) // Sword is one-handed
      expect(weaponAnalysis.grips[0].gripType).toBe('primary')
      expect(weaponAnalysis.confidence).toBeGreaterThan(0.8)

      console.log('✅ Step 2: Weapon analysis completed')
      console.log(`   Confidence: ${(weaponAnalysis.confidence * 100).toFixed(1)}%`)

      // Step 3: Generate weapon configuration
      const weaponConfig = await weaponSystem.generateWeaponConfiguration(
        weaponAnalysis,
        'iron longsword with leather-wrapped hilt'
      )

      expect(weaponConfig.weaponAnalysis).toBe(weaponAnalysis)
      expect(weaponConfig.attachmentPoints.length).toBeGreaterThan(0)
      expect(weaponConfig.physicsProperties.mass).toBeGreaterThan(0)
      expect(weaponConfig.metadata.damage).toBeGreaterThan(0)

      // Verify attachment points
      const primaryGrip = weaponConfig.attachmentPoints.find(p => p.name === 'primary_grip')
      expect(primaryGrip).toBeDefined()
      expect(primaryGrip!.socketType).toBe('hand')
      expect(primaryGrip!.priority).toBe(100)

      console.log('✅ Step 3: Weapon configuration generated')
      console.log(`   Attachment points: ${weaponConfig.attachmentPoints.length}`)
      console.log(`   Physics mass: ${weaponConfig.physicsProperties.mass.toFixed(2)}kg`)
      console.log(`   Base damage: ${weaponConfig.metadata.damage}`)

      // Verify weapon orientations
      expect(weaponConfig.orientation.restPosition).toBeDefined()
      expect(weaponConfig.orientation.combatPosition).toBeDefined()
      expect(weaponConfig.orientation.sheathedPosition).toBeDefined()
      expect(weaponConfig.orientation.blockPosition).toBeDefined() // Swords have block

      // Verify animations
      expect(weaponConfig.animations.idle).toContain('sword_idle_sword')
      expect(weaponConfig.animations.attack).toContain('sword_slash_horizontal')
      expect(weaponConfig.animations.block).toContain('sword_block_high')

      console.log('✅ Complete weapon creation pipeline successful')
    })

    it('should handle two-handed weapon analysis correctly', async () => {
      const mockStaffGeometry: GeometryData = {
        vertices: new Float32Array([
          // Long staff vertices
          -0.03, -1.0, -0.03, 0.03, -1.0, 0.03, -0.03, 1.0, -0.03, 0.03, 1.0, 0.03,
        ]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      // Create staff
      const staffResult = await meshyService.createItem('wizard staff with crystal orb', 'weapon', 'staff')

      expect(staffResult.metadata.weaponType).toBe('staff')

      // Analyze staff
      const staffAnalysis = await handDetector.analyzeWeapon(
        mockStaffGeometry,
        'staff',
        'wizard staff with crystal orb'
      )

      expect(staffAnalysis.weaponType).toBe('staff')
      expect(staffAnalysis.grips).toHaveLength(2) // Staff is two-handed

      const primaryGrip = staffAnalysis.grips.find(g => g.gripType === 'primary')
      const secondaryGrip = staffAnalysis.grips.find(g => g.gripType === 'secondary')

      expect(primaryGrip).toBeDefined()
      expect(secondaryGrip).toBeDefined()

      // Generate configuration
      const staffConfig = await weaponSystem.generateWeaponConfiguration(staffAnalysis)

      // Should have both primary and secondary grip attachments
      const primaryAttachment = staffConfig.attachmentPoints.find(p => p.name === 'primary_grip')
      const secondaryAttachment = staffConfig.attachmentPoints.find(p => p.name === 'secondary_grip')

      expect(primaryAttachment).toBeDefined()
      expect(secondaryAttachment).toBeDefined()
      expect(primaryAttachment!.priority).toBe(100)
      expect(secondaryAttachment!.priority).toBe(90)

      console.log('✅ Two-handed weapon analysis completed successfully')
    })

    it('should create character with rigging pipeline', async () => {
      console.log('🧪 Testing character creation pipeline...')

      // Create character from description
      const characterResult = await meshyService.createCharacter('brave knight in shining armor')

      expect(characterResult.modelTaskId).toBe('task-123')
      expect(characterResult.metadata.itemType).toBe('character')
      expect(characterResult.riggingTaskId).toBeUndefined() // Not added yet

      console.log('✅ Character model creation completed')

      // Simulate adding rigging after model completion
      const riggingTaskId = await meshyService.addRiggingAndAnimation({
        modelUrl: characterResult.modelTaskId,
        rigType: 'gaming',
        enableAnimation: true,
      })

      expect(riggingTaskId).toBe('task-123')

      console.log('✅ Character rigging pipeline completed')
    })

    it('should create building structures correctly', async () => {
      console.log('🧪 Testing building creation...')

      const buildingResult = await meshyService.createBuilding('medieval castle with towers and battlements')

      expect(buildingResult.taskId).toBe('task-123')
      expect(buildingResult.metadata.itemType).toBe('building')
      expect(buildingResult.metadata.scale).toEqual({ x: 2, y: 2, z: 2 }) // Buildings are scaled up

      console.log('✅ Building creation completed')
    })

    it('should handle batch weapon creation', async () => {
      console.log('🧪 Testing batch weapon creation...')

      const batchRequests = [
        { prompt: 'iron sword', itemType: 'weapon' as const, weaponType: 'sword' as const },
        { prompt: 'war axe', itemType: 'weapon' as const, weaponType: 'axe' as const },
        { prompt: 'wooden bow', itemType: 'weapon' as const, weaponType: 'bow' as const },
      ]

      // Mock sequential responses
      let callCount = 0
      global.fetch = async () => {
        const responses = ['sword-task', 'axe-task', 'bow-task']
        const result = responses[callCount % responses.length]
        callCount++
        return {
          ok: true,
          json: async () => ({ result }),
        } as any
      }

      const batchResults = await meshyService.batchCreate(batchRequests)

      expect(batchResults).toHaveLength(3)
      expect(batchResults[0].taskId).toBe('sword-task')
      expect(batchResults[1].taskId).toBe('axe-task')
      expect(batchResults[2].taskId).toBe('bow-task')

      console.log('✅ Batch creation completed')

      // Now batch analyze the geometries
      const mockGeometries = [
        { geometryData: mockSwordGeometry, weaponType: 'sword', description: 'iron sword' },
        { geometryData: mockSwordGeometry, weaponType: 'axe', description: 'war axe' },
        { geometryData: mockSwordGeometry, weaponType: 'bow', description: 'wooden bow' },
      ]

      const analyses = await handDetector.batchAnalyze(mockGeometries)

      expect(analyses).toHaveLength(3)
      expect(analyses[0].weaponType).toBe('sword')
      expect(analyses[1].weaponType).toBe('axe')
      expect(analyses[2].weaponType).toBe('bow')

      console.log('✅ Batch analysis completed')

      // Now batch generate configurations
      const configurations = await weaponSystem.batchGenerateConfigurations(analyses)

      expect(configurations).toHaveLength(3)
      configurations.forEach((config, index) => {
        expect(config.weaponAnalysis).toBe(analyses[index])
        expect(config.attachmentPoints.length).toBeGreaterThan(0)
        expect(config.physicsProperties.mass).toBeGreaterThan(0)
      })

      console.log('✅ Complete batch pipeline successful')
    })

    it('should handle API errors gracefully', async () => {
      console.log('🧪 Testing error handling...')

      // Mock API failure
      global.fetch = async () =>
        ({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }) as any

      await expect(meshyService.createItem('test item', 'weapon', 'sword')).rejects.toThrow(
        'Failed to create 3D model from text: Meshy API error: 500 Internal Server Error'
      )

      console.log('✅ Error handling working correctly')
    })

    it('should validate service health', async () => {
      console.log('🧪 Testing service health check...')

      // Mock healthy response
      global.fetch = async () =>
        ({
          ok: true,
        }) as any

      const health = await meshyService.getHealth()

      expect(health.status).toBe('healthy')
      expect(health.apiKey).toBe(true)
      expect(health.connectivity).toBe(true)

      console.log('✅ Health check completed')

      // Mock unhealthy response
      global.fetch = async () =>
        ({
          ok: false,
        }) as any

      const unhealthyHealth = await meshyService.getHealth()

      expect(unhealthyHealth.status).toBe('unhealthy')
      expect(unhealthyHealth.connectivity).toBe(false)
    })
  })

  describe('Advanced Weapon Analysis', () => {
    it('should analyze weapon proportions and confidence correctly', async () => {
      const perfectSwordGeometry: GeometryData = {
        vertices: new Float32Array([
          // Perfect sword proportions
          -0.02,
          -0.8,
          -0.01, // Blade bottom
          0.02,
          -0.8,
          0.01,
          -0.02,
          0.8,
          -0.01, // Blade top
          0.02,
          0.8,
          0.01,
          -0.05,
          -0.2,
          -0.02, // Hilt
          0.05,
          -0.2,
          0.02,
        ]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2, 4, 5, 0, 5, 1, 0]),
      }

      const analysis = await handDetector.analyzeWeapon(perfectSwordGeometry, 'sword', 'perfectly balanced sword')

      // Should have high confidence for well-proportioned sword
      expect(analysis.confidence).toBeGreaterThan(0.9)

      // Should detect correct orientation
      expect(analysis.orientation).toBeDefined()
      expect(analysis.boundingBox.dimensions.y).toBeGreaterThan(analysis.boundingBox.dimensions.x)

      console.log(`Sword confidence: ${(analysis.confidence * 100).toFixed(1)}%`)
    })

    it('should handle unusual weapon geometries', async () => {
      const weirdGeometry: GeometryData = {
        vertices: new Float32Array([
          // Unusual proportions - very wide
          -2.0, -0.1, -0.1, 2.0, -0.1, 0.1, -2.0, 0.1, -0.1, 2.0, 0.1, 0.1,
        ]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      const analysis = await handDetector.analyzeWeapon(weirdGeometry, 'sword', 'unusual weapon')

      // Should still provide analysis but with lower confidence
      expect(analysis.grips).toHaveLength(1)
      expect(analysis.confidence).toBeGreaterThan(0)
      expect(analysis.boundingBox.dimensions.x).toBeGreaterThan(analysis.boundingBox.dimensions.y)

      console.log(`Unusual weapon confidence: ${(analysis.confidence * 100).toFixed(1)}%`)
    })
  })

  describe('Physics and Metadata Calculations', () => {
    it('should calculate realistic physics properties', async () => {
      const heavySwordGeometry: GeometryData = {
        vertices: new Float32Array([
          // Large, heavy sword
          -0.1, -1.5, -0.05, 0.1, -1.5, 0.05, -0.1, 1.5, -0.05, 0.1, 1.5, 0.05,
        ]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      const analysis = await handDetector.analyzeWeapon(heavySwordGeometry, 'sword')
      const config = await weaponSystem.generateWeaponConfiguration(analysis)

      // Large sword should have significant mass
      expect(config.physicsProperties.mass).toBeGreaterThanOrEqual(1.0)

      // Damage should scale with size
      expect(config.metadata.damage).toBeGreaterThan(5) // Should be meaningful damage

      // Should have appropriate inertia tensor
      expect(config.physicsProperties.inertiaTensor.x).toBeGreaterThan(0)
      expect(config.physicsProperties.inertiaTensor.y).toBeGreaterThan(0)
      expect(config.physicsProperties.inertiaTensor.z).toBeGreaterThan(0)

      console.log(`Heavy sword mass: ${config.physicsProperties.mass.toFixed(2)}kg`)
      console.log(`Heavy sword damage: ${config.metadata.damage}`)
    })

    it('should calculate different weapon stats correctly', async () => {
      const mockGeometry: GeometryData = {
        vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
        faces: new Uint32Array([0, 1, 2]),
      }

      // Test different weapon types
      const weaponTypes = ['sword', 'axe', 'staff']
      const configs = []

      for (const weaponType of weaponTypes) {
        const analysis = await handDetector.analyzeWeapon(mockGeometry, weaponType)
        const config = await weaponSystem.generateWeaponConfiguration(analysis)
        configs.push({ type: weaponType, config })
      }

      // Axe should have higher damage than sword
      const swordConfig = configs.find(c => c.type === 'sword')!.config
      const axeConfig = configs.find(c => c.type === 'axe')!.config
      const staffConfig = configs.find(c => c.type === 'staff')!.config

      expect(axeConfig.metadata.damage).toBeGreaterThan(swordConfig.metadata.damage)
      expect(staffConfig.metadata.range).toBeGreaterThan(swordConfig.metadata.range)
      expect(staffConfig.metadata.enchantmentSlots).toBeGreaterThan(swordConfig.metadata.enchantmentSlots)

      console.log('Weapon stats comparison:')
      console.log(`  Sword: ${swordConfig.metadata.damage} damage, ${swordConfig.metadata.range} range`)
      console.log(`  Axe: ${axeConfig.metadata.damage} damage, ${axeConfig.metadata.range} range`)
      console.log(`  Staff: ${staffConfig.metadata.damage} damage, ${staffConfig.metadata.range} range`)
    })
  })
})
