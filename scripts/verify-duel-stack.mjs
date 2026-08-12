#!/usr/bin/env node

/**
 * Duel stack verifier.
 *
 * Validates a running duel stack end-to-end:
 * - server/client/betting HTTP readiness
 * - active streaming duel with real combat progress (HP drop or damage)
 * - RTMP bridge ingest bytes
 * - duel telemetry APIs (inventory + monologues)
 */

import { parseArgs } from "node:util";

const values = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    "server-url": { type: "string", default: "http://localhost:5555" },
    "client-url": { type: "string", default: "http://localhost:3333" },
    "betting-url": { type: "string", default: "http://localhost:4179" },
    "hyperbet-api-url": { type: "string", default: "" },
    "hyperbet-read-only": { type: "boolean" },
    "hls-url": { type: "string", default: "" },
    "skip-stream": { type: "boolean" },
    "skip-betting": { type: "boolean" },
    "timeout-ms": { type: "string", default: "240000" },
    "fight-timeout-ms": { type: "string", default: "120000" },
    "rtmp-timeout-ms": { type: "string", default: "120000" },
    "require-destinations": { type: "string", default: "" },
    "poll-ms": { type: "string", default: "2000" },
    verbose: { type: "boolean", short: "v" },
  },
  strict: true,
}).values;

if (values.help) {
  console.log(`
Verify duel stack readiness and combat integrity.

Usage:
  bun run duel:verify [options]

Options:
  -h, --help                 Show help
  --server-url <url>         Game server URL (default: http://localhost:5555)
  --client-url <url>         Game client URL (default: http://localhost:3333)
  --betting-url <url>        Betting app URL (default: http://localhost:4179)
  --hyperbet-api-url <url>   Optional local Hyperbet backend to verify
  --hyperbet-read-only       Require spectator UI with no transaction controls
  --hls-url <url>            Optional HLS playlist URL to verify
  --skip-stream              Skip HLS, RTMP, and stream-player checks
  --skip-betting             Skip betting app HTTP readiness check
  --timeout-ms <ms>          General timeout (default: 240000)
  --fight-timeout-ms <ms>    Combat proof timeout (default: 120000)
  --rtmp-timeout-ms <ms>     Optional RTMP status timeout (default: 120000)
  --require-destinations <list>
                             Comma list of required RTMP destinations
                             (example: twitch,youtube)
  --poll-ms <ms>             Poll interval (default: 2000)
  -v, --verbose              Verbose polling logs
`);
  process.exit(0);
}

const serverUrl = values["server-url"].replace(/\/$/, "");
const clientUrl = values["client-url"].replace(/\/$/, "");
const bettingUrl = values["betting-url"].replace(/\/$/, "");
const hyperbetApiUrl = String(values["hyperbet-api-url"] || "")
  .trim()
  .replace(/\/$/, "");
const hyperbetReadOnly = values["hyperbet-read-only"] === true;
const hlsUrl = String(values["hls-url"] || "").trim();
const skipStream = values["skip-stream"] === true;
const skipBetting = values["skip-betting"] === true;
const timeoutMs = Number.parseInt(values["timeout-ms"], 10) || 240_000;
const fightTimeoutMs =
  Number.parseInt(values["fight-timeout-ms"], 10) || 120_000;
const rtmpTimeoutMs = Number.parseInt(values["rtmp-timeout-ms"], 10) || 120_000;
const requiredDestinations = Array.from(
  new Set(
    (values["require-destinations"] || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ),
);
const pollMs = Number.parseInt(values["poll-ms"], 10) || 2_000;
const verbose = values.verbose === true;

function log(message) {
  console.log(`[duel-verify] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, ms = 4000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, ms = 4000) {
  const response = await fetchWithTimeout(url, ms);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} at ${url}`);
  }
  return response.json();
}

async function fetchJsonWithRetry(
  label,
  url,
  {
    fetchTimeoutMs = 10_000,
    waitTimeoutMs = 20_000,
    validate = () => true,
  } = {},
) {
  return waitFor(
    label,
    async () => {
      const payload = await fetchJson(url, fetchTimeoutMs);
      return validate(payload) ? payload : null;
    },
    waitTimeoutMs,
  );
}

async function waitFor(label, check, checkTimeoutMs) {
  const deadline = Date.now() + checkTimeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) {
        log(`OK: ${label}`);
        return value;
      }
      lastError = null;
      if (verbose) {
        log(`waiting: ${label}`);
      }
    } catch (err) {
      lastError = err;
      if (verbose) {
        log(
          `waiting: ${label} (${err instanceof Error ? err.message : String(err)})`,
        );
      }
    }
    await sleep(pollMs);
  }

  const suffix = lastError
    ? ` last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function assertHttpOk(label, url, checkTimeoutMs) {
  await waitFor(
    label,
    async () => {
      const response = await fetchWithTimeout(url);
      return response.ok ? response.status : null;
    },
    checkTimeoutMs,
  );
}

async function assertServerAndDatabaseHealthy(url, checkTimeoutMs) {
  return waitFor(
    "server health with checked database",
    async () => {
      const payload = await fetchJson(url);
      const latencyMs = Number(payload?.database?.latencyMs);
      if (
        payload?.status !== "ok" ||
        payload?.database?.healthy !== true ||
        payload?.database?.status !== "healthy" ||
        !Number.isFinite(latencyMs) ||
        latencyMs < 0
      ) {
        return null;
      }
      return payload;
    },
    checkTimeoutMs,
  );
}

async function assertHlsReady(label, url, checkTimeoutMs) {
  await waitFor(
    label,
    async () => {
      const response = await fetchWithTimeout(url);
      if (!response.ok) return null;
      const body = await response.text();
      const hasPlaylist = body.includes("#EXTM3U");
      const hasMediaSegments =
        body.includes("#EXTINF:") ||
        body.includes("#EXT-X-PART:") ||
        /\.ts(?:$|\?)/.test(body) ||
        /\.m4s(?:$|\?)/.test(body);
      return hasPlaylist && hasMediaSegments ? body : null;
    },
    checkTimeoutMs,
  );
}

async function assertHyperbetBackendReady(checkTimeoutMs) {
  if (!hyperbetApiUrl) return null;
  const expectedSourceUrl = `${serverUrl}/api/streaming/state`;
  const status = await waitFor(
    "Hyperbet synchronized backend",
    async () => {
      const payload = await fetchJson(`${hyperbetApiUrl}/status`);
      const stream = payload?.stream;
      const sourceAgeMs = Date.now() - Number(stream?.lastSourcePollAt ?? 0);
      if (
        payload?.service !== "hyperbet-solana-backend" ||
        stream?.sourceUrl !== expectedSourceUrl ||
        stream?.lastSourceError !== null ||
        !Number.isSafeInteger(stream?.seq) ||
        stream.seq < 0 ||
        !Number.isFinite(sourceAgeMs) ||
        sourceAgeMs < 0 ||
        sourceAgeMs > 15_000
      ) {
        return null;
      }
      return payload;
    },
    checkTimeoutMs,
  );
  const matchup = await waitFor(
    "Hyperbet authoritative matchup",
    async () => {
      const proxied = await fetchJson(`${hyperbetApiUrl}/api/streaming/state`);
      const agent1Name = String(proxied?.cycle?.agent1?.name || "").trim();
      const agent2Name = String(proxied?.cycle?.agent2?.name || "").trim();
      if (!agent1Name || !agent2Name) return null;
      return { agentNames: [agent1Name, agent2Name] };
    },
    checkTimeoutMs,
  );
  return { ...status, agentNames: matchup.agentNames };
}

async function assertHyperbetBrowserReady(
  checkTimeoutMs,
  expectedAgentNames = [],
) {
  if (skipBetting || !hyperbetApiUrl) return null;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const consoleIssues = [];
  const pageErrors = [];
  const networkFailures = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "request failed";
      if (!failure.includes("ERR_ABORTED")) {
        networkFailures.push(`${failure} ${request.url()}`);
      }
    });

    await page.goto(bettingUrl, {
      waitUntil: "domcontentloaded",
      timeout: checkTimeoutMs,
    });
    await page
      .waitForFunction(
        ({
          apiUrl,
          expectedHlsUrl,
          expectedAgents,
          requireReadOnly,
          requireStream,
        }) => {
          const bodyText = document.body?.innerText?.trim() ?? "";
          const normalizedBodyText = bodyText.toLowerCase();
          const video = document.querySelector("video");
          const source = video?.currentSrc || video?.src || "";
          const declaredSource = video?.dataset.streamSource || "";
          const appRoot = document.querySelector(".hm-root");
          const streamedStateEmittedAt = Number(
            appRoot?.getAttribute("data-stream-state-emitted-at"),
          );
          const overlay = document.querySelector(
            "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
          );
          const backendObserved = performance
            .getEntriesByType("resource")
            .some((entry) => entry.name.startsWith(`${apiUrl}/api/streaming/`));
          const backendStateObserved =
            backendObserved ||
            (Number.isFinite(streamedStateEmittedAt) &&
              streamedStateEmittedAt > 0);
          const readOnlyLabel = document.querySelector(
            '[aria-label="Read-only spectator mode"]',
          );
          const transactionControl = document.querySelector(
            [
              '[data-testid="prediction-tab-buy"]',
              '[data-testid="prediction-amount-input"]',
              '[data-testid="prediction-submit"]',
              '[data-testid="solana-clob-price-input"]',
              '[data-testid="solana-clob-admin-toggle"]',
            ].join(","),
          );
          const agentNamesVisible = expectedAgents.every((name) =>
            normalizedBodyText.includes(name.toLowerCase()),
          );
          const walletCallToAction =
            /connect\s+(?:your\s+)?wallet|wallet\s+(?:to\s+)?connect/i.test(
              bodyText,
            );
          return Boolean(
            bodyText.length > 100 &&
            !overlay &&
            backendStateObserved &&
            (!requireStream ||
              (video &&
                video.readyState >= 2 &&
                !video.paused &&
                declaredSource.startsWith(expectedHlsUrl) &&
                (source.startsWith("blob:") ||
                  source.startsWith(expectedHlsUrl)))) &&
            agentNamesVisible &&
            (!requireReadOnly ||
              (readOnlyLabel && !transactionControl && !walletCallToAction)),
          );
        },
        {
          apiUrl: hyperbetApiUrl,
          expectedHlsUrl: hlsUrl,
          expectedAgents: expectedAgentNames,
          requireReadOnly: hyperbetReadOnly,
          requireStream: !skipStream,
        },
        { timeout: checkTimeoutMs },
      )
      .catch(async (error) => {
        const browserState = await page.evaluate(() => {
          const bodyText = document.body?.innerText?.trim() ?? "";
          const video = document.querySelector("video");
          const appRoot = document.querySelector(".hm-root");
          return {
            bodyPreview: bodyText.slice(0, 500),
            overlay: Boolean(
              document.querySelector(
                "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
              ),
            ),
            readOnly: Boolean(
              document.querySelector('[aria-label="Read-only spectator mode"]'),
            ),
            transactionControls: document.querySelectorAll(
              [
                '[data-testid="prediction-tab-buy"]',
                '[data-testid="prediction-amount-input"]',
                '[data-testid="prediction-submit"]',
                '[data-testid="solana-clob-price-input"]',
                '[data-testid="solana-clob-admin-toggle"]',
              ].join(","),
            ).length,
            currentSrc: video?.currentSrc || video?.src || "",
            declaredSource: video?.dataset.streamSource || "",
            readyState: video?.readyState ?? null,
            paused: video?.paused ?? null,
            currentTime: video ? Number(video.currentTime) : null,
            streamStateEmittedAt: Number(
              appRoot?.getAttribute("data-stream-state-emitted-at"),
            ),
          };
        });
        throw new Error(
          `Hyperbet browser readiness failed: ${error instanceof Error ? error.message : String(error)}; state=${JSON.stringify(browserState)}; console=${JSON.stringify(consoleIssues)}; network=${JSON.stringify(networkFailures)}`,
        );
      });

    let videoEvidence = { checked: false };
    if (!skipStream) {
      const startTime = await page
        .locator("video")
        .evaluate((video) => Number(video.currentTime));
      await page.waitForFunction(
        (start) => {
          const video = document.querySelector("video");
          return Boolean(
            video &&
            !video.paused &&
            video.readyState >= 2 &&
            Number(video.currentTime) >= start + 1,
          );
        },
        startTime,
        { timeout: Math.min(checkTimeoutMs, 20_000) },
      );
      videoEvidence = await page.locator("video").evaluate((video) => ({
        checked: true,
        currentSrc: video.currentSrc || video.src,
        declaredSource: video.dataset.streamSource || "",
        currentTime: Number(video.currentTime),
        readyState: video.readyState,
        paused: video.paused,
      }));
    }
    const evidence = { ...videoEvidence, expectedAgentNames };
    if (
      pageErrors.length > 0 ||
      consoleIssues.length > 0 ||
      networkFailures.length > 0
    ) {
      throw new Error(
        `Hyperbet browser emitted runtime failures: ${[
          ...pageErrors,
          ...consoleIssues,
          ...networkFailures,
        ].join(" | ")}`,
      );
    }
    log(
      skipStream
        ? "OK: Hyperbet browser backend and spectator controls (stream checks skipped)"
        : "OK: Hyperbet browser backend, spectator controls, and advancing HLS",
    );
    return evidence;
  } finally {
    await browser.close();
  }
}

function getAgentPair(context) {
  const agent1 = context?.cycle?.agent1 ?? null;
  const agent2 = context?.cycle?.agent2 ?? null;
  if (!agent1?.id || !agent2?.id) return null;
  return { agent1, agent2 };
}

function getDestinationNames(status) {
  if (!Array.isArray(status?.destinations)) return [];
  return status.destinations
    .map((dest) => String(dest?.name || "").trim())
    .filter(Boolean);
}

function hasRequiredDestinations(status, required) {
  if (required.length === 0) return true;
  const available = getDestinationNames(status).map((name) =>
    name.toLowerCase(),
  );
  return required.every((requiredName) =>
    available.some(
      (candidate) =>
        candidate === requiredName ||
        candidate.includes(requiredName) ||
        requiredName.includes(candidate),
    ),
  );
}

function resolveCanonicalPublicUrl(value, baseUrl) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("canonical stream source URL is missing");
  }
  try {
    return new URL(normalized, `${baseUrl.replace(/\/$/, "")}/`).toString();
  } catch {
    throw new Error(`canonical stream source URL is invalid: ${normalized}`);
  }
}

async function assertCanonicalStreamConfiguration(checkTimeoutMs) {
  const configuration = await fetchJsonWithRetry(
    "canonical stream configuration",
    `${serverUrl}/api/streaming/config`,
    {
      waitTimeoutMs: checkTimeoutMs,
      validate: (payload) =>
        typeof payload?.canonicalPlatform === "string" &&
        typeof payload?.canonicalSourceUrl === "string",
    },
  );
  const actualUrl = resolveCanonicalPublicUrl(
    configuration.canonicalSourceUrl,
    serverUrl,
  );
  const expectedUrl = hlsUrl
    ? resolveCanonicalPublicUrl(hlsUrl, serverUrl)
    : null;
  if (expectedUrl && configuration.canonicalPlatform !== "hls") {
    throw new Error(
      `canonical stream platform mismatch: expected hls, received ${configuration.canonicalPlatform}`,
    );
  }
  if (expectedUrl && actualUrl !== expectedUrl) {
    throw new Error(
      `canonical stream source mismatch: expected ${expectedUrl}, received ${actualUrl}`,
    );
  }
  return {
    platform: configuration.canonicalPlatform,
    sourceUrl: actualUrl,
    publicDelayMs: configuration.publicDelayMs,
  };
}

async function verify() {
  log("starting duel stack verification");

  if (skipStream && requiredDestinations.length > 0) {
    throw new Error(
      "--skip-stream cannot be combined with --require-destinations",
    );
  }

  const serverHealth = await assertServerAndDatabaseHealthy(
    `${serverUrl}/health`,
    timeoutMs,
  );
  await assertHttpOk(
    "streaming state",
    `${serverUrl}/api/streaming/state`,
    timeoutMs,
  );
  const canonicalStream = await assertCanonicalStreamConfiguration(timeoutMs);
  await assertHttpOk("client page", `${clientUrl}/`, timeoutMs);
  if (!skipBetting) {
    await assertHttpOk("betting app", `${bettingUrl}/`, timeoutMs);
  } else {
    log("skipping betting app readiness check (--skip-betting)");
  }
  const hyperbetBackend = await assertHyperbetBackendReady(timeoutMs);
  const hyperbetBrowser = await assertHyperbetBrowserReady(
    Math.min(timeoutMs, 60_000),
    hyperbetBackend?.agentNames ?? [],
  );

  const duelContextUrl = `${serverUrl}/api/streaming/duel-context`;
  const contestants = await waitFor(
    "streaming duel contestants",
    async () => {
      const context = await fetchJson(duelContextUrl);
      const pair = getAgentPair(context);
      if (!pair) return null;
      return { context, pair };
    },
    timeoutMs,
  );

  const { pair } = contestants;
  const agent1Id = pair.agent1.id;
  const agent2Id = pair.agent2.id;

  const fighting = await waitFor(
    "fighting phase",
    async () => {
      const context = await fetchJson(duelContextUrl);
      const currentPair = getAgentPair(context);
      if (!currentPair) return null;
      if (context?.cycle?.phase !== "FIGHTING") return null;
      return { context, pair: currentPair };
    },
    timeoutMs,
  );

  const initialHpA = Number(fighting.pair.agent1.hp ?? 0);
  const initialHpB = Number(fighting.pair.agent2.hp ?? 0);

  const combatEvidence = await waitFor(
    "combat evidence (HP drop or damage)",
    async () => {
      const context = await fetchJson(duelContextUrl);
      const currentPair = getAgentPair(context);
      if (!currentPair) return null;

      const hpA = Number(currentPair.agent1.hp ?? 0);
      const hpB = Number(currentPair.agent2.hp ?? 0);
      const dmgA = Number(currentPair.agent1.damageDealtThisFight ?? 0);
      const dmgB = Number(currentPair.agent2.damageDealtThisFight ?? 0);

      const hpDropped = hpA < initialHpA || hpB < initialHpB;
      const damageRecorded = dmgA > 0 || dmgB > 0;
      if (!hpDropped && !damageRecorded) {
        return null;
      }

      return {
        hpDropped,
        damageRecorded,
        hpA,
        hpB,
        dmgA,
        dmgB,
      };
    },
    fightTimeoutMs,
  );

  let rtmpEvidence = skipStream
    ? {
        checked: false,
        bytesReceived: null,
        note: "stream verification explicitly skipped",
      }
    : {
        checked: false,
        bytesReceived: null,
        note: "status unavailable",
      };
  const statusUrl = `${serverUrl}/api/streaming/rtmp/status`;
  let requiredDestinationNames = [];
  if (!skipStream && requiredDestinations.length > 0) {
    const status = await waitFor(
      `required RTMP destinations (${requiredDestinations.join(", ")})`,
      async () => {
        const next = await fetchJson(statusUrl);
        return hasRequiredDestinations(next, requiredDestinations)
          ? next
          : null;
      },
      rtmpTimeoutMs,
    );
    requiredDestinationNames = getDestinationNames(status);
  }

  if (!skipStream) {
    try {
      rtmpEvidence.checked = true;
      const requireRtmpTraffic = requiredDestinations.length > 0;
      const initial = await fetchJson(statusUrl);
      const initialBytes = Number(initial?.stats?.bytesReceived ?? 0);
      const bridgeActive = Boolean(
        initial?.active || initial?.ffmpegRunning || initial?.clientConnected,
      );
      if (requireRtmpTraffic && !bridgeActive) {
        await waitFor(
          "rtmp bridge activity",
          async () => {
            const next = await fetchJson(statusUrl);
            return next?.active || next?.ffmpegRunning || next?.clientConnected
              ? next
              : null;
          },
          rtmpTimeoutMs,
        );
      }

      if (initialBytes > 0) {
        rtmpEvidence = {
          checked: true,
          bytesReceived: initialBytes,
          note: "bytes observed immediately",
        };
      } else if (requireRtmpTraffic || bridgeActive) {
        const bytes = await waitFor(
          requireRtmpTraffic
            ? "rtmp ingest bytes"
            : "rtmp ingest bytes (optional)",
          async () => {
            const next = await fetchJson(statusUrl);
            const value = Number(next?.stats?.bytesReceived ?? 0);
            return value > 0 ? value : null;
          },
          rtmpTimeoutMs,
        );
        rtmpEvidence = {
          checked: true,
          bytesReceived: Number(bytes),
          note: requireRtmpTraffic
            ? "bytes observed via required status endpoint"
            : "bytes observed via status endpoint",
        };
      } else {
        rtmpEvidence.note =
          "bridge status endpoint not attached to external RTMP process";
      }
    } catch (error) {
      rtmpEvidence = {
        checked: true,
        bytesReceived: null,
        note: `status check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  if (
    requiredDestinations.length > 0 &&
    !(
      typeof rtmpEvidence.bytesReceived === "number" &&
      rtmpEvidence.bytesReceived > 0
    )
  ) {
    throw new Error(
      `required RTMP destinations never received ingest bytes (${rtmpEvidence.note})`,
    );
  }

  if (!skipStream && hlsUrl) {
    await assertHlsReady("HLS playlist", hlsUrl, rtmpTimeoutMs);
  } else if (skipStream) {
    log("skipping HLS and RTMP verification (--skip-stream)");
  }

  const telemetryTimeoutMs = Math.min(30_000, Math.max(10_000, pollMs * 6));
  const [inventoryA, inventoryB, thoughtsA, thoughtsB] = await Promise.all([
    fetchJsonWithRetry(
      `inventory telemetry for ${agent1Id}`,
      `${serverUrl}/api/streaming/agent/${agent1Id}/inventory`,
      {
        waitTimeoutMs: telemetryTimeoutMs,
        validate: (payload) => Array.isArray(payload?.inventory),
      },
    ),
    fetchJsonWithRetry(
      `inventory telemetry for ${agent2Id}`,
      `${serverUrl}/api/streaming/agent/${agent2Id}/inventory`,
      {
        waitTimeoutMs: telemetryTimeoutMs,
        validate: (payload) => Array.isArray(payload?.inventory),
      },
    ),
    fetchJsonWithRetry(
      `monologue telemetry for ${agent1Id}`,
      `${serverUrl}/api/streaming/agent/${agent1Id}/monologues?limit=5`,
      {
        waitTimeoutMs: telemetryTimeoutMs,
        validate: (payload) => Array.isArray(payload?.thoughts),
      },
    ),
    fetchJsonWithRetry(
      `monologue telemetry for ${agent2Id}`,
      `${serverUrl}/api/streaming/agent/${agent2Id}/monologues?limit=5`,
      {
        waitTimeoutMs: telemetryTimeoutMs,
        validate: (payload) => Array.isArray(payload?.thoughts),
      },
    ),
  ]);

  log("verification passed");
  console.log(
    JSON.stringify(
      {
        ok: true,
        serverUrl,
        clientUrl,
        bettingUrl,
        hlsUrl,
        canonicalStream,
        skipStream,
        skipBetting,
        hyperbet: hyperbetBackend
          ? {
              apiUrl: hyperbetApiUrl,
              sourceUrl: hyperbetBackend.stream.sourceUrl,
              sourceSeq: hyperbetBackend.stream.seq,
              readOnly: hyperbetReadOnly,
              browser: hyperbetBrowser,
            }
          : null,
        databaseHealth: serverHealth.database,
        agent1Id,
        agent2Id,
        combatEvidence,
        rtmpEvidence,
        requiredDestinations,
        requiredDestinationNames,
        telemetry: {
          inventoryA: inventoryA.inventory.length,
          inventoryB: inventoryB.inventory.length,
          thoughtsA: thoughtsA.thoughts.length,
          thoughtsB: thoughtsB.thoughts.length,
        },
      },
      null,
      2,
    ),
  );
}

verify().catch((err) => {
  console.error(
    `[duel-verify] FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
