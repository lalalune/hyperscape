/**
 * Voice Generation Store Tests
 * 
 * Tests for Zustand store managing voice generation state.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ====================================
// CRITICAL: Setup mocks at MODULE LOAD TIME (before any other imports!)
// ====================================

// Mock localStorage IMMEDIATELY - must be before importing any modules
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

// Set localStorage on global IMMEDIATELY (not in a beforeAll hook!)
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
})

// Ensure document exists for @testing-library/react
if (typeof document === 'undefined') {
  const mockElement: any = {
    nodeType: 1, // ELEMENT_NODE - required by React
    nodeName: 'DIV',
    appendChild: vi.fn((node) => node),
    removeChild: vi.fn((node) => node),
    insertBefore: vi.fn((node) => node),
    contains: vi.fn(() => false),
    children: [],
    childNodes: [],
    firstChild: null,
    lastChild: null,
    innerHTML: '',
    textContent: '',
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }
  
  ;(global as any).document = {
    createElement: vi.fn((tag: string) => {
      const element = {
        ...mockElement,
        nodeType: 1,
        nodeName: tag.toUpperCase(),
        tagName: tag.toUpperCase()
      }
      if (tag === 'body') {
        element.nodeName = 'BODY'
        element.tagName = 'BODY'
      }
      return element
    }),
    body: { ...mockElement, nodeName: 'BODY', tagName: 'BODY' },
    documentElement: { ...mockElement, nodeName: 'HTML', tagName: 'HTML' },
    getElementById: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  }
} else if (!document.body) {
  // document exists but body doesn't
  const mockBody: any = {
    nodeType: 1,
    nodeName: 'BODY',
    tagName: 'BODY',
    appendChild: vi.fn((node) => node),
    removeChild: vi.fn((node) => node),
    insertBefore: vi.fn((node) => node),
    contains: vi.fn(() => false),
    children: [],
    childNodes: [],
    innerHTML: '',
    textContent: '',
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  ;(document as any).body = mockBody
}

// Mock voiceGenerationService BEFORE importing store
vi.mock('../../services/VoiceGenerationService', () => ({
  voiceGenerationService: {
    getVoiceLibrary: vi.fn()
  }
}))

// Mock PrivyAuthManager to avoid localStorage errors
vi.mock('../../auth/PrivyAuthManager', () => ({
  privyAuthManager: {
    getToken: vi.fn(() => null),
    getUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false)
  }
}))

// Now safe to import testing utilities and types
import { renderHook, act } from '@testing-library/react'
import type { ElevenLabsVoice, VoiceClip } from '../../types/voice-generation'

// NOW import the store and service after mocks
import { useVoiceGenerationStore } from '../useVoiceGenerationStore'
import { voiceGenerationService } from '../../services/VoiceGenerationService'

const mockVoiceService = voiceGenerationService as any

describe('useVoiceGenerationStore', () => {
  const mockVoices: ElevenLabsVoice[] = [
    {
      voiceId: 'voice-1',
      name: 'Rachel',
      category: 'premade',
      description: 'American female',
      labels: { accent: 'american', gender: 'female' },
      previewUrl: 'https://example.com/rachel.mp3'
    },
    {
      voiceId: 'voice-2',
      name: 'Adam',
      category: 'premade',
      description: 'American male',
      labels: { accent: 'american', gender: 'male' }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    
    // Reset store to initial state
    const { result } = renderHook(() => useVoiceGenerationStore())
    act(() => {
      result.current.clearAll()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      expect(result.current.availableVoices).toEqual([])
      expect(result.current.voicesLoaded).toBe(false)
      expect(result.current.voicesLoading).toBe(false)
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.generationError).toBeNull()
      expect(result.current.selectedVoiceId).toBeNull()
      expect(result.current.currentSettings).toEqual({
        modelId: 'eleven_multilingual_v2',
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true
      })
    })
  })

  describe('loadVoices', () => {
    it('should load voices', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.loadVoices(mockVoices)
      })

      expect(result.current.availableVoices).toEqual(mockVoices)
      expect(result.current.voicesLoaded).toBe(true)
      expect(result.current.voicesLoading).toBe(false)
      expect(result.current.voicesCachedAt).toBeGreaterThan(0)
    })

    it('should not update cache timestamp when loading from cache', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.loadVoices(mockVoices)
      })

      const firstCacheTime = result.current.voicesCachedAt

      // Simulate loading from cache
      act(() => {
        result.current.loadVoices(mockVoices, true)
      })

      expect(result.current.voicesCachedAt).toBe(firstCacheTime)
    })
  })

  describe('fetchVoicesWithCache', () => {
    it('should fetch voices and cache them', async () => {
      mockVoiceService.getVoiceLibrary.mockResolvedValueOnce(mockVoices)

      const { result } = renderHook(() => useVoiceGenerationStore())

      await act(async () => {
        await result.current.fetchVoicesWithCache()
      })

      expect(mockVoiceService.getVoiceLibrary).toHaveBeenCalled()
      expect(result.current.availableVoices).toEqual(mockVoices)
      expect(result.current.voicesLoaded).toBe(true)
      expect(result.current.voicesLoading).toBe(false)

      // Check cache was set
      const cached = localStorage.getItem('elevenlabs_voices_cache')
      expect(cached).toBeTruthy()
      
      const parsedCache = JSON.parse(cached!)
      expect(parsedCache.voices).toEqual(mockVoices)
    })

    it('should use cached voices if not expired', async () => {
      const cachedData = {
        voices: mockVoices,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 900000 // 15 minutes from now
      }
      localStorage.setItem('elevenlabs_voices_cache', JSON.stringify(cachedData))

      const { result } = renderHook(() => useVoiceGenerationStore())

      await act(async () => {
        await result.current.fetchVoicesWithCache()
      })

      // Should not call API
      expect(mockVoiceService.getVoiceLibrary).not.toHaveBeenCalled()
      expect(result.current.availableVoices).toEqual(mockVoices)
      expect(result.current.voicesLoaded).toBe(true)
    })

    it('should fetch fresh voices if cache expired', async () => {
      const cachedData = {
        voices: mockVoices,
        cachedAt: Date.now() - 1000000, // Old
        expiresAt: Date.now() - 1000 // Expired
      }
      localStorage.setItem('elevenlabs_voices_cache', JSON.stringify(cachedData))

      mockVoiceService.getVoiceLibrary.mockResolvedValueOnce(mockVoices)

      const { result } = renderHook(() => useVoiceGenerationStore())

      await act(async () => {
        await result.current.fetchVoicesWithCache()
      })

      // Should call API for fresh data
      expect(mockVoiceService.getVoiceLibrary).toHaveBeenCalled()
    })

    it('should handle fetch errors', async () => {
      mockVoiceService.getVoiceLibrary.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useVoiceGenerationStore())

      await act(async () => {
        try {
          await result.current.fetchVoicesWithCache()
        } catch (error) {
          // Expected error
        }
      })

      expect(result.current.voicesLoading).toBe(false)
    })
  })

  describe('clearVoiceCache', () => {
    it('should clear cache and fetch fresh voices', async () => {
      const cachedData = {
        voices: mockVoices,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 900000
      }
      localStorage.setItem('elevenlabs_voices_cache', JSON.stringify(cachedData))

      mockVoiceService.getVoiceLibrary.mockResolvedValueOnce(mockVoices)

      const { result } = renderHook(() => useVoiceGenerationStore())

      await act(async () => {
        await result.current.clearVoiceCache()
      })

      expect(localStorage.getItem('elevenlabs_voices_cache')).toBeNull()
      expect(mockVoiceService.getVoiceLibrary).toHaveBeenCalled()
    })
  })

  describe('Voice Selection', () => {
    it('should set selected voice', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setSelectedVoice('voice-1')
      })

      expect(result.current.selectedVoiceId).toBe('voice-1')
    })

    it('should clear selected voice', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setSelectedVoice('voice-1')
        result.current.setSelectedVoice(null)
      })

      expect(result.current.selectedVoiceId).toBeNull()
    })
  })

  describe('Voice Settings', () => {
    it('should update voice settings', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setCurrentSettings({
          stability: 0.7,
          similarityBoost: 0.8
        })
      })

      expect(result.current.currentSettings).toMatchObject({
        modelId: 'eleven_multilingual_v2', // Unchanged
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0,
        useSpeakerBoost: true
      })
    })

    it('should update individual settings', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setCurrentSettings({ modelId: 'eleven_turbo_v2_5' })
      })

      expect(result.current.currentSettings.modelId).toBe('eleven_turbo_v2_5')
      expect(result.current.currentSettings.stability).toBe(0.5) // Unchanged
    })
  })

  describe('NPC Voice Assignments', () => {
    it('should assign voice to NPC', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config).toBeDefined()
      expect(config?.npcId).toBe('npc-1')
      expect(config?.voiceId).toBe('voice-1')
      expect(config?.voiceName).toBe('Rachel')
      expect(config?.settings).toEqual(result.current.currentSettings)
    })

    it('should unassign voice from NPC', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.unassignVoiceFromNPC('npc-1')
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config).toBeUndefined()
    })

    it('should update NPC voice config', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.updateNPCVoiceConfig('npc-1', {
          totalClips: 5
        })
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config?.totalClips).toBe(5)
    })
  })

  describe('Voice Clips Management', () => {
    it('should add voice clip to NPC', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      const mockClip: VoiceClip = {
        nodeId: 'node-1',
        text: 'Hello world',
        audioUrl: 'voice/node-1.mp3',
        fileSize: 1024,
        generatedAt: new Date().toISOString()
      }

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.addVoiceClip('npc-1', 'node-1', mockClip)
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config?.clips['node-1']).toEqual(mockClip)
      expect(config?.totalClips).toBe(1)
    })

    it('should remove voice clip from NPC', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      const mockClip: VoiceClip = {
        nodeId: 'node-1',
        text: 'Hello world',
        audioUrl: 'voice/node-1.mp3',
        fileSize: 1024,
        generatedAt: new Date().toISOString()
      }

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.addVoiceClip('npc-1', 'node-1', mockClip)
        result.current.removeVoiceClip('npc-1', 'node-1')
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config?.clips['node-1']).toBeUndefined()
      expect(config?.totalClips).toBe(0)
    })

    it('should update totalClips count when adding multiple clips', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.addVoiceClip('npc-1', 'node-1', {
          nodeId: 'node-1',
          text: 'Test 1',
          audioUrl: 'voice/node-1.mp3',
          fileSize: 1024,
          generatedAt: new Date().toISOString()
        })
        result.current.addVoiceClip('npc-1', 'node-2', {
          nodeId: 'node-2',
          text: 'Test 2',
          audioUrl: 'voice/node-2.mp3',
          fileSize: 2048,
          generatedAt: new Date().toISOString()
        })
      })

      const config = result.current.getNPCVoiceConfig('npc-1')
      expect(config?.totalClips).toBe(2)
    })
  })

  describe('Generation State', () => {
    it('should set generating state', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setGenerating(true)
      })

      expect(result.current.isGenerating).toBe(true)

      act(() => {
        result.current.setGenerating(false)
      })

      expect(result.current.isGenerating).toBe(false)
    })

    it('should set generation progress', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setGenerationProgress(5, 10, 'npc-1')
      })

      expect(result.current.generationProgress).toEqual({
        current: 5,
        total: 10,
        npcId: 'npc-1'
      })
    })

    it('should set generation error', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.setGenerationError('Quota exceeded')
      })

      expect(result.current.generationError).toBe('Quota exceeded')

      act(() => {
        result.current.setGenerationError(null)
      })

      expect(result.current.generationError).toBeNull()
    })
  })

  describe('clearAll', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useVoiceGenerationStore())

      act(() => {
        result.current.assignVoiceToNPC('npc-1', 'voice-1', 'Rachel')
        result.current.setSelectedVoice('voice-1')
        result.current.setGenerating(true)
        result.current.setGenerationProgress(5, 10)
        result.current.setGenerationError('Test error')
      })

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.npcVoices.size).toBe(0)
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.generationProgress).toEqual({ current: 0, total: 0 })
      expect(result.current.generationError).toBeNull()
      expect(result.current.selectedVoiceId).toBeNull()
    })
  })

  describe('Voice Assignment Persistence', () => {
    it('should save voice assignments', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, version: 1 })
      }))

      const { result } = renderHook(() => useVoiceGenerationStore())

      const assignments = [
        { npcId: 'npc-1', voiceId: 'voice-1', voiceName: 'Rachel' },
        { npcId: 'npc-2', voiceId: 'voice-2', voiceName: 'Adam' }
      ]

      await act(async () => {
        await result.current.saveVoiceAssignments(
          'manifest-123',
          assignments,
          'Test Manifest',
          'Test description'
        )
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice-assignments/manifest-123'),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    it('should load voice assignments', async () => {
      const mockAssignments = [
        { npcId: 'npc-1', voiceId: 'voice-1', voiceName: 'Rachel' },
        { npcId: 'npc-2', voiceId: 'voice-2', voiceName: 'Adam' }
      ]

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assignments: mockAssignments })
      }))

      const { result } = renderHook(() => useVoiceGenerationStore())

      let assignments: any = []
      await act(async () => {
        assignments = await result.current.loadVoiceAssignments('manifest-123')
      })

      expect(assignments).toEqual(mockAssignments)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/voice-assignments/manifest-123')
      )
    })

    it('should return empty array when no assignments found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        status: 404,
        ok: false
      }))

      const { result } = renderHook(() => useVoiceGenerationStore())

      let assignments: any = []
      await act(async () => {
        assignments = await result.current.loadVoiceAssignments('manifest-999')
      })

      expect(assignments).toEqual([])
    })
  })
})

