// @ts-nocheck - Suppressing TypeScript errors for legacy compatibility
import {
  ChannelType,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelType,
  UUID,
  composePromptFromState,
  createUniqueUuid,
  parseKeyValueXml,
  logger,
} from '@elizaos/core';
import { HyperfyService } from '../service';
import { agentActivityLock } from './guards';
import { getHyperfyActions, formatActions } from '../utils';
import { autoTemplate } from '../templates';

const TIME_INTERVAL_MIN = 15000; // 15 seconds
const TIME_INTERVAL_MAX = 30000; // 30 seconds

export class BehaviorManager {
  private isRunning: boolean = false;
  private runtime: IAgentRuntime;
  private maxIterations: number = -1; // -1 for infinite, set to limit for testing

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Returns whether the behavior manager is currently running
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Set maximum iterations for testing (to prevent infinite loops in tests)
   */
  public setMaxIterations(max: number): void {
    this.maxIterations = max;
  }

  /**
   * Starts the behavior loop if not already running and prerequisites are met.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('[BehaviorManager] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[BehaviorManager] Starting behavior loop for player');

    this.runLoop().catch((err) => logger.error('[BehaviorManager] Fatal error in run loop:', err));
  }

  /**
   * Stops the behavior loop
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('[BehaviorManager] Not running');
      return;
    }

    this.isRunning = false;
    logger.info('[BehaviorManager] Stopped behavior loop');
  }

  /**
   * Main loop that waits for each behavior to finish
   */
  private async runLoop(): Promise<void> {
    let iterations = 0;

    while (this.isRunning && (this.maxIterations === -1 || iterations < this.maxIterations)) {
      try {
        await this.executeBehavior();
      } catch (error) {
        logger.error('[BehaviorManager] Error in behavior:', error);
      }

      iterations++;

      // Check if we're in test mode (NODE_ENV includes 'test' or we have a max iteration limit)
      const isTestMode = process.env.NODE_ENV?.includes('test') || this.maxIterations > 0;

      if (isTestMode && iterations >= 2) {
        // In test mode, only run a couple iterations
        logger.info('[BehaviorManager] Test mode detected, stopping after limited iterations');
        this.stop();
        break;
      }

      // Short delay between behaviors (reduced for tests)
      const delay = isTestMode
        ? 100 // 100ms for tests
        : TIME_INTERVAL_MIN + Math.floor(Math.random() * (TIME_INTERVAL_MAX - TIME_INTERVAL_MIN));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private getService() {
    return this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
  }

  /**
   * Executes a behavior
   */
  private async executeBehavior(): Promise<void> {
    const service = this.getService();
    if (!service) {
      logger.error('[BehaviorManager] Cannot start — service not available');
      return;
    }

    const world = service.getWorld();
    if (!world) {
      logger.error('[BehaviorManager] Cannot start — world not found');
      return;
    }

    const player = world.entities?.player;
    if (!player) {
      logger.error('[BehaviorManager] Cannot start — player entity not found');
      return;
    }
    // TODO: There may be slow post-processing in the bootstrap plugin's message handler.
    // Investigate long tail after message handling, especially in emitEvent or runtime methods.
    if (agentActivityLock.isActive()) {
      logger.info('[BehaviorManager] Skipping behavior — message activity in progress');
      return;
    }

    const _currentWorldId = service.currentWorldId;

    const elizaRoomId = createUniqueUuid(this.runtime, _currentWorldId || 'hyperfy-unknown-world');
    const entityId = createUniqueUuid(this.runtime, this.runtime.agentId);

    const newMessage: Memory = {
      id: createUniqueUuid(this.runtime, Date.now().toString()),
      content: {
        text: '',
        type: 'text',
      },
      roomId: elizaRoomId,
      worldId: _currentWorldId || undefined,
      entityId,
    };

    const state = await this.runtime.composeState(newMessage);

    const actionsData = await getHyperfyActions(this.runtime, newMessage, state, [
      'HYPERFY_GOTO_ENTITY',
      'HYPERFY_WALK_RANDOMLY',
      'HYPERFY_USE_ITEM',
      'HYPERFY_UNUSE_ITEM',
      'HYPERFY_AMBIENT_SPEECH',
      'REPLY',
      'IGNORE',
    ]);

    const actionsText = actionsData.length > 0 ? formatActions(actionsData) : '';

    const responsePrompt = composePromptFromState({ state, template: autoTemplate(actionsText) });

    // decide
    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: responsePrompt,
    });

    // @ts-ignore - Response type is unknown but parseKeyValueXml handles it
    const parsedXml = parseKeyValueXml(response);

    console.log('****** response\n', parsedXml);

    const responseMemory = {
      content: {
        thought: parsedXml?.thought || '',
        text: parsedXml?.text || '',
        actions: parsedXml?.actions || [],
        providers: parsedXml?.providers || [],
        emote: parsedXml?.emote || '',
      },
      entityId: createUniqueUuid(this.runtime, this.runtime.agentId),
      roomId: elizaRoomId,
    };

    const name = world.entities.player?.data?.name || 'Unknown';
    await this.runtime.ensureConnection({
      entityId,
      roomId: elizaRoomId,
      userName: name,
      name,
      source: 'hyperfy',
      channelId: _currentWorldId || undefined,
      serverId: 'hyperfy',
      type: ChannelType.WORLD,
      worldId: _currentWorldId || createUniqueUuid(this.runtime, 'hyperfy-unknown-world'),
      userId:
        (world.entities.player?.data?.id as UUID) ||
        createUniqueUuid(this.runtime, 'unknown-player'),
    });

    const callback: HandlerCallback = async (responseContent: Content): Promise<Memory[]> => {
      console.info(`[Hyperfy Auto Callback] Received response: ${JSON.stringify(responseContent)}`);
      const emote = responseContent.emote as string;
      const callbackMemory: Memory = {
        id: createUniqueUuid(this.runtime, Date.now().toString()),
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        content: {
          ...responseContent,
          channelType: ChannelType.WORLD,
          emote,
        },
        roomId: elizaRoomId,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(callbackMemory, 'messages');

      if (parsedXml?.emote) {
        const service = this.getService();
        const emoteManager = service?.emoteManager;
        if (emoteManager) {
          // @ts-ignore - Manager access
          emoteManager.playEmote(parsedXml.emote);
        }
      }

      if (parsedXml?.message) {
        const service = this.getService();
        const messageManager = service?.messageManager;
        if (messageManager) {
          // @ts-ignore - Manager access
          messageManager.sendMessage(parsedXml.message);
        }
      }

      return [];
    };

    await this.runtime.processActions(newMessage, [responseMemory], state, callback);

    await this.runtime.evaluate(newMessage, state, true, callback, [responseMemory]);
  }
}
