import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { replyAction } from '../../actions/reply';
import { createMockRuntime } from '../test-utils';

describe('REPLY Action', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
  });

  describe('validate', () => {
    it('should always return true', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      const result = await replyAction.validate(mockRuntime, mockMessage as any);
      expect(result).toBe(true);
    });
  });

  describe('handler', () => {
    let mockMessage: any;
    let mockState: any;
    let mockCallback: any;

    beforeEach(() => {
      mockMessage = {
        id: 'msg-123',
        content: {
          text: 'Hello, how are you?',
        },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();

      // Mock composeState
      mockRuntime.composeState = mock().mockResolvedValue({
        ...mockState,
        conversationContext: 'User greeted the agent',
      });

      // Mock useModel for reply generation
      mockRuntime.useModel = mock().mockResolvedValue({
        thought: 'User is greeting me, I should respond politely',
        message: "I'm doing great, thank you for asking! How can I help you today?",
      });
    });

    it('should generate reply without existing responses', async () => {
      await replyAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockRuntime.composeState).toHaveBeenCalledWith(mockMessage);
      expect(mockRuntime.useModel).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'User is greeting me, I should respond politely',
          text: "I'm doing great, thank you for asking! How can I help you today?",
          actions: ['REPLY'],
        })
      );
    });

    it('should use existing reply responses if available', async () => {
      const existingResponses = [
        {
          content: {
            thought: 'Existing thought',
            text: 'Existing reply message',
            actions: ['REPLY'],
          },
        },
      ];

      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        existingResponses as any
      );

      expect(mockRuntime.useModel).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Existing thought',
          text: 'Existing reply message',
          actions: ['REPLY'],
        })
      );
    });

    it('should handle multiple existing reply responses', async () => {
      const existingResponses = [
        {
          content: {
            message: 'First reply',
            actions: ['REPLY'],
          },
        },
        {
          content: {
            text: 'Second reply',
            actions: ['REPLY'],
          },
        },
      ];

      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        existingResponses as any
      );

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          text: 'First reply',
        })
      );
      expect(mockCallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          text: 'Second reply',
        })
      );
    });

    it('should ignore responses without REPLY action', async () => {
      const existingResponses = [
        {
          content: {
            text: 'Ambient message',
            actions: ['HYPERFY_AMBIENT_SPEECH'],
          },
        },
      ];

      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        existingResponses as any
      );

      expect(mockRuntime.useModel).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: ['REPLY'],
        })
      );
    });

    it('should handle empty message from model', async () => {
      mockRuntime.useModel.mockResolvedValue({
        thought: 'Nothing to say',
        message: '',
      });

      await replyAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Nothing to say',
          text: '',
          actions: ['REPLY'],
        })
      );
    });

    it('should use message field when available in responses', async () => {
      const existingResponses = [
        {
          content: {
            message: 'Message field content',
            text: 'Text field content',
            actions: ['REPLY'],
          },
        },
      ];

      await replyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        existingResponses as any
      );

      // Since replyFieldKeys is ['message', 'text'], it will use message first
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Message field content',
        })
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(replyAction.examples).toBeDefined();
      expect(Array.isArray(replyAction.examples)).toBe(true);
      expect(replyAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      replyAction.examples!.forEach((example: any) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [user, agent] = example;
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('content');
        expect(user.content).toHaveProperty('text');

        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');
        expect(agent.content).toHaveProperty('text');
        expect(agent.content).toHaveProperty('actions');
        expect(agent.content.actions).toContain('REPLY');
      });
    });
  });
});
