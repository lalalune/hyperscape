import {
  type Action,
  type ActionResult,
  type ActionExample,
  
  
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type State,
  type Content,
  logger,
} from '@elizaos/core'
// No longer need THREE here
import { HyperscapeService } from '../service'

// Restore constants for default values
const RANDOM_WALK_DEFAULT_INTERVAL = 4000 // ms (4 seconds)
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 30 // meters

// AgentControls interface
interface AgentControlsWithRandomWalk {
  startRandomWalk: () => void;
  stopRandomWalk: () => void;
  getIsWalkingRandomly: () => boolean;
}

export const walkRandomlyAction: Action = {
  name: 'WALK_RANDOMLY',
  similes: ['WANDER', 'PACE_AROUND', 'WALK_AROUND', 'MOVE_RANDOMLY', 'PATROL'],
  description:
    'Makes your character wander to random points nearby; use for idle behavior or ambient movement. Can be chained with STOP actions to control wandering patterns in complex scenarios.',
  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    // Keep validation simple: Check if service is connected
    return !!service && service.isConnected()
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    const world = service?.getWorld()
    const controls = world?.controls

    if (!service || !world || !callback) {
      logger.error(
        'Hyperscape service, world, or controls not found for WALK_RANDOMLY action.'
      )
      if (callback) {
        await callback({
          text: 'Error: Cannot wander. Hyperscape connection/controls unavailable.',
          success: false,
        })
      }
      return {
        text: 'Error: Cannot wander. Hyperscape connection/controls unavailable.',
        success: false,
        values: { success: false, error: 'connection_unavailable' },
        data: { action: 'WALK_RANDOMLY' },
      }
    }

    // Check for specific methods from the reverted AgentControls
    if (
      typeof (controls as { startRandomWalk?: () => void }).startRandomWalk !== 'function' ||
      typeof (controls as { stopRandomWalk?: () => void }).stopRandomWalk !== 'function'
    ) {
      logger.error(
        'AgentControls missing startRandomWalk or stopRandomWalk methods.'
      )
      if (callback) {
        await callback({
          text: 'Error: Wander functionality not available in controls.',
          success: false,
        })
      }
      return {
        text: 'Error: Wander functionality not available in controls.',
        success: false,
        values: { success: false, error: 'wander_function_unavailable' },
        data: { action: 'WALK_RANDOMLY' },
      }
    }

    const command = _options?.command || 'start'
    // Use provided interval (in seconds) or default (in ms)
    const intervalMs = _options?.interval
      ? (_options.interval as number) * 1000
      : RANDOM_WALK_DEFAULT_INTERVAL
    const maxDistance = _options?.distance || RANDOM_WALK_DEFAULT_MAX_DISTANCE

    if (command === 'stop') {
      const agentControls = controls as AgentControlsWithRandomWalk;
      if (agentControls.getIsWalkingRandomly()) {
        agentControls.stopRandomWalk()
        return {
          text: 'Stopped wandering.',
          success: true,
          values: { success: true, command: 'stop', wasWandering: true },
          data: { action: 'WALK_RANDOMLY', status: 'stopped' },
        }
      } else {
        return {
          text: 'Was not wandering.',
          success: true,
          values: { success: true, command: 'stop', wasWandering: false },
          data: {
            action: 'WALK_RANDOMLY',
            status: 'already_stopped',
          },
        }
      }
    } else {
      // command === 'start'
      const agentControls = controls as AgentControlsWithRandomWalk;
      agentControls.startRandomWalk()

      if (callback) {
        const startResponse = {
          text: '',
          actions: ['WALK_RANDOMLY'],
          source: 'hyperscape',
          metadata: { status: 'started', intervalMs, maxDistance },
        }
        await callback(startResponse as Content)
      }

      return {
        text: '',
        success: true,
        values: { success: true, command: 'start', intervalMs, maxDistance },
        data: {
          action: 'WALK_RANDOMLY',
          status: 'started',
          intervalMs,
          maxDistance,
        },
      }
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
          text: 'Starting to wander randomly...',
          actions: ['WALK_RANDOMLY'],
          source: 'hyperscape',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Just pace around here.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to pace in this general area - I should start wandering locally',
          text: 'Pacing around the area...',
          actions: ['WALK_RANDOMLY'],
          source: 'hyperscape',
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
          actions: ['WALK_RANDOMLY'],
          source: 'hyperscape',
        },
      },
    ],
  ] as ActionExample[][],
}
