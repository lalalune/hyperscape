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
import type { ClientWorld } from "../types";
import { PlayerDataProvider, usePlayerStatsContext } from "../hooks";
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
  return (
    <PlayerDataProvider world={world}>
      <CoreUIContent world={world} />
    </PlayerDataProvider>
  );
}

function CoreUIContent({ world }: { world: ClientWorld }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingOverlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const terrainPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const [loadingComplete, setLoadingComplete] = useState(false);
  // Track system and asset progress separately to gate presentation on assets
  const [systemsComplete, setSystemsComplete] = useState(false);
  const [assetsProgress, setAssetsProgress] = useState(0);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [terrainTimedOut, setTerrainTimedOut] = useState(false);

  // Check if this is spectator mode (from embedded config)
  const isSpectatorMode = (() => {
    const config = window.__HYPERSCAPE_CONFIG__;
    return config?.mode === "spectator" || config?.mode === "stream";
  })();

  // Presentation gating flags
  const [playerReady, setPlayerReady] = useState(() =>
    isSpectatorMode
      ? false
      : Boolean(
          (world.entities.player as { avatar?: unknown } | undefined)?.avatar,
        ),
  );
  const [physReady, setPhysReady] = useState(() =>
    Boolean(
      (
        world.physics as { isInitialized?: () => boolean } | undefined
      )?.isInitialized?.(),
    ),
  );
  const [terrainReady, setTerrainReady] = useState(false);
  const [player, setPlayer] = useState(() => world.entities.player);
  const [targetAvatarLoaded, setTargetAvatarLoaded] = useState(false);
  const [uiVisible, setUIVisible] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [kicked, setKicked] = useState<string | null>(null);
  const [characterFlowActive, setCharacterFlowActive] = useState(false);
  const [deathScreen, setDeathScreen] = useState<{
    message: string;
    killedBy: string;
    respawnTime: number;
  } | null>(null);

  const playerStats = usePlayerStatsContext();
  const livePlayerReady =
    playerReady ||
    (!isSpectatorMode &&
      Boolean(
        (world.entities.player as { avatar?: unknown } | undefined)?.avatar,
      ));
  const livePhysReady =
    physReady ||
    Boolean(
      (
        world.physics as { isInitialized?: () => boolean } | undefined
      )?.isInitialized?.(),
    );
  const liveTerrainReady =
    terrainReady ||
    terrainTimedOut ||
    Boolean(
      (
        world.getSystem?.("terrain") as { isReady?: () => boolean } | undefined
      )?.isReady?.(),
    );

  useEffect(() => {
    // Get the target entity ID for spectators
    const getSpectatorTargetId = () => {
      const config = window.__HYPERSCAPE_CONFIG__;
      return config?.followEntity || config?.characterId;
    };

    // Create handlers with proper types
    const handleReady = () => {
      // A READY signal indicates a major subsystem finished; mark loading as potentially complete
      setReadinessError(null);
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
          if ((playerEntity as { avatar?: unknown }).avatar) {
            setPlayerReady(true);
          }
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
        const localPlayer = world.entities?.player as
          | { id?: string; avatar?: unknown }
          | undefined;
        if (
          data.success &&
          localPlayer?.id &&
          data.playerId === localPlayer.id
        ) {
          setPlayer(localPlayer as typeof world.entities.player);
          setPlayerReady(true);
        }
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
    const handleCharacterList = (): void => setCharacterFlowActive(true);
    const handleCharacterSelected = (): void => setCharacterFlowActive(false);
    world.on("character:list", handleCharacterList);
    world.on("character:selected", handleCharacterSelected);
    // If the packet arrived before UI mounted, consult network cache
    const network = world.network as { lastCharacterList?: unknown[] };
    if (network.lastCharacterList) setCharacterFlowActive(true);

    if (
      (
        world.physics as { isInitialized?: () => boolean } | undefined
      )?.isInitialized?.()
    ) {
      setPhysReady(true);
    }

    const playerEntity = world.entities?.player;
    if (playerEntity) {
      setPlayer(playerEntity);
      if (!isSpectatorMode && (playerEntity as { avatar?: unknown }).avatar) {
        setPlayerReady(true);
      }
    }

    return () => {
      if (terrainPollTimeoutRef.current) {
        clearTimeout(terrainPollTimeoutRef.current);
        terrainPollTimeoutRef.current = null;
      }
      // Clean up the ready timeout if it exists
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
      if (loadingOverlayTimeoutRef.current) {
        clearTimeout(loadingOverlayTimeoutRef.current);
        loadingOverlayTimeoutRef.current = null;
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
    if (terrainPollTimeoutRef.current) {
      clearTimeout(terrainPollTimeoutRef.current);
      terrainPollTimeoutRef.current = null;
    }

    setTerrainReady(false);
    setTerrainTimedOut(false);
    setReadinessError(null);

    const isTerrainReady = (): boolean => {
      const terrain = world.getSystem?.("terrain") as
        | { isReady?: () => boolean }
        | undefined;
      if (!terrain?.isReady) return false;

      if (isSpectatorMode) {
        return terrain.isReady();
      }

      const player = world.entities?.player as
        | { position?: { x: number; z: number } }
        | undefined;
      if (!player?.position) return false;

      return terrain.isReady();
    };

    const updateTerrainReady = () => {
      if (!isTerrainReady()) return false;
      setTerrainReady(true);
      return true;
    };

    if (!updateTerrainReady()) {
      const startTime = performance.now();
      const checkTerrainReady = () => {
        if (updateTerrainReady()) return;

        if (performance.now() - startTime >= 20000) {
          if (isSpectatorMode) {
            setReadinessError(
              "Timed out waiting for terrain to initialize. Refresh to retry.",
            );
            return;
          }

          console.warn(
            "[CoreUI] Terrain readiness timeout after 20s; continuing startup for player mode",
          );
          setTerrainTimedOut(true);
          setTerrainReady(true);
          return;
        }

        terrainPollTimeoutRef.current = setTimeout(checkTerrainReady, 250);
      };

      terrainPollTimeoutRef.current = setTimeout(checkTerrainReady, 250);
    }

    return () => {
      if (terrainPollTimeoutRef.current) {
        clearTimeout(terrainPollTimeoutRef.current);
        terrainPollTimeoutRef.current = null;
      }
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
    const canPresent =
      livePlayerReady &&
      livePhysReady &&
      liveTerrainReady &&
      (loadingComplete || systemsComplete || assetsProgress >= 100);
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
  }, [
    livePlayerReady,
    livePhysReady,
    liveTerrainReady,
    loadingComplete,
    systemsComplete,
    assetsProgress,
  ]);

  useEffect(() => {
    if (!ready) {
      setLoadingOverlayVisible(true);
      if (loadingOverlayTimeoutRef.current) {
        clearTimeout(loadingOverlayTimeoutRef.current);
        loadingOverlayTimeoutRef.current = null;
      }
      return;
    }

    loadingOverlayTimeoutRef.current = setTimeout(() => {
      setLoadingOverlayVisible(false);
      loadingOverlayTimeoutRef.current = null;
    }, 220);

    return () => {
      if (loadingOverlayTimeoutRef.current) {
        clearTimeout(loadingOverlayTimeoutRef.current);
        loadingOverlayTimeoutRef.current = null;
      }
    };
  }, [ready]);

  // Expose loading state for debugging and analytics
  useEffect(() => {
    const loadingState = {
      ready,
      loadingComplete,
      systemsComplete,
      assetsProgress,
      playerReady: livePlayerReady,
      physReady: livePhysReady,
      terrainReady: liveTerrainReady,
      terrainTimedOut,
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
    livePlayerReady,
    livePhysReady,
    liveTerrainReady,
    terrainTimedOut,
    player,
  ]);

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
        {loadingOverlayVisible &&
          (readinessError ? (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
              <div className="text-center text-[#f2d08a] px-8">
                <p className="text-2xl mb-3">Unable to enter world</p>
                <p className="max-w-md mb-4">{readinessError}</p>
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-[#f2d08a] text-black font-bold"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </button>
              </div>
            </div>
          ) : (
            <LoadingScreen
              world={world}
              message={
                characterFlowActive ? "Entering world..." : "Loading world..."
              }
              fadingOut={ready}
            />
          ))}
        {kicked && <KickedOverlay code={kicked} />}
        {deathScreen && <DeathScreen data={deathScreen} world={world} />}
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
