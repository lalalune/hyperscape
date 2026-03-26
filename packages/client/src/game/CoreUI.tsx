import React, { useEffect, useRef, useState } from "react";
import { useThemeStore } from "@/ui";

import type { ControlAction, EventMap } from "@hyperscape/shared";
import {
  buttons,
  cls,
  EventType,
  isTouch,
  propToLabel,
} from "@hyperscape/shared";
import type { ClientWorld, PlayerStats } from "../types";
import {
  isUIUpdateEvent,
  isPlayerStatsData,
  isSkillsUpdateEvent,
  isPrayerPointsChangedEvent,
  isPrayerStateSyncEvent,
} from "../types/guards";
import { ActionProgressBar } from "./hud/ActionProgressBar";
import { ChatProvider } from "./chat/ChatContext";
import { EntityContextMenu } from "./hud/EntityContextMenu";
import { HandIcon, MouseLeftIcon, MouseRightIcon, MouseWheelIcon } from "@/ui";
import { LoadingScreen } from "../screens/LoadingScreen";
import { InterfaceManager } from "./interface/InterfaceManager";
import { StatusBars } from "./hud/StatusBars";
import { XPProgressOrb } from "./hud/XPProgressOrb";
import { LevelUpNotification } from "./hud/level-up";
import { EscapeMenu } from "./hud/EscapeMenu";
import { ConnectionIndicator } from "./hud/ConnectionIndicator";
import { NotificationContainer } from "@/ui/components";
import { Disconnected, KickedOverlay, DeathScreen } from "./hud/overlays";
import { SpectatorOverlay } from "./SpectatorOverlay";
import {
  COLORS,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  typography,
} from "../constants";

// Type for icon components
type IconComponent = React.ComponentType<{ size?: number | string }>;

export function CoreUI({ world }: { world: ClientWorld }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  // Track system and asset progress separately to gate presentation on assets
  const [systemsComplete, setSystemsComplete] = useState(false);
  const [assetsProgress, setAssetsProgress] = useState(0);

  // Check if this is spectator mode (from embedded config)
  const isSpectatorMode = (() => {
    const config = window.__HYPERSCAPE_CONFIG__;
    return config?.mode === "spectator";
  })();

  // The entity being followed in spectator mode — prefer config, fall back to URL param
  const spectatorFollowId = (() => {
    const config = window.__HYPERSCAPE_CONFIG__;
    if (config?.followEntity) return config.followEntity;
    if (config?.characterId) return config.characterId;
    return new URLSearchParams(window.location.search).get("followEntity");
  })();

  // Presentation gating flags
  const [playerReady, setPlayerReady] = useState(() => !!world.entities.player);
  const [physReady, setPhysReady] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [player, setPlayer] = useState(() => world.entities.player);
  const [targetAvatarLoaded, setTargetAvatarLoaded] = useState(false);
  const [uiVisible, setUIVisible] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [kicked, setKicked] = useState<string | null>(null);
  const [characterFlowActive, setCharacterFlowActive] = useState(false);
  const [characterList, setCharacterList] = useState<
    Array<{ id: string; name: string; level?: number }>
  >(() => {
    const net = world.network as {
      lastCharacterList?: Array<{ id: string; name: string; level?: number }>;
    };
    return net.lastCharacterList || [];
  });
  const [deathScreen, setDeathScreen] = useState<{
    message: string;
    killedBy: string;
    respawnTime: number;
  } | null>(null);

  // Player stats for StatusBars (same pattern as InterfaceManager)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    // Get the target entity ID for spectators
    const getSpectatorTargetId = () => {
      const config = window.__HYPERSCAPE_CONFIG__;
      return config?.followEntity || config?.characterId;
    };

    // Create handlers with proper types
    const handleReady = () => {
      // A READY signal indicates a major subsystem finished; mark loading as potentially complete
      setLoadingComplete(true);
    };

    const handleLoadingProgress = (data: unknown) => {
      const progressData = data as {
        progress: number;
        stage?: string;
        total?: number;
        current?: number;
      };
      // Prefer system-stage events when present
      if (progressData.stage) {
        if (progressData.progress >= 100) {
          setSystemsComplete(true);
        }
      } else if (typeof progressData.total === "number") {
        setAssetsProgress(progressData.progress);
      }
    };

    const handlePlayerSpawned = () => {
      // Only handle for non-spectators (spectators don't spawn local players)
      if (!isSpectatorMode) {
        const playerEntity = world.entities?.player;
        if (playerEntity) {
          setPlayer(playerEntity);
          setPlayerReady(true);
        }
      }
    };

    const handleAvatarComplete = (data: {
      playerId: string;
      success: boolean;
    }) => {
      if (isSpectatorMode) {
        // For spectators: check if this is the entity we're following
        const targetId = getSpectatorTargetId();
        if (data.playerId === targetId && data.success) {
          setTargetAvatarLoaded(true);
        }
      } else {
        // For normal players: any avatar complete means player is ready
        setPlayerReady(true);
      }
    };

    const handleUIToggle = (data: { visible: boolean }) => {
      setUIVisible(data.visible);
    };

    const handleUIKick = (data: { playerId: string; reason: string }) => {
      setKicked(data.reason || "Kicked from server");
    };
    const handleDisconnected = () => setDisconnected(true);
    const handleDeathScreen = (...args: unknown[]) => {
      const data = args[0] as {
        message: string;
        killedBy: string;
        respawnTime: number;
      };
      setDeathScreen(data);
    };
    const handleDeathScreenClose = () => {
      setDeathScreen(null);
    };

    // Add listeners
    world.on(EventType.READY, handleReady);
    world.on(EventType.ASSETS_LOADING_PROGRESS, handleLoadingProgress);
    world.on(EventType.PLAYER_SPAWNED, handlePlayerSpawned);
    world.on(EventType.AVATAR_LOAD_COMPLETE, handleAvatarComplete);
    // Physics system emits a non-enum event on ready
    const handlePhysicsReady = () => setPhysReady(true);
    world.on("physics:ready", handlePhysicsReady);
    world.on(EventType.UI_TOGGLE, handleUIToggle);
    world.on(EventType.UI_KICK, handleUIKick);
    world.on(EventType.NETWORK_DISCONNECTED, handleDisconnected);
    world.on(EventType.UI_DEATH_SCREEN, handleDeathScreen);
    world.on(EventType.UI_DEATH_SCREEN_CLOSE, handleDeathScreenClose);
    // Character selection flow (server-flagged)
    // Define named handlers for proper cleanup (anonymous functions don't work with off())
    const handleCharacterList = (data: unknown): void => {
      const listData = data as {
        characters?: Array<{ id: string; name: string; level?: number }>;
      };
      setCharacterList(listData.characters || []);
      setCharacterFlowActive(true);
    };
    const handleCharacterSelected = (): void => setCharacterFlowActive(false);
    world.on("character:list", handleCharacterList);
    world.on("character:selected", handleCharacterSelected);
    // If the packet arrived before UI mounted, consult network cache
    const network = world.network as {
      lastCharacterList?: Array<{ id: string; name: string; level?: number }>;
    };
    if (network.lastCharacterList) {
      setCharacterList(network.lastCharacterList);
      setCharacterFlowActive(true);
    }

    return () => {
      // Clean up the ready timeout if it exists
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
      world.off(EventType.READY, handleReady);
      world.off(EventType.ASSETS_LOADING_PROGRESS, handleLoadingProgress);
      world.off(EventType.PLAYER_SPAWNED, handlePlayerSpawned);
      world.off(EventType.AVATAR_LOAD_COMPLETE, handleAvatarComplete);
      world.off("physics:ready", handlePhysicsReady);
      world.off(EventType.UI_TOGGLE, handleUIToggle);
      world.off(EventType.UI_KICK, handleUIKick);
      world.off(EventType.NETWORK_DISCONNECTED, handleDisconnected);
      world.off(EventType.UI_DEATH_SCREEN, handleDeathScreen);
      world.off(EventType.UI_DEATH_SCREEN_CLOSE, handleDeathScreenClose);
      world.off("character:list", handleCharacterList);
      world.off("character:selected", handleCharacterSelected);
    };
  }, [world, isSpectatorMode]);

  // Poll terrain readiness until ready
  useEffect(() => {
    let terrainInterval: NodeJS.Timeout | null = null;
    function startPolling() {
      if (terrainInterval) return;
      terrainInterval = setInterval(() => {
        // CRITICAL: For spectators, check terrain directly without requiring local player
        if (isSpectatorMode) {
          const terrain = world.getSystem?.("terrain") as
            | { isReady?: () => boolean }
            | undefined;
          if (terrain && terrain.isReady && terrain.isReady()) {
            setTerrainReady(true);
            if (terrainInterval) {
              clearInterval(terrainInterval);
              terrainInterval = null;
            }
          }
          return;
        }

        // For normal players: require player entity before checking terrain
        const player = world.entities?.player as
          | { position?: { x: number; z: number } }
          | undefined;
        if (!player || !player.position) return;
        const terrain = world.getSystem?.("terrain") as
          | { isReady?: () => boolean }
          | undefined;
        if (terrain && terrain.isReady) {
          if (terrain.isReady()) {
            setTerrainReady(true);
            if (terrainInterval) {
              clearInterval(terrainInterval);
              terrainInterval = null;
            }
          }
        }
      }, 100);
    }
    startPolling();
    return () => {
      if (terrainInterval) clearInterval(terrainInterval);
    };
  }, [world, isSpectatorMode]);

  // For spectators: set playerReady when target avatar AND terrain are loaded
  // This mimics the normal player flow: wait for avatar + terrain before presenting
  useEffect(() => {
    if (isSpectatorMode && targetAvatarLoaded && terrainReady && !playerReady) {
      setPlayerReady(true);
    }
  }, [isSpectatorMode, targetAvatarLoaded, terrainReady, playerReady]);

  // Start the 300ms delay once all presentable conditions are met
  useEffect(() => {
    // Show game once player's avatar is ready and physics system is initialized
    // For spectators: also require terrain and target avatar to be ready
    const canPresent = isSpectatorMode
      ? playerReady && terrainReady && physReady
      : playerReady && physReady;
    if (canPresent) {
      // Clear any existing timeout
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }

      // Add 0.3 second delay to allow users to see the full loading bar at 100%
      readyTimeoutRef.current = setTimeout(() => {
        setReady(true);
        readyTimeoutRef.current = null;
      }, 300);
    }

    return () => {
      // Clean up timeout on unmount or when dependencies change
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    };
  }, [playerReady, physReady, isSpectatorMode, terrainReady]);

  // Expose loading state for debugging and analytics
  useEffect(() => {
    const loadingState = {
      ready,
      loadingComplete,
      systemsComplete,
      assetsProgress,
      playerReady,
      physReady,
      terrainReady,
      playerId: player?.id || null,
    };
    (
      window as Window & { __HYPERSCAPE_LOADING__?: typeof loadingState }
    ).__HYPERSCAPE_LOADING__ = loadingState;
  }, [
    ready,
    loadingComplete,
    systemsComplete,
    assetsProgress,
    playerReady,
    physReady,
    terrainReady,
    player,
  ]);

  // Extract playerId for dependency tracking - prevents stale closures
  const localPlayerId = world.entities?.player?.id;

  // Subscribe to player stats updates (for StatusBars)
  useEffect(() => {
    const onUIUpdate = (raw: unknown) => {
      if (!isUIUpdateEvent(raw)) {
        console.warn("[CoreUI] Invalid UI update event:", raw);
        return;
      }
      if (raw.component === "player" && isPlayerStatsData(raw.data)) {
        // PlayerStatsData is a partial type - safe to cast since we merge with existing state
        const newData = raw.data as unknown as Partial<PlayerStats>;
        // Merge with existing state to preserve prayer data
        setPlayerStats((prev) =>
          prev
            ? {
                ...prev,
                ...newData,
                prayerPoints: newData.prayerPoints || prev.prayerPoints,
              }
            : (newData as PlayerStats),
        );
      }
    };

    const onSkillsUpdate = (raw: unknown) => {
      if (!isSkillsUpdateEvent(raw)) {
        console.warn("[CoreUI] Invalid skills update event:", raw);
        return;
      }
      if (!localPlayerId || raw.playerId === localPlayerId) {
        // Skills event only has skills data - merge with existing state
        const updatedSkills = raw.skills as unknown as PlayerStats["skills"];
        setPlayerStats((prev) =>
          prev
            ? { ...prev, skills: updatedSkills }
            : ({ skills: updatedSkills } as unknown as PlayerStats),
        );
      }
    };

    const onPrayerPointsChanged = (raw: unknown) => {
      if (!isPrayerPointsChangedEvent(raw)) {
        console.warn("[CoreUI] Invalid prayer points changed event:", raw);
        return;
      }
      if (!localPlayerId || raw.playerId === localPlayerId) {
        setPlayerStats((prev) =>
          prev
            ? {
                ...prev,
                prayerPoints: { current: raw.points, max: raw.maxPoints },
              }
            : ({
                prayerPoints: { current: raw.points, max: raw.maxPoints },
              } as PlayerStats),
        );
      }
    };

    // Handle full prayer state sync (initial load, altar pray, etc.)
    const onPrayerStateSync = (raw: unknown) => {
      if (!isPrayerStateSyncEvent(raw)) {
        console.warn("[CoreUI] Invalid prayer state sync event:", raw);
        return;
      }
      if (!localPlayerId || raw.playerId === localPlayerId) {
        setPlayerStats((prev) =>
          prev
            ? {
                ...prev,
                prayerPoints: { current: raw.points, max: raw.maxPoints },
              }
            : ({
                prayerPoints: { current: raw.points, max: raw.maxPoints },
              } as PlayerStats),
        );
      }
    };

    world.on(EventType.UI_UPDATE, onUIUpdate);
    world.on(EventType.SKILLS_UPDATED, onSkillsUpdate);
    world.on(EventType.PRAYER_POINTS_CHANGED, onPrayerPointsChanged);
    world.on(EventType.PRAYER_STATE_SYNC, onPrayerStateSync);

    return () => {
      world.off(EventType.UI_UPDATE, onUIUpdate);
      world.off(EventType.SKILLS_UPDATED, onSkillsUpdate);
      world.off(EventType.PRAYER_POINTS_CHANGED, onPrayerPointsChanged);
      world.off(EventType.PRAYER_STATE_SYNC, onPrayerStateSync);
    };
  }, [world, localPlayerId]);

  return (
    <ChatProvider>
      <main
        id="main-content"
        role="main"
        aria-label="Game Interface"
        ref={ref}
        className="coreui absolute inset-0 overflow-hidden pointer-events-none"
      >
        {disconnected && <Disconnected />}
        {<Toast world={world} />}
        {<ConnectionIndicator world={world} />}
        {<NotificationContainer />}
        {/* UI container */}
        <div className="absolute inset-0 pointer-events-none">
          {ready && uiVisible && <ActionsBlock world={world} />}
          {ready && uiVisible && <StatusBars stats={playerStats} />}
          {ready && uiVisible && <XPProgressOrb world={world} />}
          {ready && <LevelUpNotification world={world} />}
          {ready && uiVisible && <InterfaceManager world={world} />}
          {ready && uiVisible && <ActionProgressBar world={world} />}
          {ready && uiVisible && isTouch && <TouchBtns world={world} />}
          {ready && <EntityContextMenu world={world} />}
          {ready && <EscapeMenu world={world} />}
          <div id="core-ui-portal" />
        </div>
        {/* Non-scaled overlays - full screen elements */}
        {!ready && !characterFlowActive && (
          <LoadingScreen world={world} message="Loading world..." />
        )}
        {!ready && characterFlowActive && (
          <CharacterSelectOverlay world={world} characters={characterList} />
        )}
        {kicked && <KickedOverlay code={kicked} />}
        {deathScreen && <DeathScreen data={deathScreen} world={world} />}
        {ready && isSpectatorMode && spectatorFollowId && (
          <SpectatorOverlay characterId={spectatorFollowId} />
        )}
      </main>
    </ChatProvider>
  );
}

function ActionsBlock({ world }: { world: ClientWorld }) {
  const [showActions, setShowActions] = useState(() => world.prefs?.actions);
  useEffect(() => {
    const onPrefsChange = (changes: Record<string, { value: unknown }>) => {
      if (changes.actions) setShowActions(changes.actions.value as boolean);
    };
    world.prefs?.on("change", onPrefsChange);
    return () => {
      world.prefs?.off("change", onPrefsChange);
    };
  }, []);
  if (isTouch) return null;
  if (!showActions) return null;
  return (
    <div className="absolute flex flex-col items-center top-[calc(2rem+env(safe-area-inset-top))] left-[calc(2rem+env(safe-area-inset-left))] bottom-[calc(2rem+env(safe-area-inset-bottom))] xl:top-[calc(2rem+env(safe-area-inset-top))] xl:left-[calc(2rem+env(safe-area-inset-left))] xl:bottom-[calc(2rem+env(safe-area-inset-bottom))] max-xl:top-[calc(1rem+env(safe-area-inset-top))] max-xl:left-[calc(1rem+env(safe-area-inset-left))] max-xl:bottom-[calc(1rem+env(safe-area-inset-bottom))]">
      <Actions world={world} />
    </div>
  );
}

function Actions({ world }: { world: ClientWorld }) {
  const [actions, setActions] = useState(() => world.controls?.actions || []);
  useEffect(() => {
    const handleActions = (data: unknown) => {
      if (Array.isArray(data)) {
        setActions(data);
      }
    };
    world.on(EventType.UI_ACTIONS_UPDATE, handleActions);
    return () => {
      world.off(EventType.UI_ACTIONS_UPDATE, handleActions);
    };
  }, []);
  return (
    <div className="actions flex-1 flex flex-col justify-center">
      {actions.map((action) => (
        <div className="actions-item flex items-center mb-2" key={action.id}>
          <div className="actions-item-icon">{getActionIcon(action)}</div>
          <div
            className="actions-item-label ml-2.5"
            style={{
              paintOrder: "stroke fill",
              WebkitTextStroke: "0.25rem rgba(0, 0, 0, 0.2)",
            }}
          >
            {(action as ControlAction & { label?: string }).label}
          </div>
        </div>
      ))}
    </div>
  );
}

function getActionIcon(
  action: ControlAction & { btn?: string; label?: string },
) {
  if (action.type === "custom") {
    return <ActionPill label={action.btn || ""} />;
  }
  if (action.type === "controlLeft") {
    return <ActionPill label="Ctrl" />;
  }
  if (action.type === "mouseLeft") {
    return <ActionIcon icon={MouseLeftIcon} />;
  }
  if (action.type === "mouseRight") {
    return <ActionIcon icon={MouseRightIcon} />;
  }
  if (action.type === "mouseWheel") {
    return <ActionIcon icon={MouseWheelIcon} />;
  }
  if (buttons.has(action.type)) {
    return (
      <ActionPill
        label={propToLabel[action.type as keyof typeof propToLabel]}
      />
    );
  }
  return <ActionPill label="?" />;
}

function ActionPill({ label }: { label: string }) {
  return (
    <div
      className="actionpill border border-white rounded bg-black/10 px-1.5 py-1 text-[0.875em] shadow-md"
      style={{
        paintOrder: "stroke fill",
        WebkitTextStroke: "0.25rem rgba(0, 0, 0, 0.2)",
      }}
    >
      {label}
    </div>
  );
}

function ActionIcon({ icon }: { icon: IconComponent }) {
  const Icon = icon;
  return (
    <div className="actionicon leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
      <Icon size="1.5rem" />
    </div>
  );
}

function Toast({ world }: { world: ClientWorld }) {
  const [msg, setMsg] = useState<{
    text: string;
    id: number;
    position?: { x: number; y: number };
  } | null>(null);
  useEffect(() => {
    let ids = 0;
    const onToast = (data: EventMap[EventType.UI_TOAST]) => {
      setMsg({ text: data.message, id: ++ids, position: data.position });
    };
    world.on(EventType.UI_TOAST, onToast);
    return () => {
      world.off(EventType.UI_TOAST, onToast);
    };
  }, []);
  if (!msg) return null;

  // RS3-style: If position is provided, render positioned tooltip
  if (msg.position) {
    return (
      <>
        <style>{`
          @keyframes examineTooltipIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
        <PositionedToast key={msg.id} text={msg.text} position={msg.position} />
      </>
    );
  }

  // Default: Centered toast (for system messages)
  return (
    <div
      className="absolute left-0 right-0 flex justify-center"
      style={{
        top: "calc(50% - 4.375rem)",
      }}
    >
      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      {msg && <ToastMsg key={msg.id} text={msg.text} />}
    </div>
  );
}

/** RS3-style positioned tooltip that appears near cursor */
function PositionedToast({
  text,
  position,
}: {
  text: string;
  position: { x: number; y: number };
}) {
  const [visible, setVisible] = useState(true);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Calculate position with edge detection
    const tooltipWidth = 250; // Estimated max width
    const tooltipHeight = 40; // Estimated height
    const offset = 15; // Offset from cursor
    const padding = 10; // Padding from viewport edge

    let x = position.x + offset;
    let y = position.y + offset;

    // Flip horizontally if too close to right edge
    if (x + tooltipWidth + padding > window.innerWidth) {
      x = position.x - tooltipWidth - offset;
    }

    // Flip vertically if too close to bottom edge
    if (y + tooltipHeight + padding > window.innerHeight) {
      y = position.y - tooltipHeight - offset;
    }

    // Clamp to viewport
    x = Math.max(
      padding,
      Math.min(x, window.innerWidth - tooltipWidth - padding),
    );
    y = Math.max(
      padding,
      Math.min(y, window.innerHeight - tooltipHeight - padding),
    );

    setCoords({ x, y });

    // RS3-style: Display for 2.5 seconds then fade out
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [position]);

  return (
    <div
      ref={tooltipRef}
      className={cls("fixed pointer-events-none max-w-[250px]", {
        "opacity-100 scale-100 animate-[examineTooltipIn_0.15s_ease-out]":
          visible,
        "opacity-0 scale-95 transition-all duration-300 ease-in-out": !visible,
      })}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        padding: `${spacing.sm} ${spacing.md}`,
        background: COLORS.BG_SOLID,
        border: `1px solid ${COLORS.BORDER_SECONDARY}`,
        backdropFilter: "blur(8px)",
        borderRadius: borderRadius.lg,
        boxShadow: shadows.panel,
        zIndex: zIndex.tooltip,
        color: COLORS.TEXT_PRIMARY,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        fontWeight: typography.fontWeight.medium,
      }}
    >
      {text}
    </div>
  );
}

function ToastMsg({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000); // Show for 3 seconds
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className={cls(
        "flex items-center justify-center transition-all duration-100 ease-in-out",
        {
          "opacity-100 translate-y-0 scale-100 animate-[toastIn_0.1s_ease-in-out]":
            visible,
          "opacity-0 translate-y-2.5 scale-90": !visible,
        },
      )}
      style={{
        height: spacing["4xl"],
        padding: `0 ${spacing.lg}`,
        background: COLORS.BG_SOLID,
        border: `1px solid ${COLORS.BORDER_SECONDARY}`,
        backdropFilter: "blur(5px)",
        borderRadius: borderRadius.full,
        color: COLORS.TEXT_PRIMARY,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        fontWeight: typography.fontWeight.medium,
      }}
    >
      {text}
    </div>
  );
}

type CharEntry = { id: string; name: string; level?: number };

function CharacterSelectOverlay({
  world,
  characters,
}: {
  world: ClientWorld;
  characters: CharEntry[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const network = world.network as {
    requestCharacterSelect: (id: string) => void;
    requestCharacterCreate: (name: string) => void;
    requestEnterWorld: () => void;
  };

  // Auto-select newly created character
  useEffect(() => {
    const onCreated = (data: unknown) => {
      const created = data as { id: string; name: string };
      if (created.id) {
        handleSelect(created.id);
      }
    };
    world.on(EventType.CHARACTER_CREATED, onCreated);
    return () => world.off(EventType.CHARACTER_CREATED, onCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const handleSelect = (id: string) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("selectedCharacterId", id);
    }
    network.requestCharacterSelect(id);
    network.requestEnterWorld();
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      setError("Name cannot be empty.");
      return;
    }
    if (name.length < 2 || name.length > 20) {
      setError("Name must be 2–20 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    network.requestCharacterCreate(name);
    // Server responds with character:created → auto-selects via the effect above
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{ background: "rgba(0,0,0,0.85)", zIndex: 1000 }}
    >
      <div
        style={{
          background: COLORS.BG_SOLID,
          border: `1px solid ${COLORS.BORDER_SECONDARY}`,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.panel,
          padding: spacing["2xl"],
          minWidth: "320px",
          maxWidth: "480px",
          width: "90%",
        }}
      >
        <h2
          style={{
            color: COLORS.TEXT_PRIMARY,
            fontFamily: typography.fontFamily.heading,
            fontSize: typography.fontSize["2xl"],
            fontWeight: typography.fontWeight.bold,
            marginBottom: spacing.lg,
            textAlign: "center",
          }}
        >
          {showCreate ? "Create Character" : "Select Character"}
        </h2>

        {!showCreate && (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
                marginBottom: spacing.lg,
              }}
            >
              {characters.length === 0 && (
                <p
                  style={{
                    color: COLORS.TEXT_SECONDARY,
                    textAlign: "center",
                    fontSize: typography.fontSize.sm,
                    marginBottom: spacing.sm,
                  }}
                >
                  No characters yet. Create one to begin!
                </p>
              )}
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleSelect(char.id)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${COLORS.BORDER_SECONDARY}`,
                    borderRadius: borderRadius.md,
                    padding: `${spacing.md} ${spacing.lg}`,
                    color: COLORS.TEXT_PRIMARY,
                    fontFamily: typography.fontFamily.body,
                    fontSize: typography.fontSize.base,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.05)";
                  }}
                >
                  <span style={{ fontWeight: typography.fontWeight.medium }}>
                    {char.name}
                  </span>
                  {char.level !== undefined && (
                    <span
                      style={{
                        color: COLORS.TEXT_SECONDARY,
                        fontSize: typography.fontSize.sm,
                      }}
                    >
                      Lv {char.level}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: "100%",
                background: "rgba(99,102,241,0.2)",
                border: `1px solid rgba(99,102,241,0.5)`,
                borderRadius: borderRadius.md,
                padding: `${spacing.sm} ${spacing.lg}`,
                color: COLORS.TEXT_PRIMARY,
                fontFamily: typography.fontFamily.body,
                fontSize: typography.fontSize.base,
                cursor: "pointer",
                fontWeight: typography.fontWeight.medium,
              }}
            >
              + New Character
            </button>
          </>
        )}

        {showCreate && (
          <>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="Enter character name"
              maxLength={20}
              disabled={submitting}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                border: `1px solid ${error ? "rgba(239,68,68,0.7)" : COLORS.BORDER_SECONDARY}`,
                borderRadius: borderRadius.md,
                padding: `${spacing.md} ${spacing.lg}`,
                color: COLORS.TEXT_PRIMARY,
                fontFamily: typography.fontFamily.body,
                fontSize: typography.fontSize.base,
                outline: "none",
                marginBottom: spacing.sm,
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p
                style={{
                  color: "rgba(239,68,68,0.9)",
                  fontSize: typography.fontSize.sm,
                  marginBottom: spacing.sm,
                }}
              >
                {error}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setError("");
                }}
                disabled={submitting}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${COLORS.BORDER_SECONDARY}`,
                  borderRadius: borderRadius.md,
                  padding: spacing.sm,
                  color: COLORS.TEXT_SECONDARY,
                  fontFamily: typography.fontFamily.body,
                  fontSize: typography.fontSize.base,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !newName.trim()}
                style={{
                  flex: 2,
                  background: submitting
                    ? "rgba(99,102,241,0.1)"
                    : "rgba(99,102,241,0.35)",
                  border: `1px solid rgba(99,102,241,0.5)`,
                  borderRadius: borderRadius.md,
                  padding: spacing.sm,
                  color: COLORS.TEXT_PRIMARY,
                  fontFamily: typography.fontFamily.body,
                  fontSize: typography.fontSize.base,
                  cursor: submitting ? "default" : "pointer",
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TouchBtns({ world }: { world: ClientWorld }) {
  const theme = useThemeStore((s) => s.theme);
  const [isAction, setIsAction] = useState(() => {
    const prefs = world.prefs as { touchAction?: boolean };
    return prefs?.touchAction;
  });
  useEffect(() => {
    function onChange(isAction: boolean) {
      setIsAction(isAction);
    }
    world.prefs?.on("touchAction", onChange);
    return () => {
      world.prefs?.off("touchAction", onChange);
    };
  }, []);
  return (
    <div
      className="absolute flex flex-col items-center gap-2"
      style={{
        bottom: "calc(1rem + env(safe-area-inset-bottom))",
        right: "calc(1rem + env(safe-area-inset-right))",
      }}
    >
      {isAction && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Action"
          className="pointer-events-auto w-14 h-14 flex items-center justify-center backdrop-blur-[5px] rounded-2xl cursor-pointer active:scale-95"
          style={{
            backgroundColor: theme.colors.state.danger,
            border: `1px solid ${theme.colors.state.danger}`,
            boxShadow: "0 0.125rem 0.25rem rgba(0,0,0,0.2)",
          }}
          onClick={() => {
            (
              world.controls as { action?: { onPress: () => void } }
            )?.action?.onPress();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (
                world.controls as { action?: { onPress: () => void } }
              )?.action?.onPress();
            }
          }}
        >
          <HandIcon size={24} />
        </div>
      )}
    </div>
  );
}
