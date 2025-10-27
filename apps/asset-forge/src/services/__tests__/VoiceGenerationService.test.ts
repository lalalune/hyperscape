/**
 * Voice Generation Service Tests
 * 
 * Comprehensive test suite for ElevenLabs voice generation integration.
 * Tests all service methods with proper mocking and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type {
  ElevenLabsVoice,
  VoiceLibraryResponse,
  VoiceSubscriptionInfo,
  VoiceModel,
  VoiceModelsResponse,
  VoiceCostEstimate,
  VoiceProfile,
  VoiceDesignResponse,
  CreateVoiceResponse,
  RateLimitInfo
} from '../../types/voice-generation'

// Mock ONLY apiFetch, let API_ENDPOINTS be real
vi.mock('../../utils/api', () => ({
  apiFetch: vi.fn()
}))

// Mock PrivyAuthManager to avoid initialization issues
vi.mock('../../auth/PrivyAuthManager', () => ({
  privyAuthManager: {
    getToken: vi.fn(() => null),
    getUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false)
  }
}))

// NOW import the service after mocks are set up
import { apiFetch } from '../../utils/api'
import { voiceGenerationService } from '../VoiceGenerationService'

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>

describe('VoiceGenerationService', () => {
  beforeEach(() => {
    // Completely reset the mock between tests
    mockApiFetch.mockClear()
    mockApiFetch.mockReset()
  })

  afterEach(() => {
    // Clean up any pending mock responses
    mockApiFetch.mockClear()
  })

  describe('getVoiceLibrary', () => {
    it('should fetch and return voices from library', async () => {
      const mockVoices: ElevenLabsVoice[] = [
        {
          voiceId: 'voice-1',
          name: 'Rachel',
          category: 'premade',
          description: 'American female voice',
          labels: { accent: 'american', gender: 'female' },
          previewUrl: 'https://example.com/preview.mp3'
        },
        {
          voiceId: 'voice-2',
          name: 'Adam',
          category: 'premade',
          description: 'American male voice',
          labels: { accent: 'american', gender: 'male' }
        }
      ]

      const mockResponse: VoiceLibraryResponse = {
        voices: mockVoices,
        count: 2
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await voiceGenerationService.getVoiceLibrary()

      expect(mockApiFetch).toHaveBeenCalled()
      expect(result).toEqual(mockVoices)
      expect(result).toHaveLength(2)
    })

    it('should throw error when API request fails', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API key invalid' })
      })

      await expect(voiceGenerationService.getVoiceLibrary()).rejects.toThrow('API key invalid')
    })

    it('should handle network errors', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(voiceGenerationService.getVoiceLibrary()).rejects.toThrow('Network error')
    })
  })

  describe('generateVoiceClip', () => {
    it('should generate single voice clip and return audio blob', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3, 4, 5])
      const mockBlob = new Blob([mockAudioData], { type: 'audio/mpeg' })

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob
      })

      const result = await voiceGenerationService.generateVoiceClip({
        text: 'Hello world',
        voiceId: 'voice-1'
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Hello world'),
          deduplicate: false
        })
      )
      expect(result).toBeInstanceOf(Blob)
    })

    it('should include optional voice settings', async () => {
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob
      })

      await voiceGenerationService.generateVoiceClip({
        text: 'Test',
        voiceId: 'voice-1',
        modelId: 'eleven_turbo_v2_5',
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.5,
        useSpeakerBoost: false
      })

      const callArgs = mockApiFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string)

      expect(body).toMatchObject({
        text: 'Test',
        voiceId: 'voice-1',
        modelId: 'eleven_turbo_v2_5',
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.5,
        useSpeakerBoost: false
      })
    })

    it('should throw error on generation failure', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Quota exceeded' })
      })

      await expect(
        voiceGenerationService.generateVoiceClip({
          text: 'Test',
          voiceId: 'voice-1'
        })
      ).rejects.toThrow('Quota exceeded')
    })
  })

  describe('getSubscriptionInfo', () => {
    it('should fetch subscription information', async () => {
      const mockSubscription: VoiceSubscriptionInfo = {
        tier: 'creator',
        characterCount: 50000,
        characterLimit: 100000,
        canExtendCharacterLimit: true,
        allowedToExtendCharacterLimit: true,
        nextCharacterCountResetUnix: Date.now() + 86400000,
        voiceLimit: 10,
        professionalVoiceLimit: 2,
        canExtendVoiceLimit: false,
        canUseInstantVoiceCloning: true,
        canUseProfessionalVoiceCloning: false,
        availableModels: ['eleven_multilingual_v2', 'eleven_turbo_v2_5'],
        status: 'active'
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubscription
      })

      const result = await voiceGenerationService.getSubscriptionInfo()

      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/voice/subscription'))
      expect(result).toEqual(mockSubscription)
      expect(result.tier).toBe('creator')
      expect(result.characterCount).toBe(50000)
    })
  })

  describe('getAvailableModels', () => {
    it('should fetch available TTS models', async () => {
      const mockModels: VoiceModel[] = [
        {
          modelId: 'eleven_multilingual_v2',
          name: 'Eleven Multilingual v2',
          description: 'High quality multilingual model',
          canBeFinetuned: false,
          canDoTextToSpeech: true,
          canDoVoiceConversion: false,
          canUseStyle: true,
          canUseSpeakerBoost: true,
          servesProVoices: false,
          tokenCostFactor: 1.0,
          languages: [
            { languageId: 'en', name: 'English' },
            { languageId: 'es', name: 'Spanish' }
          ]
        }
      ]

      const mockResponse: VoiceModelsResponse = {
        models: mockModels,
        count: 1
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await voiceGenerationService.getAvailableModels()

      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/voice/models'))
      expect(result).toEqual(mockModels)
      expect(result[0].modelId).toBe('eleven_multilingual_v2')
    })
  })

  describe('getRateLimitInfo', () => {
    it('should fetch rate limit information', async () => {
      const mockRateLimit: RateLimitInfo = {
        currentConcurrentRequests: 2,
        maximumConcurrentRequests: 5,
        remainingCapacity: 3,
        utilizationPercent: 40,
        tier: 'Creator',
        lastUpdated: Date.now()
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRateLimit
      })

      const result = await voiceGenerationService.getRateLimitInfo()

      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/voice/rate-limit'))
      expect(result).toEqual(mockRateLimit)
      expect(result.maximumConcurrentRequests).toBe(5)
      expect(result.remainingCapacity).toBe(3)
    })
  })

  describe('speechToSpeech', () => {
    it.skip('should convert audio using speech-to-speech (requires browser FileReader)', async () => {
      // Mock File
      const mockFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' })

      // Mock base64 response from API
      const mockBase64Audio = btoa('converted audio data')
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          audio: mockBase64Audio,
          size: 1024,
          format: 'mp3_44100_128'
        })
      })

      const result = await voiceGenerationService.speechToSpeech({
        audio: mockFile,
        voiceId: 'voice-1',
        stability: 0.5,
        similarityBoost: 0.75
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/voice/speech-to-speech',
        expect.objectContaining({
          method: 'POST',
          deduplicate: false
        })
      )
      expect(result).toBeInstanceOf(Blob)
    })

    it('should accept base64 string directly', async () => {
      const mockBase64Input = 'base64audiodata'
      const mockBase64Output = btoa('converted audio')

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          audio: mockBase64Output,
          size: 1024,
          format: 'mp3_44100_128'
        })
      })

      const result = await voiceGenerationService.speechToSpeech({
        audio: mockBase64Input,
        voiceId: 'voice-1'
      })

      expect(result).toBeInstanceOf(Blob)
    })

    it.skip('should include optional parameters (requires browser FileReader)', async () => {
      const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
      const mockBase64Audio = btoa('converted')

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          audio: mockBase64Audio,
          size: 512,
          format: 'mp3_44100_128'
        })
      })

      await voiceGenerationService.speechToSpeech({
        audio: mockFile,
        voiceId: 'voice-1',
        modelId: 'eleven_multilingual_sts_v2',
        removeBackgroundNoise: true,
        seed: 12345
      })

      const callArgs = mockApiFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string)

      expect(body.modelId).toBe('eleven_multilingual_sts_v2')
      expect(body.removeBackgroundNoise).toBe(true)
      expect(body.seed).toBe(12345)
    })
  })

  describe('designVoice', () => {
    it('should generate voice previews from description', async () => {
      const mockResponse: VoiceDesignResponse = {
        previews: [
          {
            generatedVoiceId: 'preview-1',
            audioBase64: btoa('preview audio 1'),
            mediaType: 'audio/mpeg',
            durationSecs: 3.5,
            language: 'en'
          },
          {
            generatedVoiceId: 'preview-2',
            audioBase64: btoa('preview audio 2'),
            mediaType: 'audio/mpeg',
            durationSecs: 3.2,
            language: 'en'
          }
        ],
        text: 'This is a generated preview text'
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await voiceGenerationService.designVoice({
        voiceDescription: 'A young, energetic female voice with American accent'
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/design'),
        expect.objectContaining({
          method: 'POST',
          deduplicate: false
        })
      )
      expect(result.previews).toHaveLength(2)
      expect(result.text).toBe('This is a generated preview text')
    })

    it('should include custom text and settings', async () => {
      const mockResponse: VoiceDesignResponse = {
        previews: [],
        text: 'Custom preview text'
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await voiceGenerationService.designVoice({
        voiceDescription: 'Deep male voice',
        text: 'Custom preview text',
        autoGenerateText: false,
        loudness: 1.2,
        guidanceScale: 4.0,
        seed: 42
      })

      const callArgs = mockApiFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string)

      expect(body.voiceDescription).toBe('Deep male voice')
      expect(body.text).toBe('Custom preview text')
      expect(body.autoGenerateText).toBe(false)
      expect(body.loudness).toBe(1.2)
      expect(body.guidanceScale).toBe(4.0)
      expect(body.seed).toBe(42)
    })
  })

  describe('createVoiceFromPreview', () => {
    it('should save designed voice to library', async () => {
      const mockResponse: CreateVoiceResponse = {
        voiceId: 'new-voice-123',
        name: 'My Custom Voice',
        category: 'generated',
        description: 'A custom designed voice',
        labels: { type: 'custom' },
        previewUrl: 'https://example.com/preview.mp3',
        createdAt: Date.now()
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await voiceGenerationService.createVoiceFromPreview({
        voiceName: 'My Custom Voice',
        voiceDescription: 'A custom designed voice',
        generatedVoiceId: 'preview-123'
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/create-from-preview'),
        expect.objectContaining({
          method: 'POST',
          deduplicate: false
        })
      )
      expect(result.voiceId).toBe('new-voice-123')
      expect(result.name).toBe('My Custom Voice')
    })

    it('should include optional labels and played voice IDs', async () => {
      const mockResponse: CreateVoiceResponse = {
        voiceId: 'voice-456',
        name: 'Test Voice',
        category: 'generated',
        description: 'Test',
        labels: { custom: 'true', gender: 'female' },
        createdAt: Date.now()
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await voiceGenerationService.createVoiceFromPreview({
        voiceName: 'Test Voice',
        voiceDescription: 'Test',
        generatedVoiceId: 'preview-456',
        labels: { custom: 'true', gender: 'female' },
        playedNotSelectedVoiceIds: ['preview-1', 'preview-2']
      })

      const callArgs = mockApiFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string)

      expect(body.labels).toEqual({ custom: 'true', gender: 'female' })
      expect(body.playedNotSelectedVoiceIds).toEqual(['preview-1', 'preview-2'])
    })
  })

  describe('estimateCost', () => {
    it('should estimate cost for voice generation', async () => {
      const mockEstimate: VoiceCostEstimate = {
        characterCount: 500,
        modelId: 'eleven_multilingual_v2',
        creditsRequired: 500,
        estimatedCostUSD: '0.1500'
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEstimate
      })

      const result = await voiceGenerationService.estimateCost(500, 'eleven_multilingual_v2')

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/estimate'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('500')
        })
      )
      expect(result.characterCount).toBe(500)
      expect(result.creditsRequired).toBe(500)
    })
  })

  describe('getVoiceProfile', () => {
    it('should fetch voice profile for NPC', async () => {
      const mockProfile: VoiceProfile = {
        npcId: 'npc-123',
        voiceId: 'voice-1',
        voiceName: 'Rachel',
        settings: {
          modelId: 'eleven_multilingual_v2',
          stability: 0.5,
          similarityBoost: 0.75
        },
        clips: 10,
        generatedAt: new Date().toISOString()
      }

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile
      })

      const result = await voiceGenerationService.getVoiceProfile('npc-123')

      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/voice/profile/npc-123'))
      expect(result).toEqual(mockProfile)
      expect(result?.npcId).toBe('npc-123')
    })

    it('should return null when profile not found', async () => {
      mockApiFetch.mockResolvedValueOnce({
        status: 404,
        ok: false
      })

      const result = await voiceGenerationService.getVoiceProfile('npc-999')

      expect(result).toBeNull()
    })
  })

  describe('deleteVoiceClips', () => {
    it('should delete voice clips for NPC', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const result = await voiceGenerationService.deleteVoiceClips('npc-123')

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice/npc-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(result).toBe(true)
    })

    it('should handle deletion errors', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' })
      })

      await expect(voiceGenerationService.deleteVoiceClips('npc-999')).rejects.toThrow('Not found')
    })
  })

  describe('playAudioPreview', () => {
    it.skip('should create audio element and play (requires browser window)', () => {
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
      
      const audio = voiceGenerationService.playAudioPreview(mockBlob)

      expect(audio).toBeDefined()
      // Audio mock from setup.ts should have play called
    })
  })

  describe('downloadVoiceClip', () => {
    it.skip('should trigger download without errors (requires browser document)', () => {
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
      
      // Should not throw
      expect(() => {
        voiceGenerationService.downloadVoiceClip(mockBlob, 'test-voice.mp3')
      }).not.toThrow()
    })

    it.skip('should handle filename without extension (requires browser document)', () => {
      const mockBlob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' })
      
      // Should not throw
      expect(() => {
        voiceGenerationService.downloadVoiceClip(mockBlob, 'test-voice')
      }).not.toThrow()
    })
  })

  describe('calculateCharacterCount', () => {
    it('should calculate total character count from dialogue nodes', () => {
      const dialogueNodes = [
        { text: 'Hello world' },      // 11 chars
        { text: 'How are you?' },      // 12 chars
        { text: 'Goodbye!' }           // 8 chars
      ]

      const count = voiceGenerationService.calculateCharacterCount(dialogueNodes)

      expect(count).toBe(31)
    })

    it('should handle empty array', () => {
      const count = voiceGenerationService.calculateCharacterCount([])
      expect(count).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should log errors with service prefix', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockApiFetch.mockRejectedValueOnce(new Error('Network failure'))

      await expect(voiceGenerationService.getVoiceLibrary()).rejects.toThrow('Network failure')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceGenerationService]'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should throw descriptive errors from API', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Quota exceeded',
          message: 'You have used all your monthly characters'
        })
      })

      await expect(voiceGenerationService.getVoiceLibrary()).rejects.toThrow('Quota exceeded')
    })
  })
})

