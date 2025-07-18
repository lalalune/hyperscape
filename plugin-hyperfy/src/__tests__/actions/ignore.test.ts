import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ignoreAction } from '../../actions/ignore';
import { createMockRuntime } from '../test-utils';

describe('IGNORE Action', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
  });

  describe('validate', () => {
    it('should always return true', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      const result = await ignoreAction.validate(mockRuntime, mockMessage as any);
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
          text: 'Go away bot',
        },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();
    });

    it('should return true and call callback with response content', async () => {
      const responses = [
        {
          content: {
            text: '',
            thought: 'User is being rude, I should ignore them',
            actions: ['IGNORE'],
          },
        },
      ];

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses as any
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('text', '');
      expect(result).toHaveProperty('values', { ignored: true, reason: 'conversation_ended_or_inappropriate' });
      expect(result).toHaveProperty('data', { action: 'IGNORE', hasResponse: true });
      expect(mockCallback).toHaveBeenCalledWith(responses[0].content);
    });

    it('should return true without calling callback if no responses', async () => {
      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('text', '');
      expect(result).toHaveProperty('values', { ignored: true, reason: 'conversation_ended_or_inappropriate' });
      expect(result).toHaveProperty('data', { action: 'IGNORE', hasResponse: false });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle responses without content gracefully', async () => {
      const responses = [{ content: null }];

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses as any
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('text', '');
      expect(result).toHaveProperty('values', { ignored: true, reason: 'conversation_ended_or_inappropriate' });
      expect(result).toHaveProperty('data', { action: 'IGNORE', hasResponse: false });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle null callback gracefully', async () => {
      const responses = [
        {
          content: {
            text: '',
            actions: ['IGNORE'],
          },
        },
      ];

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        null as any,
        responses as any
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('text', '');
      expect(result).toHaveProperty('values', { ignored: true, reason: 'conversation_ended_or_inappropriate' });
      expect(result).toHaveProperty('data', { action: 'IGNORE', hasResponse: true });
    });

    it('should handle multiple responses by using the first one', async () => {
      const responses = [
        {
          content: {
            text: '',
            thought: 'First ignore response',
            actions: ['IGNORE'],
          },
        },
        {
          content: {
            text: '',
            thought: 'Second ignore response',
            actions: ['IGNORE'],
          },
        },
      ];

      const result = await ignoreAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
        responses as any
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('text', '');
      expect(result).toHaveProperty('values', { ignored: true, reason: 'conversation_ended_or_inappropriate' });
      expect(result).toHaveProperty('data', { action: 'IGNORE', hasResponse: true });
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(responses[0].content);
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(ignoreAction.examples).toBeDefined();
      expect(Array.isArray(ignoreAction.examples)).toBe(true);
      expect(ignoreAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      ignoreAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThanOrEqual(2);

        example.forEach((message) => {
          expect(message).toHaveProperty('name');
          expect(message).toHaveProperty('content');

          // Check if it's an agent response with IGNORE action
          if (message.content.actions) {
            expect(message.content.actions).toContain('IGNORE');
            // IGNORE actions typically have empty text (but not always)
            if (message.content.text !== 'thats inappropriate') {
              expect(message.content.text).toBe('');
            }
          }
        });
      });
    });

    it('should include examples of different ignore scenarios', () => {
      const examples = ignoreAction.examples!;

      // Should have examples for:
      // 1. Aggressive user behavior
      const aggressiveExample = examples.find(
        (ex) =>
          ex[0].content.text?.toLowerCase().includes('screw') ||
          ex[0].content.text?.toLowerCase().includes('shut up')
      );
      expect(aggressiveExample).toBeDefined();

      // 2. End of conversation
      const goodbyeExample = examples.find((ex) =>
        ex.some(
          (msg) =>
            msg.content.text?.toLowerCase().includes('bye') ||
            msg.content.text?.toLowerCase().includes('cya')
        )
      );
      expect(goodbyeExample).toBeDefined();

      // 3. Inappropriate content
      const inappropriateExample = examples.find((ex) =>
        ex[0].content.text?.toLowerCase().includes('cyber')
      );
      expect(inappropriateExample).toBeDefined();
    });
  });

  describe('similes', () => {
    it('should have appropriate similes', () => {
      expect(ignoreAction.similes).toBeDefined();
      expect(Array.isArray(ignoreAction.similes)).toBe(true);
      expect(ignoreAction.similes).toContain('STOP_TALKING');
      expect(ignoreAction.similes).toContain('STOP_CHATTING');
      expect(ignoreAction.similes).toContain('STOP_CONVERSATION');
    });
  });

  describe('description', () => {
    it('should have a comprehensive description', () => {
      expect(ignoreAction.description).toBeDefined();
      expect(ignoreAction.description).toContain('ignoring the user');
      expect(ignoreAction.description).toContain('aggressive');
      expect(ignoreAction.description).toContain('conversation has naturally ended');
    });
  });
});
