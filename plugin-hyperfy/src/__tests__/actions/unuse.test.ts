import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyUnuseItemAction } from '../../actions/unuse';
import { createMockRuntime, createMockMemory, createMockState } from '../test-utils';
import type { IAgentRuntime } from '@elizaos/core';

describe('hyperfyUnuseItemAction', () => {
  let mockRuntime: IAgentRuntime;
  let mockService: any;
  let mockWorld: any;
  let mockActions: any;

  beforeEach(() => {
    mock.restore();

    // Create mock actions
    mockActions = {
      releaseAction: mock(),
    };

    // Create mock world
    mockWorld = {
      actions: mockActions,
      entities: {
        player: {
          data: { id: 'test-player-id', name: 'TestAgent' },
        },
      },
    };

    // Create mock service
    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
    };

    // Create mock runtime with service
    mockRuntime = createMockRuntime({
      getService: mock().mockReturnValue(mockService),
    });
  });

  describe('validate', () => {
    it('should return true when service is connected and world has actions', async () => {
      const isValid = await hyperfyUnuseItemAction.validate(mockRuntime, {} as any, {} as any);

      expect(isValid).toBe(true);
      expect(mockRuntime.getService).toHaveBeenCalled();
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not available', async () => {
      mockRuntime.getService = mock().mockReturnValue(null);

      const isValid = await hyperfyUnuseItemAction.validate(mockRuntime, {} as any, {} as any);

      expect(isValid).toBe(false);
    });

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false);

      const isValid = await hyperfyUnuseItemAction.validate(mockRuntime, {} as any, {} as any);

      expect(isValid).toBe(false);
    });

    it('should return false when world is not available', async () => {
      mockService.getWorld.mockReturnValue(null);

      const isValid = await hyperfyUnuseItemAction.validate(mockRuntime, {} as any, {} as any);

      expect(isValid).toBe(false);
    });

    it('should return false when world has no actions', async () => {
      mockWorld.actions = undefined;

      const isValid = await hyperfyUnuseItemAction.validate(mockRuntime, {} as any, {} as any);

      expect(isValid).toBe(false);
    });
  });

  describe('handler', () => {
    it('should release action and send success callback', async () => {
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const mockCallback = mock();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockActions.releaseAction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        text: 'Item released.',
        actions: ['HYPERFY_UNUSE_ITEM'],
        source: 'hyperfy',
        metadata: { status: 'released' },
      });
    });

    it('should handle missing service gracefully', async () => {
      mockRuntime.getService = mock().mockReturnValue(null);
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const mockCallback = mock();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockActions.releaseAction).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
      });
    });

    it('should handle missing world gracefully', async () => {
      mockService.getWorld.mockReturnValue(null);
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const mockCallback = mock();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockActions.releaseAction).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
      });
    });

    it('should handle missing actions gracefully', async () => {
      mockWorld.actions = undefined;
      const mockMessage = createMockMemory();
      const mockState = createMockState();
      const mockCallback = mock();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
      });
    });

    it('should work without callback', async () => {
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState, {});

      expect(mockActions.releaseAction).toHaveBeenCalled();
    });

    it('should log appropriate messages', async () => {
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState);

      expect(mockActions.releaseAction).toHaveBeenCalled();
    });

    it('should log error when service is unavailable', async () => {
      mockRuntime.getService = mock().mockReturnValue(null);
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      await hyperfyUnuseItemAction.handler(mockRuntime, mockMessage, mockState);

      expect(mockActions.releaseAction).not.toHaveBeenCalled();
    });
  });

  describe('examples', () => {
    it('should have valid example structure', () => {
      expect(hyperfyUnuseItemAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyUnuseItemAction.examples)).toBe(true);
      expect(hyperfyUnuseItemAction.examples!.length).toBeGreaterThan(0);

      hyperfyUnuseItemAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        example.forEach((message) => {
          expect(message).toHaveProperty('name');
          expect(message).toHaveProperty('content');
          expect(message.content).toHaveProperty('text');
        });
      });
    });

    it('should have proper action responses in examples', () => {
      hyperfyUnuseItemAction.examples!.forEach((example) => {
        const [userMessage, agentResponse] = example;

        // User messages should not have actions
        expect(userMessage.content.actions).toBeUndefined();

        // Agent responses should have the HYPERFY_UNUSE_ITEM action
        expect(agentResponse.content.actions).toEqual(['HYPERFY_UNUSE_ITEM']);
        expect(agentResponse.content.source).toBe('hyperfy');
      });
    });

    it('should cover different command variations', () => {
      const exampleTexts = hyperfyUnuseItemAction
        .examples!.map((example) => example[0]?.content?.text?.toLowerCase() || '')
        .filter((text) => text.length > 0);

      // Check for variety in commands
      expect(exampleTexts.some((text) => text.includes('drop'))).toBe(true);
      expect(exampleTexts.some((text) => text.includes('stop'))).toBe(true);
    });
  });

  describe('metadata', () => {
    it('should have correct action name', () => {
      expect(hyperfyUnuseItemAction.name).toBe('HYPERFY_UNUSE_ITEM');
    });

    it('should have appropriate similes', () => {
      expect(hyperfyUnuseItemAction.similes).toBeDefined();
      expect(hyperfyUnuseItemAction.similes!).toContain('RELEASE_ITEM');
      expect(hyperfyUnuseItemAction.similes!).toContain('DROP_ITEM');
      expect(hyperfyUnuseItemAction.similes!).toContain('CANCEL_INTERACTION');
    });

    it('should have a descriptive description', () => {
      expect(hyperfyUnuseItemAction.description).toContain('Drops');
      expect(hyperfyUnuseItemAction.description).toContain('stops interacting');
      expect(hyperfyUnuseItemAction.description).toContain('held item');
    });
  });
});
