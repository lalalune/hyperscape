import {
  logger,
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from '@elizaos/core';
// No longer need THREE here
import { AgentControls } from '../systems/controls'; // Still need type for casting
import { HyperfyService } from '../service';

// Restore constants for default values
const RANDOM_WALK_DEFAULT_INTERVAL = 4000; // ms (4 seconds)
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 30; // meters

// State management is now in AgentControls

export const hyperfyWalkRandomlyAction: Action = {
  name: 'HYPERFY_WALK_RANDOMLY',
  similes: ['WANDER', 'PACE_AROUND', 'WALK_AROUND', 'MOVE_RANDOMLY'], // Reverted similes/desc
  description:
    'Makes your character wander to random points nearby; use for idle behavior or ambient movement. Can be chained with STOP actions to control wandering patterns in complex scenarios.',
  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    // Keep validation simple: Check if controls exist
    return !!service && service.isConnected() && !!service.getWorld()?.controls;
  },
  handler: async (runtime: IAgentRuntime, _message: Memory, _state?: State, options?: { interval?: number; distance?: number; command?: 'start' | 'stop' }, // Reverted options
    callback?: HandlerCallback): Promise<ActionResult> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    const controls = world?.controls as unknown as AgentControls | undefined;

    if (!service || !world || !controls || !callback) {
      logger.error(
        'Hyperfy service, world, or controls not found for HYPERFY_WALK_RANDOMLY action.'
      );
      if (callback) {
        await callback({ text: 'Error: Cannot wander. Hyperfy connection/controls unavailable.' });
      }
      return {
        text: 'Error: Cannot wander. Hyperfy connection/controls unavailable.',
        values: { success: false, error: 'connection_unavailable' },
        data: { action: 'HYPERFY_WALK_RANDOMLY' },
      };
    }

    // Check for specific methods from the reverted AgentControls
    if (
      typeof controls.startRandomWalk !== 'function' ||
      typeof controls.stopRandomWalk !== 'function'
    ) {
      logger.error('AgentControls missing startRandomWalk or stopRandomWalk methods.');
      if (callback) {
        await callback({ text: 'Error: Wander functionality not available in controls.' });
      }
      return {
        text: 'Error: Wander functionality not available in controls.',
        values: { success: false, error: 'wander_function_unavailable' },
        data: { action: 'HYPERFY_WALK_RANDOMLY' },
      };
    }

    const command = options?.command || 'start';
    // Use provided interval (in seconds) or default (in ms)
    const intervalMs = options?.interval ? options.interval * 1000 : RANDOM_WALK_DEFAULT_INTERVAL;
    const maxDistance = options?.distance || RANDOM_WALK_DEFAULT_MAX_DISTANCE;

    if (command === 'stop') {
      if (controls.getIsWalkingRandomly()) {
        controls.stopRandomWalk();
        return {
          text: 'Stopped wandering.',
          values: { success: true, command: 'stop', wasWandering: true },
          data: { action: 'HYPERFY_WALK_RANDOMLY', status: 'stopped' },
        };
      } else {
        return {
          text: 'Was not wandering.',
          values: { success: true, command: 'stop', wasWandering: false },
          data: { action: 'HYPERFY_WALK_RANDOMLY', status: 'already_stopped' },
        };
      }
    } else {
      // command === 'start'
      controls.startRandomWalk(intervalMs, maxDistance);

      if (callback) {
        const startResponse = {
          text: '',
          actions: ['HYPERFY_WALK_RANDOMLY'],
          source: 'hyperfy',
          metadata: { status: 'started', intervalMs, maxDistance },
        };
        await callback(startResponse);
      }

      return {
        text: '',
        values: { success: true, command: 'start', intervalMs, maxDistance },
        data: { action: 'HYPERFY_WALK_RANDOMLY', status: 'started', intervalMs, maxDistance },
      };
    }
  },
  examples: [
    [
      { name: '{{user}}', content: { text: 'Wander around for a bit.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to start wandering around the area - I should begin random movement',
          text: 'Starting to wander randomly... (New target every ~5.0s)',
          actions: ['HYPERFY_WALK_RANDOMLY'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Just pace around here.' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to pace in this general area - I should start wandering locally',
          text: 'Starting to wander randomly... (New target every ~5.0s)',
          actions: ['HYPERFY_WALK_RANDOMLY'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Stop wandering.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to stop my random movement - I should halt the wandering behavior',
          text: 'Stopped wandering.',
          actions: ['HYPERFY_WALK_RANDOMLY'],
          source: 'hyperfy',
        },
      },
    ],
  ],
};
