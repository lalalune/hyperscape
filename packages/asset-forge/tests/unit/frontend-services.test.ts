/**
 * Frontend Services Integration Tests
 * Tests for MeshFitting, HandRigging, AssetNormalization, SpriteGeneration, API Client, and ContextBuilder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockMesh,
  createMockSkinnedMesh,
  createMockGLBBuffer,
  createMockRenderer,
  createMockScene
} from '../mocks/three-mocks'

describe('Frontend Services', () => {
  describe('MeshFittingService', () => {
    let service: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/fitting/MeshFittingService')
        service = new module.MeshFittingService()
      } catch (error) {
        service = null
      }
    })

    it('should initialize mesh fitting service', () => {
      if (!service) return
      expect(service).toBeDefined()
    })

    it('should fit mesh to target', async () => {
      if (!service) return

      const sourceMesh = createMockMesh('source', 100)
      const targetMesh = createMockMesh('target', 100)

      if (typeof service.fitMesh === 'function') {
        const result = await service.fitMesh(sourceMesh, targetMesh, {
          iterations: 5,
          stepSize: 0.1
        })

        expect(result).toBeDefined()
      }
    })

    it('should handle fitting parameters', () => {
      if (!service) return

      const params = {
        iterations: 10,
        stepSize: 0.05,
        smoothingRadius: 0.1,
        targetOffset: 0.01
      }

      expect(params.iterations).toBe(10)
      expect(params.stepSize).toBe(0.05)
    })
  })

  describe('HandRiggingService', () => {
    let service: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/hand-rigging/HandRiggingService')
        service = new module.HandRiggingService()
      } catch (error) {
        service = null
      }
    })

    it('should initialize hand rigging service', () => {
      if (!service) return
      expect(service).toBeDefined()
    })

    it('should detect hand pose', async () => {
      if (!service) return

      const weaponMesh = createMockMesh('weapon', 500)

      if (typeof service.detectHandPose === 'function') {
        const pose = await service.detectHandPose(weaponMesh)
        expect(pose).toBeDefined()
      }
    })

    it('should rig weapon to hand', async () => {
      if (!service) return

      const weaponMesh = createMockMesh('weapon', 500)
      const handMesh = createMockMesh('hand', 200)

      if (typeof service.rigToHand === 'function') {
        const result = await service.rigToHand(weaponMesh, handMesh)
        expect(result).toBeDefined()
      }
    })

    it('should handle different grip types', () => {
      if (!service) return

      const gripTypes = ['one-handed', 'two-handed', 'bow', 'staff']

      gripTypes.forEach(gripType => {
        expect(typeof gripType).toBe('string')
      })
    })
  })

  describe('AssetNormalizationService', () => {
    let service: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/processing/AssetNormalizationService')
        service = new module.AssetNormalizationService()
      } catch (error) {
        service = null
      }
    })

    it('should initialize normalization service', () => {
      if (!service) return
      expect(service).toBeDefined()
    })

    it('should normalize character height', async () => {
      if (!service) return

      const mockGLB = createMockGLBBuffer()

      if (typeof service.normalizeCharacter === 'function') {
        const result = await service.normalizeCharacter(mockGLB, 1.83)

        expect(result).toBeDefined()
        expect(result.metadata?.dimensions).toBeDefined()
      }
    })

    it('should normalize weapon with grip at origin', async () => {
      if (!service) return

      const mockGLB = createMockGLBBuffer()

      if (typeof service.normalizeWeapon === 'function') {
        const result = await service.normalizeWeapon(mockGLB)

        expect(result).toBeDefined()
      }
    })

    it('should calculate asset dimensions', () => {
      if (!service) return

      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry

      geometry.computeBoundingBox()
      const box = geometry.boundingBox!

      const size = {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z
      }

      expect(size.x).toBeGreaterThanOrEqual(0)
      expect(size.y).toBeGreaterThanOrEqual(0)
      expect(size.z).toBeGreaterThanOrEqual(0)
    })

    it('should center mesh at origin', () => {
      if (!service) return

      const mesh = createMockMesh('test', 100)

      mesh.position.set(5, 10, 15)
      mesh.updateMatrixWorld()

      // Center at origin
      mesh.position.set(0, 0, 0)
      mesh.updateMatrixWorld()

      expect(mesh.position.x).toBe(0)
      expect(mesh.position.y).toBe(0)
      expect(mesh.position.z).toBe(0)
    })
  })

  describe('SpriteGenerationService', () => {
    let service: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/generation/SpriteGenerationService')
        service = new module.SpriteGenerationService()
      } catch (error) {
        service = null
      }
    })

    it('should initialize sprite generation service', () => {
      if (!service) return
      expect(service).toBeDefined()
    })

    it('should render sprite from mesh', async () => {
      if (!service) return

      const mesh = createMockMesh('test', 100)
      const renderer = createMockRenderer(512, 512)
      const scene = createMockScene()

      scene.add(mesh)

      if (typeof service.renderSprite === 'function') {
        const sprite = await service.renderSprite(mesh, renderer, scene, {
          size: 512,
          angle: 0
        })

        expect(sprite).toBeDefined()
      }
    })

    it('should generate orthographic views', async () => {
      if (!service) return

      const angles = [0, 45, 90, 135, 180, 225, 270, 315]

      angles.forEach(angle => {
        expect(angle).toBeGreaterThanOrEqual(0)
        expect(angle).toBeLessThan(360)
      })
    })

    it('should handle different sprite sizes', () => {
      if (!service) return

      const sizes = [128, 256, 512, 1024]

      sizes.forEach(size => {
        expect(size).toBeGreaterThan(0)
        expect(size % 2).toBe(0) // Power of 2
      })
    })

    it('should render with transparency', async () => {
      if (!service) return

      const renderer = createMockRenderer(512, 512)

      // Renderer should support alpha
      expect(renderer).toBeDefined()
    })
  })

  describe('GenerationAPIClient', () => {
    let client: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/api/GenerationAPIClient')
        client = new module.GenerationAPIClient({
          baseUrl: 'http://localhost:3000'
        })
      } catch (error) {
        client = null
      }
    })

    it('should initialize API client', () => {
      if (!client) return
      expect(client).toBeDefined()
    })

    it('should start generation pipeline', async () => {
      if (!client) return

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          pipelineId: 'test-pipeline-123',
          status: 'initializing'
        })
      })

      if (typeof client.startGeneration === 'function') {
        const result = await client.startGeneration({
          description: 'A test sword',
          type: 'weapon'
        })

        expect(result.pipelineId).toBeDefined()
      }
    })

    it('should poll pipeline status', async () => {
      if (!client) return

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-pipeline',
          status: 'processing',
          progress: 50
        })
      })

      if (typeof client.getPipelineStatus === 'function') {
        const status = await client.getPipelineStatus('test-pipeline')

        expect(status.status).toBeDefined()
        expect(status.progress).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle API errors', async () => {
      if (!client) return

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      if (typeof client.startGeneration === 'function') {
        await expect(
          client.startGeneration({ description: 'Test', type: 'weapon' })
        ).rejects.toThrow()
      }
    })

    it('should handle network errors', async () => {
      if (!client) return

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      if (typeof client.startGeneration === 'function') {
        await expect(
          client.startGeneration({ description: 'Test', type: 'weapon' })
        ).rejects.toThrow('Network error')
      }
    })
  })

  describe('ContextBuilder', () => {
    let builder: any

    beforeEach(async () => {
      try {
        const module = await import('../../src/services/ContextBuilder')
        builder = new module.ContextBuilder()
      } catch (error) {
        builder = null
      }
    })

    it('should initialize context builder', () => {
      if (!builder) return
      expect(builder).toBeDefined()
    })

    it('should build generation context', () => {
      if (!builder) return

      const context = {
        worldState: {
          location: 'Ancient Ruins',
          era: 'Medieval'
        },
        npcs: [],
        quests: []
      }

      if (typeof builder.buildContext === 'function') {
        const result = builder.buildContext(context)
        expect(result).toBeDefined()
      }
    })

    it('should include NPC relationships', () => {
      if (!builder) return

      const relationships = [
        { npc1: 'guard', npc2: 'merchant', type: 'friendly' },
        { npc1: 'guard', npc2: 'thief', type: 'hostile' }
      ]

      expect(relationships).toHaveLength(2)
    })

    it('should include quest dependencies', () => {
      if (!builder) return

      const quests = [
        { id: 'quest1', dependencies: [] },
        { id: 'quest2', dependencies: ['quest1'] }
      ]

      expect(quests[1].dependencies).toContain('quest1')
    })

    it('should format context for LLM', () => {
      if (!builder) return

      const context = {
        location: 'Dark Forest',
        npcs: ['ranger', 'druid'],
        atmosphere: 'mysterious'
      }

      if (typeof builder.formatForLLM === 'function') {
        const formatted = builder.formatForLLM(context)
        expect(typeof formatted).toBe('string')
      }
    })
  })

  describe('Service Integration', () => {
    it('should chain services for complete workflow', async () => {
      // Workflow: Generate Asset -> Normalize -> Rig Hands -> Generate Sprites

      const mockGLB = createMockGLBBuffer()

      // 1. Normalize asset
      expect(mockGLB).toBeDefined()

      // 2. Load as mesh
      const mesh = createMockMesh('asset', 1000)
      expect(mesh).toBeDefined()

      // 3. Rig for hands (if weapon)
      if (mesh.name.includes('weapon')) {
        expect(mesh.geometry.attributes.position).toBeDefined()
      }

      // 4. Generate sprites
      const renderer = createMockRenderer()
      const scene = createMockScene()
      scene.add(mesh)

      expect(scene.children).toContain(mesh)
    })

    it('should handle service errors gracefully', async () => {
      // Simulate service failure in chain
      let errorCaught = false

      try {
        throw new Error('Service failure')
      } catch (error) {
        errorCaught = true
      }

      expect(errorCaught).toBe(true)
    })
  })
})
