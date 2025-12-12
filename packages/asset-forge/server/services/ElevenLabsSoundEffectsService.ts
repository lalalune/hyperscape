/**
 * ElevenLabs Sound Effects Generation Service
 * Text-to-sound-effects for game audio
 */

import { ElevenLabsClient } from "elevenlabs";

export interface GenerateSfxParams {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
}

export class ElevenLabsSoundEffectsService {
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

  async generateSoundEffect(params: GenerateSfxParams): Promise<Buffer> {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const audioStream = await this.client.textToSoundEffects.convert({
      text: params.text,
      duration_seconds: params.durationSeconds,
      prompt_influence: params.promptInfluence,
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async generateSoundEffectBatch(effects: GenerateSfxParams[]) {
    if (!this.client) {
      throw new Error("ElevenLabs client not initialized");
    }

    const results = await Promise.allSettled(
      effects.map(async (effect, index) => {
        const audioBuffer = await this.generateSoundEffect(effect);
        return {
          index,
          success: true,
          audioBuffer,
          text: effect.text,
          size: audioBuffer.length,
        };
      }),
    );

    const processedResults = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          index,
          success: false,
          text: effects[index].text,
          error: result.reason?.message || "Unknown error",
        };
      }
    });

    return {
      effects: processedResults,
      successful: processedResults.filter((r) => r.success).length,
      total: effects.length,
    };
  }

  estimateCost(duration: number | null) {
    // ElevenLabs SFX pricing (approximate - update with actual rates)
    const baseCost = 0.01; // Base cost per generation
    const durationCost = duration ? duration * 0.002 : 0.02; // Cost per second

    return {
      duration: duration || "auto",
      credits: Math.ceil((baseCost + durationCost) * 100), // Convert to credits
      estimatedCostUSD: (baseCost + durationCost).toFixed(4),
    };
  }
}
