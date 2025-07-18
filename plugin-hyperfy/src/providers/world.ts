import 'ses';

import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  logger,
  createUniqueUuid,
  type State,
} from '@elizaos/core';
import { HyperfyService } from '../service.js';
import * as THREE from 'three';
// Vector3Enhanced import removed as it doesn't exist

export const hyperfyProvider: Provider = {
  name: 'HYPERFY_WORLD_STATE',
  description:
    'Provides current entity positions/rotations and agent state in the connected Hyperfy world.',
  dynamic: true,
  get: async (runtime: IAgentRuntime, _message: Memory): Promise<ProviderResult> => {
    const currentDate = new Date();
    const timeOptions = {
      timeZone: 'UTC',
      dateStyle: 'full' as const,
      timeStyle: 'long' as const,
    };
    const utcTimeString = new Intl.DateTimeFormat('en-US', timeOptions).format(currentDate);

    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);

    if (!service || !service.isConnected()) {
      return {
        text: '# Hyperfy World State\nConnection Status: Disconnected',
        values: { hyperfy_status: 'disconnected' },
        data: { status: 'disconnected' },
      };
    }

    try {
      const world = service.getWorld();
      const messageManager = service.getMessageManager();
      const _currentWorldId = service.currentWorldId;
      const elizaRoomId = createUniqueUuid(runtime, _currentWorldId || 'hyperfy-unknown-world');
      const entities = world?.entities?.items;
      const agentId = world?.entities?.player?.data?.id;

      const allEntityIds: string[] = [];
      const categorizedEntities: Record<string, string[]> = {};
      let agentText = '## Agent Info (You)\nUnable to find your own entity.';

      if (entities) {
        for (const [id, entity] of entities.entries()) {
          const name = entity?.data?.name || entity?.blueprint?.name || 'Unnamed';
          const type = entity?.data?.type || 'unknown';
          const pos = entity?.base?.position || entity?.root?.position;
          const quat = entity?.base?.quaternion || entity?.root?.quaternion;
          const scale = entity?.base?.scale || entity?.root?.scale;
          const posStr =
            pos && pos instanceof THREE.Vector3
              ? `[${[pos.x, pos.y, pos.z].map((p) => p.toFixed(2)).join(', ')}]`
              : 'N/A';

          const quatStr =
            quat && quat instanceof THREE.Quaternion
              ? `[${[quat.x, quat.y, quat.z, quat.w].map((q) => q.toFixed(4)).join(', ')}]`
              : 'N/A';

          const scaleStr =
            scale && scale instanceof THREE.Vector3
              ? `[${[scale.x, scale.y, scale.z].map((s) => s.toFixed(2)).join(', ')}]`
              : 'N/A';

          if (id === agentId) {
            agentText = `## Agent Info (You)\nEntity ID: ${id}, Name: ${name}, Position: ${posStr}, Quaternion: ${quatStr}`;
            continue;
          }

          allEntityIds.push(id);
          let line = `- Name: ${name}, Entity ID: ${id}, Position: ${posStr}, Quaternion: ${quatStr}`;

          if (type === 'app') {
            line += `, Scale: ${scaleStr}`;
          }

          if (!categorizedEntities[type]) {
            categorizedEntities[type] = [];
          }

          categorizedEntities[type].push(line);
        }
      }

      let categorizedSummary = '';
      for (const [type, lines] of Object.entries(categorizedEntities)) {
        categorizedSummary += `\n\n## ${type[0].toUpperCase() + type.slice(1)} Entities (${lines.length})\n${lines.join('\n')}`;
      }

      const actionsSystem = world?.actions;
      const nearbyActions = (actionsSystem as any)?.getNearby?.(50) || [];
      const currentAction = actionsSystem?.currentNode;

      const actionLines = nearbyActions.map((action: any) => {
        const entity = action.ctx?.entity;
        const pos = entity?.root?.position;
        const posStr =
          pos && pos instanceof THREE.Vector3
            ? `[${[pos.x, pos.y, pos.z].map((p) => p.toFixed(2)).join(', ')}]`
            : 'N/A';

        const label = action._label ?? 'Unnamed Action';
        const entityId = entity?.data?.id ?? 'unknown';
        const entityName = entity?.blueprint?.name ?? 'Unnamed';

        return `- Entity ID: ${entityId}, Entity Name: ${entityName}, Action: ${label}, Position: ${posStr}`;
      });

      const actionHeader = `## Nearby Interactable Objects (${actionLines.length})`;
      const actionBody =
        actionLines.length > 0
          ? actionLines.join('\n')
          : 'There are no interactable objects nearby.';
      const actionText = `${actionHeader}\n${actionBody}`;

      const equipText = currentAction
        ? (() => {
          const entity = currentAction.ctx?.entity;
          const label = currentAction._label ?? 'Unnamed Action';
          const entityId = entity?.data?.id ?? 'unknown';
          const entityName = entity?.blueprint?.name ?? 'Unnamed';
          return `## Your Equipped Item or Action\nYou are currently using:\n- Action: ${label}, Entity Name: ${entityName}, Entity ID: ${entityId}`;
        })()
        : '## Your Equipped Item or Action\nYou are not currently performing or holding anything.';

      const { formattedHistory, lastResponseText, lastActions } =
        // @ts-ignore - messageManager null check
        await messageManager.getRecentMessages(elizaRoomId);

      let chatText = `## In-World Messages\n### Chat History\n${formattedHistory}`;

      const messageText = _message.content?.text?.trim();
      if (messageText) {
        const senderId = _message.entityId;
        const senderEntity = await runtime.getEntityById(senderId);
        const senderName =
          (senderEntity?.metadata?.hyperfy as any)?.username ||
          (senderEntity?.metadata?.hyperfy as any)?.name ||
          (senderEntity?.names || []).find((n: string) => n.toLowerCase() !== 'anonymous') ||
          'Unknown User';

        const receivedMessageSection = [
          '### Received Message',
          `${senderName}: ${messageText}`,
          '\n### Focus your response',
          `You are replying to the above message from **${senderName}**. Keep your answer relevant to that message. Do not repeat earlier replies unless the sender asks again.`,
        ].join('\n');

        chatText += `\n\n${receivedMessageSection}`;
      }

      const agentMemoryText = lastResponseText
        ? `### Your Last Response\n${lastResponseText}\n\n_Do not repeat this unless someone asks again._\n\n### Your Last Action\n${JSON.stringify(lastActions, null, 2)}`
        : `### Your Last Response\nNo recent message.\n\n### Your Last Action\n${JSON.stringify(lastActions, null, 2)}`;

      const formattedText = [
        '# Hyperfy World State',
        `\n## Current UTC Time\n${utcTimeString}`,
        `\n${agentText}`,
        `${categorizedSummary}`,
        `\n${actionText}`,
        `\n${equipText}`,
        `\n${chatText}`,
        `\n${agentMemoryText}`,
      ].join('\n');

      return {
        text: formattedText,
        values: {
          // Simplified values for quick access
          hyperfyStatus: formattedText,
        },
        data: {},
      };
    } catch (error: any) {
      // Add type annotation for error
      logger.error('Error getting Hyperfy state from service:', error);
      return {
        text: '# Hyperfy World State\nStatus: Error retrieving state.',
        values: { hyperfy_status: 'error' },
        data: { status: 'error', error: error.message },
      };
    }
  },
};
