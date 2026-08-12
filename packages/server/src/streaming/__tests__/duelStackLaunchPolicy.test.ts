import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertMultiStyleSparbotOptions,
  assertStandaloneSparbotRuntimeBoundary,
  assertSupportedUwsNodeVersion,
  assertProcessTerminationAllowed,
  hasConfiguredDuelModelProvider,
  isBettingFeedBootstrap,
  isFreshHyperbetReadiness,
  isHyperbetStreamSynchronized,
  isStandaloneSparbotBootstrap,
  normalizeHttpServiceUrl,
  omitEnvironmentKeys,
  resolveDuelDatabaseConfiguration,
  resolveDuelGameServiceTopology,
  resolveHyperbetRuntimeTopology,
  resolveHyperbetWorkspace,
  resolvePrivateBettingFeedToken,
  resolvePrivateRuntimeSecret,
  resolveStandaloneSparbotProfileSeed,
  resolveStandaloneSparbotStyles,
} from "../../../../../scripts/duel-stack-topology.mjs";

const launcherSource = readFileSync(
  new URL("../../../../../scripts/duel-stack.mjs", import.meta.url),
  "utf8",
);
const verifierUrl = new URL(
  "../../../../../scripts/verify-duel-stack.mjs",
  import.meta.url,
);
const execFileAsync = promisify(execFile);

describe("duel stack launch policy", () => {
  it("uses one validated custom-port topology for server binding and discovery", () => {
    expect(
      resolveDuelGameServiceTopology({
        serverUrl: "http://127.0.0.1:15555/",
        websocketUrl: "ws://127.0.0.1:15556/ws",
      }),
    ).toEqual({
      serverUrl: "http://127.0.0.1:15555",
      websocketUrl: "ws://127.0.0.1:15556/ws",
      serverPort: 15555,
      websocketPort: 15556,
    });

    expect(
      resolveDuelGameServiceTopology({
        serverUrl: "https://duel.example.com",
        websocketUrl: "wss://duel.example.com/ws",
      }),
    ).toMatchObject({ serverPort: 443, websocketPort: 443 });
    expect(() =>
      resolveDuelGameServiceTopology({
        serverUrl: "ftp://127.0.0.1:15555",
        websocketUrl: "ws://127.0.0.1:15556/ws",
      }),
    ).toThrow("must use HTTP or HTTPS");
    expect(() =>
      resolveDuelGameServiceTopology({
        serverUrl: "http://127.0.0.1:15555/api",
        websocketUrl: "ws://127.0.0.1:15556/ws",
      }),
    ).toThrow("must be an origin with no path");
    expect(() =>
      resolveDuelGameServiceTopology({
        serverUrl: "http://127.0.0.1:15555",
        websocketUrl: "http://127.0.0.1:15556/ws",
      }),
    ).toThrow("must use WS or WSS");
    expect(() =>
      resolveDuelGameServiceTopology({
        serverUrl: "http://127.0.0.1:15555",
        websocketUrl: "ws://127.0.0.1:15556/other",
      }),
    ).toThrow("must use the /ws endpoint");

    expect(launcherSource).toContain(
      "PORT: String(gameServiceTopology.serverPort)",
    );
    expect(launcherSource).toContain(
      "UWS_PORT: String(gameServiceTopology.websocketPort)",
    );
  });

  it("keeps alternate-chain bootstrap out of the native SOL launcher", () => {
    expect(launcherSource).not.toMatch(/\b(?:skip-)?chain-setup\b/i);
    expect(launcherSource).not.toMatch(/\b(?:anvil|mud|forge)\b/i);
    expect(launcherSource).toContain(
      '"../../scripts/start-hyperia-server.mjs"',
    );
    expect(launcherSource).toContain("starting the native SOL duel server");
  });

  it("resolves database mode and URL overrides without silently changing targets", () => {
    expect(
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: {},
        serverEnvironment: {},
      }),
    ).toEqual({
      mode: "local",
      databaseUrl: "",
      useManagedLocalPostgres: true,
    });

    expect(
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: {
          DUEL_DATABASE_URL: "postgresql://duel@db.example/launch",
        },
        serverEnvironment: {
          DATABASE_URL: "postgresql://stale@old.example/wrong",
          USE_LOCAL_POSTGRES: "true",
        },
      }),
    ).toEqual({
      mode: "remote",
      databaseUrl: "postgresql://duel@db.example/launch",
      useManagedLocalPostgres: false,
    });

    expect(
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: {
          DATABASE_URL: "postgresql://duel@127.0.0.1:6543/launch",
        },
      }),
    ).toEqual({
      mode: "local",
      databaseUrl: "postgresql://duel@127.0.0.1:6543/launch",
      useManagedLocalPostgres: false,
    });

    expect(() =>
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: { USE_LOCAL_POSTGRES: "false" },
      }),
    ).toThrow("Remote duel database mode requires");
    expect(() =>
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: {
          DUEL_DATABASE_MODE: "local",
          DATABASE_URL: "postgresql://duel@db.example/launch",
        },
      }),
    ).toThrow("cannot silently discard a remote DATABASE_URL");
    expect(() =>
      resolveDuelDatabaseConfiguration({
        runtimeEnvironment: { DUEL_DATABASE_MODE: "automatic" },
      }),
    ).toThrow("must be either local or remote");

    expect(launcherSource).toContain("...serverEnv,\n    ...process.env");
    expect(launcherSource).not.toContain("cleanupStaleLocalPostgresSessions");
    expect(launcherSource).toContain("String(clientPort)");
    expect(launcherSource).toContain('verifyArgs.push("--skip-betting")');
    expect(launcherSource).toContain('requestedCaptureChannel === "bundled"');
  });

  it("makes isolated launches fail closed instead of terminating existing processes", () => {
    expect(
      assertProcessTerminationAllowed({
        isolated: false,
        label: "capture",
        pids: [32, 32, 44],
      }),
    ).toEqual([32, 44]);
    expect(() =>
      assertProcessTerminationAllowed({
        isolated: true,
        label: "capture",
        pids: [32],
      }),
    ).toThrow(
      "Isolated duel launch refuses to terminate pre-existing capture process(es): 32",
    );
    expect(launcherSource).toContain("isolated: options.isolated");
  });

  it("requires the authoritative duel state before launch can complete", () => {
    expect(launcherSource).toMatch(
      /await waitForHttp\(\s*gameStreamingStateUrl,\s*"streaming duel api"/,
    );
    expect(launcherSource).not.toContain(
      "streaming duel api not ready at ${gameStreamingStateUrl}",
    );
  });

  it("requires the capture client and live HLS unless streaming is explicitly skipped", () => {
    expect(launcherSource).toContain(
      'if (!options["skip-stream"] || !clientWasReady || options.fresh)',
    );
    expect(launcherSource).toMatch(
      /await waitForLiveHls\(hlsUrl, hlsReadyTimeoutMs\)/,
    );
    expect(launcherSource).not.toMatch(/waitForLiveHls\([^;]+\.catch\(/s);
    expect(launcherSource).toContain(
      'process.env.STREAMING_CAPTURE_ENABLED || "false"',
    );
    expect(launcherSource).toContain(
      'RTMP_STATUS_FILE: options["skip-stream"] ? "" : rtmpStatusFile',
    );
    expect(launcherSource).toContain('verifyArgs.push("--skip-stream")');
    expect(launcherSource).toContain('"capture renderer"');
    expect(launcherSource).toContain("payload?.rendererHealth?.ready === true");
  });

  it("verifies a streamless duel stack without weakening streamed delivery checks", async () => {
    let hlsRequests = 0;
    let rtmpRequests = 0;
    let origin = "";
    const mockStack = createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", origin);
      const sendJson = (payload: unknown, statusCode = 200) => {
        response.writeHead(statusCode, { "content-type": "application/json" });
        response.end(JSON.stringify(payload));
      };

      if (requestUrl.pathname === "/never-ready.m3u8") {
        hlsRequests += 1;
        response.writeHead(503);
        response.end("stream intentionally unavailable");
        return;
      }
      if (requestUrl.pathname === "/api/streaming/rtmp/status") {
        rtmpRequests += 1;
        sendJson({ active: false, stats: { bytesReceived: 0 } });
        return;
      }
      if (requestUrl.pathname === "/health") {
        sendJson({
          status: "ok",
          database: { healthy: true, status: "healthy", latencyMs: 1 },
        });
        return;
      }
      if (requestUrl.pathname === "/api/streaming/config") {
        sendJson({
          canonicalPlatform: "hls",
          canonicalSourceUrl: `${origin}/never-ready.m3u8`,
          publicDelayMs: 0,
        });
        return;
      }
      if (requestUrl.pathname === "/api/streaming/duel-context") {
        sendJson({
          cycle: {
            phase: "FIGHTING",
            agent1: {
              id: "streamless-agent-a",
              hp: 20,
              damageDealtThisFight: 1,
            },
            agent2: {
              id: "streamless-agent-b",
              hp: 20,
              damageDealtThisFight: 0,
            },
          },
        });
        return;
      }
      if (requestUrl.pathname.includes("/inventory")) {
        sendJson({ inventory: [] });
        return;
      }
      if (requestUrl.pathname.includes("/monologues")) {
        sendJson({ thoughts: [] });
        return;
      }
      if (
        requestUrl.pathname === "/" ||
        requestUrl.pathname === "/api/streaming/state"
      ) {
        sendJson({ ok: true });
        return;
      }

      sendJson({ error: "not found" }, 404);
    });

    await new Promise<void>((resolve, reject) => {
      mockStack.once("error", reject);
      mockStack.listen(0, "127.0.0.1", resolve);
    });
    const address = mockStack.address();
    if (!address || typeof address === "string") {
      mockStack.close();
      throw new Error("mock duel stack did not expose a TCP address");
    }
    origin = `http://127.0.0.1:${address.port}`;

    try {
      const verifierArgs = [
        fileURLToPath(verifierUrl),
        "--server-url",
        origin,
        "--client-url",
        origin,
        "--hls-url",
        `${origin}/never-ready.m3u8`,
        "--skip-betting",
        "--timeout-ms",
        "1000",
        "--fight-timeout-ms",
        "1000",
        "--rtmp-timeout-ms",
        "250",
        "--poll-ms",
        "10",
      ];
      const { stdout } = await execFileAsync(
        process.execPath,
        [...verifierArgs, "--skip-stream"],
        { timeout: 5_000 },
      );

      expect(stdout).toContain("verification passed");
      expect(stdout).toContain('"skipStream": true');
      expect(hlsRequests).toBe(0);
      expect(rtmpRequests).toBe(0);

      await expect(
        execFileAsync(process.execPath, verifierArgs, { timeout: 5_000 }),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("Timed out waiting for HLS playlist"),
      });
      expect(hlsRequests).toBeGreaterThan(0);
      expect(rtmpRequests).toBeGreaterThan(0);

      await expect(
        execFileAsync(
          process.execPath,
          [
            ...verifierArgs,
            "--skip-stream",
            "--require-destinations",
            "twitch",
          ],
          { timeout: 5_000 },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining(
          "--skip-stream cannot be combined with --require-destinations",
        ),
      });
    } finally {
      await new Promise<void>((resolve) => mockStack.close(() => resolve()));
    }
  }, 10_000);

  it("holds the first duel until the complete launch surface is ready", () => {
    expect(launcherSource).toContain(
      "STREAMING_DUEL_MAINTENANCE_MODE: launcherOwnsStartupGate",
    );

    const contestantsIndex = launcherSource.indexOf(
      "await startContestants();",
    );
    const streamIndex = launcherSource.indexOf("await startStreamBridge();");
    const servicesIndex = launcherSource.indexOf("await startMarketMakers();");
    const releaseIndex = launcherSource.indexOf(
      "await setDuelMaintenanceMode(",
      contestantsIndex,
    );
    const verificationIndex = launcherSource.indexOf(
      'if (verifyEnabled) {\n    log("running startup verification checks...")',
    );

    expect(contestantsIndex).toBeGreaterThan(0);
    expect(streamIndex).toBeGreaterThan(contestantsIndex);
    expect(servicesIndex).toBeGreaterThan(streamIndex);
    expect(releaseIndex).toBeGreaterThan(servicesIndex);
    expect(verificationIndex).toBeGreaterThan(releaseIndex);
  });

  it("sends valid JSON for both startup maintenance actions", () => {
    expect(launcherSource).toContain('"content-type": "application/json"');
    expect(launcherSource).toMatch(
      /body: JSON\.stringify\(\s*enabled\s*\?\s*\{[\s\S]*?\}\s*:\s*\{\},\s*\)/,
    );
  });

  it("does not inject legacy, embedded, or home-page capture fallbacks", () => {
    expect(launcherSource).toContain(
      "GAME_FALLBACK_URLS: explicitStreamFallbackUrls",
    );
    expect(launcherSource).not.toContain("legacyStreamPageUrl");
    expect(launcherSource).not.toContain("embeddedSpectatorCaptureUrl");
    expect(launcherSource).not.toContain("homeCaptureUrl");
  });

  it("discovers only a complete SOL Hyperbet workspace and honors an explicit root", () => {
    const completeRoot = "/workspace/hyperbet-solana-implementation";
    const existing = new Set([
      `${completeRoot}/package.json`,
      `${completeRoot}/packages/hyperbet-solana/package.json`,
      `${completeRoot}/packages/hyperbet-solana/app/package.json`,
      `${completeRoot}/packages/hyperbet-solana/keeper/package.json`,
    ]);
    const workspace = resolveHyperbetWorkspace({
      workspaceRoot: "/workspace/hyperia",
      configuredRoot: completeRoot,
      existsSync: (candidate) => existing.has(String(candidate)),
    });

    expect(workspace).toMatchObject({
      root: completeRoot,
      solanaDir: `${completeRoot}/packages/hyperbet-solana`,
      appDir: `${completeRoot}/packages/hyperbet-solana/app`,
      keeperDir: `${completeRoot}/packages/hyperbet-solana/keeper`,
    });
    existing.delete(
      `${completeRoot}/packages/hyperbet-solana/keeper/package.json`,
    );
    expect(
      resolveHyperbetWorkspace({
        workspaceRoot: "/workspace/hyperia",
        configuredRoot: completeRoot,
        existsSync: (candidate) => existing.has(String(candidate)),
      }),
    ).toBeNull();
  });

  it("keeps the game origin, backend origin, and browser app origin distinct", () => {
    expect(
      resolveHyperbetRuntimeTopology({
        gameServerUrl: "http://127.0.0.1:5555/",
        hyperbetApiUrl: "http://localhost:8080",
        bettingPort: 4179,
      }),
    ).toEqual({
      gameOrigin: "http://127.0.0.1:5555",
      hyperbetApiUrl: "http://localhost:8080",
      hyperbetAppUrl: "http://localhost:4179",
      streamStateSourceUrl: "http://127.0.0.1:5555/api/streaming/state",
      bettingFeedStateUrl: "http://127.0.0.1:5555/api/internal/bet-sync/state",
      bettingFeedEventsUrl:
        "http://127.0.0.1:5555/api/internal/bet-sync/events",
    });
    expect(() =>
      normalizeHttpServiceUrl(
        "https://user:secret@example.test/path?token=secret",
        "service",
      ),
    ).toThrow();
  });

  it("requires a high-entropy private feed token and never substitutes the viewer token", () => {
    const generated = "a".repeat(64);
    expect(
      resolvePrivateBettingFeedToken(["", undefined], () => generated),
    ).toEqual({ token: generated, generated: true });
    expect(
      resolvePrivateBettingFeedToken(["b".repeat(32)], () => generated),
    ).toEqual({ token: "b".repeat(32), generated: false });
    expect(() =>
      resolvePrivateBettingFeedToken(["too-short"], () => generated),
    ).toThrow("at least 32 bytes");
  });

  it("creates a private local JWT secret and rejects unsupported server runtimes", () => {
    const generated = "c".repeat(64);
    expect(
      resolvePrivateRuntimeSecret(
        ["", undefined],
        () => generated,
        "The local duel JWT secret",
      ),
    ).toEqual({ token: generated, generated: true });
    expect(() =>
      resolvePrivateRuntimeSecret(
        ["too-short"],
        () => generated,
        "The local duel JWT secret",
      ),
    ).toThrow("at least 32 bytes");

    expect(assertSupportedUwsNodeVersion("v22.23.2")).toBe("22.23.2");
    expect(() => assertSupportedUwsNodeVersion("v22.23.1")).toThrow(
      "requires Node.js 22.23.2 exactly",
    );
    expect(() => assertSupportedUwsNodeVersion("v24.19.0")).toThrow(
      "requires Node.js 22.23.2 exactly",
    );
    expect(() => assertSupportedUwsNodeVersion("v25.2.1")).toThrow(
      "requires Node.js 22.23.2 exactly",
    );
    expect(() => assertSupportedUwsNodeVersion("not-a-version")).toThrow(
      "requires Node.js 22.23.2 exactly",
    );

    expect(launcherSource).toContain("JWT_SECRET: jwtCredential.token");
    expect(launcherSource).not.toMatch(/log\([^;]*jwtCredential\.token/s);
    expect(launcherSource).toContain("STREAMING_DUEL_SCHEDULER_ROLE:");
    expect(launcherSource).not.toContain("STREAMING_DUEL_ROLE:");
    expect(launcherSource).toContain(
      'configuredLocalPostgresPassword || "hyperia_dev_password"',
    );
    expect(launcherSource).toContain(
      "databaseConfiguration.useManagedLocalPostgres",
    );
  });

  it("falls back to verified model-free sparbots when no provider key exists", () => {
    expect(hasConfiguredDuelModelProvider({})).toBe(false);
    expect(
      hasConfiguredDuelModelProvider({ OPENAI_API_KEY: "  configured  " }),
    ).toBe(true);
    expect(hasConfiguredDuelModelProvider({ OPENAI_API_KEY: "   " })).toBe(
      false,
    );

    const sparbots = {
      success: true,
      spawned: [
        {
          characterId: "sparbot-standalone-a",
          name: "Riven Ash",
          tier: "adept",
        },
        {
          characterId: "sparbot-standalone-b",
          name: "Astra Vale",
          tier: "adept",
        },
      ],
    };
    expect(isStandaloneSparbotBootstrap(sparbots, 2)).toBe(true);
    expect(isStandaloneSparbotBootstrap(sparbots, 3)).toBe(false);
    expect(
      isStandaloneSparbotBootstrap(
        {
          ...sparbots,
          spawned: [{ ...sparbots.spawned[0], characterId: "model-agent" }],
        },
        1,
      ),
    ).toBe(false);

    expect(launcherSource).toContain("`${serverUrl}/admin/sparbots`");
    expect(launcherSource).toContain('"x-admin-code": adminCode');
    expect(launcherSource).toContain(
      "await seedStandaloneSparbots(\n        serverHttpUrl,",
    );
    expect(launcherSource).not.toMatch(/log\([^;]*adminCredential\.token/s);
  });

  it("fails before startup when standalone sparbots lack the exact no-money diagnostic boundary", () => {
    const validEnvironment = {
      NODE_ENV: "production",
      DUEL_LOCAL_SMOKE_MODE: "true",
      LOAD_TEST_MODE: "true",
      DUEL_BETTING_ENABLED: "false",
      DUEL_WITH_HYPERBET: "false",
      DUEL_HYPERBET_READ_ONLY_MODE: "false",
      STREAMING_DUEL_SCHEDULER_ROLE: "authority",
      PUBLIC_API_URL: "http://127.0.0.1:5555",
      PUBLIC_WS_URL: "ws://[::1]:5556/ws",
    };

    expect(
      assertStandaloneSparbotRuntimeBoundary({
        enabled: false,
        environment: {},
      }),
    ).toBe(false);
    expect(
      assertStandaloneSparbotRuntimeBoundary({
        enabled: true,
        environment: validEnvironment,
      }),
    ).toBe(true);
    expect(
      assertStandaloneSparbotRuntimeBoundary({
        enabled: true,
        environment: {
          ...validEnvironment,
          DUEL_WITH_HYPERBET: "true",
          DUEL_HYPERBET_READ_ONLY_MODE: "true",
        },
      }),
    ).toBe(true);

    for (const [name, value] of [
      ["NODE_ENV", "development"],
      ["DUEL_LOCAL_SMOKE_MODE", "false"],
      ["LOAD_TEST_MODE", "false"],
      ["DUEL_BETTING_ENABLED", "true"],
      ["DUEL_WITH_HYPERBET", "true"],
      ["STREAMING_DUEL_SCHEDULER_ROLE", "replica"],
      ["PUBLIC_API_URL", "https://arena.example"],
      ["PUBLIC_WS_URL", "wss://arena.example/ws"],
    ]) {
      expect(
        () =>
          assertStandaloneSparbotRuntimeBoundary({
            enabled: true,
            environment: { ...validEnvironment, [name]: value },
          }),
        name,
      ).toThrow("Standalone scripted sparbots require");
    }

    const assertionIndex = launcherSource.indexOf(
      "assertStandaloneSparbotRuntimeBoundary({",
    );
    const secretIndex = launcherSource.indexOf(
      "const bettingFeedCredential = resolvePrivateBettingFeedToken(",
    );
    const hlsMutationIndex = launcherSource.indexOf(
      "prepareHlsOutput(hlsOutputPath);",
    );
    const serverStartIndex = launcherSource.indexOf(
      'log("starting the native SOL duel server")',
    );
    expect(assertionIndex).toBeGreaterThan(0);
    expect(assertionIndex).toBeLessThan(hlsMutationIndex);
    expect(assertionIndex).toBeLessThan(secretIndex);
    expect(assertionIndex).toBeLessThan(serverStartIndex);
    expect(launcherSource).toContain('"local-smoke": { type: "boolean" }');
    expect(launcherSource).toContain(
      "DUEL_WITH_HYPERBET: effectiveDuelWithHyperbet",
    );
    expect(launcherSource).toContain(
      "DUEL_LOCAL_SMOKE_MODE: effectiveDuelLocalSmokeMode",
    );
    expect(launcherSource).toContain("LOAD_TEST_MODE: effectiveLoadTestMode");
    expect(launcherSource).toContain('(localSmokeRequested ? "5000" : "")');
    expect(launcherSource).toContain(
      "STREAMING_DUEL_PREPARATION_MS: effectiveDuelPreparationMs",
    );
  });

  it("resolves an explicit, deterministic combat style for every standalone sparbot", () => {
    expect(resolveStandaloneSparbotStyles("melee", 2)).toEqual([
      "melee",
      "melee",
    ]);
    expect(resolveStandaloneSparbotStyles("", 6)).toEqual([
      "melee",
      "ranged",
      "mage",
      "prayer",
      "melee",
      "ranged",
    ]);
    expect(resolveStandaloneSparbotStyles("AUTO", 2)).toEqual([
      "melee",
      "ranged",
    ]);
    expect(resolveStandaloneSparbotStyles("RANGED", 3)).toEqual([
      "ranged",
      "ranged",
      "ranged",
    ]);
    expect(resolveStandaloneSparbotStyles("ranged, mage", 2)).toEqual([
      "ranged",
      "mage",
    ]);
    expect(() => resolveStandaloneSparbotStyles("ranged,mage", 3)).toThrow(
      "exactly 3",
    );
    expect(() => resolveStandaloneSparbotStyles("ranged,unknown", 2)).toThrow(
      "melee, ranged, mage, prayer",
    );
    expect(() => resolveStandaloneSparbotStyles("melee", 21)).toThrow(
      "1 to 20",
    );

    expect(launcherSource).toContain('options["bot-styles"]');
    expect(launcherSource).toContain(
      'default: process.env.DUEL_BOT_STYLES || "auto"',
    );
    expect(launcherSource).toContain(
      "standalone scripted sparbots ready (${count}/${count}; ${styles.join",
    );
    expect(launcherSource).toContain(
      'process.env.STREAMING_DUEL_COMBAT_AI_ENABLED || "true"',
    );
    expect(launcherSource).not.toContain(
      'process.env.STREAMING_DUEL_COMBAT_AI_ENABLED || "false"',
    );
  });

  it("admits repeatable sparbot profiles only in the local-smoke lane", () => {
    expect(
      resolveStandaloneSparbotProfileSeed("", {
        enabled: true,
        localSmoke: true,
      }),
    ).toBeNull();
    expect(
      resolveStandaloneSparbotProfileSeed(" 0 ", {
        enabled: true,
        localSmoke: true,
      }),
    ).toBe(0);
    expect(
      resolveStandaloneSparbotProfileSeed("4294967295", {
        enabled: true,
        localSmoke: true,
      }),
    ).toBe(0xffffffff);

    for (const configured of ["-1", "1.5", "4294967296", "seed"] as const) {
      expect(() =>
        resolveStandaloneSparbotProfileSeed(configured, {
          enabled: true,
          localSmoke: true,
        }),
      ).toThrow("unsigned 32-bit integer");
    }
    expect(() =>
      resolveStandaloneSparbotProfileSeed("7", {
        enabled: false,
        localSmoke: true,
      }),
    ).toThrow("local-smoke no-money diagnostic lane");
    expect(() =>
      resolveStandaloneSparbotProfileSeed("7", {
        enabled: true,
        localSmoke: false,
      }),
    ).toThrow("local-smoke no-money diagnostic lane");

    expect(launcherSource).toContain('"sparbot-profile-seed": {');
    expect(launcherSource).toContain("DUEL_SPARBOT_PROFILE_SEED");
    expect(launcherSource).toContain("standaloneSparbotProfileSeed");
    expect(launcherSource).toContain(
      "...(profileSeed == null ? {} : { profileSeed })",
    );
  });

  it("keeps multi-style sparbots inside the explicit local no-money lane", () => {
    expect(
      assertMultiStyleSparbotOptions({
        enabled: false,
        localSmoke: false,
        styles: ["prayer"],
      }),
    ).toBe(false);
    expect(
      assertMultiStyleSparbotOptions({
        enabled: true,
        localSmoke: true,
        styles: ["melee", "ranged"],
      }),
    ).toBe(true);
    expect(() =>
      assertMultiStyleSparbotOptions({
        enabled: true,
        localSmoke: false,
        styles: ["melee", "ranged"],
      }),
    ).toThrow("local smoke mode");
    expect(() =>
      assertMultiStyleSparbotOptions({
        enabled: true,
        localSmoke: true,
        styles: ["melee", "prayer"],
      }),
    ).toThrow("melee/ranged/mage");
    expect(launcherSource).toContain(
      '"multi-style-sparbots": { type: "boolean" }',
    );
    expect(launcherSource).toContain("multiStyleSparbots");
    expect(launcherSource).toContain("multiStyle,");
  });

  it("validates authenticated bootstrap, fresh source sync, and fresh keeper health", () => {
    const bootstrap = {
      schemaVersion: 3,
      sourceEpoch: 100,
      seq: 3,
      emittedAt: 2_000,
      replay: { sourceEpoch: 100 },
    };
    expect(isBettingFeedBootstrap(bootstrap)).toBe(true);
    expect(isBettingFeedBootstrap({ ...bootstrap, schemaVersion: 1 })).toBe(
      false,
    );

    const status = {
      service: "hyperbet-solana-backend",
      stream: {
        sourceUrl: "http://127.0.0.1:5555/api/streaming/state",
        lastSourcePollAt: 5_000,
        lastSourceError: null,
        cycleId: "cycle-1",
        seq: 8,
      },
    };
    expect(
      isHyperbetStreamSynchronized(status, {
        sourceUrl: "http://127.0.0.1:5555/api/streaming/state",
        startedAtMs: 4_000,
      }),
    ).toBe(true);
    expect(
      isHyperbetStreamSynchronized(status, {
        sourceUrl: "http://127.0.0.1:5555/api/streaming/state",
        startedAtMs: 5_001,
      }),
    ).toBe(false);

    expect(
      isHyperbetStreamSynchronized(
        {
          ...status,
          stream: {
            ...status.stream,
            cycleId: "",
            phase: "IDLE",
          },
        },
        {
          sourceUrl: "http://127.0.0.1:5555/api/streaming/state",
          startedAtMs: 4_000,
        },
      ),
    ).toBe(true);
    expect(
      isHyperbetStreamSynchronized(
        {
          ...status,
          stream: {
            ...status.stream,
            cycleId: "boot-cycle",
            phase: "IDLE",
          },
        },
        {
          sourceUrl: "http://127.0.0.1:5555/api/streaming/state",
          startedAtMs: 4_000,
        },
      ),
    ).toBe(false);

    const readiness = {
      ok: true,
      readiness: { ready: true, reasons: [] },
      health: { running: true, bootedAtMs: 8_000 },
    };
    expect(isFreshHyperbetReadiness(readiness, 7_000)).toBe(true);
    expect(isFreshHyperbetReadiness(readiness, 8_001)).toBe(false);
  });

  it("strips signing authorities from the read-only backend environment", () => {
    expect(
      omitEnvironmentKeys(
        {
          PATH: "/bin",
          HELIUS_API_KEY: "server-provider-secret",
          KEEPER_FEE_PAYER_KEYPAIR: "authority-secret",
        },
        ["KEEPER_FEE_PAYER_KEYPAIR"],
      ),
    ).toEqual({
      PATH: "/bin",
      HELIUS_API_KEY: "server-provider-secret",
    });
  });

  it("boots the backend before the app, routes the UI through it, and gates private feed auth", () => {
    const backendSpawn = launcherSource.indexOf('"hyperbet-backend"');
    const appSpawn = launcherSource.indexOf('"betting-app"');
    expect(backendSpawn).toBeGreaterThan(0);
    expect(appSpawn).toBeGreaterThan(backendSpawn);
    expect(launcherSource).toContain(
      "VITE_GAME_API_URL: hyperbetTopology.hyperbetApiUrl",
    );
    expect(launcherSource).toContain("verifyAuthenticatedBettingFeed(");
    expect(launcherSource).toContain("BET_SYNC_SOURCE_BEARER_TOKEN:");
    expect(launcherSource).toContain("isHyperbetStreamSynchronized(");
    expect(launcherSource).toContain("isFreshHyperbetReadiness(");
    expect(launcherSource).toContain(
      'VITE_TRANSACTIONS_ENABLED: hyperbetReadOnlyMode ? "false" : "true"',
    );
    expect(launcherSource).toContain('STREAMING_CANONICAL_PLATFORM: "hls"');
    expect(launcherSource).toContain("STREAMING_CANONICAL_SOURCE_URL: hlsUrl");
    expect(launcherSource).toContain("VITE_STREAM_URL: hlsUrl");
    expect(launcherSource).toContain(
      "HLS_PUBLIC_DIR: path.dirname(hlsOutputPath)",
    );
    expect(launcherSource).toContain("hyperia-duel-hls-");
    expect(launcherSource).toContain("VITE_UI_SYNC_DELAY_MS:");
    expect(launcherSource).toContain("process.env.VITE_UI_SYNC_DELAY_MS ||");
    expect(launcherSource).toContain('"8000"');
    expect(launcherSource).not.toContain(
      "VITE_STREAM_URL: process.env.VITE_STREAM_URL",
    );
    expect(launcherSource).toContain(
      'verifyArgs.push("--hyperbet-api-url", hyperbetTopology.hyperbetApiUrl)',
    );
    expect(launcherSource).toContain('verifyArgs.push("--hyperbet-read-only")');
  });

  it("contains no retired token or perps launcher configuration", () => {
    expect(launcherSource).not.toMatch(/SOLANA_GOLD|GOLD_MINT|KEEPER_PERPS/);
    expect(launcherSource).not.toMatch(/ENABLE_PERPS|includeKeeperPerps/);
  });
});
