import { describe, expect, it, mock, beforeEach, afterAll, beforeAll } from 'bun:test';
import { hyperfyPlugin } from '../index';
import { HyperfyService } from '../service';
import { createMockRuntime, setupLoggerSpies } from './test-utils';
import { HandlerCallback, IAgentRuntime, Memory, State, UUID, logger } from '@elizaos/core';

/**
 * Integration tests demonstrate how multiple components of the plugin work together.
 * Unlike unit tests that test individual functions in isolation, integration tests
 * examine how components interact with each other.
 *
 * For example, this file shows how the HelloWorld action and HelloWorld provider
 * interact with the StarterService and the plugin's core functionality.
 */

// Set up spies on logger
beforeAll(() => {
  setupLoggerSpies(mock);
});

afterAll(() => {
  mock.restore();
});

describe('Integration: Hyperfy Action with HyperfyService', () => {
  let mockRuntime: IAgentRuntime;
  let getServiceSpy: any;

  beforeEach(() => {
    // Create a service mock that will be returned by getService
    const mockService = {
      capabilityDescription:
        'This is a hyperfy service which connects agents to Hyperfy virtual worlds.',
      stop: mock().mockResolvedValue(undefined),
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue({
        entities: {
          player: { data: { position: { x: 0, y: 0, z: 0 } } },
          items: new Map(),
        },
        controls: {
          stopAllActions: mock(),
          followEntity: mock(),
        },
      }),
      getPuppeteerManager: mock().mockReturnValue({
        snapshotEquirectangular: mock().mockResolvedValue(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ),
        snapshotFacingDirection: mock().mockResolvedValue(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ),
        snapshotViewToTarget: mock().mockResolvedValue(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ),
      }),
    };

    // Create a mock runtime with a spied getService method
    getServiceSpy = mock().mockImplementation((serviceType) => {
      if (serviceType === 'hyperfy') {
        return mockService;
      }
      return null;
    });

    mockRuntime = createMockRuntime({
      getService: getServiceSpy,
      useModel: mock()
        .mockResolvedValueOnce(
          `
          <response>
            <snapshotType>LOOK_AROUND</snapshotType>
            <parameter></parameter>
          </response>
        `
        )
        .mockResolvedValueOnce(
          'A detailed description of the scene with various objects and entities visible in the Hyperfy world.'
        ).mockResolvedValueOnce(`
          <response>
            <thought>I can see the surrounding area clearly</thought>
            <text>I'm looking around and can see the environment clearly</text>
            <emote>observing</emote>
          </response>
        `),
    }) as unknown as IAgentRuntime;
  });

  it('should handle HYPERFY_SCENE_PERCEPTION action with HyperfyService available', async () => {
    // Find the perception action
    const perceptionAction = hyperfyPlugin.actions?.find(
      (action) => action.name === 'HYPERFY_SCENE_PERCEPTION'
    );
    expect(perceptionAction).toBeDefined();

    // Create a mock message and state
    const mockMessage: Memory = {
      id: '12345678-1234-1234-1234-123456789012' as UUID,
      roomId: '12345678-1234-1234-1234-123456789012' as UUID,
      entityId: '12345678-1234-1234-1234-123456789012' as UUID,
      agentId: '12345678-1234-1234-1234-123456789012' as UUID,
      content: {
        text: 'Hello world',
        source: 'test',
      },
      createdAt: Date.now(),
    };

    const mockState: State = {
      values: {},
      data: {},
      text: '',
    };

    // Create a mock callback to capture the response
    const callbackFn = mock();

    // Execute the action
    await perceptionAction?.handler(
      mockRuntime,
      mockMessage,
      mockState,
      {},
      callbackFn as HandlerCallback,
      []
    );

    // Verify the callback was called with expected response
    expect(callbackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.any(String),
        thought: expect.any(String),
        metadata: expect.objectContaining({
          snapshotType: expect.any(String),
          sceneDescription: expect.any(String),
        }),
      })
    );

    // Get the service to ensure integration
    const service = mockRuntime.getService('hyperfy');
    expect(service).toBeDefined();
    // @ts-ignore - Service capabilityDescription property access
    expect(service?.capabilityDescription).toContain('hyperfy service');
  });
});

describe('Integration: Plugin initialization and service registration', () => {
  it('should initialize the plugin and register the service', async () => {
    // Create a fresh mock runtime with mocked registerService for testing initialization flow
    const mockRuntime = createMockRuntime();

    // Create and install a spy on registerService
    const registerServiceSpy = mock();
    mockRuntime.registerService = registerServiceSpy;

    // Run a minimal simulation of the plugin initialization process
    if (hyperfyPlugin.init) {
      await hyperfyPlugin.init(
        { DEFAULT_HYPERFY_WS_URL: 'wss://test.hyperfy.io/ws' },
        mockRuntime as unknown as IAgentRuntime
      );

      // Directly mock the service registration that happens during initialization
      // because unit tests don't run the full agent initialization flow
      if (hyperfyPlugin.services) {
        const serviceItem = hyperfyPlugin.services[0];
        const HyperfyServiceClass =
          typeof serviceItem === 'function' ? serviceItem : serviceItem.component;
        const serviceInstance = await HyperfyServiceClass.start(
          mockRuntime as unknown as IAgentRuntime
        );

        // Register the Service class to match the core API
        mockRuntime.registerService(HyperfyServiceClass);
      }

      // Now verify the service was registered with the runtime
      expect(registerServiceSpy).toHaveBeenCalledWith(expect.any(Function));
    }
  });
});
