/**
 * ElevenLabs Music Generation Service
 * AI music generation for game soundtracks
 */

import { ElevenLabsClient } from "elevenlabs";

// Music API interface (SDK types may be incomplete)
interface MusicAPI {
  compose: (params: {
    prompt?: string;
    compositionPlan?: Record<string, unknown>;
    modelId?: string;
  }) => Promise<AsyncIterable<Uint8Array>>;
}

export interface GenerateMusicParams {
  prompt?: string;
  musicLengthMs?: number;
  compositionPlan?: Record<string, unknown>;
  forceInstrumental?: boolean;
  respectSectionsDurations?: boolean;
  storeForInpainting?: boolean;
  modelId?: string;
  outputFormat?: string;
}

export interface CreateCompositionPlanParams {
  prompt: string;
  musicLengthMs?: number;
  sourceCompositionPlan?: Record<string, unknown>;
  modelId?: string;
}

export class ElevenLabsMusicService {
  private client: ElevenLabsClient | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ELEVENLABS_API_KEY;
    if (key) {
      this.client = new ElevenLabsClient({ apiKey: key });
    }
  }

  private getMusicAPI(): MusicAPI {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }
    // SDK types may not include music API, but it exists at runtime
    type ClientWithMusic = { music: MusicAPI };
    return (this.client as unknown as ClientWithMusic).music;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateMusic(params: GenerateMusicParams): Promise<Buffer> {
    const musicAPI = this.getMusicAPI();

    const audioStream = await musicAPI.compose({
      prompt: params.prompt,
      compositionPlan: params.compositionPlan,
      modelId: params.modelId || "music_v1",
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async generateMusicDetailed(params: GenerateMusicParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const audioBuffer = await this.generateMusic(params);

    return {
      audio: audioBuffer,
      metadata: {
        prompt: params.prompt,
        modelId: params.modelId || "music_v1",
        lengthMs: params.musicLengthMs,
      },
      format: params.outputFormat || "mp3_44100_128",
    };
  }

  async createCompositionPlan(params: CreateCompositionPlanParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    // Note: The SDK may not have a direct composition plan API
    // This might need to call a different endpoint or method
    // Placeholder implementation
    return {
      prompt: params.prompt,
      musicLengthMs: params.musicLengthMs,
      sections: [
        {
          name: "intro",
          duration: 5000,
          description: "Opening section",
        },
        {
          name: "main",
          duration: params.musicLengthMs ? params.musicLengthMs - 10000 : 50000,
          description: "Main melody",
        },
        {
          name: "outro",
          duration: 5000,
          description: "Closing section",
        },
      ],
      modelId: params.modelId || "music_v1",
    };
  }

  async generateBatch(tracks: GenerateMusicParams[]) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const results = await Promise.allSettled(
      tracks.map(async (track) => {
        const audio = await this.generateMusic(track);
        return {
          success: true,
          audio,
          request: track,
        };
      }),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          success: false,
          audio: null,
          request: tracks[index],
          error: result.reason?.message || "Unknown error",
        };
      }
    });
  }

  getStatus() {
    return {
      available: this.isAvailable(),
      service: "ElevenLabs Music Generation",
      model: "music_v1",
      maxDuration: 300000, // 5 minutes in ms
      formats: ["mp3_44100_128"],
    };
  }
}
