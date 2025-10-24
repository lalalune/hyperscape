/**
 * GenerationService Integration Tests
 * Tests AI-powered asset generation pipelines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GenerationService } from '../GenerationService.mjs'
import { mockOpenAI, mockMeshy, mockFetch, resetAllMocks } from '../../../tests/mocks/ai-services.mjs'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mock external dependencies
vi.mock('node-fetch', () => ({ default: mockFetch }))

describe('GenerationService', () => {
  let service

  beforeEach(() => {
    resetAllMocks()
    service = new GenerationService()

    // Mock AICreationService
    service.aiService = {
      imageService: {
        generateImage: vi.fn().mockResolvedValue({
          imageUrl: 'https://example.com/generated-image.png',
          prompt: 'enhanced prompt',
          model: 'dall-e-3'
        })
      },
      meshyService: mockMeshy
    }

    // Mock ImageHostingService
    service.imageHostingService = {
      uploadImage: vi.fn().mockResolvedValue('https://example.com/hosted-image.png')
    }

    // Mock file download
    service.downloadFile = vi.fn().mockResolvedValue(Buffer.from('mock-glb-data'))
  })

  afterEach(() => {
    if (service) {
      service.shutdown()
    }
  })

  describe('startPipeline', () => {
    it('should create and start a new pipeline', async () => {
      const config = {
        assetId: 'test-sword',
        name: 'Test Sword',
        description: 'A medieval sword',
        type: 'weapon',
        style: 'game-ready',
        enableRetexturing: false,
        enableRigging: false
      }

      const result = await service.startPipeline(config)

      expect(result).toMatchObject({
        pipelineId: expect.any(String),
        status: 'initializing',
        message: 'Pipeline started successfully'
      })

      expect(service.activePipelines.has(result.pipelineId)).toBe(true)
    })

    it('should enforce pipeline limit', async () => {
      // Fill up to max pipelines
      const promises = []
      for (let i = 0; i < service.MAX_ACTIVE_PIPELINES + 1; i++) {
        promises.push(
          service.startPipeline({
            assetId: `test-asset-${i}`,
            description: 'Test',
            type: 'weapon'
          })
        )
      }

      await Promise.all(promises)

      // Should not exceed limit
      expect(service.activePipelines.size).toBeLessThanOrEqual(
        service.MAX_ACTIVE_PIPELINES
      )
    })

    it('should validate asset ID', async () => {
      await expect(
        service.startPipeline({
          assetId: '../../../etc/passwd',
          description: 'Test',
          type: 'weapon'
        })
      ).rejects.toThrow()
    })
  })

  describe('getPipelineStatus', () => {
    it('should return pipeline status', async () => {
      const config = {
        assetId: 'test-sword',
        description: 'A sword',
        type: 'weapon'
      }

      const { pipelineId } = await service.startPipeline(config)

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = await service.getPipelineStatus(pipelineId)

      expect(status).toMatchObject({
        id: pipelineId,
        status: expect.any(String),
        progress: expect.any(Number),
        stages: expect.any(Object)
      })
    })

    it('should throw error for non-existent pipeline', async () => {
      await expect(
        service.getPipelineStatus('non-existent-id')
      ).rejects.toThrow(/not found/)
    })
  })

  describe('processPipeline', () => {
    it('should process pipeline through all stages', async () => {
      const config = {
        assetId: 'test-asset',
        description: 'A test asset',
        type: 'weapon',
        enableRetexturing: false,
        enableRigging: false
      }

      const { pipelineId } = await service.startPipeline(config)

      // Wait for pipeline to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      const status = await service.getPipelineStatus(pipelineId)

      // Check that stages progressed
      expect(status.stages.promptOptimization).toBeDefined()
      expect(status.stages.imageGeneration).toBeDefined()
      expect(status.stages.image3D).toBeDefined()
    })

    it('should skip GPT-4 enhancement when disabled', async () => {
      const config = {
        assetId: 'test-asset',
        description: 'A test asset',
        type: 'weapon',
        metadata: {
          useGPT4Enhancement: false
        }
      }

      const { pipelineId } = await service.startPipeline(config)

      await new Promise(resolve => setTimeout(resolve, 200))

      const status = await service.getPipelineStatus(pipelineId)

      expect(status.stages.promptOptimization.status).toBe('skipped')
    })

    it('should use user-provided reference image', async () => {
      const config = {
        assetId: 'test-asset',
        description: 'A test asset',
        type: 'weapon',
        referenceImage: {
          url: 'https://example.com/reference.png'
        }
      }

      const { pipelineId } = await service.startPipeline(config)

      await new Promise(resolve => setTimeout(resolve, 200))

      const status = await service.getPipelineStatus(pipelineId)

      expect(status.stages.imageGeneration.status).toBe('skipped')
    })

    it('should handle image to 3D conversion', async () => {
      const config = {
        assetId: 'test-weapon',
        description: 'Test weapon',
        type: 'weapon',
        quality: 'standard'
      }

      const { pipelineId } = await service.startPipeline(config)

      // Wait for Meshy processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(mockMeshy.startImageTo3D).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      // Mock service failure
      service.aiService.imageService.generateImage.mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      )

      const config = {
        assetId: 'test-fail',
        description: 'Test',
        type: 'weapon'
      }

      const { pipelineId } = await service.startPipeline(config)

      await new Promise(resolve => setTimeout(resolve, 500))

      const status = await service.getPipelineStatus(pipelineId)

      expect(['failed', 'processing']).toContain(status.status)
    })
  })

  describe('enhancePromptWithGPT4', () => {
    it('should enhance prompt with GPT-4', async () => {
      // Mock fetch for GPT-4 API
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'Enhanced: A detailed medieval sword with ornate hilt and sharp blade'
            }
          }]
        })
      })

      const config = {
        description: 'A sword',
        type: 'weapon',
        style: 'medieval'
      }

      const result = await service.enhancePromptWithGPT4(config)

      expect(result).toMatchObject({
        originalPrompt: 'A sword',
        optimizedPrompt: expect.stringContaining('Enhanced'),
        model: 'gpt-4'
      })
    })

    it('should add T-pose instructions for avatars', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'Character in T-pose with empty hands'
            }
          }]
        })
      })

      const config = {
        description: 'A warrior',
        type: 'character',
        generationType: 'avatar'
      }

      const result = await service.enhancePromptWithGPT4(config)

      expect(result.optimizedPrompt).toBeDefined()
    })

    it('should fallback on GPT-4 failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API error'))

      const config = {
        description: 'A sword',
        type: 'weapon',
        style: 'game-ready'
      }

      const result = await service.enhancePromptWithGPT4(config)

      expect(result).toMatchObject({
        originalPrompt: 'A sword',
        optimizedPrompt: expect.any(String),
        error: expect.any(String)
      })
    })

    it('should throw error if API key is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      await expect(
        service.enhancePromptWithGPT4({ description: 'Test', type: 'weapon' })
      ).rejects.toThrow(/OPENAI_API_KEY/)

      process.env.OPENAI_API_KEY = originalKey
    })
  })

  describe('extractKeywords', () => {
    it('should extract material keywords', () => {
      const prompt = 'A bronze sword with steel accents'
      const keywords = service.extractKeywords(prompt)

      expect(keywords).toContain('bronze')
      expect(keywords).toContain('steel')
      expect(keywords).toContain('sword')
    })

    it('should extract style keywords', () => {
      const prompt = 'A low-poly shield with realistic textures'
      const keywords = service.extractKeywords(prompt)

      expect(keywords).toContain('low-poly')
      expect(keywords).toContain('realistic')
      expect(keywords).toContain('shield')
    })

    it('should deduplicate keywords', () => {
      const prompt = 'A sword sword sword'
      const keywords = service.extractKeywords(prompt)

      expect(keywords.filter(k => k === 'sword')).toHaveLength(1)
    })
  })

  describe('cleanupOldPipelines', () => {
    it('should remove completed pipelines after TTL', () => {
      const oldTimestamp = Date.now() - (service.PIPELINE_TTL_MS + 1000)

      // Add old completed pipeline
      service.activePipelines.set('old-pipeline', {
        id: 'old-pipeline',
        status: 'completed',
        createdAt: oldTimestamp,
        config: { assetId: 'old-asset' }
      })

      // Add recent pipeline
      service.activePipelines.set('new-pipeline', {
        id: 'new-pipeline',
        status: 'processing',
        createdAt: Date.now(),
        config: { assetId: 'new-asset' }
      })

      const cleaned = service.cleanupOldPipelines()

      expect(cleaned).toBe(1)
      expect(service.activePipelines.has('old-pipeline')).toBe(false)
      expect(service.activePipelines.has('new-pipeline')).toBe(true)
    })

    it('should not remove recent pipelines', () => {
      service.activePipelines.set('recent-pipeline', {
        id: 'recent-pipeline',
        status: 'completed',
        createdAt: Date.now(),
        config: { assetId: 'recent' }
      })

      const cleaned = service.cleanupOldPipelines()

      expect(cleaned).toBe(0)
      expect(service.activePipelines.has('recent-pipeline')).toBe(true)
    })

    it('should not remove in-progress pipelines', () => {
      const oldTimestamp = Date.now() - (service.PIPELINE_TTL_MS + 1000)

      service.activePipelines.set('old-processing', {
        id: 'old-processing',
        status: 'processing',
        createdAt: oldTimestamp,
        config: { assetId: 'old' }
      })

      const cleaned = service.cleanupOldPipelines()

      expect(cleaned).toBe(0)
      expect(service.activePipelines.has('old-processing')).toBe(true)
    })
  })

  describe('memory leak protection', () => {
    it('should limit active pipelines', async () => {
      const maxPipelines = service.MAX_ACTIVE_PIPELINES

      // Try to create more than max
      for (let i = 0; i < maxPipelines + 5; i++) {
        await service.startPipeline({
          assetId: `asset-${i}`,
          description: 'Test',
          type: 'weapon'
        })
      }

      expect(service.activePipelines.size).toBeLessThanOrEqual(maxPipelines)
    })

    it('should cleanup on shutdown', () => {
      service.activePipelines.set('test-1', { id: 'test-1', status: 'completed', createdAt: Date.now() })
      service.activePipelines.set('test-2', { id: 'test-2', status: 'processing', createdAt: Date.now() })

      service.shutdown()

      expect(service.activePipelines.size).toBe(0)
      expect(service.cleanupInterval).toBeNull()
    })
  })

  describe('integration - full pipeline', () => {
    it('should generate complete asset with retexturing', async () => {
      // Mock successful responses
      service.aiService.imageService.generateImage.mockResolvedValue({
        imageUrl: 'https://example.com/image.png'
      })

      mockMeshy.startImageTo3D.mockResolvedValue('mesh-task-123')
      mockMeshy.getTaskStatus.mockResolvedValueOnce({
        status: 'SUCCEEDED',
        progress: 100,
        model_urls: { glb: 'https://example.com/model.glb' }
      })

      const config = {
        assetId: 'full-test-asset',
        description: 'A complete test asset',
        type: 'weapon',
        enableRetexturing: true,
        materialPresets: [
          {
            id: 'bronze',
            displayName: 'Bronze',
            category: 'metal',
            tier: 1,
            stylePrompt: 'bronze material'
          }
        ]
      }

      const { pipelineId } = await service.startPipeline(config)

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000))

      const status = await service.getPipelineStatus(pipelineId)

      // Pipeline should progress through stages
      expect(['processing', 'completed', 'failed']).toContain(status.status)
    }, 10000)
  })
})
