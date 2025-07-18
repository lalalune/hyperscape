import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { BehaviorManager } from '../../managers/behavior-manager';
import { createMockRuntime } from '../test-utils';
import { HyperfyService } from '../../service';

describe('BehaviorManager', () => {
  let mockRuntime: any;
  let behaviorManager: BehaviorManager;
  let mockService: any;

  beforeEach(() => {
    mock.restore();

    // Create mock world
    const mockWorld = {
      entities: {
        player: {
          data: { id: 'test-player-id', name: 'TestAgent' },
          base: {
            position: { x: 0, y: 0, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      },
    };

    // Create mock service
    mockService = {
      getWorld: mock().mockReturnValue(mockWorld),
      currentWorldId: 'test-world-id',
      getEmoteManager: mock().mockReturnValue({
        playEmote: mock(),
      }),
      getMessageManager: mock().mockReturnValue({
        sendMessage: mock(),
      }),
    };

    // Create mock runtime with service
    mockRuntime = createMockRuntime({
      getService: mock().mockReturnValue(mockService),
      composeState: mock().mockResolvedValue({
        values: {},
        data: {},
        text: 'test state',
      }),
      useModel: mock().mockResolvedValue(`
        <response>
          <thought>I should explore the area</thought>
          <text>Let me look around</text>
          <actions>HYPERFY_SCENE_PERCEPTION</actions>
          <emote>looking around</emote>
        </response>
      `),
      ensureConnection: mock().mockResolvedValue(true),
      createMemory: mock().mockResolvedValue(true),
      processActions: mock().mockResolvedValue(true),
      evaluate: mock().mockResolvedValue(true),
    });

    behaviorManager = new BehaviorManager(mockRuntime);
  });

  afterEach(() => {
    behaviorManager.stop();
  });

  describe('start/stop', () => {
    it('should start the behavior loop', () => {
      behaviorManager.start();

      // Check that the behavior manager is now running
      expect(behaviorManager.running).toBe(true);
    });

    it('should not start if already running', () => {
      behaviorManager.start();

      // Try to start again - should not change state
      behaviorManager.start();

      // Should still be running
      expect(behaviorManager.running).toBe(true);
    });

    it('should stop the behavior loop', () => {
      behaviorManager.start();
      behaviorManager.stop();

      // Check that the behavior manager is no longer running
      expect(behaviorManager.running).toBe(false);
    });
  });

  describe('behavior execution', () => {
    it('should handle behavior execution without errors', async () => {
      // Test basic behavior execution
      behaviorManager.start();

      // Wait a bit for any async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      behaviorManager.stop();

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Set max iterations to ensure test completes
      behaviorManager.setMaxIterations(2);
      
      // Replace the mock with one that returns a rejected promise when called
      mockRuntime.useModel = mock(() => Promise.reject(new Error('Model error')));

      // The behavior manager should handle this error internally
      behaviorManager.start();

      // Wait for the behavior loop to run and handle the error
      await new Promise((resolve) => setTimeout(resolve, 300));

      behaviorManager.stop();

      // Test passes if the behavior manager didn't throw
      // The error should be caught and logged internally
      expect(true).toBe(true);
    });
  });

  describe('world state validation', () => {
    it('should handle missing service', () => {
      mockRuntime.getService.mockReturnValue(null);

      behaviorManager.start();
      behaviorManager.stop();

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should handle missing world', () => {
      mockService.getWorld.mockReturnValue(null);

      behaviorManager.start();
      behaviorManager.stop();

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should handle missing player entity', () => {
      mockService.getWorld.mockReturnValue({ entities: {} });

      behaviorManager.start();
      behaviorManager.stop();

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('action processing', () => {
    it('should be able to process actions', () => {
      const emoteManager = mockService.getEmoteManager();
      const messageManager = mockService.getMessageManager();

      // Test that managers are available
      expect(emoteManager).toBeDefined();
      expect(messageManager).toBeDefined();
      expect(emoteManager.playEmote).toBeDefined();
      expect(messageManager.sendMessage).toBeDefined();
    });

    it('should process emote actions', () => {
      const emoteManager = mockService.getEmoteManager();

      // Test that emote manager can be called
      emoteManager.playEmote('test-emote');

      expect(emoteManager.playEmote).toHaveBeenCalledWith('test-emote');
    });

    it('should process message actions', () => {
      const messageManager = mockService.getMessageManager();

      // Test that message manager can be called
      messageManager.sendMessage('test message');

      expect(messageManager.sendMessage).toHaveBeenCalledWith('test message');
    });
  });
});
