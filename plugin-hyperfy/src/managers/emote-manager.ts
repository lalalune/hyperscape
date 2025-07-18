import fs from 'fs/promises';
import path from 'path';
import { EMOTES_LIST } from '../constants.js';
import { playerEmotes, emoteMap } from '../hyperfy/core/extras/playerEmotes.js';
import { hashFileBuffer, getModuleDirectory } from '../utils.js';
import type { IAgentRuntime } from '@elizaos/core';
import type { HyperfyWorld, HyperfyPlayer } from '../types/hyperfy.js';
import { HyperfyService } from '../service.js';

const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

export class EmoteManager {
  private emoteHashMap: Map<string, string>;
  private currentEmoteTimeout: NodeJS.Timeout | null;
  private movementCheckInterval: NodeJS.Timeout | null = null;
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.emoteHashMap = new Map();
    this.currentEmoteTimeout = null;
  }

  async uploadEmotes() {
    for (const emote of EMOTES_LIST) {
      try {
        const moduleDirPath = getModuleDirectory();
        const emoteBuffer = await fs.readFile(moduleDirPath + emote.path);
        const emoteMimeType = 'model/gltf-binary';

        const emoteHash = await hashFileBuffer(emoteBuffer);
        const emoteExt = emote.path.split('.').pop()?.toLowerCase() || 'glb';
        const emoteFullName = `${emoteHash}.${emoteExt}`;
        const emoteUrl = `asset://${emoteFullName}`;

        console.info(
          `[Appearance] Uploading emote '${emote.name}' as ${emoteFullName} (${(emoteBuffer.length / 1024).toFixed(2)} KB)`
        );

        const emoteFile = new File([emoteBuffer], path.basename(emote.path), {
          type: emoteMimeType,
        });

        const service = this.getService();
        if (!service) {
          console.error(
            `[Appearance] Failed to upload emote '${emote.name}': Service not available`
          );
          continue;
        }
        const world = service.getWorld();
        if (!world) {
          console.error(`[Appearance] Failed to upload emote '${emote.name}': World not available`);
          continue;
        }
        const emoteUploadPromise = world.network.upload(emoteFile);
        const emoteTimeout = new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('Upload timed out')), 30000)
        );

        await Promise.race([emoteUploadPromise, emoteTimeout]);

        this.emoteHashMap.set(emote.name, emoteFullName);
        console.info(`[Appearance] Emote '${emote.name}' uploaded: ${emoteUrl}`);
      } catch (err: any) {
        console.error(
          `[Appearance] Failed to upload emote '${emote.name}': ${err.message}`,
          err.stack
        );
      }
    }
  }

  async playEmote(emoteName: string): Promise<void> {
    const service = this.getService();
    if (!service) {
      console.error('HyperfyService: Cannot play emote. Service not available.');
      return;
    }
    const world = service.getWorld();
    if (!service.isConnected() || !world?.entities?.player) {
      console.error('HyperfyService: Cannot play emote. Not ready.');
      return;
    }

    const agentPlayer = world.entities.player;
    // Ensure effect object exists with emote property
    if (!agentPlayer.data.effect) {
      agentPlayer.data.effect = { emote: emoteName };
    } else {
      agentPlayer.data.effect.emote = emoteName;
    }

    console.info(`[Emote] Playing '${emoteName}'`);

    this.clearTimers();

    // Get duration from EMOTES_LIST
    const emoteMeta = EMOTES_LIST.find((e) => e.name === emoteName);
    const duration = emoteMeta?.duration || 1.5;

    this.movementCheckInterval = setInterval(() => {
      if (agentPlayer.moving) {
        logger.info(`[EmoteManager] '${emoteName}' cancelled early due to movement`);
        this.clearEmote(agentPlayer);
      }
    }, 100);

    this.currentEmoteTimeout = setTimeout(() => {
      if (agentPlayer.data.effect && agentPlayer.data.effect.emote === emoteName) {
        logger.info(`[EmoteManager] '${emoteName}' finished after ${duration}s`);
        this.clearEmote(agentPlayer);
      }
    }, duration * 1000);
  }

  private clearEmote(player: HyperfyPlayer) {
    if (player.data?.effect) {
      player.data.effect.emote = null;
    }
    this.clearTimers();
  }

  private clearTimers() {
    if (this.currentEmoteTimeout) {
      clearTimeout(this.currentEmoteTimeout);
      this.currentEmoteTimeout = null;
    }
    if (this.movementCheckInterval) {
      clearInterval(this.movementCheckInterval);
      this.movementCheckInterval = null;
    }
  }

  private getService() {
    return this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
  }
}
