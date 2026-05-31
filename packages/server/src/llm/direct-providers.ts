type DirectProviderName = "hyades" | "openai" | "openrouter" | "ollama";

type ProviderSecrets = Record<string, string | undefined> | undefined;

export type DirectChatOptions = {
  characterSecrets?: ProviderSecrets;
  maxTokens?: number;
  model?: string | null;
  preferredProvider?: string | null;
  prompt: string;
  temperature?: number;
};

export type DirectChatResult = {
  model: string;
  provider: DirectProviderName;
  source: string;
  text: string;
};

export type DirectProviderConfig = {
  apiKey: string | null;
  baseUrl: URL;
  chatPath: string;
  defaultModel: string;
  modelsPath: string;
  name: DirectProviderName;
  source: string;
  ttsPath: string | null;
};

type ChatCompletionChoice = {
  message?: {
    content?: unknown;
  };
  text?: unknown;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

const DEFAULT_HYADES_MODEL = "nemotron3-omni";

function readSecret(secrets: ProviderSecrets, key: string): string | undefined {
  const value = secrets?.[key]?.trim() || process.env[key]?.trim();
  return value && !isPlaceholderSecret(value) ? value : undefined;
}

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "your_api_key_here" ||
    normalized === "your-key-here" ||
    normalized === "changeme" ||
    normalized === "change-me" ||
    normalized.startsWith("sk-...")
  );
}

function parseHttpUrl(raw: string | undefined): URL | null {
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function stripTrailingV1(url: URL): URL {
  const next = new URL(url.toString());
  next.pathname = next.pathname.replace(/\/v1\/?$/, "") || "/";
  return next;
}

function withPath(baseUrl: URL, path: string): URL {
  const url = new URL(baseUrl.toString());
  const basePath = url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;
  const nextPath = path.startsWith("/") ? path : `/${path}`;
  url.pathname = `${basePath}${nextPath}`.replace(/\/{2,}/g, "/");
  return url;
}

function getHyadesBaseUrl(secrets: ProviderSecrets): URL | null {
  const endpoint = parseHttpUrl(readSecret(secrets, "HYADES_LLM_ENDPOINT"));
  if (endpoint) {
    return stripTrailingV1(endpoint);
  }

  const runtime = parseHttpUrl(readSecret(secrets, "HYADES_RUNTIME_URL"));
  if (runtime) {
    return runtime;
  }

  return parseHttpUrl(process.env.PUBLIC_HYADES_URL?.trim());
}

function getProviderSource(
  secrets: ProviderSecrets,
  key: string,
  fallback: string,
): string {
  return secrets?.[key]?.trim() ? `character ${key}` : fallback;
}

export function resolveDirectProvider(
  preferredProvider?: string | null,
  characterSecrets?: ProviderSecrets,
): DirectProviderConfig | null {
  const preferred = preferredProvider?.trim().toLowerCase();
  const candidates: DirectProviderName[] =
    preferred === "hyades" ||
    preferred === "openai" ||
    preferred === "openrouter" ||
    preferred === "ollama"
      ? [preferred]
      : ["hyades", "openrouter", "openai", "ollama"];

  for (const candidate of candidates) {
    if (candidate === "hyades") {
      const baseUrl = getHyadesBaseUrl(characterSecrets);
      const apiKey = readSecret(characterSecrets, "HYADES_LLM_API_KEY");
      if (!baseUrl || !apiKey) {
        continue;
      }
      return {
        apiKey,
        baseUrl,
        chatPath: "/v1/chat/completions",
        defaultModel:
          readSecret(characterSecrets, "HYADES_LLM_MODEL") ||
          readSecret(characterSecrets, "HYADES_LLM_SMALL_MODEL") ||
          DEFAULT_HYADES_MODEL,
        modelsPath: "/v1/models",
        name: "hyades",
        source: getProviderSource(
          characterSecrets,
          "HYADES_LLM_API_KEY",
          "HYADES_LLM_API_KEY",
        ),
        ttsPath: "/tts",
      };
    }

    if (candidate === "openrouter") {
      const apiKey = readSecret(characterSecrets, "OPENROUTER_API_KEY");
      if (!apiKey) {
        continue;
      }
      return {
        apiKey,
        baseUrl:
          parseHttpUrl(process.env.OPENROUTER_BASE_URL?.trim()) ||
          new URL("https://openrouter.ai/api"),
        chatPath: "/v1/chat/completions",
        defaultModel:
          readSecret(characterSecrets, "OPENROUTER_MODEL") ||
          "openai/gpt-4o-mini",
        modelsPath: "/v1/models",
        name: "openrouter",
        source: getProviderSource(
          characterSecrets,
          "OPENROUTER_API_KEY",
          "OPENROUTER_API_KEY",
        ),
        ttsPath: null,
      };
    }

    if (candidate === "openai") {
      const apiKey = readSecret(characterSecrets, "OPENAI_API_KEY");
      if (!apiKey) {
        continue;
      }
      return {
        apiKey,
        baseUrl:
          parseHttpUrl(readSecret(characterSecrets, "OPENAI_BASE_URL")) ||
          new URL("https://api.openai.com"),
        chatPath: "/v1/chat/completions",
        defaultModel:
          readSecret(characterSecrets, "OPENAI_LARGE_MODEL") ||
          readSecret(characterSecrets, "OPENAI_MODEL") ||
          "gpt-4o-mini",
        modelsPath: "/v1/models",
        name: "openai",
        source: getProviderSource(
          characterSecrets,
          "OPENAI_API_KEY",
          "OPENAI_API_KEY",
        ),
        ttsPath: null,
      };
    }

    const baseUrl =
      parseHttpUrl(process.env.OLLAMA_BASE_URL?.trim()) ||
      parseHttpUrl(process.env.OLLAMA_API_ENDPOINT?.trim()) ||
      new URL("http://localhost:11434");
    return {
      apiKey: readSecret(characterSecrets, "OLLAMA_API_KEY") || null,
      baseUrl,
      chatPath: "/v1/chat/completions",
      defaultModel: readSecret(characterSecrets, "OLLAMA_MODEL") || "llama3.2",
      modelsPath: "/v1/models",
      name: "ollama",
      source: "OLLAMA_BASE_URL",
      ttsPath: null,
    };
  }

  return null;
}

function extractChatText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const response = payload as ChatCompletionResponse;
  const choice = response.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .join("")
      .trim();
  }
  return typeof choice?.text === "string" ? choice.text.trim() : "";
}

export async function callDirectChatCompletion(
  options: DirectChatOptions,
): Promise<DirectChatResult | null> {
  const provider = resolveDirectProvider(
    options.preferredProvider,
    options.characterSecrets,
  );
  if (!provider) {
    return null;
  }

  const model = options.model?.trim() || provider.defaultModel;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (provider.apiKey) {
    headers.authorization = `Bearer ${provider.apiKey}`;
  }

  const response = await fetch(withPath(provider.baseUrl, provider.chatPath), {
    body: JSON.stringify({
      messages: [{ role: "user", content: options.prompt }],
      model,
      stream: false,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 512,
    }),
    headers,
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `${provider.name} chat failed (${response.status})${errorText ? `: ${errorText.slice(0, 240)}` : ""}`,
    );
  }

  const payload = (await response.json()) as unknown;
  const text = extractChatText(payload);
  return {
    model,
    provider: provider.name,
    source: provider.source,
    text,
  };
}

export function getDirectProviderTargetUrl(
  provider: DirectProviderConfig,
  surface: "models" | "chat" | "tts",
): URL | null {
  if (surface === "models") {
    return withPath(provider.baseUrl, provider.modelsPath);
  }
  if (surface === "chat") {
    return withPath(provider.baseUrl, provider.chatPath);
  }
  return provider.ttsPath ? withPath(provider.baseUrl, provider.ttsPath) : null;
}
