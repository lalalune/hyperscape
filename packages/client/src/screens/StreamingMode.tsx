/**
 * StreamingMode - Full-screen streaming mode for AI agent duels
 *
 * Features:
 * - Auto-connects without login
 * - Shows duel info overlay (contestants, HP, timer)
 * - Leaderboard panel on the left
 * - Camera auto-follows agents
 * - No standard UI (inventory, chat, etc.)
 */

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { GameClient } from "./GameClient";
import { LoadingScreen } from "./LoadingScreen";
import { StreamingOverlay } from "../components/streaming/StreamingOverlay";
import type {
  World,
  Entity,
  StreamingGuardrailAgentSnapshot,
  StreamingGuardrailPhase,
} from "@hyperforge/shared";
import { EventType, deriveStreamingGuardrailReason } from "@hyperforge/shared";
import type { StreamingWindow } from "@/lib/streamingWindow";
import { GAME_WS_URL, GAME_API_URL } from "../lib/api-config";
import { getStreamingAccessToken } from "../lib/streamingAccessToken";

/** Streaming state from server */
export interface StreamingState {
  type: "STREAMING_STATE_UPDATE";
  cycle: {
    cycleId: string;
    phase: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
    cycleStartTime: number;
    phaseStartTime: number;
    phaseEndTime: number;
    timeRemaining: number;
    agent1: AgentInfo | null;
    agent2: AgentInfo | null;
    countdown: number | null;
    fightStartTime: number | null;
    arenaPositions: {
      agent1: [number, number, number];
      agent2: [number, number, number];
    } | null;
    winnerId: string | null;
    winnerName: string | null;
    winReason: string | null;
  };
  leaderboard: LeaderboardEntry[];
  cameraTarget: string | null;
}

export interface AgentInfo {
  id: string;
  name: string;
  provider: string;
  model: string;
  hp: number;
  maxHp: number;
  combatLevel: number;
  wins: number;
  losses: number;
  damageDealtThisFight: number;
  highestHit: number;
  attacksLanded: number;
  healsUsed: number;
  equipment: Record<string, string>;
  inventory: Array<{ itemId: string; quantity: number } | null>;
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
}

export interface LeaderboardEntry {
  rank: number;
  characterId: string;
  name: string;
  provider: string;
  model: string;
  wins: number;
  losses: number;
  winRate: number;
  combatLevel: number;
  currentStreak: number;
}

export interface StreamingRendererHealth {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: StreamingState["cycle"]["phase"] | null;
}

function toGuardrailAgent(
  agent: AgentInfo | null,
): StreamingGuardrailAgentSnapshot | null {
  if (!agent) return null;
  return {
    id: agent.id,
    name: agent.name,
    hp: agent.hp,
    maxHp: agent.maxHp,
  };
}

function deriveStreamingSurfaceBlockReason(params: {
  connected: boolean;
  worldReady: boolean;
  terrainReady: boolean;
  hasStreamingState: boolean;
  initError: string | null;
  needsCameraLock: boolean;
  cameraLocked: boolean;
  phase: StreamingState["cycle"]["phase"] | null;
}): string | null {
  const activePhase = Boolean(params.phase && params.phase !== "IDLE");

  if (params.initError?.trim()) {
    return "initialization_failed";
  }
  if (!params.connected) {
    return "socket_disconnected";
  }
  if (!params.hasStreamingState) {
    return activePhase ? "stream_state_missing" : "waiting_for_duel_data";
  }
  if (!params.worldReady) {
    return "world_not_ready";
  }
  if (!params.terrainReady) {
    return "terrain_not_ready";
  }
  if (params.needsCameraLock && !params.cameraLocked) {
    return "camera_target_unresolved";
  }
  return null;
}

export function deriveStreamingRendererHealth(params: {
  connected: boolean;
  worldReady: boolean;
  terrainReady: boolean;
  hasStreamingState: boolean;
  initError: string | null;
  needsCameraLock: boolean;
  cameraLocked: boolean;
  loadingDismissed: boolean;
  phase: StreamingState["cycle"]["phase"] | null;
  agent1: AgentInfo | null;
  agent2: AgentInfo | null;
  arenaPositions: StreamingState["cycle"]["arenaPositions"] | null | undefined;
}): StreamingRendererHealth {
  const activePhase = Boolean(params.phase && params.phase !== "IDLE");
  const blockingReason = deriveStreamingSurfaceBlockReason({
    connected: params.connected,
    worldReady: params.worldReady,
    terrainReady: params.terrainReady,
    hasStreamingState: params.hasStreamingState,
    initError: params.initError,
    needsCameraLock: params.needsCameraLock,
    cameraLocked: params.cameraLocked,
    phase: params.phase,
  });
  let degradedReason =
    blockingReason ??
    deriveStreamingGuardrailReason({
      phase: params.phase as StreamingGuardrailPhase | null,
      agent1: toGuardrailAgent(params.agent1),
      agent2: toGuardrailAgent(params.agent2),
      arenaPositions: params.arenaPositions,
    });

  if (!degradedReason && !params.loadingDismissed) {
    degradedReason = activePhase ? "loading_overlay_active" : "initializing";
  }

  return {
    ready: degradedReason === null,
    degradedReason,
    updatedAt: Date.now(),
    phase: params.phase,
  };
}

export function shouldDismissStreamingLoading(params: {
  connected: boolean;
  worldReady: boolean;
  terrainReady: boolean;
  hasStreamingState: boolean;
  initError?: string | null;
  needsCameraLock: boolean;
  cameraLocked: boolean;
  phase?: StreamingState["cycle"]["phase"] | null;
}): boolean {
  return (
    deriveStreamingSurfaceBlockReason({
      connected: params.connected,
      worldReady: params.worldReady,
      terrainReady: params.terrainReady,
      hasStreamingState: params.hasStreamingState,
      initError: params.initError ?? null,
      needsCameraLock: params.needsCameraLock,
      cameraLocked: params.cameraLocked,
      phase: params.phase ?? null,
    }) === null
  );
}

export function StreamingMode() {
  const [streamingState, setStreamingState] = useState<StreamingState | null>(
    null,
  );
  const [connected, setConnected] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [cameraLocked, setCameraLocked] = useState(false);
  const [terrainStalled, setTerrainStalled] = useState(false);
  const [readyEventDelayed, setReadyEventDelayed] = useState(false);
  const [clientInitError, setClientInitError] = useState<string | null>(null);
  // Once true, loading screen never returns — camera switches are seamless
  const [loadingDismissed, setLoadingDismissed] = useState(false);
  // Fade-out animation: true while the loading overlay is fading away
  const [fadingOut, setFadingOut] = useState(false);
  const worldRef = useRef<World | null>(null);
  const worldReadyRef = useRef(false);
  const lastCameraTargetRef = useRef<string | null>(null);
  const terrainPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terrainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cameraRetryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const worldListenerCleanupRef = useRef<(() => void) | null>(null);
  const [streamAccessToken] = useState<string | null>(() =>
    getStreamingAccessToken(),
  );

  // WebSocket URL for streaming mode (supports optional streamToken gate)
  const wsUrl = useMemo(() => {
    const baseWsUrl = GAME_WS_URL;
    const url = new URL(baseWsUrl, window.location.href);
    url.searchParams.set("mode", "streaming");
    if (streamAccessToken) {
      url.searchParams.set("streamToken", streamAccessToken);
    }
    return url.toString();
  }, [streamAccessToken]);

  const clearTerrainPolling = useCallback(() => {
    if (terrainPollRef.current) {
      clearInterval(terrainPollRef.current);
      terrainPollRef.current = null;
    }
    if (terrainTimeoutRef.current) {
      clearTimeout(terrainTimeoutRef.current);
      terrainTimeoutRef.current = null;
    }
  }, []);

  const clearCameraRetryTimeouts = useCallback(() => {
    for (const timeoutId of cameraRetryTimeoutsRef.current) {
      clearTimeout(timeoutId);
    }
    cameraRetryTimeoutsRef.current = [];
  }, []);

  // Handle world setup
  const handleSetup = useCallback(
    (world: World) => {
      worldListenerCleanupRef.current?.();
      worldListenerCleanupRef.current = null;
      worldRef.current = world;
      setConnected(true);
      const win = window as StreamingWindow;
      win.__HYPERIA_STREAM_READY__ = false;
      win.__HYPERIA_STREAM_RENDERER_HEALTH__ = null;
      win.__HYPERIA_STREAM_BOOT_STATUS__ = "initializing";
      setWorldReady(false);
      setTerrainReady(false);
      setTerrainStalled(false);
      setReadyEventDelayed(false);
      setClientInitError(null);

      // Force potato-mode graphics tuned for stable 720p streaming output.
      // Keep DPR at 1 so capture canvas stays at target resolution.
      const prefs = world.getSystem("prefs") as {
        setDPR?: (v: number) => void;
        setShadows?: (v: string) => void;
        setPostprocessing?: (v: boolean) => void;
        setBloom?: (v: boolean) => void;
        setColorGrading?: (v: string) => void;
        setDepthBlur?: (v: boolean) => void;
        setWaterReflections?: (v: boolean) => void;
        setEntityHighlighting?: (v: boolean) => void;
      } | null;
      if (prefs) {
        prefs.setDPR?.(1);
        prefs.setShadows?.("none");
        prefs.setPostprocessing?.(false);
        prefs.setBloom?.(false);
        prefs.setColorGrading?.("none");
        prefs.setDepthBlur?.(false);
        prefs.setWaterReflections?.(false);
        prefs.setEntityHighlighting?.(false);
      }

      const markWorldReady = () => {
        if (worldReadyRef.current) return;
        worldReadyRef.current = true;
        setWorldReady(true);
        setReadyEventDelayed(false);
        if (worldReadyTimeoutRef.current) {
          clearTimeout(worldReadyTimeoutRef.current);
          worldReadyTimeoutRef.current = null;
        }
      };

      world.on(EventType.READY, markWorldReady);

      // Safety net logging only: do not force world-ready state. Forcing
      // readiness can hide renderer/bootstrap failures and lock streams at 3%.
      if (worldReadyTimeoutRef.current) {
        clearTimeout(worldReadyTimeoutRef.current);
      }
      worldReadyTimeoutRef.current = setTimeout(() => {
        setReadyEventDelayed(true);
        console.warn(
          "[StreamingMode] READY event timeout reached; waiting for READY event instead of forcing world-ready",
        );
        worldReadyTimeoutRef.current = null;
      }, 60000);

      // Start terrain readiness polling so we avoid presenting chunk-pop-in.
      clearTerrainPolling();
      terrainPollRef.current = setInterval(() => {
        const terrain = world.getSystem("terrain") as {
          isReady?: () => boolean;
        } | null;
        if (terrain?.isReady?.()) {
          setTerrainReady(true);
          setTerrainStalled(false);
          clearTerrainPolling();
        }
      }, 100);

      terrainTimeoutRef.current = setTimeout(() => {
        setTerrainStalled(true);
        console.warn(
          "[StreamingMode] Terrain readiness timeout reached; continuing to wait for terrain instead of forcing ready",
        );
      }, 30000);

      // Subscribe to streaming state updates (forwarded from server via WebSocket)
      const onStreamingStateUpdate = (data: unknown) => {
        const state = data as StreamingState;

        // Initial camera lock: only needed for the very first target so
        // the loading screen can dismiss.  After that, ClientCameraSystem
        // handles all target switches via its own streaming:state:update
        // subscription with smooth cinematic transitions — no loading screen.
        markWorldReady();
        if (
          state.cameraTarget &&
          state.cameraTarget !== lastCameraTargetRef.current
        ) {
          const isFirstTarget = lastCameraTargetRef.current === null;
          lastCameraTargetRef.current = state.cameraTarget;

          if (isFirstTarget) {
            clearCameraRetryTimeouts();
            updateCameraTarget(world, state.cameraTarget);
          }
        }

        // Only trigger React re-render when visible state actually changed
        setStreamingState((prev) => {
          if (!prev) return state;
          // Skip re-render if phase, HP, countdown, and leaderboard are unchanged
          const c = state.cycle;
          const p = prev.cycle;
          if (
            c.phase === p.phase &&
            c.countdown === p.countdown &&
            c.winnerId === p.winnerId &&
            c.agent1?.hp === p.agent1?.hp &&
            c.agent2?.hp === p.agent2?.hp &&
            c.agent1?.damageDealtThisFight === p.agent1?.damageDealtThisFight &&
            c.agent2?.damageDealtThisFight === p.agent2?.damageDealtThisFight &&
            Math.floor(c.timeRemaining / 1000) ===
              Math.floor(p.timeRemaining / 1000) &&
            state.leaderboard.length === prev.leaderboard.length
          ) {
            return prev; // Same reference = no re-render
          }
          return state;
        });
      };
      world.on("streaming:state:update", onStreamingStateUpdate);
      worldListenerCleanupRef.current = () => {
        world.off(EventType.READY, markWorldReady);
        world.off("streaming:state:update", onStreamingStateUpdate);
      };

      // Disable player controls (spectator mode)
      const inputSystem = world.getSystem("client-input") as {
        disable?: () => void;
        setEnabled?: (enabled: boolean) => void;
      } | null;

      if (inputSystem?.disable) {
        inputSystem.disable();
      } else if (inputSystem?.setEnabled) {
        inputSystem.setEnabled(false);
      }

      if (import.meta.env.DEV) {
        console.log("[StreamingMode] World setup complete");
      }
    },
    [clearTerrainPolling, clearCameraRetryTimeouts],
  );

  // Initial camera lock — only used once to dismiss the loading screen.
  // After this, ClientCameraSystem handles all camera targeting internally
  // via its streaming:state:update subscription with smooth transitions.
  const updateCameraTarget = useCallback((world: World, targetId: string) => {
    const maxRetries = 20;
    const retryDelayMs = 250;

    const attemptLock = (attempt: number) => {
      let entity = world.entities?.get(targetId);

      if (!entity && world.entities?.players) {
        for (const [, player] of world.entities.players) {
          const playerAny = player as {
            id?: string;
            data?: { id?: string; characterId?: string };
          };
          if (
            playerAny.id === targetId ||
            playerAny.data?.id === targetId ||
            playerAny.data?.characterId === targetId
          ) {
            entity = player as Entity;
            break;
          }
        }
      }

      if (!entity && world.entities?.items) {
        for (const [, item] of world.entities.items) {
          if (item.id === targetId) {
            entity = item;
            break;
          }
        }
      }

      if (!entity) {
        if (attempt < maxRetries) {
          if (import.meta.env.DEV && (attempt === 0 || attempt % 10 === 0)) {
            console.log(
              `[StreamingMode] Waiting for initial camera target "${targetId}" (attempt ${attempt}/${maxRetries})`,
            );
          }
          const timeoutId = setTimeout(
            () => attemptLock(attempt + 1),
            retryDelayMs,
          );
          cameraRetryTimeoutsRef.current.push(timeoutId);
        } else {
          console.warn(
            `[StreamingMode] Initial camera target not found after ${maxRetries} retries, proceeding anyway`,
          );
          setCameraLocked(true);
        }
        return;
      }

      setCameraLocked(true);
      if (import.meta.env.DEV) {
        console.log(
          `[StreamingMode] Initial camera target acquired: ${targetId}`,
        );
      }
    };

    attemptLock(0);
  }, []);

  // Poll for initial state if not received via WebSocket
  useEffect(() => {
    if (!connected || streamingState) return;

    let mounted = true;
    const controllers = new Set<AbortController>();
    let warnedOnce = false;

    // Try to fetch initial state via HTTP. Keep retrying until WS/state arrives.
    const baseApiUrl = GAME_API_URL;
    const stateUrl = `${baseApiUrl}/api/streaming/state`;
    const fetchState = () => {
      if (!mounted) return;
      const controller = new AbortController();
      controllers.add(controller);

      fetch(stateUrl, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            if (!warnedOnce && res.status !== 503) {
              warnedOnce = true;
              console.warn(
                `[StreamingMode] Initial state fetch returned HTTP ${res.status}`,
              );
            }
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (!mounted) return;
          if (data && data.type === "STREAMING_STATE_UPDATE") {
            setStreamingState(data);
          }
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          if (!warnedOnce) {
            warnedOnce = true;
            console.warn("[StreamingMode] Failed to fetch initial state:", err);
          }
        })
        .finally(() => {
          controllers.delete(controller);
        });
    };

    fetchState();
    const interval = setInterval(fetchState, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.clear();
    };
  }, [connected, streamingState]);

  // Lock the world's built-in MusicSystem to use exclusively combat tracks
  useEffect(() => {
    if (!worldReady || !worldRef.current) return;

    const musicSystem = worldRef.current.getSystem("music-system") as {
      setCategoryLock?: (category: "normal" | "combat" | null) => void;
    } | null;

    if (musicSystem?.setCategoryLock) {
      musicSystem.setCategoryLock("combat");
      if (import.meta.env.DEV) {
        console.log("[StreamingMode] Locked MusicSystem to combat tracks");
      }
    }

    return () => {
      if (musicSystem?.setCategoryLock) {
        musicSystem.setCategoryLock(null);
      }
    };
  }, [worldReady]);

  // Auto-start canvas capture for HLS streaming when world is ready
  useEffect(() => {
    if (!worldReady || !terrainReady) return;

    const searchParams = new URLSearchParams(window.location.search);
    const disableBridgeCaptureValue = (
      searchParams.get("disableBridgeCapture") || ""
    ).toLowerCase();
    const disableBridgeCapture = ["1", "true", "yes", "on"].includes(
      disableBridgeCaptureValue,
    );
    const internalCaptureValue = (
      searchParams.get("internalCapture") || ""
    ).toLowerCase();
    const internalCapture = ["1", "true", "yes", "on"].includes(
      internalCaptureValue,
    );
    const captureDebugValue = (
      searchParams.get("captureDebug") || ""
    ).toLowerCase();
    const captureDebug = ["1", "true", "yes", "on"].includes(captureDebugValue);
    const captureVerbose = captureDebug || import.meta.env.DEV;
    if (disableBridgeCapture || !internalCapture) {
      if (captureVerbose) {
        console.log(
          disableBridgeCapture
            ? "[StreamingMode] Bridge capture disabled by URL param, skipping in-page capture"
            : "[StreamingMode] Bridge capture disabled: 'internalCapture=1' is required to enable in-page capture",
        );
      }
      return;
    }

    const win = window as StreamingWindow;
    if (win.__captureControl__) {
      try {
        const status = win.__captureControl__.getStatus?.();
        if (status?.recording && status.wsConnected) {
          if (captureVerbose) {
            console.log(
              "[Capture] Existing capture is healthy; skipping re-init",
            );
          }
          return;
        }
        win.__captureControl__.stop?.();
      } catch {
        // best effort cleanup of stale capture controls
      }
      delete win.__captureControl__;
    }

    const bridgeUrl = searchParams.get("bridgeUrl") || "ws://127.0.0.1:8765";

    if (captureVerbose) {
      console.log("[StreamingMode] Starting canvas capture to", bridgeUrl);
    }

    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      console.warn("[StreamingMode] No canvas found, skipping capture");
      return;
    }
    const captureCanvas = canvas;

    const TARGET_FPS = 30;
    const VIDEO_BITRATE = 6_000_000;

    let ws: WebSocket | null = null;
    // eslint-disable-next-line no-undef
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    // eslint-disable-next-line no-undef
    let oscillator: OscillatorNode | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let requestDataTimer: ReturnType<typeof setInterval> | null = null;
    let healthTimer: ReturnType<typeof setInterval> | null = null;
    let forceFrameTimer: ReturnType<typeof setInterval> | null = null;
    let statusTimer: ReturnType<typeof setInterval> | null = null;
    let chunkCount = 0;
    let bytesSent = 0;
    let startedAt = 0;
    let lastChunkAt = 0;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 10;
    let stopped = false;

    const getCaptureStatus = () => {
      const perfWithMemory = performance as {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      return {
        recording: recorder?.state === "recording",
        wsConnected: ws?.readyState === WebSocket.OPEN,
        chunkCount,
        bytesSent,
        uptime: startedAt > 0 ? Date.now() - startedAt : 0,
        lastChunkMs: lastChunkAt > 0 ? Date.now() - lastChunkAt : null,
        wsBufferedAmount: ws?.bufferedAmount ?? 0,
        heapUsedBytes: perfWithMemory.memory?.usedJSHeapSize ?? null,
        heapLimitBytes: perfWithMemory.memory?.jsHeapSizeLimit ?? null,
      };
    };

    const logCaptureStatus = (prefix: string) => {
      const status = getCaptureStatus();
      const heapSuffix =
        status.heapUsedBytes && status.heapLimitBytes
          ? ` heap=${(status.heapUsedBytes / 1024 / 1024).toFixed(1)}MB/${(status.heapLimitBytes / 1024 / 1024).toFixed(1)}MB`
          : "";
      console.log(
        `${prefix} recording=${status.recording} ws=${status.wsConnected} chunks=${status.chunkCount} buffered=${status.wsBufferedAmount}${heapSuffix}`,
      );
    };

    const clearCaptureTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (requestDataTimer) {
        clearInterval(requestDataTimer);
        requestDataTimer = null;
      }
      if (healthTimer) {
        clearInterval(healthTimer);
        healthTimer = null;
      }
      if (forceFrameTimer) {
        clearInterval(forceFrameTimer);
        forceFrameTimer = null;
      }
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
      }
    };

    function startRecording() {
      if (stopped || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (recorder && recorder.state !== "inactive") return;

      try {
        stream = captureCanvas.captureStream(TARGET_FPS);
      } catch (err) {
        console.error("[Capture] captureStream failed:", err);
        return;
      }

      // The RTMP bridge owns audio timing and can inject silent fallback audio
      // when system audio capture is unavailable.

      let mimeType = "video/webm;codecs=h264";
      // eslint-disable-next-line no-undef
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
        // eslint-disable-next-line no-undef
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/webm";
        }
      }

      // eslint-disable-next-line no-undef
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
      });

      recorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          ws &&
          ws.readyState === WebSocket.OPEN &&
          ws.bufferedAmount < 2 * 1024 * 1024
        ) {
          ws.send(event.data);
          chunkCount++;
          bytesSent += event.data.size;
          lastChunkAt = Date.now();
          if (captureVerbose && (chunkCount <= 3 || chunkCount % 60 === 0)) {
            console.log(
              `[Capture] Chunk #${chunkCount}: ${event.data.size} bytes`,
            );
          }
        } else if (ws && ws.bufferedAmount >= 2 * 1024 * 1024) {
          console.warn(
            `[Capture] Dropping chunk due to backpressure (${ws.bufferedAmount} bytes buffered)`,
          );
        }
      };

      recorder.onstop = () => {
        if (captureDebug) {
          logCaptureStatus("[Capture] Recorder stopped");
        }
      };

      recorder.start(200);
      requestDataTimer = setInterval(() => {
        if (!recorder || recorder.state !== "recording") return;
        try {
          recorder.requestData();
        } catch {}
      }, 250);
      healthTimer = setInterval(() => {
        if (!recorder || recorder.state !== "recording") return;
        if (lastChunkAt <= 0) return;
        const idleMs = Date.now() - lastChunkAt;
        if (idleMs > 5000) {
          console.warn(
            `[Capture] Recorder idle for ${idleMs}ms, nudging requestData`,
          );
          try {
            recorder.requestData();
          } catch {}
        }
      }, 2000);
      const videoTrack = stream?.getVideoTracks?.()[0] as  // eslint-disable-next-line no-undef
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
      if (videoTrack?.requestFrame) {
        const frameIntervalMs = Math.max(15, Math.floor(1000 / TARGET_FPS));
        forceFrameTimer = setInterval(() => {
          try {
            videoTrack.requestFrame?.();
          } catch {}
        }, frameIntervalMs);
      }
      if (captureVerbose) {
        statusTimer = setInterval(() => {
          logCaptureStatus("[Capture] Status");
        }, 10000);
      }
      startedAt = Date.now();
      lastChunkAt = startedAt;
      if (captureVerbose) {
        console.log("[Capture] Recording started:", mimeType);
      }
    }

    function stopRecording() {
      clearCaptureTimers();

      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {}
      }
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      recorder = null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      if (oscillator) {
        try {
          oscillator.stop();
        } catch {}
        oscillator.disconnect();
        oscillator = null;
      }
      const currentAudioCtx = audioCtx;
      audioCtx = null;
      if (currentAudioCtx && currentAudioCtx.state !== "closed") {
        void currentAudioCtx.close().catch((err) => {
          console.warn("[Capture] Failed to close AudioContext:", err);
        });
      }
    }

    function connect() {
      if (stopped) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws = new WebSocket(bridgeUrl);
      ws.onopen = () => {
        if (captureVerbose) {
          console.log("[Capture] Connected to RTMPBridge");
        }
        reconnectAttempts = 0;
        startRecording();
      };
      ws.onclose = () => {
        if (captureVerbose) {
          console.log("[Capture] Disconnected from RTMPBridge");
        }
        stopRecording();
        if (!stopped && reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 3000);
        }
      };
      ws.onerror = () => {
        if (captureDebug) {
          console.warn("[Capture] WebSocket error");
        }
      };
    }

    connect();

    win.__captureControl__ = {
      stop: () => {
        stopped = true;
        clearCaptureTimers();
        stopRecording();
        ws?.close();
        ws = null;
      },
      getStatus: getCaptureStatus,
    };
    win.__captureStatus__ = getCaptureStatus();

    return () => {
      stopped = true;
      clearCaptureTimers();
      stopRecording();
      ws?.close();
      ws = null;
      delete win.__captureControl__;
      delete win.__captureStatus__;
    };
  }, [worldReady, terrainReady]);

  useEffect(() => {
    return () => {
      const win = window as StreamingWindow;
      win.__HYPERIA_STREAM_READY__ = false;
      win.__HYPERIA_STREAM_RENDERER_HEALTH__ = null;
      win.__HYPERIA_STREAM_BOOT_STATUS__ = null;
      if (worldReadyTimeoutRef.current) {
        clearTimeout(worldReadyTimeoutRef.current);
        worldReadyTimeoutRef.current = null;
      }
      worldListenerCleanupRef.current?.();
      worldListenerCleanupRef.current = null;
      worldRef.current = null;
      worldReadyRef.current = false;
      clearTerrainPolling();
      clearCameraRetryTimeouts();
    };
  }, [clearTerrainPolling, clearCameraRetryTimeouts]);

  // Loading screen is shown only during initial boot. Once everything is
  // ready for the first time, we fade out and never show it again — camera
  // target switches are handled seamlessly by ClientCameraSystem.
  const needsCameraLock = Boolean(streamingState?.cameraTarget);
  const isInitiallyReady = shouldDismissStreamingLoading({
    connected,
    worldReady,
    terrainReady,
    hasStreamingState: streamingState !== null,
    initError: clientInitError,
    needsCameraLock,
    cameraLocked,
    phase: streamingState?.cycle.phase ?? null,
  });
  const rendererHealth = useMemo(
    () =>
      deriveStreamingRendererHealth({
        connected,
        worldReady,
        terrainReady,
        hasStreamingState: streamingState !== null,
        initError: clientInitError,
        needsCameraLock,
        cameraLocked,
        loadingDismissed,
        phase: streamingState?.cycle.phase ?? null,
        agent1: streamingState?.cycle.agent1 ?? null,
        agent2: streamingState?.cycle.agent2 ?? null,
        arenaPositions: streamingState?.cycle.arenaPositions,
      }),
    [
      cameraLocked,
      clientInitError,
      connected,
      loadingDismissed,
      needsCameraLock,
      streamingState,
      terrainReady,
      worldReady,
    ],
  );

  useEffect(() => {
    const win = window as StreamingWindow;
    win.__HYPERIA_STREAM_READY__ = rendererHealth.ready;
    win.__HYPERIA_STREAM_RENDERER_HEALTH__ = rendererHealth;
  }, [rendererHealth]);

  // Write boot status to a window global so the capture pipeline's renderer
  // health probe can detect loading/error state without reading DOM textContent.
  useEffect(() => {
    const win = window as StreamingWindow;
    if (loadingDismissed) {
      win.__HYPERIA_STREAM_BOOT_STATUS__ = null;
    } else if (clientInitError) {
      const lower = clientInitError.toLowerCase();
      if (lower.includes("webgpu")) {
        win.__HYPERIA_STREAM_BOOT_STATUS__ = "error:webgpu_required";
      } else if (lower.includes("http error")) {
        win.__HYPERIA_STREAM_BOOT_STATUS__ = "error:http";
      } else {
        win.__HYPERIA_STREAM_BOOT_STATUS__ = "error:init_failed";
      }
    } else if (!connected) {
      win.__HYPERIA_STREAM_BOOT_STATUS__ = "connecting";
    } else if (!worldReady) {
      win.__HYPERIA_STREAM_BOOT_STATUS__ = "initializing";
    } else if (!terrainReady) {
      win.__HYPERIA_STREAM_BOOT_STATUS__ = "loading_assets";
    } else {
      win.__HYPERIA_STREAM_BOOT_STATUS__ = "finalizing";
    }
  }, [clientInitError, connected, loadingDismissed, terrainReady, worldReady]);

  // Trigger fade-out once when the stream is first ready.
  useEffect(() => {
    if (!isInitiallyReady || loadingDismissed || fadingOut) {
      return;
    }
    setFadingOut(true);
  }, [fadingOut, isInitiallyReady, loadingDismissed]);

  // Complete the fade-out without clearing our own dismissal timer.
  useEffect(() => {
    if (!fadingOut || loadingDismissed) {
      return;
    }
    const timer = setTimeout(() => {
      setLoadingDismissed(true);
      setFadingOut(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [fadingOut, loadingDismissed]);

  // Show loading overlay only during initial load or fade-out
  const showLoading = !loadingDismissed && !clientInitError;

  const loadingHeadline = !connected
    ? "Connecting to Hyperia..."
    : !worldReady
      ? "Initializing world systems..."
      : !terrainReady
        ? "Generating terrain..."
        : "Preparing stream view...";
  const loadingDetail = !connected
    ? "Opening duel stream connection"
    : !worldReady
      ? readyEventDelayed
        ? "Still waiting for the READY event from the live world"
        : "Bootstrapping stream world"
      : !terrainReady
        ? terrainStalled
          ? "Terrain is taking longer than expected; waiting for a real ready signal"
          : "Waiting for terrain and arena visuals"
        : needsCameraLock && !cameraLocked
          ? "Locking the initial camera target"
          : "Finalizing spectator presentation";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000",
        position: "relative",
      }}
    >
      {/* Game client (fullscreen, no UI) */}
      <GameClient
        wsUrl={wsUrl}
        onSetup={handleSetup}
        onInitError={setClientInitError}
        hideUI={true}
        streamingMode={true}
      />

      {/* Streaming overlay (on top of game) */}
      <StreamingOverlay state={streamingState} />

      {/* Loading overlay — shown only during initial boot, fades out smoothly */}
      {showLoading && worldRef.current && (
        <div
          style={{
            zIndex: 100,
            position: "absolute",
            inset: 0,
            opacity: fadingOut ? 0 : 1,
            transition: "opacity 0.5s ease-out",
            pointerEvents: fadingOut ? "none" : "auto",
          }}
        >
          <LoadingScreen
            world={worldRef.current}
            message={`${loadingHeadline} ${loadingDetail}`}
            completionStage="Ready to stream..."
          />
        </div>
      )}
      {showLoading && !worldRef.current && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 1.0)",
            zIndex: 100,
            opacity: fadingOut ? 0 : 1,
            transition: "opacity 0.5s ease-out",
            pointerEvents: fadingOut ? "none" : "auto",
          }}
        >
          <div style={{ textAlign: "center", color: "#f2d08a" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
              {loadingHeadline}
            </h2>
            <p style={{ opacity: 0.7 }}>AI Agent Duel Streaming Mode</p>
          </div>
        </div>
      )}
    </div>
  );
}
