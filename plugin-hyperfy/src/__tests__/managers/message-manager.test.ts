import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { MessageManager } from '../../managers/message-manager';
import { createMockRuntime } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('MessageManager', () => {
  let mockRuntime: any;
  let messageManager: MessageManager;
  let mockWorld: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();
    messageManager = new MessageManager(mockRuntime);
  });

  describe('sendMessage', () => {
    it('should send a message to the world chat', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
      });

      messageManager.sendMessage('Hello world!');

      expect(mockWorld.chat.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          text: 'Hello world!',
          entityId: 'test-player-id',
          from: 'HyperfyTestAgent', // This should match runtime.character.name
          timestamp: expect.any(Number),
        }),
        true
      );
    });

    it('should handle missing world gracefully', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(null),
      });

      expect(() => messageManager.sendMessage('Test')).not.toThrow();
    });

    it('should handle missing service gracefully', () => {
      mockRuntime.getService = mock().mockReturnValue(null);

      expect(() => messageManager.sendMessage('Test')).not.toThrow();
    });

    it('should handle empty messages', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
      });

      messageManager.sendMessage('');

      expect(mockWorld.chat.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          text: '',
          entityId: 'test-player-id',
          from: 'HyperfyTestAgent',
          timestamp: expect.any(Number),
        }),
        true
      );
    });

    it('should include timestamp in message', () => {
      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
      });

      const beforeTime = Date.now();
      messageManager.sendMessage('Test message');
      const afterTime = Date.now();

      expect(mockWorld.chat.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          text: 'Test message',
          entityId: 'test-player-id',
          from: 'HyperfyTestAgent',
          timestamp: expect.any(Number),
        }),
        true
      );

      const call = mockWorld.chat.add.mock.calls[0][0];
      expect(call.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(call.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('handleMessage', () => {
    it('should process incoming messages', async () => {
      const mockMessage = {
        id: 'msg-123',
        body: 'Hello agent!',
        fromId: 'user-123',
        from: 'Alice',
        createdAt: new Date().toISOString(),
      };

      const mockService = {
        getWorld: mock().mockReturnValue(mockWorld),
        currentWorldId: 'world-123',
        getEmoteManager: mock().mockReturnValue({
          playEmote: mock(),
        }),
      };
      mockRuntime.getService = mock().mockReturnValue(mockService);

      await messageManager.handleMessage(mockMessage);

      expect(mockRuntime.ensureConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: expect.any(String),
          userName: 'Alice',
          source: 'hyperfy',
        })
      );

      expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.objectContaining({
            content: expect.objectContaining({
              text: 'Hello agent!',
            }),
          }),
        })
      );
    });

    it('should skip processing own messages', async () => {
      const mockMessage = {
        id: 'msg-123',
        body: 'My own message',
        fromId: 'test-player-id', // Same as agent's player ID
        from: 'TestAgent',
        createdAt: new Date().toISOString(),
      };

      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
        currentWorldId: 'world-123',
      });

      await messageManager.handleMessage(mockMessage);

      // Should not process messages from the agent itself
      expect(mockRuntime.ensureConnection).not.toHaveBeenCalled();
    });

    it('should handle messages without fromId', async () => {
      const mockMessage = {
        id: 'msg-123',
        body: 'System message',
        // No fromId
        from: 'System',
        createdAt: new Date().toISOString(),
      };

      mockRuntime.getService = mock().mockReturnValue({
        getWorld: mock().mockReturnValue(mockWorld),
        currentWorldId: 'world-123',
      });

      await messageManager.handleMessage(mockMessage);

      expect(mockRuntime.emitEvent).not.toHaveBeenCalled();
    });

    it('should handle callback responses with emotes', async () => {
      const mockMessage = {
        id: 'msg-123',
        body: 'Tell me a joke!',
        fromId: 'user-123',
        from: 'Alice',
        createdAt: new Date().toISOString(),
      };

      const mockEmoteManager = { playEmote: mock() };
      const mockService = {
        getWorld: mock().mockReturnValue(mockWorld),
        currentWorldId: 'world-123',
        getEmoteManager: mock().mockReturnValue(mockEmoteManager),
      };
      mockRuntime.getService = mock().mockReturnValue(mockService);

      await messageManager.handleMessage(mockMessage);

      // Get the callback from emitEvent
      const emitCall = mockRuntime.emitEvent.mock.calls[0];
      const callback = emitCall[1].callback;

      // Call the callback with a response containing an emote
      await callback({
        text: 'Here is a joke!',
        emote: 'laugh',
      });

      expect(mockEmoteManager.playEmote).toHaveBeenCalledWith('laugh');
      expect(mockWorld.chat.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          text: 'Here is a joke!',
          entityId: 'test-player-id',
          from: 'HyperfyTestAgent',
          timestamp: expect.any(Number),
        }),
        true
      );
    });
  });

  describe('getRecentMessages', () => {
    it('should handle getRecentMessages method', async () => {
      // Test that the method exists and can be called
      const result = await messageManager.getRecentMessages('room-123' as any);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('formattedHistory');
      expect(result).toHaveProperty('lastResponseText');
      expect(result).toHaveProperty('lastActions');
    });
  });

  describe('formatMessages', () => {
    it('should format messages with entity names', () => {
      const messages = [
        {
          id: '1',
          entityId: 'entity-1',
          content: { text: 'Hello!' },
          createdAt: new Date('2024-01-01T10:30:00').getTime(),
        },
      ];

      const entities = [
        {
          id: 'entity-1',
          names: ['Alice'],
          data: JSON.stringify({ hyperfy: { id: 'user-1', userName: 'Alice' } }),
        },
      ];

      const formatted = messageManager.formatMessages({ messages, entities } as any);

      expect(formatted).toContain('Alice');
      expect(formatted).toContain('Hello!');
      expect(formatted).toContain('10:30');
    });

    it('should handle missing entity data', () => {
      const messages = [
        {
          id: '1',
          entityId: 'entity-1',
          content: { text: 'Test' },
          createdAt: Date.now(),
        },
      ];

      const entities = [
        {
          id: 'entity-1',
          names: ['Fallback Name'],
          data: null,
        },
      ];

      const formatted = messageManager.formatMessages({ messages, entities } as any);

      expect(formatted).toContain('Fallback Name');
      expect(formatted).toContain('Test');
    });
  });
});
