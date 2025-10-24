/**
 * AssetService Integration Tests
 * Tests asset listing, retrieval, update, and deletion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AssetService } from '../AssetService.mjs'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('AssetService', () => {
  let service
  let testAssetsDir

  beforeEach(async () => {
    // Create a temporary test directory
    testAssetsDir = path.join(__dirname, '../../../test-assets-temp')
    await fs.mkdir(testAssetsDir, { recursive: true })

    // Create mock asset structure
    const testAssetId = 'test-sword'
    const assetDir = path.join(testAssetsDir, testAssetId)
    await fs.mkdir(assetDir, { recursive: true })

    // Create metadata.json
    const metadata = {
      name: 'Test Sword',
      gameId: 'test-sword',
      type: 'weapon',
      subtype: 'sword',
      description: 'A test sword asset',
      generatedAt: new Date().toISOString(),
      isBaseModel: true,
      hasModel: true
    }
    await fs.writeFile(
      path.join(assetDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    // Create a mock GLB file
    await fs.writeFile(
      path.join(assetDir, 'test-sword.glb'),
      Buffer.from('mock-glb-data')
    )

    service = new AssetService(testAssetsDir)
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testAssetsDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('listAssets', () => {
    it('should list all assets with metadata', async () => {
      const assets = await service.listAssets()

      expect(assets).toBeDefined()
      expect(assets.length).toBeGreaterThan(0)
      expect(assets[0]).toMatchObject({
        id: 'test-sword',
        name: 'Test Sword',
        type: 'weapon',
        hasModel: true
      })
    })

    it('should sort assets by generation date', async () => {
      // Create a second asset with older date
      const oldAssetId = 'old-asset'
      const oldAssetDir = path.join(testAssetsDir, oldAssetId)
      await fs.mkdir(oldAssetDir, { recursive: true })

      const oldDate = new Date('2020-01-01').toISOString()
      const oldMetadata = {
        name: 'Old Asset',
        gameId: 'old-asset',
        type: 'weapon',
        generatedAt: oldDate
      }
      await fs.writeFile(
        path.join(oldAssetDir, 'metadata.json'),
        JSON.stringify(oldMetadata)
      )
      await fs.writeFile(
        path.join(oldAssetDir, 'old-asset.glb'),
        Buffer.from('data')
      )

      const assets = await service.listAssets()

      expect(assets.length).toBe(2)
      // Newest first
      expect(assets[0].id).toBe('test-sword')
      expect(assets[1].id).toBe('old-asset')
    })

    it('should skip invalid asset directories', async () => {
      // Create invalid directory (no metadata)
      const invalidDir = path.join(testAssetsDir, 'invalid-asset')
      await fs.mkdir(invalidDir, { recursive: true })

      const assets = await service.listAssets()

      // Should not throw, just skip invalid assets
      expect(assets).toBeDefined()
      expect(assets.every(a => a.id !== 'invalid-asset')).toBe(true)
    })

    it('should handle empty assets directory', async () => {
      // Create empty directory
      const emptyDir = path.join(__dirname, '../../../test-empty-assets')
      await fs.mkdir(emptyDir, { recursive: true })

      const emptyService = new AssetService(emptyDir)
      const assets = await emptyService.listAssets()

      expect(assets).toEqual([])

      await fs.rm(emptyDir, { recursive: true, force: true })
    })
  })

  describe('getModelPath', () => {
    it('should return path to GLB file', async () => {
      const modelPath = await service.getModelPath('test-sword')

      expect(modelPath).toContain('test-sword.glb')
      expect(await fs.access(modelPath).then(() => true).catch(() => false)).toBe(true)
    })

    it('should prefer rigged model for characters', async () => {
      // Create character asset with rigged model
      const charId = 'test-character'
      const charDir = path.join(testAssetsDir, charId)
      await fs.mkdir(charDir, { recursive: true })

      const charMetadata = {
        name: 'Test Character',
        type: 'character',
        riggedModelPath: `${charId}_rigged.glb`,
        generatedAt: new Date().toISOString()
      }
      await fs.writeFile(
        path.join(charDir, 'metadata.json'),
        JSON.stringify(charMetadata)
      )
      await fs.writeFile(
        path.join(charDir, `${charId}.glb`),
        Buffer.from('base-model')
      )
      await fs.writeFile(
        path.join(charDir, `${charId}_rigged.glb`),
        Buffer.from('rigged-model')
      )

      const modelPath = await service.getModelPath(charId)

      expect(modelPath).toContain('_rigged.glb')
    })

    it('should throw error for non-existent asset', async () => {
      await expect(
        service.getModelPath('non-existent-asset')
      ).rejects.toThrow()
    })

    it('should validate asset ID to prevent path traversal', async () => {
      await expect(
        service.getModelPath('../../../etc/passwd')
      ).rejects.toThrow()
    })
  })

  describe('getAssetMetadata', () => {
    it('should return parsed metadata', async () => {
      const metadata = await service.getAssetMetadata('test-sword')

      expect(metadata).toMatchObject({
        name: 'Test Sword',
        type: 'weapon',
        subtype: 'sword'
      })
    })

    it('should throw error for missing metadata', async () => {
      await expect(
        service.getAssetMetadata('non-existent')
      ).rejects.toThrow()
    })
  })

  describe('loadAsset', () => {
    it('should load complete asset information', async () => {
      const asset = await service.loadAsset('test-sword')

      expect(asset).toMatchObject({
        id: 'test-sword',
        name: 'Test Sword',
        type: 'weapon',
        hasModel: true,
        modelFile: 'test-sword.glb'
      })
    })

    it('should return null for non-directory paths', async () => {
      // Create a file instead of directory
      const filePath = path.join(testAssetsDir, 'not-a-directory.txt')
      await fs.writeFile(filePath, 'test')

      const asset = await service.loadAsset('not-a-directory.txt')

      expect(asset).toBeNull()

      await fs.unlink(filePath)
    })
  })

  describe('deleteAsset', () => {
    it('should delete asset directory', async () => {
      const result = await service.deleteAsset('test-sword')

      expect(result).toBe(true)

      const exists = await fs.access(
        path.join(testAssetsDir, 'test-sword')
      ).then(() => true).catch(() => false)

      expect(exists).toBe(false)
    })

    it('should delete variants when includeVariants is true', async () => {
      // Create base asset
      const baseId = 'base-asset'
      const baseDir = path.join(testAssetsDir, baseId)
      await fs.mkdir(baseDir, { recursive: true })
      await fs.writeFile(
        path.join(baseDir, 'metadata.json'),
        JSON.stringify({
          name: 'Base Asset',
          type: 'weapon',
          isBaseModel: true,
          generatedAt: new Date().toISOString()
        })
      )
      await fs.writeFile(path.join(baseDir, 'base.glb'), Buffer.from('data'))

      // Create variant
      const variantId = 'base-asset-variant'
      const variantDir = path.join(testAssetsDir, variantId)
      await fs.mkdir(variantDir, { recursive: true })
      await fs.writeFile(
        path.join(variantDir, 'metadata.json'),
        JSON.stringify({
          name: 'Variant',
          type: 'weapon',
          isVariant: true,
          parentBaseModel: baseId,
          generatedAt: new Date().toISOString()
        })
      )
      await fs.writeFile(path.join(variantDir, 'variant.glb'), Buffer.from('data'))

      await service.deleteAsset(baseId, true)

      const baseExists = await fs.access(baseDir).then(() => true).catch(() => false)
      const variantExists = await fs.access(variantDir).then(() => true).catch(() => false)

      expect(baseExists).toBe(false)
      expect(variantExists).toBe(false)
    })

    it('should throw error for non-existent asset', async () => {
      await expect(
        service.deleteAsset('non-existent')
      ).rejects.toThrow()
    })
  })

  describe('updateAsset', () => {
    it('should update metadata fields', async () => {
      const updates = {
        metadata: {
          description: 'Updated description',
          tags: ['test', 'updated']
        }
      }

      const updated = await service.updateAsset('test-sword', updates)

      expect(updated.metadata.description).toBe('Updated description')
      expect(updated.metadata.tags).toEqual(['test', 'updated'])
      expect(updated.metadata.lastModified).toBeDefined()
    })

    it('should rename asset directory when name changes', async () => {
      const updates = {
        name: 'renamed-sword'
      }

      const updated = await service.updateAsset('test-sword', updates)

      expect(updated.id).toBe('renamed-sword')

      const oldExists = await fs.access(
        path.join(testAssetsDir, 'test-sword')
      ).then(() => true).catch(() => false)
      const newExists = await fs.access(
        path.join(testAssetsDir, 'renamed-sword')
      ).then(() => true).catch(() => false)

      expect(oldExists).toBe(false)
      expect(newExists).toBe(true)
    })

    it('should return null for non-existent asset', async () => {
      const updated = await service.updateAsset('non-existent', {
        metadata: { test: 'value' }
      })

      expect(updated).toBeNull()
    })

    it('should prevent rename collision', async () => {
      // Create second asset
      const secondId = 'second-sword'
      const secondDir = path.join(testAssetsDir, secondId)
      await fs.mkdir(secondDir, { recursive: true })
      await fs.writeFile(
        path.join(secondDir, 'metadata.json'),
        JSON.stringify({ name: 'Second Sword', type: 'weapon', generatedAt: new Date().toISOString() })
      )
      await fs.writeFile(path.join(secondDir, 'second.glb'), Buffer.from('data'))

      await expect(
        service.updateAsset('test-sword', { name: 'second-sword' })
      ).rejects.toThrow(/already exists/)
    })
  })

  describe('security', () => {
    it('should prevent path traversal in getModelPath', async () => {
      await expect(
        service.getModelPath('../../sensitive-file')
      ).rejects.toThrow()
    })

    it('should prevent path traversal in loadAsset', async () => {
      await expect(
        service.loadAsset('../../../etc/passwd')
      ).rejects.toThrow()
    })

    it('should validate asset IDs', async () => {
      const invalidIds = [
        '../parent',
        '../../root',
        '/absolute/path',
        'path/with/../traversal'
      ]

      for (const invalidId of invalidIds) {
        await expect(
          service.getModelPath(invalidId)
        ).rejects.toThrow()
      }
    })
  })
})
