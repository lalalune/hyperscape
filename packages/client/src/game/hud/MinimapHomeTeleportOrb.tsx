/**
 * Minimap Home Teleport Orb - A circular orb button for teleporting home.
 * Displays casting progress and cooldown state.
 * Keyboard shortcut: H
 */

import React, { useEffect, useState, useCallback, useRef, useId } from "react";
import { HOME_TELEPORT_CONSTANTS, EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import {
  getHomeTeleportCooldownProgress,
  readHomeTeleportRemainingMs,
} from "./homeTeleportUi";

type TeleportState = "ready" | "cooldown" | "casting";

interface MinimapHomeTeleportOrbProps {
  world: ClientWorld;
  size?: number;
}

/**
 * Home icon - house silhouette
 */
function HomeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))" }}
    >
      {/* House shape */}
      <path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9V15H15V21H18C18.5523 21 19 20.5523 19 20V10M19 10L21 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const formatTime = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
};

/**
 * Home Teleport Orb - A circular orb that shows teleport state.
 * - Ready: Shows home icon, click to start casting
 * - Casting: Shows progress fill, click to cancel
 * - Cooldown: Shows remaining time, disabled
 */
export function MinimapHomeTeleportOrb({
  world,
  size = 44,
}: MinimapHomeTeleportOrbProps) {
  const [state, setState] = useState<TeleportState>("ready");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [castProgress, setCastProgress] = useState(0);
  const [castStartTime, setCastStartTime] = useState<number | null>(null);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const uniqueId = useId();
  const castStartTimeRef = useRef<number | null>(null);
  const cooldownEndTimeRef = useRef<number | null>(null);
  const cooldownSecondRef = useRef(-1);
  const tickerRef = useRef<number | null>(null);

  // Use ref to track state in event handlers (avoids stale closure)
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    castStartTimeRef.current = castStartTime;
  }, [castStartTime]);

  useEffect(() => {
    cooldownEndTimeRef.current = cooldownEndTime;
  }, [cooldownEndTime]);

  // Server event handlers
  useEffect(() => {
    const onCastStart = () => {
      setState("casting");
      setCastStartTime(performance.now());
      setCooldownEndTime(null);
      setCooldownRemaining(0);
      setCastProgress(0);
    };

    const onFailed = (event?: unknown) => {
      const remainingMs = readHomeTeleportRemainingMs(event);
      if (remainingMs > 0) {
        setState("cooldown");
        setCooldownEndTime(performance.now() + remainingMs);
        setCooldownRemaining(remainingMs);
      } else {
        // Server rejected or cancelled - reset to ready
        setState("ready");
        setCooldownEndTime(null);
        setCooldownRemaining(0);
      }
      setCastStartTime(null);
      setCastProgress(0);
    };

    const onCastCancel = () => {
      // Server confirmed cancel - reset to ready
      setState("ready");
      setCastStartTime(null);
      setCooldownEndTime(null);
      setCooldownRemaining(0);
      setCastProgress(0);
    };

    const onTeleported = () => {
      // Use ref to get current state (avoids stale closure)
      if (stateRef.current === "casting") {
        setState("cooldown");
        setCooldownEndTime(
          performance.now() + HOME_TELEPORT_CONSTANTS.COOLDOWN_MS,
        );
        setCooldownRemaining(HOME_TELEPORT_CONSTANTS.COOLDOWN_MS);
        setCastStartTime(null);
        setCastProgress(0);
      }
    };

    world.on(EventType.HOME_TELEPORT_CAST_START, onCastStart);
    world.on(EventType.HOME_TELEPORT_FAILED, onFailed);
    world.on(EventType.HOME_TELEPORT_CAST_CANCEL, onCastCancel);
    world.on(EventType.PLAYER_TELEPORTED, onTeleported);

    return () => {
      world.off(EventType.HOME_TELEPORT_CAST_START, onCastStart);
      world.off(EventType.HOME_TELEPORT_FAILED, onFailed);
      world.off(EventType.HOME_TELEPORT_CAST_CANCEL, onCastCancel);
      world.off(EventType.PLAYER_TELEPORTED, onTeleported);
    };
  }, [world]);

  // Animation-driven progress/cooldown tickers (replaced setInterval for lower overhead)
  useEffect(() => {
    const clearTicker = () => {
      if (tickerRef.current !== null) {
        cancelAnimationFrame(tickerRef.current);
        tickerRef.current = null;
      }
    };

    if (state === "ready") {
      clearTicker();
      cooldownSecondRef.current = -1;
      setCooldownRemaining(0);
      setCastProgress(0);
      return undefined;
    }

    cooldownSecondRef.current = -1;

    const tick = () => {
      const now = performance.now();

      if (state === "casting" && castStartTimeRef.current !== null) {
        const progress = Math.max(
          0,
          Math.min(
            100,
            ((now - castStartTimeRef.current) /
              HOME_TELEPORT_CONSTANTS.CAST_TIME_MS) *
              100,
          ),
        );
        setCastProgress(progress);
      } else if (state === "cooldown" && cooldownEndTimeRef.current !== null) {
        const remaining = Math.max(0, cooldownEndTimeRef.current - now);
        const remainingSeconds = Math.floor(remaining / 1000);
        if (remainingSeconds !== cooldownSecondRef.current) {
          cooldownSecondRef.current = remainingSeconds;
          setCooldownRemaining(remaining);
        }
        if (remaining <= 0) {
          setCooldownRemaining(0);
          setState("ready");
          setCooldownEndTime(null);
          clearTicker();
          return;
        }
      } else {
        clearTicker();
        return;
      }

      tickerRef.current = requestAnimationFrame(tick);
    };

    tickerRef.current = requestAnimationFrame(tick);
    return clearTicker;
  }, [state, castStartTime, cooldownEndTime]);

  const handleClick = useCallback(() => {
    const network = world.network as {
      send?: (packet: string, data: unknown) => void;
    };
    if (!network?.send) return;

    if (state === "casting") {
      // Send cancel request - don't reset state until server confirms via HOME_TELEPORT_CAST_CANCEL
      network.send("homeTeleportCancel", {});
    } else if (state === "ready") {
      network.send("homeTeleport", {});
    }
  }, [world, state]);

  // Keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyH" && !e.repeat) {
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") handleClick();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClick]);

  const isCasting = state === "casting";
  const isDisabled = state === "cooldown";
  const cooldownProgress = isDisabled
    ? getHomeTeleportCooldownProgress(cooldownRemaining)
    : 0;

  // Color scheme based on state
  // Ready/cooldown fill: Warm purple/magenta (magical feel)
  // Casting: Bright blue (active)
  // Cooldown shell: Muted gray
  const fillColorStart = isDisabled
    ? "#c084fc"
    : isCasting
      ? "#60a5fa"
      : "#c084fc";
  const fillColorMid = isDisabled
    ? "#a855f7"
    : isCasting
      ? "#3b82f6"
      : "#a855f7";
  const fillColorEnd = isDisabled
    ? "#7c3aed"
    : isCasting
      ? "#2563eb"
      : "#7c3aed";
  const borderColor = isDisabled
    ? "rgba(100, 100, 100, 0.5)"
    : isCasting
      ? "rgba(96, 165, 250, 0.6)"
      : "rgba(192, 132, 252, 0.5)";
  const glowColor = isDisabled
    ? "rgba(100, 100, 100, 0.1)"
    : isCasting
      ? "rgba(96, 165, 250, 0.3)"
      : "rgba(192, 132, 252, 0.25)";
  const iconColor = "#1a1510";

  // Gradient IDs need to be unique per instance
  const gradientId = `homeTeleportGradient-${uniqueId}`;
  const clipId = `homeTeleportClip-${uniqueId}`;

  // SVG handles everything - no CSS border needed
  const center = size / 2;
  const borderWidth = 2;
  const fillRadius = center; // Fill goes edge to edge
  const outerBorderRadius = center - borderWidth / 2; // Border stroke centered on edge

  // Calculate fill percentage based on state
  const fillPercent = isCasting
    ? Math.max(0, Math.min(100, castProgress))
    : isDisabled
      ? cooldownProgress
      : 100;

  // Label text
  const label =
    state === "cooldown"
      ? formatTime(cooldownRemaining)
      : state === "casting"
        ? "X"
        : "H";

  const title =
    state === "cooldown"
      ? `On cooldown (${formatTime(cooldownRemaining)})`
      : state === "casting"
        ? "Click to cancel (H)"
        : "Teleport home (H)";

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        boxShadow: `
          0 2px 8px rgba(0, 0, 0, 0.5),
          0 0 12px ${glowColor}
        `,
        overflow: "hidden",
        transform: isHovered && !isDisabled ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.7 : 1,
      }}
      title={title}
    >
      {/* SVG handles all rendering for pixel-perfect alignment */}
      <svg
        width={size}
        height={size}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={fillColorEnd} />
            <stop offset="50%" stopColor={fillColorMid} />
            <stop offset="100%" stopColor={fillColorStart} />
          </linearGradient>
          <clipPath id={clipId}>
            <circle cx={center} cy={center} r={fillRadius} />
          </clipPath>
        </defs>

        {/* Background shell */}
        <circle
          cx={center}
          cy={center}
          r={fillRadius}
          fill={isDisabled ? "#2c2a31" : "#1a1510"}
        />

        {/* Fill rectangle clipped to circle, height based on progress/state */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={0}
            y={size * (1 - fillPercent / 100)}
            width={size}
            height={size * (fillPercent / 100)}
            fill={`url(#${gradientId})`}
            style={{ transition: "y 0.05s linear, height 0.05s linear" }}
          />
        </g>

        {/* Border ring drawn in SVG for perfect alignment */}
        <circle
          cx={center}
          cy={center}
          r={outerBorderRadius}
          fill="none"
          stroke={borderColor}
          strokeWidth={borderWidth}
        />

        {/* Subtle glass highlight at top */}
        <ellipse
          cx={center}
          cy={center * 0.5}
          rx={fillRadius * 0.45}
          ry={fillRadius * 0.2}
          fill="rgba(255, 255, 255, 0.06)"
        />
      </svg>

      {/* Icon and label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 1,
          gap: 0,
        }}
      >
        {/* Icon */}
        <div style={{ marginTop: -2 }}>
          <HomeIcon size={size * 0.42} color={iconColor} />
        </div>

        {/* Label (H for ready, X for casting, time for cooldown) */}
        <span
          style={{
            fontSize: size * 0.24,
            fontWeight: 700,
            fontFamily:
              "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
            color: iconColor,
            textShadow: `0 0 4px ${fillColorStart}`,
            marginTop: -4,
            letterSpacing: "-0.02em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
