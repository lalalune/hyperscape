import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyUseItemAction } from '../../actions/use';
import { createMockRuntime } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('HYPERFY_USE_ITEM Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockControls: any;
  let mockActions: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    mockControls = {
      goto: mock().mockResolvedValue(true),
    };

    mockActions = {
      performAction: mock(),
    };

    mockWorld.controls = mockControls;
    mockWorld.actions = mockActions;

    // Mock entities
    mockWorld.entities.items.set('item-123', {
      root: {
        position: { x: 10, y: 0, z: 20 },
      },
    });

    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
    };

    mockRuntime.getService = mock().mockReturnValue(mockService);
  });

  describe('validate', () => {
    it('should return true when service is connected and systems exist', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      const result = await hyperfyUseItemAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      mockService.isConnected.mockReturnValue(false);

      const result = await hyperfyUseItemAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(false);
    });

    it('should return false when controls are missing', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      mockWorld.controls = null;

      const result = await hyperfyUseItemAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(false);
    });

    it('should return false when actions are missing', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      mockWorld.actions = null;

      const result = await hyperfyUseItemAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    let mockMessage: any;
    let mockState: any;
    let mockCallback: any;

    beforeEach(() => {
      mockMessage = {
        id: 'msg-123',
        content: { text: 'Pick up the item' },
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
        hyperfyWorldState: 'World state with items',
      });

      // Mock useModel for entity extraction
      mockRuntime.useModel = mock().mockResolvedValue({
        entityId: 'item-123',
      });
    });

    it('should use item with provided entityId', async () => {
      await hyperfyUseItemAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        { entityId: 'item-123' },
        mockCallback
      );

      expect(mockControls.goto).toHaveBeenCalledWith(10, 20);
      expect(mockActions.performAction).toHaveBeenCalledWith('item-123');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Using item: item-123',
          actions: ['HYPERFY_USE_ITEM'],
          source: 'hyperfy',
          metadata: { targetEntityId: 'item-123', status: 'triggered' },
        })
      );
    });

    it('should extract entityId from LLM when not provided', async () => {
      await hyperfyUseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockRuntime.composeState).toHaveBeenCalledWith(
        mockMessage,
        ['HYPERFY_WORLD_STATE', 'RECENT_MESSAGES'],
        true
      );
      expect(mockRuntime.useModel).toHaveBeenCalled();
      expect(mockActions.performAction).toHaveBeenCalledWith('item-123');
    });

    it('should handle missing entity gracefully', async () => {
      await hyperfyUseItemAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        { entityId: 'non-existent' },
        mockCallback
      );

      expect(mockControls.goto).not.toHaveBeenCalled();
      expect(mockActions.performAction).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Could not locate entity non-existent.',
          metadata: { error: 'entity_not_found' },
        })
      );
    });

    it('should handle no suitable item found', async () => {
      mockRuntime.useModel.mockResolvedValue({
        entityId: null,
      });

      await hyperfyUseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockActions.performAction).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle LLM extraction errors', async () => {
      mockRuntime.useModel.mockRejectedValue(new Error('LLM error'));

      await hyperfyUseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockActions.performAction).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle missing service gracefully', async () => {
      mockRuntime.getService.mockReturnValue(null);

      await hyperfyUseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot use item. Agent action system unavailable.',
        })
      );
    });

    it('should handle entity without position', async () => {
      mockWorld.entities.items.set('item-no-pos', {
        root: null,
      });

      await hyperfyUseItemAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        { entityId: 'item-no-pos' },
        mockCallback
      );

      expect(mockControls.goto).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Could not locate entity item-no-pos.',
          metadata: { error: 'entity_not_found' },
        })
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyUseItemAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyUseItemAction.examples)).toBe(true);
      expect(hyperfyUseItemAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      hyperfyUseItemAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [user, agent] = example;
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('content');
        expect(user.content).toHaveProperty('text');

        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');
        expect(agent.content).toHaveProperty('text');

        // Some examples show successful use, others show no item found
        if (agent.content.actions) {
          expect(agent.content.actions).toContain('HYPERFY_USE_ITEM');
          expect(agent.content.source).toBe('hyperfy');
        }
      });
    });
  });
});
