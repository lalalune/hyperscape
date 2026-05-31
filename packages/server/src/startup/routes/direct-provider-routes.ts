/**
 * Direct model provider routes.
 *
 * These routes let Hyperscape call configured OpenAI-compatible providers
 * without booting an Eliza runtime. Server-side secrets are injected here so
 * browser/client code never needs provider keys.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  getDirectProviderTargetUrl,
  resolveDirectProvider,
} from "../../llm/direct-providers.js";

type ProviderParams = {
  provider: string;
};

type ProxyBody = string | Buffer | ArrayBuffer | ArrayBufferView;

function buildBody(request: FastifyRequest): ProxyBody | undefined {
  if (request.body === undefined || request.body === null) {
    return undefined;
  }

  if (
    typeof request.body === "string" ||
    Buffer.isBuffer(request.body) ||
    request.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(request.body)
  ) {
    return request.body;
  }

  return JSON.stringify(request.body);
}

function copyResponseHeaders(response: Response, reply: FastifyReply): void {
  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "content-encoding" ||
      lowerKey === "content-length" ||
      lowerKey === "transfer-encoding" ||
      lowerKey === "connection"
    ) {
      return;
    }
    reply.header(key, value);
  });
}

async function proxyProviderRequest(
  request: FastifyRequest<{ Params: ProviderParams }>,
  reply: FastifyReply,
  surface: "models" | "chat" | "tts",
): Promise<unknown> {
  const provider = resolveDirectProvider(request.params.provider);
  if (!provider) {
    return reply.code(404).send({
      error: "Provider is not configured",
      message:
        "Configure HYADES_LLM_API_KEY/HYADES_RUNTIME_URL, OPENROUTER_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL.",
    });
  }

  const target = getDirectProviderTargetUrl(provider, surface);
  if (!target) {
    return reply.code(404).send({
      error: "Provider surface is not available",
      provider: provider.name,
      surface,
    });
  }

  const headers: Record<string, string> = {};
  const contentType = request.headers["content-type"];
  if (typeof contentType === "string") {
    headers["content-type"] = contentType;
  }
  if (provider.apiKey) {
    headers.authorization = `Bearer ${provider.apiKey}`;
  }

  try {
    const response = await fetch(target, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : (buildBody(request) as BodyInit | undefined),
      headers,
      method: request.method,
      redirect: "manual",
    });

    copyResponseHeaders(response, reply);
    const arrayBuffer = await response.arrayBuffer();
    return reply.code(response.status).send(Buffer.from(arrayBuffer));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(502).send({
      error: "Provider request failed",
      message,
      provider: provider.name,
      surface,
    });
  }
}

export function registerDirectProviderRoutes(fastify: FastifyInstance): void {
  console.log("[DirectProviders] Registering direct provider routes...");

  fastify.get<{ Params: ProviderParams }>(
    "/api/providers/:provider/v1/models",
    async (request, reply) => proxyProviderRequest(request, reply, "models"),
  );

  fastify.post<{ Params: ProviderParams }>(
    "/api/providers/:provider/v1/chat/completions",
    async (request, reply) => proxyProviderRequest(request, reply, "chat"),
  );

  fastify.post<{ Params: ProviderParams }>(
    "/api/providers/:provider/tts",
    async (request, reply) => proxyProviderRequest(request, reply, "tts"),
  );
}
