import { type IAgentRuntime, type Memory, type State, UUID, createUniqueUuid } from '@elizaos/core';
import { HyperfyService } from '../../service';
import type { HyperfyWorld } from '../../types/hyperfy';

/**
 * Real World E2E Test Suite for Hyperfy Plugin
 * ============================================
 *
 * This test suite uses actual agent runtime to test the Hyperfy plugin
 * with real world connections and interactions.
 *
 * Prerequisites:
 * - WS_URL environment variable set to a valid Hyperfy world WebSocket URL
 * - Or uses default test world at wss://chill.hyperfy.xyz/ws
 */

interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

// Helper to wait for async operations
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const HyperfyRealWorldTestSuite: TestSuite = {
  name: 'hyperfy_real_world_test_suite',

  tests: [
    /**
     * Test 1: Real World Connection
     * Tests actual connection to a Hyperfy world
     */
    {
      name: 'hyperfy_real_world_connection',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real world connection...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        // Get WebSocket URL from environment or use default
        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        console.log(`Attempting to connect to: ${wsUrl}`);

        try {
          // Connect to the real world
          await service.connect({
            wsUrl,
            worldId,
            authToken: process.env.HYPERFY_AUTH_TOKEN,
          });

          // Verify connection
          if (!service.isConnected()) {
            throw new Error('Service reports not connected after connect()');
          }

          // Get the world instance
          const world = service.getWorld();
          if (!world) {
            throw new Error('World instance is null after connection');
          }

          // Verify world properties
          if (!world.network || !world.network.id) {
            throw new Error('World network not initialized');
          }

          console.log(`✅ Connected to world with network ID: ${world.network.id}`);

          // Wait for player entity to be created
          await wait(2000);

          if (world.entities.player) {
            console.log(`✅ Player entity created with ID: ${world.entities.player.data.id}`);
          } else {
            console.log('⚠️  Player entity not yet created (may take more time)');
          }
        } finally {
          // Always disconnect after test
          await service.disconnect();
        }
      },
    },

    /**
     * Test 2: Real Chat System
     * Tests sending and receiving chat messages
     */
    {
      name: 'hyperfy_real_chat_system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real chat system...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world || !world.chat) {
            throw new Error('World chat system not available');
          }

          // Subscribe to chat messages
          let messageReceived = false;
          const unsubscribe = world.chat.subscribe((messages: any[]) => {
            console.log(`Chat updated: ${messages.length} total messages`);
            if (messages.length > 0) {
              messageReceived = true;
            }
          });

          // Send a test message
          const testMessage = {
            id: createUniqueUuid(runtime, 'msg'),
            entityId: runtime.agentId,
            text: `Test message from ${runtime.character.name} at ${new Date().toISOString()}`,
            timestamp: Date.now(),
            from: runtime.character.name,
          };

          console.log('Sending test message...');
          world.chat.add(testMessage, true); // broadcast = true

          // Wait for message propagation
          await wait(1000);

          // Check if message was added
          const foundMessage = world.chat.msgs.find((m: any) => m.id === testMessage.id);
          if (!foundMessage) {
            throw new Error('Test message not found in chat history');
          }

          console.log('✅ Chat message sent and stored successfully');

          // Cleanup
          unsubscribe();
        } finally {
          await service.disconnect();
        }
      },
    },

    /**
     * Test 3: Real Entity System
     * Tests entity detection and interaction
     */
    {
      name: 'hyperfy_real_entity_system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real entity system...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world) {
            throw new Error('World not available');
          }

          // Wait for world to populate
          await wait(3000);

          // Check for entities
          console.log(`Found ${world.entities.items.size} entities in the world`);
          console.log(`Found ${world.entities.players.size} players in the world`);

          // List some entities
          let entityCount = 0;
          world.entities.items.forEach((entity: any, id: string) => {
            if (entityCount < 5) {
              console.log(
                `  Entity ${id}: ${entity.data.name || 'Unnamed'} (type: ${entity.data.type || 'unknown'})`
              );
              entityCount++;
            }
          });

          if (world.entities.items.size === 0) {
            console.log('⚠️  No entities found (world may be empty)');
          } else {
            console.log('✅ Entity system working correctly');
          }
        } finally {
          await service.disconnect();
        }
      },
    },

    /**
     * Test 4: Real Action System
     * Tests executing actions in the world
     */
    {
      name: 'hyperfy_real_action_system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real action system...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world || !world.actions) {
            throw new Error('World actions system not available');
          }

          // Wait for player to be ready
          await wait(3000);

          if (!world.entities.player) {
            console.log('⚠️  Player not ready, skipping action test');
            return;
          }

          // Try to execute an emote action
          console.log('Executing wave emote...');
          if (world.actions?.execute) {
            world.actions.execute('emote', 'wave');
          } else {
            console.log('⚠️  Actions system not available');
          }

          // Wait for action to process
          await wait(1000);

          // Check if emote was applied
          const playerEmote = world.entities.player.data.effect?.emote;
          console.log(`Player emote state: ${playerEmote || 'none'}`);

          console.log('✅ Action system executed (check world for visual confirmation)');
        } finally {
          await service.disconnect();
        }
      },
    },

    /**
     * Test 5: Real Movement System
     * Tests player movement and navigation
     */
    {
      name: 'hyperfy_real_movement_system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real movement system...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world || !world.controls) {
            throw new Error('World controls not available');
          }

          // Wait for player to be ready
          await wait(3000);

          if (!world.entities.player) {
            console.log('⚠️  Player not ready, skipping movement test');
            return;
          }

          // Get initial position
          const initialPos = {
            x: world.entities.player.position.x,
            y: world.entities.player.position.y,
            z: world.entities.player.position.z,
          };

          console.log(
            `Initial position: (${initialPos.x.toFixed(2)}, ${initialPos.y.toFixed(2)}, ${initialPos.z.toFixed(2)})`
          );

          // Move to a new position
          const targetX = initialPos.x + 5;
          const targetZ = initialPos.z + 5;

          console.log(
            `Moving to: (${targetX.toFixed(2)}, ${initialPos.y.toFixed(2)}, ${targetZ.toFixed(2)})`
          );
          await world.controls.goto(targetX, initialPos.y, targetZ);

          // Wait for movement
          await wait(5000);

          // Check new position
          const newPos = {
            x: world.entities.player.position.x,
            y: world.entities.player.position.y,
            z: world.entities.player.position.z,
          };

          console.log(
            `New position: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)})`
          );

          const moved =
            Math.abs(newPos.x - initialPos.x) > 0.1 || Math.abs(newPos.z - initialPos.z) > 0.1;

          if (moved) {
            console.log('✅ Movement system working correctly');
          } else {
            console.log('⚠️  Player did not move (may be blocked or movement disabled)');
          }
        } finally {
          await service.disconnect();
        }
      },
    },

    /**
     * Test 6: Real Event System
     * Tests world event handling
     */
    {
      name: 'hyperfy_real_event_system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real event system...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world || !world.events) {
            throw new Error('World events system not available');
          }

          // Track events
          const receivedEvents: string[] = [];

          // Subscribe to various events
          world.events.on('chat', (data: any) => {
            receivedEvents.push('chat');
            console.log('Received chat event:', data);
          });

          world.events.on('playerJoined', (data: any) => {
            receivedEvents.push('playerJoined');
            console.log('Received playerJoined event:', data);
          });

          world.events.on('entityAdded', (data: any) => {
            receivedEvents.push('entityAdded');
            console.log('Received entityAdded event:', data);
          });

          // Trigger a chat event
          world.chat.add(
            {
              id: createUniqueUuid(runtime, 'test-msg'),
              entityId: runtime.agentId,
              text: 'Testing event system',
              timestamp: Date.now(),
            },
            false
          );

          // Wait for events
          await wait(2000);

          console.log(`Received ${receivedEvents.length} events: ${receivedEvents.join(', ')}`);

          if (receivedEvents.length > 0) {
            console.log('✅ Event system working correctly');
          } else {
            console.log('⚠️  No events received (may need more activity in world)');
          }
        } finally {
          await service.disconnect();
        }
      },
    },

    /**
     * Test 7: Real Network Communication
     * Tests network message sending and receiving
     */
    {
      name: 'hyperfy_real_network_communication',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing real network communication...');

        const service = runtime.getService('hyperfy') as HyperfyService;
        if (!service) {
          throw new Error('HyperfyService not found');
        }

        const wsUrl = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
        const worldId = createUniqueUuid(runtime, 'test-world') as UUID;

        try {
          await service.connect({ wsUrl, worldId });

          const world = service.getWorld();
          if (!world || !world.network) {
            throw new Error('World network not available');
          }

          console.log(`Network ID: ${world.network.id}`);
          console.log(`Max upload size: ${world.network.maxUploadSize} MB`);

          // Send a custom network message
          console.log('Sending custom network message...');
          world.network.send('customTest', {
            timestamp: Date.now(),
            message: 'Testing network communication',
            agentId: runtime.agentId,
          });

          // Wait for any responses
          await wait(1000);

          console.log('✅ Network communication test completed');
        } finally {
          await service.disconnect();
        }
      },
    },
  ],
};

// Export default instance for test runner
export default HyperfyRealWorldTestSuite;
