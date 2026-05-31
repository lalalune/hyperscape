import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDirectProviderRoutes } from "../routes/direct-provider-routes";

type RouteHandler = (
  request: RequestShape,
  reply: ReplyRecorder,
) => Promise<unknown>;

type RequestShape = {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params: { provider: string };
  url: string;
};

type ReplyRecorder = {
  headers: Record<string, string>;
  payload: unknown;
  statusCode: number;
  code: (statusCode: number) => ReplyRecorder;
  header: (key: string, value: string) => ReplyRecorder;
  send: (payload: unknown) => unknown;
};

function createReplyRecorder(): ReplyRecorder {
  return {
    headers: {},
    payload: undefined,
    statusCode: 200,
    code(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    },
  };
}

function createFastifyRecorder() {
  const routes = new Map<string, RouteHandler>();
  const fastify = {
    get(path: string, handler: RouteHandler) {
      routes.set(`GET ${path}`, handler);
      return this;
    },
    post(path: string, handler: RouteHandler) {
      routes.set(`POST ${path}`, handler);
      return this;
    },
  };

  return {
    fastify: fastify as never,
    routes,
  };
}

describe("direct provider routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.HYADES_LLM_API_KEY;
    delete process.env.HYADES_RUNTIME_URL;
    delete process.env.OPENAI_API_KEY;
  });

  it("forwards Hyades chat requests with server-side authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.HYADES_RUNTIME_URL = "http://hyades.local";
    process.env.HYADES_LLM_API_KEY = "test-hyades-key";

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    const { fastify, routes } = createFastifyRecorder();
    registerDirectProviderRoutes(fastify);

    const reply = createReplyRecorder();
    await routes.get("POST /api/providers/:provider/v1/chat/completions")?.(
      {
        body: { model: "nemotron3-omni", messages: [] },
        headers: { "content-type": "application/json" },
        method: "POST",
        params: { provider: "hyades" },
        url: "/api/providers/hyades/v1/chat/completions",
      },
      reply,
    );

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://hyades.local/v1/chat/completions",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer test-hyades-key",
      "content-type": "application/json",
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("returns 404 when a provider has no TTS surface", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.OPENAI_API_KEY = "test-openai-key";

    const { fastify, routes } = createFastifyRecorder();
    registerDirectProviderRoutes(fastify);

    const reply = createReplyRecorder();
    await routes.get("POST /api/providers/:provider/tts")?.(
      {
        body: { text: "hello" },
        headers: { "content-type": "application/json" },
        method: "POST",
        params: { provider: "openai" },
        url: "/api/providers/openai/tts",
      },
      reply,
    );

    expect(reply.statusCode).toBe(404);
    expect(reply.payload).toMatchObject({
      error: "Provider surface is not available",
      provider: "openai",
      surface: "tts",
    });
  });
});
