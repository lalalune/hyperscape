import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyWalkRandomlyAction } from '../../actions/walk_randomly';
import { createMockRuntime, createMockMemory, createMockState } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('HYPERFY_WALK_RANDOMLY Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockControls: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    mockControls = {
      startRandomWalk: mock(),
      stopRandomWalk: mock(),
      getIsWalkingRandomly: mock().mockReturnValue(false),
    };

    mockWorld.controls = mockControls;

    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
    };

    mockRuntime.getService = mock().mockReturnValue(mockService);
  });

  describe('validate', () => {
    it('should return true when service is connected and controls exist', async () => {
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const result = await hyperfyWalkRandomlyAction.validate(mockRuntime, mockMessage, mockState);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false);
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      const result = await hyperfyWalkRandomlyAction.validate(mockRuntime, mockMessage, mockState);

      expect(result).toBe(false);
    });

    it('should return false when controls are missing', async () => {
      mockWorld.controls = null;
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      const result = await hyperfyWalkRandomlyAction.validate(mockRuntime, mockMessage, mockState);

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
        content: { text: 'Walk around randomly' },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();
    });

    it('should start random walk with default parameters', async () => {
      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(4000, 30);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          actions: ['HYPERFY_WALK_RANDOMLY'],
          source: 'hyperfy',
          metadata: { status: 'started', intervalMs: 4000, maxDistance: 30 },
        })
      );
    });

    it('should start random walk with custom parameters', async () => {
      const options = { interval: 10, distance: 50 };

      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        options,
        mockCallback
      );

      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(10000, 50);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { status: 'started', intervalMs: 10000, maxDistance: 50 },
        })
      );
    });

    it('should stop random walk when command is stop', async () => {
      mockControls.getIsWalkingRandomly.mockReturnValue(true);

      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        { command: 'stop' },
        mockCallback
      );

      expect(mockControls.stopRandomWalk).toHaveBeenCalled();
      expect(mockControls.startRandomWalk).not.toHaveBeenCalled();
    });

    it('should not call stop if not walking randomly', async () => {
      mockControls.getIsWalkingRandomly.mockReturnValue(false);

      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        { command: 'stop' },
        mockCallback
      );

      expect(mockControls.stopRandomWalk).not.toHaveBeenCalled();
    });

    it('should handle missing controls methods gracefully', async () => {
      mockControls.startRandomWalk = undefined;

      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Wander functionality not available in controls.',
        })
      );
    });

    it('should handle missing service gracefully', async () => {
      mockRuntime.getService.mockReturnValue(null);

      await hyperfyWalkRandomlyAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot wander. Hyperfy connection/controls unavailable.',
        })
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyWalkRandomlyAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyWalkRandomlyAction.examples)).toBe(true);
      expect(hyperfyWalkRandomlyAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      hyperfyWalkRandomlyAction.examples!.forEach((example: any) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [user, agent] = example;
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('content');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');

        if (agent.content.actions) {
          expect(agent.content.actions).toContain('HYPERFY_WALK_RANDOMLY');
        }
      });
    });
  });
});
