import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { AssetValidator, ValidationTestRunner } from '../../src/utils/validation'
import { AICreationService } from '../../src/core/AICreationService'

const OUTPUT_DIR = path.join(__dirname, '../../output')
const BATCH_FILES_DIR = path.join(__dirname, '../../demo-batches')

test.describe('Asset Validation Tests', () => {
  let validator: AssetValidator
  let testRunner: ValidationTestRunner
  let service: AICreationService
  
  test.beforeAll(async () => {
    validator = new AssetValidator()
    testRunner = new ValidationTestRunner()
    
    // Initialize service with test config
    service = new AICreationService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'test-key',
        model: 'dall-e-3'
      },
      meshy: {
        apiKey: process.env.MESHY_API_KEY || 'test-key',
        baseUrl: 'https://api.meshy.ai'
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 500
      },
      output: {
        directory: OUTPUT_DIR,
        format: 'glb'
      }
    })
  })
  
  test('should validate weapon asset requirements', async () => {
    // Create mock weapon generation result
    const mockWeaponResult = {
      id: 'test-weapon-1',
      request: {
        id: 'test-weapon-1',
        name: 'Test Sword',
        description: 'A test sword for validation',
        type: 'weapon' as const,
        subtype: 'sword',
        style: 'realistic'
      },
      stages: [
        { stage: 'image' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'model' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'remesh' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'analysis' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      imageResult: {
        imageUrl: 'https://example.com/test-sword.png',
        prompt: 'A test sword',
        metadata: {
          model: 'dall-e-3',
          resolution: '1024x1024',
          timestamp: new Date()
        }
      },
      modelResult: {
        modelUrl: 'https://example.com/test-sword.glb',
        format: 'glb' as const,
        polycount: 3000,
        metadata: {
          meshyTaskId: 'test-123',
          processingTime: 120000
        }
      },
      remeshResult: {
        modelUrl: 'https://example.com/test-sword-remesh.glb',
        originalPolycount: 3000,
        remeshedPolycount: 2000,
        targetPolycount: 2000
      },
      analysisResult: {
        weaponType: 'sword' as const,
        primaryGrip: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          confidence: 0.95
        },
        attachmentPoints: []
      },
      finalAsset: {
        modelUrl: path.join(OUTPUT_DIR, 'test-weapon-1', 'test-sword.glb'),
        metadata: {
          name: 'Test Sword',
          type: 'weapon',
          analysisResult: {}
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockWeaponResult)
    
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.score).toBeGreaterThan(80)
    expect(validation.metadata.polycount).toBe(2000)
    expect(validation.metadata.hasHardpoints).toBe(true)
  })
  
  test('should validate armor asset requirements', async () => {
    const mockArmorResult = {
      id: 'test-armor-1',
      request: {
        id: 'test-armor-1',
        name: 'Test Helmet',
        description: 'A test helmet for validation',
        type: 'armor' as const,
        subtype: 'helmet',
        style: 'realistic'
      },
      stages: [
        { stage: 'image' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'model' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'remesh' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'analysis' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      imageResult: {
        imageUrl: 'https://example.com/test-helmet.png',
        prompt: 'A test helmet',
        metadata: {
          model: 'dall-e-3',
          resolution: '1024x1024',
          timestamp: new Date()
        }
      },
      modelResult: {
        modelUrl: 'https://example.com/test-helmet.glb',
        format: 'glb' as const,
        polycount: 4000,
        metadata: {
          meshyTaskId: 'test-124',
          processingTime: 120000
        }
      },
      remeshResult: {
        modelUrl: 'https://example.com/test-helmet-remesh.glb',
        originalPolycount: 4000,
        remeshedPolycount: 3000,
        targetPolycount: 3000
      },
      analysisResult: {
        slot: 'helmet' as const,
        attachmentPoint: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      },
      finalAsset: {
        modelUrl: path.join(OUTPUT_DIR, 'test-armor-1', 'test-helmet.glb'),
        metadata: {
          name: 'Test Helmet',
          type: 'armor',
          analysisResult: {}
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockArmorResult)
    
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.score).toBeGreaterThan(80)
    expect(validation.metadata.polycount).toBe(3000)
  })
  
  test('should validate character asset requirements', async () => {
    const mockCharacterResult = {
      id: 'test-character-1',
      request: {
        id: 'test-character-1',
        name: 'Test Goblin',
        description: 'A test goblin for validation',
        type: 'character' as const,
        subtype: 'biped',
        style: 'realistic'
      },
      stages: [
        { stage: 'image' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'model' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'remesh' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'analysis' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      imageResult: {
        imageUrl: 'https://example.com/test-goblin.png',
        prompt: 'A test goblin',
        metadata: {
          model: 'dall-e-3',
          resolution: '1024x1024',
          timestamp: new Date()
        }
      },
      modelResult: {
        modelUrl: 'https://example.com/test-goblin.glb',
        format: 'glb' as const,
        polycount: 12000,
        metadata: {
          meshyTaskId: 'test-125',
          processingTime: 180000
        }
      },
      remeshResult: {
        modelUrl: 'https://example.com/test-goblin-remesh.glb',
        originalPolycount: 12000,
        remeshedPolycount: 8000,
        targetPolycount: 8000
      },
      analysisResult: {
        rigType: 'biped' as const,
        bones: [
          { name: 'root', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
          { name: 'spine', position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, parent: 'root' }
        ]
      },
      finalAsset: {
        modelUrl: path.join(OUTPUT_DIR, 'test-character-1', 'test-goblin.glb'),
        metadata: {
          name: 'Test Goblin',
          type: 'character',
          analysisResult: {}
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockCharacterResult)
    
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.score).toBeGreaterThan(80)
    expect(validation.metadata.polycount).toBe(8000)
  })
  
  test('should validate building asset requirements', async () => {
    const mockBuildingResult = {
      id: 'test-building-1',
      request: {
        id: 'test-building-1',
        name: 'Test Bank',
        description: 'A test bank for validation',
        type: 'building' as const,
        subtype: 'bank',
        style: 'realistic'
      },
      stages: [
        { stage: 'image' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'model' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'remesh' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'analysis' as const, status: 'completed' as const, timestamp: new Date() },
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      imageResult: {
        imageUrl: 'https://example.com/test-bank.png',
        prompt: 'A test bank',
        metadata: {
          model: 'dall-e-3',
          resolution: '1024x1024',
          timestamp: new Date()
        }
      },
      modelResult: {
        modelUrl: 'https://example.com/test-bank.glb',
        format: 'glb' as const,
        polycount: 25000,
        metadata: {
          meshyTaskId: 'test-126',
          processingTime: 240000
        }
      },
      remeshResult: {
        modelUrl: 'https://example.com/test-bank-remesh.glb',
        originalPolycount: 25000,
        remeshedPolycount: 10000,
        targetPolycount: 10000
      },
      analysisResult: {
        buildingType: 'bank' as const,
        entryPoints: [
          { name: 'main', position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, isMain: true }
        ],
        functionalAreas: [
          { name: 'vault', type: 'vault' as const, position: { x: 0, y: 0, z: -5 }, size: { x: 3, y: 3, z: 3 } }
        ],
        npcPositions: [
          { role: 'banker', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }
        ]
      },
      finalAsset: {
        modelUrl: path.join(OUTPUT_DIR, 'test-building-1', 'test-bank.glb'),
        metadata: {
          name: 'Test Bank',
          type: 'building',
          analysisResult: {}
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockBuildingResult)
    
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.score).toBeGreaterThan(80)
    expect(validation.metadata.polycount).toBe(10000)
  })
  
  test('should reject assets with polycount too high', async () => {
    const mockResult = {
      id: 'test-high-poly',
      request: {
        id: 'test-high-poly',
        name: 'High Poly Sword',
        description: 'A sword with too many polygons',
        type: 'weapon' as const,
        subtype: 'sword',
        style: 'realistic'
      },
      stages: [
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      modelResult: {
        modelUrl: 'https://example.com/high-poly-sword.glb',
        format: 'glb' as const,
        polycount: 50000, // Too high for weapon
        metadata: {
          meshyTaskId: 'test-127',
          processingTime: 120000
        }
      },
      finalAsset: {
        modelUrl: path.join(OUTPUT_DIR, 'test-high-poly', 'high-poly-sword.glb'),
        metadata: {
          name: 'High Poly Sword',
          type: 'weapon'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockResult)
    
    expect(validation.isValid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
    expect(validation.errors[0]).toContain('Polycount')
    expect(validation.score).toBeLessThan(80)
  })
  
  test('should reject assets with missing required data', async () => {
    const mockResult = {
      id: 'test-incomplete',
      request: {
        id: 'test-incomplete',
        name: 'Incomplete Asset',
        description: 'An incomplete asset',
        type: 'weapon' as const,
        subtype: 'sword',
        style: 'realistic'
      },
      stages: [
        { stage: 'final' as const, status: 'completed' as const, timestamp: new Date() }
      ],
      // Missing modelResult and finalAsset
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const validation = await validator.validateGeneration(mockResult)
    
    expect(validation.isValid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
    expect(validation.score).toBe(0)
  })
})