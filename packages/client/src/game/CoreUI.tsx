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
  // Presentation gating flags
  const [playerReady, setPlayerReady] = useState(() => !!world.entities.player);
  const [_physReady, setPhysReady] = useState(false);
  const [_terrainReady, setTerrainReady] = useState(false);
  const [_player, setPlayer] = useState(() => world.entities.player);
  const [ui, setUI] = useState(world.ui?.state);
  const [_menu, setMenu] = useState(null);
  const [_settings, _setSettings] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [kicked, setKicked] = useState<string | null>(null);
  const [characterFlowActive, setCharacterFlowActive] = useState(false);
  useEffect(() => {
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
        if (progressData.progress >= 100) setSystemsComplete(true);
      } else if (typeof progressData.total === "number") {
        setAssetsProgress(progressData.progress);
      }
    };
    const handlePlayerSpawned = () => {
      const player = world.entities?.player;
      if (player) {
        setPlayer(player);
        setPlayerReady(true);
      }
    };
    const handleAvatarComplete = (_data: {
      playerId: string;
      success: boolean;
    }) => {
      // Avatar loaded for a player — consider local player ready for presentation
      setPlayerReady(true);
    };
    const handleUIToggle = (data: { visible: boolean }) => {
      setUI((prev) => (prev ? { ...prev, visible: data.visible } : undefined));
    };
    const handleUIMenu = () => setMenu(null);
    const handleUIKick = (data: { playerId: string; reason: string }) => {
      setKicked(data.reason || "Kicked from server");
    };
    const handleDisconnected = () => setDisconnected(true);

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
      world.off("character:list", () => setCharacterFlowActive(true));
      world.off("character:selected", () => setCharacterFlowActive(false));
    };
  }, []);

  // Poll terrain readiness at the player's tile until ready
  useEffect(() => {
    let terrainInterval: NodeJS.Timeout | null = null;
    function startPolling() {
      if (terrainInterval) return;
      terrainInterval = setInterval(() => {
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
  }, [world]);

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
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    let ids = 0;
    const onToast = (data: EventMap[EventType.UI_TOAST]) => {
      setMsg({ text: data.message, id: ++ids });
    };
    world.on(EventType.UI_TOAST, onToast);
    return () => {
      world.off(EventType.UI_TOAST, onToast);
    };
  }, []);
  if (!msg) return null;
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
