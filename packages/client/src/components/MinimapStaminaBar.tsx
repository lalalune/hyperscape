import React, { useEffect, useState } from "react";
import { EventType } from "@hyperscape/shared";
import type { ClientWorld } from "../types";

interface MinimapStaminaBarProps {
  world: ClientWorld;
  width: number;
}

export function MinimapStaminaBar({ world, width }: MinimapStaminaBarProps) {
  const [runMode, setRunMode] = useState(true);
  const [stamina, setStamina] = useState(100);

  useEffect(() => {
    const player = world.entities?.player;
    if (player) {
      setRunMode(player.runMode ?? true);
      setStamina(player.stamina ?? 100);
    }

    const handleUpdate = (data: unknown) => {
      const update = data as { runMode?: boolean; stamina?: number };
      if (typeof update.runMode === "boolean") setRunMode(update.runMode);
      if (typeof update.stamina === "number") setStamina(update.stamina);
    };

    world.on(EventType.PLAYER_STAMINA_UPDATE, handleUpdate);
    world.on(EventType.PLAYER_UPDATED, handleUpdate);

    // Poll for stamina since PLAYER_STAMINA_UPDATE is not emitted by server
    const pollInterval = setInterval(() => {
      const p = world.entities?.player;
      if (p) {
        setStamina((prev) => (p.stamina !== prev ? (p.stamina ?? 100) : prev));
        setRunMode((prev) => (p.runMode !== prev ? (p.runMode ?? true) : prev));
      }
    }, 100);

    return () => {
      world.off(EventType.PLAYER_STAMINA_UPDATE, handleUpdate);
      world.off(EventType.PLAYER_UPDATED, handleUpdate);
      clearInterval(pollInterval);
    };
  }, [world]);

  const toggleRunMode = () => {
    const player = world.entities?.player;
    const newRunMode = !runMode;
    if (player) player.runMode = newRunMode;
    setRunMode(newRunMode);
    world.network?.send?.("moveRequest", { runMode: newRunMode });
  };

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRunMode();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="h-6 rounded-md border-2 border-white/30 bg-black/80 cursor-pointer relative overflow-hidden flex items-center justify-center"
      style={{ width }}
      title={runMode ? "Running (click to walk)" : "Walking (click to run)"}
    >
      <div
        className="absolute left-0 top-0 bottom-0 transition-[width] duration-300 ease-out pointer-events-none"
        style={{
          width: `${Math.max(0, Math.min(100, stamina))}%`,
          background: runMode
            ? "linear-gradient(90deg, #00ff88, #00cc66)"
            : "linear-gradient(90deg, #ffa500, #ff8800)",
        }}
      />
      <div className="relative z-[1] text-white text-[10px] font-semibold pointer-events-none">
        {runMode ? "🏃" : "🚶"} {Math.round(stamina)}%
      </div>
    </div>
  );
}
