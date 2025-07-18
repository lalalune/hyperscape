import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyAmbientSpeechAction } from '../../actions/ambient';
import { createMockRuntime } from '../test-utils';

describe('HYPERFY_AMBIENT_SPEECH Action', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
  });

  describe('validate', () => {
    it('should always return true', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      const result = await hyperfyAmbientSpeechAction.validate(mockRuntime, mockMessage as any);
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
          text: 'test message',
          providers: ['HYPERFY_WORLD_STATE'],
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
        hyperfyStatus: 'Connected to world',
      });

      // Mock useModel for ambient speech generation
      mockRuntime.useModel = mock().mockResolvedValue({
        thought: 'Observing the peaceful environment',
        message: 'This place feels ancient... wonder what stories it holds.',
      });
    });

    it('should generate ambient speech without existing responses', async () => {
      await hyperfyAmbientSpeechAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockRuntime.composeState).toHaveBeenCalledWith(
        mockMessage,
        expect.arrayContaining(['RECENT_MESSAGES'])
      );

      expect(mockRuntime.useModel).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Observing the peaceful environment',
          text: 'This place feels ancient... wonder what stories it holds.',
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        })
      );
    });

    it('should use existing ambient responses if available', async () => {
      const existingResponses = [
        {
          content: {
            thought: 'Existing thought',
            message: 'Existing ambient message',
            text: 'Existing ambient message',
            actions: ['HYPERFY_AMBIENT_SPEECH'],
          },
        },
      ];

      await hyperfyAmbientSpeechAction.handler(
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
          text: 'Existing ambient message',
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        })
      );
    });

    it('should handle multiple existing responses', async () => {
      const existingResponses = [
        {
          content: {
            message: 'First ambient message',
            actions: ['HYPERFY_AMBIENT_SPEECH'],
          },
        },
        {
          content: {
            text: 'Second ambient message',
            actions: ['HYPERFY_AMBIENT_SPEECH'],
          },
        },
      ];

      await hyperfyAmbientSpeechAction.handler(
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
          text: 'First ambient message',
        })
      );
      expect(mockCallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          text: 'Second ambient message',
        })
      );
    });

    it('should ignore responses without HYPERFY_AMBIENT_SPEECH action', async () => {
      const existingResponses = [
        {
          content: {
            text: 'Regular message',
            actions: ['REPLY'],
          },
        },
      ];

      await hyperfyAmbientSpeechAction.handler(
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
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        })
      );
    });

    it('should handle empty message from model', async () => {
      mockRuntime.useModel.mockResolvedValue({
        thought: 'Quiet contemplation',
        message: '',
      });

      await hyperfyAmbientSpeechAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Quiet contemplation',
          text: '',
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        })
      );
    });

    it('should include custom providers in state composition', async () => {
      const customMessage = {
        ...mockMessage,
        content: {
          ...mockMessage.content,
          providers: ['CUSTOM_PROVIDER', 'ANOTHER_PROVIDER'],
        },
      };

      await hyperfyAmbientSpeechAction.handler(
        mockRuntime,
        customMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockRuntime.composeState).toHaveBeenCalledWith(
        customMessage,
        expect.arrayContaining(['CUSTOM_PROVIDER', 'ANOTHER_PROVIDER', 'RECENT_MESSAGES'])
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyAmbientSpeechAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyAmbientSpeechAction.examples)).toBe(true);
      expect(hyperfyAmbientSpeechAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      hyperfyAmbientSpeechAction.examples!.forEach((example: any[]) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [context, agent] = example;
        expect(context).toHaveProperty('name');
        expect(context).toHaveProperty('content');

        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');
        expect(agent.content).toHaveProperty('text');
        expect(agent.content).toHaveProperty('actions');
        expect(agent.content.actions).toContain('HYPERFY_AMBIENT_SPEECH');
      });
    });
  });
});
