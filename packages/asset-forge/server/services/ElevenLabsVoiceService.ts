/**
 * ElevenLabs Voice Generation Service
 * Text-to-speech integration for NPC dialogue
 */

import { ElevenLabsClient } from "elevenlabs";

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface GenerateVoiceParams {
  text: string;
  voiceId: string;
  npcId?: string;
  settings?: VoiceSettings;
}

export interface BatchVoiceParams {
  texts: string[];
  voiceId: string;
  npcId?: string;
  settings?: VoiceSettings;
}

export interface SpeechToSpeechParams {
  audio: Buffer;
  voiceId: string;
  modelId?: string;
  outputFormat?: string;
  stability?: number;
  similarityBoost?: number;
  removeBackgroundNoise?: boolean;
  seed?: number;
}

export interface DesignVoiceParams {
  voiceDescription: string;
  modelId?: string;
  text?: string;
  autoGenerateText?: boolean;
  loudness?: number;
  seed?: number;
  guidanceScale?: number;
  outputFormat?: string;
}

export interface CreateVoiceFromPreviewParams {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
  labels?: Record<string, string>;
  playedNotSelectedVoiceIds?: string[];
}

export class ElevenLabsVoiceService {
  private client: ElevenLabsClient | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ELEVENLABS_API_KEY;
    if (key) {
      this.client = new ElevenLabsClient({ apiKey: key });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async getAvailableVoices() {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const response = await this.client.voices.getAll();
    return response.voices || [];
  }

  async generateVoice(params: GenerateVoiceParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const audioStream = await this.client.textToSpeech.convert(params.voiceId, {
      text: params.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: params.settings
        ? {
            stability: params.settings.stability,
            similarity_boost: params.settings.similarity_boost,
            style: params.settings.style,
            use_speaker_boost: params.settings.use_speaker_boost,
          }
        : undefined,
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      success: true,
      audioData: buffer.toString("base64"),
      npcId: params.npcId,
    };
  }

  async generateVoiceBatch(params: BatchVoiceParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const results = await Promise.allSettled(
      params.texts.map(async (text) => {
        const audioStream = await this.client!.textToSpeech.convert(
          params.voiceId,
          {
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: params.settings
              ? {
                  stability: params.settings.stability,
                  similarity_boost: params.settings.similarity_boost,
                  style: params.settings.style,
                  use_speaker_boost: params.settings.use_speaker_boost,
                }
              : undefined,
          },
        );

        const chunks: Uint8Array[] = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        return {
          success: true,
          audioData: buffer.toString("base64"),
          text,
        };
      }),
    );

    const processedResults = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          success: false,
          text: params.texts[index],
          error: result.reason?.message || "Unknown error",
        };
      }
    });

    return {
      successful: processedResults.filter((r) => r.success).length,
      total: params.texts.length,
      results: processedResults,
    };
  }

  async getSubscriptionInfo() {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    return await this.client.user.getSubscription();
  }

  async getAvailableModels() {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    // The SDK doesn't have a direct models endpoint, return commonly used models
    return [
      {
        model_id: "eleven_multilingual_v2",
        name: "Multilingual v2",
        description: "High quality multilingual model",
      },
      {
        model_id: "eleven_monolingual_v1",
        name: "Monolingual v1",
        description: "English-only model",
      },
      {
        model_id: "eleven_turbo_v2",
        name: "Turbo v2",
        description: "Fast, low-latency model",
      },
    ];
  }

  async speechToSpeech(params: SpeechToSpeechParams): Promise<Buffer> {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    // Note: The elevenlabs SDK may have different method names
    // This is a placeholder - check the actual SDK documentation
    throw new Error("Speech-to-speech not yet implemented in this service");
  }

  async designVoice(params: DesignVoiceParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    // Note: Voice design API may have different structure
    // This is a placeholder - check the actual SDK documentation
    throw new Error("Voice design not yet implemented in this service");
  }

  async createVoiceFromPreview(params: CreateVoiceFromPreviewParams) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    // Note: This API may have different structure
    // This is a placeholder - check the actual SDK documentation
    throw new Error(
      "Create voice from preview not yet implemented in this service",
    );
  }

  estimateCost(texts: string[], settings?: VoiceSettings) {
    // Calculate total character count
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);

    // ElevenLabs pricing (approximate - update with actual rates)
    const costPerCharacter = 0.00003; // $0.30 per 10k characters

    return {
      characterCount: totalChars,
      estimatedCostUSD: (totalChars * costPerCharacter).toFixed(4),
      texts: texts.length,
    };
  }

  getRateLimitInfo() {
    // This would need to track actual rate limits from API responses
    return {
      requestsRemaining: "unknown",
      resetTime: "unknown",
      message: "Rate limit info requires tracking API response headers",
    };
  }
}
