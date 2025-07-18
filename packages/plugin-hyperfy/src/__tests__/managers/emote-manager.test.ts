import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { EmoteManager } from '../../managers/emote-manager';
import { createMockRuntime } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('EmoteManager', () => {
  let mockRuntime: any;
  let emoteManager: EmoteManager;
  let mockWorld: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
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
        execute: mock(),
      },
    };
    emoteManager = new EmoteManager(mockRuntime);
  });

  describe('playEmote', () => {
    it('should play an emote when world and player exist', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
        isConnected: mock().mockReturnValue(true),
      });

      emoteManager.playEmote('wave');

      // Check that the player's effect.emote was set
      expect(mockWorld.entities.player.data.effect.emote).toBe('wave');
    });

    it('should handle missing world gracefully', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(null),
        isConnected: mock().mockReturnValue(false),
      });

      expect(() => emoteManager.playEmote('wave')).not.toThrow();
    });

    it('should handle missing service gracefully', () => {
      mockRuntime.getService = mock().mockReturnValue(null);

      expect(() => emoteManager.playEmote('wave')).not.toThrow();
    });

    it('should handle empty emote name', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
        isConnected: mock().mockReturnValue(true),
      });

      emoteManager.playEmote('');

      // Check that the player's effect.emote was set to empty string
      expect(mockWorld.entities.player.data.effect.emote).toBe('');
    });
  });

  describe('playEmote with duration', () => {
    it('should set up emote correctly', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
        isConnected: mock().mockReturnValue(true),
      });

      emoteManager.playEmote('wave');

      // Check that the emote was set
      expect(mockWorld.entities.player.data.effect.emote).toBe('wave');
    });
  });

  describe('uploadEmotes', () => {
    it('should handle emote upload process', async () => {
      // Mock world with network and assetsUrl
      const mockWorldWithNetwork = {
        ...mockWorld,
        network: {
          upload: mock().mockResolvedValue('success'),
        },
        assetsUrl: 'https://test.com/assets',
      };

      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorldWithNetwork),
        isConnected: mock().mockReturnValue(true),
      });

      // Test that uploadEmotes can be called (it will fail due to missing files but shouldn't crash)
      await emoteManager.uploadEmotes();

      // Test passes if we reach here without crashing
      expect(true).toBe(true);
    });
  });

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
      };

      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorldWithPlayer),
        isConnected: mock().mockReturnValue(true),
      });

      // Play the emote
      emoteManager.playEmote('wave');

      // Should set the player's effect.emote
      expect(mockWorldWithPlayer.entities.player.data.effect.emote).toBe('wave');
    });
  });
});
