import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectHyperiaLaunchDiagnostics,
  ensureHyperiaRuntimeReady,
  prepareHyperiaAppLaunch,
  resolveHyperiaViewerAuthMessage,
  type HyperiaBridgeRuntimeLike,
} from "./app-runtime.js";

type WalletAuthFixtureServer = {
  close: () => Promise<void>;
  requests: Array<Record<string, unknown>>;
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

async function startWalletAuthFixtureServer(options?: {
  errorMessage?: string;
  status?: number;
}): Promise<WalletAuthFixtureServer> {
  const requests: Array<Record<string, unknown>> = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "POST" && url.pathname === "/api/agents/wallet-auth") {
      requests.push((await readJsonBody(req)) ?? {});
      const status = options?.status ?? 200;
      res.statusCode = status;
      if (status >= 400) {
        res.end(
          JSON.stringify({
            success: false,
            error: options?.errorMessage ?? "wallet auth unavailable",
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          success: true,
          authToken: "runtime-auth-token",
          characterId: "runtime-character-id",
          accountId: "runtime-account-id",
        }),
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: "not found" }));
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
    throw new Error("Failed to bind wallet auth fixture server");
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
    requests,
    url: `http://127.0.0.1:${address.port}`,
  };
}

function createRuntime(options?: {
  agentId?: string;
  authToken?: string | null;
  characterId?: string | null;
  hasService?: boolean;
  walletAddress?: string;
}) {
  const settings = new Map<string, string>();
  if (options?.authToken !== null) {
    settings.set(
      "HYPERIA_AUTH_TOKEN",
      options?.authToken ?? "existing-auth-token",
    );
  }
  if (options?.characterId !== null) {
    settings.set(
      "HYPERIA_CHARACTER_ID",
      options?.characterId ?? "existing-character-id",
    );
  }
  const setSetting = vi.fn((key: string, value: string) => {
    settings.set(key, value);
  });
  const getServiceLoadPromise = vi.fn(async () => ({}));

  return {
    agentId: options?.agentId ?? "runtime-agent-id",
    character: {
      name: "Chen",
      walletAddresses: {
        evm:
          options?.walletAddress ??
          "0x1234567890123456789012345678901234567890",
      },
      settings: {
        secrets: {},
      },
      secrets: {},
    },
    getSetting: (key: string) => settings.get(key) ?? null,
    hasService: (serviceType: string) =>
      serviceType === "hyperiaService" && options?.hasService !== false,
    getServiceLoadPromise,
    setSetting,
  } satisfies HyperiaBridgeRuntimeLike & {
    getServiceLoadPromise: typeof getServiceLoadPromise;
    setSetting: typeof setSetting;
  };
}

afterEach(() => {
  delete process.env.HYPERIA_API_URL;
  delete process.env.HYPERIA_AUTH_TOKEN;
  delete process.env.HYPERIA_CHARACTER_ID;
  delete process.env.HYPERIA_ACCOUNT_ID;
});

describe("plugin-hyperia app runtime helpers", () => {
  it("provisions and persists Hyperia credentials through wallet auth", async () => {
    const fixtureServer = await startWalletAuthFixtureServer();
    process.env.HYPERIA_API_URL = fixtureServer.url;

    try {
      const runtime = createRuntime({
        authToken: null,
        characterId: null,
      });

      await expect(prepareHyperiaAppLaunch(runtime)).resolves.toEqual([]);
      expect(fixtureServer.requests).toEqual([
        expect.objectContaining({
          walletAddress: "0x1234567890123456789012345678901234567890",
          walletType: "evm",
          agentName: "Chen",
          agentId: "runtime-agent-id",
        }),
      ]);
      expect(runtime.setSetting).toHaveBeenCalledWith(
        "HYPERIA_AUTH_TOKEN",
        "runtime-auth-token",
        true,
      );
      expect(runtime.setSetting).toHaveBeenCalledWith(
        "HYPERIA_CHARACTER_ID",
        "runtime-character-id",
        false,
      );
      expect(runtime.setSetting).toHaveBeenCalledWith(
        "HYPERIA_ACCOUNT_ID",
        "runtime-account-id",
        false,
      );
      expect(process.env.HYPERIA_AUTH_TOKEN).toBe("runtime-auth-token");
      expect(process.env.HYPERIA_CHARACTER_ID).toBe("runtime-character-id");
      expect(process.env.HYPERIA_ACCOUNT_ID).toBe("runtime-account-id");
    } finally {
      await fixtureServer.close();
    }
  });

  it("returns a warning diagnostic when wallet auth provisioning fails", async () => {
    const fixtureServer = await startWalletAuthFixtureServer({
      status: 503,
      errorMessage: "temporarily unavailable",
    });
    process.env.HYPERIA_API_URL = fixtureServer.url;

    try {
      const runtime = createRuntime({
        authToken: null,
        characterId: null,
      });
      const diagnostics = await prepareHyperiaAppLaunch(runtime);

      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: "hyperia-auth-provisioning-failed",
          severity: "warning",
          message: expect.stringContaining("temporarily unavailable"),
        }),
      ]);
      expect(runtime.setSetting).not.toHaveBeenCalled();
    } finally {
      await fixtureServer.close();
    }
  });

  it("builds viewer auth payloads only when runtime auth is available", () => {
    expect(
      resolveHyperiaViewerAuthMessage(
        createRuntime({ authToken: null, characterId: null }),
      ),
    ).toBeNull();

    expect(resolveHyperiaViewerAuthMessage(createRuntime())).toEqual({
      type: "HYPERIA_AUTH",
      authToken: "existing-auth-token",
      agentId: "runtime-agent-id",
      characterId: "existing-character-id",
      followEntity: "existing-character-id",
    });
  });

  it("waits for the Hyperia runtime service and errors when it is absent", async () => {
    const readyRuntime = createRuntime();
    await expect(
      ensureHyperiaRuntimeReady(readyRuntime),
    ).resolves.toBeUndefined();
    expect(readyRuntime.getServiceLoadPromise).toHaveBeenCalledWith(
      "hyperiaService",
    );

    const missingRuntime = createRuntime({ hasService: false });
    await expect(ensureHyperiaRuntimeReady(missingRuntime)).rejects.toThrow(
      "Hyperia service was not registered on the agent runtime.",
    );
  });

  it("reports launch diagnostics for missing auth, inactive runtime bridge, and absent live sessions", () => {
    const runtime = createRuntime({
      authToken: null,
      characterId: "runtime-character-id",
      hasService: false,
    });

    expect(
      collectHyperiaLaunchDiagnostics({
        requestedViewerAuth: true,
        runtime,
        sessionFound: false,
        viewerAuthMessage: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "hyperia-auth-unavailable" }),
        expect.objectContaining({ code: "hyperia-runtime-bridge-inactive" }),
        expect.objectContaining({ code: "hyperia-session-not-found" }),
      ]),
    );
  });

  it("does not emit auth diagnostics when viewer auth is not requested or the session is already attached", () => {
    const runtime = createRuntime();

    expect(
      collectHyperiaLaunchDiagnostics({
        requestedViewerAuth: false,
        runtime,
        sessionFound: true,
        viewerAuthMessage: {
          type: "HYPERIA_AUTH",
          authToken: "existing-auth-token",
          characterId: "existing-character-id",
        },
      }),
    ).toEqual([]);
  });
});
