import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyEditEntityAction } from '../../actions/build';
import { createMockRuntime, createMockMemory, createMockState } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('HYPERFY_EDIT_ENTITY Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockBuildManager: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    mockBuildManager = {
      translate: mock().mockResolvedValue(true),
      rotate: mock().mockResolvedValue(true),
      scale: mock().mockResolvedValue(true),
      duplicate: mock().mockResolvedValue(true),
      delete: mock().mockResolvedValue(true),
      importEntity: mock().mockResolvedValue(true),
    };

    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
      getBuildManager: mock().mockReturnValue(mockBuildManager),
      getMessageManager: mock().mockReturnValue({
        sendMessage: mock(),
      }),
    };

    mockRuntime.getService = mock().mockReturnValue(mockService);
  });

  describe('validate', () => {
    it('should return true when service is connected and world exists', async () => {
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const result = await hyperfyEditEntityAction.validate(mockRuntime, mockMessage, mockState);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false);
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      const result = await hyperfyEditEntityAction.validate(mockRuntime, mockMessage, mockState);

      expect(result).toBe(false);
    });

    it('should return false when world is null', async () => {
      mockService.getWorld.mockReturnValue(null);
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      const result = await hyperfyEditEntityAction.validate(mockRuntime, mockMessage, mockState);

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
          text: 'Duplicate the block and move it up',
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

      // Mock model response for operation extraction
      mockRuntime.useModel = mock()
        .mockResolvedValueOnce({
          operations: [
            {
              success: true,
              operation: 'duplicate',
              target: 'entity-1',
              parameters: {},
              description: 'Duplicated block',
            },
            {
              success: true,
              operation: 'translate',
              target: 'entity-1-copy',
              parameters: {
                position: [0, 5, 0],
              },
              description: 'Moved block upward',
            },
          ],
        })
        .mockResolvedValueOnce(
          "<response><thought>Duplicated and moved the block</thought><text>I've duplicated the block and moved it up!</text></response>"
        );
    });

    it('should successfully execute multiple edit operations', async () => {
      await hyperfyEditEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockBuildManager.duplicate).toHaveBeenCalledWith('entity-1');
      expect(mockBuildManager.translate).toHaveBeenCalledWith('entity-1-copy', [0, 5, 0]);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('duplicated the block'),
          thought: expect.stringContaining('Duplicated and moved'),
        })
      );
    });

    it('should handle failed operations gracefully', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce({
          operations: [
            {
              success: false,
              operation: 'delete',
              requestedEntityName: 'floating dragon',
              reason: "No entity with name 'floating dragon' found in world state",
            },
          ],
        })
        .mockResolvedValueOnce(
          "<response><thought>Could not find the entity</thought><text>I couldn't find a floating dragon to delete.</text></response>"
        );

      await hyperfyEditEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockBuildManager.delete).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("couldn't find"),
        })
      );
    });

    it('should handle import operations', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce({
          operations: [
            {
              success: true,
              operation: 'import',
              target: 'https://assets.hyperfy.io/model.glb',
              parameters: {
                position: [10, 0, 10],
                rotation: [0, 0, 0, 1],
              },
              description: 'Imported new model',
            },
          ],
        })
        .mockResolvedValueOnce(
          "<response><thought>Imported the model</thought><text>I've imported the new model into the world!</text></response>"
        );

      await hyperfyEditEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockBuildManager.importEntity).toHaveBeenCalledWith(
        'https://assets.hyperfy.io/model.glb',
        [10, 0, 10],
        [0, 0, 0, 1]
      );
    });

    it('should handle model parsing errors', async () => {
      mockRuntime.useModel.mockReset().mockRejectedValueOnce(new Error('Model error'));

      await hyperfyEditEntityAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      // Should not throw, but operations won't be executed
      expect(mockBuildManager.duplicate).not.toHaveBeenCalled();
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyEditEntityAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyEditEntityAction.examples)).toBe(true);
      expect(hyperfyEditEntityAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      if (!hyperfyEditEntityAction.examples) {
        throw new Error('Examples should be defined');
      }

      hyperfyEditEntityAction.examples.forEach((example) => {
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
        expect(agent.content.actions).toContain('HYPERFY_EDIT_ENTITY');
      });
    });
  });
});
