import type { IAgentRuntime } from "@elizaos/core";
import { Player, ClientNetwork } from "@hyperscape/shared";
import { promises as fsPromises } from "fs";
import path from "path";
import { NETWORK_CONFIG } from "../config/constants";
import { EMOTES_LIST } from "../constants";
import { HyperscapeService } from "../service";
import { getModuleDirectory, hashFileBuffer } from "../utils";
// Unused imports removed per linter
const _playerEmotes: Record<string, unknown> = {};
const _emoteMap: Record<string, string> = {};

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
    if (EMOTES_LIST.length === 0) {
      console.info(
        "[EmoteManager] No emotes configured for upload (emotes served via CDN)",
      );
      return;
    }

    for (const emote of EMOTES_LIST) {
      const moduleDirPath = getModuleDirectory();
      const emoteBuffer = await fsPromises.readFile(moduleDirPath + emote.path);
      const emoteMimeType = "model/gltf-binary";

      const emoteHash = await hashFileBuffer(emoteBuffer);
      const emoteExt = emote.path.split(".").pop()!.toLowerCase();
      const emoteFullName = `${emoteHash}.${emoteExt}`;
      const emoteUrl = `asset://${emoteFullName}`;

      console.info(
        `[Appearance] Uploading emote '${emote.name}' as ${emoteFullName} (${(emoteBuffer.length / 1024).toFixed(2)} KB)`,
      );

      const emoteArrayBuffer = emoteBuffer.buffer.slice(
        emoteBuffer.byteOffset,
        emoteBuffer.byteOffset + emoteBuffer.byteLength,
      ) as ArrayBuffer;
      const emoteFile = new File(
        [new Uint8Array(emoteArrayBuffer)],
        path.basename(emote.path),
        {
          type: emoteMimeType,
        },
      );

      const service = this.getService()!;
      const world = service.getWorld()!;
      const network = world.network as ClientNetwork;

      const emoteUploadPromise = network.upload(emoteFile);
      const emoteTimeout = new Promise((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("Upload timed out")),
          NETWORK_CONFIG.UPLOAD_TIMEOUT_MS,
        ),
      );

      await Promise.race([emoteUploadPromise, emoteTimeout]);

      this.emoteHashMap.set(emote.name, emoteFullName);
      console.info(`[Appearance] Emote '${emote.name}' uploaded: ${emoteUrl}`);
    }
  }

  async playEmote(emoteName: string): Promise<void> {
    const service = this.getService()!;
    const world = service.getWorld()!;

    const agentPlayer = world.entities.player as Player;

    // Ensure effect object exists with emote property
    if (!agentPlayer.data) {
      throw new Error("[EmoteManager] Player has no data property");
    }

    // Get duration from EMOTES_LIST (or use default if not found)
    const emoteMeta = EMOTES_LIST.find((e) => e.name === emoteName);
    if (!emoteMeta) {
      console.warn(
        `[EmoteManager] Emote '${emoteName}' not found in EMOTES_LIST (emotes served via CDN)`,
      );
      return;
    }
    const duration = emoteMeta.duration;

    const playerData = agentPlayer.data;
    if (!playerData.effect) {
      playerData.effect = { emote: emoteName };
    } else {
      playerData.effect = { emote: emoteName };
    }

    console.info(`[Emote] Playing '${emoteName}'`);

    this.clearTimers();

    this.movementCheckInterval = setInterval(() => {
      // Check if player is moving (only PlayerLocal/PlayerRemote have moving property)
      const playerWithMovement = agentPlayer as Player & { moving?: boolean };
      if (playerWithMovement.moving) {
        logger.info(
          `[EmoteManager] '${emoteName}' cancelled early due to movement`,
        );
        this.clearEmote(agentPlayer);
      }
    }, 100);

    this.currentEmoteTimeout = setTimeout(() => {
      if (!agentPlayer.data) return;
      const data = agentPlayer.data;
      if (
        data.effect &&
        (data.effect as { emote?: string }).emote === emoteName
      ) {
        logger.info(
          `[EmoteManager] '${emoteName}' finished after ${duration}s`,
        );
        this.clearEmote(agentPlayer);
      }
    }, duration * 1000);
  }

  private clearEmote(player: Player) {
    if (!player.data) return;
    const data = player.data;
    if (data.effect) {
      data.effect = null;
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
    return this.runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
  }
}
