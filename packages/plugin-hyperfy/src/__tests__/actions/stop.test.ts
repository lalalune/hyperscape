import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyStopMovingAction } from '../../actions/stop';
import { createMockRuntime } from '../test-utils';
import { createMockWorld } from '../helpers/mock-world';

describe('HYPERFY_STOP_MOVING Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockControls: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    mockControls = {
      stopAllActions: mock(),
      getIsNavigating: mock().mockReturnValue(true),
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
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      const result = await hyperfyStopMovingAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      mockService.isConnected.mockReturnValue(false);

      const result = await hyperfyStopMovingAction.validate(mockRuntime, mockMessage as any);

      expect(result).toBe(false);
    });

    it('should return false when controls are missing', async () => {
      const mockMessage = { id: 'msg-123', content: { text: 'test' } };
      mockWorld.controls = null;

      const result = await hyperfyStopMovingAction.validate(mockRuntime, mockMessage as any);

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
        content: { text: 'Stop moving' },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();
    });

    it('should stop movement when navigating', async () => {
      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockControls.stopAllActions).toHaveBeenCalledWith('stop action called');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          actions: ['HYPERFY_STOP_MOVING'],
          source: 'hyperfy',
          metadata: { status: 'movement_stopped', reason: 'stop action called' },
        })
      );
    });

    it('should stop movement when walking randomly', async () => {
      mockControls.getIsNavigating.mockReturnValue(false);
      mockControls.getIsWalkingRandomly.mockReturnValue(true);

      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockControls.stopAllActions).toHaveBeenCalledWith('stop action called');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          metadata: { status: 'movement_stopped', reason: 'stop action called' },
        })
      );
    });

    it('should report when not moving', async () => {
      mockControls.getIsNavigating.mockReturnValue(false);
      mockControls.getIsWalkingRandomly.mockReturnValue(false);

      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockControls.stopAllActions).toHaveBeenCalledWith('stop action called');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          metadata: { status: 'movement_stopped', reason: 'stop action called' },
        })
      );
    });

    it('should handle missing controls gracefully', async () => {
      mockControls.stopAllActions = undefined;

      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Stop functionality not available in controls.',
        })
      );
    });

    it('should handle missing service gracefully', async () => {
      mockRuntime.getService.mockReturnValue(null);

      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot stop movement. Hyperfy connection/controls unavailable.',
        })
      );
    });

    it('should handle missing world gracefully', async () => {
      mockService.getWorld.mockReturnValue(null);

      await hyperfyStopMovingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error: Cannot stop movement. Hyperfy connection/controls unavailable.',
        })
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyStopMovingAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyStopMovingAction.examples)).toBe(true);
      expect(hyperfyStopMovingAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      hyperfyStopMovingAction.examples!.forEach((example: any) => {
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
        expect(agent.content.actions).toContain('HYPERFY_STOP_MOVING');
      });
    });
  });
});
