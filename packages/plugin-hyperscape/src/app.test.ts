import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectLaunchDiagnostics,
  ensureRuntimeReady,
  handleAppRoutes,
  prepareLaunch,
  resolveLaunchSession,
  resolveViewerAuthMessage,
  type HyperscapeAppRouteContext,
} from "./app.js";

type HyperscapeFixtureServer = {
  close: () => Promise<void>;
  headers: {
    goalStop: string[];
    message: string[];
    thoughts: string[];
  };
  requests: {
    goalStop: Array<Record<string, unknown>>;
    message: Array<Record<string, unknown>>;
    walletAuth: Array<Record<string, unknown>>;
  };
  url: string;
};

async function readJsonBody(
  req: http.IncomingMessage,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

async function startFixtureServer(options?: {
  omitThoughtsRoute?: boolean;
}): Promise<HyperscapeFixtureServer> {
  const headers = {
    goalStop: [] as string[],
    message: [] as string[],
    thoughts: [] as string[],
  };
  const requests = {
    goalStop: [] as Array<Record<string, unknown>>,
    message: [] as Array<Record<string, unknown>>,
    walletAuth: [] as Array<Record<string, unknown>>,
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const body = await readJsonBody(req);
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && url.pathname === "/api/embedded-agents") {
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, agents: [] }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/agents/mapping/agent-1") {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          agentId: "agent-1",
          characterId: "character-1",
          accountId: "account-1",
          agentName: "Chen",
        }),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/agents/agent-1/goal") {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          goal: {
            description: "Scout the moon gate",
            type: "scout",
          },
          availableGoals: [{ description: "Hold position", type: "idle" }],
          goalsPaused: false,
        }),
      );
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/agents/agent-1/quick-actions"
    ) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          quickCommands: [
            { label: "Check the gate", command: "Check the moon gate" },
          ],
          nearbyLocations: [{ name: "Moon Gate" }],
          availableGoals: [
            { description: "Scout the moon gate", type: "scout" },
          ],
          playerPosition: [12, 0, 8],
        }),
      );
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/agents/agent-1/thoughts" &&
      !options?.omitThoughtsRoute
    ) {
      headers.thoughts.push(req.headers.authorization ?? "");
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          thoughts: [
            {
              id: "thought-1",
              type: "reasoning",
              content: "The moon gate is the safest scouting route.",
              timestamp: 1_710_000_100_000,
            },
          ],
          count: 1,
        }),
      );
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/agents/wallet-auth"
    ) {
      requests.walletAuth.push(body ?? {});
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          authToken: "fixture-auth-token",
          characterId: "character-1",
          accountId: "account-1",
        }),
      );
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/agents/agent-1/message"
    ) {
      headers.message.push(req.headers.authorization ?? "");
      requests.message.push(body ?? {});
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: "Message delivered." }));
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/agents/agent-1/goal/stop"
    ) {
      headers.goalStop.push(req.headers.authorization ?? "");
      requests.goalStop.push(body ?? {});
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: "Goal stopped." }));
      return;
    }

    res.statusCode = 404;
    res.end(
      JSON.stringify({
        success: false,
        error: `Unhandled ${req.method} ${url.pathname}`,
      }),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind Hyperscape fixture server");
  }

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    headers,
    requests,
    url: `http://127.0.0.1:${address.port}`,
  };
}

function createRuntime(
  serverUrl: string,
  options?: {
    authToken?: string | null;
    characterId?: string | null;
    hasService?: boolean;
  },
) {
  const settings = new Map<string, string>([["HYPERSCAPE_API_URL", serverUrl]]);
  if (options?.authToken !== null) {
    settings.set("HYPERSCAPE_AUTH_TOKEN", options?.authToken ?? "runtime-token");
  }
  if (options?.characterId !== null) {
    settings.set(
      "HYPERSCAPE_CHARACTER_ID",
      options?.characterId ?? "character-1",
    );
  }
  const getServiceLoadPromise = vi.fn(async () => ({}));

  return {
    agentId: "agent-1",
    character: {
      name: "Chen",
      walletAddresses: {
        evm: "0x1234567890123456789012345678901234567890",
      },
    },
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
      settings.set(key, value);
    },
    hasService: (serviceType: string) =>
      serviceType === "hyperscapeService" && options?.hasService !== false,
    getServiceLoadPromise,
  };
}

function createRouteContext(
  url: string,
  method: string,
  runtime: ReturnType<typeof createRuntime>,
  body?: Record<string, unknown>,
) {
  const chunks: Buffer[] = [];
  const headers = new Map<string, string | string[]>();
  const request = {} as http.IncomingMessage;
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(
        name.toLowerCase(),
        Array.isArray(value) ? [...value] : String(value),
      );
      return response as unknown as http.ServerResponse;
    },
    end(chunk?: unknown) {
      if (chunk === undefined || chunk === null) {
        return response as unknown as http.ServerResponse;
      }
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : typeof chunk === "string"
            ? Buffer.from(chunk)
            : Buffer.from(String(chunk)),
      );
      return response as unknown as http.ServerResponse;
    },
  } as unknown as http.ServerResponse;

  const parsedUrl = new URL(url);

  const ctx: HyperscapeAppRouteContext = {
    req: request,
    res: response,
    method,
    pathname: parsedUrl.pathname,
    url: parsedUrl,
    runtime,
    readJsonBody: async () => (body ?? null) as Record<string, unknown> | null,
    json: (res, data, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    },
    error: (res, message, status = 500) => {
      res.statusCode = status;
      res.end(JSON.stringify({ error: message }));
    },
  };

  return {
    ctx,
    getBody: () => Buffer.concat(chunks).toString("utf8"),
    getHeaders: () => headers,
    getStatus: () => response.statusCode,
  };
}

afterEach(() => {
  delete process.env.HYPERSCAPE_API_URL;
  delete process.env.HYPERSCAPE_AUTH_TOKEN;
  delete process.env.HYPERSCAPE_CLIENT_URL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.CLIENT_URL;
});

describe("plugin-hyperscape app bridge", () => {
  it("resolves a mapped session using runtime-scoped API configuration", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url);
      const session = await resolveLaunchSession({
        runtime,
        viewer: {
          authMessage: {
            agentId: "agent-1",
            characterId: "character-1",
            followEntity: "character-1",
          },
        },
      });

      expect(session).toEqual(
        expect.objectContaining({
          sessionId: "agent-1",
          appName: "@hyperscape/plugin-hyperscape",
          status: "running",
          canSendCommands: true,
          followEntity: "character-1",
          suggestedPrompts: ["Check the moon gate"],
          telemetry: expect.objectContaining({
            recentThoughts: [
              expect.objectContaining({
                content: "The moon gate is the safest scouting route.",
                type: "reasoning",
              }),
            ],
            recommendedGoals: [
              expect.objectContaining({
                description: "Hold position",
                type: "idle",
              }),
            ],
          }),
        }),
      );
      expect(fixtureServer.headers.thoughts).toEqual(["Bearer runtime-token"]);
    } finally {
      await fixtureServer.close();
    }
  });

  it("treats a missing thoughts endpoint as optional session telemetry", async () => {
    const fixtureServer = await startFixtureServer({ omitThoughtsRoute: true });
    try {
      const runtime = createRuntime(fixtureServer.url);
      const session = await resolveLaunchSession({
        runtime,
        viewer: {
          authMessage: {
            agentId: "agent-1",
            characterId: "character-1",
            followEntity: "character-1",
          },
        },
      });

      expect(session).toEqual(
        expect.objectContaining({
          sessionId: "agent-1",
          activity: [],
          telemetry: expect.objectContaining({
            recentThoughts: [],
          }),
        }),
      );
    } finally {
      await fixtureServer.close();
    }
  });

  it("uses the runtime auth token for proxied message and control routes", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url);

      const message = createRouteContext(
        "http://localhost/api/apps/hyperscape/session/agent-1/message",
        "POST",
        runtime,
        { content: "Check the gate" },
      );
      expect(await handleAppRoutes(message.ctx)).toBe(true);
      expect(message.getStatus()).toBe(200);
      expect(JSON.parse(message.getBody())).toEqual(
        expect.objectContaining({
          success: true,
          session: expect.objectContaining({
            sessionId: "agent-1",
          }),
        }),
      );

      const control = createRouteContext(
        "http://localhost/api/apps/hyperscape/session/agent-1/control",
        "POST",
        runtime,
        { action: "pause" },
      );
      expect(await handleAppRoutes(control.ctx)).toBe(true);
      expect(control.getStatus()).toBe(200);
      expect(JSON.parse(control.getBody())).toEqual(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Goal stopped"),
        }),
      );

      expect(fixtureServer.headers.message).toEqual(["Bearer runtime-token"]);
      expect(fixtureServer.headers.goalStop).toEqual(["Bearer runtime-token"]);
      expect(fixtureServer.requests.message).toEqual([
        { content: "Check the gate" },
      ]);
    } finally {
      await fixtureServer.close();
    }
  });

  it("proxies the thoughts route with runtime authorization", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url);
      const thoughts = createRouteContext(
        "http://localhost/api/apps/hyperscape/agents/agent-1/thoughts?limit=1",
        "GET",
        runtime,
      );

      expect(await handleAppRoutes(thoughts.ctx)).toBe(true);
      expect(thoughts.getStatus()).toBe(200);
      expect(JSON.parse(thoughts.getBody())).toEqual(
        expect.objectContaining({
          success: true,
          thoughts: [
            expect.objectContaining({
              content: "The moon gate is the safest scouting route.",
            }),
          ],
        }),
      );
      expect(fixtureServer.headers.thoughts).toEqual(["Bearer runtime-token"]);
    } finally {
      await fixtureServer.close();
    }
  });

  it("prepares launch by provisioning runtime auth through wallet auth", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url, {
        authToken: null,
        characterId: null,
      });

      await expect(prepareLaunch({ runtime })).resolves.toEqual(
        expect.objectContaining({
          launchUrl: "http://localhost:3333",
          viewer: expect.objectContaining({
            url: "http://localhost:3333",
            embedParams: expect.objectContaining({
              embedded: "true",
              mode: "spectator",
              surface: "agent-control",
            }),
            postMessageAuth: true,
          }),
        }),
      );
      expect(fixtureServer.requests.walletAuth).toEqual([
        expect.objectContaining({
          walletAddress: "0x1234567890123456789012345678901234567890",
          walletType: "evm",
          agentId: "agent-1",
        }),
      ]);
      await expect(resolveViewerAuthMessage({ runtime })).resolves.toEqual(
        expect.objectContaining({
          type: "HYPERSCAPE_AUTH",
          authToken: "fixture-auth-token",
          agentId: "agent-1",
          characterId: "character-1",
          followEntity: "character-1",
        }),
      );
    } finally {
      await fixtureServer.close();
    }
  });

  it("waits for the runtime service through the bridge hook", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url, { hasService: true });

      await expect(ensureRuntimeReady({ runtime })).resolves.toBeUndefined();
      expect(runtime.getServiceLoadPromise).toHaveBeenCalledWith(
        "hyperscapeService",
      );
    } finally {
      await fixtureServer.close();
    }
  });

  it("reports launch diagnostics when auth or runtime readiness is missing", async () => {
    const fixtureServer = await startFixtureServer();
    try {
      const runtime = createRuntime(fixtureServer.url, {
        authToken: null,
        hasService: false,
      });

      const diagnostics = await collectLaunchDiagnostics({
        runtime,
        viewer: {
          postMessageAuth: true,
          authMessage: null,
        },
        session: null,
      });

      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "hyperscape-auth-unavailable" }),
          expect.objectContaining({
            code: "hyperscape-runtime-bridge-inactive",
          }),
          expect.objectContaining({ code: "hyperscape-session-not-found" }),
        ]),
      );
    } finally {
      await fixtureServer.close();
    }
  });
});
