// Vercel AI Gateway Plugin for ElizaOS
// Based on @elizaos/plugin-openai but configured to use Vercel's AI Gateway

import { createOpenAI } from "@ai-sdk/openai";
import {
  EventType,
  logger,
  ModelType,
  type Plugin,
  type Runtime,
} from "@elizaos/core";
import {
  generateObject,
  generateText,
  JSONParseError,
  type LanguageModelUsage,
} from "ai";
import { encodingForModel } from "js-tiktoken";

// ============================================================================
// Type Definitions
// ============================================================================

export interface TranscriptionParams {
  audio: Blob | File;
  model?: string;
  language?: string;
  response_format?: string;
  prompt?: string;
  temperature?: number;
  timestampGranularities?: string[];
}

export interface TextToSpeechParams {
  text: string;
  model?: string;
  voice?: string;
  format?: "mp3" | "wav" | "flac" | string;
  instructions?: string;
}

// ============================================================================
// Configuration Helper Functions
// ============================================================================

function getSetting(runtime: Runtime, key: string, defaultValue?: string): string | undefined {
  return runtime.getSetting(key) ?? process.env[key] ?? defaultValue;
}

function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && typeof globalThis.document !== "undefined";
}

function getAuthHeader(runtime: Runtime): Record<string, string> {
  if (isBrowser()) {
    return {};
  }

  // Vercel AI Gateway supports both API keys and OIDC tokens
  const apiKey = getSetting(runtime, "AI_GATEWAY_API_KEY") || getSetting(runtime, "VERCEL_OIDC_TOKEN");
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function getBaseURL(runtime: Runtime): string {
  // Default to Vercel AI Gateway
  const baseURL = getSetting(runtime, "AI_GATEWAY_BASE_URL", "https://ai-gateway.vercel.sh/v1");
  logger.debug(`[Vercel AI Gateway] Base URL: ${baseURL}`);
  return baseURL;
}

function getApiKey(runtime: Runtime): string | undefined {
  // Try AI Gateway key first, then fall back to OIDC token
  return getSetting(runtime, "AI_GATEWAY_API_KEY") || getSetting(runtime, "VERCEL_OIDC_TOKEN");
}

function getSmallModel(runtime: Runtime): string {
  return getSetting(runtime, "AI_GATEWAY_SMALL_MODEL") ?? getSetting(runtime, "SMALL_MODEL", "gpt-4o-mini");
}

function getLargeModel(runtime: Runtime): string {
  return getSetting(runtime, "AI_GATEWAY_LARGE_MODEL") ?? getSetting(runtime, "LARGE_MODEL", "gpt-4o");
}

function getImageDescriptionModel(runtime: Runtime): string {
  return getSetting(runtime, "AI_GATEWAY_IMAGE_DESCRIPTION_MODEL", "gpt-4o-mini") ?? "gpt-4o-mini";
}

function getExperimentalTelemetry(runtime: Runtime): boolean {
  const setting = getSetting(runtime, "AI_GATEWAY_EXPERIMENTAL_TELEMETRY", "false");
  const normalizedSetting = String(setting).toLowerCase();
  const result = normalizedSetting === "true";
  logger.debug(
    `[Vercel AI Gateway] Experimental telemetry: "${setting}" (normalized: "${normalizedSetting}", result: ${result})`
  );
  return result;
}

// ============================================================================
// Client Creation
// ============================================================================

function createVercelAIGatewayClient(runtime: Runtime) {
  const baseURL = getBaseURL(runtime);
  const apiKey = getApiKey(runtime) ?? "";

  logger.debug(`[Vercel AI Gateway] Creating client with baseURL: ${baseURL}`);

  return createOpenAI({
    apiKey,
    baseURL,
    // Vercel AI Gateway is OpenAI-compatible
    compatibility: "strict"
  });
}

// ============================================================================
// Tokenization
// ============================================================================

async function tokenizeText(model: ModelType, prompt: string): Promise<Uint32Array> {
  const modelName =
    model === ModelType.TEXT_SMALL
      ? process.env.AI_GATEWAY_SMALL_MODEL ?? process.env.SMALL_MODEL ?? "gpt-4o-mini"
      : process.env.AI_GATEWAY_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";

  const tokens = encodingForModel(modelName as any).encode(prompt);
  return tokens;
}

async function detokenizeText(model: ModelType, tokens: Uint32Array): Promise<string> {
  const modelName =
    model === ModelType.TEXT_SMALL
      ? process.env.AI_GATEWAY_SMALL_MODEL ?? process.env.SMALL_MODEL ?? "gpt-4o-mini"
      : process.env.AI_GATEWAY_LARGE_MODEL ?? process.env.LARGE_MODEL ?? "gpt-4o";

  return encodingForModel(modelName as any).decode(tokens);
}

// ============================================================================
// Object Generation
// ============================================================================

async function generateObjectByModelType(
  runtime: Runtime,
  params: any,
  modelType: string,
  getModelFn: (runtime: Runtime) => string
): Promise<any> {
  const client = createVercelAIGatewayClient(runtime);
  const modelName = getModelFn(runtime);

  logger.log(`[Vercel AI Gateway] Using ${modelType} model: ${modelName}`);

  const temperature = params.temperature ?? 0;
  const schemaPresent = !!params.schema;

  // Use generateText when no schema is provided (ElizaOS standard behavior)
  // This avoids the /responses endpoint which doesn't exist on Vercel AI Gateway
  try {
    const { text, usage } = await generateText({
      model: client.languageModel(modelName),
      prompt: params.prompt,
      temperature,
    });

    if (usage) {
      emitModelUsageEvent(runtime, modelType, params.prompt, usage);
    }

    // Return the raw text response (ElizaOS will parse it as needed)
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[generateText] Error: ${message}`);
    throw error;
  }
}

function getJsonRepairFunction() {
  return async ({ text, error }: { text: string; error: Error }) => {
    try {
      if (error instanceof JSONParseError) {
        const cleanedText = text.replace(/```json\n|\n```|```/g, "");
        JSON.parse(cleanedText);
        return cleanedText;
      }
      return null;
    } catch (jsonError) {
      const message = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.warn(`Failed to repair JSON text: ${message}`);
      return null;
    }
  };
}

function emitModelUsageEvent(
  runtime: Runtime,
  type: string,
  prompt: string,
  usage: LanguageModelUsage
) {
  runtime.emitEvent(EventType.MODEL_USED, {
    provider: "vercel-ai-gateway",
    type,
    prompt,
    tokens: {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
    },
  });
}

// ============================================================================
// Text-to-Speech
// ============================================================================

async function fetchTextToSpeech(runtime: Runtime, options: TextToSpeechParams): Promise<ReadableStream | null> {
  const defaultModel = getSetting(runtime, "AI_GATEWAY_TTS_MODEL", "tts-1");
  const defaultVoice = getSetting(runtime, "AI_GATEWAY_TTS_VOICE", "nova");
  const defaultInstructions = getSetting(runtime, "AI_GATEWAY_TTS_INSTRUCTIONS", "");
  const baseURL = getBaseURL(runtime);

  const model = options.model || defaultModel;
  const voice = options.voice || defaultVoice;
  const instructions = options.instructions ?? defaultInstructions;
  const format = options.format || "mp3";

  try {
    const res = await fetch(`${baseURL}/audio/speech`, {
      method: "POST",
      headers: {
        ...getAuthHeader(runtime),
        "Content-Type": "application/json",
        ...(format === "mp3" ? { Accept: "audio/mpeg" } : {}),
      },
      body: JSON.stringify({
        model,
        voice,
        input: options.text,
        format,
        ...(instructions && { instructions }),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vercel AI Gateway TTS error ${res.status}: ${err}`);
    }

    return res.body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch speech from Vercel AI Gateway: ${message}`);
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

export const vercelAIGatewayPlugin: Plugin = {
  name: "vercel-ai-gateway",
  description: "Vercel AI Gateway plugin - route AI requests through Vercel's AI Gateway",
  config: {
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
    AI_GATEWAY_SMALL_MODEL: process.env.AI_GATEWAY_SMALL_MODEL || "gpt-4o-mini",
    AI_GATEWAY_LARGE_MODEL: process.env.AI_GATEWAY_LARGE_MODEL || "gpt-4o",
    AI_GATEWAY_IMAGE_DESCRIPTION_MODEL: process.env.AI_GATEWAY_IMAGE_DESCRIPTION_MODEL || "gpt-4o-mini",
    AI_GATEWAY_EXPERIMENTAL_TELEMETRY: process.env.AI_GATEWAY_EXPERIMENTAL_TELEMETRY || "false",
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
  },
  models: {
    [ModelType.TEXT_SMALL]: async (runtime: Runtime, params: any) => {
      return generateObjectByModelType(runtime, params, "TEXT_SMALL", getSmallModel);
    },
    [ModelType.TEXT_LARGE]: async (runtime: Runtime, params: any) => {
      return generateObjectByModelType(runtime, params, "TEXT_LARGE", getLargeModel);
    },
    [ModelType.TEXT_EMBEDDING]: async (runtime: Runtime, params: any) => {
      const baseURL = getBaseURL(runtime);
      const embeddingModel = getSetting(runtime, "AI_GATEWAY_EMBEDDING_MODEL", "text-embedding-3-small");

      // Handle null params for initialization
      if (params === null) {
        logger.debug("Creating test embedding for initialization");
        const embeddingDimension = 1536; // Default dimension for text-embedding-3-small
        const testVector = Array(embeddingDimension).fill(0);
        testVector[0] = 0.1;
        return testVector;
      }

      // Extract text from params
      let text: string;
      if (typeof params === "string") {
        text = params;
      } else if (typeof params === "object" && params.text) {
        text = params.text;
      } else {
        logger.warn("Invalid input format for embedding");
        const embeddingDimension = 1536;
        const fallbackVector = Array(embeddingDimension).fill(0);
        fallbackVector[0] = 0.2;
        return fallbackVector;
      }

      if (!text.trim()) {
        logger.warn("Empty text for embedding");
        const embeddingDimension = 1536;
        const emptyVector = Array(embeddingDimension).fill(0);
        emptyVector[0] = 0.3;
        return emptyVector;
      }

      try {
        const res = await fetch(`${baseURL}/embeddings`, {
          method: "POST",
          headers: {
            ...getAuthHeader(runtime),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: embeddingModel,
            input: text,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Embedding error ${res.status}: ${err}`);
        }

        const data = await res.json();

        if (data.usage) {
          runtime.emitEvent(EventType.MODEL_USED, {
            provider: "vercel-ai-gateway",
            type: ModelType.TEXT_EMBEDDING,
            prompt: text,
            tokens: {
              prompt: data.usage.prompt_tokens,
              completion: 0,
              total: data.usage.total_tokens,
            },
          });
        }

        return data.data[0].embedding;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to fetch embeddings: ${message}`);
      }
    },
    [ModelType.IMAGE]: async (runtime: Runtime, params: any) => {
      const baseURL = getBaseURL(runtime);
      const imageModel = getSetting(runtime, "AI_GATEWAY_IMAGE_MODEL", "dall-e-3");

      try {
        const res = await fetch(`${baseURL}/images/generations`, {
          method: "POST",
          headers: {
            ...getAuthHeader(runtime),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: imageModel,
            prompt: params.prompt,
            n: params.n || 1,
            size: params.size || "1024x1024",
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Image generation error ${res.status}: ${err}`);
        }

        const data = await res.json() as any;
        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to generate image: ${message}`);
      }
    },
    [ModelType.IMAGE_DESCRIPTION]: async (runtime: Runtime, params: any) => {
      const client = createVercelAIGatewayClient(runtime);
      const modelName = getImageDescriptionModel(runtime);
      const maxTokens = parseInt(
        getSetting(runtime, "AI_GATEWAY_IMAGE_DESCRIPTION_MAX_TOKENS", "8192") ?? "8192"
      );

      let imageUrl: string;
      let promptText: string;

      if (typeof params === "string") {
        imageUrl = params;
        promptText = "Describe this image in detail:";
      } else {
        imageUrl = params.imageUrl;
        promptText = params.prompt || "Describe this image in detail:";
      }

      try {
        const { text } = await generateText({
          model: client.languageModel(modelName),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image", image: imageUrl },
              ],
            },
          ],
          maxTokens: maxTokens,
        } as any);

        return {
          title: text.split("\n")[0],
          description: text,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to describe image: ${message}`);
      }
    },
    [ModelType.TRANSCRIPTION]: async (runtime: Runtime, audio: Blob) => {
      const baseURL = getBaseURL(runtime);
      const transcriptionModel = getSetting(runtime, "AI_GATEWAY_TRANSCRIPTION_MODEL", "whisper-1");

      const formData = new FormData();
      formData.append("file", audio);
      formData.append("model", transcriptionModel ?? "whisper-1");

      try {
        const res = await fetch(`${baseURL}/audio/transcriptions`, {
          method: "POST",
          headers: getAuthHeader(runtime),
          body: formData,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Transcription error ${res.status}: ${err}`);
        }

        const data = await res.json() as any;
        return data.text;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to transcribe audio: ${message}`);
      }
    },
    [ModelType.TEXT_TO_SPEECH]: async (runtime: Runtime, options: TextToSpeechParams | string) => {
      const opts = typeof options === "string" ? { text: options } : options;
      return fetchTextToSpeech(runtime, opts);
    },
    [ModelType.TEXT_TOKENIZER_ENCODE]: async (_runtime: Runtime, params: { model?: ModelType; text?: string; prompt?: string }) => {
      const text = params.text || params.prompt || "";
      const model = params.model || ModelType.TEXT_LARGE;
      return tokenizeText(model, text);
    },
    [ModelType.TEXT_TOKENIZER_DECODE]: async (_runtime: Runtime, params: { model?: ModelType; tokens: Uint32Array; modelType?: ModelType }) => {
      const model = params.model || params.modelType || ModelType.TEXT_LARGE;
      return detokenizeText(model, params.tokens);
    },
  },
};

export default vercelAIGatewayPlugin;
