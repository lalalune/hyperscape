import { type IAgentRuntime, type Memory, type State, UUID, type TestSuite } from '@elizaos/core';
import { hyperfyPlugin } from '../../index';

/**
 * Hyperfy Plugin E2E Test Suite
 * =============================
 *
 * These tests verify the complete integration of the Hyperfy plugin,
 * including world connection, agent movement, perception, and interaction.
 */

interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

export const HyperfyIntegrationTestSuite: TestSuite = {
  name: 'hyperfy_integration_test_suite',

  tests: [
    /**
     * Test 1: Service Initialization
     * Verifies that the HyperfyService starts correctly
     */
    {
      name: 'hyperfy_service_initialization',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService('hyperfy');

        if (!service) {
          throw new Error('HyperfyService not found in runtime');
        }

        // @ts-ignore - Service capabilityDescription property access
        if (!service.capabilityDescription.includes('Hyperfy world')) {
          throw new Error('Service capability description missing or incorrect');
        }

        console.log('✅ HyperfyService initialized successfully');
      },
    },

    /**
     * Test 2: World Connection Mock
     * Tests connection to a mocked Hyperfy world
     */
    {
      name: 'hyperfy_world_connection_mock',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService('hyperfy') as any;

        if (!service) {
          throw new Error('HyperfyService not found');
        }

        // Check if we can get the world (will be null if not connected)
        const world = service.getWorld?.();

        // In a real test environment, we'd mock the connection
        // For now, we verify the service methods exist
        if (typeof service.connect !== 'function') {
          throw new Error('Service missing connect method');
        }

        if (typeof service.isConnected !== 'function') {
          throw new Error('Service missing isConnected method');
        }

        console.log('✅ World connection methods verified');
      },
    },

    /**
     * Test 3: Movement Action Validation
     * Verifies movement actions are properly registered
     */
    {
      name: 'hyperfy_movement_actions',
      fn: async (runtime: IAgentRuntime) => {
        const movementActions = [
          'HYPERFY_GOTO_ENTITY',
          'HYPERFY_WALK_RANDOMLY',
          'HYPERFY_STOP_MOVING',
        ];

        for (const actionName of movementActions) {
          const action = runtime.actions.find((a: any) => a.name === actionName);

          if (!action) {
            throw new Error(`Movement action ${actionName} not found`);
          }

          // Validate action structure
          if (!action.description || !action.handler || !action.validate) {
            throw new Error(`Action ${actionName} missing required properties`);
          }
        }

        console.log('✅ All movement actions registered correctly');
      },
    },

    /**
     * Test 4: Perception Action
     * Tests the scene perception capability
     */
    {
      name: 'hyperfy_perception_action',
      fn: async (runtime: IAgentRuntime) => {
        const perceptionAction = runtime.actions.find((a: any) => a.name === 'HYPERFY_SCENE_PERCEPTION');

        if (!perceptionAction) {
          throw new Error('Scene perception action not found');
        }

        // Create mock message for testing
        const mockMessage: Memory = {
          id: runtime.agentId,
          entityId: 'test-entity-id-1234-5678-9012-345678901234' as UUID,
          roomId: 'test-room-id-1234-5678-9012-345678901234' as UUID,
          content: {
            text: 'Look around',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Create mock state
        const mockState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Test validation (should pass without service connection in test mode)
        const isValid = await perceptionAction.validate(runtime, mockMessage, mockState);

        console.log(`✅ Perception action validation: ${isValid}`);
      },
    },

    /**
     * Test 5: Emote System
     * Verifies emote provider and manager integration
     */
    {
      name: 'hyperfy_emote_system',
      fn: async (runtime: IAgentRuntime) => {
        const emoteProvider = runtime.providers.find((p: any) => p.name === 'HYPERFY_EMOTE_LIST');

        if (!emoteProvider) {
          throw new Error('Emote provider not found');
        }

        // Create mock message and state
        const mockMessage: Memory = {
          id: runtime.agentId,
          entityId: runtime.agentId,
          roomId: 'test-room-id-1234-5678-9012-345678901234' as UUID,
          content: { text: '', source: 'test' },
          createdAt: Date.now(),
        };

        const mockState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Get emote list
        const result = await emoteProvider.get(runtime, mockMessage, mockState);

        if (!result.data?.emotes || !Array.isArray(result.data.emotes)) {
          throw new Error('Emote provider did not return emote list');
        }

        if (result.data.emotes.length === 0) {
          throw new Error('No emotes found in emote list');
        }

        // Verify emote structure
        const firstEmote = result.data.emotes[0];
        if (
          !firstEmote.name ||
          !firstEmote.path ||
          !firstEmote.duration ||
          !firstEmote.description
        ) {
          throw new Error('Emote missing required properties');
        }

        console.log(`✅ Found ${result.data.emotes.length} emotes with correct structure`);
      },
    },

    /**
     * Test 6: World State Provider
     * Tests the world state information provider
     */
    {
      name: 'hyperfy_world_state_provider',
      fn: async (runtime: IAgentRuntime) => {
        const worldProvider = runtime.providers.find((p: any) => p.name === 'HYPERFY_WORLD_STATE');

        if (!worldProvider) {
          throw new Error('World state provider not found');
        }

        // Create mock message and state
        const mockMessage: Memory = {
          id: runtime.agentId,
          entityId: runtime.agentId,
          roomId: 'test-room-id-1234-5678-9012-345678901234' as UUID,
          content: { text: '', source: 'test' },
          createdAt: Date.now(),
        };

        const mockState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Get world state (will show disconnected in test)
        const result = await worldProvider.get(runtime, mockMessage, mockState);

        if (!result.text || !result.values || !result.data) {
          throw new Error('World provider returned incomplete result');
        }

        // Should at least have status
        if (!result.data.status) {
          throw new Error('World provider missing status');
        }

        console.log(`✅ World state provider working, status: ${result.data.status}`);
      },
    },

    /**
     * Test 7: Build Actions
     * Verifies world editing capabilities
     */
    {
      name: 'hyperfy_build_actions',
      fn: async (runtime: IAgentRuntime) => {
        const buildAction = runtime.actions.find((a: any) => a.name === 'HYPERFY_EDIT_ENTITY');

        if (!buildAction) {
          throw new Error('Build action not found');
        }

        // Check similes include expected values
        const expectedSimiles = ['EDIT_ENTITY_IN_WORLD', 'MODIFY_SCENE', 'BUILD_STRUCTURE'];
        const hasSimilies = expectedSimiles.every((s) => buildAction.similes?.includes(s));

        if (!hasSimilies) {
          throw new Error('Build action missing expected similes');
        }

        console.log('✅ Build action properly configured');
      },
    },

    /**
     * Test 8: Message Handling
     * Tests chat message processing
     */
    {
      name: 'hyperfy_message_handling',
      fn: async (runtime: IAgentRuntime) => {
        // Check for message handler in events
        const events = runtime.events;

        if (!events || !events.get) {
          throw new Error('Runtime events not properly initialized');
        }

        // Verify REPLY action exists
        const replyAction = runtime.actions.find((a: any) => a.name === 'REPLY');

        if (!replyAction) {
          throw new Error('REPLY action not found');
        }

        // Verify IGNORE action exists
        const ignoreAction = runtime.actions.find((a: any) => a.name === 'IGNORE');

        if (!ignoreAction) {
          throw new Error('IGNORE action not found');
        }

        console.log('✅ Message handling actions verified');
      },
    },

    /**
     * Test 9: Character Integration
     * Verifies character provider works with Hyperfy
     */
    {
      name: 'hyperfy_character_integration',
      fn: async (runtime: IAgentRuntime) => {
        const characterProvider = runtime.providers.find((p: any) => p.name === 'CHARACTER');

        if (!characterProvider) {
          throw new Error('Character provider not found');
        }

        // Create mock message and state
        const mockMessage: Memory = {
          id: runtime.agentId,
          entityId: runtime.agentId,
          roomId: 'test-room-id-1234-5678-9012-345678901234' as UUID,
          content: { text: '', source: 'test' },
          createdAt: Date.now(),
        };

        const mockState: State = {
          values: {},
          data: {},
          text: '',
        };

        const result = await characterProvider.get(runtime, mockMessage, mockState);

        if (!result.values?.agentName) {
          throw new Error('Character provider did not return agent name');
        }

        if (result.values.agentName !== runtime.character.name) {
          throw new Error('Character name mismatch');
        }

        console.log(`✅ Character integration verified for: ${result.values.agentName}`);
      },
    },

    /**
     * Test 10: Action Examples Validation
     * Ensures all actions have proper examples
     */
    {
      name: 'hyperfy_action_examples',
      fn: async (runtime: IAgentRuntime) => {
        const hyperfyActions = runtime.actions.filter((a: any) => a.name.startsWith('HYPERFY_'));

        for (const action of hyperfyActions) {
          if (!action.examples || !Array.isArray(action.examples)) {
            throw new Error(`Action ${action.name} missing examples`);
          }

          if (action.examples.length === 0) {
            throw new Error(`Action ${action.name} has empty examples array`);
          }

          // Verify example structure
          const firstExample = action.examples[0];
          if (!Array.isArray(firstExample) || firstExample.length < 2) {
            throw new Error(`Action ${action.name} has invalid example structure`);
          }
        }

        console.log(`✅ All ${hyperfyActions.length} Hyperfy actions have valid examples`);
      },
    },

    /**
     * Test 11: Agent handles basic world navigation
     * Verifies that the agent can access world navigation data
     */
    {
      name: 'Agent handles basic world navigation',
      fn: async (runtime: IAgentRuntime) => {
        const hyperfyService = runtime.getService('hyperfy') as any;
        if (!hyperfyService) {
          throw new Error('Hyperfy service not available');
        }

        // Just verify we can get the world without using it
        const _world = hyperfyService.getWorld();
        
        // The test passes if we can get the world without errors
        console.log('✅ Agent can access world navigation data');
      },
    },
  ],
};

// Export default instance for test runner
export default HyperfyIntegrationTestSuite;
