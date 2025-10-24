/**
 * Asset Helpers Tests
 * Comprehensive tests for asset-related operations including
 * URL construction, type detection, file extensions, and MIME types
 */

import { describe, it, expect } from 'vitest'
import {
  getFileExtension,
  getBasename,
  hasExtension,
  hasAnyExtension,
  getMimeType,
  detectAssetType,
  isModelFile,
  isImageFile,
  isAudioFile,
  getModelUrl,
  getTextureUrl,
  getAudioUrl,
  sanitizeFilename,
  generateUniqueFilename,
  parseAssetFilename,
  isValidUrl,
  isAbsoluteUrl,
  joinUrl,
  getFilenameFromUrl,
  addQueryParams,
  filenameContains,
  filenameStartsWith,
  filenameEndsWith
} from '@/utils/asset-helpers'

describe('asset-helpers', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('model.glb')).toBe('glb')
      expect(getFileExtension('texture.png')).toBe('png')
    })

    it('should handle multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('should return lowercase extension', () => {
      expect(getFileExtension('MODEL.GLB')).toBe('glb')
    })

    it('should return empty for no extension', () => {
      expect(getFileExtension('filename')).toBe('')
    })

    it('should handle empty string', () => {
      expect(getFileExtension('')).toBe('')
    })
  })

  describe('getBasename', () => {
    it('should extract basename without extension', () => {
      expect(getBasename('model.glb')).toBe('model')
    })

    it('should handle multiple dots', () => {
      expect(getBasename('character.avatar.vrm')).toBe('character.avatar')
    })

    it('should handle no extension', () => {
      expect(getBasename('filename')).toBe('filename')
    })

    it('should handle empty string', () => {
      expect(getBasename('')).toBe('')
    })
  })

  describe('hasExtension', () => {
    it('should return true for matching extension', () => {
      expect(hasExtension('model.glb', 'glb')).toBe(true)
    })

    it('should be case-insensitive', () => {
      expect(hasExtension('MODEL.GLB', 'glb')).toBe(true)
      expect(hasExtension('model.glb', 'GLB')).toBe(true)
    })

    it('should return false for non-matching extension', () => {
      expect(hasExtension('texture.png', 'jpg')).toBe(false)
    })
  })

  describe('hasAnyExtension', () => {
    it('should return true if any extension matches', () => {
      expect(hasAnyExtension('model.glb', ['glb', 'gltf'])).toBe(true)
      expect(hasAnyExtension('model.gltf', ['glb', 'gltf'])).toBe(true)
    })

    it('should return false if no extension matches', () => {
      expect(hasAnyExtension('texture.png', ['jpg', 'jpeg'])).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(hasAnyExtension('MODEL.GLB', ['glb', 'gltf'])).toBe(true)
    })
  })

  describe('getMimeType', () => {
    it('should return correct MIME type for 3D models', () => {
      expect(getMimeType('model.glb')).toBe('model/gltf-binary')
      expect(getMimeType('model.gltf')).toBe('model/gltf+json')
      expect(getMimeType('model.vrm')).toBe('model/gltf-binary')
    })

    it('should return correct MIME type for images', () => {
      expect(getMimeType('image.png')).toBe('image/png')
      expect(getMimeType('image.jpg')).toBe('image/jpeg')
      expect(getMimeType('image.jpeg')).toBe('image/jpeg')
    })

    it('should return correct MIME type for audio', () => {
      expect(getMimeType('sound.mp3')).toBe('audio/mpeg')
      expect(getMimeType('sound.wav')).toBe('audio/wav')
    })

    it('should return default for unknown types', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream')
    })
  })

  describe('detectAssetType', () => {
    it('should detect model files', () => {
      expect(detectAssetType('sword.glb')).toBe('model')
      expect(detectAssetType('helmet.gltf')).toBe('model')
      expect(detectAssetType('character.vrm')).toBe('model')
    })

    it('should detect image files', () => {
      expect(detectAssetType('texture.png')).toBe('image')
      expect(detectAssetType('icon.jpg')).toBe('image')
    })

    it('should detect audio files', () => {
      expect(detectAssetType('sound.mp3')).toBe('audio')
      expect(detectAssetType('music.wav')).toBe('audio')
    })

    it('should detect video files', () => {
      expect(detectAssetType('video.mp4')).toBe('video')
    })

    it('should detect document files', () => {
      expect(detectAssetType('readme.txt')).toBe('document')
      expect(detectAssetType('data.json')).toBe('document')
    })

    it('should detect archive files', () => {
      expect(detectAssetType('package.zip')).toBe('archive')
    })

    it('should return unknown for unrecognized types', () => {
      expect(detectAssetType('file.xyz')).toBe('unknown')
    })
  })

  describe('isModelFile', () => {
    it('should return true for model files', () => {
      expect(isModelFile('sword.glb')).toBe(true)
      expect(isModelFile('helmet.gltf')).toBe(true)
    })

    it('should return false for non-model files', () => {
      expect(isModelFile('texture.png')).toBe(false)
      expect(isModelFile('sound.mp3')).toBe(false)
    })
  })

  describe('isImageFile', () => {
    it('should return true for image files', () => {
      expect(isImageFile('texture.png')).toBe(true)
      expect(isImageFile('icon.jpg')).toBe(true)
    })

    it('should return false for non-image files', () => {
      expect(isImageFile('model.glb')).toBe(false)
    })
  })

  describe('isAudioFile', () => {
    it('should return true for audio files', () => {
      expect(isAudioFile('sound.mp3')).toBe(true)
      expect(isAudioFile('music.wav')).toBe(true)
    })

    it('should return false for non-audio files', () => {
      expect(isAudioFile('video.mp4')).toBe(false)
    })
  })

  describe('getModelUrl', () => {
    it('should construct URL with default base', () => {
      expect(getModelUrl('sword-001')).toBe('/models/sword-001.glb')
    })

    it('should use custom base URL', () => {
      expect(getModelUrl('helmet', '/assets/3d')).toBe('/assets/3d/helmet.glb')
    })

    it('should preserve existing extension', () => {
      expect(getModelUrl('model.gltf')).toBe('/models/model.gltf')
    })
  })

  describe('getTextureUrl', () => {
    it('should construct URL with default base', () => {
      expect(getTextureUrl('stone-diffuse')).toBe('/textures/stone-diffuse.png')
    })

    it('should use custom base URL', () => {
      expect(getTextureUrl('wood.jpg', '/assets/textures')).toBe('/assets/textures/wood.jpg')
    })

    it('should preserve existing extension', () => {
      expect(getTextureUrl('texture.jpg')).toBe('/textures/texture.jpg')
    })
  })

  describe('getAudioUrl', () => {
    it('should construct URL with default base', () => {
      expect(getAudioUrl('sword-swing')).toBe('/audio/sword-swing.mp3')
    })

    it('should use custom base URL', () => {
      expect(getAudioUrl('music.ogg', '/assets/sounds')).toBe('/assets/sounds/music.ogg')
    })
  })

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('My File!@#$.glb')).toBe('My-File-.glb')
    })

    it('should replace spaces with hyphens', () => {
      expect(sanitizeFilename('my file.glb')).toBe('my-file.glb')
    })

    it('should replace multiple hyphens with single', () => {
      expect(sanitizeFilename('my---file.glb')).toBe('my-file.glb')
    })

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeFilename('-my-file-.glb')).toBe('my-file-.glb')
    })
  })

  describe('generateUniqueFilename', () => {
    it('should append timestamp to filename', () => {
      const result = generateUniqueFilename('model.glb')
      expect(result).toMatch(/^model-\d+\.glb$/)
    })

    it('should handle filenames without extension', () => {
      const result = generateUniqueFilename('model')
      expect(result).toMatch(/^model-\d+$/)
    })

    it('should preserve complex extensions', () => {
      const result = generateUniqueFilename('archive.tar.gz')
      expect(result).toMatch(/^archive\.tar-\d+\.gz$/)
    })
  })

  describe('parseAssetFilename', () => {
    it('should parse filename parts', () => {
      const result = parseAssetFilename('sword-bronze-legendary.glb')
      expect(result.name).toBe('sword')
      expect(result.parts).toEqual(['sword', 'bronze', 'legendary'])
      expect(result.extension).toBe('glb')
    })

    it('should handle single-part names', () => {
      const result = parseAssetFilename('sword.glb')
      expect(result.name).toBe('sword')
      expect(result.parts).toEqual(['sword'])
    })

    it('should handle filenames without extension', () => {
      const result = parseAssetFilename('model')
      expect(result.extension).toBe('')
    })
  })

  describe('isValidUrl', () => {
    it('should validate absolute URLs', () => {
      expect(isValidUrl('https://example.com/model.glb')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
    })

    it('should validate relative URLs', () => {
      expect(isValidUrl('/models/sword.glb')).toBe(true)
      expect(isValidUrl('./relative/path')).toBe(true)
      expect(isValidUrl('../parent/path')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false)
    })

    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('isAbsoluteUrl', () => {
    it('should return true for absolute URLs', () => {
      expect(isAbsoluteUrl('https://example.com/model.glb')).toBe(true)
      expect(isAbsoluteUrl('http://example.com')).toBe(true)
    })

    it('should return false for relative URLs', () => {
      expect(isAbsoluteUrl('/models/sword.glb')).toBe(false)
      expect(isAbsoluteUrl('./relative')).toBe(false)
    })

    it('should return false for empty strings', () => {
      expect(isAbsoluteUrl('')).toBe(false)
    })
  })

  describe('joinUrl', () => {
    it('should join URL parts with single slash', () => {
      expect(joinUrl('/models/', '/sword.glb')).toBe('/models/sword.glb')
    })

    it('should handle multiple parts', () => {
      expect(joinUrl('https://example.com/', 'assets', 'model.glb'))
        .toBe('https://example.com/assets/model.glb')
    })

    it('should handle parts without slashes', () => {
      expect(joinUrl('base', 'path', 'file.glb')).toBe('base/path/file.glb')
    })

    it('should remove trailing slashes between parts', () => {
      expect(joinUrl('/models/', 'sword.glb')).toBe('/models/sword.glb')
    })
  })

  describe('getFilenameFromUrl', () => {
    it('should extract filename from URL', () => {
      expect(getFilenameFromUrl('https://example.com/models/sword.glb')).toBe('sword.glb')
    })

    it('should extract filename from path', () => {
      expect(getFilenameFromUrl('/assets/texture.png')).toBe('texture.png')
    })

    it('should remove query parameters', () => {
      expect(getFilenameFromUrl('/models/sword.glb?v=1')).toBe('sword.glb')
    })

    it('should handle empty URL', () => {
      expect(getFilenameFromUrl('')).toBe('')
    })
  })

  describe('addQueryParams', () => {
    it('should add single query parameter', () => {
      expect(addQueryParams('/api/assets', { id: '123' }))
        .toBe('/api/assets?id=123')
    })

    it('should add multiple query parameters', () => {
      const result = addQueryParams('/api/assets', { id: '123', format: 'json' })
      expect(result).toContain('id=123')
      expect(result).toContain('format=json')
    })

    it('should encode special characters', () => {
      const result = addQueryParams('/api/assets', { query: 'hello world' })
      expect(result).toContain('hello%20world')
    })

    it('should handle numeric values', () => {
      expect(addQueryParams('/api', { count: 42 })).toContain('count=42')
    })

    it('should handle boolean values', () => {
      expect(addQueryParams('/api', { active: true })).toContain('active=true')
    })

    it('should return original URL for empty params', () => {
      expect(addQueryParams('/api/assets', {})).toBe('/api/assets')
    })
  })

  describe('filenameContains', () => {
    it('should find pattern case-insensitively', () => {
      expect(filenameContains('bronze-sword.glb', 'sword')).toBe(true)
      expect(filenameContains('Helmet_01.glb', 'helmet')).toBe(true)
    })

    it('should return false when pattern not found', () => {
      expect(filenameContains('sword.glb', 'axe')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(filenameContains('', 'test')).toBe(false)
      expect(filenameContains('test', '')).toBe(false)
    })
  })

  describe('filenameStartsWith', () => {
    it('should check start pattern case-insensitively', () => {
      expect(filenameStartsWith('sword-bronze.glb', 'sword')).toBe(true)
      expect(filenameStartsWith('Helmet_01.glb', 'helm')).toBe(true)
    })

    it('should return false when pattern not at start', () => {
      expect(filenameStartsWith('bronze-sword.glb', 'sword')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(filenameStartsWith('', 'test')).toBe(false)
    })
  })

  describe('filenameEndsWith', () => {
    it('should check end pattern case-insensitively before extension', () => {
      expect(filenameEndsWith('bronze-sword.glb', 'sword')).toBe(true)
      expect(filenameEndsWith('Helmet_LOD0.glb', 'lod0')).toBe(true)
    })

    it('should return false when pattern not at end', () => {
      expect(filenameEndsWith('sword-bronze.glb', 'sword')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(filenameEndsWith('', 'test')).toBe(false)
    })
  })
})
