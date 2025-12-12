import { RefreshCwIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { ControlAction, EventMap } from "@hyperscape/shared";
import {
  buttons,
  cls,
  EventType,
  isTouch,
  propToLabel,
} from "@hyperscape/shared";
import type { ClientWorld } from "../types";
import { ActionProgressBar } from "./hud/ActionProgressBar";
import { Chat } from "./chat/Chat";
import { ChatProvider } from "./chat/ChatContext";
import { EntityContextMenu } from "./hud/EntityContextMenu";
import { HandIcon } from "../components/Icons";
import { LoadingScreen } from "../screens/LoadingScreen";
import { MouseLeftIcon } from "../components/MouseLeftIcon";
import { MouseRightIcon } from "../components/MouseRightIcon";
import { MouseWheelIcon } from "../components/MouseWheelIcon";
import { PerformancePanel } from "../components/debug/PerformancePanel";
import { Sidebar } from "./Sidebar";
import { StatusBars } from "./hud/StatusBars";

// Type for icon components
type IconComponent = React.ComponentType<{ size?: number | string }>;

export function CoreUI({ world }: { world: ClientWorld }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [ready, setReady] = useState(false);
  const [_loadingComplete, setLoadingComplete] = useState(false);
  // Track system and asset progress separately to gate presentation on assets
  const [_systemsComplete, setSystemsComplete] = useState(false);
  const [_assetsProgress, setAssetsProgress] = useState(0);

  // Check if this is spectator mode (from embedded config)
  const isSpectatorMode = (() => {
    const config = (window as { __HYPERSCAPE_CONFIG__?: { mode?: string } })
      .__HYPERSCAPE_CONFIG__;
    return config?.mode === "spectator";
  })();

  // Presentation gating flags
  const [playerReady, setPlayerReady] = useState(() => !!world.entities.player);
  const [_physReady, setPhysReady] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [_player, setPlayer] = useState(() => world.entities.player);
  const [targetAvatarLoaded, setTargetAvatarLoaded] = useState(false);
  const [ui, setUI] = useState(world.ui?.state);
  const [_menu, setMenu] = useState(null);
  const [_settings, _setSettings] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [kicked, setKicked] = useState<string | null>(null);
  const [characterFlowActive, setCharacterFlowActive] = useState(false);
  const [deathScreen, setDeathScreen] = useState<{
    message: string;
    killedBy: string;
    respawnTime: number;
  } | null>(null);
  useEffect(() => {
    // Get the target entity ID for spectators
    const getSpectatorTargetId = () => {
      const config = (
        window as {
          __HYPERSCAPE_CONFIG__?: {
            followEntity?: string;
            characterId?: string;
          };
        }
      ).__HYPERSCAPE_CONFIG__;
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
        const player = world.entities?.player;
        if (player) {
          setPlayer(player);
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
      setUI((prev) => (prev ? { ...prev, visible: data.visible } : undefined));
    };
    const handleUIMenu = () => setMenu(null);
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
    world.on(EventType.UI_MENU, handleUIMenu);
    world.on(EventType.UI_KICK, handleUIKick);
    world.on(EventType.NETWORK_DISCONNECTED, handleDisconnected);
    world.on(EventType.UI_DEATH_SCREEN, handleDeathScreen);
    world.on(EventType.UI_DEATH_SCREEN_CLOSE, handleDeathScreenClose);
    // Character selection flow (server-flagged)
    world.on("character:list", () => setCharacterFlowActive(true));
    world.on("character:selected", () => setCharacterFlowActive(false));
    // If the packet arrived before UI mounted, consult network cache
    const network = world.network as { lastCharacterList?: unknown[] };
    if (network.lastCharacterList) setCharacterFlowActive(true);

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
      world.off(EventType.UI_MENU, handleUIMenu);
      world.off(EventType.UI_KICK, handleUIKick);
      world.off(EventType.NETWORK_DISCONNECTED, handleDisconnected);
      world.off(EventType.UI_DEATH_SCREEN, handleDeathScreen);
      world.off(EventType.UI_DEATH_SCREEN_CLOSE, handleDeathScreenClose);
      world.off("character:list", () => setCharacterFlowActive(true));
      world.off("character:selected", () => setCharacterFlowActive(false));
    };
  }, []);

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
    // Keep it simple: show game once the player's avatar is ready
    const canPresent = playerReady;
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
  }, [playerReady]);

  // Event capture removed - was blocking UI interactions
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * (world.prefs?.ui || 1)}px`;
    function onChange(changes: { ui?: number }) {
      if (changes.ui) {
        document.documentElement.style.fontSize = `${16 * (world.prefs?.ui || 1)}px`;
      }
    }
    world.prefs?.on("change", onChange);
    return () => {
      world.prefs?.off("change", onChange);
    };
  }, []);

  return (
    <ChatProvider>
      <div
        ref={ref}
        className="coreui absolute inset-0 overflow-hidden pointer-events-none"
      >
        {/* Performance monitor - dev only */}
        <PerformancePanel monitor={world.performanceMonitor} />
        {disconnected && <Disconnected />}
        {<Toast world={world} />}
        {ready && <ActionsBlock world={world} />}
        {ready && <StatusBars world={world} />}
        {ready && (
          <Sidebar world={world} ui={ui || { active: false, pane: null }} />
        )}
        {ready && <Chat world={world} />}
        {ready && <ActionProgressBar world={world} />}
        {!ready && (
          <LoadingScreen
            world={world}
            message={
              characterFlowActive ? "Entering world..." : "Loading world..."
            }
          />
        )}
        {kicked && <KickedOverlay code={kicked} />}
        {deathScreen && <DeathScreen data={deathScreen} world={world} />}
        {ready && isTouch && <TouchBtns world={world} />}
        {ready && <EntityContextMenu world={world} />}
        <div id="core-ui-portal" />
      </div>
    </ChatProvider>
  );
}

function Disconnected() {
  return (
    <>
      <div className="fixed top-0 left-0 w-full h-full backdrop-grayscale pointer-events-none z-[9999] opacity-0 animate-[fadeIn_3s_ease-in-out_forwards]" />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        className="disconnected-btn pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-bg border border-dark-border backdrop-blur-md rounded-2xl h-11 px-4 flex items-center cursor-pointer"
        onClick={() => window.location.reload()}
      >
        <RefreshCwIcon size={18} />
        <span className="ml-2">Reconnect</span>
      </div>
    </>
  );
}

const kickMessages: Record<string, string> = {
  duplicate_user: "Player already active on another device or window.",
  player_limit: "Player limit reached.",
  unknown: "You were kicked.",
};
function KickedOverlay({ code }: { code: string }) {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-auto">
      <div className="text-white text-lg">
        {kickMessages[code] || kickMessages.unknown}
      </div>
    </div>
  );
}

function DeathScreen({
  data,
  world,
}: {
  data: { message: string; killedBy: string; respawnTime: number };
  world: ClientWorld;
}) {
  const handleRespawn = () => {
    // Send respawn request to server via network
    const network = world.network as {
      send?: (packet: string, data: unknown) => void;
    };

    if (!network) {
      console.error("[DeathScreen] Network object is null/undefined!");
      return;
    }

    if (!network.send) {
      console.error("[DeathScreen] Network.send method doesn't exist!");
      return;
    }

    try {
      network.send("requestRespawn", {
        playerId: world.entities?.player?.id,
      });
    } catch (err) {
      console.error("[DeathScreen] Error sending packet:", err);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto z-[10000]">
      <div className="flex flex-col items-center gap-6 max-w-md p-8 bg-dark-bg border-2 border-red-600 rounded-2xl backdrop-blur-md">
        <div className="text-4xl font-bold text-red-500">
          Oh dear, you are dead!
        </div>
        <div className="text-white text-center space-y-2">
          <p className="text-lg">
            Killed by: <span className="text-red-400">{data.killedBy}</span>
          </p>
          <p className="text-base opacity-90">
            You have lost your items at the death location.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 mt-4">
          <button
            onClick={handleRespawn}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-lg transition-colors cursor-pointer border-2 border-blue-400"
          >
            Click here to respawn
          </button>
          <div className="text-sm text-gray-400 text-center max-w-sm">
            Your items have been dropped at your death location. You have 5
            minutes to retrieve them before they despawn!
          </div>
        </div>
      </div>
    </div>
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
    return <ActionPill label={propToLabel[action.type]} />;
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
      className={cls(
        "fixed px-3 py-2 bg-[rgba(11,10,21,0.92)] border border-[#3a3b49] backdrop-blur-[8px] rounded-lg text-white text-sm font-medium shadow-lg pointer-events-none z-[99999] max-w-[250px]",
        {
          "opacity-100 scale-100 animate-[examineTooltipIn_0.15s_ease-out]":
            visible,
          "opacity-0 scale-95 transition-all duration-300 ease-in-out":
            !visible,
        },
      )}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
    >
      {text}
    </div>
  );
}

function ToastMsg({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setTimeout(() => setVisible(false), 3000); // Show for 3 seconds
  }, []);
  return (
    <div
      className={cls(
        "h-[2.875rem] flex items-center justify-center px-4 bg-[rgba(11,10,21,0.85)] border border-[#2a2b39] backdrop-blur-[5px] rounded-[1.4375rem] transition-all duration-100 ease-in-out text-white text-[0.9375rem] font-medium",
        {
          "opacity-100 translate-y-0 scale-100 animate-[toastIn_0.1s_ease-in-out]":
            visible,
          "opacity-0 translate-y-2.5 scale-90": !visible,
        },
      )}
    >
      {text}
    </div>
  );
}

function TouchBtns({ world }: { world: ClientWorld }) {
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
          className="pointer-events-auto w-14 h-14 flex items-center justify-center bg-[#ff4d4d] border border-[#ff6666] backdrop-blur-[5px] rounded-2xl shadow-[0_0.125rem_0.25rem_rgba(0,0,0,0.2)] cursor-pointer active:scale-95"
          onClick={() => {
            (
              world.controls as { action?: { onPress: () => void } }
            )?.action?.onPress();
          }}
        >
          <HandIcon size={24} />
        </div>
      )}
    </div>
  );
}
