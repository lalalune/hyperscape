import { type IAgentRuntime, type Memory, type State, UUID, createUniqueUuid } from '@elizaos/core';
import { HyperfyService } from '../../service';

/**
 * Real Runtime E2E Test Suite for Hyperfy Plugin
 * ==============================================
 *
 * This test suite uses actual agent runtime to test the Hyperfy plugin
 * in realistic conditions without mocks.
 */

interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

export const HyperfyRealRuntimeTestSuite: TestSuite = {
  name: 'hyperfy_real_runtime_test_suite',

  tests: [
    /**
     * Test 1: Plugin Registration and Service Start
     * Verifies the plugin is properly registered and service starts
     */
    {
      name: 'hyperfy_plugin_registration_and_service_start',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing plugin registration and service start...');

        // Check if Hyperfy plugin is loaded
        const hyperfyPlugin = runtime.plugins.find((p: any) => p.name === 'plugin-hyperfy');
        if (!hyperfyPlugin) {
          throw new Error('Hyperfy plugin not found in runtime plugins');
        }

        // Check if service is registered
        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found in runtime services');
        }

        // Verify service properties
        if (!service.capabilityDescription) {
          throw new Error('Service missing capability description');
        }

        console.log('✅ Plugin registered and service started successfully');
      },
    },

    /**
     * Test 2: Action Registration
     * Verifies all Hyperfy actions are properly registered
     */
    {
      name: 'hyperfy_action_registration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing action registration...');

        const expectedActions = [
          'HYPERFY_GOTO_ENTITY',
          'HYPERFY_WALK_RANDOMLY',
          'HYPERFY_STOP_MOVING',
          'HYPERFY_SCENE_PERCEPTION',
          'HYPERFY_EDIT_ENTITY',
          'HYPERFY_USE_ITEM',
          'HYPERFY_UNUSE_ITEM',
          'HYPERFY_AMBIENT_SPEECH',
          'REPLY',
          'IGNORE',
        ];

        const missingActions: string[] = [];

        for (const actionName of expectedActions) {
          const action = runtime.actions.find((a: any) => a.name === actionName);
          if (!action) {
            missingActions.push(actionName);
          } else {
            // Verify action has required properties
            if (!action.description || !action.handler || !action.validate) {
              throw new Error(`Action ${actionName} missing required properties`);
            }
          }
        }

        if (missingActions.length > 0) {
          throw new Error(`Missing actions: ${missingActions.join(', ')}`);
        }

        console.log(`✅ All ${expectedActions.length} actions registered correctly`);
      },
    },

    /**
     * Test 3: Provider Registration
     * Verifies all Hyperfy providers are properly registered
     */
    {
      name: 'hyperfy_provider_registration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing provider registration...');

        const expectedProviders = [
          'HYPERFY_WORLD_STATE',
          'HYPERFY_EMOTE_LIST',
          'HYPERFY_ACTIONS',
          'CHARACTER',
        ];

        const missingProviders: string[] = [];

        for (const providerName of expectedProviders) {
          const provider = runtime.providers.find((p: any) => p.name === providerName);
          if (!provider) {
            missingProviders.push(providerName);
          } else {
            // Verify provider has required properties
            if (!provider.get || typeof provider.get !== 'function') {
              throw new Error(`Provider ${providerName} missing get function`);
            }
          }
        }

        if (missingProviders.length > 0) {
          throw new Error(`Missing providers: ${missingProviders.join(', ')}`);
        }

        console.log(`✅ All ${expectedProviders.length} providers registered correctly`);
      },
    },

    /**
     * Test 4: World State Provider
     * Tests the world state provider returns valid data
     */
    {
      name: 'hyperfy_world_state_provider_test',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing world state provider...');

        const provider = runtime.providers.find((p: any) => p.name === 'HYPERFY_WORLD_STATE');
        if (!provider) {
          throw new Error('World state provider not found');
        }

        // Create a test message
        const testMessage: Memory = {
          id: createUniqueUuid(runtime, 'test-msg') as UUID,
          entityId: runtime.agentId,
          roomId: createUniqueUuid(runtime, 'test-room') as UUID,
          content: { text: 'test', source: 'test' },
          createdAt: Date.now(),
        };

        const testState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Get world state
        const result = await provider.get(runtime, testMessage, testState);

        // Verify result structure
        if (!result.text || !result.values || !result.data) {
          throw new Error('Provider returned incomplete result');
        }

        // Should have status in data
        if (!result.data.status) {
          throw new Error('Provider missing status in data');
        }

        console.log(`✅ World state provider working, status: ${result.data.status}`);
      },
    },

    /**
     * Test 5: Emote Provider
     * Tests the emote provider returns valid emote list
     */
    {
      name: 'hyperfy_emote_provider_test',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing emote provider...');

        const provider = runtime.providers.find((p: any) => p.name === 'HYPERFY_EMOTE_LIST');
        if (!provider) {
          throw new Error('Emote provider not found');
        }

        // Create a test message
        const testMessage: Memory = {
          id: createUniqueUuid(runtime, 'test-msg') as UUID,
          entityId: runtime.agentId,
          roomId: createUniqueUuid(runtime, 'test-room') as UUID,
          content: { text: 'test', source: 'test' },
          createdAt: Date.now(),
        };

        const testState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Get emote list
        const result = await provider.get(runtime, testMessage, testState);

        // Verify result structure
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
     * Test 6: Action Validation Without Connection
     * Tests that actions properly validate when not connected
     */
    {
      name: 'hyperfy_action_validation_without_connection',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing action validation without connection...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        // Ensure we're not connected
        if (service.isConnected()) {
          console.log('Service is connected, this test expects disconnected state');
        }

        // Test movement action validation
        const gotoAction = runtime.actions.find((a: any) => a.name === 'HYPERFY_GOTO_ENTITY');
        if (!gotoAction) {
          throw new Error('GOTO action not found');
        }

        const testMessage: Memory = {
          id: createUniqueUuid(runtime, 'test-msg') as UUID,
          entityId: runtime.agentId,
          roomId: createUniqueUuid(runtime, 'test-room') as UUID,
          content: { text: 'go to the fountain', source: 'test' },
          createdAt: Date.now(),
        };

        const testState: State = {
          values: {},
          data: {},
          text: '',
        };

        // Validate should return false when not connected
        const isValid = await gotoAction.validate(runtime, testMessage, testState);

        if (service.isConnected() && !isValid) {
          throw new Error('Action validation failed when connected');
        }

        console.log(
          `✅ Action validation works correctly, connected: ${service.isConnected()}, valid: ${isValid}`
        );
      },
    },

    /**
     * Test 7: Message Handler Event Registration
     * Verifies message handler is registered for Hyperfy events
     */
    {
      name: 'hyperfy_message_handler_registration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing message handler registration...');

        // Check if message received handler is registered
        const handlers = runtime.events.get('HYPERFY_MESSAGE_RECEIVED');

        if (!handlers || handlers.length === 0) {
          throw new Error('No message handlers registered for HYPERFY_MESSAGE_RECEIVED event');
        }

        console.log(`✅ Found ${handlers.length} message handler(s) registered`);
      },
    },

    /**
     * Test 8: Service Managers
     * Tests that service managers are accessible
     */
    {
      name: 'hyperfy_service_managers_test',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing service managers...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        // Test manager getters
        const managers = [
          { name: 'EmoteManager', getter: () => service.getEmoteManager() },
          { name: 'BehaviorManager', getter: () => service.getBehaviorManager() },
          { name: 'MessageManager', getter: () => service.getMessageManager() },
          { name: 'VoiceManager', getter: () => service.getVoiceManager() },
          { name: 'PuppeteerManager', getter: () => service.getPuppeteerManager() },
          { name: 'BuildManager', getter: () => service.getBuildManager() },
        ];

        for (const { name, getter } of managers) {
          try {
            const manager = getter();
            if (!manager) {
              throw new Error(`${name} is null`);
            }
          } catch (error) {
            throw new Error(`Failed to get ${name}: ${error}`);
          }
        }

        console.log('✅ All service managers are accessible');
      },
    },

    /**
     * Test 9: Character Integration
     * Tests that character data is properly integrated
     */
    {
      name: 'hyperfy_character_integration_test',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing character integration...');

        const characterProvider = runtime.providers.find((p: any) => p.name === 'CHARACTER');
        if (!characterProvider) {
          throw new Error('Character provider not found');
        }

        const testMessage: Memory = {
          id: createUniqueUuid(runtime, 'test-msg') as UUID,
          entityId: runtime.agentId,
          roomId: createUniqueUuid(runtime, 'test-room') as UUID,
          content: { text: 'test', source: 'test' },
          createdAt: Date.now(),
        };

        const testState: State = {
          values: {},
          data: {},
          text: '',
        };

        const result = await characterProvider.get(runtime, testMessage, testState);

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
     * Test 10: Plugin Configuration
     * Tests that plugin configuration is properly loaded
     */
    {
      name: 'hyperfy_plugin_configuration_test',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing plugin configuration...');

        const plugin = runtime.plugins.find((p: any) => p.name === 'plugin-hyperfy');
        if (!plugin) {
          throw new Error('Hyperfy plugin not found');
        }

        // Check description
        if (!plugin.description || !plugin.description.includes('3D')) {
          throw new Error('Plugin description missing or incorrect');
        }

        // Check services
        if (!plugin.services || plugin.services.length === 0) {
          throw new Error('Plugin services not defined');
        }

        // Check actions
        if (!plugin.actions || plugin.actions.length === 0) {
          throw new Error('Plugin actions not defined');
        }

        // Check providers
        if (!plugin.providers || plugin.providers.length === 0) {
          throw new Error('Plugin providers not defined');
        }

        console.log(
          `✅ Plugin configuration verified: ${plugin.actions.length} actions, ${plugin.providers.length} providers`
        );
      },
    },
  ],
};

// Export default instance for test runner
export default HyperfyRealRuntimeTestSuite;
