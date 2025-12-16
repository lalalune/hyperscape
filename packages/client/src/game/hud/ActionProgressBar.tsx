import React, { useEffect, useState, useRef, useMemo } from "react";
import { EventType } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";

interface ActionProgress {
  action: string;
  resourceName: string;
  duration: number;
  startTime: number;
}

const containerStyle: React.CSSProperties = {
  bottom: "calc(15% + env(safe-area-inset-bottom))",
};

const labelShadowStyle: React.CSSProperties = {
  textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
};

const percentTextShadowStyle: React.CSSProperties = {
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
};

const barFillBaseStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
  boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.3)",
};

const barHighlightStyle: React.CSSProperties = {
  background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent)",
};

export function ActionProgressBar({ world }: { world: ClientWorld }) {
  const [currentAction, setCurrentAction] = useState<ActionProgress | null>(null);
  const animationKeyRef = useRef(0);
  const percentDisplayRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleGatheringStart = (data: unknown) => {
      const d = data as {
        playerId: string;
        resourceId: string;
        action?: string;
        duration?: number;
        cycleTicks?: number;
        tickDurationMs?: number;
      };
      const localPlayer = world.entities?.player;
      if (!localPlayer || localPlayer.id !== d.playerId) return;

      const action = d.action || "Gathering";
      const resourceId = d.resourceId || "";
      const resourceName = resourceId.includes("tree")
        ? "Tree"
        : resourceId.includes("fish")
          ? "Fishing Spot"
          : resourceId.includes("rock")
            ? "Rock"
            : "Resource";

      const tickDuration = d.tickDurationMs || 600;
      const cycleTicks = d.cycleTicks || 4;
      const duration = d.duration || cycleTicks * tickDuration;

      animationKeyRef.current += 1;

      setCurrentAction({
        action,
        resourceName,
        duration,
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
      world.off(EventType.RESOURCE_GATHERING_COMPLETED, handleGatheringComplete);
      world.off(EventType.RESOURCE_GATHERING_STOPPED, handleGatheringStopped);
    };
  }, [world]);

  useEffect(() => {
    if (!currentAction) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePercent = () => {
      if (!currentAction || !percentDisplayRef.current) return;

      const elapsed = Date.now() - currentAction.startTime;
      const progress = Math.min(elapsed / currentAction.duration, 1);
      const percentage = Math.floor(progress * 100);

      percentDisplayRef.current.textContent = `${percentage}%`;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updatePercent);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePercent);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentAction?.startTime, currentAction?.duration]);

  const animationCSS = useMemo(() => {
    if (!currentAction) return null;

    const animName = `progress-fill-${animationKeyRef.current}`;
    const durationMs = currentAction.duration;

    return {
      animName,
      keyframes: `
        @keyframes ${animName} {
          from { width: 0%; }
          to { width: 100%; }
        }
      `,
      style: {
        ...barFillBaseStyle,
        animation: `${animName} ${durationMs}ms linear forwards`,
      } as React.CSSProperties,
    };
  }, [currentAction?.startTime, currentAction?.duration]);

  if (!currentAction || !animationCSS) return null;

  return (
    <div
      className="w-[320px] max-w-[90vw] fixed left-1/2 -translate-x-1/2 pointer-events-none z-[999]"
      style={containerStyle}
    >
      <style>{animationCSS.keyframes}</style>

      <div
        className="text-center text-white text-sm font-semibold mb-2 animate-pulse"
        style={labelShadowStyle}
      >
        <span className="inline-block mr-1">🪓</span>
        {currentAction.action} {currentAction.resourceName}...
      </div>

      <div className="h-6 bg-black/60 border-2 border-white/30 rounded-xl overflow-hidden relative">
        <div
          key={animationKeyRef.current}
          className="h-full rounded-[10px] relative overflow-hidden"
          style={animationCSS.style}
        >
          <div className="absolute top-0 left-0 right-0 h-1/2" style={barHighlightStyle} />
        </div>

        <div
          ref={percentDisplayRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs font-bold pointer-events-none"
          style={percentTextShadowStyle}
        >
          0%
        </div>
      </div>
    </div>
  );
}
