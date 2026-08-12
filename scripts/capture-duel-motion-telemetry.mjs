#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import {
  buildDefaultCaptureLaunchArgs,
  applyCaptureFrameRateToUrl,
} from "../packages/server/src/streaming/captureBrowserPolicy.ts";
import {
  attachStreamingViewerToken,
  duelCaptureStatesAgree,
  evaluateDuelSceneCapture,
  normalizeDuelCaptureState,
} from "./duel-capture-scenarios.mjs";
import {
  DUEL_MOTION_TELEMETRY_LIMITS,
  evaluateDuelStyleSwitchTelemetry,
  isDuelMotionSamplingRace,
  parseDuelMotionRoles,
  parseDuelMotionSafeCrop,
  summarizeDuelHitReactionResolutionTelemetry,
  summarizeDuelHitReactionTelemetry,
  summarizeDuelStyleSwitchTelemetry,
  summarizeDuelMotionTelemetry,
} from "./duel-motion-telemetry.mjs";
import { summarizeDuelRangedTransitionTelemetry } from "./duel-ranged-transition-telemetry.mjs";
import { accumulateFightingObservation } from "./duel-fighting-observation.mjs";

const COMBAT_ROLES = new Set(["melee", "ranged", "mage"]);
const MAX_RETAINED_SAMPLES = 600;
const MAX_RETAINED_ERRORS = 100;

const options = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    "stream-url": {
      type: "string",
      default: "http://localhost:3333/stream.html",
    },
    "state-url": {
      type: "string",
      default: "http://localhost:5555/api/streaming/state",
    },
    "output-dir": {
      type: "string",
      default: "artifacts/duel-arena-motion-telemetry",
    },
    roles: { type: "string", default: "ranged,mage" },
    "multi-style": { type: "boolean" },
    "require-hit-reactions": { type: "boolean" },
    "require-ranged-transitions": { type: "boolean" },
    "network-latency-ms": { type: "string", default: "0" },
    "cpu-throttle-rate": { type: "string", default: "1" },
    "duration-s": { type: "string", default: "240" },
    "minimum-fighting-s": { type: "string" },
    "maximum-duration-s": { type: "string" },
    "poll-ms": { type: "string", default: "100" },
    viewport: { type: "string", default: "1920x1080" },
    "safe-ndc-x": { type: "string" },
    "safe-ndc-y": { type: "string" },
    headed: { type: "boolean" },
    verbose: { type: "boolean", short: "v" },
  },
  strict: true,
}).values;

if (options.help) {
  console.log(`
Read-only production-shaped duel motion and 60 FPS capture gate.

Usage:
  bun scripts/capture-duel-motion-telemetry.mjs [options]

Options:
  --stream-url <url>   Canonical stream page (streamFps=60 is enforced)
  --state-url <url>    Authenticated public state API
  --output-dir <path>  New evidence directory; an existing manifest is never overwritten
  --roles <csv>        Exact fixed pair, or melee,ranged,mage in multi-style mode
  --multi-style        Require both contestants to switch frozen combat roles live
  --require-hit-reactions Require repeated health/reaction alignment in the real avatar mixer
  --require-ranged-transitions Require repeated live nock/release/projectile continuity
  --network-latency-ms <n> Browser transport latency in milliseconds (0-2000)
  --cpu-throttle-rate <n> Browser CPU slowdown multiplier (1-20)
  --duration-s <n>     Minimum wall-clock capture window (default: 240)
  --minimum-fighting-s <n> Required accepted FIGHTING time; ranged-transition default: 60
  --maximum-duration-s <n> Hard wall-clock timeout; defaults to max(duration, 4x FIGHTING target)
  --poll-ms <n>        Browser/server poll interval (default: 100)
  --viewport <WxH>     Browser viewport (default: 1920x1080)
  --safe-ndc-x <n>     Optional maximum absolute fighter projection X (0,1]
  --safe-ndc-y <n>     Optional maximum absolute fighter projection Y (0,1]
  --headed             Show Chromium
  --verbose, -v        Print bounded progress every five seconds

The gate does not mutate combat or outcomes. It retains authoritative browser
scene samples only while browser/server public state agrees during FIGHTING,
then verifies movement, diagonal and directional coverage, facing, rotation,
transform agreement, arena containment, and renderer frame percentiles.
Viewer and state credentials are accepted only through
STREAMING_CAPTURE_VIEWER_TOKEN and STREAMING_CAPTURE_STATE_TOKEN and are never
written to evidence. When no distinct state token is supplied, the viewer
token also authorizes the state cross-check so both probes use the same
authoritative timeline instead of mixing live and intentionally delayed state.
`);
  process.exit(0);
}

function parseBoundedInteger(value, fallback, minimum, maximum, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  const normalized = Number.isSafeInteger(parsed) ? parsed : fallback;
  if (normalized < minimum || normalized > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}`);
  }
  return normalized;
}

function parseBoundedNumber(value, fallback, minimum, maximum, label) {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  if (normalized < minimum || normalized > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}`);
  }
  return normalized;
}

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(String(value ?? "").trim());
  if (!match) throw new TypeError("viewport must use WIDTHxHEIGHT format");
  return {
    width: parseBoundedInteger(match[1], 0, 320, 7680, "viewport width"),
    height: parseBoundedInteger(match[2], 0, 320, 4320, "viewport height"),
  };
}

function parseHttpUrl(value, label) {
  const url = new URL(String(value ?? ""));
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`${label} must use HTTP or HTTPS`);
  }
  if (url.username || url.password || url.hash) {
    throw new TypeError(`${label} cannot contain credentials or a fragment`);
  }
  return url;
}

function publicUrl(url) {
  const copy = new URL(url);
  copy.search = "";
  copy.hash = "";
  return copy.toString();
}

function boundedMessage(value, maximumLength = 500) {
  return String(value ?? "")
    .replace(/(?:https?|wss?):\/\/[^\s)'"<>]+/gi, (candidate) => {
      try {
        return publicUrl(new URL(candidate));
      } catch {
        return "redacted-url";
      }
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function redactRequestUrl(value) {
  try {
    return publicUrl(new URL(value));
  } catch {
    return "invalid-url";
  }
}

function increment(counter, key) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function fetchState(url, bearerToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`state HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readBrowserProbe(page) {
  return page.evaluate(() => {
    const runtimeWindow = window;
    const documentElement = document.documentElement;
    const body = document.body;
    return {
      state: runtimeWindow.__HYPERIA_STREAM_STATE__ ?? null,
      rendererHealth: runtimeWindow.__HYPERIA_STREAM_RENDERER_HEALTH__ ?? null,
      performance: runtimeWindow.__HYPERIA_STREAM_PERFORMANCE__ ?? null,
      sceneDiagnostics:
        runtimeWindow.__HYPERIA_STREAM_SCENE_DIAGNOSTICS__ ?? null,
      layout: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: Math.max(
          documentElement.scrollWidth,
          body?.scrollWidth ?? 0,
        ),
        scrollHeight: Math.max(
          documentElement.scrollHeight,
          body?.scrollHeight ?? 0,
        ),
        canvasCount: document.querySelectorAll("canvas").length,
        activeHudCount: document.querySelectorAll(".streaming-duel-info")
          .length,
        errorOverlayCount: document.querySelectorAll(
          "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
        ).length,
        activeCombatRoles: Array.from(
          document.querySelectorAll("[data-active-combat-role]"),
        )
          .map((element) => element.getAttribute("data-active-combat-role"))
          .filter(Boolean),
        styleSwitchEventCount: document.querySelectorAll(
          '[data-event-kind="style_switch"]',
        ).length,
      },
    };
  });
}

function exactDiagnosticRole(agent) {
  const roles = [...new Set(agent?.availableCombatStyles ?? [])].filter(
    (role) => COMBAT_ROLES.has(role),
  );
  return roles.length === 1 ? roles[0] : null;
}

function resolveFrozenCombatRole(agent) {
  if (agent?.loadoutFrozen !== true) return null;
  const weaponId = agent?.equipment?.weapon;
  if (typeof weaponId !== "string" || !weaponId.trim()) return null;
  const allowedRoles = new Set(agent?.availableCombatStyles ?? []);
  const matches = [...COMBAT_ROLES].filter((role) => {
    if (!allowedRoles.has(role)) return false;
    const loadout = agent?.combatLoadouts?.[role];
    return loadout?.role === role && loadout?.weaponId === weaponId;
  });
  return matches.length === 1 ? matches[0] : null;
}

function roleSetMatches(roles, expectedRoles) {
  return (
    JSON.stringify([...roles].sort()) ===
    JSON.stringify([...expectedRoles].sort())
  );
}

function publicRoleStateMatches(publicAgents, expectedRoles, multiStyle) {
  if (!multiStyle) {
    return roleSetMatches(publicAgents.map(exactDiagnosticRole), expectedRoles);
  }
  return publicAgents.every((agent) => {
    const available = [...new Set(agent?.availableCombatStyles ?? [])].filter(
      (role) => COMBAT_ROLES.has(role),
    );
    const loadoutRoles = Object.keys(agent?.combatLoadouts ?? {}).filter(
      (role) => COMBAT_ROLES.has(role),
    );
    return (
      roleSetMatches(available, expectedRoles) &&
      roleSetMatches(loadoutRoles, expectedRoles) &&
      resolveFrozenCombatRole(agent) !== null
    );
  });
}

function buildMotionSample(browserState, diagnostics, observedAt, multiStyle) {
  const publicAgents = [
    browserState?.cycle?.agent1,
    browserState?.cycle?.agent2,
  ];
  const roles = publicAgents.map((agent) =>
    multiStyle ? resolveFrozenCombatRole(agent) : exactDiagnosticRole(agent),
  );
  const combatStats = publicAgents.map((agent) => ({
    hp: Number(agent?.hp),
    maxHp: Number(agent?.maxHp),
    attacksLanded: Number(agent?.attacksLanded),
  }));
  if (roles.some((role) => role == null)) return null;
  if (
    combatStats.some(
      ({ hp, maxHp, attacksLanded }) =>
        !Number.isFinite(hp) ||
        hp < 0 ||
        !Number.isFinite(maxHp) ||
        maxHp <= 0 ||
        hp > maxHp ||
        !Number.isSafeInteger(attacksLanded) ||
        attacksLanded < 0,
    )
  ) {
    return null;
  }
  if (diagnostics.agents.some((agent) => agent == null)) return null;
  return {
    observedAt,
    sceneUpdatedAt: diagnostics.updatedAt,
    cycleId: diagnostics.cycleId,
    renderedSeparationXZ: diagnostics.renderedSeparationXZ,
    agents: diagnostics.agents.map((agent, index) => ({
      id: agent.id,
      role: roles[index],
      hp: combatStats[index].hp,
      maxHp: combatStats[index].maxHp,
      attacksLanded: combatStats[index].attacksLanded,
      renderPosition: agent.renderPosition,
      simulationPosition: agent.simulationPosition,
      avatarPosition: agent.avatarPosition,
      renderQuaternion: agent.renderQuaternion,
      ndcPosition: agent.ndcPosition,
      facingTargetErrorDegrees: agent.facingTargetErrorDegrees,
      insideCombatArena: agent.insideCombatArena,
      visible: agent.visible,
      active: agent.active,
      avatarReady: agent.avatarReady,
      hitReaction: agent.hitReaction ?? null,
      avatarEmote: agent.avatarEmote ?? null,
    })),
  };
}

function buildHitReactionLifecycleSample(state, diagnostics, observedAt) {
  if (
    !state ||
    !["FIGHTING", "RESOLUTION"].includes(state.phase) ||
    diagnostics.cycleId !== state.cycleId ||
    diagnostics.phase !== state.phase
  ) {
    return null;
  }
  const publicAgents = [state.agent1, state.agent2];
  if (
    publicAgents.some((agent) => agent == null) ||
    diagnostics.agents.some(
      (agent, index) => !agent || agent.id !== publicAgents[index]?.id,
    )
  ) {
    return null;
  }
  return {
    observedAt,
    sceneUpdatedAt: diagnostics.updatedAt,
    cycleId: state.cycleId,
    phase: state.phase,
    agents: diagnostics.agents.map((agent, index) => ({
      id: agent.id,
      hp: publicAgents[index].hp,
      hitReaction: agent.hitReaction ?? null,
      avatarEmote: agent.avatarEmote ?? null,
    })),
  };
}

function finitePositionTuple(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const tuple = value.map(Number);
  return tuple.every(Number.isFinite) ? tuple : null;
}

function buildRangedTransitionSnapshot(
  rawSceneDiagnostics,
  normalizedDiagnostics,
  roles,
  observedAt,
) {
  const rangedPlayerIds = normalizedDiagnostics.agents.flatMap(
    (agent, index) => (agent && roles[index] === "ranged" ? [agent.id] : []),
  );
  if (rangedPlayerIds.length === 0) return null;
  const presentation = rawSceneDiagnostics?.combatPresentation;
  const bow = presentation?.bow;
  const projectiles = presentation?.projectiles;
  if (
    bow?.schemaVersion !== 1 ||
    projectiles?.schemaVersion !== 1 ||
    !Number.isSafeInteger(bow.latestSequence) ||
    bow.latestSequence < 0 ||
    !Number.isSafeInteger(projectiles.latestSequence) ||
    projectiles.latestSequence < 0 ||
    !Array.isArray(bow.players) ||
    !Array.isArray(bow.recentTransitions) ||
    !Array.isArray(projectiles.activeArrows) ||
    !Array.isArray(projectiles.recentArrowSpawns) ||
    !Number.isSafeInteger(projectiles.arrowCancelledBeforeSpawnCount) ||
    projectiles.arrowCancelledBeforeSpawnCount < 0
  ) {
    return null;
  }

  const rangedSet = new Set(rangedPlayerIds);
  const players = bow.players
    .filter((player) => rangedSet.has(player?.playerId))
    .map((player) => ({
      playerId: player.playerId,
      itemId:
        typeof player.itemId === "string" && player.itemId.length <= 160
          ? player.itemId
          : null,
      controllerReady: player.controllerReady === true,
      nockedArrowVisible: player.nockedArrowVisible === true,
      nockedArrowWorldPosition:
        player.nockedArrowWorldPosition == null
          ? null
          : finitePositionTuple(player.nockedArrowWorldPosition),
    }));
  if (
    players.length !== rangedPlayerIds.length ||
    players.some(
      (player) => player.nockedArrowVisible && !player.nockedArrowWorldPosition,
    )
  ) {
    return null;
  }

  const normalizeTransition = (transition) => {
    if (
      !Number.isSafeInteger(transition?.sequence) ||
      transition.sequence < 0 ||
      !rangedSet.has(transition.playerId) ||
      !["scheduled", "released", "cancelled"].includes(transition.kind) ||
      !Number.isFinite(transition.performanceTimeMs)
    ) {
      return null;
    }
    const normalized = {
      sequence: transition.sequence,
      playerId: transition.playerId,
      itemId:
        typeof transition.itemId === "string" && transition.itemId.length <= 160
          ? transition.itemId
          : null,
      kind: transition.kind,
      performanceTimeMs: transition.performanceTimeMs,
    };
    if (transition.kind === "scheduled") {
      return Number.isFinite(transition.releaseAtPerformanceTimeMs)
        ? {
            ...normalized,
            releaseAtPerformanceTimeMs: transition.releaseAtPerformanceTimeMs,
          }
        : null;
    }
    if (transition.kind === "released") {
      const lastVisibleNockWorldPosition = finitePositionTuple(
        transition.lastVisibleNockWorldPosition,
      );
      const drawHandWorldPosition = finitePositionTuple(
        transition.drawHandWorldPosition,
      );
      return lastVisibleNockWorldPosition && drawHandWorldPosition
        ? {
            ...normalized,
            lastVisibleNockWorldPosition,
            drawHandWorldPosition,
          }
        : null;
    }
    return normalized;
  };
  const normalizeSpawn = (spawn) => {
    const startPosition = finitePositionTuple(spawn?.startPosition);
    const targetPosition = finitePositionTuple(spawn?.targetPosition);
    if (
      !Number.isSafeInteger(spawn?.sequence) ||
      spawn.sequence < 0 ||
      !rangedSet.has(spawn.attackerId) ||
      typeof spawn.targetId !== "string" ||
      spawn.targetId.length === 0 ||
      spawn.targetId.length > 160 ||
      !Number.isFinite(spawn.performanceTimeMs) ||
      !startPosition ||
      !targetPosition
    ) {
      return null;
    }
    return {
      sequence: spawn.sequence,
      attackerId: spawn.attackerId,
      targetId: spawn.targetId,
      arrowId:
        typeof spawn.arrowId === "string" && spawn.arrowId.length <= 160
          ? spawn.arrowId
          : null,
      networkEventId:
        typeof spawn.networkEventId === "string" &&
        spawn.networkEventId.length > 0 &&
        spawn.networkEventId.length <= 160
          ? spawn.networkEventId
          : null,
      performanceTimeMs: spawn.performanceTimeMs,
      startPosition,
      targetPosition,
      travelDurationMs: Number.isFinite(spawn.travelDurationMs)
        ? spawn.travelDurationMs
        : null,
    };
  };

  if (!rangedTransitionBaselineInitialized) {
    rangedTransitionBaselineInitialized = true;
    lastBowTransitionSequence = bow.latestSequence;
    lastArrowSpawnSequence = projectiles.latestSequence;
    rangedTransitionCancelledBeforeSpawnBaseline =
      projectiles.arrowCancelledBeforeSpawnCount;
  }
  if (
    bow.latestSequence < lastBowTransitionSequence ||
    projectiles.latestSequence < lastArrowSpawnSequence
  ) {
    return null;
  }
  const rawTransitions = bow.recentTransitions.filter(
    (transition) => transition?.sequence > lastBowTransitionSequence,
  );
  const transitions = rawTransitions.map(normalizeTransition);
  const rawSpawns = projectiles.recentArrowSpawns.filter(
    (spawn) =>
      spawn?.sequence > lastArrowSpawnSequence &&
      rangedSet.has(spawn?.attackerId),
  );
  const spawnEvents = rawSpawns.map(normalizeSpawn);
  const activeArrows = projectiles.activeArrows
    .filter((arrow) => rangedSet.has(arrow?.attackerId))
    .map(normalizeSpawn);
  if (
    transitions.some((transition) => transition === null) ||
    spawnEvents.some((spawn) => spawn === null) ||
    activeArrows.some((spawn) => spawn === null)
  ) {
    return null;
  }
  lastBowTransitionSequence = bow.latestSequence;
  lastArrowSpawnSequence = projectiles.latestSequence;
  return {
    observedAt,
    cycleId: normalizedDiagnostics.cycleId,
    rangedPlayerIds,
    players,
    transitions,
    spawnEvents,
    activeArrows,
    arrowCancelledBeforeSpawnCount: projectiles.arrowCancelledBeforeSpawnCount,
    arrowCancelledBeforeSpawnDelta:
      projectiles.arrowCancelledBeforeSpawnCount -
      rangedTransitionCancelledBeforeSpawnBaseline,
  };
}

const multiStyle = options["multi-style"] === true;
const requireHitReactions = options["require-hit-reactions"] === true;
const requireRangedTransitions = options["require-ranged-transitions"] === true;
const expectedRoles = parseDuelMotionRoles(options.roles, multiStyle);
const networkLatencyMs = parseBoundedInteger(
  options["network-latency-ms"],
  0,
  0,
  2_000,
  "network-latency-ms",
);
const cpuThrottleRate = parseBoundedNumber(
  options["cpu-throttle-rate"],
  1,
  1,
  20,
  "cpu-throttle-rate",
);
if (requireRangedTransitions && !expectedRoles.includes("ranged")) {
  throw new TypeError(
    "require-ranged-transitions needs at least one ranged role",
  );
}
if (
  requireRangedTransitions &&
  (networkLatencyMs < 100 || cpuThrottleRate < 2)
) {
  throw new RangeError(
    "require-ranged-transitions needs at least 100 ms browser latency and 2x CPU throttling",
  );
}
const rawStreamUrl = parseHttpUrl(options["stream-url"], "stream-url");
const streamUrl = new URL(
  applyCaptureFrameRateToUrl(rawStreamUrl.toString(), 60),
);
const streamingViewerToken = String(
  process.env.STREAMING_CAPTURE_VIEWER_TOKEN ?? "",
).trim();
const streamNavigationUrl = attachStreamingViewerToken(
  streamUrl,
  streamingViewerToken,
);
const stateUrl = parseHttpUrl(options["state-url"], "state-url");
const explicitStateBearerToken = String(
  process.env.STREAMING_CAPTURE_STATE_TOKEN ?? "",
).trim();
const stateBearerToken = explicitStateBearerToken || streamingViewerToken;
const stateAuthorizationMode = explicitStateBearerToken
  ? "explicit_state_token"
  : streamingViewerToken
    ? "viewer_token_fallback"
    : "public";
const outputDirectory = path.resolve(String(options["output-dir"]));
const manifestPath = path.join(outputDirectory, "manifest.json");
const screenshotPath = path.join(outputDirectory, "fighting-motion.png");
const durationSeconds = parseBoundedInteger(
  options["duration-s"],
  240,
  15,
  3_600,
  "duration-s",
);
const minimumFightingSeconds = parseBoundedInteger(
  options["minimum-fighting-s"],
  requireRangedTransitions ? 60 : 0,
  0,
  3_600,
  "minimum-fighting-s",
);
const maximumDurationSeconds = parseBoundedInteger(
  options["maximum-duration-s"],
  Math.max(durationSeconds, minimumFightingSeconds * 4),
  durationSeconds,
  7_200,
  "maximum-duration-s",
);
const durationMs = durationSeconds * 1_000;
const minimumFightingObservationMs = minimumFightingSeconds * 1_000;
const maximumDurationMs = maximumDurationSeconds * 1_000;
const pollMs = parseBoundedInteger(
  options["poll-ms"],
  100,
  50,
  1_000,
  "poll-ms",
);
const viewport = parseViewport(options.viewport);
const safeCrop = parseDuelMotionSafeCrop(
  options["safe-ndc-x"],
  options["safe-ndc-y"],
);

await access(manifestPath)
  .then(() => {
    throw new Error(`refusing to overwrite existing evidence: ${manifestPath}`);
  })
  .catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);

const captureHeadless = options.headed !== true;
const captureAngleBackend =
  String(process.env.STREAMING_CAPTURE_ANGLE ?? "").trim() ||
  (process.platform === "darwin" ? "metal" : "vulkan");
const captureBrowserChannel =
  String(process.env.STREAMING_CAPTURE_BROWSER_CHANNEL ?? "").trim() ||
  (process.platform === "darwin" ? "chrome" : undefined);
const browser = await chromium.launch({
  headless: captureHeadless,
  args: buildDefaultCaptureLaunchArgs({
    angleBackend: captureAngleBackend,
    featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
  }),
  ...(captureBrowserChannel ? { channel: captureBrowserChannel } : {}),
});
const context = await browser.newContext({ viewport });
const page = await context.newPage();
const cdpSession = await context.newCDPSession(page);
let browserConditionError = null;
try {
  await cdpSession.send("Network.enable");
  if (networkLatencyMs > 0) {
    await cdpSession.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: networkLatencyMs,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "wifi",
    });
  }
  if (cpuThrottleRate > 1) {
    await cdpSession.send("Emulation.setCPUThrottlingRate", {
      rate: cpuThrottleRate,
    });
  }
} catch (error) {
  browserConditionError = boundedMessage(
    error instanceof Error ? error.message : String(error),
  );
}
const consoleErrors = [];
const requestFailures = [];
const responseFailures = [];
const runtimeErrors = [];
const preEvidenceRuntimeErrors = [];
const rejectionCounts = new Map();
const preEvidenceRejectionCounts = new Map();
const integrityRejectionCounts = new Map();
const phaseObservationCounts = new Map();
const samples = [];
const hitReactionLifecycleSamples = [];
const rangedTransitionSnapshots = [];
let rangedTransitionBaselineInitialized = false;
let lastBowTransitionSequence = 0;
let lastArrowSpawnSequence = 0;
let rangedTransitionCancelledBeforeSpawnBaseline = 0;
let latestPerformance = null;
let lastSceneUpdatedAt = null;
let lastLifecycleSceneUpdatedAt = null;
let screenshot = null;
let navigationError = null;
let lastProgressAt = 0;
let maximumUiStyleSwitchEvents = 0;
let fightingObservation = { totalMs: 0, previous: null };
const startedAt = Date.now();

const recordRejection = (reason) => {
  increment(rejectionCounts, reason);
  if (!isDuelMotionSamplingRace(reason)) {
    increment(integrityRejectionCounts, reason);
  }
};

page.on("console", (message) => {
  if (
    message.type() !== "error" ||
    consoleErrors.length >= MAX_RETAINED_ERRORS
  ) {
    return;
  }
  consoleErrors.push({
    at: Date.now(),
    message: boundedMessage(message.text()),
  });
});
page.on("pageerror", (error) => {
  if (consoleErrors.length >= MAX_RETAINED_ERRORS) return;
  consoleErrors.push({
    at: Date.now(),
    message: boundedMessage(error.message),
  });
});
page.on("requestfailed", (request) => {
  if (requestFailures.length >= MAX_RETAINED_ERRORS) return;
  requestFailures.push({
    at: Date.now(),
    method: request.method(),
    url: redactRequestUrl(request.url()),
    reason: boundedMessage(
      request.failure()?.errorText ?? "request failed",
      200,
    ),
  });
});
page.on("response", (response) => {
  if (
    response.status() < 400 ||
    responseFailures.length >= MAX_RETAINED_ERRORS
  ) {
    return;
  }
  responseFailures.push({
    at: Date.now(),
    method: response.request().method(),
    status: response.status(),
    url: redactRequestUrl(response.url()),
  });
});

try {
  await page.goto(streamNavigationUrl.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForSelector("canvas", {
    state: "attached",
    timeout: 120_000,
  });

  while (
    Date.now() - startedAt < maximumDurationMs &&
    (Date.now() - startedAt < durationMs ||
      fightingObservation.totalMs < minimumFightingObservationMs)
  ) {
    const observedAt = Date.now();
    let browserProbe;
    let serverState;
    try {
      [browserProbe, serverState] = await Promise.all([
        readBrowserProbe(page),
        fetchState(stateUrl, stateBearerToken),
      ]);
    } catch (error) {
      const targetErrors =
        samples.length > 0 ? runtimeErrors : preEvidenceRuntimeErrors;
      if (targetErrors.length < MAX_RETAINED_ERRORS) {
        targetErrors.push({
          at: observedAt,
          message: boundedMessage(
            error instanceof Error ? error.message : String(error),
          ),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    latestPerformance = browserProbe.performance ?? latestPerformance;
    maximumUiStyleSwitchEvents = Math.max(
      maximumUiStyleSwitchEvents,
      Number(browserProbe.layout.styleSwitchEventCount) || 0,
    );
    const normalizedState = normalizeDuelCaptureState(browserProbe.state);
    increment(phaseObservationCounts, normalizedState?.phase ?? "INVALID");
    if (
      !normalizedState ||
      !["FIGHTING", "RESOLUTION"].includes(normalizedState.phase)
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    const reject = (reason) => {
      if (samples.length > 0) {
        recordRejection(reason);
      } else {
        increment(preEvidenceRejectionCounts, reason);
      }
    };
    if (!duelCaptureStatesAgree(browserProbe.state, serverState)) {
      reject("browser_server_state_disagreement");
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const baseLayoutReady =
      browserProbe.layout.canvasCount === 1 &&
      browserProbe.layout.errorOverlayCount === 0 &&
      browserProbe.layout.scrollWidth <= browserProbe.layout.innerWidth &&
      browserProbe.layout.scrollHeight <= browserProbe.layout.innerHeight;
    if (browserProbe.rendererHealth?.ready !== true || !baseLayoutReady) {
      reject("renderer_or_layout_not_ready");
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const sceneEvaluation = evaluateDuelSceneCapture(
      browserProbe.sceneDiagnostics,
      browserProbe.state,
      observedAt,
    );
    const blockingSceneIssues = sceneEvaluation.issues.filter(
      (issue) =>
        issue !== "agent1_combat_facing_error" &&
        issue !== "agent2_combat_facing_error",
    );
    if (!sceneEvaluation.diagnostics || blockingSceneIssues.length > 0) {
      for (const issue of blockingSceneIssues.length > 0
        ? blockingSceneIssues
        : ["scene_invalid"]) {
        reject(`scene:${issue}`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    if (sceneEvaluation.diagnostics.updatedAt !== lastLifecycleSceneUpdatedAt) {
      const lifecycleSample = buildHitReactionLifecycleSample(
        normalizedState,
        sceneEvaluation.diagnostics,
        observedAt,
      );
      if (lifecycleSample) {
        lastLifecycleSceneUpdatedAt = lifecycleSample.sceneUpdatedAt;
        hitReactionLifecycleSamples.push(lifecycleSample);
        if (hitReactionLifecycleSamples.length > MAX_RETAINED_SAMPLES) {
          hitReactionLifecycleSamples.shift();
        }
      }
    }
    if (normalizedState.phase !== "FIGHTING") {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const publicAgents = [
      browserProbe.state?.cycle?.agent1,
      browserProbe.state?.cycle?.agent2,
    ];
    if (!publicRoleStateMatches(publicAgents, expectedRoles, multiStyle)) {
      reject("combat_role_mismatch");
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const fightingLayoutReady =
      browserProbe.layout.activeHudCount === 1 &&
      (!multiStyle ||
        (browserProbe.layout.activeCombatRoles.length === 2 &&
          browserProbe.layout.activeCombatRoles.every((role) =>
            COMBAT_ROLES.has(role),
          )));
    if (!fightingLayoutReady) {
      reject("renderer_or_layout_not_ready");
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    if (sceneEvaluation.diagnostics.updatedAt === lastSceneUpdatedAt) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const sample = buildMotionSample(
      browserProbe.state,
      sceneEvaluation.diagnostics,
      observedAt,
      multiStyle,
    );
    if (!sample) {
      reject("sample_invalid");
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    lastSceneUpdatedAt = sample.sceneUpdatedAt;
    fightingObservation = accumulateFightingObservation(
      fightingObservation,
      sample,
    );
    samples.push(sample);
    if (samples.length > MAX_RETAINED_SAMPLES) samples.shift();
    if (requireRangedTransitions) {
      const transitionSnapshot = buildRangedTransitionSnapshot(
        browserProbe.sceneDiagnostics,
        sceneEvaluation.diagnostics,
        sample.agents.map((agent) => agent.role),
        observedAt,
      );
      if (!transitionSnapshot) {
        reject("ranged_transition_diagnostics_invalid");
      } else {
        rangedTransitionSnapshots.push(transitionSnapshot);
        if (rangedTransitionSnapshots.length > MAX_RETAINED_SAMPLES) {
          rangedTransitionSnapshots.shift();
        }
      }
    }

    const summary = summarizeDuelMotionTelemetry({
      samples,
      performance: latestPerformance,
      expectedRoles,
      safeCrop,
    });
    const liveStyleMetrics = summarizeDuelStyleSwitchTelemetry(
      samples,
      maximumUiStyleSwitchEvents,
    );
    const liveHitReactionSummary = summarizeDuelHitReactionTelemetry(samples);
    const liveHitReactionResolutionSummary =
      summarizeDuelHitReactionResolutionTelemetry(
        samples,
        hitReactionLifecycleSamples,
      );
    const liveRangedTransitionSummary = requireRangedTransitions
      ? summarizeDuelRangedTransitionTelemetry(rangedTransitionSnapshots)
      : null;
    const liveStyleChecks = multiStyle
      ? evaluateDuelStyleSwitchTelemetry(liveStyleMetrics, expectedRoles)
      : [];
    if (options.verbose && observedAt - lastProgressAt >= 5_000) {
      lastProgressAt = observedAt;
      console.log(
        JSON.stringify({
          samples: summary.metrics.sampleCount,
          observationMs: summary.metrics.observationMs,
          cumulativeFightingObservationMs: fightingObservation.totalMs,
          roles: summary.metrics.observedRoles,
          agents: summary.metrics.agents.map((agent) => ({
            role: agent.role,
            travelXZ: agent.travelXZ,
            diagonalSegments: agent.diagonalSegments,
            facingP95: agent.facingErrorDegrees.p95,
            yawDeltaP95: agent.yawDeltaDegrees.p95,
          })),
          frameP95: summary.metrics.performance.frameIntervalMs?.p95 ?? null,
          styleSwitches: liveStyleMetrics.totalSwitches,
          hitReactionTriggers: liveHitReactionSummary.metrics.triggerIncrements,
          rangedTransitions:
            liveRangedTransitionSummary?.metrics.agents.map((agent) => ({
              playerId: agent.playerId,
              released: agent.releasedCount,
              spawned: agent.spawnedCount,
              paired: agent.pairedCount,
            })) ?? [],
          failingChecks: [
            ...summary.checks,
            ...liveStyleChecks,
            ...(requireHitReactions
              ? [
                  ...liveHitReactionSummary.checks,
                  ...liveHitReactionResolutionSummary.checks,
                ]
              : []),
            ...(liveRangedTransitionSummary?.checks ?? []),
          ]
            .filter((entry) => !entry.pass)
            .map((entry) => entry.label),
        }),
      );
    }

    if (
      screenshot === null &&
      summary.ok &&
      liveStyleChecks.every((entry) => entry.pass) &&
      (!requireHitReactions ||
        (liveHitReactionSummary.ok && liveHitReactionResolutionSummary.ok)) &&
      (!requireRangedTransitions || liveRangedTransitionSummary?.ok === true) &&
      integrityRejectionCounts.size === 0 &&
      runtimeErrors.length === 0 &&
      consoleErrors.length === 0 &&
      requestFailures.length === 0 &&
      responseFailures.length === 0
    ) {
      await page.screenshot({ path: screenshotPath });
      await chmod(screenshotPath, 0o600);
      const [afterBrowserProbe, afterServerState] = await Promise.all([
        readBrowserProbe(page),
        fetchState(stateUrl, stateBearerToken),
      ]);
      const afterState = normalizeDuelCaptureState(afterBrowserProbe.state);
      const afterAgents = [
        afterBrowserProbe.state?.cycle?.agent1,
        afterBrowserProbe.state?.cycle?.agent2,
      ];
      if (
        afterState?.phase !== "FIGHTING" ||
        !duelCaptureStatesAgree(afterBrowserProbe.state, afterServerState) ||
        !publicRoleStateMatches(afterAgents, expectedRoles, multiStyle) ||
        afterBrowserProbe.rendererHealth?.ready !== true ||
        afterBrowserProbe.layout.errorOverlayCount !== 0
      ) {
        await unlink(screenshotPath).catch(() => {});
        recordRejection("post_screenshot_state_invalid");
      } else {
        latestPerformance = afterBrowserProbe.performance ?? latestPerformance;
        screenshot = {
          file: path.basename(screenshotPath),
          sha256: await sha256(screenshotPath),
          capturedAt: Date.now(),
          cycleId: afterState.cycleId,
          viewport,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
} catch (error) {
  navigationError = boundedMessage(
    error instanceof Error ? error.message : String(error),
  );
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

const motionSummary = summarizeDuelMotionTelemetry({
  samples,
  performance: latestPerformance,
  expectedRoles,
  safeCrop,
});
const styleSwitchMetrics = summarizeDuelStyleSwitchTelemetry(
  samples,
  maximumUiStyleSwitchEvents,
);
const finalStyleSwitchChecks = multiStyle
  ? evaluateDuelStyleSwitchTelemetry(styleSwitchMetrics, expectedRoles)
  : [];
const hitReactionSummary = summarizeDuelHitReactionTelemetry(samples);
const hitReactionResolutionSummary =
  summarizeDuelHitReactionResolutionTelemetry(
    samples,
    hitReactionLifecycleSamples,
  );
const rangedTransitionSummary = requireRangedTransitions
  ? summarizeDuelRangedTransitionTelemetry(rangedTransitionSnapshots)
  : null;
const captureChecks = [
  ...motionSummary.checks,
  ...finalStyleSwitchChecks,
  ...(requireHitReactions
    ? [...hitReactionSummary.checks, ...hitReactionResolutionSummary.checks]
    : []),
  ...(rangedTransitionSummary?.checks ?? []),
  {
    label: "required cumulative FIGHTING observation is retained",
    pass: fightingObservation.totalMs >= minimumFightingObservationMs,
    actual: `acceptedMs=${fightingObservation.totalMs},requiredMs=${minimumFightingObservationMs}`,
  },
  {
    label: "requested browser network and CPU conditions are active",
    pass: browserConditionError === null,
    actual: browserConditionError
      ? `error=${browserConditionError}`
      : `latencyMs=${networkLatencyMs},cpuRate=${cpuThrottleRate}`,
  },
  {
    label: "stream requested at true 60 FPS",
    pass: streamUrl.searchParams.get("streamFps") === "60",
    actual: streamUrl.searchParams.get("streamFps") ?? "missing",
  },
  {
    label: "motion screenshot retained",
    pass: screenshot !== null,
    actual: screenshot?.file ?? "missing",
  },
  {
    label: "continuous samples have no integrity rejection",
    pass: integrityRejectionCounts.size === 0,
    actual:
      integrityRejectionCounts.size === 0
        ? "0"
        : JSON.stringify(Object.fromEntries(integrityRejectionCounts)),
  },
  {
    label: "browser and state probes complete without errors",
    pass:
      navigationError === null &&
      preEvidenceRuntimeErrors.length === 0 &&
      runtimeErrors.length === 0 &&
      consoleErrors.length === 0 &&
      requestFailures.length === 0 &&
      responseFailures.length === 0,
    actual: `navigation=${navigationError ? 1 : 0},preEvidenceRuntime=${preEvidenceRuntimeErrors.length},runtime=${runtimeErrors.length},console=${consoleErrors.length},requests=${requestFailures.length},responses=${responseFailures.length}`,
  },
];
const finishedAt = Date.now();
const ok = captureChecks.every((entry) => entry.pass);
const manifest = {
  schemaVersion: 6,
  ok,
  startedAt,
  finishedAt,
  elapsedMs: finishedAt - startedAt,
  minimumDurationMs: durationMs,
  maximumDurationMs,
  minimumFightingObservationMs,
  cumulativeFightingObservationMs: fightingObservation.totalMs,
  streamUrl: publicUrl(streamUrl),
  stateUrl: publicUrl(stateUrl),
  stateAuthorizationMode,
  requestedFrameRate: 60,
  multiStyle,
  requireHitReactions,
  requireRangedTransitions,
  expectedRoles,
  captureBrowser: {
    headless: captureHeadless,
    channel: captureBrowserChannel ?? "bundled",
    angleBackend: captureAngleBackend,
    networkLatencyMs,
    cpuThrottleRate,
    conditionError: browserConditionError,
  },
  viewport,
  safeCropNdc: safeCrop,
  limits: DUEL_MOTION_TELEMETRY_LIMITS,
  screenshot,
  checks: captureChecks,
  metrics: motionSummary.metrics,
  styleSwitchMetrics,
  hitReactionMetrics: hitReactionSummary.metrics,
  hitReactionResolutionMetrics: hitReactionResolutionSummary.metrics,
  rangedTransitionMetrics: rangedTransitionSummary?.metrics ?? null,
  samples,
  hitReactionLifecycleSamples,
  rangedTransitionSnapshots,
  navigationError,
  runtimeErrors,
  preEvidenceRuntimeErrors,
  consoleErrors,
  requestFailures,
  responseFailures,
  rejectionCounts: Object.fromEntries(rejectionCounts),
  preEvidenceRejectionCounts: Object.fromEntries(preEvidenceRejectionCounts),
  integrityRejectionCounts: Object.fromEntries(integrityRejectionCounts),
  phaseObservationCounts: Object.fromEntries(phaseObservationCounts),
};
const temporaryManifestPath = `${manifestPath}.tmp-${process.pid}`;
try {
  await writeFile(
    temporaryManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await rename(temporaryManifestPath, manifestPath);
} catch (error) {
  await unlink(temporaryManifestPath).catch(() => {});
  throw error;
}

console.log(
  JSON.stringify({
    ok,
    samples: samples.length,
    observationMs: motionSummary.metrics.observationMs,
    cumulativeFightingObservationMs: fightingObservation.totalMs,
    roles: motionSummary.metrics.observedRoles,
    styleSwitches: styleSwitchMetrics.totalSwitches,
    hitReactionTriggers: hitReactionSummary.metrics.triggerIncrements,
    rangedTransitions:
      rangedTransitionSummary?.metrics.agents.map((agent) => ({
        playerId: agent.playerId,
        released: agent.releasedCount,
        spawned: agent.spawnedCount,
        paired: agent.pairedCount,
        maximumNockToSpawnMetres: agent.lastVisibleNockToSpawnMetres.max,
      })) ?? [],
    failingChecks: captureChecks
      .filter((entry) => !entry.pass)
      .map((entry) => entry.label),
    rejectionCounts: Object.fromEntries(rejectionCounts),
    preEvidenceRejectionCounts: Object.fromEntries(preEvidenceRejectionCounts),
    integrityRejectionCounts: Object.fromEntries(integrityRejectionCounts),
    phaseObservationCounts: Object.fromEntries(phaseObservationCounts),
    preEvidenceRuntimeErrors: preEvidenceRuntimeErrors.length,
    consoleErrors: consoleErrors.length,
    requestFailures: requestFailures.length,
    responseFailures: responseFailures.length,
    runtimeErrors: runtimeErrors.length,
    screenshot: screenshot?.file ?? null,
    manifestPath,
  }),
);
if (!ok) process.exitCode = 1;
