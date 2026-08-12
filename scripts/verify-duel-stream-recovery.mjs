#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";

import {
  parseListenerPids,
  parseProcessSnapshot,
  validateCaptureRestartTarget,
} from "./duel-capture-restart-policy.mjs";

const execFileAsync = promisify(execFile);

const values = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    "betting-url": { type: "string" },
    "hyperbet-api-url": { type: "string" },
    "hyperia-url": { type: "string" },
    "capture-port": { type: "string" },
    "status-file": { type: "string" },
    "evidence-dir": { type: "string" },
    "timeout-ms": { type: "string", default: "90000" },
    "poll-ms": { type: "string", default: "250" },
  },
  strict: true,
}).values;

if (values.help) {
  console.log(`
Verify same-session Hyperbet fail-closed stream recovery.

Usage:
  node scripts/verify-duel-stream-recovery.mjs [options]

Required options:
  --betting-url <url>       Local Hyperbet application URL
  --hyperbet-api-url <url>  Local Hyperbet backend URL
  --hyperia-url <url>       Local Hyperia server URL
  --capture-port <port>     Smoke-owned capture listener to restart
  --status-file <path>      Smoke-owned RTMP status JSON to fault
  --evidence-dir <path>     New or empty directory for retained evidence

Optional:
  --timeout-ms <ms>         Per-stage deadline (default: 90000)
  --poll-ms <ms>            API polling cadence (default: 250)
`);
  process.exit(0);
}

const timeoutMs = Number.parseInt(String(values["timeout-ms"]), 10);
const pollMs = Number.parseInt(String(values["poll-ms"]), 10);
const capturePort = Number.parseInt(requiredText("capture-port"), 10);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 30_000) {
  throw new Error("--timeout-ms must be an integer of at least 30000");
}
if (!Number.isSafeInteger(pollMs) || pollMs < 50 || pollMs > 2_000) {
  throw new Error("--poll-ms must be an integer from 50 to 2000");
}
if (
  !Number.isSafeInteger(capturePort) ||
  capturePort < 1 ||
  capturePort > 65_535
) {
  throw new Error("--capture-port must be an integer from 1 to 65535");
}

function requiredText(name) {
  const value = String(values[name] ?? "").trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function normalizeLoopbackUrl(name) {
  const raw = requiredText(name);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`--${name} must be a valid URL`);
  }
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
  ) {
    throw new Error(`--${name} must use loopback HTTP`);
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.toString().replace(/\/$/, "");
}

const bettingUrl = normalizeLoopbackUrl("betting-url");
const hyperbetApiUrl = normalizeLoopbackUrl("hyperbet-api-url");
const hyperiaUrl = normalizeLoopbackUrl("hyperia-url");
const statusFile = path.resolve(requiredText("status-file"));
const evidenceDir = path.resolve(requiredText("evidence-dir"));
const screenshotPaths = Object.freeze({
  healthy: path.join(evidenceDir, "01-healthy.png"),
  unavailable: path.join(evidenceDir, "02-renderer-unavailable.png"),
  recovered: path.join(evidenceDir, "03-recovered.png"),
  captureRestarted: path.join(evidenceDir, "04-capture-restarted.png"),
});
const evidencePath = path.join(evidenceDir, "stream-recovery-evidence.json");

function log(message) {
  console.log(`[stream-recovery] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, requestTimeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithStatus(url, requestTimeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, requestTimeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/vnd.apple.mpegurl,text/plain" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeHlsManifest(raw) {
  const manifest = String(raw);
  const mediaSequenceMatch = manifest.match(
    /^#EXT-X-MEDIA-SEQUENCE:(\d+)\s*$/m,
  );
  const mediaSequence = mediaSequenceMatch
    ? Number.parseInt(mediaSequenceMatch[1], 10)
    : null;
  const lines = manifest.split(/\r?\n/);
  const segments = lines.filter((line) =>
    /\.(?:ts|m4s|mp4)(?:$|[?#])/i.test(line.trim()),
  );
  if (!Number.isSafeInteger(mediaSequence) || segments.length < 1) {
    throw new Error("HLS manifest has no valid media sequence or segments");
  }
  const programDateTimes = lines
    .filter((line) => line.startsWith("#EXT-X-PROGRAM-DATE-TIME:"))
    .map((line) => Date.parse(line.slice("#EXT-X-PROGRAM-DATE-TIME:".length)))
    .filter(Number.isFinite);
  const segmentDurations = lines
    .filter((line) => line.startsWith("#EXTINF:"))
    .map((line) => Number.parseFloat(line.slice("#EXTINF:".length)))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const targetDurationMatch = manifest.match(
    /^#EXT-X-TARGETDURATION:(\d+)\s*$/m,
  );
  return {
    mediaSequence,
    segmentCount: segments.length,
    firstSegment: segments[0],
    lastSegment: segments.at(-1),
    targetDurationSeconds: targetDurationMatch
      ? Number.parseInt(targetDurationMatch[1], 10)
      : null,
    totalDurationSeconds: Number(
      segmentDurations
        .reduce((total, duration) => total + duration, 0)
        .toFixed(3),
    ),
    firstProgramDateTimeMs: programDateTimes[0] ?? null,
    lastProgramDateTimeMs: programDateTimes.at(-1) ?? null,
    discontinuityCount: lines.filter((line) => line === "#EXT-X-DISCONTINUITY")
      .length,
  };
}

async function readCaptureRestartTarget() {
  const [listenerOutput, { stdout: processOutput }] = await Promise.all([
    execFileAsync("lsof", ["-nP", `-iTCP:${capturePort}`, "-sTCP:LISTEN", "-t"])
      .then(({ stdout }) => stdout)
      .catch((error) => {
        if (error?.code === 1) return String(error?.stdout ?? "");
        throw error;
      }),
    execFileAsync("ps", ["-axo", "pid=,pgid=,command="]),
  ]);
  return validateCaptureRestartTarget({
    capturePort,
    listenerPids: parseListenerPids(listenerOutput),
    processSnapshot: parseProcessSnapshot(processOutput),
    verifierPid: process.pid,
  });
}

async function readExternalCaptureStatus() {
  return JSON.parse(await fsp.readFile(statusFile, "utf8"));
}

function summarizeCaptureTarget(target) {
  return {
    capturePort: target.capturePort,
    listenerPid: target.listenerPid,
    groupId: target.groupId,
    leaderPid: target.leaderPid,
    memberCount: target.memberPids.length,
  };
}

async function waitFor(label, predicate) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await sleep(pollMs);
  }
  const detail = lastError
    ? `; last error=${lastError instanceof Error ? lastError.message : String(lastError)}`
    : "";
  throw new Error(`${label} was not observed within ${timeoutMs}ms${detail}`);
}

function rendererHealthFrom(payload) {
  return payload?.cycle?.rendererHealth ?? null;
}

function isHealthyRenderer(payload) {
  const health = rendererHealthFrom(payload);
  return Boolean(
    health?.ready === true &&
    health.degradedReason == null &&
    Number.isFinite(health.updatedAt) &&
    Date.now() - health.updatedAt >= 0 &&
    Date.now() - health.updatedAt <= 15_000,
  );
}

function isInjectedRendererFault(payload) {
  const health = rendererHealthFrom(payload);
  return Boolean(
    health?.ready === false &&
    health.degradedReason === "camera_target_unresolved" &&
    Number.isFinite(health.updatedAt),
  );
}

function isCaptureStartupFault(payload) {
  const health = rendererHealthFrom(payload);
  return Boolean(
    health?.ready === false &&
    typeof health.degradedReason === "string" &&
    health.degradedReason.startsWith("capture_") &&
    Number.isFinite(health.updatedAt),
  );
}

function summarizeCaptureLifecycle(raw, killedAt) {
  const lifecycle = raw?.captureLifecycle;
  if (
    !lifecycle ||
    !Number.isSafeInteger(lifecycle.processId) ||
    !Number.isFinite(lifecycle.processStartedAt) ||
    lifecycle.processStartedAt <= killedAt ||
    lifecycle.stage !== "streaming" ||
    !Array.isArray(lifecycle.transitions)
  ) {
    throw new Error("replacement capture lifecycle is missing or invalid");
  }

  const transitions = lifecycle.transitions.map((transition, index) => {
    const stage = String(transition?.stage ?? "").trim();
    const at = Number(transition?.at);
    if (!stage || !Number.isFinite(at) || at < lifecycle.processStartedAt) {
      throw new Error(
        `replacement capture lifecycle transition ${index} is invalid`,
      );
    }
    if (index > 0 && at < Number(lifecycle.transitions[index - 1]?.at)) {
      throw new Error("replacement capture lifecycle timestamps regressed");
    }
    return {
      stage,
      at,
      elapsedFromKillMs: at - killedAt,
      elapsedFromProcessStartMs: at - lifecycle.processStartedAt,
    };
  });
  const requiredStages = [
    "process_starting",
    "bridge_starting",
    "browser_launching",
    "page_loading",
    "renderer_waiting",
    "renderer_ready",
    "capture_warmup",
    "capture_starting",
    "streaming",
  ];
  const observedStages = new Set(transitions.map(({ stage }) => stage));
  const missingStages = requiredStages.filter(
    (stage) => !observedStages.has(stage),
  );
  if (missingStages.length > 0) {
    throw new Error(
      `replacement capture lifecycle missed stages: ${missingStages.join(", ")}`,
    );
  }

  return {
    processId: lifecycle.processId,
    processStartedAt: lifecycle.processStartedAt,
    processStartDelayMs: lifecycle.processStartedAt - killedAt,
    stage: lifecycle.stage,
    transitions,
  };
}

function summarizeApiState(payload) {
  return {
    seq: Number.isSafeInteger(payload?.seq) ? payload.seq : null,
    emittedAt: Number.isFinite(payload?.emittedAt) ? payload.emittedAt : null,
    cycleId: String(payload?.cycle?.cycleId ?? "") || null,
    duelId: String(payload?.cycle?.duelId ?? "") || null,
    phase: String(payload?.cycle?.phase ?? "") || null,
    agentNames: [
      String(payload?.cycle?.agent1?.name ?? "").trim(),
      String(payload?.cycle?.agent2?.name ?? "").trim(),
    ].filter(Boolean),
    rendererHealth: rendererHealthFrom(payload),
  };
}

async function prepareEvidenceDirectory() {
  await fsp.mkdir(evidenceDir, { recursive: true });
  const collisions = [...Object.values(screenshotPaths), evidencePath].filter(
    (candidate) => fs.existsSync(candidate),
  );
  if (collisions.length > 0) {
    throw new Error(
      `refusing to overwrite existing evidence: ${collisions.join(", ")}`,
    );
  }
}

async function waitForStatusTemplate() {
  return waitFor("healthy smoke-owned renderer status", async () => {
    const raw = await fsp.readFile(statusFile, "utf8");
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.destinations) ||
      !parsed.stats ||
      typeof parsed.stats !== "object" ||
      parsed.rendererHealth?.ready !== true
    ) {
      return null;
    }
    return parsed;
  });
}

function startRendererFaultInjection(initialTemplate) {
  let template = initialTemplate;
  let writeError = null;
  const writeFault = () => {
    try {
      try {
        const current = JSON.parse(fs.readFileSync(statusFile, "utf8"));
        if (
          current &&
          typeof current === "object" &&
          Array.isArray(current.destinations) &&
          current.stats &&
          typeof current.stats === "object"
        ) {
          template = current;
        }
      } catch {
        // A capture write may briefly overlap this read. The last complete
        // allowlisted template remains sufficient for the next fault sample.
      }
      const now = Date.now();
      const fault = {
        ...template,
        updatedAt: now,
        rendererHealth: {
          ...(template.rendererHealth ?? {}),
          ready: false,
          degradedReason: "camera_target_unresolved",
          updatedAt: now,
        },
      };
      fs.writeFileSync(statusFile, JSON.stringify(fault));
    } catch (error) {
      writeError = error;
    }
  };
  writeFault();
  const interval = setInterval(writeFault, 25);
  return {
    stop() {
      clearInterval(interval);
      if (writeError) {
        throw new Error(
          `renderer fault injection failed: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
        );
      }
    },
  };
}

async function readBrowserState(page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    const appRoot = document.querySelector(".hm-root");
    const recovery = document.querySelector(".hm-stream-recovery");
    const matchup = document.querySelector(".hm-matchup-label");
    const liveState = document.querySelector(".hm-live-state");
    const phaseBadges = Array.from(
      document.querySelectorAll(".hm-phase-badge"),
    ).map((node) => node.textContent?.trim() ?? "");
    const fighterCards = Array.from(
      document.querySelectorAll(".hm-spectator-fighter"),
    ).map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    return {
      bodyLength: document.body?.innerText?.trim().length ?? 0,
      recoveryVisible: Boolean(
        recovery &&
        recovery instanceof HTMLElement &&
        recovery.offsetParent !== null,
      ),
      recoveryText: recovery?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      matchupLabel: matchup?.textContent?.trim() ?? "",
      liveState: liveState?.textContent?.trim() ?? "",
      phaseBadges,
      fighterCardCount: fighterCards.length,
      fighterCards,
      logPhase:
        document.querySelector(".hm-log-phase")?.textContent?.trim() ?? "",
      logText:
        document.querySelector(".hm-log-text")?.textContent?.trim() ?? "",
      video: video
        ? {
            currentTime: Number(video.currentTime),
            currentSrc: video.currentSrc || video.src,
            declaredSource: video.dataset.streamSource || "",
            paused: video.paused,
            readyState: video.readyState,
          }
        : null,
      synchronization: appRoot
        ? {
            mode: appRoot.getAttribute("data-stream-sync-mode") || "",
            playbackDateMs: Number(
              appRoot.getAttribute("data-stream-playback-date-ms"),
            ),
            stateEmittedAt: Number(
              appRoot.getAttribute("data-stream-state-emitted-at"),
            ),
            skewMs: Number(appRoot.getAttribute("data-stream-sync-skew-ms")),
          }
        : null,
      marker: globalThis.__HYPERIA_STREAM_RECOVERY_MARKER__ ?? null,
      navigationEntries: performance.getEntriesByType("navigation").length,
    };
  });
}

function assertBrowserTelemetrySynchronized(state, label) {
  const synchronization = state?.synchronization;
  if (
    synchronization?.mode !== "program-date-time" ||
    !Number.isFinite(synchronization.playbackDateMs) ||
    synchronization.playbackDateMs <= 0 ||
    !Number.isFinite(synchronization.stateEmittedAt) ||
    synchronization.stateEmittedAt <= 0 ||
    !Number.isFinite(synchronization.skewMs) ||
    synchronization.skewMs < -250 ||
    synchronization.skewMs > 3_000
  ) {
    throw new Error(
      `${label} is not synchronized to the HLS program date: ${JSON.stringify(synchronization)}`,
    );
  }
}

async function waitForHealthyBrowser(page, expectedMarker, minimumVideoTime) {
  await page.waitForFunction(
    ({ marker, minTime }) => {
      const video = document.querySelector("video");
      const recovery = document.querySelector(".hm-stream-recovery");
      const appRoot = document.querySelector(".hm-root");
      const playbackDateMs = Number(
        appRoot?.getAttribute("data-stream-playback-date-ms"),
      );
      const stateEmittedAt = Number(
        appRoot?.getAttribute("data-stream-state-emitted-at"),
      );
      const skewMs = playbackDateMs - stateEmittedAt;
      return Boolean(
        globalThis.__HYPERIA_STREAM_RECOVERY_MARKER__ === marker &&
        !recovery &&
        document.querySelector(".hm-matchup-label")?.textContent?.trim() ===
          "Current Match" &&
        video &&
        video.readyState >= 2 &&
        !video.paused &&
        Number(video.currentTime) >= minTime &&
        appRoot?.getAttribute("data-stream-sync-mode") ===
          "program-date-time" &&
        Number.isFinite(playbackDateMs) &&
        playbackDateMs > 0 &&
        Number.isFinite(stateEmittedAt) &&
        stateEmittedAt > 0 &&
        skewMs >= -250 &&
        skewMs <= 3_000,
      );
    },
    { marker: expectedMarker, minTime: minimumVideoTime },
    { timeout: timeoutMs },
  );
  return readBrowserState(page);
}

function startBrowserObservation(page, startedAt) {
  const observations = [];
  let stopped = false;
  let failure = null;
  let lastKey = null;
  const loop = (async () => {
    while (!stopped) {
      try {
        const state = await readBrowserState(page);
        if (
          state.recoveryVisible &&
          (state.matchupLabel === "Current Match" ||
            state.liveState === "LIVE" ||
            state.fighterCardCount > 0 ||
            state.logPhase === "LIVE")
        ) {
          throw new Error(
            `unsafe recovery presentation: ${JSON.stringify(state)}`,
          );
        }
        if (
          ["UNAVAILABLE", "RECONNECTING"].includes(state.liveState) &&
          !state.recoveryVisible
        ) {
          throw new Error(
            `unexplained unavailable presentation: ${JSON.stringify(state)}`,
          );
        }
        const observation = {
          elapsedMs: Date.now() - startedAt,
          recoveryVisible: state.recoveryVisible,
          matchupLabel: state.matchupLabel,
          liveState: state.liveState,
          phaseBadges: state.phaseBadges,
          fighterCardCount: state.fighterCardCount,
          logPhase: state.logPhase,
          videoTime: state.video?.currentTime ?? null,
          videoReadyState: state.video?.readyState ?? null,
          videoPaused: state.video?.paused ?? null,
          synchronization: state.synchronization,
        };
        const key = JSON.stringify({
          recoveryVisible: observation.recoveryVisible,
          matchupLabel: observation.matchupLabel,
          liveState: observation.liveState,
          phaseBadges: observation.phaseBadges,
          fighterCardCount: observation.fighterCardCount,
          logPhase: observation.logPhase,
          videoReadyState: observation.videoReadyState,
          videoPaused: observation.videoPaused,
        });
        if (key !== lastKey) {
          observations.push(observation);
          lastKey = key;
        } else if (observations.length > 0) {
          observations[observations.length - 1] = observation;
        }
      } catch (error) {
        failure = error;
        stopped = true;
        break;
      }
      await sleep(100);
    }
  })();

  return {
    async stop() {
      stopped = true;
      await loop;
      if (failure) throw failure;
      return observations;
    },
  };
}

function isExpectedCaptureConsoleIssue(message) {
  return [
    "[StreamPlayer] HLS error:",
    "[StreamPlayer] Playback stalled",
    "[StreamPlayer] Playlist stalled",
    "[StreamPlayer] Rebuilding stream:",
    "[StreamPlayer] Non-fatal buffering/loading issue",
  ].some((prefix) => message.includes(prefix));
}

function isExpectedCaptureNetworkIssue(message) {
  return message.includes(`${hyperiaUrl}/live/`);
}

async function waitForUnavailableBrowser(page, expectedMarker) {
  await page.waitForFunction(
    (marker) => {
      const recovery = document.querySelector(".hm-stream-recovery");
      const recoveryText = recovery?.textContent?.replace(/\s+/g, " ") ?? "";
      const badges = Array.from(
        document.querySelectorAll(".hm-phase-badge"),
      ).map((node) => node.textContent?.trim());
      const unavailableDetails = document.querySelector(
        ".hm-spectator-unavailable",
      );
      return Boolean(
        globalThis.__HYPERIA_STREAM_RECOVERY_MARKER__ === marker &&
        recovery &&
        recovery instanceof HTMLElement &&
        recovery.offsetParent !== null &&
        recoveryText.includes("Live arena view temporarily unavailable") &&
        document.querySelector(".hm-matchup-label")?.textContent?.trim() ===
          "Waiting for stream" &&
        document.querySelector(".hm-live-state")?.textContent?.trim() ===
          "RECONNECTING" &&
        badges.length > 0 &&
        badges.every((badge) => badge === "RECONNECTING") &&
        unavailableDetails?.textContent?.includes(
          "Match details unavailable",
        ) &&
        unavailableDetails.textContent.includes(
          "Reconnecting to verified live arena telemetry.",
        ) &&
        document.querySelectorAll(".hm-spectator-fighter").length === 0 &&
        document.querySelector(".hm-log-phase")?.textContent?.trim() ===
          "RECONNECTING" &&
        document.querySelector(".hm-log-text")?.textContent?.trim() ===
          "Reconnecting to verified live arena telemetry.",
      );
    },
    expectedMarker,
    { timeout: timeoutMs },
  );
  return readBrowserState(page);
}

async function main() {
  await prepareEvidenceDirectory();
  const statusTemplate = await waitForStatusTemplate();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const consoleIssues = [];
  const pageErrors = [];
  const networkFailures = [];
  const expectedCaptureConsoleIssues = [];
  const expectedCaptureNetworkFailures = [];
  let captureFaultActive = false;
  let faultInjection = null;
  let page = null;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        const issue = `${message.type()}: ${message.text()}`;
        if (captureFaultActive && isExpectedCaptureConsoleIssue(issue)) {
          expectedCaptureConsoleIssues.push(issue);
        } else {
          consoleIssues.push(issue);
        }
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        const issue = `${response.status()} ${response.url()}`;
        if (captureFaultActive && isExpectedCaptureNetworkIssue(issue)) {
          expectedCaptureNetworkFailures.push(issue);
        } else {
          networkFailures.push(issue);
        }
      }
    });
    page.on("requestfailed", (request) => {
      const detail = request.failure()?.errorText || "request failed";
      if (!detail.includes("ERR_ABORTED")) {
        const issue = `${detail} ${request.url()}`;
        if (captureFaultActive && isExpectedCaptureNetworkIssue(issue)) {
          expectedCaptureNetworkFailures.push(issue);
        } else {
          networkFailures.push(issue);
        }
      }
    });

    const baselineApis = await waitFor(
      "healthy Hyperia and Hyperbet APIs",
      async () => {
        const [hyperia, hyperbet, hyperbetStatus] = await Promise.all([
          fetchJson(`${hyperiaUrl}/api/streaming/state`),
          fetchJson(`${hyperbetApiUrl}/api/streaming/state`),
          fetchJsonWithStatus(`${hyperbetApiUrl}/status`),
        ]);
        const names = [
          String(hyperbet?.cycle?.agent1?.name ?? "").trim(),
          String(hyperbet?.cycle?.agent2?.name ?? "").trim(),
        ];
        if (
          !isHealthyRenderer(hyperia) ||
          !isHealthyRenderer(hyperbet) ||
          names.some((name) => !name) ||
          hyperbetStatus.body?.stream?.sourceEventsEnabled !== true ||
          hyperbetStatus.body?.stream?.sourceEventsConnected !== true ||
          !Number.isFinite(
            hyperbetStatus.body?.stream?.sourceEventsLastEventAt,
          ) ||
          !Number.isSafeInteger(
            hyperbetStatus.body?.stream?.sourceEventsLastEventId,
          )
        ) {
          return null;
        }
        return { hyperia, hyperbet, hyperbetStatus, names };
      },
    );

    await page.goto(bettingUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const marker = `stream-recovery-${Date.now()}-${process.pid}`;
    await page.evaluate((value) => {
      globalThis.__HYPERIA_STREAM_RECOVERY_MARKER__ = value;
    }, marker);
    const baseline = await waitForHealthyBrowser(page, marker, 1);
    assertBrowserTelemetrySynchronized(baseline, "baseline browser");
    const firstVideoTime = baseline.video?.currentTime ?? 0;
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
      firstVideoTime,
      { timeout: Math.min(timeoutMs, 20_000) },
    );
    const healthyBrowser = await readBrowserState(page);
    await page.screenshot({ path: screenshotPaths.healthy, fullPage: true });
    log("healthy HLS, renderer authority, and current matchup observed");

    faultInjection = startRendererFaultInjection(statusTemplate);
    const faultApis = await waitFor("propagated renderer fault", async () => {
      const [hyperia, hyperbet] = await Promise.all([
        fetchJson(`${hyperiaUrl}/api/streaming/state`),
        fetchJson(`${hyperbetApiUrl}/api/streaming/state`),
      ]);
      return isInjectedRendererFault(hyperia) &&
        isInjectedRendererFault(hyperbet)
        ? { hyperia, hyperbet }
        : null;
    });
    const unavailableBrowser = await waitForUnavailableBrowser(page, marker);
    await page.screenshot({
      path: screenshotPaths.unavailable,
      fullPage: true,
    });
    log(
      "renderer fault cleared current matchup and exposed reconnecting state",
    );

    faultInjection.stop();
    faultInjection = null;
    const recoveredApis = await waitFor(
      "healthy renderer recovery",
      async () => {
        const [hyperia, hyperbet] = await Promise.all([
          fetchJson(`${hyperiaUrl}/api/streaming/state`),
          fetchJson(`${hyperbetApiUrl}/api/streaming/state`),
        ]);
        return isHealthyRenderer(hyperia) && isHealthyRenderer(hyperbet)
          ? { hyperia, hyperbet }
          : null;
      },
    );
    const recoveredBrowser = await waitForHealthyBrowser(
      page,
      marker,
      (healthyBrowser.video?.currentTime ?? 0) + 1,
    );
    assertBrowserTelemetrySynchronized(
      recoveredBrowser,
      "renderer-recovered browser",
    );
    await page.screenshot({ path: screenshotPaths.recovered, fullPage: true });

    if (
      recoveredBrowser.marker !== marker ||
      recoveredBrowser.navigationEntries !== healthyBrowser.navigationEntries
    ) {
      throw new Error("browser page reloaded during stream recovery");
    }

    const hlsPlaybackUrl = recoveredBrowser.video?.declaredSource ?? "";
    const parsedHlsUrl = new URL(hlsPlaybackUrl);
    if (
      parsedHlsUrl.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(parsedHlsUrl.hostname) ||
      !parsedHlsUrl.pathname.endsWith(".m3u8")
    ) {
      throw new Error("browser HLS source is not a loopback playlist");
    }
    const manifestBeforeRestart = summarizeHlsManifest(
      await fetchText(hlsPlaybackUrl),
    );
    const captureTargetBefore = await readCaptureRestartTarget();
    const captureKilledAt = Date.now();
    const captureObserver = startBrowserObservation(page, captureKilledAt);
    let captureObservations = [];
    let captureRestartResult;
    captureFaultActive = true;
    try {
      process.kill(-captureTargetBefore.groupId, "SIGKILL");
      const processReplacement = await waitFor(
        "supervised capture process replacement",
        async () => {
          const captureTargetAfter = await readCaptureRestartTarget();
          if (
            captureTargetAfter.groupId === captureTargetBefore.groupId ||
            (captureTargetBefore.listenerPid !== null &&
              captureTargetAfter.listenerPid ===
                captureTargetBefore.listenerPid)
          ) {
            return null;
          }
          return {
            captureTargetAfter,
            observedAt: Date.now(),
          };
        },
      );
      const lifecycleStarted = await waitFor(
        "replacement capture lifecycle status",
        async () => {
          const externalStatus = await readExternalCaptureStatus();
          return Number.isFinite(externalStatus?.updatedAt) &&
            externalStatus.updatedAt > captureKilledAt &&
            Number.isFinite(
              externalStatus?.captureLifecycle?.processStartedAt,
            ) &&
            externalStatus.captureLifecycle.processStartedAt > captureKilledAt
            ? { externalStatus, observedAt: Date.now() }
            : null;
        },
      );
      const captureStartupApis = await waitFor(
        "fail-closed capture startup state",
        async () => {
          const [hyperia, hyperbet] = await Promise.all([
            fetchJson(`${hyperiaUrl}/api/streaming/state`),
            fetchJson(`${hyperbetApiUrl}/api/streaming/state`),
          ]);
          return isCaptureStartupFault(hyperia) &&
            isCaptureStartupFault(hyperbet)
            ? { hyperia, hyperbet, observedAt: Date.now() }
            : null;
        },
      );
      const captureStartupBrowser = await waitForUnavailableBrowser(
        page,
        marker,
      );
      const captureStartupBrowserObservedAt = Date.now();

      const [readyStatus, readyApis, advancedManifest] = await Promise.all([
        waitFor("replacement capture status ready", async () => {
          const externalStatus = await readExternalCaptureStatus();
          return Number.isFinite(externalStatus?.updatedAt) &&
            externalStatus.updatedAt > captureKilledAt &&
            externalStatus?.rendererHealth?.ready === true &&
            externalStatus?.rendererHealth?.degradedReason == null &&
            externalStatus?.stats?.ffmpegRunning === true &&
            externalStatus?.captureLifecycle?.stage === "streaming"
            ? { externalStatus, observedAt: Date.now() }
            : null;
        }),
        waitFor("healthy capture restart APIs", async () => {
          const [hyperia, hyperbet] = await Promise.all([
            fetchJson(`${hyperiaUrl}/api/streaming/state`),
            fetchJson(`${hyperbetApiUrl}/api/streaming/state`),
          ]);
          return isHealthyRenderer(hyperia) && isHealthyRenderer(hyperbet)
            ? { hyperia, hyperbet, observedAt: Date.now() }
            : null;
        }),
        waitFor("advancing post-restart HLS manifest", async () => {
          const manifest = summarizeHlsManifest(
            await fetchText(hlsPlaybackUrl),
          );
          return manifest.mediaSequence > manifestBeforeRestart.mediaSequence
            ? { manifest, observedAt: Date.now() }
            : null;
        }),
      ]);
      captureRestartResult = {
        captureTargetAfter: processReplacement.captureTargetAfter,
        externalStatus: readyStatus.externalStatus,
        hyperia: readyApis.hyperia,
        hyperbet: readyApis.hyperbet,
        manifest: advancedManifest.manifest,
        phaseObservations: {
          processReplacedAt: processReplacement.observedAt,
          lifecycleStatusObservedAt: lifecycleStarted.observedAt,
          failClosedApisAt: captureStartupApis.observedAt,
          failClosedBrowserAt: captureStartupBrowserObservedAt,
          statusReadyAt: readyStatus.observedAt,
          apisReadyAt: readyApis.observedAt,
          manifestAdvancedAt: advancedManifest.observedAt,
        },
        captureStartupApis,
        captureStartupBrowser,
      };
      const captureRestartBrowser = await waitForHealthyBrowser(
        page,
        marker,
        (recoveredBrowser.video?.currentTime ?? 0) + 1,
      );
      assertBrowserTelemetrySynchronized(
        captureRestartBrowser,
        "capture-recovered browser",
      );
      const browserRecoveredAt = Date.now();
      await sleep(2_000);
      captureObservations = await captureObserver.stop();
      captureFaultActive = false;
      await page.screenshot({
        path: screenshotPaths.captureRestarted,
        fullPage: true,
      });
      const captureRestartScreenshotBrowser = await readBrowserState(page);
      assertBrowserTelemetrySynchronized(
        captureRestartScreenshotBrowser,
        "capture-recovered screenshot browser",
      );
      if (
        captureRestartScreenshotBrowser.marker !== marker ||
        captureRestartScreenshotBrowser.navigationEntries !==
          healthyBrowser.navigationEntries ||
        captureRestartScreenshotBrowser.video?.declaredSource !== hlsPlaybackUrl
      ) {
        throw new Error("browser identity changed during capture restart");
      }
      log(
        `capture process group ${captureTargetBefore.groupId} was replaced by ${captureRestartResult.captureTargetAfter.groupId} without reloading the viewer`,
      );
      captureRestartResult = {
        killedAt: captureKilledAt,
        recoveredAt: browserRecoveredAt,
        durationMs: browserRecoveredAt - captureKilledAt,
        targetBefore: summarizeCaptureTarget(captureTargetBefore),
        targetAfter: summarizeCaptureTarget(
          captureRestartResult.captureTargetAfter,
        ),
        manifestBefore: manifestBeforeRestart,
        manifestAfter: captureRestartResult.manifest,
        lifecycle: summarizeCaptureLifecycle(
          captureRestartResult.externalStatus,
          captureKilledAt,
        ),
        phaseObservations: Object.fromEntries(
          Object.entries(captureRestartResult.phaseObservations).map(
            ([key, at]) => [
              key,
              {
                at,
                elapsedFromKillMs: at - captureKilledAt,
              },
            ],
          ),
        ),
        failClosed: {
          hyperia: summarizeApiState(
            captureRestartResult.captureStartupApis.hyperia,
          ),
          hyperbet: summarizeApiState(
            captureRestartResult.captureStartupApis.hyperbet,
          ),
          browser: captureRestartResult.captureStartupBrowser,
        },
        hyperia: summarizeApiState(captureRestartResult.hyperia),
        hyperbet: summarizeApiState(captureRestartResult.hyperbet),
        browser: captureRestartScreenshotBrowser,
        observations: captureObservations,
      };
    } finally {
      captureFaultActive = false;
      if (captureObservations.length === 0) {
        captureObservations = await captureObserver.stop();
      }
    }
    if (
      pageErrors.length > 0 ||
      consoleIssues.length > 0 ||
      networkFailures.length > 0 ||
      expectedCaptureConsoleIssues.length > 40 ||
      expectedCaptureNetworkFailures.length > 40
    ) {
      throw new Error(
        `browser emitted runtime failures: ${[
          ...pageErrors,
          ...consoleIssues,
          ...networkFailures,
        ].join(
          " | ",
        )}; expected capture diagnostics=${expectedCaptureConsoleIssues.length} console/${expectedCaptureNetworkFailures.length} network`,
      );
    }

    const evidence = {
      schemaVersion: 2,
      capturedAt: new Date().toISOString(),
      scope: "local-no-money-stream-recovery",
      faults: ["camera_target_unresolved", "capture_process_group_sigkill"],
      browser: {
        name: browser.browserType().name(),
        version: browser.version(),
        viewport: { width: 1440, height: 900 },
        sameSessionMarkerRetained: true,
        navigationEntries: recoveredBrowser.navigationEntries,
      },
      baseline: {
        hyperia: summarizeApiState(baselineApis.hyperia),
        hyperbet: summarizeApiState(baselineApis.hyperbet),
        hyperbetSourceEvents: {
          status: baselineApis.hyperbetStatus.status,
          connected:
            baselineApis.hyperbetStatus.body.stream.sourceEventsConnected,
          lastEventAt:
            baselineApis.hyperbetStatus.body.stream.sourceEventsLastEventAt,
          lastEventId:
            baselineApis.hyperbetStatus.body.stream.sourceEventsLastEventId,
          sourceUrl: baselineApis.hyperbetStatus.body.stream.sourceEventsUrl,
        },
        browser: healthyBrowser,
      },
      unavailable: {
        hyperia: summarizeApiState(faultApis.hyperia),
        hyperbet: summarizeApiState(faultApis.hyperbet),
        browser: unavailableBrowser,
      },
      recovered: {
        hyperia: summarizeApiState(recoveredApis.hyperia),
        hyperbet: summarizeApiState(recoveredApis.hyperbet),
        browser: recoveredBrowser,
      },
      captureRestart: captureRestartResult,
      diagnostics: {
        consoleIssues,
        pageErrors,
        networkFailures,
        expectedCaptureConsoleIssues,
        expectedCaptureNetworkFailures,
      },
      screenshots: Object.fromEntries(
        Object.entries(screenshotPaths).map(([key, value]) => [
          key,
          path.basename(value),
        ]),
      ),
      limitations: [
        "Local read-only Hyperbet topology; no transaction or settlement authority was enabled.",
        "Renderer fault was injected into the smoke-owned status file; capture restart used a real SIGKILL against only the separately validated smoke-owned process group.",
        "No external broadcast destination or public network was involved.",
      ],
    };
    await fsp.writeFile(
      evidencePath,
      `${JSON.stringify(evidence, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    log(`PASS: same-session fail-closed recovery retained at ${evidencePath}`);
  } finally {
    if (faultInjection) {
      try {
        faultInjection.stop();
      } catch (error) {
        console.error(
          `[stream-recovery] cleanup warning: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await page?.close().catch(() => undefined);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    `[stream-recovery] FAIL: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
