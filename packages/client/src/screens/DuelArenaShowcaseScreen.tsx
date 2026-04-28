/* global EventSource */

import { GAME_API_URL } from "@/lib/api-config";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Bot,
  Camera,
  ExternalLink,
  Eye,
  Radio,
  RefreshCw,
  Shield,
  Signal,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import "./DuelArenaShowcaseScreen.css";

const ADMIN_CODE_KEY = "hyperscape_admin_code";
const CONTEXT_POLL_MS = 4000;
const HEALTH_POLL_MS = 6000;

type ShowcaseLeaderboardEntry = {
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
};

type ShowcaseAgent = {
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
  inventory?: Array<{ slot: number; itemId: string; quantity: number }>;
  monologues?: Array<{
    id: string;
    type: string;
    content: string;
    timestamp: number;
  }>;
};

type ShowcaseCycle = {
  cycleId: string;
  phase: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
  phaseStartTime: number;
  phaseEndTime: number;
  timeRemaining: number;
  countdown: number | null;
  winnerId: string | null;
  winnerName: string | null;
  winReason: string | null;
  cameraTarget: string | null;
  agent1: ShowcaseAgent | null;
  agent2: ShowcaseAgent | null;
};

type StreamingStateResponse = {
  type: string;
  cycle: ShowcaseCycle;
  leaderboard: ShowcaseLeaderboardEntry[];
  cameraTarget: string | null;
  shotPreset?:
    | "auto"
    | "countdown-wide"
    | "fight-close"
    | "fight-orbital"
    | "fight-overhead"
    | "winner-hero";
};

type DuelContextResponse = {
  type: string;
  cycle: Omit<ShowcaseCycle, "cameraTarget"> & {
    agent1: ShowcaseAgent | null;
    agent2: ShowcaseAgent | null;
  };
  leaderboard: ShowcaseLeaderboardEntry[];
  cameraTarget: string | null;
};

type RecentDuel = {
  cycleId: string;
  winnerName: string;
  loserName: string;
  winReason: string;
  finishedAt: number;
};

type LeaderboardDetailsResponse = {
  leaderboard: ShowcaseLeaderboardEntry[];
  cycle: ShowcaseCycle;
  recentDuels: RecentDuel[];
  updatedAt: number;
};

type StreamHealth = {
  healthy?: boolean;
  connected?: boolean;
  stats?: {
    healthy?: boolean;
    spectators?: number;
    destinations?: unknown[];
    droppedFrames?: number;
    backpressured?: boolean;
    uptimeSeconds?: number;
  };
  error?: string;
  message?: string;
};

type CaptureHealth = {
  running?: boolean;
  status?: string;
  browserConnected?: boolean;
  bridgeConnected?: boolean;
  lastFrameAt?: number;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

type DirectorCameraState = {
  mode: "auto" | "agent1" | "agent2" | "winner" | "target";
  targetId: string | null;
  resolvedTargetId: string | null;
  shotPreset:
    | "auto"
    | "countdown-wide"
    | "fight-close"
    | "fight-orbital"
    | "fight-overhead"
    | "winner-hero";
};

type AdminDuelStatusResponse = {
  directorCamera: DirectorCameraState | null;
};

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Human-readable phase for iframe overlay (not raw enum strings). */
function showcasePhaseLabel(phase: string): {
  title: string;
  hint: string | null;
} {
  switch (phase) {
    case "IDLE":
      return { title: "Stand by", hint: "Staging the next bout" };
    case "ANNOUNCEMENT":
      return { title: "Coming up", hint: "Fighters heading to the ring" };
    case "COUNTDOWN":
      return { title: "Get ready", hint: "Combat starts momentarily" };
    case "FIGHTING":
      return { title: "Live", hint: "Round in progress" };
    case "RESOLUTION":
      return { title: "Results", hint: "Winner locked — cooldown" };
    default:
      return { title: phase, hint: null };
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatItemName(itemId: string): string {
  return itemId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hpPercent(agent: ShowcaseAgent | null): number {
  if (!agent || agent.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (agent.hp / agent.maxHp) * 100));
}

function HealthPill({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className={`duel-showcase-health-pill ${ok ? "ok" : "bad"}`}>
      <span className="dot" />
      <span className="label">{label}</span>
      <span className="detail">{detail}</span>
    </div>
  );
}

function AgentFaceoffCard({
  agent,
  side,
  isWinner,
}: {
  agent: ShowcaseAgent | null;
  side: "left" | "right";
  isWinner: boolean;
}) {
  const loadout = (agent?.inventory || []).filter(Boolean).slice(0, 6);
  const thought = agent?.monologues?.[0]?.content || "No recent monologue.";
  const health = hpPercent(agent);

  return (
    <div
      className={`duel-showcase-faceoff-card ${side} ${isWinner ? "winner" : ""}`}
    >
      {agent ? (
        <>
          <div className="duel-showcase-faceoff-top">
            <div>
              <div className="duel-showcase-faceoff-name">{agent.name}</div>
              <div className="duel-showcase-faceoff-meta">
                Cb {agent.combatLevel} · {agent.provider} · {agent.model}
              </div>
            </div>
            <div className="duel-showcase-faceoff-record">
              {agent.wins}-{agent.losses}
            </div>
          </div>
          <div className="duel-showcase-faceoff-hp">
            <div className="track">
              <div className="fill" style={{ width: `${health}%` }} />
            </div>
            <div className="numbers">
              <span>{agent.hp}</span>
              <span>/ {agent.maxHp}</span>
            </div>
          </div>
          <div className="duel-showcase-faceoff-stats">
            <div>
              <span>Damage</span>
              <strong>{agent.damageDealtThisFight}</strong>
            </div>
            <div>
              <span>Win Rate</span>
              <strong>
                {agent.wins + agent.losses > 0
                  ? `${Math.round((agent.wins / (agent.wins + agent.losses)) * 100)}%`
                  : "0%"}
              </strong>
            </div>
          </div>
          <div className="duel-showcase-faceoff-section">
            <div className="section-label">Hot Mic</div>
            <div className="section-quote">{thought}</div>
          </div>
          <div className="duel-showcase-faceoff-section">
            <div className="section-label">Loadout Glimpse</div>
            <div className="loadout-grid">
              {loadout.length > 0 ? (
                loadout.map((item) => (
                  <span
                    key={`${agent.id}-${item.slot}`}
                    className="loadout-pill"
                  >
                    {formatItemName(item.itemId)}
                    {item.quantity > 1 ? ` x${item.quantity}` : ""}
                  </span>
                ))
              ) : (
                <span className="loadout-empty">No inventory snapshot</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="duel-showcase-faceoff-empty">
          Waiting for contestant…
        </div>
      )}
    </div>
  );
}

export const DuelArenaShowcaseScreen: React.FC = () => {
  const [adminCode, setAdminCode] = useState(
    () => localStorage.getItem(ADMIN_CODE_KEY) || "",
  );
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkingStored, setCheckingStored] = useState(
    () => !!localStorage.getItem(ADMIN_CODE_KEY),
  );

  const [streamState, setStreamState] = useState<StreamingStateResponse | null>(
    null,
  );
  const [duelContext, setDuelContext] = useState<DuelContextResponse | null>(
    null,
  );
  const [leaderboardDetails, setLeaderboardDetails] =
    useState<LeaderboardDetailsResponse | null>(null);
  const [streamHealth, setStreamHealth] = useState<StreamHealth | null>(null);
  const [captureHealth, setCaptureHealth] = useState<CaptureHealth | null>(
    null,
  );
  const [directorCamera, setDirectorCamera] =
    useState<DirectorCameraState | null>(null);
  const [directorPending, setDirectorPending] = useState(false);
  const [cameraResetPending, setCameraResetPending] = useState(false);
  const [debugMode, setDebugMode] = useState<"spawn" | "existing">("spawn");
  const [debugTargetId, setDebugTargetId] = useState("");
  const [debugExistingOpponentId, setDebugExistingOpponentId] = useState("");
  const [debugOpponentName, setDebugOpponentName] = useState("");
  const [debugSparbotStyle, setDebugSparbotStyle] = useState<
    "auto" | "ranged" | "mage"
  >("auto");
  const [debugPending, setDebugPending] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string | null>(null);
  const [debugCleanupPending, setDebugCleanupPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Emergency controls
  const [emergencyPending, setEmergencyPending] = useState(false);
  const [emergencyStatus, setEmergencyStatus] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Server health + logs
  const [serverHealth, setServerHealth] = useState<{
    uptime: number;
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
    maintenance: boolean;
    phase: string;
  } | null>(null);
  const [serverLogs, setServerLogs] = useState<
    { ts: number; level: "info" | "warn" | "error"; msg: string }[]
  >([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const adminCodeRef = useRef(adminCode);
  adminCodeRef.current = adminCode;
  const eventSourceRef = useRef<EventSource | null>(null);
  const contextIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverHealthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${GAME_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-code": adminCodeRef.current,
        ...(init?.headers || {}),
      },
    });
    if (response.status === 403) {
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  }, []);

  // Emergency stop/start
  const emergencyStop = useCallback(
    async (message?: string) => {
      setEmergencyPending(true);
      setEmergencyStatus(null);
      try {
        await adminFetch("/admin/stream/emergency-stop", {
          method: "POST",
          body: JSON.stringify({ message }),
        });
        setIsMaintenance(true);
        setEmergencyStatus("🛑 STOPPED — markets paused, overlay active");
      } catch (e) {
        setEmergencyStatus(
          `Stop failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setEmergencyPending(false);
      }
    },
    [adminFetch],
  );

  const emergencyStart = useCallback(async () => {
    setEmergencyPending(true);
    setEmergencyStatus(null);
    try {
      await adminFetch("/admin/stream/emergency-start", { method: "POST" });
      setIsMaintenance(false);
      setEmergencyStatus("✅ STARTED — scheduling re-enabled");
    } catch (e) {
      setEmergencyStatus(
        `Start failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setEmergencyPending(false);
    }
  }, [adminFetch]);

  // Fetch server health + logs
  const fetchServerHealth = useCallback(async () => {
    try {
      const [healthRes, logsRes] = await Promise.all([
        adminFetch("/admin/stream/health"),
        adminFetch("/admin/stream/logs?limit=80"),
      ]);
      const health = (await healthRes.json()) as typeof serverHealth;
      const { logs } = (await logsRes.json()) as { logs: typeof serverLogs };
      setServerHealth(health);
      setIsMaintenance(health?.maintenance ?? false);
      setServerLogs(logs || []);
    } catch {
      // health fetch errors are non-fatal
    }
  }, [adminFetch]);

  // Poll health every 5s when authed
  useEffect(() => {
    if (!isAuthed) return;
    void fetchServerHealth();
    serverHealthIntervalRef.current = setInterval(
      () => void fetchServerHealth(),
      5000,
    );
    return () => {
      if (serverHealthIntervalRef.current)
        clearInterval(serverHealthIntervalRef.current);
    };
  }, [isAuthed, fetchServerHealth]);

  const tryAuth = useCallback(
    async (code: string): Promise<boolean> => {
      adminCodeRef.current = code;
      try {
        await adminFetch("/admin/stats");
        return true;
      } catch {
        return false;
      }
    },
    [adminFetch],
  );

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_CODE_KEY);
    if (!stored) {
      setCheckingStored(false);
      return;
    }
    let cancelled = false;
    tryAuth(stored).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setIsAuthed(true);
      } else {
        localStorage.removeItem(ADMIN_CODE_KEY);
      }
      setCheckingStored(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tryAuth]);

  const handleLogin = useCallback(async () => {
    if (!adminCode) return;
    setAuthLoading(true);
    setAuthError(null);
    const ok = await tryAuth(adminCode);
    if (ok) {
      setIsAuthed(true);
      localStorage.setItem(ADMIN_CODE_KEY, adminCode);
    } else {
      setAuthError("Invalid code or server unreachable");
    }
    setAuthLoading(false);
  }, [adminCode, tryAuth]);

  const fetchContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const [contextRes, detailsRes, adminStatusRes] = await Promise.all([
        fetch(`${GAME_API_URL}/api/streaming/duel-context`),
        fetch(
          `${GAME_API_URL}/api/streaming/leaderboard/details?historyLimit=10`,
        ),
        adminFetch("/admin/duels/status"),
      ]);

      if (contextRes.ok) {
        setDuelContext((await contextRes.json()) as DuelContextResponse);
      }
      if (detailsRes.ok) {
        setLeaderboardDetails(
          (await detailsRes.json()) as LeaderboardDetailsResponse,
        );
      }
      if (adminStatusRes.ok) {
        const adminStatus =
          (await adminStatusRes.json()) as AdminDuelStatusResponse;
        setDirectorCamera(adminStatus.directorCamera);
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load duel context",
      );
    } finally {
      setLoadingContext(false);
    }
  }, [adminFetch]);

  const fetchHealth = useCallback(async () => {
    try {
      const [rtmpRes, captureRes] = await Promise.all([
        fetch(`${GAME_API_URL}/api/streaming/rtmp/status`),
        fetch(`${GAME_API_URL}/api/streaming/capture/status`),
      ]);

      if (rtmpRes.ok) {
        setStreamHealth((await rtmpRes.json()) as StreamHealth);
      } else {
        setStreamHealth(
          (await rtmpRes.json().catch(() => ({
            error: "RTMP bridge unavailable",
          }))) as StreamHealth,
        );
      }

      if (captureRes.ok) {
        setCaptureHealth((await captureRes.json()) as CaptureHealth);
      } else {
        setCaptureHealth(
          (await captureRes.json().catch(() => ({
            error: "Capture pipeline unavailable",
          }))) as CaptureHealth,
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load stream health",
      );
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;

    fetchContext();
    fetchHealth();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const source = new EventSource(
      `${GAME_API_URL}/api/streaming/state/events`,
    );
    const applyState = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as StreamingStateResponse;
        setStreamState(parsed);
        setLoadError(null);
      } catch (error) {
        console.warn("[DuelArenaShowcase] Failed to parse SSE state:", error);
      }
    };
    const handleUnavailable = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as {
          message?: string;
          error?: string;
        };
        setLoadError(
          parsed.message || parsed.error || "Streaming state unavailable",
        );
      } catch {
        setLoadError("Streaming state unavailable");
      }
    };

    source.addEventListener("state", applyState as EventListener);
    source.addEventListener("reset", applyState as EventListener);
    source.addEventListener("unavailable", handleUnavailable as EventListener);
    source.onerror = () => {
      setLoadError("Lost live stream state connection");
    };
    eventSourceRef.current = source;

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [isAuthed, fetchContext, fetchHealth]);

  useEffect(() => {
    if (contextIntervalRef.current) {
      clearInterval(contextIntervalRef.current);
      contextIntervalRef.current = null;
    }
    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
      healthIntervalRef.current = null;
    }
    if (!isAuthed || !autoRefresh) return;

    contextIntervalRef.current = setInterval(fetchContext, CONTEXT_POLL_MS);
    healthIntervalRef.current = setInterval(fetchHealth, HEALTH_POLL_MS);

    return () => {
      if (contextIntervalRef.current) {
        clearInterval(contextIntervalRef.current);
        contextIntervalRef.current = null;
      }
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }
    };
  }, [autoRefresh, fetchContext, fetchHealth, isAuthed]);

  const cycle = duelContext?.cycle || streamState?.cycle || null;
  const leaderboard =
    duelContext?.leaderboard ||
    leaderboardDetails?.leaderboard ||
    streamState?.leaderboard ||
    [];
  const recentDuels = leaderboardDetails?.recentDuels || [];
  const phase = cycle?.phase || "IDLE";
  const phaseUi = showcasePhaseLabel(phase);
  const cameraTarget =
    duelContext?.cameraTarget || streamState?.cameraTarget || null;
  const winnerId = cycle?.winnerId || null;
  const streamOk = Boolean(
    streamHealth?.healthy ?? streamHealth?.stats?.healthy,
  );
  const captureOk = Boolean(
    captureHealth?.running ??
    captureHealth?.browserConnected ??
    captureHealth?.bridgeConnected,
  );

  const headline = useMemo(() => {
    if (!cycle) return "Awaiting next duel cycle";
    if (phase === "FIGHTING" && cycle.agent1 && cycle.agent2) {
      return `${cycle.agent1.name} vs ${cycle.agent2.name}`;
    }
    if (phase === "RESOLUTION" && cycle.winnerName) {
      return `${cycle.winnerName} claims the arena`;
    }
    if (phase === "IDLE" || phase === "ANNOUNCEMENT") {
      if (cycle.agent1 && cycle.agent2) {
        return `${cycle.agent1.name} vs ${cycle.agent2.name} — on deck`;
      }
      return "Next duel soon";
    }
    return `${phase} phase live`;
  }, [cycle, phase]);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      page: "stream",
      disableBridgeCapture: "1",
    });
    return `/?${params.toString()}`;
  }, []);

  const setDirectorMode = useCallback(
    async (
      mode: "auto" | "agent1" | "agent2" | "winner" | "target",
      targetId?: string | null,
    ) => {
      setDirectorPending(true);
      try {
        const response = await adminFetch("/admin/duels/camera", {
          method: "POST",
          body: JSON.stringify({ mode, targetId }),
        });
        const data = (await response.json()) as {
          directorCamera?: DirectorCameraState;
        };
        if (data.directorCamera) {
          setDirectorCamera(data.directorCamera);
        }
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to update director camera mode",
        );
      } finally {
        setDirectorPending(false);
      }
    },
    [adminFetch],
  );

  const resetCameraToArena = useCallback(async () => {
    setCameraResetPending(true);
    try {
      const response = await adminFetch("/admin/duels/camera/reset", {
        method: "POST",
      });
      const data = (await response.json()) as {
        directorCamera?: DirectorCameraState;
      };
      if (data.directorCamera) setDirectorCamera(data.directorCamera);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to reset camera",
      );
    } finally {
      setCameraResetPending(false);
    }
  }, [adminFetch]);

  const setDirectorShotPreset = useCallback(
    async (
      shotPreset:
        | "auto"
        | "countdown-wide"
        | "fight-close"
        | "fight-orbital"
        | "fight-overhead"
        | "winner-hero",
    ) => {
      setDirectorPending(true);
      try {
        const response = await adminFetch("/admin/duels/camera", {
          method: "POST",
          body: JSON.stringify({
            mode: directorCamera?.mode || "auto",
            targetId: directorCamera?.targetId,
            shotPreset,
          }),
        });
        const data = (await response.json()) as {
          directorCamera?: DirectorCameraState;
        };
        if (data.directorCamera) {
          setDirectorCamera(data.directorCamera);
        }
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to update shot preset",
        );
      } finally {
        setDirectorPending(false);
      }
    },
    [adminFetch, directorCamera?.mode, directorCamera?.targetId],
  );

  const directorModeLabel = useMemo(() => {
    switch (directorCamera?.mode) {
      case "agent1":
        return "Locked left fighter";
      case "agent2":
        return "Locked right fighter";
      case "winner":
        return "Winner hold";
      case "target":
        return "Custom lock";
      case "auto":
      default:
        return "Auto director";
    }
  }, [directorCamera?.mode]);

  const directorShotLabel = useMemo(() => {
    switch (directorCamera?.shotPreset) {
      case "countdown-wide":
        return "Countdown wide";
      case "fight-close":
        return "Fight close";
      case "fight-orbital":
        return "Orbital";
      case "fight-overhead":
        return "Overhead";
      case "winner-hero":
        return "Winner hero";
      case "auto":
      default:
        return "Auto shots";
    }
  }, [directorCamera?.shotPreset]);

  const debugAgentOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ id: string; label: string }> = [];

    const pushOption = (id?: string | null, name?: string | null) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      options.push({
        id,
        label: name?.trim() || id,
      });
    };

    pushOption(cycle?.agent1?.id, cycle?.agent1?.name);
    pushOption(cycle?.agent2?.id, cycle?.agent2?.name);
    leaderboard
      .slice(0, 12)
      .forEach((entry) => pushOption(entry.characterId, entry.name));

    return options;
  }, [
    cycle?.agent1?.id,
    cycle?.agent1?.name,
    cycle?.agent2?.id,
    cycle?.agent2?.name,
    leaderboard,
  ]);

  const debugOpponentOptions = useMemo(
    () => debugAgentOptions.filter((option) => option.id !== debugTargetId),
    [debugAgentOptions, debugTargetId],
  );

  useEffect(() => {
    if (debugAgentOptions.length === 0) {
      if (debugTargetId) {
        setDebugTargetId("");
      }
      return;
    }
    if (!debugAgentOptions.some((option) => option.id === debugTargetId)) {
      setDebugTargetId(debugAgentOptions[0]?.id || "");
    }
  }, [debugAgentOptions, debugTargetId]);

  useEffect(() => {
    if (debugOpponentOptions.length === 0) {
      if (debugExistingOpponentId) {
        setDebugExistingOpponentId("");
      }
      return;
    }
    if (
      !debugOpponentOptions.some(
        (option) => option.id === debugExistingOpponentId,
      )
    ) {
      setDebugExistingOpponentId(debugOpponentOptions[0]?.id || "");
    }
  }, [debugExistingOpponentId, debugOpponentOptions]);

  const spawnDebugMatchup = useCallback(async () => {
    if (!debugTargetId) return;
    if (debugMode === "existing" && !debugExistingOpponentId) return;

    setDebugPending(true);
    setDebugStatus(null);
    try {
      const response = await adminFetch("/admin/duels/debug-matchup", {
        method: "POST",
        body: JSON.stringify({
          targetCharacterId: debugTargetId,
          spawnOpponent: debugMode === "spawn",
          opponentCharacterId:
            debugMode === "existing" ? debugExistingOpponentId : undefined,
          opponentName:
            debugMode === "spawn"
              ? debugOpponentName.trim() || undefined
              : undefined,
          scriptedRole: "combat",
          sparbotCombatStyle:
            debugMode === "spawn" ? debugSparbotStyle : undefined,
        }),
      });
      const data = (await response.json()) as {
        mode?: "spawned" | "existing";
        opponent?: { name?: string; characterId?: string };
      };
      const targetLabel =
        debugAgentOptions.find((option) => option.id === debugTargetId)
          ?.label || debugTargetId;
      const opponentLabel =
        debugMode === "existing"
          ? debugOpponentOptions.find(
              (option) => option.id === debugExistingOpponentId,
            )?.label ||
            data.opponent?.characterId ||
            "selected opponent"
          : data.opponent?.name || "debug opponent";
      setDebugStatus(`Queued ${targetLabel} vs ${opponentLabel}`);
      setDebugOpponentName("");
      await fetchContext();
    } catch (error) {
      setDebugStatus(
        error instanceof Error
          ? error.message
          : "Failed to queue debug matchup",
      );
    } finally {
      setDebugPending(false);
    }
  }, [
    adminFetch,
    debugAgentOptions,
    debugExistingOpponentId,
    debugMode,
    debugOpponentName,
    debugSparbotStyle,
    debugOpponentOptions,
    debugTargetId,
    fetchContext,
  ]);

  const cleanupDebugMatchups = useCallback(async () => {
    setDebugCleanupPending(true);
    setDebugStatus(null);
    try {
      const response = await adminFetch("/admin/duels/debug-matchup/cleanup", {
        method: "POST",
      });
      const data = (await response.json()) as { removed?: number };
      setDebugStatus(`Removed ${data.removed ?? 0} spawned debug bot(s)`);
      await fetchContext();
    } catch (error) {
      setDebugStatus(
        error instanceof Error ? error.message : "Failed to cleanup debug bots",
      );
    } finally {
      setDebugCleanupPending(false);
    }
  }, [adminFetch, fetchContext]);

  if (!isAuthed && checkingStored) {
    return (
      <div className="duel-showcase-auth-shell">
        <div className="duel-showcase-auth-card">
          <RefreshCw className="spin" size={36} />
          <h1>Duel Arena Director</h1>
          <p>Verifying staff access…</p>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="duel-showcase-auth-shell">
        <div className="duel-showcase-auth-card">
          <Shield size={36} />
          <h1>Duel Arena Director</h1>
          <p>Moderator broadcast booth</p>
          {authError && (
            <div className="duel-showcase-auth-error">{authError}</div>
          )}
          <input
            className="duel-showcase-auth-input"
            type="password"
            placeholder="Admin code"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !authLoading) {
                void handleLogin();
              }
            }}
          />
          <button
            className="duel-showcase-auth-button"
            onClick={() => void handleLogin()}
            disabled={!adminCode || authLoading}
          >
            {authLoading ? "Checking…" : "Authenticate"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="duel-showcase">
      <header className="duel-showcase-topbar">
        <div>
          <div className="eyebrow">Mods Only</div>
          <h1>Duel Arena Director</h1>
          <p>{headline}</p>
        </div>
        <div className="duel-showcase-topbar-actions">
          <label className="duel-showcase-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            Auto refresh
          </label>
          <button
            className="duel-showcase-btn"
            onClick={() => void fetchContext()}
          >
            <RefreshCw size={14} />
            Refresh data
          </button>
          <a
            className="duel-showcase-btn ghost"
            href="/?page=stream"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            Open full stream
          </a>
          <a
            className="duel-showcase-btn ghost"
            href="/?page=agent-monitor"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            Agent monitor
          </a>
        </div>
      </header>

      {loadError && <div className="duel-showcase-error">{loadError}</div>}

      <main className="duel-showcase-grid">
        <section className="duel-showcase-stage">
          <div className="duel-showcase-stage-header">
            <div>
              <div className="panel-label">Live Arena Feed</div>
              <div className="panel-title">Cinematic duel view</div>
            </div>
            <div className="stage-meta">
              <span>
                <Signal size={13} />
                Live camera director
              </span>
              {cycle?.winnerName && (
                <span className="winner-callout">
                  <Trophy size={13} />
                  {cycle.winnerName}
                </span>
              )}
            </div>
          </div>
          <div className="duel-showcase-stage-frame">
            <iframe
              className="duel-showcase-stage-iframe"
              src={iframeSrc}
              title="Duel arena live stream"
              allow="autoplay; fullscreen"
            />
            <div className="duel-showcase-stage-overlay">
              <div className="duel-showcase-stage-overlay-row">
                <div
                  className={`phase-badge phase-badge--${phase.toLowerCase()}`}
                >
                  <span className="phase-badge-title">{phaseUi.title}</span>
                  {phaseUi.hint ? (
                    <span className="phase-badge-hint">{phaseUi.hint}</span>
                  ) : null}
                </div>
                {(phase === "IDLE" ||
                  phase === "ANNOUNCEMENT" ||
                  phase === "RESOLUTION") &&
                  cycle &&
                  cycle.timeRemaining > 0 && (
                    <div className="intermission-timer-chip">
                      <span className="intermission-timer-label">
                        {phase === "RESOLUTION" ? "Next in" : "Starts in"}
                      </span>
                      <span className="intermission-timer-value">
                        {formatTimeRemaining(cycle.timeRemaining)}
                      </span>
                    </div>
                  )}
              </div>
              {cycle?.countdown !== null &&
                cycle?.countdown !== undefined &&
                phase === "COUNTDOWN" && (
                  <div className="duel-showcase-stage-overlay-countdown">
                    <div className="countdown-chip">T-{cycle.countdown}</div>
                  </div>
                )}
            </div>
          </div>
          <div className="duel-showcase-faceoff">
            <AgentFaceoffCard
              agent={cycle?.agent1 || null}
              side="left"
              isWinner={winnerId !== null && winnerId === cycle?.agent1?.id}
            />
            <div className="duel-showcase-versus">
              <Swords size={22} />
              <span>VS</span>
            </div>
            <AgentFaceoffCard
              agent={cycle?.agent2 || null}
              side="right"
              isWinner={winnerId !== null && winnerId === cycle?.agent2?.id}
            />
          </div>
          <section className="duel-showcase-readout">
            <div className="panel-label">Broadcast Readout</div>
            <div className="duel-showcase-readout-grid">
              <div
                className={`duel-showcase-readout-card ${streamOk ? "ok" : "bad"}`}
              >
                <div className="duel-showcase-readout-top">
                  <div className="duel-showcase-readout-title">
                    <span className="dot" />
                    Broadcast
                  </div>
                  <strong>{streamOk ? "Healthy" : "Offline"}</strong>
                </div>
                <div className="duel-showcase-readout-detail">
                  {streamHealth?.stats?.spectators !== undefined
                    ? `${streamHealth.stats.spectators} spectators`
                    : streamHealth?.message || "status unknown"}
                </div>
              </div>
              <div
                className={`duel-showcase-readout-card ${captureOk ? "ok" : "bad"}`}
              >
                <div className="duel-showcase-readout-top">
                  <div className="duel-showcase-readout-title">
                    <span className="dot" />
                    Capture
                  </div>
                  <strong>{captureOk ? "Ready" : "Waiting"}</strong>
                </div>
                <div className="duel-showcase-readout-detail">
                  {typeof captureHealth?.status === "string"
                    ? captureHealth.status
                    : captureHealth?.message || "pipeline unknown"}
                </div>
              </div>
              <div className="duel-showcase-readout-card">
                <div className="duel-showcase-readout-top">
                  <div className="duel-showcase-readout-title">
                    <Eye size={14} />
                    Director
                  </div>
                  <strong>{directorModeLabel}</strong>
                </div>
                <div className="duel-showcase-readout-meta">
                  <span>Shot</span>
                  <strong>{directorShotLabel}</strong>
                </div>
                <div className="duel-showcase-readout-meta">
                  <span>Target</span>
                  <strong>
                    {directorCamera?.resolvedTargetId ||
                      cameraTarget ||
                      "auto-directing"}
                  </strong>
                </div>
              </div>
              <div className="duel-showcase-readout-card">
                <div className="duel-showcase-readout-top">
                  <div className="duel-showcase-readout-title">
                    <Activity size={14} />
                    Match State
                  </div>
                  <strong>{phase}</strong>
                </div>
                <div className="duel-showcase-readout-meta">
                  <span>Clock</span>
                  <strong>
                    {cycle ? formatTimeRemaining(cycle.timeRemaining) : "--:--"}
                  </strong>
                </div>
                <div className="duel-showcase-readout-meta">
                  <span>Leaderboard</span>
                  <strong>{leaderboard.length} agents</strong>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="duel-showcase-sidebar">
          <section className="duel-showcase-panel">
            <div className="panel-label">Director Controls</div>
            <button
              className="duel-showcase-btn duel-arena-reset-btn"
              onClick={() => void resetCameraToArena()}
              disabled={cameraResetPending || directorPending}
              title="Force camera back to auto mode targeting the current duel arena"
            >
              <Radio size={14} />
              {cameraResetPending ? "Resetting..." : "⚡ Reset to Arena"}
            </button>
            <div className="duel-showcase-director-meta">
              <span>{directorModeLabel}</span>
              <strong>
                {directorCamera?.resolvedTargetId ||
                  cameraTarget ||
                  "no live target"}
              </strong>
            </div>
            <div className="duel-showcase-director-grid">
              <button
                className={`director-btn ${directorCamera?.mode === "auto" ? "active" : ""}`}
                onClick={() => void setDirectorMode("auto")}
                disabled={directorPending}
              >
                Auto
              </button>
              <button
                className={`director-btn ${directorCamera?.mode === "agent1" ? "active" : ""}`}
                onClick={() =>
                  void setDirectorMode("agent1", cycle?.agent1?.id || null)
                }
                disabled={directorPending || !cycle?.agent1}
              >
                Follow {cycle?.agent1?.name || "Left"}
              </button>
              <button
                className={`director-btn ${directorCamera?.mode === "agent2" ? "active" : ""}`}
                onClick={() =>
                  void setDirectorMode("agent2", cycle?.agent2?.id || null)
                }
                disabled={directorPending || !cycle?.agent2}
              >
                Follow {cycle?.agent2?.name || "Right"}
              </button>
              <button
                className={`director-btn ${directorCamera?.mode === "winner" ? "active" : ""}`}
                onClick={() => void setDirectorMode("winner")}
                disabled={directorPending || !cycle?.winnerId}
              >
                Winner hold
              </button>
            </div>
            <div className="duel-showcase-director-subtitle">Shot presets</div>
            <div className="duel-showcase-director-grid presets">
              <button
                className={`director-btn ${directorCamera?.shotPreset === "auto" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("auto")}
                disabled={directorPending}
              >
                Auto shots
              </button>
              <button
                className={`director-btn ${directorCamera?.shotPreset === "countdown-wide" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("countdown-wide")}
                disabled={directorPending}
              >
                Countdown wide
              </button>
              <button
                className={`director-btn ${directorCamera?.shotPreset === "fight-close" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("fight-close")}
                disabled={directorPending}
              >
                Fight close
              </button>
              <button
                className={`director-btn ${directorCamera?.shotPreset === "fight-orbital" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("fight-orbital")}
                disabled={directorPending}
              >
                Orbital
              </button>
              <button
                className={`director-btn ${directorCamera?.shotPreset === "fight-overhead" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("fight-overhead")}
                disabled={directorPending}
              >
                Overhead
              </button>
              <button
                className={`director-btn ${directorCamera?.shotPreset === "winner-hero" ? "active" : ""}`}
                onClick={() => void setDirectorShotPreset("winner-hero")}
                disabled={directorPending}
              >
                Winner hero
              </button>
            </div>
          </section>

          <section className="duel-showcase-panel">
            <div className="panel-label">Debug Matchup</div>
            <div className="duel-showcase-debug-copy">
              Queue a selected live agent against either a fresh sparring bot or
              another existing live agent.
            </div>
            <div className="duel-showcase-debug-form">
              <select
                className="duel-showcase-select"
                value={debugTargetId}
                onChange={(event) => setDebugTargetId(event.target.value)}
                disabled={debugPending || debugAgentOptions.length === 0}
              >
                {debugAgentOptions.length === 0 ? (
                  <option value="">No agents available</option>
                ) : (
                  debugAgentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
              <div className="duel-showcase-debug-mode-row">
                <button
                  className={`director-btn ${debugMode === "spawn" ? "active" : ""}`}
                  onClick={() => setDebugMode("spawn")}
                  disabled={debugPending}
                >
                  Fresh sparbot
                </button>
                <button
                  className={`director-btn ${debugMode === "existing" ? "active" : ""}`}
                  onClick={() => setDebugMode("existing")}
                  disabled={debugPending}
                >
                  Reuse existing agent
                </button>
              </div>
              {debugMode === "spawn" ? (
                <>
                  <div className="duel-showcase-director-subtitle">
                    Sparbot style
                  </div>
                  <select
                    className="duel-showcase-select"
                    value={debugSparbotStyle}
                    onChange={(event) =>
                      setDebugSparbotStyle(
                        event.target.value as "auto" | "ranged" | "mage",
                      )
                    }
                    disabled={debugPending}
                    aria-label="Sparbot combat style"
                  >
                    <option value="auto">Sparbot: auto (skills)</option>
                    <option value="ranged">Sparbot: ranged</option>
                    <option value="mage">Sparbot: mage</option>
                  </select>
                  <input
                    className="duel-showcase-input"
                    type="text"
                    value={debugOpponentName}
                    onChange={(event) =>
                      setDebugOpponentName(event.target.value)
                    }
                    placeholder="Optional opponent name"
                    disabled={debugPending}
                  />
                </>
              ) : (
                <select
                  className="duel-showcase-select"
                  value={debugExistingOpponentId}
                  onChange={(event) =>
                    setDebugExistingOpponentId(event.target.value)
                  }
                  disabled={debugPending || debugOpponentOptions.length === 0}
                >
                  {debugOpponentOptions.length === 0 ? (
                    <option value="">No alternate agents available</option>
                  ) : (
                    debugOpponentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              )}
              <button
                className="duel-showcase-btn"
                onClick={() => void spawnDebugMatchup()}
                disabled={
                  debugPending ||
                  !debugTargetId ||
                  (debugMode === "existing" && !debugExistingOpponentId)
                }
              >
                <Bot size={14} />
                {debugPending
                  ? debugMode === "existing"
                    ? "Queueing..."
                    : "Spawning..."
                  : debugMode === "existing"
                    ? "Queue existing matchup"
                    : "Spawn sparring bot"}
              </button>
            </div>
            <div className="duel-showcase-debug-hint">
              Auto shots already phase-shift between countdown, fight, and
              finish unless you pin a preset.
            </div>
            <button
              className="duel-showcase-btn ghost"
              onClick={() => void cleanupDebugMatchups()}
              disabled={debugCleanupPending}
            >
              <RefreshCw
                size={14}
                className={debugCleanupPending ? "spin" : undefined}
              />
              {debugCleanupPending
                ? "Cleaning up..."
                : "Remove spawned debug bots"}
            </button>
            {debugStatus ? (
              <div className="duel-showcase-debug-status">{debugStatus}</div>
            ) : null}
          </section>

          <section className="duel-showcase-panel">
            <div className="panel-label">Director Notes</div>
            <div className="duel-showcase-notes">
              <div className="note-row">
                <span>On Air</span>
                <strong>{streamOk ? "Healthy" : "Needs attention"}</strong>
              </div>
              <div className="note-row">
                <span>Capture</span>
                <strong>{captureOk ? "Flowing" : "Degraded"}</strong>
              </div>
              <div className="note-row">
                <span>Frame narrative</span>
                <strong>
                  {phase === "FIGHTING"
                    ? "Let the camera ride the damage race"
                    : phase === "RESOLUTION"
                      ? "Hold winner celebration"
                      : "Set up the next clash"}
                </strong>
              </div>
              <div className="note-row">
                <span>Context feed</span>
                <strong>{loadingContext ? "Refreshing…" : "Ready"}</strong>
              </div>
            </div>
          </section>

          <section className="duel-showcase-panel">
            <div className="panel-label">Leaderboard</div>
            <div className="duel-showcase-leaderboard">
              {leaderboard.slice(0, 8).map((entry) => (
                <div key={entry.characterId} className="leaderboard-row">
                  <div className="rank">#{entry.rank}</div>
                  <div className="meta">
                    <div className="name">{entry.name}</div>
                    <div className="model">
                      {entry.provider} · {entry.model}
                    </div>
                  </div>
                  <div className="record">
                    <strong>{entry.wins}</strong>
                    <span>{Math.round(entry.winRate * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Emergency Controls ─────────────────────────────── */}
          <section
            className={`duel-showcase-panel emergency-panel ${isMaintenance ? "in-maintenance" : ""}`}
          >
            <div className="panel-label">
              <Shield size={13} />
              Emergency Controls
              {isMaintenance && (
                <span className="maintenance-badge">MAINTENANCE</span>
              )}
            </div>
            <div className="emergency-btn-row">
              <button
                className="emergency-stop-btn"
                onClick={() => void emergencyStop()}
                disabled={emergencyPending || isMaintenance}
                title="Halt scheduling, pause markets, push overlay to stream"
              >
                ⛔ Emergency Stop
              </button>
              <button
                className="emergency-start-btn"
                onClick={() => void emergencyStart()}
                disabled={emergencyPending || !isMaintenance}
                title="Re-enable duel scheduling after maintenance"
              >
                ▶ Resume Stream
              </button>
            </div>
            {emergencyStatus && (
              <div
                className={`emergency-status ${isMaintenance ? "stopped" : "started"}`}
              >
                {emergencyStatus}
              </div>
            )}
          </section>

          {/* ── Server Health ──────────────────────────────────── */}
          <section className="duel-showcase-panel">
            <div className="panel-label">Server Health</div>
            {serverHealth ? (
              <div className="server-health-grid">
                <div className="health-cell">
                  <span>Heap</span>
                  <strong
                    className={
                      serverHealth.memory.heapUsedMB > 800 ? "warn" : ""
                    }
                  >
                    {serverHealth.memory.heapUsedMB} /{" "}
                    {serverHealth.memory.heapTotalMB} MB
                  </strong>
                </div>
                <div className="health-cell">
                  <span>RSS</span>
                  <strong>{serverHealth.memory.rssMB} MB</strong>
                </div>
                <div className="health-cell">
                  <span>Uptime</span>
                  <strong>
                    {Math.floor(serverHealth.uptime / 60)}m{" "}
                    {serverHealth.uptime % 60}s
                  </strong>
                </div>
                <div className="health-cell">
                  <span>Phase</span>
                  <strong>{serverHealth.phase}</strong>
                </div>
              </div>
            ) : (
              <div className="duel-showcase-empty">Polling…</div>
            )}
            {/* Live Logs */}
            <button
              className="logs-toggle-btn"
              onClick={() => setLogsExpanded((v) => !v)}
            >
              {logsExpanded ? "▲ Hide logs" : "▼ Show server logs"}
            </button>
            {logsExpanded && (
              <div className="server-logs-box">
                {serverLogs.length === 0 && (
                  <span className="log-empty">No logs yet.</span>
                )}
                {[...serverLogs].reverse().map((line, i) => (
                  <div key={i} className={`log-line log-${line.level}`}>
                    <span className="log-ts">
                      {new Date(line.ts).toLocaleTimeString()}
                    </span>
                    <span className="log-msg">{line.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="duel-showcase-panel">
            <div className="panel-label">Recent Results</div>
            <div className="duel-showcase-recent">
              {recentDuels.length > 0 ? (
                recentDuels.slice(0, 8).map((duel) => (
                  <div key={duel.cycleId} className="recent-row">
                    <div className="recent-title">
                      <Bot size={13} />
                      <span>
                        <strong>{duel.winnerName}</strong> beat {duel.loserName}
                      </span>
                    </div>
                    <div className="recent-meta">
                      <span>{duel.winReason.replace(/_/g, " ")}</span>
                      <span>{formatRelativeTime(duel.finishedAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="duel-showcase-empty">
                  No recent duel history yet.
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
