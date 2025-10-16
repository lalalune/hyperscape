import { VOICE_CONFIG } from "../config/constants";
import {
  ChannelType,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelType,
  UUID,
  createUniqueUuid,
  logger,
} from "@elizaos/core";
import { HyperscapeService } from "../service";
import { convertToAudioBuffer } from "../utils";

// Local implementation of getWavHeader
function getWavHeader(
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  dataLength: number,
): Buffer {
  const header = Buffer.alloc(44);

  // "RIFF" chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28); // ByteRate
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}
import { agentActivityLock } from "./guards";
import { hyperscapeEventType } from "../events";

type LiveKitAudioData = {
  participant: string;
  buffer: Buffer;
};

export class VoiceManager {
  private runtime: IAgentRuntime;
  private userStates: Map<
    string,
    {
      buffers: Buffer[];
      totalLength: number;
      lastActive: number;
      transcriptionText: string;
    }
  > = new Map();
  private processingVoice: boolean = false;
  private transcriptionTimeout: NodeJS.Timeout | null = null;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  start() {
    const service = this.getService();
    if (!service) {
      console.error("[VoiceManager] Service not available");
      return;
    }

    const world = service.getWorld();
    if (!world || !world.livekit) {
      console.error("[VoiceManager] World or LiveKit not available");
      return;
    }

    world.livekit?.on("audio", async (data: LiveKitAudioData) => {
      function isLoudEnough(pcmBuffer: Buffer, threshold = 1000): boolean {
        let sum = 0;
        const sampleCount = Math.floor(pcmBuffer.length / 2); // 16-bit samples

        for (let i = 0; i < pcmBuffer.length; i += 2) {
          const sample = pcmBuffer.readInt16LE(i);
          sum += Math.abs(sample);
        }

        const avgAmplitude = sum / sampleCount;
        return avgAmplitude > threshold;
      }

      const playerId = data.participant;
      if (!this.userStates.has(playerId)) {
        this.userStates.set(playerId, {
          buffers: [],
          totalLength: 0,
          lastActive: Date.now(),
          transcriptionText: "",
        });
      }

      const pcmBuffer = data.buffer;
      if (isLoudEnough(pcmBuffer)) {
        this.handleUserBuffer(playerId, pcmBuffer);
      }
    });
  }

  async handleUserBuffer(playerId: string, buffer: Buffer) {
    const state = this.userStates.get(playerId)!;

    state.buffers.push(buffer);
    state.totalLength += buffer.length;
    state.lastActive = Date.now();
    this.debouncedProcessTranscription(playerId as UUID);
  }

  async debouncedProcessTranscription(playerId: UUID) {
    const DEBOUNCE_TRANSCRIPTION_THRESHOLD =
      VOICE_CONFIG.TRANSCRIPTION_DEBOUNCE_MS;

    if (this.processingVoice) {
      const state = this.userStates.get(playerId);
      if (state) {
        state.buffers.length = 0;
        state.totalLength = 0;
      }
      return;
    }

    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
    }

    this.transcriptionTimeout = setTimeout(async () => {
      await agentActivityLock.run(async () => {
        this.processingVoice = true;
        try {
          await this.processTranscription(playerId);

          // Clean all users' previous buffers
          this.userStates.forEach((state, _) => {
            state.buffers.length = 0;
            state.totalLength = 0;
            state.transcriptionText = "";
          });
        } finally {
          this.processingVoice = false;
        }
      });
    }, DEBOUNCE_TRANSCRIPTION_THRESHOLD) as NodeJS.Timeout;
  }

  private async processTranscription(playerId: UUID) {
    const state = this.userStates.get(playerId)!;
    if (state.buffers.length === 0) {
      return;
    }

    const inputBuffer = Buffer.concat(state.buffers, state.totalLength);

    state.buffers.length = 0; // Clear the buffers
    state.totalLength = 0;
    // Convert Opus to WAV
    const sampleRate = VOICE_CONFIG.SAMPLE_RATE;
    const numChannels = 1;
    const bitsPerSample = 16;
    const wavHeader = getWavHeader(
      sampleRate,
      numChannels,
      bitsPerSample,
      inputBuffer.length,
    );
    const wavBuffer = Buffer.concat([wavHeader, inputBuffer]);
    logger.debug("Starting transcription...");

    const transcriptionText = await this.runtime.useModel(
      ModelType.TRANSCRIPTION,
      wavBuffer,
    );

    function isValidTranscription(text: string): boolean {
      if (!text || text.includes("[BLANK_AUDIO]")) {
        return false;
      }
      return true;
    }

    if (isValidTranscription(transcriptionText as string)) {
      state.transcriptionText += transcriptionText;
    }

    if (state.transcriptionText.length) {
      const finalText = state.transcriptionText;
      state.transcriptionText = "";
      await this.handleMessage(finalText, playerId);
    }
  }

  private async handleMessage(message: string, playerId: UUID) {
    if (!message || message.trim() === "" || message.length < 3) {
      return { text: "", actions: ["IGNORE"] };
    }

    const service = this.getService()!;
    const world = service.getWorld()!;
    const playerInfo = world.entities.getPlayer(playerId)!;

    const userName = playerInfo.data.name;
    const name = userName;
    const _currentWorldId = service.currentWorldId!;
    const channelId = _currentWorldId;
    const roomId = createUniqueUuid(this.runtime, _currentWorldId);
    const entityId = createUniqueUuid(this.runtime, playerId) as UUID;

    const type = ChannelType.WORLD;

    // Ensure connection for the sender entity
    await this.runtime.ensureConnection({
      entityId,
      roomId,
      userName,
      name,
      source: "hyperscape",
      channelId,
      serverId: "hyperscape",
      type: ChannelType.WORLD,
      worldId: _currentWorldId,
      userId: playerId,
    });

    const memory: Memory = {
      id: createUniqueUuid(
        this.runtime,
        `${channelId}-voice-message-${Date.now()}`,
      ),
      agentId: this.runtime.agentId,
      entityId,
      roomId,
      content: {
        text: message,
        source: "hyperscape",
        name,
        userName,
        isVoiceMessage: true,
        channelType: type,
      },
      createdAt: Date.now(),
    };

    const callback: HandlerCallback = async (
      content: Content,
      _files: File[] = [],
    ) => {
      console.info(
        `[Hyperscape Voice Chat Callback] Received response: ${JSON.stringify(content)}`,
      );
      const responseMemory: Memory = {
        id: createUniqueUuid(
          this.runtime,
          `${memory.id}-voice-response-${Date.now()}`,
        ),
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        content: {
          ...content,
          name: this.runtime.character.name,
          inReplyTo: memory.id,
          isVoiceMessage: true,
          channelType: type,
        },
        roomId,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(responseMemory, "messages");

      if (responseMemory.content.text?.trim()) {
        const responseStream = await this.runtime.useModel(
          ModelType.TEXT_TO_SPEECH,
          content.text,
        );
        const audioBuffer = await convertToAudioBuffer(responseStream);
        const emoteManager = service.getEmoteManager()!;
        const emote = (content.emote as string) || "TALK";
        emoteManager.playEmote(emote);
        await this.playAudio(audioBuffer);
      }

      return [responseMemory];
    };

    agentActivityLock.enter();
    // Emit voice-specific events
    this.runtime.emitEvent([hyperscapeEventType.VOICE_MESSAGE_RECEIVED], {
      runtime: this.runtime,
      message: memory,
      callback,
      onComplete: () => {
        agentActivityLock.exit();
      },
    });
  }

  async playAudio(audioBuffer: Buffer) {
    if (this.processingVoice) {
      logger.info("[VOICE MANAER] Current voice is processing.....");
      return;
    }

    const service = this.getService()!;
    const world = service.getWorld()!;

    this.processingVoice = true;

    // Audio publishing requires LiveKit API integration (future enhancement)
      "[VoiceManager] Audio playback requested but not implemented yet",
    );

    this.processingVoice = false;
  }

  private getService() {
    return this.runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
  }
}
