import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyGotoEntityAction } from '../../actions/goto';
import { createMockRuntime } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('HYPERFY_GOTO_ENTITY Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
    };

    mockRuntime.getService = mock().mockReturnValue(mockService);
  });

  describe('validate', () => {
    it('should return true when service is connected and world exists', async () => {
      const result = await hyperfyGotoEntityAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false);

      const result = await hyperfyGotoEntityAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(false);
    });

    it('should return false when world is null', async () => {
      mockService.getWorld.mockReturnValue(null);

      const result = await hyperfyGotoEntityAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(false);
    });

    it('should return false when service is null', async () => {
      mockRuntime.getService.mockReturnValue(null);

      const result = await hyperfyGotoEntityAction.validate(mockRuntime, {} as any, {} as any);

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
        content: {
          text: 'Go to the crystal',
        },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();

      // Mock composeState to return state with world info
      mockRuntime.composeState = mock().mockResolvedValue({
        ...mockState,
        hyperfyStatus: 'Connected to world',
      });

      // Mock model response for navigation extraction
      mockRuntime.useModel = mock().mockResolvedValue({
        navigationType: 'entity',
        parameter: { entityId: 'entity-1' },
      });
    });

    it('should successfully navigate to an entity', async () => {
      await hyperfyGotoEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockWorld.controls.followEntity).toHaveBeenCalledWith('entity-1');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Arrived at Block.',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        })
      );
    });

    it('should handle multiple entities and select closest', async () => {
      // Add another entity to the world
      mockWorld.entities.items.set('entity-3', {
        data: { id: 'entity-3', name: 'Crystal' },
        base: { position: { x: 2, y: 0, z: 2 } },
        root: { position: { x: 2, y: 0, z: 2 } },
      });

      await hyperfyGotoEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      // Should navigate to entity
      expect(mockWorld.controls.followEntity).toHaveBeenCalledWith('entity-1');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Arrived at'),
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        })
      );
    });

    it('should handle no matching entities', async () => {
      // Mock model to return invalid navigation result
      mockRuntime.useModel.mockReset().mockResolvedValueOnce(null);

      await hyperfyGotoEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockWorld.controls.followEntity).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Action failed: Invalid navigation target.',
          metadata: { error: 'invalid_navigation_target' },
        })
      );
    });

    it('should handle movement errors', async () => {
      mockWorld.controls.followEntity.mockRejectedValue(new Error('Movement failed'));

      await hyperfyGotoEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Navigation failed: Movement failed',
          metadata: { error: 'navigation_error', detail: 'Movement failed' },
        })
      );
    });

    it('should handle missing entity', async () => {
      // Mock navigation result for non-existent entity
      mockRuntime.useModel.mockReset().mockResolvedValue({
        navigationType: 'entity',
        parameter: { entityId: 'non-existent' },
      });

      await hyperfyGotoEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      // followEntity will be called but should handle the missing entity
      expect(mockWorld.controls.followEntity).toHaveBeenCalledWith('non-existent');
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyGotoEntityAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyGotoEntityAction.examples)).toBe(true);
      expect(hyperfyGotoEntityAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      if (!hyperfyGotoEntityAction.examples) {
        throw new Error('Examples should be defined');
      }

      hyperfyGotoEntityAction.examples.forEach((example: any) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [user, agent] = example;
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('content');
        expect(user.content).toHaveProperty('text');

        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');
        expect(agent.content).toHaveProperty('text');
        // Some examples show errors and don't have actions
        if (agent.content.actions) {
          expect(agent.content.actions).toContain('HYPERFY_GOTO_ENTITY');
        }
      });
    });
  });
});
