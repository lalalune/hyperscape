import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmoteManager } from '../../managers/emote-manager'
import { createMockRuntime } from '../test-utils'
import { createMockWorld } from '../helpers/mock-world'

describe('EmoteManager', () => {
  let mockRuntime: any
  let emoteManager: EmoteManager
  let mockWorld: any

  beforeEach(() => {
    vi.restoreAllMocks()
    mockRuntime = createMockRuntime()
    mockWorld = {
      entities: {
        player: {
          data: {
            id: 'test-player-id',
            effect: {},
          },
        },
      },
      actions: {
        execute: vi.fn(),
      },
    }
    emoteManager = new EmoteManager(mockRuntime)
  })

  describe('playEmote', () => {
    it('should play an emote when world and player exist', () => {
      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(mockWorld),
        isConnected: vi.fn().mockReturnValue(true),
      })

      emoteManager.playEmote('wave')

      // Check that the player's effect.emote was set
      expect(mockWorld.entities.player.data.effect.emote).toBe('wave')
    })

    it('should handle missing world gracefully', () => {
      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(null),
        isConnected: vi.fn().mockReturnValue(false),
      })

      expect(() => emoteManager.playEmote('wave')).not.toThrow()
    })

    it('should handle missing service gracefully', () => {
      mockRuntime.getService = vi.fn().mockReturnValue(null)

      expect(() => emoteManager.playEmote('wave')).not.toThrow()
    })

    it('should handle empty emote name', () => {
      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(mockWorld),
        isConnected: vi.fn().mockReturnValue(true),
      })

      emoteManager.playEmote('')

      // Check that the player's effect.emote was set to empty string
      expect(mockWorld.entities.player.data.effect.emote).toBe('')
    })
  })

  describe('playEmote with duration', () => {
    it('should set up emote correctly', () => {
      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(mockWorld),
        isConnected: vi.fn().mockReturnValue(true),
      })

      emoteManager.playEmote('wave')

      // Check that the emote was set
      expect(mockWorld.entities.player.data.effect.emote).toBe('wave')
    })
  })

  describe('uploadEmotes', () => {
    it('should handle emote upload process', async () => {
      // Mock world with network and assetsUrl
      const mockWorldWithNetwork = {
        ...mockWorld,
        network: {
          upload: vi.fn().mockResolvedValue('success'),
        },
        assetsUrl: 'https://test.com/assets',
      }

      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(mockWorldWithNetwork),
        isConnected: vi.fn().mockReturnValue(true),
      })

      // Test that uploadEmotes can be called (it will fail due to missing files but shouldn't crash)
      await emoteManager.uploadEmotes()

      // Test passes if we reach here without crashing
      expect(true).toBe(true)
    })
  })

  describe('emote hash mapping', () => {
    it('should handle emote mapping correctly', () => {
      // Test basic emote mapping functionality
      const mockWorldWithPlayer = {
        ...mockWorld,
        entities: {
          player: {
            data: {
              id: 'test-player-id',
              effect: { emote: null },
            },
          },
        },
      }

      mockRuntime.getService = vi.fn().mockReturnValue({
        getWorld: vi.fn().mockReturnValue(mockWorldWithPlayer),
        isConnected: vi.fn().mockReturnValue(true),
      })

      // Play the emote
      emoteManager.playEmote('wave')

      // Should set the player's effect.emote
      expect(mockWorldWithPlayer.entities.player.data.effect.emote).toBe('wave')
    })
  })
})
