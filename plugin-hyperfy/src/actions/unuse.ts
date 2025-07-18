import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { HyperfyService } from '../service';
import { AgentActions } from '../systems/actions';

export const hyperfyUnuseItemAction: Action = {
  name: 'HYPERFY_UNUSE_ITEM',
  similes: ['RELEASE_ITEM', 'DROP_ITEM', 'CANCEL_INTERACTION'],
  description:
    "Drops or stops interacting with the currently held item; use when a player tells you to release it or you're done using it. Can be chained after USE_ITEM actions to complete interaction sequences.",
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    return !!service && service.isConnected() && !!world?.actions;
  },
  handler: async (runtime: IAgentRuntime, _message: Memory, _state?: State, _options?: {}, callback?: HandlerCallback): Promise<ActionResult> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    const actions = world?.actions as unknown as AgentActions | undefined;

    if (!service || !world || !actions) {
      logger.error('[UNUSE Action] Hyperfy service or actions not found.');
      if (callback) {
        await callback({ text: 'Error: Cannot unuse item. Required systems are unavailable.' });
      }
      return {
        text: 'Error: Cannot unuse item. Required systems are unavailable.',
        values: { success: false, error: 'systems_unavailable' },
        data: { action: 'HYPERFY_UNUSE_ITEM' },
      };
    }

    logger.info('[UNUSE ITEM] Attempting to release current action.');
    actions.releaseAction();

    if (callback) {
      const successResponse = {
        text: 'Item released.',
        actions: ['HYPERFY_UNUSE_ITEM'],
        source: 'hyperfy',
        metadata: { status: 'released' },
      };
      await callback(successResponse);
    }

    return {
      text: 'Item released.',
      values: { success: true, status: 'released' },
      data: { action: 'HYPERFY_UNUSE_ITEM' },
    };
  },
  examples: [
    [
      { name: '{{user}}', content: { text: 'Drop it now.' } },
      {
        name: '{{agent}}',
        content: {
          thought: "User wants me to drop whatever I'm currently holding or interacting with",
          text: 'Item released.',
          actions: ['HYPERFY_UNUSE_ITEM'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Stop using that.' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to stop my current interaction and release the item',
          text: 'Item released.',
          actions: ['HYPERFY_UNUSE_ITEM'],
          source: 'hyperfy',
        },
      },
    ],
  ],
};
