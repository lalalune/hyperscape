/**
 * AI SDK Service
 * Provides configured language models from Vercel AI SDK
 * Supports Cloudflare AI Gateway routing
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type ModelQuality = "quality" | "speed" | "balanced";

interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
}

/**
 * AI SDK Service for providing configured language models
 */
class AISDKService {
  private openai: ReturnType<typeof createOpenAI>;
  private modelConfigs: Record<ModelQuality, ModelConfig>;

  constructor() {
    // Initialize OpenAI client with AI Gateway if available
    const useAIGateway = !!process.env.AI_GATEWAY_API_KEY;
    const apiKey = useAIGateway
      ? process.env.AI_GATEWAY_API_KEY!
      : process.env.OPENAI_API_KEY!;

    if (!apiKey) {
      throw new Error(
        "AI_GATEWAY_API_KEY or OPENAI_API_KEY required for AI SDK Service",
      );
    }

    this.openai = createOpenAI({
      apiKey,
      baseURL: useAIGateway
        ? "https://ai-gateway.vercel.sh/v1"
        : "https://api.openai.com/v1",
    });

    // Model configurations for different quality levels
    this.modelConfigs = {
      quality: {
        provider: "openai",
        model: useAIGateway ? "openai/gpt-4o" : "gpt-4o",
        temperature: 0.7,
      },
      speed: {
        provider: "openai",
        model: useAIGateway ? "openai/gpt-4o-mini" : "gpt-4o-mini",
        temperature: 0.7,
      },
      balanced: {
        provider: "openai",
        model: useAIGateway ? "openai/gpt-4o" : "gpt-4o",
        temperature: 0.5,
      },
    };

    console.log(
      `[AISDKService] Initialized with ${useAIGateway ? "AI Gateway" : "direct OpenAI"}`,
    );
  }

  /**
   * Get a configured language model
   */
  async getConfiguredModel(
    quality: ModelQuality = "balanced",
  ): Promise<LanguageModel> {
    const config = this.modelConfigs[quality];

    if (!config) {
      throw new Error(`Unknown model quality: ${quality}`);
    }

    // Return the configured model (temperature applied during generation)
    return this.openai(config.model);
  }

  /**
   * Get model configuration for a quality level
   */
  getModelConfig(quality: ModelQuality): ModelConfig {
    return this.modelConfigs[quality];
  }
}

// Export singleton instance
export const aiSDKService = new AISDKService();
