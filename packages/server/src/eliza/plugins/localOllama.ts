/**
 * Local Ollama plugin shim for AI SDK v5 compatibility.
 *
 * Replaces `@elizaos/plugin-ollama@2.0.0-alpha.70` which bundles
 * `ollama-ai-provider@^1.2.0` (implements AI SDK spec v1). Our server
 * uses `ai@^6.0.97` which is AI SDK v5 and requires spec v2 models.
 * Loading the upstream plugin succeeds at import time but every model
 * call fails at runtime with:
 *
 *   Unsupported model version v1 for provider "ollama.chat"
 *   Unsupported model version v1 for provider "ollama.embedding"
 *
 * This shim re-implements the same Plugin surface using
 * `ollama-ai-provider-v2@^3.5.0` which implements spec v2 and is
 * peer-compatible with `ai@^6.0.0`. Drop this file (and revert the
 * import-path change in AgentManager.ts) once upstream plugin-ollama
 * ships a v2-compatible alpha.
 *
 * Interface parity: the exported `ollamaPlugin` matches the shape of
 * `@elizaos/plugin-ollama@2.0.0-alpha.70`'s `ollamaPlugin` (name,
 * description, config, init, models.{TEXT_EMBEDDING,TEXT_SMALL,
 * TEXT_LARGE,OBJECT_SMALL,OBJECT_LARGE}), so dropping this in via
 * AgentManager with the same provider record is transparent to the
 * ElizaOS runtime.
 */

import {
  ModelType,
  type IAgentRuntime,
  type JsonValue,
  type Plugin,
} from "@elizaos/core";
import type { JSONObject } from "@ai-sdk/provider";
import { embed, generateObject, generateText } from "ai";
import { createOllama, type OllamaProvider } from "ollama-ai-provider-v2";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_SMALL_MODEL = "gemma3:latest";
const DEFAULT_LARGE_MODEL = "gemma3:latest";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text:latest";

// 1536 is the OpenAI-style embedding size used as the error-path default by
// @elizaos/plugin-ollama. Keep it so downstream code that assumes a fixed
// length on the error path (e.g. vector DB inserts) does not break.
const EMBEDDING_ERROR_FALLBACK_SIZE = 1536;

// Rough char→token ratio (4 chars ≈ 1 token). Used to truncate embedding
// input to the 8k-token context most local embedding models expect.
const CHARS_PER_TOKEN_ESTIMATE = 4;
const MAX_EMBEDDING_TOKENS = 8000;

function getEnvValue(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const v = process.env[key];
  return v === undefined ? undefined : String(v);
}

function getSetting(
  runtime: IAgentRuntime,
  key: string,
  defaultValue?: string,
): string | undefined {
  const v = runtime.getSetting(key);
  if (v !== undefined && v !== null) return String(v);
  return getEnvValue(key) ?? defaultValue;
}

/**
 * Base URL including `/api` suffix — matches the convention used by
 * `@elizaos/plugin-ollama`, so values in OLLAMA_API_ENDPOINT work
 * unchanged when switching from the upstream plugin to this shim.
 */
function getBaseURL(runtime: IAgentRuntime): string {
  const apiEndpoint =
    getSetting(runtime, "OLLAMA_API_ENDPOINT") ||
    getSetting(runtime, "OLLAMA_API_URL") ||
    DEFAULT_OLLAMA_URL;
  if (!apiEndpoint.endsWith("/api")) {
    return apiEndpoint.endsWith("/")
      ? `${apiEndpoint}api`
      : `${apiEndpoint}/api`;
  }
  return apiEndpoint;
}

function getApiBase(runtime: IAgentRuntime): string {
  const baseURL = getBaseURL(runtime);
  return baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
}

function getSmallModel(runtime: IAgentRuntime): string {
  return (
    getSetting(runtime, "OLLAMA_SMALL_MODEL") ||
    getSetting(runtime, "SMALL_MODEL") ||
    DEFAULT_SMALL_MODEL
  );
}

function getLargeModel(runtime: IAgentRuntime): string {
  return (
    getSetting(runtime, "OLLAMA_LARGE_MODEL") ||
    getSetting(runtime, "LARGE_MODEL") ||
    DEFAULT_LARGE_MODEL
  );
}

function getEmbeddingModel(runtime: IAgentRuntime): string {
  return (
    getSetting(runtime, "OLLAMA_EMBEDDING_MODEL") || DEFAULT_EMBEDDING_MODEL
  );
}

/**
 * Attempt to /api/show the model; if Ollama returns 404, /api/pull it.
 * Matches the upstream plugin's ensureModelAvailable() behaviour so
 * boxes without pre-pulled models still work on first call. Silently
 * swallows errors (logged) — actual model calls later will re-surface
 * any real failure.
 */
async function ensureModelAvailable(
  model: string,
  providedBaseURL?: string,
  customFetch?: typeof fetch,
): Promise<void> {
  const baseURL = providedBaseURL || `${DEFAULT_OLLAMA_URL}/api`;
  const apiBase = baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
  const fetcher = customFetch ?? fetch;
  try {
    const showRes = await fetcher(`${apiBase}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (showRes.ok) return;
    console.info(`[local-ollama] Model ${model} not found locally, pulling...`);
    const pullRes = await fetcher(`${apiBase}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false }),
    });
    if (!pullRes.ok) {
      console.error(
        `[local-ollama] Failed to pull ${model}: ${pullRes.statusText}`,
      );
    } else {
      console.info(`[local-ollama] Downloaded model ${model}`);
    }
  } catch (err) {
    console.error("[local-ollama] Error ensuring model availability:", err);
  }
}

function getRuntimeFetch(runtime: IAgentRuntime): typeof fetch | undefined {
  // `runtime.fetch` is an optional field on IAgentRuntime in some alpha
  // versions. Narrow at runtime to avoid TS-breaking the union.
  return (runtime as unknown as { fetch?: typeof fetch }).fetch;
}

function getRuntimeSystemPrompt(runtime: IAgentRuntime): string | undefined {
  return (runtime as unknown as { character?: { system?: string } }).character
    ?.system;
}

function createProvider(runtime: IAgentRuntime): OllamaProvider {
  return createOllama({
    baseURL: getBaseURL(runtime),
    fetch: getRuntimeFetch(runtime),
  });
}

// ----------------------------------------------------------------------------
// Model handlers
// ----------------------------------------------------------------------------

async function handleTextEmbedding(
  runtime: IAgentRuntime,
  params: unknown,
): Promise<number[]> {
  try {
    const baseURL = getBaseURL(runtime);
    const customFetch = getRuntimeFetch(runtime);
    const provider = createProvider(runtime);
    const modelName = getEmbeddingModel(runtime);
    console.log(`[local-ollama] TEXT_EMBEDDING model=${modelName}`);
    await ensureModelAvailable(modelName, baseURL, customFetch);

    let text =
      typeof params === "string"
        ? params
        : (params as { text?: string } | null | undefined)?.text || "";
    const maxChars = MAX_EMBEDDING_TOKENS * CHARS_PER_TOKEN_ESTIMATE;
    if (text.length > maxChars) {
      console.warn(
        `[local-ollama] Embedding input too long (~${Math.ceil(
          text.length / CHARS_PER_TOKEN_ESTIMATE,
        )} tokens), truncating to ~${MAX_EMBEDDING_TOKENS} tokens`,
      );
      text = text.slice(0, maxChars);
    }
    // `embed` requires a non-empty string; fall back to a placeholder so the
    // error path still returns something usable.
    const embeddingText = text || "test";
    try {
      const { embedding } = await embed({
        model: provider.embedding(modelName),
        value: embeddingText,
      });
      return embedding;
    } catch (err) {
      console.error("[local-ollama] Error generating embedding:", err);
      return new Array<number>(EMBEDDING_ERROR_FALLBACK_SIZE).fill(0);
    }
  } catch (err) {
    console.error("[local-ollama] Error in TEXT_EMBEDDING model:", err);
    return new Array<number>(EMBEDDING_ERROR_FALLBACK_SIZE).fill(0);
  }
}

type TextGenerationParams = {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
};

async function generateOllamaText(
  provider: OllamaProvider,
  modelName: string,
  params: TextGenerationParams,
): Promise<string> {
  try {
    // Ollama's native /api/chat accepts stop sequences and a single
    // `repeat_penalty` multiplier, not separate presence/frequency penalties
    // or a top-level `stopSequences` array. ai@6 / the v2 provider exposes
    // the Ollama-native knobs via `providerOptions.ollama.options.*`, so we
    // route the params through that path. Keeping them at the top level
    // would produce "feature setting not supported" warnings on every call
    // and (more importantly) silently drop the values.
    //
    // `repeat_penalty` maps roughly onto the AI SDK's penalty concept:
    // Ollama's default is 1.1, neutral is 1.0. We average the caller's
    // presence+frequency signal and offset from the neutral baseline so
    // that the upstream plugin's 0.7/0.7 defaults map to a sensible ~1.1.
    const ollamaOptions: JSONObject = {};
    if (typeof params.temperature === "number") {
      ollamaOptions.temperature = params.temperature;
    }
    if (typeof params.maxOutputTokens === "number") {
      ollamaOptions.num_predict = params.maxOutputTokens;
    }
    if (params.stopSequences && params.stopSequences.length > 0) {
      ollamaOptions.stop = params.stopSequences;
    }
    const penaltySignal =
      ((params.frequencyPenalty ?? 0) + (params.presencePenalty ?? 0)) / 2;
    if (penaltySignal !== 0) {
      ollamaOptions.repeat_penalty = 1 + penaltySignal * 0.2;
    }

    const providerOptions: Record<string, JSONObject> | undefined =
      Object.keys(ollamaOptions).length > 0
        ? {
            ollama: {
              options: ollamaOptions,
            },
          }
        : undefined;

    const { text } = await generateText({
      model: provider(modelName),
      prompt: params.prompt,
      system: params.system,
      // Keep top-level temperature + maxOutputTokens for transparency in
      // other providers if the same handler is ever reused; the v2 Ollama
      // provider honours `providerOptions.ollama.options.*` as the
      // primary source of truth.
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
      providerOptions,
    });
    return text;
  } catch (err) {
    console.error("[local-ollama] Error in generateOllamaText:", err);
    return "Error generating text. Please try again later.";
  }
}

async function handleTextSmall(
  runtime: IAgentRuntime,
  { prompt, stopSequences = [] }: { prompt: string; stopSequences?: string[] },
): Promise<string> {
  try {
    // Defaults mirror @elizaos/plugin-ollama@2.0.0-alpha.70's handleTextSmall.
    const temperature = 0.7;
    const frequencyPenalty = 0.7;
    const presencePenalty = 0.7;
    const maxOutputTokens = 8000;

    const baseURL = getBaseURL(runtime);
    const customFetch = getRuntimeFetch(runtime);
    const provider = createProvider(runtime);
    const model = getSmallModel(runtime);
    console.log(`[local-ollama] TEXT_SMALL model=${model}`);
    await ensureModelAvailable(model, baseURL, customFetch);

    return await generateOllamaText(provider, model, {
      prompt,
      system: getRuntimeSystemPrompt(runtime),
      temperature,
      maxOutputTokens,
      frequencyPenalty,
      presencePenalty,
      stopSequences,
    });
  } catch (err) {
    console.error("[local-ollama] Error in TEXT_SMALL model:", err);
    return "Error generating text. Please try again later.";
  }
}

async function handleTextLarge(
  runtime: IAgentRuntime,
  {
    prompt,
    stopSequences = [],
    maxTokens = 8192,
    temperature = 0.7,
    frequencyPenalty = 0.7,
    presencePenalty = 0.7,
  }: {
    prompt: string;
    stopSequences?: string[];
    maxTokens?: number;
    temperature?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  },
): Promise<string> {
  try {
    const model = getLargeModel(runtime);
    const baseURL = getBaseURL(runtime);
    const customFetch = getRuntimeFetch(runtime);
    const provider = createProvider(runtime);
    console.log(`[local-ollama] TEXT_LARGE model=${model}`);
    await ensureModelAvailable(model, baseURL, customFetch);

    return await generateOllamaText(provider, model, {
      prompt,
      system: getRuntimeSystemPrompt(runtime),
      temperature,
      // AI SDK v5 renamed `maxTokens` → `maxOutputTokens`; upstream callers
      // still pass `maxTokens` so we translate here and keep the public
      // handler signature compatible.
      maxOutputTokens: maxTokens,
      frequencyPenalty,
      presencePenalty,
      stopSequences,
    });
  } catch (err) {
    console.error("[local-ollama] Error in TEXT_LARGE model:", err);
    return "Error generating text. Please try again later.";
  }
}

type ObjectGenerationParams = {
  prompt: string;
  temperature?: number;
};

// ElizaOS's Plugin type requires OBJECT_* handlers to return a
// Record<string, JsonValue>. generateObject with output: "no-schema"
// returns `unknown`, so we coerce to the ElizaOS-compatible record type
// here; the runtime only ever stringifies this back out, so a permissive
// cast is safe.
type JsonObject = Record<string, JsonValue>;

async function generateOllamaObject(
  provider: OllamaProvider,
  modelName: string,
  params: ObjectGenerationParams,
): Promise<JsonObject> {
  try {
    const { object } = await generateObject({
      model: provider(modelName),
      output: "no-schema",
      prompt: params.prompt,
      temperature: params.temperature,
    });
    if (object && typeof object === "object" && !Array.isArray(object)) {
      return object as JsonObject;
    }
    return {};
  } catch (err) {
    console.error("[local-ollama] Error generating object:", err);
    return {};
  }
}

async function handleObjectSmall(
  runtime: IAgentRuntime,
  params: ObjectGenerationParams,
): Promise<JsonObject> {
  try {
    const baseURL = getBaseURL(runtime);
    const customFetch = getRuntimeFetch(runtime);
    const provider = createProvider(runtime);
    const model = getSmallModel(runtime);
    console.log(`[local-ollama] OBJECT_SMALL model=${model}`);
    await ensureModelAvailable(model, baseURL, customFetch);
    return await generateOllamaObject(provider, model, params);
  } catch (err) {
    console.error("[local-ollama] Error in OBJECT_SMALL model:", err);
    return {};
  }
}

async function handleObjectLarge(
  runtime: IAgentRuntime,
  params: ObjectGenerationParams,
): Promise<JsonObject> {
  try {
    const baseURL = getBaseURL(runtime);
    const customFetch = getRuntimeFetch(runtime);
    const provider = createProvider(runtime);
    const model = getLargeModel(runtime);
    console.log(`[local-ollama] OBJECT_LARGE model=${model}`);
    await ensureModelAvailable(model, baseURL, customFetch);
    return await generateOllamaObject(provider, model, params);
  } catch (err) {
    console.error("[local-ollama] Error in OBJECT_LARGE model:", err);
    return {};
  }
}

// ----------------------------------------------------------------------------
// Plugin export
// ----------------------------------------------------------------------------

export const ollamaPlugin: Plugin = {
  name: "ollama-local-shim",
  description:
    "Local Ollama plugin shim using ollama-ai-provider-v2 for AI SDK v5 compatibility",
  config: {
    OLLAMA_API_ENDPOINT: process.env.OLLAMA_API_ENDPOINT ?? null,
    OLLAMA_SMALL_MODEL: process.env.OLLAMA_SMALL_MODEL ?? null,
    OLLAMA_MEDIUM_MODEL: process.env.OLLAMA_MEDIUM_MODEL ?? null,
    OLLAMA_LARGE_MODEL: process.env.OLLAMA_LARGE_MODEL ?? null,
    OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL ?? null,
  },
  async init(_config: unknown, runtime: IAgentRuntime): Promise<void> {
    const apiBase = getApiBase(runtime);
    const baseURL = getBaseURL(runtime);
    if (!baseURL || baseURL === `${DEFAULT_OLLAMA_URL}/api`) {
      const endpoint = runtime.getSetting("OLLAMA_API_ENDPOINT");
      if (!endpoint) {
        console.warn(
          "[local-ollama] OLLAMA_API_ENDPOINT not set, using default localhost:11434",
        );
      }
    }
    try {
      const response = await fetch(`${apiBase}/api/tags`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        console.warn(
          `[local-ollama] Ollama API validation failed: ${response.statusText}`,
        );
      } else {
        console.log(
          `[local-ollama] Ollama API reachable at ${apiBase} (plugin shim active)`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[local-ollama] Ollama API validation error: ${msg}`);
    }
  },
  models: {
    [ModelType.TEXT_EMBEDDING]: async (
      runtime: IAgentRuntime,
      params: unknown,
    ) => handleTextEmbedding(runtime, params),
    [ModelType.TEXT_SMALL]: async (
      runtime: IAgentRuntime,
      params: { prompt: string; stopSequences?: string[] },
    ) => handleTextSmall(runtime, params),
    [ModelType.TEXT_LARGE]: async (
      runtime: IAgentRuntime,
      params: {
        prompt: string;
        stopSequences?: string[];
        maxTokens?: number;
        temperature?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
      },
    ) => handleTextLarge(runtime, params),
    [ModelType.OBJECT_SMALL]: async (
      runtime: IAgentRuntime,
      params: ObjectGenerationParams,
    ) => handleObjectSmall(runtime, params),
    [ModelType.OBJECT_LARGE]: async (
      runtime: IAgentRuntime,
      params: ObjectGenerationParams,
    ) => handleObjectLarge(runtime, params),
  },
};

export default ollamaPlugin;
