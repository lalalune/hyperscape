/**
 * Action Progress Bar Component
 * Shows gathering/action progress to the player
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useThemeStore } from "@/ui";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import { HUD_FRAME, HUD_LAYERS } from "./layout";

interface ActionProgress {
  action: string;
  resourceName: string;
  progress: number; // 0-1
  duration: number;
  startTime: number;
}

export function ActionProgressBar({ world }: { world: ClientWorld }) {
  const theme = useThemeStore((s) => s.theme);
  const [currentAction, setCurrentAction] = useState<ActionProgress | null>(
    null,
  );
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleGatheringStart = (data: unknown) => {
      const d = data as {
        playerId: string;
        resourceId: string;
        action?: string;
        duration?: number;
        cycleTicks?: number; // OSRS-style tick count
        tickDurationMs?: number; // 600ms per tick
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

      // Calculate duration from tick-based timing if available
      // OSRS standard: 4 ticks per attempt = 2.4 seconds
      const tickDuration = d.tickDurationMs || 600;
      const cycleTicks = d.cycleTicks || 4; // Default to OSRS standard 4 ticks
      const duration = d.duration || cycleTicks * tickDuration;

      setCurrentAction({
        action,
        resourceName,
        progress: 0,
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
      world.off(
        EventType.RESOURCE_GATHERING_COMPLETED,
        handleGatheringComplete,
      );
      world.off(EventType.RESOURCE_GATHERING_STOPPED, handleGatheringStopped);
    };
  }, [world]);

  // Update progress based on elapsed time
  // Store a ref to avoid creating new action objects every interval
  // Only progress changes during the update cycle, so we compute it from startTime/duration
  useEffect(() => {
    if (!currentAction) return;

    // Cache the values we need for progress calculation to avoid re-reads
    const { startTime, duration } = currentAction;
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use functional update but only update if progress changed meaningfully
      // This avoids unnecessary re-renders while still updating the UI
      setCurrentAction((prev) => {
        if (!prev) return null;
        // Only create new object if progress is different (threshold for float comparison)
        if (Math.abs(prev.progress - progress) < 0.001) return prev;
        // Reuse all properties except progress to minimize object creation
        return {
          action: prev.action,
          resourceName: prev.resourceName,
          duration: prev.duration,
          startTime: prev.startTime,
          progress,
        };
      });

      if (progress < 1) {
        animationFrameRef.current =
          window.requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentAction?.startTime]);

  // Memoize styles to avoid recalculating on every render
  const styles = useMemo(
    () => ({
      container: {
        width: 320,
        maxWidth: "90vw",
        position: "fixed" as const,
        left: "50%",
        transform: "translateX(-50%)",
        bottom: HUD_FRAME.progressBottomOffset,
        pointerEvents: "none" as const,
        zIndex: HUD_LAYERS.cluster,
      },
      label: {
        textAlign: "center" as const,
        color: theme.colors.text.primary,
        fontSize: theme.typography.fontSize.sm,
        fontFamily: theme.typography.fontFamily.body,
        fontWeight: theme.typography.fontWeight.semibold,
        marginBottom: theme.spacing.sm,
        textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
      },
      barContainer: {
        height: theme.spacing.xl,
        background: theme.colors.background.secondary,
        border: `2px solid ${theme.colors.border.default}`,
        borderRadius: theme.borderRadius.xl,
        overflow: "hidden" as const,
        position: "relative" as const,
        boxShadow: theme.shadows.lg,
      },
      barFill: {
        height: "100%",
        background: theme.colors.status.energy,
        borderRadius: theme.borderRadius.xl - 4,
        transition: "width 50ms linear",
        position: "relative" as const,
        overflow: "hidden" as const,
        boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
      },
      shine: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        height: "50%",
        background:
          "linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent)",
        borderRadius: `${theme.borderRadius.xl}px ${theme.borderRadius.xl}px 0 0`,
      },
      percentage: {
        position: "absolute" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        color: theme.colors.text.primary,
        fontSize: theme.typography.fontSize.xs,
        fontFamily: theme.typography.fontFamily.body,
        fontWeight: theme.typography.fontWeight.bold,
        pointerEvents: "none" as const,
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
      },
    }),
    [theme],
  );

  if (!currentAction) return null;

  const percentage = Math.floor(currentAction.progress * 100);

  return (
    <div style={styles.container}>
      {/* Action label */}
      <div style={styles.label} className="animate-progress-pulse">
        <span
          style={{ display: "inline-block", marginRight: theme.spacing.xs }}
          aria-hidden="true"
        >
          🪓
        </span>
        {currentAction.action} {currentAction.resourceName}...
      </div>

      {/* Progress bar container */}
      <div style={styles.barContainer}>
        {/* Progress fill */}
        <div
          style={{
            ...styles.barFill,
            width: `${percentage}%`,
          }}
        >
          {/* Shine highlight */}
          <div style={styles.shine} />
        </div>

        {/* Percentage label */}
        <div style={styles.percentage}>{percentage}%</div>
      </div>
    </div>
  );
}
