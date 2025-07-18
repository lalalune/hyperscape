import {
  ChannelType,
  Entity,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  UUID,
  formatTimestamp,
  createUniqueUuid,
  getEntityDetails,
} from '@elizaos/core';
import { HyperfyService } from '../service.js';
import { agentActivityLock } from './guards';
import { hyperfyEventType } from '../events';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import type { HyperfyChatMessage } from '../types/hyperfy.js';

export class MessageManager {
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async handleMessage(msg: any): Promise<void> {
    // maybe a thinking emote here?
    await agentActivityLock.run(async () => {
      const service = this.getService();
      if (!service) {
        console.error('[MessageManager] Service not available');
        return;
      }

      const world = service.getWorld();
      if (!world || !world.entities?.player?.data?.id) {
        console.error('[MessageManager] World or player not available');
        return;
      }

      const agentPlayerId = world.entities.player.data.id; // Get agent's ID
      const senderName = msg.from || 'System';
      const messageBody = msg.body || '';
      const _currentWorldId = service.currentWorldId;
      console.info(`[Chat Received] From: ${senderName}, ID: ${msg.id}, Body: "${messageBody}"`);

      // Respond only to messages not from the agent itself
      if (msg.fromId && msg.fromId !== agentPlayerId) {
        console.info(`[Hyperfy Chat] Processing message from ${senderName}`);

        // First, ensure we register the entity (world, room, sender) in Eliza properly
        const hyperfyWorldId = createUniqueUuid(this.runtime, 'hyperfy-world') as UUID;
        const elizaRoomId = createUniqueUuid(
          this.runtime,
          _currentWorldId || 'hyperfy-unknown-world'
        );
        const entityId = createUniqueUuid(this.runtime, msg.fromId.toString()) as UUID;

        console.debug(`[Hyperfy Chat] Creating entity connection for: ${entityId}`);
        // Ensure connection for the sender entity
        await this.runtime.ensureConnection({
          entityId,
          roomId: elizaRoomId,
          userName: senderName,
          name: senderName,
          source: 'hyperfy',
          channelId: _currentWorldId || undefined,
          serverId: 'hyperfy',
          type: ChannelType.WORLD,
          worldId: hyperfyWorldId,
          userId: msg.fromId,
        });

        // Create the message memory
        const messageId = createUniqueUuid(this.runtime, msg.id.toString()) as UUID;
        console.debug(`[Hyperfy Chat] Creating memory: ${messageId}`);
        const memory: Memory = {
          id: messageId,
          entityId,
          agentId: this.runtime.agentId,
          roomId: elizaRoomId,
          worldId: hyperfyWorldId,
          content: {
            text: messageBody,
            source: 'hyperfy',
            channelType: ChannelType.WORLD,
            metadata: {
              hyperfyMessageId: msg.id,
              hyperfyFromId: msg.fromId,
              hyperfyFromName: senderName,
            },
          },
          createdAt: Date.now(),
        };

        // Create a callback function to handle responses
        const callback: HandlerCallback = async (responseContent: Content): Promise<Memory[]> => {
          console.info(
            `[Hyperfy Chat Callback] Received response: ${JSON.stringify(responseContent)}`
          );

          console.log(`[Hyperfy Chat Response] ${responseContent}`);
          const emote = responseContent.emote as string;
          // Send response back to Hyperfy
          const emoteManager = service?.getEmoteManager();
          if (emote && emoteManager) {
            emoteManager.playEmote(emote);
          }
          if (responseContent.text) {
            this.sendMessage(responseContent.text);
          }
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

          return [];
        };

        // Ensure the entity actually exists in DB before event emission
        try {
          const entity = await this.runtime.getEntityById(entityId);
          if (!entity) {
            console.warn(
              `[Hyperfy Chat] Entity ${entityId} not found in database after creation, creating directly`
            );
            await this.runtime.createEntity({
              id: entityId,
              names: [senderName],
              agentId: this.runtime.agentId,
              metadata: {
                hyperfy: {
                  id: msg.fromId,
                  username: senderName,
                  name: senderName,
                },
              },
            });
          }
        } catch (error) {
          console.error(`[Hyperfy Chat] Error checking/creating entity: ${error}`);
        }

        // Emit the MESSAGE_RECEIVED event to trigger the message handler
        console.info(`[Hyperfy Chat] Emitting MESSAGE_RECEIVED event for message: ${messageId}`);
        agentActivityLock.enter();
        await this.runtime.emitEvent(hyperfyEventType.MESSAGE_RECEIVED, {
          runtime: this.runtime,
          message: memory,
          callback,
          source: 'hyperfy',
          onComplete: () => {
            agentActivityLock.exit();
          },
        });

        console.info(`[Hyperfy Chat] Successfully emitted event for message: ${messageId}`);
      }
    });
  }

  async sendMessage(text: string): Promise<void> {
    const service = this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
    if (!service) {
      console.error('[MessageManager] Service not available');
      return;
    }

    const world = service.getWorld();
    if (!world || !world.entities?.player?.data?.id) {
      console.error('[MessageManager] World or player not available');
      return;
    }

    const agentPlayerId = world.entities.player.data.id; // Get agent's ID
    const agentPlayerName = world.entities.player.data?.name || 'Hyperliza';

    console.info(
      `HyperfyService sending message: "${text}" as ${agentPlayerName} (${agentPlayerId})`
    );

    if (typeof world.chat.add !== 'function') {
      throw new Error('world.chat.add is not a function');
    }

    const chatMessage: HyperfyChatMessage = {
      id: this.generateId(),
      entityId: agentPlayerId,
      text,
      timestamp: Date.now(),
      from: this.runtime.character.name,
    };

    world.chat.add(chatMessage, true);
  }

  formatMessages({ messages, entities }: { messages: Memory[]; entities: Entity[] }) {
    const messageStrings = messages
      .filter((message: Memory) => message.entityId)
      .reverse()
      .map((message: Memory) => {
        const content = message.content as Content;
        const messageText = content.text || '';
        const messageActions = content.actions;

        const entity = entities.find((e: Entity) => e.id === message.entityId) as any;
        const formattedName = (() => {
          try {
            const parsedData = JSON.parse(entity?.data || '{}');
            const hyperfyData = parsedData.hyperfy || {};
            return (
              hyperfyData.userName ||
              hyperfyData.name ||
              (entity?.names || []).find((n: string) => n.toLowerCase() !== 'anonymous') ||
              'Unknown User'
            );
          } catch (e) {
            return (
              (entity?.names || []).find((n: string) => n.toLowerCase() !== 'anonymous') ||
              'Unknown User'
            );
          }
        })();

        const formattedId = entity ? (entity.data ? JSON.parse(entity.data).hyperfy.id : '') : '';

        const messageTime = message.createdAt ? new Date(message.createdAt) : new Date();
        const hours = messageTime.getHours().toString().padStart(2, '0');
        const minutes = messageTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const timestamp = message.createdAt
          ? formatTimestamp(message.createdAt)
          : formatTimestamp(Date.now()); // assuming this is already defined

        const actionString =
          messageActions && messageActions.length > 0 ? ` (${messageActions.join(', ')})` : '';

        const textPart = messageText ? `: ${messageText}` : '';

        const formattedLine = `- ${timeString} (${timestamp}) ${formattedName} [${formattedId}]${actionString}${textPart}`;

        return formattedLine;
      })
      .filter(Boolean)
      .join('\n');

    return messageStrings;
  }

  async getRecentMessages(roomId: UUID, count = 20) {
    const [entitiesData, recentMessagesData] = await Promise.all([
      // @ts-ignore - getEntityDetails function signature mismatch
      getEntityDetails({ runtime: this.runtime, roomId }),
      this.runtime.getMemories({
        tableName: 'messages',
        roomId,
        count,
        unique: false,
      }),
    ]);
    const formattedHistory = this.formatMessages({
      messages: recentMessagesData,
      // @ts-ignore - entities type mismatch (string vs Entity[])
      entities: entitiesData,
    });

    const lastResponseText =
      recentMessagesData
        .filter(
          (msg) =>
            msg.entityId === this.runtime.agentId &&
            typeof msg.content?.text === 'string' &&
            msg.content.text.trim() !== ''
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.content.text || null;

    const lastActions =
      recentMessagesData
        .filter(
          (msg) =>
            msg.entityId === this.runtime.agentId &&
            Array.isArray(msg.content?.actions) &&
            msg.content.actions.length > 0
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.content.actions || [];

    return {
      formattedHistory,
      lastResponseText,
      lastActions,
    };
  }

  private getService() {
    return this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
  }

  // Private method to generate ID
  private generateId(): string {
    return `entity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
