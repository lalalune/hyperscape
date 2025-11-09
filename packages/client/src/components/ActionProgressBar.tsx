/**
 * Action Progress Bar Component
 * Shows gathering/action progress to the player
 */

import React, { useEffect, useState } from "react";
import { EventType } from "@hyperscape/shared";
import type { ClientWorld } from "../types";

interface ActionProgress {
  action: string;
  resourceName: string;
  progress: number; // 0-1
  duration: number;
  startTime: number;
}

export function ActionProgressBar({ world }: { world: ClientWorld }) {
  const [currentAction, setCurrentAction] = useState<ActionProgress | null>(
    null,
  );

  useEffect(() => {
    const handleGatheringStart = (data: unknown) => {
      const d = data as {
        playerId: string;
        resourceId: string;
        action?: string;
        duration?: number;
      };
      const localPlayer = world.entities?.player;
      if (!localPlayer || localPlayer.id !== d.playerId) return;

      // Determine action name and resource name
      const action = d.action || "Gathering";
      const resourceId = d.resourceId || "";
      const resourceName = resourceId.includes("tree")
        ? "Tree"
        : resourceId.includes("fish")
          ? "Fishing Spot"
          : resourceId.includes("rock")
            ? "Rock"
            : "Resource";

      setCurrentAction({
        action,
        resourceName,
        progress: 0,
        duration: d.duration || 5000,
        startTime: Date.now(),
      });
    };

    const handleGatheringComplete = (data: unknown) => {
      const d = data as { playerId: string };
      const localPlayer = world.entities?.player;
      if (!localPlayer || localPlayer.id !== d.playerId) return;

      setCurrentAction(null);
    };

    const handleGatheringStopped = (data: unknown) => {
      const d = data as { playerId: string };
      const localPlayer = world.entities?.player;
      if (!localPlayer || localPlayer.id !== d.playerId) return;

      setCurrentAction(null);
    };

    world.on(EventType.RESOURCE_GATHERING_STARTED, handleGatheringStart);
    world.on(EventType.RESOURCE_GATHERING_COMPLETED, handleGatheringComplete);
    world.on(EventType.RESOURCE_GATHERING_STOPPED, handleGatheringStopped);

    return () => {
      world.off(EventType.RESOURCE_GATHERING_STARTED, handleGatheringStart);
      world.off(
        EventType.RESOURCE_GATHERING_COMPLETED,
        handleGatheringComplete,
      );
      world.off(EventType.RESOURCE_GATHERING_STOPPED, handleGatheringStopped);
    };
  }, [world]);

  // Update progress based on elapsed time
  useEffect(() => {
    if (!currentAction) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - currentAction.startTime;
      const progress = Math.min(elapsed / currentAction.duration, 1);

      setCurrentAction((prev) => (prev ? { ...prev, progress } : null));

      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [currentAction?.startTime]);

  if (!currentAction) return null;

  const percentage = Math.floor(currentAction.progress * 100);

  return (
    <div
      className="w-[320px] max-w-[90vw] fixed left-1/2 -translate-x-1/2 pointer-events-none z-[999]"
      style={{
        bottom: "calc(15% + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="text-center text-white text-sm font-semibold mb-2 animate-pulse"
        style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
      >
        <span className="inline-block mr-1">🪓</span>
        {currentAction.action} {currentAction.resourceName}...
      </div>

      <div className="h-6 bg-black/60 border-2 border-white/30 rounded-xl overflow-hidden relative">
        <div
          className="h-full rounded-[10px] transition-[width] duration-[50ms] linear relative overflow-hidden"
          style={{
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
            boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.3)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1/2"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent)",
            }}
          />
        </div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs font-bold pointer-events-none"
          style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)" }}
        >
          {percentage}%
        </div>
      </div>
    </div>
  );
}
